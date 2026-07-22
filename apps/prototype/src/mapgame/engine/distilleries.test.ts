import { describe, expect, it } from "vitest";
import { playToEnd } from "./bot";
import { DISTILLERY_ABILITIES, baseDistillery, runDistilleryTrigger } from "./distilleries";
import { createGame } from "./setup";
import type { GameState } from "./types";

describe("distillery hook (brief §17 — architecture, no content)", () => {
  it("every player starts with a symmetric (no-ability) distillery", () => {
    const s = createGame({ playerNames: ["A", "B", "C"], seed: 3 });
    for (const p of s.players) {
      expect(p.distillery.abilityId).toBeNull();
      expect(typeof p.distillery.name).toBe("string");
    }
  });

  it("ships with an EMPTY ability registry (base game is symmetric)", () => {
    expect(Object.keys(DISTILLERY_ABILITIES)).toHaveLength(0);
  });

  it("firing a trigger is a no-op while the registry is empty", () => {
    const s = createGame({ playerNames: ["A", "B"], seed: 9 });
    const before = JSON.stringify(s.players.map((p) => p.capital));
    for (const trig of ["onSetup", "onAgeStart", "onRoundStart", "onPushWin", "onPushLose", "onScoring", "onAgeEnd"] as const) {
      runDistilleryTrigger(s, trig);
    }
    expect(JSON.stringify(s.players.map((p) => p.capital))).toBe(before);
  });

  it("state carrying a distillery still deep-clones (structuredClone-safe) through a full game", () => {
    const s: GameState = playToEnd(createGame({ playerNames: ["A", "B", "C", "D"], seed: 21 }));
    expect(s.phase).toBe("ended");
    for (const p of s.players) expect(p.distillery).toBeDefined();
  });

  it("baseDistillery names the seat and carries no ability", () => {
    expect(baseDistillery("Rickhouse Row")).toEqual({ name: "Rickhouse Row", abilityId: null });
  });
});
