"use client";

/**
 * ScalingHost — wraps the game shell in a design canvas and applies a
 * CSS transform-scale so the canvas always fits the viewport without
 * clipping the HandTray.
 *
 * Width is now *adaptive*. The design canvas has a minimum width
 * (1680px) but grows to match the viewport's aspect ratio when the
 * viewport is wider than 1680×{contentH}. The GameBoard grid uses
 * `minmax(0, 1fr)` on its stage column, so the extra width is absorbed
 * by the distillery stage / market row while the fixed side rails
 * (Rivals, Demand, Log) stay at their designed widths. Net effect:
 * ultrawide / 16:10 / 16:9 monitors fill edge-to-edge instead of
 * showing dead gutter on either side of a 1680px canvas. Narrower
 * viewports keep the 1680 minimum and get top/bottom padding instead.
 *
 * Height is *measured* from the actual content via ResizeObserver —
 * the play board is dense and routinely exceeds 900px once Rickhouse +
 * Market + Mash Bills + Action Bar + HandTray are all mounted, so a
 * fixed 900px design height would clip the hand tray on common 1080p
 * laptops. Measuring the inner div lets us shrink the canvas
 * proportionally when the content runs taller than the viewport.
 *
 * Centering: `transform: scale` doesn't affect layout box size, so
 * flexbox would center the *unscaled* rectangle and leave the visual
 * content off-center on wide monitors. We wrap the scaled inner in a
 * sized sleeve (`paintedW × paintedH`) so the flex parent centers the
 * actual painted area both horizontally and vertically.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Floor for the adaptive design width. The board's hand-tuned layout
 * (mash bill cards, hand fan, action bar) was designed at 1680px; we
 * never go below this — narrower viewports scale the 1680 canvas down
 * and get top/bottom buffer.
 */
const DESIGN_WIDTH_MIN = 1680;
/**
 * Used only as the initial guess + a floor for the height-aware scale
 * computation; the measured content height takes over once the inner
 * div mounts.
 */
const DESIGN_HEIGHT_FALLBACK = 900;

export default function ScalingHost({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState<number>(1);
  const [contentH, setContentH] = useState<number>(DESIGN_HEIGHT_FALLBACK);
  const [designW, setDesignW] = useState<number>(DESIGN_WIDTH_MIN);
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
      // Adaptive design width: when the viewport is wider than the
      // 1680×{contentH} canvas (i.e. height is the limiting axis), grow
      // the design width to match the viewport aspect ratio. With this
      // designWidth the height-fit scale paints exactly the viewport
      // width — no gutter. When the viewport is narrower than that
      // ratio, fall back to 1680 and let the width-fit scale win;
      // any leftover height becomes top/bottom buffer.
      const aspectFitWidth =
        (availableWidth * effectiveHeight) / Math.max(1, availableHeight);
      const designWidth = Math.max(DESIGN_WIDTH_MIN, aspectFitWidth);
      const sx = availableWidth / designWidth;
      const sy = availableHeight / effectiveHeight;
      const nextScale = Math.min(sx, sy);
      setScale(nextScale);
      setContentH(effectiveHeight);
      setDesignW(designWidth);
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
          the painted canvas — without this, the unscaled layout box
          would pin against one edge on wider viewports. */}
      <div
        style={{
          width: designW * scale,
          height: contentH * scale,
          flexShrink: 0,
        }}
      >
        <div
          ref={innerRef}
          style={{
            width: `${designW}px`,
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
