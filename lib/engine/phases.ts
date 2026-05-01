/**
 * Phase transition logic. Called by the reducer when a phase-end condition is
 * detected (e.g. all fees resolved, all passes in a lap, all market resolutions).
 *
 * Each function mutates the state in place — they are only ever called from
 * inside the Immer-wrapped reducer.
 */

import { resetPerRoundInvestmentUsage } from "@/lib/rules/investments";
import type { GameState } from "./state";
import {
  DISTRESSED_LOAN_REPAYMENT,
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

/**
 * Per current rules, the only end-trigger is the Triple Crown:
 * any player with 3 Gold Bourbons ends the game immediately.
 */
export function checkWinConditions(state: GameState): void {
  if (state.phase === "gameover") return;

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

/** Round 1 skips Phase 1. Other rounds enter fees. */
export function enterFeesPhase(state: GameState): void {
  state.phase = "fees";
  state.feesPhase = {
    resolvedPlayerIds: [],
    paidBarrelIds: [],
  };
  // Distressed loan repayment is taken off the top before any rent decisions.
  // We resolve it here so per-player rent UIs see post-repayment cash.
  for (const id of state.playerOrder) {
    const p = state.players[id];
    if (!p.loanOutstanding) continue;
    const owed = DISTRESSED_LOAN_REPAYMENT;
    if (p.cash >= owed) {
      p.cash -= owed;
      p.loanOutstanding = false;
      logEvent(state, "loan_repaid", { playerId: id, amount: owed });
    } else {
      // Partial repayment: pay all available cash; debt continues to next Phase 1.
      // No compounding interest, no penalty — just rolls over.
      const partial = p.cash;
      p.cash = 0;
      logEvent(state, "loan_partial_repayment", {
        playerId: id,
        paid: partial,
        stillOwed: owed - partial,
      });
      // Note: we leave loanOutstanding = true; the remaining $owed - partial
      // will be re-attempted next Phase 1. The reducer-level repayment helper
      // can be smarter later; for now this keeps the rule honest.
      // To avoid double-counting, store remaining owed via subtraction by
      // reusing the constant on next entry (the player has $0 either way).
    }
  }
  logEvent(state, "phase_change", { phase: "fees", round: state.round });
}

export function finishFeesPhase(state: GameState): void {
  // No bankruptcy, no double-penalty. Unpaid barrels simply did not age this
  // round (handled in the reducer's payFees handler). We just transition.
  enterActionPhase(state);
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
  state.marketPhase = {};
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
  // Swap the round-effect queues. Anything market cards queued during the
  // round that just ended becomes active now; this round's slot resets.
  state.currentRoundEffects = state.pendingRoundEffects;
  state.pendingRoundEffects = { resourceShortages: [] };
  if (state.currentRoundEffects.resourceShortages.length > 0) {
    logEvent(state, "round_effects_active", {
      shortages: [...state.currentRoundEffects.resourceShortages],
    });
  }
  enterFeesPhase(state);
  checkWinConditions(state);
}

/** Cap demand to [MIN_DEMAND, MAX_DEMAND]. */
export function clampDemand(state: GameState): void {
  if (state.demand < MIN_DEMAND) state.demand = MIN_DEMAND;
  if (state.demand > MAX_DEMAND) state.demand = MAX_DEMAND;
}
