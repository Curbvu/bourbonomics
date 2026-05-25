"use client";

/**
 * Bourbon Wiki — read-only browser of every catalog the engine ships.
 *
 * Three tabs:
 *   - **Cards**         the mash-bill catalog (recipes, payoff grids,
 *                       awards, rarity tiers).
 *   - **Distilleries**  the v2.10 4-distillery roster (starting state,
 *                       permanent ability, constraint, difficulty).
 *   - **Investments**   the investment catalog (display-only today;
 *                       most cards are `implemented: false`).
 *
 * Everything reads from the engine's `defaultMashBillCatalog()`,
 * `defaultDistilleryPool()`, and `defaultInvestmentCatalog()` so this
 * view never drifts from what the game actually ships.
 *
 * Pure reference material — no game state mutation.
 */

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";

import {
  defaultDistilleryPool,
  defaultInvestmentCatalog,
  defaultMashBillCatalog,
  mashBillBuildCost,
  type Distillery,
  type DistilleryDifficulty,
  type InvestmentCard,
  type InvestmentTier,
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

type WikiTab = "cards" | "distilleries" | "investments";

export default function WikiPage() {
  const [tab, setTab] = useState<WikiTab>("cards");

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
            Bourbon Wiki
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Reference for every catalog the engine ships — mash bills, distilleries, investments. Click a card to expand.
          </p>
        </header>

        <nav
          className="mb-6 inline-flex rounded-lg border border-slate-700 bg-slate-900/60 p-1"
          aria-label="Wiki sections"
        >
          <TabButton active={tab === "cards"} onClick={() => setTab("cards")}>
            Cards
          </TabButton>
          <TabButton active={tab === "distilleries"} onClick={() => setTab("distilleries")}>
            Distilleries
          </TabButton>
          <TabButton active={tab === "investments"} onClick={() => setTab("investments")}>
            Investments
          </TabButton>
        </nav>

        {tab === "cards" ? <CardsPanel /> : null}
        {tab === "distilleries" ? <DistilleriesPanel /> : null}
        {tab === "investments" ? <InvestmentsPanel /> : null}
      </div>
    </main>
  );
}

