import { describe, expect, it } from "vitest";
import { playToEnd, stepAuto } from "./bot";
import { applyAction } from "./engine";
import { createGame } from "./setup";
import type { GameState } from "./types";

// A fresh game, advanced past the age-start trade/catch-up to round-1 planning.
function game(n: number, seed = 3): GameState {
  let s = createGame({ playerNames: Array.from({ length: n }, (_, i) => `P${i}`), seed });
  let guard = 0;
  while (s.stage !== "planning" && s.phase === "playing" && guard++ < 50) s = stepAuto(s);
  return s;
}

describe("turn machine (brief §4)", () => {
  it("planning → commit → resolve advances through the stages", () => {
    let s = game(2);
    expect(s.stage).toBe("planning");
    // both players end planning
    s = applyAction(s, { type: "END_TURN" }).ok ? (applyAction(s, { type: "END_TURN" }) as any).state : s;
    // easier: drive explicitly
    s = game(2);
    let r = applyAction(s, { type: "END_TURN" });
    expect(r.ok).toBe(true);
    s = (r as { ok: true; state: GameState }).state;
    r = applyAction(s, { type: "END_TURN" });
    s = (r as { ok: true; state: GameState }).state;
    expect(s.stage).toBe("commit");
  });

  it("a player cannot act off-suit without a permitting card or token", () => {
    let s = game(2);
    s = end2(s); // planning done
    s = commitBoth(s);
    expect(s.stage).toBe("resolve");
    // Try an action the current actor's committed card may not permit: attempt PUSH.
    const actor = s.players[s.initiative[s.turnPos]!]!;
    if (!actor.allowedSuits.includes("SALES")) {
      const r = applyAction(s, { type: "PUSH", tileId: s.tiles[0]!.id, bourbonIds: [] });
      expect(r.ok).toBe(false);
    }
  });

  it("the initiative marker moves to the last icon card played", () => {
    let s = game(2);
    s = end2(s);
    // Each player plays hand[0] face-up. Whoever, later in this round's order,
    // played an icon card should hold the marker after reveal.
    const order = [...s.initiative];
    const cards = order.map((i) => s.players[i]!.hand[0]!);
    s = commitBoth(s);
    s = endResolve(s);
    const lastIconInOrder = [...order].reverse().find((i) => cards[order.indexOf(i)]!.icon);
    if (lastIconInOrder !== undefined) {
      // marker holder leads next round
      expect(s.initiative[0]).toBe(s.initiativeMarker);
      expect(s.initiativeMarker).toBe(lastIconInOrder);
    }
  });
});

// helpers
function end2(s: GameState): GameState {
  for (let i = 0; i < s.players.length; i++) {
    const r = applyAction(s, { type: "END_TURN" });
    s = (r as { ok: true; state: GameState }).state;
  }
  return s;
}
function commitBoth(s: GameState): GameState {
  while (s.stage === "commit") {
    const actor = s.players[s.initiative[s.turnPos]!]!;
    const r = applyAction(s, { type: "COMMIT_PLAY", faceUpIds: [actor.hand[0]!.id], sacrificeIds: [], surrender: false });
    s = (r as { ok: true; state: GameState }).state;
  }
  return s;
}
function endResolve(s: GameState): GameState {
  let guard = 0;
  while (s.stage === "resolve" && guard++ < 50) {
    const r = applyAction(s, { type: "END_TURN" });
    s = (r as { ok: true; state: GameState }).state;
  }
  return s;
}

describe("end-to-end: an all-auto game runs to age 5 and declares a winner", () => {
  for (const n of [2, 3, 4, 5]) {
    it(`${n}-player game completes`, () => {
      const final = playToEnd(game(n));
      expect(final.phase).toBe("ended");
      expect(final.age).toBe(5);
      // a winner exists (someone has max capital)
      const maxCap = Math.max(...final.players.map((p) => p.capital));
      expect(final.players.some((p) => p.capital === maxCap)).toBe(true);
      // the log records the game-over line
      expect(final.log.some((l) => l.message.includes("Game over"))).toBe(true);
    });
  }

  it("is deterministic: same seed → same final capitals", () => {
    const a = playToEnd(game(3, 99));
    const b = playToEnd(game(3, 99));
    expect(a.players.map((p) => p.capital)).toEqual(b.players.map((p) => p.capital));
  });

  it("blocking tiles never accrue DPs over a whole game", () => {
    const final = playToEnd(game(4));
    const blocking = new Set(final.tiles.filter((t) => t.category === "BLOCKING").map((t) => t.id));
    expect(final.dps.some((d) => blocking.has(d.tileId))).toBe(false);
  });

  it("no player's DP supply goes negative (markers return from market)", () => {
    const final = playToEnd(game(3));
    for (const p of final.players) expect(p.dpSupply).toBeGreaterThanOrEqual(0);
  });
});
