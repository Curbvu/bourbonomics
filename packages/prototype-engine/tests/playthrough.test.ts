// Full-game integration playthrough — a reasonably competent bot plays complete
// games to game-end, exercising the whole loop across many turns (collect →
// draw bills → stage → build → age → sell → complete cards → improve →
// ultimates → clock). This catches turn-sequence / cross-system bugs that the
// unit tests, which probe pieces in isolation, can miss.

import { describe, expect, it } from "vitest";
import { applyAction, botAction, createGame, rankPlayers, reputationOf } from "../src/index";
import type { Action, GameState } from "../src/types";

interface Stats {
  ended: boolean;
  rounds: number;
  actions: number;
  builds: number;
  sales: number;
  completions: number;
  improvements: number;
  ultimates: number;
  crashes: number;
}

/**
 * Play a full game where EVERY seat is driven by the shipped `botAction` policy
 * (the same one the client runs for AI seats). The only thing the harness does
 * itself is the demand-phase BEGIN_COLLECT hand-off.
 */
function playGame(seed: number, playerNames: string[], roundCap = 400): { state: GameState; stats: Stats } {
  let state = createGame({ seed, playerNames });
  const stats: Stats = { ended: false, rounds: 0, actions: 0, builds: 0, sales: 0, completions: 0, improvements: 0, ultimates: 0, crashes: 0 };

  // Apply an action; on success adopt the new state, tally milestones from the
  // fresh log lines, then TRUNCATE the log so structuredClone stays O(1) over a
  // long game (the log otherwise grows unbounded → quadratic clones).
  const act = (a: Action): boolean => {
    const res = applyAction(state, a);
    stats.actions += 1;
    if (!res.ok) return false;
    state = res.state;
    for (const l of state.log) {
      if (l.includes("MARKET CRASH")) stats.crashes += 1;
      if (l.includes("now aging")) stats.builds += 1;
      if (/ sold "/.test(l)) stats.sales += 1;
      if (l.includes("🏅")) stats.completions += 1;
      if (l.includes("improved ")) stats.improvements += 1;
      if (l.includes("ultimate:")) stats.ultimates += 1;
    }
    state.log.length = 0;
    return true;
  };

  while (state.phase !== "ended" && state.roundNumber <= roundCap && stats.actions < 40000) {
    stats.rounds = state.roundNumber;
    if (state.roundPhase === "demand") {
      act({ type: "BEGIN_COLLECT" });
      continue;
    }
    const a = botAction(state);
    // Robustness: a refused action should never spin the harness.
    if (!act(a)) act(state.roundPhase === "collect" ? { type: "COLLECT_CLAIM", claims: [] } : { type: "END_TURN" });
  }

  stats.ended = state.phase === "ended";
  return { state, stats };
}

function assertConsistent(state: GameState, players: string[]) {
  for (const p of state.players) {
    expect(p.capital).toBeGreaterThanOrEqual(0);
    expect(reputationOf(p)).toBe(p.keptCards.reduce((s, c) => s + c.reputation, 0));
    expect(p.cardsCompleted).toBe(p.keptCards.length);
    for (const b of p.rickhouse) if (b.built) expect(b.salesRemaining).toBeGreaterThan(0); // no zero-sale ghost barrels (resting barrels are 0 until built)
  }
  const ranked = rankPlayers(state);
  expect(ranked.length).toBe(players.length);
  for (const r of ranked) expect(r.total).toBe(r.capital + r.reputation);
  for (let i = 1; i < ranked.length; i++) expect(ranked[i - 1]!.total).toBeGreaterThanOrEqual(ranked[i]!.total);
}

describe("full-game playthrough", () => {
  for (const players of [["A", "B"], ["A", "B", "C", "D"], ["A", "B", "C", "D", "E", "F"]]) {
    it(`a competent ${players.length}-player game runs to a clean end`, () => {
      const { state, stats } = playGame(100 + players.length, players);
      console.log(`${players.length}p:`, JSON.stringify(stats));

      expect(stats.ended).toBe(true); // terminates at the demand-deck clock
      expect(stats.actions).toBeLessThan(40000); // no stall / spin
      expect(stats.builds).toBeGreaterThan(0);
      expect(stats.sales).toBeGreaterThan(0);
      expect(stats.completions).toBeGreaterThan(0); // the only thing that ends the game
      expect(stats.improvements).toBeGreaterThan(0);
      assertConsistent(state, players);
    });
  }
});
