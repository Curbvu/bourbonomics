"use client";

/**
 * CardInspectModal — large detail view that opens when any card is
 * clicked in the HandTray or MarketCenter. Reads `inspect` from the
 * game store; closes on backdrop / ✕ / Esc.
 *
 * Each kind (resource, capital, mash bill, operations, investment)
 * renders the same gradient/border idiom as its mini-tile, scaled up,
 * with full prose unclamped — so the player has one place to read every
 * detail (recipe constraints, reward grid, awards, full effect text).
 */

import { useEffect } from "react";
import type {
  Card,
  InvestmentCard,
  MashBill,
  OperationsCard,
  ResourceSubtype,
} from "@bourbonomics/engine";
import { useGameStore, type InspectPayload } from "@/lib/store/game";
import {
  CAPITAL_CHROME,
  OPS_CHROME,
  RESOURCE_CHROME,
  RESOURCE_GLYPH,
  RESOURCE_LABEL,
} from "./handCardStyles";
import { TIER_CHROME, tierOrCommon } from "./tierStyles";

export default function CardInspectModal() {
  const { inspect, setInspect } = useGameStore();

  useEffect(() => {
    if (!inspect) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setInspect(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inspect, setInspect]);

  if (!inspect) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Card details"
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-4 backdrop-blur-sm"
      onClick={() => setInspect(null)}
    >
      <div
        role="document"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md"
      >
        <button
          type="button"
          onClick={() => setInspect(null)}
          aria-label="Close"
          className="absolute -right-1 -top-1 z-10 grid h-8 w-8 place-items-center rounded-full border border-slate-700 bg-slate-900 font-mono text-sm text-slate-300 shadow-lg transition-colors hover:border-amber-500 hover:text-amber-200"
        >
          ✕
        </button>
        <Body inspect={inspect} />
      </div>
    </div>
  );
}

function Body({ inspect }: { inspect: InspectPayload }) {
  switch (inspect.kind) {
    case "resource":
      return <ResourceDetail card={inspect.card} />;
    case "capital":
      return <CapitalDetail card={inspect.card} />;
    case "mashbill":
      return <MashBillDetail bill={inspect.bill} />;
    case "operations":
      return <OperationsDetail card={inspect.card} />;
    case "investment":
      return <InvestmentDetail card={inspect.card} />;
  }
}

function ResourceDetail({ card }: { card: Card }) {
  const subtype = card.subtype as ResourceSubtype;
  const chrome = RESOURCE_CHROME[subtype];
  const count = card.resourceCount ?? 1;
  const cost = card.cost ?? 1;
  const baseLabel = RESOURCE_LABEL[subtype];
  const heading = card.displayName ?? (count > 1 ? `${count}× ${baseLabel}` : baseLabel);
  const aliases = card.aliases ?? [];
  return (
    <article
      className={[
        "relative flex flex-col gap-3 rounded-xl border-2 p-5 shadow-[0_12px_32px_rgba(0,0,0,.55)]",
        chrome.gradient,
        chrome.border,
      ].join(" ")}
    >
      <DetailCornerCost cost={cost} />
      <header className="flex items-center justify-between pr-12">
        <span className={`font-mono text-[11px] font-semibold uppercase tracking-[0.18em] ${chrome.label}`}>
          Resource
        </span>
      </header>
      <div className="flex items-center gap-4">
        <div
          className={`grid h-20 w-20 flex-shrink-0 place-items-center rounded-full border-2 bg-white/10 text-4xl shadow-[inset_0_1px_4px_rgba(255,255,255,.18)] backdrop-blur-sm ${chrome.border} ${chrome.ink}`}
        >
          {RESOURCE_GLYPH[subtype]}
        </div>
        <div className="flex flex-col">
          <h3 className={`font-display text-2xl font-bold leading-tight drop-shadow-[0_1px_4px_rgba(0,0,0,.35)] ${chrome.ink}`}>
            {heading}
          </h3>
          <span className={`mt-1 font-mono text-[10px] uppercase tracking-[.12em] ${chrome.label}`}>
            {count > 1 ? `counts as ${count} ${baseLabel.toLowerCase()}` : baseLabel.toLowerCase()}
            {aliases.length ? ` · subs for ${aliases.join("/")}` : ""}
          </span>
        </div>
      </div>
      {card.flavor ? (
        <p className={`font-display text-[12px] italic leading-snug ${chrome.label} opacity-95`}>
          “{card.flavor}”
        </p>
      ) : null}
      <div className="rounded-lg border border-white/10 bg-slate-950/55 p-3">
        <span className="font-mono text-[10px] uppercase tracking-[.15em] text-slate-400">
          Use
        </span>
        <p className="mt-1 text-[13px] leading-snug text-slate-100">
          Spend as part of a mash to make a barrel, or pay it as 1¢ toward any market purchase.
        </p>
      </div>
    </article>
  );
}

