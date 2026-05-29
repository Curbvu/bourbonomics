import { describe, it, expect } from "vitest";
import { applyAction } from "../src/engine.js";
import { makeMashBill, makeResourceCard } from "../src/cards.js";
import type { OperationsCard, OperationsCardDefId } from "../src/types.js";
import { advanceToActionPhase, giveHand, makeTestGame, placeBarrel } from "./helpers.js";

const bill = () =>
  makeMashBill(
    {
      defId: "ops_test",
      name: "Ops Test",
      ageBands: [2, 4, 6],
      demandBands: [2, 4, 6],
      rewardGrid: [
        [1, 2, 3],
        [2, 4, 5],
        [3, 5, 6],
      ],
    },
    100,
  );

/**
 * v2.6 helper: seed a "ready" slot with the given bill so a test that
 * needs to MAKE_BOURBON against a specific recipe has somewhere to
 * commit cards.
 */
function placeReadySlot(
  state: ReturnType<typeof makeTestGame>,
  ownerId: string,
  mashBill: ReturnType<typeof makeMashBill>,
): ReturnType<typeof makeTestGame> {
  const owner = state.players.find((p) => p.id === ownerId)!;
  const taken = new Set(state.allBarrels.filter((b) => b.ownerId === ownerId).map((b) => b.slotId));
  const free = owner.rickhouseSlots.find((s) => !taken.has(s.id));
  if (!free) throw new Error(`placeReadySlot: ${ownerId} has no open slot`);
  return {
    ...state,
    allBarrels: [
      ...state.allBarrels,
      {
        id: `barrel_test_ready_${state.allBarrels.length}`,
        ownerId,
        slotId: free.id,
        phase: "ready",
        completedInRound: null,
        attachedMashBill: mashBill,
        productionCardDefIds: [],
        productionCards: [],
        agingCards: [],
        age: 0,
        productionRound: state.round,
        agedThisRound: false,
        inspectedThisRound: false,
        skipNextRoundAging: false,
        extraAgesAvailable: 0,
        gridRepOffset: 0,
        demandBandOffset: 0,
      },
    ],
  };
}

function giveOpsCard(
  state: ReturnType<typeof makeTestGame>,
  playerId: string,
  defId: OperationsCardDefId,
  drawnInRound = 0,
) {
  const card: OperationsCard = {
    id: `ops_test_${defId}_${playerId}`,
    defId,
    name: defId,
    description: "test card",
    cost: 4,
    drawnInRound,
  };
  return {
    state: {
      ...state,
      players: state.players.map((p) =>
        p.id === playerId ? { ...p, operationsHand: [...p.operationsHand, card] } : p,
      ),
    },
    cardId: card.id,
  };
}

describe("PLAY_OPERATIONS_CARD — Market Manipulation", () => {
  it("nudges demand up by 1 (capped at 12)", () => {
    let state = makeTestGame({ startingDemand: 5 });
    state = advanceToActionPhase(state, [1, 1]);
    const { state: s, cardId } = giveOpsCard(state, "p1", "market_manipulation");
    state = s;
    state = applyAction(state, {
      type: "PLAY_OPERATIONS_CARD",
      playerId: "p1",
      cardId,
      defId: "market_manipulation",
      direction: "up",
    });
    expect(state.demand).toBe(6);
    // Turn does NOT end — currentPlayerIndex stays on p1.
    expect(state.currentPlayerIndex).toBe(0);
  });

  it("nudges demand down by 1 (floored at 0)", () => {
    let state = makeTestGame({ startingDemand: 0 });
    state = advanceToActionPhase(state, [1, 1]);
    state = { ...state, demand: 0 };
    const { state: s, cardId } = giveOpsCard(state, "p1", "market_manipulation");
    state = applyAction(s, {
      type: "PLAY_OPERATIONS_CARD",
      playerId: "p1",
      cardId,
      defId: "market_manipulation",
      direction: "down",
    });
    expect(state.demand).toBe(0);
  });
});

