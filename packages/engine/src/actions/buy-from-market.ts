import type { Draft } from "immer";
import type { Card, GameAction, GameState, ValidationResult } from "../types";
import { capitalUnits } from "../cards";
import { drawWithReshuffle } from "../deck";
import { endPlayerTurn, isCurrentPlayer } from "../state";

type BuyFromMarketAction = Extract<GameAction, { type: "BUY_FROM_MARKET" }>;

const MARKET_CONVEYOR_SIZE = 6;

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
  if (player.pendingRushBarrelId) {
    return { legal: false, reason: "you must resolve a forced Rush to Market first" };
  }

  const purchased = state.marketConveyor[action.marketSlotIndex];
  if (!purchased) {
    return {
      legal: false,
      reason: `market slot ${action.marketSlotIndex} is empty or out of range`,
    };
  }
  const cost = purchased.cost ?? 1;

  const spendIds = action.spendCardIds;
  if (spendIds.length === 0) {
    return { legal: false, reason: "must spend at least one card" };
  }
  if (new Set(spendIds).size !== spendIds.length) {
    return { legal: false, reason: "duplicate card id in spend list" };
  }

  const handIds = new Set(player.hand.map((c) => c.id));
  let totalCapital = 0;
  for (const id of spendIds) {
    if (!handIds.has(id)) {
      return { legal: false, reason: `card ${id} is not in your hand` };
    }
    const card = player.hand.find((c) => c.id === id)!;
    if (card.type !== "capital") {
      return {
        legal: false,
        reason: `${id} is not a capital card — market purchases require capital`,
      };
    }
    totalCapital += capitalUnits(card);
  }

  if (totalCapital < cost) {
    return {
      legal: false,
      reason: `spent capital is ${totalCapital}, need ${cost}`,
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

  // Remove the purchased card from the conveyor and queue refill.
  draft.marketConveyor.splice(action.marketSlotIndex, 1);

  // Move spent cards from hand → discard.
  const spendSet = new Set(action.spendCardIds);
  const newHand: Card[] = [];
  const spent: Card[] = [];
  for (const card of player.hand) {
    if (spendSet.has(card.id)) spent.push(card);
    else newHand.push(card);
  }
  player.hand = newHand;
  player.discard.push(...spent);

  // The bought card itself goes to the player's discard.
  player.discard.push(purchased);

  // Refill conveyor (draw 1 from supply if room + cards available).
  if (draft.marketConveyor.length < MARKET_CONVEYOR_SIZE && draft.marketSupplyDeck.length > 0) {
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

  endPlayerTurn(draft, action.playerId);
}
