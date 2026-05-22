"use client";

/**
 * ScalingHost — wraps the game shell in a fixed design canvas
 * and applies a CSS transform-scale so the canvas always fits the
 * viewport without clipping the HandTray.
 *
 * Width is a fixed design budget (1680px). Height is *measured*
 * from the actual content via ResizeObserver — the play board is
 * dense and routinely exceeds 900px once Rickhouse + Market +
 * Mash Bills + Action Bar + HandTray are all mounted, so a fixed
 * 900px design height would clip the hand tray on common 1080p
 * laptops. Measuring the inner div lets us shrink the canvas
 * proportionally when the content runs taller than the viewport.
 *
 * Trade-off: `transform: scale` rasterizes after layout, so click
 * targets and tooltips inside the scaled subtree work correctly with
 * the proportional dimensions. Portals rendered outside this subtree
 * (e.g. some inspect modals attached to <body>) get the viewport
 * dimensions, not the design dimensions — they're positioned using
 * page coordinates, so they read correctly without extra math.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";

const DESIGN_WIDTH = 1680;
/**
 * Used only as the initial guess + a floor for the height-aware scale
 * computation; the measured content height takes over once the inner
 * div mounts.
 */
const DESIGN_HEIGHT_FALLBACK = 900;

export default function ScalingHost({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState<number>(1);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => {
      const inner = innerRef.current;
      const contentHeight = inner ? inner.scrollHeight : DESIGN_HEIGHT_FALLBACK;
      const effectiveHeight = Math.max(contentHeight, DESIGN_HEIGHT_FALLBACK);
      const sx = window.innerWidth / DESIGN_WIDTH;
      const sy = window.innerHeight / effectiveHeight;
      setScale(Math.min(sx, sy, 1));
    };
    update();
    window.addEventListener("resize", update);
    // Re-measure when content height changes (modals opening, picker
    // bars sliding in, demand-roll height changes, etc.).
    let observer: ResizeObserver | null = null;
    if (innerRef.current && "ResizeObserver" in window) {
      observer = new ResizeObserver(update);
      observer.observe(innerRef.current);
    }
    return () => {
      window.removeEventListener("resize", update);
      observer?.disconnect();
    };
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
        ref={innerRef}
        style={{
          width: `${DESIGN_WIDTH}px`,
          // `height: auto` lets the content drive the box height; the
          // measured height feeds back into `sy` so the canvas scales
          // down whenever the content runs taller than the viewport.
          minHeight: `${DESIGN_HEIGHT_FALLBACK}px`,
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
