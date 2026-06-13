// Bourbonomics — data model (ground-up revision).
//
// Pure typed structures, no behavior. The engine reducer (engine.ts)
// consumes a GameState + Action and returns a new GameState. Keep this
// module dependency-free so it can be imported by both the engine and
// the UI without dragging logic along.
//
// The round runs in three phases — Demand → Collect → Play. Brand lines,
// slot cards, marketing cards, the flood engine, and the 6-action budget
// are REMOVED. Three systems are intentionally STUBBED (see GAME_RULES.md):
// the collection engine, the prestige source, and the quality distribution.

// ---------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------

/** Quality tier of a resource / finished bourbon. Higher = scarcer & better. */
export type Quality = "common" | "specialty" | "heritage";

/**
 * The five resource piles. Grain splits into its three identities — rye /
 * wheat / barley. Each is its own face-down pile; a die face names the pile,
 * quality is drawn blind off the top.
 */
export type ResourceKind = "cask" | "corn" | "rye" | "wheat" | "barley";

/** A die face: the five resource kinds plus the wild "anything". */
export type DieFace = ResourceKind | "anything";

/** Free-form bourbon flavor traits, derived from a mash bill. */
export type Trait = string;

/**
 * Canonical house-style tag, derived from a mash bill's `expression`
 * (see `expressionToTags` in content.ts). Recorded on every batch. Reserved
 * for the 🚧 STUBBED collection engine (coherence will key off it); not yet
 * scored.
 */
export type Tag = "wheat" | "rye" | "highCorn" | "fourGrain" | "classic";

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
 * A mash bill is the recipe + payoff grid for a bourbon. `recipe` lists the
 * resource kinds (with counts) that must be committed to make it. `matrix`
 * is the age×demand payoff grid inherited by the finished bourbon.
 */
export interface MashBill {
  id: string;
  defId: string;
  name: string;
  traits: Trait[];
  /** House-style / grain identity (e.g. "wheated", "high-rye", "four-grain"). */
  expression: string;
  /** Required resource kinds → counts. Quality of committed cards sets tier. */
  recipe: Partial<Record<ResourceKind, number>>;
  /** How many sales (extractions) a batch built from this bill yields. `[PH]`. */
  batchQty: number;
  /** matrix[age][demand] → capital. Clamped at the edges on lookup. */
  matrix: number[][];
  placeholder: true;
}

/**
 * A demand card — 🚧 PLACEHOLDER. The real content (tags, thresholds, payoff
 * shaping) is not finalized; reuse the prior version's idea of a focus tag and
 * carry a single `level` that feeds the age×demand matrix. Each round the
 * Demand Phase lays out `Marketing`-many of these; the round's matrix demand
 * level is the highest among them. Holds for the whole round (forecastable).
 */
