import { describe, expect, it } from "vitest";
import {
  canAddFlag,
  canPlaceDP,
  controlledTiles,
  derivedNiches,
  hasMonopoly,
  liveDPCount,
  nicheStatus,
  qualifyingNiches,
  tileController,
  tileOwner,
  tilesContiguous,
} from "./derive";
import { mkDP, mkFlag, mkState, mkTile } from "./testkit";

// A small horizontal run of tiles at r=0: q = 0,1,2,3,4,5
function lineBoard(n: number) {
  return Array.from({ length: n }, (_, q) => mkTile({ q, r: 0 }, { id: `t${q}` }));
}

describe("control (brief §16.4)", () => {
  it("strictly more LIVE DPs than any rival = control", () => {
    const tiles = lineBoard(1);
    const s = mkState({ tiles, dps: [mkDP("A", "t0"), mkDP("A", "t0"), mkDP("B", "t0")] });
    expect(tileController(s, "t0")).toBe("A");
  });

  it("tie for most LIVE DPs = nobody controls", () => {
    const tiles = lineBoard(1);
    const s = mkState({ tiles, dps: [mkDP("A", "t0"), mkDP("B", "t0")] });
    expect(tileController(s, "t0")).toBeNull();
  });

  it("DARK DPs do not count toward control", () => {
    const tiles = lineBoard(1);
    const s = mkState({
      tiles,
      dps: [mkDP("A", "t0", "LIVE"), mkDP("B", "t0", "DARK"), mkDP("B", "t0", "DARK")],
    });
    expect(tileController(s, "t0")).toBe("A");
    expect(liveDPCount(s, "t0", "B")).toBe(0);
  });

  it("empty tile has no controller", () => {
    const s = mkState({ tiles: lineBoard(1) });
    expect(tileController(s, "t0")).toBeNull();
  });
});

describe("placement legality (brief §16.5)", () => {
  it("onto an uncontrolled tile is allowed", () => {
    const s = mkState({ tiles: lineBoard(3) });
    expect(canPlaceDP(s, "A", "t1")).toBe(true);
  });

  it("onto a tile you control is allowed", () => {
    const tiles = lineBoard(3);
    const s = mkState({ tiles, dps: [mkDP("A", "t0")] });
    expect(canPlaceDP(s, "A", "t0")).toBe(true);
  });

  it("onto a rival-controlled tile is allowed only if adjacent to one you control", () => {
    const tiles = lineBoard(3); // t0 - t1 - t2
    // B controls t1; A controls t0 (adjacent) -> A may build DARK on t1
    const s = mkState({
      tiles,
      dps: [mkDP("A", "t0"), mkDP("B", "t1")],
    });
    expect(canPlaceDP(s, "A", "t1")).toBe(true);
  });

  it("cannot grow through a rival: no controlled neighbor = rejected", () => {
    const tiles = lineBoard(3); // t0 - t1 - t2
    // B controls t1. A has only a DARK DP inside t1 and controls nothing adjacent.
    const s = mkState({
      tiles,
      dps: [mkDP("B", "t1"), mkDP("A", "t1", "DARK")],
    });
    // A wants to build on t2, behind B. t2 is uncontrolled -> allowed by uncontrolled rule.
    expect(canPlaceDP(s, "A", "t2")).toBe(true);
    // But building further on t1 (rival-controlled) with no controlled neighbor -> rejected.
    expect(canPlaceDP(s, "A", "t1")).toBe(false);
  });

  it("BLOCKING tiles reject placement", () => {
    const tiles = [mkTile({ q: 0, r: 0 }, { id: "t0", category: "BLOCKING" })];
    const s = mkState({ tiles });
    expect(canPlaceDP(s, "A", "t0")).toBe(false);
  });
});

describe("contiguity (blocking breaks chains)", () => {
  it("a straight run is contiguous", () => {
    const s = mkState({ tiles: lineBoard(4) });
    expect(tilesContiguous(s, ["t0", "t1", "t2", "t3"])).toBe(true);
  });

  it("a gap breaks contiguity", () => {
    const s = mkState({ tiles: lineBoard(4) });
    expect(tilesContiguous(s, ["t0", "t1", "t3"])).toBe(false);
  });

  it("a blocking tile in the middle breaks the chain", () => {
    const tiles = [
      mkTile({ q: 0, r: 0 }, { id: "t0" }),
      mkTile({ q: 1, r: 0 }, { id: "b1", category: "BLOCKING" }),
      mkTile({ q: 2, r: 0 }, { id: "t2" }),
    ];
    const s = mkState({ tiles });
    expect(tilesContiguous(s, ["t0", "b1", "t2"])).toBe(false);
  });
});

