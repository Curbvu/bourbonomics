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
import { useGameStore, type InspectPayload } from "@/lib/store/game";
import {
  CAPITAL_CHROME,
  OPS_CHROME,
  RESOURCE_CHROME,
  RESOURCE_GLYPH,
  RESOURCE_LABEL,
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
      <EffectBlurb effect={card.effect} />
      <div className="rounded-lg border border-white/10 bg-slate-950/55 p-3">
        <span className="font-mono text-[10px] uppercase tracking-[.15em] text-slate-400">
          Use
        </span>
        <p className="mt-1 text-[13px] leading-snug text-slate-100">
          Spend as part of a mash to make a barrel, or pay it as {formatMoney(1)} toward any market purchase.
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
        <MoneyText
          n={value}
          className={`font-display text-[64px] font-bold leading-none drop-shadow-[0_3px_8px_rgba(0,0,0,.45)] ${chrome.ink}`}
        />
        <span className={`font-mono text-[11px] uppercase tracking-[.18em] ${chrome.label}`}>
          spend at the market
        </span>
      </div>
      {card.flavor ? (
        <p className={`font-display text-[12px] italic leading-snug ${chrome.label} opacity-95`}>
          “{card.flavor}”
        </p>
      ) : null}
      <EffectBlurb effect={card.effect} />
      <div className="rounded-lg border border-white/10 bg-slate-950/55 p-3">
        <span className="font-mono text-[10px] uppercase tracking-[.15em] text-slate-400">
          Use
        </span>
        <p className="mt-1 text-[13px] leading-snug text-slate-100">
          Pays {formatMoney(value)} toward any market purchase. Goes to the discard
          pile after the action; reshuffles into your deck on cleanup.
        </p>
      </div>
    </article>
  );
}

/**
 * Human-readable description of any themed-card effect descriptor.
 * Walks composite trees so every leaf gets its own line. Returned as
 * a panel; renders nothing when there is no effect.
 */
function EffectBlurb({ effect }: { effect: CardEffect | undefined }) {
  if (!effect) return null;
  const lines = describeEffect(effect);
  if (lines.length === 0) return null;
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-700/[0.12] p-3">
      <span className="font-mono text-[10px] uppercase tracking-[.15em] text-amber-300">
        Effect
      </span>
      <ul className="mt-1 space-y-0.5 text-[12.5px] leading-snug text-amber-50">
        {lines.map((line, i) => (
          <li key={i}>• {line}</li>
        ))}
      </ul>
    </div>
  );
}

function describeEffect(effect: CardEffect): string[] {
  if (effect.kind === "composite") {
    return effect.effects.flatMap((e) => describeEffect(e));
  }
  switch (effect.kind) {
    case "draw_cards":
      return [
        `Draw ${effect.n} card${effect.n === 1 ? "" : "s"} ${whenLabel(effect.when)}.`,
      ];
    case "rep_on_sale_flat":
      return [`Gain +${effect.rep} reputation on sale.`];
    case "rep_on_sale_if_age_gte":
      return [
        `Gain +${effect.rep} reputation on sale if barrel age ≥ ${effect.age}.`,
      ];
    case "rep_on_sale_if_demand_gte":
      return [
        `Gain +${effect.rep} reputation on sale if demand ≥ ${effect.demand}.`,
      ];
    case "rep_on_commit_aging":
      return [`Gain +${effect.rep} reputation when used as an aging card.`];
    case "rep_on_market_spend":
      return [
        `Gain +${effect.rep} reputation each time this card pays a market purchase.`,
      ];
    case "bump_demand":
      return [
        `Demand ${effect.delta >= 0 ? "+" : ""}${effect.delta} when committed at production.`,
      ];
    case "skip_demand_drop":
      return ["Demand does not drop when this barrel sells."];
    case "barrel_starts_aged":
      return [
        `Barrel starts at age ${effect.age} when this is committed at production.`,
      ];
    case "aging_card_doubled":
      return [`Adds ${effect.years} years of aging instead of the usual 1.`];
    case "grid_demand_band_offset":
      return [
        `Sale grid reads ${effect.offset > 0 ? "+" : ""}${effect.offset} demand band${
          Math.abs(effect.offset) === 1 ? "" : "s"
        }.`,
      ];
    case "grid_rep_offset":
      return [
        `+${effect.offset} reputation at every grid band for the rest of the barrel's life.`,
      ];
    case "returns_to_hand_on_sale":
      return ["Returns to your hand when the barrel sells (instead of discard)."];
    default:
      return [];
  }
}

