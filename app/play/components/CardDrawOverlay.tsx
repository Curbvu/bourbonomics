"use client";

/**
 * Hearthstone-style card draw reveal.
 *
 * Watches the game log for new draw events on the human player and queues
 * each one for a dramatic reveal: the card flips in from below and **stays
 * on screen** until the player clicks to dismiss / advance to the next
 * queued draw. (Earlier versions auto-dismissed after 1.5s, which didn't
 * give enough time to read the card.)
 *
 * Responds to: draw_resource, draw_resource_bonus, draw_bourbon,
 * draw_investment, draw_operations.
 *
 * Bot draws are intentionally not animated — we don't reveal opponent hands.
 */

import { useEffect, useRef, useState } from "react";

import { BOURBON_CARDS_BY_ID } from "@/lib/catalogs/bourbon.generated";
import { INVESTMENT_CARDS_BY_ID } from "@/lib/catalogs/investment.generated";
import {
  OPERATIONS_CARDS_BY_ID,
} from "@/lib/catalogs/operations.generated";
import {
  SPECIALTY_RESOURCES_BY_ID,
} from "@/lib/catalogs/resource.generated";
import type { ResourceType } from "@/lib/catalogs/types";
import { useGameStore } from "@/lib/store/gameStore";

import BourbonCardFace from "./BourbonCardFace";

type DrawEvent =
  | {
      key: string;
      kind: "resource";
      resource: ResourceType;
      specialtyId: string | null;
      bonus: boolean;
    }
  | { key: string; kind: "bourbon"; cardId: string; source: string }
  | { key: string; kind: "investment"; cardId: string }
  | { key: string; kind: "operations"; cardId: string };

const RESOURCE_THEME: Record<
  ResourceType,
  { gradient: string; border: string; glow: string; accent: string }
> = {
  cask: {
    gradient: "from-amber-600/90 via-amber-800/80 to-amber-950",
    border: "border-amber-400",
    glow: "rgba(251, 191, 36, 0.55)",
    accent: "text-amber-200",
  },
  corn: {
    gradient: "from-yellow-500/90 via-yellow-700/80 to-amber-950",
    border: "border-yellow-300",
    glow: "rgba(250, 204, 21, 0.55)",
    accent: "text-yellow-100",
  },
  barley: {
    gradient: "from-lime-600/90 via-lime-800/80 to-emerald-950",
    border: "border-lime-300",
    glow: "rgba(163, 230, 53, 0.5)",
    accent: "text-lime-100",
  },
  rye: {
    gradient: "from-rose-600/90 via-rose-800/80 to-rose-950",
    border: "border-rose-300",
    glow: "rgba(244, 63, 94, 0.5)",
    accent: "text-rose-100",
  },
  wheat: {
    gradient: "from-sky-500/90 via-sky-700/80 to-slate-950",
    border: "border-sky-300",
    glow: "rgba(56, 189, 248, 0.5)",
    accent: "text-sky-100",
  },
};

