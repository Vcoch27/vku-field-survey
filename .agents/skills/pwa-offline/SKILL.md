---
name: pwa-offline
description: >
  Plans or verifies PWA installability, manifest, service-worker App Shell, offline
  boot, cache behavior, and Background Sync feature detection. Use for PWA shell
  behavior; do not use for survey queue semantics or native implementation.
---

# Purpose

Keep PWA platform behavior evidence-driven and separate from domain synchronization rules.

# Required Reading

- `docs/assignment/REQUIREMENTS.md`
- `docs/acceptance/PWA.md`
- Relevant researched sources/risks and approved architecture

# In Scope

- Manifest, installability, icons, secure context, service worker, App Shell, cache strategy, offline boot/reload, Background Sync feature detection, and fallback trigger integration

# Out of Scope

- IndexedDB survey schema, queue ordering, API payloads, UI styling, or Capacitor-native implementation

# Invariants

- Consequential browser/platform behavior is verified against current official sources.
- Cache behavior is explicit; feature availability is detected rather than assumed.
- Fallback triggers call the approved shared sync use case.

# Procedure

1. Map work to PWA acceptance IDs and target environments.
2. Research current official installability, service-worker, cache, and Background Sync constraints when not already recorded.
3. Define the minimum App Shell and cache/update behavior as a proposal.
4. Identify unsupported/error paths and approved fallbacks.
5. When implementation is authorized, verify online-first load, installation, offline launch, and offline reload on approved targets.

# Verification

Use `docs/acceptance/PWA.md`; record manifest/cache inspection, runtime/version, console state, and evidence paths.

# Output Contract

Return mapped IDs, source-backed constraints, proposed/observed behavior, compatibility limits, verification results, evidence, and unresolved questions.

# References

- Official web standards and browser documentation recorded in `docs/research/SOURCES.md`

# Optional Scripts

Only approved local manifest/icon/build-artifact validation scripts.
