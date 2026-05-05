import type { Draft } from "immer";
import type { GameAction, GameState, MashBill, ValidationResult } from "../types";
import { awardConditionMet, computeReward } from "../rewards";
import { endPlayerTurn, isCurrentPlayer } from "../state";

type RushToMarketAction = Extract<GameAction, { type: "RUSH_TO_MARKET" }>;

export function validateRushToMarket(
  state: GameState,
  action: RushToMarketAction,
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

  // If there's a forced rush pending, the player MUST resolve it (and only it).
  if (player.pendingRushBarrelId && player.pendingRushBarrelId !== action.barrelId) {
    return {
      legal: false,
      reason: `you must Rush to Market the forced barrel ${player.pendingRushBarrelId} first`,
    };
  }

  // Voluntary rushes require a 1-year barrel. Forced rushes (from Distressed
  // Sale Notice) bypass the age check — the targeting validation already
  // happened when the ops card was played.
  const isForced = player.pendingRushBarrelId === action.barrelId;
  if (!isForced && barrel.age !== 1) {
    return { legal: false, reason: "Rush to Market requires a 1-year-old barrel" };
  }

  if (action.goldBourbonId) {
    const has = player.unlockedGoldBourbons.find((m) => m.id === action.goldBourbonId);
    if (!has) {
      return { legal: false, reason: `gold bourbon ${action.goldBourbonId} is not unlocked` };
    }
  }

  return { legal: true };
}

export function applyRushToMarket(
  draft: Draft<GameState>,
  action: RushToMarketAction,
): void {
  const player = draft.players.find((p) => p.id === action.playerId)!;
  const barrelIdx = draft.allBarrels.findIndex((b) => b.id === action.barrelId);
  const barrel = draft.allBarrels[barrelIdx]!;
  const attached = barrel.attachedMashBill;

  const billForReward: MashBill = action.goldBourbonId
    ? player.unlockedGoldBourbons.find((m) => m.id === action.goldBourbonId)!
    : attached;
  const baseReward = computeReward(billForReward, barrel.age, draft.demand);
  // Half rounded down, minimum 1.
  const halved = Math.max(1, Math.floor(baseReward / 2));
  player.reputation += halved;

  // Aging cards return to discard.
  player.discard.push(...barrel.agingCards);

  // Awards resolve as usual against the ATTACHED bill, using the halved reward.
  const goldEligible =
    attached.goldAward &&
    awardConditionMet(attached.goldAward, barrel.age, draft.demand, halved);
  const silverEligible =
    attached.silverAward &&
    awardConditionMet(attached.silverAward, barrel.age, draft.demand, halved);
  if (goldEligible) {
    player.unlockedGoldBourbons.push(attached);
  } else if (silverEligible) {
    player.mashBills.push(attached);
  } else {
    draft.bourbonDiscard.push(attached);
  }

  draft.allBarrels.splice(barrelIdx, 1);
  player.barrelsSold += 1;

  // Demand does NOT drop on Rush to Market.

  // Clear forced-rush flag if this resolved one.
  if (player.pendingRushBarrelId === action.barrelId) {
    player.pendingRushBarrelId = null;
  }

  endPlayerTurn(draft, action.playerId);
}