describe("PLAY_OPERATIONS_CARD — Regulatory Inspection", () => {
  it("blocks aging on the targeted barrel", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state, [1, 1]);
    state = placeBarrel(state, "p1", bill(), 1);
    const { state: s, cardId } = giveOpsCard(state, "p1", "regulatory_inspection");
    state = applyAction(s, {
      type: "PLAY_OPERATIONS_CARD",
      playerId: "p1",
      cardId,
      defId: "regulatory_inspection",
      targetBarrelId: state.allBarrels.find((b) => b.phase === "aging")!.id,
    });
    expect(state.allBarrels.find((b) => b.phase === "aging")!.inspectedThisRound).toBe(true);
    state = giveHand(state, "p1", [makeResourceCard("corn", "p1", 0)]);
    expect(() =>
      applyAction(state, {
        type: "AGE_BOURBON",
        playerId: "p1",
        barrelId: state.allBarrels.find((b) => b.phase === "aging")!.id,
        cardId: "card_p1_corn_0",
      }),
    ).toThrow(/regulatory inspection/);
  });
});

describe("PLAY_OPERATIONS_CARD — Rushed Shipment", () => {
  it("allows aging the same barrel twice in one round", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state, [1, 1]);
    state = placeBarrel(state, "p1", bill(), 0);
    const barrelId = state.allBarrels.find((b) => b.phase === "aging")!.id;
    const { state: s, cardId } = giveOpsCard(state, "p1", "rushed_shipment");
    state = applyAction(s, {
      type: "PLAY_OPERATIONS_CARD",
      playerId: "p1",
      cardId,
      defId: "rushed_shipment",
      targetBarrelId: barrelId,
    });
    state = giveHand(state, "p1", [
      makeResourceCard("corn", "p1", 0),
      makeResourceCard("corn", "p1", 1),
    ]);
    state = applyAction(state, {
      type: "AGE_BOURBON",
      playerId: "p1",
      barrelId,
      cardId: "card_p1_corn_0",
    });
    state = applyAction(state, {
      type: "AGE_BOURBON",
      playerId: "p1",
      barrelId,
      cardId: "card_p1_corn_1",
    });
    expect(state.allBarrels.find((b) => b.phase === "aging")!.age).toBe(2);
  });
});

describe("PLAY_OPERATIONS_CARD — Demand Surge", () => {
  it("absorbs the demand drop on the next sale", () => {
    let state = makeTestGame({ startingDemand: 6 });
    state = advanceToActionPhase(state, [1, 1]);
    state = placeBarrel(state, "p1", bill(), 5);
    const { state: s, cardId } = giveOpsCard(state, "p1", "demand_surge");
    state = applyAction(s, {
      type: "PLAY_OPERATIONS_CARD",
      playerId: "p1",
      cardId,
      defId: "demand_surge",
    });
    expect(state.players.find((p) => p.id === "p1")!.demandSurgeActive).toBe(true);
    const before = state.demand;
    state = applyAction(state, {
      type: "SELL_BOURBON",
      playerId: "p1",
      barrelId: state.allBarrels.find((b) => b.phase === "aging")!.id,
    });
    expect(state.demand).toBe(before);
    expect(state.players.find((p) => p.id === "p1")!.demandSurgeActive).toBe(false);
  });
});

describe("Operations cards in the final round", () => {
  it("a card drawn this round cannot be played once finalRoundTriggered fires", () => {
    let state = makeTestGame({ startingDemand: 6 });
    state = advanceToActionPhase(state, [1, 1]);
    state = { ...state, finalRoundTriggered: true };
    const { state: s, cardId } = giveOpsCard(state, "p1", "market_manipulation", state.round);
    expect(() =>
      applyAction(s, {
        type: "PLAY_OPERATIONS_CARD",
        playerId: "p1",
        cardId,
        defId: "market_manipulation",
        direction: "up",
      }),
    ).toThrow(/final round/);
  });

  it("a card carried over from a prior round can still be played", () => {
    let state = makeTestGame({ startingDemand: 6 });
    state = advanceToActionPhase(state, [1, 1]);
    state = { ...state, finalRoundTriggered: true };
    const { state: s, cardId } = giveOpsCard(state, "p1", "market_manipulation", 0);
    const next = applyAction(s, {
      type: "PLAY_OPERATIONS_CARD",
      playerId: "p1",
      cardId,
      defId: "market_manipulation",
      direction: "up",
    });
    expect(next.demand).toBe(7);
  });
});

