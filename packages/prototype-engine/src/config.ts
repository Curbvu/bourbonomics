// Bourbonomics PROTOTYPE — central tuning module.
//
// Every tunable number in the prototype lives here so playtesting is a
// one-file edit. Nothing in this module imports game logic; it is pure
// data + the two scalar conversion functions used at scoring time.

export const CONFIG = {
  /** Actions each player spends per round (round-robin, one per pass). */
  ACTIONS_PER_ROUND: 6,
  /** Hard cap on barrels resting in a player's rickhouse at once. */
  RICKHOUSE_CAPACITY: 4,
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
  /** Cards taken into hand per market visit. */
  RESOURCE_DRAW_COUNT: 3,
  /** Face-up resource market size — the player picks RESOURCE_DRAW_COUNT of these. */
  RESOURCE_MARKET_SIZE: 8,
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
 * P3 feature flags. All default OFF until the base loop is tuned — flip one on
 * only when its batch lands. Kept separate from CONFIG (tuning numbers) so the
 * "is this mechanic live?" switches read at a glance.
 *   - angelsShare:        a batch held past maturity loses 1 salesRemaining.
 *   - doubleLoopSnake:    double-loop snake turn order (vs. single-pass round-robin).
 *   - marketingExtraCard: Draft Marketing may draw one extra demand card for the round.
 */
export const FLAGS = {
  angelsShare: false,
  doubleLoopSnake: false,
  marketingExtraCard: false,
} as const;

/** Escalating cost to open the Nth brand line (existingCount lines already open). */
export function openLineCost(existingCount: number): number {
  return CONFIG.OPEN_LINE_BASE_COST + existingCount;
}

/** Convert end-game prestige into capital. Single function so it is trivial to retune. */
export function prestigeToCapital(prestige: number): number {
  return prestige * CONFIG.PRESTIGE_TO_CAPITAL_RATE;
}
