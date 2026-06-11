"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Fixed 1920x1080 design canvas. Mirrors the live game's ScalingHost.
 *
 * The board is authored at exactly DESIGN_W x DESIGN_H. This component
 * measures the available area and applies a single uniform CSS
 * `transform: scale(...)` so the whole canvas fits. Excess space on the
 * dominant axis becomes letterbox / pillarbox (the page background).
 * No reflow, no media queries — every UI decision is made at
 * 1920x1080.
 */

const DESIGN_W = 1920;
const DESIGN_H = 1080;

export default function ScalingHost({ children }: { children: React.ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;

    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      const sx = width / DESIGN_W;
      const sy = height / DESIGN_H;
      setScale(Math.min(sx, sy));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={outerRef}
      className="relative grid flex-1 place-items-center overflow-hidden"
    >
      {/* Sleeve sized to the painted (scaled) rect so the grid centers it. */}
      <div
        style={{
          width: DESIGN_W * scale,
          height: DESIGN_H * scale,
        }}
      >
        <div
          data-bb-scale-canvas
          style={{
            width: DESIGN_W,
            height: DESIGN_H,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            overflow: "hidden",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
