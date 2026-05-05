import type { Draft } from "immer";
import type { GameAction, GameState, ValidationResult } from "../types";
import { endPlayerTurn, isCurrentPlayer } from "../state";

type PassTurnAction = Extract<GameAction, { type: "PASS_TURN" }>;

/**
 * Voluntarily end your turn. Any cards still in hand go to your discard pile
 * at cleanup, and you are marked out for the rest of the round.
 *
 * The rules don't list "pass" as an action per se, but they do say that
 * "unused cards" go to discard at cleanup — implying a player can stop acting
 * with cards still in hand. PASS_TURN makes that explicit.
 */
export function validatePassTurn(
  state: GameState,
  action: PassTurnAction,
): ValidationResult {
  if (state.phase !== "action") {
    return { legal: false, reason: `phase is "${state.phase}", expected "action"` };
  }
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return { legal: false, reason: `unknown player ${action.playerId}` };
  if (!isCurrentPlayer(state, action.playerId)) {
    return { legal: false, reason: "it is not your turn" };
  }
  if (player.outForRound) {
    return { legal: false, reason: "you are already out for the round" };
  }
  return { legal: true };
}

export function applyPassTurn(
  draft: Draft<GameState>,
  action: PassTurnAction,
): void {
  const player = draft.players.find((p) => p.id === action.playerId)!;
  player.outForRound = true;
  // Insider Buyer's half-cost is a "this turn" effect — drop it on
  // turn end so an unused discount can't carry forward.
  player.pendingHalfCostMarketBuy = false;
  endPlayerTurn(draft, action.playerId);
}
