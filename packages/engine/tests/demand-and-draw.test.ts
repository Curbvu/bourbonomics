import { describe, it, expect } from "vitest";
import { applyAction, IllegalActionError } from "../src/engine.js";
import { makeTestGame } from "./helpers.js";

describe("ROLL_DEMAND", () => {
  it("raises demand when 2d6 sum > current", () => {
    const state = makeTestGame({ startingDemand: 5 });
    const next = applyAction(state, { type: "ROLL_DEMAND", roll: [4, 5] }); // 9 > 5
    expect(next.demand).toBe(6);
    expect(next.phase).toBe("draw");
    expect(next.demandRolls).toHaveLength(1);
    expect(next.demandRolls[0]?.result).toBe("rise");
  });

  it("holds demand when 2d6 sum <= current", () => {
    const state = makeTestGame({ startingDemand: 9 });
    const next = applyAction(state, { type: "ROLL_DEMAND", roll: [3, 4] }); // 7 <= 9
    expect(next.demand).toBe(9);
    expect(next.demandRolls[0]?.result).toBe("hold");
    expect(next.phase).toBe("draw");
  });

  it("caps demand at 12", () => {
    const state = makeTestGame({ startingDemand: 12 });
    const next = applyAction(state, { type: "ROLL_DEMAND", roll: [6, 6] }); // 12 not > 12 anyway
    expect(next.demand).toBe(12);

    // Force "rise" outcome at boundary (12 already): should still cap.
    const state2 = { ...state, demand: 11 };
    const next2 = applyAction(state2, { type: "ROLL_DEMAND", roll: [6, 6] }); // 12 > 11
    expect(next2.demand).toBe(12);
  });

  it("rejects rolls outside [1,6]", () => {
    const state = makeTestGame();
    expect(() => applyAction(state, { type: "ROLL_DEMAND", roll: [0, 5] })).toThrow(IllegalActionError);
    expect(() => applyAction(state, { type: "ROLL_DEMAND", roll: [7, 5] })).toThrow(IllegalActionError);
    expect(() => applyAction(state, { type: "ROLL_DEMAND", roll: [3.5, 4] })).toThrow(IllegalActionError);
  });

  it("rejects ROLL_DEMAND outside the demand phase", () => {
    let state = makeTestGame();
    state = applyAction(state, { type: "ROLL_DEMAND", roll: [3, 4] }); // → draw phase
    expect(() => applyAction(state, { type: "ROLL_DEMAND", roll: [3, 4] })).toThrow(IllegalActionError);
  });

  it("transitions to draw phase and resets phase-completion list", () => {
    let state = makeTestGame();
    state = applyAction(state, { type: "ROLL_DEMAND", roll: [3, 4] });
    expect(state.phase).toBe("draw");
    expect(state.playerIdsCompletedPhase).toEqual([]);
  });
});

describe("DRAW_HAND", () => {
  it("draws handSize cards into the player's hand", () => {
    let state = makeTestGame();
    state = applyAction(state, { type: "ROLL_DEMAND", roll: [3, 4] });
    state = applyAction(state, { type: "DRAW_HAND", playerId: "p1" });
    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.hand).toHaveLength(8);
    expect(p1.deck).toHaveLength(14 - 8);
    expect(p1.discard).toHaveLength(0);
  });

  it("rejects double-draw by the same player", () => {
    let state = makeTestGame();
    state = applyAction(state, { type: "ROLL_DEMAND", roll: [3, 4] });
    state = applyAction(state, { type: "DRAW_HAND", playerId: "p1" });
    expect(() => applyAction(state, { type: "DRAW_HAND", playerId: "p1" })).toThrow(IllegalActionError);
  });

  it("rejects DRAW_HAND in the demand phase", () => {
    const state = makeTestGame();
    expect(() => applyAction(state, { type: "DRAW_HAND", playerId: "p1" })).toThrow(IllegalActionError);
  });

  it("rejects unknown player", () => {
    let state = makeTestGame();
    state = applyAction(state, { type: "ROLL_DEMAND", roll: [3, 4] });
    expect(() => applyAction(state, { type: "DRAW_HAND", playerId: "ghost" })).toThrow(IllegalActionError);
  });

  it("advances to the action phase once all players have drawn", () => {
    let state = makeTestGame();
    state = applyAction(state, { type: "ROLL_DEMAND", roll: [3, 4] });
    state = applyAction(state, { type: "DRAW_HAND", playerId: "p1" });
    expect(state.phase).toBe("draw");
    state = applyAction(state, { type: "DRAW_HAND", playerId: "p2" });
    expect(state.phase).toBe("action");
    expect(state.currentPlayerIndex).toBe(0);
    expect(state.playerIdsCompletedPhase).toEqual([]);
    for (const p of state.players) expect(p.outForRound).toBe(false);
  });

  it("reshuffles discard into deck mid-draw if deck is short", () => {
    // Drain p1's deck into discard manually before drawing.
    let state = makeTestGame();
    const p1Index = 0;
    state = {
      ...state,
      players: state.players.map((p, i) =>
        i === p1Index ? { ...p, discard: p.deck.slice(), deck: [] } : p,
      ),
    };
    state = applyAction(state, { type: "ROLL_DEMAND", roll: [3, 4] });
    state = applyAction(state, { type: "DRAW_HAND", playerId: "p1" });
    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.hand).toHaveLength(8);
    expect(p1.discard).toHaveLength(0);
    expect(p1.deck.length + p1.hand.length).toBe(14);
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
    state = applyAction(state, { type: "ROLL_DEMAND", roll: [3, 4] });
    state = applyAction(state, { type: "DRAW_HAND", playerId: "p1" });
    expect(state.players.find((p) => p.id === "p1")!.hand).toHaveLength(3);
  });
});
