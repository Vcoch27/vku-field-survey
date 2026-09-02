---
name: skill-creator
description: >
  Creates or reviews one focused reusable agent skill with precise activation,
  scope, procedure, verification, and output contract. Use for repeatable
  workflows; do not use to bundle an entire project or duplicate global rules.
---

# Purpose

Encode a proven, repeated job as a small skill another agent can invoke reliably.

# Required Reading

- `AGENTS.md`
- `.agents/rules/project-guardrails.md`
- Existing nearby skills and the workflow examples supplied by the requester

# In Scope

- Trigger and boundary definition
- Minimal `SKILL.md` instructions and only necessary resources
- Frontmatter, discoverability, safety, and output review

# Out of Scope

- Mega-skills spanning unrelated jobs
- Project-wide policy already owned by `AGENTS.md`
- Product implementation or speculative integrations

# Invariants

- One skill solves one clear job.
- `name` uses lowercase letters, digits, and hyphens.
- Description says what activates the skill and what nearby work does not.
- Scripts are least-privilege, deterministic, non-destructive by default, and contain no secrets.

# Procedure

1. Collect concrete trigger examples and non-examples.
2. Identify the repeated procedure and reusable scripts/references/assets actually needed.
3. Check for overlap with an existing skill or global rule.
4. Create the smallest skill with required reading, scope, invariants, procedure, verification, output, references, and optional scripts.
5. Review for vague triggers, unnecessary dependencies, duplicated policy, excessive permissions, and unfinished placeholders.
6. Validate structure and, when risk warrants it, forward-test against a realistic task.

# Verification

- Frontmatter parses and folder/name match.
- No TODO scaffold text remains.
- In-scope/out-of-scope and observable outputs are unambiguous.
- Referenced files exist; any script is executed on a safe fixture.

# Output Contract

Report the skill path, trigger, resources added, validation performed, known limits, and any question requiring human approval.

# References

- The supplied setup playbook, sections 20–22

# Optional Scripts

Add scripts only when repeated deterministic execution is safer than prose instructions.
