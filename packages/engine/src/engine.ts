import { produce, type Draft } from "immer";
import type { GameAction, GameState, ScoreResult, ValidationResult } from "./types";
import { applyRollDemand, validateRollDemand } from "./actions/demand";
import { applyDrawHand, validateDrawHand } from "./actions/draw";
import { applyMakeBourbon, validateMakeBourbon } from "./actions/make-bourbon";
import { applyAgeBourbon, validateAgeBourbon } from "./actions/age-bourbon";
import { applySellBourbon, validateSellBourbon } from "./actions/sell-bourbon";
import { applyBuyFromMarket, validateBuyFromMarket } from "./actions/buy-from-market";
import { applyDrawMashBill, validateDrawMashBill } from "./actions/draw-deck";
import { applyTrade, validateTrade } from "./actions/trade";
import { applyPassTurn, validatePassTurn } from "./actions/pass-turn";

export class IllegalActionError extends Error {
  constructor(
    message: string,
    public readonly action: GameAction,
  ) {
    super(message);
    this.name = "IllegalActionError";
  }
}

/**
 * Pure validation. Never throws; safe for UI gating.
 */
export function validateAction(state: GameState, action: GameAction): ValidationResult {
  switch (action.type) {
    case "ROLL_DEMAND":
      return validateRollDemand(state, action);
    case "DRAW_HAND":
      return validateDrawHand(state, action);
    case "MAKE_BOURBON":
      return validateMakeBourbon(state, action);
    case "AGE_BOURBON":
      return validateAgeBourbon(state, action);
    case "SELL_BOURBON":
      return validateSellBourbon(state, action);
    case "BUY_FROM_MARKET":
      return validateBuyFromMarket(state, action);
    case "DRAW_MASH_BILL":
      return validateDrawMashBill(state, action);
    case "TRADE":
      return validateTrade(state, action);
    case "PASS_TURN":
      return validatePassTurn(state, action);
    default:
      return { legal: false, reason: `unhandled action type: ${(action as { type: string }).type}` };
  }
}

/**
 * Validates and applies an action, returning a new GameState.
 * Throws IllegalActionError if the action is not legal in the current state.
 */
export function applyAction(state: GameState, action: GameAction): GameState {
  const validation = validateAction(state, action);
  if (!validation.legal) {
    throw new IllegalActionError(
      `${action.type}: ${validation.reason ?? "illegal"}`,
      action,
    );
  }
  return produce(state, (draft: Draft<GameState>) => {
    dispatch(draft, action);
    draft.actionHistory.push(action);
  });
}

function dispatch(draft: Draft<GameState>, action: GameAction): void {
  switch (action.type) {
    case "ROLL_DEMAND":
      applyRollDemand(draft, action);
      return;
    case "DRAW_HAND":
      applyDrawHand(draft, action);
      return;
    case "MAKE_BOURBON":
      applyMakeBourbon(draft, action);
      return;
    case "AGE_BOURBON":
      applyAgeBourbon(draft, action);
      return;
    case "SELL_BOURBON":
      applySellBourbon(draft, action);
      return;
    case "BUY_FROM_MARKET":
      applyBuyFromMarket(draft, action);
      return;
    case "DRAW_MASH_BILL":
      applyDrawMashBill(draft, action);
      return;
    case "TRADE":
      applyTrade(draft, action);
      return;
    case "PASS_TURN":
      applyPassTurn(draft, action);
      return;
    default:
      throw new IllegalActionError(`unhandled action type: ${(action as { type: string }).type}`, action);
  }
}

export function isGameOver(state: GameState): boolean {
  return state.phase === "ended";
}

/**
 * Tiebreakers (per rules):
 *   1. Most reputation
 *   2. Fewest cards remaining in deck (lean engine wins)
 *   3. Most barrels sold
 *   4. Shared rank
 */
export function computeFinalScores(state: GameState): ScoreResult[] {
  const rows = state.players.map((p) => ({
    playerId: p.id,
    reputation: p.reputation,
    deckSize: p.hand.length + p.deck.length + p.discard.length,
    barrelsSold: p.barrelsSold,
    rank: 0,
  }));
  rows.sort((a, b) => {
    if (b.reputation !== a.reputation) return b.reputation - a.reputation;
    if (a.deckSize !== b.deckSize) return a.deckSize - b.deckSize;
    return b.barrelsSold - a.barrelsSold;
  });
  let rank = 1;
  for (let i = 0; i < rows.length; i++) {
    if (
      i > 0 &&
      (rows[i]!.reputation !== rows[i - 1]!.reputation ||
        rows[i]!.deckSize !== rows[i - 1]!.deckSize ||
        rows[i]!.barrelsSold !== rows[i - 1]!.barrelsSold)
    ) {
      rank = i + 1;
    }
    rows[i]!.rank = rank;
  }
  return rows;
}
