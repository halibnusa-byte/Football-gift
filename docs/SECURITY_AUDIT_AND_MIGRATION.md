# Football Gift – Security audit (2026-11-27)

This is an audit of the current `main` branch, not a claim that the application is secure or production-ready. No live Firebase settings were changed.

## Confirmed findings

### 1. The current Realtime Database rules are a full lockout
`firebase-config.js` currently has root-level `.read: false` and `.write: false`. Realtime Database rules cascade: a child rule cannot grant access that a parent rule has denied. Therefore the later child rules do not reopen access. If these rules are deployed, the browser app's database reads and writes will fail.

### 2. Removing the root lockout as-is would expose broad write access
The child rules for `players`, `settings`, `events`, `messages`, `announcements`, and `activity` currently allow any authenticated user to write at those paths. Authentication is anonymous in `index.html`; it is not proof that a caller is an administrator or owns a player record. In particular, the current `players` rule is not scoped to `auth.uid`.

### 3. Reward generation is still client-side
The browser code in `index.html` contains `weightedPrize`, `rarePick`, `rollAndAward`, and `awardPrizeTo`. It chooses rewards with browser-side randomness and writes inventory, first-win timestamps, total wins, and the global Football Token owner directly to Realtime Database. A modified browser can bypass those checks.

The callable `rollAndAward` in `functions/index.js` deliberately throws `failed-precondition`; it is not a working reward endpoint. The browser nevertheless calls its own local `rollAndAward` function.

### 4. Event claims are not authoritative
Event participation claims are created by browser-side transactions under `players/<uid>/eventClaims`. Event rewards are also decided in the browser. The LaserTag score board and top-three rewards are client-writable/client-awarded. A client can alter these values unless the event flow is moved to trusted server code and rules deny direct client writes.

### 5. Several admin controls still write directly from the browser
Examples include admin-code hashes, special-player and Message Man configuration, role-code records, settings/chances, announcements, player resets, pending Galaxy/Blitz rewards, Comeback gifts, and player inventories. UI role checks are not a security boundary. These operations need callable server functions that verify Firebase Auth custom claims and validate every input.

### 6. Role setup has two competing designs
`functions/index.js` redeems role codes from the Secret Manager secret `ROLE_CODE_MAP` and writes custom claims. However, `index.html` still contains browser-side role administration that writes role-code hashes under Realtime Database `admin/*`. The callable does not read those database records. The project needs one authoritative role-provisioning path; it must not store usable role codes or role hashes in client-writable database paths.

### 7. Skibidi completion is marked at the wrong time
In `functions/index.js`, `settings/completedEvents/skibidi` is set when the event starts, and it is also set when the event is stopped. It must only be set after a server-verified successful completion, not merely because the event was started or stopped.

### 8. Deployment/configuration evidence is incomplete
The checked paths `package.json` and `firebase.json` were not found at the repository root. Before deployment, confirm the actual Functions package manifest, Node runtime, deployed function region, Secret Manager configuration, Firebase project/database URL, and the rules file that is actually deployed. The database URL and project identifiers in the browser and Functions source must refer to the intended same project.

## Safe migration order

1. Keep the current root-deny rules unpublished until a tested replacement and matching client/server migration exist. If they have already been published, do not replace them with permissive rules; first establish the current live state with the project owner.
2. Create a staging Firebase project/database and test against it. Do not use production player data for security experiments.
3. Define a data-access matrix for every database path: public-to-authenticated reads, own-player reads, admin-only reads, server-only writes, and any explicitly permitted user-owned writes.
4. Move every reward-affecting action to callable Functions: box opening, reward roll, unique Football Token claim, event claim, Comeback claim, gifting/transfers, resets, and event leaderboard settlement. Enforce per-user limits and uniqueness in server transactions.
5. Move every admin mutation to callable Functions and enforce custom claims on the server. Remove corresponding browser writes. Do not treat hidden buttons or local `role` variables as authorization.
6. Make Realtime Database rules deny client writes to server-owned state. Add narrowly scoped reads and only the minimum own-user writes needed (for example, presence), with validation and UID checks.
7. Reconcile the Secret Manager role map with the admin UI. Provisioning must be an owner-controlled server-side operation; do not expose role-code hashes or secrets to clients.
8. Correct Skibidi completion so only a verified successful end state marks it complete.
9. Add emulator tests for unauthenticated access, anonymous users, cross-user reads/writes, role escalation, duplicate claims, reward tampering, unique-token races, event timing, server lock/unlock, and each legitimate game flow.
10. Only after staging tests pass, review the exact rules and Functions deployment with the project owner and publish them. Then run a production smoke test.

## Scope and status

- Branch: `security/audit-and-migration-plan`
- This commit adds documentation only; it does not change game behavior, database rules, secrets, or production Firebase.
- No Firebase rules have been published by this audit.
- The app must not be described as fully secured or ready to publish until the migration and tests above are completed.
