import { describe, it, expect } from "vitest";
import { applyAction, IllegalActionError } from "../src/engine.js";
import { computeReward, awardConditionMet } from "../src/rewards.js";
import { makeMashBill, makeCapitalCard, makeResourceCard } from "../src/cards.js";
import { advanceToActionPhase, giveHand, makeTestGame, placeBarrel, spendCardId } from "./helpers.js";

const testBill = () =>
  makeMashBill(
    {
      defId: "test_bill",
      name: "Test",
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

describe("computeReward", () => {
  it("looks up the correct cell for valid age + demand", () => {
    const b = testBill();
    expect(computeReward(b, 2, 2)).toBe(1);
    expect(computeReward(b, 5, 7)).toBe(5); // age row 1, demand col 2
    expect(computeReward(b, 6, 6)).toBe(6); // top-right
    expect(computeReward(b, 3, 4)).toBe(2);
  });

  it("returns 0 below the lowest band thresholds", () => {
    const b = testBill();
    expect(computeReward(b, 1, 5)).toBe(0); // age below 2
    expect(computeReward(b, 5, 1)).toBe(0); // demand below 2
  });

  it("returns 0 for blank cells", () => {
    const blank = makeMashBill(
      {
        defId: "blank",
        name: "Blank Test",
        ageBands: [2, 4, 6],
        demandBands: [5, 7, 9],
        rewardGrid: [
          [null, 2, 3],
          [1, 3, 5],
          [2, 4, 7],
        ],
      },
      0,
    );
    expect(computeReward(blank, 2, 5)).toBe(0); // blank cell at top-left
    expect(computeReward(blank, 5, 7)).toBe(3);
  });
});

describe("awardConditionMet", () => {
  it("requires every present field", () => {
    const cond = { minAge: 5, minDemand: 6, minReward: 4 };
    expect(awardConditionMet(cond, 5, 6, 4)).toBe(true);
    expect(awardConditionMet(cond, 4, 6, 4)).toBe(false);
    expect(awardConditionMet(cond, 5, 5, 4)).toBe(false);
    expect(awardConditionMet(cond, 5, 6, 3)).toBe(false);
  });

  it("ignores missing fields", () => {
    expect(awardConditionMet({ minAge: 5 }, 5, 0, 0)).toBe(true);
    expect(awardConditionMet({}, 0, 0, 0)).toBe(true);
  });
});

describe("SELL_BOURBON — happy path", () => {
  it("grants reputation, drops demand, removes the barrel, discards aging cards", () => {
    let state = makeTestGame({ startingDemand: 6 });
    state = advanceToActionPhase(state, [1, 1]);
    expect(state.demand).toBe(6);
    state = placeBarrel(state, "p1", testBill(), 5);
    state = giveHand(state, "p1", [makeCapitalCard("p1", 0)]);
    const barrelId = state.allBarrels.find((b) => b.phase === "aging")!.id;
    state = applyAction(state, {
      type: "SELL_BOURBON",
      playerId: "p1",
      barrelId,
      reputationSplit: 5, // total reward is 5 at age=5, demand=6
      cardDrawSplit: 0,
      spendCardId: spendCardId(state, "p1"),
    });
    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.reputation).toBe(5);
    expect(p1.barrelsSold).toBe(1);
    expect(state.demand).toBe(5);
    expect(state.allBarrels.filter((b) => b.phase !== "ready")).toHaveLength(0);
    // 5 aging cards + 1 sell-action capital card = 6 in discard.
    expect(p1.discard.filter((c) => c.id.startsWith("agingcard_"))).toHaveLength(5);
  });

  it("draws cards mid-sale into hand for use later in the same action phase", () => {
    let state = makeTestGame({ startingDemand: 6 });
    state = advanceToActionPhase(state, [1, 1]);
    state = placeBarrel(state, "p1", testBill(), 5);
    // Stock p1's deck so the mid-sale draw has cards to pull from.
    state = {
      ...state,
      players: state.players.map((p) =>
        p.id === "p1"
          ? {
              ...p,
              hand: [makeCapitalCard("p1", 99)],
              deck: [
                makeResourceCard("rye", "p1", 50),
                makeResourceCard("rye", "p1", 51),
                makeResourceCard("rye", "p1", 52),
              ],
              discard: [],
            }
          : p,
      ),
    };
    const barrelId = state.allBarrels.find((b) => b.phase === "aging")!.id;
    const sellSpend = spendCardId(state, "p1");
    state = applyAction(state, {
      type: "SELL_BOURBON",
      playerId: "p1",
      barrelId,
      reputationSplit: 2,
      cardDrawSplit: 3,
      spendCardId: sellSpend,
    });
    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.reputation).toBe(2);
    // Hand math: started at 1 capital. Sell spends it → discard=[cap].
    // Draw count = cardDrawSplit (3). Deck has 3 ryes; 3 draws empty
    // it. Final hand = [3 ryes] = 3.
    expect(p1.hand).toHaveLength(3);
    expect(p1.deck).toHaveLength(0);
  });

  it("rejects barrels younger than 2 years", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state, [1, 1]);
    state = placeBarrel(state, "p1", testBill(), 1);
    const barrelId = state.allBarrels.find((b) => b.phase === "aging")!.id;
    expect(() =>
      applyAction(state, {
        type: "SELL_BOURBON",
        playerId: "p1",
        barrelId,
        reputationSplit: 0,
        cardDrawSplit: 0,
        spendCardId: spendCardId(state, "p1"),
      }),
    ).toThrow(/2 years/);
  });

  it("rejects mismatched split", () => {
    let state = makeTestGame({ startingDemand: 6 });
    state = advanceToActionPhase(state, [1, 1]);
    state = placeBarrel(state, "p1", testBill(), 5); // reward = 5
    const barrelId = state.allBarrels.find((b) => b.phase === "aging")!.id;
    expect(() =>
      applyAction(state, {
        type: "SELL_BOURBON",
        playerId: "p1",
        barrelId,
        reputationSplit: 4,
        cardDrawSplit: 0,
        spendCardId: spendCardId(state, "p1"),
      }),
    ).toThrow(/expected reward of 5/);
  });

  it("rejects selling another player's barrel", () => {
    let state = makeTestGame({ startingDemand: 6 });
    state = advanceToActionPhase(state, [1, 1]);
    state = placeBarrel(state, "p2", testBill(), 5);
    const barrelId = state.allBarrels.find((b) => b.phase === "aging")!.id;
    expect(() =>
      applyAction(state, {
        type: "SELL_BOURBON",
        playerId: "p1",
        barrelId,
        reputationSplit: 5,
        cardDrawSplit: 0,
        spendCardId: spendCardId(state, "p1"),
      }),
    ).toThrow(/own/);
  });

  it("demand floors at 0 even on sequential sales", () => {
    let state = makeTestGame({ startingDemand: 1 });
    state = advanceToActionPhase(state, [1, 1]);
    // The roll-of-2 bumps demand to 2. Pin it back to 1 so the test exercises
    // the floor.
    state = { ...state, demand: 1 };
    state = placeBarrel(state, "p1", testBill(), 5); // reward at demand=1 is 0
    state = placeBarrel(state, "p2", testBill(), 5);
    // Keep both players in the round so we don't auto-cleanup between sales.
    state = giveHand(state, "p1", [makeCapitalCard("p1", 90)]);
    state = giveHand(state, "p2", [makeCapitalCard("p2", 90)]);
    const ids = state.allBarrels.filter((b) => b.phase === "aging").map((b) => b.id);
    state = applyAction(state, {
      type: "SELL_BOURBON",
      playerId: "p1",
      barrelId: ids[0]!,
      reputationSplit: 0,
      cardDrawSplit: 0,
      spendCardId: spendCardId(state, "p1"),
    });
    expect(state.demand).toBe(0);
    // Hand off to p2 — selling no longer ends the turn.
    state = applyAction(state, { type: "PASS_TURN", playerId: "p1" });
    state = applyAction(state, {
      type: "SELL_BOURBON",
      playerId: "p2",
      barrelId: ids[1]!,
      reputationSplit: 0,
      cardDrawSplit: 0,
      spendCardId: spendCardId(state, "p2"),
    });
    expect(state.demand).toBe(0);
  });
});

