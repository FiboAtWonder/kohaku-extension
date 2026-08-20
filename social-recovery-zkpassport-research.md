# zkPassport — research findings for Account recovery

> Research date **2026-08-20**. Commissioned by decision 80 (zkPassport replaces ZK Email) to unblock the C-05/D-07 redraw. Method: three parallel Opus 5 research fronts — (A) user mechanics and device constraints, (B) cryptography, trust anchors and integration surface, (C) repo-side impact inventory. Fronts A and B worked from live primary sources (zkpassport.id, docs, the GitHub org, npm, app-store metadata) and from **live chain state read by `eth_call`**; front C worked from this repo. The raw fronts are appended verbatim as appendices, with a confidence label and a source URL on every claim: VERIFIED (primary source or chain read) · OBSERVED (docs/code/store metadata) · INFERRED (our reasoning) · UNKNOWN.
>
> Scope note: this document answers "what would it cost us, and what breaks" — it does not re-open decision 80. The ruling stays with Fibo.

## Verdict

**zkPassport works, and it is impressive engineering, but as a *recovery* method it has three structural problems that our other methods do not have.** Recovery is the feature you use rarely, years later, under stress. zkPassport's guarantees are strongest for one-shot checks — age, nationality, sanctions, personhood at signup — and weakest exactly where recovery lives: durability over years, revocability after theft, and independence from a vendor's live infrastructure.

Ranked by how much they threaten the MVP:

| # | Finding | Why it matters for recovery | Confidence |
|---|---|---|---|
| 1 | **The enrolled identifier dies with the document.** The nullifier hashes the passport's SOD signature, so a renewed passport yields a different identifier; and expiry is asserted *in-circuit* (`"Document is expired"`), so an expired document cannot prove at all. | Every enrolment carries a silent ceiling of one document lifetime (≤10 years, less for minors). A user who renews their passport — the single most normal thing to do with a passport — **loses recovery without being told**. Nothing links an old document to a new one. | VERIFIED (circuits) |
| 2 | **A proof does not prove presence, and no document can be revoked.** Passive Authentication only: no Active/Chip Authentication (commented out in the reader). The revocation tree exists, is committed into the published root, and is **empty and unwired** — no in-circuit non-membership, no CRL, no OCSP. | One historical chip dump is enough, forever. Someone who copied the chip once can start a recovery on our account, and neither we, nor zkPassport, nor the issuing country can revoke that specific document. FaceMatch `strict` is the only mitigation — and it is a closed-source, device-attestation-gated check. | VERIFIED (circuits, chain) |
| 3 | **The trust anchor is one unprotected EOA.** `0x1F08b2613Cb12dD38E5c449C6033300a61E67250` is the sole writer of the CSCA merkle root: no timelock, no quorum, no provenance check, guardian unset, instant effect on three chains. Its nonce equals `rootCount`, so that one key made all 27 updates. | A compromise of that key mints a proof matching **any** nullifier we have enrolled — i.e. forges a recovery on any account protected by this method. Our own 24h waiting period is the only remaining brake. | VERIFIED (chain reads) |

Three further facts shape cost rather than safety:

