import { describe, expect, it } from "vitest";
import {
  canPlaceOnLine,
  createBottleFromSale,
} from "../../src/lines/placement.js";
import { lineBoardForDistillery, allLineBoards } from "../../src/lines/boards.js";
import { getLineCardDef } from "../../src/lines/cards.js";
import type {
  Barrel,
  Bottle,
  Line,
  LineCardInstance,
  MashBill,
} from "../../src/types.js";

const makeBottle = (overrides: Partial<Bottle> = {}): Bottle => ({
  bottleId: "b1",
  originalBillId: "bill1",
  billDefId: "test_bill",
  name: "Test Bourbon",
  recipeTags: ["rye"],
  primaryRecipeTag: "rye",
  caskTag: "common-cask",
  rarity: "common",
  ageAtSale: 4,
  demandAtSale: 5,
  placedOnRound: 1,
  ...overrides,
});

const emptyLine = (overrides: Partial<Line> = {}): Line => ({
  id: "line1",
  lineBoardId: null,
  stackedCards: [],
  bottles: [],
  ...overrides,
});

const stackedCard = (defId: string): LineCardInstance => ({
  instanceId: `inst_${defId}`,
  defId,
});

describe("canPlaceOnLine — empty line", () => {
  it("accepts any bottle on an empty bare line", () => {
    expect(canPlaceOnLine(makeBottle(), emptyLine())).toBe(true);
  });
});

describe("canPlaceOnLine — Line Board predicates", () => {
  it("Wheated Comfort accepts wheated bottles", () => {
    const board = lineBoardForDistillery("wheated_baron")!;
    const line = emptyLine({ lineBoardId: board.id });
    expect(
      canPlaceOnLine(
        makeBottle({ recipeTags: ["wheated"], primaryRecipeTag: "wheated" }),
        line,
      ),
    ).toBe(true);
  });
  it("Wheated Comfort rejects non-wheated bottles", () => {
    const board = lineBoardForDistillery("wheated_baron")!;
    const line = emptyLine({ lineBoardId: board.id });
    expect(canPlaceOnLine(makeBottle(), line)).toBe(false);
  });
  it("High-Rye Tradition accepts rye bottles", () => {
    const board = lineBoardForDistillery("high_rye_house")!;
    const line = emptyLine({ lineBoardId: board.id });
    expect(canPlaceOnLine(makeBottle({ recipeTags: ["rye"] }), line)).toBe(true);
  });
  it("Diversified Portfolio rejects duplicate primary tags", () => {
    const board = lineBoardForDistillery("connoisseur_estate")!;
    const line = emptyLine({
      lineBoardId: board.id,
      bottles: [makeBottle({ primaryRecipeTag: "rye" })],
    });
    expect(canPlaceOnLine(makeBottle({ primaryRecipeTag: "rye" }), line)).toBe(
      false,
    );
    expect(
      canPlaceOnLine(makeBottle({ primaryRecipeTag: "wheated" }), line),
    ).toBe(true);
  });
  it("Standard Reserve accepts everything", () => {
    const board = lineBoardForDistillery("vanilla")!;
    const line = emptyLine({ lineBoardId: board.id });
    expect(canPlaceOnLine(makeBottle(), line)).toBe(true);
  });
});

describe("canPlaceOnLine — constraint composition (board AND stacked cards)", () => {
  it("requires all predicates to pass", () => {
    const board = lineBoardForDistillery("wheated_baron")!;
    const reserveCard = getLineCardDef("lc_reserve_line")!;
    const line = emptyLine({
      lineBoardId: board.id,
      stackedCards: [stackedCard(reserveCard.id)],
    });
    // Wheated + age 4+ → both pass
    expect(
      canPlaceOnLine(
        makeBottle({
          recipeTags: ["wheated"],
          primaryRecipeTag: "wheated",
          ageAtSale: 4,
        }),
        line,
      ),
    ).toBe(true);
    // Wheated but age 2 → board passes, reserve card fails
    expect(
      canPlaceOnLine(
        makeBottle({
          recipeTags: ["wheated"],
          primaryRecipeTag: "wheated",
          ageAtSale: 2,
        }),
        line,
      ),
    ).toBe(false);
    // Age 4 but not wheated → board fails
    expect(
      canPlaceOnLine(makeBottle({ recipeTags: ["rye"], ageAtSale: 4 }), line),
    ).toBe(false);
  });
});

describe("canPlaceOnLine — unknown defIds are silently allowed", () => {
  it("treats unknown lineBoardId as no constraint", () => {
    const line = emptyLine({ lineBoardId: "lb_does_not_exist" });
    expect(canPlaceOnLine(makeBottle(), line)).toBe(true);
  });
  it("treats unknown stackedCard defId as no constraint", () => {
    const line = emptyLine({ stackedCards: [stackedCard("lc_unknown")] });
    expect(canPlaceOnLine(makeBottle(), line)).toBe(true);
  });
});

describe("createBottleFromSale", () => {
  it("derives tags, cask tag, and pipes through age + demand + rarity", () => {
    const bill = {
      id: "bill_42",
      defId: "test_wheated",
      name: "Test Wheated",
      tier: "rare",
      recipe: { minWheat: 1 },
    } as unknown as MashBill;
    const barrel = {
      productionCards: [
        {
          id: "ck",
          cardDefId: "heritage_cask",
          type: "resource",
          subtype: "cask",
          specialty: true,
        },
      ],
    } as Pick<Barrel, "productionCards">;
    const bottle = createBottleFromSale(bill, barrel, 7, 5, 3, "bottle_xyz");
    expect(bottle.bottleId).toBe("bottle_xyz");
    expect(bottle.originalBillId).toBe("bill_42");
    expect(bottle.billDefId).toBe("test_wheated");
    expect(bottle.rarity).toBe("rare");
    expect(bottle.ageAtSale).toBe(5);
    expect(bottle.demandAtSale).toBe(7);
    expect(bottle.placedOnRound).toBe(3);
    expect(bottle.caskTag).toBe("heritage-cask");
    expect(bottle.recipeTags).toContain("wheated");
    expect(bottle.primaryRecipeTag).toBe("wheated");
  });
});

describe("flagship board distillery binding", () => {
  it("has exactly one board per distillery bonus", () => {
    const boards = allLineBoards();
    const bonuses = new Set(boards.map((b) => b.distilleryBonus));
    expect(bonuses.size).toBe(boards.length);
    expect(bonuses.has("vanilla")).toBe(true);
    expect(bonuses.has("wheated_baron")).toBe(true);
    expect(bonuses.has("high_rye_house")).toBe(true);
    expect(bonuses.has("connoisseur_estate")).toBe(true);
  });
});
