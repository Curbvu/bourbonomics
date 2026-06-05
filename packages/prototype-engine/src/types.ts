// Bourbonomics PROTOTYPE — data model.
//
// Pure typed structures, no behavior. The engine reducer (engine.ts)
// consumes a GameState + Action and returns a new GameState. Keep this
// module dependency-free so it can be imported by both the engine and
// the UI without dragging logic along.

// ---------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------

/** Quality tier of a resource / finished bourbon. Higher = scarcer & better. */
export type Quality = "common" | "specialty" | "heritage";

/** Kinds of resource cards drawn from the communal deck. */
export type ResourceKind = "cask" | "corn" | "grain";

/**
 * Bourbon flavor traits, derived from a mash bill. Marketing cards gate on
 * these. Free-form strings keep placeholder content easy to extend.
 */
export type Trait = string;

// ---------------------------------------------------------------------
// Cards & content
// ---------------------------------------------------------------------

export interface ResourceCard {
  id: string;
  defId: string;
  kind: ResourceKind;
  quality: Quality;
  name: string;
  /** PLACEHOLDER flag — all Batch 1 content is provisional. */
  placeholder: true;
}

/**
 * A mash bill is the recipe + payoff grid for a bourbon. `recipe` lists the
 * resource kinds (with counts) that must be committed to make it. `matrix`
 * is the age×demand payoff grid inherited by the finished bourbon.
 */
export interface MashBill {
  id: string;
  defId: string;
  name: string;
  traits: Trait[];
  /**
   * House-style / grain identity (e.g. "wheated", "high-rye", "four-grain").
   * A single canonical tag — distinct from `traits`, which is a free-form
   * flavor list. Carried onto the finished Bourbon as `expression` so slot
   * cards (the Expressions line) can read a clean house-style value.
   */
  expression: string;
  /** Required resource kinds → counts. Quality of committed cards sets tier. */
  recipe: Partial<Record<ResourceKind, number>>;
  /** matrix[age][demand] → capital. Clamped at the edges on lookup. */
  matrix: number[][];
  placeholder: true;
}

/**
 * A concrete payout with no branching — the leaf of a slot reward.
 * `prestigeFromAge` is a computed payout: grant prestige equal to the
 * placed bottle's age (Flagship slot 1, intentionally uncapped).
 */
export interface RewardLeaf {
  capital?: number;
  prestige?: number;
  /** Draw this many resource cards into hand. */
  resources?: number;
  /** Computed: prestige = the placed bottle's age. */
  prestigeFromAge?: boolean;
}

/** Gate for a fallback reward (Single Barrel): a miss pays the fallback. */
export interface SlotGate {
  /** Placed bottle's age must be ≥ this. */
  minAge?: number;
  /** Placed bottle's quality must be ≥ this tier (common<specialty<heritage). */
  minQuality?: Quality;
}

/**
 * The reward a slot pays when a bottle is placed there.
 *  - flat:   a single payout.
 *  - choice: the player picks one of `options` at placement.
 *  - gated:  `hit` if the gate passes, otherwise `miss` (never blocks placement).
 */
export type SlotRewardSpec =
  | { kind: "flat"; reward: RewardLeaf }
  | { kind: "choice"; options: RewardLeaf[] }
  | { kind: "gated"; gate: SlotGate; hit: RewardLeaf; miss: RewardLeaf };

/** One slot's full specification. */
export interface SlotSpec {
  reward: SlotRewardSpec;
  /** Optional slots may be left empty with no penalty (Flagship, Expressions). */
  optional?: boolean;
  /**
   * Expressions: a placed bottle's age must EQUAL the bottle already in this
   * slot index (its "paired required"). Undefined = no pairing constraint.
   */
  matchAgeOfSlot?: number;
}

export interface SlotCard {
  id: string;
  defId: string;
  name: string;
  /** One spec per slot, indexed left→right (young→premium). */
  slots: SlotSpec[];
  /**
   * Non-decreasing age ceiling per slot, left→right — the "staircase".
   * Informational: placement enforces the age-order rule, not the ceiling.
   */
  ageCeilings: number[];
  /**
   * Expressions house-style end bonus (prestige), checked once at scoring:
   * all optional slots filled, all sharing one expression, each differing
   * from its paired required's expression. Undefined = no bonus.
   */
  houseStyleBonus?: number;
  placeholder: true;
}

/**
 * Marketing cards attach to a brand line, gate on traits, and pay prestige
 * when a matching bourbon is placed. `exclusiveGroup` enforces mutual
 * exclusivity: two cards sharing a group cannot coexist on one line.
 */
export interface MarketingCard {
  id: string;
  defId: string;
  name: string;
  /** A placed bourbon fires this card only if it has ALL of these traits. */
  requiredTraits: Trait[];
  /** Cards with the same group are mutually exclusive on a single line. */
  exclusiveGroup: string;
  /** Prestige paid each time a trait-matched bourbon is placed. */
  prestigeOnMatch: number;
  placeholder: true;
}

/** Demand forecast card: a per-round delta, optionally conditional. */
export interface ForecastCard {
  id: string;
  defId: string;
  label: string;
  delta: number;
  /** If set, the delta only applies while demand < this value. */
  onlyIfDemandBelow?: number;
  placeholder: true;
}

