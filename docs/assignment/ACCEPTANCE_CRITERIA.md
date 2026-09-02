# VKU Field Survey Acceptance Criteria

Design status: **Owner decisions applied — candidate for Human Gate B freeze**

Execution status: **NOT TESTED — product does not exist**

Each criterion has exactly one classification:

- `DIRECT`: explicitly required by the VKU assignment.
- `DERIVED`: necessary to prove a direct requirement safely and meaningfully.
- `QUALITY_PROPOSAL`: owner-approved project quality commitment, but not an assignment requirement.
- `BLOCKED`: cannot be finalized until the referenced open question is resolved.
- `REMOVE`: unjustified, redundant, overly speculative, or architecture-specific.

## Classification Registry

| Acceptance ID | Classification | Requirement or open-question trace |
|---|---|---|
| PWA-01 | DIRECT | PWA-REQ-01, PWA-REQ-02, PWA-REQ-05 |
| PWA-02 | DIRECT | PWA-REQ-03 |
| PWA-03 | DIRECT | PWA-REQ-02–PWA-REQ-05 |
| PWA-04 | DIRECT | PWA-REQ-06 |
| PWA-05 | DIRECT | PWA-REQ-07 |
| PWA-06 | DERIVED | PWA-REQ-06, PWA-REQ-07 |
| DATA-01 | DIRECT | DATA-REQ-01, DATA-REQ-02 |
| DATA-02 | DIRECT | DATA-REQ-01–DATA-REQ-03 |
| DATA-03 | QUALITY_PROPOSAL | Project Quality Proposal |
| DATA-04 | DERIVED | DATA-REQ-01–DATA-REQ-03 |
| DATA-05 | DERIVED | DATA-REQ-01–DATA-REQ-03, FORM-REQ-07 |
| DATA-06 | QUALITY_PROPOSAL | Project Quality Proposal |
| SYNC-01 | DIRECT | SYNC-REQ-01–SYNC-REQ-03 |
| SYNC-02 | DIRECT | SYNC-REQ-04, SYNC-REQ-05 |
| SYNC-03 | DIRECT | SYNC-REQ-04, SYNC-REQ-06, NATIVE-REQ-03 |
| SYNC-04 | DERIVED | SYNC-REQ-03, SYNC-REQ-04 |
| SYNC-05 | DERIVED | DATA-REQ-03, SYNC-REQ-03, SYNC-REQ-04 |
| SYNC-06 | DERIVED | SYNC-REQ-04 |
| SYNC-07 | QUALITY_PROPOSAL | Project Quality Proposal |
| SYNC-08 | QUALITY_PROPOSAL | Project Quality Proposal |
| SYNC-09 | DIRECT | SYNC-REQ-06, SYNC-REQ-07 |
| SYNC-10 | DERIVED | DATA-REQ-03, SYNC-REQ-03, SYNC-REQ-04 |
| NATIVE-01 | DIRECT | NATIVE-REQ-01, NATIVE-REQ-04 |
| NATIVE-02 | DIRECT | NATIVE-REQ-01, NATIVE-REQ-04 |
| NATIVE-03 | DIRECT | NATIVE-REQ-02 |
| NATIVE-04 | DIRECT | FORM-REQ-07, NATIVE-REQ-02 |
| NATIVE-05 | DIRECT | NATIVE-REQ-03 |
| NATIVE-06 | DIRECT | NATIVE-REQ-03, SYNC-REQ-04 |
| NATIVE-07 | QUALITY_PROPOSAL | Project Quality Proposal |
| UI-01 | DERIVED | PWA-REQ-01, FORM-REQ-01–FORM-REQ-07, NATIVE-REQ-01 |
| UI-02 | QUALITY_PROPOSAL | Project Quality Proposal |
| UI-03 | DERIVED | FORM-REQ-05 |
| UI-04 | QUALITY_PROPOSAL | Project Quality Proposal |
| UI-05 | QUALITY_PROPOSAL | Project Quality Proposal |
| UI-06 | QUALITY_PROPOSAL | Project Quality Proposal |
| UI-07 | QUALITY_PROPOSAL | Project Quality Proposal |
| UI-08 | QUALITY_PROPOSAL | Project Quality Proposal |
| UI-09 | QUALITY_PROPOSAL | Project Quality Proposal |
| UI-10 | QUALITY_PROPOSAL | Project Quality Proposal |

## Classification Count

| Classification | Count |
|---|---:|
| DIRECT | 17 |
| DERIVED | 9 |
| QUALITY_PROPOSAL | 13 |
| BLOCKED | 0 |
| REMOVE | 0 |
| **Total** | **39** |

## Detailed Contracts

- PWA: `docs/acceptance/PWA.md`
- Offline persistence: `docs/acceptance/OFFLINE.md`
- Synchronization: `docs/acceptance/SYNC.md`
- Native Android: `docs/acceptance/NATIVE.md`
- UI: `docs/acceptance/UI.md`

## Owner-Approved Acceptance Decisions

- Autosave occurs automatically after meaningful form changes without a manual Save action. A short debounce is permitted; its exact duration is not an acceptance requirement.
- Browser/native restart persistence is a project quality commitment when platform persistent storage remains available.
- Acceptance terminology is `PENDING_SYNC`, `SYNCING`, `SYNCED`, and `SYNC_FAILED`. Only `PENDING_SYNC` is a direct assignment term.
- `SYNCED` requires positive acknowledgement from the submission destination. A failed or unacknowledged attempt must not be represented as `SYNCED`.
- Saved-locally, pending, failed, and synchronized UI feedback is a project quality commitment; visual treatment is deferred.

## Completion Rule

Classification is not approval or test status. An agent may claim completion only after Human Gate B approves the criterion, the implementation exists, the documented verification is executed, results are recorded, and evidence is linked.
