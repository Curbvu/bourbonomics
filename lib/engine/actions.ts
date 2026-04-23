/**
 * Reducer action union. Every state change flows through one of these.
 *
 * Rules source: docs/GAME_RULES.md §Actions + §Round structure.
 * Opening-phase actions are also here (the rules call them "setup" but
 * conceptually the reducer still needs them as dispatchable events).
 */

import type { RickhouseId } from "./rickhouses";

export type ResourcePileName =
  | "cask"
  | "corn"
  | "barley"
  | "rye"
  | "wheat";

// ---------- Action-phase actions (Phase 2) ----------

export type ActionDrawResource = {
  t: "DRAW_RESOURCE";
  playerId: string;
  pile: ResourcePileName;
};

export type ActionDrawBourbon = {
  t: "DRAW_BOURBON";
  playerId: string;
  source: "face-up" | "deck";
};

export type ActionMakeBourbon = {
  t: "MAKE_BOURBON";
  playerId: string;
  rickhouseId: RickhouseId;
  /** Instance ids of resource cards from the player's hand to commit to the mash. */
  resourceInstanceIds: string[];
};

export type ActionSellBourbon = {
  t: "SELL_BOURBON";
  playerId: string;
  barrelId: string;
  /** Bourbon card id chosen for the sale — either a face-up id or a drawn id already in hand. */
  bourbonCardId: string;
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

// ---------- Phase-1 action (fees) ----------

export type ActionPayFees = {
  t: "PAY_FEES";
  playerId: string;
  /** Barrel ids the player chooses to pay rent on this round. */
  barrelIds: string[];
};

// ---------- Phase-3 actions (market) ----------

export type ActionRollDemand = { t: "ROLL_DEMAND"; playerId: string };
export type ActionDrawEvent = { t: "DRAW_EVENT"; playerId: string };

// ---------- Opening-phase actions ----------

export type ActionOpeningKeep = {
  t: "OPENING_KEEP";
  playerId: string;
  keptIds: string[]; // exactly 3
};

export type ActionOpeningCommit = {
  t: "OPENING_COMMIT";
  playerId: string;
  /** One decision per kept card, in the same order as keptIds from OPENING_KEEP. */
  decisions: Array<"implement" | "hold">;
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
  | ActionPass
  | ActionPayFees
  | ActionRollDemand
  | ActionDrawEvent
  | ActionOpeningKeep
  | ActionOpeningCommit
  | ActionAdvance;

export type ActionKind = Action["t"];
