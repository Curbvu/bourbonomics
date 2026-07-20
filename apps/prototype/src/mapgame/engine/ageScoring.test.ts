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

describe("niche scoring — three stacking tiers (brief v3 §9)", () => {
  it("tier 1: +1 Capital per controlled claim, nothing for uncontrolled claims", () => {
    const s = nicheGame((st) => {
      // A controls t0,t1,t2 (no rival there); t3,t4 empty → uncontrolled
      st.dps.push(mkDP("A", "t0"), mkDP("A", "t1"), mkDP("A", "t2"));
    });
    runAgeEnd(s, []);
    // A controls 3 claims → +3. Not a majority-of-5? 3/5 IS a majority → tier2,
    // but no reward tiles controlled here → still just +3.
    expect(s.players[0]!.capital).toBe(3);
  });

  it("tier 2: majority control collects rewards on the tiles you control", () => {
    const s = nicheGame(
      (st) => {
        // A controls t0,t1,t2 (majority); B controls t3,t4 → rival LIVE present → not monopoly
        st.dps.push(mkDP("A", "t0"), mkDP("A", "t1"), mkDP("A", "t2"), mkDP("B", "t3"), mkDP("B", "t4"));
      },
      { t1: { kind: "CAPITAL", amount: 3 }, t3: { kind: "CAPITAL", amount: 3 } },
    );
    runAgeEnd(s, []);
    // tier1: 3 controlled claims (+3). tier2: reward on t1 controlled by A (+3);
    // t3's reward is controlled by B → A doesn't get it. Total +6.
    expect(s.players[0]!.capital).toBe(6);
  });

  it("tier 3: monopoly (no rival LIVE anywhere) collects ALL niche rewards", () => {
    const s = nicheGame(
      (st) => {
        st.dps.push(...[0, 1, 2, 3, 4].map((q) => mkDP("A", `t${q}`)));
      },
      { t1: { kind: "CAPITAL", amount: 3 }, t3: { kind: "TOKEN", token: "SALES" } },
    );
    runAgeEnd(s, []);
    // tier1: 5 controlled (+5). tier3: all rewards → t1 cap3 (+3) and t3 SALES token.
    expect(s.players[0]!.capital).toBe(5 + 3);
    expect(s.players[0]!.tokens.SALES).toBe(1);
  });

  it("a DARK rival DP does not block monopoly", () => {
    const s = nicheGame(
      (st) => {
        st.dps.push(...[0, 1, 2, 3, 4].map((q) => mkDP("A", `t${q}`)));
        st.dps.push(mkDP("B", "t2", "DARK")); // dark rival — doesn't block
      },
      { t1: { kind: "CAPITAL", amount: 2 } },
    );
    runAgeEnd(s, []);
    expect(s.players[0]!.capital).toBe(5 + 2);
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
