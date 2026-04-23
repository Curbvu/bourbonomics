import { describe, expect, it } from "vitest";
import { createInitialState } from "@/lib/engine/setup";
import { reduce } from "@/lib/engine/reducer";
import type { GameState } from "@/lib/engine/state";

function newGame() {
  return createInitialState({
    id: "g1",
    seed: 1,
    seats: [
      { name: "Alice", kind: "human" },
      { name: "Bob", kind: "bot", botDifficulty: "easy" },
    ],
  });
}


describe("reducer — opening flow", () => {
  it("starts in opening with each player drafted 6 cards", () => {
    const s = newGame();
    expect(s.phase).toBe("opening");
    expect(s.round).toBe(1);
    expect(s.players.p1.openingDraft).toHaveLength(6);
    expect(s.players.p2.openingDraft).toHaveLength(6);
  });

  it("OPENING_KEEP must select exactly 3 cards from the draft", () => {
    const s = newGame();
    const draft = s.players.p1.openingDraft!;
    const bad = reduce(s, {
      t: "OPENING_KEEP",
      playerId: "p1",
      keptIds: draft.slice(0, 2),
    });
    expect(bad.players.p1.openingKeptBeforeAuction).toBeNull();
    expect(bad.log.some((l) => l.kind.startsWith("error:"))).toBe(true);

    const good = reduce(s, {
      t: "OPENING_KEEP",
      playerId: "p1",
      keptIds: draft.slice(0, 3),
    });
    expect(good.players.p1.openingKeptBeforeAuction).toEqual(draft.slice(0, 3));
    expect(good.players.p1.openingDraft).toBeNull();
  });

  it("commits opening hand and enters action phase round 1 (skipping fees)", () => {
    let s = newGame();
    for (const id of ["p1", "p2"]) {
      const draft = s.players[id].openingDraft!;
      s = reduce(s, { t: "OPENING_KEEP", playerId: id, keptIds: draft.slice(0, 3) });
    }
    for (const id of ["p1", "p2"]) {
      s = reduce(s, {
        t: "OPENING_COMMIT",
        playerId: id,
        decisions: ["hold", "hold", "hold"],
      });
    }
    expect(s.phase).toBe("action");
    expect(s.round).toBe(1);
    expect(s.players.p1.investments.length).toBe(3);
    expect(s.players.p1.investments.every((i) => i.status === "unbuilt")).toBe(true);
    expect(s.players.p2.investments.every((i) => i.status === "unbuilt")).toBe(true);
  });

  it("implementing a card during opening marks it funded_waiting, not active", () => {
    let s = newGame();
    for (const id of ["p1", "p2"]) {
      const draft = s.players[id].openingDraft!;
      s = reduce(s, { t: "OPENING_KEEP", playerId: id, keptIds: draft.slice(0, 3) });
    }
    // p1 tries to implement all 3 (may be forced to hold if under capital).
    s = reduce(s, {
      t: "OPENING_COMMIT",
      playerId: "p1",
      decisions: ["implement", "implement", "implement"],
    });
    s = reduce(s, {
      t: "OPENING_COMMIT",
      playerId: "p2",
      decisions: ["hold", "hold", "hold"],
    });
    const p1 = s.players.p1;
    // Whatever the cash allowed, implemented cards are waiting — no "active" in round 1.
    expect(p1.investments.every((i) => i.status === "unbuilt" || i.status === "funded_waiting")).toBe(true);
    expect(p1.investments.every((i) => i.status !== "active")).toBe(true);
  });
});

describe("reducer — action phase paid-action ladder", () => {
  it("first pass records firstPasserId but free window stays open until end of lap", () => {
    let s = openTo(newGame());
    expect(s.actionPhase.freeWindowActive).toBe(true);
    expect(s.actionPhase.paidLapTier).toBe(0);

    const firstPlayer = s.currentPlayerId;
    s = reduce(s, { t: "PASS_ACTION", playerId: firstPlayer });
    expect(s.firstPasserId).toBe(firstPlayer);
    // Lap is not over yet — second player can still act for free.
    expect(s.actionPhase.freeWindowActive).toBe(true);
    expect(s.actionPhase.paidLapTier).toBe(0);
  });

  it("free window closes at end of the first-pass lap; next-lap tier becomes $1", () => {
    let s = openTo(newGame());
    s = reduce(s, { t: "PASS_ACTION", playerId: s.currentPlayerId });
    s = reduce(s, { t: "PASS_ACTION", playerId: s.currentPlayerId });
    // Both passed in a single lap → phase ends.
    expect(s.phase).toBe("market");
    expect(s.actionPhase.freeWindowActive).toBe(false);
    expect(s.actionPhase.paidLapTier).toBe(1);
  });
});

describe("reducer — market phase", () => {
  it("each player rolls once and demand may shift", () => {
    let s = openTo(newGame());
    s = reduce(s, { t: "PASS_ACTION", playerId: s.currentPlayerId });
    s = reduce(s, { t: "PASS_ACTION", playerId: s.currentPlayerId });
    expect(s.phase).toBe("market");
    const startDemand = s.demand;
    s = reduce(s, { t: "ROLL_DEMAND", playerId: s.currentPlayerId });
    s = reduce(s, { t: "ROLL_DEMAND", playerId: s.currentPlayerId });
    // Both market resolutions done — should advance to round 2 fees.
    expect(s.round).toBe(2);
    expect(s.phase).toBe("fees");
    expect(s.demand).toBeGreaterThanOrEqual(0);
    expect(s.demand).toBeLessThanOrEqual(12);
    // Sanity: demand changed by at most 2 (1 per roll).
    expect(Math.abs(s.demand - startDemand)).toBeLessThanOrEqual(2);
  });
});

// ---------- Helpers ----------

/** Drive the opening phase forward to the start of the action phase using "hold" for all kept cards. */
function openTo(s0: GameState): GameState {
  let s = s0;
  for (const id of s.playerOrder) {
    const draft = s.players[id].openingDraft!;
    s = reduce(s, { t: "OPENING_KEEP", playerId: id, keptIds: draft.slice(0, 3) });
  }
  for (const id of s.playerOrder) {
    s = reduce(s, {
      t: "OPENING_COMMIT",
      playerId: id,
      decisions: ["hold", "hold", "hold"],
    });
  }
  return s;
}
