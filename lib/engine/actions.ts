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

/**
 * Discard a held mash bill back into the bourbon discard, then draw a
 * fresh one off the top of the deck. Net hand size stays the same; this
 * is the only way to swap a card out once you're at the hand limit (or
 * to cycle a bad bill at any time).
 */
export type ActionDiscardAndDrawBourbon = {
  t: "DISCARD_AND_DRAW_BOURBON";
  playerId: string;
  /** The mash-bill card id to discard from the player's bourbon hand. */
  bourbonCardId: string;
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

// ---------- Phase transition (reducer-driven) ----------

export type ActionAdvance = { t: "ADVANCE" };

// ---------- Union ----------

export type Action =
  | ActionDrawResource
  | ActionDrawBourbon
  | ActionDiscardAndDrawBourbon
  | ActionMakeBourbon
  | ActionSellBourbon
  | ActionDrawInvestment
  | ActionDrawOperations
  | ActionImplementInvestment
  | ActionResolveOperations
  | ActionPass
  | ActionPayFees
  | ActionTakeDistressedLoan
  | ActionMarketDraw
  | ActionMarketKeep
  | ActionAdvance;

export type ActionKind = Action["t"];