- **No external audit, and the circuits are not frozen.** The SDK README says so verbatim ("it has not yet had an external audit"); there is no bug bounty; a scope-forgery gap in exactly the binding we would rely on was closed two weeks ago (circuits PR #152, 2026-08-06). One real soundness bug was found by an outsider. Both `zkpassport-packages` and `cloud-prover` ship **without a LICENSE file**. [VERIFIED]
- **Backend-zero is not achievable.** A closed-source WebSocket relay (`wss://bridge.zkpassport.id`) is mandatory; registry roots are read over an Ethereum RPC (the SDK ships a *shared hardcoded* Alchemy key we must replace); and the evidence on SRS sizes says the **`compressed-evm` proof we need is produced in zkPassport's cloud prover** (~84 s, 16 vCPU/64 GB spot nodes, ~6 concurrent, one zone). On-chain verification measured at **~0.93–1.0M gas** on mainnet — though `verify` is `view`, so our own checks can be a free `eth_call`. [VERIFIED / OBSERVED]
- **A separate ~455 MB app install is mandatory today.** Browser proving exists only as an unmerged draft PR (#243); iOS App Clips are "rolling out"; white-label is enterprise roadmap. The wallet cannot host the prover. [VERIFIED]

**And one go/no-go that outranks everything above: it is unverified that this works from a browser extension at all.** The scope model hashes an `https://` domain and the app validates the request origin against a registered domain; an extension presents `chrome-extension://<id>`. A closely related bug (issue #211) already makes Node usage fail **silently** — the confirm control stays disabled and `onError` never fires. This must be prototyped before any screen is drawn. [INFERRED from VERIFIED code]

## What the user actually does

The shape of the flow, which is what the wireframes must encode:

1. **Enrolment, once per document.** Install the ZKPassport app → camera-scan the MRZ (or type document number, birth date, expiry by hand) → **tap the phone to the chip** and hold still → the app stores the encrypted ID locally and generates 3 base proofs (**10–50 s**, algorithm- and device-dependent) → the ID is cached for reuse.
2. **Each later verification.** Our surface shows a **QR code or deep link**; the phone app receives the request over the bridge, produces a disclosure proof from the cached ID (**<1–10 s**), and returns it. The physical document is **not** needed again.
3. **For an on-chain-verifiable proof** — which is what a recovery module needs — the outer `compressed-evm` proof is produced in the **cloud prover at ~84 s**. Third-party field observation of the whole round trip: "consistently under a minute" (Safe Foundation research).

Constraints that change our screens:

- **Documents:** ICAO-9303 passports, national IDs and residence permits whose issuing country publishes signing certificates; "130+ countries" claimed. **No NFC chip = unusable**, with no photo-only fallback. Two distinct unsupported states exist: missing country certificate (the ID is saved and may work later) and unsupported signing algorithm (never).
- **Platform:** iOS 15.2+ and Android, both public. iPhone NFC can need Wi-Fi/airplane-mode toggling to avoid interference; Android needs NFC switched on in system settings; FaceMatch is less reliable on Android and refuses on rooted/attestation-failing devices.
- **Failure taxonomy is rich and physical:** MRZ unreadable (→ manual entry), chip not detected, connection lost on any movement (**3 attempts max**), RF-shielded passport cover, worn/damaged chip, PACE→BAC fallback, unsupported issuer or algorithm, expired document, FaceMatch refusal or timeout. Phone cases are the standard second-attempt advice.
- **The phone matters.** The enrolled ID and its derived keys live in that app's local store, protected by Face ID/Touch ID; no documented cloud backup or cross-device sync. A lost phone means re-scanning the document — recoverable, unlike a device-bound passkey, because the document is the credential.
- **Telemetry:** the app POSTs per-verification activity (`requestId`, `domain`, `scope`, status, duration) to `dashboard-api.zkpassport.id`, and the dashboard retains proofs as an audit trail. No PII, but it sits against the "no data is stored on ZKPassport servers" claim. The iOS listing averages **2.86 over 14 ratings** — a small sample, but not a smooth-onboarding signal.

## What we would enrol, and how it breaks

- **Enrol one `bytes32`:** the `scoped_nullifier`, returned as `uniqueIdentifier`. Derivation: `private_nullifier = Poseidon2(DG1 ‖ eContent ‖ SOD_signature)`, then `scoped_nullifier = Poseidon2(private_nullifier, service_scope, service_subscope)`.
- **We control a two-level scope:** `service_scope = sha256(our domain)`, `service_subscope = sha256(our scope string)`, both enforced on-chain. **A distinct scope string per account gives a distinct, mutually unlinkable identifier per account** — the direct analogue of the per-account secret we wanted from ZK Email's `accountCode`. Note it is a *public* domain separator, so it must be stored or derived deterministically, not remembered.
- **Never key recovery on a dashboard policy.** `.policy(id)` locks the scope to `<policy-id>:<version>`, so bumping a policy version **rotates every user's identifier** and silently orphans every enrolment.
- **Replay protection is our job.** `verify` is a stateless `view` — the same proof bytes verify repeatedly inside the validity window (SDK default 7 days; the caller chooses it). We must store consumed nullifiers or bind a per-attempt nonce. `bind("custom_data", …)` is our nonce channel (≤500 bytes total bound data, ASCII).
- **Root freshness:** live mainnet config is `VALID_WITHIN_WINDOW` with a **24 h** window. A proof on the newest root never ages out; a proof on a superseded root dies 24 h after replacement. Fine for live recovery — but a proof **cannot** be pre-generated and stored as a break-glass artifact.
- **Privacy is a choice between two imperfect options.** The default identifier is recomputable by anyone holding the chip data — explicitly including the issuing government. The salted alternative removes that, but **requires `.facematch("strict")`**, adds a live vOPRF network (3 nodes, threshold 2, all EU, one operated by Aztec Labs — zkPassport's own owner, so vendor+1 reaches the threshold), and is pinned to a **single global OPRF key** that `admin` can rotate: if it rotates, previously enrolled salted nullifiers stop verifying.
- **Liveness risk:** verification can be paused at three independent layers (`RootVerifier.pause`, `SubVerifier.setPaused`, `RootRegistry`), any one of which makes **every** recovery attempt fail. None is paused today; `guardian` is unset. The certificate registry's newest root is **105 days old** (2026-05-06), which is unexplained.

## Answers to the gates the impact inventory raised

Front C listed ten gates that block any Pen prompt. The research closes seven:

| Gate | Answer |
|---|---|
| **B1 — what the user physically presents** | A **hand-off to the zkPassport phone app**: our surface renders a QR/deep link, the phone scans (enrolment) or replays a cached ID (later), the proof returns over the bridge. Desktop Chrome cannot read NFC, so this is **not** a redraw of one screen — it needs a QR + waiting/progress + return sub-flow, i.e. **2–4 new screens**. |
| **B2 — failure taxonomy** | Rich and physical (see above). C-05k survives but is **re-authored**: its `.eml`-specific copy ("not the original message", "a forward or a copy") dies entirely. Add bridge-disconnect and cloud-prover-timeout states, which the `.eml` flow never had. |
| **B3 — is a help sheet still needed** | **Yes, but a different sheet.** C-05n is **replaced, not deleted**: "which documents work" + "turn on NFC" + "take the phone case off" + the iPhone Wi-Fi/airplane tip + open the passport to the photo page. So the 17 C-05n referrers resolve to a rename, and the MVP screen budget stays ~76. |
| **B4 — can the enrolment test be local, no chain** | **No.** Registry roots come over an Ethereum RPC, the bridge is mandatory, and the EVM-mode proof is cloud-produced. The spec's "Local only, no chain" promise **cannot hold for this method** — it needs its own honest line. |
| **B5 — nullifier / linkability semantics** | One identifier per **document** per (domain, scope) — the docs say the bound is "one ID ↔ one account", not one person. With per-account scopes, one passport can back several accounts unlinkably. So a picker holding two instances is legitimate only if they are two different documents. |
| **B6 — is the credential device-bound** | **Not in the passkey sense.** The cached ID is phone-local with no sync, but the *document* is the credential — a new phone plus the passport restores it. D-15's "not tied to the lost device" logic therefore survives, with a re-scan caveat. |
| **B7 — trust root for the health check** | The on-chain certificate-registry root (CSCA merkle root, 24 h validity window, single-EOA writer). A check means producing a fresh proof, which needs the app and the bridge — so a **silent background check is impossible**; it is a user-gesture test, consistent with decision 83. The `M34 DKIM-rotation` deferral is re-pointed, not deleted: the analogue is registry-root staleness and the paused-verifier case. |

Still needing a Fibo ruling, unchanged: **B8** the preset name ("Your device + your ID"?), **B9** the method's display name and the value fixture that replaces `f•••@gmail.com` — a passport number must never be shown — plus **B9b** one "Government ID" method card with a document picker versus separate zkPassport and Aadhaar rows, and **B10** whether the two known-stale strings get patched now or in this round.

## Prior art already in the repo

`social-recovery-ux-assets/prototype-demo.html` already contains a **complete passport flow**: a 4-step Government ID wizard with a `🛂 Passport · NFC chip · COMING SOON` row, a recovery screen (`Scan your passport` → `Reading passport chip… → Verifying issuer signature… → Generating ZK proof…`), and the value fixture `Passport no. •••••••• 🔒 hidden`. It answers B9 for free — but note its central assumption is **wrong for zkPassport today**: it has the wallet device reading the chip directly. The real flow hands off to a separate app. Useful for labels and value fixtures; misleading for the journey.

## Blast radius if we proceed

From the repo inventory (appendix C). The earlier working estimate of "four screens" was wrong by an order of magnitude.

| Surface | Count |
|---|---|
| Wireframes | **52 MAIN screens** carry email content (of 131 MAIN wrappers); 27 more sit in `Flow · OUTDATED` and need no work. **9 purpose screens** (C-05e, C-05k, C-05n, D-07e mechanic-only; C-03c, C-04b, C-07g, C-07k, D-07c shape-identity) plus C-06 as preset identity. **6 frame renames** in MAIN. |
| Spec | 26 lines (11 stale prose, 2 mermaid nodes, the Milestones row, 5 decision rows) |
| Demo | 19 steps + 2 persona bios; 6 `screen` keys; 1 hotspot label |
| Deck | 17 lines across 8 slides, plus `ui-patterns.svg` (3 lines) |
| Status doc | 11 lines, including the wireframe filename table |
| C-05n referrers | 17 across 6 files |

Sequencing that the inventory proves necessary: rename the 6 frames **first** (demo keys and the status doc's table derive from them), then the global string swap, then delete the 4 dead design notes, then redraw the purpose screens, then the F band, then X-02. **Do not split the Pen round** — those steps touch the same 52 screens, and the demo re-export can only run once against settled frame names.

## Recommendation

**Do not ship zkPassport as an MVP recovery method on this evidence.** The blocking reason is not the friction or the cost — it is finding 1, the silent ~10-year ceiling with no renewal path, compounded by finding 2, an unrevocable credential. A recovery method whose enrolment expires without warning, and which a one-time chip copy can use forever, is worse than the honest floor we already ship (a single passkey, with copy that says what it protects).

Four options, in the order I would consider them:

1. **Move zkPassport to V1 and gate it on mitigations.** MVP ships passkey + guardians (+ Aadhaar if it survives its own R2 finding). zkPassport arrives with: an extension prototype that proves the origin/scope model works, expiry surfaced everywhere (management, health check, an expiry countdown, a re-enrol prompt before the document dies), salted nullifiers, per-account scopes, and consumed-nullifier storage. **This is my recommendation.**
2. **Keep it in MVP but constrain its role** — never a required row, only a group member, so its failure can never be the sole path to an account; plus the same expiry mitigations. Cheaper on the roadmap, but it still puts an unrevocable credential into the MVP.
3. **Reconsider the swap.** Front B notes the asymmetry plainly: ZK Email has five audits and deployed ERC-7579 modules; the only passport recovery module that exists is Safe Research's unaudited Sepolia demo. If the reason for decision 80 was ZK Email's `.eml` friction, that trade now looks different.
4. **Ship neither as MVP** and let MVP be passkey + guardians, with the ZK-ID family as the V1 headline. Smallest MVP, and it makes the "all 4 methods" constraint a V1 promise instead.

Whichever way it goes, two things are true: the **extension-origin prototype must run before any screen is drawn**, and the Pen round must be single-shot over 52 screens rather than the four-screen patch we assumed.

## Questions to route outward

**To the kit team / Ace 0x:** does the recovery module store a consumed-nullifier set, or must the wallet? Is ~1M gas per verification acceptable inside `initiateRecovery`? Who owns replacing the SDK's shared Alchemy key? And does the module's own timelock interact with the registry's 24 h root-validity window?

**To zkPassport (if we proceed):** does the flow work from a `chrome-extension://` origin? Is there any renewal path linking an old document identifier to a new one? What is the OPRF key-rotation policy, given that a rotation orphans salted enrolments? Why is the certificate registry 105 days stale? What are the LICENSE terms for `zkpassport-packages` and `cloud-prover`? And is the cloud prover optional for `compressed-evm`, or required?

---

# Appendix A — user mechanics and device constraints (raw front)

Research date: 2026-08-20. Live sources treated as authoritative. Labels: VERIFIED = stated by zkPassport primary source (site/docs/own repo); OBSERVED = read in docs, code or store metadata; INFERRED = my reasoning; UNKNOWN.

Version snapshot at time of research: `@zkpassport/sdk` and `@zkpassport/ui` 0.16.2 (published 2026-08-20), `@zkpassport/utils` 0.37.5, mobile app 1.3.1 (iOS updated 2026-07-24, Android updated 2026-07-23), app circuit version constant `0.20.0`.

## 1. Enrollment — step by step, and which surface

- The verifying surface is a **web page + QR code / deep link**; the proving surface is the **ZKPassport native mobile app**. The SDK's `done()` returns a `url` of the form `https://zkpassport.id/r?d=<domain>&t=<requestId>&c=<config>&s=<service>&p=<pubkey>&m=<mode>&v=<sdkVersion>&dt=<ts>&dev=0`, which the integrator renders as a QR code or a link. [OBSERVED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/zkpassport-sdk/src/index.ts]
- There is no browser-based prover today. A **draft, unmerged PR** adds one: `feat: browser proving and saved IDs (restore enrollment)` (PR #243, opened 2026-08-05, still draft, 27 files, author `saleel`). Until it lands, every proof requires the installed native app. [OBSERVED — https://github.com/zkpassport/zkpassport-packages/pull/243]
- zkPassport itself states the app install is currently unavoidable and branded: "Today, yes; users install the ZKPassport app to scan their document. We're rolling out iOS App Clips so the scan can happen inline in your flow without a separate install. White-label is on the roadmap for enterprise customers." [VERIFIED — https://zkpassport.id]
- Official 3-step description: "1) Choose ID … 2) Scan your ID - Scan the document with your camera, then tap your phone to read the chip 3) Verify instantly". [VERIFIED — https://apps.apple.com/us/app/zkpassport/id6477371975]
- **Both an optical scan and an NFC chip read are required.** The optical step reads the MRZ; the MRZ (document number + date of birth + date of expiry) is the key that unlocks the encrypted chip session. "That decryption key is derived from the data of the Machine Readable Zone (MRZ) … Specifically, it is derived from the Document Number, the Date of Birth and the Date of Expiry". [VERIFIED — https://github.com/zkpassport/circuits]
- If the camera cannot read the MRZ, the app offers **manual MRZ entry** ("Enter Manually" → expiry date, birthdate, document number). This is a genuine fallback, not an error path. [VERIFIED — https://docs.zkpassport.id/faq]
- In-app enrollment screens, in order (from the app's own strings): onboarding modal ("Scan once, verify faster" / "One-time ID scan" / "Reuse without rescanning") → accept Terms + Privacy → "Get ready to scan" per document type → MRZ camera scan (or manual entry) → review/edit parsed MRZ → NFC modal "Ready to scan" → "Hold still" (authenticating) → progressive reads (Common Data, MRZ, Photo, Portrait, Signature, Security options, Public key, Security Data) → "Saving ID … your ID gets encrypted and saved locally to your device" → base proofs generated. [OBSERVED — https://github.com/zkpassport/mobile-app/blob/main/src/i18n/locales/en.json]
- Physical placement instructions differ by document: passport = "Open your Passport to the photo page and place it face up on a flat surface"; national ID and residence permit = "Place the back of your … on a flat surface with good lighting". [OBSERVED — https://github.com/zkpassport/mobile-app/blob/main/src/i18n/locales/en.json]
- **Both iOS and Android are supported**, as public store listings (not TestFlight/beta): iOS min OS 15.2, 455 MB, free, publisher "Obsidion Labs Limited", first released 2025-06-03; Android first released 2025-05-29. [VERIFIED — https://apps.apple.com/us/app/zkpassport/id6477371975 and https://play.google.com/store/apps/details?id=app.zkpassport.zkpassport]
- Platform-specific NFC caveats: on **iPhone**, "if connection to the chip keeps on failing … a workaround can be to disable temporarily WiFi or even turn on airplane mode to prevent any interference with the NFC communication channel". On **Android**, the app must prompt the user to switch NFC on in system settings ("Turn on NFC to continue … Settings > Connections > NFC"). [VERIFIED — https://docs.zkpassport.id/faq ; OBSERVED — mobile-app en.json]
- Private FaceMatch (the optional liveness/selfie step) is **more restricted on Android than iOS**: iPhones "support face scanning reliably; Android devices may refuse scans on devices considered untrustworthy". FaceMatch shipped for iOS in SDK v0.9.0 and for Android only in v0.10.0. [VERIFIED — https://docs.zkpassport.id/limitations and https://docs.zkpassport.id/changelog]
- The app **cannot be developed or tested on the iOS simulator** ("Make sure to run the app on an actual device as the simulator is not supported by the app") — relevant if a wallet team wants automated end-to-end tests. [OBSERVED — https://github.com/zkpassport/mobile-app#readme]

## 2. Which documents work

- Supported document classes: **passports, national ID cards, and residence permits** that comply with ICAO 9303 — i.e. "most modern electronic IDs with NFC capabilities". The app's document picker offers exactly those three types. [VERIFIED — https://docs.zkpassport.id/faq ; OBSERVED — mobile-app en.json `passportView.documentType.*`]
- Hard requirement beyond the standard: **the issuing country must publish its signing certificates.** "Only passports, national IDs, and residence permits that comply with ICAO 9303 standards whose issuing country publish their signing certificates are supported." [VERIFIED — https://docs.zkpassport.id/limitations]
- Coverage claim: "Reads NFC chips on government IDs across **130+ countries**." Aztec's case study (Jun 2025) said "over 120 countries", so the number is growing. [VERIFIED — https://zkpassport.id ; VERIFIED (secondary, dated) — https://aztec.network/blog/zkpassport-case-study-a-look-into-online-identity-verification]
- The authoritative live list is the **certificate registry explorer / coverage map**, with tabs for Map, Certificates, Certificate Roots, Circuit Roots, Overview. Recent additions called out in the docs: "Indian passports and EU National IDs". [VERIFIED — https://registry.zkpassport.id/map and https://docs.zkpassport.id/limitations]
- How the list is maintained: CSCA (country root) certificates are collected from the **ICAO Master List** and from countries that publish them on their own sites, then committed as roots into an on-chain **ZKPassportRegistry** (certificate roots + circuit roots), which the SDK and app read. DSCs come from the chip itself. CSCA certs rotate every 3–5 years, DSCs every few weeks/months. [VERIFIED — https://github.com/zkpassport/circuits ; OBSERVED — https://registry.zkpassport.id/overview and https://github.com/zkpassport/zkpassport-packages/issues/253]
- **Documents without an NFC chip are simply unusable.** App error copy: "This ID doesn't contain an NFC chip, so it can't be used with this app." There is no OCR-only or photo-of-document fallback. [OBSERVED — mobile-app en.json `eventPage.description.docNotSupported`]
- Two distinct "unsupported" states after a successful chip read: (a) missing country certificate — "This document isn't supported yet due to missing information from the issuing authority. We've saved it in the app anyway, keep an eye on the app for updates"; (b) unsupported crypto — "Unfortunately your ID uses a signing algorithm that we don't support yet." In case (a) the ID becomes usable later without a re-scan. [OBSERVED — mobile-app en.json]
- The docs' own integration advice: "Make ZKPassport checks optional or provide fallback verification methods for unsupported IDs." [VERIFIED — https://docs.zkpassport.id/limitations]
- Format note for the MRZ layout: passports are TD3 (2 lines), ID cards / residence permits are TD1 (3 lines); TD2 is being dropped by ICAO. [VERIFIED — https://github.com/zkpassport/circuits]

## 3. What can be proven

Query-builder predicates (full list from the API reference):

- `disclose(field)` — reveals a raw value. Fields: `nationality`, `birthdate`, `fullname`, `firstname`, `lastname`, `expiry_date`, `document_number`, `document_type`, `issuing_country`, `gender`. [VERIFIED — https://docs.zkpassport.id/api]
- `gte` / `gt` / `lte` / `lt` / `range` — numeric/date comparisons, supported for `age`, `birthdate`, `expiry_date`. This is the "age over N" family; the SDK warns if the age is outside 1–99. [VERIFIED — https://docs.zkpassport.id/api and https://docs.zkpassport.id/changelog]
- `in` / `out` — set membership / exclusion, supported only for `nationality` and `issuing_country`. SDK exports `EU_COUNTRIES`, `EEA_COUNTRIES`, `SCHENGEN_COUNTRIES`, `ASEAN_COUNTRIES`, `MERCOSUR_COUNTRIES`, `SANCTIONED_COUNTRIES`. [VERIFIED — https://docs.zkpassport.id/api]
- `eq` — exact match on any credential field. [VERIFIED — https://docs.zkpassport.id/api]
- `sanctions(countries?, lists?, {strict?})` — non-membership in sanctions lists. Today all available lists are checked: **US, UK, EU, Switzerland** (US OFAC SDN was first, extended in SDK v0.11.0). Non-strict matches on name+DOB or passport number+nationality; strict matches on last+first name only (higher false-positive rate, harder to evade). [VERIFIED — https://docs.zkpassport.id/api and https://docs.zkpassport.id/changelog]
- `facematch(mode?)` — on-device liveness + face match against the chip photo; `"regular"` (fast, basic liveness) or `"strict"` (extensive anti-spoofing). Result surfaces as `result.facematch.passed` and `result.facematch.mode`. [VERIFIED — https://docs.zkpassport.id/examples/facematch and https://docs.zkpassport.id/api]
- `bind(key, value)` — binds `user_address` (e.g. an Ethereum address), `chain`, or `custom_data` into the proof; total bound data ≤ 500 bytes. `bind` is the only builder method allowed alongside `.policy()`. [VERIFIED — https://docs.zkpassport.id/api]
- `policy(id)` — applies an immutable dashboard-defined query; locks scope to `<policy-id>:<version>`. [VERIFIED — https://docs.zkpassport.id/api and https://docs.zkpassport.id/getting-started/policies]
- **Document validity / expiry is always enforced**, not opt-in: the expiry check is part of proof generation, and `validity` (default 7 days) bounds how stale the expiry proof may be. An expired document therefore cannot produce a passing proof. `expiry_date` can additionally be disclosed or compared. [VERIFIED — https://docs.zkpassport.id/api and https://docs.zkpassport.id/examples/kyc]
- **Stable per-person (really per-document) identifier:** every successful verification returns `uniqueIdentifier` plus `uniqueIdentifierType`. It is derived from the chip ID data + your **domain** + your **scope**, hashed with Poseidon2. Same ID + same domain + same scope ⇒ same identifier, forever. This is the only stable output. [VERIFIED — https://docs.zkpassport.id/faq and https://docs.zkpassport.id/examples/personhood]
- **One-shot attestations:** everything else — age/date comparisons, nationality in/out, disclosures, `sanctions`, `facematch`, `bind` — is a per-request assertion carried in the disclosure proof and its committed inputs. They carry a proof timestamp and are bounded by `validity`; they are not re-derivable later without a new proof. [INFERRED from https://docs.zkpassport.id/api (`validity`, `getProofTimestamp`, per-request `committedInputs`)]
- `NullifierType` enum: `NON_SALTED = 0`, `SALTED = 1`, `NON_SALTED_MOCK = 2`, `SALTED_MOCK = 3`. A `NONE` nullifier type was also added in the circuits/SDK in Jul 2026 (i.e. it is possible to request a proof with no identifier at all). [VERIFIED — https://docs.zkpassport.id/api ; OBSERVED — https://github.com/zkpassport/circuits/pull/152]
- Personhood caveats, stated by zkPassport: "A person can have multiple IDs, so if you want to have one person <-> one account … it won't be exactly that but more one ID <-> one account", and robust personhood needs `facematch("strict")`. [VERIFIED — https://docs.zkpassport.id/examples/personhood]
- Explicitly **not** covered: stolen/lost-document checks and full AML/CTF. "Neither the SDK nor the app checks whether the ID was reported stolen or lost." [VERIFIED — https://docs.zkpassport.id/examples/kyc]

## 4. Repeat use — what stays the same months later

- The `uniqueIdentifier` is stable for the same document under the same `(domain, scope)` pair. Nothing else persists across sessions on the verifier side. [VERIFIED — https://docs.zkpassport.id/examples/personhood]
- **Scope is per-app and per-use-case.** `scope` is an optional request parameter that defaults to your domain; changing it yields a different identifier. "This ensures the unique identifier is the same for the same ID while differing between different services." [VERIFIED — https://docs.zkpassport.id/faq and https://docs.zkpassport.id/getting-started/basic-usage]
- Consequence for multi-account: **the same passport can back several accounts that are mutually unlinkable, if and only if the wallet issues each under a different `scope`.** Under one fixed scope, one document = one identifier, so a second account under that scope is detectable (that is precisely the anti-sybil property). [INFERRED from https://docs.zkpassport.id/faq]
- Cross-site linkability is explicitly denied in the app's own onboarding copy: "Not linkable across websites — Websites cannot correlate or track you between different services." [OBSERVED — mobile-app en.json]
- **Identifier-stability hazards a wallet must plan for.** (a) With `.policy()`, scope is locked to `<policy-id>:<version>`, and the docs state this "keeps the user's unique identifier stable **until you bump the policy version**" — a policy edit rotates every user's identifier. There is an open PR to drop the version from the scope (#254, 2026-08-18). (b) The derivation itself has changed before: SDK v0.6.0 "the derivation of the unique identifier has changed slightly to be more future proof, so unique identifiers will change between the previous versions of the SDK and this one". (c) Earlier still, v0.4.0/v0.6.0 moved chain id in and out of the scope. [VERIFIED — https://docs.zkpassport.id/getting-started/policies and https://docs.zkpassport.id/changelog ; OBSERVED — https://github.com/zkpassport/zkpassport-packages/pull/254]
- Salted identifiers (`NullifierType.SALTED`) change the trust model, not the stability: still deterministic per ID+app, but derived with a threshold secret so even the issuing government cannot recompute it. They **require `.facematch("strict")`** in the query or the request throws. [VERIFIED — https://docs.zkpassport.id/examples/salted-identifiers]
- The default (non-salted) identifier is recomputable by anyone holding the full chip data, the domain and the scope — "This could include the issuing government (if they keep a record of all the IDs they signed)". [VERIFIED — https://docs.zkpassport.id/faq]
- A renewed passport is a different document and therefore a different identifier; there is no issuer-provided link between an old and a new document. Third-party research names this as an open gap for recovery use cases ("a renewal pathway linking old and new document identifiers when passports change"). [OBSERVED (secondary) — https://safefoundation.org/blog/safe-research-zk-passport-where-are-we-now]

## 5. What the user must have in hand at proof time

- **The physical document is needed at enrollment only.** The chip data is encrypted and stored on the phone, and the three expensive base proofs are cached: "Scan once, use forever - No need to keep scanning your ID"; "Reuse without rescanning — Verify in seconds without scanning your ID each time"; "The 3 base proofs are generated right after the ID is scanned and cached for later use". [VERIFIED — https://apps.apple.com/us/app/zkpassport/id6477371975 , https://docs.zkpassport.id/faq ; OBSERVED — mobile-app en.json]
- **The specific phone matters.** ID data and derived keys live in the app's local store (`id_data_encryption_key`, `commitment_salt`, `oprf_secret` derived from a device master key); the app can be gated behind Face ID / Touch ID ("You use Face ID/Touch ID to protect it", plus a `settings.security.requireAuth` toggle). No cloud backup or cross-device sync of the enrolled ID is documented, so a lost or wiped phone means re-scanning the document. [OBSERVED — https://github.com/zkpassport/mobile-app/blob/main/src/lib/constants.ts and src/i18n/locales/en.json ; INFERRED for the no-sync conclusion]
- The app can hold **several documents** ("Add ID"), so a user may pick which ID answers a given request. [OBSERVED — mobile-app en.json `passportView.addID`]
- **No user account and no login on zkPassport's side.** There is no sign-up/sign-in in the app; identity state is purely local. [OBSERVED — https://github.com/zkpassport/mobile-app (no auth screens in `src/app`); INFERRED]
- **No developer account or API key is required either** for the self-served flow: "No API key and no account are required to get started — just install the packages and you're good to go." A dashboard account (Sign in with Google) is needed only for branding, policies, and the proof audit trail. [VERIFIED — https://docs.zkpassport.id/getting-started/quick-start and https://zkpassport.id]
- **But there are server dependencies at proof time** (see §7): an end-to-end-encrypted WebSocket "bridge" (`@obsidion/bridge`) carries the request and the proofs between page and phone; the app reads registry roots from an Ethereum RPC; compressed/EVM proofs go through zkPassport's cloud prover; salted identifiers call the TACEO OPRF node network. [OBSERVED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/zkpassport-sdk/src/index.ts , https://github.com/zkpassport/mobile-app/blob/main/src/lib/constants.ts , https://github.com/zkpassport/cloud-prover]

## 6. Time and friction

- Published proving numbers: the 3 base proofs take **10–50 s** (once, at enrollment; depends on the country's signature algorithm and the device); disclosure proofs take **under 1 s to 10 s**. "As the 3 base proofs are generated right after the ID is scanned and cached for later use, the actual proof generation time the user will experience is the time it takes to generate the disclosure proofs." [VERIFIED — https://docs.zkpassport.id/faq]
- SDK guidance for the repeat path: `onGeneratingProof` → "Expect this to take up to ~10 seconds on a decent connection." [VERIFIED — https://docs.zkpassport.id/getting-started/basic-usage]
- **On-chain-verifiable proofs are much slower and are proved in the cloud.** The cloud prover runs on 16 vCPU / 64 GB spot nodes at "~84 s per large EVM outer proof", with a 600 s ingress timeout. [OBSERVED — https://github.com/zkpassport/cloud-prover#readme]
- RAM: RSA documents stay under ~1 GB; ECDSA with large curves (P521, Brainpool P512r1 + SHA-512) can approach ~2 GB, "which may get close to the limit of some low-end devices". Devices with less than ~2 GB available fall back to the cloud prover for non-sensitive sub-proofs. [VERIFIED — https://docs.zkpassport.id/faq ; OBSERVED — https://github.com/zkpassport/cloud-prover#readme]
- Third-party field observation of the whole repeat round trip: "the round trip consistently completes in under a minute" (Safe Foundation research on zkPassport-backed Safe recovery). [OBSERVED (secondary) — https://safefoundation.org/blog/safe-research-zk-passport-where-are-we-now]
- App download weight is itself friction: **455 MB** on iOS, because the binary bundles a 128 MB Aztec SRS and ~180 MB of ML models for local FaceMatch. [VERIFIED — https://docs.zkpassport.id/faq and https://apps.apple.com/us/app/zkpassport/id6477371975]
- FaceMatch adds a five-pose liveness routine per check: look at the camera neutral, then rotate left, up, right, down, with on-screen coaching. [VERIFIED — https://docs.zkpassport.id/faq ; OBSERVED — mobile-app en.json `facematch.*`]
- Documented failure modes:
  - **MRZ scan failure** — glare or poor lighting; fallback is manual entry of expiry date, birthdate, document number. On ID cards, users commonly enter the wrong number of several printed numbers; the docs tell them to read the MRZ prefix (`IDFRA…`, `IDD<<…`, `IDESP…`, `C<ITA…`, `I<PRT…`) to identify the right one. [VERIFIED — https://docs.zkpassport.id/faq]
  - **Chip not detected** — the NFC modal never changes from "Ready to scan" to "Hold still"; the user must move the phone around while maintaining contact. Some passports have an **RF shield in the cover** and must be opened to the photo page. [VERIFIED — https://docs.zkpassport.id/faq]
  - **Connection lost mid-read** — any phone movement after detection drops the chip session. The app retries up to 3 times (`NFC_MAX_ATTEMPTS = 3`) with escalating coaching: "Place your phone back on your ID", "Keep your phone steady", "Last attempt - hold phone firmly on ID", then "Could not reconnect. Please try again." Removing the phone case is the standard second-attempt advice. [VERIFIED — https://docs.zkpassport.id/faq ; OBSERVED — mobile-app constants.ts and en.json]
  - **Worn/damaged chip** — "We detected the chip in your document, but couldn't complete the scan. The chip may be damaged or not responding correctly." [OBSERVED — mobile-app en.json]
  - **PACE/BAC** — the app tries PACE and falls back automatically: "PACE Authentication failed, switching to BAC". A misread MRZ shows as chip authentication failure and bounces the user to manual MRZ entry. [OBSERVED — mobile-app en.json ; VERIFIED — https://docs.zkpassport.id/faq]
  - **iPhone RF interference** — disable Wi-Fi or enable airplane mode. [VERIFIED — https://docs.zkpassport.id/faq]
  - **Android NFC switched off** — blocking modal with a deep link to system settings. [OBSERVED — mobile-app en.json]
  - **Unsupported issuer certificate** or **unsupported signing algorithm** — see §2; the SDK returns `verified: false` for unsupported IDs (a bug where it wrongly returned `true` was fixed in v0.3.4). [OBSERVED — mobile-app en.json ; VERIFIED — https://docs.zkpassport.id/changelog]
  - **Expired document** — expiry is checked inside the proof, so it fails. [INFERRED from https://docs.zkpassport.id/api (`validity`) and https://docs.zkpassport.id/examples/kyc]
  - **FaceMatch refused by device attestation** — jailbroken/rooted device, GrapheneOS, a Google-blacklisted device certificate, an unsupported manufacturer signature scheme, or insufficient security guarantees (Play Integrity on Android, App Attest on iOS). Also "The user's photo extracted from the ID may not be retrieved or parsed properly, so the face scan cannot be performed". A concrete Android case: Samsung A15 intermediate attestation TBS of 633 bytes exceeded a 500-byte circuit limit. [VERIFIED — https://docs.zkpassport.id/faq and https://docs.zkpassport.id/limitations ; OBSERVED — https://github.com/zkpassport/circuits/issues/132]
  - **FaceMatch timeout** — "We couldn't confirm that your face matches the ID used for this verification." [OBSERVED — mobile-app en.json]
- Sentiment signal: the iOS listing carries a **2.86 average over 14 ratings** — small sample, but not a smooth-onboarding signal. [OBSERVED — https://itunes.apple.com/lookup?id=6477371975]

## 7. Offline capability, and what phones home

- Proof generation and all handling of ID data are local: "Your personal data is encrypted and processed locally on your device and never leaves it"; "A cryptographic proof of the result is generated on-device." Circuits run via Barretenberg/UltraHonk natively on the phone. [VERIFIED — https://docs.zkpassport.id/faq and https://zkpassport.id]
- **A fully offline proof is not possible in the shipped flow.** Concrete network dependencies found:
  - **Bridge** — the SDK connects to an end-to-end-encrypted WebSocket relay (`@obsidion/bridge`, "Obsidion Bridge: A reliable end-to-end encrypted websocket bridge", latest 0.12.1, 2026-07-07) to deliver the request and receive the proofs; `bridgeUrl` is an advanced override and `onBridgeConnect`/`isBridgeConnected` are public lifecycle hooks. [OBSERVED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/zkpassport-sdk/src/index.ts and https://www.npmjs.com/package/@obsidion/bridge]
  - **Ethereum RPC** — both the app and the SDK read registry roots from mainnet via Alchemy (`RPC_URL` in the app; hardcoded Alchemy mainnet/Sepolia URLs in the SDK). SDK v0.15.x also validates "registry roots as of the proof's date". [OBSERVED — https://github.com/zkpassport/mobile-app/blob/main/src/lib/constants.ts and packages/zkpassport-sdk/src/index.ts]
  - **`api.zkpassport.id`** — app metadata (`/api/metadata`) and error/event reporting (`/api/report`). [OBSERVED — https://github.com/zkpassport/mobile-app/blob/main/src/lib/constants.ts and src/services/EventReportingService.ts]
  - **`dashboard-api.zkpassport.id`** — trusted-origin/branding lookup (`/public/project?domain=…`) and **activity reporting** (`/public/activity`). The app POSTs `{requestId, domain, status, scope, errorCode, durationMs, devMode}` for `started` / `success` / `failed`, called from the home screen, the QR scanner and the access-request view. No ID data is sent, but **which domain and scope a user verified against, and when, reaches zkPassport's server**. [OBSERVED — https://github.com/zkpassport/mobile-app/blob/main/src/services/ActivityReportingService.ts]
  - **`cloud-prover.zkpassport.id`** — used to recurse sub-proofs into the compressed/EVM outer proof, and "for proving non-sensitive sub-proofs, where a user's device memory is insufficient (i.e. less than ~2 GB)". The README states "No sensitive passport/national ID card information ever leaves a user's device". [OBSERVED — https://github.com/zkpassport/cloud-prover#readme and https://github.com/zkpassport/mobile-app/blob/main/src/lib/constants.ts]
  - **TACEO OPRF network** — salted identifiers call three nodes (`eu.node0/1/2.zkp.oprf.taceo.network`, operated by H2ONodes, TACEO, AztecLabs) with threshold 2. [OBSERVED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/zkpassport-utils/src/oprf/constants.ts]
  - **`cdn.zkpassport.id`** — the sanctions Merkle tree is served from `cdn.zkpassport.id/sanctions/all_sanctions_tree.json.gz`. [OBSERVED — https://github.com/zkpassport/circuits/issues/143]
  - **Verifier-side fallback** — SDK v0.15.x "Fall back to the verifier API when local proof verification fails", i.e. the integrator's verification can silently route to a zkPassport service. [OBSERVED — https://github.com/zkpassport/zkpassport-packages/pull/238]
- Marketing/product tension worth flagging: the site claims "No data is stored on ZKPassport servers", yet also "Proofs are stored in your dashboard to serve as an audit trail", and the app posts per-verification activity rows. Proofs are not PII, but this is server-side retention. [OBSERVED — https://zkpassport.id and https://github.com/zkpassport/mobile-app/blob/main/src/services/ActivityReportingService.ts]

## 8. Maturity

- **Very actively maintained.** `zkpassport-packages` was pushed on 2026-08-20 (research day); `@zkpassport/sdk` 0.16.2 and `@zkpassport/ui` 0.16.2 were both published 2026-08-20; `circuits` last pushed 2026-08-06; issue/PR numbers in the monorepo reached #257 by 2026-08-20. Release cadence over the last three months is roughly weekly-to-fortnightly. [OBSERVED — GitHub API on github.com/zkpassport ; https://www.npmjs.com/package/@zkpassport/sdk]
- Still pre-1.0 on the SDK, and the changelog shows **frequent breaking changes**, including proving-system bumps that invalidate proofs from older app versions (v0.7.0, v0.10.0: "Proofs generated with previous version of the mobile app will not work with this version of the SDK") and app/SDK version coupling (v0.4.0 requires app ≥ 0.6.13; v0.5.0 requires app ≥ 0.7.4). [VERIFIED — https://docs.zkpassport.id/changelog]
- **The mobile app is now open source** — `zkpassport/mobile-app`, Apache-2.0, published 2026-07-17 as a single "Initial public release" commit (React Native / Expo). That satisfies the FAQ's condition ("The mobile app will be open sourced when out of the testing phase and publicly listed on the App Store and Google Play Store"), but ongoing development does not appear to happen in that public repo — it has one commit and no issues, and an external contributor reports "your mobile-app repo doesn't accept fork PRs". [OBSERVED — https://github.com/zkpassport/mobile-app and https://github.com/zkpassport/zkpassport-packages/pull/236 ; VERIFIED — https://docs.zkpassport.id/faq]
- **Licensing is inconsistent.** `circuits`, `mobile-app`, `noir_rs` and the archived `zkpassport-sdk` are Apache-2.0; `@zkpassport/sdk` and `@zkpassport/ui` declare Apache-2.0 in `package.json`; but the **`zkpassport-packages` monorepo has no LICENSE file** and `@zkpassport/utils` (0.37.5) declares no license on npm. An integrator opened issue #246 "No Formal License" on 2026-08-11 — still open, no reply as of 2026-08-20. [OBSERVED — GitHub API + npm registry + https://github.com/zkpassport/zkpassport-packages/issues/246]
- **No published third-party audit found.** The circuits repo has a `SECURITY.md` (added 2026-05-20) but no audit report, and I found no audit report on the site, docs, or in any repo. What does exist is a visible stream of **externally reported soundness bugs, fixed in the open**: "OFAC Sanctions Evasion via Under-Constrained MRZ Name Parsing" (circuits #143, reported by `@imxm`, 2026-05-13, closed), "Bug: MRZ name is underconstrained" (#148, 2026-06-20, closed), "fix: fix outer circuit constraints" (#145). An earlier dependency fix notes "Update to Barretenberg 0.82.2 which patches a vulnerability in UltraHonk". [OBSERVED — https://github.com/zkpassport/circuits/issues/143 , /148 , https://docs.zkpassport.id/changelog ; UNKNOWN for a formal audit]
- **Used in production**, per zkPassport's own case-study copy: "Met age verification requirements across jurisdictions for Aztec's $60M token sale" and "Provided Devconnect ticket discounts for hundreds of participants from 11 LatAm countries". Aztec separately describes zkPassport gating **sequencer onboarding** on its testnet. On-chain verifier `ZKPassportVerifier` is deployed at the deterministic address `0x1D000001000EFD9a6371f4d90bB8920D5431c0D8` on **Ethereum Mainnet, Ethereum Sepolia and Base Mainnet** ("If you need a specific chain, please reach out to us"), while `bind("chain", …)` accepts a much longer list of planned chains. [VERIFIED — https://zkpassport.id and https://docs.zkpassport.id/getting-started/onchain ; VERIFIED (secondary) — https://aztec.network/blog/zkpassport-case-study-a-look-into-online-identity-verification]
- **Pricing / gating:** verification is free and unmetered — "Completely free"; "We're never in the loop, so there's nothing to bill you for." Paid gating is only on the periphery: "Add-on services (white-label apps, hosted analytics, premium support) may carry a fee, but the verification itself is free", and white-label / removing zkPassport branding is "on the roadmap for enterprise customers". The dashboard (policies, branding, audit trail) requires a Google sign-in but no payment. [VERIFIED — https://zkpassport.id]

## 9. What integrators have publicly hit

- **Return-to-app UX on mobile is broken for in-app browsers** — the most substantive public complaint, PR #236 (2026-07-28, still open). An integrator writes that `returnDeepLink` "is opened via the OS, so an https value always lands in the **default** browser, which is often not where the user's signed-in session lives. A flow started in an in-app webview (Discord, X — no scheme can reopen those) or a non-default browser returns the user to a browser with none of their state. For links shared in chat apps this is the majority path, not an edge case." Their current workaround is rewriting returns into `googlechromes://`, `firefox://open-url`, `microsoft-edge-https://` "and coaching users through the round trip". They also note `returnDeepLink` "wasn't documented in the API reference". [OBSERVED — https://github.com/zkpassport/zkpassport-packages/pull/236]
- **The mobile-app repo does not accept fork PRs**, so app-side fixes cannot be contributed normally. [OBSERVED — https://github.com/zkpassport/zkpassport-packages/pull/236]
- **License ambiguity blocks adoption** — "We are not entirely sure how we can make use of this library and potentially contribute back if not." (issue #246, open). [OBSERVED — https://github.com/zkpassport/zkpassport-packages/issues/246]
- **Android FaceMatch device incompatibility** — Samsung A15 attestation chain exceeded the circuit's 500-byte intermediate-TBS limit (circuits #132, fixed by raising the limit). [OBSERVED — https://github.com/zkpassport/circuits/issues/132]
- **Soundness bug in the sanctions path**, externally reported and fixed (circuits #143 above). [OBSERVED — https://github.com/zkpassport/circuits/issues/143]
- **A wallet-recovery integrator's assessment** (Safe Foundation research): usable "if you frame it as personhood rather than legal identity"; open items before production are liveness/MFA for higher-value accounts, "a renewal pathway linking old and new document identifiers when passports change", and "timelocks, rate limits, and clear revocation procedures"; also "The system cannot prevent a single person with multiple passports from onboarding multiple times", and every proof "must be bound to a single-use nonce" and "protected against replay on-chain". Note two claims in that piece that **contradict current zkPassport docs** and look stale or wrong: "there are no built-in biometric liveness checks" (Private FaceMatch exists, with a strict liveness mode) and "only documents with Active Authentication are widely supported today" (the scheme relies on passive authentication via DSC/CSCA, per the circuits README). Treat that source with care. [OBSERVED (secondary) — https://safefoundation.org/blog/safe-research-zk-passport-where-are-we-now ; contradicted by https://docs.zkpassport.id/examples/facematch and https://github.com/zkpassport/circuits]
- **Verifier-side breaking churn** as a standing integration cost: `verify()` now requires `originalQuery`; scope semantics, nullifier derivation and the Solidity verifier interface have each changed at least once. [VERIFIED — https://docs.zkpassport.id/changelog]

## Gaps

- **Exact supported-country list and count.** `registry.zkpassport.id/map`, `/certificates` and `/overview` render client-side, so I could not enumerate countries or confirm the "130+" figure against registry data. I found no public JSON/API endpoint for it. [UNKNOWN]
- **Whether a live face scan is needed on every FaceMatch request, or can be cached.** SDK PR #234 "Support cached facematch enrollment proofs" was merged 2026-07-22 (reuse a zero-scope enrollment proof "instead of a live face scan per request"), but its companion circuits change (#151) was **reverted** on 2026-08-05 (#153). The app does have a "Clear FaceMatch Cache" developer setting. I could not determine the shipped behaviour as of 2026-08-20. This matters: it decides whether a wallet's repeat flow is a tap-to-approve or a five-pose selfie routine.
- **Default bridge URL / bridge operator model.** `@obsidion/bridge` has no public repo and the default endpoint is not in the open SDK source I read. I could not establish who runs it, whether it is rate-limited, or what it logs beyond the request-id/pubkey correlation implied by the SDK tests.
- **Whether activity reporting to `dashboard-api.zkpassport.id` is gated** (e.g. only for dashboard-registered domains) or unconditional. I saw three call sites but did not trace the guards.
- **Any formal security audit.** None found for circuits, contracts, SDK, or app. Absence of evidence, not evidence of absence.
- **iOS App Clips timeline.** Announced as "rolling out" on the homepage; no ship date, no docs page, no code found. This is the single biggest potential change to the enrollment funnel, and I could not date it.
- **Browser proving timeline** (PR #243) — draft since 2026-08-05, last touched 2026-08-10, no target release.
- **Real-world NFC success rate / drop-off.** No published numbers from zkPassport or integrators; only the 3-retry ceiling and qualitative coaching copy.
- **Enrolled-ID portability.** I found no documented backup, export, or device-migration path for a scanned ID, but I did not exhaustively read the app's storage layer, so I cannot state definitively that none exists.
- **Total wall-clock enrollment time** (MRZ + chip read + base proofs) as a single measured figure. Components are documented (base proofs 10–50 s); the scan portion is not.
- **Whether the `NONE` nullifier type is exposed through the public SDK query surface** — it appears in circuits/SDK PRs from Jul 2026 but not in the published `NullifierType` docs enum.

---

# Appendix B — cryptography, trust anchors and integration (raw front)

Scope: evaluating zkPassport (zkpassport.id) as an account-recovery method for a browser-extension wallet on an ERC-4337 smart account with an ERC-7579 recovery module.

Evidence base: primary sources read directly at commit level on 2026-08-20 — `zkpassport/circuits` @ `1a1836e` (2026-08-06), `zkpassport/zkpassport-packages` @ `a843c1e` (2026-08-20), `zkpassport/zkpassport-docs` @ `665a760` (2026-08-20).

Labels: VERIFIED = read in the primary source, stated directly. OBSERVED = stated in a secondary/reputable source. INFERRED = my reasoning from evidence. UNKNOWN = no source found.

Caution on search noise: several unrelated projects share the name — Rarimo "ZK Passport", Self Protocol (self.xyz), OpenPassport / Proof of Passport, and zkMe's own product also called "zkPassport". Nothing in this document is sourced from those projects.

---

## Headline for an integration decision

Five findings dominate, all verified against primary sources or live chain state:

1. **The trust anchor is one unprotected EOA.** `oracle = 0x1F08b2613Cb12dD38E5c449C6033300a61E67250` is the sole writer of the certificate merkle root, with no timelock, no quorum, no proof of provenance, an unassigned guardian, and instant effect on all three chains. Its nonce (27) equals `rootCount` (27), so that one key has made every update. A single compromised key can mint a proof matching any nullifier we have enrolled — i.e. forge a recovery. (§3)
2. **No external audit exists, and the code is not frozen.** The project's own SDK README, edited today, says so: "it has not yet had an external audit." There is no bug bounty, zero releases on the circuits repo, and a soundness-relevant change two weeks ago that re-keyed every verifier. One real soundness bug (an under-constrained Brillig hint) was found by an outsider and fixed. (§9)
3. **The enrolled identifier dies with the document.** The nullifier hashes the SOD signature, so passport reissuance produces a different identifier; and expiry is asserted in-circuit, so an expired document cannot prove at all. Any enrolment therefore has a hard ceiling of one document lifetime, and a user who renews silently loses recovery. (§4, §5)
4. **A proof does not prove the person is present.** The circuits implement Passive Authentication only — no DG14/DG15, no Active or Chip Authentication — and AA is commented out in the reader entirely. A proof attests that a validly signed chip dump was presented, not that the genuine chip or its holder is there. One historical chip read is enough, forever, and there is no per-document revocation. FaceMatch (`strict`) is the only mitigation. (§8)
5. **Backend-zero is not achievable, though the residual dependencies are knowable and mostly self-hostable.** No API key or account is needed, and verification can be a free `eth_call` because `verify` is `view`. But three hosted hops sit in the path: the vendor's closed-source relay `wss://bridge.zkpassport.id`, a hosted cloud prover that the SRS/circuit-size evidence says is **required** for the `compressed-evm` proof we need (capped at ~6 concurrent proofs on spot capacity in one zone), and a shared hardcoded Alchemy key we must replace. On-chain verification costs **~0.93M–1.0M gas** on mainnet, measured. (§1, §2, §6, §7)

And one go/no-go unknown that outranks all of the above for us: **it is unverified that the flow works from a browser extension at all.** The scope model hashes an `https://` domain and the app validates origin against a registered domain; an extension presents `chrome-extension://<id>`, and a closely related bug already makes Node usage fail *silently*. Prototype this first. (§6)

---

## 1. Proof system and circuits

- Proving stack is **Noir** (circuit language) + **Barretenberg** (backend) producing **UltraHonk** proofs. Not Circom, not Halo2, not Groth16. `[VERIFIED — https://docs.zkpassport.id/faq]`
- Barretenberg is the Aztec backend, and proofs are generated **natively on the mobile device**. Quote: "ZKPassport uses UltraHonk proofs by leveraging the Barretenberg backend from Aztec to generate proofs natively on mobile devices, and Noir as the language for writing the logic of the proofs." `[VERIFIED — https://docs.zkpassport.id/faq]`
- No per-circuit trusted setup — a stated motivation for choosing Noir over their earlier Circom work. `[OBSERVED — https://github.com/zkpassport/circuits]`
- A complete identity proof is **at least 4 subproofs**, recursively aggregated: 2 signature proofs (CSCA→DSC, DSC→ID data), 1 data-integrity proof, and 1+ disclosure proofs. `[VERIFIED — https://docs.zkpassport.id/faq]`
- Circuit crate inventory in the repo maps exactly to that structure: `sig-check/{dsc,id-data}`, `data-check/integrity`, `disclose/bytes`, `compare/{age,birthdate,expiry}`, `inclusion-check/{issuing-country,nationality}`, `exclusion-check/{issuing-country,nationality,sanctions}`, `bind/{evm,standard}`, `facematch/{android,ios}`, `oprf-auth`, and the recursive aggregator `main/outer`. `[VERIFIED — https://github.com/zkpassport/circuits/tree/main/src/noir/bin]`
- The aggregator is **not one circuit but a family**, one per number of aggregated subproofs: `main/outer/count_4` … `count_13`. The count determines which on-chain verifier is used. `[VERIFIED — https://github.com/zkpassport/circuits/tree/main/src/noir/bin/main/outer]`
- Circuits are heavily **monomorphized per algorithm combination** — e.g. `data-check/integrity/sa_sha224/dg_sha256`, `facematch/android/rk_ecdsa/ik_count_1/ik_ecdsa_p384_sha384`. This is why the mobile app is large and why circuit artifacts are fetched per document rather than bundled wholesale. `[VERIFIED — https://github.com/zkpassport/circuits/tree/main/src/noir/bin]`
- The app is stated to be over 400MB, with a dedicated FAQ entry explaining it — consistent with shipping many circuit variants. `[VERIFIED — https://docs.zkpassport.id/faq]`
- Prove time, per project docs: the 3 base proofs take **10s to 50s**, depending on the issuing country's signature algorithm and the device. Disclosure proofs take **under 1s to 10s**. `[VERIFIED — https://docs.zkpassport.id/faq]`
- Base proofs are generated **once, right after the ID chip scan, and cached**; only disclosure proofs are generated per request. So the latency a returning user experiences is the disclosure-proof latency, not the full 10-50s. `[VERIFIED — https://docs.zkpassport.id/faq]`
- RAM: RSA documents stay under ~1GB (works on low-end phones); ECDSA is heavier, up to ~2GB for large curves such as P521 / Brainpool P512r1, which "may get close to the limit of some low-end devices". `[VERIFIED — https://docs.zkpassport.id/faq]`
- Measured proof size from the repo's own on-chain test fixtures: the `compressed-evm` outer proof is **9,888 bytes**; a proof carrying all subproofs is **10,592 bytes**. `[VERIFIED — https://github.com/zkpassport/circuits/tree/main/src/solidity/test/fixtures]`
- Public input count in those fixtures: **10 fields** for the standard/salted case and **18** for the all-subproofs case. `[VERIFIED — https://github.com/zkpassport/circuits/tree/main/src/solidity/test/fixtures]`
- Where proving runs: **the phone only**, for the passport path. The NFC chip read requires a physical device with NFC, and the base proofs are produced in the mobile app. There is no browser-WASM proving path for passport data. `[VERIFIED — https://docs.zkpassport.id/intro]`
- Browser WASM **is** used, but for **verification**, not proving: the SDK loads `@aztec/bb.js` and instantiates an `UltraHonkVerifierBackend`, with IndexedDB/localStorage CRS caching — i.e. it runs in the browser. `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/zkpassport-sdk/src/bb-verifier.ts]`
- The SDK carries two Barretenberg verifier generations side by side (`@aztec/bb.js-v4` and `@aztec/bb.js`), selected by circuit version, with a cutover at circuit version `0.20.0`. Old proofs need the old backend. `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/zkpassport-sdk/src/bb-verifier.ts]`
- One hard datapoint for the `compressed-evm` path: the cloud prover's own README measures **~84s per large EVM outer proof** on a `t2d-standard-16` (16 vCPU / 64 GB), with measured peak ~11 GiB RAM and ~7 cores average. That is a server, so treat it as an upper bound on the recursion work, not a phone figure — but it shows the EVM outer proof is substantially heavier than the "<1-10s disclosure proof" headline. `[VERIFIED — https://github.com/zkpassport/cloud-prover]`
- Per-device (phone) published benchmark numbers beyond the 10-50s / <1-10s docs range: `[UNKNOWN — no source found]`
- Gate counts are not published — `scripts/info.sh` generates them via `bb gates` but `info/` is untracked, and CI runs no benchmark job. **But the outer circuit sizes are directly readable from the generated Solidity verifiers' `LOG_N` constant**: `OuterCount4` and `OuterCount5` = 22, `OuterCount6`–`OuterCount10` = 23, `OuterCount11`–`OuterCount13` = 24. So the outer circuits are **2²² to 2²⁴ gates**. `[VERIFIED — https://github.com/zkpassport/circuits/tree/main/src/solidity/src/ultra-honk-verifiers]`
- The naming is now unambiguous: `outer_count_N` wraps **N subproofs = 3 base proofs + (N−3) disclosure proofs**, stated in the auto-generated circuit header. So `OuterCount4` = 1 disclosure proof, `OuterCount13` = 10. `[VERIFIED — https://github.com/zkpassport/circuits/blob/main/src/noir/bin/main/outer/count_5/src/main.nr]`
- Disclosure circuits sit in the **2¹⁹–2²⁰** range, inferable from the app's offload thresholds (it sends a circuit to the cloud prover at `size >= 1048576 - 50`, i.e. 2²⁰, or `>= 524288`, i.e. 2¹⁹, on devices under 3.5 GB RAM). `[VERIFIED — https://github.com/zkpassport/mobile-app/blob/main/src/services/ProofService/DisclosureProofService.ts]`
- **The single most consequential number in this section: the app bundles a 128MB SRS covering circuits only "up to the 2^21 subgroup size", but every outer circuit is 2²²–2²⁴.** Read with the cloud-prover README, this means **the `compressed-evm` outer proof cannot be produced on the phone at all** — it is normally produced by the hosted cloud prover, regardless of how much RAM the device has. See §7. `[INFERRED — https://docs.zkpassport.id/faq]`
- Proofs are generated with `evm: true, disable_zk: true`, which is why they are smaller and cheaper to verify than a default UltraHonk EVM proof — and why the gas figures in §2 are well below generic UltraHonk benchmarks. Note `disable_zk` means the *outer proof itself* is not zero-knowledge; privacy comes from the inner subproofs having already concealed the private inputs. `[VERIFIED — https://github.com/zkpassport/mobile-app/blob/main/src/services/ProofService/OuterProofService.ts]`
- Real-world latency complaints exist: Aztec validator registration hung at "Verifying signature 1/2" for over 130s across three attempts on two Android devices, and an iPhone 15 Pro was reported crashing at 89% of `compressed-evm` proof compression. `[VERIFIED — https://github.com/passportxyz/passport/issues/3615]`
- Do **not** quote the "2.5s / 6.8s" figures from the Aztec case study as zkPassport numbers — those are Aztec's own private-transfer benchmarks on an M2 MacBook. `[VERIFIED — https://aztec.network/blog/zkpassport-case-study-a-look-into-online-identity-verification]`

## 2. Verification

- Yes — there is a deployed on-chain verifier, `ZKPassportVerifier`, at **`0x1D000001000EFD9a6371f4d90bB8920D5431c0D8`**. The address is deterministic and therefore **identical on every supported chain**. `[VERIFIED — https://docs.zkpassport.id/getting-started/onchain]`
- Chains the docs claim deployment on: **Ethereum Mainnet, Ethereum Sepolia, Base Mainnet**. Other chains are "reach out to us". `[VERIFIED — https://docs.zkpassport.id/getting-started/onchain]`
- Repo deployment records corroborate mainnet (chainId 1), Base (8453) and Sepolia (11155111), and give the same `root_verifier` address on 1 and 8453. `[VERIFIED — https://github.com/zkpassport/circuits/tree/main/src/solidity/deployments]`
- Architecture is a three-layer router: **RootVerifier** (stable address, version→subverifier routing) → **SubVerifier** (all the semantic checks) → **per-circuit UltraHonk `ProofVerifier`** selected by vkey hash. `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/registry-contracts/src/SubVerifier.sol]`
- Ten separate UltraHonk verifier contracts are deployed per chain, `outer_count_4` through `outer_count_13`, matching the aggregator family. Mainnet subverifier version `0.20.0` lists all ten with distinct addresses. `[VERIFIED — https://github.com/zkpassport/circuits/blob/main/src/solidity/deployments/addresses-1.json]`
- The generated Solidity verifiers live at `src/solidity/src/ultra-honk-verifiers/OuterCount4.sol` … `OuterCount13.sol`. `[VERIFIED — https://github.com/zkpassport/circuits/tree/main/src/solidity/src/ultra-honk-verifiers]`
- **`SubVerifier.verify` is declared `view`.** This is significant: verification is a pure read, so it can be executed as a free `eth_call` off-chain, or inside a transaction on-chain, with identical semantics. `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/registry-contracts/src/SubVerifier.sol]`
- The SDK exploits exactly that: for `outer_evm` proofs it does off-chain verification by `readContract` against the deployed verifier over a public RPC, rather than verifying locally. `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/zkpassport-sdk/src/index.ts]`
- Verification is therefore **not EVM-only**: off-chain verification is also supported natively in the SDK via Barretenberg WASM (`bb-verifier.ts`), and proofs can additionally be verified **inside another Noir circuit** using `std::verify_proof` recursion. `[VERIFIED — https://docs.zkpassport.id/faq]`
- Integrator ergonomics: `getSolidityVerifierDetails()` returns `{address, functionName, abi}`; `getSolidityVerifierParameters({proof, scope, devMode})` builds the calldata struct. `verify()` returns `(bool verified, bytes32 uniqueIdentifier, IZKPassportHelper helper)`. `[VERIFIED — https://docs.zkpassport.id/getting-started/onchain]`
- Only a proof requested with `mode: "compressed-evm"` is verifiable on EVM chains. The default mode is `"fast"`, which the docs state is **not** on-chain verifiable and gives "slightly less privacy in regards to the issuing country". `"compressed"` is full-privacy but also not EVM-verifiable. `[VERIFIED — https://docs.zkpassport.id/api]`
### Gas cost — measured directly against mainnet

No gas figure is published anywhere: the repo's gas test (`vm.startSnapshotGas("UltraHonkVerifier verify")` in `ProofVerifier.t.sol`) only `console.log`s the result, no `.gas-snapshot` is committed, and the docs/changelog are silent. `[VERIFIED — https://github.com/zkpassport/circuits/blob/main/src/solidity/test/ProofVerifier.t.sol]`

So I measured it. I ABI-encoded the repo's own committed fixture (`valid_proof.hex` + `valid_public_inputs.json`, which `ProofVerifier.t.sol` pairs with `OuterCount5`) and called the **deployed mainnet `outer_count_5` verifier at `0xaE018c3FaE33d1aB5dD2245FA593892d9b1927b4`**.

- `eth_call` returned **`true`** — the deployed mainnet verifier accepts the repo's committed fixture. This independently confirms the published artifacts match the deployed contracts. `[VERIFIED — eth_call verify(bytes,bytes32[]) on 0xaE018c3FaE33d1aB5dD2245FA593892d9b1927b4, Ethereum mainnet]`
- `eth_estimateGas` for the same call returned `0xd1890` = **858,768 gas** for the bare UltraHonk proof verification as a standalone transaction. `[VERIFIED — eth_estimateGas on 0xaE018c3FaE33d1aB5dD2245FA593892d9b1927b4, Ethereum mainnet]`
- Breakdown of that 858,768: calldata is 10,340 bytes (9,406 non-zero, 934 zero) = 154,232 gas, plus 21,000 base = **175,232 intrinsic**, leaving **~683,500 gas of actual verifier execution**. The EIP-7623 calldata floor for this payload is 406,580, comfortably below the total, so the floor does not bind. `[VERIFIED — computed from the eth_estimateGas result and the encoded calldata]`
- The same measurement on the largest verifier, `outer_count_13` at `0x8c424C342211DAde4Bf40B0f4c5a09D9a8810694`, gives **900,770 gas** total (190,364 intrinsic, ~710,400 execution). So the raw-verifier cost is remarkably flat across the family: **~683k–710k execution regardless of how many disclosures are aggregated.** `[VERIFIED — eth_estimateGas on 0x8c424C342211DAde4Bf40B0f4c5a09D9a8810694, Ethereum mainnet]`
- **The full `ZKPassportVerifier.verify()` path was also measured**, by simulating against the live mainnet router at `0x1D000001000EFD9a6371f4d90bB8920D5431c0D8` (version `0x14` = v0.20.0), returning `valid = 1`:
  - typical disclosure (`OuterCount5`, 3 base + 2 disclosure): **926,746 gas** total; 11,524 B calldata → 183,136 intrinsic; ~743,600 execution
  - salted/OPRF nullifier (the production privacy mode, `OuterCount5`): **936,131 gas** total; ~752,700 execution
  - maximum disclosure (`OuterCount13`, 3 base + 10 disclosure): **995,822 gas** total; 14,564 B calldata → 207,764 intrinsic; ~788,100 execution
  
  Confidence check: the simulated call returned `uniqueIdentifier = 0x171de101deed3f056917faecfe6cc04db2ef02689a8a483962a688948ce44461`, exactly the value the repo's own forge test asserts — so the real code path was exercised. `[VERIFIED — eth_call/eth_estimateGas on 0x1D000001000EFD9a6371f4d90bB8920D5431c0D8, Ethereum mainnet]`
- **Honest caveat on those full-path numbers.** They required `eth_call` state overrides, because the repo fixture is not a production proof: the `RootRegistry` was stubbed to return `true` (bypassing the two `isRootValid` Merkle checks), the `proofVerifiers` mapping was repointed at the real deployed verifier, `globalOPRFPubKeyHash` was set to the fixture value, and `devMode` plus a long validity were used since the fixture uses mock ZKR certificates. Only the first override is gas-relevant, and **it makes the estimate an underestimate** — the real registry does two external view calls with storage reads, plausibly **+10–40k**. `[INFERRED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/registry-contracts/src/SubVerifier.sol]`
- **Defensible headline: a full on-chain zkPassport verification costs roughly 0.93M–1.0M gas**, of which ~680–790k is execution and ~160–210k is calldata plus intrinsic. Because calldata is a large share, this is materially cheaper on an L2 than on L1. `[INFERRED — eth_estimateGas on 0x1D000001000EFD9a6371f4d90bB8920D5431c0D8, Ethereum mainnet]`
- For scale: a generic Barretenberg/Noir UltraHonk Solidity verifier for a P-256 passkey circuit costs **2,396,575 gas**. zkPassport's ~680k is well below that because of `disable_zk` and a fixed outer circuit. Label clearly as the proof system's cost, not a zkPassport measurement. `[OBSERVED — https://blog.base.dev/benchmarking-zkp-systems]`
- **Do not use** the "~770k / ~500k gas" figures that surface in search — those are Privado ID / Rarimo, different projects. `[OBSERVED — https://docs.privado.id/docs/faqs/content/verifier-on-chain-verification-gas-costs/]`
- Usage evidence: the root verifier has **zero direct transactions** on both Ethereum and Base, and its only logs are admin/config events. That is expected — integrators call it as a `view` from their own contracts, so the gas is paid inside the caller's transaction and no top-level tx exists. `[VERIFIED — https://eth.blockscout.com/address/0x1D000001000EFD9a6371f4d90bB8920D5431c0D8]`
- Integrator-facing calldata note: besides the ~9.9KB proof, we must also pass `committedInputs`, which is **695 bytes** for 2 disclosure proofs and **2,775 bytes** for 10. `[VERIFIED — https://github.com/zkpassport/circuits/tree/main/src/solidity/test/fixtures]`
- Practical consequence: on Ethereum mainnet a recovery that verifies on chain costs ~1M gas — real money, but a once-per-recovery event. On **Base** (also deployed, same address) this is negligible. Verifying **off-chain via `eth_call` costs nothing**, since `verify` is `view`; the on-chain cost is only incurred if the recovery module must check the proof itself in a transaction. `[INFERRED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/registry-contracts/src/SubVerifier.sol]`

## 3. Trust anchor — the CSCA list (the DKIM-registry analogue)

This is the section that matters most for a recovery decision, so it is the most heavily verified. The short version: **the cryptography is trustless and independently reproducible; the curation is a single unprotected key.**

### Structure

- The trust anchor is an **on-chain merkle root**, not a bundled key list. The proof exposes `certificate_registry_root` as public input 0, and `SubVerifier` checks it against a registry contract. `[VERIFIED — https://docs.zkpassport.id/getting-started/onchain]`
- Contract is **`RootRegistry` at `0x1D0000020038d6E40E1d98e09fA1bb3A7DAA8B70`** — the same vanity address on Ethereum Mainnet, Base Mainnet and Sepolia. `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/registry-sdk/src/client.ts]`
- `RootRegistry` multiplexes three registries by id: `CERTIFICATE = 1`, `CIRCUIT = 2`, `SANCTIONS = 3`. Live mainnet instances: certificate `0xbaF7Fb72b8d1024f67F3E636db84C9639059e05d`, circuit `0x6863e9a6ff2d313fDEE00869EA09B56006423C98`, sanctions `0x820cc0becfd3d8467b21fc8b88336abced0df824`. `[VERIFIED — eth_call registries(bytes32) on 0x1D0000020038d6E40E1d98e09fA1bb3A7DAA8B70, Ethereum mainnet]`
- Certificate registry instances per chain: mainnet `0xbaF7Fb72b8d1024f67F3E636db84C9639059e05d`, Base `0x501aded0683d5f859ff1097a3ba4e3e0e0f999d8`, Sepolia `0x5135c41430e263fbf734be9f1fe9f5833b81393f`. `[VERIFIED — eth_call registries(1) on each chain]`
- **Merkle depth 16** (`CERTIFICATE_MERKLE_TREE_HEIGHT = 16`, max 65,536 leaves), hashed with **Poseidon2 over BN254, arity 2**. Confirmed live: `treeHeight()` returns `0x10`. Two sibling trees exist — revocation at depth 14 and masterlist at depth 8; the circuit registry is depth 12. `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/zkpassport-utils/src/registry/index.ts]`
- The published root is **not** the bare certificate-tree root. It is a two-level composition: `state_root = Poseidon2(cert_root, revocation_root, masterlist_root)`, then `certificate_registry_root = Poseidon2(pack_be(schema_version[u16] || timestamp[u32]), state_root)`. `[VERIFIED — https://github.com/zkpassport/circuits/blob/main/src/noir/lib/commitment/common/src/lib.nr]`
- **The whole construction was independently recomputed from the published data and matches the on-chain root byte-for-byte.** Using zkPassport's own `@zkpassport/poseidon2`: masterlist tree (h8, 31 leaves) → `0x20896310…f2d4`; empty revocation tree (h14) → `0x0197f217…4c4a`; certificate tree (h16) → `0x1a6bf53e…cc8b`; `state_root` → `0x1f791f3f…9441`; final root → `0x1a46d2abb5609cb22b62fa3275c85adefbf798cdb41407122f36801d50dd527f`, identical to the live `latestRoot`. The trust anchor is fully auditable by anyone. `[VERIFIED — https://certificates.zkpassport.id/mainnet/0x1a46d2abb5609cb22b62fa3275c85adefbf798cdb41407122f36801d50dd527f.json]`
- Deployed bytecode matches published source: reading `RegistryInstance` storage slots 0-7 puts every value exactly where the source's layout predicts. `[VERIFIED — eth_getStorageAt 0x0-0x7 on 0xbaF7Fb72b8d1024f67F3E636db84C9639059e05d]`

### What is actually in the tree

- Current mainnet root contents: **584 certificates, 139 countries, 31 masterlist hashes, zero revocations**, `version 1`, `timestamp 1778032874` (2026-05-06). `[VERIFIED — https://certificates.zkpassport.id/mainnet/0x1a46d2abb5609cb22b62fa3275c85adefbf798cdb41407122f36801d50dd527f.json]`
- Algorithm mix across those 584: **RSA 326, ECDSA 140, RSA-PSS 118** — relevant to prove time and RAM, since ECDSA documents are the memory-heavy path. `[VERIFIED — same file]`
- **Only CSCAs are merkleized. The DSC list is never published or merkleized at all** — the certificate chain is verified *in ZK*. `sig-check/dsc` proves the CSCA's signature over the DSC's TBS while simultaneously proving CSCA tree membership, and the leaf type is hard-coded `CSC_CERT_TYPE = 1`. All 584 live records are CSCAs. `[VERIFIED — https://github.com/zkpassport/circuits/tree/main/src/noir/bin/sig-check/dsc]`
- Full ZK chain of custody: CSCA ∈ tree → CSCA signs DSC TBS → DSC pubkey proven embedded in that TBS (`"Public key of DSC not found in TBS"`) → DSC signs the SOD `signed_attributes`. The CSCA's country is also constrained in-circuit to equal the MRZ issuing country, without revealing it. `[VERIFIED — https://github.com/zkpassport/circuits/blob/main/src/noir/lib/data-check/tbs-pubkey/src/lib.nr]`
- Off-chain distribution is static and content-addressed: `https://certificates.zkpassport.id/{mainnet,testnet}/{root}.json` (gzip). There is **no REST API, no `latest.json`, no directory index** — you must read the root from chain first, then fetch by root. `registry.zkpassport.id` is only a client-rendered explorer. `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/registry-sdk/src/constants.ts]`
- Each root also commits an IPFS CIDv0 on chain; the live one (`QmXXYcQrCPyfKPyH8wpGBp3CrbPSBm9xmYJv5W3kj6iZiV`) resolves on zkPassport's own gateway to identical content. **Caveat: public IPFS gateways did not serve it**, so it may be pinned only on their gateway rather than the public network. `[OBSERVED — https://ipfs.io/ipfs/QmXXYcQrCPyfKPyH8wpGBp3CrbPSBm9xmYJv5W3kj6iZiV]`

### Where the certificates come from — and how stale they are

- **Sourcing is a curated merge of the ICAO PKD master list plus ~28 national master lists.** Provenance is a first-class, cryptographically committed field: each leaf carries `tags`, the set of master lists that vouched for it, and the tags are hashed *into* the leaf. The v0 constant named them: `["ICAO", "DE", "NL", "IT", "ES", "CH", "SE", "IN", "BD"]`; in v1 ICAO's code became `UN`. `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/zkpassport-utils/src/registry/index.ts]`
- **The ICAO PKD is a minority source.** Of the 584 live certificates, only **380 (65%) carry the `UN`/ICAO tag** — 204 rest solely on national master lists. Tag census: `IN 425, SE 417, IT 411, NL 397, UN 380, DE 372, CH 354, HU 347, NO 282, CA 242, ES 202, RO 139, FR 81, CM 13, LV 7, AT 5, MD 5, FI 4, XX 4, UZ 4, BD 2, BW 2, CR 2, UG 2, UA 2, AO 1, EC 1, MN 1, SC 1`. `[VERIFIED — https://certificates.zkpassport.id/mainnet/0x1a46d2abb5609cb22b62fa3275c85adefbf798cdb41407122f36801d50dd527f.json]`
- **67 certificates have only a single voucher, and 4 carry only the non-ISO placeholder `XX`** (1 Paraguay, 3 Türkiye) — evidence that out-of-band, manually added certificates are already accepted in production with no master-list attribution. `[VERIFIED — same file]`
- **The ingest→build→publish pipeline is closed-source.** A public ASN.1 master-list *parser* exists, but it reads from a local path only (`fs.readFileSync`) — there is no fetcher, scraper, LDAP/LDIF client or PKD downloader in any public zkpassport repo, and nothing consumes the `MasterList` class. `[VERIFIED — https://github.com/zkpassport/circuits/tree/main/src/rust/masterlist-interpreter]`
- **No public CI drives it.** No workflow in any org repo has a `schedule:` trigger. `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/tree/main/.github/workflows]`
- **Cadence is irregular, with long gaps.** 27 roots since 2023-12-25, leaf counts growing 468 → 584. Notable gaps: **10 months** (2024-07-11 → 2025-05-08) and 3 months (2025-08-14 → 2025-11-19). Five consecutive roots in early 2026 land at exactly 02:00:00 UTC, suggesting a scheduled but manually gated job. `[VERIFIED — eth_call getHistoricalRoots(1,1,30) on RegistryHelper 0x8C93bB3a7ED88dA0647Ea53f8cd3f57832a513Cd, Ethereum mainnet]`
- **The registry is currently 105 days stale: the newest root dates to 2026-05-06.** The S3 `last-modified` header independently reads `Wed, 06 May 2026 05:55:24 GMT`. Separately, the *contract* was itself deployed on 2026-05-06 and backfilled with all 27 historical roots inside a 12-minute window (each carrying its true historical `validFrom`), so the contract is new while the history is backdated — and nothing has been published since. `[VERIFIED — eth_getLogs RootUpdated on 0xbaF7Fb72b8d1024f67F3E636db84C9639059e05d + getHistoricalRoots, Ethereum mainnet]`
- No community or permissionless submission path exists. `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/registry-contracts/src/RegistryInstance.sol]`

### Who can update it — the core trust finding

- The update function is `updateRootWithMetadata(newRoot, currentRoot, timestamp, leaves, cid, metadata1..3)`, gated **`onlyOracle whenNotPaused`**. `batchUpdateRoots` is also `onlyOracle`. **There is no timelock, no governance, no quorum, and no proof-of-provenance check** — the oracle supplies an arbitrary `bytes32`, and the `cid`/`metadata` fields are decorative strings the same caller chooses. `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/registry-contracts/src/RegistryInstance.sol]`
- The only safeguards are optimistic concurrency and monotonic time: `require(currentRoot == latestRoot)`, `require(indexByRoot[newRoot] == 0)`, `require(timestamp > oldRootData.validFrom)`. `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/registry-contracts/src/RegistryInstance.sol]`
- **The root updater is a bare EOA: `oracle = 0x1F08b2613Cb12dD38E5c449C6033300a61E67250`.** `eth_getCode` returns 0 bytes, and it is the *same* EOA on mainnet, Base and Sepolia. `[VERIFIED — eth_call + eth_getCode on 0xbaF7Fb72b8d1024f67F3E636db84C9639059e05d and the Base/Sepolia instances]`
- **Corroboration that this one key does everything: the oracle EOA's nonce is exactly 27 on mainnet and exactly 27 on Base — equal to `rootCount = 27` on both.** Every root update ever made came from this key, and it has sent no other transaction. Balances are small hot-wallet amounts. `[VERIFIED — eth_getTransactionCount / eth_getBalance on 0x1F08b2613Cb12dD38E5c449C6033300a61E67250]`
- The certificate registry's own `admin` is **also a bare EOA**: `0x9cf1e6240f7e38c95eEF14707395f5366687b502` on mainnet and Base. Admin can `setOracle`, `transferAdmin`, `setValidityWindow`, `setRootValidationMode`, `setRevocationStatus`, `unpause`. `[VERIFIED — eth_call + eth_getCode on 0xbaF7Fb72b8d1024f67F3E636db84C9639059e05d]`
- **`guardian = address(0)` on the certificate registry on all three chains** — the emergency-pause role is unassigned, so only that single admin EOA can pause. `[VERIFIED — eth_getStorageAt slot 2 on the three certificate registry instances]`
- The outer `RootRegistry` is better governed but does not govern the root-writing path. Mainnet + Sepolia admin is the **Safe `0x2000ab040a899f914D6DfD2457C3dFBB22d4c762`**; on Base it is a `ProtocolController` whose own admin is that same Safe. `[VERIFIED — eth_getStorageAt slot 0 on 0x1D0000020038d6E40E1d98e09fA1bb3A7DAA8B70 and the Base ProtocolController]`
- **And that Safe is effectively single-key: `getThreshold()` returns 1, with 2 owners** (`0xcCcf3b4D7a230E0d486C1D4A7035F5eA2Ce6225d`, `0x346bF08C7fb6a976e0bA01bD056bf4AaBB98bA86`). `[VERIFIED — eth_call getThreshold()/getOwners() on 0x2000ab040a899f914D6DfD2457C3dFBB22d4c762, Ethereum mainnet]`

### The attack, stated precisely

- **Whoever holds the oracle EOA key can insert a fabricated country key and mint unlimited fake identities — including one matching any nullifier we have enrolled.** The path is unguarded and **takes effect instantly**, because `isRootValid` short-circuits `if (latestRoot == root) return !revoked;` before any window logic. One key, no quorum, no delay, no challenge period. `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/registry-contracts/src/RegistryInstance.sol]`
- Blast radius is all three chains simultaneously, since the same oracle EOA is configured on each. Incident response is weak: with `guardian` unset, only the single admin hot key can pause. `[VERIFIED — eth_getStorageAt slots 1-2 on the three certificate registry instances]`
- Note this oracle EOA is **not** controlled by the Safe or the `ProtocolController` — that contract exposes only `rootRegistry_*` / `rootVerifier_*` functions and has no path to a registry instance's oracle. So the better-governed layer cannot restrain the weaker one. `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/registry-contracts/src/ProtocolController.sol]`
- The genuine mitigation is **detectability, not prevention**: because provenance tags are hashed into every leaf and the 31 master-list file hashes are committed into the root, anyone can prove after the fact which master lists vouched for a given CSCA. A fabricated key would have to appear with forged or empty tags. But nothing in the contracts or circuits *checks* tags, and the 4 `XX`-only certificates show unattributed entries already pass. `[VERIFIED — https://certificates.zkpassport.id/mainnet/0x1a46d2abb5609cb22b62fa3275c85adefbf798cdb41407122f36801d50dd527f.json]`
- **The project publishes essentially nothing about this trust model.** The docs sitemap has 20 URLs and none covers the registry, master lists, or governance; `registry-contracts/README.md` is a single line. Grepping both repos and the docs for "trust assumption / centrali / decentrali / governance / timelock" returns no substantive hit. **No decentralization roadmap was found anywhere.** `[VERIFIED — https://docs.zkpassport.id/sitemap.xml]`
- Dev/test anchor is properly separated: mock passports are signed by the fictional "Zero Knowledge Republic", whose roots are in **Sepolia only** and explicitly not in mainnet registries, and mock proofs carry distinct nullifier types. `[VERIFIED — https://docs.zkpassport.id/getting-started/dev-mode]`
## 4. Revocation, expiry, key rotation, replay

### Root updates and old proofs

- **Historical roots are retained permanently on chain**, in `mapping(bytes32 => HistoricalRoot)` with `{validFrom, validTo, revoked, leaves, cid, metadata1..3}` plus `rootByIndex`/`indexByRoot`. Nothing is ever deleted. `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/registry-contracts/src/RegistryInstance.sol]`
- Four validation modes exist: `LATEST_ONLY`, `LATEST_AND_PREVIOUS`, `VALID_AT_TIMESTAMP`, `VALID_WITHIN_WINDOW`. `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/registry-contracts/src/IRegistryInstance.sol]`
- **Live mainnet config: `rootValidationMode = 3` = `VALID_WITHIN_WINDOW`, `validityWindowSecs = 86400` (24 hours).** This is also the constructor default in `CertificateRegistry.sol`, and Base is configured identically (same mode, same window, same `rootCount = 27`, same `latestRoot`). `[VERIFIED — eth_call rootValidationMode()/validityWindowSecs() on 0xbaF7Fb72b8d1024f67F3E636db84C9639059e05d and 0x501aded0683d5f859ff1097a3ba4e3e0e0f999d8]`
- The exact rule: the **latest root is always valid regardless of timestamp**; any older root is valid only if `validFrom <= timestamp && (validTo == 0 || validTo >= timestamp - validityWindowSecs)`. `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/registry-contracts/src/RegistryInstance.sol]`
- **Confirmed empirically at the exact boundary.** Root #27 (latest) returns valid at `now`, at ts=1,000,000,000 (year 2001, before its own `validFrom`) and at ts=2,500,000,000 (year 2049). Root #26 returns valid at its `validTo` and at `validTo + 86400`, but **invalid at `validTo + 86401`**. `[VERIFIED — eth_call isRootValid(1, root, ts) on 0x1D0000020038d6E40E1d98e09fA1bb3A7DAA8B70, Ethereum mainnet]`
- **Practical answer for us: a proof built on the newest root never expires from the root's side; a proof built on a superseded root dies 24 hours after it was replaced.** Since a recovery flow always generates a fresh proof, this is not a blocker — but it does mean a proof cannot be pre-generated and stored for months as a break-glass artifact. `[INFERRED — eth_call isRootValid on 0x1D0000020038d6E40E1d98e09fA1bb3A7DAA8B70, Ethereum mainnet]`
- Reassuringly the mode is **not** `LATEST_ONLY`. But `admin`/`oracle` can switch it to `LATEST_ONLY` at any time with no delay, which would invalidate in-flight proofs. `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/registry-contracts/src/RegistryInstance.sol]`
- The timestamp used is **not `block.timestamp`** — it is the proof's own `current_date` public input. **In-circuit there is no root freshness check at all**: the circuit proves only "this CSCA is in the tree committed by root R", with `timestamp` a private witness fed into root reconstruction and never compared to `current_date`. All root-age enforcement is on chain. `[VERIFIED — https://github.com/zkpassport/circuits/blob/main/src/noir/lib/commitment/csc-to-dsc/src/lib.nr]`
- Every root's `revoked` flag is checked in all four modes, so a single bad root can be retracted retroactively via `setRevocationStatus` (`onlyAdminOrOracle`). All 27 live roots have `revoked = 0`. `[VERIFIED — eth_call getHistoricalRoots on RegistryHelper 0x8C93bB3a7ED88dA0647Ea53f8cd3f57832a513Cd, Ethereum mainnet]`

### Certificate revocation and expiry — both specified, neither enforced

- **A revocation tree exists and is committed into the published root, but its contents are not checked in-circuit.** The circuit header says so outright: the revocation and masterlist roots "are bound to the published `certificate_registry_root` via the hash above, but their contents are not verified by this sub-circuit at the moment." `[VERIFIED — https://github.com/zkpassport/circuits/blob/main/src/noir/lib/commitment/csc-to-dsc/src/lib.nr]`
- **Consequence: a revoked DSC is not rejected today.** Grepping `revok|revoc|crl` across every `.nr` file yields only `revocation_tree_root` plumbing — zero non-membership logic. `[VERIFIED — https://github.com/zkpassport/circuits/tree/main/src/noir]`
- **And the revocation tree is empty in production**: the live packaged file has no `revocations` key, and the root only recomputes correctly using an all-zeros depth-14 tree. Nothing is revoked. `[VERIFIED — https://certificates.zkpassport.id/mainnet/0x1a46d2abb5609cb22b62fa3275c85adefbf798cdb41407122f36801d50dd527f.json]`
- The mechanism is built but unwired: a complete ordered-tree non-membership scheme exists in TypeScript (`buildRevocationExclusionProof`, enforcing `lower.leaf < target < upper.leaf` with adjacent indices), with **no Noir counterpart**. Leaf format is DSC-serial based. `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/zkpassport-utils/src/registry/index.ts]`
- **No CRL fetching, no CRL distribution-point parsing, and no OCSP anywhere** in circuits or packages. `[VERIFIED — https://github.com/zkpassport/circuits/tree/main/src/noir]`
- **CSCA expiry is committed but never enforced.** `csc_expiry: u32` flows only into the leaf hash; there is no `assert(csc_expiry > current_date)` anywhere in the circuits. Off-chain CSCA selection also ignores validity dates — `getCscaForPassportAsync` falls back to `return akiMatchedCert` even when every check fails, so an expired-but-in-tree CSCA remains selectable. `[VERIFIED — https://github.com/zkpassport/circuits/blob/main/src/noir/lib/commitment/csc-to-dsc/src/lib.nr]`
- So revocation exists only at **whole-root granularity**. A specific stolen, cloned or compromised passport cannot be revoked by zkPassport, by the issuing country, or by us. `[INFERRED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/registry-contracts/src/RegistryInstance.sol]`
- Do not confuse this with the person-level **sanctions** registry (id 3), which is a separate feature with real in-circuit non-membership over an ordered tree, sourced from OpenSanctions (US OFAC SDN, EU FSF, UK FCDO, CH SECO). `[VERIFIED — https://github.com/zkpassport/circuits/tree/main/src/ts/sanctions]`

### Country key rotation

- **CSCA rotation is handled implicitly by accumulation, not replacement.** Old and new CSCAs coexist in the tree; leaf counts grow monotonically (468 → 584) and dipped only twice across 27 roots. A country's rotation appears as a new leaf at the next publication. `[INFERRED — eth_call getHistoricalRoots on RegistryHelper 0x8C93bB3a7ED88dA0647Ea53f8cd3f57832a513Cd, Ethereum mainnet]`
- Because expiry is not enforced, documents signed under an old CSCA keep working indefinitely — good for our durability, bad for hygiene. `[INFERRED — https://github.com/zkpassport/circuits/blob/main/src/noir/lib/commitment/csc-to-dsc/src/lib.nr]`

### Document expiry and reissuance

- **Document expiry is enforced in-circuit, hard.** `data-check/expiry` asserts `current_date.lt(expiry_date)` with the message `"Document is expired"`. An expired document therefore **cannot produce a valid proof at all** — this is the one date actually checked against `current_date` in ZK. `[VERIFIED — https://github.com/zkpassport/circuits/blob/main/src/noir/lib/data-check/expiry/src/lib.nr]`
- **Reissuance breaks the identifier.** The private nullifier is `Poseidon2` over packed `DG1 || eContent || SOD signature`. Because the SOD signature is an input, a reissued (or merely re-signed) document yields a **completely different nullifier**. `[VERIFIED — https://github.com/zkpassport/circuits/blob/main/src/noir/lib/commitment/common/src/lib.nr]`
- Together these put a **hard ceiling on any enrolment**: recovery works until the enrolled document expires (max ~10 years, less for documents issued to minors), and then never again. An enrolled user who renews their passport silently loses recovery. `[INFERRED — https://github.com/zkpassport/circuits/blob/main/src/noir/lib/data-check/expiry/src/lib.nr]`

### Replay and request binding

- Proof freshness: `DateUtils.isDateValid` requires `block.timestamp >= proofTimestamp` and `proofTimestamp + validityPeriodInSeconds > block.timestamp`. **The verifier caller chooses `validityPeriodInSeconds`**, so we control the replay window; the SDK default is 7 days. `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/registry-contracts/src/lib/DateUtils.sol]`
- **The verifier itself provides no replay protection.** `verify` is a stateless `view` function — it never records a consumed nullifier. Within the chosen validity window the same proof bytes verify an unlimited number of times. **Anti-replay is entirely the integrator's job**: we must store used nullifiers, or bind a per-attempt nonce. `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/registry-contracts/src/SubVerifier.sol]`
- What binds a proof to a request, and it is genuinely strong: `bind("user_address", …)`, `bind("chain", …)` and `bind("custom_data", …)` are committed inside the proof and recovered on chain via `helper.getBoundData()` as `{senderAddress, chainId, customData}`. **`custom_data` is our nonce/challenge channel**; total bound data is capped at **500 bytes** and `custom_data` is ASCII. `[VERIFIED — https://docs.zkpassport.id/api]`
- Scope binding is enforced in the contract, not merely advisory: `_verifyScopes` recomputes `sha256(domain) >> 8` and `sha256(scope) >> 8` and requires equality with the `service_scope`/`service_subscope` public inputs. A proof minted for another domain cannot be replayed against ours. `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/registry-contracts/src/SubVerifier.sol]`
- Commitment soundness: `_verifyCommittedInputs` walks the whole `committedInputs` blob, recomputes each `sha256(...) >> 8` commitment, and asserts full coverage on both sides (`offset == length`, `index == count`) — so an attacker cannot append or omit predicates. `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/registry-contracts/src/SubVerifier.sol]`
- **A scope/date forgery gap in this very area was closed only two weeks ago.** PR #152 (2026-08-06) added the assertion that "at least one disclosure subproof must commit to the top-level scope, subscope and current date, so an outer proof can never be built purely from scope-less reusable subproofs while claiming an arbitrary scope or date." Before that fix, the scope binding we would rely on was forgeable. `[VERIFIED — https://github.com/zkpassport/circuits/pull/152]`

### Liveness risk

- **Verification can be paused at three independent layers.** `RootVerifier.pause()` is callable by `admin` or `guardian`; `SubVerifier.setPaused` is `onlyAdmin`, with `whenNotPaused` on `verify`; and `RootRegistry.isRootValid` returns `false` when paused. Any one of these makes **every** recovery attempt fail. Live state: none currently paused, and `guardian` is unset on both the RootVerifier and the certificate registry. `[VERIFIED — eth_call paused()/guardian() on 0x1D000001000EFD9a6371f4d90bB8920D5431c0D8, Ethereum mainnet]`
## 5. Identifier model for our use case

- The thing to enrol is the **`scoped_nullifier`**, a single `bytes32` returned from `verify()` as `uniqueIdentifier` and exposed as the second-from-last public input. It is a hash, not a public key and not a commitment we open later. `[VERIFIED — https://docs.zkpassport.id/getting-started/onchain]`
- Exact derivation, two layers:
  - `private_nullifier = Poseidon2(pack31(DG1) || pack31(eContent) || pack31(SOD_signature))`
  - `scoped_nullifier = Poseidon2([private_nullifier, service_scope, service_subscope])`, or `Poseidon2([private_nullifier, service_scope, service_subscope, nullifier_secret])` when salted. `[VERIFIED — https://github.com/zkpassport/circuits/blob/main/src/noir/lib/commitment/common/src/lib.nr]`
- **We do control a per-app scope, and it is two-level.** `service_scope = sha256(domain) >> 8` (our registered domain) and `service_subscope = sha256(scope) >> 8` (the free-form `scope` string we pass to `request()`). Both are checked on-chain. `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/registry-contracts/src/SubVerifier.sol]`
- Therefore the identifier is **unlinkable across services**, and we can go further: using a distinct `scope` string per wallet account yields a **distinct nullifier per account**, unlinkable to each other. That is a direct analogue of a per-account secret — but note it is a *public* domain-separator, not a secret, so it must be remembered (or derived deterministically) to re-verify. `[INFERRED — https://github.com/zkpassport/circuits/blob/main/src/noir/lib/commitment/common/src/lib.nr]`
- **Stability — the critical caveat.** The identifier is stable for the *same physical document*: same document ⇒ same nullifier for a given (domain, scope). It is **not** stable across passport reissuance, because the SOD signature feeds the hash. A user who renews their passport **loses the ability to recover**. `[VERIFIED — https://github.com/zkpassport/circuits/blob/main/src/noir/lib/commitment/common/src/lib.nr]`
- Combined with hard in-circuit expiry enforcement, this gives a **bounded lifetime on any enrolment**: recovery works until the enrolled document expires (max ~10 years, less for IDs issued to minors), and then never again. `[INFERRED — https://github.com/zkpassport/circuits/blob/main/src/noir/lib/data-check/expiry/src/lib.nr]`
- Privacy caveat on the default identifier: it is derived only from chip data + domain + scope, so **anyone with full knowledge of the chip data can recompute it** — explicitly including the issuing government. `[VERIFIED — https://docs.zkpassport.id/faq]`
- The fix is `NullifierType.SALTED`, which mixes in a `nullifier_secret` produced by a **vOPRF network** so nobody can recompute the identifier from chip data alone, while keeping determinism. `[VERIFIED — https://docs.zkpassport.id/examples/salted-identifiers]`
- But salted identifiers carry two hard couplings: they **require `.facematch("strict")`** (the request throws without it), and the circuit **requires a valid OPRF proof** (`assert(oprf_proof.beta != 0, ...)`). `[VERIFIED — https://github.com/zkpassport/circuits/blob/main/src/noir/lib/commitment/scoped-nullifier/src/lib.nr]`
- Salted proofs are pinned to a **single global OPRF key** on-chain: `SubVerifier._verifyOPRFPubKeyHash` requires the proof's `oprf_pk_hash` to equal `globalOPRFPubKeyHash`, which `admin` can change at will. The code comments "Per-service OPRF key overrides are not supported for now." **If that key rotates, previously enrolled salted nullifiers stop verifying.** `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/registry-contracts/src/SubVerifier.sol]`
- I confirmed the key is live and singular: the SDK's `DEFAULT_OPRF_PUB_KEY_HASH` constant equals `0x029ad69ef5e692aa43cd3635002a473d72b412d10741d2cba30700df1e895334`, and the mainnet subverifier's `globalOPRFPubKeyHash()` returns **exactly that value**. `[VERIFIED — eth_call globalOPRFPubKeyHash() on 0x358324e0D0deeA401078aeB2dc252157B678b43C, Ethereum mainnet]`
- **Who runs the OPRF network matters for us: the three nodes are operated by H2ONodes, TACEO, and Aztec Labs, with `OPRF_DEFAULT_THRESHOLD = 2`.** Since Aztec Labs owns zkPassport, the vendor is itself one of three operators — so **the vendor plus one partner reaches the 2-of-3 threshold** and could recompute salted identifiers. All three nodes are EU-region (`eu.node{0,1,2}.zkp.oprf.taceo.network`), reached over a WebSocket handshake. `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/zkpassport-utils/src/oprf/constants.ts]`
- Net effect on the privacy choice: the default nullifier is recomputable by the issuing government; the salted nullifier is recomputable by a 2-of-3 quorum that includes the vendor. Neither is unconditionally private, and only the salted one adds a live network dependency plus a mandatory FaceMatch. `[INFERRED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/zkpassport-utils/src/oprf/constants.ts]`
- There are 5 nullifier types: `NON_SALTED (0)`, `SALTED (1)`, `NON_SALTED_MOCK (2)`, `SALTED_MOCK (3)`, `NONE (4)`. The contract rejects mock types unless `devMode`, and rejects `NONE` (which forces `scoped_nullifier == 0`) outside devMode. Mainnet is additionally protected because ZKR certificates are absent from mainnet roots. `[VERIFIED — https://github.com/zkpassport/circuits/blob/main/src/noir/lib/utils/src/constants.nr]`
- Sybil bound: one nullifier per *document*, not per *human*. The docs are explicit that the guarantee is `one ID <-> one account`, not `one person <-> one account`. `[VERIFIED — https://docs.zkpassport.id/examples/personhood]`
- **Trap to avoid: never key a recovery module on a dashboard policy.** Applying `.policy(id)` **locks the scope to `<policy-id>:<version>`**, so bumping the policy version **rotates every user's unique identifier** — silently orphaning every enrolment. For our use case the scope must be a constant string we control and never change. `[VERIFIED — https://docs.zkpassport.id/getting-started/policies]`
- Practical enrolment shape for us, given all of the above: store `keccak/bytes32 scopedNullifier` per account, with a fixed `scope` string, plus the document's `expiry_date` (so the wallet can warn the user before the enrolment dies), and a used-nonce set for replay protection. `[INFERRED — https://docs.zkpassport.id/getting-started/onchain]`

## 6. SDK surface and flow

- Packages: **`@zkpassport/sdk`** (headless) and **`@zkpassport/ui`** (drop-in QR card, React `ZKPassportQRCode` + framework-agnostic `mount()`). Both are browser-side TypeScript. `[VERIFIED — https://docs.zkpassport.id/getting-started/quick-start]`
- Integrator surface is small: `new ZKPassport(domain)` → `request(options)` → chain query-builder predicates (`disclose`, `gte`, `range`, `in`/`out`, `bind`, `facematch`, `sanctions`, `policy`) → `done()` → `{url, onResult, …}`, plus lifecycle callbacks `onRequestReceived`, `onGeneratingProof`, `onProofGenerated`, `onResult`, `onReject`, `onError`. `[VERIFIED — https://docs.zkpassport.id/api]`
- **A phone handoff is unavoidable.** The flow is a request URL `https://zkpassport.id/r?d=<domain>&t=<topic>&c=<base64 query>&s=<base64 service>&p=<ecdh pubkey>&m=<mode>&v=<version>&dt=<timestamp>&dev=<0|1>` rendered as a QR code, or opened as a deep link on the same device. A `returnDeepLink` option supports the same-device round trip back to the browser. `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/zkpassport-sdk/src/index.ts]`
- The mobile app is a required component and is a **closed-source native app** on the App Store / Play Store. The docs state it "will be open sourced when out of the testing phase". This is the part of the trust base you cannot audit today. `[VERIFIED — https://docs.zkpassport.id/faq]`
- Transport between browser and phone is a **relay: `@obsidion/bridge` (^0.11.2)**, a third-party package, keyed by a `bridgeId`/topic with an **ECDH key pair so payloads are end-to-end encrypted** between page and phone. The relay sees ciphertext and routing metadata. `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/zkpassport-sdk/package.json]`
- The bridge is **overridable**: `request()` accepts `bridgeUrl`, and also `topicOverride` / `keyPairOverride`. The docs class these as "Advanced configuration: feel free to contact us if you need to use these options". `[VERIFIED — https://docs.zkpassport.id/api]`
- Verification can be done fully client-side (browser WASM, or an `eth_call` against the deployed verifier), fully on-chain (submit to our contract), or server-side. There is **no requirement to send proofs to zkPassport** for the self-served flow. `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/zkpassport-sdk/src/index.ts]`
- `@zkpassport/ui` deliberately does **not** expose the advanced escape hatches: its options type omits `projectID`, `topicOverride`, `keyPairOverride`, `cloudProverUrl` and `bridgeUrl`. Using them means dropping to the raw SDK and building our own UI. `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/zkpassport-ui/src/types.ts]`

### A specific risk for a browser extension

- **The SDK's domain/origin handling is known to break outside a normal web page, and it fails silently.** In Node, `Bridge.create()` omits `origin`, so the WebSocket announces `Origin: "nodejs"`; the phone app cannot match that to a registered domain, **the Confirm slider stays permanently disabled, and `onError` never fires**. Open since 2026-05-25, with a working patch in the issue. `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/issues/211]`
- A browser extension presents a `chrome-extension://<id>` origin, not an `https://` domain. Since the whole scope model is `sha256(domain)` and the app validates origin against a registered domain, **this is the most likely single blocker for our integration and should be the first thing prototyped.** Nothing in the docs addresses extension origins. `[INFERRED — https://github.com/zkpassport/zkpassport-packages/issues/211]`
- Related friction reported by integrators: **no Solidity interfaces are shipped on npm** (they must be copied out of the HTML docs — open since 2025-11), **`zkpassport-packages` has no LICENSE file** (a contributor reported this blocks them from using it, open since 2026-08-11), and there is **no published proof-format spec** for third-party verifiers. `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/issues/145]`
- Headless/automated testing is impossible without dev mode, because "a phone can't scan a headless browser" — relevant to our CI story. `[VERIFIED — https://github.com/RonTuretzky/zkburn-decentralized]`

## 7. Dependencies that break a backend-zero design

Good news first: **no API key and no account are required.** Quote: "No API key and no account are required to get started — just install the packages and you're good to go." `[VERIFIED — https://docs.zkpassport.id/getting-started/quick-start]`

But a browser extension with no backend still inherits these third-party runtime dependencies:

- **The relay/bridge is mandatory infrastructure, and it is zkPassport's own closed-source server.** The default endpoint is hardcoded in the package as `DEFAULT_WS_ENDPOINT = "wss://bridge.zkpassport.id"` — a WebSocket relay on zkPassport's domain. Payloads are ECDH end-to-end encrypted so the relay sees ciphertext plus routing metadata, but **availability is a hard dependency for every enrolment and every recovery**. `[VERIFIED — @obsidion/bridge@0.11.2, dist/esm/chunk-JJR3XGA6.js — https://www.npmjs.com/package/@obsidion/bridge]`
- **`bridgeUrl` is overridable but not practically self-hostable today**: the published npm package is client-only (no server component, no `repository` field, and no public source repo for the server was found). Pointing `bridgeUrl` elsewhere would mean reimplementing the relay protocol ourselves — and the phone app would still have to be told to use it, which the request URL does not appear to carry. `[VERIFIED — @obsidion/bridge@0.11.2 package contents — https://www.npmjs.com/package/@obsidion/bridge]`
- **The request URL is on zkpassport.id.** `https://zkpassport.id/r?...` is what the QR encodes. If that host is unreachable the deep link cannot be handed off, even though the query payload itself is self-contained in the URL. `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/zkpassport-sdk/src/index.ts]`
- **Hardcoded shared Alchemy RPC keys.** `zkpassport-sdk/src/index.ts` and `registry-sdk/src/client.ts` both embed the *same* Alchemy API key (`in6UjcATST36yyKuk83yb1yukKs65u8G`) for eth-mainnet, base-mainnet and eth-sepolia. This is a **rate-limited endpoint shared across every zkPassport integrator**. For a wallet this is unacceptable as-is — we must inject our own RPC/transport. `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/registry-sdk/src/client.ts]`
- **Artifact CDNs.** Circuit manifests and packaged circuits come from `circuits2.zkpassport.id/{mainnet,testnet}` (`/by-root/…`, `/by-version/…`, `/by-hash/…`) and certificates from `certificates.zkpassport.id/{mainnet,testnet}`. Both have an **IPFS fallback at `ipfs.zkpassport.id/ipfs/{cid}`** and are content-addressed, so they are mirrorable — a genuine mitigation. `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/registry-sdk/src/constants.ts]`
- **Sanctions tree** (only if we use `.sanctions()`, which recovery does not need) is a single gzipped blob from `cdn.zkpassport.id`. `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/zkpassport-utils/src/circuits/sanctions/sanctions.ts]`
- **The vOPRF network is a 2-of-3 threshold service run by H2ONodes, TACEO and Aztec Labs**, at `eu.node{0,1,2}.zkp.oprf.taceo.network`, over WebSockets, all EU-region. Required **only** for salted identifiers — but if we want them, this is a live multi-party service in the critical path of every enrolment *and* every recovery, and its key is pinned on chain (§5). `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/zkpassport-utils/src/oprf/constants.ts]`
- **Dashboard API** at `dashboard-api.zkpassport.id` handles per-domain config and proof submission. Used by the dashboard/policy flow (`.policy("pol_xyz")`, `projectID`); avoidable by staying fully self-served. `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/zkpassport-sdk/src/constants.ts]`
- **A hosted cloud prover is in the path for exactly the mode we need, and it has a hard capacity ceiling.** Its own README states it is used "only for recursing sub-proofs (already proven with concealed private inputs) into a final compressed EVM-compatible proof, or for proving non-sensitive sub-proofs, where a user's device memory is insufficient (i.e. less than ~2 GB)", and that "No sensitive passport/national ID card information ever leaves a user's device". Only `outer*`, `facematch*` and `sig_check_dsc*` circuits are accepted, validated against the circuit registry. `[VERIFIED — https://github.com/zkpassport/cloud-prover]`
- Concretely: it runs on a GKE cluster in `us-central1-a` on **spot** `t2d-standard-16` nodes, **one proof per node at ~84s per large EVM outer proof**, with the autoscaler capped at **max 6 nodes** (min 1 warm) and a 600s ingress timeout. That is a ceiling of roughly six concurrent EVM proofs globally, on preemptible capacity, in a single zone. `[VERIFIED — https://github.com/zkpassport/cloud-prover]`
- **Why this is more serious than the README implies.** The README frames cloud proving as a fallback for devices with under ~2GB RAM. But the app's bundled SRS covers only 2²¹ while every outer circuit is 2²²–2²⁴ (§1), so **the `compressed-evm` outer proof appears to be unprovable on any phone** — meaning the hosted prover is on the critical path of *every* on-chain verification, not just low-end devices. The in-app default is `https://cloud-prover.zkpassport.id`. `[INFERRED — https://docs.zkpassport.id/faq]`
- What it actually receives: witness-level inputs for the `outer*`, `facematch*` and `sig_check_dsc*` families (it accepts a pre-solved witness or raw inputs and solves the witness itself). Privacy rests on a **client-side guard** — the app only routes a disclosure/facematch circuit there when `salted_private_nullifier == 0` and every element of `salted_dg1` is `0`. So the "no sensitive data leaves the device" claim depends on the closed-source app enforcing that guard correctly. `[VERIFIED — https://github.com/zkpassport/mobile-app/blob/main/src/services/ProofService/DisclosureProofService.ts]`
- The service code has **no auth, no API key and no rate limiting** — an unguarded `POST /prove` with `express.json({limit: "50mb"})`. The app does define a 401 `AUTHENTICATION_FAILED` case, so something may sit in front of the hosted deployment, but nothing documents it. `[VERIFIED — https://github.com/zkpassport/cloud-prover/blob/main/src/server.ts]`
- **Mitigation, with a legal caveat**: it is self-hostable in practice (`npm run dev`, or a Docker build; the repo ships Terraform and kustomize), and `cloudProverUrl` points the flow at our own instance. But the cloud-prover repo has **no LICENSE file**, so redistribution rights are unclear. `[VERIFIED — https://github.com/zkpassport/cloud-prover]`
- `cloudProverUrl` is also gated as advanced config — the docs say "Contact us if you need these", and `@zkpassport/ui` excludes it from its public props. `[VERIFIED — https://docs.zkpassport.id/api]`
- **On-chain liveness dependencies** (see §4): `RootVerifier.pause`, `SubVerifier.setPaused` and `RootRegistry` pause each unilaterally disable all verification. `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/registry-contracts/src/RootVerifier.sol]`
- Pricing tiers / rate limits on the hosted services: `[UNKNOWN — no source found]`

## 8. Security caveats — what a zkPassport proof does NOT prove

- **It does not prove personhood, only document-hood.** The docs state the guarantee is `one ID <-> one account`, not `one person <-> one account`, because "a person can have multiple IDs". Dual nationals and holders of passport + national ID + residence permit can mint multiple distinct nullifiers under the same scope. `[VERIFIED — https://docs.zkpassport.id/examples/personhood]`
- **It does not prove the holder is the subject** unless FaceMatch is requested. Without `.facematch()`, possession of the document (and its MRZ) is sufficient — so **document theft is a complete break** of a recovery scheme that relies on the nullifier alone. `[VERIFIED — https://docs.zkpassport.id/examples/personhood]`
- FaceMatch is the stated mitigation, with `strict` mode for higher-security flows, and it runs **locally on the device**. `[VERIFIED — https://docs.zkpassport.id/api]`
- FaceMatch has real availability limits the project itself documents: it needs a "trustable device"; **Android devices may be refused** if attestation is unsatisfactory; photo extraction from some IDs fails, which prevents the face scan entirely; and some Android attestation signature algorithms are unsupported. `[VERIFIED — https://docs.zkpassport.id/limitations]`
- FaceMatch trust is rooted in **platform attestation**, not in zkPassport: the SDK pins Apple App Attest and Google key-attestation root key hashes, plus the iOS/Android app-id hashes. So FaceMatch assurance inherits Apple's and Google's attestation integrity, and the closed-source app's honesty. `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/zkpassport-sdk/src/constants.ts]`
- **It does not prove liveness or absence of coercion.** Nothing in the protocol distinguishes a willing user from one under duress; a `strict` FaceMatch specifically proves a live face matching the document, which a coerced user also satisfies. `[INFERRED — https://docs.zkpassport.id/examples/facematch]`
### Chip cloning — the sharpest finding, and it is confirmed

- **The circuits implement Passive Authentication only. There is no Active Authentication (AA) and no Chip Authentication (CA) proven in ZK.** A code search over `zkpassport/circuits` returns **zero occurrences of `DG14` or `DG15`** — the data groups that carry the AA/CA public keys. The circuit set is exactly `bind`, `compare`, `data-check`, `disclose`, `exclusion-check`, `facematch`, `inclusion-check`, `main/outer`, `oprf-auth`, `sig-check/{dsc,id-data}`. `[VERIFIED — https://github.com/zkpassport/circuits/tree/main/src/noir/bin]`
- **Worse: Active Authentication is commented out in the iOS reader.** `PassportReader.swift` line ~685 reads `//try await doActiveAuthenticationIfNeccessary(tagReader : tagReader)` — AA is never performed at all, not even locally. `[VERIFIED — https://github.com/zkpassport/mobile-app/blob/main/ios/PassportReader/Sources/PassportReader/PassportReader.swift]`
- And the dormant AA code would be **replay-vulnerable if re-enabled**: the random challenge line is commented out and replaced with a hardcoded one — `// let challenge = generateRandomUInt8Array(8)` then `let challenge = hexStringToBytes("000000006502d67b")`. `[VERIFIED — https://github.com/zkpassport/mobile-app/blob/main/ios/PassportReader/Sources/PassportReader/PassportReader.swift]`
- Chip Authentication is attempted when DG14 advertises it, but is **non-blocking**: failure sets `chipAuthenticationStatus = .failed` and the scan continues. The status never enters a circuit, so a verifier **cannot tell whether CA succeeded, failed, or was skipped**. `[VERIFIED — https://github.com/zkpassport/mobile-app/blob/main/ios/PassportReader/Sources/PassportReader/PassportReader.swift]`
- Passive Authentication alone cannot detect a cloned chip — an unaltered clone carries the same data and the same valid country signature. AA and EAC-CA are the only cryptographic clone detectors in ICAO 9303, and neither is mandatory for issuers. `[OBSERVED — https://www.readid.com/blog/overview-security-mechanisms-epassports]`
- **What this means for a recovery module, precisely: a zkPassport proof attests that a validly signed chip dump exists and was presented — not that the genuine physical chip, nor its rightful holder, is present.** A one-time chip read (a hotel check-in, a border scan, a leaked dataset) is sufficient to mint proofs forever, until the document expires. As one third-party reviewer puts it, a sybil farm "does not need to acquire passports; it needs to acquire chip reads, which is a data-brokerage problem, not a physical one." `[OBSERVED — https://github.com/andrevalenm/poh-aggregator/blob/main/research/protocols/zk-passport-and-eid.md]`
- FaceMatch is the only real mitigation against this, because it binds a live face to the chip's DG2 photo. It compares against the **chip-stored** photo, not a camera scan of the printed page. `[VERIFIED — https://docs.zkpassport.id/faq]`
- **There is no revocation path for a stolen or cloned document** — it remains valid until expiry (§4). `[OBSERVED — https://github.com/andrevalenm/poh-aggregator/blob/main/research/protocols/zk-passport-and-eid.md]`
- Photo-only / non-chip verification is explicitly disclaimed: relying on ID photos inside ZK proofs gives "close to no guarantee on whether the ID is authentic or not". `[VERIFIED — https://docs.zkpassport.id/limitations]`
- **Coverage is partial and is a UX cliff.** Only ICAO-9303 documents from countries that publish their signing certificates work. The project's own advice is to "make ZKPassport optional or provide fallback verification methods" — advice we should take literally for a recovery method. `[VERIFIED — https://docs.zkpassport.id/limitations]`
- Default (non-salted) nullifiers are **recomputable by the issuing government**, which for a wallet means a state actor can link an on-chain account to a citizen. `[VERIFIED — https://docs.zkpassport.id/faq]`
- Marketing claim to treat with care: the site asserts "Deepfakes, forgeries, and AI-generated IDs can't pass" because verification rests on chip signatures. True for *forged* documents; **not** a claim about theft, coercion or cloning. `[OBSERVED — https://zkpassport.id]`

## 9. Audits, reviews, and whether the code is frozen

### Audits — there are none

- **The project states, as of today, that it has never had an external audit.** The SDK README's `Security` section reads verbatim: *"ZKPassport has undergone multiple internal audits, but it has not yet had an external audit."* That file was last modified **2026-08-20** (commit `a843c1e`, "chore(sdk): Update Readme (#257)") — the statement is current, not stale. `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/zkpassport-sdk/README.md]`
- `SECURITY.md` (identical in `circuits` and `zkpassport-packages`) says only *"ZKPassport is currently under internal and external review."* It defines a disclosure channel — GitHub Private Vulnerability Reporting or **`security@aztec-labs.com`** — and names no auditor, date or scope. `[VERIFIED — https://github.com/zkpassport/circuits/blob/main/SECURITY.md]`
- Context for that email address: **Aztec Labs acquired zkPassport on 2026-05-27.** The official announcement contains no mention of any audit, auditor, security review or bug bounty. `[VERIFIED — https://aztec-labs.com/blog/zkpassport-acquisition]`
- **No `/audits` folder and no audit report exists in any repo in the org.** `[VERIFIED — https://github.com/orgs/zkpassport/repositories]`
- The only visible external-review artefact is an **open, unmerged pull request: #96 "DO NOT MERGE - zkpassport circuit audit comments"**, opened 2025-09-05 by Michael Connor (`iAmMichaelConnor`, Aztec), touching 48 files with 10 review comments — bug descriptions, missing tests, and security recommendations. Still open. Note this is an internal-adjacent review, not an independent audit. `[VERIFIED — https://github.com/zkpassport/circuits/pull/96]`
- **A press claim of external audits appears to be false.** crypto.news (2026-05-27) states the project *"had already passed multiple live audits, with Consensys Diligence and TU Vienna both contributing security reviews."* This is directly contradicted by the project's own README, is absent from the official Aztec Labs announcement, and no matching entry appears on the auditor's own site. Do not rely on it. `[OBSERVED — https://crypto.news/aztec-labs-acquires-zkpassport-code-stays-open/]`
- `zkpassport.id` and `docs.zkpassport.id` carry no "audited by" badge, auditor name, or report link. `[VERIFIED — https://zkpassport.id/]`
- **No bug bounty exists.** `SECURITY.md` offers only unpaid coordinated disclosure. Aztec Network's Cantina bounty scope covers the L1 rollup stack, not zkPassport. Note the inverted relationship: **zkPassport is the KYC gate for other programs' bounty payouts** (Immunefi, Aztec), not itself a bounty target. `[VERIFIED — https://github.com/zkpassport/circuits/blob/main/SECURITY.md]`
- Zero published GitHub security advisories on `circuits` and `zkpassport-packages`, and zero npm advisories for `@zkpassport/sdk` or `@zkpassport/utils`. `[VERIFIED — https://github.com/zkpassport/circuits/security/advisories]`

### One real, publicly documented soundness bug — fixed

- **Issue #143, "OFAC Sanctions Evasion via Under-Constrained MRZ Name Parsing"**, reported 2026-05-13 by Moazzam Arif (`imxm`, BlockApex / QuillAudits), closed 2026-06-15. A genuine, exploitable soundness break. `[VERIFIED — https://github.com/zkpassport/circuits/issues/143]`
- Root cause: `find_subarray_index` used an **unconstrained Brillig hint on the critical path**. The constraint system pinned the match offset to *"some position where the needle matches"* rather than *"the first position"*, letting the prover choose. `[VERIFIED — https://github.com/zkpassport/circuits/issues/143]`
- Exploit: a sanctioned person with a genuine CSCA-signed passport picks any `<<` inside the MRZ trailing padding, producing a non-canonical name decomposition whose hash was never inserted into the sanctions tree — so the **non-membership proof passes**. Every real passport has padding, so every sanctioned person was exploitable, and one witness edit defeated the name, name+DOB and name+YOB trees at once. `[VERIFIED — https://github.com/zkpassport/circuits/issues/143]`
- Fix landed: `find_subarray_index_strict` now constrains first-occurrence, and the sanctions library calls the strict variants at all seven call sites. Residual note — the non-strict function still exists and remains available to other callers, and the issue was closed by an apparently unrelated PR rather than a named fix PR. `[VERIFIED — https://github.com/zkpassport/circuits/blob/main/src/noir/lib/exclusion-check/sanctions/src/lib.nr]`
- The bug class matters more than the instance: **an under-constrained Brillig hint in an unaudited Noir codebase**. That is the canonical ZK soundness failure mode, it was found by an outside party rather than internal review, and the codebase has had no external audit. `[INFERRED — https://github.com/zkpassport/circuits/issues/143]`
- No exploited incident, breach or in-the-wild attack on zkPassport was found. `[UNKNOWN — no source found]`

### Not frozen — actively moving, with no stability declaration

- **`zkpassport/circuits` has zero GitHub releases**, and exactly two tags, both toolchain pins rather than circuit versions (`noir-v1.0.0-beta.22`, `bb-v5.0.0`). There is no `CHANGELOG.md`. `[VERIFIED — https://github.com/zkpassport/circuits/tags]`
- 2026 commit cadence on `circuits`: activity every month, most recently **2026-08-06** — two weeks before this review. `[VERIFIED — https://github.com/zkpassport/circuits/commits/main]`
- That latest commit (**PR #152, "feat: add NONE nullifier type"**) is a **soundness-relevant breaking change that re-keyed the whole circuit set**: *"Regenerated outer mains, packaged circuits (new root), outer solidity verifiers and DeploySubVerifier vkey hashes."* It also closed the scope/date forgery gap described in §4. `[VERIFIED — https://github.com/zkpassport/circuits/pull/152]`
- Versioning is **architecturally designed for rotation, not freeze**: circuits are identified by Poseidon2 vkey hashes aggregated into a circuit-registry merkle root, fetched `by-root` or `by-version`, with on-chain historical roots and per-root validity periods. The public explorer advertises "historical circuit registry merkle roots, their validity periods, and circuit counts". `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/registry-sdk/src/constants.ts]`
- The SDK changelog records repeated breaking proving-system changes: v0.10.0 *"Update proving system (to Barretenberg 2.0.3). **Proofs generated with previous version of the mobile app will not work with this version of the SDK**"*; v0.11.0 moved `current_date` from the integrity proof to the disclosure proofs, *"chang[ing] the verification logic"*; v0.12.0 switched to a new root verifier with interface changes; v0.15.x made `verify()` require `originalQuery`. `[VERIFIED — https://docs.zkpassport.id/changelog]`
- Everything is still `0.x`, and **no "v1", "stable" or "frozen" statement exists** anywhere. Version skew is visible right now: the shipped SDK constant is `VERSION = "0.16.2"` while the published changelog's newest entry is "v0.15.x - Latest release"; deployed subverifier version is `0.20.0`, verifier helper `0.18.0`. `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/zkpassport-sdk/src/constants.ts]`
- Two packages still ship as **beta tarballs committed inside the verifier repo** (`zkpassport-sdk-0.14.0-beta.1.tgz`, `zkpassport-utils-0.36.0-beta.1.tgz`). `[VERIFIED — https://github.com/zkpassport/zkpassport-proof-verifier]`
- A migration is mid-flight in the contracts too: commented-out "New RegistryHelper for canonical root registry" addresses sit alongside the live ones for all three chains. `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/registry-sdk/src/client.ts]`
- An unresolved correctness `TODO` sits in the SDK's verification path — `// TODO: set to always validate when the issue is vkey hash calculation is fixed` — which currently **skips vkey-hash validation for `outer_evm` proofs** during off-chain verification. `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/blob/main/packages/zkpassport-sdk/src/index.ts]`
- Circuits (Apache-2.0) and SDK are open source; **the mobile app is not yet open source** — the docs say it will be "when out of the testing phase". `[VERIFIED — https://docs.zkpassport.id/faq]`

### Independent third-party analysis

- **Safe Foundation research, "ZKPassport: Where are we now?" (2025-09-04)** covers zkPassport, Rarimo, Self and Privado ID. Directly relevant caveats: *"Possession of a valid document is not liveness"*; *"The system cannot prevent a single person with multiple passports from onboarding multiple times"*; *"Malicious actors with stolen passports/IDs could generate valid proofs without owner consent"*; document renewal risks *"disruption of recovery access"*; and proofs *"must not be reusable; each request needs a fresh nonce or challenge."* It discloses no audit for any of the four projects. `[OBSERVED — https://safefoundation.org/blog/safe-research-zk-passport-where-are-we-now]`
- A `poh-aggregator` research doc (andrevalenm) is the most detailed third-party write-up found, and its AA/chip-authentication claims were independently confirmed against the mobile-app source (§8). **But it also contains verifiable factual errors** — it states the tree is depth 12 (it is 16) and that certificates "can be added by anyone" (there is no permissionless path). Treat it as a lead, not a citation. `[OBSERVED — https://github.com/andrevalenm/poh-aggregator/blob/main/research/protocols/zk-passport-and-eid.md]`
- Its governance claim of a "Gnosis Safe with threshold 1" is **half right, and I checked**: the Safe is real and is threshold-1, but it governs the `RootRegistry`, not the certificate root-writing path — which is a bare EOA, i.e. worse than claimed. `[VERIFIED — eth_call getThreshold() on 0x2000ab040a899f914D6DfD2457C3dFBB22d4c762, Ethereum mainnet]`
- **Academic coverage is essentially nil.** The only paper referencing zkPassport is *zk-X509* (Tokamak Network, 2026-03-31), which mentions it once in related work purely to note the NFC-hardware dependency. No security critique. `[VERIFIED — https://arxiv.org/html/2603.25190v2]`
- No zkPassport security discussion was found on zkresear.ch, ethresear.ch, Ethereum Magicians, Hacker News or Reddit. `[UNKNOWN — no source found]`

### Name-collision warnings for anyone re-running this research

- **zkMe** ships a separate product also called "zkPassport" (`docs.zk.me/hub/how-built/id-infra/zkpassport`); search engines conflate the two heavily. `[VERIFIED — https://docs.zk.me/hub/how-built/id-infra/zkpassport]`
- Halborn's "Passport ZK Circuits Security Assessment" is **Rarimo's** Freedom Tool, not this project. `[VERIFIED — https://www.halborn.com/audits/rarimo/passport-zk-circuits-security-assessment-c1e6e2]`
- zkSecurity's two passport-related reports audit **Self / Celo**, not zkPassport. `[VERIFIED — https://reports.zksecurity.xyz/]`
## 10. ZK Email vs zkPassport

### Neither project compares itself to the other

- **ZK Email never mentions zkPassport** — not in its docs FAQ, not in the founder's canonical long-form post, not in the recovery case study. Its recovery material frames the alternative as "crypto-native friends as signers", not passports. `[VERIFIED — https://docs.zk.email/frequently-asked-questions]`
- ZK Email treats passport projects as *downstream integrators*, naming "OpenPassport (now Self), Anon Aadhar, and ZKP2P" — all different projects, not zkPassport. `[OBSERVED — https://discuss.ens.domains/t/spp2-zk-email-application/20450]`
- **zkPassport never mentions ZK Email** in its docs, limitations page or homepage, and no code in the org references zkemail. Notably, **zkPassport's homepage does not list account recovery as a use case at all.** `[VERIFIED — https://zkpassport.id/]`
- The one genuine relationship is a shared Noir dependency: ZK Email's `noir-jwt` depends on `zkpassport/noir_rsa`. `[VERIFIED — https://github.com/zkemail/noir-jwt/blob/main/Nargo.toml]`

### The one authoritative direct comparison — Aztec's

Aztec wrote this when choosing zkPassport over ZK Email for testnet gating. It is about Sybil resistance, not recovery, but it is the only first-party head-to-head that exists:

- "zkEmail — Pros: The user shares no private information. Cons: Users cannot be blocked by jurisdiction, for example, it would be impossible to carry out sanctions checks, if required." Aztec also preferred passports because the user interfaces with the network directly "rather than through a third-party email confirmation". `[VERIFIED — https://aztec.network/blog/zkpassport-case-study-a-look-into-online-identity-verification]`

### Third-party framing

- An academic table places them on adjacent rows: zkPassport = credential "Passport/eID", hardware "NFC required", trust "Government CA", CRL "N/A"; zk-email = "Email DKIM", hardware "None", trust "Email providers", CRL "No". It characterises zk-email as "limited to email and does not provide the government-grade trust level of PKI certificates". `[OBSERVED — https://arxiv.org/html/2603.25190v2]`
- The EF's Kohaku roadmap lists both as options without comparing them: "Social recovery options through ZKemail, ZKpassport, Anon adhar…". `[VERIFIED — https://notes.ethereum.org/@niard/KohakuRoadmap]`
- No Ethereum Magicians thread, EF/PSE post, or conference talk compares email-based vs passport-based ZK recovery head-to-head. `[UNKNOWN — no source found]`

### Trade-offs, as stated by the sources

- **Trust anchor.** ZK Email trusts the sending mailserver's DKIM key — "As the holder of the domain's private key, the sending mailserver can forge any message it wants" — many independent anchors, each churning. zkPassport trusts government CSCAs, but reaches them through **one EOA-controlled merkle root** (§3). Email's registry problem is decentralised-but-churning; zkPassport's is stable-but-centralised, and measurably more centralised than the "government PKI" framing suggests. `[VERIFIED — https://blog.aayushg.com/zkemail/]`
- **Coverage.** Only ICAO-9303 documents "whose issuing country publish their signing certificates" work, and zkPassport itself tells integrators to make the check optional or provide a fallback. Email coverage is effectively universal. **This is the strongest structural argument for email as the default rail and passport as an optional second factor.** `[VERIFIED — https://docs.zkpassport.id/limitations]`
- **Liveness.** ZK Email has none — a guardian only needs mailbox access — and mitigates with a recovery delay that "gives the wallet owner time to react … from attackers who have access to a guardians email address". zkPassport *does* offer local FaceMatch strict-mode liveness, but it is device-gated and can be refused on Android. `[VERIFIED — https://github.com/zkemail/email-recovery]`
- **Revocation.** ZK Email admits "We don't have mailserver key rotations figured out right now", but ships an IC DNS oracle with both `sign_dkim_public_key` and `revoke_dkim_public_key`. **zkPassport is worse: no per-document revocation exists at all, and its revocation tree is built but unwired and empty (§4).** A stolen document stays valid until expiry. `[VERIFIED — https://github.com/zkemail/ic-dns-oracle]`
- **The key asymmetry for recovery.** Passport renewal changes the nullifier, so a registered guardian silently dies roughly every ten years — Safe flags "New passports generate different cryptographic identifiers, risking disruption". A rotated DKIM key is a *registry-side* fix that does not change the guardian's identity. **For a set-once-use-in-ten-years recovery factor, this asymmetry favours email decisively.** `[OBSERVED — https://safefoundation.org/blog/safe-research-zk-passport-where-are-we-now]`
- **Sybil / uniqueness.** zkPassport gives a genuine per-document uniqueness guarantee that email cannot; email addresses are unlimited and free. This favours passports for personhood — which is not what recovery needs. `[VERIFIED — https://docs.zkpassport.id/examples/personhood]`
- **Attacker model.** Email recovery falls to mailbox compromise: remote, scalable, silent. Passport recovery falls to a chip read plus, if FaceMatch is on, a coerced or spoofed face — and per §8 the chip read alone suffices today, which makes it a data-brokerage problem rather than a physical one. `[VERIFIED — https://docs.zkpassport.id/examples/personhood]`
- **Privacy.** zkPassport identifiers are per-domain+scope Poseidon2 hashes, but the default is recomputable by the issuing government, and the salted alternative depends on a 2-of-3 OPRF quorum that includes the vendor (§5). ZK Email keeps guardian emails off-chain and offers an `AccountHidingRecoveryCommandHandler`. `[VERIFIED — https://docs.zkpassport.id/faq]`
- **Cost.** ZK Email recovery is reported at "around 1.2M gas" (secondary source), against my measured **~0.93–1.0M** for zkPassport (§2). **The two are the same order of magnitude — cost is not a differentiator.** `[OBSERVED — https://www.cryptopolitan.com/clave-universal-recovery-zk-email/]`
- **UX.** Email wins for the *guardian* (no app, no hardware, reply from any device). Passport wins for the *owner* (self-recovery, nobody else has to cooperate). These are genuinely different products: passport recovery is self-custody-preserving, email recovery is delegation. `[VERIFIED — https://zk.email/case-studies/recovery]`
- **Deliverability / censorship.** Clave's ZK Email beta shipped Gmail-only, with Vitalik's caveat not to "store funds in a setup where zk-email breaking means that you lose access to your funds". ZK Email's counter is that prover and relayer are fully open source. No source quantifies deliverability failure rates. `[OBSERVED — https://blog2.getclave.io/clave-unveils-the-new-zk-email-recovery-beta/]`

### The maturity gap is the decisive finding

- **ZK Email has five published audits** (Matter Labs, Zellic, Ackee, zksecurity, Y Academy), a real **ERC-7579 module family** reachable from Safe7579 / Kernel V3 / Nexus / Etherspot Prime, and L2 mainnet deployments (Base, Base Sepolia, Sepolia, zkSync Era). `[VERIFIED — https://docs.zk.email/audits]`
- **zkPassport has zero external audits (§9), and the only passport-based recovery module that exists anywhere is Safe Research's explicitly unaudited Sepolia demo** — `ZKPassportSafeRecovery.sol`, a Safe module rather than an ERC-7579 one, "for demonstration purposes and has not been formally audited". `[VERIFIED — https://github.com/safe-research/zk-passport]`
- For an ERC-7579 recovery module specifically, that means ZK Email is a drop-in with audited precedent, while zkPassport would be **new, unaudited integration work on an unaudited dependency**. `[INFERRED — https://docs.zk.email/audits]`

### Prior integrator experience worth knowing

- **Safe Research** built the reference passport-recovery module (guardian registration stores only an identity hash; recovery replaces a Safe owner). Its own write-up flags exactly the issues in this document: no liveness ("a thief with a valid document could potentially generate proofs"), no defence against one person with several passports, renewal breaking identifiers, and that **replay protection is not native — "every proof must be bound to a single-use nonce"**. `[OBSERVED — https://safefoundation.org/blog/safe-research-zk-passport-where-are-we-now]`
- **Spectre Protocol** (ZK account recovery on Base) wired zkPassport behind a pluggable `IPersonhoodVerifier`, using `bind("user_address")`/`bind("chain")`/`bind("custom_data")` with `uniqueIdentifier` as the nullifier — exactly the shape we would use. It ships a mock adapter on testnet because **the RootVerifier is not deployed to Base Sepolia**. `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/issues/240]`
- Largest production integrators are Aztec testnet (validator personhood gating) and Immunefi (mandatory for new bounty submissions) — both Sybil gating, not recovery. `[OBSERVED — https://aztec.network/blog/zkpassport-case-study-a-look-into-online-identity-verification]`
- Dominant integrator complaint is **document coverage in practice**: Australian passports fail on missing extended-length APDU support (the same passport reads fine in ReadID on the same phone), plus reports for Irish, Bolivian, Kenyan, Venezuelan, German-ID and Italian-passport documents. `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/issues/180]`
- Worse, **"supported country" does not mean "your request works"**: Colombia shows 100% registry coverage and base proofs succeed, but disclosure fails with `FAILED_TO_GET_DISCLOSURE_CIRCUITS`. `[VERIFIED — https://github.com/zkpassport/zkpassport-packages/issues/172]`
- And there is **no fallback for excluded users** — a researcher was fully blocked: expired passport rejected, national ID and driving licence not detected, "No manual verification option is available". For a recovery method, being locked out at enrolment is a product failure. `[VERIFIED — https://github.com/immunefi-team/Web3-Security-Library/issues/42]`
- Disambiguation note for future research: `ethereum.org/developers/tools/zkpassport` actually describes "Proof of Passport", a different project. `[OBSERVED — https://ethereum.org/developers/tools/zkpassport/]`

## Gaps

### Closed during this research

- **Verification gas** — measured on live mainnet: 858,768 raw UltraHonk (`OuterCount5`), 900,770 (`OuterCount13`), and 926,746–995,822 for the full `verify()` path (§2).
- **Live registry configuration** — `VALID_WITHIN_WINDOW`, 86,400s window, depth 16, 27 roots, verified empirically at the exact window boundary (§3, §4).
- **Governance** — root writer is a bare EOA whose nonce (27) equals `rootCount`; certificate-registry admin is a bare EOA; guardian unset; the RootRegistry Safe is 1-of-2 (§3).
- **Certificate provenance and cadence** — ICAO PKD (`UN` tag) covers only 380/584; 27 roots since 2023-12-25 with a 10-month gap; registry 105 days stale (§3).
- **Trust-anchor reproducibility** — the published root was independently recomputed from published data and matches byte-for-byte (§3).
- **Audit status** — the project's own README says it has never had an external audit; no bug bounty; one fixed soundness bug (§9).
- **Active/Chip Authentication** — confirmed absent from the circuits, and AA is commented out in the iOS reader (§8).
- **Circuit sizes** — outer circuits are 2²²–2²⁴ (from verifier `LOG_N`), disclosure circuits 2¹⁹–2²⁰ (§1).
- **Cloud prover** — role, ~84s latency, 6-node spot ceiling, no auth, self-hostable but unlicensed; and the SRS evidence that it is on the critical path for `compressed-evm` (§1, §7).
- **Bridge** — default is `wss://bridge.zkpassport.id`, closed-source, vendor-hosted (§7).
- **OPRF network** — 2-of-3 threshold across H2ONodes / TACEO / Aztec Labs; live key confirmed pinned on chain (§5).
- **Pricing** — verification is free, no API key, no documented quotas; commercial terms only for add-on services (§7).
- **ZK Email comparison** — no first-party comparison exists between the two; Aztec's is the only authoritative head-to-head; the maturity gap is large (§10).

### Still open

Ordered by how much each would change an integration decision.

1. **Does the flow work at all from a browser extension?** The scope model is `sha256(domain)` and the app validates origin against a registered domain, but an extension presents `chrome-extension://<id>`. A closely related bug already makes Node usage fail silently with the Confirm slider permanently disabled. **This is a go/no-go question and should be prototyped before any design work.** `[UNKNOWN — https://github.com/zkpassport/zkpassport-packages/issues/211]`
2. **Key custody.** Whether the root-writing oracle EOA, the certificate-registry admin EOA and the two 1-of-2 Safe owners are operationally separated — different humans, hardware wallets, geographic split — or hot keys on a CI box. A single signature forges any identity instantly, with no timelock and no guardian. Nothing is published. `[UNKNOWN — no source found]`
3. **Whether the `compressed-evm` outer proof can ever be produced on-device.** The SRS/circuit-size mismatch strongly implies no (§1), which would put a hosted, single-zone, spot-capacity prover with a 6-node ceiling on the critical path of every recovery. Confirm by instrumenting a real proof, and price self-hosting. `[UNKNOWN — https://github.com/zkpassport/cloud-prover]`
4. **Why the registry is 105 days stale, and what the SLA is.** Broken pipeline, paused for the in-flight "canonical root registry" migration, or normal? This decides whether a newly-issued passport can enrol. No status page, no cadence commitment. `[UNKNOWN — no source found]`
5. **Whether the mobile app can be trusted.** Closed-source, 400MB+, and it holds the chip data, the FaceMatch decision, the cloud-prover privacy guard and the proving keys. Everything §8 claims about liveness and §7 about data minimisation rests on this unauditable component. Open-sourcing is promised with no date. `[UNKNOWN — no source found]`
6. **OPRF key rotation policy.** Operators and threshold are known and the live key is confirmed pinned on chain (§5), but the contract hard-requires a match and admin can change it with no delay — so a rotation would silently invalidate every enrolled salted nullifier. No migration path is documented. `[UNKNOWN — no source found]`
7. **Whether the phone app honours a non-default `bridgeUrl`.** The request URL carries no bridge parameter, so overriding it browser-side may not be enough. If not, the vendor relay is an unavoidable single point of failure. `[UNKNOWN — no source found]`
8. **Licensing.** `zkpassport-packages` and `cloud-prover` both ship without a LICENSE file. Self-hosting the prover and vendoring the SDK are both legally unclear today. `[UNKNOWN — https://github.com/zkpassport/zkpassport-packages/issues/246]`
9. **Real-world enrolment success rate**, by document type and country. "Supported" in the registry demonstrably does not mean a request succeeds, and there is no fallback for excluded users. `[UNKNOWN — https://github.com/zkpassport/zkpassport-packages/issues/172]`
10. **Per-device phone prove-time benchmarks.** Only the docs' 10-50s base / <1-10s disclosure range plus scattered failure reports exist. `[UNKNOWN — no source found]`
11. **Whether the `NONE` nullifier type added 2026-08-06 interacts safely with our flow.** It forces `scoped_nullifier == 0` and is rejected outside devMode, but it is weeks old, unaudited, and touches exactly the code path our enrolment depends on. `[UNKNOWN — https://github.com/zkpassport/circuits/pull/152]`
12. **Whether the 4 `XX`-tagged and 67 single-voucher certificates are legitimate.** Already trusted in production with no master-list attribution, and nothing in the circuits or contracts checks tags. `[UNKNOWN — https://certificates.zkpassport.id/mainnet/0x1a46d2abb5609cb22b62fa3275c85adefbf798cdb41407122f36801d50dd527f.json]`

---

# Appendix C — repo-side impact inventory (raw front)

Read-only survey. Branch `docs/social-recovery-ux-flows`, repo `/Users/fiboape/repos/internal/kohaku/kohaku-extension`.

Sources inventoried:

| # | File | How read |
|---|---|---|
| 1 | `/Users/fiboape/repos/internal/kohaku/kohaku-extension/social-recovery-ux-flows.md` (556 lines) | grep + sed |
| 2 | `/Users/fiboape/repos/internal/kohaku/kohaku-extension/social-wireframes.pen` (9.4 MB JSON, 159 page wrappers) | `python3 json.load`, recursive `content` walk |
| 3 | `/Users/fiboape/repos/internal/kohaku/kohaku-extension/social-recovery-ux-assets/persona-demo/journeys.json` | `python3 json.load` |
| 4 | `/Users/fiboape/repos/internal/kohaku/kohaku-extension/social-recovery-ux-assets/recovery-ux-review.html` | grep |
| 5 | `/Users/fiboape/repos/internal/kohaku/kohaku-extension/social-recovery-sdk-requirements.md` (199 lines) | grep |
| 6 | `/Users/fiboape/repos/internal/kohaku/kohaku-extension/social-recovery-extension-work.md` (25 lines) | grep |
| 7 | `/Users/fiboape/repos/internal/kohaku/kohaku-extension/social-recovery-ux-status.md` (137 lines) — extra, found in sweep | grep |
| 8 | `/Users/fiboape/repos/internal/kohaku/kohaku-extension/social-recovery-ux-assets/persona-demo/persona-docs.json` — extra, found in sweep | `python3 json.load` |

Match pattern used on the wireframes: `e-?mail | \.eml | \beml\b | dkim | gmail | outlook | apple mail | yahoo | proton mail | inbox | @…\.(com|org|net|io) | show original | relayer`, plus a second pass for `✉ 📧 zk_email zk-email` (second pass found nothing the first pass missed — no envelope-glyph-only screens exist).

`persona-demo/README.md`, `demo-template.html` and `build-demo.py`: **zero** email hits. `prototype-demo.html` (43 hits) and `ui-patterns.svg` (3 hits) were **not** clean — see §6b; `prototype-demo.html` also turns out to contain a complete passport flow already, see §10.

---

## 1. Wireframe screens whose whole purpose is email

### 1a. Purpose = the `.eml` mechanic itself (delete or fully redraw)

| Code | Frame name | Band | What the screen does |
|---|---|---|---|
| **C-05e** | `C-05e-verify-your-email-receive-upload` | `Flow · C · SETUP (OWNER)` — **MAIN** | The enrollment verify-access test, full size: "Send email" → wait → "Show original" → drop the `.eml` → local check. 16 email strings; caption "Verify your email". Nothing on the screen survives the method swap. |
| **C-05k** | `C-05k-email-check-failed-eml` | `Flow · C · SETUP (OWNER)` — **MAIN** | The failure state of C-05e ("The file you uploaded was not the original message"). 18 email strings; caption "Email check failed". Failure taxonomy is `.eml`-specific — wrong-file, forward, copy. |
| **C-05n** | `C-05n-how-to-get-the-eml-sheet` | `Flow · C · SETUP (OWNER)` — **MAIN** | Full-screen help sheet: five client rows (Gmail, Outlook web, Apple Mail, Yahoo, Proton) explaining how to save the original message. 18 email strings; caption "How to get the .eml". **This screen has no zkPassport analogue — it is a candidate for deletion, not renaming.** |
| **D-07e** | `D-07e-verify-with-your-email-eml` | `Flow · D · RECOVERY (RECOVERER)` — **MAIN** | The recovery-side twin of C-05e: one checklist row answered by receive-and-upload. 14 email strings; caption "Verify with your email". Its design note names C-05n explicitly. |
| C-05e | `C-05e-enroll-email` | `Flow · OUTDATED · MULTI-PATH MODEL` | Superseded send-then-upload version. **No work needed.** |
| C-05k | `C-05k-email-eml-check-fail` | `Flow · OUTDATED · MULTI-PATH MODEL` | Superseded fail state. **No work needed.** |
| D-07e | `D-07e-recovery-email-code` | `Flow · OUTDATED · MULTI-PATH MODEL` | Superseded recovery-side email screen. **No work needed.** |

### 1b. Purpose = a path shape whose identity is "email" (frame name and caption must change)

These screens survive the method swap, but their **frame name, wrapper caption and demo `screen` key** all encode "email", so they cannot be handled by a content-only edit.

| Code | Frame name | Band | What it does | Why it is not merely a mention |
|---|---|---|---|---|
| **C-03c** | `C-03c-inventory-device-and-email` | `Flow · C` — MAIN | Inventory step with exactly "Another device" + "A long-lived email" ticked — Diana's entry state. | Frame name + caption "Inventory · device and email" + the checkbox row itself. The zkPassport inventory item is not yet worded, so the tick-label is undecided. |
| **D-07c** | `D-07c-checklist-passkey-plus-email` | `Flow · D` — MAIN | The `passkey AND email` checklist entry state; carries the "ZK Email mechanics (Q16)" open-question note. | Frame name + caption "Checklist passkey plus email" + a Q16 design note that dies with decision 80. |
| **C-04b** | `C-04b-recommended-path-either-one` | `Flow · C` — MAIN | Diana's recommendation: `[1 of 2](passkey, ZK Email)`. Name is method-neutral; the member is not. | Only one member row to swap, but it is the screen's entire point. |
| **C-07g** | `C-07g-review-either-one-works` | `Flow · C` — MAIN | Review of the same `[1 of 2]` shape. | Same. |
| **C-07k** | `C-07k-dry-run-either-one-works` | `Flow · C` — MAIN | Dry run of the same shape — **embeds the `.eml` mechanic in miniature** (Send email / Show original / How do I get the .eml? / Drop the .eml file here). | 6 mechanic strings. Redrawing it needs the zkPassport journey, exactly like C-05e. |
| **C-06** | `C-06-waiting-period` | `Flow · C` — MAIN | Waiting-period step for the `passkey AND Email` preset. | Header names the preset "Your device + your email" and the path line reads `Passkey — this device AND Email (ZK Email)`. |
| C-04b | `C-04b-recommended-paths-two-methods` | OUTDATED | "Email alone" as a standalone path. | **No work needed.** |
| C-06b | `C-06b-waiting-period-dominated-path` | OUTDATED | Whole screen argues about "Your device + your email" being dominated. | **No work needed.** |
| C-07g | `C-07g-review-two-single-method-paths` | OUTDATED | "Email alone" path review. | **No work needed.** |
| C-07k | `C-07k-dry-run-two-single-paths` | OUTDATED | "PATH 2 · EMAIL ALONE" + full send/download/drop rehearsal (8 strings). | **No work needed.** |
| G-02b | `G-02b-remove-path-confirm` | OUTDATED | 'Remove "Your device + your email"?' + "Your email stays enrolled". | **No work needed.** |
| G-03 | `G-03-method-in-use-block` | OUTDATED | Blocks removal of the email method in use. | **No work needed.** |

---

## 2. Wireframe screens that merely MENTION email / `.eml`

All strings below are **exact** `content` values, ready for a Pen find-and-replace prompt. Bands are MAIN unless stated.

### 2a. Preset-name / path-line mentions — `Flow · C`

| Code | Frame | Exact strings |
|---|---|---|
| C-01 | `C-01-choose-your-recovery-path-presets` | `Your device + your email` · `ZK Email (required)` |
| C-01b | `C-01b-resume-setup` | `Email` · `Your device + your email` · `Email (ZK Email)` |
| C-01c | `C-01c-unprotected-after-removal` | `Email` · `Your device + your email` · `Email (ZK Email)` |

### 2b. Inventory-checkbox mentions — `Flow · C`

| Code | Frame | Exact strings |
|---|---|---|
| C-03 | `C-03-inventory` | `A long-lived email` · `An address you will still control in years. Used with ZK Email.` |
| C-03b | `C-03b-inventory-device-only` | `A long-lived email` · `An address you will still control in years. Used with ZK Email.` |
| C-03c | `C-03c-inventory-device-and-email` | `A long-lived email` · `An address you will still control in years. Used with ZK Email.` · `“Another device” and “A long-lived email” are picked; trusted contacts and Aadhaar are not. Two methods, so the conditional single-method note is not shown.` |

### 2c. Side-panel / method-library mentions (`Email (ZK Email)` row + `.eml` direction note) — `Flow · C`

Every one of these carries the same pair of strings in the enrollment side panel or explainer:
`Email (ZK Email)` and `direction: local proof from a raw .eml (no relayer)`.

| Code | Frame | Exact strings |
|---|---|---|
| C-05a | `C-05a-create-passkey` | `Email (ZK Email)` |
| C-05 | `C-05-enroll-passkey-test-pass` | `Email (ZK Email)` · `direction: local proof from a raw .eml (no relayer)` |
| C-05b | `C-05b-enroll-passkey-test-fail` | `Email (ZK Email)` · `direction: local proof from a raw .eml (no relayer)` |
| C-05g | `C-05g-create-passkey-start` | `Email (ZK Email)` |
| C-05h | `C-05h-enroll-passkey-test-pending` | `Email (ZK Email)` · `direction: local proof from a raw .eml (no relayer)` |
| C-11 | `C-11-explainer-sheet` | `Email (ZK Email)` · `direction: local proof from a raw .eml (no relayer)` |

> Note for the Pen prompt: verifier finding **F4** (status doc) already flags that this C-05 side panel lists methods the persona never picked. If F4 is resolved in the same round, these six screens are touched twice.

### 2d. Recovery-password / hidden-values copy — `Flow · C`

| Code | Frame | Exact strings |
|---|---|---|
| C-06e | `C-06e-recovery-password` | `Anyone who finds this account can read the shape of your recovery path. A password also hides the values — which guardians, which email.` |
| C-07c | `C-07c-review-single-method-path` | `Which guardians, which email — the values stay unreadable without the password.` |
| C-07d | `C-07d-review-people-only-path` | `Which guardians, which email — the values stay unreadable without the password.` |

### 2e. Persona-shape mentions — a group member that happens to be an email — `Flow · C`

| Code | Frame | Exact strings |
|---|---|---|
| C-04b | `C-04b-recommended-path-either-one` | `ZK Email — f•••@gmail.com` |
| C-07g | `C-07g-review-either-one-works` | `ZK Email — f•••@gmail.com` |
| C-07k | `C-07k-dry-run-either-one-works` | `ZK Email — f•••@gmail.com` · `Receive the email, then upload the original file` · `Send email` · `Show original` · `How do I get the .eml?  ›` · `Drop the .eml file here` |
| C-07l | `C-07l-dry-run-mixed-group` | `Email — recovery@gmail.com` · `.eml checked on this device` |
| C-07m | `C-07m-dry-run-all-methods` | `Email — recovery@gmail.com` · `.eml checked on this device` |
| C-10 | `C-10-advanced-builder-single-path` | `ZK Email — f•••@gmail.com` |
| C-10b | `C-10b-add-member-instance-uniqueness` | `ZK Email — f•••@gmail.com` · `EMAILS` (picker section header) · `f•••@gmail.com` · `work•••@company.com` |
| C-10c | `C-10c-advanced-builder-saved-single` | `ZK Email — f•••@gmail.com` |
| C-10d | `C-10d-add-member-optional-test` | `EMAILS` · `f•••@gmail.com` · `work•••@company.com` |
| C-10e | `C-10e-add-method-to-library-single` | `f•••@gmail.com` · `An email address` · `Confirmed with ZK Email. Mechanics are still open (Q16).` |

> **C-10b / C-10d / C-10e are the member picker and enroll-a-method sheet — MVP screens (decision 82).** The `EMAILS` section header and the two-address fixture imply the enrolled-instance model (an email address is a typed value the user can hold two of). Whether zkPassport supports two instances per account depends on its nullifier semantics — an open item, not a copy edit.

### 2f. Waiting-period and apply-to-other-accounts — `Flow · C`

| Code | Frame | Exact strings |
|---|---|---|
| C-06 | `C-06-waiting-period` | `Your device + your email` · `Passkey — this device  AND  Email (ZK Email)` |
| C-09 | `C-09-apply-to-other-accounts` | `ZK Email code per account (R10)` · `Whether each account can derive its own email code is undecided. Until it is, the email method is not offered for a second account — reusing one code would link the accounts.` |
| C-09b | `C-09b-apply-to-other-accounts-selected` | same two strings |
| C-09c | `C-09c-apply-progress` | same two strings |

> The C-09 family encodes the `accountCode` unlinkability blocker as a **UI rule** ("the email method is not offered for a second account"). Under decision 80 this becomes the zkPassport nullifier question (spec line 547) — the rule may invert, so this is a design decision, not a rename.

### 2g. Recovery side — `Flow · D`

| Code | Frame | Exact strings |
|---|---|---|
| D-04b | `D-04b-confirm-identity-people-only` | `The path always shows which kinds of method it needs. The exact guardians and email address come on the next step.` |
| D-04c | `D-04c-confirm-identity-lone-mixed-group` | `🔑 passkey · 👤 0x8a5D…dc41 · ✉️ email · waiting 48h` · `The path always shows which kinds of method it needs. The exact guardians and email address come on the next step.` |
| D-06b | `D-06b-path-one-member-unavailable` | `ZK Email` · `Access to the enrolled email address.` |
| D-07c | `D-07c-checklist-passkey-plus-email` | `Email (ZK Email)` · `Confirm with your email` · `ZK Email mechanics (Q16)` · `OPEN · Q16 — direction: local proof from a raw .eml (no relayer). Open: subject/command format, accountCode storage, in-extension latency. The entry state drawn here mirrors D-07e.` · `The email method cannot be completed yet.` |
| D-07g | `D-07g-checklist-mixed-group-no-passkey` | `Email (ZK Email)` · `.eml checked on this device` |
| D-07j | `D-07j-checklist-mixed-group-complete` | `Email (ZK Email)` · `.eml checked on this device` |
| D-15 | `D-15-recovery-done-cleanup` | `fable@gmail.com` · `Email · not tied to the lost device` |

> **D-15 note:** the "not tied to the lost device" claim is the whole reason the email row survives cleanup. zkPassport's device-boundness is unknown, so this row's *semantics* — not just its label — depend on the research pass. Also carries verifier finding **F7** ("D-15 email mask mismatch") already queued.

### 2h. Owner-pending, health check, management, exhibit

| Code | Frame | Band | Exact strings |
|---|---|---|---|
| D2-03 | `D2-03-account-no-longer-controlled` | `Flow · D2` | `Your device + your email` · `Email (ZK Email)` |
| F-01 | `F-01-health-check-all-pass` | `Flow · F` | `recovery@gmail.com` · `Passed a test check with your email provider · just now` |
| F-02 | `F-02-health-check-alert` | `Flow · F` | `“Your device + your guardians” and “Your device + your email”` · `recovery@gmail.com` · `Passed a test check with your email provider · just now` |
| G-01 | `G-01-management-overview-single-path` | `Flow · G` | `ZK Email — f•••@gmail.com` |
| G-01b | `G-01b-cleanup-deferred-single` | `Flow · G` | `ZK Email — f•••@gmail.com` |
| G-01c | `G-01c-triage-deferred-single` | `Flow · G` | `ZK Email — f•••@gmail.com` |
| G-02 | `G-02-remove-last-path-warning` | `Flow · G` | `Your device + your email` · `Email (ZK Email)` |
| G-03b | `G-03b-group-below-threshold` | `Flow · G` | `Your device + your email` · `Email (ZK Email)` |
| G-04 | `G-04-recovery-pending-management` | `Flow · G` | `Your device + your email` · `Email (ZK Email)` |
| G-05 | `G-05-edit-path` | `Flow · G` | `Add member — guardian, passkey, email or Aadhaar` |
| X-01 | `X-01-policy-models-compared` | `Flow · X` | `ZK Email — f•••@gmail.com` (×2, two model columns) |
| X-02 | `X-02-rollout-milestones` | `Flow · X` | `Enrollment + mandatory tests, ALL 4 methods (incl. the .eml help sheet).` — **the stale string the status doc already flags for Fibo's ruling** |

> **F-01 / F-02 caveat:** "Passed a test check with your **email provider**" names an external trust root that zkPassport does not have. The health-check row is a semantic rewrite, not a label swap.

### 2i. False positives — do NOT touch

| Code | Frame | Band | Why it matched |
|---|---|---|---|
| D-11 | `D-11-confirm-start-recovery` | `Flow · D` | Matched on `relayer` inside the **funding** design note: `These calls sit outside the normal fee flow and no relayer exists today. …` — that is the execution relayer (Q7/19), unrelated to the email send-relayer. |
| D-11b | `D-11b-submitting` | `Flow · D` | Same funding note. |
| D-12 | `D-12-submit-failure` | `Flow · D` | Same funding note. |

---

## 3. Spec passages — `social-recovery-ux-flows.md`

### 3a. Already reconciled with decision 80 (verify only, no edit expected)

| Line | Exact phrase (abridged) |
|---|---|
| 79 | `**Methods (decision 80, 2026-08-20):** passkey, guardians …, **zkPassport**, Anon Aadhaar. **ZK Email is dropped**; zkPassport replaces it.` — plus the hedge `until then every "ZK Email" mention below is historical` |
| 101 | Preset 2: `**Your device + your ID** — \`passkey AND zkpassport\`, both required (was "your device + your email" with \`zk_email\` before decision 80; … the R9/Gmail note dies with the email method). Preset name and copy to be finalized with the zkPassport research.` |
| 141 | Verify-access table row: `**zkPassport** (replaces ZK Email, decision 80) \| Test flow TBD from the research pass … *Historical, for reference: the ZK Email test was "Send email" → user replies → user uploads their own reply as \`.eml\` → local proof (decisions 55/77).*` |
| 448 | MVP blockers: `**zkPassport integration + prover** (decision 80, replaces the ZK Email relayer/prover blocker)` |
| 533 | Decision 80 row itself (the change log) |
| 545 | Tech-deps row: `**zkPassport integration** (decision 80, replaces the whole ZK Email row): what the user presents (NFC document scan / photo / app hand-off), proof budget in-extension, verifier deployment per chain, nullifier + linkability semantics, and whether an enrollment secret must join the backup set \| zkPassport sub-flows + verify-access + C-05/D-07 redraw \| 80` |
| 547 | Tech-deps row: `Per-account unlinkability for the ZK method (R10) — was ZK Email's \`accountCode\`; re-ask for zkPassport's nullifier scheme under decision 80 \| Multi-account apply \| 80/R10` |

### 3b. Still stale — building-blocks and model prose

| Line | Exact phrase | Fix |
|---|---|---|
| 80 | Examples: `` `passkey AND [2 of 3](G1, G2, zk_email)` `` and `` `passkey AND zk_email` (both required) `` | Rename the identifier in two examples. |
| 81 | `a group's members can be ANY method instances — guardians, passkeys, ZK Email, Aadhaar — mixed freely` | Method-list rename. |
| 82 | `("Require 2 ▾ of: passkey, Ana, email")` | Label example. |
| 83 | `Multiple groups in one path (` `` `passkey AND [2/3 guardians] AND [1/2 emails]` `` `) exist only in the Advanced builder.` | Example rename; `[1/2 emails]` implies 2 instances of the method (see §2e). |
| 84 | `one enrolled method instance (a specific passkey, guardian address, or email) appears **once**` and `(two ZK Email methods on different addresses is fine)` | Instance-uniqueness wording; the two-instance claim needs the nullifier answer. |
| 124 | Inventory item: `- ☐ long-lived email` | Wizard step-2 checkbox list. |
| 149 | Recovery-Card exclusions: `the method inventory, guardian addresses, the enrolled email address, thresholds` | Rename. |
| 153 | `- ZK Email \`accountCode\` derivation per account: **open question** (moved to the tech-dependencies table).` | Superseded by line 547 — candidate for deletion. |
| 159 | `Two-method inventories (e.g. passkey + email only) get **one [1 of 2] ANY-of group** recommended` | Diana's rule; the example is the email method. |
| 179 | Config visibility: `the policy **structure** is readable on-chain ("passkey + zk_email")` | Rename. |
| 432 | Deferred list: `**M34 DKIM-rotation failure split**` | DKIM has no zkPassport equivalent — this deferral **disappears**, it cannot be renamed. |

### 3c. Still stale — mermaid diagrams (structural, not prose)

| Line | Exact node text | Diagram |
|---|---|---|
| 208 | `G --> G2["Confirm with your email —<br/>send email → upload the .eml<br/>(decision 77; remainder Q16)"]` | Flow D recovery graph. Node text and the decision reference both die. |
| 361 | `B --> D["ZK Email: test proof against<br/>live DKIM registry"]` | Flow F health-check graph. **The DKIM registry is the trust root being tested** — the node's *meaning* changes, not its label. |

### 3d. Milestones section (decision 79) — lines 434–452

| Line | Exact phrase | Note |
|---|---|---|
| 440 | MVP row: `enrollment + mandatory tests, all 4 methods (**C-05 family + C-05n**)` | **The only spec-side C-05n referrer inside a scope commitment.** If C-05n is deleted, the MVP screen budget (`~76 screens`) drops by one and the parenthetical must change. |
| 440 | `\| **MVP** (~76 screens) \|` | Screen count is load-bearing — it is quoted on X-02, the deck's Milestones slide, and the demo's `rollout` card story. |
| 448 | MVP blockers row — already updated (see §3a) | — |

The V1 row (441) and V2 row (442) contain no email references.

### 3e. Decisions log rows

| Line | Row | Exact phrase | Status under decision 80 |
|---|---|---|---|
| 469 | **16** — ZK Email mechanics | `**Narrowed by #55**: transport is local \`.eml\` proving, no relayer. Still open: subject/command format, accountCode storage, prover stack + latency.` | Decision 80 says 16 is **no longer a live rule** — history only. The spec row still reads as live. Q16 is cited on-screen (C-10e, D-07c) and in the deck. |
| 508 | **55** — ZK Email transport direction | `**Local proving**: the user obtains the raw \`.eml\` (Gmail: ⋮ → Show original → Download original) … the 6-digit-code illustration is retired. **Amended by #77**` | History only. |
| 528 | **75** — Path shapes | `Presets remap: … device+email = passkey AND zk_email (both required)` | Live rule with a stale example. Needs the preset rename from line 101. |
| 529 | **76** — Instance uniqueness | `One enrolled method instance (specific passkey, guardian address, email) appears once … Method types may repeat with different values.` | Live rule with a stale example, plus the two-instance assumption. |
| 530 | **77** — ZK Email receive-and-upload | `A **"How to get the .eml" help sheet** covers Gmail, Outlook (web), Apple Mail, Yahoo, Proton — linked from the enrollment test and the recovery verify row.` … `Wireframe updates (C-05e, D-07e, C-05n) queued — held while the team decides ZK Email vs zkPassport.` | History only. **Contains a C-05n referrer and the queued-work note that this front supersedes.** |
| 533 | **80** — zkPassport replaces ZK Email | `then a Pen round to redraw C-05e/C-05k/C-05n/D-07e and the preset, plus the persona/demo remap and the stale ".eml" copy on X-02, the deck's Milestones slide and the Milestones section. Wireframes and demo still show the email method until that round runs.` | **This is the authoritative to-do list; this inventory is its expansion.** Note it names C-05k, which decisions 77's queued list omitted. |

### 3f. Verify-access table (line 134–142)

Already reconciled (§3a line 141). One residual: the table's `Anon Aadhaar` row says `Test proof against the current UIDAI key` and the zkPassport row says `verify against the on-chain verifier` — the **enrollment test must exist and must be blocking** (line 136: "Mandatory for identity methods; a failing test blocks the save"). If zkPassport's test cannot be run locally without chain access, line 136 is contradicted. Flag, not an edit.

### 3g. Presets list (lines 97–103)

Three presets. Preset 2 (line 101) is the email preset, already renamed to "Your device + your ID" in the spec but **not** in any wireframe (see §2a: C-01, C-01b, C-01c still say "Your device + your email", as do C-06, D2-03, G-02, G-03b, G-04, F-02). Spec line 101 explicitly says the name is provisional: `Preset name and copy to be finalized with the zkPassport research.` **So the preset name is not yet decidable — this gates §2a.**

---

## 4. Companion docs (already reconciled — verify only)

| File | Line | Phrase |
|---|---|---|
| `social-recovery-sdk-requirements.md` | 7 | `**A1 — Method set (decided 2026-08-20, decision 80):** … **zkPassport**. ZK Email is out` |
| `social-recovery-sdk-requirements.md` | 173 | `circom/Groth16 zk-email-class ≈ minutes + ~1 GB artifacts … zkPassport's budget comes from its research pass` |
| `social-recovery-sdk-requirements.md` | 174 | `(The ZK Email send-relayer requirement died with decision 80.)` |
| `social-recovery-sdk-requirements.md` | 199 | `Historical (superseded by decisions 80/A5): … the ZK Email findings (reply-based proving, accountCode custody, relayer API)` |
| `social-recovery-extension-work.md` | 3 | `Methods (decision 80): passkey, guardians, Anon Aadhaar, zkPassport — ZK Email is out.` |
| `social-recovery-extension-work.md` | 12 | `zkPassport's input surface (NFC scan / document photo / other) is TBD from its research pass. The \`.eml\` upload is dropped with ZK Email (decision 80).` |
| `social-recovery-ux-status.md` | 3 | The **Open ruling for Fibo**: `X-02, the deck's Milestones slide and the spec's Milestones section still say ".eml help sheet" / "ZK Email relayer + prover" — stale under decision 80. Options: patch to neutral wording now, or fold into the queued zkPassport Pen round (recommended — the method name is not final).` |
| `social-recovery-ux-status.md` | 25, 27, 31, 32, 54–56, 71, 77, 107, 112, 118 | Historical round logs + the **wireframe filename table** (54 `C-05e-verify-your-email-receive-upload`, 55 `C-05k-email-check-failed-eml`, 56 `C-05n-how-to-get-the-eml-sheet`, 71 `D-07e-verify-with-your-email-eml`) and line 77: `C-05n is a plain full-screen help sheet (five client rows …) placed after C-05l; it is opened from both C-05e and D-07e.` **The filename table must be updated in the same commit as any Pen rename, or the handoff doc lies.** |

> `social-recovery-ux-status.md` is not on the requested source list but it is the workstream handoff doc, and its lines 54–56/71/77 are a second copy of the wireframe frame names. Treat it as a required companion edit.

---

## 5. Demo journeys — `persona-demo/journeys.json`

Personas and step counts: `sam` 23 · `alice` 26 · `carl` 24 · `diana` 23 · `bob` 24 · `rollout` 1 · `extras` 5.
**`sam`, `alice` and `carl` journeys are clean** — zero email references.

| Persona | Step | `screen` | Field | Offending phrase |
|---|---|---|---|---|
| diana | — | (persona `bio`) | `bio` | `Diana has a passkey and a long-lived email … the email is her way back.` |
| diana | 1 | `C-03c-inventory-device-and-email` | `screen` + `story` | screen key itself · `She ticks “Another device” and “A long-lived email”.` |
| diana | 2 | `C-04b-recommended-path-either-one` | `story` | `The wizard does NOT recommend passkey AND email` |
| diana | 5 | `C-05e-verify-your-email-receive-upload` | `screen` + `story` + `spec` + `hitLabel` | screen key · `The email check, on the real mechanic: she clicks “Send email”, the message arrives at her enrolled address, she downloads the original .eml and uploads it … (Subject format and prover still open — Q16.)` · `spec: Decision 77 — receive-and-upload · help sheet C-05n` · **`hitLabel: Send email`** |
| diana | 7 | `C-06e-recovery-password` | `story` | `Her email address gets hidden too.` |
| diana | 8 | `C-07k-dry-run-either-one-works` | `story` | `the email row runs the same send-and-upload check in miniature` |
| diana | 9 | `C-07g-review-either-one-works` | `story` | `any 1 of 2: passkey, email` |
| diana | 17 | `D-04-confirm-identity-single-path` | `story` | `any 1 of 2 — passkey or email. The email is her way back. (Bridge: … hers is any 1 of 2 — passkey or email.)` |
| diana | 18 | `D-06b-path-one-member-unavailable` | `story` | `the email alone still recovers … she knows her own inbox.` |
| diana | 19 | `D-07e-verify-with-your-email-eml` | `screen` + `story` | screen key · `One row: “Send email”, the message arrives, she uploads the original .eml, and the wallet creates the proof on this device (~60s).` |
| diana | 20 | `D-11-confirm-start-recovery` | `story` | `(Bridge: her path row reads Email · 1 row complete.)` |
| diana | 22 | `D-15-recovery-done-cleanup` | `story` | `remove “MacBook passkey”, keep the email, add a passkey on the new machine` |
| bob | — | (persona `bio`) | `bio` | `one lone group, any 2 of 3 — passkey, email, hardware-wallet guardian` |
| bob | 1 | `C-10-advanced-builder-single-path` | `story` | `any 2 of 3 — passkey, email, a guardian` |
| bob | 9 | `D-04c-confirm-identity-lone-mixed-group` | `story` | `any 2 of 3 members (passkey · person · email)` |
| bob | 10 | `D-06c-your-recovery-path-lone-group` | `story` | `the email and his guardian will answer` |
| bob | 11 | `D-07e-verify-with-your-email-eml` | `screen` + `story` | screen key · `Member one, the email: “Send email”, the original .eml uploaded, proof generated on-device.` |
| bob | 14 | `D-07g-checklist-mixed-group-no-passkey` | `story` | `Email done — 1 of 2 for the group.` |
| bob | 21 | `D2-02-post-cancel-triage` | `story` | `(Bridge: for Bob that was the passkey and the email.)` |
| extras | 2 | `C-07m-dry-run-all-methods` | `story` | `passkey, guardians, email and Aadhaar in one rehearsal` |
| extras | 3 | `C-05n-how-to-get-the-eml-sheet` | `screen` + `story` + `spec` | screen key · `The help sheet behind “How do I get the .eml?”: per-client steps for Gmail, Outlook, Apple Mail, Yahoo and Proton. Opened from both the setup check (C-05e) and the recovery row (D-07e).` · `spec: Decision 77 — per-client steps to be verified by the kit team` |

`rollout` step 0 (`X-02-rollout-milestones`) has **no** email string in its story, but the **screen it exports** does (§2h) — so the demo's Rollout card breaks silently, without a journeys edit.

### Demo-side mechanical consequences

- **6 `screen` keys change** if the frames are renamed: `C-03c-inventory-device-and-email`, `C-05e-verify-your-email-receive-upload`, `D-07e-verify-with-your-email-eml` (×2 — diana 19 and bob 11), `C-05n-how-to-get-the-eml-sheet`, `D-07c-checklist-passkey-plus-email` (not currently in any journey). Each key drives a PNG export path in `build-demo.py`.
- **1 `hitLabel` changes**: diana step 5 `Send email` — the hotspot is bound to the button text. If the zkPassport CTA is not "Send email", the hotspot bounds must be re-derived.
- If **C-05n is deleted**, `extras` loses a step (5 → 4) and the Extras card shrinks; the demo's advertised screen count (76, label `rollout-section`) drops.

### `persona-demo/persona-docs.json` (extra find)

Verbatim ottie persona research, rendered as the demo's per-persona research panel. Hits: `bob` 6, `carl` 6, `diana` 4, `alice` 0, `sam` 0 — e.g. `• ZK-Email on Gmail. Google as the DKIM signer, PSE as the ERC-7969 re…`, `clause 1: (passkey AND zk_email)  timelock 48h`, `Clauses involving ZK-Email get longer windows because the DKIM registry is a shared ex…`.
The file's own `note` says it is `Verbatim from the Personas research page (Notion). The policy encodings predate spec decision 41 …` — so it is **explicitly historical and arguably needs no edit**, but a reviewer opening Bob's research panel will read "ZK-Email" three sentences after the demo says zkPassport. Ruling needed: leave (documented as historical) or add a one-line staleness banner.

---

## 6. Deck — `social-recovery-ux-assets/recovery-ux-review.html`

| Line | Slide (`data-title`) | Offending phrase |
|---|---|---|
| 200 | Top 5 inputs needed | `<b>ZK Email mechanics <span class="chip open">narrowed</span></b>Direction decided (55, amended by 77): the user clicks “Send email” and <em>receives</em> an email at the enrolled address, downloads the original .eml (Gmail “Show original”) and uploads it — the wallet proves it locally. Still open: subject format, accountCode sto…` — **a whole "ask" item that disappears** |
| 202 | Top 5 inputs needed | `We assume <code>passkey AND [zk_email OR aadhaar]</code> is valid inside the single path` |
| 217 | The model | `ANY-of groups mix methods, M-of-N: <code>passkey AND [Ana OR email]</code>` |
| 222 | The model | `Four methods in v1: passkey, guardians, ZK Email, Anon Aadhaar (listed last, badged “India”).` |
| 248 | UI patterns | inline SVG: `<text …>✉️  recovery@gmail.com</text>` — hand-drawn illustration, not a screenshot |
| 270 | UI patterns | inline SVG: `<text …>✉️ recovery@gmail.com</text>` — same |
| 341 | Flow C · Setup model | `<li><code>passkey AND zk_email</code> — your device + your email, both required</li>` — **the preset list** |
| 347 | Flow C · Setup model | `members mix guardians, passkeys, email, Aadhaar` |
| 360 | Flow C · Setup model | `one enrolled method instance (a specific passkey, guardian address, or email) appears once across the path` |
| 378 | Flow C · Wizard | mermaid inventory node: `☐ long-lived email` |
| 389 | Flow C · Wizard | `<b>ZK Email is receive-and-upload (decision 77):</b> the user clicks <b>“Send email”</b>, receives an email at the enrolled address, opens “Show original”, downloads the <code>.eml</code> and uploads it — the proof is computed locally. Same interaction at enrollment and during recovery.` — **a whole decision row that disappears** |
| 390 | Flow C · Wizard | `A new <b>“How to get the .eml” help sheet</b> covers Gmail, Outlook (web), Apple Mail, Yahoo and Proton, linked from the enrollment test and from the recovery verify row.` — **C-05n referrer; disappears** |
| 428 | Flow D · Collect | mermaid node: `G --> G2["Confirm with your email —<br/>send email → upload the .eml"]` |
| 562 | Flow F · Health | mermaid node: `B --> D["ZK Email: test proof against<br/>live DKIM registry"]` |
| 613 | **Milestones** | `<li>Enrollment + mandatory tests, <b>all 4 methods</b> (incl. the .eml help sheet)</li>` — **the stale string the status doc flags for Fibo** |
| 647 | **Milestones** | `MVP blockers for the kit team: funding/executor (Q7/19), ZK …` (truncated in source line; contains the ZK Email relayer/prover blocker) |
| 659 | Open threads | `<tr><td>Q16/55/77</td><td><b>ZK Email</b> — receive-and-upload direction decided (77 …); open: subject/command format, accountCode storage without a backend, prover stack (~15–60s in-extension?), DKIM registry choice, module timelock vs our waiting period, <b>who runs the send-only relayer</b>…` — **whole table row disappears** |
| 670 | Open threads | `<tr><td>—</td><td>ZK Email accountCode derivation per account (unlinkability)</td><td>Multi-account apply</td></tr>` — **whole table row; becomes the nullifier question** |
| 463 | Flow D · Decisions | `no execution relayer exists (backend-zero)` — **false positive**, this is the funding blocker, not the email relayer. Do not touch. |

Deck line 200 also feeds the "Five things this review must answer" count — removing the ZK Email ask leaves **four**, and the slide heading (line 197, `Five things this review must answer`) becomes wrong unless the zkPassport ask replaces it one-for-one.

---

## 6b. Other asset files — `ui-patterns.svg` and `prototype-demo.html`

Both are committed in `0d26eba61` ("assets: persist demo + deck sources in the repo"). **Neither is referenced by the spec, the status doc, or the persona-demo README** — they are persisted sources, not live surfaces.

### `social-recovery-ux-assets/ui-patterns.svg` — 3 hits

The standalone copy of the deck's "UI patterns" illustration. Its content is duplicated inline in the deck (§6 lines 248, 270), so **any illustration edit must land in both files**.

| Line | Exact string |
|---|---|
| 20 | `<text x="80" y="281" font-size="11.5" fill="#1a1d26">✉️  recovery@gmail.com</text>` |
| 28 | `…AND</tspan>  [👤 Ana <tspan font-weight="700" fill="#6a4bd6">OR</tspan> ✉️ Email]</text>` |
| 51 | `<text x="758" y="190" font-size="11" fill="#7a8194">✉️ recovery@gmail.com</text>` |

Line 28's `[👤 Ana OR ✉️ Email]` uses the **OR** grammar, which decision 73 already removed — so this file carries pre-existing drift beyond the method question.

### `social-recovery-ux-assets/prototype-demo.html` — 43 hits

The **pre-wireframe clickable prototype**, and the most stale file in the inventory. It is stale on four independent counts, only one of which is decision 80:

| Staleness | Evidence |
|---|---|
| Wrong brand | `Ambire Wallet wants to create a passkey` (440) · `Your Ambire recovery code` / `Ambire · no-reply@ambire.com` (741) · `https://ambire.com/r/0x2b0f…6ef5` (720) · `open Ambire on any device` (626, 1134). The substrate decision (bare-bones 4337, not the Ambire stack) makes this doubly wrong. |
| Superseded policy model | `RC_POLICIES = { A:{…methods:['passkey','guardians']}, B:{…methods:['email','passport']} }` (1146–1149) — the **OR-of-policies** model removed by decision 73. |
| Retired code illustration | The email recovery screen uses a **6-digit code**: `Use this code to confirm your inbox: <b>834-192</b>` (742), `<input class="field mono" id="rc-email-code" value="834-192">` (745). Decision 55 explicitly retired the code illustration; decision 77 replaced it with receive-and-upload. This drift predates decision 80. |
| Email method (decision 80) | Method card `Emails · Prove control of your inbox, no password` (405) · add-email screen `sr-email` (464–474, `Add a recovery email`, `recovery@gmail.com`) · recovery screen `sr-recover-email` (730–753, `Confirm your inbox`, `We'll email a code to your recovery address … a zero-knowledge proof from the email's DKIM signature`, `Checking DKIM signature…`) · JS: `addEmail()` (923), `rcOpenEmail()` (1286), `rcEmailSend()` (1293), `rcEmailVerify()` (1294), `startProof(… ['Checking DKIM signature…','Verifying inbox control…','Generating ZK proof…'] …)` (1296) · `CAT.email` (1031) · `RC_METHOD.email` (1153) · `initiateRecovery` comment `email / passport → zero-knowledge proof` (1144) |

**Recommendation: no work.** The file is three model generations behind and unreferenced. If anyone wants it consistent, it needs a rebuild, not a rename — and the honest option is to delete it or add a one-line "superseded, kept for history" banner. **But it must be named in the ruling**, because a reader who opens it sees an email method with a 6-digit code, which contradicts every other surface.

---

## 7. Everything referencing the `.eml` help sheet C-05n

C-05n has **no zkPassport analogue** — there is no third-party mail client to instruct. It is the single most likely screen to be **deleted** rather than renamed, so every referrer below must be resolved, not rewritten.

| Surface | Location | Reference |
|---|---|---|
| Wireframe (self) | `C-05n` / `C-05n-how-to-get-the-eml-sheet`, band `Flow · C` | The screen. Caption `How to get the .eml`. Its own back-link reads `Back to Verify your email`. A `C-05n` string is present in the frame. |
| Wireframe (link) | `C-05e` (MAIN) | `How do I get the .eml?  ›` — 1 instance |
| Wireframe (link) | `C-05k` (MAIN) | `How do I get the .eml?  ›` — **2 instances** (header link + in the error block) |
| Wireframe (link) | `C-07k` (MAIN, dry run) | `How do I get the .eml?  ›` — 1 instance |
| Wireframe (link) | `D-07e` (MAIN) | `How do I get the .eml?  ›` — 1 instance |
| Wireframe (design note) | `D-07e` (MAIN) | `Receive → download the .eml → upload. The “How do I get the .eml?” link opens the C-05n sheet. Never write “relayer”.` — names C-05n by code |
| Wireframe (exhibit) | `X-02-rollout-milestones` (band `Flow · X`) | `Enrollment + mandatory tests, ALL 4 methods (incl. the .eml help sheet).` |
| Spec | line **440** (Milestones, MVP row) | `enrollment + mandatory tests, all 4 methods (C-05 family + C-05n)` — inside the MVP scope commitment and the `~76 screens` budget |
| Spec | line **530** (decision 77) | `A **"How to get the .eml" help sheet** covers Gmail, Outlook (web), Apple Mail, Yahoo, Proton — linked from the enrollment test and the recovery verify row.` + `Wireframe updates (C-05e, D-07e, C-05n) queued` |
| Spec | line **533** (decision 80) | `with it go … the "How to get the .eml" help sheet (C-05n)` + `a Pen round to redraw C-05e/C-05k/C-05n/D-07e` |
| Status doc | line **56** | Filename table row: `\| **C-05n (new)** \| \`C-05n-how-to-get-the-eml-sheet\` \|` |
| Status doc | line **77** | `C-05n is a plain full-screen help sheet (five client rows: Gmail, Outlook web, Apple Mail, Yahoo, Proton) placed after C-05l; it is opened from both C-05e and D-07e.` — **also records the frame's canvas position, which matters if it is removed** |
| Status doc | lines **3, 31** | Round logs: `the C-05e/D-07e/C-05n wireframes, the C-05n queued Pen items` · `C-05n in Extras` |
| Demo journeys | `diana` step 5, field `spec` | `Decision 77 — receive-and-upload · help sheet C-05n` |
| Demo journeys | `extras` step 3 | Whole step: `screen: C-05n-how-to-get-the-eml-sheet`, story naming Gmail/Outlook/Apple Mail/Yahoo/Proton and both openers |
| Deck | line **390** | `A new <b>“How to get the .eml” help sheet</b> covers Gmail, Outlook (web), Apple Mail, Yahoo and Proton, linked from the enrollment test and from the recovery verify row.` |
| Deck | line **613** | `Enrollment + mandatory tests, <b>all 4 methods</b> (incl. the .eml help sheet)` |

**17 referrers across 6 files.** Deleting C-05n changes two published screen counts (spec `~76 screens`, demo label `rollout-section` / 76 screens) and drops one Extras demo step.

---

## 8. Blast radius count

### Wireframes (`social-wireframes.pen`, 159 page wrappers)

| Band | Wrappers total | Wrappers with genuine email content | Of which: purpose-is-email | Frame names to rename |
|---|---|---|---|---|
| `Flow · A · FIRST RUN & FAST TRACK` | 4 | 0 | 0 | 0 |
| `Flow · B · NUDGES & HOME SURFACE` | 4 | 0 | 0 | 0 |
| `Flow · C · SETUP (OWNER)` | 56 | **32** | **7** — 3 mechanic (C-05e, C-05k, C-05n) + 4 shape-identity (C-03c, C-04b, C-07g, C-07k) — plus C-06 as a preset-identity screen | 4 (C-03c, C-05e, C-05k, C-05n) |
| `Flow · D · RECOVERY (RECOVERER)` | 39 | **8** | **2** — 1 mechanic (D-07e) + 1 shape-identity (D-07c) | 2 (D-07c, D-07e) |
| `Flow · D2 · PENDING & POST-CANCEL` | 4 | **1** | 0 | 0 |
| `Flow · E1 · GUARDIAN APPROVAL PAGE` | 10 | 0 | 0 | 0 |
| `Flow · F · HEALTH CHECK` | 2 | **2** | 0 (but both need a semantic rewrite) | 0 |
| `Flow · G · MANAGEMENT` | 10 | **7** | 0 | 0 |
| `Flow · X · MODEL COMPARISON (team exhibit)` | 2 | **2** | 0 | 0 |
| **MAIN subtotal** | **131** | **52** | **9** (incl. C-06) | **6** |
| `Flow · OUTDATED · MULTI-PATH MODEL` | 28 | 27 | 6 | 3 — **no work needed** |
| **Grand total** | **159** | **79** | **15** (6 of them in OUTDATED — no work) | **9** (3 in OUTDATED — no work) |

Plus **3 false-positive screens** (D-11, D-11b, D-12) that matched only on the funding-relayer note — explicitly out of scope.
Plus **6 wrapper `Caption` nodes** carrying email text (C-03c, C-05e, C-05k, C-05n, D-07c, D-07e in MAIN; 3 more in OUTDATED).

### Other surfaces

| Surface | Count | Detail |
|---|---|---|
| Spec `social-recovery-ux-flows.md` | **26 lines** | 7 already-reconciled (79, 101, 141, 448, 533, 545, 547) · 11 stale prose (80, 81, 82, 83, 84, 124, 149, 153, 159, 179, 432) · 2 mermaid nodes (208, 361) · 1 Milestones row (440) · 5 decision rows (469, 508, 528, 529, 530) |
| Status doc `social-recovery-ux-status.md` | **11 lines** | incl. the 4-row wireframe filename table (54, 55, 56, 71) and the C-05n placement note (77) |
| SDK doc `social-recovery-sdk-requirements.md` | **4 lines** | all already reconciled (7, 173, 174, 199) — verify only |
| Extension doc `social-recovery-extension-work.md` | **2 lines** | already reconciled (3, 12) — verify only |
| Demo journeys `journeys.json` | **19 steps + 2 persona bios** | diana 11 steps, bob 6, extras 2 · 6 `screen` keys · 1 `hitLabel` |
| Demo research `persona-docs.json` | **3 personas, 16 hits** | bob 6, carl 6, diana 4 — self-declared historical; ruling needed |
| Deck `recovery-ux-review.html` | **17 lines** (+1 false positive) | 2 whole decision rows (389, 390) · 2 whole open-thread rows (659, 670) · 1 whole review-ask (200) · 3 mermaid nodes (378, 428, 562) · 2 inline SVG illustrations (248, 270) · 1 Milestones bullet (613) |
| `ui-patterns.svg` | **3 lines** | 20, 28, 51 — duplicate of the deck's inline illustration; line 28 also carries pre-decision-73 `OR` grammar |
| `prototype-demo.html` | **43 hits, ~20 lines** | Pre-wireframe prototype, unreferenced, three model generations stale (Ambire branding · OR-of-policies · retired 6-digit code). **Recommend no work; name it in the ruling.** |
| C-05n referrers | **17 across 6 files** | see §7 |
| Files touched, total | **6 edited + 4 ruled/verified** | Edit: pen (incl. X-02), spec, status doc, journeys, deck, ui-patterns.svg. Ruling or verify only: SDK doc, extension doc, persona-docs.json, prototype-demo.html |

---

## 9. Order of operations

### 9a. Blocking — no Pen prompt can be written until these are answered

These are not copy questions. Each one changes the **number** or **shape** of screens, so writing a Pen prompt before they land guarantees a rework round.

| # | Question | What it gates |
|---|---|---|
| **B1** | **What does the user physically do to present the document?** NFC tap on a phone · document photo upload · hand-off to the zkPassport mobile app and back. | The entire C-05e / D-07e redraw. An in-extension NFC scan is impossible on desktop Chrome, so a phone hand-off means a **QR + poll + return** sub-flow — that is 2–4 *new* screens, not a redraw of 1. **Partial prior art exists — see §10.** |
| **B2** | **Does the flow have a failure taxonomy, and what is in it?** | Whether C-05k survives at all, and what its error copy says. Today's failures ("not the original message", "a forward or a copy") are `.eml`-specific and all die. |
| **B3** | **Does the user need help instructions from a third party?** | Whether **C-05n is deleted or replaced**. If deleted: MVP screen budget drops to ~75, spec line 440 changes, demo Extras loses a step, 17 referrers resolve to nothing. If replaced (e.g. "which documents work" / "how to enable NFC"), C-05n becomes a different sheet with the same slot. **This is the single highest-leverage question** — it decides delete-vs-rename for 17 referrers. |
| **B4** | **Can the enrollment test run locally with no chain access?** Spec line 136 makes the test mandatory and blocking; line 141 says "verify against the on-chain verifier". | Whether the C-05 verify-access family keeps its "Local only, no chain" promise, and whether the dry run (C-07k/C-07l/C-07m) can rehearse the method offline. |
| **B5** | **Nullifier / linkability semantics: one instance per person, or per account?** | (a) the C-09 family's UI rule ("the email method is not offered for a second account"); (b) the `EMAILS` picker section on C-10b/C-10d holding **two** instances; (c) spec lines 83/84 (`[1/2 emails]`, "two ZK Email methods on different addresses is fine"). If zkPassport is one-per-person, the two-instance fixture is a **lie in an MVP screen**. |
| **B6** | **Is the credential device-bound?** | D-15's `Email · not tied to the lost device` row — the reason the method survives post-recovery cleanup. If zkPassport is bound to a phone, D-15's cleanup logic changes for Diana. |
| **B7** | **What is the trust root for the health check?** F-01/F-02 say "Passed a test check with your **email provider**"; the spec's Flow F mermaid (line 361) says "test proof against live DKIM registry". | The F band rewrite, and whether spec line 432's `M34 DKIM-rotation failure split` deferral is deleted or re-pointed. |
| **B8** | **The preset name.** Spec line 101 already proposes "Your device + your ID" but marks it provisional: *"Preset name and copy to be finalized with the zkPassport research."* | 10 screens repeat the string `Your device + your email` (C-01, C-01b, C-01c, C-06, D2-03, G-02, G-03b, G-04, F-02, + X-01's column) and 3 more repeat the row label `ZK Email` / `Email (ZK Email)`. Cheap once fixed; unfixable while provisional. |
| **B9** | **The method's display name and row label.** `ZK Email` → `zkPassport`? `Passport`? `Your ID`? And the value shown next to it — `f•••@gmail.com` has no analogue (a passport number must never be displayed). | Every one of the 40-odd mention screens. This is the most-repeated string in the inventory. **Candidate answers are already drawn in `prototype-demo.html` — see §10:** card label `Government ID · Prove you are a real person, privately`, row label `Passport`, value row `Passport no. •••••••• 🔒 hidden`. Raises **B9b: one ZK-ID method card with a document picker, or two separate method rows for zkPassport and Aadhaar?** |
| **B10** | **Ruling on the two already-flagged stale strings** (status doc line 3): patch X-02 / deck Milestones / spec Milestones to neutral wording **now**, or fold into this round. Status doc recommends folding in. | Whether §3d, X-02 and deck 613 are one commit or two. |

**B1, B3 and B9 are the hard gates.** B1 decides how many screens exist; B3 decides whether one screen is deleted; B9 decides what text goes in 40 screens. Nothing about the *user journey* can be prompted without B1.

### 9b. Mechanical once the user journey is known

Safe to batch into a single Pen round plus one docs commit, in this order:

1. **Rename 6 MAIN frames + their 6 wrapper captions** (C-03c, C-05e, C-05k, C-05n, D-07c, D-07e). Do this *first* — the demo's `screen` keys and the status doc's filename table both derive from it. Leave the 3 OUTDATED frames alone.
2. **Global string swap across 52 MAIN screens** — `ZK Email` → the B9 name, `Email (ZK Email)` → the B9 row label, `Your device + your email` → the B8 preset name, `f•••@gmail.com` / `recovery@gmail.com` / `work•••@company.com` / `fable@gmail.com` → the B9 value fixture. Pure find-and-replace once B8/B9 land. **Do not touch the OUTDATED band, and do not touch D-11/D-11b/D-12.**
3. **Delete the 4 dead design notes** — `direction: local proof from a raw .eml (no relayer)` (6 screens: C-05, C-05b, C-05h, C-11, plus its variants), `ZK Email mechanics (Q16)` + its OPEN block on D-07c, `ZK Email code per account (R10)` + note on C-09/C-09b/C-09c, `Confirmed with ZK Email. Mechanics are still open (Q16).` on C-10e. Replace with the zkPassport open items from spec line 545.
4. **Redraw the 4 purpose screens** (C-05e, C-05k, C-05n-or-successor, D-07e) plus the miniature mechanic inside C-07k. Only possible after B1–B3.
5. **Rewrite the F band** (F-01, F-02) — semantics, not labels. After B7.
6. **Patch X-02** (`incl. the .eml help sheet`) — after B3 decides what the MVP list says.
7. **Spec commit**: 11 stale prose lines + 2 mermaid nodes + Milestones line 440 + decision rows 469/508/528/529/530 marked historical, + delete line 153 (superseded by 547) + resolve line 432's M34 deferral. Update the `~76 screens` count if C-05n dies.
8. **Status doc commit** — filename table rows 54/55/56/71, the C-05n placement note (77), and a new round entry. **Mandatory at the same checkpoint** per the workstream rule.
9. **Journeys commit** — 6 `screen` keys, 1 `hitLabel`, 19 step stories, 2 persona bios; drop or re-point `extras` step 3; adjust the Rollout card story only if the milestone list changes.
10. **Re-export the demo** — 6 renamed frames need fresh PNGs; diana step 5's hotspot bounds need re-deriving if the CTA text changes.
11. **Deck commit** — 17 lines. Note the "Five things this review must answer" heading (line 197) breaks if the ZK Email ask (line 200) is removed without a one-for-one zkPassport replacement. Re-publish to the existing artifact URL.
12. **Verify-only pass** on the SDK doc (4 lines) and extension doc (2 lines) — both already reconciled with decision 80.
13. **Ruling then action** on `persona-docs.json` (16 hits, 3 personas) — leave as declared-historical, or add a staleness banner.
14. **`ui-patterns.svg`** — 3 lines; the same illustration edit must land on deck lines 248/270. Consider fixing line 28's pre-decision-73 `OR` grammar in the same pass.
15. **Ruling then action** on `prototype-demo.html` — recommend leaving it with a "superseded, kept for history" banner, since a rename still leaves Ambire branding and the OR-of-policies model. Read §10 first: it is the best existing reference for what the redraw should look like.

### 9c. Recommended sequencing

**Read §10 before the research pass runs** — a passport enrollment wizard and a passport recovery screen are already drawn in `prototype-demo.html`, which narrows B1, B6 and B9 for free. Then run the **zkPassport research pass and answer B1–B7 in it**, then get B8/B9/B10 as a short Fibo ruling, then a single Pen round covering steps 1–6, then one docs commit covering 7–13. Splitting the Pen round is the trap: steps 1 and 2 touch the same 52 screens as step 4, and the demo re-export can only run once against a settled set of frame names.

---

## 10. Unexpected asset: a passport flow is already drawn

`prototype-demo.html` contains a **complete, working passport recovery sub-flow** and a passport enrollment slot. It predates decision 80 by months and nobody has cited it, but it answers or anchors several of the §9a gates. Worth reading before the research pass writes its own answers.

| Location | What is already drawn |
|---|---|
| 406 | Method card: `<b>Government ID</b><small>Prove you are a real person, privately</small>` with the 🪪 icon — a **method-card label that avoids naming the document type** |
| 477–540 | `sr-gov` … `sr-gov-4`: a **4-step Government ID enrollment wizard** |
| 485–486 | Document picker: `Aadhaar · India · secure QR` (selected) next to `🛂 Passport · NFC chip · most countries` badged **`COMING SOON`** — the disabled row is precisely the method decision 80 now wants |
| 498 | `Line up the secure QR on your Aadhaar (or the passport chip) with your device so it can be read.` — a shared capture screen for both ZK-ID methods |
| 757–774 | `sr-recover-passport`: **the recovery-side screen.** `Scan your passport` · `Hold your passport to the device to read its chip, then build a zero-knowledge proof — no personal details are revealed.` · `🛂` hero · `Start scan` CTA |
| 767, 1307 | Progress substeps: `Reading passport chip…` → `Verifying issuer signature…` → `Generating ZK proof…` |
| 771 | **The value-display answer to gate B9:** `<span class="rk">Passport no.</span><span class="rv">••••••••</span><span class="rh">🔒 hidden</span>` — the analogue of today's `f•••@gmail.com` fixture, drawn as a fully-masked row rather than a partially-masked one |
| 1154 | `passport:{icon:'🛂',title:'Passport',sub:'Scan your passport, then build a proof',done:'ZK proof ready'}` — row label, subtitle and done-state |
| 936 | `addItem('gov', govDoc+' · verified privately','🪪')` — the enrolled-instance label pattern (`Aadhaar · verified privately`) |

What this contributes to the gates:

- **B1 (input surface):** an NFC chip read is the drawn assumption, with a single hero + "Start scan" button and no external hand-off. It does **not** address the desktop-Chrome problem — the prototype is phone-shaped throughout, so the QR/hand-off question stays open.
- **B2 (failure taxonomy):** none drawn. The prototype has no passport failure state, so C-05k's successor still has to be invented.
- **B9 (value fixture and label):** `Passport no. •••••••• 🔒 hidden` and the neutral card label `Government ID · Prove you are a real person, privately` are ready-made candidates. Note the prototype **groups Aadhaar and passport under one "Government ID" method card** — which conflicts with the spec's four-method list (line 79) treating zkPassport and Anon Aadhaar as separate methods. Worth an explicit ruling: one ZK-ID method card with a document picker, or two method rows.
- **B6 (device-boundness):** a chip read implies the document, not the device, is the credential — which would keep D-15's "not tied to the lost device" claim true. Not confirmation, but the drawn assumption agrees.

Caveat: every one of these screens sits inside the superseded OR-of-policies model and the Ambire branding, so it is a **shape reference only** — not a source to copy strings from.
