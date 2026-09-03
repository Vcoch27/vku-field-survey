import { describe, it, expect, vi } from 'vitest';
import type { ClaimedSubmission, SurveySubmission } from './models.ts';
import type { SubmissionGateway, SurveyStoragePort } from './ports.ts';
import { SyncOrchestrator, synchronizeSubmissions } from './syncOrchestrator.ts';

describe('SyncOrchestrator (Domain Workflow)', () => {
  function createFakeSubmission(id: string, timestamp: string): SurveySubmission {
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
        photo: null,
      },
      syncStatus: 'PENDING_SYNC',
    };
  }

  function createMockStorage(submissions: SurveySubmission[]) {
    let queue = [...submissions];

    const storage: SurveyStoragePort = {
      saveDraft: vi.fn().mockResolvedValue(undefined),
      getDraft: vi.fn().mockResolvedValue(null),
      clearDraft: vi.fn().mockResolvedValue(undefined),
      enqueueSubmission: vi.fn().mockResolvedValue(undefined),
      enqueueSubmissionAndClearDraft: vi.fn().mockResolvedValue(undefined),
      getPendingSubmissions: vi.fn().mockImplementation(async () => queue),
      getAllSubmissions: vi.fn().mockImplementation(async () => queue),
      getSubmissionById: vi.fn().mockImplementation(async (id) => queue.find((s) => s.id === id) ?? null),
      recoverStaleClaims: vi.fn().mockResolvedValue(0),
      atomicClaimNext: vi
        .fn()
        .mockImplementation(async (options?: { excludeIds?: ReadonlySet<string> }) => {
          const eligible = queue.find(
            (s) =>
              (s.syncStatus === 'PENDING_SYNC' ||
                (s.syncStatus === 'SYNC_FAILED' &&
                  s.failureDisposition !== 'REQUIRES_ATTENTION')) &&
              (!options?.excludeIds || !options.excludeIds.has(s.id))
          );
          if (!eligible) return null;

          const claimed: ClaimedSubmission = {
            submission: { ...eligible, syncStatus: 'SYNCING' },
            claimToken: `claim-${eligible.id}`,
            claimedAt: new Date().toISOString(),
          };

          // Update in-memory queue state to SYNCING
          queue = queue.map((s) => (s.id === eligible.id ? claimed.submission : s));
          return claimed;
        }),
      updateSubmissionStatus: vi
        .fn()
        .mockImplementation(async (id, status, errorMessage, failureDisposition) => {
          queue = queue.map((s) =>
            s.id === id
              ? { ...s, syncStatus: status, lastErrorMessage: errorMessage, failureDisposition }
              : s
          );
        }),
      markSubmissionSynced: vi.fn().mockImplementation(async (id) => {
        queue = queue.map((s) => (s.id === id ? { ...s, syncStatus: 'SYNCED' } : s));
      }),
    };

    return { storage, getQueue: () => queue };
  }

  it('ACKNOWLEDGED outcome transitions submission to SYNCED', async () => {
    const sub = createFakeSubmission('sub-1', '2026-09-02T10:00:00.000Z');
    const { storage } = createMockStorage([sub]);

    const gateway: SubmissionGateway = {
      sendSubmission: vi.fn().mockResolvedValue({
        outcome: 'ACKNOWLEDGED',
        acknowledgementToken: 'ack-tok-1',
      }),
    };

    const orchestrator = new SyncOrchestrator({ storage, gateway });
    const result = await orchestrator.synchronize();

    expect(result.processedCount).toBe(1);
    expect(result.syncedCount).toBe(1);
    expect(result.failedCount).toBe(0);
    expect(storage.markSubmissionSynced).toHaveBeenCalledWith('sub-1', 'ack-tok-1');
  });

  it('RETRYABLE_FAILURE outcome updates status to SYNC_FAILED and does not mark SYNCED', async () => {
    const sub = createFakeSubmission('sub-2', '2026-09-02T10:00:00.000Z');
    const { storage } = createMockStorage([sub]);

    const gateway: SubmissionGateway = {
      sendSubmission: vi.fn().mockResolvedValue({
        outcome: 'RETRYABLE_FAILURE',
        reason: '503 Service Unavailable',
      }),
    };

    const result = await synchronizeSubmissions({ storage, gateway });

    expect(result.processedCount).toBe(1);
    expect(result.syncedCount).toBe(0);
    expect(result.failedCount).toBe(1);
    expect(result.errors).toEqual([{ submissionId: 'sub-2', reason: '503 Service Unavailable' }]);
    expect(storage.updateSubmissionStatus).toHaveBeenCalledWith(
      'sub-2',
      'SYNC_FAILED',
      '503 Service Unavailable',
      'RETRYABLE'
    );
    expect(storage.markSubmissionSynced).not.toHaveBeenCalled();
  });

  it('REQUIRES_ATTENTION outcome updates status to SYNC_FAILED with REQUIRES_ATTENTION disposition and is excluded on later pass', async () => {
    const sub = createFakeSubmission('sub-3', '2026-09-02T10:00:00.000Z');
    const { storage, getQueue } = createMockStorage([sub]);

    const gateway: SubmissionGateway = {
      sendSubmission: vi.fn().mockResolvedValue({
        outcome: 'REQUIRES_ATTENTION',
        reason: 'Missing campus building authorization',
      }),
    };

    // First pass: processed and fails with REQUIRES_ATTENTION
    const result1 = await synchronizeSubmissions({ storage, gateway });

    expect(result1.processedCount).toBe(1);
    expect(result1.failedCount).toBe(1);
    expect(storage.updateSubmissionStatus).toHaveBeenCalledWith(
      'sub-3',
      'SYNC_FAILED',
      'Missing campus building authorization',
      'REQUIRES_ATTENTION'
    );
    expect(storage.markSubmissionSynced).not.toHaveBeenCalled();

    // Verify queue retained record with REQUIRES_ATTENTION disposition
    expect(getQueue()[0].syncStatus).toBe('SYNC_FAILED');
    expect(getQueue()[0].failureDisposition).toBe('REQUIRES_ATTENTION');

    // Second pass (e.g. later sync trigger): MUST NOT be claimed automatically
    const result2 = await synchronizeSubmissions({ storage, gateway });
    expect(result2.processedCount).toBe(0);
    expect(result2.syncedCount).toBe(0);
    expect(result2.failedCount).toBe(0);
    expect(gateway.sendSubmission).toHaveBeenCalledTimes(1); // Not called again in pass 2
  });

  it('gateway throw is caught, transitions to SYNC_FAILED with RETRYABLE disposition, and never marks SYNCED', async () => {
    const sub = createFakeSubmission('sub-4', '2026-09-02T10:00:00.000Z');
    const { storage } = createMockStorage([sub]);

    const gateway: SubmissionGateway = {
      sendSubmission: vi.fn().mockRejectedValue(new Error('Network connection dropped')),
    };

    const result = await synchronizeSubmissions({ storage, gateway });

    expect(result.processedCount).toBe(1);
    expect(result.failedCount).toBe(1);
    expect(result.syncedCount).toBe(0);
    expect(storage.updateSubmissionStatus).toHaveBeenCalledWith(
      'sub-4',
      'SYNC_FAILED',
      'Network connection dropped',
      'RETRYABLE'
    );
    expect(storage.markSubmissionSynced).not.toHaveBeenCalled();
  });

  it('processes queued records sequentially in FIFO timestamp order', async () => {
    const sub1 = createFakeSubmission('sub-early', '2026-09-02T10:00:00.000Z');
    const sub2 = createFakeSubmission('sub-late', '2026-09-02T10:05:00.000Z');
    const { storage } = createMockStorage([sub1, sub2]);

    const dispatchedOrder: string[] = [];
    const gateway: SubmissionGateway = {
      sendSubmission: vi.fn().mockImplementation(async (s) => {
        dispatchedOrder.push(s.id);
        return { outcome: 'ACKNOWLEDGED' };
      }),
    };

    const result = await synchronizeSubmissions({ storage, gateway });

    expect(result.processedCount).toBe(2);
    expect(result.syncedCount).toBe(2);
    expect(dispatchedOrder).toEqual(['sub-early', 'sub-late']);
  });

  it('fairness: failing head item does not starve subsequent eligible items in a single pass', async () => {
    const headFailingSub = createFakeSubmission('sub-fail', '2026-09-02T10:00:00.000Z');
    const secondValidSub = createFakeSubmission('sub-success', '2026-09-02T10:01:00.000Z');
    const { storage } = createMockStorage([headFailingSub, secondValidSub]);

    const gateway: SubmissionGateway = {
      sendSubmission: vi.fn().mockImplementation(async (s) => {
        if (s.id === 'sub-fail') {
          return { outcome: 'RETRYABLE_FAILURE', reason: 'Gateway timeout' };
        }
        return { outcome: 'ACKNOWLEDGED' };
      }),
    };

    const result = await synchronizeSubmissions({ storage, gateway });

    // Both were processed: head failed, second succeeded without starvation
    expect(result.processedCount).toBe(2);
    expect(result.failedCount).toBe(1);
    expect(result.syncedCount).toBe(1);
    expect(storage.updateSubmissionStatus).toHaveBeenCalledWith(
      'sub-fail',
      'SYNC_FAILED',
      'Gateway timeout',
      'RETRYABLE'
    );
    expect(storage.markSubmissionSynced).toHaveBeenCalledWith('sub-success', undefined);
  });

  it('recovers stale claims before claiming using configured timeout', async () => {
    const sub = createFakeSubmission('sub-stale', '2026-09-02T10:00:00.000Z');
    const { storage } = createMockStorage([sub]);
    vi.mocked(storage.recoverStaleClaims).mockResolvedValue(1);

    const gateway: SubmissionGateway = {
      sendSubmission: vi.fn().mockResolvedValue({ outcome: 'ACKNOWLEDGED' }),
    };

    const result = await synchronizeSubmissions({
      storage,
      gateway,
      config: { staleClaimTimeoutMs: 15_000 },
    });

    expect(storage.recoverStaleClaims).toHaveBeenCalledWith(15_000);
    expect(result.recoveredStaleCount).toBe(1);
  });

  it('preserves stable client UUID across repeated retry passes', async () => {
    const sub = createFakeSubmission('stable-uuid-99', '2026-09-02T10:00:00.000Z');
    const { storage, getQueue } = createMockStorage([sub]);

    const receivedIds: string[] = [];
    const gateway: SubmissionGateway = {
      sendSubmission: vi.fn().mockImplementation(async (s) => {
        receivedIds.push(s.id);
        if (receivedIds.length === 1) {
          return { outcome: 'RETRYABLE_FAILURE', reason: 'Temporary outage' };
        }
        return { outcome: 'ACKNOWLEDGED' };
      }),
    };

    // Pass 1: fails
    const result1 = await synchronizeSubmissions({ storage, gateway });
    expect(result1.failedCount).toBe(1);

    // Ensure status was preserved as SYNC_FAILED and still in queue
    expect(getQueue()[0].syncStatus).toBe('SYNC_FAILED');

    // Pass 2: retries and succeeds
    const result2 = await synchronizeSubmissions({ storage, gateway });
    expect(result2.syncedCount).toBe(1);

    // Both attempts dispatched the EXACT same stable client UUID
    expect(receivedIds).toEqual(['stable-uuid-99', 'stable-uuid-99']);
  });
});