// ---------------------------------------------------------------------
// Runtime entities
// ---------------------------------------------------------------------

export interface Bourbon {
  id: string;
  mashBillId: string;
  name: string;
  traits: Trait[];
  /** House-style tag inherited from the mash bill (read by the Expressions line). */
  expression: string;
  /**
   * The recipe this barrel needs to be built — shown as requirements while
   * unbuilt. Copied from the mash bill when the barrel is laid down.
   */
  recipe: Partial<Record<ResourceKind, number>>;
  /**
   * False = an unbuilt barrel resting in the rickhouse (displays its recipe,
   * does NOT age, cannot be sold). Set true by MAKE_BOURBON once the required
   * resources are committed; only then does it begin aging.
   */
  built: boolean;
  /** Years rested. Starts 0, +1 per round while BUILT and in the rickhouse. */
  age: number;
  quality: Quality;
  /** Inherited from the mash bill at make time. matrix[age][demand]. */
  matrix: number[][];
  /** Round index when the bourbon was created (for the "aged ≥1 round" gate). */
  createdRound: number;
}

export interface BrandLine {
  id: string;
  slotCard: SlotCard;
  /** Filled left→right. null = empty slot. Length === slotCard.slotRewards.length. */
  slots: (Bourbon | null)[];
  /** Highest anchored age = the line's effective ceiling. null when empty. */
  ageCeiling: number | null;
  marketingCards: MarketingCard[];
}

export interface Player {
  id: string;
  name: string;
  /** Spendable currency AND the bulk of final score. */
  capital: number;
  /** Converts to capital at game end via prestigeToCapital(). */
  prestige: number;
  hand: ResourceCard[];
  /** Mash bills kept via DRAW_MASH_BILLS — reusable recipes for MAKE_BOURBON. */
  mashBills: MashBill[];
  /** Slot cards drawn via DRAW_SLOT_CARD, spent by OPEN_BRAND_LINE. */
  slotCards: SlotCard[];
  /** HARD CAP RICKHOUSE_CAPACITY. */
  rickhouse: Bourbon[];
  brandLines: BrandLine[];
  /** Actions left in the current round (round-robin, one per pass). */
  actionsRemaining: number;
  /** Set true once the first (free) marketing draw is used. */
  usedFreeMarketing: boolean;
  /** Tiebreaker counter. */
  bourbonsSold: number;
}

export type GamePhase = "playing" | "ended";

export interface GameState {
  phase: GamePhase;
  players: Player[];

  // Shared demand market.
  demand: number;
  demandForecast: ForecastCard[];
  forecastDeck: ForecastCard[];

  // Communal resource pool (shared by ALL players).
  resourceDeck: ResourceCard[];
  resourceDiscard: ResourceCard[];
  /** Face-up resource market (take-and-refill): players pick from these. */
  resourceMarket: ResourceCard[];

  // Mash bills: face-up tray (take-and-refill) + face-down supply (end clock).
  mashBillTray: MashBill[];
  mashBillSupply: MashBill[];

  // Abundant slot card designs (drawn freely).
  slotCardSupply: SlotCard[];

  // Marketing: face-up tray that refills from the deck.
  marketingTray: MarketingCard[];
  marketingDeck: MarketingCard[];

  roundNumber: number;
  startPlayerIndex: number;
  currentPlayerIndex: number;
  /** Mirror of the current player's actionsRemaining (convenience for UI). */
  actionsRemaining: number;

  /**
   * Set to the round number of the final round once the bill supply empties.
   * When that round completes, the game ends (one final equal-turn round).
   */
  finalRound: number | null;

  /** Deterministic seed threaded through every randomized step. */
  rngSeed: number;

  /** Append-only log of human-readable events (handy for the UI + tests). */
  log: string[];
}

// ---------------------------------------------------------------------
// Actions — the engine's only input surface (bot/multiplayer reuse these)
// ---------------------------------------------------------------------

export type Action =
  | { type: "DRAW_RESOURCES" }
  | { type: "TAKE_MARKET_RESOURCES"; cardIds: string[] }
  | { type: "DRAW_MASH_BILLS"; keepIndex: number }
  | { type: "DRAW_SLOT_CARD"; slotDefId?: string }
  | { type: "MAKE_BOURBON"; barrelId: string; resourceCardIds: string[] }
  | { type: "DRAW_MARKETING"; keepIndex: number; brandLineId: string }
  | { type: "OPEN_BRAND_LINE"; slotCardId: string }
  | {
      type: "SELL_BOURBON";
      bourbonId: string;
      /** Brand line to place the bottle into (required — selling mints a bottle). */
      brandLineId: string;
      /** Target slot index the player chooses (must honor the staircase). */
      slotIndex: number;
      /** For a choice-node slot: which option index the player takes. */
      rewardChoice?: number;
    };

export type ActionType = Action["type"];

/** Result of attempting an action: either the next state or a refusal. */
export type ActionResult =
  | { ok: true; state: GameState }
  | { ok: false; reason: string };
