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
    // v2.2: trade does NOT end the active player's turn — p1 keeps the cursor.
    expect(state.currentPlayerIndex).toBe(0);
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

  it("v2.2: trade does NOT end the turn even when both hands empty out", () => {
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
    // Trade itself never ends the turn — both players still need to PASS_TURN.
    expect(state.phase).toBe("action");
    expect(state.currentPlayerIndex).toBe(0);
    state = applyAction(state, { type: "PASS_TURN", playerId: "p1" });
    state = applyAction(state, { type: "PASS_TURN", playerId: "p2" });
    expect(state.phase).toBe("demand");
    expect(state.round).toBe(2);
  });
});

describe("TRADE — Broker bonus (vestigial under v2.2)", () => {
  it("first trade still flips brokerFreeTradeUsed for telemetry, but no main action ends a turn anymore", () => {
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
    expect(state.currentPlayerIndex).toBe(0);
    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.brokerFreeTradeUsed).toBe(true);
    expect(p1.hand.map((c) => c.id)).toEqual(["card_p1_cap1_1"]);
  });
});
