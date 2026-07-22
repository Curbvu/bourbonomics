import { describe, expect, it } from "vitest";
import { runAgeEnd } from "./ageLoop";
import { CONFIG } from "./config";
import { mkDP, mkFlag, mkPlayer, mkState, mkTile } from "./testkit";
import type { GameState, Reward } from "./types";

// 5 tiles in a line, player A flags all 5 (a qualifying niche). Rewards seeded on
// two of them. Score at age 5 (terminal — runAgeEnd just scores + ends).
function nicheGame(setup: (s: GameState) => void, rewards: Record<string, Reward> = {}): GameState {
  const tiles = [0, 1, 2, 3, 4].map((q) =>
    mkTile({ q, r: 0 }, { id: `t${q}`, reward: rewards[`t${q}`] ?? null }),
  );
  const s = mkState({
    age: 5,
    players: [mkPlayer("A"), mkPlayer("B")],
    tiles,
    nicheFlags: [0, 1, 2, 3, 4].map((q) => mkFlag("A", `t${q}`)),
  });
  setup(s);
  return s;
}

describe("niche scoring — two stacking tiers (brief v4 §10)", () => {
  it("tier 1: +1 Capital per controlled claim, nothing for uncontrolled claims", () => {
    const s = nicheGame((st) => {
      // A controls t0,t1,t2 (no rival there); t3,t4 empty → uncontrolled
      st.dps.push(mkDP("A", "t0"), mkDP("A", "t1"), mkDP("A", "t2"));
    });
    runAgeEnd(s, []);
    // A controls 3 of 5 claims → +3. Not the WHOLE niche → no tier-2 rewards.
    expect(s.players[0]!.capital).toBe(3);
  });

  it("tier 2 is ALL-OR-NOTHING: control the whole niche → collect every reward", () => {
    const s = nicheGame(
      (st) => {
        st.dps.push(...[0, 1, 2, 3, 4].map((q) => mkDP("A", `t${q}`)));
      },
      { t1: { kind: "CAPITAL", amount: 3 }, t3: { kind: "TOKEN", token: "SALES" } },
    );
    runAgeEnd(s, []);
    // tier1: 5 controlled (+5). tier2: control ALL 5 → every reward: t1 cap3 (+3)
    // and t3 SALES token. Tiers stack.
    expect(s.players[0]!.capital).toBe(5 + 3);
    expect(s.players[0]!.tokens.SALES).toBe(1);
  });

  it("tier 2 pays NOTHING if one niche tile is controlled by a rival", () => {
    const s = nicheGame(
      (st) => {
        // A controls t0..t3; B controls t4 → A does NOT control the whole niche.
        st.dps.push(mkDP("A", "t0"), mkDP("A", "t1"), mkDP("A", "t2"), mkDP("A", "t3"), mkDP("B", "t4"));
      },
      { t1: { kind: "CAPITAL", amount: 3 }, t4: { kind: "CAPITAL", amount: 3 } },
    );
    runAgeEnd(s, []);
    // tier1: A controls 4 claims (+4). tier2: A misses t4 → no rewards at all,
    // not even t1's, which A controls. All-or-nothing.
    expect(s.players[0]!.capital).toBe(4);
  });

  it("control needs one more LIVE DP than a rival — a contested tile breaks tier 2", () => {
    const s = nicheGame(
      (st) => {
        st.dps.push(...[0, 1, 2, 3, 4].map((q) => mkDP("A", `t${q}`)));
        st.dps.push(mkDP("B", "t2")); // t2 now tied 1-1 → nobody controls it
      },
      { t1: { kind: "CAPITAL", amount: 3 } },
    );
    runAgeEnd(s, []);
    // A controls t0,t1,t3,t4 (4 claims, +4); t2 tied → uncontrolled. Not the whole
    // niche → no tier-2 rewards.
    expect(s.players[0]!.capital).toBe(4);
  });

  it("claims below the niche threshold score nothing", () => {
    const tiles = [0, 1, 2].map((q) => mkTile({ q, r: 0 }, { id: `t${q}` }));
    const s = mkState({
      age: 5,
      players: [mkPlayer("A")],
      tiles,
      nicheFlags: [0, 1, 2].map((q) => mkFlag("A", `t${q}`)), // only 3 < 5
      dps: [0, 1, 2].map((q) => mkDP("A", `t${q}`)),
    });
    runAgeEnd(s, []);
    expect(s.players[0]!.capital).toBe(0); // no niche → 0
  });
});
