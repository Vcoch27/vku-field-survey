/**
 * Google Apps Script Web App Backend for VKU Field Survey
 *
 * Receives survey submissions from the VKU Field Survey React/PWA/Capacitor client,
 * saves photos into a dedicated Google Drive folder,
 * and appends records with photo hyperlinks to a private Google Sheet.
 *
 * Architecture:
 * Client (HTTPS POST) -> Apps Script Web App (Executes as owner)
 *                       ├─> Google Drive Folder ("VKU_Field_Survey_Photos")
 *                       └─> Private Google Sheet ("SurveyResponses" sheet)
 */

const DEFAULT_SHEET_NAME = 'SurveyResponses';
const DEFAULT_FOLDER_NAME = 'VKU_Field_Survey_Photos';

const HEADERS = [
  'submission_id',
  'submitted_at',
  'zone',
  'building',
  'room_number',
  'room_identifier',
  'category',
  'condition_rating',
  'defect_notes',
  'photo_id',
  'photo_url',
  'photo_captured_at',
  'synced_at',
];

const VALID_CATEGORIES = ['Hardware', 'Projector', 'AC', 'Electrical', 'Furniture'];
const VALID_ZONES = ['K', 'V'];
const VALID_RATINGS = [1, 2, 3, 4, 5];

/**
 * Health check endpoint for testing Web App availability.
 */
function doGet(e) {
  return createJsonResponse({
    ok: true,
    service: 'VKU Field Survey Submission Endpoint',
    version: '1.1.0',
    timestamp: new Date().toISOString(),
  });
}

