import { describe, expect, it } from "vitest";
import {
  ageBand,
  demandBand,
  lookupSalePrice,
} from "@/lib/rules/pricing";
import type { BourbonCardDef } from "@/lib/catalogs/types";

// Sample card with a sparse grid: some cells are blank ($0).
//   Age bands:    Young 2–3, Aged 4–7, Well-Aged 8+
//   Demand bands: Low 0–3,  Mid 4–6,   High 7–12
const sampleCard: BourbonCardDef = {
  id: "TEST",
  name: "Test card",
  rarity: "Standard",
  grid: [
    [3, 5, 0], // Young: pays Low/Mid; nothing at High
    [10, 14, 18], // Aged: full row
    [0, 22, 30], // Well-Aged: nothing at Low
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

  it("demandBand maps correctly per current rules (Low 0–3, Mid 4–6, High 7–12)", () => {
    expect(demandBand(0)).toBe(0);
    expect(demandBand(1)).toBe(0);
    expect(demandBand(3)).toBe(0);
    expect(demandBand(4)).toBe(1);
    expect(demandBand(5)).toBe(1);
    expect(demandBand(6)).toBe(1);
    expect(demandBand(7)).toBe(2);
    expect(demandBand(12)).toBe(2);
  });

  it("looks up the grid intersection for printed cells", () => {
    expect(lookupSalePrice(sampleCard, 2, 3).price).toBe(3);
    expect(lookupSalePrice(sampleCard, 5, 5).price).toBe(14);
    expect(lookupSalePrice(sampleCard, 10, 9).price).toBe(30);
  });

  it("blank cells pay $0", () => {
    // Young × High is blank.
    const r1 = lookupSalePrice(sampleCard, 2, 8);
    expect(r1.price).toBe(0);
    expect(r1.source).toBe("blank");

    // Well-Aged × Low is blank.
    const r2 = lookupSalePrice(sampleCard, 9, 1);
    expect(r2.price).toBe(0);
    expect(r2.source).toBe("blank");
  });

  it("demand 0 still uses the Low column", () => {
    // Aged × Low (demand 0) → printed price.
    expect(lookupSalePrice(sampleCard, 5, 0).price).toBe(10);
  });
});
