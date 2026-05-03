/**
 * Reducer action union. Every state change flows through one of these.
 *
 * Rules source: docs/GAME_RULES.md §Actions + §Round structure.
 */

import type { RickhouseId } from "./rickhouses";

export type ResourcePileName =
  | "cask"
  | "corn"
  | "barley"
  | "rye"
  | "wheat";

// ---------- Phase 2 actions ----------

export type ActionDrawResource = {
  t: "DRAW_RESOURCE";
  playerId: string;
  pile: ResourcePileName;
};

export type ActionDrawBourbon = {
  t: "DRAW_BOURBON";
  playerId: string;
};

export type ActionMakeBourbon = {
  t: "MAKE_BOURBON";
  playerId: string;
  rickhouseId: RickhouseId;
  /** Instance ids of resource cards from the player's hand to commit to the mash. */
  resourceInstanceIds: string[];
  /**
   * Mash bill (Bourbon card) committed to the barrel at production. Must
   * be in the player's `bourbonHand` at dispatch; it leaves the hand and
   * is locked to the new barrel for the barrel's life.
   */
  mashBillId: string;
};

export type ActionSellBourbon = {
  t: "SELL_BOURBON";
  playerId: string;
  barrelId: string;
  /**
   * If set, the player is opting to apply one of their unlocked Gold
   * Bourbons as the alt payout for this sale. The reducer validates
   * the barrel actually meets that Gold Bourbon's criteria; if not the
   * dispatch is rejected.
   */
  applyGoldBourbonId?: string;
};

export type ActionDrawInvestment = {
  t: "DRAW_INVESTMENT";
  playerId: string;
};

export type ActionDrawOperations = {
  t: "DRAW_OPERATIONS";
  playerId: string;
};

export type ActionImplementInvestment = {
  t: "IMPLEMENT_INVESTMENT";
  playerId: string;
  investmentInstanceId: string;
};

export type ActionResolveOperations = {
  t: "RESOLVE_OPERATIONS";
  playerId: string;
  operationsInstanceId: string;
};

/**
 * Audit — any player whose turn it is may call this once per round.
 * Forces every player (including the auditor) over the soft hand limit
 * (HAND_LIMIT = 10 cards across mash bills + unbuilt investments + ops)
 * into a `pendingAuditOverage` state; their next action must be an
 * AUDIT_DISCARD bringing them back to 10. The auditor's action is
 * consumed regardless of whether anyone overflowed.
 */
export type ActionCallAudit = {
  t: "CALL_AUDIT";
  playerId: string;
};

/**
 * The discard side of an Audit. The acting player must specify which
 * cards to drop; combined count must equal their `pendingAuditOverage`.
 * Mash bills go to the bourbon discard, unbuilt investments to the
 * investment discard, operations to the operations discard.
 */
export type ActionAuditDiscard = {
  t: "AUDIT_DISCARD";
  playerId: string;
  mashBillIds: string[];
  investmentInstanceIds: string[];
  operationsInstanceIds: string[];
};

export type ActionPass = { t: "PASS_ACTION"; playerId: string };

// ---------- Phase 1 actions ----------

export type ActionPayFees = {
  t: "PAY_FEES";
  playerId: string;
  /** Barrel ids the player chooses to pay rent on this round. */
  barrelIds: string[];
};

export type ActionTakeDistressedLoan = {
  t: "TAKE_DISTRESSED_LOAN";
  playerId: string;
};

// ---------- Phase 3 actions ----------

/**
 * Phase 3 is "draw 2 market cards, keep 1, discard 1". The reducer splits this
 * into two dispatches so the UI can show the choice between calls.
 */
export type ActionMarketDraw = {
  t: "MARKET_DRAW";
  playerId: string;
};

export type ActionMarketKeep = {
  t: "MARKET_KEEP";
  playerId: string;
  /** Card id from the two drawn that the player chooses to resolve. */
  keptCardId: string;
};

// ---------- Distillery draft (pre-round-1) ----------

/**
 * Pick + commit one of the two dealt Distillery cards. The unchosen
 * card returns to the deck (which is reshuffled) and the chosen
 * card's bonuses resolve immediately. When every baron has confirmed,
 * the reducer transitions out of `distillery_draft` into round 1's
 * action phase.
 */
export type ActionDistilleryConfirm = {
  t: "DISTILLERY_CONFIRM";
  playerId: string;
  /** Must be one of the two ids in the player's `dealtDistilleryIds`. */
  chosenId: string;
};

// ---------- Phase transition (reducer-driven) ----------

export type ActionAdvance = { t: "ADVANCE" };

// ---------- Union ----------

export type Action =
  | ActionDrawResource
  | ActionDrawBourbon
  | ActionMakeBourbon
  | ActionSellBourbon
  | ActionDrawInvestment
  | ActionDrawOperations
  | ActionImplementInvestment
  | ActionResolveOperations
  | ActionCallAudit
  | ActionAuditDiscard
  | ActionPass
  | ActionPayFees
  | ActionTakeDistressedLoan
  | ActionMarketDraw
  | ActionMarketKeep
  | ActionDistilleryConfirm
  | ActionAdvance;

export type ActionKind = Action["t"];
