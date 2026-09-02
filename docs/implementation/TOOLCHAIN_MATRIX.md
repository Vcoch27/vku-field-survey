# Toolchain and Dependency Matrix

Status: **REVALIDATED FOR M0**
Date Checked: 2026-09-02

This document records the exact toolchain and dependency versions verified during the M0 phase. It determines the safe compatibility baseline before initialization.

## Dependency Classification Table

| Tool / Package | Latest Verified Stable | Planned Milestone | Classification | Compatibility Notes | Official Source |
|---|---|---|---|---|---|
| `react` | 19.2.x | M1 | REQUIRED NOW | Fully compatible with Vite 8. | npmjs / official release |
| `react-dom` | 19.2.x | M1 | REQUIRED NOW | Matches `react` version. | npmjs / official release |
| `typescript` | 7.0.x | M1 | REQUIRED NOW | Supported by Vite 8 and React 19 templates. | npmjs / official release |
| `vite` | 8.2.x | M1 | REQUIRED NOW | Supports Node 20.19+ and 22.12+. | npmjs / official release |
| `@vitejs/plugin-react` | Vite scaffold baseline | M1 | REQUIRED NOW | Official Vite plugin for React. | Vite React TS template |
| ESLint baseline | Vite scaffold baseline | M1 | REQUIRED NOW | Sourced directly from Vite scaffold. | Vite React TS template |
| `vitest` | 4.1.x | M1 | REQUIRED NOW | Establishes the logic-test baseline. | npmjs / official release |
| `idb` | 8.0.x | M3 | DEFERRED | Standard promise wrapper for IndexedDB. | npmjs / official release |
| `zustand` | 5.0.x | M4 (or later) | DEFERRED | Only install when shared transient state is actually needed. | npmjs / official release |
| `vite-plugin-pwa` | 1.3.x | M7 | DEFERRED | Verified compatible with Vite 8. | npmjs / official release |
| `@capacitor/core` | 8.5.x | M8 | DEFERRED | Requires Node 22+. | official Capacitor docs |
| `@capacitor/cli` | 8.5.x | M8 | DEFERRED | Must match core major version. | official Capacitor docs |
| `@capacitor/android` | 8.5.x | M8 | DEFERRED | Matches Capacitor 8 core. | official Capacitor docs |
| `@capacitor/camera` | 8.5.x | M8 | DEFERRED | Matches Capacitor 8 core. | official Capacitor docs |
| `@capacitor/network` | 8.5.x | M8 | DEFERRED | Matches Capacitor 8 core. | official Capacitor docs |

## Recommended local prerequisites

- **FACT (Vite 8 Minimum)**: Vite 8 officially supports Node.js 20.19+ and 22.12+.
- **FACT (Capacitor 8 Minimum)**: Capacitor 8 officially requires Node.js 22 or higher.
- **PROJECT BASELINE**: Node.js **24.x LTS** is recommended as the project baseline because the combined React/Vite/Capacitor toolchain is strictly bound by Capacitor's higher Node 22+ requirement.
- **npm**: Included with the Node 24.x LTS baseline.

## M1 install set

M1 must remain minimal. The following packages constitute the web scaffold and logic-test baseline and are the **only** dependencies authorized for installation during M1 project initialization:

- `react`
- `react-dom`
- `typescript`
- `vite`
- `@vitejs/plugin-react`
- `vitest`
- Base ESLint configuration provided by the Vite scaffold.

## Deferred dependency set

These packages are intentionally deferred and **must not** be installed in M1:

- `idb` (Deferred to M3 — IndexedDB persistence)
- `zustand` (Deferred to M4 or later — only when shared state is needed)
- `vite-plugin-pwa` (Deferred to M7 — PWA offline shell)
- `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/camera`, `@capacitor/network` (Deferred to M8 — Capacitor native integration)

## Capacitor toolchain requirements

For the M8 Capacitor Native Integration, the following official environment requirements apply per Capacitor 8 documentation:

- **Node.js**: Node 22 or higher.
- **JDK**: Java 21 is recommended.
- **Android Studio**: Otter (2025.2.1) or newer.
- **Gradle / AGP**: Gradle Wrapper 8.14.3 and Android Gradle Plugin (AGP) 8.13.0.
- **minSdkVersion**: 24 (Requires Android 7.0+, implying System WebView 60+).
- **targetSdkVersion**: 36.
- **compileSdkVersion**: 36.

## Risks / incompatibilities

- **Gradle Syntax Change**: Gradle 8+ deprecates space-assignment syntax. The Android build configuration (`variables.gradle` or `build.gradle`) must use the `=` operator (e.g., `compileSdk = 36`).
- **Node Version Requirement**: Developers must use Node 22+ (Node 24 LTS recommended) to avoid Capacitor 8 build failures.

## Version Installation Strategy

Do not require manually pinning every package before scaffolding if `create-vite` generates a current mutually-compatible baseline. Use this reproducible strategy for M1:

1. Use current official `create-vite` scaffold.
2. Inspect the generated `package.json`.
3. Verify the generated versions against this matrix.
4. Install `vitest`.
5. Generate `package-lock.json`.
6. Commit the baseline.

## Revalidation notes

The implementation plan assumptions correctly align with current toolchain realities. Dependencies have been partitioned properly to keep the M1 initialization strictly confined to the React/Vite web scaffold. No required package lacks support for current majors.