export interface DemandCard {
  id: string;
  defId: string;
  label: string;
  /** Primary style focus (display + the 🚧 STUBBED demand-matching engine). */
  tag: Tag;
  /** The matrix demand level this card contributes. `[PH]`. */
  level: number;
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
 * separate sales (extractions). Each extraction reads the age × demand matrix
 * and banks Capital; the **final** extraction frees the rickhouse slot (and —
 * 🚧 STUBBED — will enshrine the batch into the collection / pay the
 * completion bonus once the engine is designed).
 */
export interface Bourbon {
  id: string;
  mashBillId: string;
  name: string;
  traits: Trait[];
  /** House-style tag inherited from the mash bill. */
  expression: string;
  /** Canonical tags derived from `expression` (reserved for the collection engine). */
  recipeTags: Tag[];
  /** The recipe this barrel needs to be built — shown as requirements while unbuilt. */
  recipe: Partial<Record<ResourceKind, number>>;
  /**
   * Resource cards STAGED onto this (unbuilt) barrel ahead of building. Staged
   * cards have left the Warehouse (they free hold cap) and are locked to the
   * barrel — they must be recipe-matched and cannot exceed the recipe's counts.
   * MAKE_BOURBON builds from staged + any extra loose cards.
   */
  staged: ResourceCard[];
  /**
   * False = an unbuilt barrel resting in the rickhouse (displays its recipe,
   * does NOT age, cannot be sold). Set true by MAKE_BOURBON once the required
   * resources are committed; only then does it begin aging.
   */
  built: boolean;
  /** Years rested. Starts 0, +1 per round while BUILT and in the rickhouse. */
  age: number;
  quality: Quality;
  /** Total sales this batch yields over its life. Copied from the mash bill. */
  batchQty: number;
  /** Sales left before the batch is spent. Starts at `batchQty`; each sale −1. */
  salesRemaining: number;
  /** Inherited from the mash bill at make time. matrix[age][demand]. */
  matrix: number[][];
  /** Round index when the bourbon was created (for the "aged ≥1 round" gate). */
  createdRound: number;
}

// ---------------------------------------------------------------------
// Distillery board: per-player departments on a linear improvement ramp
// ---------------------------------------------------------------------

/**
 * The growth paths grown over the game. All permanent, no upkeep.
 *   - rickhouse        → total barrel capacity (resting unbuilt + aging built).
 *   - supply           → dice rolled/held in the Collect Phase (+2nd reroll once upgraded).
 *   - warehouse        → resource cards you may hold (hand cap).
 *   - distillingOffice → mash bills drawn per Draw Mash Bills action.
 *   - tastingRoom      → Capital sell bonus per sale.
 *   - marketing        → how many demand cards are laid down each round.
 *
 * NOTE: GAME_RULES.md lists five "departments" (everything but rickhouse) yet
 * §The Rickhouse calls capacity "a department / growth path" that you grow.
 * Rickhouse is included here as a sixth growth path so capacity can expand;
 * the doc's "five" list should be reconciled.
 */
export type DepartmentId =
  | "rickhouse"
  | "supply"
  | "warehouse"
  | "mashFloor"
  | "marketing"
  | "distribution"
  | "countingHouse";

/**
 * One department on a player's board. `level` starts at 0 (the base) and is
 * advanced one step at a time by Improve Distillery. `values[level]` is the
 * effect magnitude at that level. The Capital cost of advancing is NOT stored
 * here — it comes from the per-player linear improvement ramp (see config).
 */
export interface Department {
  id: DepartmentId;
  name: string;
  /** One-line description of what the department does. */
  blurb: string;
  level: number;
  maxLevel: number;
  /** values[level] = the department's effect magnitude at that level. */
  values: number[];
  /**
   * Per-department Capital discount applied to the linear ramp (the distillery
   * asymmetry — "which growth paths are cheap"). 0 = full ramp price. `[PH]`.
   */
  discount: number;
}

/**
 * A distillery's signature ability — its asymmetric edge, applied at sale time.
 *   - none          → no signature (the balanced beginner distillery).
 *   - volumeBonus   → +Capital on EVERY sale (throughput tilt).
 *   - ryeBonus      → +Capital on each sale of a rye-tagged batch (tag tilt).
 *   - agedPrestige  → +prestige completing a well-aged batch (patience tilt).
 */
export type AbilityId = "none" | "volumeBonus" | "ryeBonus" | "agedPrestige";

/** A player's distillery — the board carrying the five departments. */
export interface DistilleryBoard {
  distilleryId: string;
  name: string;
  /** The distillery's signature ability (its asymmetric edge). */
  signature: AbilityId;
  /** One-line description of the signature, for the UI. */
  signatureBlurb: string;
  departments: Department[];
}

export interface Player {
  id: string;
  name: string;
  /** Spendable currency AND the bulk of final score. */
  capital: number;
  /** Converts to Reputation at game end. 🚧 Source STUBBED (see GAME_RULES.md). */
  prestige: number;
  hand: ResourceCard[];
  /** Resting + aging barrels. Capacity = the rickhouse (a growth path) — `[PH]`. */
  rickhouse: Bourbon[];
  /** Per-player department board. */
  distillery: DistilleryBoard;
  /**
   * Count of improvements made across all departments. Drives the linear
   * ramp: the Nth improvement costs the Nth step. Persists all game.
   */
  improvements: number;
  /** Set true once this player has drawn mash bills this Play turn (once-per-turn gate). */
  drewMashBillsThisTurn: boolean;
  /** Set true once this player has ended their Play turn this round. */
  donePlayThisRound: boolean;
  /** Tiebreaker counter. */
  bourbonsSold: number;
}

export type GamePhase = "playing" | "ended";

/** The phase within a round. Demand → Collect → Play, then age + next round. */
export type RoundPhase = "demand" | "collect" | "play";

/**
 * Live state of the Collect Phase pass. Players act in most-Capital-first
 * order: each rolls up to their Supply cap (inheriting the previous player's
 * leftovers), rerolls once (twice with a Supply upgrade), claims dice into
 * resources up to their Warehouse cap, and passes leftovers on.
 */
export interface CollectState {
  /** Player indices in most-Capital-first order (the pass order). */
  order: number[];
  /** Position into `order` — whose collect turn it is. */
  pos: number;
  /** Dice inherited (passed) from the previous player at the start of this turn. */
  inherited: Die[];
  /** The active player's dice currently in play (inherited + rolled). */
  dice: Die[];
  /** Rerolls the active player has used this turn. */
  rerollsUsed: number;
  /** Max rerolls the active player gets (1, or 2 with a Supply upgrade). */
  maxRerolls: number;
}

export interface GameState {
  phase: GamePhase;
  /** Phase within the current round. */
  roundPhase: RoundPhase;
  players: Player[];

