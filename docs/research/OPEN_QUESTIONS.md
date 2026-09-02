# Open Questions

Questions here are genuinely unresolved by the supplied assignment context or owner decisions. They must not be answered through guessing.

---

## OQ-003 — Submission Destination and API Contract

- **Question**: What approved destination, endpoint URL, and API contract will receive queued surveys?
- **Why It Matters**: HTTP method, URL, payload structure, authentication, idempotency headers, error schemas, and transport details cannot be frozen without it.
- **Current Fact**: The supplied VKU assignment does not define a backend service, endpoint URL, schema, or transport protocol.
- **Constraint**: Do not invent a fake endpoint or choose a backend provider without human approval.
- **Architectural Recommendation**: The architecture must safely abstract the backend transport behind a decoupled port/interface (e.g., `SyncDestinationAdapter`) that accepts a survey draft and returns a typed outcome (`acknowledged` | `retryable_error` | `terminal_error`). The UI and offline sync queue must interact only with this interface, remaining agnostic of HTTP specifics.
- **Status**: **OPEN** (Requires human/domain input).

---

## OQ-004 — Field Vocabularies and Form Validation Rules (CR-001 Clarified)

- **Resolved Facts (Direct from Assignment & CR-001 Human Owner Clarification)**:
  - **Category**: Explicitly controlled enum: `Hardware`, `Projector`, `AC`, `Electrical`, `Furniture` (`FORM-REQ-04`).
  - **Condition Rating**: Explicitly controlled integer: 1–5 stars (`FORM-REQ-05`).
  - **Campus Zone (CR-001)**: Controlled enum: `K` (khu Hàn) | `V` (khu Việt).
  - **Floor (CR-001)**: Not entered as an independent user-facing field. Floor is encoded directly inside the room number (e.g. 301, 211, 105). No mandatory domain floor extraction or regex validation rule is enforced.
  - **Room Identifier (CR-001)**: Composed format: `${zone}.${building}-${roomNumber}` (e.g., `K.A-205`, `K.D1-201`, `V.A-505`). Derived dynamically in UI/domain helper for display; not stored as redundant persisted state.
- **Unresolved / Narrowed Questions**:
  - `OQ-004a` (Building Catalog): Is the building list open/extensible text or a closed controlled vocabulary? Known examples (`A`, `B`, `C`, `D1`, `D2`, `E1`, `E2`) are illustrative and not confirmed as exhaustive.
  - Are defect notes mandatory or optional, and is there a character limit?
  - Is the camera photo mandatory before submission, or optional?
- **Why It Matters**: Fixes the location domain and UI model while leaving building selection flexible until an exhaustive campus catalog is verified.
- **Status**: **PARTIALLY RESOLVED VIA CR-001; OQ-004a REMAINS OPEN FOR EXHAUSTIVE BUILDING LIST**.

---

## OQ-005 — Target Environments and Deployment Verification Matrix

- **Question**: Which specific browser versions, Android API levels, and HTTPS deployment provider should be frozen as the official project verification targets?
- **Why It Matters**: PWA installability behaviors, Background Sync availability, Camera permissions, native APK building, and deployment verification depend on specific environment versions.
- **Current Facts**:
  - `PWA-REQ-01` and `DELIVERABLE-REQ-01` mandate an installable PWA deployed over HTTPS.
  - `NATIVE-REQ-01` and `NATIVE-REQ-04` mandate a Capacitor Android app and installable APK.
  - The assignment does not mandate specific minimum browser or Android versions.
  - Both Cloudflare Pages and Vercel natively provide valid HTTPS and static Vite hosting.
- **Recommendation (Proposed Verification Matrix)**:
  - **PWA Target 1 (Primary)**: Google Chrome (Current Stable, Desktop & Android) — verifies manifest installability, App Shell caching, and Chromium Background Sync.
  - **PWA Target 2 (Cross-Platform Fallback)**: Safari (iOS 17+ / macOS) — verifies WebKit Add to Home Screen, App Shell offline boot, and sync fallback when Background Sync is unavailable.
  - **Native Android**: Android 14 (API 34) or Android 15 (API 35) emulator/device matching Capacitor 6 or 7 baseline toolchain.
  - **Deployment**: Either Cloudflare Pages or Vercel.
