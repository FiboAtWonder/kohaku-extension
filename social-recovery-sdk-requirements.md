# Kohaku SDK — Account-recovery requirements

> **Status: v2 (2026-08-20)** — restructured per Fibo's review on [PR #2](https://github.com/FiboAtWonder/kohaku-extension/pull/2). Posture: this document states **what the extension needs from `@kohaku-eth/social-recovery`**, assuming the SDK exists and its methods work. Contract internals (encodings, binding hashes, thresholds, verifier wiring) are the SDK's problem — we consume APIs. Extension-side changes live in `social-recovery-extension-work.md`. Milestone tags (MVP/V1/V2) follow spec decision 79. The investigation facts that shaped v1 are compressed into Appendix A.

## 1 · Working assumptions

- **A1 — Method set.** Passkey, guardians, ZK Email, Anon Aadhaar — all four ship in the MVP (decision 79). The team will very probably replace ZK Email with **zkPassport**; §2.3 carries both, with the email rows tagged *(if kept)* and a zkPassport placeholder pending the decision.
- **A2 — ZK Email mechanic (if kept), assumed working end to end:** the SDK asks the relayer to send the email → the user **replies** to it → the user downloads **their own reply** (`.eml`, e.g. Gmail: Sent → Show original) → uploads it → the SDK proves locally. This is the flow the UX will draw (decision 77 amended accordingly; wireframe updates queued, held while the zkPassport question is open).
- **A3 — Anon Aadhaar works.** The SDK exposes the full lifecycle in §2.3; upstream library health is the kit team's to solve, not a UX constraint.
- **A4 — The SDK owns the on-chain shape.** Path encoding (required rows + M-of-N groups), the recovery binding hash, the 24h waiting-period floor, and owner-only cancel semantics are internal to the SDK/contracts. The extension never sees a preimage or an ABI struct — it sees the path model and prepared transactions.
- **A5 — Division of labor.** The SDK **prepares** (transactions/userops, payloads, proofs, derived data); the extension **signs, broadcasts, stores, and renders**. Every long-running SDK operation is async with progress callbacks and cancellation.
- **A6 — Funding nuance.** The sponsorship question is substrate-specific: on the current Ambire substrate a recovery submission cannot be paymaster-sponsored (it bypasses `validateUserOp`); on a 7579-style 4337 account that validates recovery inside a module, bundler+paymaster sponsorship **is** possible. The SDK hides this behind prepared-tx outputs plus an execution-rail choice; the MVP-safe default is a transaction broadcastable by a plain funded EOA.

## 2 · SDK surface (what the extension needs)

Names are proposals; shapes are requirements. "PreparedTx" = a fully-encoded transaction or UserOperation the extension can sign and broadcast with its own machinery.

### 2.1 Client + host adapters

