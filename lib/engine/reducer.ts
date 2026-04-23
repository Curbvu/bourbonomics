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
import { lookupSalePrice } from "@/lib/rules/pricing";
import {
  applyActionCostDiscount,
  applyMarketBuyBonus,
  applyRickhouseFeeDiscount,
} from "@/lib/modifiers/investment";
import { applyMakeOps, applySellOps } from "@/lib/modifiers/resource";
import { resolveOperationsEffect } from "@/lib/modifiers/operations";
import type { Action, ResourcePileName } from "./actions";
import { INVESTMENT_CARDS_BY_ID, drawTop, mintInstanceId } from "./decks";
import {
  advanceToNextPlayer,
  checkWinConditions,
  clampDemand,
  enterFeesPhase,
  enterFirstRound,
  enterMarketPhase,
  finishFeesPhase,
  logEvent,
  maybeEndActionPhase,
  maybeEndMarketPhase,
  onLapEnd,
} from "./phases";
import { createRng, rollD6 } from "./rng";
import {
  canMakeBourbon,
  canPassAction,
  canSellBourbon,
  canAffordCurrentAction,
  currentActionCost,
  findBarrel,
  isPlayersTurn,
} from "./checks";
import type { GameState, ResourceCardInstance } from "./state";

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
    case "OPENING_KEEP":
      return openingKeep(state, action);
    case "OPENING_COMMIT":
      return openingCommit(state, action);
    case "PAY_FEES":
      return payFees(state, action);
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
    case "PASS_ACTION":
      return passAction(state, action);
    case "ROLL_DEMAND":
      return rollDemand(state, action);
    case "DRAW_EVENT":
      return drawEvent(state, action);
    case "ADVANCE":
      return advance(state);
  }
}

// ---------- Opening phase ----------

function openingKeep(
  state: GameState,
  action: Extract<Action, { t: "OPENING_KEEP" }>,
): void {
  if (state.phase !== "opening") return errorEvent(state, "not_in_opening");
  const p = state.players[action.playerId];
  if (!p || p.openingDraft === null || p.openingKeptBeforeAuction !== null) {
    return errorEvent(state, "already_kept_or_no_draft");
  }
  if (action.keptIds.length !== 3) {
    return errorEvent(state, "must_keep_three", { kept: action.keptIds.length });
  }
  for (const id of action.keptIds) {
    if (!p.openingDraft.includes(id))
      return errorEvent(state, "kept_not_in_draft", { id });
  }
  // Discard the unkept three to the bottom of the investment deck.
  const discarded = p.openingDraft.filter((id) => !action.keptIds.includes(id));
  for (const id of discarded) state.market.investmentDeck.unshift(id);
  p.openingKeptBeforeAuction = action.keptIds.slice();
  p.openingDraft = null;
  logEvent(state, "opening_keep", { playerId: p.id, kept: action.keptIds });
}

function openingCommit(
  state: GameState,
  action: Extract<Action, { t: "OPENING_COMMIT" }>,
): void {
  if (state.phase !== "opening") return errorEvent(state, "not_in_opening");
  const p = state.players[action.playerId];
  if (!p || p.openingKeptBeforeAuction === null) {
    return errorEvent(state, "not_ready_to_commit");
  }
  // Materialise instances for each kept card, in the same order as keptIds.
  const instances = p.openingKeptBeforeAuction.map((cardId) => ({
    instanceId: mintInstanceId("inv"),
    cardId,
  }));
  if (action.decisions.length !== instances.length) {
    return errorEvent(state, "decision_count_mismatch", {
      expected: instances.length,
      got: action.decisions.length,
    });
  }
  for (let i = 0; i < instances.length; i++) {
    const inst = instances[i];
    const choice = action.decisions[i];
    const def = INVESTMENT_CARDS_BY_ID[inst.cardId];
    if (!def) return errorEvent(state, "unknown_investment", { cardId: inst.cardId });
    if (choice === "implement") {
      if (p.cash < def.capital) {
        // Force "hold" if they can't afford — illegal otherwise.
        p.investments.push({
          ...inst,
          status: "unbuilt",
          fundedOnRound: null,
          usedThisRound: false,
        });
        logEvent(state, "opening_hold_forced", {
          playerId: p.id,
          cardId: inst.cardId,
        });
      } else {
        p.cash -= def.capital;
        p.investments.push({
          ...inst,
          status: "funded_waiting",
          fundedOnRound: 1, // Round 1 is the "current" round during opening; flips at start of round 2.
          usedThisRound: false,
        });
        logEvent(state, "opening_implement", {
          playerId: p.id,
          cardId: inst.cardId,
          capital: def.capital,
        });
      }
    } else {
      p.investments.push({
        ...inst,
        status: "unbuilt",
        fundedOnRound: null,
        usedThisRound: false,
      });
      logEvent(state, "opening_hold", {
        playerId: p.id,
        cardId: inst.cardId,
      });
    }
  }
  p.openingKeptBeforeAuction = null;

  // If all players have committed, enter Round 1 action phase (Phase 1 is skipped in round 1).
  const allDone = state.playerOrder.every(
    (id) => state.players[id].openingKeptBeforeAuction === null && state.players[id].openingDraft === null,
  );
  if (allDone) enterFirstRound(state);
}

