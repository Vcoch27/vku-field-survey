# VKU Field Survey System Architecture

Status: **APPROVED — FROZEN AT HUMAN GATE D**

This document establishes the authoritative software architecture for the VKU Field Survey application. It specifies domain concepts, architectural boundaries, ports and adapters, and data ownership so that implementation agents can proceed without making uncoordinated structural decisions.

---

## 1. Goals and Non-Goals

### Goals

- Satisfy all VKU assignment requirements (`REQUIREMENTS.md`) and frozen acceptance criteria (`ACCEPTANCE_CRITERIA.md`).
- Provide reliable offline-first operation: real-time automatic draft persistence, offline survey submission, and durable queued synchronization.
- Decouple business logic from platform-specific APIs to enable seamless execution across both PWA (browser) and Native Android (Capacitor) runtimes.
- Isolate the unknown backend destination behind a generic port so that sync orchestration is robust against any future API contract.
- Keep the design minimal, understandable, and demonstrable for student presentation and technical reporting.

### Non-Goals

- Inventing a specific backend server, REST endpoint, GraphQL schema, or cloud vendor integration.
- Implementing complex multi-master synchronization or distributed conflict resolution (surveys are append-only submissions).
- Adding complex enterprise frameworks, heavy ORMs, or unnecessary multi-tier abstractions.

---

## 2. Architectural Constraints and Invariants

1. **No Direct IndexedDB Access from UI**: React components never interact directly with IndexedDB; all persistence flows through the domain Storage Port.
2. **No Direct Synchronization from UI**: UI triggers synchronization solely by invoking the centralized sync use case.
3. **Hardware Isolation via Adapters**: Camera and Network plugins are encapsulated behind domain ports. No `if (Capacitor.isNativePlatform())` branching inside UI components.
4. **Network State as Trigger Only**: An online status change is strictly an attempt trigger. It is never treated as proof of remote delivery.
5. **Single-Flight Sequential Sync**: All sync triggers converge on one orchestrator. Queue items are processed strictly sequentially (FIFO) with a concurrency lock.
6. **Data Retention Invariant**: Network errors or destination failures must never delete or corrupt pending survey data. Data is marked `SYNCED` only upon positive destination acknowledgement.

---

## 3. High-Level Architecture and Dependency Structure

The system uses a **Lightweight Ports and Adapters (Hexagonal)** architectural style adapted for a modern client-side application. The core domain and application use cases have zero dependencies on external frameworks, Capacitor plugins, or browser storage APIs.

**Implementation Constraint**: Agents must avoid full Clean Architecture ceremonial layering. Do not create unnecessary DTOs, mappers, wrappers, or duplicated models just to satisfy arbitrary tiering. Keep the implementation lightweight and pragmatic.

### Component Dependency Diagram (ASCII)

```text
+-----------------------------------------------------------------------+
|                              PRESENTATION                             |
|  [ React Views & Form UI ] <-----> [ Transient State (Local/Shared) ] |
+-----------------------------------+-----------------------------------+
                                    | invokes
                                    v
+-----------------------------------------------------------------------+
|                            APPLICATION LAYER                          |
|   [ AutosaveDraft ]   [ SubmitSurveyOffline ]   [ SyncOrchestrator ]  |
|                         [ RecoverDraft ]                              |
+-----------------------------------+-----------------------------------+
                                    | uses domain models & ports
                                    v
+-----------------------------------------------------------------------+
|                              DOMAIN LAYER                             |
|  - Models: InspectionDraft, SurveySubmission, PhotoAttachment         |
|  - Value Objects & Terminology: Category, SyncStatus, Rating          |
|  - Ports (Interfaces):                                                |
|      * SurveyStoragePort                                              |
|      * CameraPort                                                     |
|      * NetworkStatusPort                                              |
|      * SubmissionGateway                                              |
+-----------------------------------+-----------------------------------+
                                    ^
                                    | implements interfaces
+-----------------------------------+-----------------------------------+
|                         INFRASTRUCTURE ADAPTERS                       |
|                                                                       |
|  [ Storage Adapter ]  --> IndexedDB (via idb)                         |
|                                                                       |
|  [ Camera Adapters ]  --> WebCameraAdapter (HTML5 input)              |
|                       --> CapacitorCameraAdapter (@capacitor/camera)  |
|                                                                       |
|  [ Network Adapters ] --> WebNetworkAdapter (window online/offline)   |
|                       --> CapacitorNetworkAdapter (@capacitor/net)    |
|                                                                       |
|  [ Submission Gateway] -> SubmissionGatewayAdapter (Generic Port)     |
+-----------------------------------------------------------------------+
```

