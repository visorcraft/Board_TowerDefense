<h1 align="center">🏰 Tower Defense</h1>

<p align="center">
  <b>A cooperative, hands-on tower defense you play on a Board — with real, physical Pieces.</b>
  <br />
  Build, reshape, and upgrade a shared defense — Cannons, Blocks, Stairs, and Shapeshifter Rings — against six escalating waves and a final boss.
  <br />
  One screen · many hands · ~8–10 minute rounds.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-Board-1f6feb" alt="Platform: Board" />
  <img src="https://img.shields.io/badge/built%20with-TypeScript-3178c6?logo=typescript&logoColor=white" alt="Built with TypeScript" />
  <img src="https://img.shields.io/badge/bundler-Vite%205-646cff?logo=vite&logoColor=white" alt="Vite 5" />
  <img src="https://img.shields.io/badge/Piece%20Set-Save%20the%20Bloogs-ff8c00" alt="Piece Set: Save the Bloogs" />
  <img src="https://img.shields.io/badge/tests-56%20passing-3fb950" alt="56 tests passing" />
  <img src="https://img.shields.io/badge/status-alpha-orange" alt="Status: alpha" />
  <img src="https://img.shields.io/badge/license-GPL--3.0--only-blue" alt="License: GPL-3.0-only" />
</p>

---

## Screenshots

<p align="center">
  <em>Top-down, integer-scaled 1080p play area — Cannons holding three lanes against an incoming wave.</em>
  <br /><br />
  <i>A committed capture is pending; grab a live frame from a paired Board any time with
  <code>board-connect screenshot --out docs/screenshot.png</code>.</i>
</p>

---

## What is Tower Defense?

Tower Defense answers a simple table-top question: *"can we hold the line together?"* You don't click towers into place — you **put physical Pieces on the screen**. A Cannon is a Cannon you can pick up, rotate to aim, and slide a Ring across to change its firing mode. Everyone plays at once, on one Board, with shared gold and a shared goal.

It's built around three pillars:

- **Physical-first.** Every tower is a real *Save the Bloogs* Piece you place, rotate, and slide — no menus, just hands. The `glyphId` of each Piece maps to a role through a JSON table, so hardware IDs can be re-mapped without touching code.
- **Co-op by default.** One shared board, one pool of gold, one goal. Any number of hands, no turns, no per-player state — all touches are collaborative.
- **Self-contained.** Pure-canvas rendering, procedural WebAudio, and deterministic seeded waves. It runs fully offline as a Board webapp — and in a plain browser, with mouse/keyboard fallbacks, for development.

**What it covers today:**

