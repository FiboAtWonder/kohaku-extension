# Kohaku SDK — requirements from the Account-recovery UX

> **Status: v1 draft for review** — synthesized 2026-08-19 from the UX spec
> (`social-recovery-ux-flows.md`, decisions 1–78) and a three-front code
> investigation (contracts+kit design · extension integration · proof methods).
> Owner: Fibo. Companion asks live on the kit-team Notion page.
>
> Scope assumptions: ERC-4337 smart account focus (78; 7702 deferred — note the
> extension's live smart-EOA path today IS 7702 on Sepolia) · one recovery path
> per account = required method rows AND any-of M-of-N groups (73) · one waiting
> period, contract-enforced 24h minimum (74) · backend-zero except ONE send-only
> email relayer (77) · everything user-side runs in the MV3 extension; proving
> runs locally.

## 1 · What exists today (investigation digest)

**The SDK package does not exist.** `packages/social-recovery` is absent from
the kohaku monorepo; zero recovery code anywhere in it. What exists: a frozen
kit design (Services/Providers/`RecoveryClient` layout, `ValidationService.
evaluate() → FragilityReport`, `initiate/execute/cancelRecovery` +
`add/update/removePolicy` contract API — 23 unresolved threads) and an
undocumented PoC with one dummy method, no timelock, no execute/cancel.

**Two competing substrates.** Today's contracts (`kohaku-commons`) are
Ambire-style external signature validators: the policy is a **hash commitment**
in `privileges[signerKey]`; config travels as calldata; recovery reaches the
account only through `execute()` sig-mode 255 — never through `validateUserOp`,
which is the mechanical root of the funding blocker (Q7/19). The kit design
wants a 7579-executor singleton with plaintext policies. `executeBySender`
(privileged msg.sender, no signature) is the documented bridge. Nothing
deployed: `RecoverySigValidator` has no address anywhere; `DKIM_VALIDATOR_ADDR`
is the zero address.

**Nothing on-chain supports our path model.** No M-of-N threshold primitive
exists in either repo (the T10 threshold concession was never written into the
frozen `RecoveryPolicy` struct); no required-rows-AND-groups shape; no 24h
minimum (zero-second timelocks legal); cancel is wrong-shaped (any single
guardian can cancel — or pre-poison a recovery before it is scheduled; the DKIM
path has no cancel at all); recovery **grants and never revokes** privileges,
and `setAddrPrivilege` is a self-call the wallet's own validation rejects
(patched by selector on a fork branch).

**The extension gives us a proven integration pattern.** The Railgun plugin:
`createPlugin(host, params)`, background controller + React context per
controller, packaged WASM loaded via `browser.runtime.getURL`, single-instance
WASM behind a lock, storage bridged async→sync with load-all/flush. Groth16
BN254 proving already runs in the service worker (ark-circom + ark-groth16 +
wasmer witness calculator). CSP allows `wasm-unsafe-eval`, not `eval`.

**Missing extension primitives:** no fresh-key direct-tx path (every broadcast
needs a registered Account + AccountOp), no WebAuthn/P-256 anywhere, no
file-upload/`FileReader` surface (one dropzone precedent), no camera/QR scan
(fine: cross-device passkey QR is browser-native; Aadhaar QR arrives as an
uploaded image), no generic on-chain event watcher (receipt polling only), no
`offscreen` permission.

**ZK Email ecosystem is live and deployed** (Sepolia/Base: UniversalEmailRecoveryModule,
UserOverrideableDKIMRegistry with oracle+user-override 2-of-N, Groth16
verifier). `accountCode` = random BN254 scalar, generated client-side; **losing
it kills the method** — upstream leaves the relayer DB as the de facto backup.
The guardian email address never touches the chain.

## 2 · Findings that change our decisions (need rulings)

| # | Finding | Impact | Proposed route |
|---|---|---|---|
| R1 | **Decision 77 is infeasible as written** (confirmed from circuit source). zk-email proves the email the user SENDS; identity binds to the `From` header (`accountSalt = Poseidon(from_addr, accountCode)`). A received, relayer-signed email fails the salt check — and a receive-direction circuit would need a new circuit + trusted-setup ceremony and would let the relayer mint recoveries. The standard flow: relayer sends "[Reply Needed]" with a hidden command div → user replies "Confirm" → the **reply** is proven. | UX: one added user step (reply), and the `.eml` the user downloads is their own reply (Gmail: Sent → Show original). Spec 77 + C-05e/D-07e/C-05n need a small amendment. Open sub-question: do all 5 help-sheet clients store the DKIM-signed copy in Sent? | Fibo rules on the UX amendment; sent-copy question joins the Q16 list for Ace 0x |
| R2 | **Anon Aadhaar is not shippable today**: the SDK fails against current QRs (UIDAI key rotated, certs expired, fix PR unmerged, repo unmaintained), 584 MB zkey / ~1.5 GB peak memory, testnet-only verifier, nullifier stability across QR regenerations unproven. | Method availability | Keep Aadhaar in the UX as-is but tag it at risk; route viability (incl. the Noir rewrite option) to the kit team |
| R3 | **The recovery binding hash is unsettled** (with/without `policyId`; four incompatible preimages across design + PoC; only the PoC binds chainId — and zk-email's own layer binds no chainId either). | Everything downstream (contracts, circuits, guardian page payload, SDK) | Kit team must freeze ONE preimage before SDK code exists |
| R4 | **Proving cannot run in the service worker** as-is (blocking calls, no `navigator.credentials` there either) and the extension lacks the `offscreen` permission. Measured stakes (browser, zk-email-class circuits): circom/snarkjs ≈ **3 min after a ~1 GB chunked-zkey download** (worst measured: 12.6 min, 1.75 GB); Noir/UltraHonk ≈ **4.2 s multithreaded / 16.6 s single-thread** at 222k gates with only MB-scale artifacts and no ceremony — but multithreading needs COOP/COEP manifest keys (extension-compatible), bb.js has a ~2^19–2^20 gate ceiling under WASM-4GB, UltraHonk proofs cost ~1.9M verify gas vs Groth16's 319k, and `@zk-email/sdk` local proving is **circom-only today** (Noir plumbing landing). SP1/zkVM: server-only (128 GB RAM). | SDK API must be async with progress callbacks; extension needs an `offscreen` document (the only MV3 host fit for multi-minute jobs) + COOP/COEP keys | Extension work item; prover-stack choice routes to the kit team with these numbers |
| R5 | **Passkey health checks cannot be silent** (no API reveals credential existence; every probe is modal or destructive). Flow F for passkeys = environment checks only; a real test needs a user gesture. | Flow F copy already says "offered, not enforced" — compatible; the meter must treat failures as "unproven", never "deleted" | No UX change; encode in SDK semantics |
| R6 | **Funding is still the blocker, now sharper**: externally-validated recovery cannot go through `validateUserOp`, so no paymaster can sponsor it on the current substrate; the old DKIM+4337 escape hatch survives only in deployed bytecode, deleted from source; extension consts declare no 4337 rails on Sepolia. | D-11 submit | SDK must ship the self-pay fresh-key rail FIRST, with a sponsorship rail behind an interface; the ownership question stays with the kit team (Q7/19) |

## 3 · Proposed SDK surface (what the extension needs)

Aligned with the kit's decided layout (`RecoveryClient` + Services +
Providers). Names are proposals; shapes are requirements.

### 3.1 Client + host adapters

```
RecoveryClientFactory.create(config) → RecoveryClient
config: { chainId, addressBook, hostAdapters, relayerUrl }
hostAdapters (provided by the extension):
  provider        — EIP-1193 / viem-compatible reads
  storage         — ASYNC key-value (lesson: the Railgun Host's sync Storage
                    forced a load-all/flush bridge; do not repeat)
  broadcaster     — TWO rails: (a) accountOp rail for owner-signed writes,
                    (b) freshKey rail: sign+send a direct tx from an ephemeral
                    key with gas estimation and self-pay  ← DOES NOT EXIST in
                    the extension today; must be built alongside the SDK
  signer          — sign EIP-712 / raw payloads with a named keystore key
                    (deriveAt-style raw-key export is NOT acceptable here)
  workerHost      — where proving runs (offscreen document / extension page),
                    async with onProgress
```

### 3.2 Account service (Flows B, C, G)

| Method | Serves | Notes vs today |
|---|---|---|
| `getRecoveryState(account)` → installed?, path, waitingPeriod, pendingRequest | B-01 gate, C-01, D-04, G-01 | Needs a config-readback story: on the Ambire substrate config is a hash commitment — the SDK must define where the plaintext path lives (see §4 encryption) |
| `enableRecovery(path, waitingPeriod)` → prepared tx batch | C step 8 | ONE batched owner confirmation (Q28): smart-account enablement (deploy/7702 delegate/4337 as ruled) + validator wiring + config. On Ambire: `setAddrPrivilege` self-call — the CALL_TO_SELF wallet check needs a real fix, not the selector bypass |
| `updateRecovery(diff)` / `removeRecovery()` | G-05, G-02, D-15 cleanup | Diff-aware; one owner tx (68); removal always legal (unprotected warning is UX) |
| `applyToAccounts(accounts, path)` | C-09, decision 72 | Per-account re-encode, fresh accountCode per account (R10), per-account progress |

### 3.3 Policy domain (pure, no I/O)

- `validatePath(path)` — instance uniqueness (76), group threshold sanity,
  ≥24h waiting period (74), one-path shape (73). Mirrors contract rules.
- `evaluate(path) → FragilityReport` — the kit's decided green/amber/red rules
  (OrthogonalTrustRoots, NoSameSeedGuardians — decidable only for wallet-held
  seeds, MinAvailability). Powers the honesty copy and the meter (Flow F).
- `encodePath/decodePath` — ↔ contract encoding. **Blocked on T10/R3**: the
  frozen struct has no threshold field; our model needs required-rows + groups.

### 3.4 Method providers (one interface, four implementations)

```
interface RecoveryMethod {
  enroll(params, opts) → EnrolledMethod
  testAccess(enrolled, { rehearsal }) → TestResult      // C-05 tests + C-07 dry run
  createClaim(enrolled, intent, { onProgress }) → Claim  // D-07 rows
  healthCheck(enrolled) → HealthResult                   // Flow F, unattended half only
}
```

| Method | enroll | testAccess | createClaim | healthCheck (unattended) |
|---|---|---|---|---|
| **Passkey** | create credential (extension page, not SW), read BE/BS flags for synced/device-bound (38); store credentialId + pubkey (x,y) | `get()` with gesture, verify locally | sign recovery payload; format for on-chain P-256 (OZ `P256.sol` progressive: RIP-7212/EIP-7951 `0x100`, Daimo fallback); `flags & 0x05 == 0x05`; clientDataJSON origin is `chrome-extension://<id>` — verifier must accept it; cross-device = browser-native hybrid QR | environment probes only (R5) |
| **Guardian** | address checks: checksum, ENS resolve, `code.length`, same-seed (wallet-held seeds only); optional signature test (52) | reachability rehearsal (47/52) | build request link/QR payload; `parseApproval(paste)` → validate via the existing deployless `verifyMessage` (ecrecover + 1271 + 6492) with errors: malformed / wrong recovery / wrong signer | `code.length`, ENS drift, SCW owner-set drift |
| **ZK Email** | generate accountCode (CSPRNG Fr — SDK must own backup/custody, see §4), derive accountSalt, register | relayer send → user replies (R1) → upload own-reply `.eml` → parse (browser-safe parser; the Node-only `libs/dkim` parser cannot run under the webpack config) → verify DKIM locally. No proof at setup | same pipeline + local Groth16 proof with onProgress (minutes-scale budget; zkey size pushes toward the Noir option — R4) → `EmailAuthMsg`-shaped claim | DKIM key hash still valid in the registry |
| **Aadhaar** | QR **image upload** → jsqr decode → test proof against current UIDAI key | same | full proof (~20–51 s measured, ~1.5 GB peak — R2) | on-chain verifier's UIDAI key hash still current |

**Passkey facts the SDK must encode** (verified against WebAuthn L3 + Chromium
source): synced/device-bound detection (38) = the **BE flag (0x08)** — immutable,
read once at registration; **BS (0x10)** is the live backed-up state, re-read on
every assertion (GPM hardcodes BE=1/BS=1, so "syncable but not yet synced" is
undetectable). Store the AAGUID verbatim at registration — platform and hybrid
registrations keep the real AAGUID even under `attestation:"none"` (security
keys get zeroed); the community AAGUID list gives display names only. CXP/CXF
migration is invisible to us — the recorded provider can go stale silently, so
copy must never promise "lives in iCloud". Hybrid QR: fresh scan every ceremony
(Chrome removed paired phones), needs Bluetooth on + one extra click, and the
timeout is clamped to a 3-minute minimum. **Open risk to test first: whether
phones accept `chrome-extension://<id>` as the RP ID over hybrid** — unverified;
fallback is claiming a real domain RP ID via host_permissions + Related Origin
Requests.

### 3.5 Recovery session (Flow D) + owner side (D2) + guardian page (E1)

- `startSession(account, newOwner)` → persisted, resumable session; claim
  store with the decision-70 wipe rules (exit/cancel/submit).
- `session.addClaim / progress()` — required rows + per-group M-of-N
  satisfaction (feeds the decision-60 grammar).
- `session.submit()` — assemble claims → initiate. **Self-pay fresh-key rail
  first** (R6); sponsorship rail behind `IExecutionRail`.
- `session.status()` / `execute()` — countdown read, cancelled terminal state,
  permissionless execute after maturity (kit-consistent; ruling still tentative).
- `watchRecovery(account, cb)` — polling watcher (receipt/log polling; no
  backend). Powers D2 banner + system notification and B-03. NEW infra.
- `getPendingRecoveryDetails(account)` — enough for the D2-02 triage (which
  methods were satisfied).
- `cancelRecovery(account)` — owner tx. **Contract gap: owner-only cancel with
  correct semantics exists nowhere today** (guardian-cancel + pre-poisoning in
  `RecoverySigValidator`; no cancel in the DKIM path).
- Guardian page kit (extension-served, 51): `parseRequest(url)`,
  `readOnchainContext` (nonce), `buildApprovalPayload` (EIP-712 — plaintext
  fields so hardware wallets display the real newOwner; preimage blocked on
  R3), injected + WalletConnect + offline sign path, `formatApproval`.

### 3.6 Secrets & encryption

- Backup set (kit-decided): `accountCode`, passkey `credentialId`, guardian
  list. The SDK must expose export/import of this set; the UX ties it to the
  recovery password + dry-run recall row (48/56).
- Recovery-password encryption of config values: scheme blocked on 53/Q29 —
  note the substrate tension: Ambire's commitment model hides values but makes
  the plaintext bytes load-bearing (lose them = path unreachable); the kit
  design stores plaintext on-chain. Whatever wins, the SDK owns
  encrypt/decrypt/re-encrypt (guardian edits re-encrypt under the same
  password, 56) and the "wrong password never blocks recovery" rule.

## 4 · Extension work items (not SDK, but required)

1. Fresh-key broadcast rail (sign+send direct tx, gas estimate, self-pay) —
   nothing usable exists (`KeystoreSigner.sendTransaction` is uncalled and
   provider-less).
2. Offscreen document (or dedicated extension page) for proving and WebAuthn;
   add the `offscreen` permission. WASM behind a single-instance lock
   (Railgun lesson).
3. File-upload surface (`.eml`, Aadhaar QR image) — one `react-dropzone`
   precedent exists.
4. Recovery polling watcher wired to banners (`BannerCategory` + `Action`
   unions need new members; `maxBannerCount = 1` — pending recovery must win),
   system notifications, and the badge.
5. `StorageProps` keys + migration for drafts, sessions, backup set;
   keep-alive interplay for long proofs; auto-lock (1-day default) vs
   multi-day waiting periods.
6. Port-messaging targeting fix: `PortMessenger.send` broadcasts to every
   port — recovery secrets (.eml material, approvals, challenges) must not.
7. CALL_TO_SELF exemption done properly for `setAddrPrivilege`.
8. Sepolia consts currently declare no 4337/paymaster/bundler support —
   align with whatever the funding ruling is.
9. Passkey ceremonies must run in a **full extension tab** (or options page):
   the action popup is destroyed on focus loss and `create()` is
   focus-checked — a QR hand-off kills it. WebAuthn from extension pages
   works since Chrome 122 (rp.id = the extension id, rewritten to
   `chrome-extension://<id>`). **Day-one test:** hybrid QR against real
   iOS/Android with that RP ID; if rejected, fall back to a domain RP ID via
   host_permissions + Related Origin Requests.

## 5 · Asks to the kit team (delta vs the existing asks page)

1. **Freeze the binding hash** (R3): one preimage, with chainId, policyId
   in/out decided.
2. **T10 threshold field + required-rows-AND-groups encoding** — our decision
   73/75 model cannot be expressed by the frozen struct.
3. **24h minimum on-chain** (74) — currently declined (T13); we require it.
4. **Owner-only cancel semantics** + fix guardian pre-poisoning.
5. **ZK Email direction** (R1): confirm reply-based flow + who runs the
   send-only relayer + accountCode custody (loss kills the method; upstream's
   de facto backup is the relayer DB — collides with backend-zero).
6. **Aadhaar viability** (R2) incl. the Noir path and nullifier stability.
7. **Prover stack** (R4), with measured numbers: circom/ark (local Railgun
   asset; deployed zk-email verifiers; ~1 GB zkey downloads, minutes-scale
   browser proofs) vs Noir/UltraHonk (4–17 s browser proofs, MB artifacts, no
   ceremony; but ~6× verify gas, a 2^19–2^20 browser gate ceiling, SDK local
   proving not yet enabled, and no Aadhaar Solidity verifier).
8. **Funding/executor** (Q7/19) with the new fact: paymaster sponsorship is
   structurally impossible through `validateUserOp` on the current substrate.
9. Colibri `p256verify` gap (passkey paths fail verified eth_call on one of
   the two RPC providers).

## 6 · Flow → requirement traceability

Flow A/A1: extension-only (key creation) — no SDK surface.
Flow B: §3.2 getRecoveryState · §3.5 watchRecovery.
Flow C: §3.2 enable/apply · §3.3 all · §3.4 enroll/testAccess (dry run =
testAccess rehearsal) · §3.6 backup + password.
Flow D: §3.5 session/submit/execute · §3.4 createClaim · §3.2 getRecoveryState.
Flow D2: §3.5 watch/details/cancel.
Flow E1: §3.5 guardian page kit.
Flow F: §3.4 healthCheck (R5 limits) · §3.3 evaluate for the meter.
Flow G: §3.2 update/remove · §3.3 validate · §3.5 pending-state reads.
