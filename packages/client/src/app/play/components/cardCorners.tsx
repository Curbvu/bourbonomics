"use client";

/**
 * Corner tab shared by every card silhouette on the table.
 *
 * Reads as a small notch in the card's top-right corner: flush with
 * the top edge, sharing the card's outer radius, with a desaturated
 * amber tint that anchors to the card rather than floating on top.
 * No drop shadow.
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