---

## 4. Domain Concepts and Models

The domain model defines conceptual entities, value objects, and lifecycle states:

### 4.1. InspectionDraft

Represents the working survey currently being filled out by the user in the field.

- **Draft ID**: Unique client identifier for the working draft session.
- **Zone**: Campus zone enum: `'K'` (khu Hàn) | `'V'` (khu Việt) (CR-001).
- **Building**: String (flexible text or selection; examples: A, B, C, D1, D2, E1, E2 per OQ-004a).
- **Room Number**: String representing room number (encodes floor, e.g. 205, 505; opaque string, no regex rule).
- **Derived Full Room Identifier**: Display identifier formatted as `${zone}.${building}-${roomNumber}` (e.g. `K.A-205`, `V.A-505`), derived dynamically in helpers rather than persisted redundantly.
- **Category**: Controlled vocabulary: `Hardware` | `Projector` | `AC` | `Electrical` | `Furniture` (`FORM-REQ-04`).
- **Condition Rating**: Integer 1 to 5 (`FORM-REQ-05`).
- **Defect Notes**: Text describing observed defects (`FORM-REQ-06`).
- **Photo**: Associated `PhotoAttachment` or null (`FORM-REQ-07`).
- **Last Modified Timestamp**: Client timestamp of most recent change.

#### 4.2. PhotoAttachment

Represents an image captured for an inspection.

- **Photo ID**: UUID identifier.
- **Display URI**: A transient, safe URI (`webPath` or blob URL) for immediate rendering in UI (Ephemeral).
- **Binary Data**: Storable `Blob` representing the image content.
- **Captured Timestamp**: Timestamp when the photo was acquired.

**Architecture Invariant**: A persisted draft or submission containing a photo must reference photo data that the `SurveyStoragePort` considers durable. The domain model does not dictate IndexedDB as the specific format, but infrastructure must own the durability representation.

### 4.3. SurveySubmission

Represents a finalized, submitted survey ready for or undergoing remote synchronization. Keep this minimal; avoid speculative metadata.

- **Submission ID**: Unique UUID (`SYNC-REQ-01`). Must remain stable across retries to enable future backend idempotency.
- **Timestamp**: Creation timestamp (`SYNC-REQ-02`).
- **Survey Data**: Complete snapshot of the inspection fields.
- **Photo**: Embedded or referenced `PhotoAttachment`.
- **Sync Status**: Strict approved lifecycle state (`SYNC-REQ-03`):
  - `PENDING_SYNC`: Queued and waiting for network/sync trigger (direct assignment requirement).
  - `SYNCING`: Currently in-flight, durably claimed by an execution context.
  - `SYNCED`: Positively acknowledged by destination (project terminology).
  - `SYNC_FAILED`: Transmission failed or unacknowledged; retained for retry (project terminology).
- **Last Error Message**: (Optional) Descriptive error information from the last attempt (if failed).

---

## 5. Application Layer (Use Cases)

The application layer contains the procedural workflows coordinating domain logic, persistence, and external ports:

1. **`AutosaveDraftUseCase`**:
   - Triggered automatically after meaningful form edits (debounced).
   - Validates draft identity, persists current field values and photo references into `SurveyStoragePort`.
2. **`RecoverDraftUseCase`**:
   - Invoked on application initialization / page reload.
   - Reads the latest persisted draft from `SurveyStoragePort` and rehydrates active UI state.
