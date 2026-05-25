"use client";

/**
 * AgeFlight — card-shaped element that flies from the player's hand
 * tray UP into the destination barrel slot when AGE_BOURBON fires.
 * Mirrors MakeFlight's structure: watches `lastAge.seq` to retrigger,
 * looks up the destination via `[data-slot-id="..."]` and the source
 * via `[data-hand-tray]`, and animates a fixed-position card via
 * inline transform + transition.
 *
 * Self-clears after FLIGHT_MS so the element doesn't linger.
 *
 * The source is the hand-tray's vertical center (the card the player
 * picked has already been removed from the hand by the engine, so we
 * fly from "where it was" rather than "where it is"). Good enough for
 * the visual story of "this card → that barrel."
 */

import { useEffect, useState } from "react";
import { useGameStore, type LastAge } from "@/lib/store/game";

const FLIGHT_MS = 620;
const SPAWN_MS = 80;

interface ActiveFlight {
  snapshot: LastAge;
  source: { x: number; y: number } | null;
  delta: { dx: number; dy: number; scale: number } | null;
}

export default function AgeFlight() {
  const { lastAge, humanSeatPlayerId } = useGameStore();
  const [active, setActive] = useState<ActiveFlight | null>(null);

  // Re-trigger on every new seq.
  useEffect(() => {
    if (!lastAge) return;
    setActive({ snapshot: lastAge, source: null, delta: null });
  }, [lastAge?.seq]); // eslint-disable-line react-hooks/exhaustive-deps

  // Step 1: locate the source. For the human, the spent card came
  // from the hand tray, so we fly up from there. For a bot, there's
  // no on-screen hand — start the ghost at the bot's tile so the
  // animation feels like "a card came out of their stack" rather
  // than appearing from nowhere on the human's hand row.
  useEffect(() => {
    if (!active) return;
    if (active.source != null) return;
    const isHuman = active.snapshot.ownerId === humanSeatPlayerId;
    const sourceEl = isHuman
      ? document.querySelector<HTMLElement>("[data-hand-tray]")
      : document.querySelector<HTMLElement>(
          `[data-opponent-tile="${active.snapshot.ownerId}"]`,
        );
    if (!sourceEl) {
      setActive(null);
      return;
    }
    const rect = sourceEl.getBoundingClientRect();
    setActive({
      ...active,
      source: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
    });
  }, [active, humanSeatPlayerId]);

  // Step 2: after a brief spawn pause (so the ghost is visible at the
  // hand position for a beat), compute the destination and start the
  // translate transition. Human destination is the rickhouse slot;
  // bot destination is the bot's tile (same as source — the ghost
  // resolves in place, but the spawn-then-fade still reads as "they
  // aged something").
  useEffect(() => {
    if (!active) return;
    if (active.source == null) return;
    if (active.delta != null) return;
    const t = window.setTimeout(() => {
      const isHuman = active.snapshot.ownerId === humanSeatPlayerId;
      const target = isHuman
        ? document.querySelector<HTMLElement>(
            `[data-slot-id="${active.snapshot.slotId}"]`,
          )
        : document.querySelector<HTMLElement>(
            `[data-opponent-tile="${active.snapshot.ownerId}"]`,
          );
      if (!target) {
        setActive(null);
        return;
      }
      const dest = target.getBoundingClientRect();
      const cx = dest.left + dest.width / 2;
      const cy = dest.top + dest.height / 2;
      const dx = cx - active.source!.x;
      const dy = cy - active.source!.y;
      // Shrink so the landing reads as "this card joined the barrel."
      const scale = Math.max(0.35, dest.width / 100);
      setActive({ ...active, delta: { dx, dy, scale } });
    }, SPAWN_MS);
    return () => window.clearTimeout(t);
  }, [active, humanSeatPlayerId]);

  // Step 3: clear after the full flight finishes.
  useEffect(() => {
    if (!active || active.delta == null) return;
    const t = window.setTimeout(() => setActive(null), FLIGHT_MS + 80);
    return () => window.clearTimeout(t);
  }, [active]);

  if (!active || !active.source) return null;
  const { snapshot, source, delta } = active;

  const transform =
    delta == null
      ? "translate(-50%, -50%) scale(1)"
      : `translate(calc(-50% + ${delta.dx}px), calc(-50% + ${delta.dy}px)) scale(${delta.scale.toFixed(3)})`;

  // Subtype-driven chrome — match the per-grain palette used in the
  // hand cards so the ghost reads as the right kind of card.
  const chrome = chromeForSubtype(snapshot.cardSubtype);

  return (
    <div
      key={snapshot.seq}
      className="pointer-events-none fixed inset-0 z-[80]"
      aria-hidden
    >
      <div
        className={`absolute flex h-[120px] w-[86px] flex-col items-stretch overflow-hidden rounded-md border-2 px-2 py-2 shadow-[0_8px_24px_rgba(0,0,0,.5)] ${chrome.border} ${chrome.bg}`}
        style={{
          top: source.y,
          left: source.x,
          transform,
          transition:
            delta == null
              ? undefined
              : `transform ${FLIGHT_MS}ms cubic-bezier(0.4, 0.05, 0.7, 0.95), opacity ${FLIGHT_MS}ms ease-in`,
          opacity: delta == null ? 1 : 0.85,
        }}
      >
        <span className={`font-mono text-[11px] uppercase tracking-[.18em] ${chrome.tag}`}>
          Aging
        </span>
        <h4 className={`mt-1 line-clamp-2 font-display text-[12px] font-bold leading-tight ${chrome.title}`}>
          {snapshot.cardLabel}
        </h4>
        <div className="mt-auto flex justify-center">
          <span className="font-display text-[18px] font-bold text-amber-200 drop-shadow-[0_0_6px_rgba(251,191,36,.6)]">
            +1y
          </span>
        </div>
      </div>
    </div>
  );
}

interface SubtypeChrome {
  border: string;
  bg: string;
  tag: string;
  title: string;
}

function chromeForSubtype(subtype: string): SubtypeChrome {
  switch (subtype) {
    case "cask":
      return {
        border: "border-amber-400",
        bg: "bg-gradient-to-b from-amber-900/85 via-amber-950/85 to-slate-950",
        tag: "text-amber-300",
        title: "text-amber-50",
      };
    case "corn":
      return {
        border: "border-yellow-400",
        bg: "bg-gradient-to-b from-yellow-800/85 via-yellow-950/85 to-slate-950",
        tag: "text-yellow-200",
        title: "text-yellow-50",
      };
    case "rye":
      return {
        border: "border-rose-400",
        bg: "bg-gradient-to-b from-rose-900/85 via-rose-950/85 to-slate-950",
        tag: "text-rose-300",
        title: "text-rose-50",
      };
    case "barley":
      return {
        border: "border-teal-300",
        bg: "bg-gradient-to-b from-teal-900/85 via-teal-950/85 to-slate-950",
        tag: "text-teal-200",
        title: "text-teal-50",
      };
    case "wheat":
      return {
        border: "border-cyan-300",
        bg: "bg-gradient-to-b from-cyan-900/85 via-cyan-950/85 to-slate-950",
        tag: "text-cyan-200",
        title: "text-cyan-50",
      };
    default:
      return {
        border: "border-slate-400",
        bg: "bg-gradient-to-b from-slate-700/85 via-slate-900/85 to-slate-950",
        tag: "text-slate-200",
        title: "text-slate-50",
      };
  }
}
