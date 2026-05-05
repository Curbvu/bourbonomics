// ============================================================
// Bourbonomics 2.0 — Engine Types
// ============================================================
// Refer to docs/GAME_RULES.md for the canonical ruleset and
// docs/IMPLEMENTATION_GUIDE.md for the architectural intent.

// -----------------------------
// Cards
// -----------------------------

export type CardType = "resource" | "capital" | "mashbill";

export type ResourceSubtype = "cask" | "corn" | "rye" | "barley" | "wheat";
export type GrainSubtype = "rye" | "barley" | "wheat";

export const GRAIN_SUBTYPES: GrainSubtype[] = ["rye", "barley", "wheat"];

/** A concrete card instance in a player's deck/hand/discard/etc. */
export interface Card {
  id: string;                         // unique instance id
  cardDefId: string;                  // references the catalog definition
  type: "resource" | "capital";       // mash bills + ops cards have their own types
  subtype?: ResourceSubtype;          // for resource cards
  premium?: boolean;                  // true for cards like 2-rye
  resourceCount?: number;             // 1 for plain, 2 for 2-rye, etc.
  capitalValue?: number;              // for capital cards
  /** Optional: subtypes this card may stand in for (e.g. "any grain" specialty). */
  aliases?: ResourceSubtype[];
  /** Capital cost to acquire this card from the market. */
  cost?: number;
}

// -----------------------------
// Mash Bills
// -----------------------------

/** Recipe constraint on the mash committed at production. Always tightens, never loosens. */
export interface MashBillRecipe {
  minCorn?: number;
  minRye?: number;
  minBarley?: number;
  minWheat?: number;
  /** 0 means forbidden. */
  maxRye?: number;
  maxWheat?: number;
  minTotalGrain?: number;
}

/** Predicate against the resolved sale conditions. All fields are AND-ed. */
export interface AwardCondition {
  minAge?: number;
  minDemand?: number;
  minReward?: number;
}

export interface MashBill {
  id: string;                                // unique instance id
  defId: string;                             // references the catalog definition
  name: string;
  flavorText?: string;
  ageBands: [number, number, number];
  demandBands: [number, number, number];
  /** 3x3 grid; null cells reward 0 reputation (printed as "—"). */
  rewardGrid: (number | null)[][];
  recipe?: MashBillRecipe;
  silverAward?: AwardCondition;
  goldAward?: AwardCondition;
}

/** Mash bills with `recipe.maxRye === 0` are "wheated" for distillery-bonus purposes. */
export function isWheatedBill(bill: MashBill): boolean {
  return bill.recipe?.maxRye === 0;
}

// -----------------------------
// Distilleries
// -----------------------------

export type DistilleryBonus =
  | "warehouse"        // +1 upper rickhouse slot at init
  | "high_rye"         // 1 free 2-rye premium card in starter deck
  | "wheated_baron"    // wheated mash bills cost 1 fewer grain (min 1 grain still required)
  | "broker"           // once per round, Trade does not consume the turn
  | "old_line"         // bonded warehouse holds 3 slots instead of 2
  | "vanilla";         // no bonus

export interface Distillery {
  id: string;
  defId: string;
  name: string;
  flavorText?: string;
  bonus: DistilleryBonus;
  /** Default number of bonded slots a player gets if they pick this distillery. */
  bondedSlots: number;
  /** Default number of upper-tier slots. */
  upperSlots: number;
}

// -----------------------------
// Operations Cards
// -----------------------------

export type OperationsCardDefId =
  | "market_manipulation"
  | "regulatory_inspection"
  | "rushed_shipment"
  | "distressed_sale_notice"
  | "barrel_broker"
  | "market_corner"
  | "blend"
  | "demand_surge";

export interface OperationsCard {
  id: string;
  defId: OperationsCardDefId;
  name: string;
  description: string;
  /** Round in which the card was added to the player's operations hand. */
  drawnInRound: number;
}

// -----------------------------
// Barrels & Rickhouse Slots
// -----------------------------

export type RickhouseTier = "bonded" | "upper";

export interface RickhouseSlot {
  id: string;          // e.g. "slot_p1_bonded_0"
  ownerId: string;
  tier: RickhouseTier;
}

