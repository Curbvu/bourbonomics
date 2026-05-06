"use client";

/**
 * Mash Bills gallery — read-only browser of the bourbon catalog.
 *
 * Reads from the engine's `defaultMashBillCatalog()` so this view never
 * drifts from in-game bills. Click a card to open the detail panel
 * (recipe constraints, payoff grid, awards).
 *
 * Pure reference material — no game state mutation.
 */

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";

import {
  defaultMashBillCatalog,
  mashBillCost,
  type MashBill,
  type MashBillTier,
  type ResourceSubtype,
} from "@bourbonomics/engine";
import { TIER_CHROME, tierOrCommon } from "@/app/play/components/tierStyles";
import { MoneyText } from "@/app/play/components/money";
import {
  RESOURCE_CHROME,
  RESOURCE_GLYPH,
  RESOURCE_LABEL,
} from "@/app/play/components/handCardStyles";

const RARITIES: MashBillTier[] = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
];

type RarityFilter = "all" | MashBillTier;

export default function MashBillsPage() {
  const catalog = useMemo(() => defaultMashBillCatalog(), []);
  const [filter, setFilter] = useState<RarityFilter>("all");
  const [selectedDefId, setSelectedDefId] = useState<string | null>(null);

  const visible =
    filter === "all"
      ? catalog
      : catalog.filter((b) => tierOrCommon(b.tier) === filter);
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
            Every mash bill in the bourbon supply. Reference only — no game state changes here.
          </p>
        </header>

        <nav className="mb-6 flex flex-wrap items-center gap-2">
          <FilterPill active={filter === "all"} onClick={() => setFilter("all")}>
            All ({catalog.length})
          </FilterPill>
          {RARITIES.map((rarity) => {
            const count = catalog.filter((b) => tierOrCommon(b.tier) === rarity).length;
            if (count === 0) return null;
            return (
              <FilterPill
                key={rarity}
                active={filter === rarity}
                onClick={() => setFilter(rarity)}
                rarity={rarity}
              >
                {TIER_CHROME[rarity].label_text} ({count})
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
  rarity,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  rarity?: MashBillTier;
}) {
  const chrome = rarity ? TIER_CHROME[rarity] : null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full border-2 px-3 py-1 font-mono text-xs uppercase tracking-[.10em] transition-colors",
        active
          ? chrome
            ? `${chrome.pill}`
            : "border-amber-400 bg-amber-500/20 text-amber-100"
          : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500 hover:text-slate-200",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function BillCard({ bill }: { bill: MashBill }) {
  const rarity = tierOrCommon(bill.tier);
  const chrome = TIER_CHROME[rarity];
  return (
    <article className="flex flex-col rounded-xl border-2 border-slate-700 bg-slate-900/60 px-4 py-4 shadow-[0_4px_16px_rgba(0,0,0,.35)]">
      {/* Title row + rarity badge */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-bold leading-tight text-slate-100">
            {bill.name}
          </h2>
          {bill.slogan ? (
            <p className="mt-1 font-display text-[13px] italic leading-snug text-slate-400">
              “{bill.slogan}”
            </p>
          ) : null}
        </div>
        <span
          className={`flex-shrink-0 rounded-md border-2 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[.10em] ${chrome.pill}`}
          title={`Rarity: ${chrome.label_text}`}
        >
          {chrome.label_text}
        </span>
      </header>

      {/* Reward matrix */}
      <div className="my-4">
        <PayoffMatrix bill={bill} />
      </div>

      {/* Recipe — always rendered as a clear vertical list of chips */}
      <SectionLabel>Recipe</SectionLabel>
      <RecipeChips bill={bill} />

      {/* Awards — only when the bill has any */}
      {bill.silverAward || bill.goldAward ? (
        <div className="mt-3">
          <SectionLabel>Awards</SectionLabel>
          <AwardsRow bill={bill} />
        </div>
      ) : null}

      {/* Cost footer */}
      <footer className="mt-4 flex items-center justify-between border-t border-slate-700/60 pt-2.5 font-mono text-[11px] uppercase tracking-[.12em] text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="text-slate-500">cost</span>
          <MoneyText n={mashBillCost(bill)} className="font-display text-[15px] font-bold text-amber-200" />
        </span>
      </footer>
    </article>
  );
}

function BillDetailPanel({ bill, onBack }: { bill: MashBill; onBack: () => void }) {
  const rarity = tierOrCommon(bill.tier);
  const chrome = TIER_CHROME[rarity];
  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-4 font-mono text-xs text-amber-400 hover:text-amber-300"
      >
        ← back to gallery
      </button>
      <article className="rounded-xl border-2 border-slate-700 bg-slate-900/60 px-7 py-6 shadow-[0_8px_24px_rgba(0,0,0,.45)]">
        <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-4xl font-bold leading-tight text-slate-100">
              {bill.name}
            </h2>
            {bill.slogan ? (
              <p className="mt-2 font-display text-base italic text-slate-400">
                “{bill.slogan}”
              </p>
            ) : null}
            {bill.flavorText ? (
              <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-slate-300">{bill.flavorText}</p>
            ) : null}
          </div>
          <span
            className={`flex-shrink-0 rounded-md border-2 px-3 py-1.5 font-mono text-[13px] font-bold uppercase tracking-[.10em] ${chrome.pill}`}
          >
            {chrome.label_text}
          </span>
        </header>

        <section className="grid gap-5 md:grid-cols-2">
          <div>
            <SectionLabel>Reward — reputation by age × demand</SectionLabel>
            <PayoffMatrix bill={bill} large />
          </div>
          <div className="space-y-4">
            <div>
              <SectionLabel>Recipe</SectionLabel>
              <RecipeChips bill={bill} />
            </div>
            {bill.silverAward || bill.goldAward ? (
              <div>
                <SectionLabel>Awards</SectionLabel>
                <AwardsRow bill={bill} verbose />
              </div>
            ) : null}
            <div className="flex items-center gap-3 border-t border-slate-700/60 pt-3 font-mono text-[12px] uppercase tracking-[.12em] text-slate-400">
              <span className="text-slate-500">cost to draw</span>
              <MoneyText n={mashBillCost(bill)} className="font-display text-lg font-bold text-amber-200" />
            </div>
          </div>
        </section>
      </article>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-1.5 font-mono text-[11px] font-semibold uppercase tracking-[.15em] text-slate-400">
      {children}
    </h3>
  );
}

/**
 * Payoff matrix — reward cells coloured on a heat scale (low / mid /
 * high) so the player can read where the bill peaks at a glance.
 */
function PayoffMatrix({ bill, large = false }: { bill: MashBill; large?: boolean }) {
  const cellPad = large ? "h-14" : "h-11";
  const cellText = large ? "text-[24px]" : "text-[19px]";
  const headerText = large ? "text-[12px]" : "text-[11px]";
  const cornerText = large ? "text-[10px]" : "text-[9px]";
  const peak = bill.rewardGrid.flat().reduce<number>(
    (m, c) => (c != null && c > m ? c : m),
    1,
  );

  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-950/65 p-2.5">
      <div
        className="grid items-stretch gap-1"
        style={{ gridTemplateColumns: `auto repeat(${bill.demandBands.length}, minmax(0, 1fr))` }}
      >
        {/* Corner — axis legend */}
        <div
          className={`flex items-center justify-end pr-1 font-mono ${cornerText} font-semibold uppercase leading-tight tracking-[.10em] text-slate-500`}
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
              className={`grid place-items-center rounded-sm bg-slate-900/60 py-1 font-mono ${headerText} font-bold uppercase tracking-[.10em] text-slate-300`}
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
                className={`grid place-items-center rounded-sm bg-slate-900/60 px-2 font-mono ${headerText} font-bold uppercase tracking-[.10em] text-slate-300`}
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
  count?: number;
  label: string;
  subtype: ResourceSubtype | null;
  forbidden?: boolean;
}

/**
 * Build the full recipe as a list of chips — including the universal
 * 1 cask + 1 corn + 1 grain so every bill renders the same shape.
 * Recipe overrides (minCorn ≥ 2, minRye, etc.) replace or extend the
 * universal mins as appropriate.
 */
function buildRecipeChips(bill: MashBill): RecipeChip[] {
  const r = bill.recipe ?? {};
  const minCorn = Math.max(1, r.minCorn ?? 0);
  const minRye = r.minRye ?? 0;
  const minBarley = r.minBarley ?? 0;
  const minWheat = r.minWheat ?? 0;
  const namedGrain = minRye + minBarley + minWheat;
  const minTotalGrain = Math.max(r.minTotalGrain ?? 0, namedGrain === 0 ? 1 : namedGrain);
  const wildGrain = Math.max(0, minTotalGrain - namedGrain);

  const chips: RecipeChip[] = [];
  chips.push({ key: "cask", count: 1, label: "Cask", subtype: "cask" });
  chips.push({ key: "corn", count: minCorn, label: "Corn", subtype: "corn" });
  if (minRye) chips.push({ key: "rye", count: minRye, label: "Rye", subtype: "rye" });
  if (minBarley) chips.push({ key: "barley", count: minBarley, label: "Barley", subtype: "barley" });
  if (minWheat) chips.push({ key: "wheat", count: minWheat, label: "Wheat", subtype: "wheat" });
  if (wildGrain > 0) chips.push({ key: "grain", count: wildGrain, label: "Any grain", subtype: null });
  if (r.maxRye === 0) chips.push({ key: "no-rye", label: "No rye", subtype: "rye", forbidden: true });
  else if (r.maxRye != null) chips.push({ key: "max-rye", count: r.maxRye, label: "max rye", subtype: "rye" });
  if (r.maxWheat === 0) chips.push({ key: "no-wheat", label: "No wheat", subtype: "wheat", forbidden: true });
  else if (r.maxWheat != null) chips.push({ key: "max-wheat", count: r.maxWheat, label: "max wheat", subtype: "wheat" });
  return chips;
}

function RecipeChips({ bill }: { bill: MashBill }) {
  const chips = buildRecipeChips(bill);
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
