/**
 * Mash bill validation per GAME_RULES.md §Making Bourbon:
 *   - exactly 1 cask
 *   - ≥1 corn
 *   - ≥1 grain (barley, rye, or wheat)
 *   - total resource cards ≤ 6
 */

import type { ResourceType } from "@/lib/catalogs/types";
import type { ResourceCardInstance } from "@/lib/engine/state";

const GRAIN_TYPES: ResourceType[] = ["barley", "rye", "wheat"];

export type MashBreakdown = {
  cask: number;
  corn: number;
  barley: number;
  rye: number;
  wheat: number;
  grain: number;
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
    total: 0,
  };
  for (const r of mash) {
    b[r.resource] += 1;
    b.total += 1;
  }
  b.grain = b.barley + b.rye + b.wheat;
  return b;
}

export type MashValidation = { ok: true } | { ok: false; reason: string };

export function validateMash(
  mash: readonly ResourceCardInstance[],
): MashValidation {
  const b = summarizeMash(mash);

  if (b.total === 0) return { ok: false, reason: "Mash is empty" };
  if (b.total > 6)
    return { ok: false, reason: `Mash has ${b.total} cards (max 6)` };
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

  return { ok: true };
}

export const MASH_GRAIN_TYPES = GRAIN_TYPES;
