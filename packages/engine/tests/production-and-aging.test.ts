import { describe, it, expect } from "vitest";
import { applyAction } from "../src/engine.js";
import { makeResourceCard, makeCapitalCard, makeMashBill } from "../src/cards.js";
import { advanceToActionPhase, firstEmptySlot, giveHand, makeTestGame } from "./helpers.js";

const cask = (label: string, i = 0) => makeResourceCard("cask", label, i);
const corn = (label: string, i = 0) => makeResourceCard("corn", label, i);
const rye = (label: string, i = 0) => makeResourceCard("rye", label, i);
const barley = (label: string, i = 0) => makeResourceCard("barley", label, i);
const wheat = (label: string, i = 0) => makeResourceCard("wheat", label, i);
const cap = (label: string, i = 0, v = 1) => makeCapitalCard(label, i, v);

function p1MashBillId(state: ReturnType<typeof makeTestGame>): string {
  return state.players.find((p) => p.id === "p1")!.mashBills[0]!.id;
}

describe("MAKE_BOURBON — happy path", () => {
  it("creates a barrel and consumes the cards + mash bill", () => {
    let state = makeTestGame();
    const mbId = p1MashBillId(state);
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [
      cask("p1", 0),
      corn("p1", 1),
      rye("p1", 2),
      cap("p1", 3),
    ]);
    const slotId = firstEmptySlot(state, "p1");
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      cardIds: ["card_p1_cask_0", "card_p1_corn_1", "card_p1_rye_2"],
      mashBillId: mbId,
      slotId,
    });

    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.mashBills.find((m) => m.id === mbId)).toBeUndefined();
    expect(p1.hand.map((c) => c.id)).toEqual(["card_p1_cap1_3"]);
    expect(p1.discard.map((c) => c.id).sort()).toEqual(
      ["card_p1_cask_0", "card_p1_corn_1", "card_p1_rye_2"].sort(),
    );

    expect(state.allBarrels).toHaveLength(1);
    const barrel = state.allBarrels[0]!;
    expect(barrel.ownerId).toBe("p1");
    expect(barrel.slotId).toBe(slotId);
    expect(barrel.attachedMashBill.id).toBe(mbId);
    expect(barrel.age).toBe(0);
    expect(barrel.agingCards).toHaveLength(0);
    expect(barrel.productionRound).toBe(1);
  });

  it("advances the turn to the next player", () => {
    let state = makeTestGame();
    const mbId = p1MashBillId(state);
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [cask("p1", 0), corn("p1", 1), rye("p1", 2)]);
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      cardIds: ["card_p1_cask_0", "card_p1_corn_1", "card_p1_rye_2"],
      mashBillId: mbId,
      slotId: firstEmptySlot(state, "p1"),
    });
    expect(state.currentPlayerIndex).toBe(1);
  });
});

describe("MAKE_BOURBON — universal recipe rules", () => {
  it("rejects without a cask", () => {
    let state = makeTestGame();
    const mbId = p1MashBillId(state);
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [corn("p1", 0), rye("p1", 1)]);
    expect(() =>
      applyAction(state, {
        type: "MAKE_BOURBON",
        playerId: "p1",
        cardIds: ["card_p1_corn_0", "card_p1_rye_1"],
        mashBillId: mbId,
        slotId: firstEmptySlot(state, "p1"),
      }),
    ).toThrow(/cask/);
  });

  it("rejects more than one cask source", () => {
    let state = makeTestGame();
    const mbId = p1MashBillId(state);
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [cask("p1", 0), cask("p1", 1), corn("p1", 2), rye("p1", 3)]);
    expect(() =>
      applyAction(state, {
        type: "MAKE_BOURBON",
        playerId: "p1",
        cardIds: ["card_p1_cask_0", "card_p1_cask_1", "card_p1_corn_2", "card_p1_rye_3"],
        mashBillId: mbId,
        slotId: firstEmptySlot(state, "p1"),
      }),
    ).toThrow(/cask/);
  });

  it("rejects without a corn", () => {
    let state = makeTestGame();
    const mbId = p1MashBillId(state);
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [cask("p1", 0), rye("p1", 1)]);
    expect(() =>
      applyAction(state, {
        type: "MAKE_BOURBON",
        playerId: "p1",
        cardIds: ["card_p1_cask_0", "card_p1_rye_1"],
        mashBillId: mbId,
        slotId: firstEmptySlot(state, "p1"),
      }),
    ).toThrow(/corn/);
  });

  it("rejects without any grain", () => {
    let state = makeTestGame();
    const mbId = p1MashBillId(state);
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [cask("p1", 0), corn("p1", 1)]);
    expect(() =>
      applyAction(state, {
        type: "MAKE_BOURBON",
        playerId: "p1",
        cardIds: ["card_p1_cask_0", "card_p1_corn_1"],
        mashBillId: mbId,
        slotId: firstEmptySlot(state, "p1"),
      }),
    ).toThrow(/grain/);
  });
});

