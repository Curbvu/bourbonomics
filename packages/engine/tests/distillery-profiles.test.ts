import { describe, expect, it } from "vitest";
import { initializeGame } from "../src/initialize.js";
import { defaultDistilleryPool } from "../src/distilleries.js";
import { defaultMashBillCatalog, defaultStarterCards } from "../src/defaults.js";
import type { Distillery } from "../src/types.js";

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
// still supports the catalog, and structural fields (slots, maxSlots)
// take effect at distillery-select time. Most v3 abilities are
// design-only stubs (`implemented: false`) until dedicated engine
// hooks land — those scenarios stay skipped for now.
describe("Distillery profiles — Structural fields", () => {
  it("v3: Vanilla ships 4 rickhouse slots", () => {
    const state = gameWithDistilleries(["vanilla", "vanilla"]);
    expect(state.players[0]!.rickhouseSlots).toHaveLength(4);
    expect(state.players[1]!.rickhouseSlots).toHaveLength(4);
  });

  it("v3: The Estate ships 5 rickhouse slots", () => {
    const state = gameWithDistilleries(["estate", "vanilla"]);
    expect(state.players[0]!.rickhouseSlots).toHaveLength(5);
    expect(state.players[1]!.rickhouseSlots).toHaveLength(4);
  });

  it("v3: The Artisanal Distillery ships 3 slots, hard-capped", () => {
    const state = gameWithDistilleries(["artisanal", "vanilla"]);
    const artisanal = state.players[0]!;
    expect(artisanal.rickhouseSlots).toHaveLength(3);
    // Hard cap: maxSlots field locks expansion.
    expect(artisanal.distillery?.maxSlots).toBe(3);
  });
});

describe.skip("Distillery profiles — v3 abilities (not yet resolved)", () => {
  it("Quick-Turn: first aging commit advances 2 years for 2 cards", () => {
    // Engine hook pending — flip implemented when AGE_BOURBON resolves
    // the first-commit branch.
  });

  it("Patient Cooper: cannot sell before age 4; reads grid at demand+1", () => {
    // Engine hook pending — SELL_BOURBON gating + demand-band offset.
  });

  it("Single-Barrel House: max 1 aging barrel; Specialty grants +2 rep", () => {
    // Engine hook pending — barrel-phase transition cap + sale-rep multiplier.
  });

  it("Storm Chaser: re-roll one die; no sale at demand 5/6", () => {
    // Engine hook pending — ROLL_DEMAND mulligan + SELL_BOURBON gating.
  });

  it("Mothballed: 2 pre-aged barrels + 8-card starter + bill embargo R1-3", () => {
    // Engine hook pending — multi-pre-aged-barrel placement + DRAW_MASH_BILL gating.
  });
});
