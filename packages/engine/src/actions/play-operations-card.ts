import type { Draft } from "immer";
import type {
  Card,
  GameAction,
  GameState,
  OperationsCard,
  RickhouseSlot,
  ValidationResult,
} from "../types";
import { makeCapitalCard } from "../cards";
import { drawWithReshuffle } from "../deck";
import { isCurrentPlayer } from "../state";

type PlayOperationsCardAction = Extract<GameAction, { type: "PLAY_OPERATIONS_CARD" }>;

const DEMAND_MIN = 0;
const DEMAND_MAX = 12;
const MARKET_CONVEYOR_SIZE = 10;
const RICKHOUSE_SLOT_HARD_CAP = 6;

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
    case "bourbon_boom":
    case "glut":
    case "insider_buyer":
    case "kentucky_connection":
    case "bottling_run":
      return { legal: true };

    case "cash_out": {
      const hasResources = player.hand.some((c) => c.type === "resource");
      if (!hasResources) {
        return { legal: false, reason: "no resource cards in hand to cash out" };
      }
      return { legal: true };
    }

    case "allocation": {
      if (state.bourbonDeck.length === 0) {
        return { legal: false, reason: "the bourbon deck is empty" };
      }
      return { legal: true };
    }

    case "rickhouse_expansion_permit": {
      if (player.rickhouseSlots.length >= RICKHOUSE_SLOT_HARD_CAP) {
        return {
          legal: false,
          reason: `rickhouse already at the ${RICKHOUSE_SLOT_HARD_CAP}-slot cap`,
        };
      }
      return { legal: true };
    }

    case "forced_cure": {
      const target = state.allBarrels.find((b) => b.id === action.targetBarrelId);
      if (!target) return { legal: false, reason: `barrel ${action.targetBarrelId} not found` };
      if (target.ownerId !== player.id) {
        return { legal: false, reason: "Forced Cure targets one of your own barrels" };
      }
      return { legal: true };
    }

    case "mash_futures":
    case "coopers_contract": {
      if (player.pendingMakeDiscount != null) {
        return {
          legal: false,
          reason: "you already have a pre-played production discount queued",
        };
      }
      return { legal: true };
    }

    case "rating_boost": {
      if (player.pendingRatingBoost > 0) {
        return {
          legal: false,
          reason: "a Rating Boost is already queued for your next sale",
        };
      }
      return { legal: true };
    }

    case "master_distiller": {
      const target = state.allBarrels.find((b) => b.id === action.targetBarrelId);
      if (!target) return { legal: false, reason: `barrel ${action.targetBarrelId} not found` };
      if (target.ownerId !== player.id) {
        return { legal: false, reason: "Master Distiller targets one of your own barrels" };
      }
      return { legal: true };
    }
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

    case "bourbon_boom": {
      draft.demand = Math.min(DEMAND_MAX, draft.demand + 2);
      break;
    }

    case "glut": {
      draft.demand = Math.max(DEMAND_MIN, draft.demand - 2);
      break;
    }

    case "insider_buyer": {
      // Sweep the conveyor into the market discard, then deal a fresh
      // 10 from the supply (drawing through reshuffle if needed).
      draft.marketDiscard.push(...draft.marketConveyor);
      draft.marketConveyor = [];
      const want = MARKET_CONVEYOR_SIZE;
      const result = drawWithReshuffle(
        draft.marketSupplyDeck.slice(),
        draft.marketDiscard.slice(),
        want,
        draft.rngState,
      );
      draft.marketConveyor.push(...result.drawn);
      draft.marketSupplyDeck = result.deck;
      draft.marketDiscard = result.discard;
      draft.rngState = result.rngState;
      // Bonus from the spec: the next BUY_FROM_MARKET this turn pays
      // half the printed cost (rounded up, min 1¢). Cleared on the
      // purchase, on PASS_TURN, or in cleanup.
      player.pendingHalfCostMarketBuy = true;
      break;
    }

    case "kentucky_connection": {
      const result = drawWithReshuffle(
        player.deck.slice(),
        player.discard.slice(),
        2,
        draft.rngState,
      );
      player.hand.push(...result.drawn);
      player.deck = result.deck;
      player.discard = result.discard;
      draft.rngState = result.rngState;
      break;
    }

    case "bottling_run": {
      // Each player draws 1 from their own deck (with reshuffle).
      for (const p of draft.players) {
        const result = drawWithReshuffle(
          p.deck.slice(),
          p.discard.slice(),
          1,
          draft.rngState,
        );
        p.hand.push(...result.drawn);
        p.deck = result.deck;
        p.discard = result.discard;
        draft.rngState = result.rngState;
      }
      break;
    }

    case "cash_out": {
      // Discard every resource card from hand; mint $1 capital cards
      // (one per discarded resource) into the discard pile.
      const kept: Card[] = [];
      const discarded: Card[] = [];
      for (const c of player.hand) {
        if (c.type === "resource") discarded.push(c);
        else kept.push(c);
      }
      player.hand = kept;
      player.discard.push(...discarded);
      for (let i = 0; i < discarded.length; i++) {
        player.discard.push(
          makeCapitalCard(player.id, draft.idCounter++, 1),
        );
      }
      break;
    }

    case "allocation": {
      // Take the top 2 mash bills (or however many remain) into hand.
      const take = Math.min(2, draft.bourbonDeck.length);
      for (let i = 0; i < take; i++) {
        const bill = draft.bourbonDeck.pop();
        if (bill) player.mashBills.push(bill);
      }
      break;
    }

    case "rickhouse_expansion_permit": {
      const newSlot: RickhouseSlot = {
        id: `slot_${player.id}_perm_${draft.idCounter++}`,
        ownerId: player.id,
        tier: "upper",
      };
      player.rickhouseSlots.push(newSlot);
      break;
    }

    case "forced_cure": {
      const target = draft.allBarrels.find((b) => b.id === action.targetBarrelId)!;
      target.extraAgesAvailable += 1;
      break;
    }

    case "mash_futures": {
      player.pendingMakeDiscount = "grain";
      break;
    }

    case "coopers_contract": {
      player.pendingMakeDiscount = "cask";
      break;
    }

    case "rating_boost": {
      // Stacks: a player who somehow held two could queue +4. Validate
      // currently rejects a second copy, so this is just defensive.
      player.pendingRatingBoost += 2;
      break;
    }

    case "master_distiller": {
      const target = draft.allBarrels.find((b) => b.id === action.targetBarrelId)!;
      target.demandBandOffset += 2;
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
