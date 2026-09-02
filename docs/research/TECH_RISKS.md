# Technical Risks

Status: **AUDITED AND CORRECTED — RESEARCH PASS**

All risks are grounded in primary sources recorded in `docs/research/SOURCES.md`.

---

## RISK-001 — Incomplete Background Sync Availability Across Platforms
- **Related IDs**: `SYNC-REQ-07`, `SYNC-09`
- **Verified Context**: 
  - **FACT**: The Background Synchronization API is a WICG specification with Limited Availability. It is supported on Chromium-based engines (Chrome, Edge, Samsung Internet), but **unsupported** in Apple WebKit / Safari (iOS and macOS) and Mozilla Firefox. Furthermore, even where supported, browsers throttle or defer execution based on device battery and background budgets.
- **Likelihood**: High (guaranteed on non-Chromium devices).
- **Impact**: High if Background Sync is treated as the primary or sole synchronization trigger, as background queue processing will fail silently on Safari/iOS.
- **Proposed Mitigation**: 
  - **RECOMMENDATION**: Feature-detect Background Sync API before registering sync tags. Implement a multi-trigger synchronization architecture where `window.addEventListener('online')`, application visibility/focus change (`document.addEventListener('visibilitychange')`), and user-initiated sync actions invoke the exact same centralized sync use case (`SYNC-REQ-06`, `SYNC-03`).
- **Residual Risk**: Queued surveys on Safari/iOS will not synchronize when the application/browser tab is completely closed; sync will resume upon the next app launch or return to foreground.
- **Human Decision Required**: No (handled by architectural design adhering to frozen acceptance criteria).

---

## RISK-002 — False-Positive Online State from `navigator.onLine`
- **Related IDs**: `SYNC-REQ-06`, `SYNC-10`, `NATIVE-REQ-03`, `NATIVE-05`, `NATIVE-06`
- **Verified Context**: 
  - **FACT**: `navigator.onLine === true` and window `online` events only indicate an active local network interface, not end-to-end internet connectivity or destination server reachability (MDN / WHATWG HTML). Captive portals, firewalls, and server outages yield `true` while HTTP dispatches fail.
- **Likelihood**: High in field survey environments (unstable Wi-Fi, campus networks, cellular dead zones).
- **Impact**: A naive sync engine that equates `online === true` with success risks marking surveys complete prematurely or throwing unhandled errors.
- **Proposed Mitigation**: 
  - **RECOMMENDATION**: Adhere strictly to project invariants: network status is solely an attempt trigger. A queued survey remains in `PENDING_SYNC` or transitions to `SYNC_FAILED` on failed network dispatch, preserving all draft data, photos, and UUIDs (`SYNC-04`, `SYNC-05`, `SYNC-10`). No survey is marked `SYNCED` without positive destination acknowledgement.
- **Residual Risk**: UI may temporarily display "Network Available" while backend remains unreachable; UI copy must distinguish local connectivity from remote synchronization completion (`UI-05`, `UI-07`).
- **Human Decision Required**: No.

---

## RISK-003 — WebView Memory Overhead and OOM Crashes from Photo Data
- **Related IDs**: `NATIVE-REQ-02`, `FORM-REQ-07`, `NATIVE-04`, `DATA-05`
- **Verified Context**: 
  - **FACT**: Native camera sensors produce high-resolution images (often 12–50 MP, 3–15 MB compressed). Converting images to Base64 strings in the JavaScript runtime increases memory size by ~33% and creates multiple large allocations in the V8 heap.
- **Likelihood**: Medium to High on low-to-mid-range Android mobile devices if full Base64 strings are stored in app state.
- **Impact**: Performance degradation, UI stuttering, or native Android Out-Of-Memory (OOM) process termination.
- **Proposed Mitigation**: 
  - **RECOMMENDATION**: Avoid retaining raw Base64 strings in application state. Use Capacitor's URI-based photo representation (`webPath` / file path), render previews using standard image elements, and persist photo binary data in IndexedDB as native `Blob` objects via `idb` rather than Base64 strings.
- **Residual Risk**: Android may purge temporary cache directories if storage is critically low; persisted photos should be stored in durable app storage or IndexedDB.
- **Human Decision Required**: No.

---

## RISK-004 — Storage Quota and Eviction of Local Drafts
- **Related IDs**: `DATA-REQ-01`, `DATA-REQ-03`, `DATA-01`, `DATA-03`
- **Verified Context**: 
  - **FACT**: Browsers manage IndexedDB under origin storage quotas and LRU eviction policies (MDN Storage API). Under extreme disk pressure, temporary origin storage can be cleared by the OS or browser.
- **Likelihood**: Low for standard survey text and compressed photos, but non-zero on full devices.
- **Impact**: Unsynced survey drafts or queue entries could be lost prior to successful dispatch.
- **Proposed Mitigation**: 
  - **RECOMMENDATION**: Wrap IndexedDB transactions in defensive error handling catching `QuotaExceededError`. Optionally request persistent storage permission (`navigator.storage.persist()`) where supported. Ensure photo attachments are kept to reasonable dimensions before storage.
- **Residual Risk**: If the user explicitly clears browser site data or uninstalls the app, local storage is purged.
- **Human Decision Required**: No.

---

## RISK-005 — Architectural Rework from Premature Backend Contract Assumptions
- **Related IDs**: `OQ-003`, `OQ-006`, `SYNC-04`
- **Verified Context**: 
  - **FACT**: The VKU assignment defines no backend destination, URL, request schema, authentication method, or positive acknowledgement format.
  - **FACT**: Generic HTTP semantics (RFC 9110) do not prescribe an application-level contract.
- **Likelihood**: High if architecture or sync engine couples directly to an assumed REST/JSON endpoint.
- **Impact**: Substantial refactoring required when actual backend or mock requirements are introduced.
- **Proposed Mitigation**: 
  - **RECOMMENDATION**: In Gate D architecture, encapsulate submission dispatch behind a decoupled interface (e.g. `SyncDestinationAdapter`) returning a typed result. The offline queue, IndexedDB repository, and UI must depend only on this abstraction, keeping OQ-003 and OQ-006 isolated until explicitly decided.
- **Residual Risk**: A complex backend contract (e.g. multi-step multipart auth) might require expanding the adapter interface.
- **Human Decision Required**: Yes (Human Gates D & E).
