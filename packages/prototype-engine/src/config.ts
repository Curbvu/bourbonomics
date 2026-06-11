// Bourbonomics PROTOTYPE — central tuning module.
//
// Every tunable number in the prototype lives here so playtesting is a
// one-file edit. Nothing in this module imports game logic (type-only
// imports excepted); it is pure data + the two scalar conversion functions
// used at scoring time.

import type { Quality, ResourceKind } from "./types";

export const CONFIG = {
  /** Actions each player spends per round (round-robin, one per pass). */
  ACTIONS_PER_ROUND: 6,
  /** Shared demand LEVEL ceiling / floor (the matrix demand axis). */
  DEMAND_CAP: 12,
  DEMAND_FLOOR: 0,
  /** Demand level at game start. `[PH]`. */
  DEMAND_START: 2,
  /**
   * Global rising trend: the demand level drifts +1 every this-many rounds at
   * the Year Pass (on top of the flood band). Patient play is rewarded; the
   * early game is naturally quiet. `[PH]`.
   */
  DEMAND_RISE_EVERY: 2,
  /** Max marketing cards attachable to a single brand line. */
  MARKETING_STACK_CAP: 3,
  /** Capital cost to draw marketing (the very first draw of the game is free). */
  MARKETING_DRAW_COST: 1,
  /** Base capital cost to open a brand line; escalates per existing line. */
  OPEN_LINE_BASE_COST: 1,
  /** Soft ceiling on brand lines per player (not hard-enforced; informational). */
  MAX_BRAND_LINES: 4,
  /** A barrel must reach this age before it may be sold. */
  MIN_SELL_AGE: 2,
  /**
   * Flat Capital paid on the FINAL extraction of a batch (the completion
   * bonus). Attached to the final-sale event, NOT per unit — bunching all
   * sales at once must not earn more bonus. `[PH]` — pre-playtest.
   */
  COMPLETION_BONUS: 1,
  /** Signature-ability magnitudes (asymmetric distilleries). All `[PH]`. */
  VOLUME_BONUS: 1,
  RYE_BONUS: 2,
  AGED_PRESTIGE_MIN_AGE: 5,
  AGED_PRESTIGE: 1,

  // --- Collection: five type-sorted piles + Collect ------------------------
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
   * Quality distribution seeded into EVERY pile (blind upside variance). Must
   * sum to 1; counts are rounded, remainder topped up with Common. `[PH]`.
   */
  PILE_QUALITY_SPLIT: { common: 0.6, specialty: 0.3, heritage: 0.1 } as Record<
    Quality,
    number
  >,
  /**
   * When a pile empties, reshuffle its own discard back into it. Per-type so
   * each pile stays self-contained. `[PH]`.
   */
  PILE_RESHUFFLE_ON_EMPTY: true,
  /** Capital charged per paid OVERFLOW draw beyond the free Supply Room budget. `[PH]`. */
  OVERFLOW_COST: 1,

  MASH_BILL_OFFER: 3,
  MARKETING_OFFER: 3,
  /** Tray sizes (face-up, take-and-refill). */
  MASH_BILL_TRAY_SIZE: 3,
  MARKETING_TRAY_SIZE: 4,
  /** Slots a brand line may hold at most (slot cards define their own count <= this). */
  MAX_SLOTS_PER_LINE: 6,
  /** Prestige → capital conversion rate applied at game end. */
  PRESTIGE_TO_CAPITAL_RATE: 1,
} as const;

/**
 * Collection brakes — both OFF by default; flat OVERFLOW_COST per draw is live.
 * Behind config so the "fixed free pool + paid overflow" model can be tightened
 * after playtest without touching the loop.
 *   - overflowEscalating:  first overflow +1, second +2, third +3, … (mirrors
 *                          the Open Brand Line escalation). When false, every
 *                          overflow draw is the flat OVERFLOW_COST.
 *   - overflowPerRoundCap: optional hard cap on bought (overflow) draws per
 *                          round. null = no cap.
 */
export const FLAGS = {
  overflowEscalating: false,
  overflowPerRoundCap: null as number | null,
} as const;

/** Escalating cost to open the Nth brand line (existingCount lines already open). */
export function openLineCost(existingCount: number): number {
  return CONFIG.OPEN_LINE_BASE_COST + existingCount;
}

/** Convert end-game prestige into capital. Single function so it is trivial to retune. */
export function prestigeToCapital(prestige: number): number {
  return prestige * CONFIG.PRESTIGE_TO_CAPITAL_RATE;
}
