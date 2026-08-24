# Contracts spec-v1 — reconciliation against our UX and SDK docs

> **Report only — no spec of ours has been changed.** Reviewed 2026-08-21 against `defi-wonderland/mast-social-recovery` PR #3 "feat: design baseline, spec-v1 idea checkpoint" (branch `design/spec-v1`, updated 2026-08-20 22:47Z): `spec/design.md` (322 lines), `spec/invariants.yaml` (I-1…I-18), `spec/open-questions.yaml` (Q-2…Q-19), plus their `design-context/` notes.
>
> Our side: `social-recovery-ux-flows.md` (flows A–G, decisions 1–83, Milestones), `social-recovery-sdk-requirements.md` v5, `social-recovery-extension-work.md` v3. Investigated by four parallel Opus 5 fronts; the long-form per-front reports are in the session scratchpad (`report-A-model.md`, `report-B-sdk.md`, `report-C-questions.md`, `report-D-methods.md`).

## 0 · Read this first — they are working from a two-week-old copy of us

Their PR vendors our flows at `.harness/kickoff/prior/design/ux-flows.md`: 573 lines, **35 decisions**, no single-path model. Our live doc carries **83**. Decisions 36–83 are invisible to their spec, and several of them settle questions their spec marks as *blocking irreversible surface*:

| Ours, invisible to them | What it settles on their side |
|---|---|
| **73** — ONE recovery path per account (2026-08-18) | **Q-3**, blocking: "the companion UX flows still model OR-ed paths, so the single-rule shape needs one final confirmation" |
| **48/56 + 79** — recovery password is an explicit MVP wizard step (C-06e) | **Q-6**, blocking: "the UX flows never mint that password at setup" — premise stale, though the deeper problem is real (§3.1) |
| **74** — 24h contract floor, 48h UI default | **Q-4**: we agree on the floor; they challenge the default |
| **80** — zkPassport replaces ZK Email | their method set |
| **81** — grading is wallet-side; an existing EOA may be the 4337 signer | **Q-8**, **Q-19** |
| **83** — passkey health check is a user-gesture test | — |

**Action 0, today, before anything else in this report: send them the current `social-recovery-ux-flows.md` and `social-recovery-sdk-requirements.md`.** Answering Q-3 alone unblocks irreversible surface for them, and it costs one sentence.

## 1 · What their spec answers for us

| Our pending item | Their answer | Where | Verdict |
|---|---|---|---|
| **Q29 / decision 53 — value visibility, MVP-blocking** | A per-holder **privacy dial, private by default**. Storage holds only a salted commitment plus the wait in the clear; any reveal rides the setup event: `backup = encrypt(password_key, config) \| config \| empty` | I-15; design.md:273–295 | **Answered — and it breaks two of our decisions.** See §3.1 and §3.2 |
| **M10 — two pending recoveries?** | **Exactly one attempt per account, ever** | I-10; design.md:115,126 | Answered. Needs a new screen (§4) |
| **Decision 74 — where the 24h floor is enforced** | At the **setup write**: the wait sits in the clear beside the commitment so the contract checks it there | I-7; design.md:111 | Answered. Revert surface is C-07's save, already covered by the C-07b anatomy |
| **Q19 — who executes after the timelock** | Recovery installs as a 7579 **executor**; finalize is **permissionless** — "anyone presses finalize" | design.md:188,246; I-17 | Answered. Closes the `executor: OPEN` node in Flow D chapter 3 |
| **Q7 — who pays** | Partial: a holder may configure a **bounded repayment inside the setup commitment**, so the helpers approve it, or leave it off and self-relay | design.md:250; I-17 | Partial answer + an undrawn wizard field (§4) |
| **Q16 — ZK Email** | Dropped independently: "An email proof was weighed for this set and dropped, its available construction working poorly and unsupported" | design.md:64,299 | Confirms our decision 80. Our "Ace 0x / Q16 remainder" pending item can be closed |
| **Q20 — config survival + `onUninstall` nonce reset** | Uninstalling the module "never rewinds" the setup; uninstall cancels any active attempt | design.md:144,134 | Answered — and it **validates decision 46**: lost-device methods stay live after recovery |
| **T10 — group encoding with thresholds** | `rule = AND(clause…)`, `clause = ANY_N_OF(n, [cred…])`, with a worked mixed example | design.md:93–108; I-5 | Answered — confirms decisions 41/73/75. A required row is `ANY_N_OF(1,[c])` |
| **Decision 81(a) — grading is wallet-side** | "the SDK's setup check is the gate … a client-side check the contract never sees"; the disclosure invariant is `check: human-only` | I-5; I-14 | Same split as ours. One collision — their Q-8 floats an SDK-checked conformance (§5) |
| **Guardian payload contents** | Fully specified, eleven fields | design.md:142–171 | Answered — and it **breaks decision 9** (§3.3) |

