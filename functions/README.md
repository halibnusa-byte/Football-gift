# Trusted Firebase backend (migration scaffold)

This folder is the start of the server-side migration. It is **not deployed** and the current browser app still writes privileged data directly.

## Functions included
- `rollAndAward`: server-generated prize roll and server-side inventory update. A caller can award themselves; awarding another UID requires the `mainAdmin` custom claim.
- `setActiveEvent`: starts/stops a whitelisted event and enforces delegated event permissions using server-verified custom claims.

## Required before use
1. Finish migrating the browser UI to call these functions. Remove client writes to inventory, footballTokenOwner, events, admin roles, settings, and other privileged records.
2. Add further callable functions for gift transfers, manual grants, player resets, role assignment, announcements, event mini-game claims, server lock, and all remaining privileged actions.
3. Deploy and test in the Firebase Emulator Suite first.
4. Only after the client migration and tests, deploy narrow Realtime Database rules. Do not deploy the final rules while the old browser client is live: its direct writes will fail and gameplay will stop.
5. Assign custom claims only from a trusted Admin SDK environment. Never let a browser choose its own claims.

## Local setup
- Node.js 20+
- Install dependencies with `npm install` in this folder.
- Configure Firebase CLI for the correct project and run the Emulator Suite.
- Deployment of Cloud Functions may require the Firebase Blaze plan. Ask a parent/guardian to review billing before enabling it; do not enable billing just to test.

## Custom claims
The backend expects boolean claims: `mainAdmin`, `halfAdmin`, and `quarterAdmin`.
Claims must be assigned through a trusted Admin SDK script or controlled operator workflow after verifying the intended account UID. Do not put service-account credentials in this repository or in the browser.
