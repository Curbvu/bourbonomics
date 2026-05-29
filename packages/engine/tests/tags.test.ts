import { describe, expect, it } from "vitest";
import { applyCeiling, deriveBillTags } from "../src/tags.js";
import type { BillTag, MashBill } from "../src/types.js";

// Helpers — build a minimal bill spec for the derivation function.
// Only the fields deriveBillTags reads are required.
function bill(
  override: Partial<
    Pick<
      MashBill,
      "recipe" | "tier" | "silverAward" | "goldAward" | "primaryGrain"
    >
  > = {},
): Pick<
  MashBill,
  "recipe" | "tier" | "silverAward" | "goldAward" | "primaryGrain"
> {
  return {
    recipe: {},
    tier: "common",
    ...override,
  };
}

describe("deriveBillTags — grain presence", () => {
  it("emits no grain tags when recipe demands no named grain", () => {
    const tags = deriveBillTags(bill());
    expect(tags).not.toContain("rye");
    expect(tags).not.toContain("wheat");
    expect(tags).not.toContain("barley");
  });

  it("emits rye when minRye >= 1", () => {
    const tags = deriveBillTags(bill({ recipe: { minRye: 1 } }));
    expect(tags).toContain("rye");
  });

  it("emits wheat when minWheat >= 1", () => {
    const tags = deriveBillTags(bill({ recipe: { minWheat: 1 } }));
    expect(tags).toContain("wheat");
  });

  it("emits barley when minBarley >= 1", () => {
    const tags = deriveBillTags(bill({ recipe: { minBarley: 1 } }));
    expect(tags).toContain("barley");
  });

  it("specialty-only floors still count toward grain presence", () => {
    const tags = deriveBillTags(
      bill({ recipe: { minSpecialty: { rye: 1 } } }),
    );
    expect(tags).toContain("rye");
  });
});

describe("deriveBillTags — corn strength", () => {
  it("emits corn-heavy when maxCorn >= 4", () => {
    const tags = deriveBillTags(
      bill({ recipe: { minCorn: 2, maxCorn: 5 } }),
    );
    expect(tags).toContain("corn-heavy");
    expect(tags).not.toContain("corn-light");
  });

  it("emits corn-light when maxCorn <= 2", () => {
    const tags = deriveBillTags(
      bill({ recipe: { minCorn: 1, maxCorn: 2 } }),
    );
    expect(tags).toContain("corn-light");
    expect(tags).not.toContain("corn-heavy");
  });

  it("emits neither when maxCorn is 3 (mid range)", () => {
    const tags = deriveBillTags(
      bill({ recipe: { minCorn: 2, maxCorn: 3 } }),
    );
    expect(tags).not.toContain("corn-heavy");
    expect(tags).not.toContain("corn-light");
  });
});

describe("deriveBillTags — profile", () => {
  it("emits wheated when wheat is the only named grain", () => {
    const tags = deriveBillTags(bill({ recipe: { minWheat: 2 } }));
    expect(tags).toContain("wheated");
    expect(tags).toContain("single-grain");
  });

  it("emits rye-heavy when rye is the primary by count", () => {
    const tags = deriveBillTags(
      bill({ recipe: { minRye: 3, minBarley: 1 } }),
    );
    expect(tags).toContain("rye-heavy");
    expect(tags).not.toContain("triple-grain");
  });

  it("emits triple-grain when three distinct grains are demanded", () => {
    const tags = deriveBillTags(
      bill({ recipe: { minRye: 1, minBarley: 1, minWheat: 1 } }),
    );
    expect(tags).toContain("triple-grain");
  });

  it("breaks ties via primaryGrain field when two grains tie for top count", () => {
    const tags = deriveBillTags(
      bill({
        recipe: { minRye: 2, minWheat: 2 },
        primaryGrain: "wheat",
      }),
    );
    expect(tags).toContain("wheated");
    expect(tags).not.toContain("rye-heavy");
  });

  it("emits neither rye-heavy nor wheated when tied and no primaryGrain set", () => {
    const tags = deriveBillTags(bill({ recipe: { minRye: 2, minWheat: 2 } }));
    expect(tags).not.toContain("rye-heavy");
    expect(tags).not.toContain("wheated");
  });
});

describe("deriveBillTags — quality", () => {
  it("emits specialty when the recipe demands any Specialty component", () => {
    const tags = deriveBillTags(
      bill({ recipe: { minSpecialty: { cask: 1 } } }),
    );
    expect(tags).toContain("specialty");
  });

  it("emits heritage when a rare+ bill demands Specialty components", () => {
    const tags = deriveBillTags(
      bill({
        tier: "epic",
        recipe: { minSpecialty: { cask: 1 } },
      }),
    );
    expect(tags).toContain("heritage");
    expect(tags).toContain("specialty");
  });

  it("does NOT emit heritage on common-tier bills even with specialty floors", () => {
    const tags = deriveBillTags(
      bill({
        tier: "common",
        recipe: { minSpecialty: { cask: 1 } },
      }),
    );
    expect(tags).toContain("specialty");
    expect(tags).not.toContain("heritage");
  });

  it("emits heritage-recipe when Specialty floors span >= 2 component slots", () => {
    const tags = deriveBillTags(
      bill({
        tier: "epic",
        recipe: { minSpecialty: { cask: 1, rye: 1 } },
      }),
    );
    expect(tags).toContain("heritage-recipe");
  });

  it("does NOT emit heritage-recipe with only one specialty slot", () => {
    const tags = deriveBillTags(
      bill({
        tier: "epic",
        recipe: { minSpecialty: { cask: 1 } },
      }),
    );
    expect(tags).not.toContain("heritage-recipe");
  });
});

