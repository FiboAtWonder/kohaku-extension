# Kohaku SDK — Account-recovery requirements

> **Status: v10.** What the extension needs from the SDK, assuming it works; the SDK is stateless — all state lives in the extension; extension-side work: `social-recovery-extension-work.md`; milestone tags per decision 79. Version history: `social-recovery-ux-status.md`.

## 1 · Working assumptions

- **A1 — Method set (decision 80):** passkey, guardians, Anon Aadhaar, **zkPassport**. ZK Email is out; zkPassport replaces it. All four ship in the MVP (79). zkPassport's concrete mechanics (inputs, proof budget, verifier, nullifier semantics) get a research pass before its wireframes are drawn; until then §2.3 carries the lifecycle contract with TBD specifics.
- **A2 — Anon Aadhaar works.** The SDK exposes the full lifecycle in §2.3; upstream library health is the kit team's to solve, not a UX constraint.
- **A3 — The consumer never needs to know how the contracts work.** The SDK fully abstracts the on-chain implementation: path encoding (required rows + M-of-N groups), the recovery binding hash and cancel semantics are internal. The extension sees the path model and prepared transactions — never a preimage, an ABI struct, or a contract address.
- **A4 — Division of labor.** The SDK **prepares** (transactions/userops, payloads, proofs, derived data) and computes (validation, progress math); the extension **signs, broadcasts, stores, and renders**. Every long-running SDK operation is async with progress callbacks and cancellation. The SDK holds no session state.
- **A4b — Proving is the SDK's job, behind one method.** The SDK ships the prover — circuits, artifacts, witness generation, verification — and exposes it as a single call (`createClaim`). The extension never implements proving; the work runs inside the extension only because that is where the SDK is loaded. All the extension decides is which JavaScript context hosts the call (see the constraints section).
- **A5 — Account substrate + funding (decisions 87/88; adapter scope per REC-20):** a **bare-bones 4337 implementation**; recovery is authorized by the account/module, but the proof verification **cannot run in the 4337 validation phase** — a recovery submission is a plain call (or a call nested inside some already-funded party's own operation), never a validation-time check on the recovered account. The **7579 recovery adapter that binds our bare-bones account to the kit's module is a KIT-TEAM deliverable**: their Q-19 assumed an Ambire fork, adapters ship immutable (their Q-2), and **the extension ships no Solidity** — routed to them as REC-20. The account does not have to be freshly created — an existing EOA can be set as its signer. The **standard create flow must deploy the smart account at initialization**, while the recovery fast-track creates only an EOA that becomes the recovered account's signer (88, amended in review). Funding (87): **the MVP is user-funded** — gas-deposit screens at onboarding (A1-04) and before submitting (D-09), auto-skipped when the account holds enough. The kit provides **contract-side support, not a paymaster**: `execute` reimburses `msg.sender` directly (no batched sponsored UserOps on the executor flow — mechanic flagged as may-change). Paymaster sponsorship is **V1**; who operates it stays open.
- **A6 — Safety grading belongs to the wallet, not the SDK.** The SDK provides social-recovery *functionality* to any wallet implementation; each wallet holds its own criteria for what counts as a safe-enough configuration. So there is no `FragilityReport` (= a graded how-secure-is-your-setup verdict) in this surface: the SDK returns the path and the method metadata, and the extension implements its own rules, meter and honesty copy — **in V2** (decision 86; MVP/V1 show a plain set-up status). Structural validity — threshold sanity, one-path shape, **instance uniqueness** (the timelock floor is gone, decision 85) — stays in the SDK as `validatePath`. Note the gate is stronger than "it would fail on-chain anyway": under their I-5 the contract **never inspects the rule**, so `validatePath` is the only well-formedness check that exists (§2.7b), and instance uniqueness is **wallet policy, not a contract rule** (decision 93, REC-9).
- **A7 — The three privacy levels exist (assumed; decision 97).** We assume the kit supports all three levels the UX exposes and decision 84 promised: `hide-everything` (methods + metadata — displayed **Private**, and **the default** per decision 99) · `hide-details` (**shape in the clear, values encrypted** — displayed **Shape visible**) · `public` (nothing encrypted, no recovery password — displayed **Public**). The middle one has **no counterpart** in their current `encrypt(password_key, config) | config | empty` model — that dial is all-hidden, all-public, or nothing — so this is an assumption we build on, not a fact they have confirmed: **kit-ask REC-24** carries the request. Two parts of this surface rest on A7: `getRecoveryConfig` is **two-state** (§2.2, §2.6) because `hide-details` must return the structure with no password at all, and `encryptConfigValues` keeps its `hide-details` mode (§3). **With Private as the default (decision 99), REC-24 is no longer load-bearing.** A negative answer no longer collapses the default — the default is already the level their `encrypt(password_key, config)` mode gives us; it only removes the middle level, which is **opt-in**. The enum literals do not move either way.

## 2 · SDK surface (what the extension needs)

Names are proposals; shapes are requirements. "PreparedTx" = a fully-encoded transaction or UserOperation the extension can sign and broadcast with its own machinery. **No `prepare*` call ever broadcasts or executes anything** — preparation and submission are strictly separate (submission is the extension's).

### 2.1 Client + host adapters

- `RecoveryClientFactory.create(config)` → `RecoveryClient`; config = chainId, address book, host adapters.
- Host adapters the extension provides: `provider` (EIP-1193/viem reads), `storage` (**async** key-value, used only for SDK-internal caches — never for session state), `signer` (sign EIP-712/raw payloads by keystore key name — no raw-private-key export).
- The SDK does **not** broadcast and does **not** persist sessions. Every write returns PreparedTx(s).

### 2.2 Setup & management (Flows C, G) — MVP unless tagged

| Requirement | Serves |
|---|---|
| `getRecoveryConfig(account)` → set up? · the path (rows+groups) · waiting period. The SETUP state — "is recovery configured, and what is it". **NOT a bare chain read** (REC-25): at the hidden levels nothing about a setup is chain-readable (their I-16 puts the wait inside the commitment), so the call **reads the setup-event backup; whether it also decrypts, or hands ciphertext to `decryptConfigValues`, is OPEN** — it can return "configured, contents unavailable". **Two-state, resolved by decision 97 / A7 (REC-25 closed) — the DEFAULT read is the locked one:** at `hide-everything` (Private, the default per decision 99) the call returns **nothing but "configured, contents unavailable"** until the password arrives; at `hide-details` and `public` it returns the **structure** — rows, groups, thresholds, waiting period — from the setup-event backup with **no password**, and only the **values** need the decrypt. The caller must be able to tell those two failures apart — "everything withheld" and "values withheld" render as different screens (D-04/D-06) | B-01 gate, C-01, D-04, G-01 |
| `getRecoveryAttempt(account)` → none, or the attempt — `attemptId`, `status` (`pending` \| `cancelled` \| `executed`), `cancelCause` when cancelled, the destination/handover, countdown, expired claims. The LIVE-RECOVERY state, distinct from config; it covers the ENDED attempt too, because the D-13/D2 terminals are screens about a finished attempt. `getPendingRecovery(account)` stays as a **thin filter** over it (`status === 'pending'`). The terminals consume `status` **+** `cancelCause` — whether the cancelled event names which of the four roads fired is kit-ask **REC-42**. See the §3 note: what D2-01/B-03 need may have no chain source at the private levels | D-13, D2-01, G-04, B-03 |
| `prepareSetup(account, config, waitingPeriod)` → PreparedTx[] — `config` is the `EncryptedPath` from `encryptConfigValues`, which carries **the visibility level AND the plaintext body the commitment is taken over** (84); account deployment/upgrade to the 4337 substrate + recovery install + config, batched to ONE owner confirmation (Q28). **One door only** — there is no second path that takes a plain `RecoveryPath`, and no separate visibility parameter. The Flow C step-8 SAVE, not recovery submission | C-07/C-07e |
| `prepareUpdate(account, next)` → PreparedTx[] — diff-aware; **the SDK reads the current on-chain setup itself** (an edit during a wait cancels the running attempt, so the diff must be against the chain, not a client copy); supports editing one value in place (79: "no remove-and-recreate") | G-05/b/c |
| `prepareRemove(account)` → PreparedTx | G-02 |
| `validatePath(path)` — instance uniqueness (76), threshold sanity, one-path shape (73). It does **not** mirror the contract rules: their contract deliberately allows naming the same person twice, so **instance uniqueness is wallet policy** (decision 93, REC-9), and under their I-5 the contract checks no rule at all — this call is the **only** well-formedness gate (§2.7b). (No SDK or contract waiting-period floor — decision 85; the 24-hour minimum of decision 100 is extension picker policy, and `validatePath` does not enforce it) | wizard + Advanced |
| Method + path **metadata** rich enough for a wallet to grade a configuration itself: per method instance its type, and the properties that bear on fragility (e.g. a passkey's synced-vs-device-bound flag, a guardian's contract-vs-EOA nature). Includes each module's **trust-root declaration** (their term, REC-13 — never "method manifest"): the outside parties a method depends on, as SDK **data** for us to render. A module that ships **no declaration** is surfaced as carrying **"unknown outside parties"** (their I-4), not as "unpinned code". **No grading verdict** — see A6 | C-04*, G-01, F |
| *(V2)* per-account apply helpers: `prepareSetup` re-run per account + fresh per-account method secrets. Iteration/progress UI is extension-side | C-09 family |

### 2.3 Method providers — one lifecycle interface, per-method implementations

```
interface RecoveryMethod {
  enroll(params, opts) → EnrolledMethod            // register the instance for the path
  testAccess(enrolled, { rehearsal }) → TestResult  // setup tests (MVP) + dry run (V1)
  createClaim(enrolled, intent, { onProgress, signal }) → Claim   // proves ONE row: runs the prover, or collects the signature, for this method instance
  healthCheck(enrolled) → HealthResult              // V2, unattended half only
}
```

| Method | enroll | testAccess | createClaim | healthCheck (V2, unattended) |
|---|---|---|---|---|
| **Passkey** | create the credential, report synced vs device-bound (BE flag, decision 38), return credentialId + pubkey | one signed test challenge (user gesture) | sign the recovery intent; output formatted for the on-chain P-256 verifier; cross-device works via the browser's own QR hand-off | **user-gesture test by design**: the check asks the user to tap their passkey, which is exactly the interaction we want. Background checks can only confirm the environment, because no browser API silently reports whether one credential still exists — so a background failure means "unproven", never "deleted" |
| **Guardian** | address validation: checksum, ENS resolve, contract detection, same-seed check (only for wallet-held seeds) | reachability rehearsal only (52) | `buildApprovalPayload(intent, handover, guardian)` → the human-readable payload the guardian signs, over the eleven-field digest (§2.5; MVP: shown raw on the D-07 row, decision 79) + `parseApproval(intent, handover, signature)` → the validated claim ready for the submission tx, with **four** error classes: malformed / wrong recovery / wrong signer / **expired** (decision 91); EOA + ERC-1271 guardians | `code.length`, ENS drift, SCW owner-set drift |
| **Anon Aadhaar** | QR **image upload** → decode → test proof against the current UIDAI key | same as enroll test | full proof with onProgress (tens of seconds, heavy memory — must be cancellable) | on-chain verifier's UIDAI key hash still current |
| **zkPassport** *(decision 80 — mechanics TBD after the research pass)* | same lifecycle contract; inputs, proof budget, verifier availability and nullifier semantics to be filled in | | | |

### 2.4 Recovery operations (Flow D) — MVP, stateless

The claim set, resume behavior and wipe rules (decision 70) are **extension state** (`social-recovery-extension-work.md` item 7). The SDK provides pure computation and prepared transactions over that state:

- **Claims expire (decision 91, amending 70; REC-7/28).** `valid_until` is a real digest field and their I-13 rejects a late proof at the door. Decision 70's "claims survive pauses and resumes" still holds for *storage* — a resumed session keeps them — but a resumed session **may hold dead claims**. So `Claim` carries `expiresAt` (§3), `evaluateProgress` must count an expired claim as **not satisfied**, and the attempt read surfaces `expiredClaimIds`. Every resume path re-checks expiry before rendering progress; the D-07 row shows a per-claim countdown and an "ask again" action.
- `evaluateProgress(path, claims, opts?)` → required rows + per-group M-of-N status, **expired claims excluded** (pure function; feeds the decision-60 progress grammar). `opts.expectedAttemptId` also **voids** a claim stamped with a different attempt id (REC-27) — a void claim is a distinct outcome from an expired one, and §3's `ProgressReport` reports it as `voidedClaimIds`.
- `prepareInitiate(account, intent, handover, claims)` → PreparedTx — the recovery submission. It takes the **intent** (or at least its `attemptId`) so the submission commits to the **client-predicted** id the claims were stamped with (REC-27). Takes the full **handover** (new key + old authority + install path), not a bare `newOwner`: what is REMOVED is bound into the digest the guardians signed (REC-10). Broadcast by the recoverer's funded key (MVP is user-funded, decision 87; the D-09 gas-deposit screen fills the tank first when needed) — as a plain third-party call, since proof verification cannot run in the 4337 validation phase. Paymaster sponsorship arrives in V1 behind the same call.
- `prepareExecute(account)` → PreparedTx — finalize after the countdown (permissionless; `execute` reimburses `msg.sender` directly per the kit team — mechanic may change).
- `prepareCancel(account)` → PreparedTx — owner cancel (D2, MVP).
- Watching for initiated/cancelled/executed recoveries: the SDK provides the **read** (`getRecoveryAttempt`, with `getPendingRecovery` as its `status === 'pending'` filter); scheduling/polling/notifying is extension-side. The D-13/D2 **terminals** consume `status` + `cancelCause` — owner-cancelled and counterproof-cancelled are different screens with different copy, so the cause must arrive as data (kit-ask **REC-42**).

### 2.5 Guardian approval payloads

- The SDK's whole job here (MVP and V1 alike): `buildApprovalPayload(intent, handover, guardian)` — what must be signed — and `parseApproval(intent, handover, signature)` — turning the returned signature into the proof/claim the submission tx needs (§2.3 guardian row). Nothing more.
- **What gets signed is now specified, not assumed (REC-10).** It is the **eleven-field binding digest** their spec freezes: `chain_id`, `account`, `recovery_contract`, `version`, `setup_nonce`, `keccak256(setup_body)` where `setup_body = (rule, wait, adapter, repayment)`, the client-predicted `attempt_id`, `purpose` (`approve` | `cancel`), `valid_until`, `slot`, and `keccak256(handover)` where `handover = (new_key, old_authority, install_path)`. The SDK builds it and parses against it; **the extension never assembles it by hand** (A3). Only the `slot` index scheme is still open (§5 item 6).
- **A bare `newOwner` is unsafe.** It names only what is added. The handover binds what is **REMOVED** — the old authority and the install path — precisely to stop a submitter substituting it and leaving a door open on an account the user believes was rescued. The payload's human string must therefore render the removal too (REC-33), and the returned claim carries `expiresAt` from `valid_until` (decision 91).
- The V1 hosted guardian **page** (rendering, wallet connect, offline copy/paste UX) is extension-built and extension-served (decision 51), consuming those two calls.

### 2.6 Secrets & encryption — MVP (Q29/53 answered by decision 84; password model rewritten by decision 90, REC-12)

- **Commit-reveal config encryption (decision 84) — unchanged and still true:** values live in encrypted logs, decrypted with the recovery password. The SDK accepts the user's **visibility level** at setup — `hide-everything` (methods + metadata; **the default**, decision 99) · `hide-details` (shape in the clear, values encrypted) · `public` (no recovery password exists and nothing is encrypted) — encrypts accordingly, decrypts on the recoverer side, and re-encrypts on guardian edits (56). **Display names ↔ enum literals (decision 99 — the literals are UNCHANGED):** **Private** ↔ `hide-everything` · **Shape visible** ↔ `hide-details` · **Public** ↔ `public`. **All three levels are ASSUMED available (decision 97, assumption A7):** `hide-details` — shape in the clear, values encrypted — has no counterpart in their current model, and kit-ask REC-24 carries the confirmation; with Private now the default, that middle level is **opt-in**.
- **What the old promise got wrong.** "A wrong password never blocks recovery — a failed decrypt degrades to hidden values, never to an error" (48/56) **cannot survive at the hidden levels** and is retired here. Nothing about a hidden setup is chain-readable (their I-16 puts even the wait inside the commitment), so there is no set of hidden values to degrade to: without the password the recoverer cannot learn what to satisfy.
- **The model that replaces it (decisions 84 + 90).** At `public` **no password exists** — nothing to get wrong. At `hide-details` and `hide-everything` the password is **REQUIRED**, and it is **printed on the Recovery Card** (decision 90), so the card — not the user's memory — is the recall path. The password step is therefore present at the hidden levels and absent at Public.
- **A failed decrypt is a real blocker, surfaced honestly.** On a fresh device the SDK returns a decrypt failure, not hidden values. The extension must say so plainly, offer retry, and point at the Recovery Card — never a silent degrade that leaves the recoverer guessing. **Two-state D-04/D-06 readout — REC-25 is RESOLVED by decision 97 / A7:** at `hide-everything` (Private, the default) a decrypt failure hides **everything**, and the screen says "we cannot show your setup yet — enter the recovery password from your card"; at `hide-details` and `public` the shape needs **no password** and only the values wait for one, so a decrypt failure there hides the values against a visible path. Both states must read as *withheld*, never as "no recovery is set up".
- Backup set **pack/unpack**: every method secret that exists nowhere else (passkey credentialId, the guardian list, zkPassport secrets per the research pass) — one bundle the UX ties to the recovery password and the dry-run recall row. **Collecting, storing and re-importing the secrets is the extension's; the SDK only packs and unpacks the bundle format** — `packBackupSet` / `unpackBackupSet` are pure, take no account and touch no storage (§3). The separate **setup-event** backup the SDK emits at setup is verified — see §2.7c.

### 2.7 Duties the contracts spec assigns the SDK (REC-11)

Their spec-v1 invariants now name the `sdk` as a **bound module** — these four duties are not ours to implement, but the extension depends on each one holding, so they are stated here as requirements on the package.

- **(a) Salt minting — per account and per credential.** The SDK mints a **fresh salt for every account and every credential**; it never reuses one across accounts. This is load-bearing, not hygiene: the unlinkability guarantee is **conditional** on it (decision 92, REC-8). Under salt reuse their R-16 attack applies — one account's recovery unmasks another account's setup through `keccak256(B, R)` — so reuse turns "your reuse is invisible at rest" into a false statement. The extension's linkability copy is written against this condition holding.
- **(b) The I-5 well-formedness gate at setup.** The contract **never checks the rule**. `validatePath` (§2.2) is therefore the **only** gate between a user and an unsatisfiable, permanently-stuck configuration — it is not a client-side convenience mirroring an on-chain check that would reject the save anyway. It must reject at setup, before the commitment is written.
- **(c) Setup-event backup emission that verifies its own output.** When the SDK emits the **setup-event** backup — the event field the config reads come from, distinct from the §2.6 backup **set** of method secrets — it must **verify the emitted ciphertext actually decrypts back to the committed setup** — same password, same bytes — before the setup transaction is handed to us. A backup that does not round-trip is an unrecoverable account with a green checkmark on it, and at the hidden levels nothing on chain can be read to repair it.
- **(d) The frozen setup-commitment preimage encoder.** The bytes hashed into the setup commitment are produced by one encoder that the **SDK, the contract, and the rebuild client all recompute identically**; a frozen test vector exists on their side. The extension never encodes a preimage and never re-derives a commitment by hand.

## 3 · Interface summary

Signatures only — the reasoning for each lives in §2. Shapes are proposals, names negotiable; what matters is the inputs and outputs each call needs.

```ts
// ── Client ───────────────────────────────────────────────────────────────
createRecoveryClient(config: RecoveryClientConfig): RecoveryClient

interface RecoveryClientConfig {
  chainId: number
  addressBook: MethodAddressBook            // verifier/module addresses per chain
  host: {
    provider: Eip1193Provider               // reads
    storage: AsyncKeyValueStore             // SDK-internal caches only
    signer: { signTypedData(keyRef, data), signMessage(keyRef, bytes) }
  }
}

// ── Config & management (Flows C, G) ─────────────────────────────────────
// OPEN — shape unresolved. Must distinguish FOUR states: not configured · shape readable with values
// withheld · nothing readable · fully readable. Whether the decrypt lives HERE (password param) or stays
// in decryptConfigValues is OPEN.
// CANDIDATE, NOT AGREED:
//   type ConfigRead =
//     | { state: 'not-configured' }
//     | { state: 'shape-only';  path: RecoveryPath; waitingPeriod: Seconds }   // values withheld
//     | { state: 'sealed' }                                                    // nothing readable
//     | { state: 'full';        path: RecoveryPath; waitingPeriod: Seconds }
getRecoveryConfig(account: Address): Promise<RecoveryConfig | null>   // ← shape OPEN
getRecoveryAttempt(account: Address): Promise<RecoveryAttempt | null>
getPendingRecovery(account: Address): Promise<PendingRecovery | null>   // thin filter: status === 'pending'
prepareSetup(account: Address, config: EncryptedPath, waitingPeriod: Seconds): Promise<PreparedTx[]>  // ONE door only: `config` carries the visibility level and the committed body (encryptConfigValues) — there is no variant taking a plain RecoveryPath
prepareUpdate(account: Address, next: RecoveryPath): Promise<PreparedTx[]>  // diff-aware; the SDK reads the CURRENT on-chain setup itself — never a client copy
prepareRemove(account: Address): Promise<PreparedTx[]>
validatePath(path: RecoveryPath): ValidationResult

interface RecoveryPath {
  required: EnrolledMethod[]
  groups: Array<{ threshold: number; members: EnrolledMethod[] }>
}
interface EnrolledMethod {
  id: string
  type: 'passkey' | 'guardian' | 'aadhaar' | 'zkpassport'
  metadata: MethodMetadata                  // fragility inputs; the wallet grades (A6)
}
interface MethodMetadata {
  passkey?: { synced: boolean; credentialId: string }
  guardian?: { address: Address; isContract: boolean; ens?: string }
  // zkpassport / aadhaar: TBD with the research pass
}
interface RecoveryConfig { path: RecoveryPath; waitingPeriod: Seconds }
// WARNING — no guaranteed chain source (REC-16, ask pending in `social-recovery-kit-asks.md`): the handover,
// the wait and the finalize deadline are exactly what D2-01/B-03/D-13 render, and at the private levels the
// wait lives inside the commitment (their I-16) while the attempt event may not carry the rest in the clear.
// Until they answer, treat every field below except `attemptId` as best-effort.
// The D-13/D2 TERMINALS consume `status` + `cancelCause`: owner-cancelled and counterproof-cancelled are
// different screens with different copy, so the cause must arrive as data (kit-ask REC-42).
interface RecoveryAttempt {
  attemptId: Hex                            // client-predicted at open time; an intervening attempt voids a gathering (REC-27)
  status: 'pending' | 'cancelled' | 'executed'
  cancelCause?: 'owner' | 'counterproof' | 'setup-edited' | 'module-uninstalled'  /* OPEN — kit-ask REC-42 */
  handover: Handover                        // what is installed AND what is removed — render both (REC-33)
  initiatedAt: number
  executableAt: number                      // derived from the wait; may be unavailable at the hidden levels
  endedAt?: number                          // when it was cancelled or executed
  expiredClaimIds?: string[]                // claims dead on arrival after a resume (decision 91, REC-28)
}
type PendingRecovery = RecoveryAttempt & { status: 'pending' }   // getPendingRecovery is just this filter
interface ValidationResult {
  ok: boolean
  violations: Array<{ code: 'duplicate_instance' | 'bad_threshold' | 'empty_path'; methodId?: string }>
}
// PreparedTx — proof verification CANNOT run in the 4337 validation phase (REC-10), so a recovery submission
// is never a userop whose sender is the recovered account. It is a plain call from a funded third party, or a
// call nested inside that party's own operation. `third-party-call` is the kind the D-09 gas-deposit screen funds.
type PreparedTx =
  | { kind: 'tx'; to: Address; data: Hex; value?: bigint }
  | { kind: 'third-party-call'; to: Address; data: Hex; value?: bigint; payer: Address }  // submitter is ANY funded key; never the recovered account
  | { kind: 'userop'; userOp: UserOperation; sponsored: boolean }   // sponsored: V1 (decision 87); sender is the SUBMITTER's account, never the recovered one

// ── Methods (all four share this shape) ──────────────────────────────────
const method = new PassKeyMethod(client, enrolledMethod)

method.testAccess(m: EnrolledMethod, opts?: { rehearsal?: boolean }): Promise<TestResult>
method.createClaim(m: EnrolledMethod, intent: RecoveryIntent, opts?: ClaimOpts): Promise<Claim>
method.healthCheck(m: EnrolledMethod): Promise<HealthResult>

PassKeyMethod.enroll(params: EnrollParams): Promise<EnrolledMethod>

// RecoveryIntent — the ELEVEN-FIELD BINDING DIGEST their spec freezes (REC-10). The old
// `{account, newOwner, nonce}` is retired: `newOwner` alone is UNSAFE, because it names only what is ADDED.
// The handover binds what is REMOVED — the old authority and the install path — precisely so a submitter
// cannot substitute it and keep a door open on an account the user believes was rescued.
// The SDK BUILDS and PARSES this. The extension never assembles a digest by hand (A3).
interface RecoveryIntent {
  chainId: number
  account: Address
  recoveryContract: Address
  version: number
  setupNonce: bigint
  setupBodyHash: Hex                        // keccak256(setup_body), setup_body = (rule, wait, adapter, repayment)
  attemptId: Hex                            // client-predicted (REC-27: an intervening attempt voids the gathering)
  purpose: 'approve' | 'cancel'             // 'cancel' is the counterproof cancel — their I-8a, REC-30
  validUntil: number                        // enforced; their I-13 rejects a proof past its window at the door
  slot: number                              // clause index vs credential index UNRESOLVED — asked as REC-19 in `social-recovery-kit-asks.md`
  handoverHash: Hex                         // keccak256(handover)
}
interface Handover {
  newKey: Address                           // what is ADDED
  oldAuthority: Address                     // what is REMOVED — the safety half `newOwner` never carried
  installPath: Hex                          // how it is installed; part of the binding, render it (REC-33)
}
interface ClaimOpts { onProgress?(e: { phase: string; pct?: number }): void; signal?: AbortSignal }
interface Claim {
  methodId: string
  data: Hex
  createdAt: number
  expiresAt: number                         // = the digest's valid_until (decision 91, REC-7/28)
  attemptId: Hex                            // the intent's CLIENT-PREDICTED attempt id (REC-27); the SDK stamps it in createClaim/parseApproval — a prediction, never proof
}
interface TestResult { ok: boolean; reason?: string }
interface HealthResult { status: 'ok' | 'unproven' | 'failing'; checkedAt: number; detail?: string }

// ── Guardian approvals (Flow E1) ─────────────────────────────────────────
// Both calls take the FULL eleven-field intent plus the handover it commits to — the SDK assembles the digest,
// renders the human string from it, and validates a returned signature against it (REC-10).
buildApprovalPayload(intent: RecoveryIntent, handover: Handover, guardian: EnrolledMethod): ApprovalPayload
parseApproval(intent: RecoveryIntent, handover: Handover, signature: Hex): Claim   // throws ApprovalError

interface ApprovalPayload { human: string; typedData: Eip712TypedData; validUntil: number }  // human MUST name what is removed, not just the new key (REC-33)
type ApprovalError = { code: 'malformed' | 'wrong_recovery' | 'wrong_signer' | 'expired' }   // 'expired': past valid_until (decision 91)

// ── Recovery (Flow D) — stateless; the extension holds the claims ────────
// a claim whose attemptId != expectedAttemptId is VOID (REC-27) — separate from EXPIRED
evaluateProgress(path: RecoveryPath, claims: Claim[], opts?: { now?: number; expectedAttemptId?: Hex }): ProgressReport   // expired claims count as NOT satisfied (decision 91)
prepareInitiate(account: Address, intent: RecoveryIntent, handover: Handover, claims: Claim[]): Promise<PreparedTx[]>  // handover, not a bare newOwner (REC-10); the intent (or at least its attemptId) makes the submission COMMIT to the predicted id
prepareExecute(account: Address): Promise<PreparedTx[]>
prepareCancel(account: Address): Promise<PreparedTx[]>

interface ProgressReport {
  satisfied: boolean
  required: Array<{ methodId: string; done: boolean }>
  groups: Array<{ threshold: number; done: number; total: number }>
  voidedClaimIds: string[]                  // stamped with a different attemptId (REC-27) — NOT the same as expired
}

// ── Secrets (recovery password, backup set) ──────────────────────────────
// EncryptedPath is the ONE object prepareSetup takes: it carries the visibility LEVEL and the plaintext body
// the commitment is taken over, alongside the ciphertext. `public` is a PASS-THROUGH (password null, nothing
// encrypted) — it still returns an EncryptedPath, so there is exactly one door into prepareSetup.
// 'hide-details' (shape in the clear, values encrypted) is ASSUMED available — A7 / decision 97, kit-ask REC-24
encryptConfigValues(path: RecoveryPath, password: string | null, visibility: 'hide-everything' | 'hide-details' | 'public'): Promise<EncryptedPath>
decryptConfigValues(encrypted: EncryptedPath, password: string): Promise<RecoveryPath>  // throws DecryptError — a wrong password is a REAL blocker at the hidden levels (decision 90), not a degrade to 'hidden'

// Backup SET (method secrets) — pure format work only: the extension collects, stores and re-imports them
packBackupSet(secrets: MethodSecret[], password: string): Promise<BackupSet>
unpackBackupSet(bundle: BackupSet, password: string): Promise<MethodSecret[]>   // throws DecryptError
interface MethodSecret {
  methodId: string
  type: EnrolledMethod['type']
  data: Hex                                 // the secret that exists nowhere else (credentialId, guardian list, zkPassport material)
}
```

## 4 · Constraints the SDK package must meet

- Runs inside an MV3 extension: no `eval`/dynamic codegen (CSP allows `wasm-unsafe-eval` only), WASM artifacts packaged locally or fetched-and-cached with integrity, single-instance WASM safety (or documented locking), all APIs async.
- Long operations (proving) expose progress + cancellation and make no assumption about WHICH JavaScript context runs them — the SDK owns the proving itself (A4b), the extension only picks the host context.
- Proof-stack reference points (the SDK carries these; see A4b) (measured 2026-08-19): Noir/UltraHonk-class proving ≈ 4–17 s in-browser with MB-scale artifacts; circom/Groth16 zk-email-class ≈ minutes + ~1 GB artifacts; Aadhaar circom ≈ 20–50 s + ~600 MB + ~1.5 GB peak memory. zkPassport's budget comes from its research pass; the SDK API must not leak the stack choice.
- Backend-zero: all chain access through the host `provider`.

## 5 · Open questions routed to the kit team

1. **zkPassport integration** (decision 80): SDK surface, proof budget, verifier deployment, nullifier semantics, what the user presents (NFC scan / document photo), and what secret (if any) joins the §2.6 backup set. Research pass DONE (`social-recovery-zkpassport-research.md` — verdict negative for MVP, recommendation V1; team decision pending) — the wireframes wait on that ruling.
2. Funding remainder (decision 87): confirm the execute-repays-`msg.sender` mechanic (flagged may-change); for V1 sponsorship — who operates the paymaster, and what stops a permissionless sponsored entry point from being drained by failed recovery attempts.
3. Prover stack (with the §4 numbers).
4. Commit-reveal remainder (decision 84 answered the scope): the encrypted-log schema and how the recoverer fetches it on a fresh device. **The level-mapping half (REC-1) is closed on our side by decision 97 / A7** — we assume all three levels; **the default is `hide-everything` (Private, decision 99)** and `hide-details` (Shape visible) is **opt-in pending REC-24**. We route the confirmation of the missing middle shape to the kit as **REC-24** in `social-recovery-kit-asks.md`; REC-25's two-state readout is resolved with it (§2.2, §2.6).
5. Group encoding with thresholds (T10) — assumed solved per A3; listed for traceability. (No contract floor — decision 85; the wallet enforces its own 24h picker minimum, decision 100.)
6. **Guardian payload contents — ANSWERED, no longer assumed (REC-10).** Their spec-v1 freezes the eleven-field binding digest, reproduced in §2.5 and §3. **The one remaining unknown is the `slot` index scheme** — within a clause, is `slot` the clause index or the credential index? Asked as REC-19 in `social-recovery-kit-asks.md`; the D-07 checklist copy waits on the answer.
7. **7579 adapter scope (REC-20).** Their Q-19 assumed an Ambire fork; A5 moved us to a bare-bones 4337 account (decision 80), and adapters ship immutable (their Q-2). The adapter binding our account to the recovery module is a **kit-team deliverable** — the extension ships no Solidity. Escalate before interfaces freeze.
8. **The attempt-opened event's contents (REC-16).** The attempt read needs the handover, the wait and the finalize deadline in the clear; with the wait inside the commitment (their I-16) the private levels have **no chain source** for D-13's countdown, the D2 banner, G-01's card or any watcher. Ask pending in `social-recovery-kit-asks.md`.

## 6 · Flow → requirement traceability

- Flow A/A1: extension-only.
- Flow B: §2.2 getRecoveryConfig · getRecoveryAttempt.
- Flow C: §2.2 prepareSetup/validatePath/metadata · §2.3 enroll/testAccess (dry run = rehearsal, V1) · §2.6. The meter and fragility copy are extension-side (A6).
- Flow D: §2.4 · §2.3 createClaim · §2.6 decrypt.
- Flow D2: §2.2 getRecoveryAttempt · §2.4 prepareCancel.
- Flow E1: §2.5.
- Flow F (V2): §2.3 healthCheck · §2.2 metadata (the meter's rules are ours, A6).
- Flow G: §2.2 update/remove/config reads.
- Cross-cutting: **§2.7** (the duties their invariants assign the SDK) underwrites the linkability copy (C-09, E1), the setup well-formedness gate (C-07) and every backup promise in §2.6.

## Appendix A · Investigation baseline (2026-08-19, compressed)

Facts from the three-front investigation, kept for reference; the requirements above stand on their own. The kit's decided design names a `RecoveryClient` with Services/Providers and a `ValidationService.evaluate() → FragilityReport`; §2 aligns with the layout but **not** with that last part — grading is wallet-side here (A6). The Railgun plugin is the extension's precedent for consuming kohaku SDK packages (background controller, packaged WASM, async-storage bridge) — the pattern to follow and improve, not the only integration. The P-256 precompile is live on mainnet + Sepolia (6,900 gas) with OZ `P256.sol` as the dispatch pattern and Safe's passkey module as audited prior art. Passkey portability facts: BE/BS flags are the only reliable signals; provider identity can change invisibly (CXP/CXF); health checks cannot be silent (§2.3). Historical (superseded by decisions 80/A5): the Ambire-substrate analysis (hash-commitment privileges, recovery outside `validateUserOp`, the sponsorship block) live in this document's v1/v2 history on PR #2, as do the ZK Email findings (dropped method — history in the spec's decisions log).
