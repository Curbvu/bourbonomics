import { describe, it, expect } from "vitest";
import { applyAction, validateAction } from "../src/engine.js";
import { makeMashBill, makeResourceCard } from "../src/cards.js";
import { defaultInvestmentCatalog } from "../src/defaults.js";
import { scoreEndGameLines } from "../src/lines/scoring.js";
import { chooseAction } from "../src/ai/bot.js";
import { bourbonHallOfFameBonus } from "../src/investments.js";
import type { GameState, PlayerState } from "../src/types.js";
import {
  advanceToActionPhase,
  makeTestGame,
  giveHand,
  placeBarrel,
  slotForBill,
} from "./helpers.js";

/**
 * v3.6 — investment effect resolution. The catalog flipped 28 cards to
 * `implemented: true`; these tests exercise the new engine actions and
 * the automatic effects wired into the existing handlers.
 */

/** Grant an investment to a player by defId (pulled from the catalog). */
function grantInvestment(
  state: GameState,
  playerId: string,
  defId: string,
): GameState {
  const spec = defaultInvestmentCatalog().find((c) => c.defId === defId);
  if (!spec) throw new Error(`grantInvestment: unknown defId ${defId}`);
  return {
    ...state,
    players: state.players.map((p) =>
      p.id === playerId
        ? {
            ...p,
            investments: [
              ...p.investments,
              { ...spec, id: `inv_owned_${defId}_test` },
            ],
          }
        : p,
    ),
  };
}

const sellableBill = () =>
  makeMashBill(
    {
      defId: "v36_sell_bill",
      name: "v3.6 Sell Bill",
      tier: "common",
      ageBands: [2, 4, 6],
      demandBands: [2, 4, 6],
      rewardGrid: [
        [1, 2, 3],
        [2, 4, 5],
        [3, 5, 6],
      ],
    },
    700,
  );

describe("v3.6 — Bourbon Hall of Fame", () => {
  it("bonus is +1 per distinct bill sold, capped at +6", () => {
    const base = { investments: [{ defId: "bourbon_hall_of_fame" }] };
    expect(
      bourbonHallOfFameBonus({
        ...base,
        soldBillDefIds: ["a", "b", "c"],
      } as unknown as PlayerState),
    ).toBe(3);
    expect(
      bourbonHallOfFameBonus({
        ...base,
        soldBillDefIds: ["a", "b", "c", "d", "e", "f", "g", "h"],
      } as unknown as PlayerState),
    ).toBe(6);
  });

  it("returns 0 when the player does not own the investment", () => {
    expect(
      bourbonHallOfFameBonus({
        investments: [],
        soldBillDefIds: ["a", "b"],
      } as unknown as PlayerState),
    ).toBe(0);
  });

  it("folds the bonus into the end-game total", () => {
    let state = makeTestGame();
    state = grantInvestment(state, "p1", "bourbon_hall_of_fame");
    state = {
      ...state,
      players: state.players.map((p) =>
        p.id === "p1" ? { ...p, soldBillDefIds: ["x", "y"] } : p,
      ),
    };
    const p1 = state.players.find((p) => p.id === "p1")!;
    const score = scoreEndGameLines(p1);
    // No portfolios filled in a default test game, so the +2 Hall of
    // Fame bonus is the only contribution.
    expect(score.total).toBe(2);
  });

  it("SELL_BOURBON records distinct source bills (deduped)", () => {
    let state = makeTestGame({ startingDemand: 6 });
    state = advanceToActionPhase(state, [1, 1]);
    state = placeBarrel(state, "p1", sellableBill(), 5);
    const barrelId = state.allBarrels.find((b) => b.phase === "aging")!.id;
    state = applyAction(state, { type: "SELL_BOURBON", playerId: "p1", barrelId });
    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.soldBillDefIds).toEqual(["v36_sell_bill"]);
    if (p1.pendingBottlePlacement) {
      state = applyAction(state, {
        type: "PLACE_BOTTLE",
        playerId: "p1",
        destination: { kind: "inventory" },
      });
    }

    // Sell a second barrel of the same bill — no duplicate entry.
    state = placeBarrel(state, "p1", sellableBill(), 5);
    const barrel2 = state.allBarrels.find(
      (b) => b.ownerId === "p1" && b.phase === "aging",
    )!.id;
    state = applyAction(state, {
      type: "SELL_BOURBON",
      playerId: "p1",
      barrelId: barrel2,
    });
    expect(
      state.players.find((p) => p.id === "p1")!.soldBillDefIds,
    ).toEqual(["v36_sell_bill"]);
  });
});

