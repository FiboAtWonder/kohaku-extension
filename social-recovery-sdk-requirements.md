# Kohaku SDK — requirements from the Account-recovery UX (DRAFT)

> **Status: DRAFT — flow→operations skeleton.** The "what exists / gaps" columns
> are being filled from the code-investigation round (contracts, extension,
> proof methods). Source of truth for the UX: `social-recovery-ux-flows.md`
> (decisions 1–78). Owner: Fibo.
>
> Scope assumptions: ERC-4337 smart account (decision 78; 7702 deferred) ·
> one recovery path per account = required method rows AND any-of M-of-N groups
> (decision 73) · one waiting period, contract-enforced 24h minimum (74) ·
> backend-zero except ONE send-only email relayer (77) · runs inside the MV3
> extension; proving runs locally.

## 0 · Cross-cutting / account infrastructure

| # | Needed from the SDK | UX source | Exists today? | Notes / gaps |
|---|---|---|---|---|
| 0.1 | Detect account type + recovery support (smart account? module installed?) | Flows B, C, G | TBD | |
| 0.2 | **Enable smart account / install the recovery module** — owner-signed, batched with config save (one confirmation, Q28) | Flow C step 8 | TBD | The extension must also expose 4337 account creation/upgrade |
| 0.3 | Read recovery config from chain: path structure (always readable), values (maybe encrypted), waiting period, pending-recovery state | Flows B, D ch1, D2, G | TBD | |
| 0.4 | Encrypt/decrypt config values under the **recovery password** (scheme open — decision 53 / Q29); re-encrypt on guardian edits (56) | C step 6, D-06 family | TBD | Blocked on kit-team encryption-scope choice |
| 0.5 | Chain watcher: detect recovery initiated / cancelled / executed without a backend (polling) | D2, D-13, B-03 | TBD | Powers banner + system notification |
| 0.6 | Path model validation: instance uniqueness (76), group thresholds, 24h waiting floor (74), one-path-per-account (73) | C wizard + Advanced builder | TBD | Client-side mirror of contract rules |

## 1 · Setup (Flow C)

| # | Needed from the SDK | UX source | Exists today? | Notes / gaps |
|---|---|---|---|---|
| 1.1 | Passkey enroll: create P-256 credential, detect synced vs device-bound (backup-eligibility), test-sign a challenge | C-05a/g/h, decision 38 | TBD | |
| 1.2 | Guardian enroll: checksum/ENS/contract-detection/same-seed light checks; optional real signature test (52) | C-05c/f/l, C-05i | TBD | |
| 1.3 | ZK Email enroll + verify-access: request relayer send → parse uploaded `.eml` → verify DKIM locally → derive/store `accountCode` → enrollment commitment | C-05e/k/n, decision 77 | TBD | Relayer API shape needed; Q16 remainder open |
| 1.4 | Aadhaar enroll: test proof against current UIDAI key | C-05d/j | TBD | |
| 1.5 | Dry run: per-method claim generation in local rehearsal mode (no chain) | C-07h–m, decision 47 | TBD | Same code path as recovery claims, flagged rehearsal |
| 1.6 | Config encode + save: path → contract encoding (T10 threshold field) → ONE batched owner-signed tx/UserOp (module install + config) | C-07/C-07e, Q28 | TBD | |
| 1.7 | Recovery Card data: canonical approval-page URL (extension-relative first, decision 51) | C-08 | TBD | |
| 1.8 | Apply to other accounts: per-account re-encode, fresh `accountCode` (R10), one tx per account with progress | C-09/b/c, decision 72 | TBD | |
| 1.9 | Alerts opt-in hook: register the account with the chain watcher (0.5) | C-08, decision 11 | TBD | |

## 2 · Recovery — recoverer side (Flow D)

