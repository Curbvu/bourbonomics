import { describe, expect, it } from "vitest";
import {
  computeCompositionBuffs,
  computeCompositionTotals,
} from "../src/composition.js";
import {
  makeCapitalCard,
  makeMashBill,
  makePremiumCapital,
  makePremiumResource,
  makeResourceCard,
} from "../src/cards.js";
import { applyAction } from "../src/engine.js";
import {
  advanceToActionPhase,
  giveHand,
  makeTestGame,
  placeBarrel,
} from "./helpers.js";
import type { Card } from "../src/types.js";

const r = (subtype: "cask" | "corn" | "rye" | "barley" | "wheat", n = 1) =>
  makeResourceCard(subtype, "test", n, false, 1);

const cap = (n: number) => makeCapitalCard("test", n, 1);

const fatGrid = () =>
  makeMashBill(
    {
      defId: "comp_test_bill",
      name: "Comp Test",
      ageBands: [2, 4, 6],
      demandBands: [2, 4, 6],
      rewardGrid: [
        [1, 2, 3],
        [2, 4, 5],
        [3, 5, 6],
      ],
    },
    777,
  );

describe("computeCompositionTotals", () => {
  it("counts plain resource cards by subtype", () => {
    const cards: Card[] = [r("cask", 0), r("cask", 1), r("corn", 2), r("rye", 3)];
    const t = computeCompositionTotals({ productionCards: cards, agingCards: [] });
    expect(t).toEqual({ cask: 2, corn: 1, rye: 1, barley: 0, wheat: 0, capital: 0 });
  });

  it("counts premium resources by their resourceCount (a 2-rye is 2 rye)", () => {
    const twoRye = makePremiumResource({
      defId: "two_rye",
      displayName: "2× Rye",
      subtype: "rye",
      resourceCount: 2,
      cost: 3,
      index: 0,
    });
    const t = computeCompositionTotals({ productionCards: [twoRye], agingCards: [] });
    expect(t.rye).toBe(2);
    expect(t.barley).toBe(0);
  });

  it("counts capital cards as 1 each regardless of capitalValue", () => {
    const brandLoan = makePremiumCapital({
      defId: "brand_loan",
      displayName: "Brand Loan",
      capitalValue: 3,
      index: 0,
    });
    const t = computeCompositionTotals({
      productionCards: [],
      agingCards: [brandLoan, cap(0), cap(1)],
    });
    expect(t.capital).toBe(3);
  });

  it("merges production and aging piles into a single tally", () => {
    const t = computeCompositionTotals({
      productionCards: [r("cask", 0), r("corn", 1), r("rye", 2)],
      agingCards: [r("rye", 3), r("rye", 4), r("wheat", 5)],
    });
    expect(t).toEqual({ cask: 1, corn: 1, rye: 3, barley: 0, wheat: 1, capital: 0 });
  });
});

