// Bourbonomics — central tuning module (ground-up revision).
//
// Every tunable number lives here so playtesting is a one-file edit. Nothing
// in this module imports game logic (type-only imports excepted). All numbers
// are PLACEHOLDER, pre-playtest.

import type { Quality, ResourceKind } from "./types";

export const CONFIG = {
  /** A barrel must reach this age before it may be sold. */
  MIN_SELL_AGE: 2,

  // --- The linear improvement ramp -----------------------------------------
  /**
   * Capital cost of a player's Nth department improvement (1-indexed): the
   * ramp rises linearly. The Nth improvement (across any department) costs
   * RAMP_BASE + (N-1) * RAMP_STEP. Per player, persists all game. `[PH]`.
   */
  RAMP_BASE: 1,
  RAMP_STEP: 1,

  // --- Demand (PLACEHOLDER) -------------------------------------------------
  /** Matrix demand axis bounds (the payoff grid's demand columns). */
  DEMAND_CAP: 12,
  DEMAND_FLOOR: 0,
  /** Demand level if a round somehow lays out no cards. `[PH]`. */
  DEMAND_FALLBACK: 2,

  // --- Resource piles -------------------------------------------------------
  /**
   * Starting card count per pile. Each pile is its own shuffled stack; quality
   * is blind within it. Cask is used by most recipes so its pile runs deepest.
   * `[PH]`.
   */
  PILE_COUNTS: { cask: 30, corn: 24, rye: 18, wheat: 18, barley: 18 } as Record<
    ResourceKind,
    number
  >,
  /**
   * 🚧 STUBBED quality distribution seeded into EVERY pile (blind upside).
   * Must sum to 1; counts are rounded, remainder topped up with Common. The
   * exact split and how quality gates payoff is an open design stub. `[PH]`.
   */
  PILE_QUALITY_SPLIT: { common: 0.6, specialty: 0.3, heritage: 0.1 } as Record<
    Quality,
    number
  >,
  /** When a pile empties, reshuffle its own discard back into it. `[PH]`. */
  PILE_RESHUFFLE_ON_EMPTY: true,

  // --- Signature-ability magnitudes (asymmetric distilleries) — all `[PH]` --
  VOLUME_BONUS: 1,
  RYE_BONUS: 2,
  AGED_PRESTIGE_MIN_AGE: 5,
  AGED_PRESTIGE: 1,

  /**
   * 🚧 STUBBED completion bonus paid on a batch's final sale. Tied to the
   * undesigned collection engine; held at 0 until that engine lands. `[PH]`.
   */
  COMPLETION_BONUS: 0,

  /** Prestige → capital (Reputation) conversion rate applied at game end. */
  PRESTIGE_TO_CAPITAL_RATE: 1,
} as const;

/**
 * Capital cost of a player's next improvement, given how many they have already
 * made and the target department's discount. The ramp is the global brake; the
 * discount is the per-distillery asymmetry. Never below 0.
 */
export function improvementCost(improvementsMade: number, discount = 0): number {
  const ramp = CONFIG.RAMP_BASE + improvementsMade * CONFIG.RAMP_STEP;
  return Math.max(0, ramp - discount);
}

/** Convert end-game prestige into capital. Single function so it is trivial to retune. */
export function prestigeToCapital(prestige: number): number {
  return prestige * CONFIG.PRESTIGE_TO_CAPITAL_RATE;
}
