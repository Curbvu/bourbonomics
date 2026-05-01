/**
 * Pure reducer: (state, action) → new state.
 *
 * Implementation uses Immer so action handlers can mutate a draft. The reducer
 * never reaches outside its inputs (no DOM, no fetch, no Date.now).
 *
 * Invariants enforced:
 *   - Every dispatched action is validated; an illegal action is a no-op that logs an "error" event.
 *   - Phase transitions happen automatically when their end conditions are met.
 *   - Win conditions are checked after every state mutation that could trigger them.
 */

import { produce } from "immer";

import { evaluateAward } from "@/lib/rules/awards";
import { feesForPlayer, totalFeesForPlayer } from "@/lib/rules/fees";
import { activeInvestmentCount } from "@/lib/rules/investments";
import { lookupSalePrice } from "@/lib/rules/pricing";
import {
  applyActionCostDiscount,
  applyMarketBuyBonus,
  applyRickhouseFeeDiscount,
} from "@/lib/modifiers/investment";
import { applyMakeOps, applySellOps } from "@/lib/modifiers/resource";
import { resolveOperationsEffect } from "@/lib/modifiers/operations";
import type { Action, ResourcePileName } from "./actions";
import {
  BOURBON_CARDS_BY_ID,
  INVESTMENT_CARDS_BY_ID,
  MARKET_CARDS_BY_ID,
  drawTop,
  mintInstanceId,
} from "./decks";
import {
  advanceToNextPlayer,
  checkWinConditions,
  clampDemand,
  enterFeesPhase,
  enterMarketPhase,
  finishFeesPhase,
  logEvent,
  maybeEndActionPhase,
  maybeEndMarketPhase,
  onLapEnd,
} from "./phases";
import { createRng } from "./rng";
import {
  canMakeBourbon,
  canPassAction,
  canSellBourbon,
  canAffordCurrentAction,
  currentActionCost,
  findBarrel,
  isPlayersTurn,
} from "./checks";
import {
  BOURBON_HAND_LIMIT,
  DISTRESSED_LOAN_AMOUNT,
  MARKET_DRAW_COUNT,
  MAX_ACTIVE_INVESTMENTS,
  type GameState,
  type ResourceCardInstance,
} from "./state";

export function reduce(state: GameState, action: Action): GameState {
  return produce(state, (draft) => {
    apply(draft, action);
  });
}

function apply(state: GameState, action: Action): void {
  if (state.phase === "gameover") {
    logEvent(state, "ignored_after_gameover", { action: action.t });
    return;
  }

  switch (action.t) {
    case "PAY_FEES":
      return payFees(state, action);
    case "TAKE_DISTRESSED_LOAN":
      return takeDistressedLoan(state, action);
    case "DRAW_RESOURCE":
      return drawResource(state, action);
    case "DRAW_BOURBON":
      return drawBourbonAction(state, action);
    case "DISCARD_AND_DRAW_BOURBON":
      return discardAndDrawBourbon(state, action);
    case "MAKE_BOURBON":
      return makeBourbon(state, action);
    case "SELL_BOURBON":
      return sellBourbon(state, action);
    case "DRAW_INVESTMENT":
      return drawInvestment(state, action);
    case "DRAW_OPERATIONS":
      return drawOperations(state, action);
    case "IMPLEMENT_INVESTMENT":
      return implementInvestment(state, action);
    case "RESOLVE_OPERATIONS":
      return resolveOperations(state, action);
    case "PASS_ACTION":
      return passAction(state, action);
    case "MARKET_DRAW":
      return marketDraw(state, action);
    case "MARKET_KEEP":
      return marketKeep(state, action);
    case "ADVANCE":
      return advance(state);
  }
}

// ---------- Phase 1: fees ----------

