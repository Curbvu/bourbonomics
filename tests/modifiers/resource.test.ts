import { describe, expect, it } from "vitest";
import { applySellOps, applyMakeOps } from "@/lib/modifiers/resource";
import { createInitialState } from "@/lib/engine/setup";
import type { BarrelInstance, ResourceCardInstance } from "@/lib/engine/state";

function game() {
  return createInitialState({
    id: "g",
    seed: 1,
    seats: [
      { name: "A", kind: "human" },
      { name: "B", kind: "bot", botDifficulty: "easy" },
    ],
  });
}

function resource(
  resource: ResourceCardInstance["resource"],
  specialtyId: string | null = null,
): ResourceCardInstance {
  return { instanceId: Math.random().toString(), resource, specialtyId };
}

function barrel(mash: ResourceCardInstance[], age = 4): BarrelInstance {
  return {
    barrelId: "b",
    ownerId: "p1",
    rickhouseId: "rickhouse-0",
    mash,
    mashBillId: "test-bill",
    age,
    barreledOnRound: 1,
  };
}

describe("resource modifier — on_sell", () => {
  it("applies revenue_bonus from new_american_oak (+$1 once)", () => {
    const s = game();
    const b = barrel([resource("cask", "new_american_oak"), resource("corn"), resource("rye")]);
    const acc = applySellOps({
      state: s,
      playerId: "p1",
      barrel: b,
      baseDemand: 6,
      baseAge: 4,
    });
    expect(acc.revenueBonus).toBe(1);
  });

  it("demand_lookup_shift from honey_barrel shifts lookup by +1", () => {
    const s = game();
    const b = barrel([resource("cask", "honey_barrel"), resource("corn"), resource("rye")]);
    const acc = applySellOps({
      state: s,
      playerId: "p1",
      barrel: b,
      baseDemand: 3,
      baseAge: 5,
    });
    expect(acc.demandLookupShift).toBe(1);
  });

  it("draw_bourbon_cards from wine_finish_cask triggers only when ≥2 grains", () => {
    const s = game();
    // mash has only 1 grain → no trigger
    const single = barrel([
      resource("cask", "wine_finish_cask"),
      resource("corn"),
      resource("rye"),
    ]);
    const a1 = applySellOps({
      state: s,
      playerId: "p1",
      barrel: single,
      baseDemand: 5,
      baseAge: 4,
    });
    expect(a1.extraBourbonDraws).toBe(0);

    // mash has 2 grains → triggers +1 draw
    const multi = barrel([
      resource("cask", "wine_finish_cask"),
      resource("corn"),
      resource("rye"),
      resource("wheat"),
    ]);
    const a2 = applySellOps({
      state: s,
      playerId: "p1",
      barrel: multi,
      baseDemand: 5,
      baseAge: 4,
    });
    expect(a2.extraBourbonDraws).toBe(1);
  });

  it("bourbon-grade bulk corn triggers +$2 only when mash has exactly 3 corn", () => {
    const s = game();
    const three = barrel([
      resource("cask"),
      resource("corn", "bourbon_grade_bulk"),
      resource("corn"),
      resource("corn"),
      resource("rye"),
    ]);
    const a1 = applySellOps({
      state: s,
      playerId: "p1",
      barrel: three,
      baseDemand: 5,
      baseAge: 4,
    });
    expect(a1.revenueBonus).toBe(2);

    const two = barrel([
      resource("cask"),
      resource("corn", "bourbon_grade_bulk"),
      resource("corn"),
      resource("rye"),
    ]);
    const a2 = applySellOps({
      state: s,
      playerId: "p1",
      barrel: two,
      baseDemand: 5,
      baseAge: 4,
    });
    expect(a2.revenueBonus).toBe(0);
  });
});

describe("resource modifier — on_make_bourbon", () => {
  it("high_starch_hybrid pays $1 on make", () => {
    const s = game();
    const acc = applyMakeOps({
      state: s,
      playerId: "p1",
      mash: [
        resource("cask"),
        resource("corn", "high_starch_hybrid"),
        resource("rye"),
      ],
    });
    expect(acc.bankPayout).toBe(1);
  });
});
