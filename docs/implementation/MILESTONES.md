# First Implementation Milestones

Status: **PROPOSED FOR GATE E — NO MILESTONE STARTED**

## M0 — Version and Environment Revalidation

- **Goal**: Verify current stable tool versions and a compatible Node/Android/JDK matrix before any installation.
- **Acceptance IDs**: None directly; prerequisite for reliable verification of all criteria.
- **Owner**: Integration maintainer, with human approval of the recorded matrix.
- **Write scope**: Gate-authorized implementation planning/version record only; no package or source files until initialization approval.
- **Verification**: Official-source URLs, date checked, selected versions, compatibility reasoning, and human approval.
- **Depends on**: Gate E plan approval.

## M1 — Scaffold and Quality Baseline

- **Goal**: Integrate a reviewed minimal Vite React TypeScript scaffold without overwriting repository contracts; establish typecheck, lint, test, and production-build scripts.
- **Acceptance IDs**: No product criterion claimed; enables every later acceptance check.
- **Owner**: Integration maintainer on `setup/scaffold`.
- **Write scope**: Root package/config files, `.gitignore`, minimal `index.html`, `src/main.tsx`, initial `src/app/App.tsx`, and README setup instructions.
- **Verification**: `npm run typecheck`, `npm run lint`, `npm run test -- --run`, `npm run build`; confirm no generated demo assets/dead code and no contract files overwritten.
- **Depends on**: M0, approved package manager, approved initialization plan.

## M2 — Domain Models, Ports, and Use-Case Contracts

- **Goal**: Implement framework-free inspection/submission models, approved states, ports, and callable use-case boundaries.
- **Acceptance IDs**: Enables `DATA-01`–`DATA-06`, `SYNC-01`–`SYNC-10`, `NATIVE-03`–`NATIVE-07` without claiming behavior complete.
- **Owner**: Codex Domain and offline owner.
- **Write scope**: `src/domain/**` and colocated unit tests.
- **Verification**: Typecheck; unit tests for rating/category constraints, stable submission UUID/timestamp/status creation, state transitions, and port independence from React/browser/Capacitor imports.
- **Depends on**: M1 and frozen Gate D interfaces.

## M3 — IndexedDB Draft and Queue Persistence

- **Goal**: Implement `SurveyStoragePort` using `idb`, including autosave, recovery, isolated drafts, photo Blobs, queue records, and atomic durable claims.
- **Acceptance IDs**: `DATA-01`–`DATA-06`, storage portions of `SYNC-01`, `SYNC-05`, `SYNC-07`, `SYNC-10`, `NATIVE-07`.
- **Owner**: Codex Domain and offline owner.
- **Write scope**: `src/data/**`, necessary approved changes in `src/domain/**`, and colocated tests.
- **Verification**: Transaction/integration tests for autosave without manual Save, refresh/reopen recovery, multiple-draft isolation, Blob persistence, queue durability, atomic claim, failure retention, and stale-claim fixture behavior.
- **Depends on**: M2 and `idb` version approval.

## M4 — Inspection Form and Autosave Integration

- **Goal**: Build the mobile inspection form against domain/use-case contracts and show owner-approved local/offline/sync states without direct persistence access.
- **Acceptance IDs**: `DATA-01`–`DATA-06`, `UI-01`–`UI-10`, `FORM-REQ-01`–`FORM-REQ-07` trace.
- **Owner**: Antigravity UI owner.
- **Write scope**: `src/app/App.tsx`, `src/features/**`, `src/styles/**`, and UI tests.
- **Verification**: Component/browser tests for known Category/rating fields, autosave invocation, retained values on validation, long content, keyboard/overflow, state feedback, and no `idb`/Capacitor imports in UI paths.
- **Depends on**: M2; M3 integration contract. Final Building/Floor/Room control mode and complete validation wait for OQ-004.

## M5 — Offline Submission Queue

- **Goal**: Convert valid drafts into immutable queued submissions with stable UUID, timestamp, `PENDING_SYNC`, preserved photo, and sequential eligibility.
- **Acceptance IDs**: `SYNC-01`, `SYNC-02`, `SYNC-05`, `SYNC-07`, `SYNC-10`; `UI-07` state input.
- **Owner**: Codex Domain and offline owner.
- **Write scope**: `src/domain/**`, `src/data/**`, and colocated tests.
- **Verification**: Offline submit tests, multiple-item ordering, restart persistence, no draft/queue loss on failures, and stable UUID across retries.
- **Depends on**: M2, M3; approved validation input from OQ-004 for final submit eligibility.