## 2 · Inconsistencies that break our documents — ranked

Every row is **ours to fix** unless marked otherwise. The three marked → §3 need a product decision first; the rest are corrections.

| # | Our text today | Their spec | Fix |
|---|---|---|---|
| 1 | `ux-flows.md:179` "the policy **structure** is readable on-chain"; Flow D ch.1 renders the path before any proof | Storage reveals "no identity, method, clause structure or threshold" (I-15) | → **§3.2**. Rewrite the config-visibility note to the commit-reveal model; make the D-04/D-06 readout two-state |
| 2 | Decision 56 "a forgotten password never blocks recovery — it only keeps values hidden"; SDK §2.6 "degrades to hidden values, never an error" | Without the backup a fresh device "cannot even begin a recovery" (design.md:293) | → **§3.1**. Retire or re-scope 56 |
| 3 | Decision 9 + E1 "**NO expiry shown — none is enforced**" (`:320`, `:335`) | `valid_until` is a digest field and is checked at submission (design.md:164, :120) | → **§3.3**. Invert the rationale; add expiry UI |
| 4 | Flow G "Config changes are allowed while a recovery is pending and **do not affect the pending request**" (`:404`) | "Editing the setup during the wait **cancels the running attempt in the same act**" (design.md:134; I-12) | Replace the sentence; add the consequence to the G-05 diff and the G-02 warning. **G-05's save is a cancel button in disguise** |
| 5 | Header: "Multichain out of scope (**decided**) … the same address on other chains **stays locked**" (`:9`) | Recovery disarms the lost key "only on the chain it ran on"; their reviewer calls ours "backwards, the lost key keeps full control there" | **Factual safety error — fix today.** Also relabel "decided" → deferred (their Q-15) |
| 6 | `:154` "Passkey and guardian reuse across accounts is **observable on-chain**… show a linkability warning" (drives C-09) | The commitment closes over the account, so reuse is **invisible at rest**; the real linkability moment is the recovery submission | Rewrite `:154`; move the warning from C-09 to the submission/approval moment |
| 7 | Decision 81(a) files instance uniqueness under "contract rules, not opinions" | "A rule **may** name the same person more than once, which the setup screen shows plainly **rather than the contract forbidding**" (design.md:111) | Move instance uniqueness to the wallet-side list in 81(a); amend decision 76 to say the block is our choice |
| 8 | Flow E2 is "FUTURE", blocked by missing plumbing / "R5 conflict" | I-9: "Proofs are **never** accepted or stored one at a time" — incremental submission is the explicitly rejected alternative (Q-9) | Re-label E2 as incompatible with the one-act invariant. **If we want async approvals, say so into Q-9 before the EF confirms** — that window is open |
| 9 | SDK `PendingRecovery.satisfiedMethodIds`; D2-01/B-03 name who is recovering | An attempt is born satisfied (I-9), so the field is always "all"; the attempt commits `keccak256(handover)`, so `newOwner` may not be readable | Drop the field; ask them to guarantee an `AttemptOpened` event carrying the handover in the clear, or D2-01 has nothing to name |
| 10 | SDK A5 "recovery validated by the account/module, the submission rides as a UserOperation"; extension item 3 wires a paymaster | "Proof verification cannot run in the validation phase, so the submission is a plain call or a call inside some funded party's own operation" | Rewrite A5's second clause. A sponsored op's sender is **a third party's account**, never the recovered one — item 3 currently targets the wrong sender |
| 11 | SDK `RecoveryIntent { account, newOwner, nonce }` | An eleven-field binding digest, with `handover = (new_key, old_authority, install_path)` | → **§3.3**. Replace the intent shape; `newOwner` alone lets the submitter choose what gets removed |
| 12 | SDK A2 "**Anon Aadhaar works** … not a UX constraint" | Q-7 is **blocking**: pinned 2021 certificate rejects QR codes under the rotated key, fix unmerged — "a liveness failure for exactly the legitimate user a recovery method serves" | Rewrite A2 as conditional; add an MVP contingency to the Milestones section |
| 13 | Decision 79: all four methods are MVP, non-negotiable, as peers | Wallet and passkey are **primary**; the identity pair is **secondary**, "not meant to carry a rule on their own", and a secondary credential "comes with a raised threshold" | Preset 2 (`passkey AND zkPassport`, both required) violates their guidance. Decide whether we adopt the tier model — under decision 81(a) the weighting rule is **ours** to write |
| 14 | `:149` the card excludes thresholds **and waiting-period values** | The wait is "the one field of a setup the chain always shows" | Put the waiting period on the card and the chapter-1 readout; hiding a public value buys nothing |

