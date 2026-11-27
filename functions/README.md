# Trusted Firebase backend — migration in progress

This folder is a server-side migration scaffold. It is **not deployed** and the current browser app has not yet been migrated to call these endpoints.

## Implemented callable endpoints
- `redeemRoleCode`: checks the entered code against hashes in the database on the trusted server, then assigns Firebase custom claims. Stored hashes are not returned to the browser by this endpoint.
- `setActiveEvent`: starts/stops a whitelisted event and enforces main/half/quarter-admin permissions using custom claims.
- `setServerControl`: changes the server lock only for a user with the `mainAdmin` custom claim.
- `rollAndAward`: deliberately disabled. It must remain disabled until box openings and event claims are tracked authoritatively on the server. Otherwise a modified client could request unlimited rewards.

## Still required before this is secure or playable
1. Migrate the browser role login to call `redeemRoleCode`, refresh the ID token, and stop reading role hashes from Realtime Database.
2. Migrate the server lock UI to call `setServerControl`.
3. Move box creation, box opening, reward odds, rare-box modifiers, pending Blitz/Galaxy, event challenges, Godzilla votes, LaserTag scoring and rewards to server-authoritative state.
4. Add server endpoints for gift transfers, manual grants, player resets, role assignment/revocation, announcements, settings, Message Man messages, comeback gifts and every remaining privileged action.
5. Remove client writes to inventory, firstWon, totalWins, footballTokenOwner, events, admin roles, settings, serverControl, announcements and other privileged records.
6. Replace broad branch-level database grants with narrowly validated client permissions and public-safe read models. The existing UI reads the full players/settings/activity branches, so rules cannot safely be tightened until those reads are redesigned.
7. Add Firebase Emulator tests for anonymous users, normal players, Message Man, special players, quarter admins, half admins and main admin. Test one-time Football Token uniqueness and every forbidden write.
8. Test the complete migrated client and backend together before deployment.

## Setup
- Node.js 20+
- Run `npm install` in this folder.
- Configure Firebase CLI for the correct project and run the Emulator Suite.
- Cloud Functions deployment may require Firebase Blaze billing. A parent/guardian must review billing before enabling it. Do not enable billing just to test.

## Custom claims
The backend uses boolean claims: `mainAdmin`, `halfAdmin`, `quarterAdmin`, and `special` / `messageMan`.
Claims must only be assigned by trusted Admin SDK code after server-side code verification. Never store service-account credentials in this repository or in the browser.

## Deployment warning
Do not deploy the current rules lockdown or merge this branch into `main` yet. The current browser code still writes directly to privileged database paths. Deploying restrictive rules before the client migration will break gameplay, and deploying the current client with broad rules leaves the game vulnerable.

No production Firebase rules, live data, or Main-branch files have been changed.
