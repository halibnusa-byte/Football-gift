# Security audit — Main version

Audit date: 2026-11-27
Audited source: `main` (the version the owner confirmed is currently in use).

## Confirmed findings

1. **Admin proof is forgeable.** The browser authenticates anonymously, computes the admin code hash in the client, and writes `adminProof/<uid>`. Realtime Database rules allow an authenticated user to write their own `adminProof/<uid>` value. While the server is open, the admin code hash is readable to authenticated users, so the proof check is not a trusted authorization boundary.
2. **Privileged database branches accept broad client writes.** The current rules grant authenticated clients read/write access to `settings`, `players`, `events`, `messages`, `announcements`, and `activity` while the server is open. Anonymous Firebase Auth is sufficient for this access.
3. **Rewards are decided and written in the browser.** Prize odds, event modifiers, box selection, and award logic run client-side. A modified client can bypass the intended game flow.
4. **Admin actions run in the browser.** Role setup, role changes, event controls, gifts, token grants, server control, player resets, and announcements write directly to Realtime Database from the client.
5. **Player identity is only anonymous Firebase Auth.** A display name is user-supplied and is not a verified identity.

## Important deployment distinction

The Firebase rules pasted by the owner are currently time-limited root read/write grants through 2026-12-23. The rules file in GitHub Main is different: root access is denied, but nested paths grant broad authenticated access. Neither configuration is a safe production authorization design.

## Migration requirements

- Move privileged operations to trusted server code using Firebase Admin SDK (Cloud Functions or another trusted backend).
- Give the primary admin and delegated roles server-verified identities/claims; never accept a role or proof written by the same client as authorization.
- Make reward rolls, one-time Football Token ownership, gift transfers, event state changes, admin role changes, and player resets atomic server-side operations.
- Replace broad branch-level write grants with narrow, validated per-user reads/writes. Do not deploy restrictive rules until the client has been migrated, or the game will stop working.
- Add emulator tests for anonymous users, normal players, Message Man, quarter admins, half admins, and main admin; include attempts to forge roles, alter balances, award duplicate Football Tokens, and modify global events.
- Test with separate accounts before merging or deploying.

## Current status (updated 2026-11-27)

Implemented in this branch:
- Callable role-code verification that assigns Firebase custom claims on the trusted server.
- Role-code verification now uses the server-only `ROLE_CODE_MAP` Secret Manager secret; it no longer reads hashes from client-writable Realtime Database paths.
- Static regression test added to reject future role-code lookups from Realtime Database.
- Callable event control with an event allowlist and delegated-role checks.
- Callable server-lock control restricted to the main-admin claim.
- Reward callable deliberately disabled until a server-authoritative round/claim system exists.
- Static regression checks and a CI workflow definition.

Still not complete:
- Browser role login, event start/stop, and server-lock controls have been migrated to call trusted endpoints; this is only a partial migration.
- Other legacy admin setup/role management functions and many gameplay, inventory, reward, transfer, settings, and messaging actions still write directly from the browser.
- `ROLE_CODE_MAP` has not been provisioned; role login through the new callable will fail closed until the project owner provisions it securely.
- No Firebase Emulator integration tests or end-to-end gameplay tests have been verified. CI only runs Node syntax checks and static regression tests.
- Gift transfers, manual grants, player resets, admin provisioning, announcements, event mini-games, box rounds/rewards, LaserTag, Godzilla votes, and other privileged operations still need trusted server endpoints and client migration.

This branch is a safe working branch created from Main. No production Firebase rules, live data, or Main-branch files have been changed. Do not merge or deploy until the full client migration, private role-code storage, narrow rules, integration tests, and billing review are complete.


## Additional migration work recorded on 2026-11-27

- Browser role login now calls `redeemRoleCode` and refreshes the Firebase ID token before reading server-issued custom claims. The former role-check flow that compared codes against Realtime Database hashes has been replaced.
- Browser event start/stop controls now call `setActiveEvent`; browser server-lock controls now call `setServerControl`.
- The old browser-side `adminProof/<uid>` wrapper was removed from the role-login flow.
- Static regression tests now cover the browser callable wiring in addition to backend callable checks.

These changes are a partial migration only. Other legacy admin setup/role management functions and many gameplay, inventory, reward, transfer, settings, and messaging actions still write directly from the browser. The full client/rules migration and emulator/end-to-end testing remain release blockers.


## Additional backend hardening — 2026-11-27

- Event activation now updates only `events/active`, `events/startedAt`, and `events/runId` through a parent `update()`, rather than replacing the entire `events` object. This prevents event activation from deleting unrelated event configuration stored under that branch.
- A regression test asserts that event changes preserve unrelated event data.

Release remains blocked: broad client writes, client-side reward decisions, unprovisioned role secret, and missing emulator/end-to-end tests remain unresolved. Do not merge or deploy this branch to production.
