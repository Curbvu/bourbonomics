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

  // --- Selling — the disaggregated payoff ----------------------------------
  /** Quality base value (part 1 of barrel value). `[PH]`. */
  QUALITY_BASE: { common: 1, specialty: 2, heritage: 3 } as Record<Quality, number>,
  /** Quality age-value ceiling: barrel value stops climbing here (age is uncapped). `[PH]`. */
  QUALITY_CEILING: { common: 4, specialty: 8, heritage: 12 } as Record<Quality, number>,
  /** Capital added per year of age, before the quality ceiling. `[PH]`. */
  AGE_VALUE_PER_YEAR: 1,

  // --- Resource piles ------------------------------------------------------
  /** Starting card count per pile. Cask is used by most recipes so it runs deepest. `[PH]`. */
  PILE_COUNTS: { cask: 30, corn: 24, rye: 18, wheat: 18, barley: 18 } as Record<ResourceKind, number>,
  /** Quality distribution seeded blind into EVERY pile. Must sum to ~1. `[PH]`. */
  PILE_QUALITY_SPLIT: { common: 0.6, specialty: 0.3, heritage: 0.1 } as Record<Quality, number>,
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
 * Barrel value = quality base + age (per year), capped by the quality ceiling.
 * Physical age keeps climbing past the ceiling; the VALUE stops there. This is
 * the home of the old matrix's "low quality can't ride to high age" behavior.
 */
export function barrelValue(quality: Quality, age: number): number {
  const raw = CONFIG.QUALITY_BASE[quality] + Math.max(0, age) * CONFIG.AGE_VALUE_PER_YEAR;
  return Math.min(raw, CONFIG.QUALITY_CEILING[quality]);
}

/**
 * How many slots a card activates at a given player count. A card's fill is the
 * player count times its `slotMultiple` (1 = one fill per player; 2 = two, etc.),
 * so a slot always belongs to exactly one player-share of demand.
 */
export function activeSlotsForPlayerCount(playerCount: number, slotMultiple: number): number {
  return Math.max(1, slotMultiple) * Math.max(1, playerCount);
}