3. **`SubmitSurveyOfflineUseCase`**:
   - Validates the inspection draft against required fields.
   - Converts the draft into a immutable `SurveySubmission` record with a newly minted UUID, current timestamp, and `PENDING_SYNC` status.
   - Saves the submission to the persistent queue in `SurveyStoragePort`.
   - Clears the active draft session in storage.
   - Dispatches a background sync trigger request to `SyncOrchestrator`.
4. **`SyncOrchestrator`**:
   - Central coordination point for all synchronization triggers (detailed in Section 7).

---

## 6. Ports (Abstract Interfaces)

To maintain decoupling, all external I/O is governed by explicit ports:

### 6.1. `SurveyStoragePort`

Abstract persistence boundary:

- `saveDraft(draft: InspectionDraft): Promise<void>`
- `getDraft(draftId?: string): Promise<InspectionDraft | null>`
- `clearDraft(draftId: string): Promise<void>`
- `enqueueSubmission(submission: SurveySubmission): Promise<void>`
- `getPendingSubmissions(): Promise<SurveySubmission[]>`
- `atomicClaimNext(): Promise<ClaimedSubmission | null>` (Durable queue claiming returning claim metadata)
- `updateSubmissionStatus(id: string, status: SyncStatus, error?: string): Promise<void>`
- `markSubmissionSynced(id: string, acknowledgementDetails?: unknown): Promise<void>`

### 6.2. `CameraPort`

Abstract hardware camera boundary:

- `capturePhoto(): Promise<PhotoAttachment | null>`
- Returns null if the user cancels capture; raises explicit domain errors for permission denials.

### 6.3. `NetworkStatusPort`

Abstract connectivity monitoring boundary:

- `getNetworkStatus(): Promise<{ isConnected: boolean }>`
- `subscribe(listener: (status: { isConnected: boolean }) => void): () => void`

### 6.4. `SubmissionGateway`

Abstract remote dispatch boundary (preserves OQ-003 / OQ-006):

- `sendSubmission(submission: SurveySubmission): Promise<SubmissionOutcome>`
- `SubmissionOutcome` is a minimal conceptual discriminated union separated from `SyncStatus`:
  - `{ outcome: 'ACKNOWLEDGED', acknowledgementToken?: string }`
  - `{ outcome: 'RETRYABLE_FAILURE', reason: string }`
  - `{ outcome: 'REQUIRES_ATTENTION', reason: string }`
- Note: This port does **not** assume REST, GraphQL, or any specific HTTP endpoint. The concrete gateway adapter handles network transport mapping (e.g. mapping HTTP codes to `SubmissionOutcome`).

---

## 7. Synchronization Orchestration Architecture

To fulfill `SYNC-REQ-04`, `SYNC-REQ-05`, and frozen acceptance criteria `SYNC-01` through `SYNC-10`, the synchronization mechanism utilizes a single logical workflow using cross-context durable queue claiming:

```text
[ Trigger: Background Sync ] ----+
[ Trigger: window online   ] ----+---> [ SyncOrchestrator ]
[ Trigger: App Startup     ] ----+            |
[ Trigger: Manual Retry    ] ----+            |
                                              v
                                   [ StoragePort.atomicClaimNext() ]
                                              |
     +----------------------------------------+----------------------------------------+
     | No eligible items                      | Atomically transition to SYNCING
     v                                        | + Attach durable claim metadata
[ Idle / Exit ]                               v
                                   [ Call SubmissionGateway ]
                                              |
     +----------------------------------------+----------------------------------------+
     | ACKNOWLEDGED                           | failure/unacknowledged
     v                                        v
[ Mark record SYNCED ]            [ Data Preserved ]
[ Next Item ]                     [ Transition to SYNC_FAILED (or retry eligibility) ]
                                  [ Apply future fairness/retry policy ]
```

### 7.1. Local Concurrency Safety and At-Least-Once Delivery

