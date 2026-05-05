import { describe, it, expect } from "vitest";
import { applyAction } from "../src/engine.js";
import { makeMashBill, makeCapitalCard } from "../src/cards.js";
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
  it("blocks aging on a targeted upper-tier barrel", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state, [1, 1]);
    // Place barrel in p1's first upper-tier slot.
    const upperSlot = state.players.find((p) => p.id === "p1")!.rickhouseSlots
      .find((s) => s.tier === "upper")!.id;
    state = placeBarrel(state, "p1", bill(), 1, upperSlot);
    const { state: s, cardId } = giveOpsCard(state, "p1", "regulatory_inspection");
    state = applyAction(s, {
      type: "PLAY_OPERATIONS_CARD",
      playerId: "p1",
      cardId,
      defId: "regulatory_inspection",
      targetBarrelId: state.allBarrels[0]!.id,
    });
    expect(state.allBarrels[0]!.inspectedThisRound).toBe(true);
    state = giveHand(state, "p1", [makeCapitalCard("p1", 0)]);
    expect(() =>
      applyAction(state, {
        type: "AGE_BOURBON",
        playerId: "p1",
        barrelId: state.allBarrels[0]!.id,
        cardId: "card_p1_cap1_0",
      }),
    ).toThrow(/regulatory inspection/);
  });

  it("rejects targeting a bonded-tier barrel", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state, [1, 1]);
    const bondedSlot = state.players.find((p) => p.id === "p1")!.rickhouseSlots
      .find((s) => s.tier === "bonded")!.id;
    state = placeBarrel(state, "p1", bill(), 1, bondedSlot);
    const { state: s, cardId } = giveOpsCard(state, "p1", "regulatory_inspection");
    expect(() =>
      applyAction(s, {
        type: "PLAY_OPERATIONS_CARD",
        playerId: "p1",
        cardId,
        defId: "regulatory_inspection",
        targetBarrelId: state.allBarrels[0]!.id,
      }),
    ).toThrow(/upper-tier/);
  });
});

describe("PLAY_OPERATIONS_CARD — Rushed Shipment", () => {
  it("allows aging the same barrel twice in one round", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state, [1, 1]);
    state = placeBarrel(state, "p1", bill(), 0);
    const barrelId = state.allBarrels[0]!.id;
    const { state: s, cardId } = giveOpsCard(state, "p1", "rushed_shipment");
    state = applyAction(s, {
      type: "PLAY_OPERATIONS_CARD",
      playerId: "p1",
      cardId,
      defId: "rushed_shipment",
      targetBarrelId: barrelId,
    });
    state = giveHand(state, "p1", [makeCapitalCard("p1", 0), makeCapitalCard("p1", 1)]);
    state = applyAction(state, {
      type: "AGE_BOURBON",
      playerId: "p1",
      barrelId,
      cardId: "card_p1_cap1_0",
    });
    // p1 still has 1 card and an extra age — make p2 pass first to give them another turn.
    state = giveHand(state, "p2", []);
    state = applyAction(state, { type: "PASS_TURN", playerId: "p2" });
    state = applyAction(state, {
      type: "AGE_BOURBON",
      playerId: "p1",
      barrelId,
      cardId: "card_p1_cap1_1",
    });
    expect(state.allBarrels[0]!.age).toBe(2);
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
      barrelId: state.allBarrels[0]!.id,
      reputationSplit: 5,
      cardDrawSplit: 0,
    });
    expect(state.demand).toBe(before);
    expect(state.players.find((p) => p.id === "p1")!.demandSurgeActive).toBe(false);
  });
});

