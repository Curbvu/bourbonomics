import { describe, expect, it } from "vitest";
import { stepAuto } from "./bot";
import { applyAction } from "./engine";
import { createGame } from "./setup";
import type { GameState } from "./types";

function newGame(n: number, seed = 5): GameState {
  // all-human so we can drive every player's trade/catch-up explicitly — but
  // first auto-run the setup phase so we land at the age-start Trade stage.
  let s = createGame({
    playerNames: Array.from({ length: n }, (_, i) => `P${i}`),
    bots: Array.from({ length: n }, () => false),
    seed,
  });
  let guard = 0;
  while (s.phase === "setup" && guard++ < 500) s = stepAuto(s);
  return s;
}
function apply(s: GameState, a: Parameters<typeof applyAction>[1]): GameState {
  const r = applyAction(s, a);
  if (!r.ok) throw new Error(r.reason);
  return r.state;
}
const actor = (s: GameState) => s.players[s.initiative[s.turnPos]!]!;

describe("age start — Trade (brief §4)", () => {
  it("opens in the trade stage with a catch-up board dealt", () => {
    const s = newGame(3);
    expect(s.stage).toBe("trade");
    expect(s.catchUpBoard.length).toBe(4); // PLAYERS + 1
    for (const p of s.players) expect(p.hand.length).toBe(5);
  });

  it("offering cards then all-pass conserves total hand size and returns the same count", () => {
    let s = newGame(2);
    const beforeCounts = s.players.map((p) => p.hand.length);
    const p0Offer = [s.players[0]!.hand[0]!.id, s.players[0]!.hand[1]!.id];
    s = apply(s, { type: "TRADE_OFFER", cardIds: p0Offer }); // P0 offers 2
    s = apply(s, { type: "TRADE_OFFER", cardIds: [] }); // P1 offers 0
    // after the trade resolves we move to catch-up; hand sizes are preserved
    expect(s.stage).toBe("catchup");
    expect(s.players.map((p) => p.hand.length)).toEqual(beforeCounts);
  });

  it("caps an offer at TRADE_MAX (extra ids ignored)", () => {
    let s = newGame(2);
    const three = s.players[0]!.hand.slice(0, 3).map((c) => c.id);
    s = apply(s, { type: "TRADE_OFFER", cardIds: three }); // 3 > TRADE_MAX(2)
    s = apply(s, { type: "TRADE_OFFER", cardIds: [] });
    expect(s.players[0]!.hand.length).toBe(5); // still 5 (2 out, 2 back)
  });
});

describe("age start — catch-up (brief §9)", () => {
  it("swaps a hand card for a board card, least-Capital player first", () => {
    let s = newGame(2);
    s = apply(s, { type: "TRADE_OFFER", cardIds: [] });
    s = apply(s, { type: "TRADE_OFFER", cardIds: [] });
    expect(s.stage).toBe("catchup");

    const swapper = actor(s);
    const handCard = swapper.hand[0]!;
    const boardCard = s.catchUpBoard[0]!;
    s = apply(s, { type: "CATCHUP_SWAP", handCardId: handCard.id, boardCardId: boardCard.id });

    const after = s.players.find((p) => p.id === swapper.id)!;
    expect(after.hand.some((c) => c.id === boardCard.id)).toBe(true);
    expect(after.hand.some((c) => c.id === handCard.id)).toBe(false);
  });

  it("passing catch-up for everyone reaches round-1 planning with the parked initiative", () => {
    let s = newGame(3);
    const pending = s.pendingInitiative.slice();
    s = apply(s, { type: "TRADE_OFFER", cardIds: [] });
    s = apply(s, { type: "TRADE_OFFER", cardIds: [] });
    s = apply(s, { type: "TRADE_OFFER", cardIds: [] });
    expect(s.stage).toBe("catchup");
    s = apply(s, { type: "CATCHUP_SWAP", handCardId: "", boardCardId: null });
    s = apply(s, { type: "CATCHUP_SWAP", handCardId: "", boardCardId: null });
    s = apply(s, { type: "CATCHUP_SWAP", handCardId: "", boardCardId: null });
    expect(s.stage).toBe("planning");
    expect(s.initiative).toEqual(pending);
  });
});
