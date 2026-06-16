// Bourbonomics — central tuning module (ground-up rebuild).
//
// Every tunable number lives here so playtesting is a one-file edit. Nothing in
// this module imports game logic (type-only imports excepted). All numbers are
// PLACEHOLDER, pre-playtest. The CLOCK is a config flag (see CLOCK_MODE).

import type { Quality, ResourceKind, Zone } from "./types";

/** Which resource the game's end-clock runs on. */
export type ClockMode = "demand_deck" | "mash_bill_supply";

export const CONFIG = {
  /** Starting Capital per player. */
  STARTING_CAPITAL: 5,

  /** A barrel must reach this age before it may be sold. No aging ceiling exists. */
  MIN_SELL_AGE: 2,

  // --- The clock -----------------------------------------------------------
  /**
   * `demand_deck` (default): completed-and-kept cards permanently deplete the
   * demand deck; crashed/cleared cards reshuffle; the game ends when the deck
   * (and its discard) can no longer be drawn from. `mash_bill_supply`: the
   * mash-bill supply is the clock (kept bills deplete it; demand reshuffles).
   */
  CLOCK_MODE: "demand_deck" as ClockMode,
  /**
   * Safety backstop: force the final round at this round number so the game
   * always terminates, even if completions can't outpace the demand crashes
   * (which can happen at higher player counts, where each card needs more
   * fills). The demand-deck clock stays the primary, earlier terminator. Set
   * null to disable. `[PH]` — a balance dial, not a fixed round count.
   */
  MAX_ROUNDS: 30 as number | null,

  // --- The linear improvement ramp -----------------------------------------
  /**
   * Capital cost of a player's Nth improvement (across any department): a single
   * shared, rising per-player price. With `improvementsMade` already done, the
   * next costs RAMP_BASE + improvementsMade * RAMP_STEP → 1, 2, 3, 4, … Per
   * player, persists all game. `[PH]`.
   */
  RAMP_BASE: 1,
  RAMP_STEP: 1,

  // --- Demand market -------------------------------------------------------
  /** Cards drawn each Demand Phase (the spine). Marketing can raise it. `[PH]`. */
  DEMAND_DRAW_PER_ROUND: 2,
  /** The table reaching this count triggers a crash (checked at the draw). */
  DEMAND_CRASH_AT: 10,
  /** Zone thresholds by total cards on the table: 1–(MID-1) Low, …–(HIGH-1) Mid, ≥HIGH High. */
  ZONE_MID_MIN: 5,
  ZONE_HIGH_MIN: 8,

  // --- Selling — age value off the track, demand zone as a multiplier ------
  // Barrel value is READ OFF A PRINTED TRACK by (tier, age) — an explicit
  // lookup, NOT a formula. Each tier climbs to the year it caps, then holds
  // (the barrel may keep physically aging with no further value). Ages between
  // listed entries hold the last value. `[PH]` — edit freely.
  AGE_VALUE_TABLE: {
    common: { 2: 1, 3: 1, 4: 2 },
    uncommon: { 2: 1, 3: 1, 4: 2, 5: 2, 6: 3 },
    rare: { 2: 1, 3: 2, 4: 2, 5: 3, 6: 3, 7: 4, 8: 4 },
    epic: { 2: 2, 3: 2, 4: 3, 5: 3, 6: 4, 7: 4, 8: 5, 9: 5, 10: 6, 11: 6, 12: 7 },
    legendary: { 2: 2, 3: 3, 4: 3, 5: 4, 6: 4, 7: 5, 8: 5, 9: 5, 10: 6, 11: 6, 12: 7, 13: 7, 14: 7, 15: 9, 16: 9, 17: 9, 18: 11 },
  } as Record<Quality, Record<number, number>>,
  /** The year each tier's value caps (value stops climbing; the barrel may age on). `[PH]`. */
  QUALITY_CAP_AGE: { common: 4, uncommon: 6, rare: 8, epic: 12, legendary: 18 } as Record<Quality, number>,
  /**
   * Demand zone MULTIPLIER on the age value — the real timing swing.
   * sale = (age value × zone mult) + additive card/premium/distribution bonuses.
   * `[PH]` — to tune swinginess, flatten AGE_VALUE_TABLE, NOT these.
   */
  ZONE_MULTIPLIER: { low: 1, mid: 2, high: 3 } as Record<Zone, number>,

  // --- Mash-bill complexity scaling ----------------------------------------
  // A bill always needs exactly 1 cask + ≥1 corn + ≥1 grain (rye/wheat/barley)
  // — the "is it bourbon" rule, no cask/corn-only recipes. Beyond that minimum,
  // every extra resource makes a richer bourbon: more batches AND/OR more
  // Capital per sale. All `[PH]`.
  /** Recipe size of the simplest legal bill (1 cask + 1 corn + 1 grain). */
  COMPLEXITY_MIN: 3,
  /** batchQty = BATCH_BASE + floor((complexity − MIN) × BATCH_PER). */
  COMPLEXITY_BATCH_BASE: 2,
  COMPLEXITY_BATCH_PER: 0.5,
  /** Per-sale Capital premium = (complexity − MIN) × SALE_BONUS_PER. */
  COMPLEXITY_SALE_BONUS_PER: 1,

  // --- Resource piles ------------------------------------------------------
  /** Starting card count per pile. Cask is used by most recipes so it runs deepest. `[PH]`. */
  PILE_COUNTS: { cask: 30, corn: 24, rye: 18, wheat: 18, barley: 18 } as Record<ResourceKind, number>,
  /**
   * Quality distribution seeded blind into EVERY pile — Legendary very rare,
   * Common abundant (the rare-drop dopamine moment). Must sum to ~1. `[PH]`.
   */
  PILE_QUALITY_SPLIT: { common: 0.45, uncommon: 0.28, rare: 0.17, epic: 0.08, legendary: 0.02 } as Record<Quality, number>,
  /** When a pile empties, reshuffle its own discard back into it. `[PH]`. */
  PILE_RESHUFFLE_ON_EMPTY: true,

  // --- Ultimate magnitudes (built branches; the rest are "ph" stubs) --------
  ULT_MEGA_EXPANSION: 2, // Rickhouse: +2 capacity
  ULT_CLIMATE_EXTRA_AGE: 1, // Rickhouse: designated barrel ages +1 extra (→ +2/round)
  ULT_CHAR_TOAST_START_AGE: 1, // Rickhouse: barrels start at age 1
  ULT_DOUBLE_MATURATION_AGE: 8, // Rickhouse: at this age, +1 batchQty (once)
  ULT_DOUBLE_MATURATION_BONUS: 1,
  ULT_WAREHOUSE_TASTING_MIN: 3, // Rickhouse: with ≥3 aging barrels, +Capital/round
  ULT_WAREHOUSE_TASTING_CAPITAL: 1,
  ULT_OVERFLOW_ROLL: 2, // Supply: +2 dice
  ULT_GRAND_WAREHOUSE: 3, // Warehouse: +3 hold cap
} as const;