describe("PLAY_OPERATIONS_CARD — Bourbon Boom", () => {
  it("raises demand by 2, capped at 12", () => {
    let state = makeTestGame({ startingDemand: 11 });
    state = advanceToActionPhase(state, [1, 1]);
    const { state: s, cardId } = giveOpsCard(state, "p1", "bourbon_boom");
    state = applyAction(s, {
      type: "PLAY_OPERATIONS_CARD",
      playerId: "p1",
      cardId,
      defId: "bourbon_boom",
    });
    expect(state.demand).toBe(12);
  });
});

describe("PLAY_OPERATIONS_CARD — Glut", () => {
  it("drops demand by 2, floored at 0", () => {
    let state = makeTestGame({ startingDemand: 1 });
    state = advanceToActionPhase(state, [1, 1]);
    const { state: s, cardId } = giveOpsCard(state, "p1", "glut");
    state = applyAction(s, {
      type: "PLAY_OPERATIONS_CARD",
      playerId: "p1",
      cardId,
      defId: "glut",
    });
    expect(state.demand).toBe(0);
  });
});

describe("PLAY_OPERATIONS_CARD — Kentucky Connection", () => {
  it("draws 2 cards into the player's hand", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state, [1, 1]);
    const before = state.players.find((p) => p.id === "p1")!.hand.length;
    const { state: s, cardId } = giveOpsCard(state, "p1", "kentucky_connection");
    state = applyAction(s, {
      type: "PLAY_OPERATIONS_CARD",
      playerId: "p1",
      cardId,
      defId: "kentucky_connection",
    });
    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.hand.length).toBe(before + 2);
  });
});

describe("PLAY_OPERATIONS_CARD — Allocation", () => {
  it("v2.6: draws up to 2 mash bills from the deck into the player's open slots as 'ready' barrels", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state, [1, 1]);
    const p1Id = "p1";
    const beforeSlotted = state.allBarrels.filter((b) => b.ownerId === p1Id).length;
    const beforeDeck = state.bourbonDeck.length;
    const { state: s, cardId } = giveOpsCard(state, p1Id, "allocation");
    state = applyAction(s, {
      type: "PLAY_OPERATIONS_CARD",
      playerId: p1Id,
      cardId,
      defId: "allocation",
    });
    const afterSlotted = state.allBarrels.filter((b) => b.ownerId === p1Id).length;
    const drawn = afterSlotted - beforeSlotted;
    expect(drawn).toBeGreaterThan(0);
    expect(drawn).toBeLessThanOrEqual(2);
    expect(state.bourbonDeck.length).toBe(beforeDeck - drawn);
  });
});

describe("PLAY_OPERATIONS_CARD — Rating Boost", () => {
  it("grants +2 rep on the next sale", () => {
    let state = makeTestGame({ startingDemand: 5 });
    state = advanceToActionPhase(state, [1, 1]);
    state = placeBarrel(state, "p1", bill(), 4);
    const barrelId = state.allBarrels.find((b) => b.phase === "aging")!.id;
    const { state: s, cardId } = giveOpsCard(state, "p1", "rating_boost");
    state = applyAction(s, {
      type: "PLAY_OPERATIONS_CARD",
      playerId: "p1",
      cardId,
      defId: "rating_boost",
    });
    expect(state.players.find((p) => p.id === "p1")!.pendingRatingBoost).toBe(2);
    const beforeRep = state.players.find((p) => p.id === "p1")!.capital;
    state = applyAction(state, {
      type: "SELL_BOURBON",
      playerId: "p1",
      barrelId,
    });
    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.capital).toBe(beforeRep + 4 + 2);
    expect(p1.pendingRatingBoost).toBe(0);
  });
});

