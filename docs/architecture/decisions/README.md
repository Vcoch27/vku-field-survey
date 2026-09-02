# Architecture Decision Records

Status: **APPROVED — FROZEN AT HUMAN GATE D**

This directory contains the Architecture Decision Records approved and frozen by the human owner at Gate D. They are binding for implementation unless superseded through a later approved ADR.

## Approved Decision Records

| ADR | Title | Status | Scope |
| :--- | :--- | :--- | :--- |
| [ADR-001](./ADR-001-storage-abstraction.md) | Storage Abstraction and Persistence Engine Choice | Approved | `SurveyStoragePort` and `idb` adapter |
| [ADR-002](./ADR-002-sync-orchestration.md) | Centralized Sequential Sync Orchestration with Single-Flight Locking | Approved | Single sync orchestrator, FIFO queue, and single-flight lock |
| [ADR-003](./ADR-003-platform-adapters.md) | Port-and-Adapter Isolation for Platform Capabilities (Camera and Network) | Approved | Ports and separate Web / Capacitor adapters |
| [ADR-004](./ADR-004-state-management.md) | Separation of Transient UI State from Persistent Domain Storage | Approved | Zustand for transient UI state vs IndexedDB for durable data |

---

## ADR Template

- **Status**: proposed | approved | superseded | rejected
- **Date**: YYYY-MM-DD
- **Decision Owner**:
- **Related Requirement/Acceptance IDs**:
- **Context and Verified Sources**:
- **Options Considered**:
- **Decision**:
- **Consequences and Risks**:
- **Approval Reference**:
