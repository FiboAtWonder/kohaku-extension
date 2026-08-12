# Social Recovery — UX Flow Diagrams (working doc)

> Working document. Owner: Fibo. Status: **draft, in construction**.
> Sources: social-recovery prototype HTML (demo), Notion "Personas" page (Alice → Sam),
> Design Rationales R1–R13 (policy model: OR-of-AND clauses, per-clause timelock).
>
> Framing: the social recovery initiative is a **general-purpose improvement for the
> ecosystem**. This extension is the demo/reference app that shows what can be done.
> These flows are therefore **reference UX**, not app-only decisions.
> This document will live as a **sibling to the Notion pages** (personas, rationales).
>
> Naming (decided): the user-facing label is **"Account recovery"** everywhere in the
> UI. "Social Recovery (Kit)" stays as the internal/tech name only.
>
> Context: the UX lives under **Settings › Account recovery**. The recovery module is
> ERC-7579, on a 4337 smart account or a 7702-upgraded EOA. 7702 vs 4337 copy
> differences: deferred. Chain scope: **one chain per policy**; demo runs on
> **Sepolia**; focus is Ethereum. **Multichain: out of scope for v1** (decided) —
> note for integrators: rotation happens on one chain; the same address on other
> chains stays locked.

---

## Flow A — Extension first open (entry points)

Fresh install. The user sees three options.

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
```

### Flow A1 — Fast-track onboarding (recovery-focused)

```mermaid
flowchart TD
    A["'Recover an account' clicked"] --> B[Set extension password]
    B --> C["New key generated — recovery-focused copy"]
    C --> D["Seed backup ceremony (kept, short)"]
    D --> E[→ Flow D]
