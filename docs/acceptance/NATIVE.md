# Native Android Acceptance

Design status: **Owner decisions applied — candidate for Gate B freeze**

Execution status: **NOT TESTED**

| ID | Class | Trace | PASS conditions | Required evidence |
|---|---|---|---|---|
| NATIVE-01 | DIRECT | NATIVE-REQ-01, NATIVE-REQ-04 | The Android project builds successfully with the later-approved toolchain. | Build command, tool versions, and successful log |
| NATIVE-02 | DIRECT | NATIVE-REQ-01, NATIVE-REQ-04 | The generated APK installs and the application launches on an approved Android target. | APK identity, install log, target details, and launch capture |
| NATIVE-03 | DIRECT | NATIVE-REQ-02 | An authorized camera action invokes `@capacitor/camera` and opens the native camera flow. | Device capture, plugin/runtime details, and permission state |
| NATIVE-04 | DIRECT | FORM-REQ-07, NATIVE-REQ-02 | A photo captured through `@capacitor/camera` returns to the application and is attached to the current inspection data. | Device capture and returned-photo/form evidence |
| NATIVE-05 | DIRECT | NATIVE-REQ-03 | `@capacitor/network` reports a transition to offline in the approved native runtime. | Network transition trace and target details |
| NATIVE-06 | DIRECT | NATIVE-REQ-03, SYNC-REQ-04 | `@capacitor/network` reports reconnection and queued surveys receive a retry attempt. | Reconnection and retry-attempt trace |
| NATIVE-07 | QUALITY_PROPOSAL | Project Quality Proposal | When platform persistent storage remains available, pending draft/submission data survives a full native application restart. | Before/after restart capture, platform storage conditions, and IndexedDB inspection |

Android minimum version, device matrix, permission UX, native tooling, and APK distribution procedure remain undecided.
