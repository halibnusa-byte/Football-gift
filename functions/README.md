# Trusted Firebase backend (migration scaffold)

This folder is the start of the server-side migration. It is **not deployed** and the current browser app still writes privileged data directly.

## Functions included
- `rollAndAward`: deliberately disabled. It must remain disabled until a server-authoritative round/box claim prevents users from requesting unlimited rewards.
- `setActiveEvent`: starts/stops a whitelisted event and enforces delegated event permissions using server-verified custom claims.

## Required before use
1. Finish migrating the browser UI to call callable functions. Remove client writes to inventory, footballTokenOwner, events, admin roles, settings, and other privileged records.
2. Build server-authoritative round creation, box opening, and event mini-game claims before enabling any reward function. Do not trust client-supplied prize IDs, odds, winners, opened-box counts, or timestamps.
3. Add callable functions for gift transfers, manual grants, player resets, role assignment, announcements, event mini-game claims, server lock, and all remaining privileged actions.
4. Deploy and test in the Firebase Emulator Suite first.
5. Only after the client migration and tests, deploy narrow Realtime Database rules. Do not deploy the final rules while the old browser client is live: its direct writes will fail and gameplay will stop.
6. Assign custom claims only from a trusted Admin SDK environment. Never let a browser choose its own claims.

## Local setup
- Node.js 20+
- Install dependencies with `npm install` in this folder.
- Configure Firebase CLI for the correct project and run the Emulator Suite.
- Deployment of Cloud Functions may require the Firebase Blaze plan. Ask a parent/guardian to review billing before enabling it; do not enable billing just to test.

## Custom claims
The backend expects boolean claims: `mainAdmin`, `halfAdmin`, and `quarterAdmin`.
Claims must be assigned through a trusted Admin SDK environment after verifying the intended account UID. Do not put service-account credentials in this repository or in the browser.

## Current limitation
The existing `index.html` has not yet been migrated to these functions. This scaffold is not a secure or playable replacement yet. No production Firebase rules or live data were changed.
