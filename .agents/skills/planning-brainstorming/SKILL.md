---
name: planning-brainstorming
description: >
  Explores bounded solution options and converts a substantial approved problem
  into a dependency-aware, verifiable task plan. Use before large or ambiguous
  work; do not reopen settled requirements or brainstorm without a decision gate.
---

# Purpose

Move from problem to executable plan through Explore → Clarify → Plan → Execute readiness.

# Required Reading

- Current source-of-truth, acceptance IDs, open questions, and approved ADRs
- `AGENTS.md`

# In Scope

- Constraints, unknowns, options, trade-offs, assumptions, dependencies, task boundaries, and verification strategy

# Out of Scope

- Re-asking answered questions
- Changing requirements for convenience
- Making decisions reserved for a human gate
- Implementation while planning is requested

# Invariants

- Every recommended task maps to an approved goal and verification method.
- Consequential unknowns remain visible; they are not hidden as assumptions.

# Procedure

1. State the problem and known constraints.
2. Separate known facts, assumptions, and unknowns.
3. Generate only materially distinct feasible options.
4. Compare trade-offs against requirements and acceptance criteria.
5. Recommend a path or stop at the relevant Human Gate.
6. Split work by dependencies, ownership, write scope, risks, and verification.

# Verification

Check the Definition of Ready in `AGENTS.md`; confirm no task depends on an unresolved consequential decision.

# Output Contract

Return: Problem, Known constraints, Unknowns, Options, Trade-offs, Recommended path, Task breakdown, and Verification strategy.

# References

- `docs/research/OPEN_QUESTIONS.md`
- `docs/assignment/ACCEPTANCE_CRITERIA.md`

# Optional Scripts

None by default.
