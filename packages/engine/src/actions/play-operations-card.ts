import type { Draft } from "immer";
import type {
  GameAction,
  GameState,
  OperationsCard,
  ValidationResult,
} from "../types";
import { drawWithReshuffle } from "../deck";
import {
  emptySlotsFor,
  isCurrentPlayer,
  maybeTriggerFinalRound,
} from "../state";
import { placeBillInSlot } from "../starter-pool";

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
      if (target.phase !== "aging") {
        return { legal: false, reason: "barrel is still under construction" };
      }
      return { legal: true };
    }

    case "rushed_shipment": {
      const target = state.allBarrels.find((b) => b.id === action.targetBarrelId);
      if (!target) return { legal: false, reason: `barrel ${action.targetBarrelId} not found` };
      if (target.ownerId !== player.id) {
        return { legal: false, reason: "Rushed Shipment targets one of your own barrels" };
      }
      if (target.phase !== "aging") {
        return { legal: false, reason: "barrel is still under construction" };
      }
      return { legal: true };
    }

    case "demand_surge":
    case "bourbon_boom":
    case "glut":
    case "kentucky_connection":
    case "wild_mash":
      return { legal: true };

    case "allocation": {
      // v2.6: still legal even with zero open slots (the card is
      // consumed but has no effect). Per the spec: "If you have zero
      // open slots, this card has no effect (still consumed)."
      if (state.bourbonDeck.length === 0) {
        return { legal: false, reason: "the bourbon deck is empty" };
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

    case "allocation": {
      // v2.6: draw up to 2 bills, one per open slot. Capped at the
      // player's open-slot count AND respects the slotted-bill cap
      // (Connoisseur Estate). Each drawn bill becomes a "ready"
      // barrel in an open slot.
      const billCap = player.distillery?.maxSlottedBills;
      const slottedCount = draft.allBarrels.filter((b) => b.ownerId === player.id).length;
      const slotsRoom = emptySlotsFor(draft, player.id).length;
      const billCapRoom =
        billCap !== undefined ? Math.max(0, billCap - slottedCount) : Infinity;
      const take = Math.min(2, draft.bourbonDeck.length, slotsRoom, billCapRoom);
      for (let i = 0; i < take; i++) {
        const bill = draft.bourbonDeck.pop();
        if (!bill) break;
        if (placeBillInSlot(draft, player, bill) == null) {
          // No open slot left — return bill to bottom of deck.
          draft.bourbonDeck.unshift(bill);
          break;
        }
      }
      // v2.14: Allocation can drain the bourbon deck.
      maybeTriggerFinalRound(draft);
      break;
    }

    case "rating_boost": {
      // Stacks: a player who somehow held two could queue +4. Validate
      // currently rejects a second copy, so this is just defensive.
      player.pendingRatingBoost += 2;
      break;
    }

    case "wild_mash": {
      // One-shot pre-play token. Consumed by the next MAKE_BOURBON
      // (whether or not the player invokes the swap), and cleared on
      // PASS_TURN if the player never builds. No carry across turns.
      player.pendingWildMashToken = true;
      break;
    }
  }

  // Played ops card is out of play permanently. (The unified-market
  // model no longer tracks an operationsDiscard pile; played-and-
  // resolved ops cards don't re-enter the market — those would be
  // rebuyable supply, which is too generous.)
  void card;
  // Playing an ops card does NOT consume the action — turn does not end.
}
