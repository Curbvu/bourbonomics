// Bourbonomics — data model (ground-up rebuild to the new GAME_RULES.md).
//
// Pure typed structures, no behavior. The engine reducer (engine.ts) consumes
// a GameState + Action and returns a new GameState. Keep this module
// dependency-free so it can be imported by both the engine and the UI without
// dragging logic along.
//
// The round runs in three phases — Demand → Collect → Play. The demand market
// is a PERSISTENT CARD PILE (zones by count, crash at the 10th card, slots that
// scale to player count, completed cards kept by the completer as Reputation).
// Selling uses a DISAGGREGATED payoff (barrel value + zone effect + card
// alignment) — there is no age×demand matrix. Departments are Polytopia-shape
// branches (Base → +1 → +1 → Ultimate) with per-distillery ultimate subsets.

// ---------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------

/**
 * Quality tier of a resource / finished bourbon — the WoW-style five-tier ladder
 * (Common abundant → Legendary very rare). Higher = scarcer & better.
 */
export type Quality = "common" | "uncommon" | "rare" | "epic" | "legendary";

/** The five quality tiers, low → high (handy for iteration). */
export const QUALITIES: Quality[] = ["common", "uncommon", "rare", "epic", "legendary"];

/** The five resource piles. A die face names the pile; quality is drawn blind. */
export type ResourceKind = "cask" | "corn" | "rye" | "wheat" | "barley";

/** A die face: the five resource kinds plus the wild "anything". */
export type DieFace = ResourceKind | "anything";

/**
 * A bourbon's house-style identity, derived from its mash bill `expression`.
 * Demand-card requirements match against it (the grain/style tag).
 */
export type StyleTag = "rye" | "wheat" | "barley" | "highCorn" | "fourGrain" | "classic";

/** The demand zone, read from the number of cards on the table. */
export type Zone = "low" | "mid" | "high";

/** Free-form bourbon flavor traits, derived from a mash bill. */
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
  /** PLACEHOLDER flag — all content is provisional, pre-playtest. */
  placeholder: true;
}

/**
 * A mash bill is a recipe for a bourbon. `recipe` lists the resource kinds
 * (with counts) that must be committed to make it; `batchQty` is how many sales
 * the finished batch yields. The age×demand payoff matrix is GONE — payoff is
 * computed from quality + age + the demand card it fills (see §Selling).
 */
export interface MashBill {
  id: string;
  defId: string;
  name: string;
  /** Short marketing tagline shown on the wiki card (flavor, optional). */
  slogan?: string;
  traits: Trait[];
  /** House-style / grain identity (e.g. "wheated", "high-rye", "four-grain"). */
  expression: string;
  /** Canonical style tag derived from `expression` (demand requirements key off it). */
  styleTag: StyleTag;
  /**
   * Matchable tags this bourbon carries (the visual, color-coded matching axis).
   * Seeded with the grain identities; a demand card's `tags` must all be present.
   */
  tags: StyleTag[];
  /** Required resource kinds → counts. Always exactly 1 cask + ≥1 corn + ≥1 grain. */
  recipe: Partial<Record<ResourceKind, number>>;
  /**
   * Off-curve adjustment to the quality-derived batchQty (variance). 0 = on the
   * curve; the built barrel's batchQty = batchQtyForQuality(quality, bias).
   */
  batchQtyBias: number;
  /**
   * The bourbon's PRIME age window (inclusive years). Sells for `prime` value
   * inside [primeStart, primeEnd], `younger` below it, `older` above. The built
   * barrel inherits this window. `[PH]`.
   */
  primeStart: number;
  primeEnd: number;
  placeholder: true;
}

/**
 * What a bourbon must BE to fill a slot on a demand card (the "Requirement"
 * section). Any field omitted = unconstrained. `quality`/`minAge` are floors
 * (a better/older bourbon also qualifies).
 */
export interface DemandRequirement {
  /**
   * Tags the bourbon must ALL carry to fill this order (the gating axis).
   * Empty / omitted = "any bourbon" (the open, no-lockout floor).
   */
  tags?: StyleTag[];
  minAge?: number;
  quality?: Quality;
}

/**
 * A demand card. A bourbon that meets the `requirement` fills one of its slots,
 * banking that sale's value (age-phase value × zone). Completing every slot
 * hands the card to the completer for `reputation` (Prestige). 🚧 Card CONTENT
 * is placeholder; the STRUCTURE is real.
 *
 *   - `requirement`  : what a bourbon must be to fill a slot.
 *   - `reputation`   : Prestige kept by the player who completes the card.
 *   - `slotMultiple` : fills per player (1 = player count slots; 2 = twice that…).
 *   - `slotsActive`  : how many slots are live this game (= slotMultiple × players).
 *   - `filledBy`     : player id in each active slot, or null (length = slotsActive).
 */
