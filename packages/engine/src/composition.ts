import type { Barrel, Card, Distillery, ResourceSubtype } from "./types";
import { resourceUnits } from "./cards";

// ============================================================
// Composition Buffs (v2.4)
//
// At sale time, examine all cards committed to the barrel
// (production cards + aging cards) and check thresholds. Each
// threshold met grants a buff that stacks with the grid reward
// and themed-card sale signals.
//
//   3+ cask units            +1 reputation (outside split)
//   3+ corn units            +1 purchasing power (bonus draw)
//   3+ of a single grain     +1 demand band for grid lookup
//                            (rye, barley, or wheat individually)
//   2+ capital cards         demand does not drop from this sale
//   all four grain types     +2 reputation (outside split)
//                            (corn + rye + barley + wheat each ≥1)
//
// Premium resources contribute their `resourceCount` (a 2-rye
// counts as 2 rye). Capital cards count as 1 toward the capital
// threshold regardless of `capitalValue`.
//
// v2.4 distillery profiles can tweak the math via
// `distillery.compositionMods`:
//   - excludeFromComposition: subtypes that count as 0 (High-Rye
//     blocks wheat; Wheated Baron blocks rye)
//   - singleGrainThreshold: lower the 3+ single-grain bar
//     (Wheated Baron triggers at 2)
//   - allGrainsDistinctThreshold: drop the 4-of-4 requirement
//     (Connoisseur fires at 3-of-4)
//   - allGrainsRep: override the +2 rep on the all-grains buff
//     (Connoisseur grants +3)
// ============================================================

export interface CompositionTotals {
  cask: number;
  corn: number;
  rye: number;
  barley: number;
  wheat: number;
  capital: number;
}

export type CompositionTrigger =
  | "cask_3"
  | "corn_3"
  | "single_grain_3"
  | "capital_2"
  | "all_grains";

export interface CompositionBuffSignals {
  /** Reputation added on top of the player-driven split. */
  bonusRep: number;
  /** Card draws added on top of the player-driven split. */
  bonusDraw: number;
  /** Demand-band offset for the grid lookup. Stacks with sale-card offsets. */
  gridDemandBandOffset: number;
  /** When true, this sale does not drop demand. */
  skipDemandDrop: boolean;
  /** Which thresholds fired — useful for UI tooltips and tests. */
  triggered: CompositionTrigger[];
}

export function emptyCompositionBuffs(): CompositionBuffSignals {
  return {
    bonusRep: 0,
    bonusDraw: 0,
    gridDemandBandOffset: 0,
    skipDemandDrop: false,
    triggered: [],
  };
}

/**
 * Tally every committed card by composition category. Resource cards
 * contribute `resourceCount` units to their subtype (and to any aliased
 * subtypes). Capital cards contribute 1 to the capital total each.
 *
 * If `excluded` is provided, those subtypes are tallied as 0 — used by
 * High-Rye House (blocks wheat) and Wheated Baron (blocks rye).
 */
export function computeCompositionTotals(
  barrel: Pick<Barrel, "productionCards" | "agingCards">,
  excluded?: ReadonlyArray<ResourceSubtype>,
): CompositionTotals {
  const all: Card[] = [
    ...(barrel.productionCards ?? []),
    ...(barrel.agingCards ?? []),
  ];
  const skip = new Set<ResourceSubtype>(excluded ?? []);
  const tallied = (sub: ResourceSubtype, units: number) => (skip.has(sub) ? 0 : units);
  const totals: CompositionTotals = {
    cask: 0,
    corn: 0,
    rye: 0,
    barley: 0,
    wheat: 0,
    capital: 0,
  };
  for (const c of all) {
    totals.cask += tallied("cask", resourceUnits(c, "cask"));
    totals.corn += tallied("corn", resourceUnits(c, "corn"));
    totals.rye += tallied("rye", resourceUnits(c, "rye"));
    totals.barley += tallied("barley", resourceUnits(c, "barley"));
    totals.wheat += tallied("wheat", resourceUnits(c, "wheat"));
    if (c.type === "capital") totals.capital += 1;
  }
  return totals;
}

/**
 * Pure read of a barrel's composition into a sale-time signal bundle.
 * Callers fold the result into the existing themed-card sale signals
 * before running the grid lookup and resolving the sale.
 *
 * `distillery` (optional) supplies per-distillery composition mods:
 * subtype exclusions, lower thresholds, and overridden bonuses.
 */
export function computeCompositionBuffs(
  barrel: Pick<Barrel, "productionCards" | "agingCards">,
  distillery?: Pick<Distillery, "compositionMods"> | null,
): CompositionBuffSignals {
  const mods = distillery?.compositionMods;
  const t = computeCompositionTotals(barrel, mods?.excludeFromComposition);
  const singleGrainBar = mods?.singleGrainThreshold ?? 3;
  const allGrainsBar = mods?.allGrainsDistinctThreshold ?? 4;
  const allGrainsRep = mods?.allGrainsRep ?? 2;
  const sig = emptyCompositionBuffs();

  if (t.cask >= 3) {
    sig.triggered.push("cask_3");
    sig.bonusRep += 1;
  }
  if (t.corn >= 3) {
    sig.triggered.push("corn_3");
    sig.bonusDraw += 1;
  }
  if (t.rye >= singleGrainBar || t.barley >= singleGrainBar || t.wheat >= singleGrainBar) {
    sig.triggered.push("single_grain_3");
    sig.gridDemandBandOffset += 1;
  }
  if (t.capital >= 2) {
    sig.triggered.push("capital_2");
    sig.skipDemandDrop = true;
  }
  const distinctGrains =
    (t.corn >= 1 ? 1 : 0) +
    (t.rye >= 1 ? 1 : 0) +
    (t.barley >= 1 ? 1 : 0) +
    (t.wheat >= 1 ? 1 : 0);
  if (distinctGrains >= allGrainsBar) {
    sig.triggered.push("all_grains");
    sig.bonusRep += allGrainsRep;
  }

  return sig;
}
