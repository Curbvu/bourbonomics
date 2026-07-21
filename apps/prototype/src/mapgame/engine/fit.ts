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
//   - Thresholds (AGE/PROOF) are MEET-OR-EXCEED: AGE 20 satisfies a demand for
//     AGE 8, but not AGE 23.
//   - DEPTH: a doubled tag scores its full count only against a tile that also
//     doubles it. min(tileCount, bourbonCount) delivers this for free.

import { isThreshold, slotKey, THRESHOLD_KINDS, type Tag, type ThresholdKind } from "./tags";

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
    if (isThreshold(tag)) continue;
    const key = slotKey(tag);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function thresholdValues(tags: readonly Tag[], kind: ThresholdKind): number[] {
  return tags.filter((t) => t.kind === kind).map((t) => t.value as number);
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

  return total;
}
