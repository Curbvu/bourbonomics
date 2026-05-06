/**
 * v2.5 Incremental Mash Commitment — tests covering the new lifecycle:
 *   - Start a barrel partial; phase = "construction".
 *   - Construction barrels are skipped during the Age Phase.
 *   - Completion in round N → first ages in round N+1.
 *   - Composition buffs (4-grain) read the cumulative pile assembled
 *     across multiple rounds.
 *   - Once-per-turn-per-barrel commit limit.
 *   - Mash bill attachable at start or later, single attach only.
 *   - A barrel cannot complete without an attached mash bill.
 *   - Wheated Baron's discount applies to the cumulative committed pile.
 *   - ABANDON_BARREL returns committed cards to the player's discard.
 *   - End-to-end integration: build a four-grain bill incrementally
 *     across multiple rounds and sell it.
 */

import { describe, it, expect } from "vitest";
import { applyAction } from "../src/engine.js";
import { makeCapitalCard, makeMashBill, makeResourceCard } from "../src/cards.js";
import { defaultDistilleryPool } from "../src/distilleries.js";
import {
  advanceToActionPhase,
  advanceToNextRound,
  firstEmptySlot,
  giveHand,
  makeTestGame,
} from "./helpers.js";

const cask = (label: string, i = 0) => makeResourceCard("cask", label, i);
const corn = (label: string, i = 0) => makeResourceCard("corn", label, i);
const rye = (label: string, i = 0) => makeResourceCard("rye", label, i);
const barley = (label: string, i = 0) => makeResourceCard("barley", label, i);
const wheat = (label: string, i = 0) => makeResourceCard("wheat", label, i);
const cap = (label: string, i = 0, v = 1) => makeCapitalCard(label, i, v);

const fourGrainBill = makeMashBill(
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

describe("incremental commitment — basics", () => {
  it("a partial Start Barrel leaves the barrel in construction phase", () => {
    let state = makeTestGame();
    const mbId = state.players.find((p) => p.id === "p1")!.mashBills[0]!.id;
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [cask("p1", 0), corn("p1", 1)]);
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      slotId: firstEmptySlot(state, "p1"),
      cardIds: ["card_p1_cask_0", "card_p1_corn_1"],
      mashBillId: mbId,
    });
    expect(state.allBarrels).toHaveLength(1);
    expect(state.allBarrels[0]!.phase).toBe("construction");
    expect(state.allBarrels[0]!.completedInRound).toBeNull();
    expect(state.allBarrels[0]!.attachedMashBill?.id).toBe(mbId);
    expect(state.allBarrels[0]!.productionCards).toHaveLength(2);
  });

  it("a construction barrel cannot be aged", () => {
    let state = makeTestGame();
    const mbId = state.players.find((p) => p.id === "p1")!.mashBills[0]!.id;
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [cask("p1", 0), corn("p1", 1), cap("p1", 2)]);
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      slotId: firstEmptySlot(state, "p1"),
      cardIds: ["card_p1_cask_0", "card_p1_corn_1"],
      mashBillId: mbId,
    });
    const barrelId = state.allBarrels[0]!.id;
    expect(() =>
      applyAction(state, {
        type: "AGE_BOURBON",
        playerId: "p1",
        barrelId,
        cardId: "card_p1_cap1_2",
      }),
    ).toThrow(/under construction/);
  });

  it("a barrel completed in round N first ages in round N+1", () => {
    let state = makeTestGame();
    const mbId = state.players.find((p) => p.id === "p1")!.mashBills[0]!.id;
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [cask("p1", 0), corn("p1", 1), rye("p1", 2)]);
    state = giveHand(state, "p2", []);
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      slotId: firstEmptySlot(state, "p1"),
      cardIds: ["card_p1_cask_0", "card_p1_corn_1", "card_p1_rye_2"],
      mashBillId: mbId,
    });
    const barrel = state.allBarrels[0]!;
    expect(barrel.phase).toBe("aging");
    expect(barrel.completedInRound).toBe(1);

    // Same round: aging is rejected.
    state = giveHand(state, "p1", [cap("p1", 9)]);
    expect(() =>
      applyAction(state, {
        type: "AGE_BOURBON",
        playerId: "p1",
        barrelId: barrel.id,
        cardId: "card_p1_cap1_9",
      }),
    ).toThrow(/first ages next round/);

    // Next round: aging now succeeds.
    state = advanceToNextRound(state, {
      seedDecks: { p1: [cap("p1", 9)] },
    });
    state = { ...state, currentPlayerIndex: 0 };
    state = applyAction(state, {
      type: "AGE_BOURBON",
      playerId: "p1",
      barrelId: barrel.id,
      cardId: "card_p1_cap1_9",
    });
    expect(state.allBarrels[0]!.age).toBe(1);
  });

  it("once-per-turn-per-barrel commit limit holds", () => {
    let state = makeTestGame();
    const mbId = state.players.find((p) => p.id === "p1")!.mashBills[0]!.id;
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [
      cask("p1", 0),
      corn("p1", 1),
      cap("p1", 2),
      cap("p1", 3),
    ]);
    const slotId = firstEmptySlot(state, "p1");
    // First commit — opens the barrel.
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      slotId,
      cardIds: ["card_p1_cask_0", "card_p1_corn_1"],
      mashBillId: mbId,
    });
    // Second commit on the same turn — must reject.
    expect(() =>
      applyAction(state, {
        type: "MAKE_BOURBON",
        playerId: "p1",
        slotId,
        cardIds: ["card_p1_cap1_2"],
      }),
    ).toThrow(/already committed/);
  });
});