function CapitalDetail({ card }: { card: Card }) {
  const value = card.capitalValue ?? 1;
  const cost = card.cost ?? value;
  const chrome = CAPITAL_CHROME;
  return (
    <article
      className={[
        "relative flex flex-col gap-3 rounded-xl border-2 p-5 shadow-[0_12px_32px_rgba(0,0,0,.55)]",
        chrome.gradient,
        chrome.border,
      ].join(" ")}
    >
      <DetailCornerCost cost={cost} />
      <header className="flex items-center justify-between pr-12">
        <span className={`font-mono text-[11px] font-semibold uppercase tracking-[0.18em] ${chrome.label}`}>
          Capital
        </span>
      </header>
      {card.displayName ? (
        <h3 className={`font-display text-xl font-bold leading-tight drop-shadow-[0_1px_4px_rgba(0,0,0,.35)] ${chrome.ink}`}>
          {card.displayName}
        </h3>
      ) : null}
      <div className="flex flex-col items-center gap-1 py-3">
        <span className={`font-display text-[64px] font-bold leading-none tabular-nums drop-shadow-[0_3px_8px_rgba(0,0,0,.45)] ${chrome.ink}`}>
          ${value}
        </span>
        <span className={`font-mono text-[11px] uppercase tracking-[.18em] ${chrome.label}`}>
          spend at the market
        </span>
      </div>
      {card.flavor ? (
        <p className={`font-display text-[12px] italic leading-snug ${chrome.label} opacity-95`}>
          “{card.flavor}”
        </p>
      ) : null}
      <div className="rounded-lg border border-white/10 bg-slate-950/55 p-3">
        <span className="font-mono text-[10px] uppercase tracking-[.15em] text-slate-400">
          Use
        </span>
        <p className="mt-1 text-[13px] leading-snug text-slate-100">
          Pays {value}¢ toward any market purchase. Goes to the discard
          pile after the action; reshuffles into your deck on cleanup.
        </p>
      </div>
    </article>
  );
}

/** Corner cost chip used at the top-right of every detail panel. */
function DetailCornerCost({ cost }: { cost: number }) {
  return (
    <span
      className="absolute right-2 top-2 z-10 grid h-7 min-w-[28px] place-items-center rounded-full border border-amber-400/70 bg-slate-950/85 px-1.5 font-mono text-[12px] font-bold tabular-nums text-amber-200 shadow-[0_2px_8px_rgba(0,0,0,.55)]"
      aria-label={`cost ${cost} cents`}
    >
      {cost}¢
    </span>
  );
}

