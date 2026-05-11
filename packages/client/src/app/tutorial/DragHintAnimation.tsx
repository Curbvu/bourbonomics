"use client";

/**
 * Looping click-and-drag demonstration for the tutorial. Measures the
 * bounding rects of a source element (typically a hand card) and a
 * destination (typically a rickhouse slot), then animates a ghost
 * cursor + faint card pill from one to the other on a 3s loop.
 *
 * Re-measures every 500ms (and on resize) so the animation tracks
 * layout shifts — the hand reflows when cards are picked up, the
 * slot ring resizes during the spotlight transition, etc. If either
 * end can't be located we render nothing rather than a stuck ghost.
 */

import { useEffect, useState } from "react";

interface DragHintAnimationProps {
  /** CSS selector for the source — usually a hand card. */
  fromSelector: string;
  /** CSS selector for the destination — usually a rickhouse slot. */
  toSelector: string;
}

interface Anchors {
  sx: number;
  sy: number;
  dx: number;
  dy: number;
}

export default function DragHintAnimation({
  fromSelector,
  toSelector,
}: DragHintAnimationProps) {
  const [anchors, setAnchors] = useState<Anchors | null>(null);

  useEffect(() => {
    const measure = () => {
      const from = document.querySelector(fromSelector);
      const to = document.querySelector(toSelector);
      if (!from || !to) {
        setAnchors(null);
        return;
      }
      const f = from.getBoundingClientRect();
      const t = to.getBoundingClientRect();
      const sx = f.left + f.width / 2;
      const sy = f.top + f.height / 2;
      const dx = t.left + t.width / 2 - sx;
      const dy = t.top + t.height / 2 - sy;
      setAnchors((prev) => {
        // Skip the setState if the measured anchors haven't moved —
        // saves a render every 500ms while the layout is stable.
        if (
          prev &&
          Math.abs(prev.sx - sx) < 0.5 &&
          Math.abs(prev.sy - sy) < 0.5 &&
          Math.abs(prev.dx - dx) < 0.5 &&
          Math.abs(prev.dy - dy) < 0.5
        ) {
          return prev;
        }
        return { sx, sy, dx, dy };
      });
    };
    measure();
    const id = window.setInterval(measure, 500);
    window.addEventListener("resize", measure);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", measure);
    };
  }, [fromSelector, toSelector]);

  if (!anchors) return null;

  const { sx, sy, dx, dy } = anchors;

  return (
    <div
      // z-45 sits above the spotlight dim (z-40) but below the coach
      // mark (z-50). pointer-events-none so it never eats clicks.
      className="pointer-events-none fixed z-[45]"
      style={{ top: 0, left: 0 }}
    >
      <div
        className="drag-hint-mover absolute"
        style={
          {
            // Anchor the moving div with its TOP-LEFT at source; the
            // inner content uses negative margin to center the ghost
            // on (sx, sy). Centering with a sibling transform would
            // be clobbered by the keyframe's transform.
            top: sy,
            left: sx,
            "--dx": `${dx}px`,
            "--dy": `${dy}px`,
          } as React.CSSProperties
        }
      >
        <div className="relative" style={{ marginLeft: -24, marginTop: -34 }}>
          {/* Ghost card pill — amber border + faint fill, suggests
              "you're picking this up." Sized to roughly match a hand
              card without obscuring the real one underneath. */}
          <div className="h-[68px] w-[48px] rounded-md border-2 border-amber-300/90 bg-amber-400/15 shadow-[0_0_22px_rgba(251,191,36,.55)]" />
          {/* Cursor — small white arrow with dark stroke, anchored at
              the bottom-right of the ghost pill so it reads as the
              hand "holding" the card from below-right. */}
          <svg
            viewBox="0 0 16 16"
            className="absolute -bottom-2 -right-2 h-5 w-5 drop-shadow-[0_1px_2px_rgba(0,0,0,.8)]"
            aria-hidden
          >
            <path
              d="M2 1.5 L13.5 7.5 L8.4 8.7 L11 13.6 L9.1 14.5 L6.5 9.6 L2.5 12.5 Z"
              fill="white"
              stroke="black"
              strokeWidth="1"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
      <style>{`
        @keyframes drag-hint-loop {
          0%   { transform: translate(0, 0) scale(0.95); opacity: 0; }
          6%   { transform: translate(0, 0) scale(1);    opacity: 1; }
          14%  { transform: translate(0, 0) scale(0.92); opacity: 1; }
          22%  { transform: translate(0, 0) scale(1);    opacity: 1; }
          70%  { transform: translate(var(--dx), var(--dy)) scale(1);    opacity: 1; }
          78%  { transform: translate(var(--dx), var(--dy)) scale(0.9);  opacity: 1; }
          86%  { transform: translate(var(--dx), var(--dy)) scale(1.05); opacity: 0.85; }
          100% { transform: translate(var(--dx), var(--dy)) scale(1);    opacity: 0; }
        }
        .drag-hint-mover {
          animation: drag-hint-loop 2.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          transform-origin: center;
          will-change: transform, opacity;
        }
      `}</style>
    </div>
  );
}
