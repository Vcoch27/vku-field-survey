---
name: ui-quality
description: >
  Reviews or verifies the VKU survey UI for mobile form usability, responsive and
  touch behavior, validation, accessibility, and offline/sync states. Use for UI
  acceptance and browser evidence; do not redesign storage or synchronization.
---

# Purpose

Make required field-survey states usable and independently verifiable across approved mobile/browser environments.

# Required Reading

- Form requirements, `docs/acceptance/UI.md`, approved brand guidance, architecture interfaces, and target environments

# In Scope

- Mobile-first layout, responsive behavior, touch, forms, validation, keyboard, camera preview, loading/error/empty states, offline/draft/pending/synced status, accessibility, and screenshot verification

# Out of Scope

- Local database architecture, a second sync engine, backend/API choices, or unapproved domain-model changes

# Invariants

- UI status language reflects actual domain state.
- Validation preserves the draft.
- Required controls are keyboard/touch operable and meaning is not color-only.
- UI uses approved interfaces rather than direct persistence access.

# Procedure

1. Map the task to UI IDs and enumerate all required states/content extremes.
2. Check approved tokens/copy and interface boundaries.
3. Inspect mobile viewports, long content, touch rating, camera states, offline/draft/sync feedback, validation, keyboard, focus, and overflow.
4. Run browser QA on approved targets and capture state-specific evidence.
5. Report defects by acceptance impact without fixing them in an independent review pass.

# Verification

Use `docs/acceptance/UI.md`; record viewport/browser, input method, steps, result, accessibility observations, and screenshot paths.

# Output Contract

Return mapped IDs, tested matrix, state coverage, findings by severity, evidence registry links, limitations, and PASS/BLOCKED verdict.

# References

- Approved brand guidance and official accessibility findings

# Optional Scripts

Only approved screenshot naming, viewport, or static accessibility checks; automation does not replace manual interaction QA.
