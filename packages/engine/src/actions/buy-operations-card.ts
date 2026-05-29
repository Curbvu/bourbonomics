import type { Draft } from "immer";
import type {
  Card,
  GameAction,
  GameState,
  ValidationResult,
} from "../types";
import { laborContribution } from "../types";
import { drawWithReshuffle } from "../deck";
import { isCurrentPlayer } from "../state";

type BuyOperationsCardAction = Extract<GameAction, { type: "BUY_OPERATIONS_CARD" }>;

const MARKET_SIZE = 10;

/**
 * Buy an operations card from the unified market. The picked slot must
 * be an operations-typed market card carrying an `opSpec`.
 *
 * Payment rules: rep + Labor (any mix). Marketing Labor (+2 toward
 * ops) is the matching specialty; Cooper / Architect contribute 0.
 *
 * The bought card transfers from the market into the player's
 * operationsHand (the spec is copied with a fresh id + drawnInRound).
 * The vacated market slot refills from the supply.
 */
export function validateBuyOperationsCard(
  state: GameState,
  action: BuyOperationsCardAction,
): ValidationResult {
  if (state.phase !== "action") {
    return { legal: false, reason: `phase is "${state.phase}", expected "action"` };
  }
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return { legal: false, reason: `unknown player ${action.playerId}` };
  if (!isCurrentPlayer(state, action.playerId)) {
    return { legal: false, reason: "it is not your turn" };
  }

  const card = state.market[action.marketSlotIndex];
  if (!card) {
    return {
      legal: false,
      reason: `market slot ${action.marketSlotIndex} is empty or out of range`,
    };
  }
  if (card.type !== "operations" || !card.opSpec) {
    return {
      legal: false,
      reason: `market slot ${action.marketSlotIndex} is not an operations card`,
    };
  }
  const cost = card.cost ?? card.opSpec.cost;

  if (!Number.isInteger(action.rep) || action.rep < 0) {
    return { legal: false, reason: "Capital payment must be a non-negative integer" };
  }
  if (action.rep > player.capital) {
    return {
      legal: false,
      reason: `not enough Capital: have ${player.capital}, paying ${action.rep}`,
    };
  }

  // Defend against `undefined` payload shape — validateAction's
  // contract is "never throws" (engine.ts:61). Mirrors the same fix
  // in buy-from-market.ts.
  const laborIds = action.laborCardIds ?? [];
  if (new Set(laborIds).size !== laborIds.length) {
    return { legal: false, reason: "duplicate Labor card id in payment" };
  }
  const handById = new Map(player.hand.map((c) => [c.id, c]));
  let laborTotal = 0;
  for (const id of laborIds) {
    const c = handById.get(id);
    if (!c) return { legal: false, reason: `card ${id} is not in your hand` };
    if (c.type !== "labor") {
      return { legal: false, reason: `card ${id} is not a Labor card` };
    }
    laborTotal += laborContribution(c, "ops");
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

export function applyBuyOperationsCard(
  draft: Draft<GameState>,
  action: BuyOperationsCardAction,
): void {
  const player = draft.players.find((p) => p.id === action.playerId)!;
  const marketCard = draft.market[action.marketSlotIndex]!;
  const spec = marketCard.opSpec!;

  // Remove the bought card from the unified market.
  draft.market.splice(action.marketSlotIndex, 1);

  // Copy the spec into the player's operationsHand with a fresh id +
  // current round. The `owned` namespace separates hand-side ids from
  // the market-side `ops_${defId}_${idx}` space so they can never
  // collide as supply counts change (e.g. when copies drop to 1).
  player.operationsHand.push({
    ...spec,
    id: `ops_owned_${spec.defId}_${draft.idCounter++}`,
    drawnInRound: draft.round,
  });

  // v3.3 — Spend Capital.
  player.capital -= action.rep;

  // Discard the Labor cards used as payment. Match the validator's
  // defensive default so a missing laborCardIds applies as 0 labor.
  const laborSet = new Set(action.laborCardIds ?? []);
  const newHand: Card[] = [];
  const spent: Card[] = [];
  for (const c of player.hand) {
    if (laborSet.has(c.id)) spent.push(c);
    else newHand.push(c);
  }
  player.hand = newHand;
  player.discard.push(...spent);

  // Refill the market slot from supply.
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
  // Buying does NOT end the player's turn (free action).
}