describe("MAKE_BOURBON — per-bill recipes", () => {
  it("enforces high-rye recipe (rye >= 3)", () => {
    const highRye = makeMashBill(
      {
        defId: "high_rye_test",
        name: "Test High-Rye",
        ageBands: [2, 4, 6],
        demandBands: [2, 4, 6],
        rewardGrid: [
          [1, 2, 3],
          [2, 4, 6],
          [3, 6, 9],
        ],
        recipe: { minRye: 3 },
      },
      99,
    );
    let state = makeTestGame({ startingMashBills: [[highRye], []], bourbonDeck: [] });
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [
      cask("p1", 0),
      corn("p1", 1),
      rye("p1", 2),
      rye("p1", 3),
    ]);
    expect(() =>
      applyAction(state, {
        type: "MAKE_BOURBON",
        playerId: "p1",
        cardIds: ["card_p1_cask_0", "card_p1_corn_1", "card_p1_rye_2", "card_p1_rye_3"],
        mashBillId: highRye.id,
        slotId: firstEmptySlot(state, "p1"),
      }),
    ).toThrow(/rye/);

    state = giveHand(state, "p1", [
      cask("p1", 0),
      corn("p1", 1),
      rye("p1", 2),
      rye("p1", 3),
      rye("p1", 4),
    ]);
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      cardIds: [
        "card_p1_cask_0",
        "card_p1_corn_1",
        "card_p1_rye_2",
        "card_p1_rye_3",
        "card_p1_rye_4",
      ],
      mashBillId: highRye.id,
      slotId: firstEmptySlot(state, "p1"),
    });
    expect(state.allBarrels).toHaveLength(1);
  });

  it("enforces wheated recipe (wheat >= 1, no rye)", () => {
    const wheated = makeMashBill(
      {
        defId: "wheated_test",
        name: "Test Wheated",
        ageBands: [2, 4, 6],
        demandBands: [2, 4, 6],
        rewardGrid: [
          [1, 2, 3],
          [2, 4, 5],
          [3, 5, 6],
        ],
        recipe: { minWheat: 1, maxRye: 0 },
      },
      99,
    );
    let state = makeTestGame({ startingMashBills: [[wheated], []], bourbonDeck: [] });
    state = advanceToActionPhase(state);
    // Includes rye → rejected
    state = giveHand(state, "p1", [cask("p1", 0), corn("p1", 1), wheat("p1", 2), rye("p1", 3)]);
    expect(() =>
      applyAction(state, {
        type: "MAKE_BOURBON",
        playerId: "p1",
        cardIds: ["card_p1_cask_0", "card_p1_corn_1", "card_p1_wheat_2", "card_p1_rye_3"],
        mashBillId: wheated.id,
        slotId: firstEmptySlot(state, "p1"),
      }),
    ).toThrow(/rye/);
    // Wheat present, no rye → ok
    state = giveHand(state, "p1", [cask("p1", 0), corn("p1", 1), wheat("p1", 2)]);
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      cardIds: ["card_p1_cask_0", "card_p1_corn_1", "card_p1_wheat_2"],
      mashBillId: wheated.id,
      slotId: firstEmptySlot(state, "p1"),
    });
    expect(state.allBarrels).toHaveLength(1);
  });

  it("enforces four-grain recipe (rye + barley + wheat all >= 1)", () => {
    const fourGrain = makeMashBill(
      {
        defId: "four_grain_test",
        name: "Test Four-Grain",
        ageBands: [2, 4, 6],
        demandBands: [2, 4, 6],
        rewardGrid: [
          [1, 2, 3],
          [2, 4, 5],
          [3, 5, 6],
        ],
        recipe: { minBarley: 1, minRye: 1, minWheat: 1 },
      },
      99,
    );
    let state = makeTestGame({ startingMashBills: [[fourGrain], []], bourbonDeck: [] });
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [cask("p1", 0), corn("p1", 1), rye("p1", 2), barley("p1", 3)]);
    expect(() =>
      applyAction(state, {
        type: "MAKE_BOURBON",
        playerId: "p1",
        cardIds: ["card_p1_cask_0", "card_p1_corn_1", "card_p1_rye_2", "card_p1_barley_3"],
        mashBillId: fourGrain.id,
        slotId: firstEmptySlot(state, "p1"),
      }),
    ).toThrow(/wheat/);

    state = giveHand(state, "p1", [
      cask("p1", 0),
      corn("p1", 1),
      rye("p1", 2),
      barley("p1", 3),
      wheat("p1", 4),
    ]);
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      cardIds: [
        "card_p1_cask_0",
        "card_p1_corn_1",
        "card_p1_rye_2",
        "card_p1_barley_3",
        "card_p1_wheat_4",
      ],
      mashBillId: fourGrain.id,
      slotId: firstEmptySlot(state, "p1"),
    });
    expect(state.allBarrels).toHaveLength(1);
  });
});

