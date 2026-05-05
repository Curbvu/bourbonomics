import type { Draft } from "immer";
import type { GameAction, GameState, ValidationResult } from "../types";
import { endPlayerTurn, isCurrentPlayer } from "../state";

type PassTurnAction = Extract<GameAction, { type: "PASS_TURN" }>;

/**
 * Voluntarily end your full turn. Any resource / capital cards still in
 * hand are held until the Cleanup Phase, when they hit the discard pile.
 * Operations cards in hand carry across rounds. Once you end your turn
 * you do not act again until the next round.
 *
 * Under v2.2, no main action ends a turn implicitly — only PASS_TURN
 * (the "End Turn" action) does. A bot whose hand is empty also emits
 * PASS_TURN as its terminal action.
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
  endPlayerTurn(draft, action.playerId);
}
