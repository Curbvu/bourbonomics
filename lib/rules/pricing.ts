/**
 * Bourbon sale pricing per GAME_RULES.md §Bourbon / Bourbon Card.
 *
 * Market Price Guide = 3×3 grid.
 *   Age bands    (rows):    [2–3, 4–7, 8+]
 *   Demand bands (columns): [Low 2–3, Mid 4–5, High 6+]
 *
 * Demand = 0 → special case: sale price = age in dollars (not a grid cell).
 * Demand = 1 is between "demand is 0" and the Low band per rules; we treat
 * demand 1 the same as Low (2–3) since a single barrel of demand still pays
 * the Low cell (the rules say "≥0" fallback only at 0).
 */

import type { BourbonCardDef } from "@/lib/catalogs/types";

export type AgeBand = 0 | 1 | 2; // 2–3, 4–7, 8+
export type DemandBand = 0 | 1 | 2; // Low, Mid, High

export function ageBand(ageYears: number): AgeBand {
  if (ageYears < 2)
    throw new Error(`Age ${ageYears} invalid — bourbon must be ≥ 2 years old to sell`);
  if (ageYears <= 3) return 0;
  if (ageYears <= 7) return 1;
  return 2;
}

export function demandBand(demand: number): DemandBand {
  if (demand <= 3) return 0;
  if (demand <= 5) return 1;
  return 2;
}

export type PriceLookupResult = {
  price: number;
  /** "grid" for normal, "demand_zero_fallback" when demand == 0. */
  source: "grid" | "demand_zero_fallback";
};

export function lookupSalePrice(
  card: BourbonCardDef,
  ageYears: number,
  demand: number,
): PriceLookupResult {
  if (demand <= 0) {
    // Per rules: bourbon sells for its age in dollars when demand is 0.
    return { price: ageYears, source: "demand_zero_fallback" };
  }
  const row = ageBand(ageYears);
  const col = demandBand(demand);
  return { price: card.grid[row][col], source: "grid" };
}
