# Technical Research Sources

Status: **AUDITED AND CORRECTED — RESEARCH PASS**

All consequential findings must be explicitly classified as:
- **FACT**: Verified against primary standards or official platform/maintainer documentation.
- **PROJECT REQUIREMENT**: Explicitly mandated by the VKU assignment or owner-approved acceptance contract.
- **RECOMMENDATION**: Engineering proposal or best practice; not a standard or assignment mandate.
- **OPEN ISSUE**: Technical or domain question requiring external or human decision.

---

## Findings Registry

### 1. PWA Installability and Service Worker Relationship
- **Source URL**: 
  - https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
  - https://web.dev/articles/install-criteria
  - https://w3c.github.io/manifest/
- **Source Owner**: MDN / Google Chrome Web.dev / W3C Web Applications Working Group
- **Source Class**: Official standard and browser documentation
- **Date Checked**: 2026-09-02
- **Related Requirement/Acceptance IDs**: `PWA-REQ-01`, `PWA-REQ-02`, `PWA-REQ-06`, `PWA-REQ-07`, `PWA-01`, `PWA-04`, `PWA-05`
- **Verified Facts**:
  - Web App Manifest is a W3C specification defining metadata (name, icons, start_url, display mode).
  - Secure context (HTTPS or localhost) is required for Service Workers and modern PWA installation prompts across all supporting engines.
  - Browser installability heuristics differ: Chromium historically required a registered Service Worker controlling `start_url` to fire `beforeinstallprompt` and show automated install UI; other browsers (such as Safari on iOS and macOS Sonoma) allow "Add to Home Screen" or "Add to Dock" via Web App Manifest and meta tags without requiring a Service Worker.
  - Therefore, Service Worker registration is **not** a universal web-standard prerequisite for installation across all platforms.
- **Project Requirement**:
  - In this project, Service Worker App Shell caching (`PWA-REQ-06`, `PWA-04`) and offline boot (`PWA-REQ-07`, `PWA-05`, `PWA-06`) are **explicit VKU assignment requirements**, completely independent of whether a specific browser requires a Service Worker for home-screen installation.
- **Project Implication**:
  - The project must register a Service Worker that precaches the App Shell and satisfies both Chromium installability checks and the VKU offline requirements.

---

### 2. Background Synchronization API Availability
- **Source URL**: 
  - https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API
  - https://wicg.github.io/background-sync/spec/
- **Source Owner**: MDN / WICG (Web Incubator Community Group)
- **Source Class**: Community draft specification / MDN browser compatibility database
- **Date Checked**: 2026-09-02
- **Related Requirement/Acceptance IDs**: `SYNC-REQ-04`, `SYNC-REQ-06`, `SYNC-REQ-07`, `SYNC-03`, `SYNC-09`
- **Verified Facts**:
  - The Background Synchronization API is a WICG specification with **Limited Availability** (it is not part of the standard Web Platform Baseline).
  - Requires a secure context (HTTPS) and an active Service Worker registration (`registration.sync.register('tag')`).
  - Browser support is incomplete: Supported in Chromium-based desktop and mobile browsers (Chrome 49+, Edge 79+, Opera, Samsung Internet).
  - **Not supported** in Mozilla Firefox or Apple WebKit / Safari (macOS and iOS).
  - Even where supported, execution timing is governed by browser resource constraints (battery, background execution budgets) and is not guaranteed to execute immediately or when the browser process is completely terminated.
- **Recommendation**:
  - Background Sync cannot be the sole synchronization mechanism. The application architecture must provide fallback synchronization triggers (such as `window.addEventListener('online')`, document visibility / focus resume, and user-initiated sync) to satisfy cross-platform requirements (`SYNC-REQ-06`, `SYNC-03`, `SYNC-09`).
  - Note: Providing fallbacks is an architectural quality recommendation to satisfy project criteria, not a requirement of the Background Sync Web API itself.

---