```

Decisions:
- ✅ Fast-track = **extension password + key creation + seed backup**. Nothing else.
- ✅ Seed backup is not deferred. It stays in the fast-track.
- Draft copy at key creation: "This is your new key. Your lost account will move to it."

---

## Flow B — Recovery-methods check + nudge

```mermaid
flowchart TD
    A[Account exists / dashboard] --> B{"Account has recovery
    methods / policies?"}
    B -- Yes --> C[End. No action.]
    B -- No --> D["Modal:
    'You have no recovery method yet.
    Protect your account.'
    + honesty note for floor cases"]
    D -->|Set up recovery| G[Settings › Account recovery → Flow C]
    D -->|Dismiss| F[Shows again next open]
    F --> A
    D -->|☑ Don't remind me again| H["Passive 'unprotected' shield badge
    (persistent, silent)"]
    H -. click .-> G
```

Decisions:
- ✅ Trigger: on **each dashboard open** until the user acts or opts out.
- ✅ Permanent dismiss keeps a **passive shield badge** as re-entry point.
- ✅ Copy honesty (floor cases like single-passkey): yes, as a note.

---

## Flow C — Policy setup

Building blocks:
- **Methods:** passkey, guardians (people's wallets, EOA or SCW), ZK Email, Anon Aadhaar.
- **Policies:** OR of AND clauses. Each clause has its own timelock.
- **Internal OR inside one policy is supported and can MIX method types** (decided):
  `Passkey (required) AND [signature of A OR B]` and also
  `passkey AND [zk_email OR aadhaar]` are single policies.
  ⚠️ Encoding note for tech: mixed-type OR-groups exceed the guardian-threshold
  mechanism (R11) — needs clause expansion or a native group encoding. Confirm with
  the kit team which one the contracts use; the UI can present groups either way.

### Three setup modes (decided)

| Mode | For | Shape |
|---|---|---|
| **Express** | Least technical (Diana, Sam, Carl) | Short guided wizard. Per-step education, minimal UI. |
| **Presets** | Middle ground | Pre-defined policies already in place; the user removes/edits what they don't want. |
| **Advanced** | Alice, Bob | Free policy builder (grouped condition builder). |

**Entry pattern (decided):** no three-way fork screen. The setup tab **lands directly
on the Presets state** — starter policies visible and removable. Two actions on top:
**"Guide me"** → Express wizard, **"Customize"** → Advanced builder.

**Starter presets (decided): two policies shown by default**, 48h timelock each:
1. `passkey AND [guardians threshold group]` — recovery path: your device + your people.
2. `passkey AND zk_email` — recovery path: your device + your email.

Note: both presets require enrollment before they become active — the cards start in a
"needs setup" state and deep-link into the per-method enrollment steps.

### Express wizard — draft step list

```mermaid
flowchart TD
    A[Express start] --> B["1 · How recovery works —
    one screen, three bullets"]
    B --> C["2 · Inventory: what do you have?
    ☐ another device (passkey-capable)
    ☐ trusted contacts with wallets
    ☐ long-lived email
    ☐ Aadhaar ID (last, badged)"]
    C --> D["3 · Recommended preset shown as
    recovery-path cards
    (presets from ottie's persona research)"]
    D --> E["4 · Enroll each method:
    one short explainer + 'Learn more' +
    ✅ VERIFY-ACCESS test (local, no chain)"]
    E --> F["5 · Timelock review — 48h default,
    changeable"]
    F --> G["6 · Review → submit config
    (batching: one tx? → Q28)"]
    G --> H["7 · Recovery Card download
    (address + methods + how-to-recover tutorial)"]
    H --> I["8 · Offer: apply to other accounts
    (never by default)"]
```

### Verify-access at enrollment (decided this round)

Every **non-guardian** method gets a local proof test at enrollment, before the config
is saved. No blockchain interaction. **Decided: MANDATORY for the identity methods**
(passkey, ZK Email, Aadhaar) — a failing test blocks the save, because it means the
enrollment data is wrong. Guardians stay best-effort. Rationale: a recovery method
that never worked is discovered exactly when it is too late. Reuses the health-check
machinery (Flow F):

| Method | Verify-access test |
|---|---|
| Passkey | Sign a test challenge right after creation. Instant. |
| ZK Email | Generate a full test proof locally. ⚠️ Depends on Q16 (mechanics). Proof generation may take time → progress UI; it doubles as a dry run. |
| Anon Aadhaar | Test proof against the current UIDAI key. |
| Guardians | Best effort only: address checksum / ENS resolution / "is a contract?" check. A real signature test needs the guardian to act — offer it as optional. |

Other decisions:
- ✅ All 4 methods in v1. Aadhaar for everyone, listed last, badged "Requires Aadhaar ID (India)".
- ✅ Structure UI: grouped condition builder — clause card = "recovery path", required
  rows + OR-group rows with threshold selector (Safe-style). "Any one path recovers
  your account."
- ✅ Timelock default 48h per clause, changeable.
- ✅ Multi-account: offer "apply this setup to your other accounts", never by default.
- ✅ Recovery Card at the end of setup.
- ✅ Express presets and the preset mode's contents come from **ottie's persona research**.

### UI pattern references (solved problem)

Grouped condition builder with "ALL of / ANY of" headers: Notion/Airtable advanced
filters, Apple Smart Playlists, Zapier paths, Stripe Radar, `react-querybuilder`.
Threshold selector inside a group: Safe's "M out of N owners" row.

---

## Flow D — Recover an account

Precondition (Flow A1): fresh key exists. **Assumption: gas paid by relayer/paymaster
— for the recoverer AND for guardian approvals if E2 ever ships. ⚠️ Pain point if untrue.**

```mermaid
flowchart TD
    A[Entry: Recover an account] --> B{Identify the lost account}
    B -->|Paste address| C[Fetch recovery config on-chain]
    B -->|ENS name| C
    B -->|"Same-install history:
    pick a previously used account
    🔒 gated by passkey or password
    (pending tech feasibility)"| C
    C --> E{Account has policies?}
    E -- No --> X["Dead end: account not recoverable.
    Explain why, link to docs."]
    E -- Yes --> F["Show policies as recovery paths.
    User picks the path they can satisfy."]
    F --> G["Proof-collection checklist.
    Local state persisted in extension storage."]
    G --> G1[Guardian signatures → Flow E1]
    G --> G2["ZK Email proof (mechanics TBD — Q16)"]
    G --> G3["Passkey assertion — platform sync +
    WebAuthn hybrid QR to phone"]
    G --> G4[Anon Aadhaar proof]
    G1 --> H{Clause satisfied?}
    G2 --> H
    G3 --> H
    G4 --> H
    H -- No --> G
    H -- Yes --> I["Recovery TRIGGER — one person,
    one atomic tx via relayer"]
    I --> J["Timelock wait (clause's timelock,
    default 48h). Countdown screen."]
    J --> K["Timelock ends → user is NOTIFIED
    + relayer AUTO-EXECUTES"]
    K --> L["Key rotated → account active.
    End screen: review-setup nudge"]
```

Decisions:
- ✅ Identify by pasted address or ENS. ⚠️ Hurts the least technical personas —
  mitigated by the Recovery Card and the same-install gated list.
- ✅ Pending-proof state lives locally. Atomic submission (matches R5). E1 is the
  default guardian path.
- ✅ Timelock end: notify + relayer auto-executes.
- ✅ Assume the recovery config survives rotation (Q20 open to confirm).

## Flow D2 — Cancel side (original owner's device)

```mermaid
flowchart TD
    A[Recovery initiated on-chain] --> B[Wallet detects pending recovery]
    B --> C[Persistent banner on dashboard]
    B --> D[System notification]
    C --> E{Owner action}
    D --> E
    E -->|It's me| F[Dismiss banner]
    E -->|NOT me| G["Cancel recovery —
    owner-signed transaction"]
```

Decisions:
- ✅ Banner + notification. Polling limitation = accepted caveat for now.

---

## Flow E — Guardian approval

**E1 (sync) is the default for v1** (decided). E2 (async) stays mapped as the desired
future improvement — pending the R5 conflict resolution and guardian gas sponsorship.

### Flow E1 — Sync (off-chain signature passing) — DEFAULT

```mermaid
flowchart TD
    A["Recoverer shares link/QR
    with the guardian (any channel)"] --> B["Guardian opens IPFS/IPNS-mounted
    page (immutable). Recovery params
    arrive via URL params."]
    B --> C["Page shows clearly WHAT is signed:
    account, new owner, expiry."]
    C --> D["Guardian connects wallet —
    injected AND WalletConnect"]
    D --> E[Signs EIP-712 recovery message]
    E --> F["Page outputs the signature as a
    SINGLE-LINE copyable blob, pre-wrapped
    in backticks for messaging apps"]
    F --> G[Guardian sends it to the recoverer]
    G --> H["Recoverer pastes it into the Flow D checklist"]
```

### Flow E2 — Async (on-chain approval) — FUTURE

```mermaid
flowchart TD
    A[Recoverer shares link/QR] --> B[Guardian opens the same page]
    B --> C[Page shows WHAT is approved]
    C --> D[Guardian connects wallet]
    D --> E["Guardian SUBMITS approval on-chain.
    Requires guardian gas sponsorship
    (pushback accepted — blocker for default)"]
    E --> F["Recoverer's checklist polls it —
    no message back needed"]
    F --> G[Recoverer triggers recovery — one tx]
```

Notes:
- ⚠️ R5 conflict (async = incremental submission, rejected by R5, described by the hub)
  — raise with the kit team. Product input: E2 improves UX but E1 ships first.

---

## Flow F — Health checks (in scope)

Same machinery as the verify-access tests in Flow C, run over time.

```mermaid
flowchart TD
    A["Trigger: opening the Account recovery tab
    + periodic background check"] --> B[Run per enrolled method]
    B --> C["Passkey: sign a test challenge
    (no transaction)"]
    B --> D["ZK Email: test proof against
    live DKIM registry"]
    B --> E["Guardians: no on-chain check —
    prompt periodic self-audit /
    ping guardian reachability"]
    B --> F["Aadhaar: proof against current UIDAI key"]
    C --> G{"All pass?"}
    D --> G
    E -. best effort .-> G
    F --> G
    G -- Yes --> H[Meter: Protected]
    G -- No --> I["Alert + per-method fix path
    (re-enroll, replace guardian, …)"]
    I --> J[→ Flow G edit]
```

---

## Flow G — Policy & method management

Lives in the same Settings › Account recovery tab (demo screens: `sr-policies`,
`sr-policy-edit`). All changes are owner-signed transactions (R3: only the current
owner can modify configuration).

```mermaid
flowchart TD
    A["Settings › Account recovery — overview:
    protection meter + policies list +
    enrolled methods list"] --> B[Add policy / add method → Flow C]
    A --> C[Edit policy]
    A --> D[Delete policy]
    A --> E[Remove method]

    C --> C1[Builder opens with the policy loaded]
    C1 --> C2[Save → owner-signed tx]

    D --> D1{Last remaining policy?}
    D1 -- Yes --> D2["Explicit warning: account becomes
    UNPROTECTED. Meter drops to zero.
    Type-to-confirm or equivalent."]
    D1 -- No --> D3[Simple confirm]
    D2 --> D4[Delete → owner-signed tx]
    D3 --> D4

    E --> E1{"Method used by any policy?"}
    E1 -- Yes --> E2["Blocked by default: list the
    policies that use it"]
    E2 -->|Edit those first| C
    E2 -->|Cascade-remove after warning| E3
    E1 -- No --> E3[Remove → owner-signed tx]
```

Notes:
- R3 rule surfaced in UX: config changes are allowed **while a recovery is pending**,
  but they do **not** affect the pending request. If a recovery is pending, the
  management screen must say so next to every action.
- Guardian replacement (Alice's paper-key rotation, Carl's "Sara lost her keys") is an
  Edit-policy case; the health-check alert (Flow F) deep-links here as the fix path.

---

## Decisions log

| # | Question | Answer |
|---|---|---|
| 1 | Account creation in recovery entry | Explicit step, fast-tracked (Flow A1). |
| 2 | Nudge trigger + re-nudge | Modal each open + "Don't remind me again" + passive shield badge. |
| 3 | Setup modes | **Three**: Express wizard, Presets (pre-defined, removable), Advanced builder. |
| 4 | Method set v1 | All 4. Aadhaar for everyone, listed last, badged. |
| 5 | Terminology | AND/OR via group-builder pattern ("recovery paths"). |
| 6 | Honest copy for floor cases | Yes, as a note. 7702 vs 4337 deferred. |
| 7 | Gas for recovery | Assume relayer/paymaster. ⚠️ Pain point if untrue. |
| 8 | Identify lost account | Address or ENS; optional gated same-install list (tech check pending). |
| 9 | Guardian-side UX | IPFS/IPNS page. **E1 sync = default**; E2 async = future. |
| 10 | Proof collection state | Local persistence, atomic submission. |
| 11 | Pending-recovery alert | Banner + notification. Polling caveat accepted. |
| 12 | Timelock default | 48h flat, user-changeable. |
| 13 | Multi-account | Offer "apply same setup", never by default. |
| 14 | Health checks | In scope → Flow F. |
| 15 | Chain scope | One chain per policy. Ethereum focus, demo on Sepolia. |
| 16 | ZK Email mechanics | **Open** — blocks G2 sub-flow + verify-access design. |
| 17 | Passkey on new device | Platform sync + WebAuthn hybrid, like any passkey. |
| 18 | Guardian page wallets | Injected + WalletConnect. |
| 19 | After timelock | Notify + relayer auto-executes. |
| 20 | Config survives rotation? | Assume yes; open to confirm. |
| 21 | Express presets | Owned by ottie's persona research. |
| 22 | OR-group scope | **Mixed method types allowed** in one OR-group. Encoding to confirm with kit team. |
| 23 | Guardian gas (E2) | Needs sponsorship; blocker → E1 default. |
| 24 | Multichain | **Out of scope v1.** Integrator note kept in header. |
| 25 | Fast-track onboarding | Extension password + key + **seed backup kept**. |
| 26 | Express wizard shape | Short guided flow with inventory step; + Presets as third mode. |
| 27 | Verify-access at enrollment | **Yes** — local proof test per non-guardian method; best-effort for guardians. |

| 28 | Setup gas | User pays if funded; paymaster if not. ⚠️ Keep open: batching methods+policies into ONE confirmation is unconfirmed. |
| 29 | Verify-access enforcement | **Mandatory** for identity methods (block save on failure). Guardians best-effort. |
| 30 | Starter presets | Two: `passkey + guardians`, `passkey + zk_email`. Landing = Presets state, "Guide me" / "Customize" on top. |
| 31 | ZK Email mechanics | Still unknown — external dependency. Blocks the ZK Email sub-flows. |

---

## Tech dependencies — route to the kit team

Open items this document cannot resolve alone:

| Item | Blocks | Ref |
|---|---|---|
| ZK Email mechanics (what the user does; client vs hosted prover) | Enrollment, verify-access, and recovery sub-flows for ZK Email | Q16/31 |
| Mixed-type OR-group encoding (clause expansion vs native group) | Advanced builder UI + preset encoding | Q22 |
| R5 conflict: atomic vs incremental submission (hub vs Design Rationales) | Flow E2 (async guardians) viability | Flow E |
| Setup batching: methods + policies in one tx / one confirmation | Wizard step 6 | Q28 |
| Recovery config survival after rotation | Flow D end state | Q20 |
| Same-install account history lookup, gated by passkey/password | Flow D identify step | Q8 |
| Relayer/paymaster coverage (recoverer txs; guardian approvals if E2) | Flow D, E2 | Q7/23 |

| 32 | Policy management flows | Mapped now → Flow G. |
| 33 | User-facing name | **"Account recovery"** in all UI copy. "Social Recovery Kit" = internal/tech name. |
