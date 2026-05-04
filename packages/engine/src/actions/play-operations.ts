import type { Draft } from "immer";
import type { GameAction, GameState, OperationsCard, OperationsEffect, ValidationResult } from "../types.js";
import { drawWithReshuffle } from "../deck.js";
import { endPlayerTurn, isCurrentPlayer } from "../state.js";

type PlayOperationsAction = Extract<GameAction, { type: "PLAY_OPERATIONS" }>;

const DEMAND_MIN = 0;
const DEMAND_MAX = 12;

export function validatePlayOperations(
  state: GameState,
  action: PlayOperationsAction,
): ValidationResult {
  if (state.phase !== "action") {
    return { legal: false, reason: `phase is "${state.phase}", expected "action"` };
  }
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return { legal: false, reason: `unknown player ${action.playerId}` };
  if (!isCurrentPlayer(state, action.playerId)) {
    return { legal: false, reason: "it is not your turn" };
  }
  const ops = player.heldOperations.find((o) => o.id === action.operationsCardId);
  if (!ops) {
    return { legal: false, reason: `operations card ${action.operationsCardId} is not in your held cards` };
  }
  // Effect-specific validation (currently a no-op for the supported effects).
  return { legal: true };
}

export function applyPlayOperations(
  draft: Draft<GameState>,
  action: PlayOperationsAction,
): void {
  const player = draft.players.find((p) => p.id === action.playerId)!;
  const idx = player.heldOperations.findIndex((o) => o.id === action.operationsCardId);
  const [ops] = player.heldOperations.splice(idx, 1);
  draft.operationsDiscard.push(ops as OperationsCard);

  resolveOperationsEffect(draft, action.playerId, ops!.effect);
  endPlayerTurn(draft, action.playerId);
}

function resolveOperationsEffect(
  draft: Draft<GameState>,
  playerId: string,
  effect: OperationsEffect,
): void {
  switch (effect.kind) {
    case "demand_delta": {
      draft.demand = clamp(draft.demand + effect.amount, DEMAND_MIN, DEMAND_MAX);
      return;
    }
    case "draw_cards": {
      const player = draft.players.find((p) => p.id === playerId)!;
      const result = drawWithReshuffle(
        player.deck.slice(),
        player.discard.slice(),
        effect.amount,
        draft.rngState,
      );
      player.hand.push(...result.drawn);
      player.deck = result.deck;
      player.discard = result.discard;
      draft.rngState = result.rngState;
      return;
    }
    case "trash_opponent_hand_card":
    case "steal_from_discard":
      // Targeted effects deferred — these need explicit target data and a
      // structured opponent-card-selection flow. Treat as no-op for now.
      return;
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
