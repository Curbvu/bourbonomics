/**
 * Distressed Distiller's Loan: $10 borrow, $15 repaid off the top of the
 * next Phase 1, with a punitive auto-siphon when partial repayment leaves
 * a residual debt.
 */

import { describe, expect, it } from "vitest";
import { createInitialState } from "@/lib/engine/setup";
import { reduce } from "@/lib/engine/reducer";
import { creditCash } from "@/lib/engine/cash";
import {
  enterFeesPhase,
  enterMarketPhase,
  startNextRound,
} from "@/lib/engine/phases";
import {
  DISTRESSED_LOAN_AMOUNT,
  DISTRESSED_LOAN_REPAYMENT,
  type GameState,
} from "@/lib/engine/state";

function gs(): GameState {
  return createInitialState({
    id: "g1",
    seed: 1,
    seats: [
      { name: "Alice", kind: "human" },
      { name: "Bob", kind: "bot", botDifficulty: "easy" },
    ],
  });
}

/** Force the engine into Phase 1 of a chosen round. */
function jumpToFees(state: GameState, round: number): GameState {
  state.round = round;
  enterFeesPhase(state);
  return state;
}

describe("loan constants", () => {
  it("loan principal is $10", () => {
    expect(DISTRESSED_LOAN_AMOUNT).toBe(10);
  });

  it("loan repayment is $15 ($5 interest)", () => {
    expect(DISTRESSED_LOAN_REPAYMENT).toBe(15);
    expect(DISTRESSED_LOAN_REPAYMENT - DISTRESSED_LOAN_AMOUNT).toBe(5);
  });
});

describe("loan — taking and repaying in full", () => {
  it("TAKE_DISTRESSED_LOAN: cash up by $10, loanRemaining $15, loanUsed=true", () => {
    let s = gs();
    // Force into fees phase with one barrel so rent is owed.
    s.rickhouses[0].barrels.push({
      barrelId: "b1",
      ownerId: "p1",
      rickhouseId: s.rickhouses[0].id,
      mash: [],
      mashBillId: "test",
      age: 0,
      barreledOnRound: 1,
    });
    // Drain p1's cash so they're loan-eligible.
    s.players.p1.cash = 0;
    s = jumpToFees(s, 2);
    s = reduce(s, { t: "TAKE_DISTRESSED_LOAN", playerId: "p1" });
    expect(s.players.p1.cash).toBe(DISTRESSED_LOAN_AMOUNT);
    expect(s.players.p1.loanRemaining).toBe(DISTRESSED_LOAN_REPAYMENT);
    expect(s.players.p1.loanSiphonActive).toBe(false); // not yet — first round
    expect(s.players.p1.loanUsed).toBe(true);
  });

  it("full repayment at next Phase 1 clears the loan", () => {
    let s = gs();
    s.players.p1.cash = 20;
    s.players.p1.loanRemaining = 15;
    s.players.p1.loanUsed = true;
    // Run the Phase-1 repayment path.
    s = jumpToFees(s, 3);
    expect(s.players.p1.cash).toBe(5);
    expect(s.players.p1.loanRemaining).toBe(0);
    expect(s.players.p1.loanSiphonActive).toBe(false);
  });
});

describe("loan — partial repayment activates siphon mode", () => {
  it("partial repayment leaves residual loanRemaining + activates siphon", () => {
    let s = gs();
    s.players.p1.cash = 6; // less than $15
    s.players.p1.loanRemaining = 15;
    s.players.p1.loanUsed = true;
    s = jumpToFees(s, 3);
    expect(s.players.p1.cash).toBe(0);
    expect(s.players.p1.loanRemaining).toBe(9);
    expect(s.players.p1.loanSiphonActive).toBe(true);
  });

  it("creditCash siphons income to the bank when siphon is active", () => {
    const s = gs();
    s.players.p1.cash = 0;
    s.players.p1.loanRemaining = 9;
    s.players.p1.loanSiphonActive = true;
    s.players.p1.loanUsed = true;
    creditCash(s, "p1", 5, "test:income");
    // Whole $5 went to the bank.
    expect(s.players.p1.cash).toBe(0);
    expect(s.players.p1.loanRemaining).toBe(4);
    expect(s.players.p1.loanSiphonActive).toBe(true);
  });

  it("creditCash splits a credit when it covers the residual + a surplus", () => {
    const s = gs();
    s.players.p1.cash = 0;
    s.players.p1.loanRemaining = 4;
    s.players.p1.loanSiphonActive = true;
    s.players.p1.loanUsed = true;
    creditCash(s, "p1", 10, "test:big_income");
    // $4 to bank → loan cleared; $6 to player.
    expect(s.players.p1.cash).toBe(6);
    expect(s.players.p1.loanRemaining).toBe(0);
    expect(s.players.p1.loanSiphonActive).toBe(false);
  });

  it("creditCash leaves cash untouched when siphon is OFF", () => {
    const s = gs();
    s.players.p1.cash = 0;
    s.players.p1.loanRemaining = 15;
    s.players.p1.loanSiphonActive = false; // fresh loan, due next Phase 1
    s.players.p1.loanUsed = true;
    creditCash(s, "p1", 7, "test:income");
    // Income lands normally; bank does NOT siphon (siphon mode requires
    // a prior partial repayment).
    expect(s.players.p1.cash).toBe(7);
    expect(s.players.p1.loanRemaining).toBe(15);
    expect(s.players.p1.loanSiphonActive).toBe(false);
  });
});

