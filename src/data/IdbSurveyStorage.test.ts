import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type {
  InspectionDraft,
  InspectionSnapshot,
  PhotoAttachment,
  SurveySubmission,
} from '../domain/models.ts';
import { IdbSurveyStorage } from './IdbSurveyStorage.ts';
import { DRAFT_STORE, openSurveyDatabase, SUBMISSION_STORE } from './idbSchema.ts';

const photoBytes = new Uint8Array([137, 80, 78, 71]);

function createPhoto() {
  return {
    id: 'photo-id',
    displayUri: 'blob:preview-only',
    binaryData: new Blob([photoBytes], { type: 'image/png' }),
    capturedAt: '2026-09-02T10:00:00.000Z',
  } as const;
}

async function readPhotoBytes(photo: PhotoAttachment | null | undefined): Promise<Uint8Array> {
  if (photo === null || photo === undefined) {
    throw new Error('Expected a durable photo attachment');
  }

  return new Uint8Array(await photo.binaryData.arrayBuffer());
}

function createDraft(overrides: Partial<InspectionDraft> = {}): InspectionDraft {
  return {
    id: 'draft-1',
    zone: 'K',
    building: 'Building A',
    roomNumber: '201',
    category: 'Hardware',
    conditionRating: 4,
    defectNotes: 'Projector cable damaged',
    photo: createPhoto(),
    lastModifiedAt: '2026-09-02T10:00:00.000Z',
    ...overrides,
  };
}

function createSubmission(overrides: Partial<SurveySubmission> = {}): SurveySubmission {
  const surveyData: InspectionSnapshot = {
    zone: 'K',
    building: 'Building A',
    roomNumber: '201',
    category: 'Hardware',
    conditionRating: 4,
    defectNotes: 'Projector cable damaged',
    photo: createPhoto(),
  };

  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    timestamp: '2026-09-02T10:00:00.000Z',
    surveyData,
    syncStatus: 'PENDING_SYNC',
    ...overrides,
  };
}

