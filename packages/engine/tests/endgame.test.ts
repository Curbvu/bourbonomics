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
    // With v2.2 face-up bourbon row, a single starting bill gets dealt
    // to the face-up row and the deck starts empty. The face-up pick is
    // what triggers the final round.
    let state = makeTestGame({ bourbonDeck: [onlyBill] });
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [
      makeCapitalCard("p1", 0),
      makeCapitalCard("p1", 1),
    ]);
    expect(state.bourbonFaceUp).toHaveLength(1);
    state = applyAction(state, {
      type: "DRAW_MASH_BILL",
      playerId: "p1",
      mashBillId: state.bourbonFaceUp[0]!.id,
      spendCardIds: ["card_p1_cap1_0", "card_p1_cap1_1"],
    });
    expect(state.finalRoundTriggered).toBe(true);
    expect(state.bourbonDeck).toHaveLength(0);
    expect(state.bourbonFaceUp).toHaveLength(0);
  });

  it("triggering during a round means cleanup ends the game (phase=ended) — not the next round", () => {
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
    state = giveHand(state, "p1", [
      makeCapitalCard("p1", 0),
      makeCapitalCard("p1", 1),
    ]);
    state = giveHand(state, "p2", []);
    state = applyAction(state, {
      type: "DRAW_MASH_BILL",
      playerId: "p1",
      mashBillId: state.bourbonFaceUp[0]!.id,
      spendCardIds: ["card_p1_cap1_0", "card_p1_cap1_1"],
    });
    expect(state.finalRoundTriggered).toBe(true);
    // v2.2: DRAW_MASH_BILL does not end p1's turn — they must PASS_TURN
    // explicitly. Once both seats pass, cleanup ends the game.
    expect(state.phase).toBe("action");
    state = applyAction(state, { type: "PASS_TURN", playerId: "p1" });
    state = applyAction(state, { type: "PASS_TURN", playerId: "p2" });
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
    let state = makeTestGame({
      startingMashBills: [[bills[0]!], [bills[1]!]],
      bourbonDeck: [],
      startingDemand: 6,
    });

    // Round 1 — start player is p1 (idx 0).
    state = applyAction(state, { type: "ROLL_DEMAND", roll: [3, 4] });
    state = applyAction(state, { type: "DRAW_HAND", playerId: "p1" });
    state = applyAction(state, { type: "DRAW_HAND", playerId: "p2" });
    expect(state.startPlayerIndex).toBe(0);
    expect(state.currentPlayerIndex).toBe(0);
    state = applyAction(state, { type: "PASS_TURN", playerId: "p1" });
    state = applyAction(state, { type: "PASS_TURN", playerId: "p2" });
    expect(state.round).toBe(2);
    expect(state.phase).toBe("demand");
    // Start player rotated CCW: round 2 starts at p2 (idx 1) in a 2-player game.
    expect(state.startPlayerIndex).toBe(1);

    // Round 2: p1 has a saleable barrel; p2 takes their (empty) turn first
    // because of the rotation, then p1 chains a SELL into a PASS.
    state = placeBarrel(state, "p1", bills[0]!, 5);
    state = applyAction(state, { type: "ROLL_DEMAND", roll: [3, 4] });
    state = applyAction(state, { type: "DRAW_HAND", playerId: "p1" });
    state = applyAction(state, { type: "DRAW_HAND", playerId: "p2" });
    expect(state.currentPlayerIndex).toBe(1);
    state = applyAction(state, { type: "PASS_TURN", playerId: "p2" });
    const barrelId = state.allBarrels[0]!.id;
    const reward = 5; // demand=7 (after roll), age=5 → grid[1][2] = 5
    state = applyAction(state, {
      type: "SELL_BOURBON",
      playerId: "p1",
      barrelId,
      reputationSplit: reward,
      cardDrawSplit: 0,
    });
    // v2.2: SELL did not end p1's turn — they must explicitly pass.
    expect(state.currentPlayerIndex).toBe(0);
    state = applyAction(state, { type: "PASS_TURN", playerId: "p1" });
    expect(state.players.find((p) => p.id === "p1")!.reputation).toBe(reward);
    expect(state.allBarrels).toHaveLength(0);
    expect(state.round).toBe(3);
    // Rotated again: round 3 should start at p1 (idx 0) for a 2-player game.
    expect(state.startPlayerIndex).toBe(0);

    // Force the final-round flag and burn through round 3 to end the game.
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
