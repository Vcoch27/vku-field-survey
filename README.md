# VKU Field Survey

Campus Equipment & Facility Inspection — Offline-first PWA with Android (Capacitor) support.

## Prerequisites

- Node.js 22.13 or newer (Node.js 24 LTS recommended)
- npm 10 or newer
- Java 21 (for Android builds)
- Android SDK with platform-tools (for Android builds)

## Setup

```powershell
npm install
```

## Development Commands

```powershell
npm run dev          # Start local dev server
npm run typecheck    # TypeScript type checking
npm run lint         # ESLint
npm run test -- --run  # Run test suite once
npm run build        # Production build → dist/
```

## Architecture

- **Web / PWA**: React + TypeScript + Vite, service worker via `vite-plugin-pwa` (Workbox injectManifest mode).
- **Offline**: Survey drafts autosaved to IndexedDB. Submissions queued as `PENDING_SYNC` until connectivity is available.
- **Android**: Capacitor 8 wraps the same web build. Native Camera (`@capacitor/camera`) and Network (`@capacitor/network`) adapters are loaded at runtime via `createRuntime()`.
- **Sync**: M6 `SyncOrchestrator` — sequential, durable claiming, retry on failure. Remote destination (OQ-003) is unresolved; `SYNCED` state is only set on confirmed positive acknowledgement.

## Production Deployment — Cloudflare Pages

**Build settings:**

| Setting | Value |
|---|---|
| Framework preset | None (or Vite) |
| Production branch | `main` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` |
| Environment variables | **None required** |

**Steps:**
1. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git
2. Select repository `Vcoch27/vku-field-survey`
3. Apply the build settings above
4. Click Deploy
5. After deployment, add custom domain under Pages → Custom domains

## Android Build

```powershell
# After npm run build:
npx cap sync android

# From android/ directory (requires JAVA_HOME → JDK 21, ANDROID_HOME → SDK):
$env:JAVA_HOME = "C:\Program Files\Java\jdk-21"
$env:GRADLE_USER_HOME = "$env:USERPROFILE\.gradle"
.\gradlew.bat assembleDebug
```

Debug APK is written to `android/app/build/outputs/apk/debug/`.

> **Note:** `android/local.properties` is machine-specific and excluded from version control.
