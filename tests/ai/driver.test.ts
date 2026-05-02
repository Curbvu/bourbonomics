import { describe, expect, it } from "vitest";
import { driveBots } from "@/lib/ai/driver";
import { reduce } from "@/lib/engine/reducer";
import { createInitialState } from "@/lib/engine/setup";
import {
  DISTRESSED_LOAN_AMOUNT,
  type GameState,
} from "@/lib/engine/state";

function gs(): { state: GameState; bot: string } {
  let state = createInitialState({
    id: "g",
    seed: 42,
    seats: [
      { name: "Human", kind: "human" },
      { name: "Bot", kind: "bot", botDifficulty: "normal" },
    ],
  });
  // Pass once to skip into Phase 2 → eventually we need to drive into fees.
  // For this test we simulate: bot has barrels, no cash, fees due.
  const [, bot] = state.playerOrder;
  state.players[bot].cash = 0;
  // Drop a barrel into a busy rickhouse so rent is non-trivial.
  const louisville = state.rickhouses.find((r) => r.id === "rickhouse-1")!;
  louisville.barrels.push(
    {
      barrelId: "b1",
      ownerId: bot,
      rickhouseId: "rickhouse-1",
      mash: [],
      mashBillId: state.players[bot].bourbonHand[0],
      age: 1,
      barreledOnRound: 1,
    },
    {
      barrelId: "b2",
      ownerId: bot,
      rickhouseId: "rickhouse-1",
      mash: [],
      mashBillId: state.players[bot].bourbonHand[0],
      age: 1,
      barreledOnRound: 1,
    },
  );
  // Force the phase to fees AND mark the human as resolved so the
  // driver advances to the bot (the per-player driver bails when the
  // next unresolved player needs human input).
  const [human] = state.playerOrder;
  state = { ...state, phase: "fees" };
  state.feesPhase.resolvedPlayerIds.push(human);
  return { state, bot };
}

describe("bot driver — distressed loan", () => {
  it("takes a loan when broke, has barrels, and rent is owed", () => {
    const { state, bot } = gs();
    expect(state.players[bot].cash).toBe(0);
    expect(state.players[bot].loanUsed).toBe(false);
    const after = driveBots(state);
    expect(after.players[bot].loanUsed).toBe(true);
    // After the loan: $10 in, then rent immediately consumed some/all.
    // What we care about is that the loan happened (loanUsed = true) and
    // that loanRemaining reflects the repayment debt.
    expect(after.players[bot].loanRemaining).toBeGreaterThan(0);
  });

  it("doesn't take the loan if cash already covers rent", () => {
    const { state, bot } = gs();
    state.players[bot].cash = 50; // plenty
    const after = driveBots(state);
    expect(after.players[bot].loanUsed).toBe(false);
    expect(after.players[bot].loanRemaining).toBe(0);
  });

  it("doesn't take the loan twice (loanUsed sticks)", () => {
    const { state, bot } = gs();
    // Pre-burn the loan: simulate a prior take + repayment.
    state.players[bot].loanUsed = true;
    state.players[bot].loanRemaining = 0;
    const startingCash = state.players[bot].cash;
    const after = driveBots(state);
    // Without loan, broke bot just skips rent — no cash injection.
    expect(after.players[bot].cash).toBe(startingCash);
    expect(after.players[bot].loanRemaining).toBe(0);
    // Sanity — DISTRESSED_LOAN_AMOUNT is the disbursement; not received.
    expect(after.players[bot].cash).toBeLessThan(DISTRESSED_LOAN_AMOUNT);
  });

  it("does not loan when there are no barrels to keep alive", () => {
    const { state, bot } = gs();
    // Strip every barrel — there's nothing for the loan to save.
    for (const h of state.rickhouses) h.barrels = [];
    const after = driveBots(state);
    expect(after.players[bot].loanUsed).toBe(false);
  });

  // Reduce here is exported only via the public surface; this assert
  // pins the import shape so future refactors don't break the driver.
  it("driver is callable with a freshly reduced state", () => {
    const { state } = gs();
    const next = reduce(state, { t: "ADVANCE" });
    expect(typeof driveBots(next)).toBe("object");
  });
});
