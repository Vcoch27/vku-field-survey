# VKU Field Survey Implementation Readiness Plan

Status: **PLAN ONLY — NO INITIALIZATION OR IMPLEMENTATION AUTHORIZED BY THIS DOCUMENT**

## 1. Readiness Basis

The human owner states that Gates A–D are frozen. This plan translates the frozen lightweight Ports & Adapters design into an implementation sequence without changing requirements, acceptance, research, or architecture.

Binding architecture inputs:

- React presentation with a small composition root.
- Framework-independent domain models, ports, and use cases.
- `SurveyStoragePort` implemented with `idb`.
- One logical sequential synchronization orchestrator with durable queue claiming.
- `CameraPort`, `NetworkStatusPort`, and `SubmissionGateway` boundaries.
- Zustand only for genuinely shared transient UI state; IndexedDB remains the durable source.
- No concrete remote submission adapter until `OQ-003` and the protocol-specific part of `OQ-006` are approved.

Repository metadata in architecture files still says `PROPOSED` or `CANDIDATE FOR HUMAN GATE D REVIEW`. The owner statement in the Gate E request is treated as the approval authority for this plan. Those stale labels should be normalized later through a separately authorized documentation task before agents rely on repository state alone.

## 2. Initialization Approach

The repository is non-empty because it contains the frozen contract. Do not run a root-level generator that may overwrite `docs/`, `.agents/`, `AGENTS.md`, or `README.md`.

When initialization is explicitly authorized:

1. Revalidate current stable versions and engine/toolchain compatibility using official documentation.
2. Generate a current Vite React TypeScript scaffold in a disposable directory.
3. Review the generated files and transfer only the minimal scaffold into the repository root through a normal reviewed change.
4. Add quality scripts and the first logic-test runner.
5. Add dependencies only at the milestone where they are first used.
6. Create the minimal source structure from `WORKSTREAMS.md`; do not pre-create ceremonial folders.
7. Add PWA tooling after the basic build is green.
8. Add Capacitor and Android only after the web build output and application ID are approved.

## 3. Planned Command Sequence

These commands are **not to be executed during Gate E**. Exact CLI flags must be checked against the revalidated current documentation.

### Version and environment preflight

```powershell
node --version
npm --version
npm view react version
npm view react-dom version
npm view vite version
npm view typescript version
npm view idb version
npm view zustand version
npm view vite-plugin-pwa version
npm view @capacitor/core version
npm view @capacitor/android version
npm view @capacitor/camera version
npm view @capacitor/network version
```

Registry output is only a version signal. Before selecting versions, compare it with the official Vite, React, Tailwind (only if proposed later), PWA-tooling, Capacitor, Android, and JDK compatibility documentation.

### Disposable scaffold

```powershell
$vkuScaffoldPath = Join-Path ([System.IO.Path]::GetTempPath()) ("vku-vite-" + [guid]::NewGuid())
npm create vite@latest $vkuScaffoldPath -- --template react-ts
```

Do not bulk-copy or overwrite the repository. Review and integrate only the generated `package.json`, TypeScript/Vite/lint configuration, `index.html`, and minimal entry files. Keep the disposable scaffold outside the repository and remove it only after its resolved absolute path has been verified.

### Planned dependency additions by milestone

```powershell
npm install
npm install idb
npm install zustand
npm install -D vitest
npm install -D vite-plugin-pwa
npm install @capacitor/core @capacitor/android @capacitor/camera @capacitor/network
npm install -D @capacitor/cli
```

Optional UI-test packages are deferred until M4 demonstrates a need:

```powershell
npm install -D @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
```

### Planned Capacitor initialization

```powershell
npx cap init "VKU Field Survey" "<human-approved-app-id>" --web-dir dist
npx cap add android
npx cap sync android
```

The app ID is a Human Gate E decision. Do not substitute a guessed reverse-domain identifier.

## 4. Minimum Quality Commands

The scaffold must expose stable package scripts so every workstream can run:

```powershell
npm run typecheck
npm run lint
npm run test -- --run
npm run build
```

Later phase-specific checks:

```powershell
npm run preview -- --host 0.0.0.0
npx cap sync android
Set-Location android
.\gradlew.bat assembleDebug
```

Browser, PWA, camera, network, deployment, and Android checks remain manual/evidence-backed acceptance procedures in addition to these commands.

## 5. Unresolved Inputs and Safe Containment

### OQ-003 / protocol acknowledgement

- Define only the frozen `SubmissionGateway` port and domain outcomes initially.
- Unit/integration tests may use test-local doubles that never ship in the runtime bundle only after explicit human approval.
- Do not create a runtime dummy endpoint, mock server, fake success adapter, or remote SDK without explicit human approval.
- The concrete remote adapter and final end-to-end `SYNCED` evidence remain deferred.

### OQ-004 / Building, Floor, Room

- Keep domain values as strings as frozen by architecture.
- Keep validation and UI control choice outside the domain until vocabularies are supplied.
- Do not invent VKU campus values.
- The UI milestone may implement the known Category/rating controls and the form boundary, but Building/Floor/Room control mode requires human/domain input before final acceptance.

## 6. Version Revalidation Gate

Before the first installation command, record:

- Current supported Node/npm range for the selected Vite template.
- Current stable React, TypeScript, Vite, and React plugin compatibility.
- Current `vite-plugin-pwa` compatibility with the selected Vite major and custom Service Worker strategy.
- Current `idb` and Zustand stable versions and TypeScript support.
- One consistent current Capacitor major across core, CLI, Android, Camera, and Network packages.
- That Capacitor major's required Android Studio, JDK, Gradle, compile SDK, target SDK, and minimum SDK.

Do not reuse the historical Capacitor 6/7 table as an installation pin. Record the revalidation result in a human-approved task before editing package files.

## 7. Gate E Exit Conditions

Initialization can begin only after the human owner approves:

- This dependency and directory plan.
- Current-version revalidation results.
- Android application ID.
- Whether test-local `SubmissionGateway` doubles are approved for sync orchestration tests.
- Initial verification targets sufficient for scaffold smoke checks.
- A single writing owner for `setup/scaffold`.

OQ-003 and OQ-004 do not block M1–M3 because their uncertainty is isolated behind frozen interfaces. They do block a real remote adapter and final form validation respectively.
