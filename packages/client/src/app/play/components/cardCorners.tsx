"use client";

/**
 * Corner tab shared by every card silhouette on the table.
 *
 * v2.11 (Unified Rep): cards no longer pay arbitrary "values" — rep
 * is the currency, Labor cards supplement via contribution, and
 * resource cards have no payment value. So the green CornerValue
 * tab is retired; only the top-right CornerCost remains.
 *
 * The cost tab reads as a small notch in the card's top-right
 * corner: flush with the top edge, sharing the card's outer
 * radius, with a desaturated amber tint that anchors to the card
 * rather than floating on top. No drop shadow.
 */

import { MoneyText } from "./money";

const TAB_BASE =
  "absolute top-0 right-0 z-10 inline-flex h-[16px] min-w-[22px] items-center justify-center rounded-tr-[4px] rounded-bl-[5px] border-b border-l px-1 font-mono text-[9px] font-bold leading-none";

export function CornerCost({ cost }: { cost: number }) {
  return (
    <span
      className={`${TAB_BASE} border-amber-400/30 bg-slate-950/70 text-amber-200/85`}
      aria-label={`cost B$${cost}`}
    >
      <MoneyText n={cost} />
    </span>
  );
}

/**
 * @deprecated v2.11 (Unified Rep): cards don't pay arbitrary values
 * anymore. Left as an inert stub so old imports don't crash while
 * call-sites get cleaned up; new code should not reference it.
 */
export function CornerValue(_: { value: number }) {
  return null;
}
