import type { IDBPDatabase } from 'idb';
import type {
  CampusZone,
  ClaimedSubmission,
  FailureDisposition,
  InspectionDraft,
  InspectionSnapshot,
  IsoTimestamp,
  PhotoAttachment,
  SurveySubmission,
  SyncStatus,
  Uuid,
} from '../domain/models.ts';
import type { SurveyStoragePort } from '../domain/ports.ts';
import { isCampusZone } from '../domain/validation.ts';
import {
  DRAFT_LAST_MODIFIED_INDEX,
  DRAFT_STORE,
  openSurveyDatabase,
  SUBMISSION_STORE,
  SUBMISSION_TIMESTAMP_INDEX,
  type StoredDraftRecord,
  type StoredInspectionSnapshot,
  type StoredSubmissionRecord,
  type SurveyDatabase,
} from './idbSchema.ts';

export interface ClaimMetadata {
  readonly claimToken: string;
  readonly claimedAt: IsoTimestamp;
}

export interface IdbSurveyStorageOptions {
  readonly databaseName?: string;
  readonly createClaimMetadata: () => ClaimMetadata;
}

function toDurablePhoto(photo: PhotoAttachment | null): PhotoAttachment | null {
  if (photo === null) {
    return null;
  }

  return {
    id: photo.id,
    binaryData: photo.binaryData,
    capturedAt: photo.capturedAt,
  };
}

function toDurableDraft(draft: InspectionDraft): StoredDraftRecord {
  return {
    id: draft.id,
    zone: draft.zone,
    building: draft.building,
    roomNumber: draft.roomNumber,
    category: draft.category,
    conditionRating: draft.conditionRating,
    defectNotes: draft.defectNotes,
    photo: toDurablePhoto(draft.photo),
    lastModifiedAt: draft.lastModifiedAt,
  };
}

function toDomainDraft(stored: StoredDraftRecord): InspectionDraft {
  return {
    id: stored.id,
    zone: isCampusZone(stored.zone) ? stored.zone : null,
    building: stored.building ?? '',
    roomNumber: stored.roomNumber ?? '',
    category: stored.category ?? null,
    conditionRating: stored.conditionRating ?? null,
    defectNotes: stored.defectNotes ?? '',
    photo: stored.photo ?? null,
    lastModifiedAt: stored.lastModifiedAt,
  };
}

function toDurableSubmission(submission: SurveySubmission): StoredSubmissionRecord {
  return {
    id: submission.id,
    timestamp: submission.timestamp,
    surveyData: {
      zone: submission.surveyData.zone,
      building: submission.surveyData.building,
      roomNumber: submission.surveyData.roomNumber,
      category: submission.surveyData.category,
      conditionRating: submission.surveyData.conditionRating,
      defectNotes: submission.surveyData.defectNotes,
      photo: toDurablePhoto(submission.surveyData.photo),
    },
    syncStatus: submission.syncStatus,
    ...(submission.lastErrorMessage === undefined
      ? {}
      : { lastErrorMessage: submission.lastErrorMessage }),
    ...(submission.failureDisposition === undefined
      ? {}
      : { failureDisposition: submission.failureDisposition }),
  };
}

function isEligibleForClaim(record: StoredSubmissionRecord): record is StoredSubmissionRecord & {
  surveyData: StoredInspectionSnapshot & { zone: CampusZone };
} {
  if (!isCampusZone(record.surveyData.zone)) {
    return false;
  }

  if (record.syncStatus === 'PENDING_SYNC') {
    return true;
  }

  if (record.syncStatus === 'SYNC_FAILED') {
    return record.failureDisposition !== 'REQUIRES_ATTENTION';
  }

  return false;
}

function toDomainSubmission(
  record: StoredSubmissionRecord & {
    surveyData: StoredInspectionSnapshot & { zone: CampusZone };
  }
): SurveySubmission {
  const surveyData: InspectionSnapshot = {
    zone: record.surveyData.zone,
    building: record.surveyData.building,
    roomNumber: record.surveyData.roomNumber,
    category: record.surveyData.category,
    conditionRating: record.surveyData.conditionRating,
    defectNotes: record.surveyData.defectNotes,
    photo: record.surveyData.photo,
  };

  const submission: SurveySubmission = {
    id: record.id,
    timestamp: record.timestamp,
    surveyData,
    syncStatus: record.syncStatus,
  };

  return {
    ...submission,
    ...(record.lastErrorMessage === undefined ? {} : { lastErrorMessage: record.lastErrorMessage }),
    ...(record.failureDisposition === undefined
      ? {}
      : { failureDisposition: record.failureDisposition }),
  };
}

