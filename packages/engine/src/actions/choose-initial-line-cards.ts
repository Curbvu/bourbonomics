import type { Draft } from "immer";
import type { GameAction, GameState, ValidationResult } from "../types";

type ChooseInitialLineCardsAction = Extract<
  GameAction,
  { type: "CHOOSE_INITIAL_LINE_CARDS" }
>;

/**
 * v3.0 Line system — resolve the 4-card initial draft dealt at game
 * init. Each player must keep exactly 2 cards; the other 2 return to
 * the bottom of the shared `lineCardDeck` in the order given.
 *
 * Per-player gate: this action is the ONLY one legal for a player
 * while `pendingInitialLineCardDraft` is non-null on them. Other
 * players proceed normally — the resolution is concurrent.
 */
const REQUIRED_KEEP_COUNT = 2;

export function validateChooseInitialLineCards(
  state: GameState,
  action: ChooseInitialLineCardsAction,
): ValidationResult {
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return { legal: false, reason: `unknown player ${action.playerId}` };
  const pending = player.pendingInitialLineCardDraft;
  if (!pending) {
    return {
      legal: false,
      reason: "no initial Line Card draft is pending for you",
    };
  }
  if (action.keepInstanceIds.length !== REQUIRED_KEEP_COUNT) {
    return {
      legal: false,
      reason: `must keep exactly ${REQUIRED_KEEP_COUNT} Line Cards`,
    };
  }
  const offered = new Set(pending.cards.map((c) => c.instanceId));
  const keep = new Set(action.keepInstanceIds);
  if (keep.size !== action.keepInstanceIds.length) {
    return { legal: false, reason: "duplicate keep ids" };
  }
  for (const id of keep) {
    if (!offered.has(id)) {
      return { legal: false, reason: `Line Card ${id} not in your draft` };
    }
  }
  return { legal: true };
}

export function applyChooseInitialLineCards(
  draft: Draft<GameState>,
  action: ChooseInitialLineCardsAction,
): void {
  const player = draft.players.find((p) => p.id === action.playerId)!;
  const pending = player.pendingInitialLineCardDraft!;
  const keepSet = new Set(action.keepInstanceIds);
  const kept = pending.cards.filter((c) => keepSet.has(c.instanceId));
  const returned = pending.cards.filter((c) => !keepSet.has(c.instanceId));
  player.lineCardHand.push(...kept);
  // Return rejected cards to the bottom of the deck (front of array
  // per the deck convention; see `deck.ts`).
  draft.lineCardDeck.unshift(...returned);
  player.pendingInitialLineCardDraft = null;
}
