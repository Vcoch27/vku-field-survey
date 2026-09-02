import type { SubmissionGateway, SurveyStoragePort } from './ports.ts';
import type { Uuid } from './models.ts';

export interface SyncOrchestratorConfig {
  /**
   * Maximum duration in milliseconds before an in-flight SYNCING claim
   * is considered abandoned and recovered. Defaults to 30,000ms (30s).
   */
  readonly staleClaimTimeoutMs?: number;
}

export interface SyncOrchestratorDependencies {
  readonly storage: SurveyStoragePort;
  readonly gateway: SubmissionGateway;
  readonly config?: SyncOrchestratorConfig;
}

export interface SyncResult {
  readonly processedCount: number;
  readonly syncedCount: number;
  readonly failedCount: number;
  readonly recoveredStaleCount: number;
  readonly errors: ReadonlyArray<{
    readonly submissionId: Uuid;
    readonly reason: string;
  }>;
}

export const DEFAULT_STALE_CLAIM_TIMEOUT_MS = 30_000;

/**
 * Executes a single synchronization pass over the offline submission queue.
 *
 * Invariants enforced:
 * 1. Cross-context claim safety: Uses durable SurveyStoragePort.atomicClaimNext().
 * 2. Sequential processing in timestamp-ascending FIFO order.
 * 3. Fairness policy: Each eligible submission is attempted at most once per pass,
 *    preventing a repeatedly failing head record from permanently starving later valid records.
 * 4. Stale claim recovery: Reclaims orphaned SYNCING records based on configurable lease.
 * 5. Positive acknowledgement: Record transitions to SYNCED only upon destination ACKNOWLEDGED.
 * 6. Data retention: Failed, unacknowledged, or thrown attempts transition to SYNC_FAILED
 *    without mutating or deleting survey payload or photo binary data.
 * 7. Delivery semantics: At-least-once remote delivery using stable client UUIDs.
 */
export async function synchronizeSubmissions(
  dependencies: SyncOrchestratorDependencies
): Promise<SyncResult> {
  const { storage, gateway, config } = dependencies;
  const staleTimeoutMs = config?.staleClaimTimeoutMs ?? DEFAULT_STALE_CLAIM_TIMEOUT_MS;

  // 1. Recover any stale claims abandoned by dead/crashed execution contexts
  let recoveredStaleCount = 0;
  if (typeof storage.recoverStaleClaims === 'function') {
    recoveredStaleCount = await storage.recoverStaleClaims(staleTimeoutMs);
  }

  let processedCount = 0;
  let syncedCount = 0;
  let failedCount = 0;
  const errors: Array<{ submissionId: Uuid; reason: string }> = [];

  // Track attempted submissions in this pass to enforce the fairness policy:
  // attempt each eligible record at most once per sync run to prevent head-of-line blocking.
  const attemptedInThisPass = new Set<Uuid>();

  while (true) {
    const claimed = await storage.atomicClaimNext({
      excludeIds: attemptedInThisPass,
    });

    if (claimed === null) {
      break;
    }

    const { submission } = claimed;
    attemptedInThisPass.add(submission.id);
    processedCount += 1;

    try {
      const outcome = await gateway.sendSubmission(submission);

      if (outcome.outcome === 'ACKNOWLEDGED') {
        await storage.markSubmissionSynced(submission.id, outcome.acknowledgementToken);
        syncedCount += 1;
      } else if (outcome.outcome === 'RETRYABLE_FAILURE') {
        const reason = outcome.reason;
        await storage.updateSubmissionStatus(submission.id, 'SYNC_FAILED', reason, 'RETRYABLE');
        failedCount += 1;
        errors.push({ submissionId: submission.id, reason });
      } else if (outcome.outcome === 'REQUIRES_ATTENTION') {
        const reason = outcome.reason;
        await storage.updateSubmissionStatus(
          submission.id,
          'SYNC_FAILED',
          reason,
          'REQUIRES_ATTENTION'
        );
        failedCount += 1;
        errors.push({ submissionId: submission.id, reason });
      }
    } catch (dispatchErr) {
      const reason =
        dispatchErr instanceof Error ? dispatchErr.message : 'Unknown gateway exception';
      await storage.updateSubmissionStatus(submission.id, 'SYNC_FAILED', reason, 'RETRYABLE');
      failedCount += 1;
      errors.push({ submissionId: submission.id, reason });
    }
  }

  return {
    processedCount,
    syncedCount,
    failedCount,
    recoveredStaleCount,
    errors,
  };
}

export class SyncOrchestrator {
  private readonly dependencies: SyncOrchestratorDependencies;

  constructor(dependencies: SyncOrchestratorDependencies) {
    this.dependencies = dependencies;
  }

  synchronize(): Promise<SyncResult> {
    return synchronizeSubmissions(this.dependencies);
  }
}
