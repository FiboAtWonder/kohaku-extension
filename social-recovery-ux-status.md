# Account recovery UX — status & handoff

> **Purpose:** the single catch-up document for this workstream. Any agent or
> teammate resuming the work reads this first. **Rule: update this file at every
> checkpoint** (wireframe commit, decisions batch, artifact republish, review round).
> Last update: 2026-08-18, after wireframes **v11 was verified and committed**
> (`59944b2fa`). Spec + Notion are synced. Remaining: a step-label micro-fix,
> then the demo + deck republish — see "Round in flight" below.

## The surfaces (where everything lives)

| Surface | Location | Sync rule |
|---|---|---|
| **Spec (source of truth)** | `social-recovery-ux-flows.md` — flows A–G, decisions log **1–78**, display rules, persistence table, tech-deps | Everything else follows it |
| **Wireframes** | `social-wireframes.pen` — **v11, 154 `Page ·` wrappers = 126 active + 28 in `Flow · OUTDATED`** (commit `59944b2fa`) | Edited ONLY by the Pen design agent via prompts; the driving agent writes prompts, verifies via git-JSON, commits after the user's ⌘S |
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
7. **The single-path model change** (2026-08-18, decisions 73–78) — team decision:
   ONE recovery path per account (no OR-of-paths). Path = required rows AND ANY-of
   groups; wizard builds at most one group, multiple groups are Advanced-only;
   instance uniqueness; one waiting period, 24h contract floor (48h UI default);
   ZK Email becomes receive-and-upload via an external send-only relayer + a
   "How to get the .eml" help sheet (Gmail/Outlook web/Apple Mail/Yahoo/Proton);
   4337 focus (7702 deferred, record-only). Persona remap approved: Sam = passkey
   only · Alice = [3/5] guardians · Carl = passkey AND Sara (both required) ·
   Diana = [1/2](passkey, zk email) · Bob = [2/3](passkey, guardian, zk email) via
   Advanced.

## Round in flight (single-path model)

Done: spec (`4b1232964`) · Notion sync · Pen round, verified (git-JSON: 28 moves,
25 rebuilds + C-05n, 95 content edits + property-only sweeps confirmed by
full-JSON hash) · committed as v11 (`59944b2fa`). Still to do:
1. Pen MICRO-FIX: step labels on the 9 rebuilt wizard frames (see next note).
2. Verify + commit the micro-fix (v11.1).
3. Demo: re-export active screens, remap journeys.json to the one-path personas,
   rebuild, republish artifact `b822a105…`.
4. Deck `ca87aff0…`: update the model sections + republish.

### Pen round — what landed (2026-08-18)