## 3 · The three that need a product decision from Fibo

### 3.1 The recovery password stops being optional — decision 56 cannot survive

**Theirs.** The chain stores a commitment only. The readable configuration "lives with the holder and their backup" (design.md:198), and without that backup a fresh device "cannot even begin a recovery" (design.md:293). Their own read of our flows says the Recovery Card "as specified cannot start a recovery" (ux-flows-discrepancies.md:26).

**Ours.** Decisions 48/56, restated in SDK §2.6: the password is *skippable*, it only hides values, and "a wrong password never blocks recovery" — a failed decrypt "degrades to hidden values, never to an error that stops the flow".

**Why it breaks.** At their encrypted privacy level, no password means no rule, no salts, no cleartext method configs — so no submission is possible at all. The promise is not merely optimistic, it is unimplementable. Our own premise that the card is a deliberate non-map (decision 43 family) also shifts: the card becomes the fresh-device artefact.

**The decision.** One of:
- **(a) Ship the MVP at the cleartext privacy level.** The configuration rides the setup event in the clear; no password is required to recover; decision 56 survives verbatim; we accept that guardians and method identities are publicly readable, which contradicts our guardian-privacy posture.
- **(b) Keep the encrypted level and retire decision 56.** Step 6 stops being skippable, C-06e gains "lose this and you lose the ability to recover", D-06e's "you can still recover — the values stay hidden" becomes false and must be rewritten, and the Recovery Card must carry (or point at) the backup.
- **(c) Offer the dial to the user** — their design supports it — and accept two setup paths plus two recovery-entry paths in the UX.

My recommendation: **(b) for the product, (a) for the demo**, because the demo's job is to show the flow end to end without a lost-password dead end. Either way this is MVP-blocking, exactly as decision 79 already flags Q29/53.

### 3.2 "Structure is readable on-chain" is false — Flow D's entry premise changes

**Theirs.** I-15: storage "only ever holds the salted commitment beside the wait in the clear … revealing no identity, method, clause structure or threshold". The contract "learns the rule only when a request reveals it at recovery" (design.md:273–275).

**Ours.** `social-recovery-ux-flows.md:179`: "the policy **structure** is readable on-chain ('passkey + zk_email')" — with value visibility the only open part. Flow D chapter 1 shows the path on D-04 before any proof is collected, and `getRecoveryConfig` in SDK §2.2 assumes a chain read.

**Why it breaks.** Nothing is readable. Every screen that renders the configuration back — D-04's identity card summary, D-06's path readout, G-01's management card, the G-05 editor — needs a locally held or password-decrypted copy. On a fresh device with no backup, those screens have nothing to draw.

**The decision.** Whether D-04/D-06 keep showing the path at all in the no-backup case, or whether Flow D gains an explicit "we cannot show you the setup, but you can still try" entry. This interacts with 3.1: choosing the cleartext level makes the problem disappear.

### 3.3 Guardian approvals expire, and the payload is eleven fields — decision 9 is wrong