export interface Barrel {
  id: string;
  ownerId: string;
  /** Slot in the owning player's rickhouse. */
  slotId: string;
  attachedMashBill: MashBill;
  /** card-def ids spent at production (audit only; cards are already in discard). */
  productionCardDefIds: string[];
  /** Face-down cards committed to aging. Returned to discard on sale. */
  agingCards: Card[];
  /** Equals agingCards.length. */
  age: number;
  productionRound: number;
  /** Reset to false at start of each round. */
  agedThisRound: boolean;
  /** Set by Regulatory Inspection — barrel cannot be aged this round. */
  inspectedThisRound: boolean;
  /** Set by Rushed Shipment — barrel may be aged once more this round. */
  extraAgesAvailable: number;
}

// -----------------------------
// Player
// -----------------------------

export interface PlayerState {
  id: string;
  name: string;
  /** AI-controlled? Defaults to false (human). */
  isBot?: boolean;

  /** Distillery selected during setup. Null until SELECT_DISTILLERY resolves. */
  distillery: Distillery | null;
  /** Personal rickhouse slots. Built once distillery is selected. */
  rickhouseSlots: RickhouseSlot[];

  // Personal deck zones (resource + capital cards only).
  hand: Card[];
  deck: Card[];
  discard: Card[];

  // Out-of-deck holdings.
  mashBills: MashBill[];                    // in hand, not yet committed
  unlockedGoldBourbons: MashBill[];         // permanent recipes from Gold awards
  /** Operations cards held in hand. Persist across rounds; played as a free action. */
  operationsHand: OperationsCard[];

  // Counters.
  reputation: number;
  handSize: number;                         // default 8
  barrelsSold: number;

  outForRound: boolean;                     // hand exhausted in current action phase

  // Per-round flags driven by ops cards / distillery bonuses.
  /** Set by Demand Surge — next sale this round does not drop demand. */
  demandSurgeActive: boolean;
  /** Set by The Broker bonus — true once the free trade has been used this round. */
  brokerFreeTradeUsed: boolean;
  /** Set by Distressed Sale Notice — must Rush to Market this barrel on next turn. */
  pendingRushBarrelId: string | null;
}

// -----------------------------
// Game State
// -----------------------------

export type GamePhase =
  | "setup"
  | "distillery_selection"
  | "demand"
  | "draw"
  | "action"
  | "cleanup"
  | "ended";

export interface GameState {
  /** Original seed (for replays). */
  seed: number;
  /** Current RNG state — advances with every randomized operation. */
  rngState: number;

  round: number;
  phase: GamePhase;
  currentPlayerIndex: number;

  players: PlayerState[];

  /** Available distilleries (consumed as players pick during setup). */
  distilleryPool: Distillery[];
  /** Player ids in the order they pick distilleries (reverse snake). */
  distillerySelectionOrder: string[];
  /** Index into distillerySelectionOrder pointing at the next picker. */
  distillerySelectionCursor: number;

  /** Every barrel in play. Owner is barrel.ownerId; slot is barrel.slotId. */
  allBarrels: Barrel[];

  marketConveyor: Card[];                   // up to 6 face-up
  marketSupplyDeck: Card[];                 // face-down draw pile
  marketDiscard: Card[];                    // for reshuffle on exhaustion

  bourbonDeck: MashBill[];
  bourbonDiscard: MashBill[];

  /** Shared operations deck. */
  operationsDeck: OperationsCard[];
  operationsDiscard: OperationsCard[];

  demand: number;                           // 0..12
  demandRolls: { round: number; roll: [number, number]; result: "rise" | "hold" }[];

  finalRoundTriggered: boolean;
  finalRoundTriggerPlayerIndex: number | null;

  /** Players who have completed the current phase (e.g. drew their hand). Reset on phase transition. */
  playerIdsCompletedPhase: string[];

  /** Monotonic counter for IDs of entities created mid-game (e.g. barrels). */
  idCounter: number;

  actionHistory: GameAction[];
}

// -----------------------------
// Game Config (for initializeGame)
// -----------------------------

