# Kit-team asks — Account recovery

> **Status: v1 (2026-08-25).** Companion to `social-recovery-sdk-requirements.md`: the things we need the kit team (SDK + contracts, `defi-wonderland/mast-social-recovery`) to guarantee, plus our settled positions on their open questions. One row per ask; an ask leaves this file when their spec answers it. Ids continue the reconciliation report's REC-nn scheme. Fibo delivers our current docs to them himself (REC-15).

## 1 · Asks — things their spec must guarantee

| ID | Ask | Why it blocks us |
|---|---|---|
| **REC-16** | **The attempt-opened event must carry the handover, the waiting period, and the finalize deadline in the clear.** | The wait now lives inside the setup commitment (their I-16) and the `SetupCommitted` event no longer carries it. Without these fields on the attempt event, D-13's countdown, the D2 owner banner, G-01's card, and any watcher alert have NO chain source at the hidden privacy levels — every timer surface we drew is unbuildable. Their own R-16 round defers exactly this question, so the window is open. Also covers naming who is recovering (D2-01/B-03 need the handover in the clear). |
| **REC-19** | **Define `slot`: within a clause, is it the clause index or the credential index?** (`design.md:172` — "which place in the rule this fills" — is ambiguous.) | The guardian payload spec and the D-07 checklist copy are held until answered. *Pending Fibo's confirmation before sending.* |
| **REC-24** | **A privacy level that publishes the structure but encrypts the values.** Their dial is three-way — `encrypt(password_key, config) | config | empty` — all-hidden, all-public, or nothing. Our default level "Hide the details" (shape readable, values hidden) has no counterpart. Either they add the level or we re-scope our default. | *Pending Fibo's confirmation of the level mapping (REC-1 clarification).* |
| **REC-20** | **The 7579 recovery adapter for the demo's bare-bones 4337 account is a kit-team deliverable** (SDK or contracts side — ruled by Fibo, 2026-08-25). Their spec still scopes "the Ambire fork the demo integrates" as the one adapter owed, and their Q-19 still assumes an Ambire-fork account — that premise is stale: our A5 moved the demo substrate on 2026-08-20. Adapters ship immutable (their Q-2), so it must be right first time. | The extension ships no Solidity; without this the whole setup flow has no module to install. |

## 2 · Our positions on their open questions — settled, ready to communicate

| Their item | Our position |
|---|---|
| **Q-4 (wait default)** | **48h stays our UI default** (Fibo, 2026-08-25 — REC-2), against their "safe span of days" lean. No floor anywhere is agreed (their I-7). For their rule-width/gas bound: zkPassport measures ~0.93–1.0M gas per verification on our numbers — two in one submission approach 2M. |
| **Q-7 / tiering (method weight)** | **Our UX presets take precedence over their primary/secondary weighting** (Fibo, 2026-08-25 — REC-3, decision 94). Preset 2 (`passkey AND zkPassport`, both required) stays. Method set stays passkey + guardians + Anon Aadhaar + zkPassport; we assume Aadhaar works (SDK A2) — REC-4/REC-14. |
| **Q-8 (guardian page ownership half)** | **Decision 51 is settled**: the guardian approval page is extension-built and extension-served over exactly two SDK calls (`buildApprovalPayload`, `parseApproval`); the payload formats are the SDK's. Their own Q-8 edits now put the page on the integrator — this should land without a fight (REC-21). |
| **Q-12 (helper identity in calldata)** | Answered with disclosure copy in our spec (REC-17, decision 96): the E1 page, the D-07 manual row, C-05 enrollment, and C-07 all disclose that submission publishes each used credential — an approving guardian's address becomes permanently public. |
| **Q-14 (single-key ending)** | We prefer a guided "set up recovery again" follow-on (V1, decision 96 / REC-39) over an atomic contract feature. Keep resignation out of MVP but not encoded shut. |

## 3 · Held pending internal clarification

- **REC-18 — the Q-8 disclosure-ownership answer**: rendering is ours; trust-root declarations, tiers, and method metadata must arrive as SDK **data**; we reject "a conformance requirement the SDK checks" and any SDK verdict on the holder's rule quality (our A6). Their side hardened — the `sdk` is now a named module inside their invariant system (I-5, I-16) — so the line to hold is: SDK checks on its own inputs are fine, SDK judgments about rule quality are not. *Awaiting Fibo's go after the clarification.*
- **REC-35 — the seven Q-8 setup disclosures** (which we adopt, and at what milestone). *Awaiting Fibo's ruling after the clarification.*