export interface DemandCard {
  id: string;
  defId: string;
  label: string;
  requirement: DemandRequirement;
  /** Slots = slotMultiple × player count (1 = one fill per player; some cards 2×). */
  slotMultiple: number;
  slotsActive: number;
  filledBy: (string | null)[];
  reputation: number;
  placeholder: true;
}

// ---------------------------------------------------------------------
// Resource dice (Collect Phase)
// ---------------------------------------------------------------------

/** One rolled resource die in play during a Collect turn. */
export interface Die {
  id: string;
  face: DieFace;
}

// ---------------------------------------------------------------------
// Runtime entities
// ---------------------------------------------------------------------

/**
 * A bourbon is a **batch**: a single built barrel that yields `batchQty`
 * separate sales (extractions). Each extraction banks Capital (disaggregated
 * payoff) and may fill a demand-card slot; the **final** extraction frees the
 * rickhouse slot, and filling a card's final slot hands the card to the seller.
 */
export interface Bourbon {
  id: string;
  mashBillId: string;
  name: string;
  traits: Trait[];
  /** House-style expression inherited from the mash bill. */
  expression: string;
  /** Canonical style tag (demand requirements match against this). */
  styleTag: StyleTag;
  /** Matchable tags inherited from the mash bill (the demand-matching axis). */
  tags: StyleTag[];
  /** The recipe this barrel needs to be built — shown as requirements while unbuilt. */
  recipe: Partial<Record<ResourceKind, number>>;
  /** Prime age window (inclusive) inherited from the mash bill — sells for `prime` value inside it. */
  primeStart: number;
  primeEnd: number;
  /**
   * Resource cards STAGED onto this (unbuilt) barrel ahead of building. Staged
   * cards have left the Warehouse (they free hold cap) and lock to the barrel
   * (unless the Long Cellar ultimate is active). Recipe-matched; cannot exceed
   * the recipe's counts. MAKE_BOURBON builds from staged + extra loose cards.
   */
  staged: ResourceCard[];
  /**
   * False = an unbuilt barrel resting in the rickhouse (displays its recipe,
   * does NOT age, cannot be sold). Set true by MAKE_BOURBON; only then does it
   * begin aging.
   */
  built: boolean;
  /** Years rested. Starts 0 (or 1 with Char & Toast), +1 per round while BUILT. */
  age: number;
  quality: Quality;
  /** Total sales this batch yields over its life — set from QUALITY at build time. */
  batchQty: number;
  /** Off-curve batchQty adjustment inherited from the mash bill (applied at build). */
  batchQtyBias: number;
  /** Sales left before the batch is spent. Starts at `batchQty`; each sale −1. */
  salesRemaining: number;
  /** Round index when the bourbon was built (for any aged-N-rounds gating). */
  createdRound: number;
  /** Double Maturation ultimate: set once when the barrel crosses the age gate. */
  maturationBoosted: boolean;
}

// ---------------------------------------------------------------------
// Distillery board: per-player departments on a linear improvement ramp
// ---------------------------------------------------------------------

/** The five departments. All permanent, no upkeep, grown on the shared ramp. */
export type DepartmentId =
  | "rickhouse"
  | "supply"
  | "warehouse"
  | "mashFloor"
  | "marketing";

/**
 * Ultimate effects (the qualitative top of each branch). The built menus —
 * Rickhouse, Supply, Warehouse — are implemented; the other four branches'
 * ultimates are the "ph" stub. A distillery offers a SUBSET per branch.
 */
export type UltimateId =
  // Rickhouse
  | "megaExpansion"
  | "climateControlled"
  | "charToast"
  | "doubleMaturation"
  | "warehouseTasting"
  // Supply
  | "secondReroll"
  | "overflowRoll"
  | "prospector"
  | "tripleThreat"
  // Warehouse
  | "grandWarehouse"
  | "qualitySort"
  | "longCellar"
  // Mash Floor
  | "masterRecipe"
  | "houseBlend"
  | "openBill"
  // Marketing
  | "privateCard"
  // Fallback stub for any branch whose ultimate menu is still `[PH]`.
  | "ph";