describe('IdbSurveyStorage', () => {
  let databaseName: string;
  let claimSequence: number;
  let storage: IdbSurveyStorage;

  beforeEach(() => {
    databaseName = `vku-field-survey-test-${crypto.randomUUID()}`;
    claimSequence = 0;
    storage = createStorage();
  });

  afterEach(async () => {
    await storage.close();
    indexedDB.deleteDatabase(databaseName);
  });

  function createStorage(): IdbSurveyStorage {
    return new IdbSurveyStorage({
      databaseName,
      createClaimMetadata: () => {
        claimSequence += 1;
        return {
          claimToken: `claim-${claimSequence}`,
          claimedAt: `2026-09-02T10:00:0${claimSequence}.000Z`,
        };
      },
    });
  }

  it('saves, overwrites, isolates, and recovers drafts', async () => {
    const firstDraft = createDraft();
    const updatedDraft = createDraft({
      roomNumber: '301',
      lastModifiedAt: '2026-09-02T10:01:00.000Z',
    });
    const secondDraft = createDraft({
      id: 'draft-2',
      building: 'Building B',
      lastModifiedAt: '2026-09-02T10:02:00.000Z',
    });

    await storage.saveDraft(firstDraft);
    await storage.saveDraft(updatedDraft);
    await storage.saveDraft(secondDraft);

    expect(await storage.getDraft(firstDraft.id)).toMatchObject({ roomNumber: '301' });
    expect(await storage.getDraft(secondDraft.id)).toMatchObject({
      building: 'Building B',
    });
    expect(await storage.getDraft()).toMatchObject({ id: 'draft-2' });
  });

  it('keeps draft photo bytes across database reopen', async () => {
    const draft = createDraft();
    await storage.saveDraft(draft);
    await storage.close();

    storage = createStorage();
    const recovered = await storage.getDraft(draft.id);

    expect(recovered?.photo?.displayUri).toBeUndefined();
    expect(recovered?.photo?.binaryData).toBeInstanceOf(Blob);
    expect(await readPhotoBytes(recovered?.photo)).toEqual(photoBytes);
  });

  it('keeps queued identity, status, and photo durable across reopen', async () => {
    const submission = createSubmission();
    await storage.enqueueSubmission(submission);
    await storage.close();

    storage = createStorage();
    const [recovered] = await storage.getPendingSubmissions();

    expect(recovered).toMatchObject({
      id: submission.id,
      timestamp: submission.timestamp,
      syncStatus: 'PENDING_SYNC',
    });
    expect(await readPhotoBytes(recovered.surveyData.photo)).toEqual(photoBytes);
  });

  it('updates status without deleting submission data or photo', async () => {
    const submission = createSubmission();
    await storage.enqueueSubmission(submission);

    await storage.updateSubmissionStatus(submission.id, 'SYNC_FAILED', 'destination unavailable');

    const [failed] = await storage.getPendingSubmissions();
    expect(failed).toMatchObject({
      id: submission.id,
      timestamp: submission.timestamp,
      syncStatus: 'SYNC_FAILED',
      lastErrorMessage: 'destination unavailable',
    });
    expect(await readPhotoBytes(failed.surveyData.photo)).toEqual(photoBytes);

    await storage.markSubmissionSynced(submission.id);

    expect(await storage.getPendingSubmissions()).toEqual([]);
    const database = await openSurveyDatabase(databaseName);
    const stored = await database.get(SUBMISSION_STORE, submission.id);
    database.close();
    expect(stored?.syncStatus).toBe('SYNCED');
    expect(await readPhotoBytes(stored?.surveyData.photo)).toEqual(photoBytes);
  });

  it('atomically claims an eligible record once and persists the claim', async () => {
    const submission = createSubmission();
    await storage.enqueueSubmission(submission);

    const claims = await Promise.all([storage.atomicClaimNext(), storage.atomicClaimNext()]);
    const completedClaims = claims.filter((claim) => claim !== null);

    expect(completedClaims).toHaveLength(1);
    expect(completedClaims[0]).toMatchObject({
      submission: {
        id: submission.id,
        syncStatus: 'SYNCING',
      },
      claimToken: 'claim-1',
      claimedAt: '2026-09-02T10:00:01.000Z',
    });
    expect(await storage.getPendingSubmissions()).toEqual([]);

    await storage.close();
    storage = createStorage();

    expect(await storage.atomicClaimNext()).toBeNull();
    const database = await openSurveyDatabase(databaseName);
    const stored = await database.get(SUBMISSION_STORE, submission.id);
    database.close();
    expect(stored).toMatchObject({
      syncStatus: 'SYNCING',
      claimToken: 'claim-1',
      claimedAt: '2026-09-02T10:00:01.000Z',
    });
  });

  it('claims eligible submissions in timestamp order', async () => {
    const later = createSubmission({
      id: 'later-id',
      timestamp: '2026-09-02T11:00:00.000Z',
    });
    const earlier = createSubmission({
      id: 'earlier-id',
      timestamp: '2026-09-02T09:00:00.000Z',
    });
    await storage.enqueueSubmission(later);
    await storage.enqueueSubmission(earlier);

    const claim = await storage.atomicClaimNext();

    expect(claim?.submission.id).toBe('earlier-id');
  });

  it('surfaces duplicate queue writes instead of silently overwriting', async () => {
    const submission = createSubmission();
    await storage.enqueueSubmission(submission);

    await expect(storage.enqueueSubmission(submission)).rejects.toBeDefined();
  });

  it('skips excluded IDs when claiming next eligible record', async () => {
    const first = createSubmission({
      id: 'first-id',
      timestamp: '2026-09-02T09:00:00.000Z',
    });
    const second = createSubmission({
      id: 'second-id',
      timestamp: '2026-09-02T10:00:00.000Z',
    });
    await storage.enqueueSubmission(first);
    await storage.enqueueSubmission(second);

    const claim = await storage.atomicClaimNext({
      excludeIds: new Set(['first-id']),
    });

    expect(claim?.submission.id).toBe('second-id');
  });

  it('recovers stale claims older than configured timeout', async () => {
    const submission = createSubmission({ id: 'stale-claim-test' });
    await storage.enqueueSubmission(submission);

    // Set record to SYNCING with an old claimedAt
    const db = await openSurveyDatabase(databaseName);
    const tx = db.transaction(SUBMISSION_STORE, 'readwrite');
    const record = await tx.store.get('stale-claim-test');
    if (!record) throw new Error('Record not found');
    const updatedRecord = {
      ...record,
      syncStatus: 'SYNCING' as const,
      claimToken: 'abandoned-token',
      claimedAt: new Date(Date.now() - 40_000).toISOString(),
    };
    await tx.store.put(updatedRecord);
    await tx.done;
    db.close();

    // Recover claims older than 30s
    const recovered = await storage.recoverStaleClaims(30_000);
    expect(recovered).toBe(1);

    // Verify it transitioned to SYNC_FAILED and is now eligible for atomicClaimNext
    const claim = await storage.atomicClaimNext();
    expect(claim?.submission.id).toBe('stale-claim-test');
  });

  it('atomicClaimNext excludes SYNC_FAILED submissions with REQUIRES_ATTENTION disposition', async () => {
    const attentionSub = createSubmission({
      id: 'sub-attention',
      timestamp: '2026-09-02T09:00:00.000Z',
    });
    const retryableSub = createSubmission({
      id: 'sub-retryable',
      timestamp: '2026-09-02T10:00:00.000Z',
    });

    await storage.enqueueSubmission(attentionSub);
    await storage.enqueueSubmission(retryableSub);

    await storage.updateSubmissionStatus(
      'sub-attention',
      'SYNC_FAILED',
      'Requires human check',
      'REQUIRES_ATTENTION'
    );
    await storage.updateSubmissionStatus(
      'sub-retryable',
      'SYNC_FAILED',
      'Temporary 503',
      'RETRYABLE'
    );

    // sub-attention is earlier in timestamp order, but has REQUIRES_ATTENTION disposition.
    // atomicClaimNext must skip it and claim sub-retryable!
    const claim = await storage.atomicClaimNext();
    expect(claim?.submission.id).toBe('sub-retryable');
  });

  it('CR-001: draft with zone round-trips through IndexedDB and survives DB reopen', async () => {
    const draft = createDraft({
      id: 'draft-zone-test',
      zone: 'V',
      building: 'B',
      roomNumber: '505',
    });
    await storage.saveDraft(draft);

    const recoveredBeforeClose = await storage.getDraft('draft-zone-test');
    expect(recoveredBeforeClose?.zone).toBe('V');
    expect(recoveredBeforeClose?.building).toBe('B');
    expect(recoveredBeforeClose?.roomNumber).toBe('505');

    // Close and reopen database
    await storage.close();
    storage = createStorage();

    const recoveredAfterReopen = await storage.getDraft('draft-zone-test');
    expect(recoveredAfterReopen?.zone).toBe('V');
    expect(recoveredAfterReopen?.building).toBe('B');
    expect(recoveredAfterReopen?.roomNumber).toBe('505');
  });

  it('CR-001: legacy draft without zone recovers with zone = null and ignores obsolete floor', async () => {
    const db = await openSurveyDatabase(databaseName);
    const tx = db.transaction(DRAFT_STORE, 'readwrite');
    // Simulate pre-CR-001 legacy record directly stored in IndexedDB
    await tx.store.put({
      id: 'legacy-draft-1',
      building: 'VJIT Building',
      floor: '3rd Floor',
      roomNumber: '302',
      category: 'AC',
      conditionRating: 3,
      defectNotes: 'Old notes',
      lastModifiedAt: '2026-09-02T10:00:00.000Z',
    });
    await tx.done;
    db.close();

    const recovered = await storage.getDraft('legacy-draft-1');
    expect(recovered).not.toBeNull();
    expect(recovered?.id).toBe('legacy-draft-1');
    expect(recovered?.zone).toBeNull(); // Cleanly recovers as null
    expect(recovered?.building).toBe('VJIT Building');
    expect(recovered?.roomNumber).toBe('302');
    expect('floor' in (recovered as unknown as Record<string, unknown>)).toBe(false); // floor is ignored
  });

  it('CR-001: legacy queued submission without zone is excluded from claim without fabricating data', async () => {
    const db = await openSurveyDatabase(databaseName);
    const tx = db.transaction(SUBMISSION_STORE, 'readwrite');
    // Simulate legacy submission queued before CR-001
    await tx.store.put({
      id: 'legacy-sub-no-zone',
      timestamp: '2026-09-02T09:00:00.000Z',
      surveyData: {
        building: 'Building A',
        floor: '2',
        roomNumber: '201',
        category: 'Hardware',
        conditionRating: 4,
        defectNotes: 'Legacy submission',
        photo: null,
      },
      syncStatus: 'PENDING_SYNC',
    });
    await tx.done;
    db.close();

    // Legacy record missing zone MUST NOT be claimed by atomicClaimNext
    const claim = await storage.atomicClaimNext();
    expect(claim).toBeNull();

    // getPendingSubmissions must also exclude it
    const pending = await storage.getPendingSubmissions();
    expect(pending).toHaveLength(0);

    // Verify record still exists in storage (no destructive deletion or wipe)
    const dbCheck = await openSurveyDatabase(databaseName);
    const stored = await dbCheck.get(SUBMISSION_STORE, 'legacy-sub-no-zone');
    dbCheck.close();
    expect(stored).toBeDefined();
    expect(stored?.id).toBe('legacy-sub-no-zone');
  });

  it('retrieves all submissions in descending timestamp order', async () => {
    const older = createSubmission({
      id: 'sub-older',
      timestamp: '2026-09-01T10:00:00.000Z',
      syncStatus: 'PENDING_SYNC',
    });
    const newer = createSubmission({
      id: 'sub-newer',
      timestamp: '2026-09-02T10:00:00.000Z',
      syncStatus: 'PENDING_SYNC',
    });

    await storage.enqueueSubmission(older);
    await storage.enqueueSubmission(newer);
    await storage.markSubmissionSynced(older.id);

    const all = await storage.getAllSubmissions();
    expect(all).toHaveLength(2);
    expect(all[0].id).toBe('sub-newer');
    expect(all[1].id).toBe('sub-older');
  });

  it('retrieves single submission by id or returns null if not found', async () => {
    const sub = createSubmission({ id: 'target-sub-123' });
    await storage.enqueueSubmission(sub);

    const found = await storage.getSubmissionById('target-sub-123');
    expect(found).not.toBeNull();
    expect(found?.id).toBe('target-sub-123');

    const missing = await storage.getSubmissionById('non-existent-id');
    expect(missing).toBeNull();
  });

  it('deletes an existing submission and returns true, or false if not found', async () => {
    const sub1 = createSubmission({ id: 'to-delete-1' });
    const sub2 = createSubmission({ id: 'to-keep-2' });
    await storage.enqueueSubmission(sub1);
    await storage.enqueueSubmission(sub2);

    const deleted = await storage.deleteSubmission('to-delete-1');
    expect(deleted).toBe(true);

    const check1 = await storage.getSubmissionById('to-delete-1');
    expect(check1).toBeNull();

    const check2 = await storage.getSubmissionById('to-keep-2');
    expect(check2).not.toBeNull();

    const notFound = await storage.deleteSubmission('to-delete-1');
    expect(notFound).toBe(false);
  });

  it('resets a failed submission back to PENDING_SYNC', async () => {
    const sub = createSubmission({ id: 'failed-sub' });
    await storage.enqueueSubmission(sub);
    await storage.updateSubmissionStatus('failed-sub', 'SYNC_FAILED', 'Network error', 'RETRYABLE');

    const failed = await storage.getSubmissionById('failed-sub');
    expect(failed?.syncStatus).toBe('SYNC_FAILED');

    const reset = await storage.resetSubmissionToPending('failed-sub');
    expect(reset).toBe(true);

    const updated = await storage.getSubmissionById('failed-sub');
    expect(updated?.syncStatus).toBe('PENDING_SYNC');
    expect(updated?.lastErrorMessage).toBeUndefined();
  });
});
