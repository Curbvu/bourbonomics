import { describe, it, expect } from "vitest";
import { applyAction, IllegalActionError } from "../src/engine.js";
import { makeCapitalCard, makeInvestment, makeOperations, makeResourceCard } from "../src/cards.js";
import { advanceToActionPhase, giveHand, makeTestGame } from "./helpers.js";
import type { Investment, OperationsCard } from "../src/types.js";

const cap = (label: string, i = 0, v = 1) => makeCapitalCard(label, i, v);

describe("DRAW_MASH_BILL / DRAW_INVESTMENT / DRAW_OPERATIONS", () => {
  it("DRAW_MASH_BILL pulls a mash bill into hand and triggers final round on exhaustion", () => {
    let state = makeTestGame({
      // Single mash bill in the deck so a single draw exhausts it.
      bourbonDeck: [],
    });
    // Manually inject one mash bill so we can drain it and trigger the final round.
    const oneBill = state.players[0]!.mashBills[0]!;
    state = { ...state, bourbonDeck: [oneBill] };
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [cap("p1", 0)]);
    state = applyAction(state, {
      type: "DRAW_MASH_BILL",
      playerId: "p1",
      spendCardId: "card_p1_cap1_0",
    });
    expect(state.bourbonDeck).toHaveLength(0);
    expect(state.finalRoundTriggered).toBe(true);
    expect(state.finalRoundTriggerPlayerIndex).toBe(0);
    expect(state.players.find((p) => p.id === "p1")!.mashBills.some((m) => m.id === oneBill.id)).toBe(true);
  });

  it("DRAW_INVESTMENT puts an investment into heldInvestments", () => {
    const inv = makeInvestment(
      { defId: "test", name: "Test", capitalCost: 1, effect: { kind: "hand_size_plus", amount: 1 } },
      99,
    );
    let state = makeTestGame({ investments: [inv] });
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [cap("p1", 0)]);
    state = applyAction(state, {
      type: "DRAW_INVESTMENT",
      playerId: "p1",
      spendCardId: "card_p1_cap1_0",
    });
    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.heldInvestments.some((i) => i.id === inv.id)).toBe(true);
  });

  it("DRAW_OPERATIONS puts an operations card into heldOperations", () => {
    const op = makeOperations(
      { defId: "test_op", name: "Test", effect: { kind: "demand_delta", amount: 1 } },
      99,
    );
    let state = makeTestGame({ operations: [op] });
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [cap("p1", 0)]);
    state = applyAction(state, {
      type: "DRAW_OPERATIONS",
      playerId: "p1",
      spendCardId: "card_p1_cap1_0",
    });
    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.heldOperations.some((o) => o.id === op.id)).toBe(true);
  });

  it("DRAW_MASH_BILL fails when the bourbon deck is empty", () => {
    let state = makeTestGame({ bourbonDeck: [] });
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [cap("p1", 0)]);
    expect(() =>
      applyAction(state, {
        type: "DRAW_MASH_BILL",
        playerId: "p1",
        spendCardId: "card_p1_cap1_0",
      }),
    ).toThrow(/empty/);
  });
});

