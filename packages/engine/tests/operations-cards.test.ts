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
    const beforeRep = state.players.find((p) => p.id === "p1")!.reputation;
    state = applyAction(state, {
      type: "SELL_BOURBON",
      playerId: "p1",
      barrelId,
    });
    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.reputation).toBe(beforeRep + 4 + 2);
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
