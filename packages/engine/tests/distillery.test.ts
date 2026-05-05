import { describe, it, expect } from "vitest";
import { applyAction, IllegalActionError } from "../src/engine.js";
import { initializeGame } from "../src/initialize.js";
import { defaultDistilleryPool } from "../src/distilleries.js";
import { defaultMashBillCatalog } from "../src/defaults.js";

function makeSelectionGame() {
  const catalog = defaultMashBillCatalog();
  return initializeGame({
    seed: 1,
    players: [
      { id: "p1", name: "Alice" },
      { id: "p2", name: "Bob" },
      { id: "p3", name: "Carol" },
    ],
    distilleryPool: defaultDistilleryPool(),
    startingMashBills: [
      catalog.slice(0, 3),
      catalog.slice(3, 6),
      catalog.slice(6, 8),
    ],
    bourbonDeck: [],
  });
}

describe("Distillery selection", () => {
  it("starts in distillery_selection with reverse-snake order", () => {
    const state = makeSelectionGame();
    expect(state.phase).toBe("distillery_selection");
    expect(state.distillerySelectionOrder).toEqual(["p3", "p2", "p1"]);
    expect(state.distillerySelectionCursor).toBe(0);
  });

  it("rejects a pick by a player who isn't on the clock", () => {
    const state = makeSelectionGame();
    const distId = state.distilleryPool[0]!.id;
    expect(() =>
      applyAction(state, { type: "SELECT_DISTILLERY", playerId: "p1", distilleryId: distId }),
    ).toThrow(IllegalActionError);
  });

  it("assigns the distillery, builds rickhouse slots, and advances the cursor", () => {
    let state = makeSelectionGame();
    const oldLine = state.distilleryPool.find((d) => d.bonus === "old_line")!;
    state = applyAction(state, {
      type: "SELECT_DISTILLERY",
      playerId: "p3",
      distilleryId: oldLine.id,
    });
    const p3 = state.players.find((p) => p.id === "p3")!;
    expect(p3.distillery?.bonus).toBe("old_line");
    // v2.2: rickhouse tiers removed — Old-Line just grants +1 slot.
    expect(p3.rickhouseSlots).toHaveLength(5);
    expect(state.distillerySelectionCursor).toBe(1);
    expect(state.distilleryPool.find((d) => d.id === oldLine.id)).toBeUndefined();
  });

  it("falls through to starter_deck_draft once every player has picked a distillery", () => {
    let state = makeSelectionGame();
    for (const playerId of state.distillerySelectionOrder) {
      const distId = state.distilleryPool[0]!.id;
      state = applyAction(state, { type: "SELECT_DISTILLERY", playerId, distilleryId: distId });
    }
    expect(state.phase).toBe("starter_deck_draft");
    expect(state.players.every((p) => p.distillery !== null)).toBe(true);
  });

  it("Warehouse Distillery grants 5 slots (one extra over the default 4)", () => {
    let state = makeSelectionGame();
    const warehouse = state.distilleryPool.find((d) => d.bonus === "warehouse")!;
    state = applyAction(state, {
      type: "SELECT_DISTILLERY",
      playerId: "p3",
      distilleryId: warehouse.id,
    });
    const p3 = state.players.find((p) => p.id === "p3")!;
    expect(p3.rickhouseSlots).toHaveLength(5);
  });

  it("High-Rye House inserts a 2-rye into the player's deck", () => {
    let state = makeSelectionGame();
    const highRye = state.distilleryPool.find((d) => d.bonus === "high_rye")!;
    const initialDeckSize = state.players.find((p) => p.id === "p3")!.deck.length;
    state = applyAction(state, {
      type: "SELECT_DISTILLERY",
      playerId: "p3",
      distilleryId: highRye.id,
    });
    const p3 = state.players.find((p) => p.id === "p3")!;
    expect(p3.deck.length).toBe(initialDeckSize + 1);
    expect(p3.deck.some((c) => c.subtype === "rye" && c.premium && c.resourceCount === 2)).toBe(
      true,
    );
  });
});
