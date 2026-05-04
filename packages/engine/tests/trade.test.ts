import { describe, it, expect } from "vitest";
import { applyAction, IllegalActionError } from "../src/engine.js";
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

  it("traded cards go to the recipient's discard, action cards stay with sender", () => {
    let state = setupTrade();
    state = applyAction(state, {
      type: "TRADE",
      player1Id: "p1",
      player2Id: "p2",
      player1Cards: ["card_p1_rye_0"],
      player2Cards: ["card_p2_wheat_0"],
      player1ActionCardId: "card_p1_cap1_1",
      player2ActionCardId: "card_p2_cap1_1",
    });
    const p1 = state.players.find((p) => p.id === "p1")!;
    const p2 = state.players.find((p) => p.id === "p2")!;

    // Cards offered by p1 are in p2's discard, and vice versa.
    expect(p2.discard.some((c) => c.id === "card_p1_rye_0")).toBe(true);
    expect(p1.discard.some((c) => c.id === "card_p2_wheat_0")).toBe(true);
    // Action cards land in each player's own discard.
    expect(p1.discard.some((c) => c.id === "card_p1_cap1_1")).toBe(true);
    expect(p2.discard.some((c) => c.id === "card_p2_cap1_1")).toBe(true);
    // Each player still has their remaining capital card.
    expect(p1.hand.map((c) => c.id)).toEqual(["card_p1_cap1_2"]);
    expect(p2.hand.map((c) => c.id)).toEqual(["card_p2_cap1_2"]);
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
        player1ActionCardId: "card_p2_cap1_1",
        player2ActionCardId: "card_p1_cap1_1",
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
        player1ActionCardId: "card_p1_cap1_1",
        player2ActionCardId: "card_p2_cap1_1",
      }),
    ).toThrow(/at least one/);
  });

  it("rejects when the action card overlaps with the offer", () => {
    const state = setupTrade();
    expect(() =>
      applyAction(state, {
        type: "TRADE",
        player1Id: "p1",
        player2Id: "p2",
        player1Cards: ["card_p1_rye_0", "card_p1_cap1_1"],
        player2Cards: ["card_p2_wheat_0"],
        player1ActionCardId: "card_p1_cap1_1",
        player2ActionCardId: "card_p2_cap1_1",
      }),
    ).toThrow(/action card/);
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
        player1ActionCardId: "card_p1_cap1_1",
        player2ActionCardId: "card_p2_cap1_1",
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
        player1ActionCardId: "card_p1_cap1_1",
        player2ActionCardId: "card_p2_cap1_1",
      }),
    ).toThrow(/final round/);
  });

  it("marks an emptied-out trader as out for the round", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state);
    // Both players have exactly 2 cards: 1 to trade, 1 as action card.
    state = giveHand(state, "p1", [makeResourceCard("rye", "p1", 0), makeCapitalCard("p1", 1)]);
    state = giveHand(state, "p2", [makeResourceCard("wheat", "p2", 0), makeCapitalCard("p2", 1)]);
    state = applyAction(state, {
      type: "TRADE",
      player1Id: "p1",
      player2Id: "p2",
      player1Cards: ["card_p1_rye_0"],
      player2Cards: ["card_p2_wheat_0"],
      player1ActionCardId: "card_p1_cap1_1",
      player2ActionCardId: "card_p2_cap1_1",
    });
    // Both hands are empty post-trade. Cleanup should have wrapped the round.
    expect(state.phase).toBe("demand");
    expect(state.round).toBe(2);
  });
});
