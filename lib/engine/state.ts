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
  | "scoring" // Final-round end-of-action scoring sweep
  | "gameover";

export type WinReason = "final-round";

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
  /**
   * Bourbon-card id (a.k.a. "mash bill") attached to this barrel at
   * production. Locked for the barrel's life — the bill can't be moved,
   * swapped, or shared with another barrel. The bill's price grid is
   * what determines the sale payout.
   */
  mashBillId: string;
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
  /**
   * Bourbon-centric icon identifier picked at game setup; the player's
   * visual identity across the dashboard. Optional for save-file
   * back-compat — UI falls back to a deterministic logo derived from
   * `seatIndex` when missing.
   */
  logoId?: string;
  cash: number;
  resourceHand: ResourceCardInstance[];
  bourbonHand: string[]; // bourbon card ids drawn / held
  investments: InvestmentInstance[];
  operations: OperationsInstance[];
  /**
   * Mash-bill ids that earned a Silver award and were returned to the
   * player. Held in `bourbonHand`; this list is the de-dup set so the
   * same mash bill can't be re-credited as Silver twice in a game.
   */
  silverAwards: string[];
  /**
   * Unlocked Gold Bourbons — face-up trophy cards that live in front
   * of the player. NOT part of `bourbonHand`. Each one:
   *   - is removed from the bourbon deck/discard for the rest of the game
   *   - does NOT count toward the 10-card hand limit
   *   - counts toward the 3-Gold final-round trigger
   *   - scores its catalog `brandValue` at game end
   *   - may be applied as an alt payout at sale time on any qualifying barrel
   */
  goldBourbons: string[];
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
  /**
   * Dollars still owed to the bank. 0 means the player owes nothing.
   * Set to DISTRESSED_LOAN_REPAYMENT (15) at the moment a loan is taken;
   * decremented by the Phase-1 repayment and (if siphon is active) by
   * every cash credit that flows through `creditCash`.
   */
  loanRemaining: number;
  /**
   * True ONLY after a partial Phase-1 repayment failed to clear the
   * full $15. While this is on, every cash credit auto-siphons to the
   * bank first and the player cannot spend (rent, capital, action cost).
   * Cleared automatically when `loanRemaining` reaches 0.
   *
   * Note: a loan in its "fresh" round (taken this round, due next Phase 1)
   * has `loanRemaining > 0` but `loanSiphonActive === false`. The punitive
   * mode only activates after a partial repayment.
   */
  loanSiphonActive: boolean;
  /** True after this player has used their once-per-game loan eligibility. */
  loanUsed: boolean;
  /**
   * If non-null, this player owes an Audit-driven discard down to
   * HAND_LIMIT (10). Their next legal action is `AUDIT_DISCARD`.
   * Cleared once the discard is resolved.
   */
  pendingAuditOverage: number | null;
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
  /**
   * Bourbon mash-bill deck. Players draw from here into their
   * `bourbonHand`. Discard pile is reshuffled into the deck when
   * empty. Bills earned as Gold trophies are REMOVED from circulation
   * (never returned to deck or discard).
   */
  bourbonDeck: string[];
  bourbonDiscard: string[];
  investmentDeck: string[];
  /** Pile that audited / dumped investments land in. */
  investmentDiscard: string[];
  operationsDeck: string[];
  /** Pile that audited / dumped operations cards land in. */
  operationsDiscard: string[];
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
  /** True after any player calls Audit this round. Reset at round start. */
  auditCalledThisRound: boolean;
  /**
   * Per-player free-action budget for the current round. Round 1 seeds
   * each player with `STARTING_FREE_ACTIONS` (the "setup" round so
   * everyone can stock resources, draw bills, and barrel a few mashes
   * without paying); subsequent rounds reset to 0 and the lap-cost
   * ladder runs normally. While `freeActionsRemainingByPlayer[pid] > 0`
   * any action that player takes costs $0 and decrements the counter
   * regardless of `freeWindowActive` / `paidLapTier`.
   */
  freeActionsRemainingByPlayer: Record<string, number>;
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
 * Demand boost applied at sale time, possibly conditional on the barrel
 * or sale ordering. The boost adjusts the lookup demand passed to the
 * bill's grid; it does NOT change the global demand value.
 */
export type DemandBoost = {
  delta: number;
  /** Only applies to barrels whose age ≥ this value, if set. */
  minAge?: number;
  /** Only applies if the boosted lookup lands in the bill's top demand band. */
  topBandOnly?: boolean;
  /** Only applies to the first sale of the round. */
  firstSaleOnly?: boolean;
};

/** A persistent demand delta that ticks down each round. */
export type PersistentDemandDelta = {
  delta: number;
  roundsRemaining: number;
};

/**
 * Round-scoped effects emitted by Phase 3 market cards. Most resolve
 * immediately (demand deltas) but a few persist for the duration of the
 * *next* round before clearing. New optional fields default to
 * "no-effect" so older saves load cleanly.
 */
