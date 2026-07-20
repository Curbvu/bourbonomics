// Bourbonomics: Map Game — tunable constants (brief v3).
//
// Every playtest number lives here. Invariant §17.16: no numeric value is
// hard-coded at its use site. All values are [PH], pre-balance.

export const CONFIG = {
  // — Players —
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 5,

  // — Structure —
  AGES: 5,
  ROUNDS_PER_AGE: 5,
  HAND_SIZE: 5,
  TRADE_MAX: 2, // cards a player may put into the age-start Trade pile

  // — Catch-up (brief §11) —
  CATCHUP_MODE: "swap" as "swap" | "take",
  /** Cards dealt to the shared catch-up board. Default PLAYERS + 1. */
  catchUpBoardSize: (players: number) => players + 1,

  // — Setup —
  SEED_LINE_TILES: 3,
  SETUP_TILES_PER_PLAYER: 5,
  OPENING_DRAFT_PICKS: 4,
  TILE_MIN_ADJACENCY: 2,

  // — Player start —
  STARTING_CAPITAL: 5,
  DP_SUPPLY: 15, // one pool: map DPs AND market bid markers

  // — Market —
  marketLots: (players: number) => players + 1,

  // — Niches & scoring (brief §9 — the ONLY source of Capital) —
  NICHE_MIN_TILES: 5,
  CAPITAL_PER_CONTROLLED_CLAIM: 1, // tier 1
  // tier 2 (niche majority) → collect rewards on controlled reward tiles
  // tier 3 (niche monopoly) → collect ALL rewards in the niche
  // No per-tile income in v3 — controlling a tile outside a niche scores 0.

  // — The Push (brief §8) — deterministic combat —
  RETREAT_STRENGTH: 0, // commit no bourbon = strength 0
  DAMAGE_PER_MARGIN: 1, // 1 margin removes 1 of the loser's DPs, outright (one step)
  // A TIE does nothing: no tile change, no DP removal. Bourbons still deplete.

  // — Bourbon depletion / refresh (brief §7b) —
  // Committing a bourbon depletes it (win/lose/tie). Persists across ages.
  // Refresh (a Distill action) returns ONE depleted bourbon to FRESH.
  REFRESH_PER_ACTION: 1,

  // — Ownership / special tiles (brief §7, §13) —
  DEFENSE_BONUS_LOYALTY: 1, // Loyal Fanbase, Word of Mouth
  DEFENSE_BONUS_CULT_FOLLOWING: 2, // Cult Following
  DEFENSE_BONUS_KEYSTONE: 2, // State Capital
  KEYSTONE_TOKENS_PER_AGE: 1,
  BLOCKING_TILE_COUNT: 4,

  // — Action costs, in pips (all 1 today) —
  COST_BUILD_DP: 1,
  COST_REPAIR_DP: 1,
  COST_PUSH: 1,
  COST_ADD_NICHE_FLAG: 1,
  COST_REMOVE_NICHE_FLAG: 1,
  COST_EXPAND_DRAW: 1,
  COST_EXPAND_PLACE: 1,
  COST_BID: 1,
  COST_MOVE_BID: 1,
  COST_REFRESH: 1,
  COST_CLAIM_SLOT: 1, // place a DP into an empty ownership slot

  // — Hand limits —
  HELD_TILE_CAP: 1,

  // — Turn structure (brief §4, §17.15) —
  ACTION_FLOOR: 2, // a normal card grants at least this many actions
  SACRIFICE_PER_CHAINED: 1, // each chained card costs one face-down sacrifice
  SURRENDER_PIPS: 1, // a lone face-down = 1 action of ANY type, no icon

  // — Tokens —
  TOKEN_TO_ACTION: 1,
  /** Brief §10 + invariant §17.9: ship UNCAPPED. null = no cap. */
  TOKEN_STORAGE_CAP: null as null | ((controlledTiles: number) => number),
} as const;
