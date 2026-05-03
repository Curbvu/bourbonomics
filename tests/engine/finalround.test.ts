/**
 * Final-round trigger + scoring path: third unlocked Gold Bourbon
 * announces the final round; market phase is skipped; scoring runs.
 */

import { describe, expect, it } from "vitest";
import { createInitialState } from "@/lib/engine/setup";
import { reduce } from "@/lib/engine/reducer";
import { checkWinConditions } from "@/lib/engine/phases";
import type { GameState } from "@/lib/engine/state";
import { pastDistilleryDraft } from "@/tests/helpers/state";

function gs(): GameState {
  return pastDistilleryDraft(
    createInitialState({
      id: "g1",
      seed: 1337,
      seats: [
        { name: "Alice", kind: "human" },
        { name: "Bob", kind: "bot", botDifficulty: "easy" },
      ],
    }),
  );
}

describe("final round — trigger + scoring", () => {
  it("third Gold Bourbon sets finalRoundTriggered + finalRoundEndsOnRound but does NOT immediately end", () => {
    const s = gs();
    s.players.p1.goldBourbons.push("g1", "g2", "g3");
    checkWinConditions(s);
    expect(s.finalRoundTriggered).toBe(true);
    expect(s.finalRoundEndsOnRound).toBe(s.round);
    // Phase should remain whatever it was — NOT gameover.
    expect(s.phase).toBe("action");
    expect(s.winnerIds).toEqual([]);
  });

  it("only two Gold Bourbons does not trigger final round", () => {
    const s = gs();
    s.players.p1.goldBourbons.push("g1", "g2");
    checkWinConditions(s);
    expect(s.finalRoundTriggered).toBe(false);
    expect(s.finalRoundEndsOnRound).toBe(null);
  });

  it("action-phase end after final-round trigger goes to scoring + gameover, skipping market", () => {
    let s = gs();
    s.players.p1.goldBourbons.push("g1", "g2", "g3");
    checkWinConditions(s);
    expect(s.finalRoundTriggered).toBe(true);

    // Both players pass to end the action phase.
    s = reduce(s, { t: "PASS_ACTION", playerId: s.currentPlayerId });
    s = reduce(s, { t: "PASS_ACTION", playerId: s.currentPlayerId });

    // Should be `gameover`, NOT market.
    expect(s.phase).toBe("gameover");
    expect(s.winReason).toBe("final-round");
    expect(s.finalScores).not.toBe(null);
    expect(Object.keys(s.finalScores!)).toEqual(
      expect.arrayContaining(["p1", "p2"]),
    );
    expect(s.winnerIds.length).toBeGreaterThan(0);
  });

  it("subsequent Gold Bourbons in the trigger round do not move the end marker", () => {
    const s = gs();
    s.players.p1.goldBourbons.push("g1", "g2", "g3");
    checkWinConditions(s);
    const lockedRound = s.finalRoundEndsOnRound;
    s.players.p2.goldBourbons.push("g1", "g2", "g3");
    checkWinConditions(s);
    expect(s.finalRoundEndsOnRound).toBe(lockedRound);
  });
});
