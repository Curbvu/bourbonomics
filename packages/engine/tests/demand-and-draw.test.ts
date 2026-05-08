import { describe, it, expect } from "vitest";
import { applyAction, IllegalActionError } from "../src/engine.js";
import { makeTestGame } from "./helpers.js";
import type { GameState } from "../src/types.js";

/**
 * v2.9: a fresh game starts in the `draw` phase. Each player draws,
 * then phase flips to `action` with the start player armed to roll
 * demand on their own turn.
 *
 * `landInActionWithRollPending` walks every player through DRAW_HAND
 * so subsequent assertions can target the per-turn ROLL_DEMAND
 * mechanic without the helper auto-clearing the flag.
 */
function landInActionWithRollPending(initial: GameState): GameState {
  let s = initial;
  for (const p of s.players) {
    s = applyAction(s, { type: "DRAW_HAND", playerId: p.id });
  }
  return s;
}

describe("ROLL_DEMAND (per-player, top of action turn)", () => {
  it("raises demand when 2d6 sum > current", () => {
    const fresh = makeTestGame({ startingDemand: 5 });
    const state = landInActionWithRollPending(fresh);
    const next = applyAction(state, {
      type: "ROLL_DEMAND",
      playerId: "p1",
      roll: [4, 5], // 9 > 5
    });
    expect(next.demand).toBe(6);
    expect(next.phase).toBe("action");
    expect(next.demandRolls).toHaveLength(1);
    expect(next.demandRolls[0]?.result).toBe("rise");
    expect(next.players.find((p) => p.id === "p1")?.needsDemandRoll).toBe(false);
  });

  it("holds demand when 2d6 sum <= current", () => {
    const fresh = makeTestGame({ startingDemand: 9 });
    const state = landInActionWithRollPending(fresh);
    const next = applyAction(state, {
      type: "ROLL_DEMAND",
      playerId: "p1",
      roll: [3, 4], // 7 <= 9
    });
    expect(next.demand).toBe(9);
    expect(next.demandRolls[0]?.result).toBe("hold");
    expect(next.phase).toBe("action");
  });

  it("caps demand at 12", () => {
    const fresh = makeTestGame({ startingDemand: 12 });
    const state = landInActionWithRollPending(fresh);
    const next = applyAction(state, {
      type: "ROLL_DEMAND",
      playerId: "p1",
      roll: [6, 6], // 12 not > 12 anyway
    });
    expect(next.demand).toBe(12);

    // Force a "rise" outcome at boundary (already at 11): should still cap at 12.
    const fresh2 = makeTestGame({ startingDemand: 11 });
    const state2 = landInActionWithRollPending(fresh2);
    const next2 = applyAction(state2, {
      type: "ROLL_DEMAND",
      playerId: "p1",
      roll: [6, 6], // 12 > 11
    });
    expect(next2.demand).toBe(12);
  });

  it("rejects rolls outside [1,6]", () => {
    const state = landInActionWithRollPending(makeTestGame());
    expect(() =>
      applyAction(state, { type: "ROLL_DEMAND", playerId: "p1", roll: [0, 5] }),
    ).toThrow(IllegalActionError);
    expect(() =>
      applyAction(state, { type: "ROLL_DEMAND", playerId: "p1", roll: [7, 5] }),
    ).toThrow(IllegalActionError);
    expect(() =>
      applyAction(state, { type: "ROLL_DEMAND", playerId: "p1", roll: [3.5, 4] }),
    ).toThrow(IllegalActionError);
  });

  it("rejects a second ROLL_DEMAND in the same turn", () => {
    let state = landInActionWithRollPending(makeTestGame());
    state = applyAction(state, {
      type: "ROLL_DEMAND",
      playerId: "p1",
      roll: [3, 4],
    });
    expect(() =>
      applyAction(state, { type: "ROLL_DEMAND", playerId: "p1", roll: [3, 4] }),
    ).toThrow(IllegalActionError);
  });

  it("rejects ROLL_DEMAND from a non-current player", () => {
    const state = landInActionWithRollPending(makeTestGame());
    expect(() =>
      applyAction(state, { type: "ROLL_DEMAND", playerId: "p2", roll: [3, 4] }),
    ).toThrow(IllegalActionError);
  });

  it("blocks every non-roll action while needsDemandRoll is true", () => {
    const state = landInActionWithRollPending(makeTestGame());
    expect(() =>
      applyAction(state, { type: "PASS_TURN", playerId: "p1" }),
    ).toThrow(IllegalActionError);
  });

  it("re-arms the next seat's roll on PASS_TURN", () => {
    let state = landInActionWithRollPending(makeTestGame());
    state = applyAction(state, {
      type: "ROLL_DEMAND",
      playerId: "p1",
      roll: [3, 4],
    });
    state = applyAction(state, { type: "PASS_TURN", playerId: "p1" });
    expect(state.currentPlayerIndex).toBe(1);
    expect(state.players[1]?.needsDemandRoll).toBe(true);
  });
});