/**
 * One department branch on a player's board. `level` runs 0 (base) → maxLevel
 * (the ultimate step). `values[level]` is the quantitative magnitude at that
 * level. The Capital cost of advancing comes from the per-player linear ramp
 * (see config), reduced by `discount` (the per-distillery asymmetry).
 */
export interface Department {
  id: DepartmentId;
  name: string;
  blurb: string;
  level: number;
  maxLevel: number;
  /** values[level] = the department's quantitative effect magnitude at that level. */
  values: number[];
  /** Per-department Capital discount off the linear ramp. 0 = full price. `[PH]`. */
  discount: number;
  /** Ultimate options THIS distillery offers for this branch (pick one at the top). */
  ultimateOptions: UltimateId[];
  /** The ultimate chosen when the branch reached its ultimate step; null until then. */
  chosenUltimate: UltimateId | null;
  /** Pile chosen by the Prospector ultimate (Supply), if chosen. */
  ultimatePile: ResourceKind | null;
}

/** A player's distillery — the board carrying the five departments. */
export interface DistilleryBoard {
  distilleryId: string;
  name: string;
  /** One-line description of the distillery's tilt (starting stats / offered ults). */
  blurb: string;
  departments: Department[];
  /**
   * A passive distillery signature, applied in the engine. `"copperPlus1"` =
   * Copperline Craft: once per Collect, one claimed card is drawn at +1 quality
   * tier. null = no signature. `[PH]`.
   */
  signature: "copperPlus1" | null;
}

export interface Player {
  id: string;
  name: string;
  /** True = played automatically by the AI driver; false = a human seat. */
  isBot: boolean;
  /** Spendable currency AND part of final score (banked from every sale). */
  capital: number;
  hand: ResourceCard[];
  /** Resting + aging barrels. Capacity = the Rickhouse department (+ ultimate). */
  rickhouse: Bourbon[];
  /** Per-player department board. */
  distillery: DistilleryBoard;
  /** Completed demand cards kept by this player — the sole Reputation source. */
  keptCards: DemandCard[];
  /**
   * Private demand orders this player holds (the Marketing "Private Demand Card"
   * ultimate). They live OFF the shared table — outside the zone/crash count,
   * surviving every wipe — and only this player can fill them. Empty by default.
   */
  privateCards: DemandCard[];
  /**
   * Count of improvements made across all departments. Drives the linear ramp:
   * the Nth improvement costs the Nth step. Persists all game.
   */
  improvements: number;
  /** Set true once this player has drawn mash bills this Play turn. */
  drewMashBillsThisTurn: boolean;
  /** Set true once this player has ended their Play turn this round. */
  donePlayThisRound: boolean;
  /** Quality Sort ultimate: used its free draw this round? Reset each round. */
  qualitySortUsedThisRound: boolean;
  /** Open Bill ultimate (Mash Floor): used its bonus extra draw this round? Reset each round. */
  openBillUsedThisRound: boolean;
  /** Tiebreaker / stat counters. */
  bourbonsSold: number;
  cardsCompleted: number;
}

export type GamePhase = "playing" | "ended";

/** The phase within a round. Demand → Collect → Play, then age + next round. */
export type RoundPhase = "demand" | "collect" | "play";

/**
 * Live state of the Collect Phase pass. Players act in most-Capital-first
 * order. A player INHERITS the previous player's leftover dice onto the table
 * (those count against their Supply cap); they then choose which inherited dice
 * to keep and ROLL the rest (filling up to the cap with fresh dice). Base level
 * gets no extra reroll after that first roll; the Second Reroll ultimate grants
 * one. Then they claim dice into resources (up to Warehouse cap) and pass the
 * leftovers on. A player with no inherited dice auto-rolls a fresh set.
 */
export interface CollectState {
  /** Player indices in most-Capital-first order (the pass order). */
  order: number[];
  /** Position into `order` — whose collect turn it is. */
  pos: number;
  /** Dice inherited (passed) from the previous player — already on the table this turn. */
  inherited: Die[];
  /** The active player's dice currently on the table (inherited + rolled). */
  dice: Die[];
  /** False until the active player has taken their (free) first roll this turn. */
  rolled: boolean;
  /** Extra rerolls the active player has used after the first roll. */
  rerollsUsed: number;
  /** Extra rerolls allowed after the first roll (0 base, 1 with Second Reroll). */
  maxRerolls: number;
  /** Triple Threat ultimate: used its discard-2-take-1 this turn? */
  tripleThreatUsed: boolean;
  /** Copperline signature: has the active player's +1-quality claim fired this turn? */
  signatureUsed: boolean;
}

