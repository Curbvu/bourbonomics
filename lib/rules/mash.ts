/**
 * Mash bill validation per GAME_RULES.md §Making Bourbon.
 *
 * Universal rules (every legal mash):
 *   - exactly 1 cask
 *   - ≥1 corn
 *   - ≥1 grain (barley, rye, or wheat)
 *   - total resource cards ≤ MAX_MASH_CARDS (currently 9)
 *
 * The total-cards cap is intentionally generous so players can pursue
 * variety mashes — e.g. 3 rye + 3 corn + 1 wheat + 1 cask (8 cards) or
 * even fuller stacks. Bill-specific recipes (MashRecipe on the bourbon
 * card) can tighten the universal rules with min/max bounds for
 * individual grains or the total grain count. Recipes can never *loosen*
 * the universal rules.
 */

import type { MashRecipe, MashRecipeBound, ResourceType } from "@/lib/catalogs/types";
import type { ResourceCardInstance } from "@/lib/engine/state";

const GRAIN_TYPES: ResourceType[] = ["barley", "rye", "wheat"];

/**
 * Hard cap on total resource cards (cask + grains) in a single mash.
 * Sized to comfortably fit variety bills like 3+3+1+1 or 4+3+1 stacks
 * without letting the mash inflate past the table's economy.
 */
export const MAX_MASH_CARDS = 9;

export type MashBreakdown = {
  cask: number;
  corn: number;
  barley: number;
  rye: number;
  wheat: number;
  /** Sum of barley + rye + wheat (the "small grains"). */
  grain: number;
  /** Sum of corn + small grains — what the recipe `grain` bound checks. */
  grainTotal: number;
  total: number;
};

export function summarizeMash(mash: readonly ResourceCardInstance[]): MashBreakdown {
  const b: MashBreakdown = {
    cask: 0,
    corn: 0,
    barley: 0,
    rye: 0,
    wheat: 0,
    grain: 0,
    grainTotal: 0,
    total: 0,
  };
  for (const r of mash) {
    b[r.resource] += 1;
    b.total += 1;
  }
  b.grain = b.barley + b.rye + b.wheat;
  b.grainTotal = b.corn + b.grain;
  return b;
}

export type MashValidation = { ok: true } | { ok: false; reason: string };

export function validateMash(
  mash: readonly ResourceCardInstance[],
  recipe?: MashRecipe,
): MashValidation {
  const b = summarizeMash(mash);

  if (b.total === 0) return { ok: false, reason: "Mash is empty" };
  if (b.total > MAX_MASH_CARDS)
    return {
      ok: false,
      reason: `Mash has ${b.total} cards (max ${MAX_MASH_CARDS})`,
    };
  if (b.cask !== 1)
    return {
      ok: false,
      reason: `Mash must include exactly 1 cask (has ${b.cask})`,
    };
  if (b.corn < 1) return { ok: false, reason: "Mash must include ≥1 corn" };
  if (b.grain < 1)
    return {
      ok: false,
      reason: "Mash must include ≥1 grain (barley, rye, or wheat)",
    };

  if (recipe) {
    for (const check of evaluateRecipe(b, recipe)) {
      if (!check.ok) return { ok: false, reason: check.failureReason };
    }
  }

  return { ok: true };
}

// ──────────────────────────────────────────────────────────────────────────
// Recipe evaluation — used by validateMash AND by the make-bourbon UI to
// render a live "what does this bill need" checklist next to the chosen
// mash bill.

export type RecipeCheckKey = ResourceType | "grain";

export type RecipeCheck = {
  key: RecipeCheckKey;
  /** Display label for the resource ("rye", "corn", "small grain"). */
  label: string;
  /** Minimum count required (0 when no min is set). */
  min: number;
  /** Maximum count allowed (null when no max is set). */
  max: number | null;
  /** Current count in the player's selected mash. */
  current: number;
  ok: boolean;
  /** Message used by validateMash when the check fails. */
  failureReason: string;
};

const LABELS: Record<RecipeCheckKey, string> = {
  cask: "cask",
  corn: "corn",
  barley: "barley",
  rye: "rye",
  wheat: "wheat",
  grain: "total grain",
};

/**
 * Build the per-recipe check list against a current mash breakdown. UI
 * code uses this to render the live checklist; the validator uses it to
 * stop on the first failure.
 */
export function evaluateRecipe(
  breakdown: MashBreakdown,
  recipe: MashRecipe,
): RecipeCheck[] {
  const out: RecipeCheck[] = [];
  for (const key of ["corn", "barley", "rye", "wheat", "grain"] as const) {
    const bound: MashRecipeBound | undefined = recipe[key];
    if (!bound) continue;
    const current =
      key === "grain" ? breakdown.grainTotal : breakdown[key];
    const min = bound.min ?? 0;
    const max = bound.max ?? null;
    const minOk = current >= min;
    const maxOk = max == null || current <= max;
    const ok = minOk && maxOk;
    const label = LABELS[key];
    let failureReason = "";
    if (!minOk) {
      failureReason = `Recipe needs ≥${min} ${label} (has ${current})`;
    } else if (!maxOk && max != null) {
      failureReason =
        max === 0
          ? `Recipe forbids ${label}`
          : `Recipe allows ≤${max} ${label} (has ${current})`;
    }
    out.push({ key, label, min, max, current, ok, failureReason });
  }
  return out;
}

export const MASH_GRAIN_TYPES = GRAIN_TYPES;
