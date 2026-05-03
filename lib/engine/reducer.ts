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
import type { ResourceType } from "@/lib/catalogs/types";
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
  clampToDemandRange,
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
  canCallAudit,
  canMakeBourbon,
  canPassAction,
  canSellBourbon,
  canAffordCurrentAction,
  currentActionCost,
  findBarrel,
  handSize,
  isPlayersTurn,
} from "./checks";
import { canSpend, creditCash } from "./cash";
import {
  DISTRESSED_LOAN_AMOUNT,
  DISTRESSED_LOAN_REPAYMENT,
  HAND_LIMIT,
  MARKET_DRAW_COUNT,
  MAX_ACTIVE_INVESTMENTS,
  type GameState,
  type Player,
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
    case "CALL_AUDIT":
      return callAudit(state, action);
    case "AUDIT_DISCARD":
      return auditDiscard(state, action);
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
  if (discountedPaid > 0 && !canSpend(state, p.id)) {
    // Loan-siphon "frozen": cannot spend on rent while debt is outstanding.
    // The chosen barrels just don't age this round (per the unpaid-rent
    // rule — no penalty beyond losing time).
    return errorEvent(state, "frozen_by_loan", {
      stillOwed: p.loanRemaining,
    });
  }
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
  // No second loan — once-per-game per baron, AND nobody can take one
  // while a debt is still outstanding.
  if (p.loanUsed) return errorEvent(state, "loan_already_used");
  if (p.loanRemaining > 0)
    return errorEvent(state, "loan_already_outstanding");
  // Eligibility: cash must be less than the rent owed for the round.
  const owed = totalFeesForPlayer(state, p.id);
  if (p.cash >= owed) {
    return errorEvent(state, "loan_not_needed", { cash: p.cash, owed });
  }
  // Disbursement is the loan principal; the player's debt to the bank is
  // the FULL repayment amount (principal + interest) and is due at the
  // start of next Phase 1. The loan-disbursement is NOT routed through
  // creditCash — siphon mode can't be active yet (you can't take a loan
  // while one is outstanding) and a fresh loan is not "income".
  p.cash += DISTRESSED_LOAN_AMOUNT;
  p.loanRemaining = DISTRESSED_LOAN_REPAYMENT;
  p.loanUsed = true;
  logEvent(state, "loan_taken", {
    playerId: p.id,
    disbursed: DISTRESSED_LOAN_AMOUNT,
    repaymentDue: DISTRESSED_LOAN_REPAYMENT,
    rentOwed: owed,
  });
}

// ---------- Phase 2: action phase common helpers ----------

