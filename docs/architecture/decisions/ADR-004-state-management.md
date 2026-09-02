# ADR-004: Separation of Transient UI State from Persistent Domain Storage

- **Status**: approved (Frozen at Human Gate D)
- **Date**: 2026-09-02
- **Decision Owner**: Software Architect (Gate D)
- **Related Requirement/Acceptance IDs**: `DATA-REQ-01`, `DATA-REQ-03`, `DATA-01`, `DATA-02`, `UI-05`–`UI-08`

---

## 1. Context and Verified Sources

- In offline-first applications, conflating in-memory UI state with durable database persistence creates subtle data loss bugs, UI lag, and synchronization race conditions.
- Previous setup discussions suggested Zustand as a lightweight state container.
- Architectural invariant: IndexedDB is not an ephemeral component store, and an in-memory state manager (like Zustand) is not a persistent database.
- The UI requires tracking immediate transient state (active field focus, validation error messages, sync progress indicators, modal open/close) as well as observing durable state (saved drafts, queued items count, last sync status).

---

## 2. Options Considered

### Option A: Direct component local state (`useState` / `useReducer`) with manual persistence hooks

- _Cons_: Difficult to coordinate cross-component state (e.g., sync banner in the header needing status from background synchronization) if relying purely on prop drilling.

### Option B: Using an in-memory global state store (e.g., Zustand) as the persistence layer

- _Cons_: If Zustand is treated as the database, browser refresh or crash purges unsaved data unless coupled to `localStorage`, which cannot handle binary Blobs efficiently. Zustand must not become a second persistent database.

### Option C: Strict Dual-Layer State Model

- **Transient UI State (In-Memory)**: Managed via local component state (`useState`) for isolated UI concerns, and a lightweight Zustand store for genuinely shared transient state (e.g., global network banner visibility, live synchronization progress).
- **Persistent Domain State (Durable)**: Managed exclusively via `SurveyStoragePort` backed by IndexedDB. Holds active draft records, photo Blobs, and the queued submissions waiting for synchronization.
- _Bridge_: Form changes update transient state for immediate UI feedback, then trigger a debounced autosave command to `SurveyStoragePort`. Draft recovery on app startup reads from `SurveyStoragePort` and rehydrates the transient store.

---

## 3. Decision

1. Adopt Option C (Strict Dual-Layer State Model).
2. Keep local component state local. Recommend **Zustand** only for managing genuinely shared transient UI state.
3. Prohibit using Zustand or `localStorage` as a substitute for IndexedDB domain storage.
4. Form inputs bind to transient state; background use cases synchronize changes to the durable `SurveyStoragePort`.

---

## 4. Consequences and Risks

- **Consequences**:
  - UI stays responsive and decoupled from database transaction latency.
  - Refresh and restart behavior (`DATA-02`, `DATA-03`) rely on durable IndexedDB persistence, guaranteeing data survival across browser crashes and native app restarts.
- **Risks & Mitigation**:
  - _Risk_: A browser tab is closed during the debounce window before the transient state is flushed to IndexedDB.
  - _Mitigation_: Register a `beforeunload` / page visibility event listener to flush any pending debounced save to `SurveyStoragePort` immediately when the user navigates away or backgrounds the app.

---

## 5. Approval Reference

- Approved and frozen by the human owner at Gate D.