describe("incremental commitment — mash bill attachment", () => {
  it("can be attached at Start with no other cards", () => {
    let state = makeTestGame();
    const mbId = state.players.find((p) => p.id === "p1")!.mashBills[0]!.id;
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", []);
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      slotId: firstEmptySlot(state, "p1"),
      cardIds: [],
      mashBillId: mbId,
    });
    const barrel = state.allBarrels[0]!;
    expect(barrel.phase).toBe("construction");
    expect(barrel.attachedMashBill?.id).toBe(mbId);
    expect(barrel.productionCards).toHaveLength(0);
  });

  it("can be attached on a later commit if not attached at start", () => {
    let state = makeTestGame();
    const mbId = state.players.find((p) => p.id === "p1")!.mashBills[0]!.id;
    state = advanceToActionPhase(state);
    // Open with cards, no bill.
    state = giveHand(state, "p1", [cask("p1", 0)]);
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      slotId: firstEmptySlot(state, "p1"),
      cardIds: ["card_p1_cask_0"],
    });
    const barrel = state.allBarrels[0]!;
    expect(barrel.attachedMashBill).toBeNull();

    // Next round (per-turn gate clears after PASS_TURN), attach the bill.
    state = advanceToNextRound(state, {
      seedDecks: { p1: [corn("p1", 1)] },
    });
    state = { ...state, currentPlayerIndex: 0 };
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      slotId: barrel.slotId,
      cardIds: [],
      mashBillId: mbId,
    });
    expect(state.allBarrels[0]!.attachedMashBill?.id).toBe(mbId);
  });

  it("cannot re-attach a different mash bill once one is attached", () => {
    let state = makeTestGame();
    const p1Bills = state.players.find((p) => p.id === "p1")!.mashBills;
    const billA = p1Bills[0]!.id;
    const billB = p1Bills[1]!.id;
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [cask("p1", 0)]);
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      slotId: firstEmptySlot(state, "p1"),
      cardIds: ["card_p1_cask_0"],
      mashBillId: billA,
    });
    const slotId = state.allBarrels[0]!.slotId;
    state = advanceToNextRound(state, {
      seedDecks: { p1: [corn("p1", 1)] },
    });
    state = { ...state, currentPlayerIndex: 0 };
    expect(() =>
      applyAction(state, {
        type: "MAKE_BOURBON",
        playerId: "p1",
        slotId,
        cardIds: [],
        mashBillId: billB,
      }),
    ).toThrow(/already has a mash bill/);
  });

  it("a barrel cannot complete without a bill, even if the universal pile is full", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [cask("p1", 0), corn("p1", 1), rye("p1", 2)]);
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      slotId: firstEmptySlot(state, "p1"),
      cardIds: ["card_p1_cask_0", "card_p1_corn_1", "card_p1_rye_2"],
    });
    expect(state.allBarrels[0]!.phase).toBe("construction");
    expect(state.allBarrels[0]!.completedInRound).toBeNull();
  });
});

