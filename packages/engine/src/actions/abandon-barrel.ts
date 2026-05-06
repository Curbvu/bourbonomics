import type { Draft } from "immer";
import type { GameAction, GameState, ValidationResult } from "../types";
import { isCurrentPlayer } from "../state";

// ============================================================
// ABANDON_BARREL — v2.6.
//
// Discard a "ready" or "construction" barrel. All committed production
// cards return to the player's discard pile, the slot becomes fully
// open, and the attached mash bill is sent to the shared bourbon
// discard pile. Subsumes the v2.5 "trash a committed slot" flow.
// Aging-phase barrels cannot be abandoned — once a barrel finishes
// construction it can only leave via SELL.
// ============================================================

type AbandonBarrelAction = Extract<GameAction, { type: "ABANDON_BARREL" }>;

export function validateAbandonBarrel(
  state: GameState,
  action: AbandonBarrelAction,
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
  if (!barrel) {
    return { legal: false, reason: `unknown barrel ${action.barrelId}` };
  }
  if (barrel.ownerId !== player.id) {
    return { legal: false, reason: "you do not own that barrel" };
  }
  if (barrel.phase === "aging") {
    return { legal: false, reason: "aging barrels cannot be abandoned (sell instead)" };
  }
  return { legal: true };
}

export function applyAbandonBarrel(
  draft: Draft<GameState>,
  action: AbandonBarrelAction,
): void {
  const player = draft.players.find((p) => p.id === action.playerId)!;
  const idx = draft.allBarrels.findIndex((b) => b.id === action.barrelId);
  if (idx < 0) return;
  const barrel = draft.allBarrels[idx]!;

  // All committed cards (production pile only — construction barrels
  // never have aging cards) go to the player's discard. They are NOT
  // trashed; the player gets to reuse them on a future build.
  for (const card of barrel.productionCards) {
    player.discard.push(card);
  }

  // v2.6: bill is always present. Discard to the shared bourbon
  // discard pile so it stays in circulation for the doomsday clock.
  draft.bourbonDiscard.push(barrel.attachedMashBill);

  // Free the slot.
  draft.allBarrels.splice(idx, 1);
}
