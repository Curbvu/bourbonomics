/**
 * v3.4 — Bill tag derivation.
 *
 * One pure function (`deriveBillTags`) computes the full tag set for
 * a bill from its recipe + tier + award eligibility. Runs once per
 * bill at the catalog edge (`defaults.ts` mints bills wired through
 * this helper; `sell-bourbon.ts` propagates the result to the Bottle).
 *
 * Taxonomy + drop rules are documented in GAME_RULES.md §Tags and
 * mirrored in `types.ts::BillTag`. Keep the derivation logic here in
 * sync with both whenever the taxonomy changes.
 */

import type { BillTag, MashBill } from "./types";

const PROFILE_DROP_ORDER: BillTag[] = [
  // Card layout supports up to 7 printed tag icons. When a bill
  // would carry more than 7 tags, drop in this order until the
  // count is ≤ 7. The drop order is documented in the brief.
  "corn-light",
  "corn-heavy",
  "single-grain",
  "triple-grain",
];

/**
 * Compute the full tag set for a bill. Order in the returned array
 * matches the canonical print order (grain, strength, profile,
 * quality, awards) so UI doesn't need to re-sort.
 *
 * Pure — does not mutate the bill. Idempotent — calling twice
 * yields the same array.
 */
export function deriveBillTags(
  bill: Pick<
    MashBill,
    "recipe" | "tier" | "silverAward" | "goldAward" | "primaryGrain"
  >,
): BillTag[] {
  const tags: BillTag[] = [];
  const recipe = bill.recipe ?? {};
  const sp = recipe.minSpecialty ?? {};

  // Grain tags — presence in the recipe (named-grain minimums).
  const minRye = recipe.minRye ?? 0;
  const minWheat = recipe.minWheat ?? 0;
  const minBarley = recipe.minBarley ?? 0;
  // Specialty-only floors also count as "the recipe demands this grain."
  const spRye = sp.rye ?? 0;
  const spWheat = sp.wheat ?? 0;
  const spBarley = sp.barley ?? 0;
  const hasRye = minRye + spRye > 0;
  const hasWheat = minWheat + spWheat > 0;
  const hasBarley = minBarley + spBarley > 0;
  if (hasRye) tags.push("rye");
  if (hasWheat) tags.push("wheat");
  if (hasBarley) tags.push("barley");

  // Strength tags — derived from the corn range.
  // `maxCorn` defaults to `minCorn` when omitted (per v3.2 backwards-
  // compat note in types.ts), so we use whichever value is set.
  const minCorn = recipe.minCorn ?? 0;
  const maxCorn = recipe.maxCorn ?? minCorn;
  if (maxCorn >= 4) tags.push("corn-heavy");
  // `corn-light` fires when the upper bound is small AND the bill
  // actually demands corn (every recipe demands ≥1 corn under v3.2,
  // so the explicit floor catches the "≤2" pressure here).
  if (maxCorn > 0 && maxCorn <= 2) tags.push("corn-light");

  // Profile tags — character of the bill. Primary by count, with the
  // optional `primaryGrain` field on the bill breaking ties.
  // Total grain commitments per named subtype (basic + specialty).
  const ryeCount = minRye + spRye;
  const wheatCount = minWheat + spWheat;
  const barleyCount = minBarley + spBarley;
  const totals = [
    { tag: "rye-heavy" as const, count: ryeCount, key: "rye" as const },
    { tag: "wheated" as const, count: wheatCount, key: "wheat" as const },
    { tag: "barley-heavy" as const, count: barleyCount, key: "barley" as const },
  ];
  const grainKinds = totals.filter((t) => t.count > 0);
  // Single-grain — exactly one grain subtype demanded by the recipe.
  if (grainKinds.length === 1) tags.push("single-grain");
  // Triple-grain — three or more distinct grain subtypes.
  if (grainKinds.length >= 3) tags.push("triple-grain");
  // Primary grain: highest count wins; ties resolved by the bill's
  // optional `primaryGrain` field; if still tied, emit neither.
  if (grainKinds.length >= 2) {
    const max = Math.max(...grainKinds.map((t) => t.count));
    const top = grainKinds.filter((t) => t.count === max);
    let primary: string | null = null;
    if (top.length === 1) {
      primary = top[0]!.key;
    } else if (bill.primaryGrain && top.some((t) => t.key === bill.primaryGrain)) {
      primary = bill.primaryGrain;
    }
    if (primary === "rye") tags.push("rye-heavy");
    if (primary === "wheat") tags.push("wheated");
    // `barley-heavy` is not in the v3.4 taxonomy — barley primary
    // emits only `barley` + (maybe) `single-grain` / `triple-grain`.
  } else if (grainKinds.length === 1) {
    // Single grain — automatically the primary.
    if (grainKinds[0]!.key === "rye") tags.push("rye-heavy");
    if (grainKinds[0]!.key === "wheat") tags.push("wheated");
  }

  // Quality tags — required components.
  const totalSpecialty =
    (sp.cask ?? 0) + (sp.corn ?? 0) + spRye + spBarley + spWheat;
  if (totalSpecialty > 0) tags.push("specialty");

  // `heritage` — the recipe demands a Heritage-grade card in at
  // least one slot. In practice Heritage and Specialty currently
  // share the `minSpecialty` floor (Heritage satisfies any
  // Specialty gate); a bill is `heritage` when its rarity is rare+
  // AND it carries a specialty floor (i.e., the slot pressure is
  // strong enough that a player commonly reaches for a Heritage).
  const isRarePlus =
    bill.tier === "rare" || bill.tier === "epic" || bill.tier === "legendary";
  if (isRarePlus && totalSpecialty > 0) tags.push("heritage");

  // `heritage-recipe` — recipe requires Heritage components in ≥ 2
  // component slots (cask + at least one grain, two grains, etc.).
  const specialtySlots =
    (sp.cask ?? 0 ? 1 : 0) +
    (sp.corn ?? 0 ? 1 : 0) +
    (spRye ? 1 : 0) +
    (spBarley ? 1 : 0) +
    (spWheat ? 1 : 0);
  if (specialtySlots >= 2) tags.push("heritage-recipe");

  // Identity tags — award eligibility.
  // `gold-eligible` always prints; `silver-eligible` is dropped
  // first when the ceiling binds.
  if (bill.silverAward) tags.push("silver-eligible");
  if (bill.goldAward) tags.push("gold-eligible");

  return applyCeiling(tags);
}