describe("DRAW_HAND", () => {
  it("draws handSize cards into the player's hand", () => {
    let state = makeTestGame();
    state = applyAction(state, { type: "DRAW_HAND", playerId: "p1" });
    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.hand).toHaveLength(8);
    expect(p1.deck).toHaveLength(16 - 8);
    expect(p1.discard).toHaveLength(0);
  });

  it("does NOT auto-deal an operations card on draw — ops are bought from market", () => {
    let state = makeTestGame();
    const initialOps = state.players[0]!.operationsHand.length;
    state = applyAction(state, { type: "DRAW_HAND", playerId: "p1" });
    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.operationsHand.length).toBe(initialOps);
  });

  it("rejects double-draw by the same player", () => {
    let state = makeTestGame();
    state = applyAction(state, { type: "DRAW_HAND", playerId: "p1" });
    expect(() =>
      applyAction(state, { type: "DRAW_HAND", playerId: "p1" }),
    ).toThrow(IllegalActionError);
  });

  it("rejects unknown player", () => {
    expect(() =>
      applyAction(makeTestGame(), { type: "DRAW_HAND", playerId: "ghost" }),
    ).toThrow(IllegalActionError);
  });

  it("advances to the action phase once all players have drawn, with the start player armed to roll demand", () => {
    let state = makeTestGame();
    state = applyAction(state, { type: "DRAW_HAND", playerId: "p1" });
    expect(state.phase).toBe("draw");
    state = applyAction(state, { type: "DRAW_HAND", playerId: "p2" });
    expect(state.phase).toBe("action");
    expect(state.currentPlayerIndex).toBe(0);
    expect(state.playerIdsCompletedPhase).toEqual([]);
    for (const p of state.players) expect(p.outForRound).toBe(false);
    // v2.9: the seat the cursor lands on owes a demand roll before any
    // other action; subsequent seats are armed as the cursor reaches them.
    expect(state.players[0]?.needsDemandRoll).toBe(true);
    expect(state.players[1]?.needsDemandRoll).toBe(false);
  });

  it("reshuffles discard into deck mid-draw if deck is short", () => {
    let state = makeTestGame();
    const p1Index = 0;
    state = {
      ...state,
      players: state.players.map((p, i) =>
        i === p1Index ? { ...p, discard: p.deck.slice(), deck: [] } : p,
      ),
    };
    state = applyAction(state, { type: "DRAW_HAND", playerId: "p1" });
    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.hand).toHaveLength(8);
    expect(p1.discard).toHaveLength(0);
    expect(p1.deck.length + p1.hand.length).toBe(16);
  });

  it("draws fewer than handSize when deck + discard run out", () => {
    let state = makeTestGame();
    const p1Index = 0;
    state = {
      ...state,
      players: state.players.map((p, i) =>
        i === p1Index ? { ...p, deck: p.deck.slice(0, 3), discard: [] } : p,
      ),
    };
    state = applyAction(state, { type: "DRAW_HAND", playerId: "p1" });
    expect(state.players.find((p) => p.id === "p1")!.hand).toHaveLength(3);
  });
});
