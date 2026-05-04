import { describe, it, expect } from "vitest";
import { initializeGame } from "../src/initialize.js";
import { defaultRickhouses } from "../src/defaults.js";
import { makeTestGame } from "./helpers.js";

describe("initializeGame", () => {
  it("creates a state with the right shape", () => {
    const state = makeTestGame();
    expect(state.round).toBe(1);
    expect(state.phase).toBe("demand");
    expect(state.demand).toBe(6);
    expect(state.players).toHaveLength(2);
    expect(state.rickhouses).toHaveLength(6);
    expect(state.marketConveyor.length).toBeLessThanOrEqual(6);
    expect(state.finalRoundTriggered).toBe(false);
  });

  it("gives each player a 14-card starter deck", () => {
    const state = makeTestGame();
    for (const p of state.players) {
      expect(p.deck).toHaveLength(14);
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

  it("uses six rickhouses with total capacity 26", () => {
    const state = makeTestGame();
    expect(state.rickhouses).toEqual(defaultRickhouses());
    expect(state.rickhouses).toHaveLength(6);
    const total = state.rickhouses.reduce((acc, r) => acc + r.capacity, 0);
    expect(total).toBe(26);
  });

  it("respects custom starting demand and hand size", () => {
    const state = makeTestGame({ startingDemand: 0, startingHandSize: 5 });
    expect(state.demand).toBe(0);
    for (const p of state.players) expect(p.handSize).toBe(5);
  });
});
