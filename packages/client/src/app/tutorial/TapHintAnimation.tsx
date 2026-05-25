"use client";

/**
 * Looping click demonstration for the tutorial. Measures the bounding
 * rect of a target element (typically a market card or action button)
 * and renders a pulsing tap cursor centered on it. Re-measures every
 * 500ms (and on resize) so the cursor tracks layout shifts.
 */

import { useEffect, useState } from "react";

interface TapHintAnimationProps {
  selector: string;
}

export default function TapHintAnimation({ selector }: TapHintAnimationProps) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const measure = () => {
      const el = document.querySelector(selector);
      if (!el) {
        setPos(null);
        return;
      }
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      setPos((prev) => {
        if (prev && Math.abs(prev.x - x) < 0.5 && Math.abs(prev.y - y) < 0.5) {
          return prev;
        }
        return { x, y };
      });
    };
    measure();
    const id = window.setInterval(measure, 500);
    window.addEventListener("resize", measure);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", measure);
    };
  }, [selector]);

  if (!pos) return null;

  return (
    <div
      className="pointer-events-none fixed z-[45]"
      style={{ top: 0, left: 0 }}
    >
      <div
        className="tap-hint-mover absolute"
        style={{ top: pos.y, left: pos.x }}
      >
        {/* Pulse ring — expands outward on each beat */}
        <div className="tap-hint-pulse absolute h-12 w-12 rounded-full border-2 border-amber-300/80" style={{ marginLeft: -24, marginTop: -24 }} />
        {/* Cursor — anchored bottom-right of the tap point */}
        <svg
          viewBox="0 0 16 16"
          className="absolute h-5 w-5 drop-shadow-[0_1px_2px_rgba(0,0,0,.85)]"
          style={{ marginLeft: 2, marginTop: 2 }}
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
      <style>{`
        @keyframes tap-hint-press {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(0.88); }
        }
        @keyframes tap-hint-pulse {
          0%   { transform: scale(0.6); opacity: 0.9; }
          70%  { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        .tap-hint-mover {
          animation: tap-hint-press 1.4s ease-in-out infinite;
          transform-origin: center;
          will-change: transform;
        }
        .tap-hint-pulse {
          animation: tap-hint-pulse 1.4s ease-out infinite;
          transform-origin: center;
          will-change: transform, opacity;
        }
      `}</style>
    </div>
  );
}