/**
 * Trim a tag list down to 7 entries by dropping in priority order.
 *
 *   1. `corn-light` / `corn-heavy`
 *   2. `single-grain` / `triple-grain`
 *   3. `silver-eligible` (only if `gold-eligible` is also present —
 *      `gold-eligible` always prints)
 *   4. `specialty` (only if `heritage` is also present)
 *
 * The 7-tag ceiling is unlikely to bind in practice. Exposed for
 * testability; `deriveBillTags` calls it internally.
 */
export function applyCeiling(tags: BillTag[]): BillTag[] {
  if (tags.length <= 7) return tags;
  const out = tags.slice();
  // Step 1 + 2 — drop corn / single/triple grain markers.
  for (const candidate of PROFILE_DROP_ORDER) {
    if (out.length <= 7) break;
    const i = out.indexOf(candidate);
    if (i >= 0) out.splice(i, 1);
  }
  // Step 3 — drop silver if gold is present.
  if (out.length > 7 && out.includes("gold-eligible")) {
    const i = out.indexOf("silver-eligible");
    if (i >= 0) out.splice(i, 1);
  }
  // Step 4 — drop specialty if heritage is present.
  if (out.length > 7 && out.includes("heritage")) {
    const i = out.indexOf("specialty");
    if (i >= 0) out.splice(i, 1);
  }
  return out;
}
