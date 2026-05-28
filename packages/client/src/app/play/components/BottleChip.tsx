"use client";

/**
 * BottleChip — small visual glyph for a Bottle (a sold mash bill,
 * post-flip). Used inline in LineStrip rows to show what's on a
 * player's flagship / secondary lines without taking up a full card
 * footprint.
 *
 * Tiered by `bottle.rarity` so the eye reads premium lines at a
 * glance. The glyph itself is a simple ▥ wordmark — keeping the
 * design dependency light; a richer SVG bottle silhouette can land
 * in a follow-up.
 */

import type { Bottle, MashBillTier } from "@bourbonomics/engine";

const TIER_INK: Record<MashBillTier, string> = {
  common: "var(--t-common)",
  uncommon: "var(--t-uncommon)",
  rare: "var(--t-rare)",
  epic: "var(--t-epic)",
  legendary: "var(--t-legendary)",
};

export default function BottleChip({
  bottle,
  size = "sm",
}: {
  bottle: Bottle;
  size?: "xs" | "sm";
}) {
  const ink = TIER_INK[bottle.rarity];
  const dim = size === "xs" ? 14 : 18;
  return (
    <span
      title={`${bottle.name} · ${bottle.rarity} · age ${bottle.ageAtSale} · demand ${bottle.demandAtSale}`}
      className="inline-grid place-items-center rounded-[3px] font-mono font-bold leading-none"
      style={{
        width: dim,
        height: dim,
        background: `linear-gradient(180deg, ${ink}33, rgba(0,0,0,.4))`,
        border: `1px solid ${ink}`,
        color: ink,
        fontSize: size === "xs" ? 9 : 10,
      }}
      aria-label={`bottle ${bottle.name}`}
    >
      ▥
    </span>
  );
}