describe("MAKE_BOURBON — slot, mash bill, hand integrity", () => {
  it("rejects when the chosen slot is already occupied", () => {
    let state = makeTestGame();
    const mbId = p1MashBillId(state);
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [cask("p1", 0), corn("p1", 1), rye("p1", 2)]);
    const slotId = firstEmptySlot(state, "p1");
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      cardIds: ["card_p1_cask_0", "card_p1_corn_1", "card_p1_rye_2"],
      mashBillId: mbId,
      slotId,
    });
    // p2's turn now; reset back to p1 with a second mash bill + hand
    state = giveHand(state, "p1", [cask("p1", 5), corn("p1", 6), rye("p1", 7)]);
    state = { ...state, currentPlayerIndex: 0 };
    const mb2 = state.players.find((p) => p.id === "p1")!.mashBills[0]!.id;
    // Re-target the now-occupied slot to assert the rejection.
    expect(() =>
      applyAction(state, {
        type: "MAKE_BOURBON",
        playerId: "p1",
        cardIds: ["card_p1_cask_5", "card_p1_corn_6", "card_p1_rye_7"],
        mashBillId: mb2,
        slotId,
      }),
    ).toThrow(/occupied/);
  });

  it("rejects an unknown mash bill", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [cask("p1", 0), corn("p1", 1), rye("p1", 2)]);
    expect(() =>
      applyAction(state, {
        type: "MAKE_BOURBON",
        playerId: "p1",
        cardIds: ["card_p1_cask_0", "card_p1_corn_1", "card_p1_rye_2"],
        mashBillId: "mb_ghost_0",
        slotId: firstEmptySlot(state, "p1"),
      }),
    ).toThrow(/mash bill/);
  });

  it("rejects card ids that aren't in hand", () => {
    let state = makeTestGame();
    const mbId = p1MashBillId(state);
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [cask("p1", 0), corn("p1", 1), rye("p1", 2)]);
    expect(() =>
      applyAction(state, {
        type: "MAKE_BOURBON",
        playerId: "p1",
        cardIds: ["card_p1_cask_99", "card_p1_corn_1", "card_p1_rye_2"],
        mashBillId: mbId,
        slotId: firstEmptySlot(state, "p1"),
      }),
    ).toThrow(/not in your hand/);
  });

  it("rejects duplicate card ids", () => {
    let state = makeTestGame();
    const mbId = p1MashBillId(state);
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [cask("p1", 0), corn("p1", 1), rye("p1", 2)]);
    expect(() =>
      applyAction(state, {
        type: "MAKE_BOURBON",
        playerId: "p1",
        cardIds: ["card_p1_cask_0", "card_p1_cask_0", "card_p1_corn_1"],
        mashBillId: mbId,
        slotId: firstEmptySlot(state, "p1"),
      }),
    ).toThrow(/duplicate/);
  });

  it("rejects when it's not your turn", () => {
    let state = makeTestGame();
    const mbId = state.players.find((p) => p.id === "p2")!.mashBills[0]!.id;
    state = advanceToActionPhase(state);
    state = giveHand(state, "p2", [cask("p2", 0), corn("p2", 1), rye("p2", 2)]);
    expect(() =>
      applyAction(state, {
        type: "MAKE_BOURBON",
        playerId: "p2",
        cardIds: ["card_p2_cask_0", "card_p2_corn_1", "card_p2_rye_2"],
        mashBillId: mbId,
        slotId: firstEmptySlot(state, "p2"),
      }),
    ).toThrow(/not your turn/);
  });
});

