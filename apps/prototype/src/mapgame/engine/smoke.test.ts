import { describe, expect, it } from "vitest";
import { applyAction, botAction, createMapGame, isBotTurn } from "./index";
import { nextId } from "./ids";
import type { Bourbon, GameState } from "./types";

/** Drive every seat with the bot until the game ends or a guard trips. */
function autoplay(g: GameState, maxSteps = 5000): GameState {
  let s = g;
  let steps = 0;
  while (s.phase === "playing" && steps++ < maxSteps) {
    const a = botAction(s);
    if (!a) throw new Error(`no bot action at age ${s.age} round ${s.round} stage ${s.stage}`);
    const r = applyAction(s, a);
    if (!r.ok) throw new Error(`refused ${a.type}: ${r.reason}`);
    s = r.state;
  }
  if (steps >= maxSteps) throw new Error("autoplay did not terminate");
  return s;
}

describe("map game engine smoke", () => {
  it("plays a full game to completion with all bots", () => {
    const g = createMapGame({ seed: 7, playerNames: ["A", "B"], botFlags: [true, true] });
    const end = autoplay(g);
    expect(end.phase).toBe("ended");
    expect(end.log.some((l) => l.includes("Game over"))).toBe(true);
  });

  it("advances through age 1 into age 2", () => {
    let g = createMapGame({ seed: 3, playerNames: ["A", "B"], botFlags: [true, true] });
    let steps = 0;
    while (g.phase === "playing" && g.age < 2 && steps++ < 2000) {
      const a = botAction(g)!;
      const r = applyAction(g, a);
      expect(r.ok).toBe(true);
      if (r.ok) g = r.state;
    }
    expect(g.age).toBeGreaterThanOrEqual(2);
  });

  it("resolves a Push: attacker wins, knocks a DP inactive, burns its bourbon", () => {
    const g = createMapGame({ seed: 5, playerNames: ["You", "Rival"], botFlags: [false, true] });
    // Force into an act turn owned by the human with bips + Capital.
    const tile = g.tiles[0]!;
    g.stage = "act";
    g.turnOrder = [0];
    g.turnPos = 0;
    const me = g.players[0]!;
    const rival = g.players[1]!;
    me.bips = 5;
    me.capital = 10;
    // exactly one active DP each on the tile
    g.dps = g.dps.filter((d) => d.tileId !== tile.id);
    g.dps.push({ id: nextId("dp"), owner: me.id, tileId: tile.id, status: "active" });
    g.dps.push({ id: nextId("dp"), owner: rival.id, tileId: tile.id, status: "active" });
    // a fresh, well-matched bourbon in the attacker's cellar
    const b: Bourbon = {
      id: nextId("bourbon"), defId: "x", name: "Test Rye", traits: [...tile.traits],
      basePrice: 4, ceiling: 3, state: "fresh", locked: false, maturitySlot: 5, owner: me.id,
    };
    me.cellar = [b];

    const r = applyAction(g, { type: "PUSH", variant: "attack", tileId: tile.id, defender: rival.id, bourbonIds: [b.id] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const s = r.state;
    // rival's DP on the tile is now inactive
    expect(s.dps.filter((d) => d.tileId === tile.id && d.owner === rival.id && d.status === "active").length).toBe(0);
    // attacker's committed bourbon is burned
    expect(s.players[0]!.cellar.length).toBe(0);
    // attacker paid Capital = defender active DPs (1)
    expect(s.players[0]!.capital).toBe(9);
    expect(s.log.some((l) => l.includes("wins by"))).toBe(true);
  });

  it("is always drivable — a bot action exists whenever it's a bot's turn", () => {
    let g = createMapGame({ seed: 42, playerNames: ["A", "B", "C"], botFlags: [true, true, true] });
    let steps = 0;
    while (g.phase === "playing" && steps++ < 3000) {
      expect(isBotTurn(g)).toBe(true); // all seats are bots here
      const a = botAction(g);
      expect(a).not.toBeNull();
      const r = applyAction(g, a!);
      expect(r.ok).toBe(true);
      if (r.ok) g = r.state;
    }
    expect(g.phase).toBe("ended");
  });
});
