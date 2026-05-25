"use client";

/**
 * Fan-arrange a row of card-sized children on a shallow arc.
 *
 * Each child sits in an absolutely-positioned `.hand-fan-card` slot
 * with inline `transform: translateY(...) rotate(...)`. CSS picks up
 * the hover override (`translateY(-22px) scale(1.04) rotate(0)`) to
 * pull the focused card upright at z-index 40.
 *
 * Card width assumes 100px (matches `CARD_SIZE_CLASS` / `HandCardTile`
 * size="md"); the slot "stride" (visible width per card after overlap)
 * is 70px, giving a 30px overlap so an 8-card hand fits comfortably
 * under 800px.
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
  const cardW = 100;
  const stride = 70;
  const totalW = n > 0 ? (n - 1) * stride + cardW : 0;
  const mid = (n - 1) / 2;
  return (
    <div className="relative flex min-w-0 flex-1 items-end justify-center py-2 pl-2 pr-3">
      <div
        key={dealKey}
        className="hand-fan-dealt"
        style={{
          position: "relative",
          width: totalW,
          height: 156,
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
