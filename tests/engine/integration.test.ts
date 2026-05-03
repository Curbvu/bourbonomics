/**
 * Integration smoke test: play a short scripted game end-to-end to lock in the phase loop.
 */

import { describe, expect, it } from "vitest";
import { createInitialState } from "@/lib/engine/setup";
import { reduce } from "@/lib/engine/reducer";
import type { Action } from "@/lib/engine/actions";
import { BOURBON_CARDS_BY_ID } from "@/lib/catalogs/bourbon.generated";
import type { GameState } from "@/lib/engine/state";

function step(state: GameState, actions: Action[]): GameState {
  let s = state;
  for (const a of actions) s = reduce(s, a);
  return s;
}

function passUntilPhaseEnds(s: GameState): GameState {
  let out = s;
  let safety = 50;
  while (out.phase === "action" && safety-- > 0) {
    out = reduce(out, { t: "PASS_ACTION", playerId: out.currentPlayerId });
  }
  return out;
}

function resolveMarketUntilPhaseEnds(s: GameState): GameState {
  let out = s;
  let safety = 50;
  while (out.phase === "market" && safety-- > 0) {
    const cur = out.currentPlayerId;
    const stash = out.marketPhase[cur];
    if (!stash || stash.drawnCardIds.length === 0) {
      out = reduce(out, { t: "MARKET_DRAW", playerId: cur });
    } else {
      out = reduce(out, {
        t: "MARKET_KEEP",
        playerId: cur,
        keptCardId: stash.drawnCardIds[0],
      });
    }
  }
  return out;
}

describe("integration — full round loop", () => {
  it("plays 2 rounds: action (all pass) → market → fees → action → market", () => {
    let s = createInitialState({
      id: "g1",
      seed: 1337,
      seats: [
        { name: "Alice", kind: "human" },
        { name: "Bob", kind: "bot", botDifficulty: "easy" },
      ],
    });
    // Round 1 starts directly in action phase.
    expect(s.phase).toBe("action");
    expect(s.round).toBe(1);

    // Both players pass immediately to end action phase.
    s = passUntilPhaseEnds(s);
    expect(s.phase).toBe("market");

    // Market: each player draws 2 and keeps 1.
    s = resolveMarketUntilPhaseEnds(s);
    expect(s.round).toBe(2);
    expect(s.phase).toBe("fees");

    // Fees: no barrels exist, so both players resolve with an empty payment.
    s = step(s, [
      { t: "PAY_FEES", playerId: "p1", barrelIds: [] },
      { t: "PAY_FEES", playerId: "p2", barrelIds: [] },
    ]);
    expect(s.phase).toBe("action");
    expect(s.round).toBe(2);

    // One more full loop.
    s = passUntilPhaseEnds(s);
    s = resolveMarketUntilPhaseEnds(s);
    expect(s.round).toBe(3);
  });

  it("paid-action ladder: dispatching an action after a pass costs money", () => {
    let s = createInitialState({
      id: "g",
      seed: 1,
      seats: [
        { name: "A", kind: "human" },
        { name: "B", kind: "bot", botDifficulty: "easy" },
      ],
    });
    // Round 1 hands every player 8 free setup actions, which masks the
    // lap-cost ladder this test is about. Drain them to zero so we're
    // observing the table-wide free window + paid laps in isolation.
    for (const id of Object.keys(s.actionPhase.freeActionsRemainingByPlayer)) {
      s.actionPhase.freeActionsRemainingByPlayer[id] = 0;
    }

    const startingCashA = s.players.p1.cash;
    // Lap 1: p1 draws (free), p2 passes (first pass — free window closes at end of this lap).
    s = reduce(s, { t: "DRAW_RESOURCE", playerId: "p1", pile: "corn" });
    expect(s.players.p1.cash).toBe(startingCashA); // free
    s = reduce(s, { t: "PASS_ACTION", playerId: "p2" });
    // After the first lap closed, free window is off and next-lap tier = $1.
    expect(s.actionPhase.freeWindowActive).toBe(false);
    expect(s.actionPhase.paidLapTier).toBe(1);
    expect(s.firstPasserId).toBe("p2");

    // Lap 2: p1 takes a paid action — costs $1.
    const cashBeforePaid = s.players.p1.cash;
    s = reduce(s, { t: "DRAW_RESOURCE", playerId: "p1", pile: "corn" });
    expect(s.players.p1.cash).toBe(cashBeforePaid - 1);
  });

  it("making a valid bourbon places a barrel and removes resources from hand", () => {
    let s = createInitialState({
      id: "g",
      seed: 42,
      seats: [
        { name: "A", kind: "human" },
        { name: "B", kind: "bot", botDifficulty: "easy" },
      ],
    });
    // Give p1 a known mash by drawing during the free window. The market piles are shuffled so we
    // just draw from each required pile until p1 has 1 cask + 1 corn + 1 rye.
    function pullUntil(resource: "cask" | "corn" | "rye") {
      while (!s.players.p1.resourceHand.some((r) => r.resource === resource)) {
        s = reduce(s, { t: "DRAW_RESOURCE", playerId: "p1", pile: resource });
        if (s.currentPlayerId !== "p1") {
          // p2 gets a free draw too.
          s = reduce(s, { t: "DRAW_RESOURCE", playerId: "p2", pile: "corn" });
        }
      }
    }
    pullUntil("cask");
    pullUntil("corn");
    pullUntil("rye");

    const cask = s.players.p1.resourceHand.find((r) => r.resource === "cask")!;
    const corn = s.players.p1.resourceHand.find((r) => r.resource === "corn")!;
    const rye = s.players.p1.resourceHand.find((r) => r.resource === "rye")!;
    // Pick a mash bill from the player's starting bourbon hand. With
    // tier-shaped recipes, many bills now require more than 1 cask + 1
    // corn + 1 rye — find one that has no recipe constraint so this
    // minimal mash satisfies it.
    const billsByDef = s.players.p1.bourbonHand.map((id) => ({
      id,
      def: BOURBON_CARDS_BY_ID[id],
    }));
    const noRecipe = billsByDef.find((x) => !x.def?.recipe);
    expect(noRecipe).toBeTruthy();
    const mashBillId = noRecipe!.id;
    // Make bourbon in the first rickhouse.
    s = reduce(s, {
      t: "MAKE_BOURBON",
      playerId: "p1",
      rickhouseId: "rickhouse-0",
      resourceInstanceIds: [cask.instanceId, corn.instanceId, rye.instanceId],
      mashBillId,
    });
    const rickhouse = s.rickhouses.find((r) => r.id === "rickhouse-0")!;
    const myBarrels = rickhouse.barrels.filter((b) => b.ownerId === "p1");
    expect(myBarrels.length).toBe(1);
    expect(myBarrels[0].age).toBe(0);
    expect(myBarrels[0].mash.length).toBe(3);
    expect(myBarrels[0].mashBillId).toBe(mashBillId);
    // The mash bill should have left the player's bourbon hand.
    expect(s.players.p1.bourbonHand).not.toContain(mashBillId);
    // Those three cards should no longer be in hand.
    expect(
      s.players.p1.resourceHand.some((r) => r.instanceId === cask.instanceId),
    ).toBe(false);
  });
});