describe("incremental commitment — Wheated Baron discount on cumulative pile", () => {
  it("applies to the cumulative committed pile, not a single commit", () => {
    const wheatedBill = makeMashBill(
      {
        defId: "wheated_test",
        name: "Test Wheated",
        ageBands: [2, 4, 6],
        demandBands: [2, 4, 6],
        rewardGrid: [
          [1, 2, 3],
          [2, 3, 4],
          [3, 4, 5],
        ],
        // Recipe wants 2 wheat — Wheated Baron's discount knocks 1 off,
        // so the player only needs 1 wheat in the cumulative pile.
        recipe: { minWheat: 2, maxRye: 0 },
      },
      77,
    );
    const baron = defaultDistilleryPool().find((d) => d.bonus === "wheated_baron")!;
    const vanilla = defaultDistilleryPool().find((d) => d.bonus === "vanilla")!;
    let state = makeTestGame({
      startingDistilleries: [
        { ...baron, id: "dist_test_baron_0" },
        { ...vanilla, id: "dist_test_vanilla_1" },
      ],
      startingMashBills: [[wheatedBill], []],
      bourbonDeck: [],
    });
    state = advanceToActionPhase(state);

    // Round 1: open with cask + corn (no wheat yet) — should NOT complete.
    state = giveHand(state, "p1", [cask("p1", 0), corn("p1", 1)]);
    state = giveHand(state, "p2", []);
    const openSlot = firstEmptySlot(state, "p1");
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      slotId: openSlot,
      cardIds: ["card_p1_cask_0", "card_p1_corn_1"],
      mashBillId: wheatedBill.id,
    });
    let testBarrel = state.allBarrels.find((b) => b.slotId === openSlot)!;
    expect(testBarrel.phase).toBe("construction");

    // Round 2: commit a single wheat — Baron's discount should let
    // the cumulative pile (1 wheat) satisfy the recipe (min 2 - 1 = 1).
    state = advanceToNextRound(state, {
      seedDecks: { p1: [wheat("p1", 2)] },
    });
    state = { ...state, currentPlayerIndex: 0 };
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      slotId: openSlot,
      cardIds: ["card_p1_wheat_2"],
    });
    testBarrel = state.allBarrels.find((b) => b.slotId === openSlot)!;
    expect(testBarrel.phase).toBe("aging");
    expect(testBarrel.completedInRound).toBe(2);
  });
});