describe("PLAY_OPERATIONS_CARD — Wild Mash", () => {
  it("lets a cask substitute for a rye min on a 2-rye recipe", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state);
    const ryeHeavy = makeMashBill(
      {
        defId: "wild_mash_rye",
        name: "Wild Mash Rye Test",
        ageBands: [2, 4, 6],
        demandBands: [2, 4, 6],
        rewardGrid: [[1, 2, 3], [2, 4, 5], [3, 5, 6]],
        recipe: { minRye: 2 },
      },
      0,
    );
    state = placeReadySlot(state, "p1", ryeHeavy);
    const { state: s, cardId } = giveOpsCard(state, "p1", "wild_mash");
    state = applyAction(s, {
      type: "PLAY_OPERATIONS_CARD",
      playerId: "p1",
      cardId,
      defId: "wild_mash",
    });
    expect(state.players.find((p) => p.id === "p1")!.pendingWildMashToken).toBe(true);

    // Hand: 1 real cask + 1 real corn + 1 real rye + 1 extra cask (the
    // swap target). 2-rye recipe needs total grain 2 and ≥2 rye — with
    // 1 actual rye, the swap-as-grain cask fills the gap.
    state = giveHand(state, "p1", [
      makeResourceCard("cask", "p1", 0),
      makeResourceCard("corn", "p1", 1),
      makeResourceCard("rye", "p1", 2),
      makeResourceCard("cask", "p1", 3),
    ]);
    const readyBarrel = state.allBarrels.find(
      (b) => b.ownerId === "p1" && b.phase === "ready" && b.attachedMashBill.defId === "wild_mash_rye",
    )!;
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      slotId: readyBarrel.slotId,
      cardIds: ["card_p1_cask_0", "card_p1_corn_1", "card_p1_rye_2", "card_p1_cask_3"],
      wildMashSwap: { cardId: "card_p1_cask_3", treatAs: "grain" },
    });
    const barrelAfter = state.allBarrels.find((b) => b.slotId === readyBarrel.slotId)!;
    expect(barrelAfter.phase).toBe("aging");
    // Token consumed regardless of whether the swap fired.
    expect(state.players.find((p) => p.id === "p1")!.pendingWildMashToken).toBe(false);
  });

  it("clears the token on PASS_TURN even when no swap was used", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state, [1, 1]);
    const { state: s, cardId } = giveOpsCard(state, "p1", "wild_mash");
    state = applyAction(s, {
      type: "PLAY_OPERATIONS_CARD",
      playerId: "p1",
      cardId,
      defId: "wild_mash",
    });
    expect(state.players.find((p) => p.id === "p1")!.pendingWildMashToken).toBe(true);
    state = applyAction(state, { type: "PASS_TURN", playerId: "p1" });
    expect(state.players.find((p) => p.id === "p1")!.pendingWildMashToken).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────
// v3.6 Aggression axis — five simple attack cards.
// ─────────────────────────────────────────────────────────────────────

describe("PLAY_OPERATIONS_CARD — Slow Pour", () => {
  it("queues skipNextRoundAging on a target aging barrel", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state, [1, 1]);
    state = placeBarrel(state, "p2", bill(), 1);
    // Pick the barrel I just placed (the latest one for p2 that's aging).
    const target = state.allBarrels
      .filter((b) => b.ownerId === "p2" && b.phase === "aging")
      .at(-1)!;
    const { state: s, cardId } = giveOpsCard(state, "p1", "slow_pour");
    state = applyAction(s, {
      type: "PLAY_OPERATIONS_CARD",
      playerId: "p1",
      cardId,
      defId: "slow_pour",
      targetBarrelId: target.id,
    });
    const t = state.allBarrels.find((b) => b.id === target.id)!;
    expect(t.skipNextRoundAging).toBe(true);
    // ROUND_CLEANUP promotes skipNextRoundAging → inspectedThisRound.
    expect(t.inspectedThisRound).toBe(false);
  });
});

describe("PLAY_OPERATIONS_CARD — Spoiled Batch", () => {
  it("discards one random card from the target's hand", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state, [1, 1]);
    state = giveHand(state, "p2", [
      makeResourceCard("corn", "p2", 1),
      makeResourceCard("rye", "p2", 2),
      makeResourceCard("cask", "p2", 3),
    ]);
    const before = state.players.find((p) => p.id === "p2")!.hand.length;
    const beforeDiscard = state.players.find((p) => p.id === "p2")!.discard.length;
    const { state: s, cardId } = giveOpsCard(state, "p1", "spoiled_batch");
    state = applyAction(s, {
      type: "PLAY_OPERATIONS_CARD",
      playerId: "p1",
      cardId,
      defId: "spoiled_batch",
      targetPlayerId: "p2",
    });
    const p2 = state.players.find((p) => p.id === "p2")!;
    expect(p2.hand.length).toBe(before - 1);
    expect(p2.discard.length).toBe(beforeDiscard + 1);
  });

  it("rejects when target hand is empty", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state, [1, 1]);
    state = giveHand(state, "p2", []);
    const { state: s, cardId } = giveOpsCard(state, "p1", "spoiled_batch");
    expect(() =>
      applyAction(s, {
        type: "PLAY_OPERATIONS_CARD",
        playerId: "p1",
        cardId,
        defId: "spoiled_batch",
        targetPlayerId: "p2",
      }),
    ).toThrow(/hand is empty/);
  });
});

