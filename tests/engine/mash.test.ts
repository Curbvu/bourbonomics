import { describe, expect, it } from "vitest";
import { evaluateRecipe, summarizeMash, validateMash } from "@/lib/rules/mash";
import type { ResourceCardInstance } from "@/lib/engine/state";
import type { ResourceType } from "@/lib/catalogs/types";

let counter = 0;
function r(type: ResourceType): ResourceCardInstance {
  return {
    instanceId: `t${counter++}`,
    resource: type,
    specialtyId: null,
  };
}

describe("mash validation", () => {
  it("rejects empty mash", () => {
    expect(validateMash([])).toEqual({ ok: false, reason: "Mash is empty" });
  });

  it("requires exactly 1 cask", () => {
    expect(validateMash([r("corn"), r("rye")]).ok).toBe(false);
    expect(validateMash([r("cask"), r("cask"), r("corn"), r("rye")]).ok).toBe(false);
  });

  it("requires ≥1 corn", () => {
    expect(validateMash([r("cask"), r("rye")]).ok).toBe(false);
  });

  it("requires ≥1 grain", () => {
    expect(validateMash([r("cask"), r("corn")]).ok).toBe(false);
  });

  it("accepts a 7-card variety mash (3 corn + 3 rye + cask)", () => {
    const sevenCard = [
      r("cask"),
      r("corn"),
      r("corn"),
      r("corn"),
      r("rye"),
      r("rye"),
      r("rye"),
    ];
    expect(validateMash(sevenCard).ok).toBe(true);
  });

  it("rejects > 9 cards", () => {
    const ten = [
      r("cask"),
      r("corn"),
      r("corn"),
      r("corn"),
      r("rye"),
      r("rye"),
      r("rye"),
      r("wheat"),
      r("wheat"),
      r("barley"),
    ];
    expect(validateMash(ten).ok).toBe(false);
  });

  it("accepts the canonical examples from rules", () => {
    expect(
      validateMash([r("cask"), r("corn"), r("corn"), r("corn"), r("corn"), r("rye")]).ok,
    ).toBe(true);
    expect(
      validateMash([r("cask"), r("corn"), r("rye"), r("rye")]).ok,
    ).toBe(true);
    expect(
      validateMash([r("cask"), r("corn"), r("corn"), r("rye"), r("rye")]).ok,
    ).toBe(true);
  });

  it("summarizes counts correctly", () => {
    const b = summarizeMash([
      r("cask"),
      r("corn"),
      r("corn"),
      r("rye"),
      r("wheat"),
    ]);
    expect(b.cask).toBe(1);
    expect(b.corn).toBe(2);
    expect(b.rye).toBe(1);
    expect(b.wheat).toBe(1);
    expect(b.barley).toBe(0);
    expect(b.grain).toBe(2);
    expect(b.grainTotal).toBe(4);
    expect(b.total).toBe(5);
  });
});

describe("mash recipe enforcement", () => {
  it("rejects a high-rye bill that has only 1 rye", () => {
    const result = validateMash(
      [r("cask"), r("corn"), r("rye")],
      { rye: { min: 3 } },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/≥3 rye/);
  });

  it("accepts a high-rye bill with 3 rye", () => {
    const result = validateMash(
      [r("cask"), r("corn"), r("rye"), r("rye"), r("rye")],
      { rye: { min: 3 } },
    );
    expect(result.ok).toBe(true);
  });

  it("rejects a wheated bill that includes rye (max=0)", () => {
    const result = validateMash(
      [r("cask"), r("corn"), r("wheat"), r("rye")],
      { wheat: { min: 1 }, rye: { max: 0 } },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/forbids rye/);
  });

  it("rejects a four-grain bill missing one of the small grains", () => {
    const result = validateMash(
      [r("cask"), r("corn"), r("rye"), r("wheat")],
      {
        barley: { min: 1 },
        rye: { min: 1 },
        wheat: { min: 1 },
      },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/≥1 barley/);
  });

  it("rejects when total grain count falls under recipe.grain.min", () => {
    const result = validateMash(
      [r("cask"), r("corn"), r("rye")],
      { grain: { min: 4 } },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/≥4 total grain/);
  });

  it("evaluateRecipe surfaces per-check current/min for the UI", () => {
    const breakdown = summarizeMash([
      r("cask"),
      r("corn"),
      r("rye"),
      r("rye"),
    ]);
    const checks = evaluateRecipe(breakdown, {
      rye: { min: 3 },
      wheat: { max: 0 },
    });
    expect(checks).toHaveLength(2);
    const rye = checks.find((c) => c.key === "rye")!;
    expect(rye.current).toBe(2);
    expect(rye.min).toBe(3);
    expect(rye.ok).toBe(false);
    const wheat = checks.find((c) => c.key === "wheat")!;
    expect(wheat.ok).toBe(true);
  });
});