function payFees(
  state: GameState,
  action: Extract<Action, { t: "PAY_FEES" }>,
): void {
  if (state.phase !== "fees") return errorEvent(state, "not_in_fees");
  const p = state.players[action.playerId];
  if (!p || p.eliminated) return errorEvent(state, "no_player");
  if (state.feesPhase.resolvedPlayerIds.includes(p.id)) {
    return errorEvent(state, "already_resolved_fees");
  }

  const owedAll = feesForPlayer(state, p.id);
  const total = totalFeesForPlayer(state, p.id);
  const chosen = new Set(action.barrelIds);
  let paid = 0;
  let unpaid = 0;
  for (const fee of owedAll) {
    if (chosen.has(fee.barrelId)) {
      paid += fee.amount;
    } else {
      unpaid += fee.amount;
    }
  }
  // Apply active-investment rickhouse-fee discount (once per round).
  const { total: discountedPaid, consume } = applyRickhouseFeeDiscount(p, paid);
  if (discountedPaid > p.cash) {
    return errorEvent(state, "cannot_afford_chosen", {
      paid: discountedPaid,
      cash: p.cash,
    });
  }
  p.cash -= discountedPaid;
  if (discountedPaid !== paid) {
    logEvent(state, "rickhouse_fee_discount", {
      playerId: p.id,
      before: paid,
      after: discountedPaid,
    });
    consume();
  }
  for (const fee of owedAll) {
    if (chosen.has(fee.barrelId)) {
      const found = findBarrel(state, fee.barrelId);
      if (found) found.barrel.age += 1;
      state.feesPhase.paidBarrelIds.push(fee.barrelId);
    }
  }
  state.feesPhase.resolvedPlayerIds.push(p.id);
  // Per current rules: unpaid barrels simply do not age. No double penalty,
  // no debt tracking, no bankruptcy.
  logEvent(state, "fees_paid", {
    playerId: p.id,
    paid,
    unpaid,
    total,
    barrelsAged: action.barrelIds.length,
    barrelsSkipped: owedAll.length - action.barrelIds.length,
  });

  // If everyone has resolved, run the end-of-fees pass.
  const stillToResolve = state.playerOrder.filter(
    (id) =>
      !state.players[id].eliminated && !state.feesPhase.resolvedPlayerIds.includes(id),
  );
  if (stillToResolve.length === 0) finishFeesPhase(state);
}

function takeDistressedLoan(
  state: GameState,
  action: Extract<Action, { t: "TAKE_DISTRESSED_LOAN" }>,
): void {
  if (state.phase !== "fees") return errorEvent(state, "not_in_fees");
  const p = state.players[action.playerId];
  if (!p || p.eliminated) return errorEvent(state, "no_player");
  if (p.loanUsed) return errorEvent(state, "loan_already_used");
  if (p.loanOutstanding) return errorEvent(state, "loan_already_outstanding");
  // Eligibility: cash must be less than the rent owed for the round.
  const owed = totalFeesForPlayer(state, p.id);
  if (p.cash >= owed) {
    return errorEvent(state, "loan_not_needed", { cash: p.cash, owed });
  }
  p.cash += DISTRESSED_LOAN_AMOUNT;
  p.loanOutstanding = true;
  p.loanUsed = true;
  logEvent(state, "loan_taken", {
    playerId: p.id,
    amount: DISTRESSED_LOAN_AMOUNT,
    rentOwed: owed,
  });
}

// ---------- Phase 2: action phase common helpers ----------

function chargeActionCost(state: GameState, playerId: string): boolean {
  const p = state.players[playerId];
  const baseCost = currentActionCost(state);
  // The "first paid action this round" scope triggers on the first paid action a player takes.
  const firstPaidThisRound = !state.actionPhase.freeWindowActive && !p.hasTakenPaidActionThisRound;
  const { cost, consume } = applyActionCostDiscount(p, baseCost, firstPaidThisRound);
  if (cost > 0) {
    if (p.cash < cost) return false;
    p.cash -= cost;
  }
  if (baseCost > 0) {
    p.hasTakenPaidActionThisRound = true;
  }
  if (cost !== baseCost) {
    logEvent(state, "action_cost_discount", {
      playerId,
      baseCost,
      finalCost: cost,
    });
  }
  consume();
  return true;
}

