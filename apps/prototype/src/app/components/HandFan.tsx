"use client";

/**
 * Fan-arrange a row of card-sized children on a shallow arc — ported
 * from the live game so the prototype hand reads the same. Each child
 * sits in an absolutely-positioned `.hand-fan-card` slot with an inline
 * `transform: translateY(lift) rotate(rot)`. CSS (globals.css) supplies
 * the hover override that pulls the focused card upright at z-40.
 *
 * Size presets match CardTile:
 *   - md (in-game hand): 130×180 cards, 100px stride
 *   - sm (tight rails):  86×120 cards, 70px stride
 *
 * When `dealKey` changes the inner wrapper remounts so every slot
 * replays the `hand-deal-in` keyframe (staggered left→right).
 */

import React from "react";

export type HandFanSize = "sm" | "md";

interface FanGeometry {
  cardW: number;
  stride: number;
  containerH: number;
  rot: number;
  lift: number;
}

const FAN_GEOMETRY: Record<HandFanSize, FanGeometry> = {
  sm: { cardW: 86, stride: 70, containerH: 150, rot: 2.6, lift: 1.6 },
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
        className={dealKey > 0 ? "hand-fan-dealt" : undefined}
        style={{ position: "relative", width: totalW, height: geom.containerH }}
      >
        {slots.map((child, i) => {
          const off = i - mid;
          const rot = off * geom.rot;
          const lift = Math.abs(off) * geom.lift;
          const x = i * geom.stride;
          // Lift the whole slot for selected cards so the raised card clears
          // its neighbors instead of being clipped behind the next slot.
          const isSelected =
            React.isValidElement(child) &&
            (child.props as { selected?: boolean }).selected === true;
          return (
            <div
              key={
                React.isValidElement(child) && child.key != null ? child.key : i
              }
              className={`hand-fan-card${isSelected ? " hand-fan-card--selected" : ""}`}
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
