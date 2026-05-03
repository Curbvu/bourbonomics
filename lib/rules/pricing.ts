/**
 * Bourbon sale pricing per GAME_RULES.md §Mash Bill Pricing.
 *
 * Each bourbon card defines its OWN age and demand band thresholds —
 * there is no shared global lookup table. The price grid is read by
 * mapping the barrel's age into the bill's `ageBands` (rows) and the
 * global market demand into the bill's `demandBands` (columns).
 *
 * Bands are 1–3 long per axis, capped per tier (common bills are simple
 * 1×1 or 2×2 grids; rarer bills may use the full 3×3). Resolution rule:
 * find the highest band index whose threshold is ≤ the value. So age 5
 * against `[2, 4, 7]` lands in row 1; demand 8 against `[3, 6, 9]` lands
 * in col 1; demand 10 lands in col 2; demand 1 against `[0, 6]` lands in
 * col 0.
 *
 * Grids are intentionally sparse — blank cells (encoded as 0 or
 * absent) pay $0. A bourbon sold into a cell with no printed price
 * simply collects nothing for that sale.
 */

import type { BourbonCardDef } from "@/lib/catalogs/types";

/** Resolved band index. 0–2 because no axis exceeds 3 bands. */
export type BandIndex = 0 | 1 | 2;
export type AgeBand = BandIndex;
export type DemandBand = BandIndex;

/**
 * Map a barrel age (in years) into one of the bill's age bands.
 * Throws on age < 2 because the engine's sale path is never supposed
 * to reach pricing for an underage barrel; UI code that needs to render
 * unsold barrels should gate on `age >= bill.ageBands[0]` first.
 */
export function ageBandFor(card: BourbonCardDef, ageYears: number): AgeBand {
  if (ageYears < 2)
    throw new Error(`Age ${ageYears} invalid — bourbon must be ≥ 2 years old to sell`);
  return resolveBand(card.ageBands, ageYears);
}

/** Map the global 0–12 demand value into one of the bill's demand bands. */
export function demandBandFor(
  card: BourbonCardDef,
  demand: number,
): DemandBand {
  return resolveBand(card.demandBands, demand);
}

/**
 * Walk the thresholds from the top down and return the first band whose
 * lower bound is ≤ value. Length-agnostic: works on 1-, 2-, or 3-element
 * threshold arrays. Returns 0 when value is below the lowest threshold
 * (the "lowest band absorbs everything beneath it" rule).
 */
function resolveBand(
  thresholds: readonly number[],
  value: number,
): BandIndex {
  for (let i = thresholds.length - 1; i >= 0; i -= 1) {
    if (value >= thresholds[i]) return i as BandIndex;
  }
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
  const cell = card.grid[row]?.[col];
  if (cell == null || cell <= 0) return { price: 0, source: "blank" };
  return { price: cell, source: "grid" };
}