function recordActionInLap(state: GameState, playerId: string): void {
  state.actionPhase.actionsThisLapPlayerIds.push(playerId);
  state.actionPhase.consecutivePasses = 0;
  if (state.actionPhase.actionsThisLapPlayerIds.length >= activeUnpassedPlayerCount(state)) {
    onLapEnd(state);
  }
}

function activeUnpassedPlayerCount(state: GameState): number {
  return state.playerOrder.filter((id) => {
    const p = state.players[id];
    return !p.eliminated;
  }).length;
}

function preActionGuards(state: GameState, playerId: string): boolean {
  if (state.phase !== "action") {
    errorEvent(state, "not_in_action");
    return false;
  }
  if (!isPlayersTurn(state, playerId)) {
    errorEvent(state, "not_your_turn", { playerId });
    return false;
  }
  if (state.players[playerId].eliminated) {
    errorEvent(state, "player_eliminated", { playerId });
    return false;
  }
  if (!canAffordCurrentAction(state, playerId)) {
    errorEvent(state, "cannot_afford_action", { playerId });
    return false;
  }
  return true;
}

function postActionAdvance(state: GameState, playerId: string): void {
  recordActionInLap(state, playerId);
  advanceToNextPlayer(state);
  checkWinConditions(state);
  maybeEndActionPhase(state);
}

// ---------- Phase 2 actions ----------

function drawResource(
  state: GameState,
  action: Extract<Action, { t: "DRAW_RESOURCE" }>,
): void {
  if (!preActionGuards(state, action.playerId)) return;
  // Resource shortage block — comes from a Phase 3 market card kept last
  // round. Locked piles refuse all draws this round; shortage clears on
  // the next round's startNextRound.
  if (state.currentRoundEffects.resourceShortages.includes(action.pile)) {
    return errorEvent(state, "pile_shortaged", { pile: action.pile });
  }
  const pile = state.market[action.pile as ResourcePileName];
  if (pile.length === 0) return errorEvent(state, "pile_empty", { pile: action.pile });
  if (!chargeActionCost(state, action.playerId)) return errorEvent(state, "afford");
  const player = state.players[action.playerId];
  const card = pile[pile.length - 1];
  pile.pop();
  player.resourceHand.push(card);
  logEvent(state, "draw_resource", {
    playerId: action.playerId,
    pile: action.pile,
    instanceId: card.instanceId,
    specialtyId: card.specialtyId,
  });
  // Active-investment: market_buy_bonus_cards (extra draws from the same pile).
  const bonus = applyMarketBuyBonus(player);
  if (bonus.extraCards > 0) {
    let drawn = 0;
    for (let i = 0; i < bonus.extraCards && pile.length > 0; i++) {
      const extra = pile.pop()!;
      player.resourceHand.push(extra);
      logEvent(state, "draw_resource_bonus", {
        playerId: action.playerId,
        pile: action.pile,
        instanceId: extra.instanceId,
        specialtyId: extra.specialtyId,
      });
      drawn++;
    }
    if (drawn > 0) bonus.consume();
  }
  postActionAdvance(state, action.playerId);
}

function drawBourbonAction(
  state: GameState,
  action: Extract<Action, { t: "DRAW_BOURBON" }>,
): void {
  if (!preActionGuards(state, action.playerId)) return;
  const player = state.players[action.playerId];
  if (player.bourbonHand.length >= BOURBON_HAND_LIMIT) {
    return errorEvent(state, "bourbon_hand_full", {
      limit: BOURBON_HAND_LIMIT,
    });
  }
  if (state.market.bourbonDeck.length === 0) {
    reshuffleBourbonDiscard(state);
  }
  if (state.market.bourbonDeck.length === 0)
    return errorEvent(state, "bourbon_deck_empty");
  if (!chargeActionCost(state, action.playerId))
    return errorEvent(state, "afford");
  const [drawn, rest] = drawTop(state.market.bourbonDeck);
  state.market.bourbonDeck = rest;
  if (!drawn) return;
  player.bourbonHand.push(drawn);
  logEvent(state, "draw_bourbon", {
    playerId: action.playerId,
    cardId: drawn,
  });
  postActionAdvance(state, action.playerId);
}

