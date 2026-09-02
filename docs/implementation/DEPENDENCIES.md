# Dependency Plan

Status: **PROPOSED FOR GATE E — INSTALL NOTHING YET**

No version is pinned from memory. Every selected package uses a version verified immediately before installation, committed through the lockfile, and checked for peer/toolchain compatibility.

| Dependency/tool | Decision | Why | Frozen support | Revalidate before installation |
|---|---|---|---|---|
| `react`, `react-dom` | REQUIRED | Frozen presentation layer uses React views | ARCHITECTURE §3; UI acceptance | Current stable versions and Vite template compatibility |
| `typescript` | REQUIRED dev | Type-safe domain ports, adapters, and UI | Frontend quality rule; architecture interfaces | Current stable version supported by Vite/plugins |
| `vite`, `@vitejs/plugin-react` | REQUIRED dev | Minimal React TypeScript build/dev scaffold | PWA/HTTPS deliverables and frozen React architecture | Current stable major, Node engine, React plugin compatibility |
| ESLint packages emitted by the verified Vite template | REQUIRED dev | Required lint merge gate | `AGENTS.md` verification | Current template output and TypeScript lint compatibility |
| `vitest` | REQUIRED dev | Fast unit/integration tests for framework-free domain, storage, and sync logic | M2, M3, M5, M6 verification | Current Vite compatibility and environment configuration |
| `idb` | REQUIRED | Frozen ADR selects an IndexedDB adapter using `idb` | DATA-REQ-02; ADR-001 | Current stable version, maintenance, typings, browser support |
| `zustand` | RECOMMENDED | Frozen ADR permits it only for genuinely shared transient UI/network/sync state | ADR-004; UI-05–UI-07 | Current React compatibility; install only when shared state appears |
| `vite-plugin-pwa` | RECOMMENDED dev | Reduces manifest/App Shell build plumbing and can support a custom Service Worker | PWA-REQ-02–PWA-REQ-07; SYNC-REQ-07 | Current Vite compatibility, maintenance, `injectManifest`/custom SW behavior |
| `@capacitor/core` | REQUIRED | Native runtime boundary | NATIVE-REQ-01 | Current stable major and platform compatibility |
| `@capacitor/cli` | REQUIRED dev | Capacitor initialization and sync commands | NATIVE-01, NATIVE-04 | Same major as all Capacitor packages; Node/JDK prerequisites |
| `@capacitor/android` | REQUIRED | Android project generation/build | NATIVE-REQ-01, NATIVE-REQ-04 | Same major as core/CLI; Android/JDK/Gradle requirements |
| `@capacitor/camera` | REQUIRED | Frozen native Camera adapter | NATIVE-REQ-02; ADR-003 | Same compatible Capacitor major; permission and URI-result docs |
| `@capacitor/network` | REQUIRED | Frozen native Network adapter | NATIVE-REQ-03; ADR-003 | Same compatible Capacitor major; current event API |
| React Testing Library packages | RECOMMENDED, DEFERRED | Useful for form interaction and visible-state tests | UI-01–UI-10 | Add only at M4 if tests require DOM interaction |
| Tailwind CSS | OPTIONAL, NOT SELECTED | Styling can begin with native CSS; no frozen requirement/ADR mandates Tailwind | None | Reconsider only with an approved UI rationale; then verify current Vite integration |
| `localForage` | NOT SELECTED | Requirement permits it, but frozen ADR selects `idb` | DATA-REQ-02; ADR-001 | None unless ADR-001 is superseded |
| UUID package | NOT SELECTED | Prefer the platform UUID capability if verified for all frozen targets | SYNC-REQ-01 | Verify target support before deciding; do not add preemptively |
| Direct Workbox packages | NOT SELECTED INITIALLY | Avoid duplicate PWA abstraction if the selected plugin already supplies required tooling | PWA-04–PWA-06 | Add only if the custom SW plan proves a direct dependency necessary |
| Backend SDK / HTTP client | NOT SELECTED | Backend and API contract remain unresolved | OQ-003, OQ-006 | Requires explicit human approval and concrete contract |

## Minimal Initial Install Boundary

M1 installs only packages created by the verified Vite React TypeScript scaffold plus Vitest. `idb`, Zustand, PWA tooling, and Capacitor packages are added when their owning milestone begins. This keeps dependency changes attributable and reviewable.

## Lockfile Policy

- Commit exactly one npm lockfile.
- Do not mix npm, pnpm, Yarn, or Bun without a human decision.
- Do not run broad automatic major upgrades during feature work.
- A dependency change must name the requirement/ADR it supports and include typecheck, lint, tests, and build results.

