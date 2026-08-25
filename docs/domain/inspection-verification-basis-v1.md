# Inspection verification basis V1

Residual verification preserves the current DEMO_5X5 calculation and requires one finite basis:

- `RECORDED_EVIDENCE`: at least one pending action has recorded evidence;
- `FIELD_OBSERVATION`: a 10–1000 character professional note;
- `OTHER_JUSTIFIED`: a 10–1000 character professional note.

The action stores basis, note, verifier and time. If the verifier is also the assignee, it stores
self-verification metadata. HIGH/CRITICAL initial risk additionally requires explicit acknowledgement.
No file is universally required, and evidence alone never implies verification.

Initial and residual results remain distinct and use the same historical method identity/version.
