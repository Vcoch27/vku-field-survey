---
name: troubleshooting
description: >
  Diagnoses a reproducible technical failure through captured evidence and
  hypothesis testing, then verifies the smallest authorized fix. Use for concrete
  failures; do not use for speculative rewrites or dependency churn.
---

# Purpose

Find and prove root cause instead of treating symptoms through trial and error.

# Required Reading

- Full error, stack trace, reproduction context, recent relevant changes, and applicable acceptance IDs
- `AGENTS.md`

# In Scope

- Reproduction, minimization, hypotheses, controlled experiments, root-cause analysis, scoped fix verification, regression risk

# Out of Scope

- Suppressing errors
- Random dependency/version changes
- Rewriting modules before necessity is demonstrated
- Product changes outside the authorized task

# Invariants

- Preserve exact evidence before changing state.
- Test one meaningful hypothesis at a time.
- Distinguish root cause from observed symptom.

# Procedure

1. Reproduce and capture the exact failure.
2. Minimize scope and identify relevant recent changes.
3. Rank falsifiable hypotheses.
4. Test hypotheses one at a time and record results.
5. Identify root cause or report why it remains unproven.
6. If fixing is authorized, implement the smallest correction.
7. Re-run reproduction and relevant regression checks.

# Verification

The original reproduction passes after the fix, adjacent acceptance behavior remains intact, and evidence supports the stated root cause.

# Output Contract

Return: Observed error, Reproduction, Root cause, Fix, Files changed, Verification, and Regression risk.

# References

- Official documentation is required before attributing behavior to a platform/tool guarantee.

# Optional Scripts

Use only safe, targeted reproduction or diagnostic scripts; never destructive cleanup by default.