describe("flag legality (brief v3 §9 / §17.6)", () => {
  it("first flag may go anywhere; later flags must chain adjacent", () => {
    const s = mkState({ tiles: lineBoard(4) }); // t0-t1-t2-t3
    expect(canAddFlag(s, "A", "t2")).toBe(true); // first flag, anywhere
    s.nicheFlags.push(mkFlag("A", "t2"));
    expect(canAddFlag(s, "A", "t1")).toBe(true); // adjacent to t2
    expect(canAddFlag(s, "A", "t3")).toBe(true); // adjacent to t2
    expect(canAddFlag(s, "A", "t0")).toBe(false); // not adjacent to any of A's flags
  });

  it("cannot flag the same tile twice or a blocking tile", () => {
    const tiles = [mkTile({ q: 0, r: 0 }, { id: "t0" }), mkTile({ q: 1, r: 0 }, { id: "b1", category: "BLOCKING" })];
    const s = mkState({ tiles, nicheFlags: [mkFlag("A", "t0")] });
    expect(canAddFlag(s, "A", "t0")).toBe(false);
    expect(canAddFlag(s, "A", "b1")).toBe(false);
  });
});

describe("ownership slot + monopoly (brief v3 §7, §6)", () => {
  it("tileOwner reads the DP in the ownership slot", () => {
    const dp = mkDP("A", "t0");
    const tile = mkTile({ q: 0, r: 0 }, { id: "t0", category: "LOYALTY", ownershipSlot: true, ownerSlotDP: dp.id });
    const s = mkState({ tiles: [tile], dps: [dp] });
    expect(tileOwner(s, "t0")).toBe("A");
  });

  it("hasMonopoly: your LIVE DP with no rival LIVE DP", () => {
    const tiles = lineBoard(1);
    const s = mkState({ tiles, dps: [mkDP("A", "t0"), mkDP("B", "t0", "DARK")] });
    expect(hasMonopoly(s, "t0", "A")).toBe(true); // rival DP is DARK
    s.dps.push(mkDP("B", "t0", "LIVE"));
    expect(hasMonopoly(s, "t0", "A")).toBe(false);
  });
});

describe("niches — derived from flags (brief §8)", () => {
  it("connected flags form one niche; a gap splits them", () => {
    const s = mkState({
      tiles: lineBoard(6),
      nicheFlags: [
        mkFlag("A", "t0"),
        mkFlag("A", "t1"),
        mkFlag("A", "t2"), // group 1
        mkFlag("A", "t4"),
        mkFlag("A", "t5"), // group 2 (t3 unflagged)
      ],
    });
    const ns = derivedNiches(s, "A");
    expect(ns.length).toBe(2);
    expect(ns.map((n) => n.tileIds.length).sort()).toEqual([2, 3]);
  });

  it("only groups of >= 5 qualify to harvest", () => {
    const s = mkState({
      tiles: lineBoard(6),
      nicheFlags: [0, 1, 2, 3, 4].map((q) => mkFlag("A", `t${q}`)),
    });
    expect(qualifyingNiches(s, "A").length).toBe(1);
  });

  it("a flag needs no DP (aspirational)", () => {
    const s = mkState({ tiles: lineBoard(1), nicheFlags: [mkFlag("A", "t0")] });
    expect(derivedNiches(s, "A")[0]!.tileIds).toEqual(["t0"]);
  });

  it("overlap: two players may flag the same tile independently", () => {
    const s = mkState({
      tiles: lineBoard(2),
      nicheFlags: [mkFlag("A", "t0"), mkFlag("B", "t0"), mkFlag("B", "t1")],
    });
    expect(derivedNiches(s, "A").length).toBe(1);
    expect(derivedNiches(s, "B")[0]!.tileIds.length).toBe(2);
  });
});

describe("niche harvest status (brief §10 — v4 two-tier)", () => {
  const flags5 = [0, 1, 2, 3, 4].map((q) => mkFlag("A", `t${q}`));

  it("control EVERY tile = full (tier1 + tier2 all rewards)", () => {
    const s = mkState({
      tiles: lineBoard(5),
      nicheFlags: flags5,
      dps: [0, 1, 2, 3, 4].map((q) => mkDP("A", `t${q}`)),
    });
    const niche = qualifyingNiches(s, "A")[0]!;
    expect(nicheStatus(s, niche)).toBe("full");
  });

  it("control SOME but not all = partial (tier1 only, no rewards)", () => {
    const s = mkState({
      tiles: lineBoard(5),
      nicheFlags: flags5,
      dps: [mkDP("A", "t0"), mkDP("A", "t1"), mkDP("A", "t2"), mkDP("B", "t4")], // t3 empty, t4 rival
    });
    const niche = qualifyingNiches(s, "A")[0]!;
    expect(nicheStatus(s, niche)).toBe("partial");
  });

  it("one rival-controlled tile denies tier 2 → partial, not full", () => {
    const s = mkState({
      tiles: lineBoard(5),
      nicheFlags: flags5,
      // A controls t0..t3; t4 contested 1-1 (nobody controls) → not all controlled
      dps: [mkDP("A", "t0"), mkDP("A", "t1"), mkDP("A", "t2"), mkDP("A", "t3"), mkDP("A", "t4"), mkDP("B", "t4")],
    });
    const niche = qualifyingNiches(s, "A")[0]!;
    expect(nicheStatus(s, niche)).toBe("partial");
  });

  it("control none = none", () => {
    const s = mkState({
      tiles: lineBoard(5),
      nicheFlags: flags5,
      dps: [mkDP("B", "t0"), mkDP("B", "t1"), mkDP("B", "t2"), mkDP("B", "t3")],
    });
    const niche = qualifyingNiches(s, "A")[0]!;
    expect(nicheStatus(s, niche)).toBe("none");
  });
});
