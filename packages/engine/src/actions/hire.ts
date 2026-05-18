import type { Draft } from "immer";
import type { GameAction, GameState, ValidationResult } from "../types";
import { makeLaborCard } from "../cards";
import { isCurrentPlayer } from "../state";

type HireAction = Extract<GameAction, { type: "HIRE" }>;

/**
 * v2.11 (Unified Rep) — HIRE: take 1 Generic Labor card from the
 * central pile and add it to your discard. Free action, once per
 * turn (gated by `player.hireUsedThisTurn`). Illegal when the pile
 * is empty.
 */
export function validateHire(
  state: GameState,
  action: HireAction,
): ValidationResult {
  if (state.phase !== "action") {
    return { legal: false, reason: `phase is "${state.phase}", expected "action"` };
  }
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return { legal: false, reason: `unknown player ${action.playerId}` };
  if (!isCurrentPlayer(state, action.playerId)) {
    return { legal: false, reason: "it is not your turn" };
  }
  if (player.hireUsedThisTurn) {
    return { legal: false, reason: "you have already hired this turn" };
  }
  if (state.laborPile <= 0) {
    return { legal: false, reason: "the central Labor pile is empty" };
  }
  return { legal: true };
}

export function applyHire(
  draft: Draft<GameState>,
  action: HireAction,
): void {
  const player = draft.players.find((p) => p.id === action.playerId)!;
  draft.laborPile -= 1;
  player.hireUsedThisTurn = true;
  player.discard.push(
    makeLaborCard({
      subtype: "generic",
      ownerLabel: player.id,
      index: draft.idCounter++,
    }),
  );
  // Free action — turn does NOT end.
}
