# Data Flow Specifications

Status: **APPROVED — FROZEN AT HUMAN GATE D**

This document specifies the exact lifecycle flows for field data across active editing, persistence, recovery, photo capture, offline submission, and restart recovery.

---

## 1. User Edits Form and Autosave Flow

Addresses: `DATA-REQ-01`, `DATA-01`, `OQ-007`.

### Flow Description

1. The user inputs text or selects an option in the UI (e.g., updates Room Number or Category).
2. The UI component immediately dispatches the change to transient local or shared UI state to update the visual interface without lag.
3. The UI component triggers a debounced autosave timer (e.g., 800ms).
4. If further edits occur before the timer expires, the debounce timer resets.
5. When the timer expires, the `AutosaveDraftUseCase` is invoked with the current draft snapshot.
6. The use case calls `SurveyStoragePort.saveDraft(draft)`. Note: A draft is not considered durably saved unless its associated photo (if captured) has a durable representation (e.g., binary Blob) committed to IndexedDB, not just an ephemeral object URL.
7. The IndexedDB storage adapter commits the draft into the `drafts` object store.
8. The UI receives a confirmation signal that local persistence succeeded and displays subtle "Saved locally" feedback (`UI-06`).

```text
[ User Input ]
      |
      v
[ Update Transient Store (Instant UI Render) ]
      |
      v
[ Debounce Timer (e.g., 800ms) ]
      | (timer fires)
      v
[ AutosaveDraftUseCase ]
      |
      v
[ SurveyStoragePort.saveDraft() ]
      |
      v
[ IndexedDB 'drafts' Store ] ---> [ UI: "Saved Locally" Indicator ]
```

---

## 2. Page Refresh and Rehydration Flow

Addresses: `DATA-REQ-03`, `DATA-02`, `DATA-04`.

### Flow Description

1. The user refreshes the browser page (or the browser restarts).
2. The application boots and initializes root React components.
3. The root component triggers `RecoverDraftUseCase.execute()`.
4. The use case queries `SurveyStoragePort.getDraft()`.
5. The IndexedDB adapter reads the saved record from the `drafts` store.
6. If a draft exists, the use case returns the data to the transient UI store.
7. The transient store rehydrates form field inputs and restores the photo preview.
8. The user can immediately resume editing without loss of previously entered values.

```text
[ Browser Refresh / App Boot ]
      |
      v
[ RecoverDraftUseCase ]
      |
      v
[ SurveyStoragePort.getDraft() ]
      |
      v
[ IndexedDB 'drafts' Store ]
      | (returns saved draft)
      v
[ Rehydrate Transient UI Store ]
      |
      v
[ Form Fields & Photo Preview Restored ]
```

---

## 3. Photo Capture Flow (PWA vs. Native Android)

Addresses: `FORM-REQ-07`, `NATIVE-REQ-02`, `DATA-05`, `NATIVE-03`, `NATIVE-04`, `UI-04`.

### Flow Description

1. The user taps the "Capture Photo" action in the survey form.
2. The UI invokes `CameraPort.capturePhoto()` through dependency injection.
3. **PWA Runtime Execution**:
   - `WebCameraAdapter` opens the HTML5 camera input (`<input type="file" accept="image/*" capture="environment">`).
   - The user takes a photo or selects an image file.
   - The file is converted to a local Blob URL for immediate preview and a binary `Blob`.
4. **Capacitor Android Runtime Execution**:
   - `CapacitorCameraAdapter` invokes `@capacitor/camera` native plugin.
   - The native camera UI opens. Upon capture, Capacitor returns a file URI (`webPath`).
   - The adapter reads the file URI as a binary `Blob` and produces a `PhotoAttachment` domain model.
5. The resulting `PhotoAttachment` is attached to the active `InspectionDraft`.
6. The autosave flow is triggered, persisting the photo into IndexedDB (`drafts` store) alongside the form fields.

```text
[ User taps "Capture Photo" ]
              |
              v
     [ CameraPort ]
     /            \
    v              v
[ Web Adapter ]  [ Capacitor Adapter ]
(HTML5 Camera)   (@capacitor/camera via URI)
    \              /
     v            v
  [ PhotoAttachment Domain Model ]
  (Photo ID, Display URI, Binary Blob)
              |
              v
  [ Attach to InspectionDraft ]
              |
              v
  [ Persist to IndexedDB via SurveyStoragePort ]
```

---

## 4. Offline Submission and Queue Creation Flow

Addresses: `SYNC-REQ-01`–`SYNC-REQ-03`, `SYNC-01`, `UI-01`, `UI-08`.

### Flow Description

1. The user taps the "Submit Survey" button.
2. The form checks required field validations (Zone, Building, Room, Category, Rating, Notes, Photo).
   - If invalid, submission is halted and errors are displayed (`UI-08`).
3. If valid, `SubmitSurveyOfflineUseCase` is called with the current draft.
4. The use case creates a new `SurveySubmission` entity:
   - Generates a cryptographically secure client UUID (`SYNC-REQ-01`).
   - Captures the current timestamp in ISO 8601 format (`SYNC-REQ-02`).
   - Sets the lifecycle status to `PENDING_SYNC` (`SYNC-REQ-03`).
   - Packages all form fields and the photo binary Blob.
5. The use case calls `SurveyStoragePort.enqueueSubmission(submission)`.
6. The storage adapter saves the submission into the `submission_queue` IndexedDB store.
7. The active draft is deleted from the `drafts` store via `SurveyStoragePort.clearDraft()`.
8. The form fields in the UI store are reset for the next inspection.
9. A background notification is sent to `SyncOrchestrator` to attempt synchronization if connectivity is currently available.

```text
[ User clicks "Submit Survey" ]
              |
              v
   [ Validate Form Fields ]
              | (valid)
              v
[ SubmitSurveyOfflineUseCase ]
              |
  +-----------+-----------+
  | Generates:            |
  | - UUID (SYNC-REQ-01)  |
  | - Timestamp (REQ-02)  |
  | - PENDING_SYNC status |
  +-----------+-----------+
              |
              v
[ SurveyStoragePort.enqueueSubmission() ]
              |
              v
[ IndexedDB 'submission_queue' Store ]
              |
              v
[ Clear Active Draft in Storage & UI ]
              |
              v
[ Notify SyncOrchestrator to Attempt Sync ]
```

---

## 5. Application Restart Recovery Flow

Addresses: `DATA-03`, `SYNC-07`, `NATIVE-07`.

### Flow Description

1. The browser is completely closed or the native Android app process is terminated.
2. The user restarts the device/app.
3. On application boot:
   - `RecoverDraftUseCase` checks the `drafts` store; if an unsubmitted draft was in progress, it rehydrates the form.
   - `SyncOrchestrator.onStartup()` is invoked.
   - The orchestrator queries `SurveyStoragePort.getPendingSubmissions()`.
   - If queued items with status `PENDING_SYNC` or `SYNC_FAILED` exist in the `submission_queue` store, the sync queue count in the UI is rehydrated.
   - If the network adapter reports an active connection, the orchestrator triggers sequential queue processing.

```text
[ App Process Restart ]
      |
      +--------------------------------+
      |                                |
      v                                v
[ RecoverDraftUseCase ]      [ SyncOrchestrator.onStartup() ]
      |                                |
      v                                v
[ Rehydrate Active Form ]    [ Query Pending Queue from IndexedDB ]
                                       |
                             [ Rehydrate Queue Counter in UI ]
                                       |
                             [ Trigger Sync if Online ]
```
