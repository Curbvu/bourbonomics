import { describe, it, expect } from "vitest";
import { applyAction } from "../src/engine.js";
import { makeMashBill, makeCapitalCard, makeResourceCard } from "../src/cards.js";
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
    // v2.2: AGE doesn't end the turn — p1 chains into the bonus age.
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

// Distressed Sale Notice was removed alongside the Rush to Market mechanic.

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
  it("merges two of your barrels into one with combined cards", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state, [1, 1]);
    const slots = state.players.find((p) => p.id === "p1")!.rickhouseSlots;
    state = placeBarrel(state, "p1", bill(), 2, slots[0]!.id);
    state = placeBarrel(state, "p1", bill(), 4, slots[1]!.id);
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

describe("PLAY_OPERATIONS_CARD — Insider Buyer", () => {
  it("sweeps the conveyor and refills 10 fresh cards", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state, [1, 1]);
    const initialIds = state.marketConveyor.map((c) => c.id);
    const { state: s, cardId } = giveOpsCard(state, "p1", "insider_buyer");
    state = applyAction(s, {
      type: "PLAY_OPERATIONS_CARD",
      playerId: "p1",
      cardId,
      defId: "insider_buyer",
    });
    expect(state.marketConveyor).toHaveLength(10);
    // None of the original conveyor cards should still occupy the row
    // (they all went to discard before the redeal pulled fresh ones).
    const overlap = state.marketConveyor.filter((c) => initialIds.includes(c.id));
    // Some overlap is possible if the supply reshuffled the discard back in,
    // but a full match would suggest the sweep didn't actually happen.
    expect(overlap.length).toBeLessThan(initialIds.length);
  });

  it("grants a one-shot half-cost discount on the next BUY_FROM_MARKET", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state, [1, 1]);
    const { state: s, cardId } = giveOpsCard(state, "p1", "insider_buyer");
    state = applyAction(s, {
      type: "PLAY_OPERATIONS_CARD",
      playerId: "p1",
      cardId,
      defId: "insider_buyer",
    });
    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.pendingHalfCostMarketBuy).toBe(true);

    // Try to buy a 4¢ card with $2 capital — should succeed under the
    // half-cost rule (ceil(4/2) = 2¢).
    const target = state.marketConveyor.find((c) => (c.cost ?? 1) === 4);
    if (!target) return; // skip if seed didn't surface a 4¢ card
    const slotIdx = state.marketConveyor.findIndex((c) => c.id === target.id);
    state = giveHand(state, "p1", [makeCapitalCard("p1", 999, 2)]);
    state = applyAction(state, {
      type: "BUY_FROM_MARKET",
      playerId: "p1",
      marketSlotIndex: slotIdx,
      spendCardIds: ["card_p1_cap2_999"],
    });
    const p1After = state.players.find((p) => p.id === "p1")!;
    // Discount consumed.
    expect(p1After.pendingHalfCostMarketBuy).toBe(false);
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

describe("PLAY_OPERATIONS_CARD — Bottling Run", () => {
  it("every player draws 1 card", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state, [1, 1]);
    const before = state.players.map((p) => p.hand.length);
    const { state: s, cardId } = giveOpsCard(state, "p1", "bottling_run");
    state = applyAction(s, {
      type: "PLAY_OPERATIONS_CARD",
      playerId: "p1",
      cardId,
      defId: "bottling_run",
    });
    state.players.forEach((p, i) => {
      expect(p.hand.length).toBe((before[i] ?? 0) + 1);
    });
  });
});