export interface GameState {
  phase: GamePhase;
  /** Phase within the current round. */
  roundPhase: RoundPhase;
  players: Player[];

  /** The PERSISTENT demand market (the card pile). Zone is read from its length. */
  demandCards: DemandCard[];
  /** Face-down demand draw deck. Depletes permanently as cards are completed/kept. */
  demandDeck: DemandCard[];
  /** Crashed / cleared (non-kept) cards, reshuffled back into the deck when it runs low. */
  demandDiscard: DemandCard[];

  // Five type-sorted resource piles (shared by ALL players). A die face names
  // the pile; quality is drawn blind off the top. Consumed resources go to the
  // matching per-type discard, reshuffled back when the pile empties.
  piles: Record<ResourceKind, ResourceCard[]>;
  pileDiscards: Record<ResourceKind, ResourceCard[]>;

  /** Face-down mash bill supply (reshuffles rejected bills; clock in mash-bill mode). */
  mashBillSupply: MashBill[];

  /** Live Collect-Phase pass state; null outside the Collect Phase. */
  collect: CollectState | null;

  roundNumber: number;
  /** Seating order start; rotates each round. Used for the Play round-robin. */
  startPlayerIndex: number;
  /** Whose turn it is right now (collect or play). */
  currentPlayerIndex: number;

  /**
   * Set to the round number of the final round once the clock is exhausted.
   * When that round completes, the game ends (equal turns), then score.
   */
  finalRound: number | null;

  /** Deterministic seed threaded through every randomized step. */
  rngSeed: number;

  /** Append-only log of human-readable events. */
  log: string[];
}

// ---------------------------------------------------------------------
// Actions — the engine's only input surface (bot/multiplayer reuse these)
// ---------------------------------------------------------------------

export type Action =
  // --- Demand Phase ---
  // Advance from Demand → Collect (lay-out already happened on phase entry).
  | { type: "BEGIN_COLLECT" }
  // --- Collect Phase ---
  | {
      type: "COLLECT_ROLL";
      /**
       * Ids of the dice the player KEEPS; every other die on the table is
       * rerolled. The first roll of a turn also tops the table up to the Supply
       * cap with fresh dice. After that first (free) roll, extra rolls require a
       * reroll allowance (0 base, 1 with Second Reroll).
       */
      keepDiceIds: string[];
    }
  | {
      type: "COLLECT_CLAIM";
      /**
       * Dice the active player claims into resources. For an "anything" face,
       * `pile` chooses which pile to draw from; for a typed face it is ignored.
       * Unclaimed dice pass to the next player. Ends this collect turn.
       */
      claims: { dieId: string; pile?: ResourceKind }[];
    }
  | {
      // Supply "Triple Threat" ultimate: discard 2 dice, take 1 of any face.
      type: "TRIPLE_THREAT";
      discardDiceIds: string[];
      face: DieFace;
    }
  // --- Play Phase ---
  | {
      type: "DRAW_MASH_BILLS";
      /**
       * Indexes into the revealed top-of-supply offer (Mash-Floor-many bills) to
       * keep as resting barrels; the rest cycle back. Once per turn.
       */
      keepIndexes: number[];
    }
  | { type: "MAKE_BOURBON"; barrelId: string; resourceCardIds: string[] }
  | {
      type: "STAGE";
      /** Resting barrel to stage onto, and one loose card to stage (recipe-matched). */
      barrelId: string;
      resourceCardId: string;
    }
  | {
      // Warehouse "Long Cellar" ultimate: pull a staged card back to the hand.
      type: "UNSTAGE";
      barrelId: string;
      resourceCardId: string;
    }
  | {
      // Warehouse "Quality Sort" ultimate: one free blind draw/round (respects cap).
      type: "QUALITY_SORT";
      pile: ResourceKind;
    }
  | {
      // Route a single sale to a demand-card slot (demandCardId) or the glut (omit).
      type: "SELL";
      bourbonId: string;
      demandCardId?: string;
    }
  | {
      type: "IMPROVE";
      departmentId: DepartmentId;
      /** Required when advancing into the ultimate step (level → maxLevel). */
      ultimateId?: UltimateId;
      /** Pile for the Prospector ultimate, when chosen. */
      ultimatePile?: ResourceKind;
    }
  | { type: "END_TURN" };

export type ActionType = Action["type"];

/** Result of attempting an action: either the next state or a refusal. */
export type ActionResult =
  | { ok: true; state: GameState }
  | { ok: false; reason: string };
