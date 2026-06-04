"use client";

import { matrixValue, CONFIG } from "@bourbonomics/prototype-engine";
import type { Bourbon } from "@bourbonomics/prototype-engine";

const TIER_INK: Record<string, string> = {
  common: "var(--t-common)",
  specialty: "var(--t-specialty)",
  heritage: "var(--t-heritage)",
};

/**
 * A single aging barrel in the rickhouse. Oak-stave body + brass age
 * medallion; the medallion embers when the bourbon is sellable
 * (age >= MIN_SELL_AGE) and dims while it's still too young. Shows the
 * live sale preview at the current demand so the player can time the
 * market.
 */
export default function Barrel({
  bourbon,
  demand,
  canSell,
  onSell,
}: {
  bourbon: Bourbon;
  demand: number;
  canSell: boolean;
  onSell: () => void;
}) {
  const preview = matrixValue(bourbon.matrix, bourbon.age, demand);
  const ink = TIER_INK[bourbon.quality];
  const ready = bourbon.age >= CONFIG.MIN_SELL_AGE;

  return (
    <div className="pour-in flex w-[132px] flex-col gap-1.5">
      {/* barrel graphic */}
      <div className="brass-edge barrel-wood relative grid h-[78px] place-items-center overflow-hidden rounded-[10px]">
        {/* hoops */}
        <span className="pointer-events-none absolute inset-x-0 top-[12px] h-[3px] bg-gradient-to-b from-[#f3e2b4] via-[#b89358] to-[#5c3c1f]" />
        <span className="pointer-events-none absolute inset-x-0 bottom-[12px] h-[3px] bg-gradient-to-b from-[#f3e2b4] via-[#b89358] to-[#5c3c1f]" />
        {/* tier pip */}
        <span
          className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full"
          style={{ background: ink, boxShadow: `0 0 6px ${ink}` }}
          title={bourbon.quality}
        />
        {/* medallion */}
        <div
          className={[
            "brass-medallion grid h-12 w-12 place-items-center rounded-full",
            ready ? "ember-needs" : "ember-aged",
          ].join(" ")}
        >
          <span
            className="font-display font-bold leading-none text-[#1a120b]"
            style={{ fontSize: 20 }}
          >
            {bourbon.age}
          </span>
        </div>
      </div>

      <div
        className="line-clamp-1 text-[12px] font-semibold leading-tight"
        style={{ color: ink }}
      >
        {bourbon.name}
      </div>
      <div className="font-mono text-[10px] text-[var(--mute)]">
        ~{preview}฿ now
      </div>
      <button
        type="button"
        onClick={onSell}
        disabled={!canSell}
        className="w-full rounded border border-[var(--rule)] bg-[var(--panel)] px-1 py-1 font-mono text-[10px] uppercase tracking-[.08em] text-[var(--ink-muted)] transition hover:border-[var(--amber)] hover:text-[var(--gold)] disabled:opacity-40"
      >
        {canSell ? "Sell →" : `aging ${bourbon.age}/${CONFIG.MIN_SELL_AGE}`}
      </button>
    </div>
  );
}
