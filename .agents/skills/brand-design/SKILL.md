---
name: brand-design
description: >
  Defines or reviews a coherent visual language, design tokens, UX copy, and
  accessibility guidance for a scoped UI workstream. Use after brand inputs are
  available; do not use to choose business architecture or invent requirements.
---

# Purpose

Turn approved product and brand inputs into reusable UI guidance rather than one-off styling prompts.

# Required Reading

- Approved requirements and UI acceptance criteria
- Existing brand assets, design decisions, and open questions
- `AGENTS.md`

# In Scope

- Color, typography, spacing, radius, icon style, and status semantics
- Tone of voice and offline/sync copy guidance
- Accessibility and responsive consistency

# Out of Scope

- Domain, persistence, synchronization, or backend architecture
- Fabricating logos, fonts, tokens, or brand claims without approval
- Treating an unrelated example brief as a project requirement

# Invariants

- Distinguish offline, saved locally, pending, failed, and synchronized states.
- Do not rely on color alone for meaning.
- Trace project-specific choices to an approved source or mark them unresolved.

# Procedure

1. Inventory authoritative brand inputs and UI states.
2. Record missing inputs in `docs/research/OPEN_QUESTIONS.md`.
3. Propose the smallest token and copy system covering required states.
4. Check contrast, focus, touch, responsive, and long-content behavior.
5. Map guidance to UI acceptance IDs and request human approval before freezing it.

# Verification

Review internal token consistency, state differentiation, accessibility basics, responsive applicability, and source traceability.

# Output Contract

Produce a scoped design-guidance proposal with sources, tokens/copy rules, acceptance mapping, unresolved choices, and approval status.

# References

- `docs/acceptance/UI.md`
- Official WCAG/WAI sources must support consequential accessibility claims during research.

# Optional Scripts

Only add deterministic checks such as token validation or contrast inspection when their inputs are approved.
