// Mulberry32 — small, fast, deterministic 32-bit PRNG.
// All randomized engine operations thread an integer state and return both
// the value and the next state. This keeps the engine pure-functional and
// makes replays exact.

/** Advance the RNG. Returns [value in [0,1), nextState]. */
export function nextRng(state: number): [number, number] {
  const newState = (state + 0x6d2b79f5) | 0;
  let t = newState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, newState];
}

/** Returns [int in [0, n), nextState]. n must be a positive integer. */
export function rngRange(state: number, n: number): [number, number] {
  if (n <= 0 || !Number.isInteger(n)) {
    throw new RangeError(`rngRange: n must be a positive integer (got ${n})`);
  }
  const [v, next] = nextRng(state);
  return [Math.floor(v * n), next];
}

/** Roll one die with `sides` sides. Returns [1..sides, nextState]. */
export function rollDie(state: number, sides: number): [number, number] {
  const [r, next] = rngRange(state, sides);
  return [r + 1, next];
}

/** Roll 2d6. Returns [(a, b), nextState]. */
export function roll2d6(state: number): [[number, number], number] {
  const [a, s1] = rollDie(state, 6);
  const [b, s2] = rollDie(s1, 6);
  return [[a, b], s2];
}
