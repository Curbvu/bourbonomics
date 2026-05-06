"use client";

/**
 * Mash Bills gallery — read-only browser of the bourbon catalog.
 *
 * Reads from the engine's `defaultMashBillCatalog()` so this view never
 * drifts from in-game bills. Click a card to open the detail panel
 * (recipe constraints, payoff grid, awards, tier explanation).
 *
 * Pure reference material — no game state mutation.
 */

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";

import {
  defaultMashBillCatalog,
  mashBillCost,
  type MashBill,
  type ResourceSubtype,
} from "@bourbonomics/engine";
import { TIER_CHROME, tierOrCommon, type TierChrome } from "@/app/play/components/tierStyles";
import { MoneyText } from "@/app/play/components/money";
import {
  RESOURCE_CHROME,
  RESOURCE_GLYPH,
  RESOURCE_LABEL,
} from "@/app/play/components/handCardStyles";

type TierFilter = "all" | 1 | 2 | 3;

const COMPLEXITY_TIER_INK: Record<1 | 2 | 3, { pill: string; name: string; blurb: string }> = {
  1: {
    pill: "border-slate-400 bg-slate-700/40 text-slate-100",
    name: "Tier 1 · Starter",
    blurb:
      "Universal rule only or one easy constraint. Forgiving payouts, low age thresholds — the bills you reach for first.",
  },
  2: {
    pill: "border-amber-300 bg-amber-700/40 text-amber-50",
    name: "Tier 2 · Mid",
    blurb:
      "One real constraint. Wider payoff range; best payouts at age 4+. Demand bands matter — most Silver awards live here.",
  },
  3: {
    pill: "border-rose-300 bg-rose-700/40 text-rose-50",
    name: "Tier 3 · Specialty",
    blurb:
      "Multi-constraint or sharply skewed demand. Best payouts gated behind age 6+. Where the Gold awards live — and where mistimed bills bleed cards.",
  },
};