function discardAndDrawBourbon(
  state: GameState,
  action: Extract<Action, { t: "DISCARD_AND_DRAW_BOURBON" }>,
): void {
  if (!preActionGuards(state, action.playerId)) return;
  const player = state.players[action.playerId];
  const handIdx = player.bourbonHand.indexOf(action.bourbonCardId);
  if (handIdx === -1) {
    return errorEvent(state, "bourbon_not_in_hand", {
      cardId: action.bourbonCardId,
    });
  }
  // Need a card to draw on the swap. If the deck is empty, the discard
  // we're about to push *would* go right back, so reshuffle BEFORE pushing
  // to keep the swap deterministic and avoid cycling the same id back.
  if (state.market.bourbonDeck.length === 0) reshuffleBourbonDiscard(state);
  if (state.market.bourbonDeck.length === 0)
    return errorEvent(state, "bourbon_deck_empty");
  if (!chargeActionCost(state, action.playerId))
    return errorEvent(state, "afford");

  // Discard then draw — net hand size unchanged.
  player.bourbonHand.splice(handIdx, 1);
  state.market.bourbonDiscard.push(action.bourbonCardId);
  const [drawn, rest] = drawTop(state.market.bourbonDeck);
  state.market.bourbonDeck = rest;
  if (drawn) {
    player.bourbonHand.push(drawn);
  }
  logEvent(state, "discard_and_draw_bourbon", {
    playerId: player.id,
    discardedCardId: action.bourbonCardId,
    drawnCardId: drawn,
  });
  postActionAdvance(state, action.playerId);
}

function reshuffleBourbonDiscard(state: GameState): void {
  if (state.market.bourbonDiscard.length === 0) return;
  const rng = createRng(state.rngState);
  const merged = state.market.bourbonDeck.concat(state.market.bourbonDiscard);
  const shuffled: string[] = [];
  const pool = merged.slice();
  while (pool.length > 0) {
    const idx = Math.floor(((rng.state = (rng.state + 0x6d2b79f5) >>> 0) >>> 0) / 4294967296 * pool.length);
    shuffled.push(pool[idx]);
    pool.splice(idx, 1);
  }
  state.market.bourbonDeck = shuffled;
  state.market.bourbonDiscard = [];
  state.rngState = rng.state;
}

function reshuffleMarketDiscard(state: GameState): void {
  if (state.market.marketDiscard.length === 0) return;
  const rng = createRng(state.rngState);
  const merged = state.market.marketDeck.concat(state.market.marketDiscard);
  const shuffled: string[] = [];
  const pool = merged.slice();
  while (pool.length > 0) {
    const idx = Math.floor(((rng.state = (rng.state + 0x6d2b79f5) >>> 0) >>> 0) / 4294967296 * pool.length);
    shuffled.push(pool[idx]);
    pool.splice(idx, 1);
  }
  state.market.marketDeck = shuffled;
  state.market.marketDiscard = [];
  state.rngState = rng.state;
}

