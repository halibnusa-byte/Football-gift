# Football Gift Challenge – The Comeback Era

This repository contains the Football Gift Challenge web app.

## Development status

Active work is kept on the draft branch `comeback-era-build-2026-11-27`. The `main` branch is not changed by this development work.

### Existing game systems

- 15 shared gift boxes per round and up to 3 opens per player.
- Existing prize inventory, ranking, global one-time Football Token ownership, and Galaxy event drop.
- Event controls and event-specific challenges, including the video-pause vote, Time Travel, School, Lava, Alien Invasion, Ocean, Zombie, 3D LaserTag, and bespoke playable mini-games for 34 standard events (reaction, memory, ordering, map, goal, and knowledge challenges).
- Persistent shop points, shop items, timed offers, and player inventory.
- Player roles, admin controls, lockdown UI, live chat, activity feed, and comeback features.

### Important established constraints

- Keep the six established main tokens: Revenge Token, Football Loser Token, Double Goal Token, Selbst-Retter-Token, Freistoß-Token, and Football Token.
- Do not invent additional token types for events. Events use existing rewards, special gifts/items, or Nieten.
- Double Goal is the second-rarest of the six main tokens; Selbst-Retter is fourth-rarest.
- Football Token can be awarded only once globally.
- Galaxy Gift appears only during the Galaxy Event, with a 0.001% spawn chance.
- LaserTag player skins are 3D models.

### Validation

GitHub Actions checks JavaScript syntax and a set of static game invariants:

```bash
python3 tests/check_invariants.py
```

These checks do not replace browser, Android, multiplayer, or Firebase permission tests.

## Before public release

See [SECURITY_SETUP.md](SECURITY_SETUP.md). Firebase authorization, reward integrity, two-account multiplayer, and real-device testing remain release blockers. Do not treat the browser-only code or a client-side role code as secure authorization.
