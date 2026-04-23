import { describe, expect, it } from "vitest";
import { summarizeMash, validateMash } from "@/lib/rules/mash";
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

  it("rejects > 6 cards", () => {
    const seven = [
      r("cask"),
      r("corn"),
      r("corn"),
      r("rye"),
      r("rye"),
      r("wheat"),
      r("wheat"),
    ];
    expect(validateMash(seven).ok).toBe(false);
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
    expect(b.total).toBe(5);
  });
});
