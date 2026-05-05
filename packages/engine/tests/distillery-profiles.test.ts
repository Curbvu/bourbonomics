import { describe, expect, it } from "vitest";
import { applyAction } from "../src/engine.js";
import { initializeGame } from "../src/initialize.js";
import { defaultDistilleryPool } from "../src/distilleries.js";
import { defaultMashBillCatalog, defaultStarterCards } from "../src/defaults.js";
import { computeCompositionBuffs } from "../src/composition.js";
import { makeCapitalCard, makeMashBill, makeResourceCard } from "../src/cards.js";
import { advanceToActionPhase, giveHand, makeTestGame, placeBarrel } from "./helpers.js";
import type { Card, Distillery } from "../src/types.js";

const r = (sub: "cask" | "corn" | "rye" | "barley" | "wheat", n = 1) =>
  makeResourceCard(sub, "t", n, false, 1);

function pickDistillery(bonus: Distillery["bonus"]): Distillery {
  const pool = defaultDistilleryPool();
  const dist = pool.find((d) => d.bonus === bonus);
  if (!dist) throw new Error(`distillery bonus ${bonus} not in pool`);
  return { ...dist, id: `dist_test_${bonus}` };
}

function gameWithDistilleries(bonuses: Distillery["bonus"][]) {
  const catalog = defaultMashBillCatalog();
  return initializeGame({
    seed: 1,
    players: bonuses.map((_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}` })),
    startingDistilleries: bonuses.map(pickDistillery),
    startingMashBills: bonuses.map((_, i) => catalog.slice(i * 3, (i + 1) * 3)),
    bourbonDeck: catalog.slice(bonuses.length * 3),
    starterDecks: bonuses.map((_, i) => defaultStarterCards(`p${i + 1}`)),
  });
}

describe("Distillery profiles — Starting state", () => {
  it("places a pre-aged starter barrel for distilleries that ship one", () => {
    const state = gameWithDistilleries(["high_rye", "wheated_baron", "old_line"]);
    expect(state.allBarrels).toHaveLength(3);
    const ages = state.allBarrels.map((b) => b.age).sort();
    expect(ages).toEqual([1, 1, 2]); // high_rye=1, wheated=1, old_line=2
  });

  it("does not place a starter barrel for Vanilla / Warehouse / Connoisseur", () => {
    const state = gameWithDistilleries(["vanilla", "warehouse", "connoisseur"]);
    expect(state.allBarrels).toHaveLength(0);
  });

  it("Connoisseur Estate drafts a 4th mash bill from the bourbon deck on bind", () => {
    const state = gameWithDistilleries(["connoisseur", "vanilla"]);
    const conn = state.players[0]!;
    expect(conn.mashBills).toHaveLength(4);
  });
});

describe("Distillery profiles — Permanent abilities", () => {
  it("High-Rye House: +1 reputation when selling a high-rye bill", () => {
    let state = makeTestGame({
      startingDemand: 6,
      startingDistilleries: [pickDistillery("high_rye"), pickDistillery("vanilla")],
    });
    state = advanceToActionPhase(state, [1, 1]);
    // Hand-rolled high-rye bill so the grid value is predictable.
    const highRyeBill = makeMashBill(
      {
        defId: "hr_test",
        name: "HR Test",
        ageBands: [2, 4, 6],
        demandBands: [2, 4, 6],
        rewardGrid: [
          [1, 1, 1],
          [1, 1, 1],
          [1, 1, 1],
        ],
        recipe: { minRye: 2 },
      },
      0,
    );
    state = placeBarrel(state, "p1", highRyeBill, 5, undefined, {
      productionCards: [r("cask", 0), r("corn", 1), r("rye", 2), r("rye", 3), r("rye", 4)],
      // Aging is corn-only so single-grain composition (rye_3) does not fire.
      agingCards: [r("corn", 10), r("corn", 11), r("corn", 12), r("corn", 13), r("corn", 14)],
    });
    state = giveHand(state, "p1", [makeCapitalCard("p1", 99)]);
    // High-Rye ships a starter barrel (age 1) — pick the test barrel by id.
    const barrelId = state.allBarrels.find(
      (b) => b.ownerId === "p1" && b.attachedMashBill.defId === "hr_test",
    )!.id;
    const repBefore = state.players.find((p) => p.id === "p1")!.reputation;
    const next = applyAction(state, {
      type: "SELL_BOURBON",
      playerId: "p1",
      barrelId,
      reputationSplit: 1, // grid value
      cardDrawSplit: 0,
    });
    const p1After = next.players.find((p) => p.id === "p1")!;
    // grid (1) + corn_3 composition bonus (0 rep, 1 draw) + high-rye sale mod (+1 rep).
    expect(p1After.reputation).toBe(repBefore + 1 + 1);
  });

  it("Wheated Baron: composition single-grain buff fires at 2+ instead of 3+", () => {
    const wheated = pickDistillery("wheated_baron");
    const buffs = computeCompositionBuffs(
      {
        productionCards: [r("cask", 0), r("corn", 1), r("wheat", 2)],
        agingCards: [r("wheat", 3), r("corn", 4)],
      },
      wheated,
    );
    expect(buffs.triggered).toContain("single_grain_3");
  });

  it("Wheated Baron: rye contributes 0 to composition counts", () => {
    const wheated = pickDistillery("wheated_baron");
    const buffs = computeCompositionBuffs(
      {
        productionCards: [r("cask", 0), r("corn", 1), r("rye", 2)],
        agingCards: [r("rye", 3), r("rye", 4), r("rye", 5)],
      },
      wheated,
    );
    // 4 rye would normally trigger single_grain_3; with rye excluded, no buff.
    expect(buffs.triggered).not.toContain("single_grain_3");
  });

  it("High-Rye: wheat contributes 0 to composition counts", () => {
    const highRye = pickDistillery("high_rye");
    const buffs = computeCompositionBuffs(
      {
        productionCards: [r("cask", 0), r("corn", 1), r("rye", 2)],
        agingCards: [r("wheat", 3), r("wheat", 4), r("wheat", 5)],
      },
      highRye,
    );
    expect(buffs.triggered).not.toContain("single_grain_3");
  });

  it("Connoisseur: all-grains buff fires at 3 distinct types and grants +3 rep", () => {
    const conn = pickDistillery("connoisseur");
    const buffs = computeCompositionBuffs(
      {
        productionCards: [r("cask", 0), r("corn", 1), r("rye", 2)],
        agingCards: [r("barley", 3), r("corn", 4)],
      },
      conn,
    );
    expect(buffs.triggered).toContain("all_grains");
    // Bonus rep only includes the all_grains contribution here.
    expect(buffs.bonusRep).toBe(3);
  });
});

describe("Distillery profiles — Constraints", () => {
  it("Warehouse first sale must be a barrel aged 4+ years", () => {
    let state = makeTestGame({
      startingDemand: 6,
      startingDistilleries: [pickDistillery("warehouse"), pickDistillery("vanilla")],
    });
    state = advanceToActionPhase(state, [1, 1]);
    const bill = makeMashBill(
      {
        defId: "wh_test",
        name: "WH Test",
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
    state = placeBarrel(state, "p1", bill, 3); // age 3 — too young
    state = giveHand(state, "p1", [makeCapitalCard("p1", 0)]);
    const barrelId = state.allBarrels[0]!.id;
    expect(() =>
      applyAction(state, {
        type: "SELL_BOURBON",
        playerId: "p1",
        barrelId,
        reputationSplit: 2,
        cardDrawSplit: 0,
      }),
    ).toThrow(/first sale must be a barrel aged 4\+ years/);
  });

  it("Connoisseur cannot draw a 5th mash bill (hand cap of 4)", () => {
    // Start with a Connoisseur game where p1 already has 4 bills.
    const catalog = defaultMashBillCatalog();
    let state = initializeGame({
      seed: 1,
      players: [{ id: "p1", name: "Alice", isBot: false }],
      startingDistilleries: [pickDistillery("connoisseur")],
      startingMashBills: [catalog.slice(0, 4)],
      bourbonDeck: catalog.slice(4),
      starterDecks: [defaultStarterCards("p1")],
    });
    state = advanceToActionPhase(state, [1, 1]);
    state = giveHand(state, "p1", [makeCapitalCard("p1", 0)]);
    expect(() =>
      applyAction(state, {
        type: "DRAW_MASH_BILL",
        playerId: "p1",
        spendCardIds: [state.players[0]!.hand[0]!.id],
      }),
    ).toThrow(/caps mash-bill hand at 4/);
  });

  it("The Broker cannot expand rickhouse via Rickhouse Expansion Permit", () => {
    // Plant a Rickhouse Expansion Permit in p1's hand.
    let state = makeTestGame({
      startingDistilleries: [pickDistillery("broker"), pickDistillery("vanilla")],
    });
    state = advanceToActionPhase(state, [1, 1]);
    const opsCard: Card[] = []; void opsCard;
    state = {
      ...state,
      players: state.players.map((p) =>
        p.id === "p1"
          ? {
              ...p,
              operationsHand: [
                {
                  id: "ops_rep_1",
                  defId: "rickhouse_expansion_permit",
                  name: "Rickhouse Expansion Permit",
                  description: "+1 slot",
                  cost: 6,
                  drawnInRound: 1,
                },
              ],
            }
          : p,
      ),
    };
    expect(() =>
      applyAction(state, {
        type: "PLAY_OPERATIONS_CARD",
        playerId: "p1",
        cardId: "ops_rep_1",
        defId: "rickhouse_expansion_permit",
      }),
    ).toThrow(/cannot expand past 4 slots/);
  });
});