- `RecoveryClientFactory.create(config)` → `RecoveryClient`; config = chainId, address book, relayer URL, host adapters.
- Host adapters the extension provides: `provider` (EIP-1193/viem reads), `storage` (**async** key-value — the Railgun plugin's sync Storage forced an ugly bridge; do not repeat), `signer` (sign EIP-712/raw payloads by keystore key name — no raw-private-key export).
- The SDK does **not** broadcast. Every write returns PreparedTx(s).

### 2.2 Setup & management (Flows C, G) — MVP unless tagged

| Requirement | Serves |
|---|---|
| `getRecoveryConfig(account)` → set up? · the path (rows+groups) · waiting period. This is the SETUP state — "is recovery configured, and what is it" | B-01 gate, C-01, D-04, G-01 |
| `getPendingRecovery(account)` → none, or: initiated recovery details — who/newOwner, countdown, which methods were satisfied. This is the LIVE-RECOVERY state, distinct from config | D-13, D2-01, G-04, B-03 |
| `prepareSetup(path, waitingPeriod)` → PreparedTx[] — smart-account enablement + recovery install + config, batched to ONE owner confirmation (Q28). This is the Flow C step-8 SAVE, not recovery submission | C-07/C-07e |
| `prepareUpdate(currentPath, newPath)` → PreparedTx — diff-aware single tx; supports editing one value in place (79: "no remove-and-recreate") | G-05/b/c |
| `prepareRemove(account)` → PreparedTx | G-02 |
| `validatePath(path)` — instance uniqueness (76), threshold sanity, ≥24h (74), one-path shape (73); mirrors the contract rules so the builder can block bad saves client-side | wizard + Advanced |
| `evaluate(path)` → FragilityReport (green/amber/red) — powers the meter and honesty copy | C-04*, G-01, F |
| *(V2)* per-account apply helpers: `prepareSetup` re-run per account + fresh per-account method secrets (e.g. accountCode). Iteration/progress UI is extension-side | C-09 family |

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
| **Passkey** | create the credential, report synced vs device-bound (BE flag, decision 38), return credentialId + pubkey | one signed test challenge (user gesture) | sign the recovery intent; output formatted for the on-chain P-256 verifier; cross-device works via the browser's own QR hand-off | environment checks only — no browser API can silently confirm a specific passkey still exists: every real probe opens a system prompt (or, with the Signal API, deletes the credential). So automatic checks can test the environment, and a true test always needs a user click; failures read as "unproven", never "deleted" |
| **Guardian** | address validation: checksum, ENS resolve, contract detection, same-seed check (only for wallet-held seeds) | reachability rehearsal only (52) | `buildApprovalPayload(intent)` → the human-readable EIP-712 payload (MVP: shown raw on the D-07 row for manual signing, decision 79) + `parseApproval(pasted)` → validated claim with the three error classes: malformed / wrong recovery / wrong signer; EOA + ERC-1271 guardians | `code.length`, ENS drift, SCW owner-set drift |
| **ZK Email** *(if kept)* | generate + custody the accountCode (its backup is part of §2.6 — losing it kills the method), derive the salt, register | `requestEmail()` (relayer send) → user replies → `parseEml(file)` on the uploaded own-reply → local DKIM verify; no proof at setup | same pipeline + local proof with onProgress (minutes-scale budget) | DKIM key still valid in the registry |
| **Anon Aadhaar** | QR **image upload** → decode → test proof against the current UIDAI key | same as enroll test | full proof with onProgress (tens of seconds, heavy memory — must be cancellable) | on-chain verifier's UIDAI key hash still current |
| **zkPassport** *(placeholder — pending the team's ZK Email decision)* | same lifecycle contract as above; concrete inputs (NFC scan? document photo?), proof budget, verifier availability and nullifier semantics need a research pass once the direction is confirmed | | | |

### 2.4 Recovery session (Flow D) — MVP

- `startSession(account, newOwner)` → session object. The SDK owns the session **logic** (claim set, satisfaction rules, wipe rules per decision 70); the bytes persist through the extension's storage adapter.
- `session.addClaim(claim)` / `session.progress()` → required rows + per-group M-of-N status (feeds the decision-60 progress grammar).
- `session.prepareInitiate()` → PreparedTx — the recovery submission. Must be broadcastable by a plain funded EOA (A6); a sponsored rail sits behind the same call for substrates that allow it.
- `session.prepareExecute()` → PreparedTx — finalize after the countdown (permissionless).
- `prepareCancel(account)` → PreparedTx — owner cancel (D2, MVP).
- `session.wipe()` — decision-70 triggers.
- Watching for initiated/cancelled/executed recoveries: the SDK provides the **read** (`getPendingRecovery`); scheduling/polling/notifying is extension-side.

### 2.5 Guardian approval payloads

- MVP (79): manual mechanic — `buildApprovalPayload` + `parseApproval` from §2.3 cover it; no hosted page.
- V1: the guardian **page kit** — parse a request link, read on-chain context (nonce), render-and-sign helpers (injected + WalletConnect + offline copy/paste path), approval formatting. Ships as an SDK sub-package the extension serves at a relative path (51).

### 2.6 Secrets & encryption — MVP (Q29/53 is MVP-blocking per decision 79)

- Recovery-password encryption of config values: encrypt at setup, decrypt on the recoverer side, re-encrypt on guardian edits (56); "wrong password never blocks recovery" (48/56) must hold at the API level (a failed decrypt degrades to hidden values, never to an error that stops the flow).
- Backup set export/import: every method secret that exists nowhere else (e.g. ZK Email accountCode, passkey credentialId, the guardian list) — one bundle the UX ties to the recovery password and the dry-run recall row.

## 3 · Constraints the SDK package must meet

- Runs inside an MV3 extension: no `eval`/dynamic codegen (CSP allows `wasm-unsafe-eval` only), WASM artifacts packaged locally or fetched-and-cached with integrity, single-instance WASM safety (or documented locking), all APIs async.
- Long operations (proving) expose progress + cancellation and make no assumption about WHERE they run — the extension chooses the execution context.
- Proof-stack budgets to design against (measured 2026-08-19): circom/Groth16 zk-email-class proofs ≈ minutes + ~1 GB artifacts; Noir/UltraHonk ≈ 4–17 s + MB-scale artifacts but ~6× verify gas and a browser gate ceiling; Aadhaar circom ≈ 20–50 s + ~600 MB + ~1.5 GB peak memory. The stack choice is the kit team's (§4.3); the SDK API must not leak it.
- No backend assumptions beyond the send-only email relayer *(if ZK Email is kept)*; all chain access through the host `provider`.

## 4 · Open questions routed to the kit team

1. **ZK Email vs zkPassport** — confirm the direction; it gates §2.3, the C-05e/D-07e/C-05n wireframes, and the relayer question entirely.
2. Funding/executor (Q7/19) with the A6 nuance: pick the substrate/rail that lets the MVP submission be self-paid, and say whether sponsorship comes with it.
3. Prover stack (with the §3 numbers).
4. Value visibility / encryption scope (Q29/53) — **MVP-blocking** (79).
5. Group encoding with thresholds (T10) and the 24h floor's validation/revert surface (74) — assumed solved per A4; listed for traceability.
6. Guardian payload contents (nonce, policyId in/out) — assumed frozen by the kit per A4; the UX only needs it human-readable and chain-bound.
7. Colibri `p256verify` gap (passkey verification fails verified reads on one RPC provider).

## 5 · Flow → requirement traceability

- Flow A/A1: extension-only.
- Flow B: §2.2 getRecoveryConfig · getPendingRecovery.
- Flow C: §2.2 prepareSetup/validate/evaluate · §2.3 enroll/testAccess (dry run = rehearsal, V1) · §2.6.
- Flow D: §2.4 session · §2.3 createClaim · §2.6 decrypt.
- Flow D2: §2.2 getPendingRecovery · §2.4 prepareCancel.
- Flow E1: §2.5 (MVP manual, V1 page kit).
- Flow F (V2): §2.3 healthCheck · §2.2 evaluate.
- Flow G: §2.2 update/remove/config reads.

## Appendix A · Investigation baseline (2026-08-19, compressed)

Facts from the three-front investigation, kept for reference; none of them change the requirements above, they explain them. Today's contracts (`kohaku-commons`) are Ambire external-signature validators (policy = hash commitment, recovery only via `execute()` sig-mode 255 — the root of A6); the kit design targets a 7579-executor with a `RecoveryClient` layout this document aligns with; no M-of-N primitive, 24h floor, or owner-only cancel exists on-chain yet (A4 items). The Railgun plugin is the extension's precedent for consuming kohaku SDK packages (background controller, packaged WASM, async-storage bridge) — cited as the integration pattern to follow and improve, not the only integration. ZK Email's ecosystem is deployed on Sepolia/Base (registry, verifier, recovery module); the proven email is always one the user sends, hence A2's reply step; accountCode loss kills the method, hence §2.6. The P-256 precompile is live on mainnet + Sepolia (6,900 gas) with OZ `P256.sol` as the dispatch pattern and Safe's passkey module as audited prior art. Passkey portability facts: BE/BS flags are the only reliable signals; provider identity can change invisibly (CXP/CXF); health checks cannot be silent (§2.3). Full detail lives in the PR #2 history (v1 of this document) and the session transcripts.
