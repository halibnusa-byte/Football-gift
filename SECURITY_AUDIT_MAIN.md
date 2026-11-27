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
- Callable event control with an event allowlist and delegated-role checks.
- Callable server-lock control restricted to the main-admin claim.
- Reward callable deliberately disabled until a server-authoritative round/claim system exists.
- Static regression checks and a CI workflow definition.

Still not complete:
- The browser client has not been migrated to call these endpoints; it still performs privileged direct writes.
- Role-code hashes still live in legacy Realtime Database paths. Until strict rules prevent client writes to those paths, they are not a trustworthy source of authorization.
- No production rules have been deployed, and no Firebase Emulator integration tests or successful CI run have been verified.
- Gift transfers, manual grants, player resets, admin provisioning, announcements, event mini-games, box rounds/rewards, LaserTag, Godzilla votes, and other privileged operations still need trusted server endpoints and client migration.

This branch is a safe working branch created from Main. No production Firebase rules, live data, or Main-branch files have been changed. Do not merge or deploy until the full client migration, private role-code storage, narrow rules, integration tests, and billing review are complete.
