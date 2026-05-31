"use client";

/**
 * ScalingHost — wraps the game shell in a **fixed-aspect** design canvas
 * (1680 × 945, 16:9) and applies a CSS transform-scale so the canvas
 * always fits the viewport. Excess viewport space is letterboxed /
 * pillarboxed and shows the page background (the warm bourbon radial
 * on `play/page.tsx`'s outer `<main>`).
 *
 * Hard rule (see CLAUDE.md §1): the game canvas is a fixed 16:9
 * rectangle. Text size, padding, hit targets, animation timing all
 * stay constant in design space; the only thing that changes across
 * monitors is the uniform scale factor. Any editor working on the
 * game UI MUST design against 1680 × 945; content that doesn't fit
 * is a layout bug, not a viewport bug.
 *
 * Why this matters:
 * - **Performance**: the canvas paints at a known size, so frame
 *   budgets are predictable.
 * - **Text consistency**: 12pt copy reads as 12pt at every size; no
 *   surprises from aspect-driven reflow.
 * - **Edit consistency**: when we tighten the rickhouse or restyle
 *   the hand strip, we're always editing the same canvas. No "this
 *   looked fine at 1440 but breaks at 1920."
 *
 * Implementation:
 * - Measure the OUTER wrapper (the slot between GameTopBar and the
 *   bottom of the viewport).
 * - Scale = min(availW / DESIGN_W, availH / DESIGN_H).
 * - Sleeve is sized to the painted rectangle (`DESIGN_W * scale ×
 *   DESIGN_H * scale`) so the flex parent centers the painted area
 *   horizontally + vertically. The excess on the dominant axis is
 *   the letterbox / pillarbox.
 * - Inner div carries `overflow: hidden` so misbehaving content can
 *   never push the canvas past 1680 × 945.
 *
 * `data-bb-scale-canvas` is the legibility-rule anchor in
 * globals.css — the play-screen font-size floor applies only to
 * children of this scaled canvas so the GameTopBar (which sits
 * outside ScalingHost) keeps its native sizing.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Fixed design canvas — 16:9 at 1680 wide. Don't change without
 *  changing CLAUDE.md §1 first. */
const DESIGN_W = 1680;
const DESIGN_H = 945;

export default function ScalingHost({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState<number>(1);
  const outerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => {
      const outer = outerRef.current;
      const availW = outer?.clientWidth ?? window.innerWidth;
      const availH = outer?.clientHeight ?? window.innerHeight;
      // Fit the fixed-aspect canvas into the available area. min()
      // guarantees the canvas never overflows either axis; the
      // dominant axis gets centered with letterbox / pillarbox bars
      // showing the parent's background.
      const sx = availW / DESIGN_W;
      const sy = availH / DESIGN_H;
      const nextScale = Math.min(sx, sy);
      // Floor at a tiny positive value — a zero scale collapses the
      // sleeve and triggers ResizeObserver loops on initial paint.
      setScale(Number.isFinite(nextScale) && nextScale > 0 ? nextScale : 1);
    };
    update();
    window.addEventListener("resize", update);
    let observer: ResizeObserver | null = null;
    if (outerRef.current && "ResizeObserver" in window) {
      observer = new ResizeObserver(update);
      observer.observe(outerRef.current);
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
          the painted canvas on both axes. Without this, the unscaled
          layout box (1680 × 945) would pin against one edge on
          smaller viewports. */}
      <div
        style={{
          width: DESIGN_W * scale,
          height: DESIGN_H * scale,
          flexShrink: 0,
        }}
      >
        <div
          data-bb-scale-canvas
          style={{
            width: DESIGN_W,
            height: DESIGN_H,
            // `overflow: hidden` enforces the fixed-aspect contract.
            // Anything that wants to overflow the 945-tall canvas is a
            // layout bug — fix the panel, don't relax the canvas.
            overflow: "hidden",
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
