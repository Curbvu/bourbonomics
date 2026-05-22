/**
 * Currency formatting — single source of truth for the in-game unit.
 *
 * Bourbonomics uses one currency: reputation (and Labor cards as a
 * fungible supplement). Earlier iterations used "Bourbon dollars" (B$);
 * this helper still emits the B$ glyph for legacy UI hooks but new
 * surfaces increasingly read "rep" plain.
 *
 * Usage:
 *   formatMoney(3)        → "B$3"
 *   formatMoney(0)        → "B$0"
 *   <MoneyText n={3} />   → JSX with the stylized B$ glyph + the number
 */

import type { ReactNode } from "react";
import { BCurrency } from "./BCurrency";

export function formatMoney(n: number): string {
  return `B$${n}`;
}

/**
 * Inline JSX renderer for B$N. Renders the stylized B$ logotype glyph
 * (BCurrency) inline before the number; falls back to plain text in
 * environments that need it (tooltips, aria-labels — use `formatMoney`
 * for those).
 */
export function MoneyText({
  n,
  className = "",
}: {
  n: number;
  className?: string;
}): ReactNode {
  return (
    <span className={`inline-flex items-baseline gap-[0.15em] ${className}`}>
      <BCurrency
        className="self-center opacity-90"
        style={{ width: "0.85em", height: "0.85em" }}
      />
      <span className="tabular-nums">{n}</span>
    </span>
  );
}
