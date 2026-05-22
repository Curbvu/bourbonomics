import type { Draft } from "immer";
import type { Card, GameAction, GameState, ValidationResult } from "../types";
import { laborContribution } from "../types";
import { applySpendEffect } from "../card-effects";
import { drawWithReshuffle } from "../deck";
import { isCurrentPlayer } from "../state";

type BuyFromMarketAction = Extract<GameAction, { type: "BUY_FROM_MARKET" }>;

const MARKET_CONVEYOR_SIZE = 10;

/**
 * Payment validation rules:
 *   total = rep + sum(laborCardIds → laborContribution(card, "market_resource"))
 *   total ≥ cost
 *   rep ≥ 0, never goes negative
 *
 * Rep and Labor are fully fungible — any cost can be paid in rep, Labor,
 * or any mix. A $0 cost still requires at least one payment unit unless
 * the action explicitly handles it.
 *
 * Insider Buyer (pre-played) halves the printed cost, rounded up,
 * floored at 1.
 */
export function validateBuyFromMarket(
  state: GameState,
  action: BuyFromMarketAction,
): ValidationResult {
  if (state.phase !== "action") {
    return { legal: false, reason: `phase is "${state.phase}", expected "action"` };
  }
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return { legal: false, reason: `unknown player ${action.playerId}` };
  if (!isCurrentPlayer(state, action.playerId)) {
    return { legal: false, reason: "it is not your turn" };
  }

  const purchased = state.marketConveyor[action.marketSlotIndex];
  if (!purchased) {
    return {
      legal: false,
      reason: `market slot ${action.marketSlotIndex} is empty or out of range`,
    };
  }

  const printedCost = purchased.cost ?? 1;
  const cost = player.pendingHalfCostMarketBuy
    ? Math.max(1, Math.ceil(printedCost / 2))
    : printedCost;

  // Validate rep portion.
  if (!Number.isInteger(action.rep) || action.rep < 0) {
    return { legal: false, reason: "rep payment must be a non-negative integer" };
  }
  if (action.rep > player.reputation) {
    return {
      legal: false,
      reason: `not enough reputation: have ${player.reputation}, paying ${action.rep}`,
    };
  }

  // Validate Labor card ids — they must be in hand, be Labor type,
  // and be uniquely listed.
  const laborIds = action.laborCardIds;
  if (new Set(laborIds).size !== laborIds.length) {
    return { legal: false, reason: "duplicate Labor card id in payment" };
  }
  const handById = new Map(player.hand.map((c) => [c.id, c]));
  let laborTotal = 0;
  for (const id of laborIds) {
    const card = handById.get(id);
    if (!card) return { legal: false, reason: `card ${id} is not in your hand` };
    if (card.type !== "labor") {
      return { legal: false, reason: `card ${id} is not a Labor card` };
    }
    laborTotal += laborContribution(card, "market_resource");
  }

  const total = action.rep + laborTotal;
  if (total < cost) {
    return {
      legal: false,
      reason: `payment totals ${total}, need ${cost}`,
    };
  }

  return { legal: true };
}

export function applyBuyFromMarket(
  draft: Draft<GameState>,
  action: BuyFromMarketAction,
): void {
  const player = draft.players.find((p) => p.id === action.playerId)!;
  const purchased = draft.marketConveyor[action.marketSlotIndex]!;

  // Remove the purchased card from the conveyor.
  draft.marketConveyor.splice(action.marketSlotIndex, 1);

  // Spend rep.
  player.reputation -= action.rep;

  // Discard Labor cards (firing any on_spend effects — Lender's Note
  // style — though no Labor card currently declares such an effect).
  const laborSet = new Set(action.laborCardIds);
  const newHand: Card[] = [];
  const spentLabor: Card[] = [];
  for (const card of player.hand) {
    if (laborSet.has(card.id)) spentLabor.push(card);
    else newHand.push(card);
  }
  player.hand = newHand;
  for (const c of spentLabor) applySpendEffect(player, c);
  player.discard.push(...spentLabor);

  // The bought card itself goes to the player's discard.
  player.discard.push(purchased);

  // Consume the Insider Buyer half-cost flag (one shot).
  player.pendingHalfCostMarketBuy = false;

  // Refill conveyor (draw 1 from supply if room + cards available).
  if (
    draft.marketConveyor.length < MARKET_CONVEYOR_SIZE &&
    draft.marketSupplyDeck.length > 0
  ) {
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
  // v2.2: buying does NOT end the player's turn.
}