function MashBillDetail({ bill }: { bill: MashBill }) {
  const tier = tierOrCommon(bill.tier);
  const chrome = TIER_CHROME[tier];
  const cells: number[] = [];
  for (const row of bill.rewardGrid) for (const c of row) if (c !== null) cells.push(c);
  const peak = cells.length ? Math.max(...cells) : 0;
  const floor = cells.length ? Math.min(...cells) : 0;
  const recipe = bill.recipe ?? {};
  const recipeBits: string[] = [];
  if (recipe.minCorn) recipeBits.push(`≥${recipe.minCorn} corn`);
  if (recipe.minRye) recipeBits.push(`≥${recipe.minRye} rye`);
  if (recipe.minBarley) recipeBits.push(`≥${recipe.minBarley} barley`);
  if (recipe.minWheat) recipeBits.push(`≥${recipe.minWheat} wheat`);
  if (recipe.maxRye === 0) recipeBits.push("no rye");
  else if (recipe.maxRye != null) recipeBits.push(`≤${recipe.maxRye} rye`);
  if (recipe.maxWheat === 0) recipeBits.push("no wheat");
  else if (recipe.maxWheat != null) recipeBits.push(`≤${recipe.maxWheat} wheat`);
  return (
    <article
      className={[
        "relative flex flex-col gap-3 rounded-xl border-2 p-5 shadow-[0_12px_32px_rgba(0,0,0,.55)]",
        chrome.gradient,
        chrome.border,
        chrome.glow,
      ].join(" ")}
    >
      <DetailCornerCost cost={1} />
      <header className="flex items-baseline justify-between pr-12">
        <span className={`font-mono text-[11px] font-semibold uppercase tracking-[0.18em] ${chrome.label}`}>
          {chrome.label_text}
        </span>
        <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[.12em] text-slate-300">
          {bill.goldAward ? <span aria-hidden>🥇 gold</span> : null}
          {bill.silverAward ? <span aria-hidden>🥈 silver</span> : null}
        </span>
      </header>
      <h3 className={`font-display text-2xl font-bold leading-tight drop-shadow-[0_1px_4px_rgba(0,0,0,.35)] ${chrome.titleInk}`}>
        {bill.name}
      </h3>
      {bill.slogan ? (
        <p className={`font-display text-[13px] italic leading-snug ${chrome.label} opacity-95`}>
          “{bill.slogan}”
        </p>
      ) : null}
      {bill.flavorText ? (
        <p className="text-[12px] italic leading-snug text-slate-300/85">
          {bill.flavorText}
        </p>
      ) : null}

      <div className="grid grid-cols-3 gap-2 rounded-lg border border-white/10 bg-slate-950/55 p-3">
        {bill.rewardGrid.map((row, ri) =>
          row.map((cell, ci) => (
            <div
              key={`${ri}-${ci}`}
              className="grid place-items-center rounded border border-white/10 bg-slate-950/70 py-2"
            >
              <span className={`font-display text-[18px] font-bold tabular-nums ${chrome.titleInk}`}>
                {cell == null ? "—" : cell}
              </span>
            </div>
          )),
        )}
      </div>
      <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[.14em] text-slate-400">
        <span>
          rep range{" "}
          <span className={chrome.titleInk}>
            {floor}–{peak}
          </span>
        </span>
        <span>
          age {bill.ageBands.join("/")}y · demand {bill.demandBands.join("/")}
        </span>
      </div>

      {recipeBits.length > 0 ? (
        <div className="rounded-lg border border-white/10 bg-slate-950/55 p-3">
          <span className="font-mono text-[10px] uppercase tracking-[.15em] text-slate-400">
            Recipe
          </span>
          <p className="mt-1 text-[12.5px] leading-snug text-slate-100">
            cask + {recipeBits.join(" · ")}
          </p>
        </div>
      ) : null}
    </article>
  );
}