**Theirs.** The digest is `chain_id, account, recovery_contract, version, setup_nonce, keccak256(rule), attempt_id, purpose, valid_until, slot, keccak256(handover)` (design.md:142–171). `valid_until` is enforced, `purpose` separates approve from cancel, `slot` pins which position in which clause the signature fills, and `attempt_id` is **predicted by the client**, not read from chain (design.md:146).

**Ours.** Decision 9 and the E1 copy: "A guardian signature has **no expiry** — it dies only when its nonce is consumed or the request is cancelled. Never display a time limit the contract does not enforce" (ux-flows.md:335), and the E1 page shows "recovery nonce (read on-chain)" with "NO expiry shown — none is enforced" (ux-flows.md:320).

**Why it breaks.** Three separate errors: expiry *is* enforced; there are *two* nonces (setup nonce and attempt id), not one; and the attempt id is a prediction that an intervening attempt can invalidate. Our SDK `RecoveryIntent { account, newOwner, nonce }` carries three of eleven inputs, so any claim built from it fails verification. `newOwner` alone is also unsafe — the handover commits `(new_key, old_authority, install_path)`, and leaving the rest to the submitter is precisely the attack the field exists to prevent (design.md:148).

**The decision.** Mostly mechanical — rewrite decision 9, the E1 payload copy, and the SDK intent shape. The genuine product question: **what does a guardian see about the expiry**, and what does the recoverer see when an approval expires mid-gathering? That is a new state on the D-07 row and on the guardian page.


## 4 · Frictions — UX we have not drawn

Capabilities and constraints that exist on their side with no screen on ours. None of these is a contradiction; all are missing work.

**New flows**
- **Counterproof cancel (I-8a).** A full proof set signed under a CANCEL purpose cancels an attempt — "what protects a holder whose key is already gone". That is a second gathering ceremony: a cancel-side checklist mirroring D-07, a cancel variant of E1 and of the MVP manual row, and a keyless entry point. Flow D2 draws owner-signed cancel only. *Suggest: MVP states it in copy; the flow ships V1.*
- **Fresh-device account discovery.** Their watcher rebuilds a setup from the event stream; Q-8 lists "the fresh device's account discovery" as unbuilt. Nothing in Flow D tells a recoverer their account address on a blank device — today the Recovery Card is the only answer, and §3.1 puts that card in question.

**New states on existing screens**
- **"A recovery is already running"** (I-10, one attempt per account) — a chapter-1 band plus a distinct submit-rejected cause, separate from the generic retry.
- **"Another recovery started — your approvals are void"** — the attempt id is *predicted*; an intervening attempt kills a whole gathering at once.
- **Per-claim expiry countdown + an expired-claim state** on the D-07 rows, plus an "approval expired, ask again" action. This collides with decision 70's "claims survive pauses and resumes": a resumed recovery may hold dead claims.
- **"Waiting period ended — cancelling may not land"** on the D2 banner: whoever wants finalization sends it in the first block after the wait, and the owner does not control ordering.
- **"This will cancel the running recovery"** on G-05's save, and "this also cancels any recovery currently running" on G-02's removal warning.
- **A "rule too large" state** in the builder — Q-4 owes a maximum rule width and per-method gas bound; zkPassport alone measures ~0.93–1.0M gas, so two of them approach 2M in one submission.

**New content on existing screens**
- **"What this removes."** The handover commits `(new_key, old_authority, install_path)`. Our D-11 confirmation and both guardian payload surfaces show what is *gained*, never what is *removed* — which is exactly the substitution the field exists to prevent.
- **Helper publication disclosure.** Submission puts each used credential's cleartext into calldata, publishing an approving guardian's address permanently — "landing on third parties who never consented". Needs a line on E1, on the MVP D-07 manual block, at C-05 guardian enrollment, and on C-07.
- **Extra-door enumeration at setup.** I-16 leaves authorities outside the recovery contract to the holder to enumerate, and their setup screen asks for it. We have never drawn it, and it also means the post-recovery terminal cannot claim the account is clean.
- **The seven setup disclosures of Q-8** — single point of failure, shared failure, adopt-at-your-own-risk, identity demonstration, each privacy level's reveal, the backup trade, extra doors. Roughly five are missing from C-07/C-07b/C-07e and the G-05 diff.
- **The waiting period on the Recovery Card** (it is public anyway).
- **A repayment row** near C-06 and a line on C-07's trust list for the adapter — both are setup-time commitments the helpers approve.
- **Post-recovery re-salting.** They recommend reconfiguring with fresh salts after every recovery; that belongs on the D-15 cleanup list.