describe("IMPLEMENT_INVESTMENT", () => {
  function withHeldInvestment(state: ReturnType<typeof makeTestGame>, inv: Investment) {
    return {
      ...state,
      players: state.players.map((p) => (p.id === "p1" ? { ...p, heldInvestments: [inv] } : p)),
    };
  }

  it("happy path: pays capital, moves investment to active, applies hand_size_plus", () => {
    const inv = makeInvestment(
      { defId: "larger_distillery", name: "Larger", capitalCost: 2, effect: { kind: "hand_size_plus", amount: 1 } },
      99,
    );
    let state = makeTestGame();
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [cap("p1", 0), cap("p1", 1)]);
    state = withHeldInvestment(state, inv);
    state = applyAction(state, {
      type: "IMPLEMENT_INVESTMENT",
      playerId: "p1",
      investmentId: inv.id,
      capitalCardIds: ["card_p1_cap1_0", "card_p1_cap1_1"],
    });
    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.activeInvestments.some((i) => i.id === inv.id)).toBe(true);
    expect(p1.heldInvestments).toHaveLength(0);
    expect(p1.handSize).toBe(9);
    expect(p1.discard.map((c) => c.id).sort()).toEqual(["card_p1_cap1_0", "card_p1_cap1_1"].sort());
  });

  it("rejects when capital is insufficient", () => {
    const inv = makeInvestment(
      { defId: "expensive", name: "Expensive", capitalCost: 5, effect: { kind: "hand_size_plus", amount: 1 } },
      99,
    );
    let state = makeTestGame();
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [cap("p1", 0)]);
    state = withHeldInvestment(state, inv);
    expect(() =>
      applyAction(state, {
        type: "IMPLEMENT_INVESTMENT",
        playerId: "p1",
        investmentId: inv.id,
        capitalCardIds: ["card_p1_cap1_0"],
      }),
    ).toThrow(/paid capital/);
  });

  it("rejects when 3 active investments are already in play", () => {
    const inv = makeInvestment(
      { defId: "fourth", name: "Fourth", capitalCost: 1, effect: { kind: "hand_size_plus", amount: 1 } },
      99,
    );
    const existing = [1, 2, 3].map((n) =>
      makeInvestment(
        { defId: `existing${n}`, name: `Existing ${n}`, capitalCost: 1, effect: { kind: "hand_size_plus", amount: 1 } },
        n,
      ),
    );
    let state = makeTestGame();
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [cap("p1", 0)]);
    state = {
      ...state,
      players: state.players.map((p) =>
        p.id === "p1"
          ? { ...p, activeInvestments: existing, heldInvestments: [inv] }
          : p,
      ),
    };
    expect(() =>
      applyAction(state, {
        type: "IMPLEMENT_INVESTMENT",
        playerId: "p1",
        investmentId: inv.id,
        capitalCardIds: ["card_p1_cap1_0"],
      }),
    ).toThrow(/3 active/);
  });

  it("hand_size_plus persists into the next round's draw phase", () => {
    const inv = makeInvestment(
      { defId: "larger", name: "Larger", capitalCost: 1, effect: { kind: "hand_size_plus", amount: 2 } },
      99,
    );
    let state = makeTestGame();
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [cap("p1", 0)]);
    state = withHeldInvestment(state, inv);
    state = applyAction(state, {
      type: "IMPLEMENT_INVESTMENT",
      playerId: "p1",
      investmentId: inv.id,
      capitalCardIds: ["card_p1_cap1_0"],
    });
    // PASS to end the round.
    state = giveHand(state, "p2", []);
    state = applyAction(state, { type: "PASS_TURN", playerId: "p2" });
    expect(state.phase).toBe("demand");
    state = applyAction(state, { type: "ROLL_DEMAND", roll: [3, 4] });
    state = applyAction(state, { type: "DRAW_HAND", playerId: "p1" });
    const p1 = state.players.find((p) => p.id === "p1")!;
    // p1 starts round 2 with deck/discard freshly stocked; should draw min(handSize=10, available)
    expect(p1.handSize).toBe(10);
    expect(p1.hand.length).toBeLessThanOrEqual(10);
  });
});

describe("PLAY_OPERATIONS", () => {
  function withHeldOps(state: ReturnType<typeof makeTestGame>, op: OperationsCard) {
    return {
      ...state,
      players: state.players.map((p) => (p.id === "p1" ? { ...p, heldOperations: [op] } : p)),
    };
  }

  it("demand_delta clamps demand to [0, 12]", () => {
    const boom = makeOperations(
      { defId: "boom", name: "Boom", effect: { kind: "demand_delta", amount: 99 } },
      99,
    );
    let state = makeTestGame({ startingDemand: 5 });
    state = advanceToActionPhase(state, [1, 1]); // 5→6 after roll
    state = giveHand(state, "p1", []);
    state = withHeldOps(state, boom);
    state = applyAction(state, {
      type: "PLAY_OPERATIONS",
      playerId: "p1",
      operationsCardId: boom.id,
    });
    expect(state.demand).toBe(12);
    expect(state.operationsDiscard.some((o) => o.id === boom.id)).toBe(true);
  });

  it("draw_cards pulls cards into hand", () => {
    const op = makeOperations(
      { defId: "press", name: "Press", effect: { kind: "draw_cards", amount: 2 } },
      99,
    );
    let state = makeTestGame();
    state = advanceToActionPhase(state);
    state = {
      ...state,
      players: state.players.map((p) =>
        p.id === "p1"
          ? {
              ...p,
              hand: [],
              deck: [
                makeResourceCard("rye", "p1", 0),
                makeResourceCard("rye", "p1", 1),
                makeResourceCard("rye", "p1", 2),
              ],
              discard: [],
              heldOperations: [op],
            }
          : p,
      ),
    };
    state = applyAction(state, {
      type: "PLAY_OPERATIONS",
      playerId: "p1",
      operationsCardId: op.id,
    });
    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.hand).toHaveLength(2);
    expect(p1.deck).toHaveLength(1);
  });
});

describe("carry_over_cards investment effect", () => {
  it("keeps N cards in hand at cleanup", () => {
    const inv = makeInvestment(
      {
        defId: "bottling_line",
        name: "Bottling Line",
        capitalCost: 1,
        effect: { kind: "carry_over_cards", amount: 1 },
      },
      99,
    );
    let state = makeTestGame();
    state = advanceToActionPhase(state);
    // Manually attach the investment and give p1 several cards.
    state = giveHand(state, "p1", [cap("p1", 0), cap("p1", 1), cap("p1", 2)]);
    state = giveHand(state, "p2", []);
    state = {
      ...state,
      players: state.players.map((p) =>
        p.id === "p1" ? { ...p, activeInvestments: [inv] } : p,
      ),
    };
    state = applyAction(state, { type: "PASS_TURN", playerId: "p1" });
    // Round wrapped — p1 should have 1 card still in hand.
    expect(state.phase).toBe("demand");
    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.hand).toHaveLength(1);
    expect(p1.discard).toHaveLength(2);
  });
});
