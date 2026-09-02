# VKU Field Survey Requirements

Status: **Draft for Human Gate A**

Provenance: Audited against the VKU assignment information supplied by the project owner. This file records assignment outcomes and explicitly mandated technical constraints; it does not select architecture, backend, endpoint, deployment provider, or an API contract.

## PWA

- `PWA-REQ-01`: The application must be an installable PWA.
- `PWA-REQ-02`: The application must provide a valid Web App Manifest.
- `PWA-REQ-03`: The manifest must use `display: standalone`.
- `PWA-REQ-04`: The PWA theme color must be `#0284C7`.
- `PWA-REQ-05`: The manifest must provide icons at 192×192 and 512×512.
- `PWA-REQ-06`: A Service Worker must cache the App Shell.
- `PWA-REQ-07`: The App Shell must support offline boot.

## Inspection Form

- `FORM-REQ-01`: Capture Building.
- `FORM-REQ-02`: Capture Floor.
- `FORM-REQ-03`: Capture Room number.
- `FORM-REQ-04`: Capture Category using one of: Hardware, Projector, AC, Electrical, or Furniture.
- `FORM-REQ-05`: Capture a 1–5 star condition rating.
- `FORM-REQ-06`: Capture defect notes.
- `FORM-REQ-07`: Capture a camera photo.

## Offline Persistence

- `DATA-REQ-01`: Persist form/draft data locally in real time.
- `DATA-REQ-02`: Use IndexedDB through either `idb` or `localForage`; the assignment permits both and does not select one.
- `DATA-REQ-03`: Prevent form/draft data loss when the browser page is refreshed.

The precise meaning and save timing of “real time” remains unresolved in `docs/research/OPEN_QUESTIONS.md`.

## Offline Queue and Synchronization

Each queued offline survey must contain:

- `SYNC-REQ-01`: A UUID.
- `SYNC-REQ-02`: A timestamp.
- `SYNC-REQ-03`: A `PENDING_SYNC` state.

Queue processing must satisfy:

- `SYNC-REQ-04`: Retry queued surveys when connectivity returns.
- `SYNC-REQ-05`: Dispatch queued surveys sequentially.
- `SYNC-REQ-06`: Support `window.ononline` as a connectivity-return trigger.
- `SYNC-REQ-07`: Support Background Sync as a synchronization trigger.

The submission destination, endpoint, API contract, and successful-sync acknowledgement are not specified by the assignment information currently recorded.

## Native Android

- `NATIVE-REQ-01`: Provide a Capacitor Android application.
- `NATIVE-REQ-02`: Integrate camera access using `@capacitor/camera`.
- `NATIVE-REQ-03`: Monitor network state using `@capacitor/network`.
- `NATIVE-REQ-04`: Produce an installable Android APK.

## Deliverables

- `DELIVERABLE-REQ-01`: Provide a live PWA demo URL deployed over HTTPS.
- `DELIVERABLE-REQ-02`: Provide a public GitHub repository.
- `DELIVERABLE-REQ-03`: Keep the public repository history and project structure clean.
- `DELIVERABLE-REQ-04`: Provide setup instructions in `README.md`.
- `DELIVERABLE-REQ-05`: Provide a short technical report PDF of 2–4 pages.
- `DELIVERABLE-REQ-06`: Use the supplied report structure recorded in `REPORT_TEMPLATE.md`.

## Explicitly Unresolved

- Backend choice, submission endpoint, API contract, authentication, and success acknowledgement
- Browser support strategy and minimum supported versions
- Android minimum version and device matrix
- Deployment provider
- Architecture and interface contracts
- Choice between `idb` and `localForage`

