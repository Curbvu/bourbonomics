"use client";

/**
 * Hearthstone-style card draw reveal.
 *
 * Watches the game log for new draw events on the human player and queues
 * each one for a brief, dramatic reveal: the card flips in from below, hovers
 * in the centre with a shimmer sweep and a coloured aura, then drifts toward
 * the hand tray. Auto-dismisses after the animation; clicking the backdrop
 * skips to the next queued card.
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

const ANIM_DURATION_MS = 1500;

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

  // Auto-advance the queue once the head animation completes.
  useEffect(() => {
    if (queue.length === 0) return;
    const t = setTimeout(() => {
      setQueue((q) => q.slice(1));
    }, ANIM_DURATION_MS);
    return () => clearTimeout(t);
  }, [queue]);

  if (queue.length === 0) return null;
  const head = queue[0];

  const skip = () => setQueue((q) => q.slice(1));
  const glow = glowFor(head);

  return (
    <div
      role="presentation"
      aria-hidden="true"
      className="card-draw-stage fixed inset-0 z-40 flex items-center justify-center bg-slate-950/55"
      onClick={skip}
    >
      {/* Centred coloured aura (uses CSS vars so we don't ship a per-card class). */}
      <div
        className="card-draw-glow pointer-events-none absolute left-1/2 top-1/2 h-[380px] w-[380px] rounded-full blur-3xl"
        style={{
          background: `radial-gradient(circle, ${glow} 0%, transparent 65%)`,
        }}
      />
      <div
        className="card-draw-spark pointer-events-none absolute left-1/2 top-1/2 h-[200px] w-[200px] rounded-full"
        style={{
          background: `radial-gradient(circle, ${glow} 0%, transparent 70%)`,
          mixBlendMode: "screen",
        }}
      />

      <div
        key={head.key}
        className="card-draw-card pointer-events-auto absolute left-1/2 top-1/2"
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
      className={`flex h-80 w-56 flex-col rounded-xl border-2 bg-gradient-to-b ${theme.gradient} ${theme.border} p-5 shadow-2xl`}
      aria-label={`Resource card: ${event.resource}${event.bonus ? " bonus" : ""}`}
    >
      <header className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${theme.accent}`}>
        {event.bonus ? "Bonus draw" : "Resource"}
      </header>
      <div className="mt-3 text-3xl font-bold capitalize text-white drop-shadow">
        {event.resource}
      </div>
      <div className={`mt-1 text-xs ${theme.accent} opacity-80`}>
        {specialty ? "Specialty" : "Plain"}
      </div>
      <div className="my-4 flex flex-1 items-center justify-center">
        <div
          className={`flex h-20 w-20 items-center justify-center rounded-full border-2 ${theme.border} bg-white/10 text-4xl font-black uppercase text-white`}
        >
          {event.resource[0]}
        </div>
      </div>
      {specialty ? (
        <div className="space-y-1">
          <div className="text-sm font-semibold text-white">{specialty.name}</div>
          <div className="text-[11px] leading-snug text-white/85">
            {specialty.rule}
          </div>
        </div>
      ) : (
        <div className="text-[11px] italic text-white/70">
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
        <div className="pointer-events-none absolute -inset-2 rounded-2xl border-2 border-amber-300/40 shadow-[0_0_40px_rgba(251,191,36,0.35)]" />
      ) : null}
      <div className="relative">
        <BourbonCardFace card={card} size="md" />
        <div className="mt-1 text-center text-[10px] uppercase tracking-widest text-amber-300/80">
          {event.source === "face-up" ? "Drawn (face-up)" : "Drawn (deck)"}
        </div>
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
      className="flex h-80 w-60 flex-col rounded-xl border-2 border-emerald-400 bg-gradient-to-b from-emerald-700/85 via-emerald-900/85 to-slate-950 p-5 shadow-2xl"
      aria-label={`Investment card: ${def?.name ?? event.cardId}`}
    >
      <header className="flex items-baseline justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
          Investment
        </span>
        <span className="text-[10px] uppercase tracking-wide text-emerald-200/80">
          {def?.rarity ?? ""}
        </span>
      </header>
      <h3 className="mt-2 text-lg font-bold leading-tight text-white">
        {def?.name ?? event.cardId}
      </h3>
      <div className="mt-1 text-[11px] italic text-emerald-100/80">
        {def?.short}
      </div>
      <div className="my-4 flex items-center justify-center">
        <div className="rounded-full border-2 border-emerald-300 bg-white/10 px-5 py-2 text-2xl font-black tabular-nums text-white shadow-inner">
          ${def?.capital ?? 0}
        </div>
      </div>
      <p className="text-[11px] leading-snug text-white/90">{def?.effect}</p>
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
      className="flex h-80 w-60 flex-col rounded-xl border-2 border-violet-400 bg-gradient-to-b from-violet-700/85 via-violet-900/85 to-slate-950 p-5 shadow-2xl"
      aria-label={`Operations card: ${def?.title ?? event.cardId}`}
    >
      <header className="flex items-baseline justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-200">
          Operations
        </span>
        <span className="text-[10px] uppercase tracking-wide text-violet-200/80">
          One-shot
        </span>
      </header>
      <h3 className="mt-2 text-lg font-bold leading-tight text-white">
        {def?.title ?? event.cardId}
      </h3>
      {def?.concept ? (
        <div className="mt-1 text-[11px] italic text-violet-100/80">
          {def.concept}
        </div>
      ) : null}
      <div className="my-4 flex flex-1 items-center justify-center">
        <div className="text-5xl">⚡</div>
      </div>
      <p className="text-[11px] leading-snug text-white/90">{def?.effect}</p>
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
      className={`flex h-80 w-56 flex-col rounded-xl border-2 ${accent} bg-gradient-to-b ${gradient} p-5 shadow-2xl`}
    >
      <header className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/80">
        {label}
      </header>
      <h3 className="mt-2 text-base font-semibold text-white">{title}</h3>
    </article>
  );
}
