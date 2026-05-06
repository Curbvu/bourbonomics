/**
 * v2.7 market economy — sanity checks on the four-band resource system
 * and the $1 / $3 / $5 capital ladder. Locks the supply shape so the
 * UI badge logic and the rule docs don't drift.
 */

import { describe, it, expect } from "vitest";
import { defaultMarketSupply } from "../src/defaults.js";
import { paymentValue } from "../src/cards.js";

const RESOURCE_SUBTYPES = ["cask", "corn", "rye", "barley", "wheat"] as const;

describe("market supply — four-band resource economy", () => {
  it("Commons exist for every subtype, cost 1, count 1, no effect", () => {
    const supply = defaultMarketSupply();
    for (const subtype of RESOURCE_SUBTYPES) {
      const commons = supply.filter(
        (c) => c.type === "resource" && c.subtype === subtype && !c.premium,
      );
      expect(commons.length, `commons(${subtype})`).toBeGreaterThanOrEqual(1);
      for (const c of commons) {
        expect(c.cost ?? 1).toBe(1);
        expect(c.resourceCount ?? 1).toBe(1);
        expect(c.effect).toBeUndefined();
      }
    }
  });

  it("Doubles cost 3, count 2, and have no on-sale effect", () => {
    const doubles = defaultMarketSupply().filter(
      (c) =>
        c.type === "resource" &&
        c.premium === true &&
        (c.cardDefId.startsWith("double_") && !c.cardDefId.startsWith("double_superior_")),
    );
    expect(doubles.length).toBeGreaterThan(0);
    for (const d of doubles) {
      expect(d.cost, `${d.cardDefId} cost`).toBe(3);
      expect(d.resourceCount, `${d.cardDefId} count`).toBe(2);
      expect(d.effect).toBeUndefined();
    }
  });

  it("Specialties cost 3, count 1, and grant +1 rep on sale", () => {
    const specs = defaultMarketSupply().filter(
      (c) =>
        c.type === "resource" &&
        c.premium === true &&
        c.cardDefId.startsWith("superior_"),
    );
    expect(specs.length).toBeGreaterThan(0);
    for (const s of specs) {
      expect(s.cost, `${s.cardDefId} cost`).toBe(3);
      expect(s.resourceCount, `${s.cardDefId} count`).toBe(1);
      expect(s.effect).toEqual({ kind: "rep_on_sale_flat", when: "on_sale", rep: 1 });
    }
  });

  it("Double Specialties cost 6, count 2, and grant +1 rep on sale", () => {
    const ds = defaultMarketSupply().filter(
      (c) =>
        c.type === "resource" &&
        c.premium === true &&
        c.cardDefId.startsWith("double_superior_"),
    );
    expect(ds.length).toBeGreaterThan(0);
    for (const d of ds) {
      expect(d.cost, `${d.cardDefId} cost`).toBe(6);
      expect(d.resourceCount, `${d.cardDefId} count`).toBe(2);
      expect(d.effect).toEqual({ kind: "rep_on_sale_flat", when: "on_sale", rep: 1 });
    }
  });

  it("the four bands together cover roughly the spec'd distribution", () => {
    const supply = defaultMarketSupply().filter((c) => c.type === "resource");
    const total = supply.length;
    const commons = supply.filter((c) => !c.premium).length;
    const doubles = supply.filter(
      (c) =>
        c.premium &&
        c.cardDefId.startsWith("double_") &&
        !c.cardDefId.startsWith("double_superior_"),
    ).length;
    const specs = supply.filter((c) => c.premium && c.cardDefId.startsWith("superior_")).length;
    const dspecs = supply.filter((c) => c.premium && c.cardDefId.startsWith("double_superior_")).length;
    expect(commons + doubles + specs + dspecs).toBe(total);
    // Loose distribution sanity: commons are the plurality and double-
    // specialties stay rare.
    expect(commons / total).toBeGreaterThan(0.4);
    expect(dspecs / total).toBeLessThan(0.15);
  });
});

describe("market supply — $1 / $3 / $5 capital ladder", () => {
  it("includes basic $1 capitals", () => {
    const ones = defaultMarketSupply().filter(
      (c) => c.type === "capital" && (c.capitalValue ?? 1) === 1,
    );
    expect(ones.length).toBeGreaterThanOrEqual(3);
    for (const c of ones) {
      expect(c.cost ?? 1).toBe(1);
      expect(paymentValue(c)).toBe(1);
    }
  });

  it("includes $3 capitals priced at 3", () => {
    const threes = defaultMarketSupply().filter(
      (c) => c.type === "capital" && c.capitalValue === 3,
    );
    expect(threes.length).toBeGreaterThanOrEqual(2);
    for (const c of threes) {
      expect(c.cost).toBe(3);
      expect(paymentValue(c)).toBe(3);
    }
  });

  it("includes $5 capitals priced at 5 with no on-spend effect", () => {
    const fives = defaultMarketSupply().filter(
      (c) => c.type === "capital" && c.capitalValue === 5,
    );
    expect(fives.length).toBeGreaterThanOrEqual(1);
    for (const c of fives) {
      expect(c.cost).toBe(5);
      expect(paymentValue(c)).toBe(5);
      expect(c.effect).toBeUndefined();
    }
  });

  it("does not mint $2 or $4 capitals (legacy bands)", () => {
    const supply = defaultMarketSupply();
    expect(supply.find((c) => c.type === "capital" && c.capitalValue === 2)).toBeUndefined();
    expect(supply.find((c) => c.type === "capital" && c.capitalValue === 4)).toBeUndefined();
  });
});
