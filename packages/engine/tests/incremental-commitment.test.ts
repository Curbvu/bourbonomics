/**
 * v2.5 Incremental Mash Commitment — tests covering the new lifecycle:
 *   - Start a barrel partial; phase = "construction".
 *   - Construction barrels are skipped during the Age Phase.
 *   - Completion in round N → first ages in round N+1.
 *   - v2.7: a barrel accepts multiple commits in the same turn.
 *   - Mash bill attachable at start or later, single attach only.
 *   - A barrel cannot complete without an attached mash bill.
 *   - Wheated Baron's discount applies to the cumulative committed pile.
 *   - End-to-end integration: build a four-grain bill incrementally
 *     across multiple rounds and sell it.
 */

import { describe, it, expect } from "vitest";
import { applyAction } from "../src/engine.js";
import { makeCapitalCard, makeMashBill, makeResourceCard } from "../src/cards.js";
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

  it("a construction barrel cannot be aged (recipe must complete first)", () => {
    let state = makeTestGame();
    const mbId = state.allBarrels.find((b) => b.ownerId === "p1" && b.phase === "ready")!.attachedMashBill.id;
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [cask("p1", 0), corn("p1", 1), cap("p1", 2)]);
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      slotId: slotForBill(state, "p1", mbId),
      cardIds: ["card_p1_cask_0", "card_p1_corn_1"],
    });
    const barrelId = state.allBarrels[0]!.id;
    expect(state.allBarrels[0]!.phase).toBe("construction");
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

describe("incremental commitment — Specialty Cask upgrade (v3.1)", () => {
  // Bills with `minSpecialty: { cask: 1 }` previously trapped any
  // player who committed an ordinary cask first — the universal
  // "exactly 1 cask" rule rejected the follow-up Specialty cask, and
  // the barrel was permanently stuck. The upgrade swap unsticks it.
  const specialtyCaskBill = makeMashBill(
    {
      defId: "specialty_cask_test",
      name: "Test Specialty-Cask Bill",
      ageBands: [2],
      demandBands: [2],
      rewardGrid: [[3]],
      recipe: { minSpecialty: { cask: 1 } },
    },
    77,
  );

  function specialtyCask(label: string, i: number) {
    return {
      ...cask(label, i),
      id: `card_${label}_specialty_cask_${i}`,
      cardDefId: "superior_cask",
      specialty: true,
      premium: true,
    };
  }

  it("swaps an existing ordinary cask for an incoming Specialty cask", () => {
    let state = makeTestGame({
      startingMashBills: [[specialtyCaskBill], []],
      bourbonDeck: [],
    });
    state = advanceToActionPhase(state);
    const slotId = slotForBill(state, "p1", specialtyCaskBill.id);

    // Step 1: commit ordinary cask + corn + rye. Recipe count is met
    // but Specialty gate is NOT — barrel sits in construction.
    state = giveHand(state, "p1", [
      cask("p1", 0),
      corn("p1", 1),
      rye("p1", 2),
    ]);
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      slotId,
      cardIds: ["card_p1_cask_0", "card_p1_corn_1", "card_p1_rye_2"],
    });
    let barrel = state.allBarrels.find((b) => b.slotId === slotId)!;
    expect(barrel.phase).toBe("construction");
    expect(barrel.productionCards.map((c) => c.cardDefId).sort()).toEqual(
      ["cask", "corn", "rye"],
    );

    // Step 2: the trap. Without the upgrade swap, this would throw —
    // caskSources would go to 2 and validation rejects. With the
    // upgrade: ordinary cask returns to discard, Specialty cask takes
    // its place, recipe satisfied, barrel flips to aging.
    state = giveHand(state, "p1", [specialtyCask("p1", 5)]);
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      slotId,
      cardIds: ["card_p1_specialty_cask_5"],
    });

    barrel = state.allBarrels.find((b) => b.slotId === slotId)!;
    expect(barrel.phase).toBe("aging");
    expect(barrel.productionCards.map((c) => c.cardDefId).sort()).toEqual(
      ["corn", "rye", "superior_cask"],
    );

    // The displaced ordinary cask returned to the player's discard —
    // not lost, not stranded on the barrel.
    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.discard.map((c) => c.cardDefId)).toContain("cask");
  });

  it("rejects a second ordinary cask (no swap allowed without Specialty)", () => {
    let state = makeTestGame();
    const mbId = state.allBarrels.find(
      (b) => b.ownerId === "p1" && b.phase === "ready",
    )!.attachedMashBill.id;
    state = advanceToActionPhase(state);
    const slotId = slotForBill(state, "p1", mbId);

    state = giveHand(state, "p1", [cask("p1", 0), corn("p1", 1), rye("p1", 2)]);
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      slotId,
      cardIds: ["card_p1_cask_0", "card_p1_corn_1", "card_p1_rye_2"],
    });
    // The above already completed the recipe (Common bill), so the
    // barrel is aging — make it construction again for the test by
    // resetting to a fresh game where the bill needs more.
    let s2 = makeTestGame({
      startingMashBills: [[specialtyCaskBill], []],
      bourbonDeck: [],
    });
    s2 = advanceToActionPhase(s2);
    const slotId2 = slotForBill(s2, "p1", specialtyCaskBill.id);
    s2 = giveHand(s2, "p1", [cask("p1", 0), corn("p1", 1), rye("p1", 2)]);
    s2 = applyAction(s2, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      slotId: slotId2,
      cardIds: ["card_p1_cask_0", "card_p1_corn_1", "card_p1_rye_2"],
    });

    // Now try to add a SECOND ordinary cask — should still reject
    // (only Specialty triggers the swap exception).
    s2 = giveHand(s2, "p1", [cask("p1", 9)]);
    expect(() =>
      applyAction(s2, {
        type: "MAKE_BOURBON",
        playerId: "p1",
        slotId: slotId2,
        cardIds: ["card_p1_cask_9"],
      }),
    ).toThrow(/cask/);
  });
});

// v3 roster rebuild: the Wheated Baron distillery (and its
// "minWheat - 1 on wheated bills" discount) was retired. No v3
// distillery currently mods recipe minimums at MAKE_BOURBON time.
// Restore coverage when an equivalent ability lands.

describe("incremental commitment — full lifecycle integration", () => {
  it("a four-grain barrel built across rounds sells for its grid reward", () => {
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

    // Sell the barrel. Demand rolled up to 6 across the setup
    // rounds, so the grid lookup reads age=2 / demand=6 → 3.
    // v2.7.1: seed a spendable card for the sell-action cost; the
    // earlier age action emptied the hand.
    state = giveHand(state, "p1", [cap("p1", 99)]);
    const repBefore = state.players.find((p) => p.id === "p1")!.reputation;
    state = applyAction(state, {
      type: "SELL_BOURBON",
      playerId: "p1",
      barrelId,
      reputationSplit: 3,
      cardDrawSplit: 0,    });
    const repAfter = state.players.find((p) => p.id === "p1")!.reputation;
    expect(repAfter - repBefore).toBe(3);
  });
});