describe("PLAY_OPERATIONS_CARD — Distressed Sale Notice", () => {
  it("forces the target to Rush to Market on their next turn", () => {
    let state = makeTestGame({ startingDemand: 6 });
    state = advanceToActionPhase(state, [1, 1]);
    // Fill p2's rickhouse with a 1yo barrel (and 3 dummies to reach capacity 4).
    for (let i = 0; i < 4; i++) {
      state = placeBarrel(state, "p2", bill(), i === 0 ? 1 : 3);
    }
    const targetBarrelId = state.allBarrels.find((b) => b.ownerId === "p2" && b.age === 1)!.id;
    const { state: s, cardId } = giveOpsCard(state, "p1", "distressed_sale_notice");
    state = applyAction(s, {
      type: "PLAY_OPERATIONS_CARD",
      playerId: "p1",
      cardId,
      defId: "distressed_sale_notice",
      targetPlayerId: "p2",
      targetBarrelId,
    });
    expect(state.players.find((p) => p.id === "p2")!.pendingRushBarrelId).toBe(targetBarrelId);
    // p1 still has their action — pass the turn so we get to p2.
    state = applyAction(state, { type: "PASS_TURN", playerId: "p1" });
    // p2 now must Rush to Market — any other action is rejected.
    state = giveHand(state, "p2", [makeCapitalCard("p2", 0)]);
    expect(() =>
      applyAction(state, { type: "PASS_TURN", playerId: "p2" }),
    ).toThrow(/forced Rush/);
    state = applyAction(state, {
      type: "RUSH_TO_MARKET",
      playerId: "p2",
      barrelId: targetBarrelId,
    });
    expect(state.players.find((p) => p.id === "p2")!.pendingRushBarrelId).toBeNull();
  });
});

describe("PLAY_OPERATIONS_CARD — Market Corner", () => {
  it("takes a face-up market card into hand without paying", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state, [1, 1]);
    const targetCard = state.marketConveyor[0]!;
    const { state: s, cardId } = giveOpsCard(state, "p1", "market_corner");
    state = applyAction(s, {
      type: "PLAY_OPERATIONS_CARD",
      playerId: "p1",
      cardId,
      defId: "market_corner",
      marketSlotIndex: 0,
    });
    expect(state.marketConveyor[0]!.id).not.toBe(targetCard.id);
    expect(state.players.find((p) => p.id === "p1")!.hand.some((c) => c.id === targetCard.id)).toBe(true);
  });
});

describe("PLAY_OPERATIONS_CARD — Blend", () => {
  it("merges two upper-tier barrels into one with combined cards", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state, [1, 1]);
    const upperSlots = state.players.find((p) => p.id === "p1")!.rickhouseSlots.filter(
      (s) => s.tier === "upper",
    );
    state = placeBarrel(state, "p1", bill(), 2, upperSlots[0]!.id);
    state = placeBarrel(state, "p1", bill(), 4, upperSlots[1]!.id);
    const ids = state.allBarrels.filter((b) => b.ownerId === "p1").map((b) => b.id);
    const { state: s, cardId } = giveOpsCard(state, "p1", "blend");
    state = applyAction(s, {
      type: "PLAY_OPERATIONS_CARD",
      playerId: "p1",
      cardId,
      defId: "blend",
      barrel1Id: ids[0]!,
      barrel2Id: ids[1]!,
    });
    const survivors = state.allBarrels.filter((b) => b.ownerId === "p1");
    expect(survivors).toHaveLength(1);
    expect(survivors[0]!.age).toBe(6); // 2 + 4 aging cards combined
  });

  it("rejects blending bonded-tier barrels", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state, [1, 1]);
    const slots = state.players.find((p) => p.id === "p1")!.rickhouseSlots;
    const bondedSlot = slots.find((s) => s.tier === "bonded")!.id;
    const upperSlot = slots.find((s) => s.tier === "upper")!.id;
    state = placeBarrel(state, "p1", bill(), 2, bondedSlot);
    state = placeBarrel(state, "p1", bill(), 4, upperSlot);
    const ids = state.allBarrels.filter((b) => b.ownerId === "p1").map((b) => b.id);
    const { state: s, cardId } = giveOpsCard(state, "p1", "blend");
    expect(() =>
      applyAction(s, {
        type: "PLAY_OPERATIONS_CARD",
        playerId: "p1",
        cardId,
        defId: "blend",
        barrel1Id: ids[0]!,
        barrel2Id: ids[1]!,
      }),
    ).toThrow(/bonded/);
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
