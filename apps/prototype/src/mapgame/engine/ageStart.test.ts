import { describe, expect, it } from "vitest";
import { stepAuto } from "./bot";
import { CONFIG } from "./config";
import { createGame } from "./setup";
import type { GameState } from "./types";

// Run the setup phase so we land at the age-1 start.
function afterSetup(n: number, seed = 5): GameState {
  let s = createGame({ playerNames: Array.from({ length: n }, (_, i) => `P${i}`), seed });
  let guard = 0;
  while (s.phase === "setup" && guard++ < 500) s = stepAuto(s);
  return s;
}

describe("age start — deal 5 and play (no Trade / catch-up)", () => {
  for (const n of [2, 3, 4]) {
    const s = afterSetup(n);
    it(`${n}p: opens age 1 straight in round-1 planning`, () => {
      expect(s.phase).toBe("playing");
      expect(s.stage).toBe("planning");
      expect(s.round).toBe(1);
    });
    it(`${n}p: every player holds a fresh ${CONFIG.HAND_SIZE}-card hand`, () => {
      for (const p of s.players) expect(p.hand.length).toBe(CONFIG.HAND_SIZE);
    });
    it(`${n}p: round-1 initiative is the parked opening order (last drafter leads)`, () => {
      expect(s.initiative).toEqual(s.pendingInitiative);
      expect(s.initiative[0]).toBe(n - 1);
    });
  }
});
