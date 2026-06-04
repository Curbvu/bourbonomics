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
  /** Shared demand track ceiling / floor. */
  DEMAND_CAP: 12,
  DEMAND_FLOOR: 0,
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
  /** Cards drawn / kept per draft action. */
  RESOURCE_DRAW_COUNT: 3,
  MASH_BILL_OFFER: 3,
  MARKETING_OFFER: 3,
  /** Tray sizes (face-up, take-and-refill). */
  MASH_BILL_TRAY_SIZE: 3,
  MARKETING_TRAY_SIZE: 4,
  /** Visible demand forecast cards. */
  FORECAST_VISIBLE: 2,
  /** Slots a brand line may hold at most (slot cards define their own count <= this). */
  MAX_SLOTS_PER_LINE: 6,
  /** Prestige → capital conversion rate applied at game end. */
  PRESTIGE_TO_CAPITAL_RATE: 1,
} as const;

/** Escalating cost to open the Nth brand line (existingCount lines already open). */
export function openLineCost(existingCount: number): number {
  return CONFIG.OPEN_LINE_BASE_COST + existingCount;
}

/** Convert end-game prestige into capital. Single function so it is trivial to retune. */
export function prestigeToCapital(prestige: number): number {
  return prestige * CONFIG.PRESTIGE_TO_CAPITAL_RATE;
}