describe("v3.6 — Trade Lobby (SHIFT_DEMAND)", () => {
  it("nudges shared demand by ±1, once per round", () => {
    let state = makeTestGame({ startingDemand: 6 });
    state = advanceToActionPhase(state, [3, 3]);
    state = grantInvestment(state, "p1", "trade_lobby");
    expect(state.demand).toBe(6);

    state = applyAction(state, { type: "SHIFT_DEMAND", playerId: "p1", delta: 1 });
    expect(state.demand).toBe(7);

    // Second shift this round is rejected.
    expect(
      validateAction(state, { type: "SHIFT_DEMAND", playerId: "p1", delta: -1 })
        .legal,
    ).toBe(false);
  });

  it("rejects the shift if the player does not own Trade Lobby", () => {
    let state = makeTestGame({ startingDemand: 6 });
    state = advanceToActionPhase(state, [3, 3]);
    expect(
      validateAction(state, { type: "SHIFT_DEMAND", playerId: "p1", delta: 1 })
        .legal,
    ).toBe(false);
  });

  it("clamps demand to the 0..12 track bounds", () => {
    let state = makeTestGame({ startingDemand: 12 });
    state = advanceToActionPhase(state, [6, 6]);
    state = grantInvestment(state, "p1", "trade_lobby");
    state = applyAction(state, { type: "SHIFT_DEMAND", playerId: "p1", delta: 1 });
    expect(state.demand).toBe(12);
  });
});

describe("v3.6 — Warehouse store / retrieve", () => {
  it("stores a hand card and retrieves it", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state);
    state = {
      ...state,
      players: state.players.map((p) =>
        p.id === "p1" ? { ...p, warehouseUnlocked: true } : p,
      ),
    };
    const card = makeResourceCard("corn", "wh-test", 9);
    state = giveHand(state, "p1", [card]);

    state = applyAction(state, {
      type: "WAREHOUSE_STORE",
      playerId: "p1",
      cardId: card.id,
    });
    let p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.warehouseSlot?.id).toBe(card.id);
    expect(p1.hand).toHaveLength(0);

    state = applyAction(state, { type: "WAREHOUSE_RETRIEVE", playerId: "p1" });
    p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.warehouseSlot).toBeNull();
    expect(p1.hand.map((c) => c.id)).toContain(card.id);
  });

  it("rejects storing when the warehouse is locked", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state);
    const card = makeResourceCard("corn", "wh-locked", 9);
    state = giveHand(state, "p1", [card]);
    expect(
      validateAction(state, {
        type: "WAREHOUSE_STORE",
        playerId: "p1",
        cardId: card.id,
      }).legal,
    ).toBe(false);
  });
});