/**
 * Primary ingestion endpoint for offline survey sync dispatch.
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  const hasLock = lock.tryLock(15000); // Wait up to 15s for concurrent lock

  if (!hasLock) {
    return createJsonResponse({
      ok: false,
      acknowledged: false,
      error: {
        code: 'CONCURRENCY_LOCK_TIMEOUT',
        message: 'Server was busy processing another submission. Please retry.',
      },
    });
  }

  try {
    // 1. Parse JSON body
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({
        ok: false,
        acknowledged: false,
        error: {
          code: 'EMPTY_REQUEST_BODY',
          message: 'Request body must be non-empty JSON.',
        },
      });
    }

    let payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return createJsonResponse({
        ok: false,
        acknowledged: false,
        error: {
          code: 'MALFORMED_JSON',
          message: 'Unable to parse JSON request body: ' + parseErr.message,
        },
      });
    }

    // 2. Validate optional client token if WRITE_TOKEN property is set
    const scriptProperties = PropertiesService.getScriptProperties();
    const expectedToken = scriptProperties.getProperty('WRITE_TOKEN');
    if (expectedToken && expectedToken.trim() !== '') {
      const clientToken = payload.clientToken || (e.parameter && e.parameter.token);
      if (clientToken !== expectedToken) {
        return createJsonResponse({
          ok: false,
          acknowledged: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid client token.',
          },
        });
      }
    }

    // 3. Validate required domain fields
    const validationError = validatePayload(payload);
    if (validationError) {
      return createJsonResponse({
        ok: false,
        acknowledged: false,
        error: {
          code: 'INVALID_PAYLOAD',
          message: validationError,
        },
      });
    }

    // 4. Open Target Spreadsheet and Worksheet
    const sheet = getTargetSheet(scriptProperties);
    if (!sheet) {
      return createJsonResponse({
        ok: false,
        acknowledged: false,
        error: {
          code: 'SHEET_NOT_FOUND',
          message: 'Target worksheet not found. Please run setupSheet() first.',
        },
      });
    }

    // Ensure headers exist and match current schema
    ensureHeaderColumns(sheet);

    // 5. Idempotency Check: Prevent duplicate submission_id insertion
    const submissionId = String(payload.submissionId).trim();
    const existingRowIndex = findRowBySubmissionId(sheet, submissionId);

    if (existingRowIndex > 0) {
      // Already persisted -> Return ACK with duplicate: true (idempotent success)
      return createJsonResponse({
        ok: true,
        acknowledged: true,
        submissionId: submissionId,
        duplicate: true,
        message: 'Submission already recorded.',
      });
    }

    // 6. Format derived room identifier if not provided
    const zone = String(payload.zone).trim().toUpperCase();
    const building = String(payload.building).trim();
    const roomNumber = String(payload.roomNumber).trim();
    const roomIdentifier = payload.roomIdentifier
      ? String(payload.roomIdentifier).trim()
      : `${zone}.${building}-${roomNumber}`;

    // 7. Process Photo upload to Google Drive Folder (if photoBase64 is present)
    let photoUrl = '';
    if (
      payload.photoBase64 &&
      typeof payload.photoBase64 === 'string' &&
      payload.photoBase64.trim() !== ''
    ) {
      try {
        const folder = getOrCreatePhotosFolder(scriptProperties);
        const cleanBase64 = payload.photoBase64.replace(/^data:image\/[a-z]+;base64,/, '');
        const decodedBytes = Utilities.base64Decode(cleanBase64);
        const fileName = `${roomIdentifier}_${submissionId}.jpg`;
        const imageBlob = Utilities.newBlob(decodedBytes, 'image/jpeg', fileName);
        const file = folder.createFile(imageBlob);

        // Allow anyone with the link to view the photo
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        photoUrl = file.getUrl();
      } catch (photoErr) {
        Logger.log('Photo upload error: ' + photoErr.toString());
        photoUrl = 'Upload error: ' + photoErr.message;
      }
    }

    // 8. Build Row and Append to Sheet (uses direct photoUrl initially, then applies RichText)
    const newRow = [
      submissionId,
      String(payload.submittedAt || new Date().toISOString()),
      zone,
      building,
      roomNumber,
      roomIdentifier,
      String(payload.category),
      Number(payload.conditionRating),
      payload.defectNotes ? String(payload.defectNotes) : '',
      payload.photoId ? String(payload.photoId) : '',
      photoUrl || '',
      payload.photoCapturedAt ? String(payload.photoCapturedAt) : '',
      new Date().toISOString(), // synced_at timestamp
    ];

    sheet.appendRow(newRow);

    // 9. Format photo_url cell as clickable RichText "Xem ảnh" (avoids formula syntax #ERROR! in non-US locales)
    if (photoUrl && photoUrl.startsWith('http')) {
      try {
        const lastRow = sheet.getLastRow();
        const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const photoCol = currentHeaders.indexOf('photo_url') + 1;
        if (photoCol > 0) {
          const richText = SpreadsheetApp.newRichTextValue()
            .setText('Xem ảnh')
            .setLinkUrl(photoUrl)
            .build();
          sheet.getRange(lastRow, photoCol).setRichTextValue(richText);
        }
      } catch (richTextErr) {
        Logger.log('RichText format note: ' + richTextErr.toString());
      }
    }

    SpreadsheetApp.flush();

    return createJsonResponse({
      ok: true,
      acknowledged: true,
      submissionId: submissionId,
      duplicate: false,
      photoUrl: photoUrl || null,
      message: 'Survey submission successfully appended to sheet.',
    });
  } catch (err) {
    return createJsonResponse({
      ok: false,
      acknowledged: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: err.toString(),
      },
    });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Validates survey submission fields against VKU domain rules.
 */
function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return 'Payload must be a JSON object.';
  }

  if (
    !payload.submissionId ||
    typeof payload.submissionId !== 'string' ||
    payload.submissionId.trim() === ''
  ) {
    return 'Missing required field: submissionId (must be a non-empty UUID string).';
  }

  if (!payload.submittedAt || typeof payload.submittedAt !== 'string') {
    return 'Missing required field: submittedAt (ISO 8601 string).';
  }

  if (!VALID_ZONES.includes(payload.zone)) {
    return 'Invalid zone: ' + payload.zone + '. Must be "K" or "V".';
  }

  if (!payload.building || typeof payload.building !== 'string' || payload.building.trim() === '') {
    return 'Missing required field: building.';
  }

  if (
    !payload.roomNumber ||
    typeof payload.roomNumber !== 'string' ||
    payload.roomNumber.trim() === ''
  ) {
    return 'Missing required field: roomNumber.';
  }

  if (!VALID_CATEGORIES.includes(payload.category)) {
    return 'Invalid category: ' + payload.category + '. Allowed: ' + VALID_CATEGORIES.join(', ');
  }

  const rating = Number(payload.conditionRating);
  if (!VALID_RATINGS.includes(rating)) {
    return 'Invalid conditionRating: ' + payload.conditionRating + '. Must be integer 1 to 5.';
  }

  return null;
}

