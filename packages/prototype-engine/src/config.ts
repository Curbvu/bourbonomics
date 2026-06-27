// Bourbonomics — central tuning module (ground-up rebuild).
//
// Every tunable number lives here so playtesting is a one-file edit. Nothing in
// this module imports game logic (type-only imports excepted). All numbers are
// PLACEHOLDER, pre-playtest. The CLOCK is a config flag (see CLOCK_MODE).

import type { Quality, ResourceKind, Zone } from "./types";

export const CONFIG = {
  /** Starting Capital per player. */
  STARTING_CAPITAL: 5,

  /** A barrel must reach this age before it may be sold. No aging ceiling exists. */
  MIN_SELL_AGE: 2,

  // --- The clock -----------------------------------------------------------
  /**
   * THE clock: the game ends the round any player has COMPLETED this many demand
   * cards (kept as Reputation). The demand deck and mash-bill supply are both
   * renewable — neither depletes the game. `[PH]`.
   */
  COMPLETE_TO_WIN: 8,
  /**
   * Safety backstop ONLY (not the design clock): force the final round at this
   * round number so a game always terminates even if no one reaches
   * COMPLETE_TO_WIN (can happen at high player counts / with passive bots). Set
   * null to disable. `[PH]`.
   */
  MAX_ROUNDS: 60 as number | null,

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
  DEMAND_DRAW_PER_ROUND: 1,
  /** Cards on the table at game start (and after a Hot reset) — a single gentle, open card. `[PH]`. */
  DEMAND_START_CARDS: 1,
  /** Fillable slots per demand card = this × player count (uniform, deep cards). `[PH]`. */
  DEMAND_SLOTS_PER_PLAYER: 2,
  /** The table reaching this count triggers a (passive overflow) crash, checked at the draw. */
  DEMAND_CRASH_AT: 7,
  /** Zone thresholds by total cards on the table: 1–(MID-1) Low, …–(HIGH-1) Mid, ≥HIGH Hot. */
  ZONE_MID_MIN: 4,
  ZONE_HIGH_MIN: 6,

  // --- Selling — value off the track, demand zone as a multiplier ----------
  // Barrel value is READ OFF A PRINTED TRACK by (tier, age) — an explicit
  // lookup, NOT a formula. Each tier climbs to the year it caps, then holds
  // (the barrel may keep physically aging with no further value). Ages between
  // listed entries hold the last value. A sale = (age value + the matched
  // order's value) × the demand-zone MULTIPLIER. There is no recipe premium and
  // no Distribution add-on — the order's value (card_bonus) is the only additive
  // term. `[PH]` — edit freely.
  // Age → value as THREE PHASES (younger / prime / older). A bourbon sells for
  // one of three values depending on where its age sits relative to its mash
  // bill's PRIME window (e.g. 6–8 yrs): too young (pre-prime), prime (the peak,
  // in [start,end]), or past-prime (older). The magnitudes scale with QUALITY —
  // a Legendary's prime beats a Common's. `[PH]`.
  AGE_PHASE_VALUE: {
    common: { younger: 1, prime: 2, older: 1 },
    uncommon: { younger: 1, prime: 3, older: 2 },
    rare: { younger: 2, prime: 4, older: 3 },
    epic: { younger: 2, prime: 6, older: 4 },
    legendary: { younger: 3, prime: 8, older: 5 },
  } as Record<Quality, { younger: number; prime: number; older: number }>,
  /** Default prime window (inclusive years) for a mash bill that doesn't set one. `[PH]`. */
  PRIME_DEFAULT: { start: 6, end: 8 },
  /**
   * Demand zone MULTIPLIER — a simple ×1 / ×2 / ×3 for Low / Mid / High, read
   * from the number of cards on the table. It scales the bourbon's age-phase
   * value at sale time (the only payout term). `[PH]`.
   */
  ZONE_MULTIPLIER: { low: 1, mid: 2, high: 3 } as Record<Zone, number>,

  // --- batchQty: number of sales a built barrel yields, by QUALITY tier -----
  // A barrel's batchQty is set by its built QUALITY (Common one-and-done →
  // Legendary up to 3), NOT by its recipe. This is the baseline curve; a mash
  // bill may carry a per-card `batchQtyBias` (+/−) for off-curve variance (e.g.
  // a Common bill that still yields 2). Data-driven, not a hard formula. `[PH]`.
  BATCHQTY_BY_QUALITY: { common: 1, uncommon: 1, rare: 2, epic: 2, legendary: 3 } as Record<Quality, number>,
  /** Hard clamp on batchQty after the quality baseline + per-bill bias. `[PH]`. */
  BATCHQTY_MIN: 1,
  BATCHQTY_MAX: 3,

  // --- Mash-bill complexity rule -------------------------------------------
  // A bill always needs exactly 1 cask + ≥1 corn + ≥1 grain (rye/wheat/barley)
  // — the "is it bourbon" rule, no cask/corn-only recipes. (There is no longer a
  // per-sale complexity premium — the payoff is purely age × zone + card_bonus.)
  /** Recipe size of the simplest legal bill (1 cask + 1 corn + 1 grain). */
  COMPLEXITY_MIN: 3,

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
  ULT_MASTER_RECIPE_REVEAL: 1, // Mash Floor: +1 bill revealed per Draw `[PH]`
  // Marketing "Private Demand Card": a personal order outside the zone/crash
  // count, paying at the current zone multiplier; completing it does NOT trigger
  // the Hot reset. Capacity = how many private orders you hold at once. `[PH]`.
  ULT_PRIVATE_CARD_SLOTS: 1,
} as const;

