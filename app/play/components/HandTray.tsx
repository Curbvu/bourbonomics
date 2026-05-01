"use client";

/**
 * HandTray — bottom-of-canvas horizontal strip showing the human player's
 * hand, with an End-turn (= pass) button on the right.
 *
 * Spec: design_handoff_bourbon_blend/README.md §HandTray.
 *
 * Layout (left → right):
 *   1. Identity     — colored dot + "Your hand" + caption
 *   2. Resources    — vertical "RESOURCES" label + 56×76 chips per card
 *   3. Divider
 *   4. Bourbon      — vertical "BOURBON" label + small BourbonCardFace
 *   5. Divider
 *   6. Ops + Invest — stacked rows of pills
 *   7. Spacer (flex-1)
 *   8. End-turn cluster — "discard" ghost pill + amber primary button
 *
 * The "End turn" button dispatches PASS_ACTION (the closest analog to a
 * Hearthstone-style end-turn). It only fires on the human's action-phase
 * turn; otherwise it shows disabled. The "discard" pill is presentational
 * for now — Bourbonomics has no explicit discard action in current rules.
 */

import { BOURBON_CARDS_BY_ID } from "@/lib/catalogs/bourbon.generated";
import { INVESTMENT_CARDS_BY_ID } from "@/lib/catalogs/investment.generated";
import { OPERATIONS_CARDS_BY_ID } from "@/lib/catalogs/operations.generated";
import { SPECIALTY_RESOURCES_BY_ID } from "@/lib/catalogs/resource.generated";
import type { ResourceCardDef, ResourceType } from "@/lib/catalogs/types";
import { useGameStore } from "@/lib/store/gameStore";
import { PLAYER_BG_CLASS, paletteIndex } from "./playerColors";
import BourbonCardFace from "./BourbonCardFace";

type ResourceMeta = {
  glyph: string;
  short: string;
  tint: string;
  border: string;
  ink: string;
};

const RESOURCE_META: Record<ResourceType, ResourceMeta> = {
  cask: {
    glyph: "◯",
    short: "C",
    tint: "bg-amber-700/[0.20]",
    border: "border-amber-700",
    ink: "text-amber-200",
  },
  corn: {
    glyph: "◆",
    short: "C",
    tint: "bg-yellow-500/[0.18]",
    border: "border-yellow-500/45",
    ink: "text-yellow-100",
  },
  barley: {
    glyph: "★",
    short: "B",
    tint: "bg-lime-500/[0.18]",
    border: "border-lime-500/45",
    ink: "text-lime-100",
  },
  rye: {
    glyph: "▲",
    short: "R",
    tint: "bg-rose-600/[0.18]",
    border: "border-rose-600/45",
    ink: "text-rose-100",
  },
  wheat: {
    glyph: "▼",
    short: "W",
    tint: "bg-sky-500/[0.18]",
    border: "border-sky-500/45",
    ink: "text-sky-100",
  },
};

