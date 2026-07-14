// Bourbonomics: Map Game — tunable constants.
//
// This is the live mirror of the `[PH]` registry in docs/MAP_GAME_SPEC.md §12.
// Every playtest number lives here so tuning is one edit. When you change a
// value, update the spec's registry in the same commit.

export const CONFIG = {
  // — Structure —
  AGES: 5, // scoring windows
  ROUNDS_PER_AGE: 5, // an age is up to this many rounds (one action card each)
  HAND_SIZE: 5, // action cards drawn at age start

  // — Setup —
  TILES_PER_PLAYER: 5, // board size ≈ this × player count
  STARTING_CAPITAL: 10,
  STARTING_TOKENS: 1,
  STARTING_AGENTS: 4, // agent supply per player
  STARTING_DPS: 2, // active DPs each player begins with, on spread tiles

  // — Tiles —
  REWARD_DENSITY: 0.35, // fraction of tiles carrying a reward icon
  TILE_CAPITAL_INCOME: 2, // Capital per controlled tile, granted at age start

  // — Cellar / maturity —
  CELLAR_CAPACITY: 6, // finite; aging occupies space
  GRAB_ENTRY_SLOT: 1, // maturity slot a grabbed bourbon enters at
  COURT_ENTRY_SLOT: 3, // maturity slot a courted bourbon enters at
  // slot (1..5) → the max fit that maturity permits. Low maturity gates fit.
  MATURITY_ALLOWANCE: { 1: 1, 2: 2, 3: 2, 4: 3, 5: 3 } as Record<number, number>,

  // — Acquisition (Distill board) —
  DISTILL_ROW: 5, // face-up slots
  POSITION_PREMIUM: [0, 1, 1, 2, 3], // added to base price by slot index (0-based)
  GRAB_AGENTS: 1,
  COURT_AGENTS: 3,

  // — Action economy —
  // Action cards carry `bips` (2–4). Fewer bips ⇒ earlier initiative (inverse).
  // A face-down sacrifice yields 1 bip and last initiative.
  SACRIFICE_BIPS: 1,
  TOKEN_TO_BIP: 1, // a Token spent in prelude buys this many bips

  // — Action costs (bips) —
  COST_PLACE_TILE: 1,
  COST_BUILD_DP: 2,
  COST_REPAIR_DP: 1,
  COST_PUSH: 1,
  COST_DECLARE_NICHE: 1,
  COST_ADD_TILE_TO_NICHE: 1,
  COST_REMOVE_TILE_FROM_NICHE: 1,
  COST_DISTILL: 1,

  // — Niches —
  NICHE_MIN_TILES: 5, // below this a niche collapses

  // — v0 simplifications (flagged for later) —
  BOTS_AGGRESSIVE: false, // v0 bots don't initiate Pushes; they defend only
} as const;

/** Total cost to claim a bourbon = base price + slot position premium. */
export function totalDistillCost(basePrice: number, slotIndex: number): number {
  return basePrice + (CONFIG.POSITION_PREMIUM[slotIndex] ?? 0);
}

/** Max fit a bourbon at maturity `slot` (1..5) may reach. */
export function maturityAllowance(slot: number): number {
  return CONFIG.MATURITY_ALLOWANCE[Math.max(1, Math.min(5, slot))] ?? 3;
}
