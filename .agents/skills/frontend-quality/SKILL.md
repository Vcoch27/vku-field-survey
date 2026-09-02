---
name: frontend-quality
description: >
  Reviews an authorized frontend change for TypeScript, React responsibility,
  maintainability, and executable quality checks. Use on frontend plans/diffs
  after implementation is allowed; do not design product scope or persistence.
---

# Purpose

Prevent fragile, placeholder-heavy frontend changes and keep approved responsibility boundaries intact.

# Required Reading

- Applicable task contract, acceptance IDs, approved architecture, `AGENTS.md`, and `.agents/rules/frontend-quality.md`

# In Scope

- Type safety, component responsibility, duplication, abstraction cost, error/state handling, tests, lint, typecheck, and build

# Out of Scope

- Brand direction, local database design, sync protocol, native integration, or unrelated refactors

# Invariants

- UI does not own persistence or native adapters outside the approved contract.
- No `any`, suppression, placeholder, TODO-as-implementation, or giant component is accepted without explicit approval.

# Procedure

1. Map the change to its task and acceptance IDs.
2. Inspect the diff and nearby code for responsibility and reuse.
3. Trace data, state, errors, and user-visible fallbacks.
4. Run targeted tests, typecheck, lint, and build when configured.
5. Rank findings by acceptance impact and distinguish blockers from improvements.

# Verification

Record exact commands/results and confirm no finding is hidden by suppression or unrelated rewrites.

# Output Contract

Return acceptance mapping, findings by severity with file evidence, command results, regression risks, and PASS/BLOCKED verdict. A review pass remains read-only.

# References

- `.agents/rules/frontend-quality.md`
- Approved architecture and handoff for the task

# Optional Scripts

Use project-approved checks only; do not add tools during a review pass.