function TabButton({
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
      aria-pressed={active}
      className={[
        "rounded-md px-4 py-1.5 font-mono text-[13px] font-bold uppercase tracking-[.14em] transition-colors",
        active
          ? "bg-amber-500/20 text-amber-100 shadow-[inset_0_0_0_1px_rgba(252,211,77,.5)]"
          : "text-slate-400 hover:text-slate-200",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

// ============================================================
// CARDS PANEL — mash bill catalog (former /mash-bills page)
// ============================================================

const RARITIES: MashBillTier[] = ["common", "uncommon", "rare", "epic", "legendary"];
type RarityFilter = "all" | MashBillTier;

function CardsPanel() {
  const catalog = useMemo(() => defaultMashBillCatalog(), []);
  const [filter, setFilter] = useState<RarityFilter>("all");
  const [selectedDefId, setSelectedDefId] = useState<string | null>(null);

  const visible =
    filter === "all" ? catalog : catalog.filter((b) => tierOrCommon(b.tier) === filter);
  const selected = selectedDefId ? catalog.find((b) => b.defId === selectedDefId) ?? null : null;

  return (
    <>
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
        <BillDetailPanel bill={selected} onBack={() => setSelectedDefId(null)} />
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
    </>
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
    <article
      className={[
        "flex flex-col rounded-xl border-2 px-4 py-4 shadow-[0_4px_16px_rgba(0,0,0,.35)] transition-shadow",
        chrome.border,
        chrome.gradient,
        chrome.glow,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className={`font-display text-xl font-bold leading-tight ${chrome.titleInk}`}>
            {bill.name}
          </h2>
          {bill.slogan ? (
            <p className="mt-1 font-display text-[13px] italic leading-snug text-slate-400">
              “{bill.slogan}”
            </p>
          ) : null}
        </div>
        <span
          className={`flex-shrink-0 rounded-md border-2 px-2.5 py-1 font-mono text-[13px] font-bold uppercase tracking-[.10em] ${chrome.pill}`}
          title={`Rarity: ${chrome.label_text}`}
        >
          {chrome.label_text}
        </span>
      </header>

      <div className="my-4">
        <PayoffMatrix bill={bill} />
      </div>

      <SectionLabel>Recipe</SectionLabel>
      <RecipeChips bill={bill} />

      <footer className="mt-4 flex items-center justify-between border-t border-slate-700/60 pt-2.5 font-mono text-[13px] uppercase tracking-[.12em] text-slate-400">
        <span
          className="flex items-center gap-1.5"
          title="Implicit build cost: 1 per basic resource + 2 per specialty + 1 card paid into the Drafting Loop"
        >
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
      <article
        className={[
          "rounded-xl border-2 px-7 py-6 shadow-[0_8px_24px_rgba(0,0,0,.45)]",
          chrome.border,
          chrome.gradient,
          chrome.glow,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className={`font-display text-4xl font-bold leading-tight ${chrome.titleInk}`}>
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
              <span
                className="flex items-center gap-2"
                title="Implicit build cost: 1 per basic resource + 2 per specialty (cheaper of the two specialty bands) + 1 card paid into the Drafting Loop"
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
    <h3 className="mb-1.5 font-mono text-[13px] font-semibold uppercase tracking-[.15em] text-slate-400">
      {children}
    </h3>
  );
}

function PayoffMatrix({ bill, large = false }: { bill: MashBill; large?: boolean }) {
  const cellPad = large ? "h-16" : "h-12";
  const cellText = large ? "text-[26px]" : "text-[20px]";
  const headerText = large ? "text-[12px]" : "text-[13px]";
  const cornerText = large ? "text-[12px]" : "text-[12px]";

  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-950/65 p-2.5">
      <div
        className="grid items-stretch gap-1"
        style={{ gridTemplateColumns: `auto repeat(${bill.demandBands.length}, minmax(0, 1fr))` }}
      >
        <div
          className={`flex items-center justify-end pr-1 font-mono ${cornerText} font-semibold uppercase leading-tight tracking-[.10em] text-slate-500`}
        >
          <span className="text-right">
            age ↓<br />demand →
          </span>
        </div>
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
                        className="pointer-events-none absolute right-0.5 top-0.5 text-[13px] leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,.55)]"
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
      {bill.silverAward || bill.goldAward ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 font-mono text-[12px] uppercase tracking-[.12em] text-slate-400">
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
  specialty?: boolean;
}

function buildRecipeChips(bill: MashBill): RecipeChip[] {
  const r = bill.recipe ?? {};
  const sp = r.minSpecialty ?? {};
  const minCask = 1;
  const minCorn = Math.max(1, r.minCorn ?? 0);
  const minRye = r.minRye ?? 0;
  const minBarley = r.minBarley ?? 0;
  const minWheat = r.minWheat ?? 0;
  const namedGrain = minRye + minBarley + minWheat;
  const minTotalGrain = Math.max(r.minTotalGrain ?? 0, namedGrain === 0 ? 1 : namedGrain);
  const wildGrain = Math.max(0, minTotalGrain - namedGrain);

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
        <span className="font-mono text-[13px] text-rose-300">✕</span>
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

// ============================================================
// DISTILLERIES PANEL — v2.10 4-distillery roster
// ============================================================

const DIFFICULTIES: DistilleryDifficulty[] = [
  "beginner",
  "intermediate",
  "intermediate-advanced",
  "advanced",
];
type DifficultyFilter = "all" | DistilleryDifficulty;

function DistilleriesPanel() {
  const pool = useMemo(() => defaultDistilleryPool(), []);
  const [filter, setFilter] = useState<DifficultyFilter>("all");
  const [selectedDefId, setSelectedDefId] = useState<string | null>(null);

  const visible =
    filter === "all" ? pool : pool.filter((d) => d.difficulty === filter);
  const selected = selectedDefId ? pool.find((d) => d.defId === selectedDefId) ?? null : null;

  return (
    <>
      <nav className="mb-6 flex flex-wrap items-center gap-2">
        <FilterPill active={filter === "all"} onClick={() => setFilter("all")}>
          All ({pool.length})
        </FilterPill>
        {DIFFICULTIES.map((diff) => {
          const count = pool.filter((d) => d.difficulty === diff).length;
          if (count === 0) return null;
          return (
            <button
              key={diff}
              type="button"
              onClick={() => setFilter(diff)}
              className={[
                "rounded-full border-2 px-3 py-1 font-mono text-xs uppercase tracking-[.10em] transition-colors",
                filter === diff
                  ? "border-amber-400 bg-amber-500/20 text-amber-100"
                  : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500 hover:text-slate-200",
              ].join(" ")}
            >
              {diff.replace("-", " · ")} ({count})
            </button>
          );
        })}
      </nav>

      {selected ? (
        <DistilleryDetailPanel def={selected} onBack={() => setSelectedDefId(null)} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((def) => (
            <button
              key={def.defId}
              type="button"
              onClick={() => setSelectedDefId(def.defId)}
              className="text-left transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <DistilleryCard def={def} />
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function DistilleryCard({ def }: { def: Distillery }) {
  return (
    <article className="flex h-full flex-col rounded-xl border-2 border-amber-700 bg-gradient-to-b from-amber-700/30 via-amber-900/40 to-slate-950 p-5 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
      <header className="flex items-baseline justify-between">
        <span className="font-mono text-[12px] font-semibold uppercase tracking-[.18em] text-amber-300">
          Distillery · {def.difficulty.replace("-", " · ")}
        </span>
      </header>
      <h3 className="mt-3 font-display text-2xl font-semibold leading-tight text-amber-100">
        {def.name}
      </h3>
      {def.flavorText ? (
        <p className="mt-1 font-display text-[13px] italic leading-snug text-amber-200/85">
          {def.flavorText}
        </p>
      ) : null}
      <div className="mt-4 flex flex-col gap-2 text-[12px] leading-snug">
        <div>
          <div className="font-mono text-[12px] font-semibold uppercase tracking-[.16em] text-emerald-300">
            Card text
          </div>
          <p className="mt-1 line-clamp-5 text-emerald-100/95">{def.cardText}</p>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <div className="font-mono text-[12px] font-semibold uppercase tracking-[.16em] text-sky-300">
              Slots
            </div>
            <div className="text-sky-100/95">
              {def.slots}
              {def.maxSlots != null && def.maxSlots === def.slots ? " (capped)" : ""}
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[12px] font-semibold uppercase tracking-[.16em] text-fuchsia-300">
              Axis
            </div>
            <div className="text-fuchsia-100/95">{def.axis}</div>
          </div>
        </div>
      </div>
    </article>
  );
}

function DistilleryDetailPanel({
  def,
  onBack,
}: {
  def: Distillery;
  onBack: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-4 font-mono text-xs text-amber-400 hover:text-amber-300"
      >
        ← back to distillery roster
      </button>
      <article className="rounded-xl border-2 border-amber-700 bg-gradient-to-b from-amber-700/30 via-amber-900/40 to-slate-950 px-7 py-6 shadow-[0_8px_24px_rgba(0,0,0,.45)]">
        <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <span className="font-mono text-[12px] font-semibold uppercase tracking-[.18em] text-amber-300">
              Distillery · {def.difficulty.replace("-", " · ")}
            </span>
            <h2 className="mt-2 font-display text-4xl font-bold leading-tight text-amber-100">
              {def.name}
            </h2>
            {def.flavorText ? (
              <p className="mt-2 font-display text-base italic text-amber-200/85">
                {def.flavorText}
              </p>
            ) : null}
          </div>
        </header>

        <section className="grid gap-5 md:grid-cols-2">
          <div className="space-y-4">
            <div>
              <SectionLabel>Card text</SectionLabel>
              <p className="text-[14px] leading-relaxed text-emerald-100/95">{def.cardText}</p>
            </div>
            {def.description ? (
              <div>
                <SectionLabel>Flavor</SectionLabel>
                <p className="text-[14px] leading-relaxed text-slate-300">{def.description}</p>
              </div>
            ) : null}
          </div>
          <div className="space-y-4">
            {def.strategyNote ? (
              <div>
                <SectionLabel>Strategy note</SectionLabel>
                <p className="text-[14px] leading-relaxed text-amber-100/90">{def.strategyNote}</p>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-3 border-t border-slate-700/60 pt-3">
              <Stat label="Slots" value={`${def.slots}${def.maxSlots === def.slots ? " (capped)" : ""}`} accent="sky" />
              <Stat label="Max slotted bills" value={def.maxSlottedBills != null ? String(def.maxSlottedBills) : "—"} accent="emerald" />
              <Stat label="Starting bills (draft)" value={String(def.mashBillDraftSize ?? 3)} accent="amber" />
              <Stat label="Axis" value={def.axis} accent="fuchsia" />
            </div>
          </div>
        </section>
      </article>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "sky" | "emerald" | "amber" | "fuchsia";
}) {
  const ink: Record<typeof accent, string> = {
    sky: "text-sky-300",
    emerald: "text-emerald-300",
    amber: "text-amber-300",
    fuchsia: "text-fuchsia-300",
  };
  return (
    <div>
      <div className={`font-mono text-[12px] font-semibold uppercase tracking-[.16em] ${ink[accent]}`}>
        {label}
      </div>
      <div className="text-slate-100">{value}</div>
    </div>
  );
}

// ============================================================
// INVESTMENTS PANEL — display-only investment catalog
// ============================================================

const TIERS: InvestmentTier[] = ["small", "medium", "large"];
type TierFilter = "all" | InvestmentTier;

function InvestmentsPanel() {
  const catalog = useMemo(() => defaultInvestmentCatalog(), []);
  const [filter, setFilter] = useState<TierFilter>("all");
  const [selectedDefId, setSelectedDefId] = useState<string | null>(null);

  const visible = filter === "all" ? catalog : catalog.filter((c) => c.tier === filter);
  const selected = selectedDefId ? catalog.find((c) => c.defId === selectedDefId) ?? null : null;

  const anyImplemented = catalog.some((c) => c.implemented);

  return (
    <>
      <nav className="mb-6 flex flex-wrap items-center gap-2">
        <FilterPill active={filter === "all"} onClick={() => setFilter("all")}>
          All ({catalog.length})
        </FilterPill>
        {TIERS.map((tier) => {
          const count = catalog.filter((c) => c.tier === tier).length;
          if (count === 0) return null;
          return (
            <button
              key={tier}
              type="button"
              onClick={() => setFilter(tier)}
              className={[
                "rounded-full border-2 px-3 py-1 font-mono text-xs uppercase tracking-[.10em] transition-colors",
                filter === tier
                  ? "border-amber-400 bg-amber-500/20 text-amber-100"
                  : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500 hover:text-slate-200",
              ].join(" ")}
            >
              {tier} ({count})
            </button>
          );
        })}
      </nav>

      {!anyImplemented ? (
        <p className="mb-4 rounded-md border border-amber-700/60 bg-amber-900/20 px-3 py-2 font-mono text-[13px] uppercase tracking-[.12em] text-amber-300">
          Preview · investment effects are not resolved by the engine yet
        </p>
      ) : null}

      {selected ? (
        <InvestmentDetailPanel card={selected} onBack={() => setSelectedDefId(null)} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((card) => (
            <button
              key={card.defId}
              type="button"
              onClick={() => setSelectedDefId(card.defId)}
              className="text-left transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <InvestmentCardTile card={card} />
            </button>
          ))}
        </div>
      )}
    </>
  );
}

const INVESTMENT_TONE: Record<InvestmentTier, { border: string; gradient: string; ink: string; label: string }> = {
  small: {
    border: "border-emerald-400",
    gradient:
      "bg-[radial-gradient(110%_70%_at_50%_-10%,rgba(16,185,129,.18),transparent_55%),linear-gradient(180deg,rgba(6,78,59,.40)_0%,rgba(15,23,42,.95)_75%)]",
    ink: "text-emerald-50",
    label: "text-emerald-300",
  },
  medium: {
    border: "border-teal-400",
    gradient:
      "bg-[radial-gradient(110%_70%_at_50%_-10%,rgba(20,184,166,.20),transparent_55%),linear-gradient(180deg,rgba(15,118,110,.45)_0%,rgba(15,23,42,.95)_75%)]",
    ink: "text-teal-50",
    label: "text-teal-300",
  },
  large: {
    border: "border-amber-400",
    gradient:
      "bg-[radial-gradient(110%_70%_at_50%_-10%,rgba(251,191,36,.22),transparent_55%),linear-gradient(180deg,rgba(146,64,14,.45)_0%,rgba(15,23,42,.95)_75%)]",
    ink: "text-amber-50",
    label: "text-amber-300",
  },
};

function InvestmentCardTile({ card }: { card: InvestmentCard }) {
  const chrome = INVESTMENT_TONE[card.tier];
  return (
    <article
      className={[
        "flex h-full flex-col rounded-xl border-2 px-4 py-4 shadow-[0_4px_16px_rgba(0,0,0,.35)]",
        chrome.gradient,
        chrome.border,
      ].join(" ")}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span className={`font-mono text-[12px] font-semibold uppercase tracking-[.16em] ${chrome.label}`}>
            Invest · {card.tier}
          </span>
          <h3 className={`mt-1 font-display text-xl font-bold leading-tight ${chrome.ink}`}>
            {card.name}
          </h3>
          <p className={`mt-1 font-display text-[12px] italic leading-snug ${chrome.label} opacity-90`}>
            {card.short}
          </p>
        </div>
        <span
          className={`flex-shrink-0 rounded-md border-2 px-2.5 py-1 font-display text-base font-bold ${chrome.border} bg-slate-950/70 ${chrome.ink}`}
          title="Cost to buy from the market"
        >
          <MoneyText n={card.cost} />
        </span>
      </header>

      <p className="mt-3 line-clamp-4 text-[13px] leading-relaxed text-slate-300">
        {card.text}
      </p>

      <footer className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-700/60 pt-3 font-mono text-[12px] uppercase tracking-[.12em] text-slate-400">
        <span>
          <span className="text-slate-500">cat:</span>{" "}
          <span className="text-slate-200">{card.category}</span>
        </span>
        <span>
          <span className="text-slate-500">axis:</span>{" "}
          <span className="text-slate-200">{card.archetype}</span>
        </span>
        {!card.implemented ? (
          <span className="ml-auto rounded border border-amber-500/60 px-1.5 py-0.5 text-[12px] text-amber-300">
            preview
          </span>
        ) : null}
      </footer>
    </article>
  );
}

function InvestmentDetailPanel({
  card,
  onBack,
}: {
  card: InvestmentCard;
  onBack: () => void;
}) {
  const chrome = INVESTMENT_TONE[card.tier];
  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-4 font-mono text-xs text-amber-400 hover:text-amber-300"
      >
        ← back to investments
      </button>
      <article
        className={[
          "rounded-xl border-2 px-7 py-6 shadow-[0_8px_24px_rgba(0,0,0,.45)]",
          chrome.gradient,
          chrome.border,
        ].join(" ")}
      >
        <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <span className={`font-mono text-[12px] font-semibold uppercase tracking-[.16em] ${chrome.label}`}>
              Invest · {card.tier}
            </span>
            <h2 className={`mt-2 font-display text-4xl font-bold leading-tight ${chrome.ink}`}>
              {card.name}
            </h2>
            <p className={`mt-2 font-display text-base italic ${chrome.label} opacity-90`}>
              {card.short}
            </p>
          </div>
          <span
            className={`flex-shrink-0 rounded-md border-2 px-3 py-1.5 font-display text-xl font-bold ${chrome.border} bg-slate-950/70 ${chrome.ink}`}
          >
            <MoneyText n={card.cost} />
          </span>
        </header>

        <section className="grid gap-5 md:grid-cols-2">
          <div className="space-y-4">
            <div>
              <SectionLabel>Effect</SectionLabel>
              <p className="text-[14px] leading-relaxed text-slate-200">{card.text}</p>
            </div>
            {card.description ? (
              <div>
                <SectionLabel>Flavor</SectionLabel>
                <p className="text-[14px] leading-relaxed text-slate-400">{card.description}</p>
              </div>
            ) : null}
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 border-t border-slate-700/60 pt-3">
              <Stat label="Cost" value={`B$${card.cost}`} accent="amber" />
              <Stat label="Tier" value={card.tier} accent="emerald" />
              <Stat label="Category" value={card.category} accent="sky" />
              <Stat label="Archetype" value={card.archetype} accent="fuchsia" />
              <Stat
                label="Triggers"
                value={card.triggers.join(", ")}
                accent="emerald"
              />
              <Stat
                label="Rate limit"
                value={card.rateLimited ? card.rateLimitScope ?? "yes" : "—"}
                accent="sky"
              />
            </div>
            {!card.implemented ? (
              <p className="rounded-md border border-amber-500/60 bg-amber-900/20 px-3 py-2 font-mono text-[13px] uppercase tracking-[.12em] text-amber-300">
                Preview · this card's effect is not yet resolved by the engine
              </p>
            ) : null}
          </div>
        </section>
      </article>
    </div>
  );
}
