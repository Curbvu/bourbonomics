import type { Draft } from "immer";
import type { GameAction, GameState, ValidationResult } from "../types";

type ExtendLineAction = Extract<GameAction, { type: "EXTEND_LINE" }>;

/**
 * v3.0 EXTEND_LINE — retired in v3.1. Cards no longer "stack" on a
 * line for an additive predicate/scoring contribution; each Line
 * Card is now a positioned slot played via PLAY_LINE_CARD onto a
 * secondary line in slot order.
 *
 * The action type stays in the union for save-file / replay
 * compatibility (an older transcript may carry one). Validation
 * rejects every attempt with a directive to use PLAY_LINE_CARD.
 */
export function validateExtendLine(
  _state: GameState,
  _action: ExtendLineAction,
): ValidationResult {
  return {
    legal: false,
    reason:
      "EXTEND_LINE is retired in v3.1; use PLAY_LINE_CARD to add a positioned slot to a secondary Bourbon Line",
  };
}

export function applyExtendLine(
  _draft: Draft<GameState>,
  _action: ExtendLineAction,
): void {
  // Unreachable — validateExtendLine always returns illegal.
}