function chargeActionCost(state: GameState, playerId: string): boolean {
  const p = state.players[playerId];
  // Setup-round budget overrides everything: while the player has
  // free-action credits the action is free and the counter ticks down
  // instead of cash.
  const freeRemaining =
    state.actionPhase.freeActionsRemainingByPlayer[playerId] ?? 0;
  if (freeRemaining > 0) {
    state.actionPhase.freeActionsRemainingByPlayer[playerId] =
      freeRemaining - 1;
    return true;
  }
  const baseCost = currentActionCost(state, playerId);
  // The "first paid action this round" scope triggers on the first paid action a player takes.
  const firstPaidThisRound = !state.actionPhase.freeWindowActive && !p.hasTakenPaidActionThisRound;
  const { cost, consume } = applyActionCostDiscount(p, baseCost, firstPaidThisRound);
  if (cost > 0) {
    // Loan-siphon "frozen" rule: a baron with active siphon cannot
    // spend on actions until the loan clears. Free actions (cost===0)
    // are still allowed.
    if (!canSpend(state, playerId)) return false;
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
  // If the player owes an audit discard, every action other than
  // AUDIT_DISCARD itself is rejected.
  if (state.players[playerId].pendingAuditOverage != null) {
    errorEvent(state, "audit_discard_pending");
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
  // Soft hand cap: nothing prevents drawing past 10. The Audit action is
  // the enforcement mechanism for trimming hands.
  const player = state.players[action.playerId];
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
    handSize: handSize(player),
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
  // Resource on_make_bourbon opcodes (e.g., bank_payout). Routed through
  // creditCash so any active loan siphon claims it first.
  const makeOps = applyMakeOps({ state, playerId: player.id, mash });
  if (makeOps.bankPayout !== 0) {
    creditCash(state, player.id, makeOps.bankPayout, "make_bourbon_bank_payout");
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
  // Apply any active market-card demand boosts. Each boost may be gated
  // by minAge / firstSaleOnly / topBandOnly. They stack additively on
  // top of resource on_sell shifts and the global demand.
  const boosts = state.currentRoundEffects.demandBoosts ?? [];
  const isFirstSale = (state.currentRoundEffects.salesThisRound ?? 0) === 0;
  let marketBoost = 0;
  for (const b of boosts) {
    if (b.minAge != null && found.barrel.age < b.minAge) continue;
    if (b.firstSaleOnly && !isFirstSale) continue;
    if (b.topBandOnly) {
      // Only apply if the boosted lookup demand lands in the bill's
      // top demand band (col 2). Otherwise skip — the card text reads
      // "premium push only when the sale is at the top demand tier."
      const tentative = clampToDemandRange(
        state.demand + sellOps.demandLookupShift + marketBoost + b.delta,
      );
      const topThreshold = card.demandBands[2];
      if (tentative < topThreshold) continue;
    }
    marketBoost += b.delta;
  }
  const lookupDemand = clampToDemandRange(
    state.demand + sellOps.demandLookupShift + marketBoost,
  );
  const lookupAge = Math.max(2, found.barrel.age + sellOps.ageLookupShift);
  const price = lookupSalePrice(card, lookupAge, lookupDemand);
  // Payout the player would receive selling the attached bill normally.
  // We track this separately from `finalPayout` so the attached bill's
  // own Silver/Gold award eligibility is evaluated against ITS grid,
  // not against the alt-payout (a Gold Bourbon's grid sub).
  const attachedBillPayout = price.price + sellOps.revenueBonus;
  let finalPayout = attachedBillPayout;

  // Optional Gold Bourbon alt payout. The rules let a player sell any
  // qualifying barrel using one of their unlocked Gold Bourbons' grid
  // instead of the attached bill's grid. We treat "qualifies" as: the
  // sale already meets the Gold criteria of the chosen Gold Bourbon.
  // Player has full discretion to apply or skip.
  let altPayoutSource: string | null = null;
  if (action.applyGoldBourbonId) {
    if (!player.goldBourbons.includes(action.applyGoldBourbonId)) {
      return errorEvent(state, "gold_not_unlocked", {
        gold: action.applyGoldBourbonId,
      });
    }
    const altCard = BOURBON_CARDS_BY_ID[action.applyGoldBourbonId];
    if (!altCard) {
      return errorEvent(state, "unknown_gold", {
        gold: action.applyGoldBourbonId,
      });
    }
    const altAward = evaluateAward(
      altCard,
      found.barrel.mash,
      found.barrel.age,
      // Pre-eval pricing on the *alt* grid to determine whether Gold
      // criteria are met under that bill. We use the maximum of the
      // alt's grid here as the reference price for award eligibility.
      Math.max(...altCard.grid.flatMap((row) => row)),
    );
    if (!altAward.gold) {
      return errorEvent(state, "barrel_does_not_qualify", {
        gold: action.applyGoldBourbonId,
      });
    }
    const altPrice = lookupSalePrice(altCard, lookupAge, lookupDemand).price;
    finalPayout = altPrice + sellOps.revenueBonus;
    altPayoutSource = action.applyGoldBourbonId;
  }

  // Sale proceeds — routed through creditCash so an active loan siphon
  // intercepts the payout first.
  creditCash(state, player.id, finalPayout, "sell_bourbon");
  // Extra bourbon-card draws (specialty resource effect). Soft cap: no
  // hard ceiling, but we still cap at a sane bound to prevent infinite
  // draws on a degenerate state. Audit handles real overflow later.
  for (let i = 0; i < sellOps.extraBourbonDraws; i++) {
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

  // Awards — evaluated against the ATTACHED BILL'S grid price, not the
  // alt-payout (if any). Applying a Gold alt substitutes the dollar
  // amount the player receives, but the attached bill follows its own
  // award rules per the original sale.
  const award = evaluateAward(
    card,
    found.barrel.mash,
    found.barrel.age,
    attachedBillPayout,
  );

  // Disposition of the attached mash bill.
  // Gold takes precedence over Silver. Gold UNLOCKS the bill as a
  // permanent trophy — removed from circulation, NOT in hand, scores
  // brand value at game end. Silver returns the bill to the player's
  // hand (soft cap, so we always return regardless of hand size).
  let disposition: "gold_unlock" | "silver_return" | "discard" = "discard";
  if (award.gold) {
    if (!player.goldBourbons.includes(mashBillId)) {
      player.goldBourbons.push(mashBillId);
    }
    disposition = "gold_unlock";
  } else if (award.silver) {
    if (!player.silverAwards.includes(mashBillId)) {
      player.silverAwards.push(mashBillId);
    }
    player.bourbonHand.push(mashBillId);
    disposition = "silver_return";
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

  // Mash-bill goes to discard only when no award fired.
  if (disposition === "discard") {
    state.market.bourbonDiscard.push(mashBillId);
  }

  // Demand drops per sale — usually 1, but a market card (Speculator
  // Frenzy) can accelerate the decay for one round.
  const decay = state.currentRoundEffects.demandDecayPerSale ?? 1;
  state.demand -= decay;
  clampDemand(state);
  // Bump the per-round sale counter so firstSaleOnly boosts deactivate
  // after the first sale.
  state.currentRoundEffects.salesThisRound =
    (state.currentRoundEffects.salesThisRound ?? 0) + 1;

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
    disposition,
    altPayoutSource,
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
  if (def.capital > 0 && !canSpend(state, player.id)) {
    return errorEvent(state, "frozen_by_loan", {
      stillOwed: player.loanRemaining,
    });
  }
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

// ---------- Audit ----------

function callAudit(
  state: GameState,
  action: Extract<Action, { t: "CALL_AUDIT" }>,
): void {
  if (state.phase !== "action") return errorEvent(state, "not_in_action");
  if (!isPlayersTurn(state, action.playerId))
    return errorEvent(state, "not_your_turn");
  const auditCheck = canCallAudit(state, action.playerId);
  if (!auditCheck.ok)
    return errorEvent(state, "audit_invalid", { reason: auditCheck.reason });
  if (!chargeActionCost(state, action.playerId))
    return errorEvent(state, "afford");

  state.actionPhase.auditCalledThisRound = true;
  const overflowingPlayers: { playerId: string; overage: number }[] = [];
  for (const id of state.playerOrder) {
    const p = state.players[id];
    if (p.eliminated) continue;
    const size = handSize(p);
    if (size > HAND_LIMIT) {
      const overage = size - HAND_LIMIT;
      p.pendingAuditOverage = overage;
      overflowingPlayers.push({ playerId: id, overage });
    }
  }
  logEvent(state, "audit_called", {
    auditorId: action.playerId,
    overflowing: overflowingPlayers,
  });
  postActionAdvance(state, action.playerId);
}

function auditDiscard(
  state: GameState,
  action: Extract<Action, { t: "AUDIT_DISCARD" }>,
): void {
  if (state.phase !== "action") return errorEvent(state, "not_in_action");
  const player = state.players[action.playerId];
  if (!player || player.eliminated) return errorEvent(state, "no_player");
  const overage = player.pendingAuditOverage;
  if (overage == null || overage <= 0)
    return errorEvent(state, "no_audit_overage");

  const totalChosen =
    action.mashBillIds.length +
    action.investmentInstanceIds.length +
    action.operationsInstanceIds.length;
  if (totalChosen !== overage) {
    return errorEvent(state, "wrong_discard_count", {
      expected: overage,
      actual: totalChosen,
    });
  }

  // Validate every id exists in the player's hand before mutating.
  const mashBillToDiscardIdx: number[] = [];
  for (const billId of action.mashBillIds) {
    const idx = player.bourbonHand.indexOf(billId);
    if (idx === -1) return errorEvent(state, "mashbill_not_in_hand", { billId });
    mashBillToDiscardIdx.push(idx);
  }
  const invToDiscardIdx: number[] = [];
  for (const instId of action.investmentInstanceIds) {
    const idx = player.investments.findIndex(
      (i) => i.instanceId === instId && i.status === "unbuilt",
    );
    if (idx === -1)
      return errorEvent(state, "investment_not_unbuilt_in_hand", { instId });
    invToDiscardIdx.push(idx);
  }
  const opsToDiscardIdx: number[] = [];
  for (const instId of action.operationsInstanceIds) {
    const idx = player.operations.findIndex((o) => o.instanceId === instId);
    if (idx === -1)
      return errorEvent(state, "operations_not_in_hand", { instId });
    opsToDiscardIdx.push(idx);
  }

  // Discard mash bills (sort indices descending so splice is stable).
  for (const billId of action.mashBillIds) {
    const idx = player.bourbonHand.indexOf(billId);
    if (idx !== -1) {
      player.bourbonHand.splice(idx, 1);
      state.market.bourbonDiscard.push(billId);
    }
  }
  // Discard investments. Keep cardId in the investment discard pile so the
  // engine can recycle them. Drop the instance.
  for (const instId of action.investmentInstanceIds) {
    const idx = player.investments.findIndex(
      (i) => i.instanceId === instId && i.status === "unbuilt",
    );
    if (idx !== -1) {
      const inv = player.investments[idx];
      player.investments.splice(idx, 1);
      state.market.investmentDiscard.push(inv.cardId);
    }
  }
  // Discard operations.
  for (const instId of action.operationsInstanceIds) {
    const idx = player.operations.findIndex((o) => o.instanceId === instId);
    if (idx !== -1) {
      const ops = player.operations[idx];
      player.operations.splice(idx, 1);
      state.market.operationsDiscard.push(ops.cardId);
    }
  }

  player.pendingAuditOverage = null;
  logEvent(state, "audit_discard", {
    playerId: player.id,
    discarded: {
      mashBills: action.mashBillIds,
      investments: action.investmentInstanceIds,
      operations: action.operationsInstanceIds,
    },
  });

  // Audit discards happen OUTSIDE of the normal action ladder — they
  // resolve a debt rather than counting as a turn move. We do not advance
  // the lap or charge cost. The reducer leaves currentPlayerId where it
  // is (likely the audited player whose turn was interrupted by their own
  // pending overage). When all overages are clear, action play resumes
  // normally.
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
    } else if (r.kind === "persistent_demand_delta") {
      // Apply the delta now AND queue the same delta to keep firing for
      // `extraRounds` more rounds at the start of each one.
      const before = state.demand;
      state.demand += r.delta;
      clampDemand(state);
      if (r.extraRounds > 0) {
        const queue =
          state.pendingRoundEffects.persistentDemandDeltas ?? [];
        queue.push({ delta: r.delta, roundsRemaining: r.extraRounds });
        state.pendingRoundEffects.persistentDemandDeltas = queue;
      }
      logEvent(state, "market_demand_persistent", {
        playerId: p.id,
        cardId: def.id,
        delta: r.delta,
        extraRounds: r.extraRounds,
        before,
        after: state.demand,
      });
    } else if (r.kind === "conditional_demand_boost") {
      const queue = state.pendingRoundEffects.demandBoosts ?? [];
      queue.push({
        delta: r.delta,
        ...(r.minAge != null ? { minAge: r.minAge } : {}),
        ...(r.topBandOnly ? { topBandOnly: true } : {}),
        ...(r.firstSaleOnly ? { firstSaleOnly: true } : {}),
      });
      state.pendingRoundEffects.demandBoosts = queue;
      logEvent(state, "market_boost_queued", {
        playerId: p.id,
        cardId: def.id,
        delta: r.delta,
      });
    } else if (r.kind === "rent_surcharge") {
      state.pendingRoundEffects.rentSurchargePerBarrel =
        (state.pendingRoundEffects.rentSurchargePerBarrel ?? 0) + r.surcharge;
      logEvent(state, "market_rent_surcharge_queued", {
        playerId: p.id,
        cardId: def.id,
        surcharge: r.surcharge,
      });
    } else if (r.kind === "accelerated_demand_decay") {
      // Last writer wins — two of these in one round phase isn't a real
      // case in the current deck.
      state.pendingRoundEffects.demandDecayPerSale = r.perSale;
      logEvent(state, "market_decay_queued", {
        playerId: p.id,
        cardId: def.id,
        perSale: r.perSale,
      });
    } else if (r.kind === "leader_skip_make") {
      const target = leaderByMostBarrels(state);
      if (target) {
        const blocked = state.pendingRoundEffects.playersBlockedFromMake ?? [];
        if (!blocked.includes(target)) blocked.push(target);
        state.pendingRoundEffects.playersBlockedFromMake = blocked;
      }
      logEvent(state, "market_skip_make_queued", {
        playerId: p.id,
        cardId: def.id,
        targetPlayerId: target,
      });
    } else if (r.kind === "leader_discard_bill") {
      const target = leaderByMostBills(state);
      if (target) {
        const billId = pickLowestValueBill(state, target);
        if (billId) {
          const tp = state.players[target];
          tp.bourbonHand.splice(tp.bourbonHand.indexOf(billId), 1);
          state.market.bourbonDiscard.push(billId);
          logEvent(state, "market_leader_discard_bill", {
            playerId: p.id,
            cardId: def.id,
            targetPlayerId: target,
            discardedBillId: billId,
          });
        }
      }
    } else if (r.kind === "rickhouse_age_loss") {
      const rh = state.rickhouses.find((h) => h.id === r.rickhouseId);
      if (rh) {
        let losses = 0;
        for (const b of rh.barrels) {
          if (b.age > 0) {
            b.age = Math.max(0, b.age - r.loss);
            losses += 1;
          }
        }
        logEvent(state, "market_rickhouse_age_loss", {
          playerId: p.id,
          cardId: def.id,
          rickhouseId: r.rickhouseId,
          loss: r.loss,
          affected: losses,
        });
      }
    } else if (r.kind === "all_draw_bourbon") {
      for (const id of state.playerOrder) {
        const pl = state.players[id];
        if (pl.eliminated) continue;
        for (let i = 0; i < r.count; i++) {
          if (state.market.bourbonDeck.length === 0)
            reshuffleBourbonDiscard(state);
          const [drawn, rest] = drawTop(state.market.bourbonDeck);
          if (!drawn) break;
          state.market.bourbonDeck = rest;
          pl.bourbonHand.push(drawn);
        }
      }
      logEvent(state, "market_all_draw_bourbon", {
        playerId: p.id,
        cardId: def.id,
        count: r.count,
      });
    } else if (r.kind === "all_draw_resource") {
      // Each affected player pops `count` cards from the requested pile
      // (or one of the five if `resource` is unspecified — chosen by
      // round-robin per player so the result is deterministic).
      const piles: ResourceType[] = r.resource
        ? [r.resource]
        : ["cask", "corn", "barley", "rye", "wheat"];
      let pickIdx = 0;
      for (const id of state.playerOrder) {
        const pl = state.players[id];
        if (pl.eliminated) continue;
        for (let i = 0; i < r.count; i++) {
          const pickName = piles[pickIdx % piles.length];
          pickIdx += 1;
          const pile = state.market[pickName];
          if (pile.length === 0) continue;
          const card = pile.pop()!;
          pl.resourceHand.push(card);
        }
      }
      logEvent(state, "market_all_draw_resource", {
        playerId: p.id,
        cardId: def.id,
        resource: r.resource ?? "any",
        count: r.count,
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

// ---------- Market-card targeting helpers ----------

/**
 * Find the player who currently owns the most barrels across all
 * rickhouses. Ties: lowest seat index wins. Returns null if nobody owns
 * any barrels yet (no legal target — the card resolves as a no-op).
 */
function leaderByMostBarrels(state: GameState): string | null {
  const counts: Record<string, number> = {};
  for (const id of state.playerOrder) counts[id] = 0;
  for (const h of state.rickhouses) {
    for (const b of h.barrels) {
      if (counts[b.ownerId] != null) counts[b.ownerId] += 1;
    }
  }
  let best: string | null = null;
  let bestCount = 0;
  let bestSeat = Infinity;
  for (const id of state.playerOrder) {
    const c = counts[id];
    if (c <= 0) continue;
    const seat = state.players[id].seatIndex;
    if (c > bestCount || (c === bestCount && seat < bestSeat)) {
      best = id;
      bestCount = c;
      bestSeat = seat;
    }
  }
  return best;
}

/**
 * Find the player holding the most mash bills in hand. Ties broken by
 * lowest seat index. Returns null if no player has any bills.
 */
function leaderByMostBills(state: GameState): string | null {
  let best: string | null = null;
  let bestCount = 0;
  let bestSeat = Infinity;
  for (const id of state.playerOrder) {
    const p = state.players[id];
    if (p.eliminated) continue;
    const c = p.bourbonHand.length;
    if (c <= 0) continue;
    if (c > bestCount || (c === bestCount && p.seatIndex < bestSeat)) {
      best = id;
      bestCount = c;
      bestSeat = p.seatIndex;
    }
  }
  return best;
}

/**
 * Pick which mash bill the engine "auto-discards" for a leader-discard
 * market card — the bill with the lowest grid maximum (i.e. the
 * weakest) so the punishment is real but not catastrophic. Future work:
 * surface a UI prompt instead of auto-picking.
 */
function pickLowestValueBill(
  state: GameState,
  playerId: string,
): string | null {
  const p = state.players[playerId];
  let pickId: string | null = null;
  let pickMax = Infinity;
  for (const id of p.bourbonHand) {
    const card = BOURBON_CARDS_BY_ID[id];
    if (!card) continue;
    const max = Math.max(...card.grid.flatMap((row) => row));
    if (max < pickMax) {
      pickMax = max;
      pickId = id;
    }
  }
  return pickId ?? p.bourbonHand[0] ?? null;
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
// `Player` only re-exported for type ergonomics in test fixtures.
export type { Player };
