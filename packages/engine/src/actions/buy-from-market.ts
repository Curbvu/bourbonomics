import type { Draft } from "immer";
import type { Card, GameAction, GameState, ValidationResult } from "../types";
import { laborContribution } from "../types";
import { applySpendEffect } from "../card-effects";
import { drawWithReshuffle } from "../deck";
import { isCurrentPlayer } from "../state";

type BuyFromMarketAction = Extract<GameAction, { type: "BUY_FROM_MARKET" }>;

const MARKET_SIZE = 10;

/**
 * BUY_FROM_MARKET handles resource, Labor, and investment cards out of
 * the unified market. Operations cards live in the same market but
 * route through BUY_OPERATIONS_CARD (their destination is the player's
 * operationsHand rather than the discard pile).
 *
 * Payment rules:
 *   total = rep + sum(laborCardIds → laborContribution(card, domain))
 *   total ≥ cost
 *   rep ≥ 0, never goes negative
 *
 * The labor domain is inferred from the bought card:
 *   - `type === "investment"` → "investment" (Architect matches)
 *   - everything else        → "market_resource" (Cooper matches)
 *
 * Rep and Labor are fully fungible — any cost can be paid in rep,
 * Labor, or any mix.
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

  const purchased = state.market[action.marketSlotIndex];
  if (!purchased) {
    return {
      legal: false,
      reason: `market slot ${action.marketSlotIndex} is empty or out of range`,
    };
  }
  if (purchased.type === "operations") {
    return {
      legal: false,
      reason: "use BUY_OPERATIONS_CARD for operations cards",
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
  const domain =
    purchased.type === "investment" ? "investment" : "market_resource";
  const handById = new Map(player.hand.map((c) => [c.id, c]));
  let laborTotal = 0;
  for (const id of laborIds) {
    const card = handById.get(id);
    if (!card) return { legal: false, reason: `card ${id} is not in your hand` };
    if (card.type !== "labor") {
      return { legal: false, reason: `card ${id} is not a Labor card` };
    }
    laborTotal += laborContribution(card, domain);
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
  const purchased = draft.market[action.marketSlotIndex]!;

  // Remove the purchased card from the market.
  draft.market.splice(action.marketSlotIndex, 1);

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

  // The bought card itself goes to the player's discard. (For
  // investment cards, the on-buy effect is a no-op today — the spec
  // is `implemented: false` across the catalog. The Card stays in
  // discard so the player can still see what they bought.)
  player.discard.push(purchased);

  // Consume the Insider Buyer half-cost flag (one shot).
  player.pendingHalfCostMarketBuy = false;

  // Refill market slot from supply.
  if (
    draft.market.length < MARKET_SIZE &&
    draft.marketSupplyDeck.length + draft.marketDiscard.length > 0
  ) {
    const result = drawWithReshuffle(
      draft.marketSupplyDeck.slice(),
      draft.marketDiscard.slice(),
      1,
      draft.rngState,
    );
    if (result.drawn.length > 0) {
      draft.market.push(result.drawn[0]!);
    }
    draft.marketSupplyDeck = result.deck;
    draft.marketDiscard = result.discard;
    draft.rngState = result.rngState;
  }
  // Buying does NOT end the player's turn.
}
