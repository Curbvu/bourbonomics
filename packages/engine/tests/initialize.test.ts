import { describe, it, expect } from "vitest";
import { defaultDistilleryPool } from "../src/distilleries.js";
import { initializeGame } from "../src/initialize.js";
import { makeTestGame } from "./helpers.js";

describe("initializeGame", () => {
  it("creates a state with the right shape", () => {
    const state = makeTestGame();
    expect(state.round).toBe(1);
    expect(state.phase).toBe("demand");
    expect(state.demand).toBe(0);
    expect(state.players).toHaveLength(2);
    expect(state.marketConveyor.length).toBeLessThanOrEqual(10);
    expect(state.finalRoundTriggered).toBe(false);
  });

  it("gives each player a 16-card starter deck", () => {
    const state = makeTestGame();
    for (const p of state.players) {
      expect(p.deck).toHaveLength(16);
      expect(p.hand).toHaveLength(0);
      expect(p.discard).toHaveLength(0);
      expect(p.reputation).toBe(0);
      expect(p.handSize).toBe(8);
    }
  });

  it("gives each player exactly 3 starting mash bills (default)", () => {
    const state = makeTestGame();
    for (const p of state.players) {
      expect(p.mashBills).toHaveLength(3);
    }
  });

  it("gives each player a personal rickhouse with 2 bonded + 2 upper slots by default (Vanilla)", () => {
    const state = makeTestGame();
    for (const p of state.players) {
      expect(p.rickhouseSlots).toHaveLength(4);
      const bonded = p.rickhouseSlots.filter((s) => s.tier === "bonded");
      const upper = p.rickhouseSlots.filter((s) => s.tier === "upper");
      expect(bonded).toHaveLength(2);
      expect(upper).toHaveLength(2);
    }
  });

  it("deals 2 starting operations cards per player", () => {
    const state = makeTestGame();
    for (const p of state.players) {
      expect(p.operationsHand).toHaveLength(2);
      for (const c of p.operationsHand) {
        expect(c.drawnInRound).toBe(0);
      }
    }
  });

  it("starts in distillery_selection when distilleries are not pre-assigned", () => {
    const catalog = defaultDistilleryPool();
    const state = initializeGame({
      seed: 1,
      players: [
        { id: "p1", name: "Alice" },
        { id: "p2", name: "Bob" },
      ],
      distilleryPool: catalog,
    });
    expect(state.phase).toBe("distillery_selection");
    expect(state.distillerySelectionOrder).toEqual(["p2", "p1"]);
    expect(state.distillerySelectionCursor).toBe(0);
  });

  it("is deterministic for the same seed", () => {
    const a = makeTestGame({ seed: 7 });
    const b = makeTestGame({ seed: 7 });
    expect(a.players[0]!.deck.map((c) => c.id)).toEqual(b.players[0]!.deck.map((c) => c.id));
    expect(a.bourbonDeck.map((m) => m.id)).toEqual(b.bourbonDeck.map((m) => m.id));
    expect(a.marketConveyor.map((c) => c.id)).toEqual(b.marketConveyor.map((c) => c.id));
  });

  it("produces different decks for different seeds", () => {
    const a = makeTestGame({ seed: 1 });
    const b = makeTestGame({ seed: 2 });
    expect(a.players[0]!.deck.map((c) => c.id)).not.toEqual(b.players[0]!.deck.map((c) => c.id));
  });

  it("respects custom starting demand and hand size", () => {
    const state = makeTestGame({ startingDemand: 0, startingHandSize: 5 });
    expect(state.demand).toBe(0);
    for (const p of state.players) expect(p.handSize).toBe(5);
  });
});
