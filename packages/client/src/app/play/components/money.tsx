/**
 * Currency formatting — single source of truth for the in-game unit.
 *
 * Bourbonomics uses one currency: "Bourbon dollars", abbreviated **B$**.
 * Earlier iterations split this into ¢ (resource cards = 1¢) and $
 * (capital cards = $N face value), which read as two units even though
 * the engine treats them as one. v2.2 unifies both as B$N.
 *
 * Usage:
 *   formatMoney(3)        → "B$3"
 *   formatMoney(0)        → "B$0"
 *   <MoneyText n={3} />   → JSX with the "B" stylized small + the number
 */

import type { ReactNode } from "react";

export function formatMoney(n: number): string {
  return `B$${n}`;
}

/**
 * Inline JSX renderer for B$N. Renders the "B$" prefix in a smaller,
 * dimmed font so the numeric value pops; falls back to plain text in
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
    <span className={className}>
      <span className="text-[0.65em] font-semibold tracking-tight opacity-80">
        B$
      </span>
      <span className="tabular-nums">{n}</span>
    </span>
  );
}
