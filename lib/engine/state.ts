/**
 * Core game state shape. Pure data: every field must be JSON-serializable so the
 * reducer is deterministic and save/load is free.
 *
 * Authoritative rules source: docs/GAME_RULES.md.
 */

import type { ResourceType } from "@/lib/catalogs/types";
import type { RickhouseId } from "./rickhouses";

export type Phase =
  | "fees" // Phase 1
  | "action" // Phase 2
  | "market" // Phase 3
  | "gameover";

export type WinReason = "triple_crown";

// ---------- Resources ----------

export type ResourceCardInstance = {
  /** Unique instance id — a plain card and a specialty can share a resource type but never an instance id. */
  instanceId: string;
  resource: ResourceType;
  /** null for plain (type-only) cards; set to the specialty id (e.g. "new_american_oak") otherwise. */
  specialtyId: string | null;
};

// ---------- Bourbon (barrelled) ----------

export type BarrelInstance = {
  barrelId: string;
  ownerId: string;
  rickhouseId: RickhouseId;
  /** Resource instances used in the mash. 1 cask + ≥1 corn + ≥1 grain, ≤6 total. */
  mash: ResourceCardInstance[];
  /** Number of age tokens on the barrel (paid rickhouse fees). */
  age: number;
  /** Round number when the barrel was created. Used to gate selling (≥2 years). */
  barreledOnRound: number;
};

// ---------- Investments ----------

/**
 * Investment lifecycle (per current rules):
 *   unbuilt — drawn into hand, capital not paid, no effects.
 *   active  — implemented (capital paid), effects apply immediately.
 *
 * Players may hold any number of unbuilt investments in hand, but
 * may have at most MAX_ACTIVE_INVESTMENTS implemented at once.
 */
export type InvestmentStatus = "unbuilt" | "active";

export type InvestmentInstance = {
  /** Instance id — a player can hold multiple copies of the same cardId. */
  instanceId: string;
  cardId: string;
  status: InvestmentStatus;
  /** Per-round usage flag for once-per-round modifiers. */
  usedThisRound: boolean;
};

// ---------- Operations ----------

export type OperationsInstance = {
  instanceId: string;
  cardId: string;
};

// ---------- Players ----------

export type PlayerKind = "human" | "bot";
export type BotDifficulty = "easy" | "normal" | "hard";

export type Player = {
  id: string;
  name: string;
  kind: PlayerKind;
  botDifficulty?: BotDifficulty;
  seatIndex: number;
  cash: number;
  resourceHand: ResourceCardInstance[];
  bourbonHand: string[]; // bourbon card ids drawn / held
  investments: InvestmentInstance[];
  operations: OperationsInstance[];
  silverAwards: string[]; // bourbon card ids with Silver
  goldAwards: string[]; // bourbon card ids with Gold
  /**
   * Defensive flag — current rules have no bankruptcy, so this should
   * never become true in normal play. Kept so future re-introduction
   * of an elimination mechanic has a place to land without rippling
   * type changes through filters that already check it.
   */
  eliminated: boolean;
  /** Set once the player has resolved their Phase 3 market draw this round. */
  marketResolved: boolean;
  /** True after the player has spent on at least one paid action this round. Resets at round start. */
  hasTakenPaidActionThisRound: boolean;
  // Distressed Distiller's Loan tracking.
  /** True while this player owes the bank a loan repayment. */
  loanOutstanding: boolean;
  /** True after this player has used their once-per-game loan eligibility. */
  loanUsed: boolean;
};

// ---------- Rickhouses ----------

export type Rickhouse = {
  id: RickhouseId;
  capacity: number;
  barrels: BarrelInstance[];
};

// ---------- Market piles ----------

export type Market = {
  cask: ResourceCardInstance[];
  corn: ResourceCardInstance[];
  barley: ResourceCardInstance[];
  rye: ResourceCardInstance[];
  wheat: ResourceCardInstance[];
  /** Bourbon cards not yet drawn. */
  bourbonDeck: string[];
  bourbonFaceUp: string | null;
  /** Discard returns to the bottom of the bourbon deck. */
  bourbonDiscard: string[];
  investmentDeck: string[];
  operationsDeck: string[];
  /** Phase 3 market cards. Reshuffled from `marketDiscard` when empty. */
  marketDeck: string[];
  marketDiscard: string[];
};