  /**
   * The round's matrix demand LEVEL (the matrix demand axis). Laid out in the
   * Demand Phase and held for the whole round. 🚧 Derived from PLACEHOLDER
   * demand cards (highest level among those laid down).
   */
  demand: number;
  /** The demand cards laid out this round (count set by Marketing). */
  demandCards: DemandCard[];
  /** Face-down demand draw deck (reshuffles when empty). */
  demandDeck: DemandCard[];

  // Five type-sorted resource piles (shared by ALL players). A die face names
  // the pile; quality is drawn blind off the top. Consumed resources go to the
  // matching per-type discard, reshuffled back when the pile empties.
  piles: Record<ResourceKind, ResourceCard[]>;
  pileDiscards: Record<ResourceKind, ResourceCard[]>;

  /** Face-down mash bill supply — the end-game clock. Draw Mash Bills drains it. */
  mashBillSupply: MashBill[];

  /** Live Collect-Phase pass state; null outside the Collect Phase. */
  collect: CollectState | null;

  roundNumber: number;
  /** Seating order start; rotates each round. Used for the Play round-robin. */
  startPlayerIndex: number;
  /** Whose turn it is right now (collect or play). */
  currentPlayerIndex: number;

  /**
   * Set to the round number of the final round once the bill supply empties.
   * When that round completes, the game ends (one final equal-turn round).
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
      type: "COLLECT_REROLL";
      /** Ids of the active player's dice to reroll (once, twice with Supply upgrade). */
      diceIds: string[];
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
  // --- Play Phase ---
  | {
      type: "DRAW_MASH_BILLS";
      /**
       * Indexes into the revealed top-of-supply offer (Distilling-Office-many
       * bills) to keep as resting barrels; the rest cycle back. Once per turn.
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
  | { type: "SELL"; bourbonId: string }
  | { type: "IMPROVE"; departmentId: DepartmentId }
  | { type: "END_TURN" };

export type ActionType = Action["type"];

/** Result of attempting an action: either the next state or a refusal. */
export type ActionResult =
  | { ok: true; state: GameState }
  | { ok: false; reason: string };
