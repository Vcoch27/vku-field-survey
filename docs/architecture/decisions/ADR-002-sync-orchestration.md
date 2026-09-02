# ADR-002: Centralized Sequential Sync Orchestration with Single-Flight Locking

- **Status**: approved (Frozen at Human Gate D)
- **Date**: 2026-09-02
- **Decision Owner**: Software Architect (Gate D)
- **Related Requirement/Acceptance IDs**: `SYNC-REQ-01`–`SYNC-REQ-07`, `SYNC-01`–`SYNC-10`

---

## 1. Context and Verified Sources

- The VKU assignment requires:
  - Generating UUID, timestamp, and `PENDING_SYNC` status for each offline submission (`SYNC-REQ-01`–`03`).
  - Retrying queued submissions when connectivity returns (`SYNC-REQ-04`).
  - Supporting both `window.ononline` and Background Sync as triggers (`SYNC-REQ-06`, `SYNC-REQ-07`).
- Researched platform constraints (`docs/research/SOURCES.md`):
  - Background Sync API is unsupported on iOS/Safari and Firefox; execution is deferred/throttled even on Chromium.
  - `navigator.onLine` produces false positives (connected to local network/Wi-Fi router, but internet/server unreachable).
  - Triggers can fire concurrently across isolated contexts (e.g., Service Worker background sync vs. main thread UI events).
- Acceptance Invariant: A queued survey must never be deleted on failure, and must transition to `SYNCED` only upon positive destination acknowledgement (`SYNC-04`, `SYNC-10`).
- Architecture Decision: Process pending items with a default timestamp-ascending FIFO order to ensure predictable synchronization, while preventing permanent queue starvation.

---

## 2. Options Considered

### Option A: In-Memory Single-Flight Lock

- _Concept_: An in-memory mutex (`isSyncing = true`) prevents concurrent execution.
- _Cons_: Fails across isolated execution contexts (e.g., Service Worker and browser window do not share memory). Duplicate dispatches could occur if both contexts trigger sync simultaneously.

### Option B: Cross-Context Durable Queue Claiming

- _Concept_: Sync orchestration is a shared logical workflow, not a singleton in-memory object. When any context triggers a sync pass, it must securely claim a queued record via an atomic, durable transactional lock using operational metadata (`claimToken`, `claimedAt`) before dispatching it.
- _Pros_: Safe across Main Thread and Service Worker contexts. No two executions can claim and dispatch the same queued record concurrently.
- _Cons_: Requires transactional storage updates and handling of stale claims.

---

## 3. Decision

1. Route **all** synchronization triggers to a shared logical workflow contract (`SyncOrchestrator`), recognizing it may run in separate contexts (UI thread or Service Worker).
2. Enforce **cross-context durable queue claiming**. An execution context must atomically claim a queued record by attaching claim metadata (`claimToken`, `claimedAt`) and updating status to `SYNCING` before network dispatch.
3. **Local concurrency safety only**: This lock prevents concurrent local dispatch, but does **not** guarantee exactly-once remote delivery. Network ambiguity means delivery is at-least-once. The stable client-generated UUID must survive retries to enable future backend idempotency.
4. Process the queue conceptually using **FIFO order** as a default preference (architecture decision), but explicitly require a fairness/retry policy so a failing head record does not permanently starve subsequent records.
5. For each claimed survey:
   - Dispatch to `SubmissionGateway` which returns an abstract `SubmissionOutcome`.
   - On positive `ACKNOWLEDGED`: update persistent record to `SYNCED`.
   - On `RETRYABLE_FAILURE` or `REQUIRES_ATTENTION`: transition to `SYNC_FAILED` (or return to `PENDING_SYNC`). Retain full data.
6. Never delete unacknowledged data on network or server failure (`SYNC-05`, `SYNC-10`).
7. Stale claim recovery: Future sync attempts must be capable of reclaiming an abandoned record (where the claim context died mid-flight) after a defined lease/staleness policy.

---

## 4. Consequences and Risks

- **Consequences**:
  - Full compliance with `SYNC-REQ-04`.
  - Zero duplicate network dispatches caused by multiple overlapping contexts.
  - At-least-once network delivery semantics gracefully handled via stable UUIDs.
- **Risks & Mitigation**:
  - _Risk_: A record is claimed but the context crashes before resolving the claim.
  - _Mitigation_: The architecture contract requires claim metadata (e.g., `claimedAt`) to support stale claim recovery, allowing the orchestrator to reclaim abandoned records based on a timeout policy.

---

## 5. Approval Reference

- Approved and frozen by the human owner at Gate D.
