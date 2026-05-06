/**
 * v2.7 mash bill complexity tier — sanity checks on the catalog so the
 * curve doesn't drift accidentally:
 *   - every bill is tagged with a tier (1 / 2 / 3),
 *   - every payoff-grid cell is ≥ 1 (preserves the floor-1 rule),
 *   - per-tier reward range and peak respect the spec, and
 *   - one snapshot test per tier locks in a representative bill.
 */

import { describe, it, expect } from "vitest";
import { defaultMashBillCatalog } from "../src/defaults.js";

describe("mash bill complexity tier — catalog shape", () => {
  it("every bill carries a complexityTier", () => {
    const catalog = defaultMashBillCatalog();
    for (const bill of catalog) {
      expect(bill.complexityTier, `${bill.defId} missing complexityTier`).toBeDefined();
      expect([1, 2, 3]).toContain(bill.complexityTier);
    }
  });

  it("every reward cell is at least 1 (floor-1 rule)", () => {
    const catalog = defaultMashBillCatalog();
    for (const bill of catalog) {
      for (const row of bill.rewardGrid) {
        for (const cell of row) {
          if (cell == null) continue;
          expect(cell, `${bill.defId}: cell < 1`).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it("the pool is split roughly evenly across the three tiers (≥5 per tier)", () => {
    const catalog = defaultMashBillCatalog();
    const counts = { 1: 0, 2: 0, 3: 0 } as Record<number, number>;
    for (const bill of catalog) counts[bill.complexityTier!] = (counts[bill.complexityTier!] ?? 0) + 1;
    expect(counts[1]).toBeGreaterThanOrEqual(5);
    expect(counts[2]).toBeGreaterThanOrEqual(5);
    expect(counts[3]).toBeGreaterThanOrEqual(5);
  });
});

describe("mash bill complexity tier — per-tier curve", () => {
  it("Tier 1 bills cap their peak at ≤ 6", () => {
    const t1 = defaultMashBillCatalog().filter((b) => b.complexityTier === 1);
    for (const bill of t1) {
      const peak = peakReward(bill.rewardGrid);
      expect(peak, `${bill.defId} peak ${peak} > 6`).toBeLessThanOrEqual(6);
    }
  });

  it("Tier 2 bills peak between 6 and 9", () => {
    const t2 = defaultMashBillCatalog().filter((b) => b.complexityTier === 2);
    for (const bill of t2) {
      const peak = peakReward(bill.rewardGrid);
      expect(peak, `${bill.defId} peak ${peak} out of [6,9]`).toBeGreaterThanOrEqual(6);
      expect(peak, `${bill.defId} peak ${peak} out of [6,9]`).toBeLessThanOrEqual(9);
    }
  });

  it("Tier 3 bills peak between 9 and 12 (inclusive)", () => {
    const t3 = defaultMashBillCatalog().filter((b) => b.complexityTier === 3);
    for (const bill of t3) {
      const peak = peakReward(bill.rewardGrid);
      expect(peak, `${bill.defId} peak ${peak} out of [9,12]`).toBeGreaterThanOrEqual(9);
      expect(peak, `${bill.defId} peak ${peak} out of [9,12]`).toBeLessThanOrEqual(12);
    }
  });

  it("Gold awards live almost exclusively on Tier 3 bills", () => {
    const catalog = defaultMashBillCatalog();
    const goldenT1 = catalog.filter((b) => b.complexityTier === 1 && b.goldAward);
    const goldenT2 = catalog.filter((b) => b.complexityTier === 2 && b.goldAward);
    const goldenT3 = catalog.filter((b) => b.complexityTier === 3 && b.goldAward);
    expect(goldenT1).toHaveLength(0);
    expect(goldenT2.length).toBeLessThanOrEqual(1);
    expect(goldenT3.length).toBeGreaterThanOrEqual(2);
  });
});

describe("mash bill complexity tier — representative snapshots", () => {
  it("tier 1 representative — Knob's End 90", () => {
    const bill = defaultMashBillCatalog().find((b) => b.defId === "knobs_end_90")!;
    expect(bill.complexityTier).toBe(1);
    expect(bill.recipe ?? {}).toEqual({});
    expect(bill.rewardGrid).toEqual([
      [2, 3],
      [3, 4],
    ]);
  });

  it("tier 2 representative — Wheat Whisper", () => {
    const bill = defaultMashBillCatalog().find((b) => b.defId === "wheat_whisper")!;
    expect(bill.complexityTier).toBe(2);
    expect(bill.recipe).toEqual({ minWheat: 1, maxRye: 0 });
    expect(peakReward(bill.rewardGrid)).toBeGreaterThanOrEqual(6);
  });

  it("tier 3 representative — Mash Bill No. 7", () => {
    const bill = defaultMashBillCatalog().find((b) => b.defId === "mash_bill_no_7")!;
    expect(bill.complexityTier).toBe(3);
    expect(bill.recipe).toEqual({ minBarley: 1, minRye: 1, minWheat: 1 });
    expect(bill.goldAward).toBeDefined();
  });
});

function peakReward(grid: (number | null)[][]): number {
  let best = 0;
  for (const row of grid) for (const cell of row) if (cell != null && cell > best) best = cell;
  return best;
}