describe("SELL_BOURBON — Silver and Gold awards", () => {
  it("Silver returns the bill to hand", () => {
    const bill = makeMashBill(
      {
        defId: "silver_test",
        name: "Silver",
        ageBands: [2, 4, 6],
        demandBands: [2, 4, 6],
        rewardGrid: [
          [1, 2, 3],
          [2, 4, 5],
          [3, 5, 6],
        ],
        silverAward: { minAge: 4 },
      },
      0,
    );
    let state = makeTestGame({ startingDemand: 6 });
    state = advanceToActionPhase(state, [1, 1]);
    state = placeBarrel(state, "p1", bill, 5);
    const barrelId = state.allBarrels.find((b) => b.phase === "aging")!.id;
    const sellingSlotId = state.allBarrels.find((b) => b.phase === "aging")!.slotId;
    state = applyAction(state, {
      type: "SELL_BOURBON",
      playerId: "p1",
      barrelId,
      reputationSplit: 5,
      cardDrawSplit: 0,
      spendCardId: spendCardId(state, "p1"),
    });
    // v2.6: Silver leaves the bill in the now-empty selling slot as
    // a "ready" barrel (slot doesn't open).
    const retained = state.allBarrels.find((b) => b.slotId === sellingSlotId);
    expect(retained).toBeDefined();
    expect(retained!.attachedMashBill.id).toBe(bill.id);
    expect(retained!.phase).toBe("ready");
    expect(state.bourbonDiscard.some((m) => m.id === bill.id)).toBe(false);
  });

  it("Gold takes precedence over Silver — keep retains in slot", () => {
    const bill = makeMashBill(
      {
        defId: "gold_test",
        name: "Gold",
        ageBands: [2, 4, 6],
        demandBands: [2, 4, 6],
        rewardGrid: [
          [1, 2, 3],
          [2, 4, 5],
          [3, 5, 6],
        ],
        silverAward: { minAge: 4 },
        goldAward: { minAge: 5, minDemand: 5 },
      },
      0,
    );
    let state = makeTestGame({ startingDemand: 6 });
    state = advanceToActionPhase(state, [1, 1]);
    state = placeBarrel(state, "p1", bill, 5);
    const barrelId = state.allBarrels.find((b) => b.phase === "aging")!.id;
    const sellingSlotId = state.allBarrels.find((b) => b.phase === "aging")!.slotId;
    state = applyAction(state, {
      type: "SELL_BOURBON",
      playerId: "p1",
      barrelId,
      reputationSplit: 5,
      cardDrawSplit: 0,
      spendCardId: spendCardId(state, "p1"),
      goldChoice: "keep",
    });
    // v2.6: Gold "keep" leaves the bill in the now-empty selling slot
    // (Silver-style behavior).
    const retained = state.allBarrels.find((b) => b.slotId === sellingSlotId);
    expect(retained).toBeDefined();
    expect(retained!.attachedMashBill.id).toBe(bill.id);
    expect(retained!.phase).toBe("ready");
    expect(state.bourbonDiscard.some((m) => m.id === bill.id)).toBe(false);
  });

  it("falls through to discard when no award conditions are met", () => {
    const bill = makeMashBill(
      {
        defId: "noaward",
        name: "No Award",
        ageBands: [2, 4, 6],
        demandBands: [2, 4, 6],
        rewardGrid: [
          [1, 2, 3],
          [2, 4, 5],
          [3, 5, 6],
        ],
      },
      0,
    );
    let state = makeTestGame({ startingDemand: 6 });
    state = advanceToActionPhase(state, [1, 1]);
    state = placeBarrel(state, "p1", bill, 5);
    const barrelId = state.allBarrels.find((b) => b.phase === "aging")!.id;
    state = applyAction(state, {
      type: "SELL_BOURBON",
      playerId: "p1",
      barrelId,
      reputationSplit: 5,
      cardDrawSplit: 0,
      spendCardId: spendCardId(state, "p1"),
    });
    expect(state.bourbonDiscard.some((m) => m.id === bill.id)).toBe(true);
  });

  // v2.6: the v2.5 "uses an unlocked gold bourbon's grid" test is gone —
  // Gold awards no longer populate a permanent recipe library. The new
  // Gold mechanic (Convert / Keep / Decline) is exercised by the Silver
  // and Gold-keep tests above; a Gold-convert test follows.

  it("Gold convert replaces another slot's bill when commits satisfy the new recipe", () => {
    const goldBill = makeMashBill(
      {
        defId: "gold_convert_test",
        name: "Gold Convert",
        ageBands: [2, 4, 6],
        demandBands: [2, 4, 6],
        rewardGrid: [
          [1, 2, 3],
          [2, 4, 5],
          [3, 5, 6],
        ],
        // Permissive recipe so any cask + corn + grain target qualifies.
        goldAward: { minAge: 5, minDemand: 5 },
      },
      0,
    );
    const targetBill = makeMashBill(
      {
        defId: "target_bill",
        name: "Target",
        ageBands: [2, 4, 6],
        demandBands: [2, 4, 6],
        rewardGrid: [
          [1, 1, 1],
          [1, 1, 1],
          [1, 1, 1],
        ],
      },
      1,
    );
    let state = makeTestGame({ startingDemand: 6 });
    state = advanceToActionPhase(state, [1, 1]);
    // Selling barrel — aged 5, will trigger the Gold award.
    state = placeBarrel(state, "p1", goldBill, 5);
    const sellingBarrel = state.allBarrels[state.allBarrels.length - 1]!;
    // Convert target — committed cask + corn + rye that satisfy the
    // Gold bill's recipe.
    const cask = makeResourceCard("cask", "convert", 0);
    const corn = makeResourceCard("corn", "convert", 1);
    const rye = makeResourceCard("rye", "convert", 2);
    state = placeBarrel(state, "p1", targetBill, 0, undefined, {
      productionCards: [cask, corn, rye],
    });
    const targetBarrel = state.allBarrels[state.allBarrels.length - 1]!;
    state = applyAction(state, {
      type: "SELL_BOURBON",
      playerId: "p1",
      barrelId: sellingBarrel.id,
      reputationSplit: 5,
      cardDrawSplit: 0,
      spendCardId: spendCardId(state, "p1"),
      goldChoice: "convert",
      goldConvertTargetSlotId: targetBarrel.slotId,
    });
    const target = state.allBarrels.find((b) => b.slotId === targetBarrel.slotId)!;
    expect(target.attachedMashBill.id).toBe(goldBill.id);
    // Selling slot opens fully — no barrel record at that slot.
    expect(state.allBarrels.some((b) => b.slotId === sellingBarrel.slotId)).toBe(false);
    // The replaced bill goes to the bourbon discard.
    expect(state.bourbonDiscard.some((m) => m.id === targetBill.id)).toBe(true);
  });
});
