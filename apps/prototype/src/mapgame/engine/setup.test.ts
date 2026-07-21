import { describe, expect, it } from "vitest";
import { stepAuto } from "./bot";
import { CONFIG } from "./config";
import { neighborTiles } from "./derive";
import { applyAction } from "./engine";
import { placementCandidates, createGame } from "./setup";
import type { GameState } from "./types";

// Raw new game — sits at the interactive setup (setupPlace stage).
function game(n: number, seed = 7): GameState {
  return createGame({ playerNames: Array.from({ length: n }, (_, i) => `P${i}`), seed });
}
// Drive the whole setup (tile placement + opening draft) to completion via the
// auto-player, landing at age 1's Trade stage.
function played(n: number, seed = 7): GameState {
  let s = game(n, seed);
  let guard = 0;
  while (s.phase === "setup" && guard++ < 500) s = stepAuto(s);
  return s;
}
const ok = (s: GameState, a: Parameters<typeof applyAction>[1]): GameState => {
  const r = applyAction(s, a);
  if (!r.ok) throw new Error(r.reason);
  return r.state;
};

describe("setup — the fixed board (brief §13)", () => {
  for (const n of [2, 3, 4, 5]) {
    const s = game(n);
    it(`${n}p: opens in the interactive setupPlace stage`, () => {
      expect(s.phase).toBe("setup");
      expect(s.stage).toBe("setupPlace");
    });
    it(`${n}p: seeds a 3-tile line`, () => {
      for (let q = 0; q < CONFIG.SEED_LINE_TILES; q++) {
        expect(s.tiles.some((t) => t.hex.q === q && t.hex.r === 0)).toBe(true);
      }
    });
    it(`${n}p: the starting board is just the 3-tile line (no blocking yet)`, () => {
      expect(s.tiles.length).toBe(CONFIG.SEED_LINE_TILES);
      expect(s.tiles.filter((t) => t.category === "BLOCKING").length).toBe(0);
    });
    it(`${n}p: deals 5 setup tiles to each player, none yet placed`, () => {
      for (const p of s.players) expect(p.setupTiles.length).toBe(CONFIG.SETUP_TILES_PER_PLAYER);
      // hands are NOT dealt during setup
      for (const p of s.players) expect(p.hand.length).toBe(0);
    });
    it(`${n}p: lays out PLAYERS+1 market lots`, () => {
      expect(s.market.length).toBe(CONFIG.marketLots(n));
    });
  }
});

describe("setup — interactive placement & draft", () => {
  it("SETUP_PLACE_TILE places the actor's tile at a valid hex, then advances", () => {
    let s = game(2);
    const actor0 = s.players[s.initiative[s.turnPos]!]!;
    const before = actor0.setupTiles.length;
    const hex = placementCandidates(s)[0]!;
    s = ok(s, { type: "SETUP_PLACE_TILE", hex });
    const after = s.players.find((p) => p.id === actor0.id)!;
    expect(after.setupTiles.length).toBe(before - 1);
    expect(s.tiles.some((t) => t.hex.q === hex.q && t.hex.r === hex.r)).toBe(true);
  });

  it("rejects a placement that touches < 2 tiles or an occupied hex", () => {
    const s = game(2);
    // a far-away hex touches nothing
    expect(applyAction(s, { type: "SETUP_PLACE_TILE", hex: { q: 40, r: 40 } }).ok).toBe(false);
    // the seed hex is occupied
    expect(applyAction(s, { type: "SETUP_PLACE_TILE", hex: { q: 0, r: 0 } }).ok).toBe(false);
  });

  it("after all setup tiles are placed, the stage becomes setupDraft", () => {
    let s = game(3);
    let guard = 0;
    while (s.stage === "setupPlace" && guard++ < 100) {
      s = ok(s, { type: "SETUP_PLACE_TILE", hex: placementCandidates(s)[0]! });
    }
    expect(s.stage).toBe("setupDraft");
    expect(s.setupDraftSeq.length).toBe(3 * CONFIG.OPENING_DRAFT_PICKS);
    for (const p of s.players) expect(p.setupTiles.length).toBe(0);
  });

  it("draft: a bourbon OR a DP per pick; DP placement is adjacency-exempt", () => {
    // reach the draft
    let s = game(2);
    while (s.stage === "setupPlace") s = ok(s, { type: "SETUP_PLACE_TILE", hex: placementCandidates(s)[0]! });
    // first drafter takes a bourbon
    const lot = s.market[0]!;
    const d0 = s.players[s.setupDraftSeq[s.turnPos]!]!;
    s = ok(s, { type: "SETUP_DRAFT_BOURBON", lotId: lot.id });
    expect(s.players.find((p) => p.id === d0.id)!.bourbons.length).toBe(1);
    expect(s.market.length).toBe(CONFIG.marketLots(2)); // refilled
    // next drafter places a DP on any tile
    const anyTile = s.tiles.find((t) => t.category !== "BLOCKING")!;
    const d1 = s.players[s.setupDraftSeq[s.turnPos]!]!;
    s = ok(s, { type: "SETUP_PLACE_DP", tileId: anyTile.id });
    expect(s.dps.some((dp) => dp.owner === d1.id && dp.state === "LIVE")).toBe(true);
  });
});

describe("setup — completion opens age 1 (via auto-player)", () => {
  for (const n of [2, 3, 4, 5]) {
    const s = played(n);
    it(`${n}p: lands at age 1 Trade with hands dealt`, () => {
      expect(s.phase).toBe("playing");
      expect(s.stage).toBe("trade");
      for (const p of s.players) expect(p.hand.length).toBe(CONFIG.HAND_SIZE);
    });
    it(`${n}p: first player = last drafter of round 1 (index n-1)`, () => {
      expect(s.startPlayerIndex).toBe(n - 1);
      expect(s.pendingInitiative[0]).toBe(n - 1);
    });
    it(`${n}p: every player has bourbons and DPs from the opening`, () => {
      for (const p of s.players) {
        expect(p.bourbons.length + s.dps.filter((d) => d.owner === p.id).length).toBeGreaterThan(0);
      }
    });
    it(`${n}p: blocking terrain is placed once the board is built`, () => {
      expect(s.tiles.filter((t) => t.category === "BLOCKING").length).toBe(CONFIG.BLOCKING_TILE_COUNT);
    });
    it(`${n}p: opening DPs are LIVE; blocking tiles hold none`, () => {
      const blocking = new Set(s.tiles.filter((t) => t.category === "BLOCKING").map((t) => t.id));
      expect(s.dps.every((d) => d.state === "LIVE")).toBe(true);
      expect(s.dps.some((d) => blocking.has(d.tileId))).toBe(false);
    });
    it(`${n}p: every placed tile touches >= 2 existing tiles`, () => {
      const seed = new Set(Array.from({ length: CONFIG.SEED_LINE_TILES }, (_, q) => `${q},0`));
      for (const t of s.tiles) {
        if (seed.has(`${t.hex.q},${t.hex.r}`)) continue;
        expect(neighborTiles(s, t.hex).length).toBeGreaterThanOrEqual(CONFIG.TILE_MIN_ADJACENCY);
      }
    });
  }

  it("is deterministic: same seed → identical board", () => {
    const a = played(3, 42);
    const b = played(3, 42);
    expect(a.tiles.map((t) => `${t.name}@${t.hex.q},${t.hex.r}`)).toEqual(
      b.tiles.map((t) => `${t.name}@${t.hex.q},${t.hex.r}`),
    );
  });
});