function makeBourbon(
  state: GameState,
  action: Extract<Action, { t: "MAKE_BOURBON" }>,
): void {
  if (!preActionGuards(state, action.playerId)) return;
  const check = canMakeBourbon(
    state,
    action.playerId,
    action.rickhouseId,
    action.resourceInstanceIds,
    action.mashBillId,
  );
  if (!check.ok) return errorEvent(state, "make_invalid", { reason: check.reason });
  if (!chargeActionCost(state, action.playerId)) return errorEvent(state, "afford");

  const player = state.players[action.playerId];
  const mash: ResourceCardInstance[] = [];
  for (const id of action.resourceInstanceIds) {
    const idx = player.resourceHand.findIndex((r) => r.instanceId === id);
    if (idx === -1) return errorEvent(state, "resource_missing");
    mash.push(player.resourceHand[idx]);
    player.resourceHand.splice(idx, 1);
  }

  // Detach the mash bill from the player's hand — it's now locked to the
  // new barrel for the barrel's life.
  const billIdx = player.bourbonHand.indexOf(action.mashBillId);
  if (billIdx === -1) return errorEvent(state, "bourbon_not_in_hand");
  player.bourbonHand.splice(billIdx, 1);

  const rickhouse = state.rickhouses.find((r) => r.id === action.rickhouseId)!;
  const barrelId = mintInstanceId("barrel");
  rickhouse.barrels.push({
    barrelId,
    ownerId: player.id,
    rickhouseId: rickhouse.id,
    mash,
    mashBillId: action.mashBillId,
    age: 0,
    barreledOnRound: state.round,
  });
  logEvent(state, "make_bourbon", {
    playerId: player.id,
    barrelId,
    rickhouseId: rickhouse.id,
    mashSize: mash.length,
    mashBillId: action.mashBillId,
  });
  // Resource on_make_bourbon opcodes (e.g., bank_payout).
  const makeOps = applyMakeOps({ state, playerId: player.id, mash });
  if (makeOps.bankPayout !== 0) {
    player.cash += makeOps.bankPayout;
    logEvent(state, "make_bourbon_bank_payout", {
      playerId: player.id,
      amount: makeOps.bankPayout,
    });
  }
  checkWinConditions(state);
  postActionAdvance(state, action.playerId);
}

function sellBourbon(
  state: GameState,
  action: Extract<Action, { t: "SELL_BOURBON" }>,
): void {
  if (!preActionGuards(state, action.playerId)) return;
  const check = canSellBourbon(state, action.playerId, action.barrelId);
  if (!check.ok) return errorEvent(state, "sell_invalid", { reason: check.reason });
  if (!chargeActionCost(state, action.playerId)) return errorEvent(state, "afford");

  const card = check.card;
  const found = findBarrel(state, action.barrelId)!;
  const player = state.players[action.playerId];
  const mashBillId = found.barrel.mashBillId;

  // Apply resource on_sell opcodes FIRST to shift lookup age/demand before grid lookup.
  const sellOps = applySellOps({
    state,
    playerId: player.id,
    barrel: found.barrel,
    baseDemand: state.demand,
    baseAge: found.barrel.age,
  });
  const lookupDemand = Math.max(0, state.demand + sellOps.demandLookupShift);
  const lookupAge = Math.max(2, found.barrel.age + sellOps.ageLookupShift);
  const price = lookupSalePrice(card, lookupAge, lookupDemand);
  const finalPayout = price.price + sellOps.revenueBonus;

  player.cash += finalPayout;
  // Extra bourbon-card draws (specialty resource effect).
  for (let i = 0; i < sellOps.extraBourbonDraws; i++) {
    if (player.bourbonHand.length >= BOURBON_HAND_LIMIT) break;
    if (state.market.bourbonDeck.length === 0) reshuffleBourbonDiscard(state);
    const [extra, rest] = drawTop(state.market.bourbonDeck);
    if (!extra) break;
    state.market.bourbonDeck = rest;
    player.bourbonHand.push(extra);
    logEvent(state, "sell_bonus_bourbon_draw", {
      playerId: player.id,
      cardId: extra,
    });
  }
  // Awards — evaluated against the final payout.
  const award = evaluateAward(card, found.barrel.mash, found.barrel.age, finalPayout);
  // Silver/Gold both return the mash bill to the player's bourbon hand on
  // sale. Gold also marks a permanent award (3 unique → win). Silver does
  // not contribute to the win, but a Silver win that's *also* a Gold win
  // upgrades to Gold — so prefer Gold tracking.
  let returnToHand = false;
  if (award.gold) {
    if (!player.goldAwards.includes(mashBillId)) {
      player.goldAwards.push(mashBillId);
    }
    returnToHand = true;
  }
  if (award.silver) {
    if (
      !player.silverAwards.includes(mashBillId) &&
      !player.goldAwards.includes(mashBillId)
    ) {
      player.silverAwards.push(mashBillId);
    }
    returnToHand = true;
  }

  // Return mash resources to market piles.
  for (const r of found.barrel.mash) {
    const pile = state.market[r.resource as ResourcePileName];
    pile.unshift(r);
  }

  // Remove the barrel from the rickhouse.
  state.rickhouses[found.rickhouseIdx].barrels = state.rickhouses[
    found.rickhouseIdx
  ].barrels.filter((b) => b.barrelId !== action.barrelId);

  // Mash-bill disposition: either back to the player's hand (Silver/Gold)
  // or to the bourbon discard. Hand-limit guard for Silver/Gold returns —
  // if the player is already at the cap, the card discards rather than
  // overflowing the hand.
  if (returnToHand && player.bourbonHand.length < BOURBON_HAND_LIMIT) {
    player.bourbonHand.push(mashBillId);
  } else {
    state.market.bourbonDiscard.push(mashBillId);
  }

  // Demand drops by 1 per sale.
  state.demand -= 1;
  clampDemand(state);

  logEvent(state, "sell_bourbon", {
    playerId: player.id,
    barrelId: action.barrelId,
    bourbonCardId: mashBillId,
    age: found.barrel.age,
    lookupAge,
    lookupDemand,
    gridPrice: price.price,
    revenueBonus: sellOps.revenueBonus,
    finalPayout,
    priceSource: price.source,
    silver: award.silver,
    gold: award.gold,
    returnedToHand: returnToHand,
  });
  checkWinConditions(state);
  postActionAdvance(state, action.playerId);
}

