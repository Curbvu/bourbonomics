import { describe, expect, it } from "vitest";
import {
  deriveBottleProfile,
  deriveCaskTag,
  derivePrimaryRecipeTag,
  deriveRecipeTags,
} from "../../src/lines/tags.js";
import type { Barrel, Card, MashBill } from "../../src/types.js";

const cask = (specialty = false, def = "cask"): Card => ({
  id: `c_${def}`,
  cardDefId: def,
  type: "resource",
  subtype: "cask",
  specialty,
});

const heritageCask = (): Card => cask(true, "heritage_cask");
const specialtyCask = (): Card => cask(true, "superior_cask");

describe("deriveRecipeTags", () => {
  it("emits rye when minRye >= 1", () => {
    expect(deriveRecipeTags({ minRye: 1 })).toContain("rye");
    expect(deriveRecipeTags({ minRye: 1 })).not.toContain("high-rye");
  });

  it("emits high-rye when minRye >= 3 (plus the base rye tag)", () => {
    const tags = deriveRecipeTags({ minRye: 3 });
    expect(tags).toContain("rye");
    expect(tags).toContain("high-rye");
  });

  it("emits wheated for minWheat OR maxRye === 0", () => {
    expect(deriveRecipeTags({ minWheat: 1 })).toContain("wheated");
    expect(deriveRecipeTags({ maxRye: 0, minCorn: 5 })).toContain("wheated");
  });

  it("emits barley when minBarley >= 1", () => {
    expect(deriveRecipeTags({ minBarley: 1 })).toContain("barley");
  });

  it("emits pure-corn for minCorn >= 4 with no grain mins", () => {
    expect(deriveRecipeTags({ minCorn: 4 })).toContain("pure-corn");
    expect(deriveRecipeTags({ minCorn: 4, minRye: 1 })).not.toContain("pure-corn");
  });

  it("emits triple-grain when all three grain mins present", () => {
    expect(
      deriveRecipeTags({ minRye: 1, minBarley: 1, minWheat: 1 }),
    ).toContain("triple-grain");
  });

  it("emits single-grain when exactly one grain min is set", () => {
    expect(deriveRecipeTags({ minRye: 1 })).toContain("single-grain");
    expect(deriveRecipeTags({ minBarley: 1 })).toContain("single-grain");
    expect(deriveRecipeTags({ minWheat: 1 })).toContain("single-grain");
    expect(deriveRecipeTags({ minRye: 1, minWheat: 1 })).not.toContain(
      "single-grain",
    );
  });

  it("emits neutral when no grain pressure and corn < 4", () => {
    expect(deriveRecipeTags({})).toContain("neutral");
    expect(deriveRecipeTags({ minCorn: 2 })).toContain("neutral");
  });
});

describe("derivePrimaryRecipeTag", () => {
  it("prefers high-rye over rye", () => {
    expect(derivePrimaryRecipeTag(["rye", "high-rye"])).toBe("high-rye");
  });
  it("falls back to neutral when nothing matches", () => {
    expect(derivePrimaryRecipeTag([])).toBe("neutral");
  });
});

describe("deriveCaskTag", () => {
  it("picks heritage when a heritage cask is committed", () => {
    expect(
      deriveCaskTag({
        productionCards: [cask(false), heritageCask()],
      } as Pick<Barrel, "productionCards">),
    ).toBe("heritage-cask");
  });
  it("picks specialty over common", () => {
    expect(
      deriveCaskTag({
        productionCards: [cask(false), specialtyCask()],
      } as Pick<Barrel, "productionCards">),
    ).toBe("specialty-cask");
  });
  it("returns common when only plain casks are committed", () => {
    expect(
      deriveCaskTag({
        productionCards: [cask(false)],
      } as Pick<Barrel, "productionCards">),
    ).toBe("common-cask");
  });
  it("defaults to common when no cask is present", () => {
    expect(
      deriveCaskTag({ productionCards: [] } as Pick<
        Barrel,
        "productionCards"
      >),
    ).toBe("common-cask");
  });
});

describe("deriveBottleProfile (integration)", () => {
  it("returns all three derived values in one pass", () => {
    const bill = {
      recipe: { minRye: 3 },
    } as unknown as MashBill;
    const barrel = { productionCards: [specialtyCask()] } as Pick<
      Barrel,
      "productionCards"
    >;
    const profile = deriveBottleProfile(bill, barrel);
    expect(profile.recipeTags).toContain("high-rye");
    expect(profile.primaryRecipeTag).toBe("high-rye");
    expect(profile.caskTag).toBe("specialty-cask");
  });
});
