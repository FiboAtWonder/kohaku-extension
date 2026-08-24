# Kohaku SDK — Account-recovery requirements

> **Status: v7 (2026-08-24)** — two review amendments: **88** (the recovery fast-track creates only an EOA that becomes the recovered account's signer; smart-account-at-init belongs to the standard create flow) and **84** (`public` visibility sets no recovery password — nothing is encrypted, `encryptConfigValues` is skipped). Earlier v6 — fourth PR review round applied ([PR #2](https://github.com/FiboAtWonder/kohaku-extension/pull/2)), decisions 84–89: commit-reveal visibility answered (84), timelock floor removed (85), fragility grading → V2 (86), user-funded MVP + gas-deposit screens (87), smart-account-at-init + two-accounts copy (88), E2 skipped (89). Posture: this document states **what the extension needs from `@kohaku-eth/social-recovery`**, assuming the SDK exists and its methods work. Contract internals (encodings, binding hashes, thresholds, verifier wiring) are the SDK's problem — we consume APIs. The SDK is **stateless**: it prepares transactions, payloads and proofs; all state (sessions, drafts) lives in the extension. Extension-side changes live in `social-recovery-extension-work.md`. Milestone tags (MVP/V1/V2) follow spec decision 79.

## 1 · Working assumptions

- **A1 — Method set (decided 2026-08-20, decision 80):** passkey, guardians, Anon Aadhaar, **zkPassport**. ZK Email is out; zkPassport replaces it. All four ship in the MVP (79). zkPassport's concrete mechanics (inputs, proof budget, verifier, nullifier semantics) get a research pass before its wireframes are drawn; until then §2.3 carries the lifecycle contract with TBD specifics.
- **A2 — Anon Aadhaar works.** The SDK exposes the full lifecycle in §2.3; upstream library health is the kit team's to solve, not a UX constraint.
- **A3 — The consumer never needs to know how the contracts work.** The SDK fully abstracts the on-chain implementation: path encoding (required rows + M-of-N groups), the recovery binding hash and cancel semantics are internal. The extension sees the path model and prepared transactions — never a preimage, an ABI struct, or a contract address.
- **A4 — Division of labor.** The SDK **prepares** (transactions/userops, payloads, proofs, derived data) and computes (validation, progress math); the extension **signs, broadcasts, stores, and renders**. Every long-running SDK operation is async with progress callbacks and cancellation. The SDK holds no session state.
- **A4b — Proving is the SDK's job, behind one method (clarified 2026-08-20).** The SDK ships the prover — circuits, artifacts, witness generation, verification — and exposes it as a single call (`createClaim`). The extension never implements proving; the work runs inside the extension only because that is where the SDK is loaded. All the extension decides is which JavaScript context hosts the call (see the constraints section).
- **A5 — Account substrate + funding (updated 2026-08-24, decisions 87/88):** a **bare-bones 4337 implementation**; recovery is validated by the account/module. The account does not have to be freshly created — an existing EOA can be set as its signer. The **standard create flow must deploy the smart account at initialization**, while the recovery fast-track creates only an EOA that becomes the recovered account's signer (88, amended in review). Funding (87): **the MVP is user-funded** — gas-deposit screens at onboarding (A1-04) and before submitting (D-09), auto-skipped when the account holds enough. The kit provides **contract-side support, not a paymaster**: `execute` reimburses `msg.sender` directly (no batched sponsored UserOps on the executor flow — mechanic flagged as may-change). Paymaster sponsorship is **V1**; who operates it stays open.
- **A6 — Safety grading belongs to the wallet, not the SDK (ruled 2026-08-20).** The SDK provides social-recovery *functionality* to any wallet implementation; each wallet holds its own criteria for what counts as a safe-enough configuration. So there is no `FragilityReport` (= a graded how-secure-is-your-setup verdict) in this surface: the SDK returns the path and the method metadata, and the extension implements its own rules, meter and honesty copy — **in V2** (decision 86; MVP/V1 show a plain set-up status). Structural validity — the rules the contract itself enforces (instance uniqueness, threshold sanity, one-path shape — the timelock floor is gone, decision 85) — stays in the SDK as `validatePath`, because a save that violates them simply fails on-chain.

## 2 · SDK surface (what the extension needs)

Names are proposals; shapes are requirements. "PreparedTx" = a fully-encoded transaction or UserOperation the extension can sign and broadcast with its own machinery. **No `prepare*` call ever broadcasts or executes anything** — preparation and submission are strictly separate (submission is the extension's).

### 2.1 Client + host adapters

- `RecoveryClientFactory.create(config)` → `RecoveryClient`; config = chainId, address book, host adapters.
- Host adapters the extension provides: `provider` (EIP-1193/viem reads), `storage` (**async** key-value, used only for SDK-internal caches — never for session state), `signer` (sign EIP-712/raw payloads by keystore key name — no raw-private-key export).
- The SDK does **not** broadcast and does **not** persist sessions. Every write returns PreparedTx(s).

### 2.2 Setup & management (Flows C, G) — MVP unless tagged

| Requirement | Serves |
|---|---|
| `getRecoveryConfig(account)` → set up? · the path (rows+groups) · waiting period. The SETUP state — "is recovery configured, and what is it" | B-01 gate, C-01, D-04, G-01 |
| `getPendingRecovery(account)` → none, or: initiated recovery details — newOwner, countdown, which methods were satisfied. The LIVE-RECOVERY state, distinct from config | D-13, D2-01, G-04, B-03 |
| `prepareSetup(path, waitingPeriod, visibility)` → PreparedTx[] — account deployment/upgrade to the 4337 substrate + recovery install + config (encrypted per the visibility level, 84), batched to ONE owner confirmation (Q28). The Flow C step-8 SAVE, not recovery submission | C-07/C-07e |
| `prepareUpdate(currentPath, newPath)` → PreparedTx — diff-aware single tx; supports editing one value in place (79: "no remove-and-recreate") | G-05/b/c |
| `prepareRemove(account)` → PreparedTx | G-02 |
| `validatePath(path)` — instance uniqueness (76), threshold sanity, one-path shape (73); mirrors the contract rules so the builder can block bad saves client-side. (No waiting-period floor — 0h is legal, decision 85; the warning is UX) | wizard + Advanced |
| Method + path **metadata** rich enough for a wallet to grade a configuration itself: per method instance its type, and the properties that bear on fragility (e.g. a passkey's synced-vs-device-bound flag, a guardian's contract-vs-EOA nature). **No grading verdict** — see A6 | C-04*, G-01, F |
| *(V2)* per-account apply helpers: `prepareSetup` re-run per account + fresh per-account method secrets. Iteration/progress UI is extension-side | C-09 family |

### 2.3 Method providers — one lifecycle interface, per-method implementations

```
interface RecoveryMethod {
  enroll(params, opts) → EnrolledMethod            // register the instance for the path
  testAccess(enrolled, { rehearsal }) → TestResult  // setup tests (MVP) + dry run (V1)
  createClaim(enrolled, intent, { onProgress, signal }) → Claim   // recovery rows
  healthCheck(enrolled) → HealthResult              // V2, unattended half only
}
```

| Method | enroll | testAccess | createClaim | healthCheck (V2, unattended) |
|---|---|---|---|---|
| **Passkey** | create the credential, report synced vs device-bound (BE flag, decision 38), return credentialId + pubkey | one signed test challenge (user gesture) | sign the recovery intent; output formatted for the on-chain P-256 verifier; cross-device works via the browser's own QR hand-off | **user-gesture test by design** (ruled 2026-08-20): the check asks the user to tap their passkey, which is exactly the interaction we want. Background checks can only confirm the environment, because no browser API silently reports whether one credential still exists — so a background failure means "unproven", never "deleted" |
| **Guardian** | address validation: checksum, ENS resolve, contract detection, same-seed check (only for wallet-held seeds) | reachability rehearsal only (52) | `buildApprovalPayload(intent)` → the human-readable payload the guardian signs (MVP: shown raw on the D-07 row, decision 79) + `parseApproval(signature)` → the validated claim ready for the submission tx, with three error classes: malformed / wrong recovery / wrong signer; EOA + ERC-1271 guardians | `code.length`, ENS drift, SCW owner-set drift |
| **Anon Aadhaar** | QR **image upload** → decode → test proof against the current UIDAI key | same as enroll test | full proof with onProgress (tens of seconds, heavy memory — must be cancellable) | on-chain verifier's UIDAI key hash still current |
| **zkPassport** *(decision 80 — mechanics TBD after the research pass)* | same lifecycle contract; inputs, proof budget, verifier availability and nullifier semantics to be filled in | | | |

### 2.4 Recovery operations (Flow D) — MVP, stateless

The claim set, resume behavior and wipe rules (decision 70) are **extension state** (`social-recovery-extension-work.md` item 7). The SDK provides pure computation and prepared transactions over that state:

- `evaluateProgress(path, claims)` → required rows + per-group M-of-N status (pure function; feeds the decision-60 progress grammar).
- `prepareInitiate(account, newOwner, claims)` → PreparedTx — the recovery submission, broadcast by the recoverer's funded key (MVP is user-funded, decision 87; the D-09 gas-deposit screen fills the tank first when needed). Paymaster sponsorship arrives in V1 behind the same call.
- `prepareExecute(account)` → PreparedTx — finalize after the countdown (permissionless; `execute` reimburses `msg.sender` directly per the kit team — mechanic may change).
- `prepareCancel(account)` → PreparedTx — owner cancel (D2, MVP).
- Watching for initiated/cancelled/executed recoveries: the SDK provides the **read** (`getPendingRecovery`); scheduling/polling/notifying is extension-side.

### 2.5 Guardian approval payloads

- The SDK's whole job here (MVP and V1 alike): `buildApprovalPayload(intent)` — what must be signed — and `parseApproval(signature)` — turning the returned signature into the proof/claim the submission tx needs (§2.3 guardian row). Nothing more.
- The V1 hosted guardian **page** (rendering, wallet connect, offline copy/paste UX) is extension-built and extension-served (decision 51), consuming those two calls.

### 2.6 Secrets & encryption — MVP (Q29/53 answered by decision 84)

- **Commit-reveal config encryption (decision 84):** values live in encrypted logs, decrypted with the recovery password. The SDK accepts the user's **visibility level** at setup — `hide-everything` (methods + metadata) · `hide-details` (metadata only; default) · `public` (no recovery password exists and nothing is encrypted) — encrypts accordingly, decrypts on the recoverer side, and re-encrypts on guardian edits (56). "Wrong password never blocks recovery" (48/56) holds at the API level: a failed decrypt degrades to hidden values, never to an error that stops the flow.
- Backup set export/import: every method secret that exists nowhere else (passkey credentialId, the guardian list, zkPassport secrets per the research pass) — one bundle the UX ties to the recovery password and the dry-run recall row.

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
getRecoveryConfig(account: Address): Promise<RecoveryConfig | null>
getPendingRecovery(account: Address): Promise<PendingRecovery | null>
prepareSetup(account: Address, path: RecoveryPath, waitingPeriod: Seconds, visibility: 'hide-everything' | 'hide-details' | 'public'): Promise<PreparedTx[]>
prepareUpdate(account: Address, next: RecoveryPath): Promise<PreparedTx[]>
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
interface PendingRecovery {
  newOwner: Address
  initiatedAt: number
  executableAt: number
  satisfiedMethodIds: string[]
}
interface ValidationResult {
  ok: boolean
  violations: Array<{ code: 'duplicate_instance' | 'bad_threshold' | 'empty_path'; methodId?: string }>
}
type PreparedTx =
  | { kind: 'tx'; to: Address; data: Hex; value?: bigint }
  | { kind: 'userop'; userOp: UserOperation; sponsored: boolean }   // sponsored: V1 (decision 87)

// ── Methods (all four share this shape) ──────────────────────────────────
client.method(type).enroll(params: EnrollParams): Promise<EnrolledMethod>
client.method(type).testAccess(m: EnrolledMethod, opts?: { rehearsal?: boolean }): Promise<TestResult>
client.method(type).createClaim(m: EnrolledMethod, intent: RecoveryIntent, opts?: ClaimOpts): Promise<Claim>
client.method(type).healthCheck(m: EnrolledMethod): Promise<HealthResult>

interface RecoveryIntent { account: Address; newOwner: Address; nonce: bigint }
interface ClaimOpts { onProgress?(e: { phase: string; pct?: number }): void; signal?: AbortSignal }
interface Claim { methodId: string; data: Hex; createdAt: number }
interface TestResult { ok: boolean; reason?: string }
interface HealthResult { status: 'ok' | 'unproven' | 'failing'; checkedAt: number; detail?: string }

// ── Guardian approvals (Flow E1) ─────────────────────────────────────────
buildApprovalPayload(intent: RecoveryIntent, guardian: EnrolledMethod): ApprovalPayload
parseApproval(intent: RecoveryIntent, signature: Hex): Claim   // throws ApprovalError

interface ApprovalPayload { human: string; typedData: Eip712TypedData }
type ApprovalError = { code: 'malformed' | 'wrong_recovery' | 'wrong_signer' }

// ── Recovery (Flow D) — stateless; the extension holds the claims ────────
evaluateProgress(path: RecoveryPath, claims: Claim[]): ProgressReport
prepareInitiate(account: Address, newOwner: Address, claims: Claim[]): Promise<PreparedTx[]>
prepareExecute(account: Address): Promise<PreparedTx[]>
prepareCancel(account: Address): Promise<PreparedTx[]>

interface ProgressReport {
  satisfied: boolean
  required: Array<{ methodId: string; done: boolean }>
  groups: Array<{ threshold: number; done: number; total: number }>
}

// ── Secrets (recovery password, backup set) ──────────────────────────────
encryptConfigValues(path: RecoveryPath, password: string, visibility: 'hide-everything' | 'hide-details'): Promise<EncryptedPath> // 'public' skips this call — no password, nothing encrypted
decryptConfigValues(encrypted: EncryptedPath, password: string): Promise<RecoveryPath | 'hidden'>
exportBackupSet(account: Address): Promise<BackupSet>
importBackupSet(bundle: BackupSet): Promise<void>
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
4. Commit-reveal remainder (decision 84 answered the scope): the encrypted-log schema and how the recoverer fetches it on a fresh device.
5. Group encoding with thresholds (T10) — assumed solved per A3; listed for traceability. (The 24h-floor question died with decision 85.)
6. Guardian payload contents (nonce, policyId in/out) — assumed frozen by the kit per A3; the UX only needs it human-readable and chain-bound.
7. Colibri `p256verify` gap (passkey verification fails verified reads on one RPC provider).

## 6 · Flow → requirement traceability

- Flow A/A1: extension-only.
- Flow B: §2.2 getRecoveryConfig · getPendingRecovery.
- Flow C: §2.2 prepareSetup/validatePath/metadata · §2.3 enroll/testAccess (dry run = rehearsal, V1) · §2.6. The meter and fragility copy are extension-side (A6).
- Flow D: §2.4 · §2.3 createClaim · §2.6 decrypt.
- Flow D2: §2.2 getPendingRecovery · §2.4 prepareCancel.
- Flow E1: §2.5.
- Flow F (V2): §2.3 healthCheck · §2.2 metadata (the meter's rules are ours, A6).
- Flow G: §2.2 update/remove/config reads.

## Appendix A · Investigation baseline (2026-08-19, compressed)

Facts from the three-front investigation, kept for reference; the requirements above stand on their own. The kit's decided design names a `RecoveryClient` with Services/Providers and a `ValidationService.evaluate() → FragilityReport`; §2 aligns with the layout but **not** with that last part — grading is wallet-side here (A6). The Railgun plugin is the extension's precedent for consuming kohaku SDK packages (background controller, packaged WASM, async-storage bridge) — the pattern to follow and improve, not the only integration. The P-256 precompile is live on mainnet + Sepolia (6,900 gas) with OZ `P256.sol` as the dispatch pattern and Safe's passkey module as audited prior art. Passkey portability facts: BE/BS flags are the only reliable signals; provider identity can change invisibly (CXP/CXF); health checks cannot be silent (§2.3). Historical (superseded by decisions 80/A5): the Ambire-substrate analysis (hash-commitment privileges, recovery outside `validateUserOp`, the sponsorship block) live in this document's v1/v2 history on PR #2, as do the ZK Email findings (dropped method — history in the spec's decisions log).
