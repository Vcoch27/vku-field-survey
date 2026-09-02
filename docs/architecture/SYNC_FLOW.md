# Synchronization Flow Specifications

Status: **APPROVED — FROZEN AT HUMAN GATE D**

This document specifies the synchronization architecture, queue locking, sequential dispatch, error retention, trigger convergence, and lifecycle state transitions.

---

## 1. Approved Synchronization State Machine

The survey submission lifecycle follows the owner-approved terminology recorded in `docs/assignment/ACCEPTANCE_CRITERIA.md`:

```text
 +-------------------------------------------------------+
 |                 [ SUBMIT OFFLINE ]                    |
 +-------------------------------------------------------+
                            |
                            v
                  +-------------------+
                  |   PENDING_SYNC    | <---------------+
                  +-------------------+                 |
                            |                           |
                            | (Sync Trigger fires       |
                            |  & item dispatch begins)  |
                            v                           |
                  +-------------------+                 |
                  |      SYNCING      |                 |
                  +-------------------+                 |
                     /             \                    |
        Positive    /               \  Network Error    |
 Acknowledgement   /                 \  or Unacknowledged
                  v                   v                 |
          +------------+       +-------------+          |
          |   SYNCED   |       | SYNC_FAILED | ---------+
          +------------+       +-------------+  (Retry Trigger)
          (Final State)        (Data Retained)
```

### State Definitions

- **`PENDING_SYNC`**: Survey finalized and stored locally in IndexedDB queue; awaiting initial transmission attempt (Direct assignment requirement `SYNC-REQ-03`).
- **`SYNCING`**: Survey is currently being dispatched across the network via `SubmissionGateway` (Project terminology).
- **`SYNCED`**: Survey successfully received and positively acknowledged by the submission destination (`SYNC-04`).
- **`SYNC_FAILED`**: Previous dispatch failed due to network unavailability, timeout, or server error. Full survey data and photo are retained for future retry (`SYNC-05`, `SYNC-10`).

---

## 2. Trigger Convergence to Single Orchestration Point

To satisfy principle #5 and `SYNC-REQ-04` through `SYNC-REQ-07`, all synchronization triggers converge on **one single use case**: `SyncOrchestrator.synchronize()`.

```text
+------------------------------------+
| TRIGGER 1: Background Sync Event   | --+
| (Chromium Service Worker)          |   |
+------------------------------------+   |
                                         |
+------------------------------------+   |
| TRIGGER 2: window 'online' Event   | --+
| (Web & Capacitor Network Restoral) |   |
+------------------------------------+   |
                                         +---> [ SyncOrchestrator.synchronize() ]
+------------------------------------+   |
| TRIGGER 3: Application Boot/Resume | --+
| (Visibility change / App Startup)  |   |
+------------------------------------+   |
                                         |
+------------------------------------+   |
| TRIGGER 4: Manual User Retry       | --+
| (UI "Retry Sync" action)           |
+------------------------------------+
```

---

### 3. Concurrency Control and Queue Locking (Cross-Context Durable Claiming)

To prevent race conditions, duplicate dispatches, or out-of-order execution when multiple triggers fire simultaneously across different execution contexts (e.g., Service Worker background sync vs. main thread UI events):

1. The logical `SyncOrchestrator` workflow uses **durable queue claiming** via the `StoragePort`.
2. When `synchronize()` is called by any context:
   - The orchestrator requests `StoragePort.atomicClaimNext()`.
   - The transaction atomically attaches operational claim metadata (e.g., `claimToken`, `claimedAt`) to the record and transitions its status to `SYNCING`.
3. This guarantees local concurrency safety: no two local executions can claim and dispatch the same queued record concurrently.
4. **Stale Claim Recovery**: A durable claim must contain enough information to determine that ownership is stale (e.g., `claimedAt` timestamp). A future synchronization attempt must be capable of reclaiming an abandoned record (where the previous context died) after a defined lease/staleness policy. The exact timeout duration is deferred to implementation configuration.

---

## 4. Sequential Queue Processing and Outcomes

Processing conceptually adheres to a default timestamp-ascending FIFO order (an architecture decision). However, a strict FIFO guarantee must not induce permanent queue starvation; the architecture explicitly permits a later fairness/retry policy to advance the queue if a head record repeatedly fails.