describe("PLAY_OPERATIONS_CARD — Audit", () => {
  it("discards the chosen card from the target's hand", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state, [1, 1]);
    const keepCard = makeResourceCard("corn", "p2", 1);
    const targetCard = makeResourceCard("rye", "p2", 2);
    state = giveHand(state, "p2", [keepCard, targetCard]);
    const { state: s, cardId } = giveOpsCard(state, "p1", "audit");
    state = applyAction(s, {
      type: "PLAY_OPERATIONS_CARD",
      playerId: "p1",
      cardId,
      defId: "audit",
      targetPlayerId: "p2",
      targetCardId: targetCard.id,
    });
    const p2 = state.players.find((p) => p.id === "p2")!;
    expect(p2.hand.find((c) => c.id === targetCard.id)).toBeUndefined();
    expect(p2.hand.find((c) => c.id === keepCard.id)).toBeDefined();
    expect(p2.discard.find((c) => c.id === targetCard.id)).toBeDefined();
  });
});

describe("PLAY_OPERATIONS_CARD — Counterfeit Bottles", () => {
  it("queues a one-shot demand penalty on the target's next sale", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state, [1, 1]);
    const { state: s, cardId } = giveOpsCard(state, "p1", "counterfeit_bottles");
    state = applyAction(s, {
      type: "PLAY_OPERATIONS_CARD",
      playerId: "p1",
      cardId,
      defId: "counterfeit_bottles",
      targetPlayerId: "p2",
    });
    expect(state.players.find((p) => p.id === "p2")!.nextSaleDemandPenalty).toBe(2);
  });

  it("stacks numerically — two Counterfeits = penalty of 4", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state, [1, 1]);
    const { state: s1, cardId: id1 } = giveOpsCard(state, "p1", "counterfeit_bottles", 1);
    state = applyAction(s1, {
      type: "PLAY_OPERATIONS_CARD",
      playerId: "p1",
      cardId: id1,
      defId: "counterfeit_bottles",
      targetPlayerId: "p2",
    });
    const { state: s2, cardId: id2 } = giveOpsCard(state, "p1", "counterfeit_bottles", 2);
    state = applyAction(s2, {
      type: "PLAY_OPERATIONS_CARD",
      playerId: "p1",
      cardId: id2,
      defId: "counterfeit_bottles",
      targetPlayerId: "p2",
    });
    expect(state.players.find((p) => p.id === "p2")!.nextSaleDemandPenalty).toBe(4);
  });
});

describe("PLAY_OPERATIONS_CARD — Federal Inspector", () => {
  it("docks 2 capital and discards the chosen card", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state, [1, 1]);
    const fiKeep = makeResourceCard("corn", "p2", 1);
    const fiTarget = makeResourceCard("rye", "p2", 2);
    state = giveHand(state, "p2", [fiKeep, fiTarget]);
    // Seed capital so we can observe the deduction.
    state = {
      ...state,
      players: state.players.map((p) =>
        p.id === "p2" ? { ...p, capital: 5 } : p,
      ),
    };
    const { state: s, cardId } = giveOpsCard(state, "p1", "federal_inspector");
    state = applyAction(s, {
      type: "PLAY_OPERATIONS_CARD",
      playerId: "p1",
      cardId,
      defId: "federal_inspector",
      targetPlayerId: "p2",
      targetCardId: fiTarget.id,
    });
    const p2 = state.players.find((p) => p.id === "p2")!;
    expect(p2.capital).toBe(3);
    expect(p2.hand.find((c) => c.id === fiTarget.id)).toBeUndefined();
    expect(p2.discard.find((c) => c.id === fiTarget.id)).toBeDefined();
  });

  it("floors capital at 0 when target has < 2 capital", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state, [1, 1]);
    const fi2Target = makeResourceCard("rye", "p2", 1);
    state = giveHand(state, "p2", [fi2Target]);
    state = {
      ...state,
      players: state.players.map((p) =>
        p.id === "p2" ? { ...p, capital: 1 } : p,
      ),
    };
    const { state: s, cardId } = giveOpsCard(state, "p1", "federal_inspector");
    state = applyAction(s, {
      type: "PLAY_OPERATIONS_CARD",
      playerId: "p1",
      cardId,
      defId: "federal_inspector",
      targetPlayerId: "p2",
      targetCardId: fi2Target.id,
    });
    expect(state.players.find((p) => p.id === "p2")!.capital).toBe(0);
  });
});