- **Durable Claiming**: Since the Service Worker and main app context can both fire triggers, they use `StoragePort.atomicClaimNext()`. The claim securely transitions the item to `SYNCING` and associates operational claim metadata (e.g. `claimToken`, `claimedAt`). This prevents concurrent local dispatch.
- **At-Least-Once Semantics**: The atomic claim cannot guarantee exactly-once remote delivery. If a request reaches the backend but the worker dies before processing the acknowledgement, the claim will eventually expire and retry.
- **Stale Claim Recovery**: A future sync attempt must be able to reclaim an abandoned `SYNCING` record based on a lease/staleness policy using the claim metadata (`claimedAt`). The exact timeout is an implementation detail.

### 7.2. FIFO and Starvation Avoidance

- Pending records are processed conceptually with a default FIFO preference (ascending `timestamp`). (FIFO is an architecture decision).
- **Starvation Avoidance**: While records are processed sequentially, a single repeatedly failing head record must not doom later records to permanent starvation. The architecture permits a fairness/retry policy to advance the queue, though the exact backoff algorithm remains open.

### 7.3. Separation of Concepts

- **SyncStatus** (`PENDING_SYNC`, `SYNCING`, `SYNCED`, `SYNC_FAILED`) is completely decoupled from **SubmissionOutcome** (`ACKNOWLEDGED`, `RETRYABLE_FAILURE`, `REQUIRES_ATTENTION`) and decoupled from **Claim metadata**.
- A `SubmissionOutcome.RETRYABLE_FAILURE` or `REQUIRES_ATTENTION` maps to a failed network transaction, prompting a status change to `SYNC_FAILED` (or maintaining retry eligibility) while keeping the survey data fully preserved.

---

## 8. PWA and Native Platform Boundaries

### 8.1. PWA Responsibility

- **Manifest (`manifest.json`)**: Configured with `display: standalone`, theme color `#0284C7`, and icons at 192×192 and 512×512 (`PWA-REQ-02`–`05`).
- **Service Worker**:
  - Precaches static App Shell assets (HTML, CSS, compiled JS, icons) for offline boot (`PWA-REQ-06`, `PWA-REQ-07`).
  - Listens for `sync` events (Background Sync). When a sync event fires, it posts a message to active application clients or delegates to the sync use case.
- **Installability vs. Offline**: The Service Worker's primary mission in this project is App Shell availability, independent of browser-specific installation criteria.

### 8.2. Capacitor Responsibility

- Encapsulates the web application in a native Android WebView (Android 7+ / System WebView 60+).
- Native plugins (`@capacitor/camera`, `@capacitor/network`) are accessed strictly through `CapacitorCameraAdapter` and `CapacitorNetworkAdapter`.
- Android builds are generated using the standard Capacitor CLI workflow (`npx cap sync android`) and compiled to APK via Gradle/Android Studio.

---

## 9. State Management and Data Ownership

The application establishes a clear separation between transient UI state and persistent domain storage (ADR-004):

| State Category              | Storage Location                      | Lifetime                                | Examples                                                                                                      |
| :-------------------------- | :------------------------------------ | :-------------------------------------- | :------------------------------------------------------------------------------------------------------------ |
| **Transient UI State**      | In-memory store (Zustand)             | Current tab session                     | Focused input field, active form errors, modal dialog open states, live sync spinner indicator (`isSyncing`). |
| **Active Inspection Draft** | Persistent IndexedDB (`drafts` store) | Survives refresh & restart              | Field values (Building, Floor, Room, Category, Rating, Notes) and attached photo Blob.                        |
| **Submission Queue**        | Persistent IndexedDB (`queue` store)  | Survives refresh & restart until synced | UUID, creation timestamp, snapshot of survey fields, photo Blob, `SyncStatus`.                                |

---

## 10. Failure Model

