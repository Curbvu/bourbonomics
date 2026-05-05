import type { Draft } from "immer";
import type { GameAction, GameState, OperationsCard, ValidationResult } from "../types";
import { drawCards, drawWithReshuffle } from "../deck";
import { runCleanupPhase } from "../state";

type DrawHandAction = Extract<GameAction, { type: "DRAW_HAND" }>;

export function validateDrawHand(
  state: GameState,
  action: DrawHandAction,
): ValidationResult {
  if (state.phase !== "draw") {
    return { legal: false, reason: `phase is "${state.phase}", expected "draw"` };
  }
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return { legal: false, reason: `unknown player ${action.playerId}` };
  if (state.playerIdsCompletedPhase.includes(action.playerId)) {
    return { legal: false, reason: `${action.playerId} has already drawn this round` };
  }
  return { legal: true };
}

export function applyDrawHand(
  draft: Draft<GameState>,
  action: DrawHandAction,
): void {
  const player = draft.players.find((p) => p.id === action.playerId)!;
  const result = drawWithReshuffle(
    player.deck.slice(),
    player.discard.slice(),
    player.handSize,
    draft.rngState,
  );
  player.hand.push(...result.drawn);
  player.deck = result.deck;
  player.discard = result.discard;
  draft.rngState = result.rngState;

  // Also draw 1 operations card if the deck has any. Tag it with the round
  // it entered the player's hand so we can gate final-round playability.
  if (draft.operationsDeck.length > 0) {
    const opsResult = drawCards<OperationsCard>(draft.operationsDeck.slice(), 1);
    if (opsResult.drawn.length > 0) {
      const drawn = opsResult.drawn[0]!;
      player.operationsHand.push({ ...drawn, drawnInRound: draft.round });
      draft.operationsDeck = opsResult.remaining;
    }
  }

  draft.playerIdsCompletedPhase.push(action.playerId);

  if (draft.playerIdsCompletedPhase.length === draft.players.length) {
    draft.phase = "action";
    draft.playerIdsCompletedPhase = [];
    for (const p of draft.players) {
      p.outForRound = p.hand.length === 0;
    }
    const firstActive = draft.players.findIndex((p) => !p.outForRound);
    if (firstActive === -1) {
      // No one has any cards — bounce straight through to next round (or end).
      runCleanupPhase(draft);
    } else {
      draft.currentPlayerIndex = firstActive;
    }
  }
}
