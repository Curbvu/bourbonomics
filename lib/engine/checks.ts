/**
 * Legal-action predicates. These are queried by the reducer (to guard against
 * bad dispatches) and by the bot (to enumerate legal moves).
 */

import type { BourbonCardDef } from "@/lib/catalogs/types";
import { BOURBON_CARDS_BY_ID } from "./decks";
import type { RickhouseId } from "./rickhouses";
import type {
  BarrelInstance,
  GameState,
  Player,
  ResourceCardInstance,
} from "./state";
import { validateMash } from "@/lib/rules/mash";

export function isActivePlayer(state: GameState, playerId: string): boolean {
  const p = state.players[playerId];
  return Boolean(p) && !p.eliminated;
}

export function isPlayersTurn(state: GameState, playerId: string): boolean {
  return state.currentPlayerId === playerId;
}

export function currentActionCost(state: GameState): number {
  if (state.actionPhase.freeWindowActive) return 0;
  return state.actionPhase.paidLapTier;
}

export function canAffordCurrentAction(state: GameState, playerId: string): boolean {
  const cost = currentActionCost(state);
  return state.players[playerId].cash >= cost;
}

export function findBarrel(
  state: GameState,
  barrelId: string,
): { barrel: BarrelInstance; rickhouseIdx: number } | null {
  for (let i = 0; i < state.rickhouses.length; i++) {
    const b = state.rickhouses[i].barrels.find((x) => x.barrelId === barrelId);
    if (b) return { barrel: b, rickhouseIdx: i };
  }
  return null;
}

export function canMakeBourbon(
  state: GameState,
  playerId: string,
  rickhouseId: RickhouseId,
  resourceInstanceIds: string[],
  mashBillId: string,
): { ok: true } | { ok: false; reason: string } {
  const player = state.players[playerId];
  const rickhouse = state.rickhouses.find((r) => r.id === rickhouseId);
  if (!rickhouse) return { ok: false, reason: "Unknown rickhouse" };
  if (rickhouse.barrels.length >= rickhouse.capacity) {
    return { ok: false, reason: "Rickhouse is full" };
  }

  // Mash bill must be in the player's bourbon hand (committed at production,
  // locked to the barrel; it leaves the hand on success).
  if (!player.bourbonHand.includes(mashBillId)) {
    return { ok: false, reason: "Mash bill not in your hand" };
  }
  if (!BOURBON_CARDS_BY_ID[mashBillId]) {
    return { ok: false, reason: `Unknown mash bill ${mashBillId}` };
  }

  const seen = new Set<string>();
  const mash: ResourceCardInstance[] = [];
  for (const id of resourceInstanceIds) {
    if (seen.has(id))
      return { ok: false, reason: `Duplicate resource ${id}` };
    seen.add(id);
    const card = player.resourceHand.find((r) => r.instanceId === id);
    if (!card)
      return { ok: false, reason: `Resource ${id} not in hand` };
    mash.push(card);
  }

  const valid = validateMash(mash);
  if (!valid.ok) return valid;
  return { ok: true };
}

export function canSellBourbon(
  state: GameState,
  playerId: string,
  barrelId: string,
): { ok: true; card: BourbonCardDef } | { ok: false; reason: string } {
  const found = findBarrel(state, barrelId);
  if (!found) return { ok: false, reason: "Barrel not found" };
  if (found.barrel.ownerId !== playerId)
    return { ok: false, reason: "Not your barrel" };
  if (found.barrel.age < 2)
    return { ok: false, reason: "Bourbon must age ≥ 2 years before selling" };

  const card = BOURBON_CARDS_BY_ID[found.barrel.mashBillId];
  if (!card) {
    return {
      ok: false,
      reason: `Unknown mash bill ${found.barrel.mashBillId}`,
    };
  }
  return { ok: true, card };
}

export function canPassAction(state: GameState, playerId: string): boolean {
  // Passing is always legal on your turn, regardless of the paid-action ladder.
  return state.phase === "action" && state.currentPlayerId === playerId;
}

export function activePlayerCount(state: GameState): number {
  return state.playerOrder.filter(
    (id) => !state.players[id].eliminated,
  ).length;
}

export function playerHasLiquidAssets(player: Player): boolean {
  return player.cash > 0;
}
