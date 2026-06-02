import type { Draft } from "immer";
import type { GameAction, GameState, ValidationResult } from "../types";
import { isCurrentPlayer } from "../state";

type WarehouseRetrieveAction = Extract<
  GameAction,
  { type: "WAREHOUSE_RETRIEVE" }
>;

/**
 * v3.6 Warehouse investment — pull the stored Warehouse card back into
 * hand. Free action; legal only when a card is currently stored.
 */
export function validateWarehouseRetrieve(
  state: GameState,
  action: WarehouseRetrieveAction,
): ValidationResult {
  if (state.phase !== "action") {
    return { legal: false, reason: `phase is "${state.phase}", expected "action"` };
  }
  if (!isCurrentPlayer(state, action.playerId)) {
    return { legal: false, reason: "it is not your turn" };
  }
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return { legal: false, reason: `unknown player ${action.playerId}` };
  if (!player.warehouseSlot) {
    return { legal: false, reason: "your Warehouse is empty" };
  }
  return { legal: true };
}

export function applyWarehouseRetrieve(
  draft: Draft<GameState>,
  action: WarehouseRetrieveAction,
): void {
  const player = draft.players.find((p) => p.id === action.playerId)!;
  if (!player.warehouseSlot) return;
  player.hand.push(player.warehouseSlot);
  player.warehouseSlot = null;
}
