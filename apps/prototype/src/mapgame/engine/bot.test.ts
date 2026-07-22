import { describe, expect, it } from "vitest";
import { playToEnd } from "./bot";
import { CONFIG } from "./config";
import { qualifyingNiches } from "./derive";
import { createGame } from "./setup";
import type { GameState } from "./types";

function autoGame(n: number, seed: number): GameState {
  return playToEnd(createGame({ playerNames: Array.from({ length: n }, (_, i) => `P${i}`), seed }));
}

describe("strategic bots (brief §17 — play the win condition)", () => {
  for (const n of [2, 3, 4, 5]) {
    for (const seed of [1, 7, 42]) {
      const s = autoGame(n, seed);

      it(`${n}p seed ${seed}: reaches age 5 and ends`, () => {
        expect(s.phase).toBe("ended");
      });

      it(`${n}p seed ${seed}: every bot builds a qualifying niche (5+ contiguous claims)`, () => {
        for (const p of s.players) {
          expect(qualifyingNiches(s, p.id).length).toBeGreaterThanOrEqual(1);
        }
      });

      it(`${n}p seed ${seed}: bots actually score — the leader beats starting Capital`, () => {
        const top = Math.max(...s.players.map((p) => p.capital));
        expect(top).toBeGreaterThan(CONFIG.STARTING_CAPITAL);
      });
    }
  }

  it("is deterministic: same seed → identical final capitals", () => {
    const a = autoGame(4, 99);
    const b = autoGame(4, 99);
    expect(a.players.map((p) => p.capital)).toEqual(b.players.map((p) => p.capital));
  });

  it("never leaves a DP on a blocking tile over a full game", () => {
    const s = autoGame(4, 5);
    const blocking = new Set(s.tiles.filter((t) => t.category === "BLOCKING").map((t) => t.id));
    expect(s.dps.some((d) => blocking.has(d.tileId))).toBe(false);
  });
});