describe("MAKE_BOURBON — 3:1 conversion", () => {
  it("3:1 conversion produces a missing basic resource", () => {
    let state = makeTestGame();
    const mbId = p1MashBillId(state);
    state = advanceToActionPhase(state);
    // Hand: cask + corn + 3 capital cards (no grain). Convert 3 capitals → 1 rye.
    state = giveHand(state, "p1", [
      cask("p1", 0),
      corn("p1", 1),
      cap("p1", 2),
      cap("p1", 3),
      cap("p1", 4),
    ]);
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      cardIds: ["card_p1_cask_0", "card_p1_corn_1"],
      mashBillId: mbId,
      slotId: firstEmptySlot(state, "p1"),
      conversions: [
        {
          spendCardIds: ["card_p1_cap1_2", "card_p1_cap1_3", "card_p1_cap1_4"],
          resourceType: "rye",
        },
      ],
    });
    expect(state.allBarrels).toHaveLength(1);
    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.discard).toHaveLength(5); // all 5 cards used
    expect(p1.hand).toHaveLength(0);
  });

  it("rejects conversion with the wrong card count", () => {
    let state = makeTestGame();
    const mbId = p1MashBillId(state);
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [cask("p1", 0), corn("p1", 1), cap("p1", 2), cap("p1", 3)]);
    expect(() =>
      applyAction(state, {
        type: "MAKE_BOURBON",
        playerId: "p1",
        cardIds: ["card_p1_cask_0", "card_p1_corn_1"],
        mashBillId: mbId,
        slotId: firstEmptySlot(state, "p1"),
        conversions: [
          {
            spendCardIds: ["card_p1_cap1_2", "card_p1_cap1_3"],
            resourceType: "rye",
          },
        ],
      }),
    ).toThrow(/3 cards/);
  });
});

