import type { Draft } from "immer";
import type { GameAction, GameState, ValidationResult } from "../types";
import { isCurrentPlayer } from "../state";

// ============================================================
// ABANDON_BARREL — v2.5.
//
// Discard an under-construction barrel. All committed production
// cards return to the player's discard pile, the slot is freed, and
// the (possibly attached) mash bill is also discarded into the
// shared bourbon discard. Aging-phase barrels cannot be abandoned —
// once a barrel finishes construction it can only leave via SELL.
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
  if (barrel.phase !== "construction") {
    return { legal: false, reason: "only under-construction barrels can be abandoned" };
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

  // The mash bill, if attached, is discarded to the shared bourbon
  // discard pile. The bill is gone from the player's resources but
  // stays in circulation for the doomsday clock + face-up row.
  if (barrel.attachedMashBill) {
    draft.bourbonDiscard.push(barrel.attachedMashBill);
  }

  // Free the slot.
  draft.allBarrels.splice(idx, 1);
}
