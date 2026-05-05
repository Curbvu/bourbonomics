import type { Draft } from "immer";
import type { GameAction, GameState, ValidationResult } from "../types";
import { shuffleCards } from "../deck";

type StarterPassAction = Extract<GameAction, { type: "STARTER_PASS" }>;

export function validateStarterPass(
  state: GameState,
  action: StarterPassAction,
): ValidationResult {
  if (state.phase !== "starter_deck_draft") {
    return { legal: false, reason: `phase is "${state.phase}", expected "starter_deck_draft"` };
  }
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return { legal: false, reason: `unknown player ${action.playerId}` };
  if (!state.starterDeckDraftOrder.includes(action.playerId)) {
    return { legal: false, reason: `${action.playerId} is not a starter drafter` };
  }
  if (player.starterPassed) {
    return { legal: false, reason: `${action.playerId} has already passed` };
  }
  return { legal: true };
}

export function applyStarterPass(
  draft: Draft<GameState>,
  action: StarterPassAction,
): void {
  const player = draft.players.find((p) => p.id === action.playerId)!;
  player.starterPassed = true;

  // If every drafter has passed, finalize: shuffle each starter hand
  // into the player's deck and clear the trade-window state.
  const drafters = draft.starterDeckDraftOrder
    .map((id) => draft.players.find((p) => p.id === id)!)
    .filter((p) => p !== undefined);
  const allPassed = drafters.every((p) => p.starterPassed);
  if (!allPassed) return;

  for (const p of drafters) {
    const shuffleResult = shuffleCards(p.starterHand, draft.rngState);
    p.deck = shuffleResult.shuffled;
    draft.rngState = shuffleResult.rngState;
    p.starterHand = [];
  }
  draft.starterUndealtPool = [];
  draft.phase = "demand";
}