/**
 * Searches column 1 (submission_id) for an existing ID.
 * Returns 1-based row index if found, or -1 if not found.
 */
function findRowBySubmissionId(sheet, submissionId) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return -1;
  }

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === submissionId) {
      return i + 2;
    }
  }
  return -1;
}

/**
 * Resolves the Google Drive folder for saving photos.
 */
function getOrCreatePhotosFolder(scriptProperties) {
  const folderId = scriptProperties.getProperty('PHOTOS_FOLDER_ID');
  if (folderId && folderId.trim() !== '') {
    try {
      return DriveApp.getFolderById(folderId.trim());
    } catch (e) {
      Logger.log('Configured PHOTOS_FOLDER_ID not found, searching by name...');
    }
  }

  const folderName = scriptProperties.getProperty('PHOTOS_FOLDER_NAME') || DEFAULT_FOLDER_NAME;
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    const f = folders.next();
    scriptProperties.setProperty('PHOTOS_FOLDER_ID', f.getId());
    return f;
  }

  const newFolder = DriveApp.createFolder(folderName);
  newFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  scriptProperties.setProperty('PHOTOS_FOLDER_ID', newFolder.getId());
  Logger.log('Created Google Drive folder: ' + folderName + ' (ID: ' + newFolder.getId() + ')');
  return newFolder;
}

/**
 * Resolves the target Google Spreadsheet and Worksheet.
 */
function getTargetSheet(scriptProperties) {
  const spreadsheetId = scriptProperties.getProperty('SPREADSHEET_ID');
  const sheetName = scriptProperties.getProperty('SHEET_NAME') || DEFAULT_SHEET_NAME;

  let ss;
  if (spreadsheetId && spreadsheetId.trim() !== '') {
    ss = SpreadsheetApp.openById(spreadsheetId.trim());
  } else {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  }

  if (!ss) {
    throw new Error('Spreadsheet could not be accessed. Set SPREADSHEET_ID in Script Properties.');
  }

  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  return sheet;
}

/**
 * Ensures header row has all current columns (including photo_url).
 * If photo_url is missing in an existing sheet, safely inserts it.
 */
function ensureHeaderColumns(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    formatHeaderRow(sheet);
    return;
  }

  const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const headerStrings = currentHeaders.map(function (h) {
    return String(h).trim();
  });

  // If photo_url is missing, insert column K
  if (!headerStrings.includes('photo_url')) {
    const photoIdIndex = headerStrings.indexOf('photo_id');
    const insertCol = photoIdIndex >= 0 ? photoIdIndex + 2 : sheet.getLastColumn() + 1;
    sheet.insertColumnAfter(photoIdIndex >= 0 ? photoIdIndex + 1 : sheet.getLastColumn());
    sheet.getRange(1, insertCol).setValue('photo_url');
    formatHeaderRow(sheet);
    Logger.log('Inserted missing "photo_url" column at index ' + insertCol);
  }
}

function formatHeaderRow(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), HEADERS.length);
  const headerRange = sheet.getRange(1, 1, 1, lastCol);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#0284C7');
  headerRange.setFontColor('#FFFFFF');
  sheet.setFrozenRows(1);
}

/**
 * Helper function for human setup:
 * Creates worksheet 'SurveyResponses' and Drive folder 'VKU_Field_Survey_Photos'.
 */
function setupSheet() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const sheet = getTargetSheet(scriptProperties);
  ensureHeaderColumns(sheet);

  const folder = getOrCreatePhotosFolder(scriptProperties);
  Logger.log(
    'Setup complete: Sheet "' +
      sheet.getName() +
      '" and Drive folder "' +
      folder.getName() +
      '" are ready.'
  );
}

/**
 * Helper to build JSON responses.
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON
  );
}
