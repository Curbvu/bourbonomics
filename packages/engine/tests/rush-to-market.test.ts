import { describe, it, expect } from "vitest";
import { applyAction } from "../src/engine.js";
import { makeMashBill } from "../src/cards.js";
import { advanceToActionPhase, makeTestGame, placeBarrel } from "./helpers.js";

const bill = () =>
  makeMashBill(
    {
      defId: "rush_test",
      name: "Rush Test",
      ageBands: [1, 4, 6],
      demandBands: [2, 4, 6],
      rewardGrid: [
        [4, 5, 6],
        [5, 6, 7],
        [6, 7, 8],
      ],
    },
    100,
  );

describe("RUSH_TO_MARKET", () => {
  it("sells a 1-year-old barrel at half reward (rounded down, min 1)", () => {
    let state = makeTestGame({ startingDemand: 6 });
    state = advanceToActionPhase(state, [1, 1]);
    state = placeBarrel(state, "p1", bill(), 1);
    const barrelId = state.allBarrels[0]!.id;
    state = applyAction(state, {
      type: "RUSH_TO_MARKET",
      playerId: "p1",
      barrelId,
    });
    const p1 = state.players.find((p) => p.id === "p1")!;
    // grid lookup: age=1 → row 0; demand=6 → col 2 → reward 6, halved = 3.
    expect(p1.reputation).toBe(3);
    expect(state.allBarrels).toHaveLength(0);
    expect(p1.barrelsSold).toBe(1);
  });

  it("does NOT drop demand", () => {
    let state = makeTestGame({ startingDemand: 6 });
    state = advanceToActionPhase(state, [1, 1]);
    expect(state.demand).toBe(6);
    state = placeBarrel(state, "p1", bill(), 1);
    state = applyAction(state, {
      type: "RUSH_TO_MARKET",
      playerId: "p1",
      barrelId: state.allBarrels[0]!.id,
    });
    expect(state.demand).toBe(6);
  });

  it("rejects a barrel that isn't 1 year old (voluntary)", () => {
    let state = makeTestGame({ startingDemand: 6 });
    state = advanceToActionPhase(state, [1, 1]);
    state = placeBarrel(state, "p1", bill(), 3);
    expect(() =>
      applyAction(state, {
        type: "RUSH_TO_MARKET",
        playerId: "p1",
        barrelId: state.allBarrels[0]!.id,
      }),
    ).toThrow(/1-year-old/);
  });

  it("guarantees a minimum of 1 reputation even when the grid pays 0", () => {
    const lowBill = makeMashBill(
      {
        defId: "low",
        name: "Low",
        ageBands: [1, 4, 6],
        demandBands: [2, 4, 6],
        rewardGrid: [
          [1, 1, 1],
          [1, 1, 1],
          [1, 1, 1],
        ],
      },
      999,
    );
    let state = makeTestGame({ startingDemand: 6 });
    state = advanceToActionPhase(state, [1, 1]);
    state = placeBarrel(state, "p1", lowBill, 1);
    state = applyAction(state, {
      type: "RUSH_TO_MARKET",
      playerId: "p1",
      barrelId: state.allBarrels[0]!.id,
    });
    expect(state.players.find((p) => p.id === "p1")!.reputation).toBe(1);
  });
});
