/**
 * Bourbon sale pricing per GAME_RULES.md §Mash Bill Pricing.
 *
 * Each bourbon card defines its OWN age and demand band thresholds —
 * there is no shared global lookup table. The 3×3 price grid is read
 * by mapping the barrel's age into the bill's `ageBands` (rows) and
 * the global market demand into the bill's `demandBands` (columns).
 *
 * Band resolution rule: find the highest band index whose threshold
 * is ≤ the value. So age 5 against `[2, 4, 7]` lands in row 1; demand
 * 8 against `[3, 6, 9]` lands in col 1; demand 10 lands in col 2.
 *
 * Grids are intentionally sparse — blank cells (encoded as 0 or
 * absent) pay $0. A bourbon sold into a cell with no printed price
 * simply collects nothing for that sale.
 */

import type { BourbonCardDef } from "@/lib/catalogs/types";

export type AgeBand = 0 | 1 | 2;
export type DemandBand = 0 | 1 | 2;

/**
 * Map a barrel age (in years) into one of the bill's three age bands.
 * Throws on age < 2 because the engine's sale path is never supposed
 * to reach pricing for an underage barrel; UI code that needs to render
 * unsold barrels should gate on `age >= bill.ageBands[0]` first.
 */
export function ageBandFor(card: BourbonCardDef, ageYears: number): AgeBand {
  if (ageYears < 2)
    throw new Error(`Age ${ageYears} invalid — bourbon must be ≥ 2 years old to sell`);
  return resolveBand(card.ageBands, ageYears);
}

/** Map the global 0–12 demand value into one of the bill's three demand bands. */
export function demandBandFor(
  card: BourbonCardDef,
  demand: number,
): DemandBand {
  return resolveBand(card.demandBands, demand);
}

function resolveBand(
  thresholds: readonly [number, number, number],
  value: number,
): 0 | 1 | 2 {
  if (value >= thresholds[2]) return 2;
  if (value >= thresholds[1]) return 1;
  return 0;
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
  const row = ageBandFor(card, ageYears);
  const col = demandBandFor(card, demand);
  const cell = card.grid[row][col];
  if (cell == null || cell <= 0) return { price: 0, source: "blank" };
  return { price: cell, source: "grid" };
}