/**
 * Capital cost of a player's next improvement, given how many they have already
 * made. A single shared, rising per-player price (the global brake). The
 * optional `discount` is retained for compatibility but is 0 in the current
 * design (no Counting House, no per-distillery cost tilt). Never below 0.
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
 * The sale value of a bourbon by its age PHASE relative to its prime window:
 * 0 below MIN_SELL_AGE, then `younger` (pre-prime), `prime` (in [start,end]), or
 * `older` (past prime). Quality sets the three magnitudes.
 */
export function barrelValue(quality: Quality, age: number, primeStart: number, primeEnd: number): number {
  if (age < CONFIG.MIN_SELL_AGE) return 0;
  const v = CONFIG.AGE_PHASE_VALUE[quality];
  if (age < primeStart) return v.younger;
  if (age <= primeEnd) return v.prime;
  return v.older;
}

/** Which age phase a barrel is in (for the UI 3-phase display). */
export function barrelPhase(age: number, primeStart: number, primeEnd: number): "unsellable" | "younger" | "prime" | "older" {
  if (age < CONFIG.MIN_SELL_AGE) return "unsellable";
  if (age < primeStart) return "younger";
  if (age <= primeEnd) return "prime";
  return "older";
}

/** The demand zone multiplier (×1/×2/×3) applied to the age-phase value at sale time. */
export function zoneMultiplier(zone: Zone): number {
  return CONFIG.ZONE_MULTIPLIER[zone];
}

/** Total resources a recipe requires (its complexity). */
export function recipeComplexity(recipe: Partial<Record<ResourceKind, number>>): number {
  return (Object.values(recipe) as (number | undefined)[]).reduce<number>((s, n) => s + (n ?? 0), 0);
}

/**
 * Sales a built barrel yields, set by its QUALITY tier plus a per-bill bias for
 * off-curve variance. Clamped to [BATCHQTY_MIN, BATCHQTY_MAX]. Common = 1
 * (one-and-done); the top tiers reach 3.
 */
export function batchQtyForQuality(quality: Quality, bias = 0): number {
  const base = CONFIG.BATCHQTY_BY_QUALITY[quality] + bias;
  return Math.max(CONFIG.BATCHQTY_MIN, Math.min(CONFIG.BATCHQTY_MAX, base));
}

/**
 * How many slots a card activates at a given player count. A card's fill is the
 * player count times its `slotMultiple` (1 = one fill per player; 2 = two, etc.),
 * so a slot always belongs to exactly one player-share of demand.
 */
export function activeSlotsForPlayerCount(playerCount: number, slotMultiple: number): number {
  return Math.max(1, slotMultiple) * Math.max(1, playerCount);
}