export default function CardDrawOverlay() {
  // Don't replay events that already exist on first mount (page refresh, save load).
  const [baselineSeq] = useState(() => {
    const s = useGameStore.getState().state;
    return s?.logSeq ?? 0;
  });

  const [queue, setQueue] = useState<DrawEvent[]>([]);
  const lastSeenSeqRef = useRef(baselineSeq);

  // Subscribe directly to the zustand store. This is the recommended pattern for
  // bridging an external subscription into setState (avoids the
  // react-hooks/set-state-in-effect rule that flags scanning derived state in
  // a useEffect body).
  useEffect(() => {
    const unsubscribe = useGameStore.subscribe((cur) => {
      const state = cur.state;
      if (!state) return;
      const humanId = state.playerOrder.find(
        (id) => state.players[id].kind === "human",
      );
      if (!humanId) return;
      const seenAt = lastSeenSeqRef.current;
      if (state.logSeq <= seenAt) return;

      const newEvents: DrawEvent[] = [];
      for (const e of state.log) {
        if (e.at <= seenAt) continue;
        if (e.data.playerId !== humanId) continue;

        if (e.kind === "draw_resource" || e.kind === "draw_resource_bonus") {
          const pile = String(e.data.pile ?? "");
          if (
            pile !== "cask" &&
            pile !== "corn" &&
            pile !== "barley" &&
            pile !== "rye" &&
            pile !== "wheat"
          ) {
            continue;
          }
          newEvents.push({
            key: `r-${e.at}`,
            kind: "resource",
            resource: pile as ResourceType,
            specialtyId:
              (e.data.specialtyId as string | null | undefined) ?? null,
            bonus: e.kind === "draw_resource_bonus",
          });
        } else if (e.kind === "draw_bourbon") {
          newEvents.push({
            key: `b-${e.at}`,
            kind: "bourbon",
            cardId: String(e.data.cardId ?? ""),
            source: String(e.data.source ?? "deck"),
          });
        } else if (e.kind === "draw_investment") {
          newEvents.push({
            key: `i-${e.at}`,
            kind: "investment",
            cardId: String(e.data.cardId ?? ""),
          });
        } else if (e.kind === "draw_operations") {
          newEvents.push({
            key: `o-${e.at}`,
            kind: "operations",
            cardId: String(e.data.cardId ?? ""),
          });
        }
      }

      lastSeenSeqRef.current = state.logSeq;
      if (newEvents.length > 0) {
        setQueue((prev) => [...prev, ...newEvents]);
      }
    });
    return unsubscribe;
  }, []);

  // No auto-advance — the player clicks to dismiss / go to the next
  // queued card. Keyboard: Esc also dismisses.
  useEffect(() => {
    if (queue.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setQueue((q) => q.slice(1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [queue]);

  if (queue.length === 0) return null;
  const head = queue[0];

  const skip = () => setQueue((q) => q.slice(1));
  const glow = glowFor(head);
  const remaining = queue.length - 1;

  return (
    <div
      role="presentation"
      aria-hidden="true"
      className="card-draw-stage fixed inset-0 z-40 flex items-center justify-center bg-slate-950/55"
      onClick={skip}
    >
      {/* Centred coloured aura (uses CSS vars so we don't ship a per-card class). */}
      <div
        className="card-draw-glow pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[560px] rounded-full blur-3xl"
        style={{
          background: `radial-gradient(circle, ${glow} 0%, transparent 65%)`,
        }}
      />
      <div
        className="card-draw-spark pointer-events-none absolute left-1/2 top-1/2 h-[300px] w-[300px] rounded-full"
        style={{
          background: `radial-gradient(circle, ${glow} 0%, transparent 70%)`,
          mixBlendMode: "screen",
        }}
      />

      <div
        key={head.key}
        className="card-draw-card pointer-events-auto absolute left-1/2 top-1/2 cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          skip();
        }}
      >
        <div className="relative">
          <CardFace event={head} />
          {/* Diagonal shine sweep, layered on top of the face. */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
            <div
              className="card-draw-shine absolute -left-1/3 top-0 h-full w-1/2"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.45) 50%, transparent 100%)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Click-to-continue hint, pinned to the bottom of the overlay. */}
      <div className="pointer-events-none absolute bottom-10 left-1/2 -translate-x-1/2 text-center">
        <div className="font-mono text-[10px] uppercase tracking-[.18em] text-slate-400">
          click to continue
        </div>
        {remaining > 0 ? (
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[.12em] text-amber-300">
            +{remaining} more
          </div>
        ) : null}
      </div>
    </div>
  );
}

function glowFor(event: DrawEvent): string {
  switch (event.kind) {
    case "resource":
      return RESOURCE_THEME[event.resource].glow;
    case "bourbon": {
      const card = BOURBON_CARDS_BY_ID[event.cardId];
      return card?.rarity === "Rare"
        ? "rgba(251, 191, 36, 0.7)"
        : "rgba(251, 191, 36, 0.45)";
    }
    case "investment":
      return "rgba(52, 211, 153, 0.55)";
    case "operations":
      return "rgba(167, 139, 250, 0.55)";
  }
}

