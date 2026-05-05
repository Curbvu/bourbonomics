import { describe, it, expect } from "vitest";
import { applyAction } from "../src/engine.js";
import { defaultDistilleryPool } from "../src/distilleries.js";
import { makeCapitalCard, makeResourceCard } from "../src/cards.js";
import { advanceToActionPhase, giveHand, makeTestGame } from "./helpers.js";

describe("TRADE", () => {
  function setupTrade() {
    let state = makeTestGame();
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [
      makeResourceCard("rye", "p1", 0),
      makeCapitalCard("p1", 1),
      makeCapitalCard("p1", 2),
    ]);
    state = giveHand(state, "p2", [
      makeResourceCard("wheat", "p2", 0),
      makeCapitalCard("p2", 1),
      makeCapitalCard("p2", 2),
    ]);
    return state;
  }

  it("traded cards go to the recipient's discard", () => {
    let state = setupTrade();
    state = applyAction(state, {
      type: "TRADE",
      player1Id: "p1",
      player2Id: "p2",
      player1Cards: ["card_p1_rye_0"],
      player2Cards: ["card_p2_wheat_0"],
    });
    const p1 = state.players.find((p) => p.id === "p1")!;
    const p2 = state.players.find((p) => p.id === "p2")!;

    expect(p2.discard.some((c) => c.id === "card_p1_rye_0")).toBe(true);
    expect(p1.discard.some((c) => c.id === "card_p2_wheat_0")).toBe(true);
    // Each player still has both their unspent capital cards.
    expect(p1.hand.map((c) => c.id).sort()).toEqual(["card_p1_cap1_1", "card_p1_cap1_2"].sort());
    expect(p2.hand.map((c) => c.id).sort()).toEqual(["card_p2_cap1_1", "card_p2_cap1_2"].sort());
    // Initiator's (p1's) turn ends → currentPlayerIndex advances to p2.
    expect(state.currentPlayerIndex).toBe(1);
  });

  it("rejects when initiated by the non-current player", () => {
    const state = setupTrade();
    expect(() =>
      applyAction(state, {
        type: "TRADE",
        player1Id: "p2",
        player2Id: "p1",
        player1Cards: ["card_p2_wheat_0"],
        player2Cards: ["card_p1_rye_0"],
      }),
    ).toThrow(/turn it is/);
  });

  it("rejects when one side offers nothing", () => {
    const state = setupTrade();
    expect(() =>
      applyAction(state, {
        type: "TRADE",
        player1Id: "p1",
        player2Id: "p2",
        player1Cards: ["card_p1_rye_0"],
        player2Cards: [],
      }),
    ).toThrow(/at least one/);
  });

  it("rejects with cards that aren't in hand", () => {
    const state = setupTrade();
    expect(() =>
      applyAction(state, {
        type: "TRADE",
        player1Id: "p1",
        player2Id: "p2",
        player1Cards: ["card_p1_ghost_99"],
        player2Cards: ["card_p2_wheat_0"],
      }),
    ).toThrow(/not in p1's hand/);
  });

  it("rejects during the final round", () => {
    let state = setupTrade();
    state = { ...state, finalRoundTriggered: true };
    expect(() =>
      applyAction(state, {
        type: "TRADE",
        player1Id: "p1",
        player2Id: "p2",
        player1Cards: ["card_p1_rye_0"],
        player2Cards: ["card_p2_wheat_0"],
      }),
    ).toThrow(/final round/);
  });

  it("marks an emptied-out trader as out for the round", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [makeResourceCard("rye", "p1", 0)]);
    state = giveHand(state, "p2", [makeResourceCard("wheat", "p2", 0)]);
    state = applyAction(state, {
      type: "TRADE",
      player1Id: "p1",
      player2Id: "p2",
      player1Cards: ["card_p1_rye_0"],
      player2Cards: ["card_p2_wheat_0"],
    });
    // Both hands are empty post-trade. Cleanup should have wrapped the round.
    expect(state.phase).toBe("demand");
    expect(state.round).toBe(2);
  });
});

describe("TRADE — Broker bonus", () => {
  it("does not consume the active player's turn the first time it's used", () => {
    const broker = defaultDistilleryPool().find((d) => d.bonus === "broker")!;
    const vanilla = defaultDistilleryPool().find((d) => d.bonus === "vanilla")!;
    let state = makeTestGame({
      startingDistilleries: [broker, { ...vanilla, id: "dist_test_vanilla_2" }],
    });
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [
      makeResourceCard("rye", "p1", 0),
      makeCapitalCard("p1", 1),
    ]);
    state = giveHand(state, "p2", [
      makeResourceCard("wheat", "p2", 0),
      makeCapitalCard("p2", 1),
    ]);
    state = applyAction(state, {
      type: "TRADE",
      player1Id: "p1",
      player2Id: "p2",
      player1Cards: ["card_p1_rye_0"],
      player2Cards: ["card_p2_wheat_0"],
    });
    // p1 still has their capital card AND the turn is still on p1.
    expect(state.currentPlayerIndex).toBe(0);
    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.brokerFreeTradeUsed).toBe(true);
    expect(p1.hand.map((c) => c.id)).toEqual(["card_p1_cap1_1"]);
  });

  it("a second trade in the same round consumes the turn normally", () => {
    const broker = defaultDistilleryPool().find((d) => d.bonus === "broker")!;
    const vanilla = defaultDistilleryPool().find((d) => d.bonus === "vanilla")!;
    let state = makeTestGame({
      startingDistilleries: [broker, { ...vanilla, id: "dist_test_vanilla_3" }],
    });
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [
      makeResourceCard("rye", "p1", 0),
      makeResourceCard("rye", "p1", 1),
      makeCapitalCard("p1", 2),
    ]);
    state = giveHand(state, "p2", [
      makeResourceCard("wheat", "p2", 0),
      makeResourceCard("wheat", "p2", 1),
      makeCapitalCard("p2", 2),
    ]);
    // First trade — free.
    state = applyAction(state, {
      type: "TRADE",
      player1Id: "p1",
      player2Id: "p2",
      player1Cards: ["card_p1_rye_0"],
      player2Cards: ["card_p2_wheat_0"],
    });
    expect(state.currentPlayerIndex).toBe(0);
    // Second trade — turn ends.
    state = applyAction(state, {
      type: "TRADE",
      player1Id: "p1",
      player2Id: "p2",
      player1Cards: ["card_p1_rye_1"],
      player2Cards: ["card_p2_wheat_1"],
    });
    expect(state.currentPlayerIndex).toBe(1);
  });
});
