"use client";

/**
 * ScalingHost — wraps the game shell in a fixed design canvas
 * (1680×900) and applies a CSS transform-scale that shrinks the
 * canvas to fit the viewport.
 *
 * Used by /play, /play/[code], and /tutorial so the same 1680×900
 * layout works on smaller desktops (1366×768, 1280×720) without
 * clipping the HandTray. When the viewport meets or exceeds the
 * design size, scale is 1 (no-op).
 *
 * Trade-off: `transform: scale` rasterizes after layout, so click
 * targets and tooltips inside the scaled subtree work correctly with
 * the proportional dimensions. Portals rendered outside this subtree
 * (e.g. some inspect modals attached to <body>) get the viewport
 * dimensions, not the design dimensions — they're positioned using
 * page coordinates, so they read correctly without extra math.
 */

import { useEffect, useState, type ReactNode } from "react";

const DESIGN_WIDTH = 1680;
const DESIGN_HEIGHT = 900;

function computeScale(): number {
  if (typeof window === "undefined") return 1;
  const sx = window.innerWidth / DESIGN_WIDTH;
  const sy = window.innerHeight / DESIGN_HEIGHT;
  return Math.min(sx, sy, 1);
}

export default function ScalingHost({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState<number>(1);

  useEffect(() => {
    const update = () => setScale(computeScale());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <div
      style={{
        // Center the scaled canvas inside the viewport. The outer
        // wrapper fills the viewport and clips overflow; the inner
        // canvas is the design-size box that gets scaled.
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "flex-start",
      }}
    >
      <div
        style={{
          width: `${DESIGN_WIDTH}px`,
          height: `${DESIGN_HEIGHT}px`,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          flexShrink: 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}