describe("PLAY_OPERATIONS_CARD — Cash Out", () => {
  it("converts every resource card in hand into $1 capital cards in discard", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state, [1, 1]);
    // Seed a known hand: 3 corn + 1 capital. Cash Out should clear the
    // 3 corn and mint 3 new $1 capital cards into discard.
    state = giveHand(state, "p1", [
      makeCapitalCard("p1", 200, 1),
      // 3 resource cards from helpers — use makeCapitalCard for slot,
      // then mutate type via giveHand alternative. We'll just use
      // makeCapitalCard for the keep-card and the helper's resources.
    ]);
    // Append 3 resource cards directly to the hand for simplicity.
    state = {
      ...state,
      players: state.players.map((p) =>
        p.id === "p1"
          ? {
              ...p,
              hand: [
                ...p.hand,
                {
                  id: "card_p1_corn_t0",
                  cardDefId: "corn",
                  type: "resource",
                  subtype: "corn",
                  resourceCount: 1,
                  cost: 1,
                },
                {
                  id: "card_p1_corn_t1",
                  cardDefId: "corn",
                  type: "resource",
                  subtype: "corn",
                  resourceCount: 1,
                  cost: 1,
                },
                {
                  id: "card_p1_corn_t2",
                  cardDefId: "corn",
                  type: "resource",
                  subtype: "corn",
                  resourceCount: 1,
                  cost: 1,
                },
              ],
            }
          : p,
      ),
    };
    const { state: s, cardId } = giveOpsCard(state, "p1", "cash_out");
    state = applyAction(s, {
      type: "PLAY_OPERATIONS_CARD",
      playerId: "p1",
      cardId,
      defId: "cash_out",
    });
    const p1 = state.players.find((p) => p.id === "p1")!;
    // Hand keeps the original capital card; resources are gone.
    expect(p1.hand.every((c) => c.type === "capital")).toBe(true);
    // Discard now has the 3 spent corn cards + 3 freshly minted $1 capitals.
    const mintedCapitals = p1.discard.filter(
      (c) => c.type === "capital" && c.id.startsWith("card_p1_cap"),
    );
    expect(mintedCapitals.length).toBeGreaterThanOrEqual(3);
  });
});

describe("PLAY_OPERATIONS_CARD — Allocation", () => {
  it("draws 2 mash bills from the deck into the player's hand for free", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state, [1, 1]);
    const beforeBills = state.players.find((p) => p.id === "p1")!.mashBills.length;
    const beforeDeck = state.bourbonDeck.length;
    const { state: s, cardId } = giveOpsCard(state, "p1", "allocation");
    state = applyAction(s, {
      type: "PLAY_OPERATIONS_CARD",
      playerId: "p1",
      cardId,
      defId: "allocation",
    });
    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.mashBills.length).toBe(beforeBills + 2);
    expect(state.bourbonDeck.length).toBe(beforeDeck - 2);
  });
});

describe("PLAY_OPERATIONS_CARD — Rickhouse Expansion Permit", () => {
  it("adds a permanent slot to the player's rickhouse", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state, [1, 1]);
    const before = state.players.find((p) => p.id === "p1")!.rickhouseSlots.length;
    const { state: s, cardId } = giveOpsCard(state, "p1", "rickhouse_expansion_permit");
    state = applyAction(s, {
      type: "PLAY_OPERATIONS_CARD",
      playerId: "p1",
      cardId,
      defId: "rickhouse_expansion_permit",
    });
    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.rickhouseSlots.length).toBe(before + 1);
  });
});

describe("PLAY_OPERATIONS_CARD — Forced Cure", () => {
  it("grants a bonus age slot on a barrel (same shape as Rushed Shipment)", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state, [1, 1]);
    state = placeBarrel(state, "p1", bill(), 0);
    const barrelId = state.allBarrels[0]!.id;
    const { state: s, cardId } = giveOpsCard(state, "p1", "forced_cure");
    state = applyAction(s, {
      type: "PLAY_OPERATIONS_CARD",
      playerId: "p1",
      cardId,
      defId: "forced_cure",
      targetBarrelId: barrelId,
    });
    expect(state.allBarrels[0]!.extraAgesAvailable).toBe(1);
  });

  it("rejects targeting an opponent's barrel", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state, [1, 1]);
    state = placeBarrel(state, "p2", bill(), 0);
    const barrelId = state.allBarrels[0]!.id;
    const { state: s, cardId } = giveOpsCard(state, "p1", "forced_cure");
    expect(() =>
      applyAction(s, {
        type: "PLAY_OPERATIONS_CARD",
        playerId: "p1",
        cardId,
        defId: "forced_cure",
        targetBarrelId: barrelId,
      }),
    ).toThrow(/your own/);
  });
});

