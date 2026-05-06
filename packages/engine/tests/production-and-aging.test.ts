import { describe, it, expect } from "vitest";
import { applyAction } from "../src/engine.js";
import { makeResourceCard, makeCapitalCard, makeMashBill } from "../src/cards.js";
import {
  advanceToActionPhase,
  advanceToNextRound,
  giveHand,
  makeTestGame,
  slotForBill,
} from "./helpers.js";

const cask = (label: string, i = 0) => makeResourceCard("cask", label, i);
const corn = (label: string, i = 0) => makeResourceCard("corn", label, i);
const rye = (label: string, i = 0) => makeResourceCard("rye", label, i);
const barley = (label: string, i = 0) => makeResourceCard("barley", label, i);
const wheat = (label: string, i = 0) => makeResourceCard("wheat", label, i);
const cap = (label: string, i = 0, v = 1) => makeCapitalCard(label, i, v);

/**
 * v2.6: drafted bills land in slots as "ready" barrels at setup.
 * Returns the bill id of p1's first ready slot.
 */
function p1MashBillId(state: ReturnType<typeof makeTestGame>): string {
  const barrel = state.allBarrels.find(
    (b) => b.ownerId === "p1" && b.phase === "ready",
  );
  if (!barrel) throw new Error("p1 has no ready barrel");
  return barrel.attachedMashBill.id;
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
    const slotId = slotForBill(state, "p1", mbId);
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      cardIds: ["card_p1_cask_0", "card_p1_corn_1", "card_p1_rye_2"],      slotId,
    });

    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(state.allBarrels.find((b) => b.attachedMashBill.id === mbId)?.phase).not.toBe("ready");
    expect(p1.hand.map((c) => c.id)).toEqual(["card_p1_cap1_3"]);
    // Production cards are now LOCKED with the barrel until sale
    // (they used to land in discard at production time).
    expect(p1.discard.map((c) => c.id)).toEqual([]);

    expect(state.allBarrels.filter((b) => b.phase !== "ready")).toHaveLength(1);
    const barrel = state.allBarrels[0]!;
    expect(barrel.ownerId).toBe("p1");
    expect(barrel.slotId).toBe(slotId);
    expect(barrel.attachedMashBill?.id).toBe(mbId);
    expect(barrel.age).toBe(0);
    expect(barrel.agingCards).toHaveLength(0);
    expect(barrel.productionCards.map((c) => c.id).sort()).toEqual(
      ["card_p1_cask_0", "card_p1_corn_1", "card_p1_rye_2"].sort(),
    );
    expect(barrel.productionRound).toBe(1);
  });

  it("does NOT end the turn (v2.2: only PASS_TURN ends a turn)", () => {
    let state = makeTestGame();
    const mbId = p1MashBillId(state);
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [cask("p1", 0), corn("p1", 1), rye("p1", 2)]);
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      cardIds: ["card_p1_cask_0", "card_p1_corn_1", "card_p1_rye_2"],      slotId: slotForBill(state, "p1", mbId),
    });
    expect(state.currentPlayerIndex).toBe(0);
    state = applyAction(state, { type: "PASS_TURN", playerId: "p1" });
    expect(state.currentPlayerIndex).toBe(1);
  });
});

describe("MAKE_BOURBON — universal recipe rules (incremental)", () => {
  // v2.5: partial commits no longer throw. The barrel exists in
  // construction phase and stays there until the recipe is satisfied.
  it("a commit without a cask leaves the barrel under construction", () => {
    let state = makeTestGame();
    const mbId = p1MashBillId(state);
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [corn("p1", 0), rye("p1", 1)]);
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      cardIds: ["card_p1_corn_0", "card_p1_rye_1"],      slotId: slotForBill(state, "p1", mbId),
    });
    expect(state.allBarrels.filter((b) => b.phase !== "ready")).toHaveLength(1);
    expect(state.allBarrels[0]!.phase).toBe("construction");
    expect(state.allBarrels[0]!.completedInRound).toBeNull();
  });

  it("rejects committing more than one cask source", () => {
    let state = makeTestGame();
    const mbId = p1MashBillId(state);
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [cask("p1", 0), cask("p1", 1), corn("p1", 2), rye("p1", 3)]);
    expect(() =>
      applyAction(state, {
        type: "MAKE_BOURBON",
        playerId: "p1",
        cardIds: ["card_p1_cask_0", "card_p1_cask_1", "card_p1_corn_2", "card_p1_rye_3"],        slotId: slotForBill(state, "p1", mbId),
      }),
    ).toThrow(/cask/);
  });

  it("a commit without a corn leaves the barrel under construction", () => {
    let state = makeTestGame();
    const mbId = p1MashBillId(state);
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [cask("p1", 0), rye("p1", 1)]);
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      cardIds: ["card_p1_cask_0", "card_p1_rye_1"],      slotId: slotForBill(state, "p1", mbId),
    });
    expect(state.allBarrels[0]!.phase).toBe("construction");
  });

  it("a commit without any grain leaves the barrel under construction", () => {
    let state = makeTestGame();
    const mbId = p1MashBillId(state);
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [cask("p1", 0), corn("p1", 1)]);
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      cardIds: ["card_p1_cask_0", "card_p1_corn_1"],      slotId: slotForBill(state, "p1", mbId),
    });
    expect(state.allBarrels[0]!.phase).toBe("construction");
  });
});

