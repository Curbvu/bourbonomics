import type { Draft } from "immer";
import type {
  Card,
  GameAction,
  GameState,
  OperationsCard,
  ValidationResult,
} from "../types";
import { drawWithReshuffle } from "../deck";
import { isCurrentPlayer } from "../state";

type PlayOperationsCardAction = Extract<GameAction, { type: "PLAY_OPERATIONS_CARD" }>;

const DEMAND_MIN = 0;
const DEMAND_MAX = 12;

export function validatePlayOperationsCard(
  state: GameState,
  action: PlayOperationsCardAction,
): ValidationResult {
  if (state.phase !== "action") {
    return { legal: false, reason: `phase is "${state.phase}", expected "action"` };
  }
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return { legal: false, reason: `unknown player ${action.playerId}` };
  if (!isCurrentPlayer(state, action.playerId)) {
    return { legal: false, reason: "it is not your turn" };
  }

  const card = player.operationsHand.find((c) => c.id === action.cardId);
  if (!card) {
    return { legal: false, reason: `operations card ${action.cardId} is not in your hand` };
  }
  if (card.defId !== action.defId) {
    return { legal: false, reason: `card ${action.cardId} is a ${card.defId}, not ${action.defId}` };
  }

  // Final-round restriction: ops cards drawn THIS round cannot be played in the
  // final round. Cards held from prior rounds remain playable.
  if (state.finalRoundTriggered && card.drawnInRound >= state.round) {
    return {
      legal: false,
      reason: "operations cards drawn during the final round cannot be played",
    };
  }

  switch (action.defId) {
    case "market_manipulation":
      if (action.direction !== "up" && action.direction !== "down") {
        return { legal: false, reason: "direction must be 'up' or 'down'" };
      }
      return { legal: true };

    case "regulatory_inspection": {
      const target = state.allBarrels.find((b) => b.id === action.targetBarrelId);
      if (!target) return { legal: false, reason: `barrel ${action.targetBarrelId} not found` };
      const owner = state.players.find((p) => p.id === target.ownerId)!;
      const slot = owner.rickhouseSlots.find((s) => s.id === target.slotId);
      if (!slot || slot.tier !== "upper") {
        return { legal: false, reason: "Regulatory Inspection targets upper-tier slots only" };
      }
      return { legal: true };
    }

    case "rushed_shipment": {
      const target = state.allBarrels.find((b) => b.id === action.targetBarrelId);
      if (!target) return { legal: false, reason: `barrel ${action.targetBarrelId} not found` };
      if (target.ownerId !== player.id) {
        return { legal: false, reason: "Rushed Shipment targets one of your own barrels" };
      }
      return { legal: true };
    }

    case "distressed_sale_notice": {
      const targetPlayer = state.players.find((p) => p.id === action.targetPlayerId);
      if (!targetPlayer) {
        return { legal: false, reason: `unknown target player ${action.targetPlayerId}` };
      }
      if (targetPlayer.id === player.id) {
        return { legal: false, reason: "cannot target yourself" };
      }
      // Target must have a full rickhouse.
      const occupied = state.allBarrels.filter((b) => b.ownerId === targetPlayer.id).length;
      if (occupied < targetPlayer.rickhouseSlots.length) {
        return { legal: false, reason: "target player's rickhouse is not full" };
      }
      const target = state.allBarrels.find((b) => b.id === action.targetBarrelId);
      if (!target || target.ownerId !== targetPlayer.id) {
        return {
          legal: false,
          reason: `barrel ${action.targetBarrelId} is not in ${targetPlayer.id}'s rickhouse`,
        };
      }
      return { legal: true };
    }

    case "barrel_broker": {
      const sourceBarrel = state.allBarrels.find((b) => b.id === action.sourceBarrelId);
      if (!sourceBarrel) {
        return { legal: false, reason: `barrel ${action.sourceBarrelId} not found` };
      }
      if (sourceBarrel.ownerId !== player.id) {
        return { legal: false, reason: "Barrel Broker requires one of your own barrels" };
      }
      const targetPlayer = state.players.find((p) => p.id === action.targetPlayerId);
      if (!targetPlayer) {
        return { legal: false, reason: `unknown target player ${action.targetPlayerId}` };
      }
      if (targetPlayer.id === player.id) {
        return { legal: false, reason: "cannot Barrel Broker to yourself" };
      }
      const targetSlot = targetPlayer.rickhouseSlots.find((s) => s.id === action.targetSlotId);
      if (!targetSlot || targetSlot.tier !== "upper") {
        return { legal: false, reason: "target slot must be on the recipient's upper tier" };
      }
      const slotOccupied = state.allBarrels.some((b) => b.slotId === action.targetSlotId);
      if (slotOccupied) {
        return { legal: false, reason: "target slot is already occupied" };
      }
      // Payment cards must be in target player's hand.
      const targetHand = new Set(targetPlayer.hand.map((c) => c.id));
      for (const id of action.paymentCardIds) {
        if (!targetHand.has(id)) {
          return { legal: false, reason: `payment card ${id} is not in ${targetPlayer.id}'s hand` };
        }
      }
      return { legal: true };
    }

    case "market_corner": {
      const slot = state.marketConveyor[action.marketSlotIndex];
      if (!slot) {
        return {
          legal: false,
          reason: `market slot ${action.marketSlotIndex} is empty or out of range`,
        };
      }
      return { legal: true };
    }

    case "blend": {
      if (action.barrel1Id === action.barrel2Id) {
        return { legal: false, reason: "Blend requires two distinct barrels" };
      }
      const b1 = state.allBarrels.find((b) => b.id === action.barrel1Id);
      const b2 = state.allBarrels.find((b) => b.id === action.barrel2Id);
      if (!b1 || !b2) return { legal: false, reason: "one or both barrels not found" };
      if (b1.ownerId !== player.id || b2.ownerId !== player.id) {
        return { legal: false, reason: "Blend requires two of your own barrels" };
      }
      const slot1 = player.rickhouseSlots.find((s) => s.id === b1.slotId);
      const slot2 = player.rickhouseSlots.find((s) => s.id === b2.slotId);
      if (slot1?.tier === "bonded" || slot2?.tier === "bonded") {
        return { legal: false, reason: "Blend cannot use bonded-warehouse barrels" };
      }
      return { legal: true };
    }

    case "demand_surge":
      return { legal: true };
  }
}

