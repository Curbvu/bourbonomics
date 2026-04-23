/**
 * Seeded PRNG (mulberry32). Deterministic so games are replayable and bots testable.
 *
 * Usage:
 *   const rng = { state: seed };
 *   const x = next(rng);               // [0, 1)
 *   const k = nextInt(rng, 0, 10);     // integer in [0, 10)
 *   const s = shuffle(rng, [...]);     // Fisher-Yates
 *
 * The `rng` object carries a single 32-bit state field that the reducer persists
 * on `GameState.rngState` so that save/load reproduces the same outputs.
 */

export type Rng = { state: number };

export function createRng(seed: number): Rng {
  return { state: seed >>> 0 };
}

export function next(rng: Rng): number {
  let t = (rng.state = (rng.state + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Inclusive lo, exclusive hi. */
export function nextInt(rng: Rng, loInclusive: number, hiExclusive: number): number {
  return Math.floor(next(rng) * (hiExclusive - loInclusive)) + loInclusive;
}

/** Standard d6, 1..6 inclusive. */
export function rollD6(rng: Rng): number {
  return nextInt(rng, 1, 7);
}

export function shuffle<T>(rng: Rng, xs: readonly T[]): T[] {
  const out = xs.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = nextInt(rng, 0, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