## M6 — Synchronization Orchestration

- **Goal**: Implement one sequential, durable-claim synchronization workflow with acknowledgement-only success and retained failures.
- **Acceptance IDs**: `SYNC-02`–`SYNC-10`, logic portion of `NATIVE-06`, state input for `UI-07`.
- **Owner**: Codex Domain and offline owner.
- **Write scope**: `src/domain/synchronize.ts`, storage claim/status operations, and colocated tests.
- **Verification**: After explicit human approval, test-local `SubmissionGateway` doubles cover acknowledged, retryable, unacknowledged, concurrent-trigger, stale-claim, starvation/fairness, and false-positive-online scenarios. No runtime fake gateway is created. Without that approval, M6 verification remains limited to gateway-independent orchestration behavior.
- **Depends on**: M3, M5. Concrete remote transport remains deferred by OQ-003/OQ-006.

## M7 — PWA Manifest, App Shell, and Web Triggers

- **Goal**: Configure the manifest, icons, custom Service Worker App Shell cache, offline boot/reload, Background Sync feature detection, and `window.ononline` trigger bridge.
- **Acceptance IDs**: `PWA-01`–`PWA-06`, `SYNC-03`, `SYNC-08`, `SYNC-09`.
- **Owner**: Platform integration owner on `agent/platform`.
- **Write scope**: PWA/root build configuration, `src/platform/pwa/**`, required `public/**` manifest/icon assets, and integration tests.
- **Verification**: Typecheck/lint/test/build; built-manifest inspection; Service Worker/cache inspection; online-first then offline launch/reload; trigger traces on the approved browser matrix.
- **Depends on**: M1, M2, M6, approved PWA-tooling version, and M0 verification targets.

## M8 — Capacitor Android Camera and Network

- **Goal**: Add the approved Capacitor major, Android project, Camera/Network adapters, and composition wiring without leaking native APIs into UI/domain.
- **Acceptance IDs**: `NATIVE-01`–`NATIVE-07`, `DATA-05`, `SYNC-03`, `UI-04`.
- **Owner**: Platform integration owner on `agent/platform`.
- **Write scope**: `src/platform/camera/**`, `src/platform/network/**`, `src/app/createRuntime.ts`, Capacitor/root configuration, `android/**`, and platform integration tests.
- **Verification**: Web production build, `npx cap sync android`, Gradle debug APK build, install/launch, camera permission/capture/return, offline/reconnect trace, and restart persistence on approved targets.
- **Depends on**: M0, M1, M2, M3, M6, approved app ID and Android/JDK/toolchain matrix.

## M9 — Destination Integration, Deployment, QA, and Evidence

- **Goal**: Integrate only a human-approved submission destination, deploy the HTTPS PWA, execute the complete acceptance matrix, and register report-ready evidence.
- **Acceptance IDs**: All approved IDs, with focus on `SYNC-04`, PWA install/offline criteria, native criteria, and deliverable requirements.
- **Owner**: Designated integration owner; Antigravity QA captures evidence; independent Codex review is read-only.
- **Write scope**: Approved submission adapter, composition/configuration, deployment config, README, handoffs, and `docs/evidence/**` by assigned owners only.
- **Verification**: Full typecheck/lint/test/build; real acknowledgement/failure/retry scenarios; HTTPS deployment; browser/PWA matrix; Android build/device scenarios; evidence registry and report links.
- **Depends on**: M1–M8, resolution of OQ-003/OQ-006, deployment-provider approval, and complete OQ-004 validation input.

## Merge Gate for Every Milestone

Before human merge:

1. Acceptance and requirement IDs are listed in the task/handoff.
2. Write scope is respected and unrelated files are unchanged.
3. Typecheck, lint, relevant tests, and production build pass.
4. Required manual browser/device scenarios are recorded when applicable.
5. Evidence, assumptions, commands, results, and known risks are documented.
6. An independent reviewer reports no blocker.