### 3. Network Connectivity and Reachability Semantics
- **Source URL**: 
  - https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine
  - https://html.spec.whatwg.org/multipage/system-state.html#browser-state
- **Source Owner**: MDN / WHATWG HTML Living Standard
- **Source Class**: Official web standard
- **Date Checked**: 2026-09-02
- **Related Requirement/Acceptance IDs**: `SYNC-REQ-04`, `SYNC-REQ-06`, `SYNC-03`, `SYNC-10`, `NATIVE-REQ-03`, `NATIVE-05`, `NATIVE-06`
- **Verified Facts**:
  - `navigator.onLine` returns a boolean indicating whether the user agent has an active local network interface connection.
  - A `false` value reliably indicates that the browser is disconnected from any local network.
  - A `true` value **does not** prove that remote servers or the specific application backend are reachable. Common failure modes (captive portals, offline Wi-Fi access points, firewalls, DNS failures, server downtime) cause `navigator.onLine` to report `true` while HTTP requests fail.
  - The `online` and `offline` window events merely reflect state changes of `navigator.onLine`.
- **Recommendation**:
  - Treat `online` events and `@capacitor/network` status changes strictly as triggers to initiate a synchronization attempt, never as evidence that data was transferred.
  - Failed network requests must leave queued items in `SYNC_FAILED` / `PENDING_SYNC` without data loss (`SYNC-05`, `SYNC-10`).

---

### 4. IndexedDB Persistence, Quotas, and Library Comparison
- **Source URL**: 
  - https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
  - https://github.com/jakearchibald/idb
  - https://github.com/localForage/localForage
- **Source Owner**: MDN / Jake Archibald (Google) / localForage maintainers
- **Source Class**: Official standard / official maintainer repositories
- **Date Checked**: 2026-09-02
- **Related Requirement/Acceptance IDs**: `DATA-REQ-01`, `DATA-REQ-02`, `DATA-REQ-03`, `DATA-01`, `DATA-02`, `DATA-03`
- **Verified Facts**:
  - IndexedDB operates asynchronously using structured transactions. Under storage pressure, browsers manage storage quotas and can evict temporary origin data under an LRU policy if device storage is constrained.
  - `DATA-REQ-02` permits either `idb` or `localForage`; the assignment does not select one.
  - `idb`: A lightweight, promise-based wrapper over native IndexedDB. Directly exposes object stores, indexes, and transactions. Leverages the browser's structured clone algorithm directly to store binary data (`Blob`, `File`, `ArrayBuffer`) without serialization overhead. Provides official TypeScript typings and has regular maintenance/updates.
  - `localForage`: An asynchronous key-value store abstraction modeled after `localStorage`. Supports driver fallback (IndexedDB, WebSQL, localStorage). WebSQL is deprecated and removed in modern browsers. Handles `Blob` data under IndexedDB driver, but has serialization overhead/limitations when driver fallback is involved. Latest release is v1.10.0 (2021) with very low commit frequency. It is not formally labeled "deprecated" by its maintainers, but has infrequent release activity.
- **Recommendation**:
  - `idb` is strongly recommended for the architecture phase because it provides direct, idiomatic TypeScript access to IndexedDB object stores and native `Blob` storage without legacy driver fallbacks (WebSQL).
  - Final library selection remains a Gate D architectural decision.

---

### 5. Capacitor Android SDK and Environment Specifications
- **Source URL**: 
  - https://capacitorjs.com/docs/android
  - https://capacitorjs.com/docs/updating/6-0
  - https://capacitorjs.com/docs/updating/7-0
