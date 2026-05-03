"use client";

/**
 * BotActionAnimator — flying-card overlay that visualises bot moves.
 *
 * The store paces bots ~600ms apart (lib/store/gameStore.ts), so each
 * bot dispatch produces a single new log entry between renders. This
 * component watches `state.log`, finds new entries since the last
 * render that belong to a non-human player, and queues a short
 * animation per event:
 *
 *   - draw_resource          → resource card flies from the pile to the player
 *   - draw_bourbon           → bourbon card flies from the bourbon deck
 *   - draw_investment / ops  → respective deck → player
 *   - make_bourbon           → mash-card stack flies from player → rickhouse
 *
 * Source/destination DOM elements are tagged with data attributes
 * (`data-deck`, `data-player`, `data-player-pill`, `data-rickhouse`)
 * so the animator can find them with a query selector and read
 * `getBoundingClientRect()` for positioning.
 *
 * Animations layer at z-50 (above the dashboard, below modals at z-50
 * — modals win because they mount later in DOM order). Each card is
 * a small absolutely-positioned div that transitions over ~500ms,
 * then unmounts.
 */

import { useEffect, useRef, useState } from "react";

import { useGameStore } from "@/lib/store/gameStore";
import type { GameEvent } from "@/lib/engine/state";

type FlyKind = "cask" | "corn" | "grain" | "bourbon" | "invest" | "ops" | "mash";

type Flight = {
  id: string;
  kind: FlyKind;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
};

const KIND_STYLE: Record<FlyKind, { bg: string; ring: string; glyph: string; label: string }> = {
  cask: { bg: "bg-amber-500", ring: "ring-amber-300", glyph: "○", label: "CASK" },
  corn: { bg: "bg-yellow-500", ring: "ring-yellow-300", glyph: "◆", label: "CORN" },
  grain: { bg: "bg-lime-500", ring: "ring-lime-300", glyph: "★", label: "GRAIN" },
  bourbon: { bg: "bg-orange-500", ring: "ring-orange-300", glyph: "○", label: "BOURBON" },
  invest: { bg: "bg-emerald-500", ring: "ring-emerald-300", glyph: "$", label: "INVEST" },
  ops: { bg: "bg-violet-500", ring: "ring-violet-300", glyph: "⚡", label: "OPS" },
  mash: { bg: "bg-amber-400", ring: "ring-amber-200", glyph: "🛢", label: "BARREL" },
};

const FLIGHT_MS = 550;
const KEEP_AFTER_FLIGHT_MS = 80;

