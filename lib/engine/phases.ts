/**
 * Phase transition logic. Called by the reducer when a phase-end condition is
 * detected (e.g. all fees resolved, all passes in a lap, all market resolutions).
 *
 * Each function mutates the state in place — they are only ever called from
 * inside the Immer-wrapped reducer.
 */

import { activateFundedInvestmentsAtRoundStart, resetPerRoundInvestmentUsage } from "@/lib/rules/investments";
import type { GameState } from "./state";
import {
  BARON_OF_KENTUCKY_BARRELS,
  MAX_DEMAND,
  MIN_DEMAND,
  TRIPLE_CROWN_GOLDS,
} from "./state";
import { activePlayerCount } from "./checks";

// ---------- Logging helpers ----------

export function logEvent(
  state: GameState,
  kind: string,
  data: Record<string, unknown> = {},
): void {
  state.logSeq += 1;
  state.log.push({
    round: state.round,
    phase: state.phase,
    at: state.logSeq,
    kind,
    data,
  });
}

// ---------- Win condition checks ----------

export function checkWinConditions(state: GameState): void {
  if (state.phase === "gameover") return;

  // Triple crown.
  for (const id of state.playerOrder) {
    const p = state.players[id];
    if (p.goldAwards.length >= TRIPLE_CROWN_GOLDS) {
      state.winnerIds = [id];
      state.winReason = "triple_crown";
      state.phase = "gameover";
      logEvent(state, "win", { playerId: id, reason: "triple_crown" });
      return;
    }
  }

  // Baron of Kentucky: 15 barrels total AND at least 1 barrel in each of the 6 rickhouses.
  for (const id of state.playerOrder) {
    const total = totalBarrelsForPlayer(state, id);
    if (total < BARON_OF_KENTUCKY_BARRELS) continue;
    const spread = state.rickhouses.every((h) =>
      h.barrels.some((b) => b.ownerId === id),
    );
    if (!spread) continue;
    state.winnerIds = [id];
    state.winReason = "baron_of_kentucky";
    state.phase = "gameover";
    logEvent(state, "win", { playerId: id, reason: "baron_of_kentucky" });
    return;
  }

  // Last baron standing.
  const alive = state.playerOrder.filter(
    (id) => !state.players[id].eliminated,
  );
  if (alive.length === 1 && state.playerOrder.length > 1) {
    state.winnerIds = alive;
    state.winReason = "last_baron_standing";
    state.phase = "gameover";
    logEvent(state, "win", { playerId: alive[0], reason: "last_baron_standing" });
  }
}

export function totalBarrelsForPlayer(
  state: GameState,
  playerId: string,
): number {
  let n = 0;
  for (const h of state.rickhouses) {
    for (const b of h.barrels) if (b.ownerId === playerId) n++;
  }
  return n;
}

// ---------- Phase transitions ----------

/** Called when the opening phase is complete (every player committed their hand). */
export function enterFirstRound(state: GameState): void {
  state.phase = "action";
  state.round = 1;
  state.currentPlayerId = state.startPlayerId;
  resetActionPhase(state);
  logEvent(state, "phase_change", { phase: "action", round: 1 });
}

/** Round 1 skips Phase 1. Other rounds enter fees. */
export function enterFeesPhase(state: GameState): void {
  state.phase = "fees";
  state.feesPhase = {
    resolvedPlayerIds: [],
    paidBarrelIds: [],
    unpaidDebt: {},
  };
  logEvent(state, "phase_change", { phase: "fees", round: state.round });
}

export function finishFeesPhase(state: GameState): void {
  for (const id of state.playerOrder) {
    const p = state.players[id];
    const debt = state.feesPhase.unpaidDebt[id] ?? 0;
    if (debt <= 0) continue;
    if (p.cash >= debt) {
      p.cash -= debt;
      logEvent(state, "double_penalty_paid", { playerId: id, amount: debt });
    } else {
      p.cash = 0;
      p.eliminated = true;
      logEvent(state, "player_bankrupt", {
        playerId: id,
        unpaidDebt: debt,
      });
      forfeitAssetsToBank(state, id);
    }
    state.feesPhase.unpaidDebt[id] = 0;
  }
  enterActionPhase(state);
}

