import type { Draft } from "immer";
import type { Distillery, GameAction, GameState, ValidationResult } from "../types";
import { buildRickhouseSlots } from "../distilleries";
import { makeResourceCard } from "../cards";
import { shuffleCards } from "../deck";

type SelectDistilleryAction = Extract<GameAction, { type: "SELECT_DISTILLERY" }>;

export function validateSelectDistillery(
  state: GameState,
  action: SelectDistilleryAction,
): ValidationResult {
  if (state.phase !== "distillery_selection") {
    return { legal: false, reason: `phase is "${state.phase}", expected "distillery_selection"` };
  }
  const expectedPlayerId = state.distillerySelectionOrder[state.distillerySelectionCursor];
  if (!expectedPlayerId) {
    return { legal: false, reason: "no remaining picks in distillery selection order" };
  }
  if (expectedPlayerId !== action.playerId) {
    return { legal: false, reason: `it is ${expectedPlayerId}'s turn to pick, not ${action.playerId}` };
  }
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return { legal: false, reason: `unknown player ${action.playerId}` };
  if (player.distillery) {
    return { legal: false, reason: `${action.playerId} already has a distillery` };
  }
  const distillery = state.distilleryPool.find((d) => d.id === action.distilleryId);
  if (!distillery) {
    return { legal: false, reason: `distillery ${action.distilleryId} is not in the pool` };
  }
  return { legal: true };
}

export function applySelectDistillery(
  draft: Draft<GameState>,
  action: SelectDistilleryAction,
): void {
  const player = draft.players.find((p) => p.id === action.playerId)!;
  const idx = draft.distilleryPool.findIndex((d) => d.id === action.distilleryId);
  const [distillery] = draft.distilleryPool.splice(idx, 1) as [Distillery];

  player.distillery = distillery;
  player.rickhouseSlots = buildRickhouseSlots(player.id, distillery);

  // High-Rye House bonus: insert a 2-rye into the player's deck and reshuffle.
  if (distillery.bonus === "high_rye") {
    const bonus = makeResourceCard("rye", player.id, 999, true, 2);
    const combined = [...player.deck, bonus];
    const { shuffled, rngState } = shuffleCards(combined, draft.rngState);
    player.deck = shuffled;
    draft.rngState = rngState;
  }

  draft.distillerySelectionCursor += 1;
  if (draft.distillerySelectionCursor >= draft.distillerySelectionOrder.length) {
    // All players have picked — transition into the round loop.
    draft.phase = "demand";
  }
}
