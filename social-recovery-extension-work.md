# Kohaku extension — Account-recovery work items

> **Status: v1 (2026-08-20).** Extension-side changes needed to host the Account-recovery feature — split out of `social-recovery-sdk-requirements.md` per Fibo's PR #2 review ("SDK requirements and extension changes stay separate"). The SDK prepares; the extension signs, broadcasts, stores, and renders (assumption A5 there). Milestone tags per spec decision 79. File paths refer to the 2026-08-19 investigation.

## MVP

1. **Smart-account enablement path.** Wire the account-creation/upgrade route the funding ruling picks (Ambire privileges vs 7702 delegate vs 4337 module account) into onboarding and Flow C step 8, so `prepareSetup`'s batch lands as ONE confirmation. Includes a proper fix for the `CALL_TO_SELF` validation rejection of `setAddrPrivilege` self-calls (today bypassed by selector on a fork branch — `signAccountOp.ts:350`).
2. **Fresh-key broadcast rail.** Sign + broadcast the SDK's PreparedTx from a new key with gas estimation and self-pay. Nothing usable exists: `KeystoreSigner.sendTransaction` is uncalled and provider-less, and every current broadcast path requires a registered `Account` + `AccountOp`. Needed for the permissionless initiate/execute (D-11, D-13b).
3. **Proving host.** Long proofs cannot run in the MV3 service worker. Add the `offscreen` permission (or a dedicated extension page), plus COOP/COEP manifest keys for multithreaded WASM. Serialize WASM behind a lock (Railgun lesson, `railgunV2.ts:130`).
4. **Passkey ceremonies in a full tab.** The action popup dies on focus loss and `create()` is focus-checked — a QR hand-off kills it. Run all WebAuthn in a tab/options page (works since Chrome 122; RP ID = the extension id). **Day-one test:** hybrid QR against real iOS/Android with the `chrome-extension://<id>` RP ID; fallback = a domain RP ID via host_permissions + Related Origin Requests.
5. **File-upload surfaces.** `.eml` upload (if ZK Email is kept) and Aadhaar QR image upload. One `react-dropzone` precedent exists (`ImportSmartAccountJsonScreen.tsx`).
6. **Recovery watcher wiring.** Poll `getPendingRecovery` (alarm/tick driven — no generic event watcher exists today) and wire results to: a new `BannerCategory` + `Action` union member (note `maxBannerCount = 1` — the pending-recovery banner must win), `browser.notifications`, and the badge (D2-01, B-03, D-13).
7. **Storage keys + lifecycle.** New `StorageProps` entries + migration for the setup draft, recovery session, and backup set (decision-70 wipe rules). Check keep-alive interplay for long proofs, and auto-lock (1-day default `chrome.alarms`) versus multi-day waiting periods.
8. **Port-messaging targeting.** `PortMessenger.send` broadcasts to every open port (`portMessenger.ts:76`); recovery secrets (.eml material, approvals, passkey challenges) must be routed to their surface only.
9. **Network consts.** Align Sepolia entries (`testnetNetworks.ts` declares no 4337/bundler/paymaster/SA support) with the funding ruling.

## V1

10. **Guardian page hosting.** Serve the SDK's page kit at an extension-relative path (decision 51); QR display for the request link (display exists — `react-native-qrcode-svg`; no scanning needed: guardians open a link, passkeys use the browser's own QR).
11. **Alerts opt-in surface** (C-08) wired to the watcher; push/system notifications degrade per decision 11.

## V2

12. **Apply-to-others iteration UI** (C-09 family) over the SDK's per-account prepare calls, with per-account progress (decision 72).
13. **Health-check scheduling** (Flow F): periodic unattended checks via the SDK's `healthCheck`, meter + "Last check" stat (decision 71); user-gesture tests stay opt-in (R5 semantics).