| Failure Category             | Trigger Condition                      | System Behavior                                               | Data Preservation                                                 |
| :--------------------------- | :------------------------------------- | :------------------------------------------------------------ | :---------------------------------------------------------------- |
| **Validation Failure**       | Incomplete required fields on submit   | Submit prevented; errors highlighted in UI (`UI-08`).         | Active draft remains in-memory and persisted in IndexedDB.        |
| **Storage Quota Error**      | Device disk space critically exhausted | UI displays persistent storage warning.                       | Existing records protected; retry scheduled.                      |
| **Camera Permission Denied** | User refuses camera access             | UI displays friendly permission guidance without crash.       | Existing draft values preserved.                                  |
| **Network Disconnection**    | Submitting while offline               | Submission created with `PENDING_SYNC` in queue (`SYNC-01`).  | Full payload and photo preserved in IndexedDB queue.              |
| **Remote Dispatch Failure**  | Server down, timeout, captive portal   | Sync halts; item marked `SYNC_FAILED` (`SYNC-04`, `SYNC-10`). | Record completely preserved; retried on next connectivity return. |
| **Concurrent Trigger**       | Multiple sync events fire at once      | Single-flight lock ignores redundant trigger.                 | Zero duplicate requests.                                          |

---

## 11. Traceability to Acceptance Criteria

- **PWA Acceptance (`PWA-01` to `PWA-06`)**: Enabled by root manifest configuration, standalone display, and Service Worker App Shell precaching.
- **Offline Persistence (`DATA-01` to `DATA-06`)**: Enabled by `SurveyStoragePort` implementing automatic debounced persistence, refresh rehydration, and isolated draft storage in IndexedDB.
- **Synchronization (`SYNC-01` to `SYNC-10`)**: Enabled by `SyncOrchestrator` enforcing single-flight execution, FIFO sequential dispatch, positive acknowledgement verification, and failure retention.
- **Native Android (`NATIVE-01` to `NATIVE-07`)**: Enabled by `CapacitorCameraAdapter` and `CapacitorNetworkAdapter` isolating Capacitor APIs behind domain ports.
- **UI Acceptance (`UI-01` to `UI-10`)**: Enabled by clear state separation (Zustand transient state for immediate UI feedback and validation), keeping UI responsive under all network conditions.

---

## 12. Open Questions & Architectural Position

- **OQ-003 (Submission Destination/API)**: Decoupled via `SubmissionGateway`. No backend URL or transport protocol is hardcoded in the architecture.
- **OQ-004 (Field Vocabularies & Validation / CR-001)**: Location model clarified to `Zone` (`K` | `V`), `Building`, and `Room Number` (encoding floor). Floor is not independently entered. Full room identifier `${zone}.${building}-${roomNumber}` is derived dynamically. Building catalog remains flexible until OQ-004a is frozen.
- **OQ-005 (Target Environments & Deployment)**: Architectural recommendation proposes Chrome/Safari for PWA, Android 14/15 emulator for Capacitor, and Cloudflare Pages or Vercel for HTTPS hosting. Final freeze belongs to human gate approval.
- **OQ-006 (Positive Acknowledgement)**: Abstracted behind `SubmissionGateway.sendSubmission()`, returning typed outcomes (`ACKNOWLEDGED` vs `RETRYABLE_FAILURE`). Protocol status details remain isolated from the sync orchestrator.

---

## 13. Architecture Risks and Mitigations

1. **Risk: Memory Exhaustion from Captured Photos**
   - _Mitigation_: Native photos use file URIs (`webPath`) in memory; binary Blobs in IndexedDB are loaded only on demand during transmission (ADR-003).
2. **Risk: Background Sync Incompatibility on Safari/iOS**
   - _Mitigation_: Architectural multi-trigger design guarantees that `window.ononline`, document visibility changes, and app startup trigger the sync orchestrator even if Background Sync is unavailable (ADR-002).
3. **Risk: Duplicate Submissions on Network Restoral**
   - _Mitigation_: Single-flight mutex in `SyncOrchestrator` prevents concurrent queue processing; submissions carry persistent UUIDs for backend idempotency (`SYNC-REQ-01`).
