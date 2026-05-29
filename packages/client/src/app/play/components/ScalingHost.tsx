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
 * Centering: `transform: scale` doesn't affect layout box size, so
 * flexbox would center the *unscaled* 1680×N rectangle and leave the
 * visual content off-center on wide monitors. We wrap the scaled inner
 * in a sized sleeve (`scaledW × scaledH`) so the flex parent centers
 * the actual painted area both horizontally and vertically.
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
  const [contentH, setContentH] = useState<number>(DESIGN_HEIGHT_FALLBACK);
  const innerRef = useRef<HTMLDivElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => {
      const inner = innerRef.current;
      const outer = outerRef.current;
      const contentHeight = inner ? inner.scrollHeight : DESIGN_HEIGHT_FALLBACK;
      const effectiveHeight = Math.max(contentHeight, DESIGN_HEIGHT_FALLBACK);
      // Measure the OUTER wrapper rather than the full viewport: the
      // GameTopBar now lives outside ScalingHost, so the remaining
      // height the scaled canvas can use is < viewport.
      const availableWidth = outer?.clientWidth ?? window.innerWidth;
      const availableHeight = outer?.clientHeight ?? window.innerHeight;
      const sx = availableWidth / DESIGN_WIDTH;
      const sy = availableHeight / effectiveHeight;
      setScale(Math.min(sx, sy, 1));
      setContentH(effectiveHeight);
    };
    update();
    window.addEventListener("resize", update);
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
      ref={outerRef}
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Sleeve sized to the scaled visual rectangle so flexbox centers
          the painted canvas — without this, the unscaled 1680px layout
          box would pin against one edge on wider viewports. */}
      <div
        style={{
          width: DESIGN_WIDTH * scale,
          height: contentH * scale,
          flexShrink: 0,
        }}
      >
        <div
          ref={innerRef}
          style={{
            width: `${DESIGN_WIDTH}px`,
            minHeight: `${DESIGN_HEIGHT_FALLBACK}px`,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
