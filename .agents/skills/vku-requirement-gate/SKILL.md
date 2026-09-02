---
name: vku-requirement-gate
description: >
  Maps proposed VKU Field Survey work to approved requirements, acceptance IDs,
  and unresolved questions before planning or implementation. Use as a scope
  gate; do not use to invent missing requirements or approve human decisions.
---

# Purpose

Prevent scope drift and make every task traceable to authoritative VKU outcomes.

# Required Reading

- `AGENTS.md`
- `docs/assignment/REQUIREMENTS.md`
- `docs/assignment/ACCEPTANCE_CRITERIA.md`
- Relevant `docs/acceptance/*.md`
- `docs/research/OPEN_QUESTIONS.md`

# In Scope

- Requirement/acceptance mapping, phase authorization, assumptions, gaps, and write-scope checks

# Out of Scope

- Requirement invention, backend/API selection, architecture approval, unrelated features, or implementation

# Invariants

- Lecturer/user assignment outranks the setup playbook.
- A consequential conflict or gap becomes an open question, not an agent decision.
- No feature is DONE without acceptance evidence.

# Procedure

1. State the task and current project phase.
2. Identify exact requirement and acceptance IDs.
3. Check source status, open questions, prerequisites, and Human Gates.
4. State assumptions and requested write scope.
5. Return PASS only if scope is traceable and authorized; otherwise return HOLD with specific gaps.
6. Add missing consequential information to `OPEN_QUESTIONS.md` when authorized to edit it.

# Verification

Confirm every claimed outcome maps to an existing ID and no unresolved gate is presented as approved.

# Output Contract

Return: Gate result (PASS/HOLD), current phase, requirement IDs, acceptance IDs, source status, assumptions, unresolved questions, permitted scope, and prohibited scope.

# References

- `docs/assignment/`
- `docs/acceptance/`

# Optional Scripts

An acceptance-ID consistency checker may be added through `script-automation` after the format stabilizes.
