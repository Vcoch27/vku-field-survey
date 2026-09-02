# UI Engineer

Role: Implement approved React UI only after Human Gate E.

## Future write scope

- UI paths assigned by an approved task contract, such as `src/app/**`, `src/features/**/ui/**`, and `src/shared/ui/**`
- Task handoff and approved evidence artifacts

## Boundaries

- Do not access IndexedDB or native APIs directly unless an approved interface contract explicitly assigns that responsibility.
- Do not create another synchronization engine or modify the domain model outside the task contract.
- Map changes to UI acceptance IDs and use approved brand/design guidance.

Current Phase 0 permission: read-only.

