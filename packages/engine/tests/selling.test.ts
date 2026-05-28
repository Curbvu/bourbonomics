import { describe, it, expect } from "vitest";
import { applyAction } from "../src/engine.js";
import { computeReward, awardConditionMet } from "../src/rewards.js";
import { makeMashBill } from "../src/cards.js";
import { saleFloorForBill } from "../src/types.js";
import { advanceToActionPhase, makeTestGame, placeBarrel } from "./helpers.js";

// v2.11 (Unified Rep): SELL_BOURBON is single-step. Grid + bonuses
// land directly on the rep track, clamped to the bill's tier floor
// (3 for common/uncommon, 4 for rare, 5 for epic/legendary). The
// v2.10 split prompt and Gold-only purchasing-power rule are retired.

const testBill = (tier: "common" | "uncommon" | "rare" | "epic" | "legendary" = "common") =>
  makeMashBill(
    {
      defId: "test_bill",
      name: "Test",
      tier,
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
    expect(computeReward(b, 5, 7)).toBe(5);
    expect(computeReward(b, 6, 6)).toBe(6);
    expect(computeReward(b, 3, 4)).toBe(2);
  });

  it("returns 0 below the lowest band thresholds", () => {
    const b = testBill();
    expect(computeReward(b, 1, 5)).toBe(0);
    expect(computeReward(b, 5, 1)).toBe(0);
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
    expect(computeReward(blank, 2, 5)).toBe(0);
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

describe("saleFloorForBill (v2.11 tier floor)", () => {
  it("Tier 1 (common / uncommon) bills floor at 3 rep", () => {
    expect(saleFloorForBill(testBill("common"))).toBe(3);
    expect(saleFloorForBill(testBill("uncommon"))).toBe(3);
  });
  it("Tier 2 (rare) bills floor at 4 rep", () => {
    expect(saleFloorForBill(testBill("rare"))).toBe(4);
  });
  it("Tier 3 (epic / legendary) bills floor at 5 rep", () => {
    expect(saleFloorForBill(testBill("epic"))).toBe(5);
    expect(saleFloorForBill(testBill("legendary"))).toBe(5);
  });
});

describe("SELL_BOURBON — single-step v2.11 sale", () => {
  it("adds grid value to rep, drops demand, removes the barrel", () => {
    let state = makeTestGame({ startingDemand: 6 });
    state = advanceToActionPhase(state, [1, 1]);
    expect(state.demand).toBe(6);
    state = placeBarrel(state, "p1", testBill(), 5);
    const barrelId = state.allBarrels.find((b) => b.phase === "aging")!.id;
    const beforeRep = state.players.find((p) => p.id === "p1")!.reputation;
    state = applyAction(state, {
      type: "SELL_BOURBON",
      playerId: "p1",
      barrelId,
    });
    const p1 = state.players.find((p) => p.id === "p1")!;
    // Grid cell at age 5 / demand 6 = 5. Tier 1 floor = 3 (not binding).
    expect(p1.reputation).toBe(beforeRep + 5);
    expect(p1.barrelsSold).toBe(1);
    expect(state.demand).toBe(5);
    expect(state.allBarrels.filter((b) => b.phase !== "ready")).toHaveLength(0);
    // 5 aging cards land in discard (no spend card under v2.10/v2.11).
    expect(p1.discard.filter((c) => c.id.startsWith("agingcard_"))).toHaveLength(5);
  });

  it("applies the tier floor when grid + bonuses fall below it", () => {
    // Common bill at age 2 / demand 2 → grid cell = 1; tier floor = 3.
    let state = makeTestGame({ startingDemand: 2 });
    state = advanceToActionPhase(state, [1, 1]);
    state = placeBarrel(state, "p1", testBill("common"), 2);
    const barrelId = state.allBarrels.find((b) => b.phase === "aging")!.id;
    const beforeRep = state.players.find((p) => p.id === "p1")!.reputation;
    state = applyAction(state, {
      type: "SELL_BOURBON",
      playerId: "p1",
      barrelId,
    });
    expect(state.players.find((p) => p.id === "p1")!.reputation).toBe(beforeRep + 3);
  });

  it("applies the epic floor (5) on a low grid sale", () => {
    const epicBill = makeMashBill(
      {
        defId: "epic_floor_test",
        name: "Epic Floor",
        tier: "epic",
        ageBands: [2, 4, 6],
        demandBands: [2, 4, 6],
        // Worst cell is 1 — floor must lift the sale to 5.
        rewardGrid: [
          [1, 2, 3],
          [2, 3, 4],
          [3, 4, 5],
        ],
      },
      500,
    );
    let state = makeTestGame({ startingDemand: 2 });
    state = advanceToActionPhase(state, [1, 1]);
    state = placeBarrel(state, "p1", epicBill, 2);
    const barrelId = state.allBarrels.find((b) => b.phase === "aging")!.id;
    const beforeRep = state.players.find((p) => p.id === "p1")!.reputation;
    state = applyAction(state, {
      type: "SELL_BOURBON",
      playerId: "p1",
      barrelId,
    });
    expect(state.players.find((p) => p.id === "p1")!.reputation).toBe(beforeRep + 5);
  });

  it("rejects selling a barrel that just finished aging this round (round-gap)", () => {
    let state = makeTestGame({ startingDemand: 6 });
    state = advanceToActionPhase(state, [1, 1]);
    state = placeBarrel(state, "p1", testBill(), 2);
    state = {
      ...state,
      allBarrels: state.allBarrels.map((b) =>
        b.ownerId === "p1" && b.phase === "aging"
          ? { ...b, completedInRound: state.round }
          : b,
      ),
    };
    const barrelId = state.allBarrels.find((b) => b.phase === "aging")!.id;
    expect(() =>
      applyAction(state, {
        type: "SELL_BOURBON",
        playerId: "p1",
        barrelId,
      }),
    ).toThrow(/too recently/);
  });

  it("rejects selling a barrel below the minimum age", () => {
    let state = makeTestGame({ startingDemand: 6 });
    state = advanceToActionPhase(state, [1, 1]);
    state = placeBarrel(state, "p1", testBill(), 1);
    const barrelId = state.allBarrels.find((b) => b.phase === "aging")!.id;
    expect(() =>
      applyAction(state, {
        type: "SELL_BOURBON",
        playerId: "p1",
        barrelId,
      }),
    ).toThrow(/at least 2 years/);
  });

  it("rejects selling a non-aging (construction) barrel", () => {
    let state = makeTestGame({ startingDemand: 6 });
    state = advanceToActionPhase(state, [1, 1]);
    state = placeBarrel(state, "p1", testBill(), 5);
    state = {
      ...state,
      allBarrels: state.allBarrels.map((b) =>
        b.ownerId === "p1" && b.phase === "aging"
          ? { ...b, phase: "construction" }
          : b,
      ),
    };
    const barrelId = state.allBarrels.find((b) => b.ownerId === "p1")!.id;
    expect(() =>
      applyAction(state, {
        type: "SELL_BOURBON",
        playerId: "p1",
        barrelId,
      }),
    ).toThrow(/under construction/);
  });

  it("rejects selling another player's barrel", () => {
    let state = makeTestGame({ startingDemand: 6 });
    state = advanceToActionPhase(state, [1, 1]);
    state = placeBarrel(state, "p2", testBill(), 5);
    const barrelId = state.allBarrels.find((b) => b.ownerId === "p2")!.id;
    expect(() =>
      applyAction(state, {
        type: "SELL_BOURBON",
        playerId: "p1",
        barrelId,
      }),
    ).toThrow(/do not own/);
  });

  it("Silver award: bill goes to discard, slot opens, no prestige granted", () => {
    const silverBill = makeMashBill(
      {
        defId: "silver_basic",
        name: "Silver Basic",
        ageBands: [2, 4, 6],
        demandBands: [2, 4, 6],
        rewardGrid: [
          [1, 2, 3],
          [2, 4, 5],
          [3, 5, 6],
        ],
        silverAward: { minAge: 4, minDemand: 4 },
      },
      300,
    );
    let state = makeTestGame({ startingDemand: 5 });
    state = advanceToActionPhase(state, [1, 1]);
    state = placeBarrel(state, "p1", silverBill, 5);
    const barrelId = state.allBarrels.find((b) => b.phase === "aging")!.id;
    state = applyAction(state, {
      type: "SELL_BOURBON",
      playerId: "p1",
      barrelId,
    });
    // Slot opens — barrel record is gone.
    expect(state.allBarrels.find((b) => b.id === barrelId)).toBeUndefined();
    // Bill cycles into the bourbon discard.
    expect(state.bourbonDiscard.some((b) => b.defId === "silver_basic")).toBe(true);
    // No prestige for Vanilla on Silver.
    expect(state.players.find((p) => p.id === "p1")!.prestige).toBe(0);
  });

  it("Gold award: bill retired, slot opens, +1 prestige granted", () => {
    const goldBill = makeMashBill(
      {
        defId: "gold_basic",
        name: "Gold Basic",
        ageBands: [2, 4, 6],
        demandBands: [2, 4, 6],
        rewardGrid: [
          [1, 2, 3],
          [2, 4, 5],
          [3, 5, 6],
        ],
        goldAward: { minAge: 4, minDemand: 4 },
      },
      350,
    );
    let state = makeTestGame({ startingDemand: 5 });
    state = advanceToActionPhase(state, [1, 1]);
    state = placeBarrel(state, "p1", goldBill, 5);
    const barrelId = state.allBarrels.find((b) => b.phase === "aging")!.id;
    state = applyAction(state, {
      type: "SELL_BOURBON",
      playerId: "p1",
      barrelId,
    });
    // Slot opens.
    expect(state.allBarrels.find((b) => b.id === barrelId)).toBeUndefined();
    // Bill retired — not in deck OR discard.
    expect(state.bourbonDiscard.some((b) => b.defId === "gold_basic")).toBe(false);
    expect(state.bourbonDeck.some((b) => b.defId === "gold_basic")).toBe(false);
    expect(state.retiredBills.some((b) => b.defId === "gold_basic")).toBe(true);
    // +1 prestige.
    expect(state.players.find((p) => p.id === "p1")!.prestige).toBe(1);
  });

  it("prestige adds +1 rep per point to Silver/Gold sales but not base sales", () => {
    const baseBill = testBill("common");
    const silverBill = makeMashBill(
      {
        defId: "silver_prestige_check",
        name: "Silver",
        ageBands: [2, 4, 6],
        demandBands: [2, 4, 6],
        rewardGrid: [[1, 2, 3], [2, 4, 5], [3, 5, 6]],
        silverAward: { minAge: 4, minDemand: 4 },
      },
      360,
    );
    let state = makeTestGame({ startingDemand: 5 });
    state = advanceToActionPhase(state, [1, 1]);
    // Seed player with 3 prestige directly.
    state = {
      ...state,
      players: state.players.map((p) =>
        p.id === "p1" ? { ...p, prestige: 3 } : p,
      ),
    };
    // Base sale (no award): prestige NOT applied.
    state = placeBarrel(state, "p1", baseBill, 5);
    const baseBarrelId = state.allBarrels.find(
      (b) => b.ownerId === "p1" && b.phase === "aging",
    )!.id;
    const beforeRep = state.players.find((p) => p.id === "p1")!.reputation;
    state = applyAction(state, {
      type: "SELL_BOURBON",
      playerId: "p1",
      barrelId: baseBarrelId,
    });
    // v3.0 Line system: drain the pending placement before the next sale.
    state = applyAction(state, {
      type: "PLACE_BOTTLE",
      playerId: "p1",
      destination: { kind: "inventory" },
    });
    // Grid value at age 5 / demand 5 = 4. Floor 3 not binding. No prestige.
    expect(state.players.find((p) => p.id === "p1")!.reputation).toBe(beforeRep + 4);

    // Silver sale: prestige IS applied.
    state = placeBarrel(state, "p1", silverBill, 5);
    const silverBarrelId = state.allBarrels.find(
      (b) => b.ownerId === "p1" && b.phase === "aging",
    )!.id;
    const beforeSilverRep = state.players.find((p) => p.id === "p1")!.reputation;
    state = applyAction(state, {
      type: "SELL_BOURBON",
      playerId: "p1",
      barrelId: silverBarrelId,
    });
    state = applyAction(state, {
      type: "PLACE_BOTTLE",
      playerId: "p1",
      destination: { kind: "inventory" },
    });
    // Demand dropped to 4 after the first sale. Grid at age 5 / demand 4 = 4.
    // Silver triggers (minAge 4, minDemand 4). Prestige adds +3.
    expect(state.players.find((p) => p.id === "p1")!.reputation).toBe(beforeSilverRep + 4 + 3);
  });
});
