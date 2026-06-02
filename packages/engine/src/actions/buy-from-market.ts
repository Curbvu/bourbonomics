import type { Card, GameAction, GameState, PlayerState, ValidationResult } from "../types";
import type { Draft } from "immer";
import { laborContribution } from "../types";
import { applySpendEffect } from "../card-effects";
import { drawWithReshuffle } from "../deck";
import { isCurrentPlayer } from "../state";
import {
  claimRoundUse,
  hasInvestment,
  investmentUsedThisRound,
} from "../investments";

type BuyFromMarketAction = Extract<GameAction, { type: "BUY_FROM_MARKET" }>;

const MARKET_SIZE = 10;

/**
 * v3.6 — total investment discount on a market purchase. Rail Spur
 * shaves 1 off the first market buy each round (any card); R&D
 * Department shaves 1 off Specialty / Heritage resource cards. Both
 * stack, then the caller floors the final cost at 1.
 */
function investmentDiscount(
  player: Pick<PlayerState, "investments" | "investmentRoundUses">,
  purchased: Card,
): number {
  let d = 0;
  if (
    hasInvestment(player, "rail_spur") &&
    !investmentUsedThisRound(player, "rail_spur")
  ) {
    d += 1;
  }
  if (hasInvestment(player, "rd_department") && purchased.specialty === true) {
    d += 1;
  }
  return d;
}

function effectiveCost(
  player: Pick<PlayerState, "investments" | "investmentRoundUses" | "pendingHalfCostMarketBuy">,
  purchased: Card,
): number {
  const printedCost = purchased.cost ?? 1;
  const base = player.pendingHalfCostMarketBuy
    ? Math.max(1, Math.ceil(printedCost / 2))
    : printedCost;
  return Math.max(1, base - investmentDiscount(player, purchased));
}

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

  const cost = effectiveCost(player, purchased);

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

  // v3.6 Rail Spur — consume the first-market-buy-of-round discount.
  // The first purchase consumes it whether or not the player needed
  // the cut (matches "the first market purchase you make each round").
  if (
    hasInvestment(player, "rail_spur") &&
    !investmentUsedThisRound(player, "rail_spur")
  ) {
    claimRoundUse(player, "rail_spur");
  }

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

  // v3.5 — routing:
  //   - resources / Specialty Labor → hand (used this turn or
  //     cycled to discard at End Turn).
  //   - investments → straight to `player.investments` (never
  //     touches `hand`). On-purchase effects fire immediately and
  //     passive_permanent triggers stay registered for the rest of
  //     the game. The v3.5 catalog is `implemented: false` end to
  //     end, so the storage is dormant until the v3.6 effect wave.
  //
  //     We picked Option (a) from the brief — direct placement,
  //     never hand — because the round-trip through hand would
  //     create a one-frame window where the card is selectable as
  //     "in hand" (and could be saved to Warehouse, traded, etc.),
  //     none of which makes sense for an investment.
  if (purchased.type === "investment" && purchased.investmentSpec) {
    const ownedId = `inv_owned_${purchased.investmentSpec.defId}_${draft.idCounter++}`;
    player.investments.push({
      ...purchased.investmentSpec,
      id: ownedId,
    });
    applyOnPurchaseEffect(draft, player, purchased.investmentSpec.defId, ownedId);
  } else {
    player.hand.push(purchased);
  }

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

const MAX_RICKHOUSE_SLOTS = 6;

/**
 * v3.6 — resolve an investment's on-purchase effect the moment it
 * lands in `player.investments`. Immediate-effect cards apply here;
 * choice cards stash a `pendingInvestmentChoice` that gates the player
 * to RESOLVE_INVESTMENT_CHOICE before any further action.
 */
function applyOnPurchaseEffect(
  draft: Draft<GameState>,
  player: Draft<PlayerState>,
  defId: string,
  ownedId: string,
): void {
  switch (defId) {
    case "warehouse":
      // Engage the private Warehouse slot (the in/out flow is the
      // WAREHOUSE_STORE / WAREHOUSE_RETRIEVE actions).
      player.warehouseUnlocked = true;
      return;
    case "aging_warehouse":
      // Permanent +1 rickhouse slot, capped at 6 total.
      if (player.rickhouseSlots.length < MAX_RICKHOUSE_SLOTS) {
        player.rickhouseSlots.push({
          id: `slot_${player.id}_inv_${draft.idCounter++}`,
          ownerId: player.id,
        });
      }
      return;
    case "estate_bottling":
      // One-shot free second-portfolio draft; the permanent reduced
      // penalty is derived from ownership at scoring time.
      player.estateBottlingFreeDraftPending = true;
      return;
    case "brand_ambassador":
    case "master_distiller":
    case "climate_controlled_warehouse":
    case "bonded_warehouse":
      // Require a follow-up player choice (barrel / tag / slot). Gate
      // the player to RESOLVE_INVESTMENT_CHOICE.
      player.pendingInvestmentChoice = { defId, investmentId: ownedId };
      return;
    default:
      // distillery_tour_program, climate_controlled_rickhouse,
      // watchman, and all on_sell / on_make / turn_start / final_scoring
      // cards have no on-purchase side effect.
      return;
  }
}
