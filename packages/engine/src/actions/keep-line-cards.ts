import type { Draft } from "immer";
import type { GameAction, GameState, ValidationResult } from "../types";
import { isCurrentPlayer } from "../state";

type KeepLineCardsAction = Extract<GameAction, { type: "KEEP_LINE_CARDS" }>;

/**
 * v3.0 Line system — resolve a `pendingLineCardDraw` by keeping at
 * least 1 of the revealed cards. The rest return to the bottom of
 * the shared `lineCardDeck` (front of array per the deck
 * convention).
 */
export function validateKeepLineCards(
  state: GameState,
  action: KeepLineCardsAction,
): ValidationResult {
  if (!isCurrentPlayer(state, action.playerId)) {
    return { legal: false, reason: "it is not your turn" };
  }
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return { legal: false, reason: `unknown player ${action.playerId}` };
  const pending = player.pendingLineCardDraw;
  if (!pending) {
    return { legal: false, reason: "no Line Card draw is pending for you" };
  }
  if (action.keepInstanceIds.length < 1) {
    return { legal: false, reason: "must keep at least 1 Line Card" };
  }
  if (action.keepInstanceIds.length > pending.cards.length) {
    return {
      legal: false,
      reason: `cannot keep more than ${pending.cards.length} cards`,
    };
  }
  const offered = new Set(pending.cards.map((c) => c.instanceId));
  const keep = new Set(action.keepInstanceIds);
  if (keep.size !== action.keepInstanceIds.length) {
    return { legal: false, reason: "duplicate keep ids" };
  }
  for (const id of keep) {
    if (!offered.has(id)) {
      return { legal: false, reason: `Line Card ${id} not in your draw` };
    }
  }
  return { legal: true };
}

export function applyKeepLineCards(
  draft: Draft<GameState>,
  action: KeepLineCardsAction,
): void {
  const player = draft.players.find((p) => p.id === action.playerId)!;
  const pending = player.pendingLineCardDraw!;
  const keepSet = new Set(action.keepInstanceIds);
  const kept = pending.cards.filter((c) => keepSet.has(c.instanceId));
  const returned = pending.cards.filter((c) => !keepSet.has(c.instanceId));
  player.lineCardHand.push(...kept);
  draft.lineCardDeck.unshift(...returned);
  player.pendingLineCardDraw = null;
}
