# Social Recovery — UX Flow Diagrams (working doc)

> Working document. Owner: Fibo. Status: **reviewed — 6-perspective review pass applied 2026-08-12**.
> Sources: social-recovery prototype HTML (demo), the Notion
> [Personas page](https://app.notion.com/p/36d9a4c092c780578f9dde36e69dfff5) (Alice → Sam),
> Design Rationales R1–R13. Scope note: this document focuses on the **UX of the
> initiative**; contract-level details live in the tech design and are only referenced
> where a UX flow depends on them.
>
> Framing: the social recovery initiative is a **general-purpose improvement for the
> ecosystem**. This extension is the demo/reference app that shows what can be done.
> These flows are therefore **reference UX**, not app-only decisions.
> This document lives as a **sibling to the Notion pages** (personas, rationales).
>
> Naming (decided): the user-facing label is **"Account recovery"**. "Social Recovery
> (Kit)" stays as the internal/tech name only.
> User-facing vocabulary (decided): **"recovery path"** = one clause/card,
> **"method"** = one credential, **"waiting period"** = timelock. "Policy", "proof",
> "relayer", "EIP-712" stay in spec prose only.
>
> Context: the UX lives under **Settings › Account recovery**. The recovery module is
> ERC-7579, on a 4337 smart account or a 7702-upgraded EOA. 7702 vs 4337 copy
> differences: deferred. Chain scope: **one chain per policy**; demo runs on
> **Sepolia**; focus is Ethereum. **Multichain: out of scope for v1** (decided) —
> note for integrators: rotation happens on one chain; the same address on other
> chains stays locked.

---

## Flow A — Extension first open (entry points)

```mermaid
flowchart TD
    A[Install extension] --> B[Welcome screen]
    B --> C1[Create a new account]
    B --> C2[Add an existing account]
    B --> C3[Recover an account]

    C1 --> D1[Standard create flow]
    C2 --> D2[Standard import flow]

    C3 --> E[→ Flow A1 fast-track onboarding]

    D1 --> G[Dashboard]
    D2 --> G

    click E href "#flow-a1--fast-track-onboarding-recovery-focused"
```

### Flow A1 — Fast-track onboarding (recovery-focused)

```mermaid
flowchart TD
    A["'Recover an account' clicked"] --> S["Warning screen:<br/>'No support agent will ever<br/>ask you to do this.'"]
    S --> B[Set extension password]
    B --> C["New key generated — recovery-focused copy"]
    C --> D["Seed backup ceremony (kept, short)"]
    D --> E[→ Flow D]

    click E href "#flow-d--recover-an-account"
```

Decisions:
- ✅ Fast-track = **warning screen + extension password + key creation + seed
  backup**. Nothing else.
- ✅ Seed backup is not deferred. It stays in the fast-track.
- ✅ Copy at key creation (corrected): "**Your account stays at the same address.**
  This new key will control it." (Nothing "moves"; the address never changes.)

---

## Flow B — Recovery-methods check + nudge

```mermaid
flowchart TD
    A[Account exists / dashboard] --> B{"Account has recovery<br/>paths set up?"}
    B -- Yes --> C[End. No action.]
    B -- No --> D["Modal: 'You have no recovery path<br/>set up yet. Protect your account.'<br/>+ honesty note (below)"]
    D -->|Set up recovery| G[Settings › Account recovery → Flow C]
    D -->|Dismiss| F[Shows again next open]
    F --> A
    D -->|☑ Don't remind me again| H["Passive 'unprotected' shield badge<br/>(persistent, silent)"]
    H -. click .-> G

    click G href "#flow-c--recovery-setup"
```

Decisions:
- ✅ Trigger: each dashboard open until the user acts or opts out.
- ✅ Permanent dismiss keeps the shield badge as re-entry point. Concretely: a small
  shield icon in a warning state, shown permanently on the account row and on the
  Settings › Account recovery entry while the account has no recovery path. It never
  pops up and never blocks anything. Clicking it opens setup (Flow C).
- ✅ Honesty note, concrete copy: "Recovery protects you if you **lose** your key.
  It cannot stop someone who already has it. And if your only method is a passkey on
  this device, losing the device also removes this recovery path."

---

## Flow C — Recovery setup

Building blocks:
- **Methods:** passkey, guardians (people's wallets, EOA or SCW), ZK Email, Anon Aadhaar.
- **Recovery paths:** OR of AND clauses. Each path has its own waiting period.
- **A path can be a lone OR-group** (no required rows): Alice's guardians-only
  `3-of-5` is one path with the threshold inside the guardian method. The builder
  must support this shape explicitly.
- **Presets can be reduced to a single method** (Sam's floor). The builder must
  support one-method paths; the honesty note (Flow B copy) doubles as their warning.
- **Mixed-method OR-groups** (`passkey AND [zk_email OR aadhaar]`): **decided —
  valid** (assumed). Works the same as the guardian case
  `passkey AND [Guardian A OR Guardian B]`. The exact contract encoding sits with
  the kit team (tech-dependencies table).

### Three setup modes

| Mode | For | Shape |
|---|---|---|
| **Express** | Least technical | Short guided wizard. Per-step education, minimal UI. |
| **Presets** | Middle ground | Pre-defined recovery paths in place; user removes/edits. |
| **Advanced** | Most technical | Free builder (grouped condition pattern). |

**Entry pattern:** no three-way fork. The tab **lands on the Presets state**; two
actions on top: **"Guide me"** (Express) and **"Customize"** (Advanced).

**Starter presets (updated): three recovery paths shown by default**, 48h waiting
period each, all starting in "needs setup" state with deep-links into enrollment:
1. `passkey AND [guardians threshold group]` — your device + your people.
2. `passkey AND zk_email` — your device + your email. (Note: violates R9 when the
   passkey is Google-synced and the email is Gmail — accepted for now.)
3. `guardians-only, M-of-N` — people only, no device or platform dependency
   (added for the Alice/paper-guardian profile; also the only preset with no passkey).

### Express wizard — step list

```mermaid
flowchart TD
    A[Express start] --> B["1 · How recovery works —<br/>one screen, three bullets"]
    B --> C["2 · Inventory: what do you have?<br/>(four checkboxes — list below)"]
    C --> D["3 · Recommended preset shown as<br/>recovery-path cards<br/>(presets from ottie's persona research)"]
    D --> E["4 · Enroll each method:<br/>short explainer + 'Learn more' +<br/>mandatory access test (local, no chain)"]
    E --> F["5 · Waiting period — 48h default,<br/>changeable. Guardrails: minimum floor,<br/>dominated-path warning."]
    F --> G["6 · Review → submit config<br/>(batched: one confirmation — see Q28 note)"]
    G --> H["7 · Recovery Card download<br/>+ enable alerts opt-in"]
    H --> I["8 · Offer: apply to other accounts<br/>(never by default; see R10 constraints)"]
```

Inventory items (step 2):
- ☐ another device (passkey-capable)
- ☐ trusted contacts with wallets
- ☐ long-lived email
- ☐ Aadhaar ID (last, badged)

The recommended presets in step 3 come from the
[persona research (Notion)](https://app.notion.com/p/36d9a4c092c780578f9dde36e69dfff5).

Wizard state rules:
- ✅ **Draft/resume:** progress persists locally; abandoning mid-wizard re-enters at
  the last completed step. Enrollments without a saved on-chain config show as
  "not yet active".
- ✅ **Alerts opt-in (step 7):** request notification permission here — Flow D2
  depends on it. If denied: degraded banner-only behavior, stated to the user.

### Verify-access at enrollment

Mandatory for identity methods; a failing test blocks the save. Local only, no chain.

| Method | Test |
|---|---|
| Passkey | Sign a test challenge right after creation. Instant. |
| ZK Email | Generate a full test proof locally. Depends on Q16. Progress UI; doubles as dry run. |
| Anon Aadhaar | Test proof against the current UIDAI key. |
| Guardians | **Optional, open**: light checks (checksum, ENS resolution, contract detection, same-seed). A real signature test needs the guardian to act — also optional. |

### Recovery Card (step 7)

Contents — **only**: the account address, a short "how to start recovery" guide, and
the canonical approval-page URL. Plus the line "this card alone cannot move funds."

Explicitly **kept off the card** (decided, with rationale): the method inventory,
guardian names or contacts, the enrolled email address, thresholds, and waiting-period
values. Reason: the card is designed to be stored insecurely — that is its job. A
stolen or copied card must not become a **map of exactly which methods to phish**.
The address alone is public information anyway; the configuration is the secret.

### Multi-account "apply this setup" (R10 constraints)

- ZK Email `accountCode` derivation per account: **open question** (moved to the
  tech-dependencies table).
- ✅ Passkey and guardian reuse across accounts is observable on-chain (per R10).
  Show a linkability warning and offer "create a fresh passkey for this account".
- Never applied by default.

Other decisions:
- ✅ All 4 methods in v1. Aadhaar for everyone, listed last, badged.
- ✅ Waiting period: 48h flat default, **confirmed to stand also for single-method
  paths**. Changeable per path. Builder guardrails: a minimum floor (zero-second
  waiting periods must not be configurable) and a **dominated-path warning**.
  Definition: path Y is dominated when another path X needs a **subset** of Y's
  methods and has an equal-or-shorter waiting period — anyone who can complete Y can
  always use the easier X instead, so Y adds zero security. Example: with
  X = `passkey` (48h), Y = `passkey AND zk_email` (48h) is pointless. The warning
  suggests giving the stronger path a shorter waiting period, or removing one of
  the two.
- ✅ Express presets and their contents come from **ottie's persona research**.
- Advanced-builder helper (nice-to-have, from review): an "M-of-N across methods"
  macro that auto-expands pair clauses.

### UI pattern references (solved problem)

Grouped condition builder with "ALL of / ANY of" headers: Notion/Airtable advanced
filters, Apple Smart Playlists, Zapier paths, Stripe Radar, `react-querybuilder`.
Threshold selector inside a group: Safe's "M out of N owners" row.

![UI patterns: grouped condition builder, recovery-path cards with OR divider, threshold selector](social-recovery-ux-assets/ui-patterns.svg)

---

## Flow D — Recover an account

Preconditions — a key that will receive control, from either entry point:
- fresh install → the fast-track onboarding creates it (Flow A1);
- **logged-in** → an existing account is the new owner (see "Flow D additions" below).
⚠️ **Funding & execution: BLOCKER, unresolved.** `initiate/executeRecovery` are
permissionless direct calls that bypass the 4337 flow — a 4337 paymaster cannot
sponsor them, and the SDK design is backend-zero (no relayer exists today). "Who pays
and who executes" has no owner. The flow below names the intended UX; the
infrastructure question is in the tech-dependencies table.

**Config visibility:** the policy **structure** is readable on-chain
("passkey + zk_email"). Value visibility is **OPEN**: in the current contracts,
guardian addresses are natively public (R10 calls them observable); whether values
can be hidden at all sits with the kit team. Case to design for either way: values
encrypted with a **user password** — the recoverer enters it to decrypt and see the
real values (e.g. which guardians to contact).

The flow is chaptered into its three phases so each diagram stays readable.

**Chapter 1 — Identify the account**

```mermaid
flowchart TD
    A[Entry: Recover an account] --> B{"Identify the lost account"}
    B -->|Paste address| C["Lookup — loading state"]
    B -->|ENS name| C
    B -->|Same-install list 🔒| C
    C -->|Lookup fails| C1["Specific error per cause — invalid<br/>address / ENS not found / network error —<br/>+ retry + 'check your Recovery Card' hint"]
    C1 --> B
    C -->|Found| CC["Confirm identity card:<br/>address + blockie + ENS +<br/>recovery-path summary.<br/>'This is my account'"]
    CC -->|Not mine| B
    CC --> E{"Account has recovery paths?"}
    E -- No --> X["'This account has no recovery set up,<br/>so it cannot be recovered.'<br/>Primary action: try another address"]
    X --> B
    E -- Yes --> V["Paths shown. Structure is always<br/>readable; value visibility is OPEN<br/>(see config-visibility note).<br/>Password-decrypt case: enter the<br/>recovery password to see real values"]
    V --> F["Pick the recovery path<br/>you can satisfy"]
    F --> NEXT["→ Chapter 2: collect the approvals"]
```

**Chapter 2 — Collect the approvals**

```mermaid
flowchart TD
    F["Recovery path chosen (chapter 1)"] --> G["Recovery checklist — persisted locally,<br/>resumable via a pending card<br/>on the home surface"]
    G --> G1[Get guardian approvals → Flow E1]
    G --> G2["Confirm with your email<br/>(mechanics TBD — Q16)"]
    G --> G3["Confirm with your passkey —<br/>platform sync + hybrid QR to phone"]
    G --> G4[Confirm with Aadhaar]
    G -->|Cannot complete this path| SW["→ back to path choice (chapter 1)"]
    G1 --> H{"Path satisfied?"}
    G2 --> H
    G3 --> H
    G4 --> H
    H -- No --> G
    H -- Yes --> NEXT["→ Chapter 3: submit, wait, finish"]

    click G1 href "#flow-e1--sync-off-chain-signature-passing--default"
```

**Chapter 3 — Submit, wait, finish**

```mermaid
flowchart TD
    CF["Confirmation screen: the account,<br/>the new key that takes control,<br/>the chosen path, the waiting period.<br/>'The current owner can cancel during<br/>the waiting period.' Explicit consent."] --> I["START RECOVERY — one atomic tx<br/>(funding/executor: see blocker note)"]
    I -->|Submit fails| I2["Plain-language error + retry<br/>+ self-pay-gas fallback"]
    I2 --> BK["→ back to the checklist (chapter 2)"]
    I -->|Submitted| J["Waiting period countdown —<br/>persistent, resumable"]
    J -->|Owner cancels| XC["Terminal: 'The account owner<br/>cancelled this recovery.'<br/>Explanation + start again"]
    J -->|Ends| K["User is NOTIFIED + auto-execute<br/>(executor: OPEN)"]
    K --> L["Key rotated → account active.<br/>REQUIRED cleanup checklist:<br/>methods tied to the lost device<br/>are flagged for removal (→ Flow G)"]

    click L href "#flow-g--recovery-paths--method-management"
```

Decisions:
- ✅ Identify by pasted address, ENS, or the gated same-install list (full
  wallet-unlock strength, no balances shown, usage logged).
- ✅ Confirm-identity card before any proof collection (restored from the demo).
- ✅ Checklist has an explicit "switch to a different recovery path" exit; reusable
  approvals are preserved.
- ✅ Submit failures get plain-language errors, retry, and a self-pay-gas fallback.
- ✅ The countdown has a **cancelled** terminal state — the recoverer never waits
  into silence.
- ✅ End of recovery = **required cleanup checklist**, not a soft nudge: the surviving
  config still contains the lost device's methods; whoever holds that device can
  start a new recovery. Flag and walk through their removal.

## Flow D additions — logged-in entry & interactive claims

### Logged-in entry (Settings)

Recovery does not require a fresh install. A logged-in user starts it from the
**"Recover an account"** button on the Settings › Account recovery overview (Flow G).

```mermaid
flowchart TD
    A["Settings › Account recovery:<br/>'Recover an account' (logged in)"] --> B{"Wallet has multiple accounts?"}
    B -- Yes --> C["Choose the NEW OWNER:<br/>which of your accounts<br/>receives control"]
    B -- No --> D["Single account —<br/>the step is skipped automatically"]
    C --> E["→ Flow D chapter 1: identify the lost account"]
    D --> E
```

Decisions:
- ✅ Logged-in entry exists next to the fresh-install entry.
- ✅ Multiple accounts → the user picks which account becomes the new owner.
  A single account skips the step.

### Interactive claim collection (refines Flow D chapter 2)

The checklist is interactive per method of the selected path.

```mermaid
flowchart TD
    A["Checklist — one row per method<br/>of the selected path"] --> B["VERIFY button on each row:<br/>explains how to obtain the proof<br/>+ offers the submit input in place"]
    B --> C["Claim submitted →<br/>row marked complete"]
    C --> D{"User goes back and<br/>selects another path?"}
    D -- Yes --> E["Submitted claims are KEPT —<br/>methods shared between paths<br/>stay complete"]
    E --> A
    D -- No --> F["Path complete →<br/>confirmation screen"]
    F -.-> G["On recovery-flow EXIT<br/>(finished or abandoned):<br/>ALL stored claims are WIPED"]
```

Decisions:
- ✅ Each method row has a **verify button**: it explains how to get the proof and
  gives the way to submit it, in place.
- ✅ Claims **survive path switching**: going back and selecting another policy keeps
  every claim already submitted.
- ✅ Claims are **wiped when the recovery flow exits** — finished or abandoned.
  Security rule: claims never persist beyond the flow.

---

## Flow D2 — Cancel side (original owner's device)

```mermaid
flowchart TD
    A[Recovery initiated on-chain] --> B[Wallet detects pending recovery]
    B --> C[Persistent banner on dashboard]
    B --> D[System notification]
    C --> E{"Owner action"}
    D --> E
    E -->|It's me| F[Dismiss banner]
    E -->|NOT me| G["Cancel recovery —<br/>owner-signed transaction"]
    G --> T["Triage screen (required):<br/>which path and which methods were<br/>satisfied → replace them (→ Flow G)<br/>→ consider moving funds if the<br/>compromised method is unclear"]

    click T href "#flow-g--recovery-paths--method-management"
```

Decisions:
- ✅ Banner + notification. Polling caveat accepted for now (user must open the
  browser during the waiting period). Alerts opt-in in Flow C step 7 mitigates.
- ✅ Cancel is not resolution: the attacker still holds a working method. The triage
  screen is required, not optional.

---

## Flow E — Guardian approval

**E1 (sync) is the default for v1.** E2 (async) stays mapped as a future improvement.
Either way the recovery **trigger stays with one person** (the recoverer).

### Flow E1 — Sync (off-chain signature passing) — DEFAULT

```mermaid
flowchart TD
    A["Recoverer shares link/QR<br/>with the guardian (any channel)"] --> B["Guardian opens the CANONICAL<br/>IPFS/IPNS page"]
    B --> C["Page leads with plain language:<br/>who asks, what approving does.<br/>'Verify the details' expander holds<br/>the exact payload: account, new owner,<br/>recovery nonce (read on-chain).<br/>NO expiry shown — none is enforced."]
    C --> W["Required acknowledgment: the sign<br/>button stays disabled until the guardian<br/>checks 'I contacted the owner on a<br/>channel I already had.'"]
    W -->|Something is off| DE["Decline — and tell the owner<br/>about this request anyway"]
    W -->|Confirmed| D["Connect wallet —<br/>injected AND WalletConnect.<br/>OFFLINE path: copy the raw payload,<br/>sign air-gapped, paste the<br/>signature back"]
    D --> E["Approve in the wallet prompt.<br/>Page copy: 'trust the values in your<br/>WALLET prompt, not this page'"]
    E --> F["Single-line signature blob,<br/>pre-wrapped in backticks"]
    F --> G[Guardian sends it to the recoverer]
    G --> H["Recoverer pastes it — validated<br/>on paste: malformed / wrong recovery /<br/>wrong signer errors surface immediately"]
```

Security rationale (why these steps exist):
- Design principle for guardian-facing surfaces (decided): **"Information should be
  ignorable but verifiable."** Guardians can be non-technical users. Plain language
  leads; the technical detail collapses behind a "Verify the details" expander and
  never blocks the main path.
- The page renders whatever the URL says — an attacker who builds the link controls
  everything it displays. The page is **not** a trust anchor. The two real anchors
  are: the out-of-band call to the owner, and the wallet's own signing prompt.
- The acknowledgment checkbox is UI friction, not enforcement — a static page cannot
  verify that the call happened. It still forces a deliberate pause at the exact
  moment phishing relies on speed.
- Guardians who decline should still tell the owner: off-chain proof collection is
  invisible on-chain, so guardians are the owner's only tripwire during that phase.
- A guardian signature has **no expiry** — it dies only when its nonce is consumed or
  the request is cancelled. Never display a time limit the contract does not enforce.

### Flow E2 — Async (on-chain approval) — FUTURE

```mermaid
flowchart TD
    A[Recoverer shares link/QR] --> B[Guardian opens the same page]
    B --> C["Same payload display + blocking<br/>out-of-band step as E1"]
    C --> D[Guardian connects wallet]
    D --> E["Guardian SUBMITS approval on-chain"]
    E --> F["Recoverer's checklist picks it up —<br/>no message back needed"]
    F --> G[Recoverer starts the recovery — one tx]
```

Blockers (secondary to this doc's focus; tracked for completeness): no on-chain
approval function exists in the current contracts (R5 conflict); guardian-side gas
needs sponsorship; detection needs indexing that the backend-zero design removed.

---

## Flow F — Health checks (in scope)

Same machinery as the verify-access tests, run over time.

```mermaid
flowchart TD
    A["Trigger: opening the Account recovery tab<br/>+ periodic background check"] --> B[Run per enrolled method]
    B --> C["Passkey: sign a test challenge<br/>(no transaction)"]
    B --> D["ZK Email: test proof against<br/>live DKIM registry"]
    B --> E["Guardians: no on-chain check —<br/>prompt periodic self-audit /<br/>ping guardian reachability"]
    B --> F["Aadhaar: proof against current UIDAI key"]
    C --> G{"All pass?"}
    D --> G
    E -. best effort .-> G
    F --> G
    G -- Yes --> H["Meter: 'Recovery ready'"]
    G -- No --> I["Alert + per-method fix path<br/>(re-enroll, replace guardian, …)"]
    I --> J[→ Flow G edit]

    click J href "#flow-g--recovery-paths--method-management"
```

Decisions:
- ✅ Meter label is **"Recovery ready"**, not "Protected" — recovery protects against
  key **loss**, not key theft, and a single-passkey floor must not show the same
  confidence as a 2-of-3. The meter level still scales with path count/strength.

---

## Flow G — Recovery paths & method management

Lives in Settings › Account recovery (demo screens: `sr-policies`, `sr-policy-edit`).
All changes are owner-signed transactions (only the current owner can modify
configuration).

```mermaid
flowchart TD
    A["Settings › Account recovery — overview:<br/>meter + recovery paths + enrolled methods<br/>+ 'Recover an account' entry<br/>+ pending-recovery notice when active"] --> B[Add recovery path / method → Flow C]
    A --> C[Edit recovery path]
    A --> D[Remove recovery path]
    A --> E[Remove method]

    C --> C1[Builder opens with the path loaded]
    C1 --> C2[Save → owner-signed tx]

    D --> D1{"Last remaining path?"}
    D1 -- Yes --> D2["Explicit warning: account becomes<br/>UNPROTECTED. Meter drops to zero.<br/>Type-to-confirm or equivalent."]
    D1 -- No --> D3[Simple confirm]
    D2 --> D4[Remove → owner-signed tx]
    D3 --> D4

    E --> E1{"Method used by any path?"}
    E1 -- Yes --> E2["Blocked by default: list the<br/>paths that use it"]
    E2 -->|Edit those first| C
    E2 -->|Cascade-remove after warning| E3
    E1 -- No --> E3[Remove → owner-signed tx]

    click B href "#flow-c--recovery-setup"
```

Notes:
- Config changes are allowed while a recovery is pending and do not affect the
  pending request. If a recovery is pending, the management screen says so next to
  every action.
- Guardian replacement is an Edit case; the health-check alert (Flow F) and the
  post-cancel triage (Flow D2) both deep-link here as the fix path.
- "Recover an account" is reachable from this overview too, not only from the
  fresh-install welcome.

---

## Decisions log

| # | Question | Answer |
|---|---|---|
| 1 | Account creation in recovery entry | Explicit step, fast-tracked (Flow A1) + warning screen. |
| 2 | Nudge trigger + re-nudge | Modal each open + "Don't remind me again" + passive shield badge. |
| 3 | Setup modes | Three: Express, Presets (landing state), Advanced. |
| 4 | Method set v1 | All 4. Aadhaar for everyone, listed last, badged. |
| 5 | Terminology | "Account recovery" / "recovery path" / "method" / "waiting period" in UI; spec terms in prose only. |
| 6 | Honest copy for floor cases | Yes — concrete copy in Flow B. 7702 vs 4337 deferred. |
| 7 | Gas for recovery | ⚠️ **Escalated to blocker**: paymaster can't sponsor direct calls; no relayer exists (backend-zero). |
| 8 | Identify lost account | Address / ENS / gated same-install list + confirm-identity card. |
| 9 | Guardian-side UX | Hardened IPFS/IPNS page (E1 default): real payload incl. nonce, no fake expiry, blocking out-of-band step, decline branch, offline signing. |
| 10 | Proof collection state | Local persistence, resumable, switch-path exit; atomic submission. |
| 11 | Pending-recovery alert | Banner + notification + alerts opt-in at setup. Polling caveat accepted. |
| 12 | Waiting period default | 48h flat, changeable. **Confirmed also for single-method paths.** Guardrails: minimum floor + dominated-path warning. |
| 13 | Multi-account | Offer "apply same setup" with R10 constraints (fresh accountCode auto; linkability warnings). Never by default. |
| 14 | Health checks | In scope → Flow F. Meter = "Recovery ready". |
| 15 | Chain scope | One chain per policy. Ethereum focus, Sepolia demo. Multichain out of scope v1. |
| 16 | ZK Email mechanics | **Open** — blocks that method's sub-flows. |
| 17 | Passkey on new device | Platform sync + WebAuthn hybrid. |
| 18 | Guardian page wallets | Injected + WalletConnect + offline signing path. |
| 19 | After waiting period | Notify + auto-execute — intended UX; **executor unresolved** (see #7). |
| 20 | Config survives rotation? | Assume yes → makes the end-of-recovery cleanup checklist REQUIRED. |
| 21 | Express presets | Owned by ottie's persona research. |
| 22 | Mixed-method OR-groups | **Decided — assumed valid** (same as guardian OR case, PR #2 review). Encoding confirmation with kit team (T10). |
| 23 | Guardian gas (E2) | Needs sponsorship; one of E2's three blockers. |
| 24 | Multichain | Out of scope v1. |
| 25 | Fast-track onboarding | Warning screen + password + key + seed backup. Corrected copy (address never changes). |
| 26 | Express wizard shape | Guided, short, inventory step; draft/resume; alerts opt-in. |
| 27 | Verify-access | Mandatory for identity methods; guardians optional, open. Mutual guardian approval = under consideration. |
| 28 | Setup gas / batching | User pays if funded, else paymaster. Batching partially answered (thread T7: one batched UserOp — conceded, unwritten). |
| 29 | Config visibility | Structure readable; value visibility OPEN (guardian addresses natively public today); password-decrypt case stays. |
| 30 | R9 orthogonality gate | **Not now** — invariants/tech design under rework; violations allowed; revisit later. |
| 31 | Guardian mutual approval | Best-effort stands; mutual approval noted as a considered path. |
| 32 | Management flows | Mapped → Flow G. |
| 33 | User-facing name | "Account recovery". |
| 34 | Logged-in recovery entry | Settings button. Multiple accounts → choose the new owner; single account → step skipped. |
| 35 | Claim handling in the checklist | Per-method verify button (explain + submit in place). Claims survive path switching; wiped on flow exit. |

---

## Tech dependencies — route to the kit team

| Item | Blocks | Ref |
|---|---|---|
| **Funding & execution**: who pays and who executes `initiate/executeRecovery` (bypass 4337; backend-zero = no relayer) | Flow D entirely; Decision 19 | Q7/19 |
| ZK Email mechanics (user action; client vs hosted prover) | ZK Email sub-flows + verify-access | Q16 |
| Confirm the encoding for mixed-method OR-groups (assumed valid; T10 `threshold` field) | Builder + preset encoding | Q22 |
| ZK Email `accountCode` derivation per account (R10 unlinkability requirement) | Multi-account apply | — |
| Exact guardian signed payload (nonce display; add `policyId`?; expiry — define or confirm none) | Flow E1 page | — |
| Policy value visibility (guardian addresses are natively public today — can values be hidden at all?) + password-encrypted values case | Flow D entry + path display | Q29 |
| R5 conflict (atomic vs incremental); E2 needs an approval function + indexing | Flow E2 | — |
| Setup batching: write T7's one-UserOp answer into the spec | Wizard step 6 | Q28 |
| Config survival after rotation (+ `onUninstall` nonce-reset issue) | Flow D end state | Q20 |
| Same-install account history lookup, gated | Flow D identify step | Q8 |
| Enforced minimum waiting period on-chain (zero-second currently legal) | Builder guardrails | — |
