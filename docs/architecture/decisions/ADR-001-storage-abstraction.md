# ADR-001: Storage Abstraction and Persistence Engine Choice

- **Status**: approved (Frozen at Human Gate D)
- **Date**: 2026-09-02
- **Decision Owner**: Software Architect (Gate D)
- **Related Requirement/Acceptance IDs**: `DATA-REQ-01`, `DATA-REQ-02`, `DATA-REQ-03`, `DATA-01`, `DATA-02`, `DATA-03`, `DATA-05`, `DATA-06`

---

## 1. Context and Verified Sources

- `DATA-REQ-02` specifies: _"Use IndexedDB through either `idb` or `localForage`; the assignment permits both and does not select one."_
- `DATA-REQ-01` and `DATA-01` require real-time automatic persistence of active drafts without a manual save action.
- `DATA-05` requires that photos captured during inspection remain attached to the draft across page reloads.
- Researched facts from `docs/research/SOURCES.md`:
  - `idb` (Google Chrome / Jake Archibald) is an actively maintained, minimal promise-based wrapper over native IndexedDB. It directly supports native structured cloning for binary `Blob` and `File` objects without custom serialization overhead, and provides first-class TypeScript typings.
  - `localForage` is an asynchronous key-value store modeled after `localStorage` with multi-driver fallback (IndexedDB, WebSQL, localStorage). WebSQL is deprecated/removed in modern browsers. `localForage` handles Blobs under IndexedDB, but introduces overhead/limitations for non-IndexedDB drivers and has seen low commit activity since v1.10.0 (2021).
- The application architecture requires storing both active drafts and an ordered queue of pending offline submissions with query capabilities.

---

## 2. Options Considered

### Option A: Direct use of `localForage`

- _Pros_: Simple key-value API (`getItem`, `setItem`).
- _Cons_: Limited to key-value semantics; querying by status or managing complex transactional object stores requires workarounds. Contains legacy driver fallbacks (WebSQL) that add unnecessary bundle weight.

### Option B: Direct use of `idb` through an architectural Storage Port

- _Pros_: Exposes full IndexedDB capabilities (object stores, indices, transactions) via clean Promises. Supports native structured cloning for binary photos (`Blob`). Negligible bundle footprint (~1.2 kB). Full TypeScript support.
- _Cons_: Slightly lower-level than a basic key-value store (requires defining store names and transaction boundaries in the adapter).

### Option C: Custom wrapper over raw browser IndexedDB API

- _Pros_: Zero external dependencies.
- _Cons_: Significant boilerplate, event-based callback management, error-prone transaction lifecycle handling.

---

## 3. Decision

1. Define a clean domain port: `SurveyStoragePort`. Business logic and UI will interact exclusively with this port and will never import or reference IndexedDB directly.
2. Use `idb` as the concrete infrastructure adapter (`IdbSurveyStorageAdapter`).
3. Model two distinct IndexedDB object stores within the database:
   - `drafts`: stores the active, in-progress inspection draft keyed by draft ID.
   - `submission_queue`: stores queued submissions awaiting synchronization, indexed by `timestamp` and `syncStatus`.

---

## 4. Consequences and Risks

- **Consequences**:
  - The domain and UI remain completely decoupled from the underlying storage technology.
  - Efficient binary photo storage is achieved natively without Base64 expansion.
  - If the human owner later prefers `localForage`, only the adapter implementation changes; no use cases or UI components are impacted.
- **Risks & Mitigation**:
  - _Risk_: Storage quota exceeded on devices with critically low disk space (`QuotaExceededError`).
  - _Mitigation_: The adapter wraps transactions in defensive error handling, catching quota errors and surfacing actionable notifications to the user without crashing.

---

## 5. Approval Reference

- Approved and frozen by the human owner at Gate D.
