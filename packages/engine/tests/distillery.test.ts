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
    bourbonDeck: catalog,
  });
}

// v2.10: distillery selection is live for every seat.
describe("Distillery selection (v2.10)", () => {
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

  it("assigns Connoisseur Estate with 4 ready-phase slotted bills at setup", () => {
    let state = makeSelectionGame();
    const connoisseur = state.distilleryPool.find((d) => d.bonus === "connoisseur_estate")!;
    state = applyAction(state, {
      type: "SELECT_DISTILLERY",
      playerId: "p3",
      distilleryId: connoisseur.id,
    });
    const p3 = state.players.find((p) => p.id === "p3")!;
    expect(p3.distillery?.bonus).toBe("connoisseur_estate");
    expect(p3.rickhouseSlots).toHaveLength(4);
    const myBarrels = state.allBarrels.filter((b) => b.ownerId === "p3");
    expect(myBarrels).toHaveLength(4);
    expect(myBarrels.every((b) => b.phase === "ready")).toBe(true);
    expect(state.distillerySelectionCursor).toBe(1);
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

  it("puts the human ahead of bots in solo setup so the human gets first pick", () => {
    // v2.14.2: previously the entire seating used reverse-snake, so a
    // solo human at seat 0 picked LAST — bots (whose preference list
    // grabs Connoisseur then Vanilla first) would routinely strip the
    // pool's "easy" options before the human's turn. Now humans pick
    // before any bots; reverse-snake is preserved within each group.
    const catalog = defaultMashBillCatalog();
    const state = initializeGame({
      seed: 1,
      players: [
        { id: "human", name: "You" },
        { id: "bot1", name: "Clyde", isBot: true },
        { id: "bot2", name: "Dell", isBot: true },
      ],
      distilleryPool: defaultDistilleryPool(),
      bourbonDeck: catalog,
    });
    expect(state.distillerySelectionOrder[0]).toBe("human");
    // Bots still pick in reverse-snake among themselves (bot2 before bot1).
    expect(state.distillerySelectionOrder).toEqual(["human", "bot2", "bot1"]);
    expect(state.starterDeckDraftOrder[0]).toBe("human");
  });
});
