import type { SurveySubmission, SyncStatus } from './models.ts';

export interface SubmissionStatusCounts {
  readonly total: number;
  readonly pending: number;
  readonly syncing: number;
  readonly synced: number;
  readonly failed: number;
  readonly retryableFailed: number;
  readonly attentionFailed: number;
  readonly needsAttention: number;
}

export const ZERO_STATUS_COUNTS: SubmissionStatusCounts = {
  total: 0,
  pending: 0,
  syncing: 0,
  synced: 0,
  failed: 0,
  retryableFailed: 0,
  attentionFailed: 0,
  needsAttention: 0,
};

/**
 * Aggregates a list of survey submissions into strict, unambiguous status counts.
 *
 * Invariants:
 * - pending: exactly syncStatus === 'PENDING_SYNC'
 * - syncing: exactly syncStatus === 'SYNCING'
 * - synced: exactly syncStatus === 'SYNCED'
 * - failed: exactly syncStatus === 'SYNC_FAILED'
 * - retryableFailed: failed submissions with failureDisposition !== 'REQUIRES_ATTENTION'
 * - attentionFailed: failed submissions with failureDisposition === 'REQUIRES_ATTENTION'
 * - needsAttention: total non-synced items (pending + syncing + failed)
 * - total === pending + syncing + synced + failed
 */
export function aggregateSubmissions(
  submissions: readonly SurveySubmission[]
): SubmissionStatusCounts {
  let pending = 0;
  let syncing = 0;
  let synced = 0;
  let failed = 0;
  let retryableFailed = 0;
  let attentionFailed = 0;

  for (const item of submissions) {
    const status: SyncStatus = item.syncStatus;
    switch (status) {
      case 'PENDING_SYNC':
        pending += 1;
        break;
      case 'SYNCING':
        syncing += 1;
        break;
      case 'SYNCED':
        synced += 1;
        break;
      case 'SYNC_FAILED':
        failed += 1;
        if (item.failureDisposition === 'REQUIRES_ATTENTION') {
          attentionFailed += 1;
        } else {
          retryableFailed += 1;
        }
        break;
    }
  }

  return {
    total: submissions.length,
    pending,
    syncing,
    synced,
    failed,
    retryableFailed,
    attentionFailed,
    needsAttention: pending + syncing + failed,
  };
}
