import { describe, it, expect } from "vitest";
import { applyAction, IllegalActionError } from "../src/engine.js";
import { initializeGame } from "../src/initialize.js";
import { defaultDistilleryPool } from "../src/distilleries.js";
import { defaultMashBillCatalog } from "../src/defaults.js";
import { DEFAULT_BALANCED_COMPOSITION } from "../src/drafting.js";

function makeDraftGame() {
  const pool = defaultDistilleryPool();
  const catalog = defaultMashBillCatalog();
  return initializeGame({
    seed: 1,
    players: [
      { id: "p1", name: "Alice" },
      { id: "p2", name: "Bob" },
    ],
    // Pre-assign distilleries so we land directly in the starter-deck phase.
    startingDistilleries: [
      pool.find((d) => d.bonus === "vanilla")!,
      pool.find((d) => d.bonus === "old_line")!,
    ],
    startingMashBills: [catalog.slice(0, 3), catalog.slice(3, 6)],
    bourbonDeck: catalog.slice(6),
  });
}

describe("starter_deck_draft phase", () => {
  it("starts in starter_deck_draft (reverse-snake order) when distilleries are set but decks aren't", () => {
    const state = makeDraftGame();
    expect(state.phase).toBe("starter_deck_draft");
    expect(state.starterDeckDraftOrder).toEqual(["p2", "p1"]);
    expect(state.starterDeckDraftCursor).toBe(0);
    for (const p of state.players) {
      expect(p.deck).toHaveLength(0);
    }
  });

  it("rejects a compose by a player who isn't on the clock", () => {
    const state = makeDraftGame();
    expect(() =>
      applyAction(state, {
        type: "COMPOSE_STARTER_DECK",
        playerId: "p1",
        composition: DEFAULT_BALANCED_COMPOSITION,
      }),
    ).toThrow(IllegalActionError);
  });

  it("rejects a composition that doesn't total 16", () => {
    const state = makeDraftGame();
    expect(() =>
      applyAction(state, {
        type: "COMPOSE_STARTER_DECK",
        playerId: "p2",
        composition: { cask: 4, corn: 4, rye: 2, barley: 1, wheat: 1, capital: 3 }, // 15
      }),
    ).toThrow(/totals 15.*16/);
  });

  it("builds, shuffles, and assigns the deck on a valid compose", () => {
    let state = makeDraftGame();
    state = applyAction(state, {
      type: "COMPOSE_STARTER_DECK",
      playerId: "p2",
      composition: DEFAULT_BALANCED_COMPOSITION,
    });
    const p2 = state.players.find((p) => p.id === "p2")!;
    expect(p2.deck).toHaveLength(16);
    expect(state.starterDeckDraftCursor).toBe(1);
    expect(state.phase).toBe("starter_deck_draft");
  });

  it("transitions to demand once every drafter has composed", () => {
    let state = makeDraftGame();
    state = applyAction(state, {
      type: "COMPOSE_STARTER_DECK",
      playerId: "p2",
      composition: DEFAULT_BALANCED_COMPOSITION,
    });
    state = applyAction(state, {
      type: "COMPOSE_STARTER_DECK",
      playerId: "p1",
      composition: DEFAULT_BALANCED_COMPOSITION,
    });
    expect(state.phase).toBe("demand");
  });

  it("after distillery_selection completes, falls through to starter_deck_draft", () => {
    const pool = defaultDistilleryPool();
    const catalog = defaultMashBillCatalog();
    let state = initializeGame({
      seed: 1,
      players: [
        { id: "p1", name: "Alice" },
        { id: "p2", name: "Bob" },
      ],
      distilleryPool: pool,
      startingMashBills: [catalog.slice(0, 3), catalog.slice(3, 6)],
      bourbonDeck: catalog.slice(6),
    });
    expect(state.phase).toBe("distillery_selection");
    // p2 picks first (reverse snake), then p1.
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
    expect(state.phase).toBe("starter_deck_draft");
  });
});