describe("deriveBillTags — award eligibility", () => {
  it("emits silver-eligible when silverAward is present", () => {
    const tags = deriveBillTags(
      bill({ silverAward: { minReward: 3 } }),
    );
    expect(tags).toContain("silver-eligible");
  });

  it("emits gold-eligible when goldAward is present", () => {
    const tags = deriveBillTags(
      bill({ goldAward: { minReward: 5 } }),
    );
    expect(tags).toContain("gold-eligible");
  });

  it("emits both when both awards are configured", () => {
    const tags = deriveBillTags(
      bill({
        silverAward: { minReward: 3 },
        goldAward: { minReward: 5 },
      }),
    );
    expect(tags).toContain("silver-eligible");
    expect(tags).toContain("gold-eligible");
  });
});

describe("applyCeiling — 7-tag drop order", () => {
  it("returns the input unchanged when length <= 7", () => {
    const input: BillTag[] = ["rye", "wheat", "barley"];
    expect(applyCeiling(input)).toEqual(input);
  });

  it("drops corn-light/corn-heavy first when overflowing", () => {
    const input: BillTag[] = [
      "rye",
      "wheat",
      "barley",
      "specialty",
      "heritage",
      "silver-eligible",
      "gold-eligible",
      "corn-heavy",
    ];
    expect(applyCeiling(input)).not.toContain("corn-heavy");
  });

  it("drops single-grain/triple-grain second", () => {
    const input: BillTag[] = [
      "rye",
      "wheat",
      "barley",
      "specialty",
      "heritage",
      "silver-eligible",
      "gold-eligible",
      "triple-grain",
    ];
    expect(applyCeiling(input)).not.toContain("triple-grain");
  });

  it("drops silver-eligible only when gold-eligible is also present", () => {
    const input: BillTag[] = [
      "rye",
      "wheat",
      "barley",
      "specialty",
      "heritage",
      "heritage-recipe",
      "silver-eligible",
      "gold-eligible",
    ];
    const out = applyCeiling(input);
    expect(out).toContain("gold-eligible");
    expect(out).not.toContain("silver-eligible");
  });

  it("drops specialty only when heritage is also present (and step 4 actually fires)", () => {
    // Construct an input that still overflows after the earlier
    // drop steps so step 4 (specialty if heritage) actually fires.
    // 10 tags: after step 1 drops corn-heavy (9), step 2 has nothing
    // to drop (9), step 3 drops silver (8). Still > 7 → step 4 fires
    // and drops specialty (7).
    const input: BillTag[] = [
      "rye",
      "wheat",
      "barley",
      "corn-heavy",
      "specialty",
      "heritage",
      "heritage-recipe",
      "silver-eligible",
      "gold-eligible",
      "rye-heavy",
    ];
    const out = applyCeiling(input);
    expect(out).toContain("heritage");
    expect(out).not.toContain("specialty");
    expect(out.length).toBeLessThanOrEqual(7);
  });
});

describe("deriveBillTags — representative bills (smoke)", () => {
  it("wheated heritage epic bill picks up wheated, wheat, specialty, heritage, heritage-recipe", () => {
    const tags = deriveBillTags(
      bill({
        tier: "epic",
        recipe: {
          minWheat: 2,
          maxRye: 0,
          minSpecialty: { cask: 1, wheat: 1 },
        },
        silverAward: { minReward: 5 },
      }),
    );
    expect(tags).toContain("wheat");
    expect(tags).toContain("wheated");
    expect(tags).toContain("specialty");
    expect(tags).toContain("heritage");
    expect(tags).toContain("heritage-recipe");
    expect(tags).toContain("silver-eligible");
  });

  it("single-grain rye starter has rye, rye-heavy, single-grain", () => {
    const tags = deriveBillTags(
      bill({
        tier: "common",
        recipe: { minRye: 2, minCorn: 2 },
      }),
    );
    expect(tags).toContain("rye");
    expect(tags).toContain("rye-heavy");
    expect(tags).toContain("single-grain");
    expect(tags).not.toContain("triple-grain");
  });

  it("triple-grain corn-heavy uncommon picks up corn-heavy + triple-grain", () => {
    const tags = deriveBillTags(
      bill({
        tier: "uncommon",
        recipe: {
          minCorn: 2,
          maxCorn: 5,
          minRye: 1,
          minWheat: 1,
          minBarley: 1,
        },
      }),
    );
    expect(tags).toContain("corn-heavy");
    expect(tags).toContain("triple-grain");
    expect(tags).toContain("rye");
    expect(tags).toContain("wheat");
    expect(tags).toContain("barley");
  });
});