**Two structural gaps worth naming**
- **The MVP can save an unrecoverable configuration.** Nothing checks the rule at setup — our `validatePath` is the only gate — yet the dry run (decision 47) ships V1 while the password and hidden values ship MVP. Consider pulling the dry run's password-recall row alone into the MVP.
- **Recovery ends on a single fresh key with no redundancy** — "the state the recovery just repaired" (their Q-14). We never route back into setup. A guided "set up recovery again" follow-on is the cheap answer; they are deciding now whether the contract seeds it atomically, which would change D-15's shape.

## 5 · What they need from us — ranked

| # | Their question | Our position | Action |
|---|---|---|---|
| 1 | **Q-3** single-rule shape, *blocking, irreversible* — "the companion UX flows still model OR-ed paths" | **Already answered: decision 73, 2026-08-18.** Our shape is theirs exactly: required rows are `ANY_N_OF(1,[x])`, groups are clauses, all ANDed | **Send today.** One sentence unblocks irreversible surface. Include decisions 73/74/75/76/82 with dates |
| 2 | **Q-6** backup/password posture, *blocking* | Their premise is stale (decision 48 does mint a password) but the deeper problem is real — see §3.1 | Needs Fibo's ruling first, then reply with the privacy-level default and what the card carries |
| 3 | **Q-4** wait default, ceiling, finalize deadline, rule width | Floor agreed (decision 74). Default 48h — they argue 3–7 days. **No position on a ceiling; they say the number is ours to give** | Reply with a ceiling (30 days is defensible), a position on the default, and hand them our zkPassport gas numbers for the width bound |
| 4 | **Q-8** who carries the disclosures, *blocking* | Decision 81(a) answers half: rendering is ours | Reply: rendering ours, but manifests, trust roots and tier must arrive as SDK **data**. Reject an SDK verdict or rendering-conformance check — that re-enters A6 |
| 5 | **Q-12** helper identity published in calldata, *blocking* | **No position.** Decision 43 is about names, not this | Cheapest close available: write the disclosure copy for E1 + the D-07 manual row and send it as our answer |
| 6 | **Q-14** helper consent, resignation, single-key handover, *blocking, irreversible* | Consent is decision 52. The single-key ending is a real hole | Reply: prefer a guided "set up recovery again" follow-on over an atomic contract feature; keep resignation out of MVP but not encoded shut |
| 7 | **Q-7** secondary-method weight, *blocking* | Decision 4 badges Aadhaar — copy only, which they call out | Under 81(a) the weighting rule is **ours**. Define it, and decide preset 2 (§3 / row 13) |
| 8 | **Q-13** alerting | Our MVP is a polling banner on one device — the very device whose loss is the scenario | Write the MVP honesty line; scope out-of-band channel enrollment into V1 |
| 9 | **Q-5** who pays | Mutual and unresolved; they defer it past the showcase | Accept self-pay as the only MVP-countable rail; keep the keyless-user gap visible |
| 10 | **Q-19** Ambire executor authority | **Their premise is stale** — A5 moved the demo to a bare-bones 4337 account | Tell them, and settle §6 row 1 |
| 11 | **Q-15** multichain | Settled their side | We owe a copy fix — §2 row 5 |
| 12 | **Q-10** `slot` semantics | Under decision 76 (unique instances) the slot is derivable | Ask one question: within a clause, is `slot` the clause index or the credential index? Hold the checklist copy until answered |

## 6 · Scope conflicts to escalate before their interfaces freeze