// ---------- Phase 1 ----------

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
  state.feesPhase.unpaidDebt[p.id] = (state.feesPhase.unpaidDebt[p.id] ?? 0) + unpaid * 2;
  state.feesPhase.resolvedPlayerIds.push(p.id);
  logEvent(state, "fees_paid", {
    playerId: p.id,
    paid,
    unpaid,
    total,
    doublePenaltyAdded: unpaid * 2,
  });

  // If everyone has resolved, run the end-of-fees pass.
  const stillToResolve = state.playerOrder.filter(
    (id) =>
      !state.players[id].eliminated && !state.feesPhase.resolvedPlayerIds.includes(id),
  );
  if (stillToResolve.length === 0) finishFeesPhase(state);
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
  let cardId: string | null = null;
  if (action.source === "face-up") {
    cardId = state.market.bourbonFaceUp;
    if (!cardId) return errorEvent(state, "no_face_up_bourbon");
    if (!chargeActionCost(state, action.playerId)) return errorEvent(state, "afford");
    state.market.bourbonFaceUp = null;
    refillBourbonFaceUp(state);
  } else {
    if (state.market.bourbonDeck.length === 0) {
      reshuffleBourbonDiscard(state);
    }
    if (state.market.bourbonDeck.length === 0)
      return errorEvent(state, "bourbon_deck_empty");
    if (!chargeActionCost(state, action.playerId)) return errorEvent(state, "afford");
    const [drawn, rest] = drawTop(state.market.bourbonDeck);
    state.market.bourbonDeck = rest;
    cardId = drawn;
  }
  if (cardId) {
    state.players[action.playerId].bourbonHand.push(cardId);
    logEvent(state, "draw_bourbon", {
      playerId: action.playerId,
      source: action.source,
      cardId,
    });
  }
  postActionAdvance(state, action.playerId);
}

function refillBourbonFaceUp(state: GameState): void {
  if (state.market.bourbonFaceUp !== null) return;
  if (state.market.bourbonDeck.length === 0) reshuffleBourbonDiscard(state);
  const [top, rest] = drawTop(state.market.bourbonDeck);
  if (top !== null) {
    state.market.bourbonFaceUp = top;
    state.market.bourbonDeck = rest;
  }
}