describe("incremental commitment — ABANDON_BARREL", () => {
  it("returns committed cards to the player's discard and frees the slot", () => {
    let state = makeTestGame();
    const mbId = state.players.find((p) => p.id === "p1")!.mashBills[0]!.id;
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [cask("p1", 0), corn("p1", 1)]);
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      slotId: firstEmptySlot(state, "p1"),
      cardIds: ["card_p1_cask_0", "card_p1_corn_1"],
      mashBillId: mbId,
    });
    const barrelId = state.allBarrels[0]!.id;
    state = applyAction(state, {
      type: "ABANDON_BARREL",
      playerId: "p1",
      barrelId,
    });
    expect(state.allBarrels).toHaveLength(0);
    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.discard.map((c) => c.id).sort()).toEqual(
      ["card_p1_cask_0", "card_p1_corn_1"].sort(),
    );
  });

  it("rejects abandoning an aging-phase barrel", () => {
    let state = makeTestGame();
    const mbId = state.players.find((p) => p.id === "p1")!.mashBills[0]!.id;
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [cask("p1", 0), corn("p1", 1), rye("p1", 2)]);
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      slotId: firstEmptySlot(state, "p1"),
      cardIds: ["card_p1_cask_0", "card_p1_corn_1", "card_p1_rye_2"],
      mashBillId: mbId,
    });
    expect(state.allBarrels[0]!.phase).toBe("aging");
    expect(() =>
      applyAction(state, {
        type: "ABANDON_BARREL",
        playerId: "p1",
        barrelId: state.allBarrels[0]!.id,
      }),
    ).toThrow(/under-construction/);
  });
});

describe("incremental commitment — full lifecycle integration", () => {
  it("a four-grain barrel built across rounds sells with the all-grains buff", () => {
    let state = makeTestGame({
      startingMashBills: [[fourGrainBill], []],
      bourbonDeck: [],
      startingDemand: 5,
    });
    state = advanceToActionPhase(state);

    // Round 1: open with cask + corn + rye + barley. Missing wheat —
    // barrel stays in construction.
    state = giveHand(state, "p1", [
      cask("p1", 0),
      corn("p1", 1),
      rye("p1", 2),
      barley("p1", 3),
    ]);
    state = giveHand(state, "p2", []);
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      slotId: firstEmptySlot(state, "p1"),
      cardIds: [
        "card_p1_cask_0",
        "card_p1_corn_1",
        "card_p1_rye_2",
        "card_p1_barley_3",
      ],
      mashBillId: fourGrainBill.id,
    });
    const barrelId = state.allBarrels[0]!.id;
    expect(state.allBarrels[0]!.phase).toBe("construction");

    // Round 2: commit wheat to complete.
    state = advanceToNextRound(state, {
      seedDecks: { p1: [wheat("p1", 4)] },
    });
    state = { ...state, currentPlayerIndex: 0 };
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      slotId: state.allBarrels[0]!.slotId,
      cardIds: ["card_p1_wheat_4"],
    });
    expect(state.allBarrels[0]!.phase).toBe("aging");
    expect(state.allBarrels[0]!.completedInRound).toBe(2);

    // Rounds 3-4: age twice so the barrel reaches age 2 (sale-eligible).
    state = advanceToNextRound(state, {
      seedDecks: { p1: [cap("p1", 5)] },
    });
    state = { ...state, currentPlayerIndex: 0 };
    state = applyAction(state, {
      type: "AGE_BOURBON",
      playerId: "p1",
      barrelId,
      cardId: "card_p1_cap1_5",
    });
    state = advanceToNextRound(state, {
      seedDecks: { p1: [cap("p1", 6)] },
    });
    state = { ...state, currentPlayerIndex: 0 };
    state = applyAction(state, {
      type: "AGE_BOURBON",
      playerId: "p1",
      barrelId,
      cardId: "card_p1_cap1_6",
    });
    expect(state.allBarrels[0]!.age).toBe(2);

    // Sell the barrel and confirm the cumulative pile fires the
    // four-grain composition buff. Demand rolled up to 6 across the
    // setup rounds, so the grid lookup reads age=2 / demand=6 → 3.
    // Splits MUST sum to the grid reward (3); the +2 all-grains
    // bonus is added on top automatically.
    const repBefore = state.players.find((p) => p.id === "p1")!.reputation;
    state = applyAction(state, {
      type: "SELL_BOURBON",
      playerId: "p1",
      barrelId,
      reputationSplit: 3,
      cardDrawSplit: 0,
    });
    const repAfter = state.players.find((p) => p.id === "p1")!.reputation;
    // Grid 3 (rep split) + all-grains buff (+2) = 5.
    expect(repAfter - repBefore).toBe(3 + 2);
  });
});
