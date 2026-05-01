/**
 * Distressed Distiller's Loan: $10 borrow, $15 repaid off the top of the
 * next Phase 1.
 */

import { describe, expect, it } from "vitest";
import {
  DISTRESSED_LOAN_AMOUNT,
  DISTRESSED_LOAN_REPAYMENT,
} from "@/lib/engine/state";

describe("loan constants", () => {
  it("loan principal is $10", () => {
    expect(DISTRESSED_LOAN_AMOUNT).toBe(10);
  });

  it("loan repayment is $15 ($5 interest)", () => {
    expect(DISTRESSED_LOAN_REPAYMENT).toBe(15);
    expect(DISTRESSED_LOAN_REPAYMENT - DISTRESSED_LOAN_AMOUNT).toBe(5);
  });
});