function reshuffleBourbonDiscard(state: GameState): void {
  if (state.market.bourbonDiscard.length === 0) return;
  // Use a deterministic shuffle via the rng state.
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

  const rickhouse = state.rickhouses.find((r) => r.id === action.rickhouseId)!;
  const barrelId = mintInstanceId("barrel");
  rickhouse.barrels.push({
    barrelId,
    ownerId: player.id,
    rickhouseId: rickhouse.id,
    mash,
    age: 0,
    barreledOnRound: state.round,
  });
  logEvent(state, "make_bourbon", {
    playerId: player.id,
    barrelId,
    rickhouseId: rickhouse.id,
    mashSize: mash.length,
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
  const check = canSellBourbon(
    state,
    action.playerId,
    action.barrelId,
    action.bourbonCardId,
  );
  if (!check.ok) return errorEvent(state, "sell_invalid", { reason: check.reason });
  if (!chargeActionCost(state, action.playerId)) return errorEvent(state, "afford");

  const card = check.card;
  const found = findBarrel(state, action.barrelId)!;
  const player = state.players[action.playerId];

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
  let keptCard = false;
  if (award.gold) {
    if (!player.goldAwards.includes(card.id)) {
      player.goldAwards.push(card.id);
      keptCard = true;
    }
  }
  if (award.silver) {
    if (!player.silverAwards.includes(card.id) && !player.goldAwards.includes(card.id)) {
      player.silverAwards.push(card.id);
      keptCard = true;
    }
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

  // Resolve the bourbon card source.
  if (state.market.bourbonFaceUp === action.bourbonCardId) {
    state.market.bourbonFaceUp = null;
    refillBourbonFaceUp(state);
  } else if (player.bourbonHand.includes(action.bourbonCardId)) {
    player.bourbonHand = player.bourbonHand.filter((id) => id !== action.bourbonCardId);
  }
  if (!keptCard) {
    state.market.bourbonDiscard.push(card.id);
  }

  // Demand drops by 1 per sale.
  state.demand -= 1;
  clampDemand(state);

  logEvent(state, "sell_bourbon", {
    playerId: player.id,
    barrelId: action.barrelId,
    bourbonCardId: card.id,
    age: found.barrel.age,
    lookupAge,
    lookupDemand,
    gridPrice: price.price,
    revenueBonus: sellOps.revenueBonus,
    finalPayout,
    priceSource: price.source,
    silver: award.silver,
    gold: award.gold,
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
    fundedOnRound: null,
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
  const def = INVESTMENT_CARDS_BY_ID[inv.cardId];
  if (!def) return errorEvent(state, "unknown_investment");
  if (player.cash < def.capital)
    return errorEvent(state, "cannot_afford_capital", { capital: def.capital });
  if (!chargeActionCost(state, action.playerId)) return errorEvent(state, "afford");
  player.cash -= def.capital;
  inv.status = "funded_waiting";
  inv.fundedOnRound = state.round;
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

// ---------- Phase 3 ----------

function rollDemand(
  state: GameState,
  action: Extract<Action, { t: "ROLL_DEMAND" }>,
): void {
  if (state.phase !== "market") return errorEvent(state, "not_in_market");
  const p = state.players[action.playerId];
  if (!p || p.eliminated || p.marketResolved)
    return errorEvent(state, "cannot_roll");

  const rng = createRng(state.rngState);
  const d1 = rollD6(rng);
  const d2 = rollD6(rng);
  state.rngState = rng.state;
  const total = d1 + d2;
  const oldDemand = state.demand;
  if (d1 === 6 && d2 === 6) {
    state.demand = 12;
  } else if (total > state.demand) {
    state.demand += 1;
  }
  clampDemand(state);
  p.marketResolved = true;
  logEvent(state, "roll_demand", {
    playerId: p.id,
    d1,
    d2,
    total,
    oldDemand,
    newDemand: state.demand,
  });
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

function drawEvent(
  state: GameState,
  action: Extract<Action, { t: "DRAW_EVENT" }>,
): void {
  if (state.phase !== "market") return errorEvent(state, "not_in_market");
  const p = state.players[action.playerId];
  if (!p || p.eliminated || p.marketResolved)
    return errorEvent(state, "cannot_draw_event");
  // Event deck currently empty — graceful degrade to a roll.
  if (state.market.eventDeck.length === 0) {
    logEvent(state, "draw_event_empty_falls_back_to_roll", {
      playerId: p.id,
    });
    return rollDemand(state, { t: "ROLL_DEMAND", playerId: p.id });
  }
  const [drawn, rest] = drawTop(state.market.eventDeck);
  state.market.eventDeck = rest;
  p.marketResolved = true;
  logEvent(state, "draw_event", { playerId: p.id, cardId: drawn });
  advanceToNextMarketResolver(state);
  maybeEndMarketPhase(state);
}

// ---------- Reducer-driven advance ----------

function advance(state: GameState): void {
  if (state.phase === "fees") {
    // Some test paths use ADVANCE to skip past round 1 fees (which are auto-skipped).
    // No-op outside fees; normal phase exit happens automatically.
    return;
  }
  if (state.phase === "opening") {
    // No-op; opening completes when all OPENING_COMMIT actions resolve.
    return;
  }
  if (state.phase === "action") return;
  if (state.phase === "market") return;
  // Useful when wiring round 1: caller can dispatch ADVANCE to enter feeds in round 2.
  // Currently unused but kept for future test ergonomics.
}

// ---------- Helpers ----------

function errorEvent(state: GameState, kind: string, data?: Record<string, unknown>): void {
  logEvent(state, `error:${kind}`, data ?? {});
}

// Re-exports for convenience in tests / store.
export { enterMarketPhase, enterFeesPhase };
