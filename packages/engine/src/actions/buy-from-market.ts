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
    return { legal: false, reason: "Capital payment must be a non-negative integer" };
  }
  if (action.rep > player.capital) {
    return {
      legal: false,
      reason: `not enough Capital: have ${player.capital}, paying ${action.rep}`,
    };
  }

  // Validate Labor card ids — they must be in hand, be Labor type,
  // and be uniquely listed. Defend against an `undefined` payload
  // shape: the validator's docstring (engine.ts:61) promises "never
  // throws; safe for UI gating", so a malformed dispatch must come
  // back as `legal: false`, not a TypeError on `.length`. This is
  // load-bearing for the tutorial controller's pre-dispatch
  // validateAction guard — any throw here crashes the entire React
  // tree mid-reducer.
  const laborIds = action.laborCardIds ?? [];
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

  // v3.3 — Spend Capital (the in-game spendable wallet).
  player.capital -= action.rep;

  // Discard Labor cards (firing any on_spend effects — Lender's Note
  // style — though no Labor card currently declares such an effect).
  // Match the defensive default from validateBuyFromMarket so an
  // action shape without laborCardIds applies cleanly with 0 labor.
  const laborSet = new Set(action.laborCardIds ?? []);
  const newHand: Card[] = [];
  const spentLabor: Card[] = [];
  for (const card of player.hand) {
    if (laborSet.has(card.id)) spentLabor.push(card);
    else newHand.push(card);
  }
  player.hand = newHand;
  for (const c of spentLabor) applySpendEffect(player, c);
  player.discard.push(...spentLabor);

  // The bought card lands directly in the player's hand so it can be
  // used this turn. End Turn (v3.9) discards everything in hand and
  // redraws, so a card bought and unspent naturally cycles into the
  // deck at turn end. (For investment cards, the on-buy effect is a
  // no-op today — the spec is `implemented: false` across the catalog;
  // the Card sits in hand so the player can still see what they
  // bought.)
  player.hand.push(purchased);

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
