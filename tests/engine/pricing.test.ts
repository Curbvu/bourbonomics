import { describe, expect, it } from "vitest";
import {
  ageBandFor,
  demandBandFor,
  lookupSalePrice,
} from "@/lib/rules/pricing";
import type { BourbonCardDef } from "@/lib/catalogs/types";

// Sample card with the LEGACY default thresholds:
//   Age bands:    [2, 4, 8] → Young 2–3, Aged 4–7, Well-Aged 8+
//   Demand bands: [0, 4, 7] → Low 0–3,   Mid 4–6,   High 7–12
const sampleCard: BourbonCardDef = {
  id: "TEST",
  name: "Test card",
  rarity: "Standard",
  ageBands: [2, 4, 8],
  demandBands: [0, 4, 7],
  grid: [
    [3, 5, 0], // Young: pays Low/Mid; nothing at High
    [10, 14, 18], // Aged: full row
    [0, 22, 30], // Well-Aged: nothing at Low
  ],
  awards: null,
};

// Premium card with shifted thresholds — the *same* age and demand
// values land in different cells than they would on a legacy card.
const premiumCard: BourbonCardDef = {
  id: "TEST_PREMIUM",
  name: "Premium",
  rarity: "Rare",
  ageBands: [6, 8, 10],
  demandBands: [6, 8, 12],
  grid: [
    [0, 5, 9],
    [5, 11, 16],
    [9, 16, 22],
  ],
  awards: null,
};

describe("pricing — per-bill bands", () => {
  it("ageBandFor uses the bill's own thresholds", () => {
    expect(ageBandFor(sampleCard, 2)).toBe(0);
    expect(ageBandFor(sampleCard, 7)).toBe(1);
    expect(ageBandFor(sampleCard, 8)).toBe(2);

    // 7 years is the *lowest* age band on the premium card (6–7).
    expect(ageBandFor(premiumCard, 7)).toBe(0);
    expect(ageBandFor(premiumCard, 9)).toBe(1);
    expect(ageBandFor(premiumCard, 10)).toBe(2);
  });

  it("ageBandFor rejects under-2", () => {
    expect(() => ageBandFor(sampleCard, 1)).toThrow();
    expect(() => ageBandFor(sampleCard, 0)).toThrow();
  });

  it("demandBandFor uses the bill's own thresholds", () => {
    expect(demandBandFor(sampleCard, 0)).toBe(0);
    expect(demandBandFor(sampleCard, 6)).toBe(1);
    expect(demandBandFor(sampleCard, 7)).toBe(2);

    // demand 7 is *below* the premium card's first threshold (6) → col 1
    // for premium since 7 ≥ 6 but 7 < 8. demand 11 is still col 1 (< 12).
    expect(demandBandFor(premiumCard, 5)).toBe(0);
    expect(demandBandFor(premiumCard, 7)).toBe(0);
    expect(demandBandFor(premiumCard, 8)).toBe(1);
    expect(demandBandFor(premiumCard, 11)).toBe(1);
    expect(demandBandFor(premiumCard, 12)).toBe(2);
  });

  it("looks up the grid intersection for printed cells", () => {
    expect(lookupSalePrice(sampleCard, 2, 3).price).toBe(3);
    expect(lookupSalePrice(sampleCard, 5, 5).price).toBe(14);
    expect(lookupSalePrice(sampleCard, 10, 9).price).toBe(30);
  });

  it("blank cells pay $0", () => {
    // Young × High is blank on sampleCard.
    const r1 = lookupSalePrice(sampleCard, 2, 8);
    expect(r1.price).toBe(0);
    expect(r1.source).toBe("blank");
    // Well-Aged × Low is blank on sampleCard.
    const r2 = lookupSalePrice(sampleCard, 9, 1);
    expect(r2.price).toBe(0);
    expect(r2.source).toBe("blank");
  });

  it("the same age/demand resolves differently across bills", () => {
    // Age 8, demand 7 — on the legacy card lands in the Well-Aged ×
    // High cell ($30). On the premium card it lands in the middle age
    // band (8–9) and the lowest demand band (6–7), so it pays $5.
    expect(lookupSalePrice(sampleCard, 8, 7).price).toBe(30);
    expect(lookupSalePrice(premiumCard, 8, 7).price).toBe(5);
  });

  it("demand 0 still uses the Low column", () => {
    expect(lookupSalePrice(sampleCard, 5, 0).price).toBe(10);
  });
});
