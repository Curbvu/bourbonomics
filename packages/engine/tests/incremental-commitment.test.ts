/**
 * v2.5 Incremental Mash Commitment — tests covering the new lifecycle:
 *   - Start a barrel partial; phase = "construction".
 *   - Construction barrels are skipped during the Age Phase.
 *   - Completion in round N → first ages in round N+1.
 *   - Composition buffs (4-grain) read the cumulative pile assembled
 *     across multiple rounds.
 *   - v2.7: a barrel accepts multiple commits in the same turn.
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
  slotForBill,
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
    const mbId = state.allBarrels.find((b) => b.ownerId === "p1" && b.phase === "ready")!.attachedMashBill.id;
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [cask("p1", 0), corn("p1", 1)]);
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      slotId: slotForBill(state, "p1", mbId),
      cardIds: ["card_p1_cask_0", "card_p1_corn_1"],    });
    expect(state.allBarrels.filter((b) => b.phase !== "ready")).toHaveLength(1);
    expect(state.allBarrels[0]!.phase).toBe("construction");
    expect(state.allBarrels[0]!.completedInRound).toBeNull();
    expect(state.allBarrels[0]!.attachedMashBill?.id).toBe(mbId);
    expect(state.allBarrels[0]!.productionCards).toHaveLength(2);
  });

  it("a construction barrel cannot be aged", () => {
    let state = makeTestGame();
    const mbId = state.allBarrels.find((b) => b.ownerId === "p1" && b.phase === "ready")!.attachedMashBill.id;
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [cask("p1", 0), corn("p1", 1), cap("p1", 2)]);
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      slotId: slotForBill(state, "p1", mbId),
      cardIds: ["card_p1_cask_0", "card_p1_corn_1"],    });
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
    const mbId = state.allBarrels.find((b) => b.ownerId === "p1" && b.phase === "ready")!.attachedMashBill.id;
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [cask("p1", 0), corn("p1", 1), rye("p1", 2)]);
    state = giveHand(state, "p2", []);
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      slotId: slotForBill(state, "p1", mbId),
      cardIds: ["card_p1_cask_0", "card_p1_corn_1", "card_p1_rye_2"],    });
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

  it("v2.7: a player may commit to the same barrel multiple times per turn", () => {
    let state = makeTestGame();
    const mbId = state.allBarrels.find((b) => b.ownerId === "p1" && b.phase === "ready")!.attachedMashBill.id;
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [
      cask("p1", 0),
      corn("p1", 1),
      cap("p1", 2),
      rye("p1", 3),
    ]);
    const slotId = slotForBill(state, "p1", mbId);
    // First commit — opens the barrel with cask + corn (no rye yet).
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      slotId,
      cardIds: ["card_p1_cask_0", "card_p1_corn_1"],
    });
    expect(state.allBarrels.find((b) => b.slotId === slotId)!.phase).toBe(
      "construction",
    );

    // Second commit on the same turn — succeeds. The barrel auto-
    // transitions to aging the moment its cumulative pile satisfies
    // the recipe.
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      slotId,
      cardIds: ["card_p1_rye_3"],
    });
    const after = state.allBarrels.find((b) => b.slotId === slotId)!;
    expect(after.productionCards).toHaveLength(3);
    expect(after.phase).toBe("aging");
    expect(after.completedInRound).toBe(1);
  });
});

// v2.6: the v2.5 "mash bill attachment" describe block was deleted —
// bills are now bound to slots from the moment they are drawn, so
// attach-at-start / attach-later / re-attach-rejection are not testable
// behaviors. Their invariants are structurally guaranteed by the model.

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
    const openSlot = slotForBill(state, "p1", wheatedBill.id);
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      slotId: openSlot,
      cardIds: ["card_p1_cask_0", "card_p1_corn_1"],    });
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
    const mbId = state.allBarrels.find((b) => b.ownerId === "p1" && b.phase === "ready")!.attachedMashBill.id;
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [cask("p1", 0), corn("p1", 1)]);
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      slotId: slotForBill(state, "p1", mbId),
      cardIds: ["card_p1_cask_0", "card_p1_corn_1"],    });
    const barrelId = state.allBarrels[0]!.id;
    state = applyAction(state, {
      type: "ABANDON_BARREL",
      playerId: "p1",
      barrelId,
    });
    expect(state.allBarrels.filter((b) => b.phase !== "ready")).toHaveLength(0);
    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.discard.map((c) => c.id).sort()).toEqual(
      ["card_p1_cask_0", "card_p1_corn_1"].sort(),
    );
  });

  it("rejects abandoning an aging-phase barrel", () => {
    let state = makeTestGame();
    const mbId = state.allBarrels.find((b) => b.ownerId === "p1" && b.phase === "ready")!.attachedMashBill.id;
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [cask("p1", 0), corn("p1", 1), rye("p1", 2)]);
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      slotId: slotForBill(state, "p1", mbId),
      cardIds: ["card_p1_cask_0", "card_p1_corn_1", "card_p1_rye_2"],    });
    expect(state.allBarrels[0]!.phase).toBe("aging");
    expect(() =>
      applyAction(state, {
        type: "ABANDON_BARREL",
        playerId: "p1",
        barrelId: state.allBarrels[0]!.id,
      }),
    ).toThrow(/aging barrels cannot/);
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
      slotId: slotForBill(state, "p1", fourGrainBill.id),
      cardIds: [
        "card_p1_cask_0",
        "card_p1_corn_1",
        "card_p1_rye_2",
        "card_p1_barley_3",
      ],    });
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
