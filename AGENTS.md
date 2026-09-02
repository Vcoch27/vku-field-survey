# Project Mission

Prepare and build VKU Field Survey only against the supplied VKU assignment, report template, approved decisions, and acceptance criteria. The repository is the shared memory for humans, Codex, Antigravity, reviewers, and QA.

# Current Phase

`SETUP ONLY — PRODUCT CODE NOT STARTED`

Do not initialize or implement the product until Human Gates A–E are approved. Current setup artifacts may document future work but must not claim any product feature is complete.

# Source Priority

1. Lecturer/user-supplied assignment
2. Official report template
3. Human-approved project decisions
4. Official technology documentation
5. Maintainer documentation and official repositories
6. Secondary sources for discovery only

If sources conflict or a consequential requirement is missing, record it in `docs/research/OPEN_QUESTIONS.md` and wait for human approval.

# General Guardrails

- Never invent or silently change requirements, APIs, backends, architecture, or rubric interpretation.
- Do not add dependencies without documented justification and approval at the appropriate gate.
- Inspect existing files before creating abstractions; prefer the smallest requirement-aligned change.
- Do not duplicate utilities or global rules in skills.
- Do not use placeholders or TODOs as production implementation.
- Do not suppress errors or use TypeScript `any` unless explicitly approved.
- Keep UI, use cases, persistence, and platform APIs behind approved boundaries.
- Failed synchronization must never delete unsynced data.
- Network availability is a retry trigger, not proof that a destination is reachable.
- All synchronization triggers must call one approved synchronization use case.

# Phase Gates

No product implementation starts before human approval of:

- Gate A — Requirements
- Gate B — Acceptance criteria
- Gate C — Research risks
- Gate D — Architecture
- Gate E — Interface contracts

# Research Rules

For consequential technical claims, prefer primary or official sources and record the URL, source class, verified fact, project implication, compatibility limitation, and date checked. Blogs, tutorials, forums, and Reddit are not authoritative when a primary source exists.

# Git and Ownership Rules

- One writing agent per active worktree; do not edit another agent's worktree.
- Use task-scoped branches and commits; do not merge directly into `main`.
- Do not change unrelated files.
- Reviewer passes are read-only; a reviewer does not fix the code being reviewed in the same pass.
- QA is read-only except for approved evidence artifacts.

# Definition of Ready

A coding task requires a clear goal, requirement and acceptance IDs, source of truth, write scope, out-of-scope, resolved or recorded unknowns, fixed dependencies, and a verification method.

# Verification and Definition of Done

Run relevant tests, typecheck, lint, production build, and required browser/device scenarios when those commands exist. A task is complete only when acceptance IDs are mapped, scope is respected, verification passes, evidence and assumptions are recorded, risks are documented, and no blocking independent-review finding remains.

Never mark a VKU rubric item complete without evidence. “Code written” is not “Done.”
