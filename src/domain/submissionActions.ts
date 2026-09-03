import type { SurveyStoragePort } from './ports.ts';
import type { Uuid } from './models.ts';
import type { SyncOrchestrator, SyncResult } from './syncOrchestrator.ts';
import { globalSyncEventHub } from './syncEvents.ts';

export interface RetrySubmissionResult {
  readonly success: boolean;
  readonly error?: string;
  readonly syncResult?: SyncResult;
}

/**
 * Retries a failed submission safely through the existing SyncOrchestrator pipeline.
 *
 * Rules:
 * 1. Checks that record exists and is in SYNC_FAILED state.
 * 2. If failureDisposition is REQUIRES_ATTENTION, rejects automated retry with explanation.
 * 3. Transitions record to PENDING_SYNC.
 * 4. Invokes orchestrator.synchronize() to process through official gateway.
 * 5. Notifies globalSyncEventHub so all UI components react immediately.
 */
export async function retrySubmission(
  submissionId: Uuid,
  storage: SurveyStoragePort,
  orchestrator: SyncOrchestrator
): Promise<RetrySubmissionResult> {
  const existing = await storage.getSubmissionById(submissionId);
  if (!existing) {
    return { success: false, error: 'Submission not found' };
  }

  if (existing.syncStatus !== 'SYNC_FAILED') {
    return {
      success: false,
      error: `Cannot retry submission with status "${existing.syncStatus}" (only SYNC_FAILED is retryable)`,
    };
  }

  if (existing.failureDisposition === 'REQUIRES_ATTENTION') {
    return {
      success: false,
      error: 'This inspection requires surveyor attention (e.g. invalid location or schema) and cannot be retried automatically.',
    };
  }

  // Safely reset back to PENDING_SYNC
  const resetSuccess = await storage.resetSubmissionToPending(submissionId);
  if (!resetSuccess) {
    return { success: false, error: 'Failed to reset submission to pending' };
  }

  globalSyncEventHub.notifyStorageChanged();

  // Execute synchronization through existing orchestrator
  const syncResult = await orchestrator.synchronize();
  return {
    success: true,
    syncResult,
  };
}

/**
 * Permanently removes a local inspection record from IndexedDB.
 *
 * Rules:
 * 1. Deletes the selected local record from local storage.
 * 2. Does NOT delete or alter remote Google Sheet rows.
 * 3. Triggers storageChanged event on event hub to notify Header, Records, Home, and Stats.
 */
export async function deleteLocalSubmission(
  submissionId: Uuid,
  storage: SurveyStoragePort
): Promise<boolean> {
  const deleted = await storage.deleteSubmission(submissionId);
  if (deleted) {
    globalSyncEventHub.notifyStorageChanged();
  }
  return deleted;
}
