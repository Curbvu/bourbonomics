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

  it("Tier 1 bills run a single-axis grid (1×N or N×1, exactly 2 cells)", () => {
    const t1 = defaultMashBillCatalog().filter((b) => b.complexityTier === 1);
    for (const bill of t1) {
      const rows = bill.rewardGrid.length;
      const cols = bill.rewardGrid[0]!.length;
      const total = rows * cols;
      expect(
        rows === 1 || cols === 1,
        `${bill.defId} is ${rows}×${cols}; tier 1 must be single-axis`,
      ).toBe(true);
      expect(total, `${bill.defId} has ${total} cells; tier 1 must have 2`).toBe(2);
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
    // Commons run a slim single-axis grid (1×2 or 2×1) so beginners
    // can read them at a glance. Knob's End leans on age.
    expect(bill.rewardGrid).toEqual([[2], [4]]);
  });

  it("tier 2 representative — Wheat Whisper (wheated, mid-demand peak)", () => {
    const bill = defaultMashBillCatalog().find((b) => b.defId === "wheat_whisper")!;
    expect(bill.complexityTier).toBe(2);
    // v2.7.2: uncommons require ≥2 named grain. Wheat Whisper is the
    // wheated specialist — minWheat 2, no rye allowed.
    expect(bill.recipe).toEqual({ minWheat: 2, maxRye: 0 });
    expect(peakReward(bill.rewardGrid)).toBeGreaterThanOrEqual(6);
  });

  it("tier 3 representative — Mash Bill No. 7 (epic, requires specialty rye)", () => {
    const bill = defaultMashBillCatalog().find((b) => b.defId === "mash_bill_no_7")!;
    expect(bill.complexityTier).toBe(3);
    // v2.7.2: epics gate top payouts behind a specialty card.
    expect(bill.recipe).toEqual({
      minBarley: 1,
      minRye: 1,
      minWheat: 1,
      minSpecialty: { rye: 1 },
    });
    expect(bill.goldAward).toBeDefined();
  });
});

function peakReward(grid: (number | null)[][]): number {
  let best = 0;
  for (const row of grid) for (const cell of row) if (cell != null && cell > best) best = cell;
  return best;
}

describe("mash bill rarity ramp (v2.7.2)", () => {
  it("commons carry no recipe constraints (universal rule only)", () => {
    // Cornbread Line is the lone exception — minCorn: 2 still keeps it
    // grain-unconstrained.
    const commons = defaultMashBillCatalog().filter((b) => b.tier === "common");
    for (const bill of commons) {
      const r = bill.recipe ?? {};
      expect(r.minRye ?? 0, `${bill.defId} has minRye constraint`).toBe(0);
      expect(r.minBarley ?? 0, `${bill.defId} has minBarley constraint`).toBe(0);
      expect(r.minWheat ?? 0, `${bill.defId} has minWheat constraint`).toBe(0);
      expect(r.minSpecialty, `${bill.defId} has specialty constraint`).toBeUndefined();
    }
  });

  it("uncommons require at least 2 grain (named or via minTotalGrain)", () => {
    const uncommons = defaultMashBillCatalog().filter((b) => b.tier === "uncommon");
    expect(uncommons.length).toBeGreaterThan(0);
    for (const bill of uncommons) {
      const r = bill.recipe ?? {};
      const named = (r.minRye ?? 0) + (r.minBarley ?? 0) + (r.minWheat ?? 0);
      const total = Math.max(named, r.minTotalGrain ?? 0);
      expect(total, `${bill.defId} doesn't require ≥2 grain`).toBeGreaterThanOrEqual(2);
    }
  });

  it("epics and legendaries require at least 1 specialty card", () => {
    const epics = defaultMashBillCatalog().filter(
      (b) => b.tier === "epic" || b.tier === "legendary",
    );
    expect(epics.length).toBeGreaterThan(0);
    for (const bill of epics) {
      const sp = bill.recipe?.minSpecialty ?? {};
      const total =
        (sp.cask ?? 0) +
        (sp.corn ?? 0) +
        (sp.rye ?? 0) +
        (sp.barley ?? 0) +
        (sp.wheat ?? 0);
      expect(total, `${bill.defId} doesn't require any specialty`).toBeGreaterThanOrEqual(1);
    }
  });

  it("legendary requires ≥2 specialty units total", () => {
    const legs = defaultMashBillCatalog().filter((b) => b.tier === "legendary");
    expect(legs.length).toBeGreaterThan(0);
    for (const bill of legs) {
      const sp = bill.recipe?.minSpecialty ?? {};
      const total =
        (sp.cask ?? 0) +
        (sp.corn ?? 0) +
        (sp.rye ?? 0) +
        (sp.barley ?? 0) +
        (sp.wheat ?? 0);
      expect(total, `${bill.defId} legendary needs ≥2 specialty`).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("reward grids are monotonically non-decreasing (v2.8)", () => {
  /**
   * Every reward grid must rise (or hold flat) going right across
   * demand and going down across age — no backward steps. v2.8
   * dropped the earlier "grain character" curves where wheat peaked
   * mid-demand and barley peaked low; those produced cells that
   * paid less at higher demand, which read as "this card is broken"
   * in the UI.
   */
  it("every catalog bill has a monotonic reward grid", () => {
    for (const bill of defaultMashBillCatalog()) {
      const g = bill.rewardGrid;
      for (let r = 0; r < g.length; r++) {
        for (let c = 0; c < g[r]!.length; c++) {
          const cell = g[r]![c];
          if (cell == null) continue;
          const left = c > 0 ? g[r]![c - 1] : null;
          const up = r > 0 ? g[r - 1]![c] : null;
          if (left != null) {
            expect(
              cell,
              `${bill.defId} steps backward at row ${r}: ${left} → ${cell}`,
            ).toBeGreaterThanOrEqual(left);
          }
          if (up != null) {
            expect(
              cell,
              `${bill.defId} steps backward at col ${c}: ${up} → ${cell}`,
            ).toBeGreaterThanOrEqual(up);
          }
        }
      }
    }
  });
});