describe("computeCompositionBuffs", () => {
  it("returns no buffs for a barely-legal barrel", () => {
    const buffs = computeCompositionBuffs({
      productionCards: [r("cask", 0), r("corn", 1), r("rye", 2)],
      agingCards: [r("corn", 3), r("corn", 4)],
    });
    // 1 cask, 3 corn, 1 rye. Only corn_3 fires (3+ corn).
    expect(buffs.triggered).toEqual(["corn_3"]);
    expect(buffs.bonusRep).toBe(0);
    expect(buffs.bonusDraw).toBe(1);
    expect(buffs.gridDemandBandOffset).toBe(0);
    expect(buffs.skipDemandDrop).toBe(false);
  });

  it("triggers cask_3 at exactly 3 cask units", () => {
    const buffs = computeCompositionBuffs({
      productionCards: [r("cask", 0), r("cask", 1), r("cask", 2), r("corn", 3), r("rye", 4)],
      agingCards: [],
    });
    expect(buffs.triggered).toContain("cask_3");
    expect(buffs.bonusRep).toBe(1);
  });

  it("triggers single_grain_3 for 3+ rye but not for 3 mixed grains", () => {
    const ryeBarrel = computeCompositionBuffs({
      productionCards: [r("cask", 0), r("corn", 1)],
      agingCards: [r("rye", 2), r("rye", 3), r("rye", 4)],
    });
    expect(ryeBarrel.triggered).toContain("single_grain_3");
    expect(ryeBarrel.gridDemandBandOffset).toBe(1);

    const mixedBarrel = computeCompositionBuffs({
      productionCards: [r("cask", 0), r("corn", 1)],
      agingCards: [r("rye", 2), r("barley", 3), r("wheat", 4)],
    });
    expect(mixedBarrel.triggered).not.toContain("single_grain_3");
    expect(mixedBarrel.gridDemandBandOffset).toBe(0);
  });

  it("treats a 2-rye as 2 toward the single_grain_3 threshold (so 2-rye + 1-rye = 3)", () => {
    const twoRye = makePremiumResource({
      defId: "two_rye",
      displayName: "2× Rye",
      subtype: "rye",
      resourceCount: 2,
      cost: 3,
      index: 0,
    });
    const buffs = computeCompositionBuffs({
      productionCards: [r("cask", 0), r("corn", 1), twoRye, r("rye", 2)],
      agingCards: [],
    });
    expect(buffs.triggered).toContain("single_grain_3");
  });

  it("triggers capital_2 at exactly 2 capital cards", () => {
    const buffs = computeCompositionBuffs({
      productionCards: [r("cask", 0), r("corn", 1), r("rye", 2)],
      agingCards: [cap(0), cap(1)],
    });
    expect(buffs.triggered).toContain("capital_2");
    expect(buffs.skipDemandDrop).toBe(true);
  });

  it("triggers all_grains when corn + rye + barley + wheat are all present", () => {
    const buffs = computeCompositionBuffs({
      productionCards: [r("cask", 0), r("corn", 1), r("rye", 2)],
      agingCards: [r("barley", 3), r("wheat", 4)],
    });
    expect(buffs.triggered).toContain("all_grains");
    expect(buffs.bonusRep).toBe(2);
  });

  it("does not fire all_grains when any one of the four is missing", () => {
    const buffs = computeCompositionBuffs({
      productionCards: [r("cask", 0), r("corn", 1), r("rye", 2)],
      // Missing wheat.
      agingCards: [r("barley", 3), r("barley", 4)],
    });
    expect(buffs.triggered).not.toContain("all_grains");
  });

  it("stacks all five buffs when every threshold is met", () => {
    const buffs = computeCompositionBuffs({
      // Production: 1 cask, 1 corn, 1 rye (legal mash)
      productionCards: [r("cask", 0), r("corn", 1), r("rye", 2)],
      // Aging adds 2 cask, 2 corn, 2 rye, 1 barley, 1 wheat, 2 capital.
      agingCards: [
        r("cask", 3),
        r("cask", 4),
        r("corn", 5),
        r("corn", 6),
        r("rye", 7),
        r("rye", 8),
        r("barley", 9),
        r("wheat", 10),
        cap(11),
        cap(12),
      ],
    });
    expect(buffs.triggered).toEqual([
      "cask_3",
      "corn_3",
      "single_grain_3",
      "capital_2",
      "all_grains",
    ]);
    expect(buffs.bonusRep).toBe(3); // cask_3 (+1) + all_grains (+2)
    expect(buffs.bonusDraw).toBe(1);
    expect(buffs.gridDemandBandOffset).toBe(1);
    expect(buffs.skipDemandDrop).toBe(true);
  });
});

// ============================================================
// SELL_BOURBON integration — buffs flow through to the action
// ============================================================

