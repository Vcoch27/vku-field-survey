# Frontend Quality Rule

Applies only after product implementation is authorized.

- TypeScript errors, lint findings, failed tests, and build failures must be resolved or explicitly reported; never suppress them to obtain a green command.
- Keep components focused on presentation and interaction. Persistence and native/platform operations follow approved ports and use cases.
- Avoid `any`, giant components, duplicate logic, unnecessary abstractions, dead code, and placeholders presented as completed behavior.
- Cover loading, empty, validation, error, offline, pending-sync, and success states when required by acceptance IDs.
- Verify responsive behavior, keyboard interaction, touch targets, focus, labels, status announcements, and horizontal overflow in approved environments.
- Evidence must identify the build/commit, viewport or device, procedure, and acceptance ID.

