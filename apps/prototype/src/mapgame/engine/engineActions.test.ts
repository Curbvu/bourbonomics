import { describe, expect, it } from "vitest";
import { applyAction } from "./engine";
import { tileOwner } from "./derive";
import { rye } from "./tags";
import { mkBourbon, mkDP, mkPlayer, mkState, mkTile } from "./testkit";
import type { GameState } from "./types";

// A resolve-stage state where player A has pips and the given allowed suits.
function resolveState(allowed: GameState["players"][number]["allowedSuits"], setup: (s: GameState) => void): GameState {
  const A = mkPlayer("A", { allowedSuits: allowed, pipsRemaining: 5 });
  const s = mkState({ stage: "resolve", players: [A], initiative: [0], turnPos: 0 });
  setup(s);
  return s;
}
const ok = (s: GameState, a: Parameters<typeof applyAction>[1]) => {
  const r = applyAction(s, a);
  if (!r.ok) throw new Error(r.reason);
  return r.state;
};

describe("REFRESH (Distill) — brief §7b", () => {
  it("returns a DEPLETED bourbon to FRESH", () => {
    let s = resolveState(["DISTILL"], (st) => {
      st.players[0]!.bourbons.push(mkBourbon("A", [rye()], { id: "b", state: "DEPLETED" }));
    });
    s = ok(s, { type: "REFRESH", bourbonId: "b" });
    expect(s.players[0]!.bourbons[0]!.state).toBe("FRESH");
  });

  it("refuses to refresh a FRESH bourbon", () => {
    const s = resolveState(["DISTILL"], (st) => {
      st.players[0]!.bourbons.push(mkBourbon("A", [rye()], { id: "b", state: "FRESH" }));
    });
    expect(applyAction(s, { type: "REFRESH", bourbonId: "b" }).ok).toBe(false);
  });

  it("is not permitted without a Distill card/token", () => {
    const s = resolveState(["SALES"], (st) => {
      st.players[0]!.bourbons.push(mkBourbon("A", [rye()], { id: "b", state: "DEPLETED" }));
    });
    expect(applyAction(s, { type: "REFRESH", bourbonId: "b" }).ok).toBe(false);
  });
});

describe("CLAIM_SLOT — empty ownership slot (brief §7, confirmed)", () => {
  it("seats a DP in an empty slot and sets the owner + wildcard", () => {
    let s = resolveState(["DISTRIBUTION"], (st) => {
      st.tiles.push(
        mkTile({ q: 0, r: 0 }, { id: "t0", category: "LOYALTY", tags: [], ownershipSlot: true }),
      );
      // A already has a LIVE DP on the tile (so placement is legal there)
      st.dps.push(mkDP("A", "t0"));
    });
    s = ok(s, { type: "CLAIM_SLOT", tileId: "t0", tag: rye() });
    expect(tileOwner(s, "t0")).toBe("A");
    expect(s.tiles[0]!.wildcardTag).toEqual(rye());
  });

  it("refuses when the slot is already owned", () => {
    const dp = mkDP("B", "t0");
    const s = resolveState(["DISTRIBUTION"], (st) => {
      st.tiles.push(
        mkTile({ q: 0, r: 0 }, { id: "t0", category: "LOYALTY", tags: [], ownershipSlot: true, ownerSlotDP: dp.id }),
      );
      st.dps.push(dp, mkDP("A", "t0"));
    });
    expect(applyAction(s, { type: "CLAIM_SLOT", tileId: "t0", tag: rye() }).ok).toBe(false);
  });
});

describe("chaining / surrender validation (brief §4)", () => {
  function commitState(setup: (s: GameState) => void): GameState {
    const A = mkPlayer("A");
    const s = mkState({ stage: "commit", players: [A], initiative: [0], turnPos: 0 });
    setup(s);
    return s;
  }

  it("chaining requires one sacrifice per chained card", () => {
    const s = commitState((st) => {
      st.players[0]!.hand = [
        { id: "c1", name: "x", suit: "SALES", pips: 3, icon: false },
        { id: "c2", name: "y", suit: "DISTILL", pips: 3, icon: false },
        { id: "c3", name: "z", suit: "SOURCING", pips: 2, icon: false },
      ];
    });
    // 2 face-up (1 chained) needs exactly 1 sacrifice
    expect(applyAction(s, { type: "COMMIT_PLAY", faceUpIds: ["c1", "c2"], sacrificeIds: [], surrender: false }).ok).toBe(false);
    const good = applyAction(s, { type: "COMMIT_PLAY", faceUpIds: ["c1", "c2"], sacrificeIds: ["c3"], surrender: false });
    expect(good.ok).toBe(true);
    if (good.ok) expect(good.state.players[0]!.committedFaceUp.length).toBe(2);
  });

  it("a cardless player auto-passes commit (chaining can empty a hand early)", () => {
    // A leads with one card; B has an empty hand. After A commits, B is auto-
    // passed and the round moves to resolve without deadlocking.
    const A = mkPlayer("A");
    const B = mkPlayer("B");
    A.hand = [{ id: "c1", name: "x", suit: "SALES", pips: 3, icon: true }];
    B.hand = [];
    const s = mkState({ stage: "commit", players: [A, B], initiative: [0, 1], turnPos: 0 });
    const r = applyAction(s, { type: "COMMIT_PLAY", faceUpIds: ["c1"], sacrificeIds: [], surrender: false });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.state.stage).toBe("resolve");
      expect(r.state.players[1]!.hasCommitted).toBe(true);
      expect(r.state.players[1]!.committedFaceUp).toEqual([]);
    }
  });

  it("surrender is exactly one face-down card", () => {
    const s = commitState((st) => {
      st.players[0]!.hand = [{ id: "c1", name: "x", suit: "SALES", pips: 3, icon: false }];
    });
    const r = applyAction(s, { type: "COMMIT_PLAY", faceUpIds: [], sacrificeIds: ["c1"], surrender: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.players[0]!.surrendered).toBe(true);
  });
});