// ---------- Action phase bookkeeping ----------

export type ActionPhaseState = {
  /** True until any player passes for the first time this round. */
  freeWindowActive: boolean;
  /** 0 during free window; increments each lap after the free window ends. */
  paidLapTier: number;
  /** Counts consecutive passes in the current lap to detect phase end. */
  consecutivePasses: number;
  /** Every player who has passed this round (they stay seated; passing is optional after). */
  passedPlayerIds: string[];
  /** Per-player track of actions taken this *lap* for ladder accounting. */
  actionsThisLapPlayerIds: string[];
};

export type FeesPhaseState = {
  /** Players who have completed their fees decision this round. */
  resolvedPlayerIds: string[];
  /** Per-barrel: whether it was paid this round. */
  paidBarrelIds: string[];
};

/**
 * Per-player Phase 3 state: each baron draws 2 market cards and keeps 1.
 * `drawnCardIds` holds the cards currently on offer for that player; once
 * they choose one, the chosen card resolves and the other is discarded,
 * after which the entry is cleared.
 */
export type MarketPhasePlayerState = {
  drawnCardIds: string[];
};

/**
 * Round-scoped effects emitted by Phase 3 market cards. Most resolve
 * immediately (demand deltas) but a few (`resource_shortage`) need to
 * persist for the duration of the *next* round before clearing.
 */
export type RoundEffects = {
  /** Pile names that DRAW_RESOURCE rejects this round. */
  resourceShortages: ResourceType[];
};

// ---------- Events / log ----------

export type GameEvent = {
  round: number;
  phase: Phase;
  at: number; // monotonically increasing sequence number
  kind: string;
  /** Free-form payload; the UI renders a human-readable label from kind+data. */
  data: Record<string, unknown>;
};

// ---------- Root state ----------

export type GameState = {
  /**
   * Persistence schema version. Bump when GameState fields change in a way
   * that would crash code reading an older save (added required fields,
   * renamed/removed fields, etc.). The persistence layer rejects loads with
   * a mismatched version so stale localStorage can't poison a new build.
   *
   *   v1 → initial single-page rewrite.
   *   v2 → added marketDeck/marketDiscard/marketPhase, dropped eventDeck +
   *        unpaidDebt + opening fields, collapsed investment lifecycle.
   *   v3 → added currentRoundEffects + pendingRoundEffects for market-card
   *        side-effects that span a round (resource shortages, etc.).
   */
  version: 3;
  id: string;
  createdAt: number;

  seed: number;
  rngState: number;

  round: number;
  phase: Phase;

  startPlayerId: string;
  firstPasserId: string | null;

  players: Record<string, Player>;
  playerOrder: string[];
  currentPlayerId: string;

  rickhouses: Rickhouse[];
  market: Market;
  demand: number;

  actionPhase: ActionPhaseState;
  feesPhase: FeesPhaseState;
  marketPhase: Record<string, MarketPhasePlayerState>;

  /**
   * Effects active *this* round (e.g. resource shortages from a Phase 3
   * market card kept last round). Reducer reads from this; cleared at
   * the start of the next round when `pendingRoundEffects` swap in.
   */
  currentRoundEffects: RoundEffects;
  /**
   * Effects queued *during this round* by Phase 3 market resolves; they
   * become active at the start of the next round.
   */
  pendingRoundEffects: RoundEffects;

  /** Set when the game ends. */
  winnerIds: string[];
  winReason: WinReason | null;

  log: GameEvent[];
  /** Monotonic event counter. */
  logSeq: number;
};

// ---------- Constants ----------

export const STARTING_DEMAND = 6;
export const MAX_DEMAND = 12;
export const MIN_DEMAND = 0;
export const DEFAULT_STARTING_CASH = 40;
export const TRIPLE_CROWN_GOLDS = 3;
export const MAX_ACTIVE_INVESTMENTS = 3;
export const DISTRESSED_LOAN_AMOUNT = 10;
export const DISTRESSED_LOAN_REPAYMENT = 13;
/** Number of market cards drawn per player in Phase 3 (one is kept, the rest discarded). */
export const MARKET_DRAW_COUNT = 2;