describe("v3.6 — RESOLVE_INVESTMENT_CHOICE", () => {
  it("gates the player to RESOLVE_INVESTMENT_CHOICE while a choice is pending", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state);
    state = {
      ...state,
      players: state.players.map((p) =>
        p.id === "p1"
          ? {
              ...p,
              pendingInvestmentChoice: {
                defId: "master_distiller",
                investmentId: "inv_owned_master_distiller_test",
              },
            }
          : p,
      ),
    };
    // Any non-resolve action is illegal until the choice clears.
    expect(
      validateAction(state, { type: "PASS_TURN", playerId: "p1" }).legal,
    ).toBe(false);
    state = applyAction(state, {
      type: "RESOLVE_INVESTMENT_CHOICE",
      playerId: "p1",
      tag: "wheated",
    });
    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.pendingInvestmentChoice).toBeNull();
    expect(p1.masterDistillerTag).toBe("wheated");
  });

  it("brand_ambassador adds a permanent +2 demand read to the chosen barrel", () => {
    let state = makeTestGame({ startingDemand: 6 });
    state = advanceToActionPhase(state, [3, 3]);
    state = placeBarrel(state, "p1", sellableBill(), 4);
    const barrel = state.allBarrels.find((b) => b.ownerId === "p1")!;
    const before = barrel.demandBandOffset;
    state = {
      ...state,
      players: state.players.map((p) =>
        p.id === "p1"
          ? {
              ...p,
              pendingInvestmentChoice: {
                defId: "brand_ambassador",
                investmentId: "inv_owned_brand_ambassador_test",
              },
            }
          : p,
      ),
    };
    state = applyAction(state, {
      type: "RESOLVE_INVESTMENT_CHOICE",
      playerId: "p1",
      barrelId: barrel.id,
    });
    const after = state.allBarrels.find((b) => b.id === barrel.id)!;
    expect(after.demandBandOffset).toBe(before + 2);
  });

  it("climate_controlled_warehouse marks the chosen slot aging-immune", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state);
    const p1 = state.players.find((p) => p.id === "p1")!;
    const slotId = p1.rickhouseSlots[0]!.id;
    state = {
      ...state,
      players: state.players.map((p) =>
        p.id === "p1"
          ? {
              ...p,
              pendingInvestmentChoice: {
                defId: "climate_controlled_warehouse",
                investmentId: "inv_owned_ccw_test",
              },
            }
          : p,
      ),
    };
    state = applyAction(state, {
      type: "RESOLVE_INVESTMENT_CHOICE",
      playerId: "p1",
      slotId,
    });
    expect(
      state.players.find((p) => p.id === "p1")!.climateControlledSlotIds,
    ).toContain(slotId);
  });

  it("rejects a brand_ambassador choice targeting another player's barrel", () => {
    let state = makeTestGame({ startingDemand: 6 });
    state = advanceToActionPhase(state, [3, 3]);
    state = placeBarrel(state, "p2", sellableBill(), 4);
    const p2Barrel = state.allBarrels.find((b) => b.ownerId === "p2")!;
    state = {
      ...state,
      players: state.players.map((p) =>
        p.id === "p1"
          ? {
              ...p,
              pendingInvestmentChoice: {
                defId: "brand_ambassador",
                investmentId: "inv_owned_brand_ambassador_test",
              },
            }
          : p,
      ),
    };
    expect(
      validateAction(state, {
        type: "RESOLVE_INVESTMENT_CHOICE",
        playerId: "p1",
        barrelId: p2Barrel.id,
      }).legal,
    ).toBe(false);
  });
});

describe("v3.6 — Cooperage", () => {
  it("returns the first committed cask to hand but still completes the recipe", () => {
    let state = makeTestGame();
    const mbId = state.allBarrels.find(
      (b) => b.ownerId === "p1" && b.phase === "ready",
    )!.attachedMashBill.id;
    state = advanceToActionPhase(state);
    state = grantInvestment(state, "p1", "cooperage");
    state = giveHand(state, "p1", [
      makeResourceCard("cask", "p1", 0),
      makeResourceCard("corn", "p1", 1),
      makeResourceCard("rye", "p1", 2),
    ]);
    const slotId = slotForBill(state, "p1", mbId);
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      cardIds: ["card_p1_cask_0", "card_p1_corn_1", "card_p1_rye_2"],
      slotId,
    });

    const p1 = state.players.find((p) => p.id === "p1")!;
    const barrel = state.allBarrels.find((b) => b.slotId === slotId)!;
    // The barrel completes even though the cask was handed back.
    expect(barrel.phase).toBe("aging");
    expect(barrel.refundedCaskCount).toBe(1);
    // The cask returned to hand; the grain/corn stayed locked.
    expect(p1.hand.map((c) => c.id)).toContain("card_p1_cask_0");
    expect(barrel.productionCards.map((c) => c.id).sort()).toEqual(
      ["card_p1_corn_1", "card_p1_rye_2"].sort(),
    );
    // Round use is consumed so a second cask this round is not refunded.
    expect(p1.investmentRoundUses).toContain("cooperage");
  });

  it("does not refund a grain-only commit (no cask in the pile)", () => {
    let state = makeTestGame();
    const mbId = state.allBarrels.find(
      (b) => b.ownerId === "p1" && b.phase === "ready",
    )!.attachedMashBill.id;
    state = advanceToActionPhase(state);
    state = grantInvestment(state, "p1", "cooperage");
    state = giveHand(state, "p1", [
      makeResourceCard("corn", "p1", 1),
      makeResourceCard("rye", "p1", 2),
    ]);
    const slotId = slotForBill(state, "p1", mbId);
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      cardIds: ["card_p1_corn_1", "card_p1_rye_2"],
      slotId,
    });
    const p1 = state.players.find((p) => p.id === "p1")!;
    const barrel = state.allBarrels.find((b) => b.slotId === slotId)!;
    // No cask was committed, so the once-per-round use is preserved.
    expect(barrel.refundedCaskCount).toBe(0);
    expect(p1.investmentRoundUses).not.toContain("cooperage");
  });
});

