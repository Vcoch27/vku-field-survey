---
name: offline-sync
description: >
  Designs or verifies durable VKU survey drafts and sequential synchronization,
  including IndexedDB-compatible persistence, UUID/timestamps, PENDING_SYNC,
  retries, failure preservation, and duplicate control. Do not use for UI styling.
---

# Purpose

Protect field data through offline draft and synchronization lifecycles without inventing a destination contract.

# Required Reading

- Data/sync requirements and `docs/acceptance/OFFLINE.md`, `docs/acceptance/SYNC.md`
- Researched risks, approved data/sync architecture, interfaces, and API contract if one exists

# In Scope

- Draft lifecycle, IndexedDB-compatible persistence, attachments, UUID, timestamp, `PENDING_SYNC`, queue ordering, sequential retry, shared sync entry point, failure preservation, and duplicate prevention

# Out of Scope

- Colors, animations, layout, UX copy, service-worker App Shell caching, camera UI, or backend invention

# Invariants

- Failed or unreachable requests never delete unsynced data or create false success.
- Network status only triggers a retry.
- All triggers call one sync use case; queue processing is sequential.
- Completion requires the approved destination acknowledgement.

# Procedure

1. Gate the task against DATA/SYNC IDs and unresolved API questions.
2. Model states, transitions, identifiers, timestamps, attachment ownership, and transaction boundaries.
3. Specify retry, idempotency/duplicate protection, crash recovery, and failure retention using approved contracts.
4. Keep browser/native triggers outside the core sync use case behind interfaces.
5. When authorized, test refresh/restart, multi-draft isolation, multi-item order, failure/retry, unsupported Background Sync fallback, and false-online cases.

# Verification

Execute mapped scenarios from `OFFLINE.md` and `SYNC.md`; inspect persisted records and trace the same UUID across failures/retries.

# Output Contract

Return mapped IDs, state/transition contract, data-retention invariants, assumptions, implementation or review scope, test results, evidence, and unresolved API decisions.

# References

- Approved `docs/architecture/DATA_FLOW.md`, `SYNC_FLOW.md`, and ADRs when available

# Optional Scripts

Only deterministic fixture/queue validation that cannot touch real user data by default.
