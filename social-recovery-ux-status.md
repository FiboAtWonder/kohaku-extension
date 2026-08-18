# Account recovery UX — status & handoff

> **Purpose:** the single catch-up document for this workstream. Any agent or
> teammate resuming the work reads this first. **Rule: update this file at every
> checkpoint** (wireframe commit, decisions batch, artifact republish, review round).
> Last update: 2026-08-18, after the six-front attack round.

## The surfaces (where everything lives)

| Surface | Location | Sync rule |
|---|---|---|
| **Spec (source of truth)** | `social-recovery-ux-flows.md` — flows A–G, decisions log **1–72**, display rules, persistence table, tech-deps | Everything else follows it |
| **Wireframes** | `social-wireframes.pen` — **v10, 128 screens** (commit `3e8581919`) | Edited ONLY by the Pen design agent via prompts; the driving agent writes prompts, verifies via git-JSON, commits after the user's ⌘S |
| **Notion replica** | [Social Recovery UX Draft](https://app.notion.com/p/3ba9a4c092c780a492f2d144c148762b) | Sync only on request, targeted `update_content` ops only (inline discussions must survive) |
| **Review deck** (teammates) | artifact `ca87aff0-…65e3`, source `social-recovery-ux-assets/recovery-ux-review.html` | Edit the repo file, republish with `url` param |
| **Persona demo** ("Recovery Journeys") | artifact `b822a105-…08b0f`, sources in `social-recovery-ux-assets/persona-demo/` (journeys.json + template + build-demo.py) | Re-export screens from the .pen, run `build-demo.py`, republish with `url` |
| **Team review comments** | [Persona demo review](https://app.notion.com/p/3bf9a4c092c78193aa1fdf53a705e8ed) — per-persona sections, citation format `Persona · N/M · screen-code` | Triage comments into approval rounds when they arrive |
| **Kit-team asks** | [Asks for the kit team](https://app.notion.com/p/3bf9a4c092c7818a827dce1146c7747a) | Update when a blocker resolves |

## What was built (chronology, compressed)

1. **The spec** — flow diagrams for setup (C: presets landing + guided wizard +
   advanced builder), recovery (D, chaptered), owner cancel (D2), guardian page
   (E1 sync default, E2 future), health checks (F, optional), management (G).
   Built by Q&A, hardened by a 32-item doc review and a PR review.
2. **The model decisions** — generic ANY-of groups (41): a path = required rows +
   M-of-N groups over mixed members; guardians are ordinary members; per-path
   waiting periods (48h default, 12).
3. **Wireframes v1→v10** — 128 lo-fi screens in flow bands, one review round of 82
   findings, persona-driven verification rounds, and the attack round. Conventions:
   `Page · <code>` wrappers, Component / Threshold, red design-note tokens,
   PROVISIONAL dashed treatment, no guardian names anywhere (43).
4. **The persona demo** — click-through walkthrough over real exports: 5 personas
   (Sam/Alice/Carl/Diana/Bob) × Setup + Recovery acts (Bob adds Attack), an Extras
   card (provisional + all-methods dry-run), verbatim persona docs, step deep links
   (`#persona/step`), act tabs.
5. **The meeting round** (decisions 47–57) — dry run before save, recovery-password
   step (no hint, set-once), single-method copy, synced-passkey cleanup semantics,
   guardian page relative-path-first, `.eml`-local ZK Email direction (55, retires
   the code illustration), "extension password" naming.
6. **The attack round** (2026-08-18) — six Opus 5 fronts (ease, copy, missing
   states, consistency, collisions, implementability) → 89 findings → 55 approved
   → decisions 58–72, two Pen sweeps (92 frames edited, 20 screens added).

## Key decisions (themes; the log rows 1–72 in the spec are authoritative)

- **Vocabulary:** Account recovery / recovery path / method / waiting period (5);
  forbidden in UI: policy, proof, relayer, atomic (5, 24-sweep); guardian = role,
  member = group slot, approval = the artefact (61); "extension password" vs the
  separate "recovery password" (57, 48); presets: "Your device + your guardians",
  "Guardians only" (61).
- **Structure:** ten-step wizard map (58); group counts as one unit (60); threshold
  component everywhere read-only (62); error states preserve base (63); Back on
  every step (64); chip vocabulary (59).
- **Security honesty:** honest floor copy (6), no fake expiry on approvals (9),
  cancel-is-not-resolution triage (D2), no guardian names (43), card is a non-map
  (contents decided; hint dropped), per-request dismissal (66).
- **Recovery password:** skippable step 6; set once, no change surface; wrong
  password never blocks recovery (48/56); what gets encrypted is open (53/Q29).
- **ZK Email:** local `.eml` proving, no relayer (55); code illustration retired;
  subject format / accountCode / prover stack open (Q16).

## Pending — waiting on other people

1. **Team review comments** on the demo (Notion page above). None triaged yet.
2. **Ace 0x — Q16 remainder:** subject/command format; where the accountCode lives
   without a backend (sharpest); prover stack + ~15–60s in-extension latency; DKIM
   registry choice; module timelock/expiry vs our waiting period.
3. **Kit team — four asks** (see the asks page): funding/executor (Q7/19, blocker),
   group encoding (T10), value visibility (Q29), encryption scope (53). Plus the
   new **concurrency** question (two pending recoveries?, tech-deps row M10).
4. **Nico** — Advanced builder layout input; C-10 work frozen meanwhile.

## Pending — our side, deliberately deferred

- **Attack-round deferrals** (also listed in the spec's What-persists section):
  M9 stale-local-state family (re-read on resume, draft-out-of-date states),
  M13 attack-during-triage band, M16 guardian changed-mind block on E1-05,
  M23 alerts-honesty rewrite (C-08/D-13), M34 DKIM-rotation failure split.
- **Milestone split B1/B2/B3** — deferred until the UX is final; then tag every
  flow/screen and align with Ace 0x.
- **Provisional screens' fate** (C-05i optional guardian test, C-06d recheck strip)
  — keep or remove after the team reviews the demo's Extras card.
- **E1-04 mobile variant** — accepted as missing for now.
- **Demo extras** offered, not requested: Daniel/Aadhaar journey, health-check
  maintenance act.

## Decisions still to make (blocked or unowned)

- Funding/executor model (Q7/19) — blocks final Flow D copy and D-13b's real shape.
- Encryption scope (53) + value visibility (Q29) — blocks final password-step copy,
  D-06 family predicate, accountCode storage.
- Concurrency rule (one pending recovery per account?) — blocks the pending-band copy.
- Q16 remainder — blocks the final C-05e/D-07e polish.
- Whether the provisional screens ship (see above).

## Working agreements (how to continue without breaking things)

- **Loop:** driving agent writes Pen prompts → user runs the Pen agent → user
  presses ⌘S (verify the file actually changed — a save can predate the edits) →
  verify via git-JSON per-screen signatures (`git show <rev>:social-wireframes.pen`,
  never app exports of copies) → commit → sync spec/Notion/deck/demo as needed.
- **Reviews:** multi-agent fronts → merged dedup list → per-item user approval →
  split into doc round + Pen prompts. Nothing applies without approval.
- **Known baseline:** the clipping scan must report exactly ONE issue
  (D2-01 "Action · Receive", accepted). Anything else is a regression.
- **Scratchpads get wiped**; every artifact source lives in the repo. If something
  is lost anyway, replay the Write/Edit history from the session transcripts in
  `~/.claude/projects/-Users-fiboape-repos-internal-kohaku-kohaku-extension/`.
