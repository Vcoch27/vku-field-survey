import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IdbSurveyStorage } from './IdbSurveyStorage.ts';
import { openSurveyDatabase, SUBMISSION_STORE } from './idbSchema.ts';
import { synchronizeSubmissions } from '../domain/syncOrchestrator.ts';
import type { PhotoAttachment, SurveySubmission } from '../domain/models.ts';
import type { SubmissionGateway } from '../domain/ports.ts';

describe('IdbSyncOrchestratorIntegration (Durable Claim & Concurrency)', () => {
  let databaseName: string;
  let storage: IdbSurveyStorage;

  const photoBytes = new Uint8Array([1, 2, 3, 4, 5]);
  function createDurablePhoto(): PhotoAttachment {
    return {
      id: 'photo-integration-1',
      binaryData: new Blob([photoBytes], { type: 'image/jpeg' }),
      capturedAt: '2026-09-02T10:00:00.000Z',
    };
  }

  function createSubmission(id: string, timestamp: string, withPhoto = false): SurveySubmission {
    return {
      id,
      timestamp,
      surveyData: {
        zone: 'K',
        building: 'Building A',
        roomNumber: '201',
        category: 'Hardware',
        conditionRating: 4,
        defectNotes: 'Loose HDMI cable',
        photo: withPhoto ? createDurablePhoto() : null,
      },
      syncStatus: 'PENDING_SYNC',
    };
  }

  beforeEach(() => {
    databaseName = `vku-field-survey-sync-test-${crypto.randomUUID()}`;
    storage = new IdbSurveyStorage({
      databaseName,
      createClaimMetadata: () => ({
        claimToken: `claim-${crypto.randomUUID()}`,
        claimedAt: new Date().toISOString(),
      }),
    });
  });

  afterEach(async () => {
    await storage.close();
    indexedDB.deleteDatabase(databaseName);
  });

  it('concurrent synchronize() calls do not claim or dispatch the same record', async () => {
    const sub1 = createSubmission('sub-c-1', '2026-09-02T10:00:00.000Z');
    const sub2 = createSubmission('sub-c-2', '2026-09-02T10:01:00.000Z');
    await storage.enqueueSubmission(sub1);
    await storage.enqueueSubmission(sub2);

    const dispatchedLog: string[] = [];
    const gateway: SubmissionGateway = {
      sendSubmission: vi.fn().mockImplementation(async (s) => {
        dispatchedLog.push(s.id);
        // Simulate network latency during dispatch
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { outcome: 'ACKNOWLEDGED' };
      }),
    };

    // Run two synchronization workers concurrently
    const [result1, result2] = await Promise.all([
      synchronizeSubmissions({ storage, gateway }),
      synchronizeSubmissions({ storage, gateway }),
    ]);

    // Total processed between the two workers must equal 2
    expect(result1.syncedCount + result2.syncedCount).toBe(2);

    // Each record was dispatched exactly once; no duplicates across concurrent executions
    expect(dispatchedLog.sort()).toEqual(['sub-c-1', 'sub-c-2']);

    // Queue in IndexedDB must show both records SYNCED
    const pending = await storage.getPendingSubmissions();
    expect(pending).toHaveLength(0);
  });

  it('recovers stale claims from dead contexts and completes synchronization', async () => {
    const sub = createSubmission('sub-stale-id', '2026-09-02T10:00:00.000Z');
    await storage.enqueueSubmission(sub);

    // Manually claim the submission as if an earlier context crashed mid-flight 60 seconds ago
    const claimedAtTime = new Date(Date.now() - 60_000).toISOString();
    await storage.updateSubmissionStatus(sub.id, 'SYNCING');

    // Manually set claim metadata to simulate abandoned claim
    const db = await openSurveyDatabase(databaseName);
    const tx = db.transaction(SUBMISSION_STORE, 'readwrite');
    const record = await tx.store.get(sub.id);
    if (!record) throw new Error('Record not found');
    const updatedRecord = {
      ...record,
      claimToken: 'dead-token-123',
      claimedAt: claimedAtTime,
    };
    await tx.store.put(updatedRecord);
    await tx.done;
    db.close();

    const gateway: SubmissionGateway = {
      sendSubmission: vi.fn().mockResolvedValue({ outcome: 'ACKNOWLEDGED' }),
    };

    const result = await synchronizeSubmissions({
      storage,
      gateway,
      config: { staleClaimTimeoutMs: 30_000 },
    });

    expect(result.recoveredStaleCount).toBe(1);
    expect(result.syncedCount).toBe(1);
    expect(gateway.sendSubmission).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sub-stale-id' })
    );

    // Submission is now SYNCED
    const pending = await storage.getPendingSubmissions();
    expect(pending).toHaveLength(0);
  });

  it('markSubmissionSynced preserves all survey fields and binary photo data in IndexedDB', async () => {
    const sub = createSubmission('sub-photo-sync', '2026-09-02T10:00:00.000Z', true);
    await storage.enqueueSubmission(sub);

    const gateway: SubmissionGateway = {
      sendSubmission: vi.fn().mockResolvedValue({
        outcome: 'ACKNOWLEDGED',
        acknowledgementToken: 'ack-photo-123',
      }),
    };

    const result = await synchronizeSubmissions({ storage, gateway });
    expect(result.syncedCount).toBe(1);

    // Read record directly from IndexedDB to verify durable data retention
    const db = await openSurveyDatabase(databaseName);
    const stored = await db.get(SUBMISSION_STORE, 'sub-photo-sync');
    db.close();

    expect(stored).toBeDefined();
    if (!stored) return;

    expect(stored.syncStatus).toBe('SYNCED');
    expect(stored.surveyData.building).toBe('Building A');
    expect(stored.surveyData.photo).not.toBeNull();
    expect(stored.surveyData.photo?.binaryData).toBeInstanceOf(Blob);

    const retrievedBytes = new Uint8Array(
      await (stored.surveyData.photo?.binaryData as Blob).arrayBuffer()
    );
    expect(retrievedBytes).toEqual(photoBytes);
  });

  it('fairness: repeatedly failing head item does not block subsequent eligible items', async () => {
    const headSub = createSubmission('sub-head-fail', '2026-09-02T10:00:00.000Z');
    const tailSub = createSubmission('sub-tail-ok', '2026-09-02T10:05:00.000Z');
    await storage.enqueueSubmission(headSub);
    await storage.enqueueSubmission(tailSub);

    const gateway: SubmissionGateway = {
      sendSubmission: vi.fn().mockImplementation(async (s) => {
        if (s.id === 'sub-head-fail') {
          return { outcome: 'RETRYABLE_FAILURE', reason: 'Temporary gateway 503' };
        }
        return { outcome: 'ACKNOWLEDGED' };
      }),
    };

    const result = await synchronizeSubmissions({ storage, gateway });

    expect(result.processedCount).toBe(2);
    expect(result.failedCount).toBe(1);
    expect(result.syncedCount).toBe(1);

    // In IndexedDB: headSub is SYNC_FAILED, tailSub is SYNCED
    const db = await openSurveyDatabase(databaseName);
    const storedHead = await db.get(SUBMISSION_STORE, 'sub-head-fail');
    const storedTail = await db.get(SUBMISSION_STORE, 'sub-tail-ok');
    db.close();

    expect(storedHead).toBeDefined();
    expect(storedTail).toBeDefined();
    if (!storedHead || !storedTail) return;

    expect(storedHead.syncStatus).toBe('SYNC_FAILED');
    expect(storedHead.lastErrorMessage).toBe('Temporary gateway 503');
    expect(storedHead.failureDisposition).toBe('RETRYABLE');
    expect(storedTail.syncStatus).toBe('SYNCED');
  });

  it('RETRYABLE_FAILURE: transitions to SYNC_FAILED with RETRYABLE disposition and is claimed on a later pass', async () => {
    const sub = createSubmission('sub-retryable-pass', '2026-09-02T10:00:00.000Z');
    await storage.enqueueSubmission(sub);

    let attempt = 0;
    const gateway: SubmissionGateway = {
      sendSubmission: vi.fn().mockImplementation(async () => {
        attempt += 1;
        if (attempt === 1) {
          return { outcome: 'RETRYABLE_FAILURE', reason: '503 Service Unavailable' };
        }
        return { outcome: 'ACKNOWLEDGED' };
      }),
    };

    // Pass 1: fails
    const pass1 = await synchronizeSubmissions({ storage, gateway });
    expect(pass1.failedCount).toBe(1);

    // Verify stored record in IndexedDB
    const db1 = await openSurveyDatabase(databaseName);
    const storedAfterPass1 = await db1.get(SUBMISSION_STORE, 'sub-retryable-pass');
    db1.close();
    expect(storedAfterPass1?.syncStatus).toBe('SYNC_FAILED');
    expect(storedAfterPass1?.failureDisposition).toBe('RETRYABLE');

    // Pass 2: retried automatically and succeeds
    const pass2 = await synchronizeSubmissions({ storage, gateway });
    expect(pass2.syncedCount).toBe(1);

    const db2 = await openSurveyDatabase(databaseName);
    const storedAfterPass2 = await db2.get(SUBMISSION_STORE, 'sub-retryable-pass');
    db2.close();
    expect(storedAfterPass2?.syncStatus).toBe('SYNCED');
    expect(storedAfterPass2?.failureDisposition).toBeUndefined();
  });

  it('REQUIRES_ATTENTION: transitions to SYNC_FAILED with REQUIRES_ATTENTION disposition and is NOT claimed on later pass', async () => {
    const sub = createSubmission('sub-attn-pass', '2026-09-02T10:00:00.000Z');
    await storage.enqueueSubmission(sub);

    const gateway: SubmissionGateway = {
      sendSubmission: vi.fn().mockResolvedValue({
        outcome: 'REQUIRES_ATTENTION',
        reason: 'Invalid equipment barcode',
      }),
    };

    // Pass 1: fails with REQUIRES_ATTENTION
    const pass1 = await synchronizeSubmissions({ storage, gateway });
    expect(pass1.failedCount).toBe(1);

    // Verify stored record in IndexedDB
    const db = await openSurveyDatabase(databaseName);
    const stored = await db.get(SUBMISSION_STORE, 'sub-attn-pass');
    db.close();
    expect(stored?.syncStatus).toBe('SYNC_FAILED');
    expect(stored?.failureDisposition).toBe('REQUIRES_ATTENTION');
    expect(stored?.surveyData.building).toBe('Building A');

    // Pass 2: MUST NOT be claimed automatically
    const pass2 = await synchronizeSubmissions({ storage, gateway });
    expect(pass2.processedCount).toBe(0);
    expect(pass2.syncedCount).toBe(0);
    expect(pass2.failedCount).toBe(0);
    expect(gateway.sendSubmission).toHaveBeenCalledTimes(1);
  });

  it('DB reopen: REQUIRES_ATTENTION retry exclusion survives database close and reopen', async () => {
    const sub = createSubmission('sub-attn-reopen', '2026-09-02T10:00:00.000Z');
    await storage.enqueueSubmission(sub);

    const gateway: SubmissionGateway = {
      sendSubmission: vi.fn().mockResolvedValue({
        outcome: 'REQUIRES_ATTENTION',
        reason: 'Manual intervention required',
      }),
    };

    // Run sync to mark as REQUIRES_ATTENTION
    await synchronizeSubmissions({ storage, gateway });

    // Close existing storage and reopen fresh adapter instance against the same databaseName
    await storage.close();

    const reopenedStorage = new IdbSurveyStorage({
      databaseName,
      createClaimMetadata: () => ({
        claimToken: `claim-${crypto.randomUUID()}`,
        claimedAt: new Date().toISOString(),
      }),
    });

    try {
      // Reopened storage must NOT claim the REQUIRES_ATTENTION submission
      const claim = await reopenedStorage.atomicClaimNext();
      expect(claim).toBeNull();

      // getPendingSubmissions must also exclude it
      const pending = await reopenedStorage.getPendingSubmissions();
      expect(pending).toHaveLength(0);

      // Verify the record still durably exists with all fields intact
      const db = await openSurveyDatabase(databaseName);
      const stored = await db.get(SUBMISSION_STORE, 'sub-attn-reopen');
      db.close();
      expect(stored?.syncStatus).toBe('SYNC_FAILED');
      expect(stored?.failureDisposition).toBe('REQUIRES_ATTENTION');
      expect(stored?.surveyData.defectNotes).toBe('Loose HDMI cable');
    } finally {
      await reopenedStorage.close();
    }
  });

  it('gateway throw: never marks SYNCED, sets RETRYABLE disposition, and remains retry eligible', async () => {
    const sub = createSubmission('sub-throw-retry', '2026-09-02T10:00:00.000Z');
    await storage.enqueueSubmission(sub);

    let attempt = 0;
    const gateway: SubmissionGateway = {
      sendSubmission: vi.fn().mockImplementation(async () => {
        attempt += 1;
        if (attempt === 1) {
          throw new Error('Socket reset by peer');
        }
        return { outcome: 'ACKNOWLEDGED' };
      }),
    };

    // Pass 1: gateway throws exception
    const pass1 = await synchronizeSubmissions({ storage, gateway });
    expect(pass1.failedCount).toBe(1);
    expect(pass1.syncedCount).toBe(0);

    const db1 = await openSurveyDatabase(databaseName);
    const stored1 = await db1.get(SUBMISSION_STORE, 'sub-throw-retry');
    db1.close();
    expect(stored1?.syncStatus).toBe('SYNC_FAILED');
    expect(stored1?.failureDisposition).toBe('RETRYABLE');
    expect(stored1?.lastErrorMessage).toBe('Socket reset by peer');

    // Pass 2: retried automatically and succeeds
    const pass2 = await synchronizeSubmissions({ storage, gateway });
    expect(pass2.syncedCount).toBe(1);

    const db2 = await openSurveyDatabase(databaseName);
    const stored2 = await db2.get(SUBMISSION_STORE, 'sub-throw-retry');
    db2.close();
    expect(stored2?.syncStatus).toBe('SYNCED');
    expect(stored2?.failureDisposition).toBeUndefined();
  });

  it('ACKNOWLEDGED: marks SYNCED and clears previous failureDisposition and claim metadata', async () => {
    const sub = createSubmission('sub-ack-cleanup', '2026-09-02T10:00:00.000Z');
    await storage.enqueueSubmission(sub);

    // Pre-set failureDisposition on record as if it previously failed
    await storage.updateSubmissionStatus(sub.id, 'SYNC_FAILED', 'Previous error', 'RETRYABLE');

    const gateway: SubmissionGateway = {
      sendSubmission: vi.fn().mockResolvedValue({
        outcome: 'ACKNOWLEDGED',
        acknowledgementToken: 'token-ack-clean',
      }),
    };

    const result = await synchronizeSubmissions({ storage, gateway });
    expect(result.syncedCount).toBe(1);

    const db = await openSurveyDatabase(databaseName);
    const stored = await db.get(SUBMISSION_STORE, 'sub-ack-cleanup');
    db.close();

    expect(stored?.syncStatus).toBe('SYNCED');
    expect(stored?.failureDisposition).toBeUndefined();
    expect(stored?.claimToken).toBeUndefined();
    expect(stored?.claimedAt).toBeUndefined();
    expect(stored?.lastErrorMessage).toBeUndefined();
  });
});
