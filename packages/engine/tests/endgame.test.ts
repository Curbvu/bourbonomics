import { describe, it, expect } from "vitest";
import { applyAction, computeFinalScores, isGameOver } from "../src/engine.js";
import { makeCapitalCard, makeMashBill } from "../src/cards.js";
import { advanceToActionPhase, giveHand, makeTestGame, placeBarrel } from "./helpers.js";

describe("Final round trigger", () => {
  it("drawing the last mash bill flips finalRoundTriggered", () => {
    const onlyBill = makeMashBill(
      {
        defId: "lastman",
        name: "Last Man",
        ageBands: [2, 4, 6],
        demandBands: [2, 4, 6],
        rewardGrid: [[1, 1, 1], [1, 1, 1], [1, 1, 1]],
      },
      0,
    );
    let state = makeTestGame({ bourbonDeck: [onlyBill] });
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [makeCapitalCard("p1", 0)]);
    state = applyAction(state, {
      type: "DRAW_MASH_BILL",
      playerId: "p1",
      spendCardId: "card_p1_cap1_0",
    });
    expect(state.finalRoundTriggered).toBe(true);
    expect(state.bourbonDeck).toHaveLength(0);
  });

  it("triggering during round 3 means cleanup ends the game (phase=ended) — not the next round", () => {
    const onlyBill = makeMashBill(
      {
        defId: "trigger",
        name: "Trigger",
        ageBands: [2, 4, 6],
        demandBands: [2, 4, 6],
        rewardGrid: [[1, 1, 1], [1, 1, 1], [1, 1, 1]],
      },
      0,
    );
    let state = makeTestGame({ bourbonDeck: [onlyBill] });
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [makeCapitalCard("p1", 0)]);
    state = giveHand(state, "p2", []);
    state = applyAction(state, {
      type: "DRAW_MASH_BILL",
      playerId: "p1",
      spendCardId: "card_p1_cap1_0",
    });
    expect(state.finalRoundTriggered).toBe(true);
    // p1 hand empty; p2 hand empty; cleanup runs — game ends, NOT next round.
    expect(state.phase).toBe("ended");
    expect(isGameOver(state)).toBe(true);
  });
});

describe("computeFinalScores", () => {
  function blank(repA: number, repB: number, deckA = 0, deckB = 0, soldA = 0, soldB = 0) {
    let state = makeTestGame();
    state = {
      ...state,
      players: state.players.map((p) =>
        p.id === "p1"
          ? {
              ...p,
              reputation: repA,
              hand: [],
              deck: Array.from({ length: deckA }, (_, i) => makeCapitalCard("p1", i)),
              discard: [],
              barrelsSold: soldA,
            }
          : {
              ...p,
              reputation: repB,
              hand: [],
              deck: Array.from({ length: deckB }, (_, i) => makeCapitalCard("p2", i)),
              discard: [],
              barrelsSold: soldB,
            },
      ),
    };
    return state;
  }

  it("ranks by reputation (highest first)", () => {
    const state = blank(10, 4);
    const scores = computeFinalScores(state);
    expect(scores[0]!.playerId).toBe("p1");
    expect(scores[0]!.rank).toBe(1);
    expect(scores[1]!.rank).toBe(2);
  });

  it("uses deck size as the first tiebreaker (smaller wins)", () => {
    const state = blank(8, 8, /*deckA=*/ 7, /*deckB=*/ 3);
    const scores = computeFinalScores(state);
    expect(scores[0]!.playerId).toBe("p2");
    expect(scores[0]!.rank).toBe(1);
  });

  it("uses barrels sold as the second tiebreaker (more wins)", () => {
    const state = blank(8, 8, 5, 5, /*soldA=*/ 4, /*soldB=*/ 1);
    const scores = computeFinalScores(state);
    expect(scores[0]!.playerId).toBe("p1");
  });

  it("shared rank for full ties", () => {
    const state = blank(8, 8, 5, 5, 2, 2);
    const scores = computeFinalScores(state);
    expect(scores[0]!.rank).toBe(1);
    expect(scores[1]!.rank).toBe(1);
  });
});

describe("Integration smoke test — minimal full game", () => {
  it("plays through a few rounds without crashing and ends cleanly", () => {
    // 2 players, single mash bill, very small bourbon deck so the game ends fast.
    const bills = [
      makeMashBill(
        {
          defId: "smoke_a",
          name: "Smoke A",
          ageBands: [2, 4, 6],
          demandBands: [2, 4, 6],
          rewardGrid: [[1, 2, 3], [2, 4, 5], [3, 5, 6]],
        },
        0,
      ),
      makeMashBill(
        {
          defId: "smoke_b",
          name: "Smoke B",
          ageBands: [2, 4, 6],
          demandBands: [2, 4, 6],
          rewardGrid: [[1, 2, 3], [2, 4, 5], [3, 5, 6]],
        },
        1,
      ),
    ];
    let state = makeTestGame({ startingMashBills: [[bills[0]!], [bills[1]!]], bourbonDeck: [] });

    // Round 1
    state = applyAction(state, { type: "ROLL_DEMAND", roll: [3, 4] });
    state = applyAction(state, { type: "DRAW_HAND", playerId: "p1" });
    state = applyAction(state, { type: "DRAW_HAND", playerId: "p2" });
    state = applyAction(state, { type: "PASS_TURN", playerId: "p1" });
    state = applyAction(state, { type: "PASS_TURN", playerId: "p2" });
    expect(state.round).toBe(2);
    expect(state.phase).toBe("demand");

    // Round 2: place a saleable barrel for p1 and have them sell it for some rep.
    state = placeBarrel(state, "p1", bills[0]!, 5, "rh_main");
    state = applyAction(state, { type: "ROLL_DEMAND", roll: [3, 4] });
    state = applyAction(state, { type: "DRAW_HAND", playerId: "p1" });
    state = applyAction(state, { type: "DRAW_HAND", playerId: "p2" });
    const barrelId = state.allBarrels[0]!.id;
    const reward = 5; // demand=7 (after roll), age=5 → grid[1][2] = 5
    state = applyAction(state, {
      type: "SELL_BOURBON",
      playerId: "p1",
      barrelId,
      reputationSplit: reward,
      cardDrawSplit: 0,
    });
    expect(state.players.find((p) => p.id === "p1")!.reputation).toBe(reward);
    expect(state.allBarrels).toHaveLength(0);

    // Skip to a state where the bourbon deck is empty and cleanup ends the game.
    state = { ...state, bourbonDeck: [] };
    state = applyAction(state, { type: "PASS_TURN", playerId: "p2" });
    state = applyAction(state, { type: "PASS_TURN", playerId: "p1" });
    // Manually flip finalRoundTriggered to simulate end (since DRAW_MASH_BILL didn't fire).
    state = { ...state, finalRoundTriggered: true };
    state = applyAction(state, { type: "ROLL_DEMAND", roll: [3, 3] });
    state = applyAction(state, { type: "DRAW_HAND", playerId: "p1" });
    state = applyAction(state, { type: "DRAW_HAND", playerId: "p2" });
    state = applyAction(state, { type: "PASS_TURN", playerId: "p1" });
    state = applyAction(state, { type: "PASS_TURN", playerId: "p2" });
    expect(isGameOver(state)).toBe(true);

    const scores = computeFinalScores(state);
    expect(scores[0]!.playerId).toBe("p1"); // higher rep
  });
});
