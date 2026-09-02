---
name: capacitor-native
description: >
  Plans or verifies approved Capacitor Android boundaries, Camera and Network
  integrations, permissions, builds, installation, and APK evidence. Use for the
  native Android workstream; do not use for generic web UI or sync-domain design.
---

# Purpose

Keep native platform work behind approved adapters and prove it on an approved Android environment.

# Required Reading

- Native requirements and `docs/acceptance/NATIVE.md`
- Official Capacitor/Android findings in `docs/research/`
- Approved architecture, permission policy, and interface contracts

# In Scope

- Capacitor Android configuration, Camera, Network, permissions, web/native boundary, Android build/install/run verification, and APK evidence

# Out of Scope

- Web layout, IndexedDB schema, queue/business semantics, backend/API design, or unsupported platform assumptions

# Invariants

- Native APIs are accessed through approved platform adapters.
- Permission denial/cancellation is handled without claiming success.
- Connectivity events trigger approved logic but never prove server reachability.

# Procedure

1. Map to NATIVE IDs and confirm target versions/devices and official compatibility sources.
2. Define or inspect adapter boundaries and permission/error paths.
3. When authorized, configure only approved plugins and native files.
4. Build, install, and test camera, offline/reconnect, restart persistence, and web fallback behavior on approved targets.
5. Capture reproducible commands, versions, device details, logs, and artifacts.

# Verification

Use `docs/acceptance/NATIVE.md`; browser-only evidence cannot satisfy native criteria.

# Output Contract

Return mapped IDs, target/tool versions, permissions/adapters, commands/results, device evidence, risks, and unresolved questions.

# References

- Official Capacitor and Android documentation recorded in `docs/research/SOURCES.md`

# Optional Scripts

Only approved build/artifact inspection scripts; never publish or sign artifacts implicitly.
