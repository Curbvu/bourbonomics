"use client";

/**
 * MakeFlight — card-shaped element that flies from the make-overlay area
 * up into the chosen rickhouse slot when a MAKE_BOURBON action fires.
 * Mirrors PurchaseFlight in structure: watches `lastMake.seq` to retrigger,
 * looks up the destination slot via `[data-slot-id="..."]`, and animates
 * a fixed-position card via inline transform + transition.
 *
 * Self-clears after `FLIGHT_MS` so the element doesn't linger.
 */

import { useEffect, useState } from "react";
import { useGameStore, type LastMake } from "@/lib/store/game";

const FLIGHT_MS = 720;
const SPAWN_MS = 320;

export default function MakeFlight() {
  const { lastMake } = useGameStore();
  const [active, setActive] = useState<{
    snapshot: LastMake;
    delta: { dx: number; dy: number; scale: number } | null;
  } | null>(null);

  // Re-trigger on every new `seq` so the same slot can be filled twice
  // in a game and animate each time.
  useEffect(() => {
    if (!lastMake) return;
    setActive({ snapshot: lastMake, delta: null });
  }, [lastMake?.seq]); // eslint-disable-line react-hooks/exhaustive-deps

  // After the spawn animation finishes, compute the destination and
  // start the translate transition.
  useEffect(() => {
    if (!active) return;
    if (active.delta != null) return;
    const t = window.setTimeout(() => {
      const target = document.querySelector(
        `[data-slot-id="${active.snapshot.slotId}"]`,
      ) as HTMLElement | null;
      if (!target) {
        // No destination — abort; the element will fade itself out below.
        setActive(null);
        return;
      }
      const dest = target.getBoundingClientRect();
      // Source is screen-centered (we mount at top:50% / left:50%). The
      // card starts at the centroid so the delta is dest - center.
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const dx = dest.left + dest.width / 2 - cx;
      const dy = dest.top + dest.height / 2 - cy;
      // Shrink to roughly the slot size so the landing reads as "this
      // card became that barrel".
      const scale = Math.max(0.3, dest.width / 100);
      setActive({ snapshot: active.snapshot, delta: { dx, dy, scale } });
    }, SPAWN_MS);
    return () => window.clearTimeout(t);
  }, [active]);

  // Clear after the full flight finishes.
  useEffect(() => {
    if (!active || active.delta == null) return;
    const t = window.setTimeout(() => setActive(null), FLIGHT_MS + 80);
    return () => window.clearTimeout(t);
  }, [active]);

  if (!active) return null;
  const { snapshot, delta } = active;

  const transform =
    delta == null
      ? "translate(-50%, -50%) scale(1)"
      : `translate(calc(-50% + ${delta.dx}px), calc(-50% + ${delta.dy}px)) scale(${delta.scale.toFixed(3)})`;

  return (
    <div
      key={snapshot.seq}
      className="pointer-events-none fixed inset-0 z-[80]"
      aria-hidden
    >
      <div
        className={
          "absolute left-1/2 top-1/2 flex h-[140px] w-[100px] flex-col items-stretch justify-between overflow-hidden rounded-md border-2 border-amber-300 bg-gradient-to-b from-amber-700 via-amber-900 to-slate-950 px-2 py-2 shadow-[0_8px_24px_rgba(251,191,36,.45)] " +
          (delta == null ? "make-flight-spawn" : "")
        }
        style={{
          transform,
          transition:
            delta == null
              ? undefined
              : `transform ${FLIGHT_MS}ms cubic-bezier(0.4, 0.05, 0.7, 0.95), opacity ${FLIGHT_MS}ms ease-in`,
          opacity: delta == null ? 1 : 0.9,
        }}
      >
        <span className="font-mono text-[8px] uppercase tracking-[.18em] text-amber-300">
          New Barrel
        </span>
        <h4 className="line-clamp-2 font-display text-[13px] font-bold leading-tight text-amber-50 drop-shadow-[0_1px_4px_rgba(0,0,0,.45)]">
          {snapshot.mashBillName}
        </h4>
        <div className="flex justify-center">
          <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-amber-300 bg-white/10 text-xl text-amber-100 backdrop-blur-sm">
            🛢
          </span>
        </div>
      </div>
    </div>
  );
}
