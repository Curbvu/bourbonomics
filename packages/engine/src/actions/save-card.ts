import type { Draft } from "immer";
import type { GameAction, GameState, ValidationResult } from "../types";

type SaveCardAction = Extract<GameAction, { type: "SAVE_CARD" }>;

/**
 * v2.11 — SAVE_CARD: set aside one card from hand into the Save
 * slot. Joins next round's draw on top of the 8-card deal. Only one
 * card may be saved at a time. Legal during the player's action
 * phase OR during cleanup (the engine doesn't currently expose a
 * cleanup decision window, so we allow saves during the action
 * phase — the player picks the card before passing the turn).
 *
 * The card moves out of hand immediately; if the player has cards
 * remaining at end-of-round cleanup, those still discard as usual.
 */
export function validateSaveCard(
  state: GameState,
  action: SaveCardAction,
): ValidationResult {
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return { legal: false, reason: `unknown player ${action.playerId}` };
  if (state.phase !== "action") {
    return { legal: false, reason: `phase is "${state.phase}", expected "action"` };
  }
  if (player.savedCard != null) {
    return {
      legal: false,
      reason: "you already have a card in the Save slot",
    };
  }
  const card = player.hand.find((c) => c.id === action.cardId);
  if (!card) {
    return { legal: false, reason: `card ${action.cardId} is not in your hand` };
  }
  // Resource and Labor only — operations cards live in their own
  // hand, mash bills are slot-bound, and there are no other card
  // types in the player's main hand.
  if (card.type !== "resource" && card.type !== "labor") {
    return {
      legal: false,
      reason: "only resource and Labor cards may be saved",
    };
  }
  return { legal: true };
}

export function applySaveCard(
  draft: Draft<GameState>,
  action: SaveCardAction,
): void {
  const player = draft.players.find((p) => p.id === action.playerId)!;
  const idx = player.hand.findIndex((c) => c.id === action.cardId);
  const [card] = player.hand.splice(idx, 1);
  player.savedCard = card!;
  // Free action — turn does NOT end.
}
