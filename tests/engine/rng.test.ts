import { describe, expect, it } from "vitest";
import { createRng, next, nextInt, rollD6, shuffle } from "@/lib/engine/rng";

describe("rng", () => {
  it("is deterministic from a seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 100; i++) {
      expect(next(a)).toBe(next(b));
    }
  });

  it("produces different sequences for different seeds", () => {
    const a = createRng(1);
    const b = createRng(2);
    let same = true;
    for (let i = 0; i < 10; i++) {
      if (next(a) !== next(b)) {
        same = false;
        break;
      }
    }
    expect(same).toBe(false);
  });

  it("nextInt is in range and covers boundaries", () => {
    const rng = createRng(7);
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < 1000; i++) {
      const k = nextInt(rng, 0, 6);
      expect(k).toBeGreaterThanOrEqual(0);
      expect(k).toBeLessThan(6);
      if (k < min) min = k;
      if (k > max) max = k;
    }
    expect(min).toBe(0);
    expect(max).toBe(5);
  });

  it("rollD6 is 1..6", () => {
    const rng = createRng(99);
    for (let i = 0; i < 200; i++) {
      const r = rollD6(rng);
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(6);
    }
  });

  it("shuffle does not lose elements", () => {
    const rng = createRng(123);
    const xs = [1, 2, 3, 4, 5, 6, 7];
    const out = shuffle(rng, xs);
    expect(out.slice().sort()).toEqual(xs.slice().sort());
    expect(out.length).toBe(xs.length);
  });
});