| # | Needed from the SDK | UX source | Exists today? | Notes / gaps |
|---|---|---|---|---|
| 2.1 | Account lookup by address/ENS → identity card data + config read (0.3) | D-02/b/c/d, D-04 | TBD | Same-install list is extension-side |
| 2.2 | Recovery session: create/persist/resume the claim set locally; wipe on exit/cancel/submit (decision 70) | D-07 family, D-10 | TBD | |
| 2.3 | Passkey claim: sign the recovery payload; platform-synced or hybrid QR cross-device | D-07b/h, decision 17 | TBD | |
| 2.4 | Guardian claim: build the request link/QR payload; validate a pasted approval at paste time (malformed / wrong recovery / wrong signer; EOA ecrecover + ERC-1271) | D-07/f/i, E1 | TBD | |
| 2.5 | ZK Email claim: request send → `.eml` upload → local proof with progress callbacks (~15–60s) | D-07e, decision 77 | TBD | |
| 2.6 | Aadhaar claim: proof generation | D-07l | TBD | |
| 2.7 | Path-satisfaction evaluation: required rows + per-group M-of-N progress | D-07/D-08, decision 60 | TBD | |
| 2.8 | Submit: assemble claims → `initiateRecovery` as a **permissionless direct call from a fresh key** — gas estimation + self-pay fallback | D-11/b, D-12, Q7/19 blocker | TBD | Funding/executor question still open |
| 2.9 | Countdown read + cancellation detection + **execute after timelock** (auto-execute — executor OPEN) | D-13/b, D-14, Q19 | TBD | |
| 2.10 | Post-recovery cleanup: flag methods tied to the lost device (incl. synced-passkey semantics, 50) → edit-config tx (→ 4.x) | D-15/c/d, decision 20/46 | TBD | |

## 3 · Owner side (Flow D2) + guardian page (Flow E1)

| # | Needed from the SDK | UX source | Exists today? | Notes / gaps |
|---|---|---|---|---|
| 3.1 | Pending-recovery detection + request details (enough for the triage: which methods were satisfied) | D2-01/02, decision 66 | TBD | Concurrency question (M10) pending |
| 3.2 | `cancelRecovery` — owner-signed tx | D2-01b | TBD | |
| 3.3 | Guardian page kit (extension-served, relative path — 51): parse request payload from URL, read on-chain context (nonce), build the EIP-712 approval payload, injected + WalletConnect signing, offline sign path (copy payload / paste signature), output formatting | E1-01…08, decision 9/18 | TBD | Exact signed payload with kit team (nonce, policyId?, no expiry) |

## 4 · Management (Flow G) + health checks (Flow F)

| # | Needed from the SDK | UX source | Exists today? | Notes / gaps |
|---|---|---|---|---|
| 4.1 | Edit config: load → diff → validate (member-still-needed, thresholds) → one owner-signed tx | G-05/b/c, G-03/b, decision 45/68 | TBD | |
| 4.2 | Remove recovery entirely (uninstall/clear) — owner tx | G-02 | TBD | `onUninstall` nonce-reset issue (Q20) |
| 4.3 | Health checks (optional capability, 42): passkey silent test-sign · ZK Email DKIM-registry check · Aadhaar UIDAI key check · guardian reachability best-effort | F-01/02, decision 71 | TBD | |

## 5 · Environment constraints the SDK must respect

- MV3 extension: service-worker lifetime, WASM loading under the extension CSP,
  memory limits for in-browser proving (~15–60s ZK Email target).
- Backend-zero except the send-only email relayer (77): no indexer, no proving
  service; chain watching is client polling.
- One chain per policy (15); demo on Sepolia; 4337 stack (78).
- TBD from the extension investigation: bundler/paymaster stack, keystore
  access for fresh-key direct calls, storage/controller patterns (Railgun
  precedent), notification infra.

## 6 · Open questions the SDK contract depends on

Q7/19 funding+executor · Q16 remainder (subject format, accountCode storage,
prover stack/latency, DKIM registry) · Q28 batching · Q29/53 value visibility +
encryption scope · M10 concurrency · T10 group encoding · who runs the
send-only relayer + its failure UX (77).