function OperationsDetail({ card }: { card: OperationsCard }) {
  const chrome = OPS_CHROME;
  return (
    <article
      className={[
        "relative flex flex-col gap-3 rounded-xl border-2 p-5 shadow-[0_12px_32px_rgba(0,0,0,.55)]",
        chrome.gradient,
        chrome.border,
      ].join(" ")}
    >
      <DetailCornerCost cost={card.cost} />
      <header className="flex items-baseline justify-between pr-12">
        <span className={`font-mono text-[11px] font-semibold uppercase tracking-[0.18em] ${chrome.label}`}>
          Operations
        </span>
        <span className={`font-mono text-[10px] uppercase tracking-[.12em] ${chrome.label} opacity-70`}>
          acquired r{card.drawnInRound}
        </span>
      </header>
      <div className="flex items-start gap-4">
        <div className={`grid h-16 w-16 flex-shrink-0 place-items-center rounded-full border-2 bg-white/10 text-2xl shadow-[inset_0_1px_4px_rgba(255,255,255,.18)] backdrop-blur-sm ${chrome.border} ${chrome.ink}`}>
          ⚡
        </div>
        <h3 className={`font-display text-2xl font-bold leading-tight drop-shadow-[0_1px_4px_rgba(0,0,0,.35)] ${chrome.ink}`}>
          {card.name}
        </h3>
      </div>
      <div className="rounded-lg border border-white/10 bg-slate-950/55 p-3">
        <span className="font-mono text-[10px] uppercase tracking-[.15em] text-slate-400">
          Effect
        </span>
        <p className="mt-1 text-[13px] leading-snug text-slate-100">
          {card.description}
        </p>
      </div>
    </article>
  );
}

function InvestmentDetail({ card }: { card: InvestmentCard }) {
  const toneByTier: Record<InvestmentCard["tier"], { border: string; gradient: string; ink: string; label: string }> = {
    cheap: {
      border: "border-emerald-400",
      gradient:
        "bg-[radial-gradient(110%_70%_at_50%_-10%,rgba(16,185,129,.20),transparent_55%),linear-gradient(180deg,rgba(6,78,59,.55)_0%,rgba(15,23,42,.95)_75%)]",
      ink: "text-emerald-50",
      label: "text-emerald-300",
    },
    medium: {
      border: "border-teal-400",
      gradient:
        "bg-[radial-gradient(110%_70%_at_50%_-10%,rgba(20,184,166,.22),transparent_55%),linear-gradient(180deg,rgba(15,118,110,.55)_0%,rgba(15,23,42,.95)_75%)]",
      ink: "text-teal-50",
      label: "text-teal-300",
    },
    expensive: {
      border: "border-amber-400",
      gradient:
        "bg-[radial-gradient(110%_70%_at_50%_-10%,rgba(251,191,36,.24),transparent_55%),linear-gradient(180deg,rgba(146,64,14,.55)_0%,rgba(15,23,42,.95)_75%)]",
      ink: "text-amber-50",
      label: "text-amber-300",
    },
  };
  const chrome = toneByTier[card.tier];
  return (
    <article
      className={[
        "relative flex flex-col gap-3 rounded-xl border-2 p-5 shadow-[0_12px_32px_rgba(0,0,0,.55)] ring-1 ring-white/10",
        chrome.gradient,
        chrome.border,
      ].join(" ")}
    >
      <DetailCornerCost cost={card.cost} />
      <header className="flex items-baseline justify-between pr-12">
        <span className={`font-mono text-[11px] font-semibold uppercase tracking-[0.18em] ${chrome.label}`}>
          Investment · {card.tier}
        </span>
      </header>
      <h3 className={`font-display text-2xl font-bold leading-tight drop-shadow-[0_1px_4px_rgba(0,0,0,.35)] ${chrome.ink}`}>
        {card.name}
      </h3>
      <p className={`font-display text-[13px] italic leading-snug ${chrome.label} opacity-95`}>
        {card.short}
      </p>
      <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[.12em] text-slate-400">
        <span>
          implements at{" "}
          <span className={`font-bold tabular-nums ${chrome.ink}`}>
            ${card.capital}
          </span>{" "}
          capital
        </span>
      </div>
      <div className="rounded-lg border border-white/10 bg-slate-950/55 p-3">
        <span className="font-mono text-[10px] uppercase tracking-[.15em] text-slate-400">
          Effect
        </span>
        <p className="mt-1 text-[13px] leading-snug text-slate-100">
          {card.effect}
        </p>
      </div>
      <p className="font-mono text-[10px] uppercase tracking-[.12em] text-amber-300/80">
        Preview · the investment mechanic ships in v2.2.
      </p>
    </article>
  );
}
