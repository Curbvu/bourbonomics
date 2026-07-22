// Bourbonomics: Map Game — fit (brief §3).
//
// Fit = how many of a tile's tag SLOTS a bourbon can fill. Pure addition; no
// multiplication, no penalties, no averse term. Fit is the master variable of
// combat (brief §10) — a good attacker with matching bourbons should break a
// defense; a mediocre one should not.
//
// The rule, precisely: for each tag slot the tile presents, count how many the
// bourbon can satisfy, capped by how many the tile presents. Sum across slots.
//   - Exact tags (grain/batch/quality) match on kind+value.
//   - Thresholds (AGE) are MEET-OR-EXCEED: AGE 20 satisfies a demand for AGE 8,
//     but not AGE 23.
//   - WILDCARDS (tile-side ANYGRAIN / ANYBATCH, brief §3) are satisfied by ANY
//     bourbon carrying that category — a grain for ANYGRAIN, a batch for
//     ANYBATCH — capped by how many the tile presents. The combat floor.
//   - DEPTH: a doubled tag scores its full count only against a tile that also
//     doubles it. min(tileCount, bourbonCount) delivers this for free.

import { isThreshold, slotKey, THRESHOLD_KINDS, WILD_CATEGORY, type Tag, type ThresholdKind, type Wild } from "./tags";

/**
 * Maximum matching of threshold supply against threshold demand.
 *
 * Both sorted ascending, then each demand consumes the smallest unused value
 * that clears it. Greedy is optimal here: spending a larger value on a smaller
 * demand can never beat spending the smallest one that fits, because any demand
 * the larger value could have served is also served by anything above it.
 */
function matchThresholds(demands: number[], supply: number[]): number {
  const d = demands.slice().sort((a, b) => a - b);
  const s = supply.slice().sort((a, b) => a - b);
  let i = 0;
  let matched = 0;
  for (const demand of d) {
    while (i < s.length && s[i]! < demand) i += 1;
    if (i >= s.length) break; // nothing left clears this bar, nor any above it
    matched += 1;
    i += 1;
  }
  return matched;
}

function countExactSlots(tags: readonly Tag[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const tag of tags) {
    if (isThreshold(tag) || tag.kind === "WILD") continue; // wildcards resolve separately
    const key = slotKey(tag);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function thresholdValues(tags: readonly Tag[], kind: ThresholdKind): number[] {
  return tags.filter((t) => t.kind === kind).map((t) => t.value as number);
}

/** How many tile slots demand a given wildcard (ANYGRAIN / ANYBATCH). */
function countWild(tags: readonly Tag[], wild: Wild): number {
  return tags.filter((t) => t.kind === "WILD" && t.value === wild).length;
}

/** How many of a bourbon's tags belong to a category (GRAIN / BATCH). */
function countCategory(tags: readonly Tag[], kind: "GRAIN" | "BATCH"): number {
  return tags.filter((t) => t.kind === kind).length;
}

/** Fit of a bourbon's tag bag against a tile's tag bag. Always >= 0. */
export function fit(bourbonTags: readonly Tag[], tileTags: readonly Tag[]): number {
  let total = 0;

  const demanded = countExactSlots(tileTags);
  const supplied = countExactSlots(bourbonTags);
  for (const [key, tileCount] of demanded) {
    total += Math.min(tileCount, supplied.get(key) ?? 0);
  }

  for (const kind of THRESHOLD_KINDS) {
    total += matchThresholds(thresholdValues(tileTags, kind), thresholdValues(bourbonTags, kind));
  }

  // Wildcards: a tile ANYGRAIN slot is filled by any bourbon grain, ANYBATCH by
  // any bourbon batch. Capped by how many the tile presents (brief §3).
  for (const wild of ["ANYGRAIN", "ANYBATCH"] as const) {
    const demand = countWild(tileTags, wild);
    if (demand === 0) continue;
    total += Math.min(demand, countCategory(bourbonTags, WILD_CATEGORY[wild]));
  }

  return total;
}
