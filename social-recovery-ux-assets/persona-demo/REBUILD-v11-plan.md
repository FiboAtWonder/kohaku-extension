# Demo rebuild v11 — one-pass plan (prepared 2026-08-25, blocked on the Pencil MCP bridge)

> Wireframes v15 (`a20ea068e`) changed 22 screens and added 4. Only the items below affect the demo. All prep below was verified against the current `.pen` JSON; the ONLY missing inputs are live `ctx.bounds` measurements and the exports — both need a working Pencil MCP bridge. Deck is OUT of scope (Fibo, 2026-08-25).

## 1 · journeys.json → v11

**Sizes stale (4):** `C-06e-recovery-password` 830→900 · `D-11-confirm-start-recovery` 800→860 · `D-15-recovery-done-cleanup` 925→990 · `D2-01-pending-recovery-banner-and-alert` 800→1000. All other 75 sizes match; all 79 journey screens resolve to unique ACTIVE frames; no renames hit the demo.

**Hotspots to re-measure live (15 rects, current values listed):**
- `C-08-recovery-card-and-alerts` — sam[12] "Enable notifications" [928.75, 306, 127, 16]
- `D-02b-identify-account-fresh-install` — sam[18], alice[14], carl[14], diana[17] "Look up this account" [52, 669, 142, 17]
- `D-11-confirm-start-recovery` — sam[21], alice[24], carl[22], diana[21], bob[17] "Start recovery" [340, 718, 99, 17]
- `C-06e-recovery-password` — alice[4], carl[4], diana[7] "Hide the details" [409.8, 717, 100, 16]
- `C-05c-enroll-guardians` — carl[3] "Save and continue" [340, 618, 127, 17]
- `D-06-your-recovery-path-readout` — carl[16] "Start collecting approvals" [340, 720, 176, 17]
- `D-07-checklist-pending` — carl[18] "Ask a guardian" [766, 281.5, 88, 15]
- `C-06-waiting-period` — diana[6] "Continue" [340, 491, 63, 17]
- `D-02-identify-account` — bob[8] "Look up this account" [340, 669, 142, 17]
- `D-15-recovery-done-cleanup` — bob[19] "Do this later" [588, 637, 79, 16]
- `D2-01-pending-recovery-banner-and-alert` — bob[21] "It wasn't me — cancel it" [176, 260.5, 145, 15] (device: popup)

**Story/spec-note edits (no bridge needed, drawn copy verified from JSON):** C-06e steps mention Confirm password + the three per-level reveal lines + no Skip; C-08 card steps mention the printed `Recovery password ••••-••••-••••`; D2-01 (Bob's attack act) mentions the waiting-period-ended banner state, "editing the setup or uninstalling the module also cancels", and the V1 counter-proof line. E1-02/E1-03 are NOT in the demo — no E1 story edit.

**New screens → the Extras card, all four** (`D-04e-recovery-already-running`, `D-07m-approvals-void`, `D-07n-approval-expired`, `D-01b-move-your-assets`, each 1280×800, one-line description each). NOT Bob's attack act: `build-demo.py` collects screens from `personas[].steps` only, Extras is a real persona card, and the two contradiction states would break Bob's linear "the design held" arc.

**Non-journey edited screens (no journeys.json impact):** C-05d, C-07, C-07b, C-08b, D-06f, D-11b, E1-02, E1-03, G-02, G-05b.

## 2 · Export (after the bridge is back)

**83 device frames** = the 79 current journey screens (full re-export, as v10 did) + the 4 new ones. Resolve node ids LIVE by frame name (saved-file ids are stale). `Export()` treats outputPath as a directory and writes `<nodeId>.webp` — rename each to `<frameName>.webp`, which `build-demo.py --screens` requires. Expected final count: 83.

## 3 · Build + publish

Run `build-demo.py`; expected 83 screens. Publish the built HTML to the EXISTING artifact `https://claude.ai/code/artifact/b822a105-6dc4-48c7-8ef4-15bcd3f08b0f` (pass it as `url`), label `reconciliation-v15`.

## The blocker

The Pen app restarted (~15:57) AFTER this session's Pencil MCP bridge connected (~13:48); the stdio bridge holds a dead handle: `failed to connect to running Pencil app: desktop … transport not connected`. A subagent cannot respawn MCP servers. Fix: reconnect the `pencil` MCP server (restart the Claude Code session, or `/mcp` from an interactive terminal). Three stale `claudeCodeCLI` bridge processes were seen lingering (PIDs 20329, 59672, 62862) — kill them first if the reconnect misbehaves. The app itself is fine: document open at the right path, `isDirty: false`.
