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
  mashBillBuildCost,
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

      {/* Recipe — always rendered as a clear list of chips */}
      <SectionLabel>Recipe</SectionLabel>
      <RecipeChips bill={bill} />

      {/* Cost footer — `cost` is the bill's market draw price; `build`
          is the tuning aid: implicit total resource investment to make
          one barrel of this bill (basic = 1, specialty = 4, plus the
          draw cost). Larger build = more "expensive" recipe. */}
      <footer className="mt-4 flex items-center justify-between border-t border-slate-700/60 pt-2.5 font-mono text-[11px] uppercase tracking-[.12em] text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="text-slate-500">cost</span>
          <MoneyText n={mashBillCost(bill)} className="font-display text-[15px] font-bold text-amber-200" />
        </span>
        <span className="flex items-center gap-1.5" title="Implicit build cost: 1 per basic resource + 4 per specialty + draw cost">
          <span className="text-slate-500">build</span>
          <span className="font-display text-[15px] font-bold tabular-nums text-emerald-200">
            {mashBillBuildCost(bill)}
          </span>
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
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-700/60 pt-3 font-mono text-[12px] uppercase tracking-[.12em] text-slate-400">
              <span className="flex items-center gap-2">
                <span className="text-slate-500">cost to draw</span>
                <MoneyText n={mashBillCost(bill)} className="font-display text-lg font-bold text-amber-200" />
              </span>
              <span
                className="flex items-center gap-2"
                title="Implicit build cost: 1 per basic resource + 4 per specialty (3 market + 1 sale bonus) + draw cost"
              >
                <span className="text-slate-500">build cost</span>
                <span className="font-display text-lg font-bold tabular-nums text-emerald-200">
                  {mashBillBuildCost(bill)}
                </span>
              </span>
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
 * Payoff matrix — neutral cells with the **award** as the visual
 * accent. Cells that can trigger Silver get a slate gradient; Gold
 * cells get a bright amber gradient + glow + 🥇 corner badge. A
 * cell qualifies when *some* combination of (age, demand) within
 * the band satisfies the award's `minAge`/`minDemand`, and the
 * cell's reward satisfies `minReward`. Gold takes precedence.
 *
 * v2.7.2 dropped the per-cell heat tint — it competed with the
 * award marker and read as in-game amber chrome.
 */
