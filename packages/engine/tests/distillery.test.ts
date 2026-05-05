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
    const wheated = state.distilleryPool.find((d) => d.bonus === "wheated_baron")!;
    state = applyAction(state, {
      type: "SELECT_DISTILLERY",
      playerId: "p3",
      distilleryId: wheated.id,
    });
    const p3 = state.players.find((p) => p.id === "p3")!;
    expect(p3.distillery?.bonus).toBe("wheated_baron");
    expect(p3.rickhouseSlots).toHaveLength(4);
    expect(state.distillerySelectionCursor).toBe(1);
    expect(state.distilleryPool.find((d) => d.id === wheated.id)).toBeUndefined();
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

  it("High-Rye House delivers a free 2-rye via the v2.4 starter trade window", () => {
    // p3 picks first under reverse-snake; the other two players still
    // need distilleries before the starter phase begins. Walk all the
    // way through so the 2-rye lands in p3's finalized deck.
    let state = makeSelectionGame();
    const highRye = state.distilleryPool.find((d) => d.bonus === "high_rye")!;
    state = applyAction(state, {
      type: "SELECT_DISTILLERY",
      playerId: "p3",
      distilleryId: highRye.id,
    });
    // p2 and p1 take whatever's left; we don't care which.
    state = applyAction(state, {
      type: "SELECT_DISTILLERY",
      playerId: "p2",
      distilleryId: state.distilleryPool[0]!.id,
    });
    state = applyAction(state, {
      type: "SELECT_DISTILLERY",
      playerId: "p1",
      distilleryId: state.distilleryPool[0]!.id,
    });

    // After the random deal, p3's starter hand holds the two bonus
    // 2-rye cards (16 dealt + 2 bonus = 18).
    const p3Mid = state.players.find((p) => p.id === "p3")!;
    expect(p3Mid.starterHand).toHaveLength(18);
    const ryePremiumsMid = p3Mid.starterHand.filter(
      (c) => c.subtype === "rye" && c.premium && c.resourceCount === 2,
    );
    expect(ryePremiumsMid.length).toBe(2);

    // After every drafter passes, the starter hand shuffles into the deck.
    for (const id of ["p3", "p2", "p1"]) {
      state = applyAction(state, { type: "STARTER_PASS", playerId: id });
    }
    const p3Final = state.players.find((p) => p.id === "p3")!;
    expect(p3Final.deck).toHaveLength(18);
    const ryePremiumsFinal = p3Final.deck.filter(
      (c) => c.subtype === "rye" && c.premium && c.resourceCount === 2,
    );
    expect(ryePremiumsFinal.length).toBe(2);
  });
});
