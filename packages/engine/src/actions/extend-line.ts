import type { Draft } from "immer";
import type { GameAction, GameState, ValidationResult } from "../types";
import { isCurrentPlayer } from "../state";
import { findLineById } from "../lines/placement";

type ExtendLineAction = Extract<GameAction, { type: "EXTEND_LINE" }>;

/**
 * v3.0 Line system — stack one Line Card from hand onto an existing
 * line (flagship or one of the player's secondary lines). The new
 * constraint applies to FUTURE placements only — existing bottles on
 * the line are NOT re-validated (per brief). Free action.
 */
export function validateExtendLine(
  state: GameState,
  action: ExtendLineAction,
): ValidationResult {
  if (state.phase !== "action") {
    return {
      legal: false,
      reason: `phase is "${state.phase}", expected "action"`,
    };
  }
  if (!isCurrentPlayer(state, action.playerId)) {
    return { legal: false, reason: "it is not your turn" };
  }
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return { legal: false, reason: `unknown player ${action.playerId}` };
  const card = player.lineCardHand.find(
    (c) => c.instanceId === action.lineCardInstanceId,
  );
  if (!card) {
    return {
      legal: false,
      reason: `Line Card ${action.lineCardInstanceId} is not in your hand`,
    };
  }
  const line = findLineById(player, action.targetLineId);
  if (!line) {
    return {
      legal: false,
      reason: `target line ${action.targetLineId} not found`,
    };
  }
  return { legal: true };
}

export function applyExtendLine(
  draft: Draft<GameState>,
  action: ExtendLineAction,
): void {
  const player = draft.players.find((p) => p.id === action.playerId)!;
  const cardIdx = player.lineCardHand.findIndex(
    (c) => c.instanceId === action.lineCardInstanceId,
  );
  const [card] = player.lineCardHand.splice(cardIdx, 1);
  // findLineById walks the immer draft directly so the push mutates
  // the right line in place.
  let target =
    player.flagshipLine.id === action.targetLineId
      ? player.flagshipLine
      : player.secondaryLines.find((l) => l.id === action.targetLineId);
  if (!target) return; // unreachable after validation
  target.stackedCards.push(card!);
}