function whenLabel(when: string): string {
  switch (when) {
    case "on_commit_production":
      return "when committed at production";
    case "on_commit_aging":
      return "when used as an aging card";
    case "on_sale":
      return "on sale";
    case "on_spend":
      return "when spent at the market";
    default:
      return when;
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
 * each column covers, left column is the age band each row covers. The
 * raw `ageBands` / `demandBands` chips at the bottom are gone since the
 * same information is now legible from the matrix itself.
 */
function RewardMatrix({ bill, chrome }: { bill: MashBill; chrome: TierChrome }) {
  // v2.5: grids are variable size (commons 1×2 / 2×1, legendaries up
  // to 3×3 or wider). Iterate the actual band arrays rather than
  // assuming 3 rows × 3 columns.
  const ageLabels = bill.ageBands.map((_, i) => bandLabel(bill.ageBands, i, "y"));
  const demandLabels = bill.demandBands.map((_, i) => bandLabel(bill.demandBands, i));
  const cols = bill.demandBands.length;
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/55 p-3">
      <div
        className="grid items-center gap-x-2 gap-y-2"
        style={{ gridTemplateColumns: `auto repeat(${cols}, minmax(0, 1fr))` }}
      >
        {/* Header row: empty corner + demand band labels */}
        <div
          className={`flex items-center justify-end pr-1 font-mono text-[9px] uppercase tracking-[.18em] ${chrome.label} opacity-80`}
        >
          <span aria-hidden>↓ age · demand →</span>
        </div>
        {demandLabels.map((label, ci) => (
          <div
            key={`dh-${ci}`}
            className={`grid place-items-center font-mono text-[10px] font-semibold uppercase tracking-[.1em] tabular-nums ${chrome.label}`}
          >
            {label}
          </div>
        ))}

        {/* Body rows: age band label + 3 reward cells */}
        {bill.rewardGrid.map((row, ri) => (
          <Fragment key={`row-${ri}`}>
            <div
              className={`grid place-items-center pr-1 font-mono text-[10px] font-semibold uppercase tracking-[.1em] tabular-nums ${chrome.label} text-right`}
            >
              {ageLabels[ri]}
            </div>
            {row.map((cell, ci) => (
              <div
                key={`${ri}-${ci}`}
                className="grid place-items-center rounded border border-white/10 bg-slate-950/70 py-2"
              >
                <span
                  className={`font-display text-[18px] font-bold tabular-nums ${
                    cell == null ? "text-slate-600" : chrome.titleInk
                  }`}
                >
                  {cell == null ? "—" : cell}
                </span>
              </div>
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
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
}

/**
 * Decorative recipe display — renders the bill's grain composition as
 * colored chips with the same glyph + palette used everywhere else.
 * Always rendered (commons with no constraints show "any grain"); a
 * forbidden grain shows the chip with a struck-through ✕ overlay.
 */
function RecipeGrid({ bill }: { bill: MashBill }) {
  const r = bill.recipe ?? {};
  const items: RecipeChipSpec[] = [];

  // Universal: 1 cask
  items.push({
    glyph: RESOURCE_GLYPH.cask,
    label: "Cask",
    tint: RESOURCE_CHROME.cask.label,
  });

  // Universal: ≥1 corn (mins of 0 still imply 1 by the universal rule).
  const minCorn = Math.max(1, r.minCorn ?? 0);
  items.push({
    glyph: RESOURCE_GLYPH.corn,
    label: "Corn",
    count: minCorn,
    tint: RESOURCE_CHROME.corn.label,
  });

  if ((r.minRye ?? 0) > 0) {
    items.push({
      glyph: RESOURCE_GLYPH.rye,
      label: "Rye",
      count: r.minRye,
      tint: RESOURCE_CHROME.rye.label,
    });
  }
  if ((r.minBarley ?? 0) > 0) {
    items.push({
      glyph: RESOURCE_GLYPH.barley,
      label: "Barley",
      count: r.minBarley,
      tint: RESOURCE_CHROME.barley.label,
    });
  }
  if ((r.minWheat ?? 0) > 0) {
    items.push({
      glyph: RESOURCE_GLYPH.wheat,
      label: "Wheat",
      count: r.minWheat,
      tint: RESOURCE_CHROME.wheat.label,
    });
  }

  // Wild grain — when no specific grain is required, the universal
  // rule still demands ≥1 grain of any kind. Surface that explicitly
  // so commons don't feel under-specified.
  const namedGrain =
    (r.minRye ?? 0) + (r.minBarley ?? 0) + (r.minWheat ?? 0);
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
              "inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-slate-950/70 px-2 py-1 font-mono text-[11px] uppercase tracking-[.10em] shadow-[inset_0_1px_0_rgba(255,255,255,.06)]",
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
              className={item.wild ? "text-slate-300" : "text-slate-100"}
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

/**
 * Award badges — gold/silver ribbons that show the qualifying conditions
 * (age / demand / reward minimums) so the player knows when the bill
 * actually pays out the medal bonus.
 */
function AwardRow({
  tone,
  condition,
}: {
  tone: "gold" | "silver";
  condition: AwardCondition;
}) {
  const bits: string[] = [];
  if (condition.minAge != null) bits.push(`age ≥ ${condition.minAge}y`);
  if (condition.minDemand != null) bits.push(`demand ≥ ${condition.minDemand}`);
  if (condition.minReward != null) bits.push(`reward ≥ ${condition.minReward}`);
  const styles =
    tone === "gold"
      ? "border-amber-300/80 bg-gradient-to-b from-amber-300/25 via-amber-700/15 to-slate-950/80 text-amber-100 shadow-[0_0_18px_rgba(251,191,36,.18)]"
      : "border-slate-300/70 bg-gradient-to-b from-slate-300/20 via-slate-500/10 to-slate-950/80 text-slate-100";
  return (
    <div
      className={`flex items-center gap-2.5 rounded-lg border-2 px-3 py-1.5 ${styles}`}
    >
      <span className="text-[20px] leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,.5)]" aria-hidden>
        {tone === "gold" ? "🥇" : "🥈"}
      </span>
      <span className="font-mono text-[10px] font-bold uppercase tracking-[.22em]">
        {tone}
      </span>
      <span className="opacity-50" aria-hidden>·</span>
      <span className="text-[11.5px] tabular-nums">
        {bits.length ? bits.join(" · ") : "any qualifying sale"}
      </span>
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
  const hasAwards = bill.goldAward != null || bill.silverAward != null;
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

      <DetailCornerCost cost={1} />

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

      {hasAwards ? (
        <>
          <SectionHeading label="Awards" tone={chrome.label} />
          <div className="flex flex-col gap-1.5">
            {bill.goldAward ? (
              <AwardRow tone="gold" condition={bill.goldAward} />
            ) : null}
            {bill.silverAward ? (
              <AwardRow tone="silver" condition={bill.silverAward} />
            ) : null}
          </div>
        </>
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

/**
 * Barrel inspect view — shows everything that's "live state" on a
 * barrel: the attached mash bill (if any) with its full reward grid,
 * the current age + phase + completion-round, every committed card
 * (production pile + aging pile, with the cards rendered by their
 * subtype palette), and any persistent barrel modifiers (Single
 * Barrel Cask grid offset, Master Distiller demand offset, Rushed
 * Shipment extra ages).
 */
function BarrelDetail({ barrel, ownerName }: { barrel: Barrel; ownerName?: string }) {
  const bill = barrel.attachedMashBill;
  const tier = tierOrCommon(bill?.tier);
  const chrome = TIER_CHROME[tier];
  const isAging = barrel.phase === "aging";
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
              : "rounded border border-sky-400/60 bg-sky-700/30 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[.10em] text-sky-200"
          }
        >
          {isAging ? `Aging · ${barrel.age}y` : "Building"}
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
        <BarrelFact label="Phase" value={isAging ? "Aging" : "Construction"} />
        <BarrelFact label="Age" value={`${barrel.age} yr${barrel.age === 1 ? "" : "s"}`} />
        <BarrelFact label="Built in" value={`R${barrel.productionRound}`} />
        <BarrelFact
          label="Completed"
          value={barrel.completedInRound != null ? `R${barrel.completedInRound}` : "—"}
        />
        <BarrelFact label="Production cards" value={barrel.productionCards.length} />
        <BarrelFact label="Aging cards" value={barrel.agingCards.length} />
      </div>

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

      {/* Reward grid — full lookup table for the attached bill. */}
      {bill ? <RewardMatrix bill={bill} chrome={chrome} /> : null}
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
