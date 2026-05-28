import { describe, expect, it } from "vitest";
import {
  scoreEndGameLines,
  scoreInventory,
  scoreLine,
} from "../../src/lines/scoring.js";
import { lineBoardForDistillery } from "../../src/lines/boards.js";
import { getLineCardDef } from "../../src/lines/cards.js";
import type {
  Bottle,
  Line,
  LineCardInstance,
  PlayerState,
} from "../../src/types.js";

const makeBottle = (overrides: Partial<Bottle> = {}): Bottle => ({
  bottleId: `b_${Math.random().toString(36).slice(2, 8)}`,
  originalBillId: "bill1",
  billDefId: "test_bill",
  name: "Test",
  recipeTags: [],
  primaryRecipeTag: "neutral",
  caskTag: "common-cask",
  rarity: "common",
  ageAtSale: 3,
  demandAtSale: 5,
  placedOnRound: 1,
  ...overrides,
});

const blankPlayer: PlayerState = {
  id: "p1",
} as unknown as PlayerState;

const stack = (defId: string): LineCardInstance => ({
  instanceId: `inst_${defId}`,
  defId,
});

describe("scoreLine — empty line penalty", () => {
  it("returns 0 for an empty bare line", () => {
    const line: Line = {
      id: "x",
      lineBoardId: null,
      stackedCards: [],
      bottles: [],
    };
    expect(scoreLine(line, blankPlayer)).toBe(0);
  });
  it("returns -2 per stacked card on an empty line", () => {
    const line: Line = {
      id: "x",
      lineBoardId: null,
      stackedCards: [stack("lc_wheated_line"), stack("lc_reserve_line")],
      bottles: [],
    };
    expect(scoreLine(line, blankPlayer)).toBe(-4);
  });
  it("flagship with cards but no bottles still pays −2 per card", () => {
    const board = lineBoardForDistillery("vanilla")!;
    const line: Line = {
      id: "f",
      lineBoardId: board.id,
      stackedCards: [stack("lc_wheated_line")],
      bottles: [],
    };
    expect(scoreLine(line, blankPlayer)).toBe(-2);
  });
});

describe("scoreLine — flagship board scoring", () => {
  it("Standard Reserve scores 1 rep per bottle", () => {
    const board = lineBoardForDistillery("vanilla")!;
    const line: Line = {
      id: "f",
      lineBoardId: board.id,
      stackedCards: [],
      bottles: [makeBottle(), makeBottle(), makeBottle()],
    };
    expect(scoreLine(line, blankPlayer)).toBe(3);
  });
  it("Wheated Comfort: 2 rep per wheated bottle + breadth bonus at 4+", () => {
    const board = lineBoardForDistillery("wheated_baron")!;
    const line: Line = {
      id: "f",
      lineBoardId: board.id,
      stackedCards: [],
      bottles: [
        makeBottle({ recipeTags: ["wheated"] }),
        makeBottle({ recipeTags: ["wheated"] }),
        makeBottle({ recipeTags: ["wheated"] }),
        makeBottle({ recipeTags: ["wheated"] }),
      ],
    };
    expect(scoreLine(line, blankPlayer)).toBe(2 * 4 + 5);
  });
  it("Diversified Portfolio: 3 rep per unique primary recipe tag", () => {
    const board = lineBoardForDistillery("connoisseur_estate")!;
    const line: Line = {
      id: "f",
      lineBoardId: board.id,
      stackedCards: [],
      bottles: [
        makeBottle({ primaryRecipeTag: "rye" }),
        makeBottle({ primaryRecipeTag: "wheated" }),
        makeBottle({ primaryRecipeTag: "neutral" }),
      ],
    };
    expect(scoreLine(line, blankPlayer)).toBe(3 * 3);
  });
});

describe("scoreLine — Line Card scoring rules", () => {
  it("Volume Series: 1 rep per bottle, +5 at 5+", () => {
    const def = getLineCardDef("lc_volume_series")!;
    const line: Line = {
      id: "s",
      lineBoardId: null,
      stackedCards: [{ instanceId: "i", defId: def.id }],
      bottles: Array.from({ length: 5 }, () => makeBottle()),
    };
    expect(scoreLine(line, blankPlayer)).toBe(5 + 5);
  });
  it("Depth Line: positional rep capped at 5", () => {
    const def = getLineCardDef("lc_depth_line")!;
    const line: Line = {
      id: "s",
      lineBoardId: null,
      stackedCards: [{ instanceId: "i", defId: def.id }],
      // 6 bottles: 1+2+3+4+5+5 = 20
      bottles: Array.from({ length: 6 }, () => makeBottle()),
    };
    expect(scoreLine(line, blankPlayer)).toBe(20);
  });
  it("Premium Line: 3 rep per Rare+ bottle, capped at 4", () => {
    const def = getLineCardDef("lc_premium_line")!;
    const line: Line = {
      id: "s",
      lineBoardId: null,
      stackedCards: [{ instanceId: "i", defId: def.id }],
      bottles: Array.from({ length: 6 }, () => makeBottle({ rarity: "rare" })),
    };
    expect(scoreLine(line, blankPlayer)).toBe(3 * 4); // capped
  });
});

describe("scoreInventory", () => {
  it("returns 1 rep per inventory bottle", () => {
    const p = {
      inventory: [makeBottle(), makeBottle(), makeBottle()],
    } as unknown as PlayerState;
    expect(scoreInventory(p)).toBe(3);
  });
});

describe("scoreEndGameLines (full breakdown)", () => {
  it("composes flagship + secondaries + inventory + total", () => {
    const board = lineBoardForDistillery("vanilla")!;
    const variety = getLineCardDef("lc_variety_line")!;
    const p = {
      flagshipLine: {
        id: "f",
        lineBoardId: board.id,
        stackedCards: [],
        bottles: [makeBottle(), makeBottle()],
      },
      secondaryLines: [
        {
          id: "s1",
          lineBoardId: null,
          stackedCards: [{ instanceId: "i", defId: variety.id }],
          bottles: [
            makeBottle({ primaryRecipeTag: "rye" }),
            makeBottle({ primaryRecipeTag: "wheated" }),
          ],
        },
      ],
      inventory: [makeBottle()],
    } as unknown as PlayerState;
    const result = scoreEndGameLines(p);
    expect(result.flagshipScore).toBe(2); // Standard Reserve: 1/bottle
    expect(result.secondaryScores).toEqual([6]); // Variety: 3 per unique
    expect(result.inventoryScore).toBe(1);
    expect(result.total).toBe(2 + 6 + 1);
  });
});