1. **No adapter is scoped for our account.** They owe "the Ambire fork the demo integrates being the one adapter this engagement owes", and Q-19 still assumes an Ambire-fork account. Our A5 chose a bare-bones 4337 account on 2026-08-20. Either they scope a generic 7579 adapter or extension item 1 grows an unplanned Solidity deliverable plus a setup-time adapter-commitment step.
2. **Guardian page ownership.** Decision 51 makes the page extension-built and extension-served over two SDK calls. Their design has "the SDK defining the gathering flow and its formats as code running on the participants' own devices". Send decision 51 as settled.
3. **SDK conformance vs decision 81(a).** Q-8's resolution floats "stating the integrator obligation as a conformance requirement the SDK checks", and Q-7 asks "whether the SDK warns on a rule whose clause rests on secondary credentials alone". Both put a safety verdict back inside the SDK. Hold the line: advisory metadata, never a verdict.
4. **"All four methods, MVP, non-negotiable" is at risk from both ends.** Aadhaar's shippability is a blocking question on their side (pinned 2021 certificate rejecting current QR codes); zkPassport is secondary in their tiering, needs a closed-source bridge and cloud prover that breaks the backend-zero premise, costs ~1M gas per verification, and our own research recommends V1. Decision 79 needs a contingency.

## 6b · Post-review drift — decisions 84–89 (2026-08-24)

Our docs advanced to SDK v7 while this review was being written. Cross-checking the new decisions against their spec:

| Ours | Their spec | Verdict |
|---|---|---|
| **85 — timelock floor removed**: "No contract-enforced minimum waiting period. The picker allows **Instant (0h)**… Supersedes #74's floor" | **I-7**: "At least 24 hours always pass between the acceptance of a complete proof set and the rotation it approves… the contract enforces the floor at the moment the setup is written"; EF-confirmed (ef-call-outcomes:39) | **NEW LIVE CONFLICT — highest priority.** If their contract enforces 24h at the setup write, every save below 24h **reverts**. An "Instant (0h)" option would be an unsaveable choice, and the warning copy would be describing a state the chain refuses to store. Either they drop I-7 or decision 85 is unbuildable. Reconcile before either side freezes |
| **84 — commit-reveal visibility answered** | I-15, design.md:273–295 | Converges with §3.2 — check the two are the same model |
| **86 — fragility grading → V2** | Q-7/Q-8 still ask the SDK to warn | Strengthens our A6 line; the §6 row-3 conflict stands |
| **87 — user-funded MVP + gas-deposit screens** | Q-5: no named payer for the demo | Converges with §1's funding row; their repayment knob (design.md:250) may reduce the deposit burden — worth checking |
| **88 — smart account at initialization** | design.md:229–235: "does not convert in place… a fresh smart account with assets migrated across" | Compatible; the migrate-assets state is still undrawn |
| **89 — async approvals (E2) skipped** | I-9 forbids incremental submission | **Resolves finding A16.** Our reason and theirs now agree; no need to contest Q-9 |

## 7 · Suggested actions, in order

**Today, costs nothing:**
0. **Reconcile decision 85 against their I-7** (§6b) — an "Instant (0h)" picker option cannot be saved against a contract that enforces a 24h floor at the write. One of the two has to move, and both are recent.
1. Send them our current `social-recovery-ux-flows.md` + `social-recovery-sdk-requirements.md`, and answer **Q-3** explicitly with decision 73. It is blocking irreversible surface on a disagreement that no longer exists.
2. Fix the four factual errors in our doc — the multichain header (§2 row 5), the pending-edit note (row 4), the expiry claim (row 3), and the linkability line (row 6). These are wrong today regardless of any decision.

**This week, needs Fibo:**
3. Rule §3.1 (privacy level and the fate of decision 56), then §3.2 and §3.3 follow from it.
4. Answer Q-12 with disclosure copy — the cheapest blocking question we can close for them.
5. Decide the tier question: adopt their primary/secondary weighting, and rework preset 2 if so.
6. Reply to Q-4 with a wait ceiling and a position on the 48h default.

**Before their interfaces freeze:**
7. Escalate the four scope conflicts in §6.
8. Ask the `slot` question (§5 row 12) — the checklist copy and the D-07 payload spec depend on it.
9. If we want async guardian approvals for UX reasons, contest **Q-9 now** — I-9 rules incremental submission out, and the EF has not confirmed yet.

**Do not act on yet:**
10. The zkPassport and Aadhaar screen redraws stay queued — their mechanics are TBD on both sides, and Aadhaar may not ship at all.

## 6 · Scope conflicts to escalate

## 7 · Suggested actions
