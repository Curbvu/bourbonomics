"use client";

/**
 * Corner tabs shared by every card silhouette on the table.
 *
 * Top-RIGHT  → CornerCost  (amount required to purchase the card)
 * Top-LEFT   → CornerValue (amount the card pays toward a market buy)
 *
 * Visually these read as "tabs cut out of the card corner" rather than
 * floating chips: they mount flush against the card's top edge, share
 * the card's outer corner radius (rounded-md), and bleed into the body
 * via a darker translucent fill + inner-edge border. No drop shadow
 * (shadows make them look detached from the card).
 *
 * Resource and capital cards display both. Mash bills, ops, and
 * investments are non-spendable so they only get CornerCost.
 */

import { MoneyText } from "./money";

const TAB_BASE =
  "absolute top-0 z-10 inline-flex h-[20px] min-w-[28px] items-center justify-center px-1.5 font-mono text-[10px] font-bold leading-none backdrop-blur-[2px]";

export function CornerCost({ cost }: { cost: number }) {
  return (
    <span
      className={`${TAB_BASE} right-0 rounded-tr-[4px] rounded-bl-md border-b border-l border-amber-400/55 bg-gradient-to-bl from-amber-950/85 via-slate-950/85 to-slate-950/85 text-amber-200`}
      aria-label={`cost B$${cost}`}
    >
      <MoneyText n={cost} />
    </span>
  );
}

export function CornerValue({ value }: { value: number }) {
  return (
    <span
      className={`${TAB_BASE} left-0 rounded-tl-[4px] rounded-br-md border-b border-r border-emerald-400/55 bg-gradient-to-br from-emerald-950/85 via-slate-950/85 to-slate-950/85 text-emerald-200`}
      aria-label={`pays B$${value} when spent`}
    >
      <MoneyText n={value} />
    </span>
  );
}
