import { describe, expect, it } from "vitest";
import { CONFIG } from "./config";
import { neighborTiles } from "./derive";
import { createGame } from "./setup";
import type { GameState } from "./types";

function game(n: number, seed = 7): GameState {
  return createGame({ playerNames: Array.from({ length: n }, (_, i) => `P${i}`), seed });
}

describe("setup (brief §13)", () => {
  for (const n of [2, 3, 4]) {
    describe(`${n} players`, () => {
      const s = game(n);

      it("starts at age 1, round 1, playing, in the age-start Trade stage", () => {
        expect(s.age).toBe(1);
        expect(s.round).toBe(1);
        expect(s.phase).toBe("playing");
        expect(s.stage).toBe("trade");
      });

      it("seeds a 3-tile line at center", () => {
        for (let q = 0; q < CONFIG.SEED_LINE_TILES; q++) {
          expect(s.tiles.some((t) => t.hex.q === q && t.hex.r === 0)).toBe(true);
        }
      });

      it("every non-seed tile touches >= 2 existing tiles", () => {
        // Reconstruct: a tile placed later must have had >=2 neighbors at placement.
        // We can at least assert the final board: every tile beyond the seed line
        // has >= 2 neighbors now (monotonic — neighbors only grow).
        const seedKeys = new Set(
          Array.from({ length: CONFIG.SEED_LINE_TILES }, (_, q) => `${q},0`),
        );
        for (const t of s.tiles) {
          if (seedKeys.has(`${t.hex.q},${t.hex.r}`)) continue;
          expect(neighborTiles(s, t.hex).length).toBeGreaterThanOrEqual(CONFIG.TILE_MIN_ADJACENCY);
        }
      });

      it("lays out PLAYERS+1 market lots", () => {
        expect(s.market.length).toBe(CONFIG.marketLots(n));
      });

      it("places the blocking terrain", () => {
        expect(s.tiles.filter((t) => t.category === "BLOCKING").length).toBe(
          CONFIG.BLOCKING_TILE_COUNT,
        );
      });

      it("deals HAND_SIZE action cards to each player", () => {
        for (const p of s.players) expect(p.hand.length).toBe(CONFIG.HAND_SIZE);
      });

      it("first player = last drafter of the first snake round (index n-1)", () => {
        expect(s.startPlayerIndex).toBe(n - 1);
        // round-1 initiative is parked in pendingInitiative until the age-start stages finish
        expect(s.pendingInitiative[0]).toBe(n - 1);
      });

      it("every player has drafted bourbons and placed DPs in the opening", () => {
        for (const p of s.players) {
          expect(p.bourbons.length).toBeGreaterThan(0);
          expect(s.dps.some((d) => d.owner === p.id)).toBe(true);
        }
      });

      it("opening DPs are all LIVE", () => {
        expect(s.dps.every((d) => d.state === "LIVE")).toBe(true);
      });
    });
  }

  it("is deterministic: same seed → identical board", () => {
    const a = game(3, 42);
    const b = game(3, 42);
    expect(a.tiles.map((t) => `${t.name}@${t.hex.q},${t.hex.r}`)).toEqual(
      b.tiles.map((t) => `${t.name}@${t.hex.q},${t.hex.r}`),
    );
  });

  it("blocking tiles never hold DPs after setup", () => {
    const s = game(4);
    const blockingIds = new Set(s.tiles.filter((t) => t.category === "BLOCKING").map((t) => t.id));
    expect(s.dps.some((d) => blockingIds.has(d.tileId))).toBe(false);
  });
});
