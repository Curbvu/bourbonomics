import type { Barrel, MashBill, MashBillRecipe } from "../types";

/**
 * Derive recipe tags for a Bottle from its source mash bill and the
 * cards committed to the barrel. Called once at sale time inside
 * `createBottleFromSale`; the result is frozen onto the Bottle and
 * read by every Line predicate thereafter.
 *
 * Recipe tags (any subset):
 *   "rye"           — recipe demands rye (minRye ≥ 1)
 *   "high-rye"      — recipe demands ≥ 3 rye
 *   "wheated"       — recipe demands wheat (minWheat ≥ 1) OR forbids
 *                     rye entirely (maxRye === 0)
 *   "barley"        — recipe demands barley (minBarley ≥ 1)
 *   "pure-corn"     — recipe demands ≥ 4 corn AND no other grain
 *   "triple-grain"  — recipe demands all three grains
 *   "single-grain"  — recipe demands exactly one grain type
 *   "neutral"       — recipe has no grain pressure (corn-only-minimum)
 */
export function deriveRecipeTags(recipe: MashBillRecipe | undefined): string[] {
  const r = recipe ?? {};
  const minRye = r.minRye ?? 0;
  const minBarley = r.minBarley ?? 0;
  const minWheat = r.minWheat ?? 0;
  const minCorn = r.minCorn ?? 0;
  const maxRye = r.maxRye;
  const tags: string[] = [];

  if (minRye >= 1) tags.push("rye");
  if (minRye >= 3) tags.push("high-rye");
  if (minWheat >= 1 || maxRye === 0) tags.push("wheated");
  if (minBarley >= 1) tags.push("barley");

  const grainKinds = [minRye > 0, minBarley > 0, minWheat > 0];
  const grainKindCount = grainKinds.filter(Boolean).length;
  if (minCorn >= 4 && grainKindCount === 0) tags.push("pure-corn");
  if (grainKindCount === 3) tags.push("triple-grain");
  if (grainKindCount === 1) tags.push("single-grain");
  if (grainKindCount === 0 && minCorn < 4) tags.push("neutral");

  return tags;
}

/**
 * Pick a single "primary" recipe tag for Variety/Depth-style
 * predicates that need a stable per-bottle identity. Priority order
 * is roughly headline-grain first.
 */
export function derivePrimaryRecipeTag(tags: readonly string[]): string {
  if (tags.includes("high-rye")) return "high-rye";
  if (tags.includes("rye")) return "rye";
  if (tags.includes("wheated")) return "wheated";
  if (tags.includes("triple-grain")) return "triple-grain";
  if (tags.includes("pure-corn")) return "pure-corn";
  if (tags.includes("barley")) return "barley";
  return "neutral";
}

/**
 * Derive the bottle's cask tag from the cask card(s) committed to
 * the barrel. Picks the highest-grade cask present:
 *   "heritage-cask"  — at least one card with cardDefId starting
 *                      with "heritage" in the cask role
 *   "specialty-cask" — at least one specialty cask (Superior, etc.)
 *   "common-cask"    — only plain casks (default)
 *
 * Reads `barrel.productionCards`. Aging cards are never casks.
 */
export function deriveCaskTag(barrel: Pick<Barrel, "productionCards">): string {
  const casks = barrel.productionCards.filter(
    (c) => c.type === "resource" && c.subtype === "cask",
  );
  if (casks.length === 0) return "common-cask";
  if (casks.some((c) => (c.cardDefId ?? "").startsWith("heritage"))) {
    return "heritage-cask";
  }
  if (casks.some((c) => c.specialty === true)) return "specialty-cask";
  return "common-cask";
}

/** Convenience: derive tags + cask tag + primary tag in one pass. */
export function deriveBottleProfile(
  bill: MashBill,
  barrel: Pick<Barrel, "productionCards">,
): {
  recipeTags: string[];
  primaryRecipeTag: string;
  caskTag: string;
} {
  const recipeTags = deriveRecipeTags(bill.recipe);
  return {
    recipeTags,
    primaryRecipeTag: derivePrimaryRecipeTag(recipeTags),
    caskTag: deriveCaskTag(barrel),
  };
}
