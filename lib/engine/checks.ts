/**
 * Legal-action predicates. These are queried by the reducer (to guard against
 * bad dispatches) and by the bot (to enumerate legal moves).
 */

import type { BourbonCardDef, DistilleryPerk } from "@/lib/catalogs/types";
import { DISTILLERY_CARDS_BY_ID } from "@/lib/catalogs/distillery.generated";
import { BOURBON_CARDS_BY_ID } from "./decks";
import type { RickhouseId } from "./rickhouses";
import type {
  BarrelInstance,
  GameState,
  Player,
  ResourceCardInstance,
} from "./state";
import { validateMash } from "@/lib/rules/mash";

/**
 * Resolve the chosen Distillery perk for a player, or null if they
 * haven't drafted yet (still in `distillery_draft` phase) or if the
 * card id doesn't resolve.
 */
export function distilleryPerkOf(
  state: GameState,
  playerId: string,
): DistilleryPerk | null {
  const p = state.players[playerId];
  if (!p?.chosenDistilleryId) return null;
  const def = DISTILLERY_CARDS_BY_ID[p.chosenDistilleryId];
  return def?.perk ?? null;
}

export function isActivePlayer(state: GameState, playerId: string): boolean {
  const p = state.players[playerId];
  return Boolean(p) && !p.eliminated;
}

export function isPlayersTurn(state: GameState, playerId: string): boolean {
  return state.currentPlayerId === playerId;
}

/**
 * Cost the given player would pay for their next action right now.
 *
 * Resolution order:
 *   1. Table-wide free window (every player's first action of the round).
 *   2. Lap-cost ladder (`paidLapTier`).
 *   3. The Bootlegger Distillery perk subtracts $1 (floor 0).
 *
 * Pass `playerId` for the per-player resolution (so the Bootlegger
 * perk applies); omit (or pass null) to get the table-wide ladder cost
 * only — useful for UI elements that preview the global tier without
 * picking a player.
 */
export function currentActionCost(
  state: GameState,
  playerId?: string | null,
): number {
  let base = state.actionPhase.freeWindowActive
    ? 0
    : state.actionPhase.paidLapTier;
  if (playerId) {
    const perk = distilleryPerkOf(state, playerId);
    if (perk?.kind === "paid_action_discount") {
      base = Math.max(0, base - perk.amount);
    }
  }
  return base;
}

export function canAffordCurrentAction(state: GameState, playerId: string): boolean {
  const cost = currentActionCost(state, playerId);
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

/**
 * Number of cards counted against the soft 10-card hand limit. Includes
 * mash bills + UNBUILT investments + operations cards. Active investments
 * sit on the table and are NOT in hand. Unlocked Gold Bourbons are
 * trophies, also NOT in hand.
 */
export function handSize(player: Player): number {
  const unbuiltInvestments = player.investments.filter(
    (i) => i.status === "unbuilt",
  ).length;
  return (
    player.bourbonHand.length + unbuiltInvestments + player.operations.length
  );
}

export function canMakeBourbon(
  state: GameState,
  playerId: string,
  rickhouseId: RickhouseId,
  resourceInstanceIds: string[],
  mashBillId: string,
): { ok: true } | { ok: false; reason: string } {
  const player = state.players[playerId];
  // Market-card block — Distillery Strike skips the leader's next make.
  const blocked = state.currentRoundEffects.playersBlockedFromMake;
  if (blocked && blocked.includes(playerId)) {
    return {
      ok: false,
      reason: "Distillery strike — you can't make bourbon this round",
    };
  }
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

  // Pull the bill's optional recipe so per-bill grain requirements are
  // enforced alongside the universal rules (1 cask · ≥1 corn · ≥1 grain
  // · ≤MAX_MASH_CARDS). Recipes can only tighten — they never loosen.
  const billDef = BOURBON_CARDS_BY_ID[mashBillId];
  const valid = validateMash(mash, billDef.recipe);
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

export function canCallAudit(
  state: GameState,
  playerId: string,
): { ok: true } | { ok: false; reason: string } {
  if (state.phase !== "action") return { ok: false, reason: "Not in action phase" };
  if (state.currentPlayerId !== playerId)
    return { ok: false, reason: "Not your turn" };
  const p = state.players[playerId];
  if (!p || p.eliminated) return { ok: false, reason: "No player" };
  if (p.pendingAuditOverage != null)
    return { ok: false, reason: "You owe an audit discard first" };
  if (state.actionPhase.auditCalledThisRound)
    return { ok: false, reason: "Audit already called this round" };
  if (!canAffordCurrentAction(state, playerId))
    return { ok: false, reason: "Cannot afford action cost" };
  return { ok: true };
}

export function canPassAction(state: GameState, playerId: string): boolean {
  // Passing is always legal on your turn, regardless of the paid-action ladder.
  // Exception: a player owing an audit discard cannot pass — they must
  // resolve the discard first.
  if (state.phase !== "action") return false;
  if (state.currentPlayerId !== playerId) return false;
  if (state.players[playerId].pendingAuditOverage != null) return false;
  return true;
}

export function activePlayerCount(state: GameState): number {
  return state.playerOrder.filter(
    (id) => !state.players[id].eliminated,
  ).length;
}

export function playerHasLiquidAssets(player: Player): boolean {
  return player.cash > 0;
}