describe("loan — siphon-active player is frozen out of spending", () => {
  it("PAY_FEES is rejected with frozen_by_loan when siphon is active", () => {
    let s = gs();
    // Place a barrel for p1 so rent is owed.
    s.rickhouses[0].barrels.push({
      barrelId: "b1",
      ownerId: "p1",
      rickhouseId: s.rickhouses[0].id,
      mash: [],
      mashBillId: "test",
      age: 1,
      barreledOnRound: 1,
    });
    s.players.p1.cash = 5;
    s.players.p1.loanRemaining = 9;
    s.players.p1.loanSiphonActive = true;
    s.players.p1.loanUsed = true;
    s.phase = "fees";
    const cashBefore = s.players.p1.cash;
    s = reduce(s, {
      t: "PAY_FEES",
      playerId: "p1",
      barrelIds: ["b1"],
    });
    // Cash unchanged, error logged.
    expect(s.players.p1.cash).toBe(cashBefore);
    const lastError = s.log.filter((e) => e.kind.startsWith("error:")).pop();
    expect(lastError?.kind).toBe("error:frozen_by_loan");
  });

  it("free actions still resolve while frozen (no cash spent)", () => {
    let s = gs();
    s.players.p1.cash = 0;
    s.players.p1.loanRemaining = 9;
    s.players.p1.loanSiphonActive = true;
    s.players.p1.loanUsed = true;
    // Free window is active in Round 1, so a draw is free.
    expect(s.actionPhase.freeWindowActive).toBe(true);
    const handBefore = s.players.p1.resourceHand.length;
    s = reduce(s, { t: "DRAW_RESOURCE", playerId: "p1", pile: "corn" });
    expect(s.players.p1.resourceHand.length).toBe(handBefore + 1);
  });
});

describe("loan — round-trip cycle", () => {
  it("borrow → earn → siphon → cleared in same round if income is enough", () => {
    const s = gs();
    s.players.p1.cash = 0;
    s.players.p1.loanRemaining = 15;
    s.players.p1.loanSiphonActive = true; // pretend partial-repayment mode
    s.players.p1.loanUsed = true;
    creditCash(s, "p1", 20, "test:big_sale");
    expect(s.players.p1.loanRemaining).toBe(0);
    expect(s.players.p1.loanSiphonActive).toBe(false);
    expect(s.players.p1.cash).toBe(5); // $20 - $15 siphoned
  });

  it("loan_taken event records disbursed + repayment due", () => {
    let s = gs();
    s.rickhouses[0].barrels.push({
      barrelId: "b1",
      ownerId: "p1",
      rickhouseId: s.rickhouses[0].id,
      mash: [],
      mashBillId: "test",
      age: 0,
      barreledOnRound: 1,
    });
    s.players.p1.cash = 0;
    s = jumpToFees(s, 2);
    s = reduce(s, { t: "TAKE_DISTRESSED_LOAN", playerId: "p1" });
    const e = s.log.find((x) => x.kind === "loan_taken");
    expect(e?.data.disbursed).toBe(DISTRESSED_LOAN_AMOUNT);
    expect(e?.data.repaymentDue).toBe(DISTRESSED_LOAN_REPAYMENT);
  });

  it("a baron with loanRemaining > 0 cannot take a second loan", () => {
    let s = gs();
    s.rickhouses[0].barrels.push({
      barrelId: "b1",
      ownerId: "p1",
      rickhouseId: s.rickhouses[0].id,
      mash: [],
      mashBillId: "test",
      age: 0,
      barreledOnRound: 1,
    });
    s.players.p1.cash = 0;
    s.players.p1.loanRemaining = 9;
    s.players.p1.loanUsed = true;
    s.phase = "fees";
    s = reduce(s, { t: "TAKE_DISTRESSED_LOAN", playerId: "p1" });
    const lastError = s.log.filter((e) => e.kind.startsWith("error:")).pop();
    expect(lastError?.kind).toBe("error:loan_already_used");
  });
});

// Suppress "unused import" lint warnings in CI for helpers not exercised
// by the assertions above.
void enterMarketPhase;
void startNextRound;
