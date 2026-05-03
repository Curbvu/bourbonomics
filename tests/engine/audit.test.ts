/**
 * Audit action — soft-cap enforcement of the 10-card hand limit.
 */

import { describe, expect, it } from "vitest";
import { createInitialState } from "@/lib/engine/setup";
import { reduce } from "@/lib/engine/reducer";
import { handSize } from "@/lib/engine/checks";
import { HAND_LIMIT } from "@/lib/engine/state";
import type { GameState } from "@/lib/engine/state";
import { pastDistilleryDraft } from "@/tests/helpers/state";

function gs() {
  return pastDistilleryDraft(
    createInitialState({
      id: "g1",
      seed: 1,
      seats: [
        { name: "Alice", kind: "human" },
        { name: "Bob", kind: "bot", botDifficulty: "easy" },
      ],
    }),
  );
}

/** Stuff player p1 with N mash bills directly into their hand (bypassing draw). */
function fillBourbonHand(state: GameState, playerId: string, count: number) {
  const player = state.players[playerId];
  // Pull from the deck so the bills are real catalog cards.
  for (let i = 0; i < count; i += 1) {
    const id = state.market.bourbonDeck.pop();
    if (id) player.bourbonHand.push(id);
  }
}

describe("audit — soft hand cap", () => {
  it("calling audit with no overflow consumes the action and sets the round flag", () => {
    let s = gs();
    expect(s.actionPhase.auditCalledThisRound).toBe(false);
    const me = s.currentPlayerId;
    s = reduce(s, { t: "CALL_AUDIT", playerId: me });
    expect(s.actionPhase.auditCalledThisRound).toBe(true);
    // Nobody is over 10 — no pending discards anywhere.
    for (const id of s.playerOrder) {
      expect(s.players[id].pendingAuditOverage).toBe(null);
    }
    // Action consumed → next player is up.
    expect(s.currentPlayerId).not.toBe(me);
  });

  it("calling audit twice in a round is rejected", () => {
    let s = gs();
    const a = s.currentPlayerId;
    s = reduce(s, { t: "CALL_AUDIT", playerId: a });
    const b = s.currentPlayerId;
    const flagBefore = s.actionPhase.auditCalledThisRound;
    s = reduce(s, { t: "CALL_AUDIT", playerId: b });
    // Flag stays true; the second call logs an error and returns control.
    expect(s.actionPhase.auditCalledThisRound).toBe(flagBefore);
    expect(s.players[b].pendingAuditOverage).toBe(null);
  });

  it("audited overflowing player must discard down to HAND_LIMIT", () => {
    let s = gs();
    // Manually overload p1's bourbon hand to 12 cards.
    fillBourbonHand(s, "p1", 12 - s.players.p1.bourbonHand.length);
    expect(handSize(s.players.p1)).toBeGreaterThan(HAND_LIMIT);
    // p2 calls audit. Need p2 to be the current player.
    const start = s.currentPlayerId;
    if (start !== "p2") {
      s = reduce(s, { t: "PASS_ACTION", playerId: start });
    }
    s = reduce(s, { t: "CALL_AUDIT", playerId: "p2" });
    const overage = s.players.p1.pendingAuditOverage;
    expect(overage).toBe(handSize(s.players.p1) - HAND_LIMIT);
    // Now p1 resolves the discard. Pick the first `overage` mash bills.
    const toDrop = s.players.p1.bourbonHand.slice(0, overage!);
    s = reduce(s, {
      t: "AUDIT_DISCARD",
      playerId: "p1",
      mashBillIds: toDrop,
      investmentInstanceIds: [],
      operationsInstanceIds: [],
    });
    expect(s.players.p1.pendingAuditOverage).toBe(null);
    expect(handSize(s.players.p1)).toBe(HAND_LIMIT);
  });

  it("AUDIT_DISCARD with wrong count is rejected", () => {
    let s = gs();
    fillBourbonHand(s, "p1", 12 - s.players.p1.bourbonHand.length);
    if (s.currentPlayerId !== "p2") {
      s = reduce(s, { t: "PASS_ACTION", playerId: s.currentPlayerId });
    }
    s = reduce(s, { t: "CALL_AUDIT", playerId: "p2" });
    const overage = s.players.p1.pendingAuditOverage!;
    // Try discarding the wrong number of cards.
    const wrongPick = s.players.p1.bourbonHand.slice(0, overage - 1);
    s = reduce(s, {
      t: "AUDIT_DISCARD",
      playerId: "p1",
      mashBillIds: wrongPick,
      investmentInstanceIds: [],
      operationsInstanceIds: [],
    });
    // Overage still pending.
    expect(s.players.p1.pendingAuditOverage).toBe(overage);
  });
});