```text
[ Trigger Invokes Sync Workflow ]
              |
              v
[ StoragePort.atomicClaimNext() ]
              |
              +-------------------------------+
              |                               |
              | (No Claimable Items)          | (Successfully Claimed)
              v                               v
    [ Idle / Exit ]              [ PENDING_SYNC -> SYNCING ]
                                 [ + attach claim metadata ]
                                              |
                                              v
                                 [ Call SubmissionGateway.sendSubmission() ]
                                              |
      +---------------------------------------+---------------------------------------+
      |                                                                               |
      v (SubmissionOutcome: ACKNOWLEDGED)                                             v (failure / unacknowledged)
[ Mark 'SYNCED' ]                                                            [ Data remains durable ]
[ Finalize ]                                                                 [ Transition to 'SYNC_FAILED' or retry eligibility ]
                                                                             [ Apply future retry/fairness policy ]
```

### Detailed Execution Steps:

1. **Fetch and Claim**: The orchestrator attempts to claim the oldest claimable submission.
2. **Transition to `SYNCING`**: The atomic transaction updates the status and records claim metadata.
3. **Invoke Submission Gateway**: The orchestrator calls `SubmissionGateway.sendSubmission(submission)`.
   - _Remote Delivery Semantics_: The system cannot guarantee exactly-once remote delivery. If an acknowledgement is lost, the claim expires and the item is retried. The submission UUID remains stable across retries, enabling the future backend to handle idempotency.
4. **Success Handling (`ACKNOWLEDGED`)**:
   - The orchestrator updates the record status in IndexedDB to `SYNCED`.
   - The orchestrator attempts to claim the next item.
5. **Failure / Unacknowledged Handling (`RETRYABLE_FAILURE`, `REQUIRES_ATTENTION`)**:
   - E.g., network offline, timeout, or payload issues.
   - The orchestrator updates the record status in IndexedDB to `SYNC_FAILED` (or maintains retry eligibility).
   - **Data Retention Invariant**: The survey payload, defect notes, photo, and UUID remain completely intact (`SYNC-05`, `SYNC-10`).
   - The specific protocol mapping (e.g., mapping HTTP 503 or 400 to outcomes) and the exact retry scheduling algorithm remain open for implementation, but the architecture enforces that one failing item does not permanently doom subsequent records.

---

## 5. Cross-Platform Fallback Strategy (Safari / Non-Chromium)

Background Sync is not universally available (unsupported on iOS/Safari and Firefox; see `docs/research/SOURCES.md`). The system handles this seamlessly:

1. **Feature Detection**: When an offline submission is saved, the application checks:
   ```javascript
   if ('serviceWorker' in navigator && 'SyncManager' in window) {
     // Register Chromium Background Sync tag
     registration.sync.register('vku-survey-sync');
   }
   ```
2. **Graceful Fallback**: If `SyncManager` is not present (iOS Safari, Firefox), no error is thrown. The submission remains safely stored in IndexedDB as `PENDING_SYNC`.
3. **Fallback Triggers**: On non-supporting platforms, synchronization is triggered automatically when:
   - The browser emits the `window.addEventListener('online')` event (`SYNC-REQ-06`, `SYNC-03`).
   - The user switches back to the application tab (`document.addEventListener('visibilitychange')`).
   - The application boots on startup (`SYNC-08`).
   - The user presses the manual retry button in the UI (`SYNC-09`).

---

## 6. Edge Cases and Defensive Safeguards

| Edge Case                       | Safeguard                                                    | Result                                                                                                                                   |
| :------------------------------ | :----------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------- |
| **False-Positive Online Event** | `navigator.onLine` fires, but backend server is unreachable. | `SubmissionGateway` fails; record marked `SYNC_FAILED`; data preserved in IndexedDB; no crash (`SYNC-10`).                               |
| **Rapid Multiple Triggers**     | `online` event and manual click fire at the same time.       | Single-flight lock ignores redundant invocation; single dispatch proceeds (`SYNC-02`).                                                   |
| **Mid-Flight App Termination**  | App killed while record is in `SYNCING` state.               | On restart, `SyncOrchestrator` treats unacknowledged `SYNCING` records as retryable pending items, preventing stuck records (`SYNC-07`). |
| **Large Photo Attachment**      | Photo exceeds standard payload buffer.                       | Binary `Blob` streamed directly via `SubmissionGateway` without holding duplicate Base64 strings in memory.                              |