describe("v3.6 — Marketing Department", () => {
  it("rerolls a die once per round when the opening roll fails to raise demand", () => {
    let state = makeTestGame({ startingDemand: 6 });
    state = advanceToActionPhase(state, [3, 3]); // holds at 6
    state = grantInvestment(state, "p1", "marketing_department");
    state = {
      ...state,
      players: state.players.map((p) =>
        p.id === "p1"
          ? { ...p, needsDemandRoll: true, investmentRoundUses: [] }
          : p,
      ),
    };
    state = applyAction(state, {
      type: "ROLL_DEMAND",
      playerId: "p1",
      roll: [1, 1],
    });
    const p1 = state.players.find((p) => p.id === "p1")!;
    // The reroll branch fired and consumed the once-per-round use.
    expect(p1.investmentRoundUses).toContain("marketing_department");
  });

  it("does not reroll without the investment", () => {
    let state = makeTestGame({ startingDemand: 6 });
    state = advanceToActionPhase(state, [3, 3]);
    state = {
      ...state,
      players: state.players.map((p) =>
        p.id === "p1"
          ? { ...p, needsDemandRoll: true, investmentRoundUses: [] }
          : p,
      ),
    };
    state = applyAction(state, {
      type: "ROLL_DEMAND",
      playerId: "p1",
      roll: [1, 1],
    });
    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.investmentRoundUses).not.toContain("marketing_department");
    const last = state.demandRolls[state.demandRolls.length - 1]!;
    expect(last.roll).toEqual([1, 1]);
  });
});

describe("v3.6 — bot never deadlocks on a pending investment choice", () => {
  it("auto-resolves master_distiller via chooseAction", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state);
    state = {
      ...state,
      players: state.players.map((p) =>
        p.id === "p1"
          ? {
              ...p,
              pendingInvestmentChoice: {
                defId: "master_distiller",
                investmentId: "inv_owned_master_distiller_test",
              },
            }
          : p,
      ),
    };
    const action = chooseAction(state, "p1");
    expect(action.type).toBe("RESOLVE_INVESTMENT_CHOICE");
    // The chosen action must be legal (no deadlock).
    expect(validateAction(state, action).legal).toBe(true);
  });

  it("auto-resolves brand_ambassador to an owned barrel", () => {
    let state = makeTestGame({ startingDemand: 6 });
    state = advanceToActionPhase(state, [3, 3]);
    state = placeBarrel(state, "p1", sellableBill(), 4);
    state = {
      ...state,
      players: state.players.map((p) =>
        p.id === "p1"
          ? {
              ...p,
              pendingInvestmentChoice: {
                defId: "brand_ambassador",
                investmentId: "inv_owned_brand_ambassador_test",
              },
            }
          : p,
      ),
    };
    const action = chooseAction(state, "p1");
    expect(action.type).toBe("RESOLVE_INVESTMENT_CHOICE");
    expect(validateAction(state, action).legal).toBe(true);
  });
});
