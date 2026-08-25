# Contracts spec-v1 reconciliation — open items

> **Open items only.** Current as of 2026-08-24, re-checked against their head `5e252fbee` (`defi-wonderland/mast-social-recovery` PR #3, branch `design/spec-v1`: `spec/design.md`, `spec/invariants.yaml` I-1…I-19, `spec/open-questions.yaml`) and our head `688a89450`. The original 2026-08-21 review and the full re-check synthesis live in git history (`a40e7410e`, `688a89450`); the raw per-item evidence tables live in `social-recovery-contracts-spec-review-appendix.md`. Re-download their files with `gh api "repos/defi-wonderland/mast-social-recovery/contents/spec/design.md?ref=design/spec-v1" --jq '.content' | base64 -d` (quote the URL).
>
> Every item carries a stable **REC-nn** id — cite it in PR comments and commits. An item leaves this file when it is done (git history keeps the record).

**Settled context the items below rely on** — do not re-open these: they enforce **no timelock floor anywhere** (I-7: "The kit enforces no minimum"; R-16: "no floor anywhere"), so decision 85's Instant (0h) is buildable and the drawn 0h chip stands · the **wait lives inside the commitment** (I-16) and the `SetupCommitted` event does not carry it, so **nothing about a setup is chain-readable** at the private levels · their new **I-13** rejects any proof past its validity window at the door · guardian approvals bind an **eleven-field digest** whose hash field is `keccak256(setup_body)` with `setup_body = (rule, wait, adapter, repayment)` · the privacy dial is `backup = encrypt(password_key, config) | config | empty`, and their Q-6 accepts the cleartext path as "the accepted relaxation of the no-must-lose-secret requirement" · invariants renumbered (+1 above I-12: old I-13…I-18 are now I-14…I-19) · Q-3 and Q-10 are deleted (resolved) · E2/async approvals are closed on both sides (our decision 89, their I-9) · adapters and methods ship immutable (their Q-2, settled).

## 1 · Rulings Fibo owes — these block the items marked ⛔ below

| ID | Decision | Detail |
|---|---|---|
| **REC-1** | **Default privacy level + what the Recovery Card carries** | The dial is settled (decision 84 = their model); only the default posture is open, and their Q-6 explicitly waits on it. At the encrypted levels a lost password means no recovery at all, so decisions 56 ("a forgotten password never blocks recovery") and 48 ("skippable") cannot survive as written. Related divergence: our middle level "Hide the details — the shape stays readable (default)" has **no counterpart** in their three-way `encrypt \| config \| empty` — either they add a level (REC-24) or our default collapses to Hide-everything vs Public |
| **REC-2** | **Wait default: keep 48h or move to days** | The one number they still want from us. I-7 and their Q-4 both say the setup screens should default to "a safe span of days rather than hours"; the ceiling ask was deleted, so no ceiling exists anywhere |
| **REC-3** | **Tiering + presets** | Adopt their primary/secondary weighting or not; preset 2 (`passkey AND zkPassport`, both required) is their discouraged shape; and `design.md:319` now blesses **passkey-only rules as a first-class supported shape** — our preset grid and fragility copy penalise exactly that. Consider a passkey-only preset with the honest security story |
| **REC-4** | **Decision-79 contingency** | Their Q-7 states the consequence in their words: cutting AnonAadhaar leaves the method count short "with email unavailable to backfill", so "a replacement method or an explicit renegotiation of the count is owed". Decision 79 still says all four, non-negotiable |

## 2 · Doc fixes on this branch — mechanical, apply on Fibo's word

| ID | Fix | Where |
|---|---|---|
| **REC-5** | **Multichain header is backwards (safety error).** Recovery disarms the lost key only on the chain it ran on; the same address elsewhere is NOT "locked" — the lost key keeps full control there. Also relabel "(decided)" → deferred (their Q-15) | `ux-flows.md:9` |
| **REC-6** | **Flow G: editing during a pending recovery CANCELS it** (their state machine names edit and uninstall as first-class cancel edges). Replace "do not affect the pending request"; add "this will cancel the running recovery" to G-05's save and G-02's removal warning; name both side-effect routes on D2 | `ux-flows.md:408`, G-05, G-02 |
| **REC-7** | **Guardian approvals DO expire** — `valid_until` is a digest field and their I-13 fuzz-checks it. Invert decision 9's rationale, fix the E1 copy ("NO expiry shown — none is enforced"), add per-claim expiry UI (REC-28) | `ux-flows.md:322`, `:337`, decision 9 `:466` |
| **REC-8** | **Linkability line: reuse is invisible at rest only WITH per-account salts.** R-16's attack: under salt reuse, one account's recovery unmasks another's setup via `keccak256(B, R)`. Rewrite as conditional; move the warning from C-09 to the submission/approval moment | `ux-flows.md:159` |
| **REC-9** | **Instance uniqueness is our choice, not a contract rule** — their contract deliberately allows naming the same person twice (`design.md:113`). Move it to the wallet-side list in decision 81(a); amend decision 76 | `ux-flows.md:533`, `:538`; SDK `validatePath` note |
| **REC-10** | **SDK payload shapes.** `RecoveryIntent {account, newOwner, nonce}` → the eleven-field digest (incl. `purpose`, `valid_until`, `slot`, predicted `attempt_id`, `keccak256(setup_body)`, `keccak256(handover)` where handover = new_key + old_authority + install_path). Drop `satisfiedMethodIds` (an attempt is born satisfied). `PreparedTx` needs a plain third-party-call kind (proof verification cannot run in the 4337 validation phase); the `userop/sponsored` kind's sender is never the recovered account | SDK `:121`, `:129`, `:137`, `:144-145`, §5 item 6 |
| **REC-11** | **Four SDK duties their invariants now assign** (the `sdk` is a named module in their invariant vocabulary): per-account/per-credential **salt minting**, the **I-5 well-formedness gate** at setup, **backup emission that verifies the ciphertext decrypts to the committed setup**, and the frozen **setup-commitment preimage encoder** (SDK, contract and rebuild client all recompute it) | SDK doc, new section |
| **REC-12** | ⛔ REC-1 — **Retire/rewrite decisions 56 + 48's "skippable" + SDK §2.6 + D-06e** to match the ruled default; decision 84's text must stop implying the wait is public | `ux-flows.md:505`, `:513`, `:541`; SDK `:73` |
| **REC-13** | **Terminology + stale copy sweep**: "method manifest" → **"trust-root declaration"** wherever we quote them; C-07 trust-list says a declaration-less module carries "unknown outside parties" (their I-4 re-scope), not "unpinned code"; `:154` still lists an "enrolled email address" (stale vs decision 80); harden the dead-provider disclosure to **permanent lockout absent redundancy** (`design.md:315`) | `ux-flows.md:154`, C-07 copy, SDK quotes |
| **REC-14** | **SDK A2 "Anon Aadhaar works" → conditional.** Their Q-7 is blocking on the pinned-2021-certificate liveness failure; add the MVP contingency note (ties to REC-4) | SDK `:8`; Milestones `ux-flows.md:440-449` |

## 3 · Outbound to the contracts team — nothing has been sent yet

| ID | Send | Note |
|---|---|---|
| **REC-15** | The current `social-recovery-ux-flows.md` + `social-recovery-sdk-requirements.md` | Their spec still vendors our 35-decision snapshot; their Q-6 statement still claims "the UX flows never mint that password" — correct it |
| **REC-16** | **Ask: the attempt-opened event must carry the handover, the wait and the finalize deadline in the clear.** With the wait inside the commitment, D-13's countdown, the D2 banner, G-01's card and any watcher have **no chain source** at the private levels; their own R-16 defers exactly this | Blocks every timer surface we drew |
| **REC-17** | **Q-12 answer: the helper-publication disclosure copy** (submission puts each used credential's cleartext into calldata — an approving guardian's address is published permanently). Copy lands on E1, the D-07 manual row, C-05 enrollment, C-07 | Cheapest blocking question we can close |
| **REC-18** | **Q-8 answer**: rendering is ours; trust-root declarations, tier and method metadata must arrive as SDK **data**; plus the destination-key copy (REC-33). Hold the line on "a conformance requirement the SDK checks" — distinguish SDK checks on our inputs (fine) from SDK verdicts on the holder's rule quality (violates our A6). Note their side hardened: the `sdk` is now a bound module in I-5/I-16 | Their term is now "trust-root declaration" |
| **REC-19** | **The `slot` question**: within a clause, is `slot` the clause index or the credential index? (`design.md:172` is still ambiguous; old Q-10 died but this survives.) Hold the D-07 checklist copy until answered | One sentence |
| **REC-20** | **Q-19's premise is stale**: our A5 moved the demo to a bare-bones 4337 account (decision 80), not an Ambire fork — and the one adapter they owe is the Ambire fork's, with adapters now immutable (Q-2). Either they scope a generic 7579 adapter or we grow a Solidity deliverable | Scope conflict, escalate before interfaces freeze |
| **REC-21** | **Decision 51 as settled**: guardian page extension-built and extension-served over `buildApprovalPayload`/`parseApproval`. Their Q-8 edits moved the page to the integrator explicitly, so this should land without a fight | |
| **REC-22** | ⛔ REC-2 — the wait-default position, plus our zkPassport gas numbers (~0.93–1.0M per verification) for their Q-4 rule-width bound | The finalize deadline is still open on their side — if it lands, D-13 gains a second clock |
| **REC-23** | ⛔ REC-4 — the method-count position if Aadhaar is cut | |
| **REC-24** | ⛔ REC-1 — the middle-level question: our default "Hide the details" (shape readable, values hidden) has no counterpart in their `encrypt \| config \| empty`; ask them to add the level or re-scope our default | |

## 4 · Undrawn UX — states and content their contract implies, no screen on ours

| ID | Item | Suggested milestone |
|---|---|---|
| **REC-25** | ⛔ REC-1 — **two-state D-04/D-06 readout** (with-backup vs without), now covering the waiting period too; an explicit "we cannot show you the setup, but you can still try" Flow D entry; `getRecoveryConfig` cannot be a bare chain read | MVP (copy at least) |
| **REC-26** | **"A recovery is already running"** — chapter-1 band + a distinct submit-rejected cause (their I-10: one attempt per account, ever) | MVP |
| **REC-27** | **"Another recovery started — your approvals are void"** — the attempt id is client-predicted; an intervening attempt kills a whole gathering | MVP copy |
| **REC-28** | **Per-claim expiry countdown + expired-claim state** on D-07 rows + "ask again" action; `Claim` needs `expiresAt`. Collides with decision 70's "claims survive pauses and resumes" — a resumed recovery may hold dead claims | MVP |
| **REC-29** | **"Waiting period ended — cancelling may not land"** on the D2 banner | MVP copy |
| **REC-30** | **Counterproof cancel** (their I-8a): a CANCEL-purpose proof set cancels an attempt — a second gathering ceremony with a keyless entry point; `prepareCancel` is owner-only today | Copy MVP, flow V1 |
| **REC-31** | **Fresh-device account discovery** — nothing tells a recoverer their account address on a blank device; the Recovery Card is the only answer and REC-1 puts its contents in question | MVP |
| **REC-32** | **"Rule too large" builder state** — blocked on their Q-4 width/gas bound (feed them REC-22's numbers) | V1 |
| **REC-33** | **"What this removes" / destination-key rendering** on D-11, E1 and the D-07 manual row — their stated integrator obligation: "an integrator that renders a blind hash lets a phisher name their own key". Doubles as part of the Q-8 answer (REC-18) | MVP |
| **REC-34** | **Extra-door enumeration at setup** (their I-17) + the post-recovery terminal cannot claim the account is clean | V1 |
| **REC-35** | **The Q-8 disclosures: seven at setup + one on the approval screen** (single point of failure, shared failure, adopt-at-your-own-risk, identity demonstration, per-level reveal, backup trade, extra doors; destination key on approval). ~Five missing from C-07/C-07b/C-07e and the G-05 diff | MVP/V1 split |
| **REC-36** | **Repayment row** near C-06 + a line on C-07's trust list — now inside `setup_body`, so it is hashed into what guardians sign and must appear on the guardian payload surface too | V1 |
| **REC-37** | **Post-recovery re-salting** on the D-15 cleanup list (their recommendation after every recovery) | V2 with D-15 |
| **REC-38** | **Pull the dry-run password-recall row alone into MVP** — the MVP can save an unrecoverable configuration; the full dry run stays V1 | Decide |
| **REC-39** | **Single-key ending**: recovery ends on one fresh key with no redundancy (their Q-14, blocking + irreversible). Prefer a guided "set up recovery again" follow-on over an atomic contract feature — tell them so | V1 |
| **REC-40** | **Migrate-assets state** for the existing-account route (decision 88 / their "fresh smart account with assets migrated across") | V1 |
| **REC-41** | **Watcher reality**: the kit ships NO reference watcher ("built by the integrator rather than the kit") — extension item 6 owns the whole event-reader; and with no floor under the wait, the MVP alerting honesty line is load-bearing (their Q-13: a short-wait user "rests entirely on whatever alerting the integrator provides") | MVP honesty line; watcher scope in extension doc |