export type RoundEffects = {
  /** Pile names that DRAW_RESOURCE rejects this round. */
  resourceShortages: ResourceType[];
  /** Per-barrel rent surcharge added to this round's fee phase. */
  rentSurchargePerBarrel?: number;
  /** Each sale this round drops global demand by this many points (default 1). */
  demandDecayPerSale?: number;
  /** Player IDs blocked from MAKE_BOURBON this round. */
  playersBlockedFromMake?: string[];
  /** Demand boosts applied at sale time, possibly conditionally. */
  demandBoosts?: DemandBoost[];
  /** Counter incremented after each sale; used by firstSaleOnly boosts. */
  salesThisRound?: number;
  /**
   * Persistent demand deltas that fire at the start of each subsequent
   * round until `roundsRemaining` ticks down to 0. Every market-card
   * persistent effect is stored here once it crosses round boundaries.
   */
  persistentDemandDeltas?: PersistentDemandDelta[];
};

// ---------- Final-round scoring ----------

export type ScoreBreakdown = {
  cash: number;
  investments: number;
  goldBourbons: number;
  total: number;
  /** How many unlocked Gold Bourbons the player has — used as primary tiebreak. */
  goldCount: number;
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
   *   v4 → mash bills committed at production: BarrelInstance.mashBillId
   *        added; SELL_BOURBON no longer takes a card param; players draw
   *        4 bourbon cards into bourbonHand at setup; bourbonFaceUp
   *        retired from the Market.
   *   v5 → Gold awards UNLOCK a permanent face-up Gold Bourbon (Player.goldBourbons),
   *        removed from circulation; loan repayment $13 → $15 ($5 interest);
   *        soft 10-card combined hand limit replaces hard 4-bill cap;
   *        new Audit action (CALL_AUDIT / AUDIT_DISCARD); third Gold triggers
   *        FINAL ROUND (not immediate end), then market is skipped and a
   *        new "scoring" phase resolves a detailed end-game tally.
   *   v6 → punitive Distressed Loan: replaces `loanOutstanding: boolean`
   *        with `loanRemaining: number` + `loanSiphonActive: boolean`.
   *        Partial Phase-1 repayment now activates a siphon mode in
   *        which every cash credit auto-pays the bank first and the
   *        player is blocked from spending (rent / actions / capital)
   *        until $15 is cleared. DISCARD_AND_DRAW_BOURBON action retired
   *        (mash bills draw freely; Audit handles overflow).
   */
  version: 7;
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

  /**
   * True once any player unlocks their third Gold Bourbon. The current
   * round becomes the final round: action phase continues normally, then
   * market phase is skipped and scoring runs.
   */
  finalRoundTriggered: boolean;
  /** Round number that the final round resolves on (the round the trigger fired in). */
  finalRoundEndsOnRound: number | null;

  /** Set when the game ends. */
  winnerIds: string[];
  winReason: WinReason | null;
  /** Final-round scoring breakdown per player. Populated when phase transitions to "scoring". */
  finalScores: Record<string, ScoreBreakdown> | null;

  log: GameEvent[];
  /** Monotonic event counter. */
  logSeq: number;
};

// ---------- Constants ----------

export const STARTING_DEMAND = 6;
export const MAX_DEMAND = 12;
export const MIN_DEMAND = 0;
export const DEFAULT_STARTING_CASH = 25;
/** Number of Gold Bourbons a player must unlock to trigger the final round. */
export const TRIPLE_CROWN_GOLDS = 3;
export const MAX_ACTIVE_INVESTMENTS = 3;
export const DISTRESSED_LOAN_AMOUNT = 10;
/** Loan repayment ($10 principal + $5 interest) — taken off the top in the next Phase 1. */
export const DISTRESSED_LOAN_REPAYMENT = 15;
/** Number of market cards drawn per player in Phase 3 (one is kept, the rest discarded). */
export const MARKET_DRAW_COUNT = 2;
/**
 * Soft hand limit across mash bills + unbuilt investments + operations.
 * Nothing prevents temporarily exceeding it — enforcement is via the
 * Audit action, which forces every overflowing player to discard down
 * to this number.
 */
export const HAND_LIMIT = 10;
/**
 * Bourbon cards each player is dealt at game-creation time. Now `0`
 * because round 1 is the "setup" round (8 free actions per player) —
 * the first thing every player does is draw their own opening hand of
 * mash bills using those free actions, which gives them agency over
 * what shapes their early game.
 */
export const STARTING_BOURBON_HAND = 0;
/**
 * Per-player free actions granted in round 1 — the "setup" round. Each
 * player can spend these on any action (draw, make, implement, sell)
 * without paying the lap cost; once the budget is exhausted the player
 * either passes or starts paying. Subsequent rounds get 0.
 */
export const STARTING_FREE_ACTIONS = 8;
/** Default brandValue applied at scoring for a Gold Bourbon if the catalog has no override. */
export const DEFAULT_GOLD_BRAND_VALUE = 25;