function withStatus(
  record: StoredSubmissionRecord,
  status: SyncStatus,
  errorMessage?: string,
  failureDisposition?: FailureDisposition
): StoredSubmissionRecord {
  const updated: StoredSubmissionRecord = {
    id: record.id,
    timestamp: record.timestamp,
    surveyData: record.surveyData,
    syncStatus: status,
    ...(errorMessage === undefined ? {} : { lastErrorMessage: errorMessage }),
    ...(status === 'SYNC_FAILED'
      ? { failureDisposition: failureDisposition ?? record.failureDisposition ?? 'RETRYABLE' }
      : {}),
  };

  if (status === 'SYNCING' && record.claimToken !== undefined && record.claimedAt !== undefined) {
    return {
      ...updated,
      claimToken: record.claimToken,
      claimedAt: record.claimedAt,
    };
  }

  return updated;
}

export class IdbSurveyStorage implements SurveyStoragePort {
  private readonly database: Promise<IDBPDatabase<SurveyDatabase>>;
  private readonly createClaimMetadata: () => ClaimMetadata;

  constructor(options: IdbSurveyStorageOptions) {
    this.database = openSurveyDatabase(options.databaseName);
    this.createClaimMetadata = options.createClaimMetadata;
  }

  async close(): Promise<void> {
    const database = await this.database;
    database.close();
  }

  async saveDraft(draft: InspectionDraft): Promise<void> {
    const database = await this.database;
    await database.put(DRAFT_STORE, toDurableDraft(draft));
  }

  async getDraft(draftId?: Uuid): Promise<InspectionDraft | null> {
    const database = await this.database;

    if (draftId !== undefined) {
      const stored = await database.get(DRAFT_STORE, draftId);
      return stored ? toDomainDraft(stored) : null;
    }

    const cursor = await database
      .transaction(DRAFT_STORE)
      .store.index(DRAFT_LAST_MODIFIED_INDEX)
      .openCursor(null, 'prev');

    return cursor?.value ? toDomainDraft(cursor.value) : null;
  }

  async clearDraft(draftId: Uuid): Promise<void> {
    const database = await this.database;
    await database.delete(DRAFT_STORE, draftId);
  }

  async enqueueSubmissionAndClearDraft(
    submission: SurveySubmission,
    draftId?: Uuid
  ): Promise<void> {
    if (submission.syncStatus !== 'PENDING_SYNC') {
      throw new Error('A newly queued submission must be PENDING_SYNC');
    }

    const database = await this.database;
    const transaction = database.transaction([DRAFT_STORE, SUBMISSION_STORE], 'readwrite');

    try {
      await transaction.objectStore(SUBMISSION_STORE).add(toDurableSubmission(submission));

      if (draftId !== undefined) {
        await transaction.objectStore(DRAFT_STORE).delete(draftId);
      }

      await transaction.done;
    } catch (err) {
      await transaction.done.catch(() => {});
      throw err;
    }
  }

  enqueueSubmission(submission: SurveySubmission): Promise<void> {
    return this.enqueueSubmissionAndClearDraft(submission, undefined);
  }

  async getPendingSubmissions(): Promise<readonly SurveySubmission[]> {
    const database = await this.database;
    const transaction = database.transaction(SUBMISSION_STORE);
    const submissions: SurveySubmission[] = [];
    let cursor = await transaction.store.index(SUBMISSION_TIMESTAMP_INDEX).openCursor();

    while (cursor !== null) {
      if (isEligibleForClaim(cursor.value)) {
        submissions.push(toDomainSubmission(cursor.value));
      }
      cursor = await cursor.continue();
    }

    await transaction.done;
    return submissions;
  }

  async getAllSubmissions(): Promise<readonly SurveySubmission[]> {
    const database = await this.database;
    const transaction = database.transaction(SUBMISSION_STORE);
    const submissions: SurveySubmission[] = [];
    // Open cursor in descending timestamp order ('prev') so newest records appear first
    let cursor = await transaction.store.index(SUBMISSION_TIMESTAMP_INDEX).openCursor(null, 'prev');

    while (cursor !== null) {
      if (isCampusZone(cursor.value.surveyData.zone)) {
        submissions.push(
          toDomainSubmission(
            cursor.value as StoredSubmissionRecord & {
              surveyData: StoredInspectionSnapshot & { zone: CampusZone };
            }
          )
        );
      }
      cursor = await cursor.continue();
    }

    await transaction.done;
    return submissions;
  }

