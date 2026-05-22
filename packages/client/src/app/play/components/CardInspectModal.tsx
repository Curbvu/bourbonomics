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

import { Fragment, useEffect, type ReactNode } from "react";
import type {
  AwardCondition,
  Barrel,
  Card,
  CardEffect,
  InvestmentCard,
  MashBill,
  OperationsCard,
  ResourceSubtype,
} from "@bourbonomics/engine";
import { bandIndex, mashBillBuildCost, mashBillCost } from "@bourbonomics/engine";
import { useGameStore, type InspectPayload } from "@/lib/store/game";
import {
  CAPITAL_CHROME,
  LABOR_CHROME,
  OPS_CHROME,
  RESOURCE_CHROME,
  RESOURCE_GLYPH,
  RESOURCE_LABEL,
  laborGlyphFor,
} from "./handCardStyles";
import { TIER_CHROME, tierOrCommon, type TierChrome } from "./tierStyles";
import { formatMoney, MoneyText } from "./money";

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
    case "barrel":
      return <BarrelDetail barrel={inspect.barrel} ownerName={inspect.ownerName} />;
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
        "relative flex flex-col gap-4 rounded-xl border-2 p-5 shadow-[0_12px_32px_rgba(0,0,0,.55)]",
        chrome.gradient,
        chrome.border,
      ].join(" ")}
    >
      <DetailCornerCost cost={cost} />
      <header className="flex items-center justify-between pr-12">
        <span className={`font-mono text-[12px] font-semibold uppercase tracking-[0.18em] ${chrome.label}`}>
          Resource
        </span>
      </header>
      <div className="flex items-center gap-4">
        <div
          className={`grid h-20 w-20 flex-shrink-0 place-items-center rounded-full border-2 bg-white/10 text-4xl shadow-[inset_0_1px_4px_rgba(255,255,255,.18)] backdrop-blur-sm ${chrome.border} ${chrome.ink}`}
        >
          {RESOURCE_GLYPH[subtype]}
        </div>
        <h3 className={`font-display text-3xl font-bold leading-tight drop-shadow-[0_1px_4px_rgba(0,0,0,.35)] ${chrome.ink}`}>
          {heading}
        </h3>
      </div>
      <CountsBadge subtype={subtype} count={count} aliases={aliases} chrome={chrome} />
      {card.flavor ? (
        <p className={`font-display text-[15px] italic leading-snug ${chrome.label} opacity-95`}>
          “{card.flavor}”
        </p>
      ) : null}
      <EffectsByPhase effect={card.effect} />
      <UseBox>
        Spend as part of a mash to make a barrel, or pay it as {formatMoney(1)} toward any market purchase.
      </UseBox>
    </article>
  );
}

function CapitalDetail({ card }: { card: Card }) {
  // v2.11: Labor cards are also routed here (HandTray's right-click
  // inspect emits {kind:"capital"} for the secondary-currency lane).
  // Detect Labor and re-skin with LABOR_CHROME + a Labor headline so
  // the inspect modal doesn't read as "Capital · value 1" for a
  // Generic Worker.
  if (card.type === "labor") {
    return <LaborDetail card={card} />;
  }
  const value = card.capitalValue ?? 1;
  const cost = card.cost ?? value;
  const chrome = CAPITAL_CHROME;
  return (
    <article
      className={[
        "relative flex flex-col gap-4 rounded-xl border-2 p-5 shadow-[0_12px_32px_rgba(0,0,0,.55)]",
        chrome.gradient,
        chrome.border,
      ].join(" ")}
    >
      <DetailCornerCost cost={cost} />
      <header className="flex items-center justify-between pr-12">
        <span className={`font-mono text-[12px] font-semibold uppercase tracking-[0.18em] ${chrome.label}`}>
          Capital
        </span>
      </header>
      {card.displayName ? (
        <h3 className={`font-display text-2xl font-bold leading-tight drop-shadow-[0_1px_4px_rgba(0,0,0,.35)] ${chrome.ink}`}>
          {card.displayName}
        </h3>
      ) : null}
      <div className="flex flex-col items-center gap-1 py-3">
        <MoneyText
          n={value}
          className={`font-display text-[64px] font-bold leading-none drop-shadow-[0_3px_8px_rgba(0,0,0,.45)] ${chrome.ink}`}
        />
        <span className={`font-mono text-[12px] uppercase tracking-[.18em] ${chrome.label}`}>
          spend at the market
        </span>
      </div>
      {card.flavor ? (
        <p className={`font-display text-[15px] italic leading-snug ${chrome.label} opacity-95`}>
          “{card.flavor}”
        </p>
      ) : null}
      <EffectsByPhase effect={card.effect} />
      <UseBox>
        Pays {formatMoney(value)} toward any market purchase. Goes to the discard
        pile after the action; reshuffles into your deck on cleanup.
      </UseBox>
    </article>
  );
}

/**
 * v2.11 Labor card detail panel. Generic Labor (+1 anywhere) is the
 * starter-deck workhorse; Specialty Labor (Cooper, Marketing) gives
 * a +2 boost in its matching domain and contributes 0 elsewhere.
 * Generic Labor is also legal as an aging-commit card (sweat equity).
 */
function LaborDetail({ card }: { card: Card }) {
  const chrome = LABOR_CHROME;
  const sub = card.laborSubtype;
  const subtypeLabel =
    sub === "marketing" ? "Marketing" :
    sub === "cooper" ? "Cooper" :
    sub === "architect" ? "Architect" :
    "Worker";
  const contribution = card.laborContribution ?? 1;
  const cost = card.cost ?? 1;
  const domainText =
    sub === "marketing" ? "operations card purchases" :
    sub === "cooper" ? "market resource purchases" :
    sub === "architect" ? "investment purchases" :
    "any purchase";
  return (
    <article
      className={[
        "relative flex flex-col gap-4 rounded-xl border-2 p-5 shadow-[0_12px_32px_rgba(0,0,0,.55)]",
        chrome.gradient,
        chrome.border,
      ].join(" ")}
    >
      <DetailCornerCost cost={cost} />
      <header className="flex items-center justify-between pr-12">
        <span className={`font-mono text-[12px] font-semibold uppercase tracking-[0.18em] ${chrome.label}`}>
          Labor · {subtypeLabel}
        </span>
      </header>
      <div className="flex items-center gap-4">
        <div
          aria-hidden
          className={`grid h-20 w-20 flex-shrink-0 place-items-center rounded-full border-2 bg-white/10 text-5xl shadow-[inset_0_1px_4px_rgba(255,255,255,.18)] backdrop-blur-sm ${chrome.border} ${chrome.ink}`}
        >
          {laborGlyphFor(sub)}
        </div>
        <h3 className={`font-display text-3xl font-bold leading-tight drop-shadow-[0_1px_4px_rgba(0,0,0,.35)] ${chrome.ink}`}>
          {card.displayName ?? subtypeLabel}
        </h3>
      </div>
      <div className={`flex flex-col items-center ${chrome.ink}`}>
        <span className="font-display text-[48px] font-bold leading-none drop-shadow-[0_3px_8px_rgba(0,0,0,.45)]">
          +{contribution}
        </span>
        <span className={`font-mono text-[12px] uppercase tracking-[.18em] ${chrome.label}`}>
          toward {domainText}
        </span>
      </div>
      {card.flavor ? (
        <p className={`font-display text-[15px] italic leading-snug ${chrome.label} opacity-95`}>
          “{card.flavor}”
        </p>
      ) : null}
      <UseBox>
        {sub === "generic" || !sub
          ? `Tag in any purchase to discount the rep cost by ${contribution}. Generic Labor can also age a barrel — commit it to an aging slot in place of a resource. You only get 2 to start, and the central pile is gone, so spend them carefully.`
          : `Tag in a matching ${domainText.replace(" purchases", "")} purchase to discount the rep cost by ${contribution}. Contributes 0 on other purchase types. Specialty Labor only enters your deck via the market — guard it.`}
      </UseBox>
    </article>
  );
}

