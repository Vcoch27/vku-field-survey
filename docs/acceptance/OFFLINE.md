# Offline Persistence Acceptance

Design status: **Owner decisions applied — candidate for Gate B freeze**

Execution status: **NOT TESTED**

| ID | Class | Trace | PASS conditions | Required evidence |
|---|---|---|---|---|
| DATA-01 | DIRECT | DATA-REQ-01, DATA-REQ-02 | After a meaningful form change, draft data is saved automatically to IndexedDB-backed storage without the user pressing a manual Save button. A short debounce is permitted, but its exact duration is not tested by this criterion. | Form interaction and before/after IndexedDB inspection showing automatic persistence |
| DATA-02 | DIRECT | DATA-REQ-01–DATA-REQ-03 | After entering data and allowing the approved persistence trigger to complete, refreshing the page restores the saved values. | Before/after refresh capture and IndexedDB inspection |
| DATA-03 | QUALITY_PROPOSAL | Project Quality Proposal | When platform persistent storage remains available, closing and reopening the approved browser/native runtime restores the most recent saved draft. | Close/reopen capture, platform storage conditions, and IndexedDB inspection |
| DATA-04 | DERIVED | DATA-REQ-01–DATA-REQ-03 | Data recovered after refresh can be edited, persisted, and recovered after another refresh. | Edit/refresh capture and IndexedDB inspection |
| DATA-05 | DERIVED | DATA-REQ-01–DATA-REQ-03, FORM-REQ-07 | A captured photo remains associated with its draft after page refresh. | Before/after photo evidence and IndexedDB inspection |
| DATA-06 | QUALITY_PROPOSAL | Project Quality Proposal | Two or more drafts retain isolated identifiers, field values, and photos without cross-contamination. | Multi-draft behavior and IndexedDB inspection |

Storage schema, quotas, attachment limits, and exact debounce duration are not decided by this acceptance contract.