**Part 1 — the OUTDATED band.** New root band
`Flow · OUTDATED · MULTI-PATH MODEL (superseded 2026-08-18)` at `x=0, y=13546`
(Flow G's bottom edge + a 260px gutter), same anatomy as the other bands. The 28
invalidated `Page ·` wrappers moved into its Screens row in the given order:
C-01, C-04, C-04b, C-04e, C-05e, C-05k, C-06b, C-07, C-07g, C-07k, C-10, C-10b,
C-10c, C-10d, C-10e, C-10f, D-04, D-06, D-06b, D-06e, D-06f, D-07d, D-07e, G-01,
G-01b, G-01c, G-02b, G-03.

> **Convention change vs. the earlier plan:** the moved frames were **not** renamed
> to `<code>-old` (decision 67 — never rename existing frames). Instead each moved
> wrapper's caption **description** is prefixed `OUTDATED · `. Frame names and codes
> are untouched, so old review notes still resolve.

C-06b (dominated-path warning), D-07d (switch-path confirm) and G-02b (simple
remove confirm) got **no replacement** — those concepts died with the model.

**Part 2 — 25 rebuilds + 1 new screen**, each in a fresh `Page · <code>` wrapper
sorted back into its original band's Screens row by code. New short-names keep the
code prefix:

| Code | New frame short-name |
|---|---|
| C-01 | `C-01-choose-your-recovery-path-presets` |
| C-04 | `C-04-recommended-path-single` |
| C-04b | `C-04b-recommended-path-either-one` |
| C-04e | `C-04e-adjust-your-path-single` |
| C-05e | `C-05e-verify-your-email-receive-upload` |
| C-05k | `C-05k-email-check-failed-eml` |
| **C-05n (new)** | `C-05n-how-to-get-the-eml-sheet` |
| C-07 | `C-07-review-and-confirm-single` |
| C-07g | `C-07g-review-either-one-works` |
| C-07k | `C-07k-dry-run-either-one-works` |
| C-10 | `C-10-advanced-builder-single-path` |
| C-10b | `C-10b-add-member-instance-uniqueness` |
| C-10c | `C-10c-advanced-builder-saved-single` |
| C-10d | `C-10d-add-member-optional-test` |
| C-10e | `C-10e-add-method-to-library-single` |
| C-10f | `C-10f-advanced-builder-first-run` |
| D-04 | `D-04-confirm-identity-single-path` |
| D-06 | `D-06-your-recovery-path-readout` |
| D-06b | `D-06b-path-one-member-unavailable` |
| D-06e | `D-06e-wrong-recovery-password-single` |
| D-06f | `D-06f-your-recovery-path-values-visible` |
| D-07e | `D-07e-verify-with-your-email-eml` |
| G-01 | `G-01-management-overview-single-path` |
| G-01b | `G-01b-cleanup-deferred-single` |
| G-01c | `G-01c-triage-deferred-single` |
| G-03 | `G-03-member-still-needed-in-place` |

C-05n is a plain full-screen help sheet (five client rows: Gmail, Outlook web,
Apple Mail, Yahoo, Proton) placed after C-05l; it is opened from both C-05e and
D-07e.

**Part 3 — the copy sweep.** ~125 text nodes edited in place across bands A, B, C,
D, D2, F and G (E1 untouched, as specified). Every plural/multi-path implication is
gone; the residual regex hits are all the intended new copy ("there is no other
path"). Structural plural artefacts that copy alone could not remove were
**disabled** (`enabled: false`) rather than deleted, so they are one flag away from
returning: the second path card + OR divider + "Add a recovery path" button on
G-02, G-03b, G-04 and D2-03; the second per-path waiting-period card on C-06; the
"Add another recovery path" and "Customize instead" buttons on C-04c; the
"Your other recovery path" row on G-05b; and the **11 "Switch path exit" footers**
across the D-07 family and D-08.

Notable non-mechanical parts of the sweep:
- **C-06 / C-06c**: collapsed to ONE account-level waiting period, chips are now
  24h / 48h / 72h / 7 days (the old `Custom…` chip became `7 days`), a
  "The minimum waiting period is 24 hours." line sits under the chips, and a red
  note records the on-chain floor (decision 74).
- **C-07b**: base content **rebuilt** to the new C-07 review anatomy, keeping the
  save-failure card above the review blocks (decision 63).
- **D-05b**: retitled to "Path can't be satisfied" — the copy is now
  "You can't complete this recovery path right now. There is no other path." plus a
  WHAT TO TRY panel (contact the guardians, find the device). Dead-end anatomy kept.
- **G-02**: action is "Remove recovery"; the type-to-confirm modal reads
  "This removes your recovery path. The account becomes UNPROTECTED."
- **G-05**: titled "Edit your recovery path" and carries a new note that the member
  picker disables duplicates (decision 76).

**Clipping baseline holds:** the scan reports exactly one enabled issue,
D2-01 "Action · Receive" (accepted).

### Step-label micro-fix (resolved — decision 58 stands, no renumbering)

The rebuild prompt wrongly specified a 9-step map, so 9 rebuilt frames read
`OF 9` (C-04, C-04b, C-04e, C-05e, C-05k, C-07, C-07b, C-07g, C-07k) while the
37 copy-swept wizard frames correctly read `OF 10`. **Nothing in the single-path
model drops a wizard step — the ten-step map of decision 58 is unchanged**
("OF 9" exists only for single-account wallets skipping step 10). Fix = sweep the
9 frames to `OF 10` with the decision-58 step numbers: step 3 (C-04/C-04b/C-04e),
step 4 (C-05e/C-05k), step 7 (C-07k dry run), step 8 (C-07/C-07b/C-07g), and give
each indicator ten dots.

## Key decisions (themes; the log rows 1–78 in the spec are authoritative)

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
- **ZK Email:** receive-and-upload (77) — the user asks for the email, receives it
  at the enrolled address, downloads the original `.eml` and uploads it; the proof
  is computed locally (55). The word "relayer" never appears in UI copy. Code
  illustration retired; subject format / accountCode / prover stack open (Q16).

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