export function applyPlayOperationsCard(
  draft: Draft<GameState>,
  action: PlayOperationsCardAction,
): void {
  const player = draft.players.find((p) => p.id === action.playerId)!;
  const cardIdx = player.operationsHand.findIndex((c) => c.id === action.cardId);
  const [card] = player.operationsHand.splice(cardIdx, 1) as [OperationsCard];

  switch (action.defId) {
    case "market_manipulation": {
      if (action.direction === "up") {
        draft.demand = Math.min(DEMAND_MAX, draft.demand + 1);
      } else {
        draft.demand = Math.max(DEMAND_MIN, draft.demand - 1);
      }
      break;
    }

    case "regulatory_inspection": {
      const target = draft.allBarrels.find((b) => b.id === action.targetBarrelId)!;
      target.inspectedThisRound = true;
      break;
    }

    case "rushed_shipment": {
      const target = draft.allBarrels.find((b) => b.id === action.targetBarrelId)!;
      target.extraAgesAvailable += 1;
      break;
    }

    case "distressed_sale_notice": {
      const targetPlayer = draft.players.find((p) => p.id === action.targetPlayerId)!;
      targetPlayer.pendingRushBarrelId = action.targetBarrelId;
      break;
    }

    case "barrel_broker": {
      const targetPlayer = draft.players.find((p) => p.id === action.targetPlayerId)!;
      const sourceBarrel = draft.allBarrels.find((b) => b.id === action.sourceBarrelId)!;
      // Move payment cards from target's hand to source player's discard.
      const paySet = new Set(action.paymentCardIds);
      const newTargetHand: Card[] = [];
      const payment: Card[] = [];
      for (const c of targetPlayer.hand) {
        if (paySet.has(c.id)) payment.push(c);
        else newTargetHand.push(c);
      }
      targetPlayer.hand = newTargetHand;
      player.discard.push(...payment);
      // Transfer barrel ownership and slot.
      sourceBarrel.ownerId = targetPlayer.id;
      sourceBarrel.slotId = action.targetSlotId;
      break;
    }

    case "market_corner": {
      const [card] = draft.marketConveyor.splice(action.marketSlotIndex, 1);
      player.hand.push(card!);
      // Refill conveyor (single draw with reshuffle if needed).
      if (draft.marketSupplyDeck.length > 0 || draft.marketDiscard.length > 0) {
        const result = drawWithReshuffle(
          draft.marketSupplyDeck.slice(),
          draft.marketDiscard.slice(),
          1,
          draft.rngState,
        );
        if (result.drawn.length > 0) {
          draft.marketConveyor.push(result.drawn[0]!);
        }
        draft.marketSupplyDeck = result.deck;
        draft.marketDiscard = result.discard;
        draft.rngState = result.rngState;
      }
      break;
    }

    case "blend": {
      const b1Idx = draft.allBarrels.findIndex((b) => b.id === action.barrel1Id);
      const b2Idx = draft.allBarrels.findIndex((b) => b.id === action.barrel2Id);
      const b1 = draft.allBarrels[b1Idx]!;
      const b2 = draft.allBarrels[b2Idx]!;

      const peak1 = peakReward(b1.attachedMashBill);
      const peak2 = peakReward(b2.attachedMashBill);
      const keepFirst = peak1 >= peak2;
      const keptBill = keepFirst ? b1.attachedMashBill : b2.attachedMashBill;
      const discardedBill = keepFirst ? b2.attachedMashBill : b1.attachedMashBill;

      // Survivor occupies b1's slot; b2 is removed.
      b1.attachedMashBill = keptBill;
      b1.age = Math.max(b1.age, b2.age);
      b1.agingCards = [...b1.agingCards, ...b2.agingCards];
      b1.productionCardDefIds = [...b1.productionCardDefIds, ...b2.productionCardDefIds];
      // age counter is a function of agingCards.length post-blend
      b1.age = b1.agingCards.length;
      // Preserve agedThisRound only if either was already aged.
      b1.agedThisRound = b1.agedThisRound || b2.agedThisRound;
      b1.inspectedThisRound = b1.inspectedThisRound || b2.inspectedThisRound;
      b1.extraAgesAvailable = b1.extraAgesAvailable + b2.extraAgesAvailable;

      draft.bourbonDiscard.push(discardedBill);
      // Remove b2 from allBarrels (mind index ordering after b1 was edited).
      draft.allBarrels.splice(b2Idx, 1);
      break;
    }

    case "demand_surge": {
      player.demandSurgeActive = true;
      break;
    }
  }

  draft.operationsDiscard.push(card);
  // Playing an ops card does NOT consume the action — turn does not end.
}

function peakReward(bill: { rewardGrid: (number | null)[][] }): number {
  let max = 0;
  for (const row of bill.rewardGrid) {
    for (const cell of row) {
      if (cell !== null && cell > max) max = cell;
    }
  }
  return max;
}
