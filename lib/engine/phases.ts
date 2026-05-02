/**
 * Phase transition logic. Called by the reducer when a phase-end condition is
 * detected (e.g. all fees resolved, all passes in a lap, all market resolutions).
 *
 * Each function mutates the state in place — they are only ever called from
 * inside the Immer-wrapped reducer.
 */

import { resetPerRoundInvestmentUsage } from "@/lib/rules/investments";
import { computeFinalScores, pickWinners } from "@/lib/rules/scoring";
import type { GameState } from "./state";
import { MAX_DEMAND, MIN_DEMAND, TRIPLE_CROWN_GOLDS } from "./state";
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
 * Per current rules, the third unlocked Gold Bourbon does NOT end the game
 * immediately — it announces the current round as the FINAL round. The
 * action phase continues normally; the market phase is then skipped, and
 * scoring runs as a separate phase.
 *
 * Idempotent: calling this multiple times within the trigger round just
 * re-asserts the flag. The `finalRoundEndsOnRound` is locked the first
 * time the flag is set so additional Golds in the same round don't shift
 * the end-of-game.
 */
export function checkWinConditions(state: GameState): void {
  if (state.phase === "gameover" || state.phase === "scoring") return;
  if (state.finalRoundTriggered) return;

  for (const id of state.playerOrder) {
    const p = state.players[id];
    if (p.goldBourbons.length >= TRIPLE_CROWN_GOLDS) {
      state.finalRoundTriggered = true;
      state.finalRoundEndsOnRound = state.round;
      logEvent(state, "final_round_triggered", {
        triggeredBy: id,
        round: state.round,
        golds: p.goldBourbons.length,
      });
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
  // Distressed loan repayment is taken off the top before any rent decisions
  // (Phase 1 sequence: a → b → c). If the player can pay the full
  // `loanRemaining`, the loan clears. Otherwise they pay whatever they
  // have, the residual stays in `loanRemaining`, and `loanSiphonActive`
  // turns on so every future cash credit auto-siphons until the loan
  // clears (GAME_RULES.md §Distressed Distiller's Loan).
  for (const id of state.playerOrder) {
    const p = state.players[id];
    if (p.loanRemaining <= 0) continue;
    const owed = p.loanRemaining;
    if (p.cash >= owed) {
      p.cash -= owed;
      p.loanRemaining = 0;
      p.loanSiphonActive = false;
      logEvent(state, "loan_repaid", { playerId: id, amount: owed });
    } else {
      const partial = p.cash;
      p.cash = 0;
      p.loanRemaining = owed - partial;
      // Activate the siphon: from this point on, every cash credit
      // diverts to the bank first.
      p.loanSiphonActive = true;
      logEvent(state, "loan_partial_repayment", {
        playerId: id,
        paid: partial,
        stillOwed: p.loanRemaining,
      });
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
    auditCalledThisRound: false,
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
    // Final-round exception: skip Phase 3 and go straight to scoring.
    if (
      state.finalRoundTriggered &&
      state.finalRoundEndsOnRound === state.round
    ) {
      enterScoringPhase(state);
    } else {
      enterMarketPhase(state);
    }
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
  // Reset per-round counters so first-sale boosts re-arm cleanly.
  state.currentRoundEffects.salesThisRound = 0;
  if (state.currentRoundEffects.resourceShortages.length > 0) {
    logEvent(state, "round_effects_active", {
      shortages: [...state.currentRoundEffects.resourceShortages],
    });
  }
  // Apply this round's persistent demand deltas (e.g. "Cocktail
  // Renaissance — +1 for 2 rounds"). Each entry's delta fires now and
  // its roundsRemaining ticks down; entries that expire are removed.
  const persistents = state.currentRoundEffects.persistentDemandDeltas;
  if (persistents && persistents.length > 0) {
    const survivors: typeof persistents = [];
    for (const p of persistents) {
      state.demand += p.delta;
      logEvent(state, "market_persistent_tick", {
        delta: p.delta,
        roundsRemaining: p.roundsRemaining,
      });
      if (p.roundsRemaining > 1) {
        survivors.push({
          delta: p.delta,
          roundsRemaining: p.roundsRemaining - 1,
        });
      }
    }
    state.currentRoundEffects.persistentDemandDeltas = survivors;
    clampDemand(state);
  }
  enterFeesPhase(state);
  // Re-check: an outstanding final-round flag from a prior round shouldn't
  // be possible (we route to scoring instead of starting a next round), but
  // keep the win-check defensive in case of state import.
  checkWinConditions(state);
}

/**
 * End-of-game scoring sweep. Computes per-player breakdowns, picks the
 * winner(s) with tiebreaks, and parks the game in `gameover`.
 */
export function enterScoringPhase(state: GameState): void {
  state.phase = "scoring";
  logEvent(state, "phase_change", { phase: "scoring", round: state.round });
  const scores = computeFinalScores(state);
  state.finalScores = scores;
  const winners = pickWinners(state, scores);
  state.winnerIds = winners;
  state.winReason = "final-round";
  state.phase = "gameover";
  logEvent(state, "win", {
    winnerIds: winners,
    reason: "final-round",
    scores,
  });
}

/** Cap demand to [MIN_DEMAND, MAX_DEMAND]. */
export function clampDemand(state: GameState): void {
  if (state.demand < MIN_DEMAND) state.demand = MIN_DEMAND;
  if (state.demand > MAX_DEMAND) state.demand = MAX_DEMAND;
}

/** Clamp an arbitrary demand value (not on state) into the legal range. */
export function clampToDemandRange(value: number): number {
  if (value < MIN_DEMAND) return MIN_DEMAND;
  if (value > MAX_DEMAND) return MAX_DEMAND;
  return value;
}
