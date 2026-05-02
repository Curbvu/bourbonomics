"use client";

/**
 * HandInspectModal — large-format detail view for hand cards that aren't
 * mash bills or barrels. Three kinds:
 *   - resource: shows the resource type, the specialty (if any), and the
 *     full rule prose so the player can read what the chip actually does.
 *   - operations: shows the full ops card concept + effect.
 *   - investment: shows full effect, capital, status, rarity.
 *
 * Mash bills + barrels still go through BourbonInspectModal — the two
 * modals split on `useUiStore.inspect.kind` and only one paints at a
 * time.
 */

import { useEffect } from "react";

import { INVESTMENT_CARDS_BY_ID } from "@/lib/catalogs/investment.generated";
import { OPERATIONS_CARDS_BY_ID } from "@/lib/catalogs/operations.generated";
import { SPECIALTY_RESOURCES_BY_ID } from "@/lib/catalogs/resource.generated";
import type { ResourceCardDef, ResourceType } from "@/lib/catalogs/types";
import { useGameStore } from "@/lib/store/gameStore";
import { useUiStore } from "@/lib/store/uiStore";
import {
  RESOURCE_CHROME,
  RESOURCE_GLYPH,
  RESOURCE_LABEL,
} from "./handCardStyles";

export default function HandInspectModal() {
  const inspect = useUiStore((s) => s.inspect);
  const close = useUiStore((s) => s.closeInspect);
  const makeBourbonActive = useUiStore((s) => s.makeBourbon.active);
  const auditActive = useUiStore((s) => s.auditDiscard.active);
  const state = useGameStore((s) => s.state);

  useEffect(() => {
    if (!inspect) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inspect, close]);

  if (!inspect || !state) return null;
  if (makeBourbonActive || auditActive) return null;
  // Bourbon paths belong to BourbonInspectModal.
  if (inspect.kind === "bill" || inspect.kind === "barrel") return null;

  const humanId = state.playerOrder.find(
    (id) => state.players[id].kind === "human",
  );
  if (!humanId) return null;
  const me = state.players[humanId];

  let body: React.ReactNode = null;
  let title = "";

  if (inspect.kind === "resource") {
    const r = me.resourceHand.find((x) => x.instanceId === inspect.instanceId);
    if (!r) return null;
    const specialty = r.specialtyId
      ? SPECIALTY_RESOURCES_BY_ID[r.specialtyId] ?? null
      : null;
    title = specialty?.name ?? RESOURCE_LABEL[r.resource];
    body = <ResourceDetail resource={r.resource} specialty={specialty} />;
  } else if (inspect.kind === "operations") {
    const ops = me.operations.find((x) => x.instanceId === inspect.instanceId);
    if (!ops) return null;
    const def = OPERATIONS_CARDS_BY_ID[ops.cardId];
    if (!def) return null;
    title = def.title;
    body = <OperationsDetail def={def} />;
  } else if (inspect.kind === "investment") {
    const inv = me.investments.find((x) => x.instanceId === inspect.instanceId);
    if (!inv) return null;
    const def = INVESTMENT_CARDS_BY_ID[inv.cardId];
    if (!def) return null;
    title = def.name;
    body = (
      <InvestmentDetail def={def} active={inv.status === "active"} />
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} — card details`}
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onClick={close}
    >
      <div
        role="document"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute -right-1 -top-1 z-10 grid h-8 w-8 place-items-center rounded-full border border-slate-700 bg-slate-900 font-mono text-sm text-slate-300 shadow-lg hover:border-amber-500 hover:text-amber-200"
        >
          ✕
        </button>
        {body}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Detail panels
// Each renders the SAME visual idiom as the hand-tray mini card, just
// scaled up and with all prose unclamped.

function ResourceDetail({
  resource,
  specialty,
}: {
  resource: ResourceType;
  specialty: ResourceCardDef | null;
}) {
  const chrome = RESOURCE_CHROME[resource];
  return (
    <article
      className={[
        "relative flex flex-col gap-3 rounded-xl border-2 p-5 shadow-[0_12px_32px_rgba(0,0,0,.55)]",
        chrome.gradient,
        chrome.border,
      ].join(" ")}
    >
      <header className="flex items-center justify-between">
        <span
          className={`font-mono text-[10px] font-semibold uppercase tracking-[0.18em] ${chrome.label}`}
        >
          Resource
        </span>
        <span
          className={`rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[.12em] ${chrome.label} ${chrome.borderSoft}`}
        >
          {RESOURCE_LABEL[resource]}
        </span>
      </header>
      <div className="flex items-center gap-4">
        <div
          className={`grid h-16 w-16 flex-shrink-0 place-items-center rounded-full border-2 bg-white/10 text-3xl shadow-[inset_0_1px_4px_rgba(255,255,255,.18)] backdrop-blur-sm ${chrome.border} ${chrome.ink}`}
        >
          {RESOURCE_GLYPH[resource]}
        </div>
        <h3
          className={`font-display text-xl font-bold leading-tight drop-shadow-[0_1px_4px_rgba(0,0,0,.35)] ${chrome.ink}`}
        >
          {specialty?.name ?? RESOURCE_LABEL[resource]}
        </h3>
      </div>
      {specialty?.hook ? (
        <p className={`text-[12px] italic leading-snug ${chrome.ink} opacity-85`}>
          {specialty.hook}
        </p>
      ) : null}
      <div className="rounded-lg border border-white/10 bg-slate-950/50 p-3">
        <span className="font-mono text-[10px] uppercase tracking-[.15em] text-slate-400">
          Effect
        </span>
        <p className="mt-1 text-[13px] leading-snug text-slate-100">
          {specialty?.rule ??
            `Plain ${RESOURCE_LABEL[resource].toLowerCase()} card. Spend it as part of a mash to make a barrel.`}
        </p>
      </div>
    </article>
  );
}

function OperationsDetail({
  def,
}: {
  def: { title: string; concept: string; effect: string };
}) {
  return (
    <article className="relative flex flex-col gap-3 rounded-xl border-2 border-violet-400 bg-gradient-to-b from-violet-600/90 via-violet-900/90 to-slate-950 p-5 shadow-[0_12px_32px_rgba(0,0,0,.55)] ring-1 ring-white/10">
      <header className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-200">
          Operations
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[.12em] text-violet-200/70">
          one-shot
        </span>
      </header>
      <div className="flex items-start gap-4">
        <div className="grid h-14 w-14 flex-shrink-0 place-items-center rounded-full border-2 border-violet-300 bg-white/10 text-2xl shadow-[inset_0_1px_4px_rgba(255,255,255,.18)] backdrop-blur-sm">
          ⚡
        </div>
        <h3 className="font-display text-xl font-bold leading-tight text-white drop-shadow-[0_1px_4px_rgba(0,0,0,.35)]">
          {def.title}
        </h3>
      </div>
      {def.concept ? (
        <p className="text-[12px] italic leading-snug text-violet-100/85">
          {def.concept}
        </p>
      ) : null}
      <div className="rounded-lg border border-white/10 bg-slate-950/50 p-3">
        <span className="font-mono text-[10px] uppercase tracking-[.15em] text-slate-400">
          Effect
        </span>
        <p className="mt-1 text-[13px] leading-snug text-slate-100">
          {def.effect}
        </p>
      </div>
    </article>
  );
}

function InvestmentDetail({
  def,
  active,
}: {
  def: { name: string; short: string; effect: string; capital: number; rarity: string };
  active: boolean;
}) {
  return (
    <article
      className={[
        "relative flex flex-col gap-3 rounded-xl border-2 p-5 shadow-[0_12px_32px_rgba(0,0,0,.55)] ring-1 ring-white/10",
        active
          ? "border-emerald-400 bg-gradient-to-b from-emerald-700/80 via-emerald-900/85 to-slate-950"
          : "border-emerald-400/70 bg-gradient-to-b from-emerald-600/90 via-emerald-900/90 to-slate-950",
        def.rarity === "Rare" ? "rare-shimmer" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <header className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
          {active ? "Built" : "Investment"}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[.12em] text-emerald-200/70">
          {def.rarity}
        </span>
      </header>
      <div className="flex items-start gap-4">
        <div className="grid h-14 w-14 flex-shrink-0 place-items-center rounded-full border-2 border-emerald-300 bg-white/10 font-mono text-base font-black tabular-nums text-white shadow-[inset_0_1px_4px_rgba(255,255,255,.18)] backdrop-blur-sm">
          ${def.capital}
        </div>
        <h3 className="font-display text-xl font-bold leading-tight text-white drop-shadow-[0_1px_4px_rgba(0,0,0,.35)]">
          {def.name}
        </h3>
      </div>
      {def.short ? (
        <p className="text-[12px] italic leading-snug text-emerald-100/85">
          {def.short}
        </p>
      ) : null}
      <div className="rounded-lg border border-white/10 bg-slate-950/50 p-3">
        <span className="font-mono text-[10px] uppercase tracking-[.15em] text-slate-400">
          Effect
        </span>
        <p className="mt-1 text-[13px] leading-snug text-slate-100">
          {def.effect}
        </p>
      </div>
      <p className="font-mono text-[10px] uppercase tracking-[.12em] text-slate-400">
        {active
          ? "Active — effect applies"
          : `Click "Implement" in the action bar, then this card to capitalise it for $${def.capital}.`}
      </p>
    </article>
  );
}