- **Source Owner**: Ionic / Capacitor official documentation
- **Source Class**: Official product documentation
- **Date Checked**: 2026-09-02
- **Related Requirement/Acceptance IDs**: `NATIVE-REQ-01`, `NATIVE-REQ-04`, `NATIVE-01`, `NATIVE-02`
- **Verified Facts**:
  - Capacitor Android applications run inside an Android WebView requiring Chrome/System WebView version 60 or newer.
  - **Capacitor 6 Requirements**:
    - Java JDK 17.
    - Android Studio Hedgehog (2023.1.1) or newer.
    - Gradle 8.2+.
    - Default project variables: `compileSdkVersion = 34`, `targetSdkVersion = 34`, `minSdkVersion = 22`.
  - **Capacitor 7 Requirements**:
    - Java JDK 21.
    - Android Studio Ladybug (2024.2.1) or newer.
    - Default project variables: `compileSdkVersion = 35`, `targetSdkVersion = 35`, `minSdkVersion = 23`.
- **Recommendation**:
  - Select either Capacitor 6 or Capacitor 7 based on available local Android Studio and JDK toolchains, configuring matching target SDKs in `variables.gradle`. Minimum Android version does not need to be artificially restricted beyond Capacitor's baseline (`minSdkVersion 22` or `23`).

---

### 6. Capacitor Camera Return Formats and Memory Management
- **Source URL**: 
  - https://capacitorjs.com/docs/apis/camera
  - https://capacitorjs.com/docs/apis/camera#cameraresulttype
- **Source Owner**: Ionic / Capacitor official documentation
- **Source Class**: Official product documentation
- **Date Checked**: 2026-09-02
- **Related Requirement/Acceptance IDs**: `NATIVE-REQ-02`, `FORM-REQ-07`, `NATIVE-03`, `NATIVE-04`, `DATA-05`
- **Verified Facts**:
  - The `@capacitor/camera` plugin returns photos taken or picked from the gallery.
  - In earlier/standard plugin versions, `CameraOptions` accepts `resultType` with values from `CameraResultType`: `Uri`, `Base64`, or `DataUrl`. In newer plugin revisions, file-path/URI properties (`webPath`, `path`) are the standard output format.
  - Official documentation notes that Base64/DataUrl strings carry significant memory overhead due to string encoding (~33% size increase) and duplicate allocations in the JavaScript heap.
  - Capacitor documentation does not strictly prohibit Base64, but strongly emphasizes the performance and memory advantages of file-path/URI references.
- **Recommendation**:
  - For this project, URI-based results (`webPath` / file URI) are preferred over Base64/DataUrl strings to prevent memory spikes and Out-Of-Memory (OOM) crashes on mobile devices when handling multi-megapixel camera photos.

---

### 7. HTTP Protocol Semantics and Success Acknowledgement
- **Source URL**: 
  - https://www.rfc-editor.org/rfc/rfc9110#section-15
  - https://developer.mozilla.org/en-US/docs/Web/HTTP/Status
- **Source Owner**: IETF (RFC 9110 HTTP Semantics) / MDN
- **Source Class**: Official international standard
- **Date Checked**: 2026-09-02
- **Related Requirement/Acceptance IDs**: `SYNC-REQ-04`, `SYNC-04`, `OQ-003`, `OQ-006`
- **Verified Facts**:
  - Under RFC 9110 Section 15.3, the 2xx (Successful) class of status codes indicates that the client's request was successfully received, understood, and accepted at the HTTP protocol layer (e.g., `200 OK`, `201 Created`, `202 Accepted`).
  - The 4xx (Client Error) class indicates client-side errors, but individual codes have very different recovery semantics:
    - Non-retryable without payload change: `400 Bad Request`, `422 Unprocessable Content`.
    - Authentication-dependent: `401 Unauthorized`, `403 Forbidden`.
    - Recoverable / transient: `408 Request Timeout`, `429 Too Many Requests` (often accompanied by a `Retry-After` header).
  - The 5xx (Server Error) class indicates the server failed to fulfill an apparently valid request; many 5xx codes (e.g., `503 Service Unavailable`, `504 Gateway Timeout`) represent transient conditions where client retry is appropriate.
  - Crucially, protocol-level status codes alone do not specify application-level data acceptance unless bound to a specific API contract (e.g., an endpoint could return `200 OK` with an application error payload, or `202 Accepted` for asynchronous background ingestion).
