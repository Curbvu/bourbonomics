import type { Draft } from "immer";
import type { GameAction, GameState, ValidationResult } from "../types";
import {
  DEFAULT_STARTER_SIZE,
  buildStarterDeck,
  validateStarterComposition,
} from "../drafting";
import { makeResourceCard } from "../cards";
import { shuffleCards } from "../deck";

type ComposeStarterDeckAction = Extract<GameAction, { type: "COMPOSE_STARTER_DECK" }>;

export function validateComposeStarterDeck(
  state: GameState,
  action: ComposeStarterDeckAction,
): ValidationResult {
  if (state.phase !== "starter_deck_draft") {
    return { legal: false, reason: `phase is "${state.phase}", expected "starter_deck_draft"` };
  }
  const expectedPlayerId = state.starterDeckDraftOrder[state.starterDeckDraftCursor];
  if (!expectedPlayerId) {
    return { legal: false, reason: "no remaining picks in starter-deck draft order" };
  }
  if (expectedPlayerId !== action.playerId) {
    return {
      legal: false,
      reason: `it is ${expectedPlayerId}'s turn to compose, not ${action.playerId}`,
    };
  }
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return { legal: false, reason: `unknown player ${action.playerId}` };

  return validateStarterComposition(action.composition, DEFAULT_STARTER_SIZE);
}

export function applyComposeStarterDeck(
  draft: Draft<GameState>,
  action: ComposeStarterDeckAction,
): void {
  const player = draft.players.find((p) => p.id === action.playerId)!;

  // Build the deck from the composition spec.
  const baseDeck = buildStarterDeck(action.composition, player.id, DEFAULT_STARTER_SIZE);

  // High-Rye House bonus: free 2-rye sits on top of the composed starter.
  const deckWithBonus =
    player.distillery?.bonus === "high_rye"
      ? [...baseDeck, makeResourceCard("rye", player.id, 999, true, 2)]
      : baseDeck;

  const shuffleResult = shuffleCards(deckWithBonus, draft.rngState);
  player.deck = shuffleResult.shuffled;
  draft.rngState = shuffleResult.rngState;

  draft.starterDeckDraftCursor += 1;
  if (draft.starterDeckDraftCursor >= draft.starterDeckDraftOrder.length) {
    // All players composed — into the round loop.
    draft.phase = "demand";
  }
}
