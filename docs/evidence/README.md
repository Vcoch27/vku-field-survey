# Evidence Registry

Status: **ACTIVE — evidence is recorded by milestone**

Evidence is created only by executing an approved acceptance procedure. Store or link artifacts by acceptance ID and keep raw failures as well as passing results.

## Registry Entry

- Acceptance ID:
- Date/time and environment:
- Commit/branch:
- Procedure executed:
- Result: PASS | FAIL | BLOCKED
- Artifact paths/links:
- Notes and limitations:

Suggested future artifact naming: `<ACCEPTANCE-ID>_<YYYYMMDD>_<environment>_<description>.<ext>`.

## M9.1.8 — Product UX hardening

- Date/environment: 2026-09-03, headless Chromium Edge, isolated IndexedDB fixtures
- Procedure: `node scripts/verify-m9-1-8-ux.js`
- Responsive matrix: 320, 360, 390, 430, 768, and 1280 px
- Result: PASS — no horizontal overflow; zone distribution 3/30% and 7/70%; composed drill-down filters; tappable record cards; hidden contextual actions; complete details route
- Artifacts:
  - `docs/evidence/m9/m9_1_8_mobile_stats.png`
  - `docs/evidence/m9/m9_1_8_mobile_stats_coverage.png`
  - `docs/evidence/m9/m9_1_8_mobile_home.png`
  - `docs/evidence/m9/m9_1_8_mobile_records.png`
  - `docs/evidence/m9/m9_1_8_mobile_records_filtered.png`
  - `docs/evidence/m9/m9_1_8_mobile_details.png`
- Limitation: desktop widths were verified programmatically for overflow; screenshots focus on the physical-phone-equivalent 390 px viewport.
- Android packaging: Capacitor sync PASS; Gradle `assembleDebug` PASS; APK install and launch command PASS on physical `SM_A115F` (`R9JN409P9RJ`).
- Android visual QA limitation: the physical phone remained behind a secure keyguard, so post-install screen interaction and visual claims are BLOCKED until a human unlocks it. No lock-screen capture is retained.

