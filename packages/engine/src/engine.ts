import { produce, type Draft } from "immer";
import type { GameAction, GameState, ScoreResult, ValidationResult } from "./types";
import { applyRollDemand, validateRollDemand } from "./actions/demand";
import { applyDrawHand, validateDrawHand } from "./actions/draw";
import { applyMakeBourbon, validateMakeBourbon } from "./actions/make-bourbon";
import { applyAbandonBarrel, validateAbandonBarrel } from "./actions/abandon-barrel";
import { applyAgeBourbon, validateAgeBourbon } from "./actions/age-bourbon";
import { applySellBourbon, validateSellBourbon } from "./actions/sell-bourbon";
import { applyBuyFromMarket, validateBuyFromMarket } from "./actions/buy-from-market";
import {
  applyBuyOperationsCard,
  validateBuyOperationsCard,
} from "./actions/buy-operations-card";
import { applyDrawMashBill, validateDrawMashBill } from "./actions/draw-deck";
import { applyTrade, validateTrade } from "./actions/trade";
import { applyPassTurn, validatePassTurn } from "./actions/pass-turn";
import { applySelectDistillery, validateSelectDistillery } from "./actions/select-distillery";
import { applyStarterTrade, validateStarterTrade } from "./actions/starter-trade";
import { applyStarterSwap, validateStarterSwap } from "./actions/starter-swap";
import { applyStarterPass, validateStarterPass } from "./actions/starter-pass";
import {
  applyPlayOperationsCard,
  validatePlayOperationsCard,
} from "./actions/play-operations-card";

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
  // v2.9: in the action phase, the current player must roll demand
  // before doing anything else. PLAY_OPERATIONS_CARD stays free since
  // it's a 0-cost prelude historically — but every other "real" action
  // is gated on the per-turn demand roll.
  if (state.phase === "action" && action.type !== "ROLL_DEMAND" && action.type !== "PLAY_OPERATIONS_CARD") {
    const current = state.players[state.currentPlayerIndex];
    if (current && current.needsDemandRoll) {
      return {
        legal: false,
        reason: `${current.id} must roll demand before taking other actions`,
      };
    }
    // v2.9: after the demand roll, the player must commit one card to
    // an aging barrel before sales / buys / trades / new builds. The
    // narrow allow-list (AGE / ABANDON / PASS / PLAY_OPS) lets them
    // satisfy the cost, give up the turn, or fire free ops cards.
    if (current && current.needsAgeBarrels) {
      const allowedDuringAgePhase = new Set([
        "AGE_BOURBON",
        "ABANDON_BARREL",
        "PASS_TURN",
      ]);
      if (!allowedDuringAgePhase.has(action.type)) {
        return {
          legal: false,
          reason: `${current.id} must age a barrel before taking other actions`,
        };
      }
    }
  }
  switch (action.type) {
    case "SELECT_DISTILLERY":
      return validateSelectDistillery(state, action);
    case "STARTER_TRADE":
      return validateStarterTrade(state, action);
    case "STARTER_SWAP":
      return validateStarterSwap(state, action);
    case "STARTER_PASS":
      return validateStarterPass(state, action);
    case "ROLL_DEMAND":
      return validateRollDemand(state, action);
    case "DRAW_HAND":
      return validateDrawHand(state, action);
    case "MAKE_BOURBON":
      return validateMakeBourbon(state, action);
    case "ABANDON_BARREL":
      return validateAbandonBarrel(state, action);
    case "AGE_BOURBON":
      return validateAgeBourbon(state, action);
    case "SELL_BOURBON":
      return validateSellBourbon(state, action);
    case "BUY_FROM_MARKET":
      return validateBuyFromMarket(state, action);
    case "BUY_OPERATIONS_CARD":
      return validateBuyOperationsCard(state, action);
    case "DRAW_MASH_BILL":
      return validateDrawMashBill(state, action);
    case "TRADE":
      return validateTrade(state, action);
    case "PLAY_OPERATIONS_CARD":
      return validatePlayOperationsCard(state, action);
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
    case "SELECT_DISTILLERY":
      applySelectDistillery(draft, action);
      return;
    case "STARTER_TRADE":
      applyStarterTrade(draft, action);
      return;
    case "STARTER_SWAP":
      applyStarterSwap(draft, action);
      return;
    case "STARTER_PASS":
      applyStarterPass(draft, action);
      return;
    case "ROLL_DEMAND":
      applyRollDemand(draft, action);
      return;
    case "DRAW_HAND":
      applyDrawHand(draft, action);
      return;
    case "MAKE_BOURBON":
      applyMakeBourbon(draft, action);
      return;
    case "ABANDON_BARREL":
      applyAbandonBarrel(draft, action);
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
    case "BUY_OPERATIONS_CARD":
      applyBuyOperationsCard(draft, action);
      return;
    case "DRAW_MASH_BILL":
      applyDrawMashBill(draft, action);
      return;
    case "TRADE":
      applyTrade(draft, action);
      return;
    case "PLAY_OPERATIONS_CARD":
      applyPlayOperationsCard(draft, action);
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
