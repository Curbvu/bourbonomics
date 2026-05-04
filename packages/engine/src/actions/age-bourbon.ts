import type { Draft } from "immer";
import type { GameAction, GameState, ValidationResult } from "../types";
import { endPlayerTurn, isCurrentPlayer } from "../state";

type AgeBourbonAction = Extract<GameAction, { type: "AGE_BOURBON" }>;

export function validateAgeBourbon(
  state: GameState,
  action: AgeBourbonAction,
): ValidationResult {
  if (state.phase !== "action") {
    return { legal: false, reason: `phase is "${state.phase}", expected "action"` };
  }
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return { legal: false, reason: `unknown player ${action.playerId}` };
  if (!isCurrentPlayer(state, action.playerId)) {
    return { legal: false, reason: "it is not your turn" };
  }

  const barrel = state.allBarrels.find((b) => b.id === action.barrelId);
  if (!barrel) return { legal: false, reason: `barrel ${action.barrelId} not found` };
  if (barrel.ownerId !== action.playerId) {
    return { legal: false, reason: "you do not own that barrel" };
  }
  if (barrel.agedThisRound) {
    return { legal: false, reason: "barrel has already been aged this round" };
  }

  const card = player.hand.find((c) => c.id === action.cardId);
  if (!card) return { legal: false, reason: `card ${action.cardId} not in hand` };

  return { legal: true };
}

export function applyAgeBourbon(
  draft: Draft<GameState>,
  action: AgeBourbonAction,
): void {
  const player = draft.players.find((p) => p.id === action.playerId)!;
  const cardIdx = player.hand.findIndex((c) => c.id === action.cardId);
  const [card] = player.hand.splice(cardIdx, 1);

  const barrel = draft.allBarrels.find((b) => b.id === action.barrelId)!;
  barrel.agingCards.push(card!);
  barrel.age = barrel.agingCards.length;
  barrel.agedThisRound = true;

  endPlayerTurn(draft, action.playerId);
}
