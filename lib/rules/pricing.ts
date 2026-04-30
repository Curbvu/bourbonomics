/**
 * Bourbon sale pricing per GAME_RULES.md §Bourbon Card Pricing.
 *
 * Market Price Guide = 3×3 grid.
 *   Age bands    (rows):    Young 2–3, Aged 4–7, Well-Aged 8+
 *   Demand bands (columns): Low 0–3, Mid 4–6, High 7–12
 *
 * Grids are intentionally sparse — blank cells pay $0. A bourbon sold into a
 * cell with no printed price simply collects nothing for that sale.
 */

import type { BourbonCardDef } from "@/lib/catalogs/types";

export type AgeBand = 0 | 1 | 2; // Young 2–3, Aged 4–7, Well-Aged 8+
export type DemandBand = 0 | 1 | 2; // Low 0–3, Mid 4–6, High 7–12

export function ageBand(ageYears: number): AgeBand {
  if (ageYears < 2)
    throw new Error(`Age ${ageYears} invalid — bourbon must be ≥ 2 years old to sell`);
  if (ageYears <= 3) return 0;
  if (ageYears <= 7) return 1;
  return 2;
}

export function demandBand(demand: number): DemandBand {
  if (demand <= 3) return 0;
  if (demand <= 6) return 1;
  return 2;
}

export type PriceLookupResult = {
  price: number;
  /** "grid" for a printed cell, "blank" when the grid cell has no price ($0). */
  source: "grid" | "blank";
};

export function lookupSalePrice(
  card: BourbonCardDef,
  ageYears: number,
  demand: number,
): PriceLookupResult {
  const row = ageBand(ageYears);
  const col = demandBand(demand);
  const cell = card.grid[row][col];
  // Blank cells (encoded as 0 or missing) pay nothing.
  if (cell == null || cell <= 0) return { price: 0, source: "blank" };
  return { price: cell, source: "grid" };
}
