# Tower Defense — Design Doc (v0.1)

## Pitch
A cooperative tabletop tower defense played on a Board. Players physically place Save the Bloogs Pieces on the screen to build, reshape, and upgrade a shared defense against waves of enemies. One screen, one Board, multiple hands.

## Core loop (~8-10 min round)
1. **Build phase** (~15-20s): players place and rotate Cannons, Blocks, and Stairs; gold accrues.
2. **Wave phase** (~40-60s): enemies spawn from one or more edges and traverse the play area toward the goal.
3. **Resolution**: surviving enemies damage the goal; defeated enemies drop gold.
4. Repeat for N waves (target 6-8) ending in a boss wave.

## Board Piece semantics
| Piece | Role | Behavior |
|---|---|---|
| Cannon | Attack tower | Auto-targets nearest enemy in arc. Rotating the Piece (`orientation` delta) changes aim / arc width. |
| Block | Wall / path shaper | Static obstacle; enemies reroute around it. Removable. |
| Stair | Lane redirector | Tagged with a lane color. When an enemy touches it, that enemy re-enters the path at the next Stair of the matching lane. Also reorders target priority. |
| Ring (Shapeshifter) | Mode changer | Slide over a Cannon to toggle its fire mode (e.g., single, multi, slow, pierce) for a few seconds, then times out. |

Pieces are identified by `glyphId`, not by `type`. A `BLOOGS_GLYPH_ROLE` table is loaded from JSON so real-hardware IDs can be re-mapped without code changes.

## Game systems

### Waves
- Fixed deterministic enemy list per wave, seeded by wave number.
- Boss on the final wave (high HP, slow, AOE on arrival).
- Wave clears when the last enemy is defeated or leaks.

### Enemies
- Walker (1 HP, slow)
- Runner (1 HP, fast)
- Tank (5 HP, slow, slow-immune)
- Swarm (8x1 HP, fast, low reward)
- Boss (final wave only)

Cap at 32 simultaneous enemies for perf.

### Pathing & lanes
- 1-3 pre-drawn lanes rendered as faint guides.
- Blocks split the path via grid A*; recomputed only when a Block is placed or removed.
- Stairs add a cross-lane teleport at the next matching-lane Stair.

### Targeting & firing
- Acquire target at acquisition range, fire at fire rate, lead the target by its velocity.
- Arc width and rotation set by `orientation`.
- Damage types: normal, pierce, slow (%).

### Economy
- +5 gold/s passive during build phase.
- Defeated enemies drop gold; boss drops a one-shot Ring charge.
- Placing a Ring on a Cannon consumes the Ring.

## Win / lose
- Goal has 20 HP. Enemy reaching the goal deals 1 damage (boss 3).
- Round ends at final-wave clear (victory) or goal HP 0 (defeat).

## Multiplayer (co-op local)
- All players share gold, the board, and the goal.
- No per-player resources in v1; no turn order.
- Touch IDs are not assigned to players; all Glyphs are collaborative inputs.
- Pieces can be moved/rotated by any player at any time.

## Persistence (Board saves)
- Use `Board.session` save services; key by `appId` from `board.config.json`.
- Save: highest wave reached, total victories, unlocked Cannon modes, last round seed.
- Load on launch; prompt on first run.

## Audio (procedural WebAudio)
- One `AudioContext`, lazily resumed on first user gesture.
- Cues: cannon shot, enemy hit, enemy death, Block placed, Stair placed, Ring cast, wave start, wave clear, boss theme, defeat.
- Master gain + mute toggle wired into the Board's pause menu.

## Visuals (stylized top-down pixel art)
- 1080p canvas, integer-scaled nearest-neighbor for crisp pixels.
- Tile size 16 or 24 px; play area ~80% of canvas, centered.
- Palette: dark slate background, muted blue lane guides, enemy tints by type, Cannon color by current mode.
- Procedural placeholder sprites first (colored rects + outlines); licensed pixel pack later.
- Per-wave palette shift for variety.

## Out of scope (v1)
- Networked play, accounts, leaderboards, shop, IAP, custom Piece Sets beyond Save the Bloogs, voice chat, per-player stats.

## Open questions
- Real Bloogs `glyphId` values — to be captured via the diagnostic screen.
- Final wave count and difficulty curve.
- Block removal cost (free vs gold).
- Ring spell list (v1: 3-4 modes).
- Pause menu scope and persistence granularity.
