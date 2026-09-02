---
name: script-automation
description: >
  Designs and verifies a small deterministic script for a repeated local check or
  transformation. Use when automation is safer and more repeatable than manual
  reasoning; do not use for broad agents, destructive automation, or unrelated scraping.
---

# Purpose

Convert stable repeated validation into least-privilege, reviewable automation.

# Required Reading

- The repeated manual procedure, expected inputs/outputs, failure modes, and repository guardrails

# In Scope

- Folder/frontmatter validation, acceptance-ID comparison, checklist generation, TODO/`any` scans, evidence-name normalization, image-dimension checks, and build-artifact inspection

# Out of Scope

- Product features, secrets, destructive defaults, uncontrolled network activity, or Reddit/community scraping without a genuine research need and explicit scope

# Invariants

- Default behavior is local, deterministic, non-destructive, and idempotent where practical.
- Inputs, outputs, exit codes, write scope, and dry-run behavior are explicit.
- Fail safely; never hide partial failure.

# Procedure

1. Prove the workflow is repeated and stable enough to automate.
2. Define input/output contract, allowed writes, error cases, and platform assumptions.
3. Choose the smallest available runtime without adding a dependency unnecessarily.
4. Implement with clear diagnostics and least privilege.
5. Test normal, invalid, empty, boundary, and safe repeat-run cases.
6. Document invocation and limitations next to the script or in the invoking skill.

# Verification

Run the script against representative safe fixtures; verify output, exit codes, no out-of-scope writes, and repeatability.

# Output Contract

Report script path, purpose, invocation, inputs/outputs, permissions, tested cases, results, and limitations.

# References

- Repository acceptance and evidence contracts as applicable

# Optional Scripts

Do not create a script until a concrete repeated procedure is identified.
