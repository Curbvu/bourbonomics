/**
 * Pure UI-side recipe-floor math.
 *
 * `MashBillRecipe` has six free-form fields (`minCorn`, `minRye`,
 * `minBarley`, `minWheat`, `minTotalGrain`, `minSpecialty`) that together
 * imply a per-subtype "plain need" + "specialty need" + "wildcard grain
 * slot" breakdown. Every render surface that visualises a recipe — the
 * Bourbon cards' RecipePips strip, the inspect modal's RecipeProgress and
 * RecipeGrid, the rickhouse's MashPips + BarrelNeedsPlate, MakeOverlay's
 * recipeSummary, DrawBillOverlay's BillTile chips — used to compute it
 * inline. The seven copies drifted in subtle ways (e.g. wildcard accounting
 * sometimes used basic floors, sometimes effective floors that include
 * specialty), so we consolidate the math once and have each surface read
 * the result.
 *
 * Mirrors `make-bourbon.ts::effectiveRecipeMins` for the per-subtype
 * floor (`max(basic, specialty)`) so the UI's "still needs" prompts line
 * up with what the engine actually checks at commit time. Does NOT bake
 * in distillery / pre-played discounts — those depend on player state
 * and only matter at the moment of dispatch.
 */

import type { MashBillRecipe } from "./types";

export type RecipeGrainSubtype = "cask" | "corn" | "rye" | "barley" | "wheat";

export interface SubtypeFloor {
  /** `recipe.min<Subtype>` as declared (corn has a universal floor of 1
   *  baked in; cask is always 1). */
  basic: number;
  /** `recipe.minSpecialty.<subtype>` — counts cards flagged
   *  `card.specialty === true` only. */
  specialty: number;
  /** Plain-only requirement: `max(0, basic - specialty)`. When the
   *  specialty floor fully covers the basic minimum, no plain card is
   *  needed — the visualizer should drop the redundant "1 cask" row
   *  next to "1 Specialty Cask". */
  plain: number;
  /** Effective per-subtype min the engine actually checks:
   *  `max(basic, specialty)`. A recipe with
   *  `minRye: 1, minSpecialty.rye: 2` needs 2 rye total, both specialty. */
  effective: number;
}

export interface RecipeFloors {
  cask: SubtypeFloor;
  corn: SubtypeFloor;
  rye: SubtypeFloor;
  barley: SubtypeFloor;
  wheat: SubtypeFloor;
  /** Grain-total accounting. `minTotalGrain` counts rye + barley + wheat
   *  only (corn is its own track per the engine — see
   *  make-bourbon.ts::totalGrain). */
  grain: {
    /** Sum of effective rye + barley + wheat floors. */
    namedFloor: number;
    /** Effective `minTotalGrain` floor (≥1; universal-rule fallback). */
    total: number;
    /** Slots beyond the named floor — fillable with any grain. */
    wildSlots: number;
  };
  /** `recipe.maxRye === 0` — explicit "this bill forbids rye". */
  forbidsRye: boolean;
  /** `recipe.maxWheat === 0`. */
  forbidsWheat: boolean;
}

/**
 * Compute the per-subtype + grain-total breakdown for a recipe.
 *
 * Pure, deterministic, no engine state — safe to call in render
 * (and inside React's reducer if a future use-case demands it).
 */
export function computeRecipeFloors(
  recipe: MashBillRecipe | undefined,
): RecipeFloors {
  const r = recipe ?? {};
  const sp = r.minSpecialty ?? {};

  const basic = {
    cask: 1,
    corn: Math.max(1, r.minCorn ?? 0),
    rye: r.minRye ?? 0,
    barley: r.minBarley ?? 0,
    wheat: r.minWheat ?? 0,
  };
  const specialty = {
    cask: sp.cask ?? 0,
    corn: sp.corn ?? 0,
    rye: sp.rye ?? 0,
    barley: sp.barley ?? 0,
    wheat: sp.wheat ?? 0,
  };

  const buildSubtype = (sub: RecipeGrainSubtype): SubtypeFloor => ({
    basic: basic[sub],
    specialty: specialty[sub],
    plain: Math.max(0, basic[sub] - specialty[sub]),
    effective: Math.max(basic[sub], specialty[sub]),
  });

  const cask = buildSubtype("cask");
  const corn = buildSubtype("corn");
  const rye = buildSubtype("rye");
  const barley = buildSubtype("barley");
  const wheat = buildSubtype("wheat");

  const namedFloor = rye.effective + barley.effective + wheat.effective;
  const total = Math.max(
    r.minTotalGrain ?? 0,
    namedFloor === 0 ? 1 : namedFloor,
  );
  const wildSlots = Math.max(0, total - namedFloor);

  return {
    cask,
    corn,
    rye,
    barley,
    wheat,
    grain: { namedFloor, total, wildSlots },
    forbidsRye: r.maxRye === 0,
    forbidsWheat: r.maxWheat === 0,
  };
}
