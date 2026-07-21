import { describe, expect, it } from "vitest";
import { liveDPCount, tileOwner } from "./derive";
import { resolvePush } from "./push";
import { rye } from "./tags";
import { mkBourbon, mkDP, mkPlayer, mkState, mkTile } from "./testkit";
import type { GameState } from "./types";

function fight(setup: (s: GameState) => void, tags = [rye()]): GameState {
  const tile = mkTile({ q: 0, r: 0 }, { id: "t0", tags });
  const s = mkState({ players: [mkPlayer("A"), mkPlayer("B")], tiles: [tile], initiative: [0, 1] });
  setup(s);
  return s;
}

describe("the Push — outcomes (brief v3 §8)", () => {
  it("attacker with the better bourbon wins and removes loser DPs 1:1 outright", () => {
    const s = fight((st) => {
      st.tiles[0]!.tags = [rye(), rye()];
      st.dps.push(mkDP("A", "t0"), mkDP("A", "t0"), mkDP("B", "t0"));
      st.players[0]!.bourbons.push(mkBourbon("A", [rye(), rye()], { id: "ba" })); // fit 2
      // B has no fitting bourbon → strength 0 → margin 2 removes B's 1 DP outright
    });
    const res = resolvePush(s, "A", "t0", ["ba"]);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.winner).toBe("A");
    expect(liveDPCount(s, "t0", "B")).toBe(0);
    expect(s.dps.some((d) => d.owner === "B")).toBe(false); // removed, not darkened
  });

  it("committing depletes the bourbon (win)", () => {
    const s = fight((st) => {
      st.dps.push(mkDP("A", "t0"), mkDP("B", "t0"));
      st.players[0]!.bourbons.push(mkBourbon("A", [rye()], { id: "ba" }));
    });
    resolvePush(s, "A", "t0", ["ba"]);
    expect(s.players[0]!.bourbons[0]!.state).toBe("DEPLETED");
  });

  it("a TIE does nothing — no DP removed — but committed bourbons still deplete", () => {
    const s = fight((st) => {
      // B controls (2 vs 1); both field fit 1 → tie, B holds
      st.dps.push(mkDP("A", "t0"), mkDP("B", "t0"), mkDP("B", "t0"));
      st.players[0]!.bourbons.push(mkBourbon("A", [rye()], { id: "ba" }));
      st.players[1]!.bourbons.push(mkBourbon("B", [rye()], { id: "bb" }));
    });
    const res = resolvePush(s, "A", "t0", ["ba"]);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.winner).toBeNull();
    expect(liveDPCount(s, "t0", "A")).toBe(1); // no removal
    expect(liveDPCount(s, "t0", "B")).toBe(2);
    expect(s.players[0]!.bourbons[0]!.state).toBe("DEPLETED");
    expect(s.players[1]!.bourbons[0]!.state).toBe("DEPLETED");
  });

  it("only FRESH bourbons may be committed", () => {
    const s = fight((st) => {
      st.dps.push(mkDP("A", "t0"));
      st.players[0]!.bourbons.push(mkBourbon("A", [rye()], { id: "ba", state: "DEPLETED" }));
    });
    const res = resolvePush(s, "A", "t0", ["ba"]);
    expect(res.ok).toBe(false);
  });

  it("cannot commit more bourbons than LIVE DPs", () => {
    const s = fight((st) => {
      st.dps.push(mkDP("A", "t0"));
      st.players[0]!.bourbons.push(mkBourbon("A", [rye()], { id: "b1" }), mkBourbon("A", [rye()], { id: "b2" }));
    });
    expect(resolvePush(s, "A", "t0", ["b1", "b2"]).ok).toBe(false);
  });

  it("retreating defender keeps its bourbons FRESH", () => {
    const s = fight((st) => {
      st.tiles[0]!.tags = [rye(), rye()];
      st.dps.push(mkDP("A", "t0"), mkDP("A", "t0"), mkDP("B", "t0"));
      st.players[0]!.bourbons.push(mkBourbon("A", [rye(), rye()], { id: "ba" })); // fit 2
      st.players[1]!.bourbons.push(mkBourbon("B", [rye()], { id: "bb" })); // fit 1 < 2 → retreat
    });
    resolvePush(s, "A", "t0", ["ba"]);
    expect(s.players[1]!.bourbons[0]!.state).toBe("FRESH");
  });
});

describe("the Push — ownership capture (brief v3 §8)", () => {
  it("clears the owner's DPs slot-last, then seats the winner in the slot", () => {
    // B owns a Loyalty tile (defense +2) with 2 DPs, the slot DP shielded.
    const slotDP = mkDP("B", "t0");
    const otherB = mkDP("B", "t0");
    const a1 = mkDP("A", "t0");
    const a2 = mkDP("A", "t0");
    const a3 = mkDP("A", "t0");
    const tile = mkTile(
      { q: 0, r: 0 },
      { id: "t0", category: "LOYALTY", tags: [], defenseBonus: 2, ownershipSlot: true, ownerSlotDP: slotDP.id, wildcardTag: rye() },
    );
    const s = mkState({
      players: [mkPlayer("A"), mkPlayer("B")],
      tiles: [tile],
      dps: [slotDP, otherB, a1, a2, a3],
      initiative: [0, 1],
    });
    // A commits 3 rye (fit 1 each vs single-rye wildcard) = strength 3.
    // B defends fit... B has no bourbon → strength 0 (+2 only if it commits). Retreats.
    // margin 3 vs B's 2 DPs → both removed (slot last) → A seats the slot.
    s.players[0]!.bourbons.push(
      mkBourbon("A", [rye()], { id: "a1b" }),
      mkBourbon("A", [rye()], { id: "a2b" }),
      mkBourbon("A", [rye()], { id: "a3b" }),
    );
    const res = resolvePush(s, "A", "t0", ["a1b", "a2b", "a3b"]);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.winner).toBe("A");
    expect(liveDPCount(s, "t0", "B")).toBe(0);
    expect(tileOwner(s, "t0")).toBe("A"); // winner seated in the slot
  });

  it("owner's defense bonus can hold the slot against a stronger raw attack", () => {
    const slotDP = mkDP("B", "t0");
    const tile = mkTile(
      { q: 0, r: 0 },
      { id: "t0", category: "LOYALTY", tags: [], defenseBonus: 2, ownershipSlot: true, ownerSlotDP: slotDP.id, wildcardTag: rye() },
    );
    const s = mkState({
      players: [mkPlayer("A"), mkPlayer("B")],
      tiles: [tile],
      dps: [slotDP, mkDP("A", "t0"), mkDP("A", "t0")],
      initiative: [0, 1],
    });
    s.players[0]!.bourbons.push(mkBourbon("A", [rye()], { id: "a1b" }), mkBourbon("A", [rye()], { id: "a2b" })); // strength 2
    s.players[1]!.bourbons.push(mkBourbon("B", [rye()], { id: "b1b" })); // fit 1 + owner 2 = 3 > 2 → B holds
    const res = resolvePush(s, "A", "t0", ["a1b", "a2b"]);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.winner).toBe("B");
    expect(tileOwner(s, "t0")).toBe("B");
  });
});