  async getSubmissionById(id: Uuid): Promise<SurveySubmission | null> {
    const database = await this.database;
    const stored = await database.get(SUBMISSION_STORE, id);
    if (stored && isCampusZone(stored.surveyData.zone)) {
      return toDomainSubmission(
        stored as StoredSubmissionRecord & {
          surveyData: StoredInspectionSnapshot & { zone: CampusZone };
        }
      );
    }
    return null;
  }

  async atomicClaimNext(options?: {
    readonly excludeIds?: ReadonlySet<Uuid>;
  }): Promise<ClaimedSubmission | null> {
    const database = await this.database;
    const transaction = database.transaction(SUBMISSION_STORE, 'readwrite');
    let cursor = await transaction.store.index(SUBMISSION_TIMESTAMP_INDEX).openCursor();

    while (
      cursor !== null &&
      (!isEligibleForClaim(cursor.value) ||
        (options?.excludeIds !== undefined && options.excludeIds.has(cursor.value.id)))
    ) {
      cursor = await cursor.continue();
    }

    if (cursor === null) {
      await transaction.done;
      return null;
    }

    const candidate = cursor.value;
    if (!isEligibleForClaim(candidate)) {
      await transaction.done;
      return null;
    }

    const claim = this.createClaimMetadata();
    const claimedRecord = {
      ...candidate,
      syncStatus: 'SYNCING' as const,
      claimToken: claim.claimToken,
      claimedAt: claim.claimedAt,
    };

    await cursor.update(claimedRecord);
    await transaction.done;

    return {
      submission: toDomainSubmission(claimedRecord),
      claimToken: claim.claimToken,
      claimedAt: claim.claimedAt,
    };
  }

  async recoverStaleClaims(staleTimeoutMs: number): Promise<number> {
    const database = await this.database;
    const transaction = database.transaction(SUBMISSION_STORE, 'readwrite');
    const now = Date.now();
    let recoveredCount = 0;
    let cursor = await transaction.store.openCursor();

    while (cursor !== null) {
      const record = cursor.value;
      if (record.syncStatus === 'SYNCING' && record.claimedAt !== undefined) {
        const claimedTime = new Date(record.claimedAt).getTime();
        if (now - claimedTime >= staleTimeoutMs) {
          const updated: StoredSubmissionRecord = {
            id: record.id,
            timestamp: record.timestamp,
            surveyData: record.surveyData,
            syncStatus: 'SYNC_FAILED',
            failureDisposition: 'RETRYABLE',
            lastErrorMessage: 'Claim timed out and was recovered',
          };
          await cursor.update(updated);
          recoveredCount += 1;
        }
      }
      cursor = await cursor.continue();
    }

    await transaction.done;
    return recoveredCount;
  }

  async updateSubmissionStatus(
    submissionId: Uuid,
    status: SyncStatus,
    errorMessage?: string,
    failureDisposition?: FailureDisposition
  ): Promise<void> {
    const database = await this.database;
    const transaction = database.transaction(SUBMISSION_STORE, 'readwrite');
    const record = await transaction.store.get(submissionId);

    if (record === undefined) {
      throw new Error(`Submission ${submissionId} was not found`);
    }

    await transaction.store.put(withStatus(record, status, errorMessage, failureDisposition));
    await transaction.done;
  }

  markSubmissionSynced(submissionId: Uuid, acknowledgementDetails?: unknown): Promise<void> {
    void acknowledgementDetails;
    return this.updateSubmissionStatus(submissionId, 'SYNCED');
  }

  async deleteSubmission(submissionId: Uuid): Promise<boolean> {
    const database = await this.database;
    const transaction = database.transaction(SUBMISSION_STORE, 'readwrite');
    const existing = await transaction.store.get(submissionId);
    if (existing === undefined) {
      await transaction.done;
      return false;
    }
    await transaction.store.delete(submissionId);
    await transaction.done;
    return true;
  }

  async resetSubmissionToPending(submissionId: Uuid): Promise<boolean> {
    const database = await this.database;
    const transaction = database.transaction(SUBMISSION_STORE, 'readwrite');
    const existing = await transaction.store.get(submissionId);
    if (existing === undefined) {
      await transaction.done;
      return false;
    }

    const resetRecord: StoredSubmissionRecord = {
      id: existing.id,
      timestamp: existing.timestamp,
      surveyData: existing.surveyData,
      syncStatus: 'PENDING_SYNC',
    };

    await transaction.store.put(resetRecord);
    await transaction.done;
    return true;
  }
}