function PayoffMatrix({ bill, large = false }: { bill: MashBill; large?: boolean }) {
  const cellPad = large ? "h-16" : "h-12";
  const cellText = large ? "text-[26px]" : "text-[20px]";
  const headerText = large ? "text-[12px]" : "text-[11px]";
  const cornerText = large ? "text-[10px]" : "text-[9px]";

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
          const ageLo = bill.ageBands[ri]!;
          const ageHi = nextAge ?? Infinity;
          const ageLabel = nextAge != null ? `${ageLo}–${nextAge - 1}y` : `${ageLo}+y`;
          return (
            <Fragment key={`r-${ri}`}>
              <div
                className={`grid place-items-center rounded-sm bg-slate-900/60 px-2 font-mono ${headerText} font-bold uppercase tracking-[.10em] text-slate-300`}
              >
                {ageLabel}
              </div>
              {row.map((cell, ci) => {
                const nextDemand = bill.demandBands[ci + 1];
                const demandLo = bill.demandBands[ci]!;
                const demandHi = nextDemand ?? Infinity;
                const award = cellAward(bill, cell, ageHi, demandHi);
                return (
                  <div
                    key={`${ri}-${ci}`}
                    className={[
                      "relative grid place-items-center rounded-md border border-white/10",
                      cellPad,
                      awardCellBg(award, cell),
                    ].join(" ")}
                    title={`age ${ageLabel} × demand ${
                      nextDemand != null ? `${demandLo}–${nextDemand - 1}` : `${demandLo}+`
                    } → ${cell ?? "—"} rep${
                      award ? ` · ${award === "gold" ? "Gold" : "Silver"} eligible` : ""
                    }`}
                  >
                    <span
                      className={[
                        "font-display font-bold leading-none tabular-nums drop-shadow-[0_2px_4px_rgba(0,0,0,.5)]",
                        cellText,
                        cell == null
                          ? "text-slate-600"
                          : award === "gold"
                            ? "text-slate-950"
                            : award === "silver"
                              ? "text-slate-950"
                              : "text-white",
                      ].join(" ")}
                    >
                      {cell ?? "—"}
                    </span>
                    {award ? (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute right-0.5 top-0.5 text-[11px] leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,.55)]"
                      >
                        {award === "gold" ? "🥇" : "🥈"}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </Fragment>
          );
        })}
      </div>
      {/* Award legend — only when the bill actually has awards. */}
      {bill.silverAward || bill.goldAward ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 font-mono text-[10px] uppercase tracking-[.12em] text-slate-400">
          {bill.silverAward ? (
            <span className="flex items-center gap-1.5">
              <span className="text-[12px]">🥈</span>
              <span>Silver · {condText(bill.silverAward)}</span>
            </span>
          ) : null}
          {bill.goldAward ? (
            <span className="flex items-center gap-1.5">
              <span className="text-[12px]">🥇</span>
              <span>Gold · {condText(bill.goldAward)}</span>
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Cell background — neutral by default, gold/silver gradient when the
 * cell can trigger an award. v2.7.2 dropped the reward-heat tint
 * (it competed with the award marker) so the matrix reads as plain
 * cells with conspicuous medal cells punching out.
 */
function awardCellBg(award: "gold" | "silver" | null, cell: number | null): string {
  if (cell == null) return "bg-slate-900/40";
  if (award === "gold") {
    return "bg-gradient-to-b from-amber-300 to-amber-500 shadow-[0_0_10px_rgba(252,211,77,.4)]";
  }
  if (award === "silver") {
    return "bg-gradient-to-b from-slate-300 to-slate-400";
  }
  return "bg-slate-900/55";
}

/**
 * Returns "gold", "silver", or null based on whether the cell's
 * (age band, demand band, reward) can trigger an award. Gold wins
 * if both fire. A cell qualifies when *some* combination of (age,
 * demand) within the band satisfies the award's mins.
 */
function cellAward(
  bill: MashBill,
  reward: number | null,
  ageHi: number,
  demandHi: number,
): "gold" | "silver" | null {
  if (reward == null) return null;
  const fires = (
    cond: { minAge?: number; minDemand?: number; minReward?: number } | undefined,
  ): boolean => {
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

interface RecipeChip {
  key: string;
  count?: number;
  label: string;
  subtype: ResourceSubtype | null;
  forbidden?: boolean;
  /** v2.7.2: this chip requires a Specialty / Double Specialty card. */
  specialty?: boolean;
}

/**
 * Build the full recipe as a list of chips — including the universal
 * 1 cask + 1 corn + 1 grain so every bill renders the same shape.
 * Recipe overrides (minCorn ≥ 2, minRye, etc.) replace or extend the
 * universal mins as appropriate.
 */
function buildRecipeChips(bill: MashBill): RecipeChip[] {
  const r = bill.recipe ?? {};
  // v2.8: a Specialty card satisfies both the universal/per-subtype
  // minimum AND the `minSpecialty` floor — one card, two boxes ticked.
  // To keep the chip row truthful about how many cards the player
  // actually has to commit, the regular chip count is reduced by the
  // specialty count for that subtype.
  const sp = r.minSpecialty ?? {};
  const minCask = 1; // universal
  const minCorn = Math.max(1, r.minCorn ?? 0);
  const minRye = r.minRye ?? 0;
  const minBarley = r.minBarley ?? 0;
  const minWheat = r.minWheat ?? 0;
  const namedGrain = minRye + minBarley + minWheat;
  const minTotalGrain = Math.max(r.minTotalGrain ?? 0, namedGrain === 0 ? 1 : namedGrain);
  const wildGrain = Math.max(0, minTotalGrain - namedGrain);

  // Plain count = (universal/recipe min) − (specialty count for that subtype).
  const plainCask = Math.max(0, minCask - (sp.cask ?? 0));
  const plainCorn = Math.max(0, minCorn - (sp.corn ?? 0));
  const plainRye = Math.max(0, minRye - (sp.rye ?? 0));
  const plainBarley = Math.max(0, minBarley - (sp.barley ?? 0));
  const plainWheat = Math.max(0, minWheat - (sp.wheat ?? 0));

  const chips: RecipeChip[] = [];
  if (plainCask > 0) chips.push({ key: "cask", count: plainCask, label: "Cask", subtype: "cask" });
  if (plainCorn > 0) chips.push({ key: "corn", count: plainCorn, label: "Corn", subtype: "corn" });
  if (plainRye > 0) chips.push({ key: "rye", count: plainRye, label: "Rye", subtype: "rye" });
  if (plainBarley > 0) chips.push({ key: "barley", count: plainBarley, label: "Barley", subtype: "barley" });
  if (plainWheat > 0) chips.push({ key: "wheat", count: plainWheat, label: "Wheat", subtype: "wheat" });
  if (wildGrain > 0) chips.push({ key: "grain", count: wildGrain, label: "Any grain", subtype: null });
  // v2.7.2: per-subtype Specialty requirements rendered as their own
  // gold-bordered chips so the player sees "this needs a market-only
  // premium" at a glance.
  const subs: ResourceSubtype[] = ["cask", "corn", "rye", "barley", "wheat"];
  for (const s of subs) {
    const n = sp[s];
    if (n && n > 0) {
      chips.push({
        key: `sp-${s}`,
        count: n,
        label: `Specialty ${s.charAt(0).toUpperCase() + s.slice(1)}`,
        subtype: s,
        specialty: true,
      });
    }
  }
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
  if (chip.specialty) {
    // v2.7.2: Specialty requirements wear an amber/gold border + a
    // ★ marker so they read as "luxury upgrade" instead of plain
    // grain. Subtype colour still bleeds through via the tinted
    // gradient + ink so rye/wheat/cask remain distinguishable.
    return (
      <span
        className={[
          "inline-flex items-center gap-1.5 rounded-md border-2 border-amber-300 bg-amber-700/35 px-2.5 py-1 font-display text-[15px] font-bold shadow-[0_0_8px_rgba(252,211,77,.25)]",
          chrome.ink,
        ].join(" ")}
        title={chip.label}
      >
        <span className="grid h-5 w-5 place-items-center rounded-full bg-white/15 text-[12px]">
          {RESOURCE_GLYPH[chip.subtype]}
        </span>
        <span className="font-display text-[18px] tabular-nums">{chip.count ?? 1}</span>
        <span className="font-mono text-[10.5px] font-bold uppercase tracking-[.10em] text-amber-100">
          ★ Specialty {RESOURCE_LABEL[chip.subtype]}
        </span>
      </span>
    );
  }
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

function condText(c: { minAge?: number; minDemand?: number; minReward?: number }): string {
  const bits: string[] = [];
  if (c.minAge != null) bits.push(`age ${c.minAge}+`);
  if (c.minDemand != null) bits.push(`demand ${c.minDemand}+`);
  if (c.minReward != null) bits.push(`reward ${c.minReward}+`);
  return bits.join(" · ");
}
