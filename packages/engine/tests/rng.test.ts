import { describe, it, expect } from "vitest";
import { nextRng, rngRange, rollDie, roll2d6 } from "../src/rng.js";

describe("nextRng", () => {
  it("is deterministic for the same seed", () => {
    expect(nextRng(42)).toEqual(nextRng(42));
    expect(nextRng(0)).toEqual(nextRng(0));
    expect(nextRng(-1)).toEqual(nextRng(-1));
  });

  it("produces different values across iterations", () => {
    const [v1, s1] = nextRng(42);
    const [v2, s2] = nextRng(s1);
    expect(v1).not.toEqual(v2);
    expect(s1).not.toEqual(s2);
  });

  it("returns values in [0, 1)", () => {
    let state = 1;
    for (let i = 0; i < 5000; i++) {
      const [v, s] = nextRng(state);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      state = s;
    }
  });

  it("two streams from the same seed match for thousands of iterations", () => {
    let a = 12345;
    let b = 12345;
    for (let i = 0; i < 10_000; i++) {
      const [va, na] = nextRng(a);
      const [vb, nb] = nextRng(b);
      expect(va).toBe(vb);
      a = na;
      b = nb;
    }
  });
});

describe("rngRange", () => {
  it("returns ints in [0, n)", () => {
    let state = 7;
    for (let i = 0; i < 1000; i++) {
      const [v, s] = rngRange(state, 100);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(100);
      state = s;
    }
  });

  it("throws on non-positive n", () => {
    expect(() => rngRange(1, 0)).toThrow(RangeError);
    expect(() => rngRange(1, -3)).toThrow(RangeError);
    expect(() => rngRange(1, 1.5)).toThrow(RangeError);
  });
});

describe("rollDie", () => {
  it("returns values in [1, sides]", () => {
    let state = 99;
    for (let i = 0; i < 1000; i++) {
      const [v, s] = rollDie(state, 6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      state = s;
    }
  });
});

describe("roll2d6", () => {
  it("returns two dice in [1,6] each", () => {
    let state = 1;
    for (let i = 0; i < 500; i++) {
      const [[a, b], s] = roll2d6(state);
      expect(a).toBeGreaterThanOrEqual(1);
      expect(a).toBeLessThanOrEqual(6);
      expect(b).toBeGreaterThanOrEqual(1);
      expect(b).toBeLessThanOrEqual(6);
      state = s;
    }
  });

  it("is deterministic given a seed", () => {
    expect(roll2d6(42)).toEqual(roll2d6(42));
  });

  it("distribution roughly approximates 2d6 over many rolls", () => {
    const counts = new Array(13).fill(0) as number[];
    let state = 31337;
    const N = 60_000;
    for (let i = 0; i < N; i++) {
      const [[a, b], s] = roll2d6(state);
      counts[a + b] = (counts[a + b] ?? 0) + 1;
      state = s;
    }
    // Expected frequencies for 2d6 sums:
    //   2:1/36, 7:6/36, 12:1/36
    // Looser tolerances for a sanity check, not statistical proof.
    expect((counts[7] ?? 0) / N).toBeGreaterThan(0.13);
    expect((counts[7] ?? 0) / N).toBeLessThan(0.20);
    expect((counts[2] ?? 0) / N).toBeGreaterThan(0.015);
    expect((counts[2] ?? 0) / N).toBeLessThan(0.045);
  });
});