- **Project Requirement**:
  - Acceptance criterion `SYNC-04` requires positive destination acknowledgement before marking a queued survey `SYNCED`.
- **Open Issue**:
  - Because no submission endpoint or backend API contract is provided in the assignment, protocol-specific acknowledgement cannot be frozen and remains **OPEN** under `OQ-006` until architecture / Gate E.

---

### 8. Autosave Debounce Timing
- **Source URL**: 
  - https://web.dev/articles/ux-patterns
  - https://developer.mozilla.org/en-US/docs/Web/API/Document/DOMContentLoaded_event
- **Source Owner**: Web.dev / W3C
- **Source Class**: Industry engineering guidelines
- **Date Checked**: 2026-09-02
- **Related Requirement/Acceptance IDs**: `DATA-REQ-01`, `DATA-01`, `OQ-007`
- **Verified Facts**:
  - There is **no canonical universal standard or specification** prescribing an exact debounce interval (e.g. 500ms or 1500ms) for form persistence. Debounce timing is an implementation choice.
- **Project Requirement / Acceptance Decision**:
  - Owner decisions in `ACCEPTANCE_CRITERIA.md` establish that autosave occurs automatically after meaningful changes without a manual Save button; a short debounce is permitted, but its exact millisecond duration is **not** an acceptance criterion.
- **Recommendation**:
  - A short debounce in the 500ms–1500ms range is an engineering recommendation to balance immediate local data safety with avoiding excessive IndexedDB write transactions while typing.

---

### 9. Repository Cleanliness Deliverable Criteria
- **Source URL**: 
  - `docs/assignment/REQUIREMENTS.md` (`DELIVERABLE-REQ-03`)
  - https://git-scm.com/docs
- **Source Owner**: VKU Assignment / Git SCM
- **Source Class**: Assignment requirement / Official tool documentation
- **Date Checked**: 2026-09-02
- **Related Requirement/Acceptance IDs**: `DELIVERABLE-REQ-02`, `DELIVERABLE-REQ-03`, `OQ-009`
- **Verified Facts**:
  - `DELIVERABLE-REQ-03` requires: "Keep the public repository history and project structure clean."
  - The assignment does **not** mandate Conventional Commits, specific branch workflows, or external tools.
- **Recommendation**:
  - Repository cleanliness can be objectively satisfied by project quality criteria:
    - Atomic, focused commits with descriptive commit messages.
    - No build artifacts (`dist/`), temporary directories, or dependencies (`node_modules/`) tracked in version control (enforced via `.gitignore`).
    - Zero committed credentials, secrets, or environment keys.
    - No large, unintended binary files committed.
    - Standard project structure with setup instructions documented in `README.md` (`DELIVERABLE-REQ-04`).
    - (Optional) Conventional Commits syntax (`feat:`, `fix:`, `docs:`, `chore:`) may be adopted for consistency, but is not an assignment constraint.

---

### 10. Deployment Platform Capabilities
- **Source URL**: 
  - https://developers.cloudflare.com/pages/
  - https://vercel.com/docs
- **Source Owner**: Cloudflare / Vercel
- **Source Class**: Official product documentation
- **Date Checked**: 2026-09-02
- **Related Requirement/Acceptance IDs**: `DELIVERABLE-REQ-01`, `PWA-REQ-01`
- **Verified Facts**:
  - Both Cloudflare Pages and Vercel provide automated, valid HTTPS SSL/TLS certificates out of the box on their default domains and custom domains.
  - Both support static Vite build output (`dist/`) and Single-Page Application (SPA) client-side routing rewrites.
- **Recommendation**:
  - Either Cloudflare Pages or Vercel satisfies the HTTPS and static deployment requirements of `DELIVERABLE-REQ-01` and `PWA-REQ-01`. Final provider selection is deferred to Gate D.
