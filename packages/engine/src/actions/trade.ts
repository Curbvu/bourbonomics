import type { Draft } from "immer";
import type { Card, GameAction, GameState, ValidationResult } from "../types";
import { isCurrentPlayer } from "../state";

type TradeAction = Extract<GameAction, { type: "TRADE" }>;

export function validateTrade(
  state: GameState,
  action: TradeAction,
): ValidationResult {
  if (state.phase !== "action") {
    return { legal: false, reason: `phase is "${state.phase}", expected "action"` };
  }
  if (action.player1Id === action.player2Id) {
    return { legal: false, reason: "cannot trade with yourself" };
  }
  const p1 = state.players.find((p) => p.id === action.player1Id);
  const p2 = state.players.find((p) => p.id === action.player2Id);
  if (!p1) return { legal: false, reason: `unknown player ${action.player1Id}` };
  if (!p2) return { legal: false, reason: `unknown player ${action.player2Id}` };
  // v2.4 Broker exception: trades are illegal in the final round
  // unless one side is The Broker (who keeps trade liquidity open).
  if (state.finalRoundTriggered) {
    const brokerSide =
      p1.distillery?.bonus === "broker" || p2.distillery?.bonus === "broker";
    if (!brokerSide) {
      return { legal: false, reason: "trades are not allowed during the final round" };
    }
  }
  if (!isCurrentPlayer(state, action.player1Id)) {
    return { legal: false, reason: "trade must be initiated by the player whose turn it is" };
  }
  if (p2.outForRound) {
    return { legal: false, reason: `${p2.id} is out for the round and cannot trade` };
  }
  if (action.player1Cards.length === 0 || action.player2Cards.length === 0) {
    return { legal: false, reason: "both sides must give at least one card" };
  }
  if (new Set(action.player1Cards).size !== action.player1Cards.length) {
    return { legal: false, reason: "duplicate card id in player1's offer" };
  }
  if (new Set(action.player2Cards).size !== action.player2Cards.length) {
    return { legal: false, reason: "duplicate card id in player2's offer" };
  }

  const p1Hand = new Set(p1.hand.map((c) => c.id));
  const p2Hand = new Set(p2.hand.map((c) => c.id));
  for (const id of action.player1Cards) {
    if (!p1Hand.has(id)) return { legal: false, reason: `${id} is not in ${p1.id}'s hand` };
  }
  for (const id of action.player2Cards) {
    if (!p2Hand.has(id)) return { legal: false, reason: `${id} is not in ${p2.id}'s hand` };
  }

  return { legal: true };
}

export function applyTrade(draft: Draft<GameState>, action: TradeAction): void {
  const p1 = draft.players.find((p) => p.id === action.player1Id)!;
  const p2 = draft.players.find((p) => p.id === action.player2Id)!;

  const p1OfferIds = new Set(action.player1Cards);
  const p2OfferIds = new Set(action.player2Cards);

  const p1Offered: Card[] = [];
  const p1NewHand: Card[] = [];
  for (const card of p1.hand) {
    if (p1OfferIds.has(card.id)) p1Offered.push(card);
    else p1NewHand.push(card);
  }
  p1.hand = p1NewHand;

  const p2Offered: Card[] = [];
  const p2NewHand: Card[] = [];
  for (const card of p2.hand) {
    if (p2OfferIds.has(card.id)) p2Offered.push(card);
    else p2NewHand.push(card);
  }
  p2.hand = p2NewHand;

  // Traded cards land in the recipient's discard (per rules).
  p2.discard.push(...p1Offered);
  p1.discard.push(...p2Offered);

  // v2.2: trade is one of the active player's actions but does NOT end
  // their turn — they continue with whatever cards remain. The trading
  // partner's own turn (when it comes around) is unaffected.
  //
  // The Broker distillery bonus is recorded for legacy compatibility but
  // is functionally inert under v2.2 (no main action ends a turn, so a
  // "free" trade is no different from a regular one).
  if (p1.distillery?.bonus === "broker" && !p1.brokerFreeTradeUsed) {
    p1.brokerFreeTradeUsed = true;
  }
}