describe("MAKE_BOURBON — per-bill recipes", () => {
  it("high-rye recipe completes only when rye ≥ 3", () => {
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
    // 4 cards (cask + corn + 2 rye) — recipe NOT satisfied; barrel
    // stays in construction.
    let state = makeTestGame({ startingMashBills: [[highRye], []], bourbonDeck: [] });
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [
      cask("p1", 0),
      corn("p1", 1),
      rye("p1", 2),
      rye("p1", 3),
    ]);
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      cardIds: ["card_p1_cask_0", "card_p1_corn_1", "card_p1_rye_2", "card_p1_rye_3"],      slotId: slotForBill(state, "p1", highRye.id),
    });
    expect(state.allBarrels.filter((b) => b.phase !== "ready")).toHaveLength(1);
    expect(state.allBarrels[0]!.phase).toBe("construction");

    // 5 cards (cask + corn + 3 rye) — recipe satisfied; barrel flips
    // to aging phase.
    state = makeTestGame({ startingMashBills: [[highRye], []], bourbonDeck: [] });
    state = advanceToActionPhase(state);
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
      ],      slotId: slotForBill(state, "p1", highRye.id),
    });
    expect(state.allBarrels[0]!.phase).toBe("aging");
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
        cardIds: ["card_p1_cask_0", "card_p1_corn_1", "card_p1_wheat_2", "card_p1_rye_3"],        slotId: slotForBill(state, "p1", wheated.id),
      }),
    ).toThrow(/rye/);
    // Wheat present, no rye → ok
    state = giveHand(state, "p1", [cask("p1", 0), corn("p1", 1), wheat("p1", 2)]);
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      cardIds: ["card_p1_cask_0", "card_p1_corn_1", "card_p1_wheat_2"],      slotId: slotForBill(state, "p1", wheated.id),
    });
    expect(state.allBarrels.filter((b) => b.phase !== "ready")).toHaveLength(1);
  });

  it("four-grain recipe completes only when wheat is also committed", () => {
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
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      cardIds: ["card_p1_cask_0", "card_p1_corn_1", "card_p1_rye_2", "card_p1_barley_3"],      slotId: slotForBill(state, "p1", fourGrain.id),
    });
    expect(state.allBarrels[0]!.phase).toBe("construction");

    state = makeTestGame({ startingMashBills: [[fourGrain], []], bourbonDeck: [] });
    state = advanceToActionPhase(state);
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
      ],      slotId: slotForBill(state, "p1", fourGrain.id),
    });
    expect(state.allBarrels[0]!.phase).toBe("aging");
  });
});

describe("MAKE_BOURBON — slot, mash bill, hand integrity", () => {
  it("rejects MAKE_BOURBON on a slot whose barrel has already finished construction", () => {
    let state = makeTestGame();
    const mbId = p1MashBillId(state);
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [cask("p1", 0), corn("p1", 1), rye("p1", 2)]);
    const slotId = slotForBill(state, "p1", mbId);
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      cardIds: ["card_p1_cask_0", "card_p1_corn_1", "card_p1_rye_2"],
      slotId,
    });
    // First MAKE completed the barrel — phase is now "aging".
    const completed = state.allBarrels.find((b) => b.slotId === slotId)!;
    expect(completed.phase).toBe("aging");
    // Trying to commit more cards to the same slot must reject.
    state = giveHand(state, "p1", [cask("p1", 5), corn("p1", 6), rye("p1", 7)]);
    state = { ...state, currentPlayerIndex: 0 };
    expect(() =>
      applyAction(state, {
        type: "MAKE_BOURBON",
        playerId: "p1",
        cardIds: ["card_p1_cask_5", "card_p1_corn_6", "card_p1_rye_7"],
        slotId,
      }),
    ).toThrow(/finished construction/);
  });

  // v2.6: "rejects an unknown mash bill" test deleted — MAKE_BOURBON
  // no longer accepts a mashBillId parameter (bills are slot-bound).

  it("rejects card ids that aren't in hand", () => {
    let state = makeTestGame();
    const mbId = p1MashBillId(state);
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [cask("p1", 0), corn("p1", 1), rye("p1", 2)]);
    expect(() =>
      applyAction(state, {
        type: "MAKE_BOURBON",
        playerId: "p1",
        cardIds: ["card_p1_cask_99", "card_p1_corn_1", "card_p1_rye_2"],        slotId: slotForBill(state, "p1", mbId),
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
        cardIds: ["card_p1_cask_0", "card_p1_cask_0", "card_p1_corn_1"],        slotId: slotForBill(state, "p1", mbId),
      }),
    ).toThrow(/duplicate/);
  });

  it("rejects when it's not your turn", () => {
    let state = makeTestGame();
    const mbId = state.allBarrels.find((b) => b.ownerId === "p2" && b.phase === "ready")!.attachedMashBill.id;
    state = advanceToActionPhase(state);
    state = giveHand(state, "p2", [cask("p2", 0), corn("p2", 1), rye("p2", 2)]);
    expect(() =>
      applyAction(state, {
        type: "MAKE_BOURBON",
        playerId: "p2",
        cardIds: ["card_p2_cask_0", "card_p2_corn_1", "card_p2_rye_2"],        slotId: slotForBill(state, "p2", mbId),
      }),
    ).toThrow(/not your turn/);
  });
});