export default function MashBillsPage() {
  const catalog = useMemo(() => defaultMashBillCatalog(), []);
  const [filter, setFilter] = useState<TierFilter>("all");
  const [selectedDefId, setSelectedDefId] = useState<string | null>(null);

  const visible = filter === "all" ? catalog : catalog.filter((b) => b.complexityTier === filter);
  const selected = selectedDefId ? catalog.find((b) => b.defId === selectedDefId) ?? null : null;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <Link
          href="/"
          className="font-mono text-xs text-amber-400 hover:text-amber-300"
        >
          ← back to menu
        </Link>
        <header className="mt-4 mb-6">
          <h1 className="font-display text-4xl font-bold tracking-tight text-amber-400">
            Bourbon Cards
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Every mash bill in the bourbon supply, sorted by difficulty tier.
            Reference only — no game state changes here.
          </p>
        </header>

        <nav className="mb-6 flex flex-wrap items-center gap-2">
          <FilterPill active={filter === "all"} onClick={() => setFilter("all")}>
            All ({catalog.length})
          </FilterPill>
          {[1, 2, 3].map((t) => {
            const count = catalog.filter((b) => b.complexityTier === t).length;
            return (
              <FilterPill
                key={t}
                active={filter === t}
                onClick={() => setFilter(t as TierFilter)}
              >
                Tier {t} ({count})
              </FilterPill>
            );
          })}
        </nav>

        {selected ? (
          <BillDetailPanel
            bill={selected}
            onBack={() => setSelectedDefId(null)}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((bill) => (
              <button
                key={bill.defId}
                type="button"
                onClick={() => setSelectedDefId(bill.defId)}
                className="text-left transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <BillCard bill={bill} />
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full border px-3 py-1 font-mono text-xs uppercase tracking-[.08em] transition-colors",
        active
          ? "border-amber-400 bg-amber-500/20 text-amber-100"
          : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500 hover:text-slate-200",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function BillCard({ bill }: { bill: MashBill }) {
  const chrome = TIER_CHROME[tierOrCommon(bill.tier)];
  const ct = bill.complexityTier ?? 1;
  const ctChrome = COMPLEXITY_TIER_INK[ct];
  return (
    <article
      className={[
        "relative flex h-full flex-col rounded-xl border-2 px-4 py-4 shadow-[0_8px_24px_rgba(0,0,0,.45)]",
        chrome.border,
        chrome.gradient,
        chrome.glow,
      ].join(" ")}
    >
      {/* Top row — title + tier pill */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className={`font-display text-xl font-bold leading-tight ${chrome.titleInk}`}>
            {bill.name}
          </h2>
          {bill.slogan ? (
            <p className={`mt-1 font-display text-[13px] italic leading-snug ${chrome.label}`}>
              “{bill.slogan}”
            </p>
          ) : null}
        </div>
        <span
          className={`flex-shrink-0 rounded-md border-2 px-2.5 py-1 font-mono text-[12px] font-bold uppercase tracking-[.10em] ${ctChrome.pill}`}
          title={ctChrome.name}
        >
          T{ct}
        </span>
      </header>

      {/* Payoff matrix anchored at the visual center */}
      <div className="my-4">
        <PayoffMatrix bill={bill} chrome={chrome} />
      </div>

      {/* Recipe chips */}
      <div className="mt-auto">
        <SectionLabel chrome={chrome}>Recipe</SectionLabel>
        <RecipeChips bill={bill} chrome={chrome} />
      </div>

      {/* Awards */}
      <div className="mt-3">
        <SectionLabel chrome={chrome}>Awards</SectionLabel>
        <AwardsRow bill={bill} />
      </div>

      {/* Cost footer */}
      <footer className="mt-3 flex items-center justify-between border-t border-white/10 pt-2.5 font-mono text-[11px] uppercase tracking-[.12em] text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="text-slate-500">cost</span>
          <MoneyText n={mashBillCost(bill)} className={`font-display text-[15px] font-bold ${chrome.titleInk}`} />
        </span>
        <span>{tierOrCommon(bill.tier)}</span>
      </footer>
    </article>
  );
}

function BillDetailPanel({ bill, onBack }: { bill: MashBill; onBack: () => void }) {
  const chrome = TIER_CHROME[tierOrCommon(bill.tier)];
  const ct = bill.complexityTier ?? 1;
  const ctChrome = COMPLEXITY_TIER_INK[ct];
  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-4 font-mono text-xs text-amber-400 hover:text-amber-300"
      >
        ← back to gallery
      </button>
      <article
        className={[
          "rounded-xl border-2 px-7 py-6 shadow-[0_12px_32px_rgba(0,0,0,.55)]",
          chrome.border,
          chrome.gradient,
          chrome.glow,
        ].join(" ")}
      >
        <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className={`font-display text-4xl font-bold leading-tight ${chrome.titleInk}`}>
              {bill.name}
            </h2>
            {bill.slogan ? (
              <p className={`mt-2 font-display text-base italic ${chrome.label}`}>
                “{bill.slogan}”
              </p>
            ) : null}
            {bill.flavorText ? (
              <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-slate-200">{bill.flavorText}</p>
            ) : null}
          </div>
          <span
            className={`flex-shrink-0 rounded-md border-2 px-3 py-1.5 font-mono text-[13px] font-bold uppercase tracking-[.10em] ${ctChrome.pill}`}
          >
            {ctChrome.name}
          </span>
        </header>

        <section className="mb-5 grid gap-5 md:grid-cols-2">
          <div>
            <SectionLabel chrome={chrome}>Reward — reputation by age × demand</SectionLabel>
            <PayoffMatrix bill={bill} chrome={chrome} large />
          </div>
          <div className="space-y-4">
            <div>
              <SectionLabel chrome={chrome}>Recipe</SectionLabel>
              <RecipeChips bill={bill} chrome={chrome} verbose />
            </div>
            <div>
              <SectionLabel chrome={chrome}>Awards</SectionLabel>
              <AwardsRow bill={bill} verbose />
            </div>
            <div className="flex items-center gap-4 border-t border-white/10 pt-3 font-mono text-[12px] uppercase tracking-[.12em] text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="text-slate-500">cost to draw</span>
                <MoneyText n={mashBillCost(bill)} className={`font-display text-lg font-bold ${chrome.titleInk}`} />
              </span>
              <span>{tierOrCommon(bill.tier)}</span>
            </div>
          </div>
        </section>

        <section className="rounded-md border border-slate-700/60 bg-slate-950/50 px-5 py-3.5 text-[14px] leading-relaxed text-slate-300">
          <h3 className="mb-1 font-mono text-[11px] font-semibold uppercase tracking-[.15em] text-amber-300">
            About {ctChrome.name.split(" · ")[0]}
          </h3>
          <p>{ctChrome.blurb}</p>
        </section>
      </article>
    </div>
  );
}

function SectionLabel({ chrome, children }: { chrome: TierChrome; children: React.ReactNode }) {
  return (
    <h3 className={`mb-1.5 font-mono text-[11px] font-semibold uppercase tracking-[.15em] ${chrome.label}`}>
      {children}
    </h3>
  );
}

/**
 * Payoff matrix — reward cells coloured on a heat scale (low / mid /
 * high) so the player can read where the bill peaks at a glance,
 * rather than chasing tabular numbers across rows. Axis legends sit
 * on the outside of the grid; the corner cell carries an "AGE / DEMAND"
 * note so the matrix is self-documenting.
 */
function PayoffMatrix({
  bill,
  chrome,
  large = false,
}: {
  bill: MashBill;
  chrome: TierChrome;
  large?: boolean;
}) {
  const cellPad = large ? "h-14" : "h-11";
  const cellText = large ? "text-[24px]" : "text-[19px]";
  const headerText = large ? "text-[12px]" : "text-[11px]";
  const cornerText = large ? "text-[10px]" : "text-[9px]";
  const peak = bill.rewardGrid.flat().reduce<number>(
    (m, c) => (c != null && c > m ? c : m),
    1,
  );

  return (
    <div
      className="rounded-lg border border-white/15 bg-slate-950/65 p-2.5"
    >
      <div
        className="grid items-stretch gap-1"
        style={{ gridTemplateColumns: `auto repeat(${bill.demandBands.length}, minmax(0, 1fr))` }}
      >
        {/* Corner — axis legend */}
        <div
          className={`flex items-center justify-end pr-1 font-mono ${cornerText} font-semibold uppercase leading-tight tracking-[.10em] ${chrome.label} opacity-70`}
        >
          <span className="text-right">
            age ↓<br />demand →
          </span>
        </div>
        {/* Header row — demand bands */}
        {bill.demandBands.map((d, i) => {
          const next = bill.demandBands[i + 1];
          const label = next != null ? `${d}–${next - 1}` : `${d}+`;
          return (
            <div
              key={`d-${i}`}
              className={`grid place-items-center rounded-sm bg-slate-900/60 py-1 font-mono ${headerText} font-bold uppercase tracking-[.10em] ${chrome.label}`}
            >
              {label}
            </div>
          );
        })}

        {/* Body rows */}
        {bill.rewardGrid.map((row, ri) => {
          const nextAge = bill.ageBands[ri + 1];
          const ageLabel = nextAge != null ? `${bill.ageBands[ri]}–${nextAge - 1}y` : `${bill.ageBands[ri]}+y`;
          return (
            <Fragment key={`r-${ri}`}>
              <div
                className={`grid place-items-center rounded-sm bg-slate-900/60 px-2 font-mono ${headerText} font-bold uppercase tracking-[.10em] ${chrome.label}`}
              >
                {ageLabel}
              </div>
              {row.map((cell, ci) => (
                <div
                  key={`${ri}-${ci}`}
                  className={[
                    "grid place-items-center rounded-md border border-white/10",
                    cellPad,
                    rewardHeatBg(cell, peak),
                  ].join(" ")}
                  title={`age ${ageLabel} × demand ${
                    bill.demandBands[ci]
                  } → ${cell ?? "—"} rep`}
                >
                  <span
                    className={[
                      "font-display font-bold leading-none tabular-nums drop-shadow-[0_2px_4px_rgba(0,0,0,.5)]",
                      cellText,
                      cell == null ? "text-slate-600" : "text-white",
                    ].join(" ")}
                  >
                    {cell ?? "—"}
                  </span>
                </div>
              ))}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

/** Heat-scale background for a reward cell, scaled vs the bill's peak. */
function rewardHeatBg(cell: number | null, peak: number): string {
  if (cell == null) return "bg-slate-900/40";
  const ratio = cell / Math.max(1, peak);
  if (ratio >= 0.85) return "bg-amber-500/55 ring-1 ring-amber-300/60";
  if (ratio >= 0.6) return "bg-amber-700/45 ring-1 ring-amber-400/40";
  if (ratio >= 0.35) return "bg-amber-900/40";
  return "bg-slate-900/55";
}

interface RecipeChip {
  key: string;
  /** Display number (e.g. "1", "2") — omitted for the universal "any grain" or for forbidden chips. */
  count?: number;
  label: string;
  /** Resource subtype for chrome lookup; null for forbidden chips with their own styling. */
  subtype: ResourceSubtype | null;
  forbidden?: boolean;
}

function buildRecipeChips(bill: MashBill, includeUniversal: boolean): RecipeChip[] {
  const r = bill.recipe ?? {};
  const chips: RecipeChip[] = [];
  if (includeUniversal) {
    chips.push({ key: "u-cask", count: 1, label: "Cask", subtype: "cask" });
    chips.push({ key: "u-corn", count: r.minCorn ?? 1, label: "Corn", subtype: "corn" });
  } else if (r.minCorn && r.minCorn > 1) {
    chips.push({ key: "corn", count: r.minCorn, label: "Corn", subtype: "corn" });
  }
  if (r.minRye) chips.push({ key: "rye", count: r.minRye, label: "Rye", subtype: "rye" });
  if (r.minBarley) chips.push({ key: "barley", count: r.minBarley, label: "Barley", subtype: "barley" });
  if (r.minWheat) chips.push({ key: "wheat", count: r.minWheat, label: "Wheat", subtype: "wheat" });
  if (r.minTotalGrain) {
    const named = (r.minRye ?? 0) + (r.minBarley ?? 0) + (r.minWheat ?? 0);
    const wild = Math.max(0, r.minTotalGrain - named);
    if (wild > 0) chips.push({ key: "grain", count: wild, label: "Any grain", subtype: null });
  }
  if (r.maxRye === 0) chips.push({ key: "no-rye", label: "No rye", subtype: "rye", forbidden: true });
  else if (r.maxRye != null) chips.push({ key: "max-rye", count: r.maxRye, label: `max rye`, subtype: "rye" });
  if (r.maxWheat === 0) chips.push({ key: "no-wheat", label: "No wheat", subtype: "wheat", forbidden: true });
  else if (r.maxWheat != null) chips.push({ key: "max-wheat", count: r.maxWheat, label: `max wheat`, subtype: "wheat" });
  return chips;
}

function RecipeChips({
  bill,
  chrome,
  verbose = false,
}: {
  bill: MashBill;
  chrome: TierChrome;
  verbose?: boolean;
}) {
  const chips = buildRecipeChips(bill, verbose);
  if (chips.length === 0) {
    return (
      <p className={`font-mono text-[12px] uppercase tracking-[.10em] ${chrome.label}`}>
        Universal rule only · 1 cask · 1 corn · 1 grain
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <RecipeChipPill key={c.key} chip={c} />
      ))}
    </div>
  );
}

function RecipeChipPill({ chip }: { chip: RecipeChip }) {
  if (chip.forbidden) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-md border border-rose-400/60 bg-rose-900/30 px-2.5 py-1 font-display text-[14px] font-semibold text-rose-100"
        title={chip.label}
      >
        <span className="font-mono text-[11px] text-rose-300">✕</span>
        <span>{chip.label}</span>
      </span>
    );
  }
  if (chip.subtype == null) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border-2 border-slate-500 bg-slate-800/70 px-2.5 py-1 font-display text-[15px] font-bold text-slate-100">
        <span className="font-display text-[18px] tabular-nums">{chip.count ?? 1}</span>
        <span className="font-mono text-[10.5px] uppercase tracking-[.10em] text-slate-300">
          {chip.label}
        </span>
      </span>
    );
  }
  const chrome = RESOURCE_CHROME[chip.subtype];
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-md border-2 px-2.5 py-1 font-display text-[15px] font-bold",
        chrome.border,
        chrome.gradient,
        chrome.ink,
      ].join(" ")}
    >
      <span className="grid h-5 w-5 place-items-center rounded-full bg-white/15 text-[12px]">
        {RESOURCE_GLYPH[chip.subtype]}
      </span>
      <span className="font-display text-[18px] tabular-nums">{chip.count ?? 1}</span>
      <span className={`font-mono text-[10.5px] uppercase tracking-[.10em] ${chrome.label}`}>
        {RESOURCE_LABEL[chip.subtype]}
      </span>
    </span>
  );
}

function AwardsRow({ bill, verbose = false }: { bill: MashBill; verbose?: boolean }) {
  const items: { kind: "silver" | "gold"; cond: string }[] = [];
  if (bill.silverAward) items.push({ kind: "silver", cond: condText(bill.silverAward) });
  if (bill.goldAward) items.push({ kind: "gold", cond: condText(bill.goldAward) });
  if (items.length === 0) {
    return (
      <p className="font-mono text-[12px] uppercase tracking-[.10em] text-slate-500">
        None
      </p>
    );
  }
  return (
    <div className={verbose ? "flex flex-col gap-1.5" : "flex flex-wrap gap-1.5"}>
      {items.map((i) => (
        <span
          key={i.kind}
          className={[
            "inline-flex items-center gap-1.5 rounded-md border-2 px-2.5 py-1 font-display text-[14px] font-bold",
            i.kind === "gold"
              ? "border-amber-300 bg-gradient-to-b from-amber-300 to-amber-600 text-slate-950"
              : "border-slate-300 bg-gradient-to-b from-slate-300 to-slate-500 text-slate-950",
          ].join(" ")}
        >
          <span className="font-mono text-[11px] uppercase tracking-[.10em]">
            {i.kind === "gold" ? "🥇 Gold" : "🥈 Silver"}
          </span>
          {i.cond ? (
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[.06em] opacity-80">
              {i.cond}
            </span>
          ) : null}
        </span>
      ))}
    </div>
  );
}

function condText(c: { minAge?: number; minDemand?: number; minReward?: number }): string {
  const bits: string[] = [];
  if (c.minAge != null) bits.push(`age ${c.minAge}+`);
  if (c.minDemand != null) bits.push(`demand ${c.minDemand}+`);
  if (c.minReward != null) bits.push(`reward ${c.minReward}+`);
  return bits.join(" · ");
}