function drawInvestment(
  state: GameState,
  action: Extract<Action, { t: "DRAW_INVESTMENT" }>,
): void {
  if (!preActionGuards(state, action.playerId)) return;
  if (state.market.investmentDeck.length === 0)
    return errorEvent(state, "investment_deck_empty");
  if (!chargeActionCost(state, action.playerId)) return errorEvent(state, "afford");
  const [drawn, rest] = drawTop(state.market.investmentDeck);
  state.market.investmentDeck = rest;
  if (!drawn) return;
  state.players[action.playerId].investments.push({
    instanceId: mintInstanceId("inv"),
    cardId: drawn,
    status: "unbuilt",
    usedThisRound: false,
  });
  logEvent(state, "draw_investment", {
    playerId: action.playerId,
    cardId: drawn,
  });
  postActionAdvance(state, action.playerId);
}

function drawOperations(
  state: GameState,
  action: Extract<Action, { t: "DRAW_OPERATIONS" }>,
): void {
  if (!preActionGuards(state, action.playerId)) return;
  if (state.market.operationsDeck.length === 0)
    return errorEvent(state, "operations_deck_empty");
  if (!chargeActionCost(state, action.playerId)) return errorEvent(state, "afford");
  const [drawn, rest] = drawTop(state.market.operationsDeck);
  state.market.operationsDeck = rest;
  if (!drawn) return;
  state.players[action.playerId].operations.push({
    instanceId: mintInstanceId("ops"),
    cardId: drawn,
  });
  logEvent(state, "draw_operations", {
    playerId: action.playerId,
    cardId: drawn,
  });
  postActionAdvance(state, action.playerId);
}

function implementInvestment(
  state: GameState,
  action: Extract<Action, { t: "IMPLEMENT_INVESTMENT" }>,
): void {
  if (!preActionGuards(state, action.playerId)) return;
  const player = state.players[action.playerId];
  const inv = player.investments.find(
    (i) => i.instanceId === action.investmentInstanceId,
  );
  if (!inv) return errorEvent(state, "investment_not_in_hand");
  if (inv.status !== "unbuilt")
    return errorEvent(state, "investment_already_built");
  // Cap: at most MAX_ACTIVE_INVESTMENTS active per player at once.
  if (activeInvestmentCount(state, player.id) >= MAX_ACTIVE_INVESTMENTS) {
    return errorEvent(state, "investment_cap_reached", {
      cap: MAX_ACTIVE_INVESTMENTS,
    });
  }
  const def = INVESTMENT_CARDS_BY_ID[inv.cardId];
  if (!def) return errorEvent(state, "unknown_investment");
  if (player.cash < def.capital)
    return errorEvent(state, "cannot_afford_capital", { capital: def.capital });
  if (!chargeActionCost(state, action.playerId)) return errorEvent(state, "afford");
  player.cash -= def.capital;
  // Per current rules: implemented investments are active immediately.
  inv.status = "active";
  logEvent(state, "implement_investment", {
    playerId: player.id,
    instanceId: inv.instanceId,
    cardId: inv.cardId,
    capital: def.capital,
  });
  postActionAdvance(state, action.playerId);
}

