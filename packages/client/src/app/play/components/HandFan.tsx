"use client";

/**
 * Fan-arrange a row of card-sized children on a shallow arc.
 *
 * Each child sits in an absolutely-positioned `.hand-fan-card` slot
 * with inline `transform: translateY(...) rotate(...)`. CSS picks up
 * the hover override (`translateY(-22px) scale(1.04) rotate(0)`) to
 * pull the focused card upright at z-index 40.
 *
 * Card width assumes 130px (matches `CARD_SIZE_CLASS` / `HandCardTile`
 * size="md"); the slot "stride" (visible width per card after overlap)
 * is 100px, giving a 30px overlap so an 8-card hand spreads across
 * ~830px — wider than the old 590px so labels read in full.
 *
 * When `dealKey` is supplied and changes (the in-game hand passes
 * `lastDrawHand.seq` here), the inner wrapper remounts so every slot
 * replays the `hand-deal-in` keyframe defined in globals.css.
 */

import React from "react";

export default function HandFan({
  children,
  dealKey = 0,
}: {
  children: React.ReactNode;
  dealKey?: number;
}) {
  const slots = React.Children.toArray(children);
  const n = slots.length;
  const cardW = 130;
  const stride = 100;
  const totalW = n > 0 ? (n - 1) * stride + cardW : 0;
  const mid = (n - 1) / 2;
  return (
    <div className="relative flex min-w-0 flex-1 items-end justify-center py-2 pl-2 pr-3">
      <div
        key={dealKey}
        // Only opt into the deal-in keyframe when dealKey > 0 (the
        // in-game HandTray passing lastDrawHand.seq). Surfaces that
        // render an EXISTING hand — drafting modal, buy modal —
        // pass no dealKey and skip the animation entirely so the
        // CSS keyframe's translateY doesn't fight the inline
        // fan-arc transform on every parent re-render.
        className={dealKey > 0 ? "hand-fan-dealt" : undefined}
        style={{
          position: "relative",
          width: totalW,
          // Bumped from 156 to 200 to fit the taller (180px) cards
          // plus the lift offset at the fan's outer edges.
          height: 200,
        }}
      >
        {slots.map((child, i) => {
          const off = i - mid;
          const rot = off * 3.2;
          const lift = Math.abs(off) * 2.4;
          const x = i * stride;
          return (
            <div
              key={
                React.isValidElement(child) && child.key != null
                  ? child.key
                  : i
              }
              className="hand-fan-card"
              style={{
                left: x,
                width: cardW,
                transform: `translateY(${lift}px) rotate(${rot}deg)`,
                zIndex: i,
                animationDelay: `${i * 50}ms`,
              }}
            >
              {child}
            </div>
          );
        })}
      </div>
    </div>
  );
}
