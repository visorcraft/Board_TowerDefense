# Contributing to Tower Defense

Thanks for your interest in **Tower Defense** — a cooperative, physical-puzzle tower defense built on the Board Web SDK. Patches, bug reports, and design feedback are all welcome.

This project is free software under the **GNU General Public License v3.0** (see [`LICENSE`](LICENSE)). By submitting a contribution, you agree it is licensed under the same GPL-3.0-only terms (inbound = outbound), and that you have the right to contribute it.

## Ways to contribute

- **Report a bug** — open an issue with steps to reproduce, expected vs. actual behavior, and (if on hardware) the Piece Set, Board OS version, and relevant `board-connect logs` output.
- **Suggest a feature or balance change** — open an issue describing the player-facing behavior before writing code. Gameplay systems are deterministic, so changes are easy to reason about and review.
- **Send a patch** — see the workflow below.
- **Report a security issue** — please **do not** open a public issue. Follow [`SECURITY.md`](SECURITY.md) instead.

## Development setup

Requires Node.js 18+ and npm.

```bash
npm install
npm test               # vitest run — the unit-test suite
npx tsc --noEmit       # strict typecheck
npx vite build         # → dist/
npx vite --port 5173   # browser preview (mouse/keyboard stand in for fingers/Pieces)
```

You don't need a Board to develop. In the browser preview, mouse and keyboard substitute for fingers and Pieces:

- click = place a finger · drag = move it (drag a Cannon to rotate)
- `1`–`4` pick a piece · `Q`/`E` rotate a Cannon · `F`/`Tab` cycle Cannon mode
- `Space` start a wave · `R` restart · `D` (or long-press 0.9s) open the diagnostic

The [`README.md`](README.md) is the single source of truth for gameplay, architecture, and the on-device deploy flow. Read it before making non-trivial changes.

## Pull request workflow

1. Branch from `master`.
2. Make focused changes. Keep gameplay logic deterministic and pure — rendering and input are the outer layers, and all mutations live in the single `GameState` owned by `App`.
3. Add or update tests for any logic change (see **Testing** below).
4. Run **both** gates locally — they must pass:
   ```bash
   npm test
   npx tsc --noEmit
   ```
5. Open a PR against `master`. Include:
   - a short summary of the player-facing behavior change,
   - test results (`npm test` output),
   - screenshots for any visual/UI change,
   - Board notes when relevant (Piece Set, OS version, deploy result).

## Testing

The suite lives in `src/**/*.test.ts` and runs entirely without hardware — tests inject synthetic contacts (`DevContact`s) rather than touching a Board. Coverage spans gameplay logic, waves, targeting, Block path-blocking and A\* detours, input frame-diffing, phase transitions, save round-trip, piece mapping, and the pause-result guard.

New gameplay logic should come with tests. Because the game core is pure and seeded, edge cases are reproducible — please add them.

## Coding style

- **TypeScript strict, ESM imports, two-space indentation.**
- `camelCase` for functions and variables, `PascalCase` for types and classes, `UPPER_SNAKE_CASE` for glyph maps.
- Capitalize Board vocabulary: **Piece, Piece Set, Glyph**.
- Gate device-only calls on `Board.isOnDevice` — the browser preview must keep running off-device.
- Match the surrounding code's idiom, naming, and comment density.

## Commit & PR conventions

- Use concise, imperative commit messages (e.g. `Add board pause action dispatcher`).
- **No AI/agent attribution, anywhere.** Commits are authored solely by the human committer — no `Co-Authored-By` trailers, no "Generated with…" lines, and no mention of any AI assistant as a contributor in commit messages, PR titles/descriptions, code, comments, or docs.

## Code of conduct

Be respectful and constructive. Assume good faith, keep discussion focused on the work, and help keep this a welcoming project for collaborators of all backgrounds.
