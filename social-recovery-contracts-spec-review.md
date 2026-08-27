# Contracts spec-v1 reconciliation — open items

> **Open items only.** Fibo ruled on all 41 REC items (2026-08-25, two rounds); everything approved is applied as spec decisions 90–98, SDK doc v9, extension doc v5, and `social-recovery-kit-asks.md` v2 (git history has the full trail; raw evidence in `social-recovery-contracts-spec-review-appendix.md`). Their PR: `defi-wonderland/mast-social-recovery` #3, branch `design/spec-v1`, head `5e252fbee`. An item leaves this file when it is done.

| ID | Item | Status |
|---|---|---|
| **REC-15** | Send the current docs (`social-recovery-ux-flows.md`, `social-recovery-sdk-requirements.md`, `social-recovery-kit-asks.md`) to the contracts team; correct their stale Q-6 premise ("the UX flows never mint that password") in the same message | **Fibo sends this himself** |
| **REC-16** | The attempt-opened event must carry the handover, the wait, and the finalize deadline in the clear | Ready in the kit-asks file; rides with REC-15 |
| **REC-19** | The `slot` index-scheme question (clause index vs credential index); the D-07 checklist copy holds until answered | Ready in the kit-asks file; rides with REC-15 |
| **REC-24** | The kit must support the "Hide the details" shape (structure public, values encrypted) — we now ASSUME it exists (decision 97 / SDK A7) | Ready in the kit-asks file; rides with REC-15. If the kit says no, decision 97 and the default level reopen |
| **REC-20** | The 7579 adapter is a kit-team deliverable; their Q-19 premise is stale | Recorded (SDK v8+/extension v5); communicated with REC-15 |
| **REC-32** | The "rule too large" builder state | Blocked on their Q-4 max rule width / per-method gas bound (our zkPassport numbers ride with REC-15) |
| **REC-41** | Watcher: no kit-shipped reference; the extension owns the event-reader; the MVP alerting honesty line is load-bearing with no floor under the wait | **Kept open per Fibo**; the chain-source half is the REC-16 ask |
