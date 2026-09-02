# Synchronization Acceptance

Design status: **Owner decisions applied — candidate for Gate B freeze**

Execution status: **NOT TESTED**

| ID | Class | Trace | PASS conditions | Required evidence |
|---|---|---|---|---|
| SYNC-01 | DIRECT | SYNC-REQ-01–SYNC-REQ-03 | Submitting while offline creates a queued survey containing a UUID, timestamp, and `PENDING_SYNC` state. | UI and IndexedDB inspection of the queued record |
| SYNC-02 | DIRECT | SYNC-REQ-04, SYNC-REQ-05 | With at least two queued surveys, dispatch attempts occur sequentially rather than concurrently. | Ordered request/execution trace with record UUIDs |
| SYNC-03 | DIRECT | SYNC-REQ-04, SYNC-REQ-06, NATIVE-REQ-03 | A transition back to online through the required web/native connectivity signals triggers retry of queued surveys. | Connectivity transition and retry-attempt trace |
| SYNC-04 | DERIVED | SYNC-REQ-03, SYNC-REQ-04 | A `PENDING_SYNC` survey enters a synchronization attempt and becomes `SYNCED` only after positive acknowledgement from the submission destination. A failed or unacknowledged attempt is never represented as `SYNCED`. | State-transition trace, destination acknowledgement evidence, and post-attempt record state |
| SYNC-05 | DERIVED | DATA-REQ-03, SYNC-REQ-03, SYNC-REQ-04 | An unreachable destination or failed request retains the queued survey payload, photo, UUID, and retryable state. | Failure simulation and before/after IndexedDB inspection |
| SYNC-06 | DERIVED | SYNC-REQ-04 | A survey retained after a failed attempt is dispatched again after a later qualifying connectivity-return trigger. | Failure-then-retry trace for the same UUID |
| SYNC-07 | QUALITY_PROPOSAL | Project Quality Proposal | When platform persistent storage remains available, queued surveys and their retryable state survive page refresh, browser close/reopen, and native application restart. | Before/after lifecycle, platform storage conditions, and IndexedDB evidence |
| SYNC-08 | QUALITY_PROPOSAL | Project Quality Proposal | Starting or resuming the application with queued surveys initiates a retry when the approved retry preconditions are satisfied. | Startup/resume and retry trace |
| SYNC-09 | DIRECT | SYNC-REQ-06, SYNC-REQ-07 | Background Sync initiates queued retry where supported; `window.ononline` remains an assignment-required trigger independently of Background Sync availability. | Capability state and trigger-specific retry traces |
| SYNC-10 | DERIVED | DATA-REQ-03, SYNC-REQ-03, SYNC-REQ-04 | An online signal followed by an unreachable or failed destination does not mark the survey complete or delete its queued data. | Online-signal/request-failure trace and retained record evidence |

## Approved Acceptance Terminology

- `PENDING_SYNC`: queued and awaiting synchronization; directly required by the assignment.
- `SYNCING`: a synchronization attempt is in progress; project terminology.
- `SYNCED`: positive destination acknowledgement has been received; project terminology.
- `SYNC_FAILED`: the last attempt failed or was not positively acknowledged; project terminology, with data retained for retry.

Endpoint, payload, authentication, idempotency mechanism, transport-specific acknowledgement, and state implementation remain undecided. This file does not define them.
