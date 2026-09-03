/**
 * Google Apps Script Web App Backend for VKU Field Survey
 *
 * Receives survey submissions from the VKU Field Survey React/PWA/Capacitor client
 * and appends them to a private Google Sheet.
 *
 * Architecture:
 * Client (HTTPS POST) -> Apps Script Web App (Executes as owner) -> Private Google Sheet
 */

const DEFAULT_SHEET_NAME = 'SurveyResponses';

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
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
}

/**
 * Primary ingestion endpoint for offline survey sync dispatch.
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  const hasLock = lock.tryLock(10000); // Wait up to 10s for concurrent lock

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

    // Ensure header row exists
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
    }

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

    // 7. Append Row
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
      payload.photoCapturedAt ? String(payload.photoCapturedAt) : '',
      new Date().toISOString(), // synced_at timestamp
    ];

    sheet.appendRow(newRow);
    SpreadsheetApp.flush();

    return createJsonResponse({
      ok: true,
      acknowledged: true,
      submissionId: submissionId,
      duplicate: false,
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
 * Returns an error string if invalid, or null if valid.
 */
function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return 'Payload must be a JSON object.';
  }

  if (!payload.submissionId || typeof payload.submissionId !== 'string' || payload.submissionId.trim() === '') {
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

  if (!payload.roomNumber || typeof payload.roomNumber !== 'string' || payload.roomNumber.trim() === '') {
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
    return -1; // Only header or empty
  }

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === submissionId) {
      return i + 2; // Row number (1-based, skipping header row 1)
    }
  }
  return -1;
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
    // If bound to a spreadsheet
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
 * Helper function for human setup:
 * Creates worksheet 'SurveyResponses' if missing, writes header row,
 * and freezes top row. Safe to run multiple times (will not overwrite data).
 */
function setupSheet() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const sheet = getTargetSheet(scriptProperties);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#0284C7');
    headerRange.setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, HEADERS.length);
    Logger.log('Setup complete: Header row written to sheet "' + sheet.getName() + '".');
  } else {
    Logger.log('Sheet "' + sheet.getName() + '" already has ' + sheet.getLastRow() + ' rows. No headers modified.');
  }
}

/**
 * Helper to build JSON responses with CORS headers.
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
