/**
 * Core game state shape. Pure data: every field must be JSON-serializable so the
 * reducer is deterministic and save/load is free.
 *
 * Authoritative rules source: docs/GAME_RULES.md (Kentucky Straight mode).
 */

import type { ResourceType } from "@/lib/catalogs/types";
import type { RickhouseId } from "./rickhouses";

export type Mode = "kentucky_straight";

export type Phase =
  | "opening" // pre-round 1 setup: keep 3, then commit
  | "fees" // Phase 1
  | "action" // Phase 2
  | "market" // Phase 3
  | "gameover";

export type WinReason =
  | "triple_crown"
  | "baron_of_kentucky"
  | "last_baron_standing";

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

export type InvestmentStatus = "unbuilt" | "funded_waiting" | "active";

export type InvestmentInstance = {
  /** Instance id — a player can hold multiple copies of the same cardId. */
  instanceId: string;
  cardId: string;
  status: InvestmentStatus;
  /** Round when funded (via Implement). Flips to "active" at start of round + 1. */
  fundedOnRound: number | null;
  /** Per-round usage flags keyed to roundNumber to enforce oncePerRound modifiers. */
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
  eliminated: boolean;
  /** Set once the player has chosen "roll" or "event" during Phase 3 this round. */
  marketResolved: boolean;
  /** True after the player has spent on at least one paid action this round. Resets at round start. */
  hasTakenPaidActionThisRound: boolean;
  /** Opening-phase scratchpads. */
  openingDraft: string[] | null; // the initial draw of 6
  openingKeptBeforeAuction: string[] | null; // kept 3 (pre-auction)
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
  eventDeck: string[];
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
  /** Double-penalty debt remaining per player. */
  unpaidDebt: Record<string, number>;
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
  version: 1;
  id: string;
  createdAt: number;

  seed: number;
  rngState: number;

  mode: Mode;
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

  /** Set when the game ends. */
  winnerIds: string[];
  winReason: WinReason | null;

  log: GameEvent[];
  /** Monotonic event counter. */
  logSeq: number;
};

// ---------- Helpers ----------

export const STARTING_DEMAND = 6;
export const MAX_DEMAND = 12;
export const MIN_DEMAND = 0;
export const DEFAULT_STARTING_CASH = 20;
export const BARON_OF_KENTUCKY_BARRELS = 15;
export const TRIPLE_CROWN_GOLDS = 3;
