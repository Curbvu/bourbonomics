import type { Draft } from "immer";
import type { GameAction, GameState, ValidationResult } from "../types";
import { isCurrentPlayer } from "../state";

type DrawLineCardsAction = Extract<GameAction, { type: "DRAW_LINE_CARDS" }>;

/**
 * v3.0 Line system — reveal up to 3 cards from the top of the
 * shared `lineCardDeck` into the active player's
 * `pendingLineCardDraw`. Once per round per player. Free action —
 * does not end the turn.
 *
 * Top-of-deck convention matches the rest of the engine: the END of
 * the array is the top.
 */
const DRAW_COUNT = 3;

export function validateDrawLineCards(
  state: GameState,
  action: DrawLineCardsAction,
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
  if (player.hasDrawnLineCardsThisRound) {
    return {
      legal: false,
      reason: "you have already drawn Line Cards this round",
    };
  }
  if (player.pendingLineCardDraw) {
    return {
      legal: false,
      reason: "resolve your pending Line Card draw first",
    };
  }
  if (state.lineCardDeck.length === 0) {
    return { legal: false, reason: "the Line Card deck is empty" };
  }
  return { legal: true };
}

export function applyDrawLineCards(
  draft: Draft<GameState>,
  action: DrawLineCardsAction,
): void {
  const player = draft.players.find((p) => p.id === action.playerId)!;
  const drawSize = Math.min(DRAW_COUNT, draft.lineCardDeck.length);
  const top = draft.lineCardDeck.slice(draft.lineCardDeck.length - drawSize);
  // Drawn order: top card first (matches drawCards convention).
  const drawn = top.slice().reverse();
  draft.lineCardDeck.length = draft.lineCardDeck.length - drawSize;
  player.pendingLineCardDraw = { cards: drawn };
  player.hasDrawnLineCardsThisRound = true;
}
