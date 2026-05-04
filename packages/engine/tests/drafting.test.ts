import { describe, it, expect } from "vitest";
import {
  autoDraftMashBills,
  buildStarterDeck,
  DEFAULT_BALANCED_COMPOSITION,
  executeMashBillDraft,
  snakeDraftOrder,
  totalCards,
  validateStarterComposition,
} from "../src/drafting.js";
import { defaultMashBillCatalog } from "../src/defaults.js";

describe("snakeDraftOrder", () => {
  it("interleaves directions: 1-2-3-3-2-1 for 3 players × 2 picks", () => {
    expect(snakeDraftOrder(3, 2)).toEqual([0, 1, 2, 2, 1, 0]);
  });

  it("handles 2 players × 3 picks: 0-1-1-0-0-1", () => {
    expect(snakeDraftOrder(2, 3)).toEqual([0, 1, 1, 0, 0, 1]);
  });

  it("returns empty when picksPerPlayer is 0", () => {
    expect(snakeDraftOrder(4, 0)).toEqual([]);
  });
});

describe("executeMashBillDraft", () => {
  it("each player ends with the right number of bills, pool shrinks accordingly", () => {
    const pool = defaultMashBillCatalog().slice(0, 6);
    // 2 players × 3 picks = 6; always pick top of remaining
    const { perPlayer, remainingPool } = executeMashBillDraft(pool, 2, [0, 0, 0, 0, 0, 0]);
    expect(perPlayer).toHaveLength(2);
    expect(perPlayer[0]).toHaveLength(3);
    expect(perPlayer[1]).toHaveLength(3);
    expect(remainingPool).toHaveLength(0);
  });

  it("respects snake order on picks", () => {
    const pool = defaultMashBillCatalog().slice(0, 6);
    // 2 players × 3 picks. Snake order: 0,1,1,0,0,1
    // Each pick takes index 0 of remaining pool.
    const { perPlayer } = executeMashBillDraft(pool, 2, [0, 0, 0, 0, 0, 0]);
    // Player 0 gets picks at positions 0, 3, 4 in the order sequence
    // Player 1 gets picks at positions 1, 2, 5
    expect(perPlayer[0]!.map((b) => b.defId)).toEqual([
      pool[0]!.defId, // pick 0: snake[0]=p0 picks pool[0]
      pool[3]!.defId, // pick 3: snake[3]=p0 picks pool[3] (after 3 removed)
      pool[4]!.defId, // pick 4: snake[4]=p0
    ]);
  });

  it("throws on out-of-range picks", () => {
    const pool = defaultMashBillCatalog().slice(0, 4);
    expect(() => executeMashBillDraft(pool, 2, [99, 0])).toThrow(/out of range/);
  });

  it("throws when pick count doesn't divide cleanly across players", () => {
    const pool = defaultMashBillCatalog().slice(0, 5);
    expect(() => executeMashBillDraft(pool, 2, [0, 0, 0, 0, 0])).toThrow(/divisible/);
  });
});

describe("autoDraftMashBills", () => {
  it("produces a complete draft", () => {
    const pool = defaultMashBillCatalog(); // 8 bills currently
    const { perPlayer, remainingPool } = autoDraftMashBills(pool, 2, 3);
    expect(perPlayer).toHaveLength(2);
    expect(perPlayer.flat()).toHaveLength(6);
    expect(remainingPool).toHaveLength(pool.length - 6);
  });
});

describe("starter deck composition", () => {
  it("validates totals", () => {
    expect(validateStarterComposition(DEFAULT_BALANCED_COMPOSITION).legal).toBe(true);
    expect(validateStarterComposition({ cask: 5 }).legal).toBe(false);
    expect(validateStarterComposition({ cask: -1, corn: 15 }).legal).toBe(false);
  });

  it("totalCards sums correctly", () => {
    expect(totalCards(DEFAULT_BALANCED_COMPOSITION)).toBe(14);
    expect(totalCards({})).toBe(0);
  });

  it("buildStarterDeck produces 14 cards in subtype order", () => {
    const cards = buildStarterDeck(DEFAULT_BALANCED_COMPOSITION, "alice");
    expect(cards).toHaveLength(14);
    const subtypes = cards.map((c) => c.subtype ?? c.type);
    // Order: cask×3, corn×4, rye×2, barley×1, wheat×1, then 3 capital
    expect(subtypes.slice(0, 3).every((s) => s === "cask")).toBe(true);
    expect(subtypes.slice(3, 7).every((s) => s === "corn")).toBe(true);
    expect(subtypes.slice(7, 9).every((s) => s === "rye")).toBe(true);
    expect(subtypes[9]).toBe("barley");
    expect(subtypes[10]).toBe("wheat");
    expect(subtypes.slice(11, 14).every((s) => s === "capital")).toBe(true);
  });

  it("buildStarterDeck rejects compositions with the wrong total", () => {
    expect(() => buildStarterDeck({ cask: 1 }, "x")).toThrow();
  });
});