describe("SELL_BOURBON — composition buffs", () => {
  it("3+ cask grants +1 bonus reputation outside the split", () => {
    let state = makeTestGame({ startingDemand: 6 });
    state = advanceToActionPhase(state, [1, 1]);
    const bill = fatGrid();
    state = placeBarrel(state, "p1", bill, 5, undefined, {
      productionCards: [r("cask", 0), r("cask", 1), r("cask", 2), r("corn", 3), r("rye", 4)],
      // Pad aging to age 5 with cards that don't trigger anything else.
      agingCards: [
        r("corn", 10),
        r("corn", 11),
        r("corn", 12),
        r("corn", 13),
        r("corn", 14),
      ],
    });
    state = giveHand(state, "p1", [makeCapitalCard("p1", 0)]);
    const barrelId = state.allBarrels[0]!.id;
    // Composition triggers: cask_3 (+1 rep), corn_3 (+1 draw).
    // No single_grain_3 (only 1 rye), no all_grains (no barley/wheat).
    state = applyAction(state, {
      type: "SELL_BOURBON",
      playerId: "p1",
      barrelId,
      reputationSplit: 5, // grid value at age 5, demand 6 = 5
      cardDrawSplit: 0,
    });
    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.reputation).toBe(5 + 1); // grid + cask_3
  });

  it("3+ corn grants +1 bonus draw outside the split", () => {
    let state = makeTestGame({ startingDemand: 6 });
    state = advanceToActionPhase(state, [1, 1]);
    state = placeBarrel(state, "p1", fatGrid(), 5, undefined, {
      productionCards: [r("cask", 0), r("corn", 1), r("corn", 2), r("corn", 3), r("rye", 4)],
      // Aging cards are all rye so corn count is locked at 3 from production.
      agingCards: [r("rye", 10), r("rye", 11), r("rye", 12), r("rye", 13), r("rye", 14)],
    });
    // Stock the deck so the bonus draw has something to pull.
    state = {
      ...state,
      players: state.players.map((p) =>
        p.id === "p1"
          ? {
              ...p,
              hand: [makeCapitalCard("p1", 99)],
              deck: [makeResourceCard("rye", "p1", 50)],
              discard: [],
            }
          : p,
      ),
    };
    const barrelId = state.allBarrels[0]!.id;
    state = applyAction(state, {
      type: "SELL_BOURBON",
      playerId: "p1",
      barrelId,
      reputationSplit: 5,
      cardDrawSplit: 0,
    });
    const p1 = state.players.find((p) => p.id === "p1")!;
    // 1 capital already in hand + 1 from corn_3 buff draw = 2.
    expect(p1.hand).toHaveLength(2);
    expect(p1.deck).toHaveLength(0);
  });

  it("3+ single grain shifts the grid demand band, raising both validation and reward", () => {
    let state = makeTestGame({ startingDemand: 4 }); // mid-band
    state = advanceToActionPhase(state, [1, 1]);
    state = placeBarrel(state, "p1", fatGrid(), 5, undefined, {
      productionCards: [r("cask", 0), r("corn", 1), r("rye", 2)],
      // 3 wheat in aging triggers single_grain_3 → grid reads as if demand=5
      // Padding to age 5: 3 wheat + 2 corn.
      agingCards: [
        r("wheat", 10),
        r("wheat", 11),
        r("wheat", 12),
        r("corn", 13),
        r("corn", 14),
      ],
    });
    state = giveHand(state, "p1", [makeCapitalCard("p1", 0)]);
    const barrelId = state.allBarrels[0]!.id;
    // Without the buff: age 5 / demand 4 → middle row, middle col = 4.
    // With the buff: read as demand 5 → still middle col (band [4..6)).
    // To prove it shifts, target a barrel where the bump crosses a band.
    // demand 4 = col 1 (4..6). demand+1 = 5 = col 1 still. Doesn't cross.
    // Re-do at demand 3: col 0 (2..4); demand+1 = 4 = col 1.
    state = { ...state, demand: 3 };
    // At age 5, demand 3: row 1 col 0 = 2. With +1 band: row 1 col 1 = 4.
    state = applyAction(state, {
      type: "SELL_BOURBON",
      playerId: "p1",
      barrelId,
      reputationSplit: 4,
      cardDrawSplit: 0,
    });
    const p1 = state.players.find((p) => p.id === "p1")!;
    // grid-with-buff = 4, no other rep buffs (no cask_3, no all_grains).
    expect(p1.reputation).toBe(4);
  });

  it("2+ capital cancels the demand drop on this sale", () => {
    let state = makeTestGame({ startingDemand: 6 });
    state = advanceToActionPhase(state, [1, 1]);
    state = placeBarrel(state, "p1", fatGrid(), 5, undefined, {
      productionCards: [r("cask", 0), r("corn", 1), r("rye", 2)],
      // 2 capital in aging triggers capital_2.
      agingCards: [cap(10), cap(11), r("corn", 12), r("corn", 13), r("corn", 14)],
    });
    state = giveHand(state, "p1", [makeCapitalCard("p1", 0)]);
    const before = state.demand;
    const barrelId = state.allBarrels[0]!.id;
    state = applyAction(state, {
      type: "SELL_BOURBON",
      playerId: "p1",
      barrelId,
      reputationSplit: 5,
      cardDrawSplit: 0,
    });
    expect(state.demand).toBe(before);
  });

  it("all four grain types grant +2 bonus reputation outside the split", () => {
    let state = makeTestGame({ startingDemand: 6 });
    state = advanceToActionPhase(state, [1, 1]);
    state = placeBarrel(state, "p1", fatGrid(), 5, undefined, {
      productionCards: [r("cask", 0), r("corn", 1), r("rye", 2)],
      // Add barley + wheat in aging to round out all four grains.
      agingCards: [r("barley", 10), r("wheat", 11), r("corn", 12), r("corn", 13), r("corn", 14)],
    });
    state = giveHand(state, "p1", [makeCapitalCard("p1", 0)]);
    const barrelId = state.allBarrels[0]!.id;
    // Triggers: corn_3 (4 corn), all_grains (corn+rye+barley+wheat each ≥1).
    // No cask_3 (1 cask), no single_grain_3 (only 1 of each grain), no capital_2.
    state = applyAction(state, {
      type: "SELL_BOURBON",
      playerId: "p1",
      barrelId,
      reputationSplit: 5,
      cardDrawSplit: 0,
    });
    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.reputation).toBe(5 + 2); // grid + all_grains
  });

  it("validates against the buffed grid value (single_grain_3 raises N)", () => {
    let state = makeTestGame({ startingDemand: 3 });
    state = advanceToActionPhase(state, [1, 1]);
    state = placeBarrel(state, "p1", fatGrid(), 5, undefined, {
      productionCards: [r("cask", 0), r("corn", 1), r("rye", 2)],
      agingCards: [r("rye", 10), r("rye", 11), r("rye", 12), r("corn", 13), r("corn", 14)],
    });
    state = giveHand(state, "p1", [makeCapitalCard("p1", 0)]);
    state = { ...state, demand: 3 };
    const barrelId = state.allBarrels[0]!.id;
    // Without buff: row 1 col 0 = 2. With single_grain_3 (4+ rye): col 1 = 4.
    // A split of 4 should validate; a split of 2 should fail (legal under
    // the unbuffed grid but rejected once composition is applied).
    expect(() =>
      applyAction(state, {
        type: "SELL_BOURBON",
        playerId: "p1",
        barrelId,
        reputationSplit: 2,
        cardDrawSplit: 0,
      }),
    ).toThrow(/expected reward of 4/);
  });
});
