import type { SeededRng } from "./types.js";

export function createRng(seed: number): SeededRng {
  return { seed, state: seed | 0 };
}

export function rngNext(rng: SeededRng): number {
  let s = rng.state;
  s ^= s << 13;
  s ^= s >>> 17;
  s ^= s << 5;
  rng.state = s | 0;
  return ((rng.state >>> 0) % 1_000_000) / 1_000_000;
}

export function rngInt(rng: SeededRng, min: number, maxExclusive: number): number {
  return min + Math.floor(rngNext(rng) * (maxExclusive - min));
}

export function rngPick<T>(rng: SeededRng, arr: ReadonlyArray<T>): T {
  return arr[rngInt(rng, 0, arr.length)];
}

export function rngRange(rng: SeededRng, min: number, max: number): number {
  return min + rngNext(rng) * (max - min);
}

export function rngChance(rng: SeededRng, p: number): boolean {
  return rngNext(rng) < p;
}