/**
 * Capital cost of a player's next improvement, given how many they have already
 * made and a discount (per-department + Counting House). The ramp is the global
 * brake; the discount is the per-distillery asymmetry. Never below 0.
 */
export function improvementCost(improvementsMade: number, discount = 0): number {
  const ramp = CONFIG.RAMP_BASE + improvementsMade * CONFIG.RAMP_STEP;
  return Math.max(0, ramp - discount);
}

/** The demand zone read from the number of cards currently on the table. */
export function zoneForCardCount(count: number): Zone {
  if (count >= CONFIG.ZONE_HIGH_MIN) return "high";
  if (count >= CONFIG.ZONE_MID_MIN) return "mid";
  return "low";
}

/**
 * Barrel value read off the printed age track by (tier, age) — a 1-D lookup,
 * NOT a formula. Below MIN_SELL_AGE it's 0; at/above the tier's cap it holds the
 * cap value; ages between listed entries hold the last listed value.
 */
export function barrelValue(quality: Quality, age: number): number {
  if (age < CONFIG.MIN_SELL_AGE) return 0;
  const table = CONFIG.AGE_VALUE_TABLE[quality];
  const lookAge = Math.min(age, CONFIG.QUALITY_CAP_AGE[quality]);
  let val = 0;
  for (let a = CONFIG.MIN_SELL_AGE; a <= lookAge; a++) {
    const v = table[a];
    if (v !== undefined) val = v; // hold-forward: keep the last listed value
  }
  return val;
}

/** The demand zone multiplier applied to age value at sale time. */
export function zoneMultiplier(zone: Zone): number {
  return CONFIG.ZONE_MULTIPLIER[zone];
}

/** The age at which a tier's track value caps (for UI / hints). */
export function capAge(quality: Quality): number {
  return CONFIG.QUALITY_CAP_AGE[quality];
}

/** Total resources a recipe requires (its complexity). */
export function recipeComplexity(recipe: Partial<Record<ResourceKind, number>>): number {
  return (Object.values(recipe) as (number | undefined)[]).reduce<number>((s, n) => s + (n ?? 0), 0);
}

/** Sales a batch yields, scaled up by recipe complexity. */
export function batchQtyForRecipe(recipe: Partial<Record<ResourceKind, number>>): number {
  const over = Math.max(0, recipeComplexity(recipe) - CONFIG.COMPLEXITY_MIN);
  return CONFIG.COMPLEXITY_BATCH_BASE + Math.floor(over * CONFIG.COMPLEXITY_BATCH_PER);
}

/** Per-sale Capital premium a bill earns for being more complex than the minimum. */
export function saleBonusForRecipe(recipe: Partial<Record<ResourceKind, number>>): number {
  const over = Math.max(0, recipeComplexity(recipe) - CONFIG.COMPLEXITY_MIN);
  return over * CONFIG.COMPLEXITY_SALE_BONUS_PER;
}

/**
 * How many slots a card activates at a given player count. A card's fill is the
 * player count times its `slotMultiple` (1 = one fill per player; 2 = two, etc.),
 * so a slot always belongs to exactly one player-share of demand.
 */
export function activeSlotsForPlayerCount(playerCount: number, slotMultiple: number): number {
  return Math.max(1, slotMultiple) * Math.max(1, playerCount);
}
