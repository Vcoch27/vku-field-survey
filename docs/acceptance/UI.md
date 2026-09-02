# UI Acceptance

Design status: **Owner decisions applied — candidate for Gate B freeze**

Execution status: **NOT TESTED**

| ID | Class | Trace | PASS conditions | Required evidence |
|---|---|---|---|---|
| UI-01 | DERIVED | PWA-REQ-01, FORM-REQ-01–FORM-REQ-07, NATIVE-REQ-01 | On each approved mobile viewport, all required inspection fields and the primary workflow remain operable without switching to a desktop viewport. | Screenshots and interaction capture for each approved viewport |
| UI-02 | QUALITY_PROPOSAL | Project Quality Proposal | Long labels, values, and notes do not hide required information or controls. | Long-content screenshots |
| UI-03 | DERIVED | FORM-REQ-05 | The 1–5 star rating can be selected by touch and the selected value is clearly observable. | Touch interaction and selected-value evidence |
| UI-04 | QUALITY_PROPOSAL | Project Quality Proposal | A returned photo has a clear preview plus understandable replace/remove and error/cancellation behavior. | Photo-state screenshot set |
| UI-05 | QUALITY_PROPOSAL | Project Quality Proposal | The UI makes offline connectivity observable without implying successful remote synchronization. | Offline-state screenshot and copy review |
| UI-06 | QUALITY_PROPOSAL | Project Quality Proposal | The UI confirms local draft persistence without implying successful remote synchronization. | Saved-state interaction capture |
| UI-07 | QUALITY_PROPOSAL | Project Quality Proposal | The UI can distinguish saved locally, pending synchronization, synchronization failed, and synchronized states. The synchronized state is shown only after positive destination acknowledgement. | State comparison screenshots and associated record states |
| UI-08 | QUALITY_PROPOSAL | Project Quality Proposal | Validation failure preserves entered values and presents actionable errors with understandable focus/attention behavior. | Invalid-submit interaction and retained-value evidence |
| UI-09 | QUALITY_PROPOSAL | Project Quality Proposal | The software keyboard does not permanently obscure the active field or required primary action in approved mobile scenarios. | Keyboard-state capture |
| UI-10 | QUALITY_PROPOSAL | Project Quality Proposal | No horizontal page overflow occurs at approved viewport sizes with required and representative long content. | Viewport screenshots and overflow inspection |

Brand tokens, exact wording, icons, colors, component design, validation rules, supported viewports, and accessibility conformance level remain unfrozen. These quality proposals are approved project commitments but are not VKU assignment requirements.