// ---------------------------------------------------------------------------
// Per-type card faces

function CardFace({ event }: { event: DrawEvent }) {
  switch (event.kind) {
    case "resource":
      return <ResourceFace event={event} />;
    case "bourbon":
      return <BourbonFace event={event} />;
    case "investment":
      return <InvestmentFace event={event} />;
    case "operations":
      return <OperationsFace event={event} />;
  }
}

function ResourceFace({
  event,
}: {
  event: Extract<DrawEvent, { kind: "resource" }>;
}) {
  const theme = RESOURCE_THEME[event.resource];
  const specialty = event.specialtyId
    ? SPECIALTY_RESOURCES_BY_ID[event.specialtyId]
    : null;
  return (
    <article
      className={`relative flex h-[460px] w-[320px] flex-col overflow-hidden rounded-2xl border-2 bg-gradient-to-b ${theme.gradient} ${theme.border} p-6 shadow-[0_24px_60px_rgba(0,0,0,.55)] ring-1 ring-white/10`}
      aria-label={`Resource card: ${event.resource}${event.bonus ? " bonus" : ""}`}
    >
      {/* Top inner highlight — a subtle premium gloss */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
        aria-hidden
      />
      <header className="flex items-baseline justify-between">
        <span
          className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${theme.accent}`}
        >
          {event.bonus ? "Bonus draw" : "Resource"}
        </span>
        <span className={`text-[10px] uppercase tracking-wide ${theme.accent} opacity-70`}>
          {specialty ? "Specialty" : "Plain"}
        </span>
      </header>
      <h3 className="mt-4 text-5xl font-bold capitalize leading-none text-white drop-shadow-[0_2px_8px_rgba(0,0,0,.4)]">
        {event.resource}
      </h3>
      <div className="my-6 flex flex-1 items-center justify-center">
        <div
          className={`flex h-32 w-32 items-center justify-center rounded-full border-2 ${theme.border} bg-white/10 text-7xl font-black uppercase text-white shadow-[inset_0_2px_8px_rgba(255,255,255,.18),0_8px_28px_rgba(0,0,0,.4)] backdrop-blur-sm`}
        >
          {event.resource[0]}
        </div>
      </div>
      {specialty ? (
        <div className="space-y-1.5">
          <div className="text-base font-semibold text-white">{specialty.name}</div>
          <div className="text-[12.5px] leading-snug text-white/85">
            {specialty.rule}
          </div>
        </div>
      ) : (
        <div className="text-[12.5px] italic leading-snug text-white/70">
          A standard {event.resource} card. Useful in any mash.
        </div>
      )}
    </article>
  );
}

function BourbonFace({
  event,
}: {
  event: Extract<DrawEvent, { kind: "bourbon" }>;
}) {
  const card = BOURBON_CARDS_BY_ID[event.cardId];
  if (!card) {
    return (
      <FallbackFace
        label="Bourbon"
        title={event.cardId}
        accent="border-amber-400"
        gradient="from-amber-700/80 to-slate-950"
      />
    );
  }
  return (
    <div className="relative">
      {/* Outer rare-amber halo if applicable */}
      {card.rarity === "Rare" ? (
        <div className="pointer-events-none absolute -inset-3 rounded-2xl border-2 border-amber-300/40 shadow-[0_0_60px_rgba(251,191,36,0.45)]" />
      ) : null}
      <div className="relative ring-1 ring-white/10 rounded-md shadow-[0_24px_60px_rgba(0,0,0,.55)]">
        <BourbonCardFace card={card} size="lg" />
      </div>
      <div className="mt-2 text-center text-[11px] uppercase tracking-[.22em] text-amber-300/80">
        {event.source === "face-up" ? "Drawn (face-up)" : "Drawn (deck)"}
      </div>
    </div>
  );
}

function InvestmentFace({
  event,
}: {
  event: Extract<DrawEvent, { kind: "investment" }>;
}) {
  const def = INVESTMENT_CARDS_BY_ID[event.cardId];
  return (
    <article
      className="relative flex h-[460px] w-[320px] flex-col overflow-hidden rounded-2xl border-2 border-emerald-400 bg-gradient-to-b from-emerald-600/90 via-emerald-900/90 to-slate-950 p-6 shadow-[0_24px_60px_rgba(0,0,0,.55)] ring-1 ring-white/10"
      aria-label={`Investment card: ${def?.name ?? event.cardId}`}
    >
      {/* Top inner highlight */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
        aria-hidden
      />
      <header className="flex items-baseline justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-200">
          Investment
        </span>
        <span className="text-[10px] uppercase tracking-wide text-emerald-200/80">
          {def?.rarity ?? ""}
        </span>
      </header>
      <h3 className="mt-3 font-display text-3xl font-bold leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,.4)]">
        {def?.name ?? event.cardId}
      </h3>
      <div className="mt-2 text-[13px] italic text-emerald-100/85">
        {def?.short}
      </div>
      <div className="my-6 flex items-center justify-center">
        <div className="grid h-28 w-28 place-items-center rounded-full border-2 border-emerald-300 bg-white/10 text-4xl font-black tabular-nums text-white shadow-[inset_0_2px_8px_rgba(255,255,255,.20),0_8px_28px_rgba(0,0,0,.4)] backdrop-blur-sm">
          ${def?.capital ?? 0}
        </div>
      </div>
      <p className="text-[13px] leading-snug text-white/90">{def?.effect}</p>
    </article>
  );
}

function OperationsFace({
  event,
}: {
  event: Extract<DrawEvent, { kind: "operations" }>;
}) {
  const def = OPERATIONS_CARDS_BY_ID[event.cardId];
  return (
    <article
      className="relative flex h-[460px] w-[320px] flex-col overflow-hidden rounded-2xl border-2 border-violet-400 bg-gradient-to-b from-violet-600/90 via-violet-900/90 to-slate-950 p-6 shadow-[0_24px_60px_rgba(0,0,0,.55)] ring-1 ring-white/10"
      aria-label={`Operations card: ${def?.title ?? event.cardId}`}
    >
      {/* Top inner highlight */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
        aria-hidden
      />
      <header className="flex items-baseline justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-200">
          Operations
        </span>
        <span className="text-[10px] uppercase tracking-wide text-violet-200/80">
          One-shot
        </span>
      </header>
      <h3 className="mt-3 font-display text-3xl font-bold leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,.4)]">
        {def?.title ?? event.cardId}
      </h3>
      {def?.concept ? (
        <div className="mt-2 text-[13px] italic text-violet-100/85">
          {def.concept}
        </div>
      ) : null}
      <div className="my-6 flex flex-1 items-center justify-center">
        <div className="grid h-28 w-28 place-items-center rounded-full border-2 border-violet-300 bg-white/10 text-6xl shadow-[inset_0_2px_8px_rgba(255,255,255,.20),0_8px_28px_rgba(0,0,0,.4)] backdrop-blur-sm">
          ⚡
        </div>
      </div>
      <p className="text-[13px] leading-snug text-white/90">{def?.effect}</p>
    </article>
  );
}

function FallbackFace({
  label,
  title,
  accent,
  gradient,
}: {
  label: string;
  title: string;
  accent: string;
  gradient: string;
}) {
  return (
    <article
      className={`flex h-[460px] w-[320px] flex-col rounded-2xl border-2 ${accent} bg-gradient-to-b ${gradient} p-6 shadow-[0_24px_60px_rgba(0,0,0,.55)] ring-1 ring-white/10`}
    >
      <header className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/80">
        {label}
      </header>
      <h3 className="mt-3 text-2xl font-semibold leading-tight text-white">{title}</h3>
    </article>
  );
}
