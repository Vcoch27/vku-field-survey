# Source Structure and Workstream Ownership

Status: **PROPOSED FOR GATE E — DIRECTORIES DO NOT EXIST YET**

## 1. Minimal Source Tree

```text
src/
├── main.tsx                         # browser composition entry
├── app/
│   ├── App.tsx                     # top-level presentation shell
│   └── createRuntime.ts            # selects and injects approved adapters
├── domain/
│   ├── models.ts                   # InspectionDraft, Submission, Photo, statuses
│   ├── ports.ts                    # storage, camera, network, submission contracts
│   ├── autosaveDraft.ts            # autosave use case
│   ├── recoverDraft.ts             # recovery use case
│   ├── submitSurvey.ts             # offline enqueue use case
│   └── synchronize.ts              # framework-free sync orchestration
├── data/
│   ├── idbSchema.ts                # database/store/index declarations
│   └── IdbSurveyStorage.ts         # SurveyStoragePort implementation
├── platform/
│   ├── camera/
│   │   ├── WebCamera.ts
│   │   └── CapacitorCamera.ts
│   ├── network/
│   │   ├── WebNetwork.ts
│   │   └── CapacitorNetwork.ts
│   ├── pwa/
│   │   ├── registerPwa.ts
│   │   └── service-worker.ts
├── features/
│   ├── inspection/
│   │   ├── InspectionForm.tsx
│   │   └── inspectionState.ts
│   └── status/
│       └── SyncStatusView.tsx
└── styles/
    └── app.css
```

Do not create `src/platform/submission/`, a placeholder source file, or a runtime fake until OQ-003 is resolved and a concrete adapter is approved. Until then, the port lives in `domain/ports.ts`; test-local doubles also require explicit human approval.

Tests should be colocated as `*.test.ts` or `*.test.tsx` beside the behavior they verify. Do not create `dto/`, `mappers/`, `factories/`, `repositories/`, `services/`, or a generic `shared/` directory until a concrete repeated responsibility justifies one.

## 2. Folder Responsibilities

| Path | Responsibility | Must not own |
|---|---|---|
| `src/app/` | Application shell and composition of approved ports/adapters | Domain rules, IndexedDB operations, native plugin internals |
| `src/domain/` | Project-owned models, ports, and framework-free use cases | React, IndexedDB, Capacitor, browser DOM |
| `src/data/` | `idb` schema, transactions, durable drafts and queue | UI rendering, native plugins, remote contract assumptions |
| `src/platform/camera/` | Web and Capacitor implementations of `CameraPort` | Form state or persistence orchestration |
| `src/platform/network/` | Web and Capacitor connectivity signals | Declaring remote submission successful |
| `src/platform/pwa/` | PWA registration, custom Service Worker entry, App Shell and Background Sync bridge | Survey UI and backend protocol decisions |
| `src/features/` | React inspection workflow and user-visible states | Direct IndexedDB/Capacitor access or a second sync engine |
| `src/styles/` | Approved responsive/accessibility styling | Business/domain behavior |

## 3. Agent Ownership

| Workstream | Primary owner | Exclusive write scope | Notes |
|---|---|---|---|
| Scaffold | Integration maintainer | Root package/config files, initial `src/main.tsx`, `.gitignore`, README setup section | Completes and merges before other implementation worktrees start |
| Domain and offline | Codex | `src/domain/**`, `src/data/**`, their colocated tests | Owns frozen ports, use cases, IndexedDB adapter, queue, sync orchestration |
| UI | Antigravity | `src/app/App.tsx`, `src/features/**`, `src/styles/**`, UI tests | Consumes ports/use cases; never imports `idb` or Capacitor plugins |
| Platform integration | One designated integration agent | `src/app/createRuntime.ts`, `src/main.tsx`, `src/platform/**`, PWA/root build config, `capacitor.config.*`, `android/**`, `public/**` | Runs serially when root/config files are involved; owns Camera/Network/PWA wiring |
| Independent review | Separate Codex context | Read-only | Reports findings; does not fix in the same review pass |
| Browser/device QA | Antigravity QA context | `docs/evidence/**` only | Product/config remains read-only |

No file has two simultaneous writing owners. A change to a frozen port requested by UI/platform work is handed back to the Domain and offline owner as a separate reviewed task.

## 4. Branch and Worktree Plan

Keep the initial topology small:

```text
main
├── setup/scaffold
├── agent/domain-offline
├── agent/ui
├── agent/platform
└── review/<task-id>
```

Rules:

1. `setup/scaffold` completes M1 and merges through human review before feature worktrees are created.
2. `agent/domain-offline` freezes TypeScript interfaces in M2 before UI/platform consumers branch.
3. `agent/ui` and `agent/platform` use disjoint write scopes and may run concurrently only after their input contracts are merged.
4. Root configuration changes are serialized through the Platform integration owner.
5. Each milestone creates `docs/handoffs/TASK-<ID>.md`; merge only after verification and independent review.
6. No direct commits or merges to `main` by implementation agents.

## 5. Integration Boundaries

- `createRuntime.ts` is the only normal composition point choosing Web versus Capacitor adapters.
- Service Worker execution has a separate runtime composition using only Service Worker-safe adapters; it must not import React or DOM-dependent modules.
- `SubmissionGateway` has no production implementation until a human-approved contract exists.
- If explicitly approved by the human owner, test doubles remain inside test files/fixtures and never silently become the deployed gateway.
- Building/Floor/Room stay string values in the domain. UI control type and options remain externally configurable until OQ-004 is resolved, without inventing campus data.