function forfeitAssetsToBank(state: GameState, playerId: string): void {
  const p = state.players[playerId];
  // Cash goes to the bank (already deducted above if applicable).
  p.cash = 0;
  // Resources: return plain types to market piles, keeping specialty instances discarded.
  for (const r of p.resourceHand) {
    const pile = state.market[r.resource as "cask" | "corn" | "barley" | "rye" | "wheat"];
    if (pile) pile.unshift(r);
  }
  p.resourceHand = [];
  // Bourbon cards in hand → bottom of deck.
  for (const id of p.bourbonHand) state.market.bourbonDeck.unshift(id);
  p.bourbonHand = [];
  // Investments / operations → bottom of their decks.
  for (const inv of p.investments) state.market.investmentDeck.unshift(inv.cardId);
  p.investments = [];
  for (const ops of p.operations) state.market.operationsDeck.unshift(ops.cardId);
  p.operations = [];
  // Barrels: remove from rickhouses, return mash resources to market.
  for (const h of state.rickhouses) {
    h.barrels = h.barrels.filter((b) => {
      if (b.ownerId !== playerId) return true;
      for (const r of b.mash) {
        const pile = state.market[r.resource as "cask" | "corn" | "barley" | "rye" | "wheat"];
        if (pile) pile.unshift(r);
      }
      return false;
    });
  }
  // Awards: discard (could be auctioned in the future; for now, remove).
  p.silverAwards = [];
  p.goldAwards = [];
}

export function enterActionPhase(state: GameState): void {
  state.phase = "action";
  state.currentPlayerId = state.startPlayerId;
  resetActionPhase(state);
  logEvent(state, "phase_change", { phase: "action", round: state.round });
}

export function resetActionPhase(state: GameState): void {
  state.actionPhase = {
    freeWindowActive: true,
    paidLapTier: 0,
    consecutivePasses: 0,
    passedPlayerIds: [],
    actionsThisLapPlayerIds: [],
  };
  state.firstPasserId = null;
}

/** Advance to the next non-eliminated player (clockwise from currentPlayerId). */
export function advanceToNextPlayer(state: GameState): void {
  const order = state.playerOrder;
  const n = order.length;
  const idx = order.indexOf(state.currentPlayerId);
  for (let i = 1; i <= n; i++) {
    const next = order[(idx + i) % n];
    if (!state.players[next].eliminated) {
      state.currentPlayerId = next;
      return;
    }
  }
}

/** Called at the start of a new lap in the action phase (after everyone acted/passed once). */
export function onLapEnd(state: GameState): void {
  state.actionPhase.actionsThisLapPlayerIds = [];
  if (state.firstPasserId !== null) {
    if (state.actionPhase.freeWindowActive) {
      // The lap in which the first pass occurred just ended: free window closes now, next lap is $1.
      state.actionPhase.freeWindowActive = false;
      state.actionPhase.paidLapTier = 1;
    } else {
      state.actionPhase.paidLapTier += 1;
    }
    logEvent(state, "lap_end", { paidLapTier: state.actionPhase.paidLapTier });
  }
}

/** Called after every action (pass or otherwise); detects action-phase end. */
export function maybeEndActionPhase(state: GameState): boolean {
  const alive = activePlayerCount(state);
  if (alive === 0) return false;
  if (state.actionPhase.consecutivePasses >= alive) {
    enterMarketPhase(state);
    return true;
  }
  return false;
}

export function enterMarketPhase(state: GameState): void {
  state.phase = "market";
  for (const id of state.playerOrder) state.players[id].marketResolved = false;
  // Starting player for market phase is firstPasser, falling back to startPlayer.
  const starter = state.firstPasserId ?? state.startPlayerId;
  state.currentPlayerId = starter;
  logEvent(state, "phase_change", { phase: "market", round: state.round });
}

export function maybeEndMarketPhase(state: GameState): void {
  const allDone = state.playerOrder.every(
    (id) => state.players[id].eliminated || state.players[id].marketResolved,
  );
  if (!allDone) return;
  startNextRound(state);
}

export function startNextRound(state: GameState): void {
  state.round += 1;
  state.startPlayerId = state.firstPasserId ?? state.startPlayerId;
  state.currentPlayerId = state.startPlayerId;
  for (const id of state.playerOrder) {
    state.players[id].hasTakenPaidActionThisRound = false;
  }
  resetPerRoundInvestmentUsage(state);
  activateFundedInvestmentsAtRoundStart(state);
  enterFeesPhase(state);
  checkWinConditions(state);
}

/** Cap demand to [MIN_DEMAND, MAX_DEMAND]. */
export function clampDemand(state: GameState): void {
  if (state.demand < MIN_DEMAND) state.demand = MIN_DEMAND;
  if (state.demand > MAX_DEMAND) state.demand = MAX_DEMAND;
}
