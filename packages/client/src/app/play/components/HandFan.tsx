"use client";

/**
 * Fan-arrange a row of card-sized children on a shallow arc.
 *
 * Each child sits in an absolutely-positioned `.hand-fan-card` slot
 * with inline `transform: translateY(...) rotate(...)`. CSS picks up
 * the hover override (`translateY(-22px) scale(1.04) rotate(0)`) to
 * pull the focused card upright at z-index 40.
 *
 * Size presets match `HandCardTile`:
 *   - md (default, in-game HandTray): 130×180 cards, 100px stride
 *   - sm (modals, drawers): 86×120 cards, 70px stride
 *
 * Stride choices keep the same proportional 30px overlap so the fan
 * "reads" the same density at either preset.
 *
 * When `dealKey` is supplied and changes (the in-game hand passes
 * `lastDrawHand.seq` here), the inner wrapper remounts so every slot
 * replays the `hand-deal-in` keyframe defined in globals.css.
 */

import React from "react";

export type HandFanSize = "sm" | "md";

interface FanGeometry {
  cardW: number;
  stride: number;
  containerH: number;
  /** Rotation degrees per index offset from center. */
  rot: number;
  /** Lift px per |offset| from center. */
  lift: number;
}

const FAN_GEOMETRY: Record<HandFanSize, FanGeometry> = {
  // sm — used by overlays/drawers (DrawBillOverlay, BuyOverlay, etc.)
  // Cards are HandCardTile size="sm" (86×120). Fan container needs to
  // fit ~120 height + lift + rotation pad.
  sm: { cardW: 86, stride: 70, containerH: 150, rot: 2.6, lift: 1.6 },
  // md — used by the in-game HandTray. Cards are CARD_SIZE_CLASS /
  // HandCardTile size="md" (130×180). Container fits 180 + lift + pad.
  md: { cardW: 130, stride: 100, containerH: 200, rot: 3.2, lift: 2.4 },
};

export default function HandFan({
  children,
  dealKey = 0,
  size = "md",
}: {
  children: React.ReactNode;
  dealKey?: number;
  size?: HandFanSize;
}) {
  const slots = React.Children.toArray(children);
  const n = slots.length;
  const geom = FAN_GEOMETRY[size];
  const totalW = n > 0 ? (n - 1) * geom.stride + geom.cardW : 0;
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
          height: geom.containerH,
        }}
      >
        {slots.map((child, i) => {
          const off = i - mid;
          const rot = off * geom.rot;
          const lift = Math.abs(off) * geom.lift;
          const x = i * geom.stride;
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
                width: geom.cardW,
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
