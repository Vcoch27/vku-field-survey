# Compatibility and Verification Matrix

Status: **AUDITED AND CORRECTED — RESEARCH PASS**

This document contrasts **verified platform facts** (browser and operating system capabilities) with **project recommendations** (proposed verification environments and architectural choices).

---

## 1. Web and PWA Platform Capabilities

### Platform Support Matrix (FACT)

| Feature / Standard | Chromium (Chrome, Edge, Samsung) | WebKit / Safari (iOS & macOS) | Gecko / Firefox | Source / Standard |
| :--- | :--- | :--- | :--- | :--- |
| **Web App Manifest** | Supported (`manifest.json`) | Supported (iOS 11.3+, macOS Sonoma 14+) | Supported | W3C Web App Manifest |
| **PWA Installation** | Supported (automated prompt / URL bar) | Supported (Add to Home Screen / Add to Dock) | Supported (manual install/shortcut) | Vendor-specific heuristics |
| **Service Worker Required for Install?** | Historically required for prompt; now controls `start_url` | **Not required** (Manifest / meta tags suffice) | **Not required** | MDN / web.dev |
| **Service Worker & Cache API** | Supported (Secure context / HTTPS) | Supported (Secure context / HTTPS) | Supported (Secure context / HTTPS) | W3C Service Workers |
| **Background Sync API** | **Supported** (WICG, Chrome 49+) | **Not Supported** | **Not Supported** | WICG Community Draft |
| **`navigator.onLine` & events** | Supported (local interface status only) | Supported (local interface status only) | Supported (local interface status only) | WHATWG HTML Living Standard |
| **IndexedDB (`idb` / native)** | Supported (with LRU eviction under pressure) | Supported (with LRU eviction under pressure) | Supported (with LRU eviction under pressure) | W3C Indexed Database API |

### Project Verification Targets (RECOMMENDATION)

- **Primary Browser Target**: Google Chrome (Current Stable, Desktop & Android) — verifies manifest installability, App Shell caching, and Background Sync trigger.
- **Cross-Platform Fallback Target**: Apple Safari (iOS 17+ / macOS) — verifies WebKit home-screen addition, App Shell offline launch, and fallback sync when Background Sync is unavailable.
- **Offline Shell & Persistence Invariant**: While browsers differ on whether a Service Worker is needed to install the app, this VKU project has an **explicit assignment requirement** (`PWA-REQ-06`, `PWA-REQ-07`) requiring Service Worker App Shell caching and offline boot across all targets.

---

## 2. Capacitor Android Native Environment

### Official Capacitor Specifications (FACT)

| Specification | Capacitor 6.x | Capacitor 7.x | Source |
| :--- | :--- | :--- | :--- |
| **Required Java JDK** | JDK 17 | JDK 21 | Official Capacitor Docs |
| **Minimum Android Studio** | Android Studio Hedgehog (2023.1.1)+ | Android Studio Ladybug (2024.2.1)+ | Official Capacitor Docs |
| **Minimum Android SDK (`minSdkVersion`)** | API 22 (Android 5.1) | API 23 (Android 6.0) | Capacitor Android Docs |
| **Default Target SDK (`targetSdkVersion`)** | API 34 (Android 14) | API 35 (Android 15) | Capacitor Android Docs |
| **Required Android WebView** | Chrome / System WebView 60+ | Chrome / System WebView 60+ | Capacitor Android Docs |

### Camera Plugin Formats (`@capacitor/camera`)

- **FACT**: Capacitor Camera returns photos via `webPath` (file URI path) or, in earlier API versions, via `resultType` (`CameraResultType.Uri`, `CameraResultType.Base64`, `CameraResultType.DataUrl`). Capacitor docs do not forbid Base64, but document substantial memory and performance costs.
- **RECOMMENDATION**: Always prefer URI-based image results (`webPath` / file URI) to avoid large Base64 strings in the JavaScript heap, preventing mobile Out-Of-Memory (OOM) crashes.

### Android Verification Target (RECOMMENDATION)

- **Proposed Device / Emulator**: Android Emulator or physical device running Android 14 (API 34) or Android 15 (API 35), built with Android Studio Hedgehog or Ladybug.

---

## 3. Deployment Platforms

### Provider Capabilities (FACT)

| Provider | Automated HTTPS | Static Vite (`dist/`) Support | SPA Client-Side Routing |
| :--- | :--- | :--- | :--- |
| **Cloudflare Pages** | Yes (Free automated SSL/TLS) | Yes | Yes (configured via `_routes.json` or fallback) |
| **Vercel** | Yes (Free automated SSL/TLS) | Yes | Yes (configured via `vercel.json` rewrites) |

### Hosting Selection (RECOMMENDATION)

- Either Cloudflare Pages or Vercel satisfies all `DELIVERABLE-REQ-01` and PWA secure-context prerequisites. Final provider selection will occur at Gate D.