/** Find a DOM element by data-attribute selector and return its center. */
function centerOf(selector: string): { x: number; y: number } | null {
  if (typeof document === "undefined") return null;
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function playerCenter(playerId: string): { x: number; y: number } | null {
  // Prefer the right-rail opponent row (bigger target); fall back to the
  // top-bar baron pill when the rail is on a different tab.
  return (
    centerOf(`[data-player="${playerId}"]`) ??
    centerOf(`[data-player-pill="${playerId}"]`)
  );
}

function deckCenter(deckLabel: string): { x: number; y: number } | null {
  return centerOf(`[data-deck="${deckLabel}"]`);
}

function rickhouseCenter(rickhouseId: string): { x: number; y: number } | null {
  return centerOf(`[data-rickhouse="${rickhouseId}"]`);
}

/** Map an engine log event to a Flight if it should animate, else null. */
function flightFor(
  event: GameEvent,
  humanId: string | undefined,
  seq: number,
): Flight | null {
  const playerId = typeof event.data?.playerId === "string" ? event.data.playerId : null;
  if (!playerId || playerId === humanId) return null; // only animate non-human moves

  const playerPos = playerCenter(playerId);
  if (!playerPos) return null;

  const mkFlight = (
    kind: FlyKind,
    from: { x: number; y: number } | null,
    to: { x: number; y: number },
  ): Flight | null => {
    if (!from) return null;
    return {
      id: `${event.kind}-${seq}-${event.at}`,
      kind,
      fromX: from.x,
      fromY: from.y,
      toX: to.x,
      toY: to.y,
    };
  };

  switch (event.kind) {
    case "draw_resource":
    case "draw_resource_bonus": {
      const pile = typeof event.data?.pile === "string" ? event.data.pile : null;
      if (!pile) return null;
      // Cask, corn → their own deck stack. Small grains → "grain" stack.
      const deckLabel =
        pile === "cask" ? "cask" : pile === "corn" ? "corn" : "grain";
      const kind: FlyKind =
        pile === "cask" ? "cask" : pile === "corn" ? "corn" : "grain";
      return mkFlight(kind, deckCenter(deckLabel), playerPos);
    }
    case "draw_bourbon":
      return mkFlight("bourbon", deckCenter("bourbon"), playerPos);
    case "draw_investment":
      return mkFlight("invest", deckCenter("invest"), playerPos);
    case "draw_operations":
      return mkFlight("ops", deckCenter("ops"), playerPos);
    case "make_bourbon": {
      const rickhouseId =
        typeof event.data?.rickhouseId === "string" ? event.data.rickhouseId : null;
      if (!rickhouseId) return null;
      const to = rickhouseCenter(rickhouseId);
      if (!to) return null;
      return mkFlight("mash", playerPos, to);
    }
    default:
      return null;
  }
}

export default function BotActionAnimator() {
  const log = useGameStore((s) => s.state?.log);
  const playerOrder = useGameStore((s) => s.state?.playerOrder);
  const players = useGameStore((s) => s.state?.players);
  const lastSeenSeq = useRef(-1);
  const [flights, setFlights] = useState<Flight[]>([]);

  const humanId = playerOrder?.find((id) => players?.[id]?.kind === "human");

  useEffect(() => {
    if (!log || log.length === 0) return;
    const newest = log[log.length - 1];
    if (lastSeenSeq.current < 0) {
      // First mount — don't replay history.
      lastSeenSeq.current = newest.at;
      return;
    }
    const fresh = log.filter((e) => e.at > lastSeenSeq.current);
    if (fresh.length === 0) return;
    const newFlights: Flight[] = [];
    for (const e of fresh) {
      const f = flightFor(e, humanId, e.at);
      if (f) newFlights.push(f);
    }
    lastSeenSeq.current = newest.at;
    if (newFlights.length === 0) return;
    setFlights((cur) => [...cur, ...newFlights]);
    // Auto-cleanup after the flight finishes.
    const cleanupAt = FLIGHT_MS + KEEP_AFTER_FLIGHT_MS;
    setTimeout(() => {
      setFlights((cur) =>
        cur.filter((f) => !newFlights.some((nf) => nf.id === f.id)),
      );
    }, cleanupAt);
  }, [log, humanId]);

  if (flights.length === 0) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-40"
      style={{ contain: "layout" }}
    >
      {flights.map((f) => (
        <FlyingCard key={f.id} flight={f} />
      ))}
    </div>
  );
}

function FlyingCard({ flight }: { flight: Flight }) {
  const [arrived, setArrived] = useState(false);
  const style = KIND_STYLE[flight.kind];

  useEffect(() => {
    // Force a paint at the start position, THEN swap to the end position
    // on the next animation frame so the CSS transition has something to
    // animate from.
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setArrived(true));
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const x = arrived ? flight.toX : flight.fromX;
  const y = arrived ? flight.toY : flight.fromY;

  return (
    <div
      className={[
        "absolute flex h-12 w-9 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-md text-white shadow-[0_4px_14px_rgba(0,0,0,.55)] ring-2",
        style.bg,
        style.ring,
      ].join(" ")}
      style={{
        left: x,
        top: y,
        transitionProperty: "left, top, opacity, transform",
        transitionDuration: `${FLIGHT_MS}ms`,
        transitionTimingFunction: "cubic-bezier(.25,.8,.4,1)",
        opacity: arrived ? 0.0 : 0.95,
      }}
    >
      <span className="font-mono text-[14px] font-bold leading-none">
        {style.glyph}
      </span>
      <span className="mt-0.5 font-mono text-[7px] font-bold uppercase tracking-[.10em] opacity-90">
        {style.label}
      </span>
    </div>
  );
}