describe("PLAY_OPERATIONS_CARD — Mash Futures", () => {
  it("relaxes a recipe grain min by 1 on the next MAKE", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state);
    // Build a bill that requires 2 rye, drafted onto p1.
    const stiffBill = makeMashBill(
      {
        defId: "stiff_rye",
        name: "Stiff Rye",
        ageBands: [2, 4, 6],
        demandBands: [2, 4, 6],
        rewardGrid: [[1, 2, 3], [2, 4, 5], [3, 5, 6]],
        recipe: { minRye: 2 },
      },
      0,
    );
    state = {
      ...state,
      players: state.players.map((p) =>
        p.id === "p1"
          ? { ...p, mashBills: [...p.mashBills, stiffBill] }
          : p,
      ),
    };
    const { state: s, cardId } = giveOpsCard(state, "p1", "mash_futures");
    state = applyAction(s, {
      type: "PLAY_OPERATIONS_CARD",
      playerId: "p1",
      cardId,
      defId: "mash_futures",
    });
    expect(state.players.find((p) => p.id === "p1")!.pendingMakeDiscount).toBe("grain");
    // Hand: cask + corn + 1 rye (only 1 rye but discount knocks the min from 2 → 1).
    state = giveHand(state, "p1", [
      makeResourceCard("cask", "p1", 0),
      makeResourceCard("corn", "p1", 1),
      makeResourceCard("rye", "p1", 2),
    ]);
    const slot = state.players[0]!.rickhouseSlots[0]!.id;
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      cardIds: ["card_p1_cask_0", "card_p1_corn_1", "card_p1_rye_2"],
      mashBillId: stiffBill.id,
      slotId: slot,
    });
    // Discount consumed.
    expect(state.players.find((p) => p.id === "p1")!.pendingMakeDiscount).toBeNull();
    expect(state.allBarrels).toHaveLength(1);
  });
});

describe("PLAY_OPERATIONS_CARD — Cooper's Contract", () => {
  it("lets a MAKE proceed with 0 cask cards", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state);
    const { state: s, cardId } = giveOpsCard(state, "p1", "coopers_contract");
    state = applyAction(s, {
      type: "PLAY_OPERATIONS_CARD",
      playerId: "p1",
      cardId,
      defId: "coopers_contract",
    });
    expect(state.players.find((p) => p.id === "p1")!.pendingMakeDiscount).toBe("cask");
    // Caskless mash — corn + rye only.
    state = giveHand(state, "p1", [
      makeResourceCard("corn", "p1", 0),
      makeResourceCard("rye", "p1", 1),
    ]);
    const mbId = state.players[0]!.mashBills[0]!.id;
    const slot = state.players[0]!.rickhouseSlots[0]!.id;
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      cardIds: ["card_p1_corn_0", "card_p1_rye_1"],
      mashBillId: mbId,
      slotId: slot,
    });
    expect(state.allBarrels).toHaveLength(1);
    expect(state.players.find((p) => p.id === "p1")!.pendingMakeDiscount).toBeNull();
  });
});

describe("PLAY_OPERATIONS_CARD — Rating Boost", () => {
  it("grants +2 rep on the next sale", () => {
    let state = makeTestGame({ startingDemand: 5 });
    state = advanceToActionPhase(state, [1, 1]);
    state = placeBarrel(state, "p1", bill(), 4);
    const barrelId = state.allBarrels[0]!.id;
    const { state: s, cardId } = giveOpsCard(state, "p1", "rating_boost");
    state = applyAction(s, {
      type: "PLAY_OPERATIONS_CARD",
      playerId: "p1",
      cardId,
      defId: "rating_boost",
    });
    expect(state.players.find((p) => p.id === "p1")!.pendingRatingBoost).toBe(2);
    const beforeRep = state.players.find((p) => p.id === "p1")!.reputation;
    // age 4, demand 5: row 1, col 1, reward 4. +2 from Rating Boost = 6 net.
    state = applyAction(state, {
      type: "SELL_BOURBON",
      playerId: "p1",
      barrelId,
      reputationSplit: 4,
      cardDrawSplit: 0,
    });
    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.reputation).toBe(beforeRep + 4 + 2);
    // Boost consumed.
    expect(p1.pendingRatingBoost).toBe(0);
  });
});

describe("PLAY_OPERATIONS_CARD — Master Distiller", () => {
  it("permanently shifts the targeted barrel's demand-band reading at sale", () => {
    let state = makeTestGame({ startingDemand: 4 });
    state = advanceToActionPhase(state, [1, 1]);
    state = placeBarrel(state, "p1", bill(), 4);
    const barrelId = state.allBarrels[0]!.id;
    const { state: s, cardId } = giveOpsCard(state, "p1", "master_distiller");
    state = applyAction(s, {
      type: "PLAY_OPERATIONS_CARD",
      playerId: "p1",
      cardId,
      defId: "master_distiller",
      targetBarrelId: barrelId,
    });
    expect(state.allBarrels[0]!.demandBandOffset).toBe(2);
    // age 4, demand 4: base row 1, col 1 = 4. With +2 band offset col
    // shifts up to col 2 (capped) → reward 5.
    state = applyAction(state, {
      type: "SELL_BOURBON",
      playerId: "p1",
      barrelId,
      reputationSplit: 5,
      cardDrawSplit: 0,
    });
    expect(state.allBarrels).toHaveLength(0);
  });
});