// 3:1 Convert was removed in v2.5 (incremental commitment makes
// stranded resources less common — players just commit what they
// have and add more later). Tests for the old conversion path were
// dropped here.

describe("AGE_BOURBON", () => {
  it("places a card on the barrel and increments age", () => {
    let state = makeTestGame();
    const mbId = p1MashBillId(state);
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [cask("p1", 0), corn("p1", 1), rye("p1", 2)]);
    state = giveHand(state, "p2", []);
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      cardIds: ["card_p1_cask_0", "card_p1_corn_1", "card_p1_rye_2"],      slotId: slotForBill(state, "p1", mbId),
    });
    const barrelId = state.allBarrels[0]!.id;
    // v2.5: barrel completed in round 1 — first ages in round 2.
    state = advanceToNextRound(state, {
      seedDecks: { p1: [cap("p1", 3), cap("p1", 4)] },
    });
    state = { ...state, currentPlayerIndex: 0 };
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
      cardIds: ["card_p1_cask_0", "card_p1_corn_1", "card_p1_rye_2"],      slotId: slotForBill(state, "p1", mbId),
    });
    const barrelId = state.allBarrels[0]!.id;
    // Hand off to p2 explicitly so the validator hits the ownership
    // check rather than the "not your turn" check.
    state = applyAction(state, { type: "PASS_TURN", playerId: "p1" });
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
    state = giveHand(state, "p1", [cask("p1", 0), corn("p1", 1), rye("p1", 2)]);
    state = giveHand(state, "p2", []);
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      cardIds: ["card_p1_cask_0", "card_p1_corn_1", "card_p1_rye_2"],      slotId: slotForBill(state, "p1", mbId),
    });
    const barrelId = state.allBarrels[0]!.id;
    // v2.5: barrel completed in r1 — first ages in r2.
    state = advanceToNextRound(state, {
      seedDecks: { p1: [cap("p1", 3), cap("p1", 4)] },
    });
    state = { ...state, currentPlayerIndex: 0 };
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

  it("when both players have nothing in hand, sequential PASS_TURNs wrap the round", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", []);
    state = giveHand(state, "p2", []);
    state = { ...state, currentPlayerIndex: 0 };
    // Each player must explicitly pass — actions don't end turns under v2.2.
    state = applyAction(state, { type: "PASS_TURN", playerId: "p1" });
    state = applyAction(state, { type: "PASS_TURN", playerId: "p2" });
    expect(state.round).toBe(2);
    expect(state.phase).toBe("demand");
    for (const p of state.players) expect(p.outForRound).toBe(false);
  });

  it("agedThisRound resets at cleanup", () => {
    let state = makeTestGame();
    const mbId = p1MashBillId(state);
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [cask("p1", 0), corn("p1", 1), rye("p1", 2)]);
    state = giveHand(state, "p2", []);
    state = { ...state, currentPlayerIndex: 0 };
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      cardIds: ["card_p1_cask_0", "card_p1_corn_1", "card_p1_rye_2"],      slotId: slotForBill(state, "p1", mbId),
    });
    const barrelId = state.allBarrels[0]!.id;
    // v2.5: barrel completed in r1 — first ages in r2.
    state = advanceToNextRound(state, {
      seedDecks: { p1: [cap("p1", 3)] },
    });
    state = { ...state, currentPlayerIndex: 0 };
    state = applyAction(state, {
      type: "AGE_BOURBON",
      playerId: "p1",
      barrelId,
      cardId: "card_p1_cap1_3",
    });
    // p2 had no deck and was auto-marked out for the round at draw time —
    // p1's PASS_TURN is enough to wrap the round.
    state = applyAction(state, { type: "PASS_TURN", playerId: "p1" });
    expect(state.phase).toBe("demand");
    expect(state.round).toBe(3);
    expect(state.allBarrels[0]!.agedThisRound).toBe(false);
  });
});