- **Four Piece roles** — Cannon, Block, Stair, and the Shapeshifter Ring (detailed under [Gameplay](#the-pieces)).
- **Four Cannon modes** — single, multi, slow, and pierce.
- **A six-wave round ending in a boss**, with deterministic, seeded spawns across five enemy types (walker, runner, tank, swarm, boss).
- **Live 3-lane A\* pathing** that re-routes around Blocks the instant one is placed or lifted.
- **An upgrade shop** — open during the build phase or between waves — for ring zap, cannon fire-rate, stair slow, and block size.
- **Procedural WebAudio** cues and music, with a mute toggle wired into the Board's pause menu.
- **On-device saves** (highest wave, total victories, unlocked Cannon modes) via Board save services.
- **Board pause-menu integration** (Restart, Next Wave, Visit Shop, Diagnostic, Mute) and a **touch diagnostic screen** for capturing Piece glyph IDs.
- **56 Vitest unit tests** over the deterministic game logic; strict TypeScript, ESM-only.

---

## Gameplay

### A round, start to finish

A round is six escalating waves — roughly 8–10 minutes — ending in a boss:

1. **Build.** Place and rotate Pieces while gold accrues. Open the shop to spend it.
2. **Wave.** Enemies spawn from the edges and march toward your goal along up to three lanes.
3. **Resolution.** Defeated enemies drop gold; any that reach the goal chip away at its health.
4. **Repeat.** Clear the final boss to win — or lose if the goal's health hits zero.

Everyone shares the board, the gold, and the goal. There are no turns and no per-player resources: any hand can place, move, rotate, or sell any Piece at any time.

### The Pieces

| Piece | Role | What it does |
| --- | --- | --- |
| **Cannon** | Attack tower | Auto-targets the nearest enemy in its arc. Rotate the Piece to aim. |
| **Block** | Wall / path-shaper | A static obstacle enemies reroute around — drop one to reshape the lanes mid-wave. |
| **Stair** | Lane redirector | Tagged with a lane color; an enemy that touches it re-enters at the next matching Stair. |
| **Ring** | Shapeshifter | Slide it onto a Cannon to switch its fire mode (single / multi / slow / pierce) for a few seconds. |

Pieces are identified by `glyphId`, mapped to roles through [`public/pieceset.json`](public/pieceset.json) — so hardware IDs can be re-mapped without touching code.

### Enemies

Five archetypes, with deterministic, seed-driven spawns so every run of a given wave is repeatable:

- **Walker** — slow, fragile rank-and-file.
- **Runner** — fast and fragile; punishes gaps in your coverage.
- **Tank** — high health and immune to slows.
- **Swarm** — a cluster of fast, fragile, low-value enemies.
- **Boss** — the final wave: slow, heavily armored, and the whole table's problem.

### Spend it wisely

Gold accrues through the build phase and drops from defeated enemies. The **upgrade shop** — reachable during build or between waves — trades it for stronger ring zaps, faster cannons, stronger stair slows, and bigger blocks. Your highest wave, victories, and unlocked Cannon modes persist on the Board between sessions.

> **Out of scope (for now):** networked play, accounts, leaderboards, in-app purchases, and Piece Sets other than Save the Bloogs.

---

## Setup (build & run)

A standard Vite + TypeScript project.

**Prerequisites**

- Node.js 18+ and npm.
- (For deploying to hardware) the `board-connect` CLI and a paired Board — see [Deploy to the Board](#deploy-to-the-board).

**Install & develop**

```sh
git clone git@github.com:visorcraft/Board_TowerDefense.git
cd Board_TowerDefense
npm install

npm run dev          # Vite dev server — open the printed http://localhost:5173
npm test             # Vitest — 56 unit tests
npx tsc --noEmit     # strict type-check
npm run build        # production bundle → dist/
```

**Browser preview controls** (mouse + keyboard stand in for fingers and Pieces):

| Input | Action |
| --- | --- |
| Left-click | Place a dev "finger" / tap overlays |
| Drag a Piece | Move it (or, for a Cannon, rotate to aim) |
| `1` `2` `3` `4` | Pick dev Piece type — Cannon / Block / Stair / Ring |
| `Q` `E` | Rotate the selected Cannon |
| `F` / `Tab` | Cycle the selected Cannon's mode |
| `Space` | Start the wave |
| `R` | Restart the round |
| `D` or long-press (0.9 s) | Open the diagnostic screen |

---

## Deploy to the Board

The app bundles to a `.webapp.zip` with [`@board.fun/web-pack`](https://www.npmjs.com/package/@board.fun/web-pack) and ships to a real Board with `board-connect`.

```sh
# 0. Confirm the Board is reachable
board-connect ls
board-connect status

# 1. Production bundle (vite build cleans dist/, so copy the model AFTER)
npx vite build

# 2. Copy the touch model + config into dist/ (web-pack reads them from there)
cp assets/save_the_bloogs_v1.3.2.tflite dist/model.tflite
cp board.config.json dist/board.config.json

# 3. Pack (mints the appId on first run and writes it back to board.config.json)
npx web-pack dist \
  --package-id fun.visorcraft.towerdefense \
  --name "Tower Defense" \
  --model model.tflite

# 4. Install + launch (the appId is the one stored in board.config.json)
board-connect install <appId>.webapp.zip
board-connect launch <appId>

# Inspect on the device
board-connect logs <appId> --follow
board-connect screenshot --out shot.png
```

Only the **Save the Bloogs** model is bundled into the webapp — the platform recognizes one Piece Set at a time. The `.webapp.zip` is gitignored; `board.config.json` (which pins the `appId`) is committed so the same on-device save directory is reused across re-packs.

---

## Tweak

A few files and tables let you re-skin and re-map without diving into engine code:

- **`board.config.json`** — `packageId`, `appId`, app name, and Piece Set. The `appId` is a UUID that scopes on-device saves; it travels with the repo so saves persist across re-packs.
- **`public/pieceset.json`** — the `glyphId → role` map (Cannon / Block / Stair / Ring) plus labels and default Cannon mode. Update it after capturing IDs on the **Diagnostic Screen** (System Menu → Diagnostic, or long-press the canvas), then rebuild.
- **Audio** — procedural cues live in `src/audio/cues.ts`; master volume and mute are exposed through the Board pause menu.
- **Balance & systems** — wave lists, enemy stats, economy, and targeting are pure, deterministic functions under `src/game/` (and are the parts covered by the unit tests).

---

## Contribute

Patches, bug reports, and design feedback are welcome. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the full guide, and [`SECURITY.md`](SECURITY.md) for reporting security issues privately.

- Branch from `master`, send a PR.
- Before pushing, run `npm test` **and** `npx tsc --noEmit` — both must pass.
- Use concise, imperative commit messages (e.g. `Add board pause action dispatcher`).
- Gameplay systems are deterministic and pure; rendering and input are the outer layers. Keep mutations in the single `GameState` instance owned by `App`.

---

## Documentation

The README is the single source of truth for the project. Authoritative Board SDK references live upstream: [Web SDK API](https://docs.dev.board.fun/web/reference/api), [build & deploy](https://docs.dev.board.fun/web/getting-started/build-and-deploy), [board-connect](https://docs.dev.board.fun/tools/board-connect), and [Pieces & touch](https://docs.dev.board.fun/learn/pieces).

---

## License

Licensed under the **GNU General Public License v3.0** (`GPL-3.0-only`) — see [`LICENSE`](LICENSE) for the full text.

© 2026 VisorCraft LLC. This is free software: you are free to use, study, share, and modify it under the terms of the GPL. It is distributed in the hope that it will be useful, but **WITHOUT ANY WARRANTY**, to the extent permitted by law.

The GPL covers the source code in this repository. Third-party components carry their own licenses and are **not** relicensed here — notably the Board Web SDK and the *Save the Bloogs* Piece Set model (`.tflite`), which is obtained out of band and is not distributed in this repo.