describe("PLAY_OPERATIONS_CARD — Sabotage", () => {
  it("dumps the target's aging barrel and returns its cards to the opponent's discard", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state, [1, 1]);
    const cask = makeResourceCard("cask", "sab_barrel", 0);
    const corn = makeResourceCard("corn", "sab_barrel", 1);
    state = placeBarrel(state, "p2", bill(), 2, undefined, {
      productionCards: [cask, corn],
    });
    const target = state.allBarrels
      .filter((b) => b.ownerId === "p2" && b.phase === "aging")
      .at(-1)!;
    const beforeDiscard = state.players.find((p) => p.id === "p2")!.discard.length;
    const { state: s, cardId } = giveOpsCard(state, "p1", "sabotage");
    state = applyAction(s, {
      type: "PLAY_OPERATIONS_CARD",
      playerId: "p1",
      cardId,
      defId: "sabotage",
      targetBarrelId: target.id,
      targetCardId: cask.id,
    });
    const dumped = state.allBarrels.find((b) => b.id === target.id)!;
    expect(dumped.phase).toBe("ready");
    expect(dumped.productionCards.length).toBe(0);
    expect(dumped.agingCards.length).toBe(0);
    expect(dumped.age).toBe(0);
    // Bill is still attached — recipe planning is preserved per spec.
    expect(dumped.attachedMashBill).toBeDefined();
    // Opponent's discard grew by every card that was on the barrel.
    // The placeBarrel helper auto-generated 2 aging cards (age=2) plus
    // we passed 2 production cards, so 4 cards return to discard.
    const opp = state.players.find((p) => p.id === "p2")!;
    expect(opp.discard.length).toBe(beforeDiscard + 4);
  });

  it("rejects self-targeting", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state, [1, 1]);
    state = placeBarrel(state, "p1", bill(), 1);
    const own = state.allBarrels
      .filter((b) => b.ownerId === "p1" && b.phase === "aging")
      .at(-1)!;
    const { state: s, cardId } = giveOpsCard(state, "p1", "sabotage");
    expect(() =>
      applyAction(s, {
        type: "PLAY_OPERATIONS_CARD",
        playerId: "p1",
        cardId,
        defId: "sabotage",
        targetBarrelId: own.id,
        targetCardId: own.agingCards[0]?.id ?? "missing",
      }),
    ).toThrow(/targets opponents/);
  });
});

describe("PLAY_OPERATIONS_CARD — design-only cards", () => {
  it("rejects whiskey_raid / coopers_contract / grain_futures as design-only", () => {
    for (const defId of [
      "whiskey_raid",
      "coopers_contract",
      "grain_futures",
    ] as const) {
      let state = makeTestGame();
      state = advanceToActionPhase(state, [1, 1]);
      const { state: s, cardId } = giveOpsCard(state, "p1", defId);
      expect(() => {
        // Build a sensible payload — the validator rejects before
        // touching the params, but TypeScript still needs them shaped.
        const targetBarrelId = s.allBarrels[0]?.id ?? "barrel_missing";
        const targetCardId =
          s.players.find((p) => p.id === "p1")!.hand[0]?.id ?? "card_missing";
        const params =
          defId === "whiskey_raid"
            ? { defId, targetBarrelId }
            : { defId };
        void targetCardId;
        applyAction(s, {
          type: "PLAY_OPERATIONS_CARD",
          playerId: "p1",
          cardId,
          ...params,
        });
      }).toThrow(/design-only/);
    }
  });
});
