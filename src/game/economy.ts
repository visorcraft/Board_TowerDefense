import type { GameState, PlacedPiece } from "./types.js";
import { PASSIVE_GOLD_PER_MS } from "./state.js";

export const PIECE_COSTS = {
  cannon: 25,
  block: 8,
  stair: 12,
  ring: 0,
};

export const RING_COST = 30;

export function tickEconomy(state: GameState, dtMs: number): void {
  if (state.phase !== "build") return;
  state.gold += PASSIVE_GOLD_PER_MS * dtMs;
}

export function canAfford(state: GameState, cost: number): boolean {
  return state.gold >= cost;
}

export function spend(state: GameState, amount: number): boolean {
  if (state.gold < amount) return false;
  state.gold -= amount;
  return true;
}

export function placePiece(state: GameState, piece: Omit<PlacedPiece, "id" | "fireCooldownMs" | "ringTimerMs" | "hp">): PlacedPiece | null {
  if (piece.role === "unknown") return null;
  const cost = PIECE_COSTS[piece.role] ?? 0;
  if (piece.role !== "ring" && !spend(state, cost)) return null;
  if (piece.role === "ring" && !spend(state, RING_COST)) return null;
  const placed: PlacedPiece = {
    ...piece,
    id: state.nextPieceId++,
    fireCooldownMs: 0,
    ringTimerMs: 0,
    hp: piece.role === "block" ? 3 : 1,
  };
  state.pieces.push(placed);
  return placed;
}

export function removePiece(state: GameState, id: number): boolean {
  const idx = state.pieces.findIndex((p) => p.id === id);
  if (idx < 0) return false;
  const p = state.pieces[idx];
  if (p.role === "block" && !spend(state, state.blockRemovalCost)) return false;
  state.pieces.splice(idx, 1);
  return true;
}