describe("AGE_BOURBON", () => {
  it("places a card on the barrel and increments age", () => {
    let state = makeTestGame();
    const mbId = p1MashBillId(state);
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [
      cask("p1", 0),
      corn("p1", 1),
      rye("p1", 2),
      cap("p1", 3),
      cap("p1", 4),
    ]);
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      cardIds: ["card_p1_cask_0", "card_p1_corn_1", "card_p1_rye_2"],
      mashBillId: mbId,
      slotId: firstEmptySlot(state, "p1"),
    });
    const barrelId = state.allBarrels[0]!.id;
    state = giveHand(state, "p2", []);
    state = applyAction(state, { type: "PASS_TURN", playerId: "p2" });
    state = applyAction(state, {
      type: "AGE_BOURBON",
      playerId: "p1",
      barrelId,
      cardId: "card_p1_cap1_3",
    });
    expect(state.phase).toBe("action");
    const barrel = state.allBarrels.find((b) => b.id === barrelId)!;
    expect(barrel.age).toBe(1);
    expect(barrel.agingCards).toHaveLength(1);
    expect(barrel.agedThisRound).toBe(true);
    expect(state.players.find((p) => p.id === "p1")!.hand).toHaveLength(1);
  });

  it("rejects aging another player's barrel", () => {
    let state = makeTestGame();
    const mbId = p1MashBillId(state);
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [cask("p1", 0), corn("p1", 1), rye("p1", 2)]);
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      cardIds: ["card_p1_cask_0", "card_p1_corn_1", "card_p1_rye_2"],
      mashBillId: mbId,
      slotId: firstEmptySlot(state, "p1"),
    });
    const barrelId = state.allBarrels[0]!.id;
    state = giveHand(state, "p2", [cap("p2", 0)]);
    expect(() =>
      applyAction(state, {
        type: "AGE_BOURBON",
        playerId: "p2",
        barrelId,
        cardId: "card_p2_cap1_0",
      }),
    ).toThrow(/own/);
  });

  it("rejects aging the same barrel twice in one round", () => {
    let state = makeTestGame();
    const mbId = p1MashBillId(state);
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [cask("p1", 0), corn("p1", 1), rye("p1", 2), cap("p1", 3), cap("p1", 4)]);
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      cardIds: ["card_p1_cask_0", "card_p1_corn_1", "card_p1_rye_2"],
      mashBillId: mbId,
      slotId: firstEmptySlot(state, "p1"),
    });
    const barrelId = state.allBarrels[0]!.id;
    state = giveHand(state, "p2", [cap("p2", 0)]);
    state = applyAction(state, { type: "PASS_TURN", playerId: "p2" });
    state = applyAction(state, {
      type: "AGE_BOURBON",
      playerId: "p1",
      barrelId,
      cardId: "card_p1_cap1_3",
    });
    expect(state.currentPlayerIndex).toBe(0);
    expect(() =>
      applyAction(state, {
        type: "AGE_BOURBON",
        playerId: "p1",
        barrelId,
        cardId: "card_p1_cap1_4",
      }),
    ).toThrow(/already been aged/);
  });
});

describe("PASS_TURN + cleanup", () => {
  it("PASS_TURN marks the player out — cleanup later handles the discard sweep", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [cap("p1", 0), cap("p1", 1)]);
    state = giveHand(state, "p2", [cap("p2", 0)]);
    state = applyAction(state, { type: "PASS_TURN", playerId: "p1" });
    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.hand).toHaveLength(2);
    expect(p1.outForRound).toBe(true);
    expect(state.currentPlayerIndex).toBe(1);
    expect(state.phase).toBe("action");

    state = applyAction(state, { type: "PASS_TURN", playerId: "p2" });
    expect(state.phase).toBe("demand");
    const p1AfterCleanup = state.players.find((p) => p.id === "p1")!;
    expect(p1AfterCleanup.hand).toHaveLength(0);
    expect(p1AfterCleanup.discard.map((c) => c.id).sort()).toEqual(
      ["card_p1_cap1_0", "card_p1_cap1_1"].sort(),
    );
  });

  it("when both players have nothing in hand, the first PASS_TURN wraps the round", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", []);
    state = giveHand(state, "p2", []);
    state = { ...state, currentPlayerIndex: 0 };
    state = applyAction(state, { type: "PASS_TURN", playerId: "p1" });
    expect(state.round).toBe(2);
    expect(state.phase).toBe("demand");
    for (const p of state.players) expect(p.outForRound).toBe(false);
  });

  it("agedThisRound resets at cleanup", () => {
    let state = makeTestGame();
    const mbId = p1MashBillId(state);
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [cask("p1", 0), corn("p1", 1), rye("p1", 2), cap("p1", 3)]);
    state = giveHand(state, "p2", []);
    state = { ...state, currentPlayerIndex: 0 };
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      cardIds: ["card_p1_cask_0", "card_p1_corn_1", "card_p1_rye_2"],
      mashBillId: mbId,
      slotId: firstEmptySlot(state, "p1"),
    });
    const barrelId = state.allBarrels[0]!.id;
    state = applyAction(state, { type: "PASS_TURN", playerId: "p2" });
    state = applyAction(state, {
      type: "AGE_BOURBON",
      playerId: "p1",
      barrelId,
      cardId: "card_p1_cap1_3",
    });
    expect(state.phase).toBe("demand");
    expect(state.round).toBe(2);
    expect(state.allBarrels[0]!.agedThisRound).toBe(false);
  });
});