function resolveOperations(
  state: GameState,
  action: Extract<Action, { t: "RESOLVE_OPERATIONS" }>,
): void {
  if (!preActionGuards(state, action.playerId)) return;
  const player = state.players[action.playerId];
  const idx = player.operations.findIndex(
    (o) => o.instanceId === action.operationsInstanceId,
  );
  if (idx === -1) return errorEvent(state, "operations_not_in_hand");
  if (!chargeActionCost(state, action.playerId)) return errorEvent(state, "afford");
  const ops = player.operations[idx];
  player.operations.splice(idx, 1);
  state.market.operationsDeck.unshift(ops.cardId); // recirculate to bottom
  const outcome = resolveOperationsEffect(state, player.id, ops.cardId);
  logEvent(state, "resolve_operations", {
    playerId: player.id,
    cardId: ops.cardId,
    resolved: outcome.resolved,
    summary: outcome.summary,
  });
  postActionAdvance(state, action.playerId);
}

function passAction(
  state: GameState,
  action: Extract<Action, { t: "PASS_ACTION" }>,
): void {
  if (!canPassAction(state, action.playerId))
    return errorEvent(state, "cannot_pass");
  if (state.firstPasserId === null) {
    state.firstPasserId = action.playerId;
    logEvent(state, "first_pass", { playerId: action.playerId });
  } else {
    logEvent(state, "pass", { playerId: action.playerId });
  }
  if (!state.actionPhase.passedPlayerIds.includes(action.playerId)) {
    state.actionPhase.passedPlayerIds.push(action.playerId);
  }
  state.actionPhase.consecutivePasses += 1;
  state.actionPhase.actionsThisLapPlayerIds.push(action.playerId);
  if (state.actionPhase.actionsThisLapPlayerIds.length >= activeUnpassedPlayerCount(state)) {
    onLapEnd(state);
  }
  advanceToNextPlayer(state);
  if (!maybeEndActionPhase(state)) {
    // continue
  }
}

// ---------- Phase 3: market ----------

function marketDraw(
  state: GameState,
  action: Extract<Action, { t: "MARKET_DRAW" }>,
): void {
  if (state.phase !== "market") return errorEvent(state, "not_in_market");
  const p = state.players[action.playerId];
  if (!p || p.eliminated || p.marketResolved)
    return errorEvent(state, "cannot_draw_market");
  // It must be this player's turn to draw.
  if (state.currentPlayerId !== action.playerId)
    return errorEvent(state, "not_your_market_turn");
  // Already drawn but not yet kept.
  if (state.marketPhase[action.playerId]?.drawnCardIds?.length) {
    return errorEvent(state, "already_drew_market");
  }
  const drawn: string[] = [];
  for (let i = 0; i < MARKET_DRAW_COUNT; i++) {
    if (state.market.marketDeck.length === 0) reshuffleMarketDiscard(state);
    if (state.market.marketDeck.length === 0) break; // truly exhausted
    const [top, rest] = drawTop(state.market.marketDeck);
    state.market.marketDeck = rest;
    if (top) drawn.push(top);
  }
  if (drawn.length === 0) {
    // Nothing to do. Mark resolved and advance.
    p.marketResolved = true;
    logEvent(state, "market_deck_exhausted", { playerId: p.id });
    advanceToNextMarketResolver(state);
    maybeEndMarketPhase(state);
    return;
  }
  state.marketPhase[action.playerId] = { drawnCardIds: drawn };
  logEvent(state, "market_draw", {
    playerId: p.id,
    drawnCardIds: drawn,
  });
}