/**
 * Standardized "counts as N X" badge — one prominent, consistent line
 * for the resource arithmetic so a Double / Specialty's headline stat
 * is unambiguous at a glance. Aliases (cards that sub for multiple
 * subtypes) get folded into the same row.
 */
function CountsBadge({
  subtype,
  count,
  aliases,
  chrome,
}: {
  subtype: ResourceSubtype;
  count: number;
  aliases: ResourceSubtype[];
  chrome: { border: string; ink: string; label: string };
}) {
  const baseLabel = RESOURCE_LABEL[subtype];
  return (
    <div
      className={[
        "rounded-lg border-2 bg-slate-950/45 px-4 py-3 text-center",
        chrome.border,
      ].join(" ")}
    >
      <div className={`font-display text-[22px] font-bold leading-tight ${chrome.ink}`}>
        Counts as {count} {baseLabel}
      </div>
      {aliases.length ? (
        <div className={`mt-1 font-mono text-[11px] uppercase tracking-[.14em] ${chrome.label}`}>
          subs for {aliases.map((a) => RESOURCE_LABEL[a]).join(" / ")}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Standardized "Use" panel — every card type renders the same shape so
 * readers always know where to look for "what does spending this do".
 */
function UseBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/60 p-4">
      <span className="font-mono text-[11px] uppercase tracking-[.15em] text-slate-400">
        Use
      </span>
      <p className="mt-1.5 text-[15px] leading-snug text-slate-100">{children}</p>
    </div>
  );
}

// ---------------------------------------------------------------
// Effect rendering
// ---------------------------------------------------------------
//
// A card's effect (or each leaf of a composite tree) fires at exactly
// one phase: when committed at production, when used as an aging card,
// when the barrel sells, or when spent at the market. The detail modal
// groups every leaf by its phase and renders one labeled box per phase
// — so the player can see at a glance which moments the card matters
// at, with the same chrome regardless of card type.

type EffectPhase = "on_commit_production" | "on_commit_aging" | "on_sale" | "on_spend";

const PHASE_ORDER: EffectPhase[] = [
  "on_commit_production",
  "on_commit_aging",
  "on_sale",
  "on_spend",
];

const PHASE_LABEL: Record<EffectPhase, string> = {
  on_commit_production: "Mash effect",
  on_commit_aging: "Age effect",
  on_sale: "Bourbon effect",
  on_spend: "Market effect",
};

const PHASE_HINT: Record<EffectPhase, string> = {
  on_commit_production: "fires when this card is committed to a mash",
  on_commit_aging: "fires when this card is placed on a barrel as an aging year",
  on_sale: "fires when the barrel this card was committed to sells",
  on_spend: "fires every time this card pays toward a market purchase",
};

function EffectsByPhase({ effect }: { effect: CardEffect | undefined }) {
  if (!effect) return null;
  const grouped = groupEffectByPhase(effect);
  if (grouped.size === 0) return null;
  return (
    <div className="flex flex-col gap-2.5">
      {PHASE_ORDER.filter((p) => grouped.has(p)).map((phase) => (
        <EffectBox key={phase} phase={phase} lines={grouped.get(phase)!} />
      ))}
    </div>
  );
}

function EffectBox({ phase, lines }: { phase: EffectPhase; lines: string[] }) {
  return (
    <div className="rounded-lg border border-amber-500/45 bg-amber-700/[0.13] p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[12px] font-semibold uppercase tracking-[.15em] text-amber-300">
          {PHASE_LABEL[phase]}
        </span>
        <span className="font-mono text-[10px] italic uppercase tracking-[.12em] text-amber-200/65">
          {PHASE_HINT[phase]}
        </span>
      </div>
      <ul className="mt-2 space-y-1 text-[15px] leading-snug text-amber-50">
        {lines.map((line, i) => (
          <li key={i}>• {line}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Walk a (possibly composite) effect tree and bucket every leaf by its
 * `when` phase. Returns one entry per phase that has at least one
 * description.
 */
function groupEffectByPhase(effect: CardEffect): Map<EffectPhase, string[]> {
  const out = new Map<EffectPhase, string[]>();
  const visit = (e: CardEffect): void => {
    if (e.kind === "composite") {
      for (const child of e.effects) visit(child);
      return;
    }
    const phase = e.when as EffectPhase;
    const desc = describeLeafEffect(e);
    if (!desc) return;
    const bucket = out.get(phase);
    if (bucket) bucket.push(desc);
    else out.set(phase, [desc]);
  };
  visit(effect);
  return out;
}

/**
 * One-line description of a single (non-composite) effect leaf. The
 * "when" framing is owned by the surrounding EffectBox so these lines
 * stay short and read like card text rather than full sentences with
 * "on sale, …" prefixes.
 */
function describeLeafEffect(effect: CardEffect): string | null {
  switch (effect.kind) {
    case "draw_cards":
      return `Draw ${effect.n} card${effect.n === 1 ? "" : "s"}.`;
    case "rep_on_sale_flat":
      return `Gain +${effect.rep} reputation.`;
    case "rep_on_sale_if_age_gte":
      return `Gain +${effect.rep} reputation if barrel age ≥ ${effect.age}.`;
    case "rep_on_sale_if_demand_gte":
      return `Gain +${effect.rep} reputation if demand ≥ ${effect.demand}.`;
    case "rep_on_commit_aging":
      return `Gain +${effect.rep} reputation.`;
    case "rep_on_market_spend":
      return `Gain +${effect.rep} reputation.`;
    case "bump_demand":
      return `Demand ${effect.delta >= 0 ? "+" : ""}${effect.delta}.`;
    case "skip_demand_drop":
      return "Demand does not drop from this sale.";
    case "barrel_starts_aged":
      return `Barrel starts at age ${effect.age}.`;
    case "aging_card_doubled":
      return `Adds ${effect.years} years of aging instead of the usual 1.`;
    case "grid_demand_band_offset":
      return `Sale grid reads ${effect.offset > 0 ? "+" : ""}${effect.offset} demand band${
        Math.abs(effect.offset) === 1 ? "" : "s"
      }.`;
    case "grid_rep_offset":
      return `+${effect.offset} reputation at every grid band for the rest of the barrel's life.`;
    case "returns_to_hand_on_sale":
      return "Returns to your hand instead of going to discard.";
    default:
      return null;
  }
}

/** Corner cost chip used at the top-right of every detail panel. */
function DetailCornerCost({ cost }: { cost: number }) {
  return (
    <span
      className="absolute right-2 top-2 z-10 grid h-7 min-w-[34px] place-items-center rounded-full border border-amber-400/70 bg-slate-950/85 px-1.5 font-mono text-[12px] font-bold text-amber-200 shadow-[0_2px_8px_rgba(0,0,0,.55)]"
      aria-label={`cost B$${cost}`}
    >
      <MoneyText n={cost} />
    </span>
  );
}

/**
 * Format a band index as a human range. For ageBands [2,4,6] the cells
 * cover age ≥2/<4, ≥4/<6, ≥6+ — so labels read "2–3y", "4–5y", "6+y".
 * Demand bands work the same way without the year suffix.
 */
function bandLabel(
  bands: readonly number[],
  idx: number,
  suffix = "",
): string {
  const lo = bands[idx]!;
  const next = bands[idx + 1];
  if (next == null) return `${lo}+${suffix}`;
  return next - 1 === lo ? `${lo}${suffix}` : `${lo}–${next - 1}${suffix}`;
}

/**
 * Reward grid with self-documenting axes — top row is the demand band
 * each column covers, left column is the age band each row covers.
 *
 * v2.10: cells that can trigger an award light up — Silver cells get a
 * slate gradient, Gold cells get a bright amber gradient with a
 * 🥈 / 🥇 corner badge. Same idiom as the Bourbon Wiki
 * (`/wiki`) so a player who studied bills there reads the
 * inspect modal the same way.
 */
function RewardMatrix({
  bill,
  chrome,
  liveCell,
}: {
  bill: MashBill;
  chrome: TierChrome;
  /**
   * When set, the cell at this (row, col) is highlighted as the
   * barrel's current sale-time payout — i.e. what the engine would
   * pay if the player sold this barrel right now at current demand.
   * Omit when the matrix is shown without a specific barrel context
   * (e.g. the bourbon encyclopedia tile).
   */
  liveCell?: { row: number; col: number } | null;
}) {
  // v2.5: grids are variable size (commons 1×2 / 2×1, legendaries up
  // to 3×3 or wider). Iterate the actual band arrays rather than
  // assuming 3 rows × 3 columns.
  const ageLabels = bill.ageBands.map((_, i) => bandLabel(bill.ageBands, i, "y"));
  const demandLabels = bill.demandBands.map((_, i) => bandLabel(bill.demandBands, i));
  const cols = bill.demandBands.length;
  const hasAwards = bill.silverAward != null || bill.goldAward != null;
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/55 p-3">
      <div
        className="grid items-center gap-x-2 gap-y-2"
        style={{ gridTemplateColumns: `auto repeat(${cols}, minmax(0, 1fr))` }}
      >
        {/* Header row: axis legend in the corner + demand band labels */}
        <div
          className={`flex items-center justify-end pr-1.5 font-mono text-[11px] uppercase tracking-[.18em] ${chrome.label} opacity-80`}
        >
          <span aria-hidden>↓ age · demand →</span>
        </div>
        {demandLabels.map((label, ci) => (
          <div
            key={`dh-${ci}`}
            className={`grid place-items-center font-mono text-[14px] font-semibold uppercase tracking-[.10em] tabular-nums ${chrome.label}`}
          >
            {label}
          </div>
        ))}

        {/* Body rows: age band label + reward cells */}
        {bill.rewardGrid.map((row, ri) => {
          const nextAge = bill.ageBands[ri + 1];
          const ageHi = nextAge ?? Infinity;
          return (
            <Fragment key={`row-${ri}`}>
              <div
                className={`grid place-items-center pr-1.5 font-mono text-[14px] font-semibold uppercase tracking-[.10em] tabular-nums ${chrome.label} text-right`}
              >
                {ageLabels[ri]}
              </div>
              {row.map((cell, ci) => {
                const nextDemand = bill.demandBands[ci + 1];
                const demandHi = nextDemand ?? Infinity;
                const award = cellAward(bill, cell, ageHi, demandHi);
                const isLive = liveCell?.row === ri && liveCell?.col === ci;
                return (
                  <div
                    key={`${ri}-${ci}`}
                    className={[
                      "relative grid min-h-[64px] place-items-center rounded border py-3",
                      awardCellBg(award, cell),
                      isLive
                        ? "border-emerald-300 ring-2 ring-emerald-300/80 ring-offset-2 ring-offset-slate-950 shadow-[0_0_14px_rgba(110,231,183,.45)]"
                        : "border-white/10",
                    ].join(" ")}
                    aria-current={isLive ? "true" : undefined}
                  >
                    <span
                      className={`font-display text-[40px] font-bold leading-none tabular-nums drop-shadow-[0_2px_6px_rgba(0,0,0,.45)] ${
                        cell == null
                          ? "text-slate-600"
                          : award != null
                            ? "text-slate-950"
                            : chrome.titleInk
                      }`}
                    >
                      {cell == null ? "—" : cell}
                    </span>
                    {award ? (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute right-1 top-1 text-[14px] leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,.55)]"
                      >
                        {award === "gold" ? "🥇" : "🥈"}
                      </span>
                    ) : null}
                    {isLive ? (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 rounded-full border border-emerald-300 bg-emerald-500/95 px-1.5 py-[1px] font-mono text-[8px] font-bold uppercase tracking-[.14em] text-slate-950 shadow-[0_2px_6px_rgba(0,0,0,.5)]"
                      >
                        Now
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </Fragment>
          );
        })}
      </div>
      {/* Inline award legend — same idiom as the encyclopedia. Only
          shows the bands the bill actually carries. */}
      {hasAwards ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 font-mono text-[10px] uppercase tracking-[.12em] text-slate-400">
          {bill.silverAward ? (
            <span className="flex items-center gap-1.5">
              <span className="text-[12px]" aria-hidden>🥈</span>
              <span>Silver · {awardCondText(bill.silverAward)}</span>
            </span>
          ) : null}
          {bill.goldAward ? (
            <span className="flex items-center gap-1.5">
              <span className="text-[12px]" aria-hidden>🥇</span>
              <span>Gold · {awardCondText(bill.goldAward)}</span>
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Cell background — neutral by default, gold/silver gradient when the
 * cell can trigger an award. Mirrors `awardCellBg` in the bourbon
 * encyclopedia so the modal's matrix reads identically to the
 * gallery's.
 */
function awardCellBg(
  award: "gold" | "silver" | null,
  cell: number | null,
): string {
  if (cell == null) return "bg-slate-900/40";
  if (award === "gold") {
    return "bg-gradient-to-b from-amber-300 to-amber-500 shadow-[0_0_10px_rgba(252,211,77,.4)]";
  }
  if (award === "silver") {
    return "bg-gradient-to-b from-slate-300 to-slate-400";
  }
  return "bg-slate-950/70";
}

/**
 * Returns "gold", "silver", or null based on whether the cell's
 * (age band, demand band, reward) can trigger an award. Gold takes
 * precedence if both fire. A cell qualifies when *some* combination
 * of (age, demand) within the band satisfies the award's mins.
 */
function cellAward(
  bill: MashBill,
  reward: number | null,
  ageHi: number,
  demandHi: number,
): "gold" | "silver" | null {
  if (reward == null) return null;
  const fires = (cond: AwardCondition | undefined): boolean => {
    if (!cond) return false;
    if (cond.minAge != null && cond.minAge >= ageHi) return false;
    if (cond.minDemand != null && cond.minDemand >= demandHi) return false;
    if (cond.minReward != null && reward < cond.minReward) return false;
    return true;
  };
  if (fires(bill.goldAward)) return "gold";
  if (fires(bill.silverAward)) return "silver";
  return null;
}

/** Compact "age 3+ · demand 5+" string for the inline award legend. */
function awardCondText(c: AwardCondition): string {
  const bits: string[] = [];
  if (c.minAge != null) bits.push(`age ${c.minAge}+`);
  if (c.minDemand != null) bits.push(`demand ${c.minDemand}+`);
  if (c.minReward != null) bits.push(`reward ${c.minReward}+`);
  return bits.length ? bits.join(" · ") : "any qualifying sale";
}

/**
 * Ornamental section divider — double horizontal lines flanking a small
 * uppercase label. Used to break the mash-bill detail into Recipe /
 * Rewards / Awards bands so the modal reads like a whiskey label.
 */
function SectionHeading({ label, tone }: { label: string; tone: string }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <span
        className={`h-px flex-1 bg-current opacity-25 ${tone}`}
        aria-hidden
      />
      <span
        className={`font-mono text-[10px] font-bold uppercase tracking-[.32em] ${tone}`}
      >
        {label}
      </span>
      <span
        className={`h-px flex-1 bg-current opacity-25 ${tone}`}
        aria-hidden
      />
    </div>
  );
}

/**
 * Decorative corner glyph — small ✦ pinned in each corner of the mash-bill
 * detail panel so it reads as a stamped label rather than a plain rectangle.
 */
function CornerOrnament({
  pos,
  tone,
}: {
  pos: "tl" | "tr" | "bl" | "br";
  tone: string;
}) {
  const place = {
    tl: "left-1.5 top-1.5",
    tr: "right-1.5 top-1.5",
    bl: "left-1.5 bottom-1.5",
    br: "right-1.5 bottom-1.5",
  }[pos];
  return (
    <span
      className={`pointer-events-none absolute font-display text-[14px] leading-none opacity-50 ${place} ${tone}`}
      aria-hidden
    >
      ✦
    </span>
  );
}

interface RecipeChipSpec {
  /**
   * Either a plain string (e.g. "✦" wild placeholder, "◯" cask) or a
   * grain-icon React node from `RESOURCE_GLYPH` — both render through
   * the same JSX child slot.
   */
  glyph: ReactNode;
  label: string;
  count?: number;
  tint: string;
  forbidden?: boolean;
  wild?: boolean;
  /** v2.11: Specialty / Heritage card requirement. */
  specialty?: boolean;
}

/**
 * Decorative recipe display — renders the bill's grain composition as
 * colored chips with the same glyph + palette used everywhere else.
 * Always rendered (commons with no constraints show "any grain"); a
 * forbidden grain shows the chip with a struck-through ✕ overlay.
 *
 * v2.8: a Specialty card satisfies both the universal/per-subtype
 * minimum AND the `minSpecialty` floor. The plain chip count is
 * reduced by the specialty count for that subtype so the row reads
 * truthfully — no phantom "1 cask + 1 specialty cask" double-count
 * when one card is enough.
 */
function RecipeGrid({ bill }: { bill: MashBill }) {
  const r = bill.recipe ?? {};
  const sp = r.minSpecialty ?? {};
  const items: RecipeChipSpec[] = [];

  const minCorn = Math.max(1, r.minCorn ?? 0);
  const minRye = r.minRye ?? 0;
  const minBarley = r.minBarley ?? 0;
  const minWheat = r.minWheat ?? 0;

  const plainCask = Math.max(0, 1 - (sp.cask ?? 0));
  const plainCorn = Math.max(0, minCorn - (sp.corn ?? 0));
  const plainRye = Math.max(0, minRye - (sp.rye ?? 0));
  const plainBarley = Math.max(0, minBarley - (sp.barley ?? 0));
  const plainWheat = Math.max(0, minWheat - (sp.wheat ?? 0));

  if (plainCask > 0) {
    items.push({
      glyph: RESOURCE_GLYPH.cask,
      label: "Cask",
      count: plainCask > 1 ? plainCask : undefined,
      tint: RESOURCE_CHROME.cask.label,
    });
  }
  if (plainCorn > 0) {
    items.push({
      glyph: RESOURCE_GLYPH.corn,
      label: "Corn",
      count: plainCorn,
      tint: RESOURCE_CHROME.corn.label,
    });
  }
  if (plainRye > 0) {
    items.push({
      glyph: RESOURCE_GLYPH.rye,
      label: "Rye",
      count: plainRye,
      tint: RESOURCE_CHROME.rye.label,
    });
  }
  if (plainBarley > 0) {
    items.push({
      glyph: RESOURCE_GLYPH.barley,
      label: "Barley",
      count: plainBarley,
      tint: RESOURCE_CHROME.barley.label,
    });
  }
  if (plainWheat > 0) {
    items.push({
      glyph: RESOURCE_GLYPH.wheat,
      label: "Wheat",
      count: plainWheat,
      tint: RESOURCE_CHROME.wheat.label,
    });
  }

  // Wild grain — when no specific grain is required, the universal
  // rule still demands ≥1 grain of any kind. Surface that explicitly
  // so commons don't feel under-specified.
  const namedGrain = minRye + minBarley + minWheat;
  const minTotal = r.minTotalGrain ?? 0;
  const wildGrain =
    namedGrain === 0 ? 1 : Math.max(0, minTotal - namedGrain);
  if (wildGrain > 0) {
    items.push({
      glyph: "✦",
      label: "Any grain",
      count: wildGrain,
      tint: "text-slate-300",
      wild: true,
    });
  }

  // v2.7.2: per-subtype Specialty requirements as their own chips.
  for (const s of ["cask", "corn", "rye", "barley", "wheat"] as const) {
    const n = sp[s];
    if (n && n > 0) {
      items.push({
        glyph: RESOURCE_GLYPH[s],
        label: `★ Specialty ${s.charAt(0).toUpperCase() + s.slice(1)}`,
        count: n > 1 ? n : undefined,
        tint: RESOURCE_CHROME[s].label,
        specialty: true,
      });
    }
  }

  // Caps — `0` reads as forbidden, positive caps as a ceiling.
  if (r.maxRye === 0) {
    items.push({
      glyph: RESOURCE_GLYPH.rye,
      label: "No rye",
      tint: RESOURCE_CHROME.rye.label,
      forbidden: true,
    });
  } else if (r.maxRye != null) {
    items.push({
      glyph: RESOURCE_GLYPH.rye,
      label: `≤${r.maxRye} rye`,
      tint: RESOURCE_CHROME.rye.label,
    });
  }
  if (r.maxWheat === 0) {
    items.push({
      glyph: RESOURCE_GLYPH.wheat,
      label: "No wheat",
      tint: RESOURCE_CHROME.wheat.label,
      forbidden: true,
    });
  } else if (r.maxWheat != null) {
    items.push({
      glyph: RESOURCE_GLYPH.wheat,
      label: `≤${r.maxWheat} wheat`,
      tint: RESOURCE_CHROME.wheat.label,
    });
  }

  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/60 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.05)]">
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {items.map((item, i) => (
          <span
            key={i}
            className={[
              "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px] uppercase tracking-[.10em] shadow-[inset_0_1px_0_rgba(255,255,255,.06)]",
              item.specialty
                ? "border-amber-300 bg-amber-700/35 shadow-[0_0_8px_rgba(252,211,77,.25)]"
                : "border-white/10 bg-slate-950/70",
              item.forbidden ? "opacity-70" : "",
            ].join(" ")}
          >
            <span
              className={`relative inline-block text-[14px] leading-none ${item.tint}`}
            >
              {item.glyph}
              {item.forbidden ? (
                <span
                  className="absolute inset-0 grid place-items-center text-[15px] font-bold leading-none text-rose-300"
                  aria-hidden
                >
                  ✕
                </span>
              ) : null}
            </span>
            <span
              className={
                item.wild
                  ? "text-slate-300"
                  : item.specialty
                    ? "text-amber-100"
                    : "text-slate-100"
              }
            >
              {item.count && item.count > 1 ? `${item.count}× ` : ""}
              {item.label}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function MashBillDetail({ bill }: { bill: MashBill }) {
  const tier = tierOrCommon(bill.tier);
  const chrome = TIER_CHROME[tier];
  const cells: number[] = [];
  for (const row of bill.rewardGrid) for (const c of row) if (c !== null) cells.push(c);
  const peak = cells.length ? Math.max(...cells) : 0;
  const floor = cells.length ? Math.min(...cells) : 0;
  return (
    <article
      className={[
        "relative flex flex-col gap-3 overflow-hidden rounded-xl border-2 p-5 pb-6 shadow-[0_12px_32px_rgba(0,0,0,.55)]",
        chrome.gradient,
        chrome.border,
        chrome.glow,
      ].join(" ")}
    >
      {/* Inner ornamental frame — sits inside the outer rarity border to
          give the modal a bottle-label feel without competing with the
          colored tier ring. */}
      <span
        className="pointer-events-none absolute inset-2 rounded-lg border border-white/10"
        aria-hidden
      />
      <CornerOrnament pos="tl" tone={chrome.label} />
      <CornerOrnament pos="tr" tone={chrome.label} />
      <CornerOrnament pos="bl" tone={chrome.label} />
      <CornerOrnament pos="br" tone={chrome.label} />

      <DetailCornerCost cost={mashBillCost(bill)} />

      {/* Tier ribbon — uses the rarity-specific pill chrome (gold ribbon
          for legendary, etc.) so the badge alone tells the player what
          they're looking at. */}
      <header className="relative flex items-center justify-between pr-12">
        <span
          className={`rounded border-2 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[.24em] shadow-[inset_0_1px_0_rgba(255,255,255,.18)] ${chrome.pill}`}
        >
          {chrome.label_text}
        </span>
      </header>

      {/* Title with flanking flourishes */}
      <div className="flex items-center justify-center gap-3 px-4 text-center">
        <span
          className={`text-[14px] leading-none ${chrome.label} opacity-50`}
          aria-hidden
        >
          ❦
        </span>
        <h3
          className={`font-display text-[26px] font-bold leading-[1.05] drop-shadow-[0_1px_4px_rgba(0,0,0,.55)] ${chrome.titleInk}`}
        >
          {bill.name}
        </h3>
        <span
          className={`text-[14px] leading-none ${chrome.label} opacity-50`}
          aria-hidden
        >
          ❦
        </span>
      </div>

      {bill.slogan ? (
        <p
          className={`text-center font-display text-[13px] italic leading-snug ${chrome.label} opacity-95`}
        >
          “{bill.slogan}”
        </p>
      ) : null}
      {bill.flavorText ? (
        <p className="text-center text-[12px] italic leading-snug text-slate-300/85">
          {bill.flavorText}
        </p>
      ) : null}

      {/* Recipe — always shown so even unconstrained commons display the
          universal cask + corn + grain mash. */}
      <SectionHeading label="Recipe" tone={chrome.label} />
      <RecipeGrid bill={bill} />

      {/* Rewards — the same age × demand grid, now grouped under its own
          ornamental heading. */}
      <SectionHeading label="Rewards" tone={chrome.label} />
      <RewardMatrix bill={bill} chrome={chrome} />
      <div className="text-center font-mono text-[10px] uppercase tracking-[.18em] text-slate-400">
        rep range{" "}
        <span className={`font-bold ${chrome.titleInk}`}>
          {floor}–{peak}
        </span>
      </div>

      {/* Tuning footer — `cost` is the bill's market draw price; `build`
          is the implicit total resource investment to make one barrel
          (basic = 1, specialty = 4, plus the draw cost). Useful for
          ranking bills against each other while balancing payouts. */}
      <div className="mt-1 flex items-center justify-center gap-5 border-t border-white/10 pt-2 font-mono text-[10px] uppercase tracking-[.18em] text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="text-slate-500">cost</span>
          <MoneyText n={mashBillCost(bill)} className="font-display text-[13px] font-bold text-amber-200" />
        </span>
        <span
          className="flex items-center gap-1.5"
          title="Implicit build cost: 1 per basic resource + 4 per specialty (3 market + 1 sale bonus) + draw cost"
        >
          <span className="text-slate-500">build</span>
          <span className="font-display text-[13px] font-bold tabular-nums text-emerald-200">
            {mashBillBuildCost(bill)}
          </span>
        </span>
      </div>
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
        <div className="flex flex-col gap-1">
          <h3 className={`font-display text-2xl font-bold leading-tight drop-shadow-[0_1px_4px_rgba(0,0,0,.35)] ${chrome.ink}`}>
            {card.name}
          </h3>
          {card.flavor ? (
            <p className={`font-display text-[13px] italic leading-snug ${chrome.label}`}>
              “{card.flavor}”
            </p>
          ) : null}
        </div>
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
    small: {
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
    large: {
      border: "border-amber-400",
      gradient:
        "bg-[radial-gradient(110%_70%_at_50%_-10%,rgba(251,191,36,.24),transparent_55%),linear-gradient(180deg,rgba(146,64,14,.55)_0%,rgba(15,23,42,.95)_75%)]",
      ink: "text-amber-50",
      label: "text-amber-300",
    },
  };
  const chrome = toneByTier[card.tier];
  const triggerLabel = card.triggers.join(" + ");
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
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[.12em] text-slate-400">
        <span>
          category{" "}
          <span className={`font-bold ${chrome.ink}`}>{card.category}</span>
        </span>
        <span>
          archetype{" "}
          <span className={`font-bold ${chrome.ink}`}>{card.archetype}</span>
        </span>
        <span>
          trigger{" "}
          <span className={`font-bold ${chrome.ink}`}>{triggerLabel}</span>
        </span>
        {card.rateLimited ? (
          <span>
            rate{" "}
            <span className={`font-bold ${chrome.ink}`}>
              {card.rateLimitScope ?? "limited"}
            </span>
          </span>
        ) : null}
      </div>
      <div className="rounded-lg border border-white/10 bg-slate-950/55 p-3">
        <span className="font-mono text-[10px] uppercase tracking-[.15em] text-slate-400">
          Card text
        </span>
        <p className="mt-1 text-[13px] leading-snug text-slate-100">
          {card.text}
        </p>
      </div>
      <div className="rounded-lg border border-white/10 bg-slate-950/40 p-3">
        <span className="font-mono text-[10px] uppercase tracking-[.15em] text-slate-400">
          Description
        </span>
        <p className="mt-1 text-[12px] leading-snug text-slate-300">
          {card.description}
        </p>
      </div>
      <p className="font-mono text-[10px] uppercase tracking-[.12em] text-amber-300/80">
        Preview · investment effects are not yet resolved by the engine.
      </p>
    </article>
  );
}

/**
 * Barrel inspect view — shows everything that's "live state" on a
 * barrel: the attached mash bill (if any) with its full reward grid,
 * the current age + phase + completion-round, every committed card
 * (production pile + aging pile, with the cards rendered by their
 * subtype palette), and any persistent barrel modifiers (Single
 * Barrel Cask grid offset, Master Distiller demand offset, Rushed
 * Shipment extra ages).
 */
interface RecipeRow {
  key: string;
  glyph: ReactNode;
  label: string;
  tint: string;
  required: number;
  current: number;
  /** Whether over-commit has piled extra past the requirement. */
  over: number;
  /** Specialty floor (recipe.minSpecialty): renders a ★ marker. */
  specialty?: boolean;
}

/**
 * Tally the barrel's committed production cards by subtype. The
 * `specialty` field counts only cards flagged `specialty: true` per
 * subtype — used to display recipe.minSpecialty progress alongside
 * the universal/basic minimums (mirrors the engine's recipe-
 * satisfaction check in make-bourbon.ts).
 */
function tallyCommittedPile(cards: Card[]): {
  cask: number;
  corn: number;
  rye: number;
  barley: number;
  wheat: number;
  specialty: { cask: number; corn: number; rye: number; barley: number; wheat: number };
} {
  const t = {
    cask: 0,
    corn: 0,
    rye: 0,
    barley: 0,
    wheat: 0,
    specialty: { cask: 0, corn: 0, rye: 0, barley: 0, wheat: 0 },
  };
  for (const c of cards) {
    if (c.type !== "resource") continue;
    const units = c.resourceCount ?? 1;
    if (c.subtype === "cask") t.cask += units;
    if (c.subtype === "corn") t.corn += units;
    if (c.subtype === "rye") t.rye += units;
    if (c.subtype === "barley") t.barley += units;
    if (c.subtype === "wheat") t.wheat += units;
    if (c.specialty && c.subtype) {
      t.specialty[c.subtype] += units;
    }
  }
  return t;
}

/**
 * Recipe-progress display for a construction-or-aging barrel. Walks
 * the universal rule (1 cask + ≥1 corn + ≥1 grain) AND the bill's
 * own recipe constraints. Each row shows committed / required and a
 * check mark when satisfied. Over-committing past the requirement
 * is allowed (the engine doesn't penalise it) and surfaced as a
 * small "+N extra" tag — the player gets no bonus from extra cards
 * but the visual confirms they aren't broken.
 */
function RecipeProgress({ barrel }: { barrel: Barrel }) {
  const bill = barrel.attachedMashBill;
  const recipe = bill.recipe ?? {};
  const tally = tallyCommittedPile(barrel.productionCards);

  const minWheat = recipe.minWheat ?? 0;
  const minCorn = Math.max(1, recipe.minCorn ?? 0);
  const minRye = recipe.minRye ?? 0;
  const minBarley = recipe.minBarley ?? 0;
  const minTotalGrain = Math.max(recipe.minTotalGrain ?? 0, 1);

  const rows: RecipeRow[] = [];
  // Cask — always exactly 1.
  rows.push({
    key: "cask",
    glyph: RESOURCE_GLYPH.cask,
    label: "Cask",
    tint: RESOURCE_CHROME.cask.label,
    required: 1,
    current: tally.cask,
    over: Math.max(0, tally.cask - 1),
  });
  // Corn — universal ≥1 plus any recipe min.
  rows.push({
    key: "corn",
    glyph: RESOURCE_GLYPH.corn,
    label: "Corn",
    tint: RESOURCE_CHROME.corn.label,
    required: minCorn,
    current: tally.corn,
    over: Math.max(0, tally.corn - minCorn),
  });
  if (minRye > 0) {
    rows.push({
      key: "rye",
      glyph: RESOURCE_GLYPH.rye,
      label: "Rye",
      tint: RESOURCE_CHROME.rye.label,
      required: minRye,
      current: tally.rye,
      over: Math.max(0, tally.rye - minRye),
    });
  }
  if (minBarley > 0) {
    rows.push({
      key: "barley",
      glyph: RESOURCE_GLYPH.barley,
      label: "Barley",
      tint: RESOURCE_CHROME.barley.label,
      required: minBarley,
      current: tally.barley,
      over: Math.max(0, tally.barley - minBarley),
    });
  }
  if (minWheat > 0) {
    rows.push({
      key: "wheat",
      glyph: RESOURCE_GLYPH.wheat,
      label: "Wheat",
      tint: RESOURCE_CHROME.wheat.label,
      required: minWheat,
      current: tally.wheat,
      over: Math.max(0, tally.wheat - minWheat),
    });
  }
  // "Any grain" universal: only show when the named grains don't
  // already cover the total-grain minimum.
  const namedGrainMins = minRye + minBarley + minWheat;
  const totalGrainCommitted = tally.rye + tally.barley + tally.wheat;
  if (namedGrainMins < minTotalGrain) {
    rows.push({
      key: "any-grain",
      glyph: "✦",
      label: "Any grain",
      tint: "text-slate-300",
      required: minTotalGrain,
      current: totalGrainCommitted,
      over: Math.max(0, totalGrainCommitted - minTotalGrain),
    });
  }

  // v2.7.2 specialty floors: epic / legendary recipes that gate
  // payouts behind market-only Specialty cards. The engine treats a
  // Specialty card as satisfying both the basic per-subtype minimum
  // AND the specialty floor (one Superior Rye covers minRye:1 +
  // minSpecialty:{rye:1}). Showing a dedicated row here so the
  // player sees why their pile reads "ready" on basics but the
  // engine still won't transition the slot to Aging.
  const sp = recipe.minSpecialty ?? {};
  for (const sub of ["cask", "corn", "rye", "barley", "wheat"] as const) {
    const need = sp[sub] ?? 0;
    if (need > 0) {
      rows.push({
        key: `specialty-${sub}`,
        glyph: RESOURCE_GLYPH[sub],
        label: `Specialty ${sub.charAt(0).toUpperCase()}${sub.slice(1)}`,
        tint: RESOURCE_CHROME[sub].label,
        required: need,
        current: tally.specialty[sub],
        over: Math.max(0, tally.specialty[sub] - need),
        specialty: true,
      });
    }
  }

  const allSatisfied = rows.every((r) => r.current >= r.required);

  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/55 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[.15em] text-slate-400">
          Recipe progress
        </span>
        <span
          className={
            allSatisfied
              ? "rounded border border-emerald-400/60 bg-emerald-700/30 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[.10em] text-emerald-200"
              : "rounded border border-sky-400/60 bg-sky-700/30 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[.10em] text-sky-200"
          }
        >
          {allSatisfied ? "ready to age" : "still building"}
        </span>
      </div>
      <ul className="mt-2 flex flex-col gap-1">
        {rows.map((r) => {
          const satisfied = r.current >= r.required;
          const remaining = Math.max(0, r.required - r.current);
          return (
            <li
              key={r.key}
              className={[
                "flex items-center gap-2 rounded border px-2 py-1.5 font-mono text-[11px]",
                satisfied
                  ? "border-emerald-400/30 bg-emerald-900/15"
                  : r.specialty
                    ? "border-amber-400/40 bg-amber-900/15"
                    : "border-slate-800 bg-slate-950/60",
              ].join(" ")}
            >
              <span className={`text-[16px] leading-none ${r.tint}`}>{r.glyph}</span>
              {r.specialty ? (
                <span
                  aria-hidden
                  className="font-display text-[14px] leading-none text-amber-300 drop-shadow-[0_0_4px_rgba(252,211,77,.6)]"
                >
                  ★
                </span>
              ) : null}
              <span className="text-[12px] uppercase tracking-[.12em] text-slate-200">
                {r.label}
              </span>
              <span className="flex-1" />
              <span className="font-sans tabular-nums text-slate-200">
                <span className={satisfied ? "text-emerald-300" : "text-amber-200"}>
                  {r.current}
                </span>
                <span className="text-slate-500"> / </span>
                <span className="text-slate-200">{r.required}</span>
              </span>
              {r.over > 0 ? (
                <span className="ml-1 rounded border border-slate-700 bg-slate-900 px-1 py-px text-[9px] uppercase tracking-[.10em] text-slate-400">
                  +{r.over} extra
                </span>
              ) : satisfied ? (
                <span aria-hidden className="text-emerald-300">✓</span>
              ) : (
                <span className="rounded border border-amber-500/40 bg-amber-900/20 px-1 py-px text-[9px] font-bold uppercase tracking-[.10em] text-amber-200">
                  +{remaining} needed
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {!allSatisfied ? (
        <p className="mt-2 text-[10.5px] italic leading-snug text-slate-400">
          Aging starts only after every requirement is met. Over-committing past a
          minimum is fine — but it earns no bonus.
        </p>
      ) : null}
      {/* Forbidden / capped grains, surfaced separately so the row
          stays focused on what's needed. */}
      {recipe.maxRye === 0 || recipe.maxWheat === 0 ? (
        <p className="mt-1 font-mono text-[9.5px] uppercase tracking-[.10em] text-rose-300/80">
          {recipe.maxRye === 0 ? "no rye allowed" : ""}
          {recipe.maxRye === 0 && recipe.maxWheat === 0 ? " · " : ""}
          {recipe.maxWheat === 0 ? "no wheat allowed" : ""}
        </p>
      ) : null}
    </div>
  );
}

function BarrelDetail({ barrel, ownerName }: { barrel: Barrel; ownerName?: string }) {
  const { state } = useGameStore();
  const bill = barrel.attachedMashBill;
  const tier = tierOrCommon(bill?.tier);
  const chrome = TIER_CHROME[tier];
  const isAging = barrel.phase === "aging";
  const owner = state?.players.find((p) => p.id === barrel.ownerId);

  // Highlight the cell the engine would read at the current age +
  // demand if the player sold this barrel right now. Mirrors the
  // logic in `computeReward` (rewards.ts): row from age bands, col
  // from demand bands + any persistent demandBandOffset (Master
  // Distiller). Returns null when either axis falls below the lowest
  // band — staged/construction barrels (age 0) and demand-floor
  // states naturally produce no highlight.
  const liveCell = (() => {
    if (!bill || state == null) return null;
    const row = bandIndex(barrel.age, bill.ageBands);
    if (row < 0) return null;
    const baseCol = bandIndex(state.demand, bill.demandBands);
    if (baseCol < 0) return null;
    const colMax = Math.max(0, bill.demandBands.length - 1);
    const col = Math.max(
      0,
      Math.min(colMax, baseCol + (barrel.demandBandOffset ?? 0)),
    );
    return { row, col };
  })();
  return (
    <article
      className={[
        "relative flex flex-col gap-3 rounded-xl border-2 p-5 shadow-[0_12px_32px_rgba(0,0,0,.55)]",
        chrome.gradient,
        chrome.border,
      ].join(" ")}
    >
      <header className="flex items-baseline justify-between gap-3">
        <span className={`font-mono text-[11px] font-semibold uppercase tracking-[0.18em] ${chrome.label}`}>
          {ownerName ? `${ownerName}'s barrel` : "Barrel"} · {chrome.label_text}
        </span>
        <span
          className={
            isAging
              ? "rounded border border-amber-400/60 bg-amber-700/30 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[.10em] text-amber-200"
              : barrel.phase === "construction"
                ? "rounded border border-sky-400/60 bg-sky-700/30 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[.10em] text-sky-200"
                : "rounded border border-slate-500/70 bg-slate-700/40 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[.10em] text-slate-200"
          }
        >
          {isAging
            ? `Aging · ${barrel.age}y`
            : barrel.phase === "construction"
              ? "Building"
              : "Staged"}
        </span>
      </header>

      <div className="flex items-start gap-4">
        <div
          className={`grid h-20 w-20 flex-shrink-0 place-items-center rounded-full border-2 bg-white/10 text-2xl shadow-[inset_0_1px_4px_rgba(255,255,255,.18)] backdrop-blur-sm ${chrome.border} ${chrome.titleInk}`}
        >
          🛢
        </div>
        <div className="flex flex-col">
          <h3 className={`font-display text-2xl font-bold leading-tight drop-shadow-[0_1px_4px_rgba(0,0,0,.35)] ${chrome.titleInk}`}>
            {bill?.name ?? "In progress"}
          </h3>
          {bill?.slogan ? (
            <p className={`mt-1 font-display text-[12px] italic leading-snug ${chrome.label}`}>
              “{bill.slogan}”
            </p>
          ) : null}
          {!bill ? (
            <p className={`mt-1 font-display text-[12px] italic leading-snug ${chrome.label}`}>
              Attach a mash bill on a future commit to start the recipe.
            </p>
          ) : null}
        </div>
      </div>

      {/* Lifecycle facts */}
      <div className="grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-slate-950/55 p-3 font-mono text-[11px] uppercase tracking-[.10em] text-slate-400">
        <BarrelFact
          label="Phase"
          value={
            isAging
              ? "Aging"
              : barrel.phase === "construction"
                ? "Building"
                : "Staged"
          }
        />
        <BarrelFact label="Age" value={`${barrel.age} yr${barrel.age === 1 ? "" : "s"}`} />
        <BarrelFact label="Built in" value={`R${barrel.productionRound}`} />
        <BarrelFact
          label="Completed"
          value={barrel.completedInRound != null ? `R${barrel.completedInRound}` : "—"}
        />
        <BarrelFact label="Production cards" value={barrel.productionCards.length} />
        <BarrelFact label="Aging cards" value={barrel.agingCards.length} />
      </div>

      {/* Recipe progress — shows what's needed, what's committed, and
          what's still missing. Only meaningful before the barrel
          enters aging; once aging, the recipe is locked in and the
          reward grid below tells the value story instead. */}
      {!isAging ? <RecipeProgress barrel={barrel} /> : null}

      {/* Persistent modifiers (only render rows that actually fired). */}
      {barrel.gridRepOffset > 0 ||
      barrel.demandBandOffset > 0 ||
      barrel.extraAgesAvailable > 0 ||
      barrel.inspectedThisRound ||
      barrel.agedThisRound ? (
        <div className="rounded-lg border border-white/10 bg-slate-950/55 p-3">
          <span className="font-mono text-[10px] uppercase tracking-[.15em] text-slate-400">
            Modifiers
          </span>
          <ul className="mt-1 space-y-0.5 text-[12px] leading-snug text-slate-100">
            {barrel.gridRepOffset > 0 ? (
              <li>+{barrel.gridRepOffset} reputation per grid cell at sale (Single Barrel Cask)</li>
            ) : null}
            {barrel.demandBandOffset > 0 ? (
              <li>Reads grid as if demand were +{barrel.demandBandOffset} (Master Distiller)</li>
            ) : null}
            {barrel.extraAgesAvailable > 0 ? (
              <li>{barrel.extraAgesAvailable} bonus age this round (Rushed Shipment)</li>
            ) : null}
            {barrel.inspectedThisRound ? (
              <li className="text-rose-300">Cannot age this round (Regulatory Inspection)</li>
            ) : null}
            {barrel.agedThisRound ? <li>Already aged this round</li> : null}
          </ul>
        </div>
      ) : null}

      {/* Committed pile, by pile and subtype. */}
      <div className="rounded-lg border border-white/10 bg-slate-950/55 p-3">
        <span className="font-mono text-[10px] uppercase tracking-[.15em] text-slate-400">
          Committed pile
        </span>
        <div className="mt-2 grid gap-2">
          <CommittedRow label="Production" cards={barrel.productionCards} />
          <CommittedRow label="Aging" cards={barrel.agingCards} />
        </div>
      </div>

      {/* Reward grid — award cells light up in-grid; an inline legend
          beneath the matrix breaks down the threshold conditions. Same
          idiom as the Bourbon Wiki (`/wiki`). The live
          cell (current age × current demand) gets an emerald ring +
          "Now" badge so the inspector can read the barrel's payout at
          a glance — null when the barrel is too young / demand too
          cold for the grid to bind. */}
      {bill ? <RewardMatrix bill={bill} chrome={chrome} liveCell={liveCell} /> : null}
    </article>
  );
}

function BarrelFact({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-2 rounded bg-slate-950/40 px-2 py-1">
      <span>{label}</span>
      <span className="font-sans text-[12px] font-semibold normal-case tracking-normal tabular-nums text-slate-100">
        {value}
      </span>
    </div>
  );
}

const COMMITTED_PIP_COLOR: Record<string, string> = {
  cask: "bg-amber-400",
  corn: "bg-yellow-300",
  rye: "bg-red-400",
  barley: "bg-teal-300",
  wheat: "bg-cyan-300",
};

function CommittedRow({ label, cards }: { label: string; cards: Card[] }) {
  if (cards.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <span className="w-20 font-mono text-[10px] uppercase tracking-[.12em] text-slate-500">
          {label}
        </span>
        <span className="font-mono text-[11px] italic text-slate-600">none yet</span>
      </div>
    );
  }
  // Group by subtype for a tidy summary; render a small pip per card
  // and a count by subtype on the right so the player sees both
  // detail and totals at once.
  const counts = new Map<string, number>();
  for (const c of cards) {
    const key = c.type === "capital" ? "capital" : (c.subtype ?? "other");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 font-mono text-[10px] uppercase tracking-[.12em] text-slate-500">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-1">
        {cards.map((c) => {
          const palette =
            c.type === "resource" && c.subtype && COMMITTED_PIP_COLOR[c.subtype]
              ? COMMITTED_PIP_COLOR[c.subtype]
              : c.type === "capital"
                ? "bg-emerald-300"
                : "bg-slate-300";
          return (
            <span
              key={c.id}
              className={`h-2.5 w-2.5 rounded-full ${palette}`}
              title={c.displayName ?? c.subtype ?? c.cardDefId}
              aria-hidden
            />
          );
        })}
      </div>
      <span className="ml-auto flex flex-wrap items-baseline gap-1.5 font-mono text-[10px] uppercase tracking-[.10em] text-slate-400">
        {Array.from(counts.entries()).map(([k, n]) => (
          <span key={k}>
            {n}× {k}
          </span>
        ))}
      </span>
    </div>
  );
}
