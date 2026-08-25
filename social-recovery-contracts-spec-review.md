# Contracts spec-v1 reconciliation — open items

> **Open items only.** Fibo ruled on all 41 REC items on 2026-08-25; the approved fixes are APPLIED as spec decisions 90–96, SDK doc v8, extension doc v5, and the new `social-recovery-kit-asks.md` (see git history for the full trail; raw evidence stays in `social-recovery-contracts-spec-review-appendix.md`). Their PR: `defi-wonderland/mast-social-recovery` #3, branch `design/spec-v1`, head `5e252fbee`. An item leaves this file when it is done.
>
> Applied and gone from this file: REC-2 (48h stays), REC-3/4 (decision 94), REC-5…13 (decisions 90–93 + corrections), REC-14 (no change — A2 stands), REC-17 (disclosure copy in the spec), REC-21…23 (positions in the kit-asks file), REC-26…31, REC-33, REC-34, REC-36…40 (decision 96 states, milestone-tagged).

## 1 · Awaiting Fibo — clarifications answered, the call is open

| ID | The call | Status |
|---|---|---|
| **REC-1** (residual) | **The level mapping.** Their `config` shape publishes the FULL config in cleartext = our "Public". Our default "Hide the details" (structure visible, values hidden) has NO counterpart in their model. Option 1 (recommended): ask them for a fourth shape — structure in the clear, values encrypted (drafted as REC-24 in the kit-asks file); default stays "Hide the details". Option 2: drop the middle level — the dial becomes Hide-everything vs Public. | The card ruling is applied (decision 90: card carries the password; step required at hidden levels). Only the mapping is open |
| **REC-18** | **The Q-8 ownership answer**: SDK supplies facts (trust-root declarations, tiers, metadata); the wallet renders and judges; we reject an SDK conformance check or verdict (A6). Ready to send with the destination-key copy as proof of intent. | Awaiting go |
| **REC-19** | **The `slot` question**: when Ana signs in `AND( ANY_2_OF(Ana, Ben, Carla), ANY_1_OF(passkey) )`, is her slot "clause 1" or "clause 1, credential 1"? One question to the kit team; the D-07 checklist copy and the payload spec hold until answered. | Awaiting go |
| **REC-35** | **The seven Q-8 setup disclosures** — which we adopt, at what milestone. Suggested: #4 identity≠presence, #5 per-level reveal, #6 the backup trade → MVP copy; #1 single point of failure, #2 shared failure, #3 adopt-at-your-own-risk, #7 extra doors → V1 with the grading work. (We show parts of 1–2 today; the eighth — destination key on approval — is already approved as REC-33 and applied.) | Awaiting ruling |

## 2 · With Fibo / outbound

| ID | Item | Status |
|---|---|---|
| **REC-15** | Send the current `social-recovery-ux-flows.md` + `social-recovery-sdk-requirements.md` (+ the kit-asks file) to the contracts team; their Q-6 statement still carries the stale "the UX flows never mint that password" premise — correct it in the same message | **Fibo sends this himself** |
| **REC-16** | The attempt-opened event must carry the handover, the wait, and the finalize deadline in the clear — every timer surface depends on it | Ask drafted in `social-recovery-kit-asks.md`, ready |
| **REC-20** | The 7579 adapter is a **kit-team deliverable** (ruled 2026-08-25) — recorded in SDK v8 + extension v5; their stale Q-19 premise gets corrected in the same send | In the kit-asks file, rides with REC-15 |
| **REC-24** | The fourth privacy shape (structure public, values encrypted) | Drafted, held on REC-1 |

## 3 · Blocked or deliberately open

| ID | Item | Blocked on |
|---|---|---|
| **REC-25** | The two-state D-04/D-06 readout (with-password vs values-hidden). Narrowed: all three of OUR levels publish a backup on the event, so the true no-backup case only exists at their `empty` shape, which we do not expose — the remaining work is the values-hidden rendering state | REC-1's mapping call |
| **REC-32** | The "rule too large" builder state | Their Q-4 still owes the max rule width and per-method gas bound (our zkPassport numbers ride with REC-15) |
| **REC-41** | Watcher reality: no kit-shipped reference watcher; the extension owns the event-reader; the MVP alerting honesty line is load-bearing with no floor under the wait | **Kept open per Fibo (2026-08-25)**; the chain-source half is covered by the REC-16 ask |
