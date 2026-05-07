import { describe, expect, it } from "vitest";
import { applyAction } from "../src/engine.js";
import { initializeGame } from "../src/initialize.js";
import { defaultDistilleryPool } from "../src/distilleries.js";
import { defaultMashBillCatalog, defaultStarterCards } from "../src/defaults.js";
import { makeCapitalCard, makeMashBill, makeResourceCard } from "../src/cards.js";
import { advanceToActionPhase, giveHand, makeTestGame, placeBarrel, spendCardId } from "./helpers.js";
import type { Distillery } from "../src/types.js";

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

// v2.7: distilleries are feature-flagged off in active play. The engine
// still supports the full roster (kept under test in the engine source)
// but the gameplay flow runs as Vanilla-only — these scenarios stay
// skipped until the flag is restored.
describe.skip("Distillery profiles — Starting state", () => {
  it("places a pre-aged starter barrel for distilleries that ship one", () => {
    const state = gameWithDistilleries(["high_rye", "wheated_baron"]);
    const aging = state.allBarrels.filter((b) => b.phase === "aging");
    expect(aging).toHaveLength(2);
    const ages = aging.map((b) => b.age).sort();
    expect(ages).toEqual([1, 1]); // high_rye=1, wheated=1
  });

  it("v2.6: Vanilla / Connoisseur don't ship a pre-aged starter barrel — only ready bills in slots", () => {
    const state = gameWithDistilleries(["vanilla", "connoisseur"]);
    // No aging-phase starter barrels.
    const aging = state.allBarrels.filter((b) => b.phase === "aging");
    expect(aging).toHaveLength(0);
  });

  it("v2.6: Connoisseur Estate drafts 4 bills directly into slots (no open slots at start)", () => {
    const state = gameWithDistilleries(["connoisseur", "vanilla"]);
    const conn = state.players[0]!;
    const slottedBills = state.allBarrels.filter((b) => b.ownerId === conn.id);
    expect(slottedBills).toHaveLength(4);
    // All four slots are taken — no open slots.
    const taken = new Set(slottedBills.map((b) => b.slotId));
    const openSlots = conn.rickhouseSlots.filter((s) => !taken.has(s.id));
    expect(openSlots).toHaveLength(0);
  });
});

// v2.7: distilleries are feature-flagged off in active play. The engine
// still supports the full roster (kept under test in the engine source)
// but the gameplay flow runs as Vanilla-only — these scenarios stay
// skipped until the flag is restored.
describe.skip("Distillery profiles — Permanent abilities", () => {
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
      agingCards: [r("corn", 10), r("corn", 11), r("corn", 12), r("corn", 13), r("corn", 14)],
    });
    state = giveHand(state, "p1", [makeCapitalCard("p1", 99)]);
    const barrelId = state.allBarrels.find(
      (b) => b.ownerId === "p1" && b.attachedMashBill?.defId === "hr_test",
    )!.id;
    const repBefore = state.players.find((p) => p.id === "p1")!.reputation;
    const next = applyAction(state, {
      type: "SELL_BOURBON",
      playerId: "p1",
      barrelId,
      reputationSplit: 1, // grid value
      cardDrawSplit: 0,
      spendCardId: spendCardId(state, "p1"),
    });
    const p1After = next.players.find((p) => p.id === "p1")!;
    // grid (1) + high-rye sale mod (+1 rep).
    expect(p1After.reputation).toBe(repBefore + 1 + 1);
  });
});

// v2.7: distilleries are feature-flagged off in active play. The engine
// still supports the full roster (kept under test in the engine source)
// but the gameplay flow runs as Vanilla-only — these scenarios stay
// skipped until the flag is restored.
describe.skip("Distillery profiles — Constraints", () => {
  it("v2.6: Connoisseur Estate cannot draw a 5th mash bill (slotted-bill cap of 4)", () => {
    // Connoisseur drafts 4 bills into 4 slots at setup. With every slot
    // bound, the player has no open slot — DRAW_MASH_BILL is illegal.
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
    ).toThrow(/no open slot/);
  });

});
