import { describe, expect, it } from "vitest";
import {
  ageBand,
  demandBand,
  lookupSalePrice,
} from "@/lib/rules/pricing";
import type { BourbonCardDef } from "@/lib/catalogs/types";

const sampleCard: BourbonCardDef = {
  id: "TEST",
  name: "Test card",
  rarity: "Standard",
  grid: [
    [3, 5, 7],
    [10, 14, 18],
    [15, 22, 30],
  ],
  awards: null,
};

describe("pricing", () => {
  it("ageBand maps correctly", () => {
    expect(ageBand(2)).toBe(0);
    expect(ageBand(3)).toBe(0);
    expect(ageBand(4)).toBe(1);
    expect(ageBand(7)).toBe(1);
    expect(ageBand(8)).toBe(2);
    expect(ageBand(99)).toBe(2);
  });

  it("ageBand rejects under-2", () => {
    expect(() => ageBand(1)).toThrow();
    expect(() => ageBand(0)).toThrow();
  });

  it("demandBand maps correctly", () => {
    expect(demandBand(1)).toBe(0); // 1 still uses Low column
    expect(demandBand(2)).toBe(0);
    expect(demandBand(3)).toBe(0);
    expect(demandBand(4)).toBe(1);
    expect(demandBand(5)).toBe(1);
    expect(demandBand(6)).toBe(2);
    expect(demandBand(12)).toBe(2);
  });

  it("looks up the grid intersection", () => {
    expect(lookupSalePrice(sampleCard, 2, 3).price).toBe(3);
    expect(lookupSalePrice(sampleCard, 5, 5).price).toBe(14);
    expect(lookupSalePrice(sampleCard, 10, 9).price).toBe(30);
  });

  it("demand 0 returns age in dollars (not the grid)", () => {
    const r = lookupSalePrice(sampleCard, 6, 0);
    expect(r.price).toBe(6);
    expect(r.source).toBe("demand_zero_fallback");
    expect(lookupSalePrice(sampleCard, 12, 0).price).toBe(12);
  });

  it("uses the grid for demand >= 1", () => {
    expect(lookupSalePrice(sampleCard, 5, 1).price).toBe(10);
  });
});