export interface GameConfig {
  seed: number;
  players: { id: string; name: string; isBot?: boolean }[];
  /** Pre-built starter decks per player (alternative to running the draft). */
  starterDecks?: Card[][];
  /** Pre-drafted mash bills per player (alternative to running the draft). */
  startingMashBills?: MashBill[][];
  /** Mash bills remaining in the bourbon deck after the draft. */
  bourbonDeck?: MashBill[];
  /** Cards that populate the market supply (some go straight to the conveyor). */
  marketSupply?: Card[];
  /** Override the operations deck. */
  operationsDeck?: OperationsCard[];
  /** Pre-assign distilleries (skips selection phase). Length must equal players.length. */
  startingDistilleries?: Distillery[];
  /** Override the distillery pool offered during selection. */
  distilleryPool?: Distillery[];
  /** Initial demand (default 0 per rules, though tests typically set this explicitly). */
  startingDemand?: number;
  /** Override starting hand size (default 8). */
  startingHandSize?: number;
  /** Number of operations cards each player starts with. Default 2 per rules. */
  startingOperationsCardCount?: number;
}

// -----------------------------
// Actions (Discriminated Union)
// -----------------------------

/** One conversion package: 3 cards spent → 1 of `resourceType`. */
export interface ConvertSpec {
  spendCardIds: string[];
  resourceType: ResourceSubtype;
}

/** Discriminator for ops card plays. Each variant carries the params it needs. */
export type PlayOperationsCardParams =
  | { defId: "market_manipulation"; direction: "up" | "down" }
  | { defId: "regulatory_inspection"; targetBarrelId: string }
  | { defId: "rushed_shipment"; targetBarrelId: string }
  | { defId: "distressed_sale_notice"; targetPlayerId: string; targetBarrelId: string }
  | {
      defId: "barrel_broker";
      sourceBarrelId: string;
      targetPlayerId: string;
      targetSlotId: string;
      paymentCardIds: string[];
    }
  | { defId: "market_corner"; marketSlotIndex: number }
  | { defId: "blend"; barrel1Id: string; barrel2Id: string }
  | { defId: "demand_surge" };

export type GameAction =
  | { type: "SELECT_DISTILLERY"; playerId: string; distilleryId: string }
  | { type: "ROLL_DEMAND"; roll: [number, number] }
  | { type: "DRAW_HAND"; playerId: string }
  | {
      type: "MAKE_BOURBON";
      playerId: string;
      cardIds: string[];                  // resource cards spent
      mashBillId: string;
      slotId: string;                     // target rickhouse slot
      conversions?: ConvertSpec[];        // 3:1 conversions inline
    }
  | { type: "AGE_BOURBON"; playerId: string; barrelId: string; cardId: string }
  | {
      type: "SELL_BOURBON";
      playerId: string;
      barrelId: string;
      reputationSplit: number;
      cardDrawSplit: number;
      goldBourbonId?: string;             // optionally apply a permanent Gold recipe
    }
  | {
      type: "RUSH_TO_MARKET";
      playerId: string;
      barrelId: string;
      goldBourbonId?: string;
    }
  | {
      type: "BUY_FROM_MARKET";
      playerId: string;
      marketSlotIndex: number;
      spendCardIds: string[];
    }
  | { type: "DRAW_MASH_BILL"; playerId: string; spendCardId: string }
  | {
      type: "TRADE";
      player1Id: string;
      player2Id: string;
      player1Cards: string[];
      player2Cards: string[];
    }
  | ({
      type: "PLAY_OPERATIONS_CARD";
      playerId: string;
      cardId: string;
    } & PlayOperationsCardParams)
  | { type: "PASS_TURN"; playerId: string };

// -----------------------------
// Engine API
// -----------------------------

export interface ValidationResult {
  legal: boolean;
  reason?: string;
}

export interface ScoreResult {
  playerId: string;
  reputation: number;
  deckSize: number;          // hand + deck + discard (smaller wins tiebreak)
  barrelsSold: number;
  rank: number;              // 1-based; ties share rank
}

export interface GameEngine {
  initializeGame(config: GameConfig): GameState;
  validateAction(state: GameState, action: GameAction): ValidationResult;
  applyAction(state: GameState, action: GameAction): GameState;
  isGameOver(state: GameState): boolean;
  computeFinalScores(state: GameState): ScoreResult[];
}
