# ADR-003: Port-and-Adapter Isolation for Platform Capabilities (Camera and Network)

- **Status**: approved (Frozen at Human Gate D)
- **Date**: 2026-09-02
- **Decision Owner**: Software Architect (Gate D)
- **Related Requirement/Acceptance IDs**: `NATIVE-REQ-01`–`NATIVE-REQ-03`, `NATIVE-01`–`NATIVE-06`, `FORM-REQ-07`, `UI-04`

---

## 1. Context and Verified Sources

- The application must function across two distinct runtime targets:
  1. Standard web / installable PWA running in browser environments (`PWA-REQ-01`).
  2. Native Android application built with Capacitor (`NATIVE-REQ-01`).
- Hardware camera access (`FORM-REQ-07`, `NATIVE-REQ-02`) and network status monitoring (`NATIVE-REQ-03`) are required.
- If UI or business logic imports Capacitor plugins directly (e.g., `@capacitor/camera`, `@capacitor/network`), web/PWA builds will encounter missing native bridge errors or require fragile platform checks (`if (Capacitor.isNativePlatform())`) scattered throughout the component tree.
- Researched camera risks (`docs/research/TECH_RISKS.md`): Holding large Base64 strings in memory causes high memory consumption and Out-Of-Memory (OOM) crashes on mobile devices.

---

## 2. Options Considered

### Option A: Inline platform switching within UI components

- _Concept_: Direct calls inside React components using `Capacitor.isNativePlatform() ? Camera.getPhoto(...) : fileInput.click()`.
- _Cons_: High coupling, difficult to unit-test without mocking native bridges, duplicated error handling, fragile maintenance across views.

### Option B: Hexagonal Ports and Platform Adapters

- _Concept_: Define two clean domain ports:
  - `CameraPort`: defines `capturePhoto(): Promise<PhotoAttachment>`
  - `NetworkStatusPort`: defines `getStatus(): Promise<NetworkStatus>` and `onStatusChange(listener): Unsubscribe`
- Implement two concrete adapters for each port:
  - **Camera**: `CapacitorCameraAdapter` (using `@capacitor/camera` returning URI/webPath) and `WebCameraAdapter` (using HTML5 `<input type="file" accept="image/*" capture="environment">`).
  - **Network**: `CapacitorNetworkAdapter` (using `@capacitor/network`) and `WebNetworkAdapter` (using `navigator.onLine` and window `online`/`offline` event listeners).
- Inject the appropriate adapter at the application composition root (main entry point).
- _Pros_: Completely decouples UI and domain logic from Capacitor and browser APIs; simplifies unit and integration testing; ensures memory-efficient photo handling.

---

## 3. Decision

1. Adopt the **Ports and Adapters** pattern for Camera and Network capabilities.
2. The domain model `PhotoAttachment` represents photos as a project-owned abstraction containing an identifier, display URI, optional binary `Blob`, and capture timestamp.
3. Native implementations will use file URIs (`webPath`) rather than Base64 strings to safeguard mobile memory.
4. The React UI and domain use cases will depend exclusively on `CameraPort` and `NetworkStatusPort`.

---

## 4. Consequences and Risks

- **Consequences**:
  - The application builds cleanly for both Web PWA and Native Android without conditional platform code polluting components.
  - Mock adapters can be substituted trivially in automated test environments.
- **Risks & Mitigation**:
  - _Risk_: Android permission denial or user cancellation during camera capture.
  - _Mitigation_: The `CameraPort` contract defines explicit, non-throwing error results (e.g., user cancellation or permission denied) so the UI can display helpful guidance without crashing.

---

## 5. Approval Reference

- Approved and frozen by the human owner at Gate D.
