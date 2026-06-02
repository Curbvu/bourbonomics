import type { Draft } from "immer";
import type { GameAction, GameState, ValidationResult } from "../types";
import { isCurrentPlayer } from "../state";
import { MASTER_DISTILLER_TAGS } from "../investments";

type ResolveInvestmentChoiceAction = Extract<
  GameAction,
  { type: "RESOLVE_INVESTMENT_CHOICE" }
>;

const BRAND_AMBASSADOR_DEMAND_BONUS = 2;

/**
 * v3.6 — discharge a pending on-purchase investment choice. Set by
 * BUY_FROM_MARKET when the bought investment requires a follow-up pick
 * (see `applyOnPurchaseEffect`). The active player is gated to this
 * action until the choice clears (mirrors `pendingBottlePlacement`).
 *
 *   Brand Ambassador             → `barrelId`  (permanent +2 demand read)
 *   Master Distiller             → `tag`       (inherited by future barrels)
 *   Climate-Controlled Warehouse → `slotId`    (aging-negative immunity)
 *   Bonded Warehouse             → `slotId`    (aging cards return on sale)
 */
export function validateResolveInvestmentChoice(
  state: GameState,
  action: ResolveInvestmentChoiceAction,
): ValidationResult {
  if (!isCurrentPlayer(state, action.playerId)) {
    return { legal: false, reason: "it is not your turn" };
  }
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return { legal: false, reason: `unknown player ${action.playerId}` };
  const pending = player.pendingInvestmentChoice;
  if (!pending) {
    return { legal: false, reason: "you have no pending investment choice" };
  }

  switch (pending.defId) {
    case "brand_ambassador": {
      const barrel = state.allBarrels.find((b) => b.id === action.barrelId);
      if (!barrel) {
        return { legal: false, reason: `barrel ${action.barrelId} not found` };
      }
      if (barrel.ownerId !== player.id) {
        return { legal: false, reason: "Brand Ambassador targets one of your own barrels" };
      }
      return { legal: true };
    }
    case "master_distiller": {
      if (!action.tag || !MASTER_DISTILLER_TAGS.includes(action.tag)) {
        return {
          legal: false,
          reason: `tag must be one of ${MASTER_DISTILLER_TAGS.join(", ")}`,
        };
      }
      return { legal: true };
    }
    case "climate_controlled_warehouse":
    case "bonded_warehouse": {
      const slot = player.rickhouseSlots.find((s) => s.id === action.slotId);
      if (!slot) {
        return { legal: false, reason: `slot ${action.slotId} is not one of your rickhouse slots` };
      }
      return { legal: true };
    }
    default:
      return { legal: false, reason: `unresolvable pending choice ${pending.defId}` };
  }
}

export function applyResolveInvestmentChoice(
  draft: Draft<GameState>,
  action: ResolveInvestmentChoiceAction,
): void {
  const player = draft.players.find((p) => p.id === action.playerId)!;
  const pending = player.pendingInvestmentChoice;
  if (!pending) return;

  switch (pending.defId) {
    case "brand_ambassador": {
      const barrel = draft.allBarrels.find((b) => b.id === action.barrelId);
      if (barrel) barrel.demandBandOffset += BRAND_AMBASSADOR_DEMAND_BONUS;
      break;
    }
    case "master_distiller": {
      if (action.tag) player.masterDistillerTag = action.tag;
      break;
    }
    case "climate_controlled_warehouse": {
      if (action.slotId && !player.climateControlledSlotIds.includes(action.slotId)) {
        player.climateControlledSlotIds.push(action.slotId);
      }
      break;
    }
    case "bonded_warehouse": {
      if (action.slotId && !player.bondedSlotIds.includes(action.slotId)) {
        player.bondedSlotIds.push(action.slotId);
      }
      break;
    }
  }
  player.pendingInvestmentChoice = null;
}