- **Status**: **OPEN FOR ARCHITECTURE** (To be formally selected at Gate D).

---

## OQ-006 — Protocol-Specific Positive Acknowledgement

- **Resolved Acceptance Invariant**:
  - In `docs/assignment/ACCEPTANCE_CRITERIA.md` (`SYNC-04`) and owner decisions: a submission becomes `SYNCED` only after the submission destination positively acknowledges successful receipt. A failed, timed-out, or unacknowledged attempt must never be represented as `SYNCED` and must remain in `PENDING_SYNC` or transition to `SYNC_FAILED` with all data retained.
  - Approved terminology: `PENDING_SYNC`, `SYNCING`, `SYNCED`, `SYNC_FAILED`.
- **Remaining Technical Question**: What specific HTTP status code, response body payload, or transport signal constitutes positive acknowledgement?
- **Facts Verified from RFC 9110**:
  - HTTP 2xx status codes indicate protocol-level receipt, but do not dictate domain acceptance without an API schema.
  - 4xx and 5xx codes have diverse semantics (e.g. 408 Request Timeout, 429 Too Many Requests, and 503 Service Unavailable are retryable; 400 Bad Request is typically non-retryable without modification).
  - Generic HTTP status codes cannot substitute for a defined API contract.
- **Constraint**: Do not hardcode assumed HTTP status codes into the core synchronization domain.
- **Recommendation**: In Gate D architecture, define positive acknowledgement as a domain contract method on the submission adapter (e.g., `adapter.isAcknowledged(response)`).
- **Status**: **OPEN FOR ARCHITECTURE / BACKEND INTEGRATION**.

---

## OQ-007 — Autosave Implementation Timing

- **Resolved Acceptance Decision**:
  - Meaningful form changes are saved automatically to IndexedDB without a manual Save button (`DATA-REQ-01`, `DATA-01`).
  - A short debounce is permitted; exact millisecond duration is **not** an acceptance criterion.
- **Fact**: No universal web standard specifies a mandatory debounce duration.
- **Recommendation**: For implementation, a debounce between 500ms and 1500ms provides a practical balance between responsive persistence and preventing excessive IndexedDB write transactions while typing.
- **Status**: **RESOLVED AT ACCEPTANCE LEVEL; IMPLEMENTATION CHOICE FOR ARCHITECTURE**.

---

## OQ-008 — Restart Persistence

- **Resolved Owner Decision**: Drafts and pending offline submissions survive browser close/reopen and native app restart when platform persistent storage remains available.
- **Classification**: Project Quality Proposal (`DATA-03`, `SYNC-07`, `NATIVE-07`).
- **Status**: **CLOSED AT ACCEPTANCE LEVEL**.

---

## OQ-009 — Public Repository Cleanliness Criteria

- **Assignment Fact**: `DELIVERABLE-REQ-03` requires: "Keep the public repository history and project structure clean." The assignment does not mandate Conventional Commits or specific git tooling.
- **Status**: **RESOLVED FOR ARCHITECTURE**.
- **Objective Engineering Recommendations**:
  - Commit hygiene: logical, atomic commits with clear messages.
  - Clean tracking: `.gitignore` rigorously excluding build outputs (`dist/`), dependencies (`node_modules/`), caches, and local IDE metadata.
  - Security hygiene: zero committed credentials, tokens, or environment secrets.
  - Asset hygiene: no accidental large binary files committed to Git history.
  - Structure: logical source hierarchy with complete setup instructions in `README.md` (`DELIVERABLE-REQ-04`).
  - (Optional): Conventional Commits formatting (`feat:`, `fix:`, `docs:`, `chore:`) recommended for consistency.
