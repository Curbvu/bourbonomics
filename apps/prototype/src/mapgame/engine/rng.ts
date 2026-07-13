// Mulberry32 — small, fast, deterministic 32-bit PRNG (same family as the base
// engine, re-implemented so the Map Game module stays self-contained). Every
// randomized step threads a seed and returns the next seed, so replays are exact.

export function nextRng(seed: number): [number, number] {
  const next = (seed + 0x6d2b79f5) | 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, next];
}

/** Returns [int in [0, n), nextSeed]. n must be a positive integer. */
export function rngRange(seed: number, n: number): [number, number] {
  if (n <= 0 || !Number.isInteger(n)) {
    throw new RangeError(`rngRange: n must be a positive integer (got ${n})`);
  }
  const [v, next] = nextRng(seed);
  return [Math.floor(v * n), next];
}

/** Fisher-Yates shuffle returning a new array + the next seed. Pure. */
export function shuffle<T>(items: readonly T[], seed: number): [T[], number] {
  const out = items.slice();
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    const [j, next] = rngRange(s, i + 1);
    s = next;
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return [out, s];
}
