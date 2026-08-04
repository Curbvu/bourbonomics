import { describe, expect, it } from "vitest";
import { stepAuto } from "./bot";
import { CONFIG } from "./config";
import { createGame } from "./setup";
import type { GameState } from "./types";

// Drive setup only — stop the moment age 1 opens the cull stage.
function atCull(n: number, seed = 5): GameState {
  let s = createGame({ playerNames: Array.from({ length: n }, (_, i) => `P${i}`), seed });
  let guard = 0;
  while (s.phase === "setup" && guard++ < 500) s = stepAuto(s);
  return s;
}
// Run setup AND the cull stage, so we land at round-1 planning.
function afterSetup(n: number, seed = 5): GameState {
  let s = atCull(n, seed);
  let guard = 0;
  while (s.stage === "cull" && guard++ < 100) s = stepAuto(s);
  return s;
}

describe("age start — draw 6, keep 5 (brief §4/§12)", () => {
  for (const n of [2, 3, 4]) {
    it(`${n}p: age 1 opens the cull stage with ${CONFIG.HAND_DRAW}-card hands`, () => {
      const s = atCull(n);
      expect(s.phase).toBe("playing");
      expect(s.stage).toBe("cull");
      for (const p of s.players) expect(p.hand.length).toBe(CONFIG.HAND_DRAW);
    });
    it(`${n}p: culling drops every hand to ${CONFIG.HAND_SIZE} and opens planning`, () => {
      const s = afterSetup(n);
      expect(s.stage).toBe("planning");
      expect(s.round).toBe(1);
      for (const p of s.players) expect(p.hand.length).toBe(CONFIG.HAND_SIZE);
    });
    it(`${n}p: round-1 initiative is the parked opening order (last drafter leads)`, () => {
      const s = afterSetup(n);
      expect(s.initiative).toEqual(s.pendingInitiative);
      expect(s.initiative[0]).toBe(n - 1);
    });
  }
});