function marketKeep(
  state: GameState,
  action: Extract<Action, { t: "MARKET_KEEP" }>,
): void {
  if (state.phase !== "market") return errorEvent(state, "not_in_market");
  const p = state.players[action.playerId];
  if (!p || p.eliminated || p.marketResolved)
    return errorEvent(state, "cannot_keep_market");
  const stash = state.marketPhase[action.playerId];
  if (!stash || stash.drawnCardIds.length === 0)
    return errorEvent(state, "no_market_draw_to_keep");
  if (!stash.drawnCardIds.includes(action.keptCardId))
    return errorEvent(state, "kept_not_in_drawn");

  // Discard the unkept cards.
  for (const id of stash.drawnCardIds) {
    if (id !== action.keptCardId) state.market.marketDiscard.push(id);
  }
  // Resolve the kept card.
  const def = MARKET_CARDS_BY_ID[action.keptCardId];
  if (!def) {
    // Shouldn't happen, but keep playing.
    state.market.marketDiscard.push(action.keptCardId);
    logEvent(state, "market_keep_unknown", {
      playerId: p.id,
      cardId: action.keptCardId,
    });
  } else {
    const r = def.resolved;
    if (r.kind === "demand_delta") {
      const before = state.demand;
      state.demand += r.delta;
      clampDemand(state);
      logEvent(state, "market_demand_change", {
        playerId: p.id,
        cardId: def.id,
        delta: r.delta,
        before,
        after: state.demand,
      });
    } else if (r.kind === "demand_delta_conditional") {
      const before = state.demand;
      const delta = state.demand > r.threshold ? r.deltaAbove : r.deltaBelow;
      state.demand += delta;
      clampDemand(state);
      logEvent(state, "market_demand_change", {
        playerId: p.id,
        cardId: def.id,
        delta,
        branch: state.demand > r.threshold ? "above" : "below",
        threshold: r.threshold,
        before,
        after: state.demand,
      });
    } else if (r.kind === "resource_shortage") {
      // Queue the lock for next round (rules: market effects apply during
      // the next round, last one round). startNextRound swaps pending in.
      if (
        !state.pendingRoundEffects.resourceShortages.includes(r.resource)
      ) {
        state.pendingRoundEffects.resourceShortages.push(r.resource);
      }
      logEvent(state, "market_shortage_queued", {
        playerId: p.id,
        cardId: def.id,
        resource: r.resource,
      });
    } else {
      logEvent(state, "market_flavor", {
        playerId: p.id,
        cardId: def.id,
      });
    }
    // Resolved cards go to the discard.
    state.market.marketDiscard.push(action.keptCardId);
  }

  delete state.marketPhase[action.playerId];
  p.marketResolved = true;

  advanceToNextMarketResolver(state);
  maybeEndMarketPhase(state);
}

function advanceToNextMarketResolver(state: GameState): void {
  const order = state.playerOrder;
  const idx = order.indexOf(state.currentPlayerId);
  for (let i = 1; i <= order.length; i++) {
    const next = order[(idx + i) % order.length];
    const np = state.players[next];
    if (!np.eliminated && !np.marketResolved) {
      state.currentPlayerId = next;
      return;
    }
  }
}

// ---------- Reducer-driven advance ----------

function advance(state: GameState): void {
  if (state.phase === "fees") {
    return;
  }
  if (state.phase === "action") return;
  if (state.phase === "market") return;
}

// ---------- Helpers ----------

function errorEvent(state: GameState, kind: string, data?: Record<string, unknown>): void {
  logEvent(state, `error:${kind}`, data ?? {});
}

// Re-exports for convenience in tests / store.
export { enterMarketPhase, enterFeesPhase, BOURBON_CARDS_BY_ID };
