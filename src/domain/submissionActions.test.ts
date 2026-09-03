import { describe, expect, it, vi } from 'vitest';
import { retrySubmission, deleteLocalSubmission } from './submissionActions.ts';
import type { SurveyStoragePort } from './ports.ts';
import type { SurveySubmission } from './models.ts';
import type { SyncOrchestrator } from './syncOrchestrator.ts';

function createMockSubmission(
  id: string,
  syncStatus: SurveySubmission['syncStatus'],
  failureDisposition?: SurveySubmission['failureDisposition']
): SurveySubmission {
  return {
    id,
    timestamp: '2026-09-03T10:00:00.000Z',
    syncStatus,
    ...(failureDisposition ? { failureDisposition } : {}),
    surveyData: {
      zone: 'V',
      building: 'A',
      roomNumber: '205',
      category: 'Projector',
      conditionRating: 4,
      defectNotes: 'lamp flickering',
      photo: null,
    },
  };
}

describe('submissionActions', () => {
  it('rejects retry if submission is not found', async () => {
    const mockStorage: Partial<SurveyStoragePort> = {
      getSubmissionById: vi.fn().mockResolvedValue(null),
    };
    const mockOrchestrator: Partial<SyncOrchestrator> = {
      synchronize: vi.fn(),
    };

    const result = await retrySubmission(
      'non-existent',
      mockStorage as SurveyStoragePort,
      mockOrchestrator as SyncOrchestrator
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
    expect(mockOrchestrator.synchronize).not.toHaveBeenCalled();
  });

  it('rejects retry if submission is not in SYNC_FAILED state', async () => {
    const sub = createMockSubmission('sub-1', 'SYNCED');
    const mockStorage: Partial<SurveyStoragePort> = {
      getSubmissionById: vi.fn().mockResolvedValue(sub),
    };
    const mockOrchestrator: Partial<SyncOrchestrator> = {
      synchronize: vi.fn(),
    };

    const result = await retrySubmission(
      'sub-1',
      mockStorage as SurveyStoragePort,
      mockOrchestrator as SyncOrchestrator
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/only SYNC_FAILED is retryable/i);
    expect(mockOrchestrator.synchronize).not.toHaveBeenCalled();
  });

  it('rejects automated retry if failureDisposition is REQUIRES_ATTENTION', async () => {
    const sub = createMockSubmission('sub-att', 'SYNC_FAILED', 'REQUIRES_ATTENTION');
    const mockStorage: Partial<SurveyStoragePort> = {
      getSubmissionById: vi.fn().mockResolvedValue(sub),
    };
    const mockOrchestrator: Partial<SyncOrchestrator> = {
      synchronize: vi.fn(),
    };

    const result = await retrySubmission(
      'sub-att',
      mockStorage as SurveyStoragePort,
      mockOrchestrator as SyncOrchestrator
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/requires surveyor attention/i);
    expect(mockOrchestrator.synchronize).not.toHaveBeenCalled();
  });

  it('successfully resets RETRYABLE failed submission and runs orchestrator', async () => {
    const sub = createMockSubmission('sub-retry', 'SYNC_FAILED', 'RETRYABLE');
    const mockStorage: Partial<SurveyStoragePort> = {
      getSubmissionById: vi.fn().mockResolvedValue(sub),
      resetSubmissionToPending: vi.fn().mockResolvedValue(true),
    };
    const mockOrchestrator: Partial<SyncOrchestrator> = {
      synchronize: vi.fn().mockResolvedValue({
        processedCount: 1,
        syncedCount: 1,
        failedCount: 0,
        recoveredStaleCount: 0,
        errors: [],
      }),
    };

    const result = await retrySubmission(
      'sub-retry',
      mockStorage as SurveyStoragePort,
      mockOrchestrator as SyncOrchestrator
    );

    expect(result.success).toBe(true);
    expect(mockStorage.resetSubmissionToPending).toHaveBeenCalledWith('sub-retry');
    expect(mockOrchestrator.synchronize).toHaveBeenCalledTimes(1);
    expect(result.syncResult?.syncedCount).toBe(1);
  });

  it('deletes local submission through storage port', async () => {
    const mockStorage: Partial<SurveyStoragePort> = {
      deleteSubmission: vi.fn().mockResolvedValue(true),
    };

    const result = await deleteLocalSubmission('del-id', mockStorage as SurveyStoragePort);

    expect(result).toBe(true);
    expect(mockStorage.deleteSubmission).toHaveBeenCalledWith('del-id');
  });
});
