// ============================================================
// Bourbonomics 2.0 — Engine Types
// ============================================================
// Refer to docs/GAME_RULES.md for the canonical ruleset and
// docs/IMPLEMENTATION_GUIDE.md for the architectural intent.

// -----------------------------
// Cards
// -----------------------------

export type CardType =
  | "resource"
  | "capital"
  | "mashbill"
  | "investment"
  | "operations";

export type ResourceSubtype = "cask" | "corn" | "rye" | "barley" | "wheat";
export type GrainSubtype = "rye" | "barley" | "wheat";

export const GRAIN_SUBTYPES: GrainSubtype[] = ["rye", "barley", "wheat"];

/** A concrete card instance in a player's deck/hand/discard/etc. */
export interface Card {
  id: string;                         // unique instance id
  cardDefId: string;                  // references the catalog definition
  type: "resource" | "capital";       // mashbill/investment/operations have their own types
  subtype?: ResourceSubtype;          // for resource cards
  premium?: boolean;                  // true for cards like 2-rye
  resourceCount?: number;             // 1 for plain, 2 for 2-rye, etc.
  capitalValue?: number;              // for capital cards
  /** Optional: subtypes this card may stand in for (e.g. "any grain" specialty). */
  aliases?: ResourceSubtype[];
  /** Reputation gained when this card is discarded as part of a normal action. */
  discardReputationBonus?: number;
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

// -----------------------------
// Investments
// -----------------------------

export type InvestmentEffect =
  | { kind: "hand_size_plus"; amount: number }
  | { kind: "free_trash_per_round"; amount: number }
  | { kind: "carry_over_cards"; amount: number }
  | { kind: "demand_plus_per_round"; amount: number }
  | { kind: "capital_to_reputation"; capitalCost: number; reputationGained: number; perRound: number }
  | { kind: "free_age_per_round" }
  | { kind: "draw_mashbill_per_round"; amount: number };

export interface Investment {
  id: string;
  defId: string;
  name: string;
  flavorText?: string;
  capitalCost: number;
  effect: InvestmentEffect;
}

// -----------------------------
// Operations
// -----------------------------

export type OperationsEffect =
  | { kind: "demand_delta"; amount: number }
  | { kind: "trash_opponent_hand_card" }
  | { kind: "steal_from_discard"; amount: number }
  | { kind: "draw_cards"; amount: number };

export interface OperationsCard {
  id: string;
  defId: string;
  name: string;
  flavorText?: string;
  effect: OperationsEffect;
}

// -----------------------------
// Barrels & Rickhouses
// -----------------------------

export interface Barrel {
  id: string;
  ownerId: string;
  rickhouseId: string;
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
}

export interface Rickhouse {
  id: string;
  name: string;
  capacity: number;
}

// -----------------------------
// Player
// -----------------------------

export interface PlayerState {
  id: string;
  name: string;

  // Personal deck zones (resource + capital cards only).
  hand: Card[];
  deck: Card[];
  discard: Card[];
  trashed: Card[];

  // Out-of-deck holdings.
  mashBills: MashBill[];                    // in hand, not yet committed
  unlockedGoldBourbons: MashBill[];         // permanent recipes
  activeInvestments: Investment[];          // in play (max 3)
  heldInvestments: Investment[];            // drawn but not implemented
  heldOperations: OperationsCard[];         // drawn but not played

  // Counters.
  reputation: number;
  handSize: number;                         // default 8
  barrelsSold: number;

  // Per-round counters (reset at cleanup).
  freeTrashRemaining: number;
  capitalConvertedThisRound: number;
  outForRound: boolean;                     // hand exhausted in current action phase
}

// -----------------------------
// Game State
// -----------------------------

export type GamePhase =
  | "setup"
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

  // Shared zones.
  rickhouses: Rickhouse[];
  /** Every barrel in play (any rickhouse). Owner is barrel.ownerId. */
  allBarrels: Barrel[];

  marketConveyor: Card[];                   // up to 6 face-up
  marketSupplyDeck: Card[];                 // face-down draw pile
  marketDiscard: Card[];                    // for reshuffle on exhaustion

  bourbonDeck: MashBill[];
  bourbonDiscard: MashBill[];

  investmentDeck: Investment[];
  investmentDiscard: Investment[];

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
  players: { id: string; name: string }[];
  /** Pre-built starter decks per player (alternative to running the draft). */
  starterDecks?: Card[][];
  /** Pre-drafted mash bills per player (alternative to running the draft). */
  startingMashBills?: MashBill[][];
  /** Mash bills remaining in the bourbon deck after the draft. */
  bourbonDeck?: MashBill[];
  /** Cards that populate the market supply (some go straight to the conveyor). */
  marketSupply?: Card[];
  investments?: Investment[];
  operations?: OperationsCard[];
  /** Override default rickhouse list. */
  rickhouses?: Rickhouse[];
  /** Initial demand (default 6 per rules). */
  startingDemand?: number;
  /** Override starting hand size (default 8). */
  startingHandSize?: number;
}

// -----------------------------
// Actions (Discriminated Union)
// -----------------------------

/** One conversion package: 3 cards spent → 1 of `resourceType`. */
export interface ConvertSpec {
  spendCardIds: string[];
  resourceType: ResourceSubtype;
}

export type GameAction =
  | { type: "ROLL_DEMAND"; roll: [number, number] }
  | { type: "DRAW_HAND"; playerId: string }
  | {
      type: "MAKE_BOURBON";
      playerId: string;
      cardIds: string[];                  // resource cards spent
      mashBillId: string;
      rickhouseId: string;
      trashCardId?: string;               // optional failed-batch trash
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
      type: "BUY_FROM_MARKET";
      playerId: string;
      marketSlotIndex: number;
      spendCardIds: string[];
    }
  | {
      type: "IMPLEMENT_INVESTMENT";
      playerId: string;
      investmentId: string;
      capitalCardIds: string[];
    }
  | {
      type: "PLAY_OPERATIONS";
      playerId: string;
      operationsCardId: string;
      targetData?: Record<string, unknown>;
    }
  | { type: "DRAW_MASH_BILL"; playerId: string; spendCardId: string }
  | { type: "DRAW_INVESTMENT"; playerId: string; spendCardId: string }
  | { type: "DRAW_OPERATIONS"; playerId: string; spendCardId: string }
  | {
      type: "TRADE";
      player1Id: string;
      player2Id: string;
      player1Cards: string[];
      player2Cards: string[];
      player1ActionCardId: string;
      player2ActionCardId: string;
    }
  | { type: "PASS_TURN"; playerId: string }
  | { type: "END_PHASE" };

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
