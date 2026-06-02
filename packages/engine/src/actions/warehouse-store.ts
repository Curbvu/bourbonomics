import type { Draft } from "immer";
import type { GameAction, GameState, ValidationResult } from "../types";
import { isCurrentPlayer } from "../state";

type WarehouseStoreAction = Extract<GameAction, { type: "WAREHOUSE_STORE" }>;

/**
 * v3.6 Warehouse investment — set one card from hand aside into the
 * player's private Warehouse slot. The slot holds at most one card and
 * persists across End Turn and round cleanup. Free action: it does not
 * end the turn and costs nothing.
 */
export function validateWarehouseStore(
  state: GameState,
  action: WarehouseStoreAction,
): ValidationResult {
  if (state.phase !== "action") {
    return { legal: false, reason: `phase is "${state.phase}", expected "action"` };
  }
  if (!isCurrentPlayer(state, action.playerId)) {
    return { legal: false, reason: "it is not your turn" };
  }
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return { legal: false, reason: `unknown player ${action.playerId}` };
  if (!player.warehouseUnlocked) {
    return { legal: false, reason: "you have not bought the Warehouse investment" };
  }
  if (player.warehouseSlot) {
    return {
      legal: false,
      reason: "your Warehouse already holds a card (retrieve it first)",
    };
  }
  if (!player.hand.some((c) => c.id === action.cardId)) {
    return { legal: false, reason: `card ${action.cardId} is not in your hand` };
  }
  return { legal: true };
}

export function applyWarehouseStore(
  draft: Draft<GameState>,
  action: WarehouseStoreAction,
): void {
  const player = draft.players.find((p) => p.id === action.playerId)!;
  const idx = player.hand.findIndex((c) => c.id === action.cardId);
  if (idx < 0) return;
  const [card] = player.hand.splice(idx, 1);
  if (card) player.warehouseSlot = card;
}