export default function HandTray() {
  const state = useGameStore((s) => s.state)!;
  const dispatch = useGameStore((s) => s.dispatch);
  const humanId = state.playerOrder.find(
    (id) => state.players[id].kind === "human",
  );
  if (!humanId) return null;
  const me = state.players[humanId];
  const seatIdx = paletteIndex(me.seatIndex);

  const handSize =
    me.resourceHand.length +
    me.bourbonHand.length +
    me.investments.length +
    me.operations.length;
  const isMyActionTurn =
    state.currentPlayerId === humanId && state.phase === "action";

  const headBourbonId = me.bourbonHand[0];
  const headBourbon = headBourbonId ? BOURBON_CARDS_BY_ID[headBourbonId] : null;
  const extraBourbon = Math.max(0, me.bourbonHand.length - 1);

  return (
    <section className="flex items-center gap-[18px] border-t border-slate-800 bg-slate-950 px-[22px] py-3">
      {/* 1 — identity */}
      <div className="flex min-w-[130px] flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span
            className={`block h-2.5 w-2.5 rounded-full ring-2 ring-slate-950 ${PLAYER_BG_CLASS[seatIdx]}`}
            aria-hidden
          />
          <span className="font-display text-base font-semibold text-amber-100">
            Your hand
          </span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[.12em] text-slate-500">
          {handSize} cards · click to play
        </span>
      </div>

      {/* 2 — resources */}
      <div className="flex items-stretch gap-2">
        <VerticalCaption>resources</VerticalCaption>
        <div className="flex max-w-[400px] gap-1.5 overflow-x-auto">
          {me.resourceHand.length === 0 ? (
            <EmptyTallChip>no resources</EmptyTallChip>
          ) : (
            me.resourceHand.map((r) => {
              const meta = RESOURCE_META[r.resource];
              if (!meta) return null;
              const specialty = r.specialtyId
                ? SPECIALTY_RESOURCES_BY_ID[r.specialtyId]
                : null;
              return (
                <ResourceChip
                  key={r.instanceId}
                  meta={meta}
                  resource={r.resource}
                  specialty={specialty}
                />
              );
            })
          )}
        </div>
      </div>

      <Divider />

      {/* 4 — bourbon */}
      <div className="flex items-stretch gap-2">
        <VerticalCaption>bourbon</VerticalCaption>
        <div className="flex items-center gap-2">
          {headBourbon ? (
            <div className="w-[110px]">
              <BourbonCardFace card={headBourbon} size="sm" />
            </div>
          ) : (
            <div className="grid h-[76px] w-[110px] place-items-center rounded-md border border-dashed border-slate-700 px-2 text-center font-mono text-[10px] uppercase tracking-[.12em] text-slate-500">
              no bourbon card
            </div>
          )}
          {extraBourbon > 0 ? (
            <span className="font-mono text-[10px] uppercase tracking-[.12em] text-slate-500">
              +{extraBourbon}
            </span>
          ) : null}
        </div>
      </div>

      <Divider />

      {/* 6 — ops + invest, stacked */}
      <div className="flex max-w-[280px] flex-col gap-1.5">
        <div className="flex flex-wrap gap-1.5">
          {me.operations.length === 0 ? (
            <EmptyPill>no ops</EmptyPill>
          ) : (
            me.operations.map((ops) => {
              const def = OPERATIONS_CARDS_BY_ID[ops.cardId];
              return (
                <span
                  key={ops.instanceId}
                  title={def?.effect}
                  className="rounded border border-violet-500/45 bg-violet-500/[0.15] px-2.5 py-1 font-mono text-[11px] font-semibold text-violet-200"
                >
                  {def?.title ?? ops.cardId}
                  <span className="ml-1.5 opacity-60">OPS</span>
                </span>
              );
            })
          )}
        </div>
        {me.investments.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {me.investments.map((inv) => {
              const def = INVESTMENT_CARDS_BY_ID[inv.cardId];
              const isActive = inv.status === "active";
              return (
                <span
                  key={inv.instanceId}
                  title={def?.effect}
                  className={`rounded border bg-emerald-500/[0.15] px-2.5 py-1 font-mono text-[11px] font-semibold ${
                    isActive
                      ? "border-emerald-500/45 text-emerald-200"
                      : "border-slate-600 text-slate-300 opacity-80"
                  }`}
                >
                  {def?.name ?? inv.cardId}
                  <span className="ml-1.5 opacity-60">
                    ${def?.capital ?? 0} · {isActive ? "ACTIVE" : "UNBUILT"}
                  </span>
                </span>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* 7 — spacer */}
      <span className="flex-1" />

      {/* 8 — end-turn cluster */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled
          aria-label="Discard (not implemented)"
          className="rounded border border-slate-700 bg-transparent px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-[.05em] text-slate-300 opacity-50"
        >
          discard
        </button>
        <button
          type="button"
          disabled={!isMyActionTurn}
          onClick={() => dispatch({ t: "PASS_ACTION", playerId: humanId })}
          title={
            isMyActionTurn
              ? "Pass — finish your action loop"
              : "Wait for your turn"
          }
          className="rounded-md border border-amber-700 bg-gradient-to-b from-amber-500 to-amber-700 px-3.5 py-1.5 font-sans text-xs font-bold uppercase tracking-[.05em] text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,.2)] transition-colors hover:from-amber-400 hover:to-amber-600 disabled:cursor-not-allowed disabled:border-slate-700 disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-500 disabled:shadow-none"
        >
          Pass ↵
        </button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents

function VerticalCaption({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="self-stretch font-mono text-[10px] uppercase tracking-[.12em] text-slate-500"
      style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
    >
      {children}
    </span>
  );
}

function Divider() {
  return <span className="block h-[60px] w-px bg-slate-800" aria-hidden />;
}

function ResourceChip({
  meta,
  resource,
  specialty,
}: {
  meta: ResourceMeta;
  resource: string;
  specialty: ResourceCardDef | null;
}) {
  return (
    <div
      className={`flex h-[76px] w-[56px] flex-shrink-0 flex-col rounded-md border p-1.5 shadow-md ${meta.tint} ${meta.border}`}
      title={specialty?.rule}
      role="img"
      aria-label={specialty ? `${resource}: ${specialty.name}` : resource}
    >
      <div className="flex items-center justify-between">
        <span
          className={`font-mono text-[9px] font-bold tracking-[.1em] ${meta.ink}`}
        >
          {meta.short}
        </span>
        <span className={`text-[10px] opacity-70 ${meta.ink}`}>
          {meta.glyph}
        </span>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-0.5 text-center">
        <span
          className={`font-mono text-[11px] font-semibold uppercase tracking-[.05em] ${meta.ink}`}
        >
          {resource}
        </span>
        {specialty ? (
          <span
            className={`line-clamp-2 px-0.5 text-[8px] leading-[1.1] ${meta.ink} opacity-75`}
          >
            {specialty.name}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function EmptyTallChip({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid h-[76px] place-items-center rounded-md border border-dashed border-slate-700 px-3 font-mono text-[9px] uppercase tracking-[.12em] text-slate-500">
      {children}
    </div>
  );
}

function EmptyPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-dashed border-slate-700 px-2.5 py-1 font-mono text-[11px] italic text-slate-500">
      {children}
    </span>
  );
}
