/**
 * Market economy — sanity checks on the three-band, one-unit resource
 * system (Common / Specialty / Heritage) and the unified market's
 * Labor / ops / investment additions. Heritage and Specialty share the
 * `specialty: true` flag (counts toward `minSpecialty.<subtype>` gates).
 */

import { describe, it, expect } from "vitest";
import { defaultMarketSupply } from "../src/defaults.js";

const RESOURCE_SUBTYPES = ["cask", "corn", "rye", "barley", "wheat"] as const;

describe("market supply — three-band, one-unit resource economy", () => {
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

  it("Specialties cost 2, count 1, are specialty-flagged, and ship without an on-sale bonus", () => {
    const specs = defaultMarketSupply().filter(
      (c) =>
        c.type === "resource" &&
        c.premium === true &&
        c.cardDefId.startsWith("superior_"),
    );
    expect(specs.length).toBeGreaterThan(0);
    for (const s of specs) {
      expect(s.cost, `${s.cardDefId} cost`).toBe(2);
      expect(s.resourceCount, `${s.cardDefId} count`).toBe(1);
      expect(s.specialty, `${s.cardDefId} specialty flag`).toBe(true);
      expect(s.effect, `${s.cardDefId} effect`).toBeUndefined();
    }
  });

  it("Heritage cards cost 3, count 1, are specialty-flagged, and leave the per-card bonus hook empty in v2.11", () => {
    const heritage = defaultMarketSupply().filter(
      (c) =>
        c.type === "resource" &&
        c.premium === true &&
        c.cardDefId.startsWith("heritage_"),
    );
    expect(heritage.length).toBeGreaterThan(0);
    for (const h of heritage) {
      expect(h.cost, `${h.cardDefId} cost`).toBe(3);
      expect(h.resourceCount, `${h.cardDefId} count`).toBe(1);
      expect(h.specialty, `${h.cardDefId} specialty flag`).toBe(true);
      expect(h.effect, `${h.cardDefId} effect (v2.11 hook empty)`).toBeUndefined();
    }
  });

  it("Heritage ships for every subtype (cask, corn, rye, barley, wheat)", () => {
    const heritage = defaultMarketSupply().filter(
      (c) =>
        c.type === "resource" &&
        c.premium === true &&
        c.cardDefId.startsWith("heritage_"),
    );
    const subs = new Set(heritage.map((c) => c.subtype));
    for (const s of RESOURCE_SUBTYPES) {
      expect(subs.has(s), `Heritage missing for ${s}`).toBe(true);
    }
  });

  it("no 2-unit resource cards ship in the supply", () => {
    const fat = defaultMarketSupply().filter(
      (c) => c.type === "resource" && (c.resourceCount ?? 1) > 1,
    );
    expect(fat).toHaveLength(0);
  });

  it("the legacy plain Double tier and Double Specialty band are gone", () => {
    const supply = defaultMarketSupply();
    const doubles = supply.filter(
      (c) => c.type === "resource" && c.cardDefId.startsWith("double_"),
    );
    expect(doubles).toHaveLength(0);
  });

  it("the three bands together cover the supply with commons as the plurality", () => {
    const supply = defaultMarketSupply().filter((c) => c.type === "resource");
    const total = supply.length;
    const commons = supply.filter((c) => !c.premium).length;
    const specs = supply.filter((c) => c.premium && c.cardDefId.startsWith("superior_")).length;
    const heritage = supply.filter((c) => c.premium && c.cardDefId.startsWith("heritage_")).length;
    expect(commons + specs + heritage).toBe(total);
    // Commons stay the plurality; Heritage stays the rarest band.
    expect(commons / total).toBeGreaterThan(0.4);
    expect(heritage).toBeLessThan(specs);
  });
});

describe("market supply — Labor strip", () => {
  // Generic Labor no longer ships in the market — players start with
  // 2 in their starter deck and that's all the Generic Labor they
  // will ever own. Only Specialty Labor enters via the market.
  it("does NOT ship Generic Labor in the unified market", () => {
    const generic = defaultMarketSupply().filter(
      (c) => c.type === "labor" && c.laborSubtype === "generic",
    );
    expect(generic).toHaveLength(0);
  });

  it("ships Marketing Labor at $4 (+2 toward ops)", () => {
    const marketing = defaultMarketSupply().filter(
      (c) => c.type === "labor" && c.laborSubtype === "marketing",
    );
    expect(marketing.length).toBeGreaterThanOrEqual(1);
    for (const c of marketing) {
      expect(c.cost).toBe(4);
      expect(c.laborDomain).toBe("ops");
      expect(c.laborContribution).toBe(2);
    }
  });

  it("ships Cooper Labor at $4 (+2 toward market resources)", () => {
    const cooper = defaultMarketSupply().filter(
      (c) => c.type === "labor" && c.laborSubtype === "cooper",
    );
    expect(cooper.length).toBeGreaterThanOrEqual(1);
    for (const c of cooper) {
      expect(c.cost).toBe(4);
      expect(c.laborDomain).toBe("market_resource");
    }
  });

  it("ships Architect Labor at $4 (+2 toward investment buys)", () => {
    const architect = defaultMarketSupply().filter(
      (c) => c.type === "labor" && c.laborSubtype === "architect",
    );
    expect(architect.length).toBeGreaterThanOrEqual(1);
    for (const c of architect) {
      expect(c.cost).toBe(4);
      expect(c.laborDomain).toBe("investment");
    }
  });
});

describe("unified market supply — ops + investments", () => {
  it("mints wrapped operations cards (type 'operations' with opSpec)", () => {
    const ops = defaultMarketSupply().filter((c) => c.type === "operations");
    expect(ops.length).toBeGreaterThanOrEqual(1);
    for (const c of ops) {
      expect(c.opSpec).toBeDefined();
      expect(c.opSpec!.defId).toBeTruthy();
      expect(c.cost).toBe(c.opSpec!.cost);
    }
  });

  it("mints wrapped investment cards (type 'investment' with investmentSpec)", () => {
    const inv = defaultMarketSupply().filter((c) => c.type === "investment");
    expect(inv.length).toBeGreaterThanOrEqual(1);
    for (const c of inv) {
      expect(c.investmentSpec).toBeDefined();
      expect(c.investmentSpec!.defId).toBeTruthy();
    }
  });
});
