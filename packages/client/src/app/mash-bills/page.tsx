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
import { useMemo, useState } from "react";

import {
  defaultMashBillCatalog,
  mashBillCost,
  type MashBill,
} from "@bourbonomics/engine";
import { TIER_CHROME, tierOrCommon } from "@/app/play/components/tierStyles";

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
        "h-full rounded-lg border-2 px-3 py-3",
        chrome.border,
        chrome.gradient,
        chrome.glow,
      ].join(" ")}
    >
      <header className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h2 className={`font-display text-base font-semibold ${chrome.titleInk}`}>
            {bill.name}
          </h2>
          {bill.slogan ? (
            <p className={`mt-0.5 font-mono text-[10.5px] italic ${chrome.label}`}>
              {bill.slogan}
            </p>
          ) : null}
        </div>
        <span
          className={`rounded border px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-[.08em] ${ctChrome.pill}`}
          title={ctChrome.name}
        >
          T{ct}
        </span>
      </header>

      <PayoffGrid bill={bill} />

      <dl className="mt-2 space-y-0.5 font-mono text-[10.5px] text-slate-300">
        <RecipeLine bill={bill} />
        <AwardsLine bill={bill} />
        <div className="text-slate-500">
          cost: <span className="text-slate-300">{mashBillCost(bill)}¢</span>
          {" · "}
          rarity: <span className="text-slate-300">{tierOrCommon(bill.tier)}</span>
        </div>
      </dl>
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
          "rounded-lg border-2 px-6 py-5",
          chrome.border,
          chrome.gradient,
          chrome.glow,
        ].join(" ")}
      >
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className={`font-display text-3xl font-bold ${chrome.titleInk}`}>
              {bill.name}
            </h2>
            {bill.slogan ? (
              <p className={`mt-1 font-mono text-xs italic ${chrome.label}`}>
                {bill.slogan}
              </p>
            ) : null}
            {bill.flavorText ? (
              <p className="mt-2 max-w-2xl text-sm text-slate-300">{bill.flavorText}</p>
            ) : null}
          </div>
          <span
            className={`rounded border px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-[.08em] ${ctChrome.pill}`}
          >
            {ctChrome.name}
          </span>
        </header>

        <section className="mb-4 grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[.12em] text-slate-400">
              Payoff grid (rep by age × demand)
            </h3>
            <PayoffGrid bill={bill} large />
          </div>
          <div className="space-y-3 font-mono text-[12px] text-slate-200">
            <div>
              <h3 className="mb-1 font-mono text-[10px] uppercase tracking-[.12em] text-slate-400">
                Recipe
              </h3>
              <RecipeLine bill={bill} verbose />
            </div>
            <div>
              <h3 className="mb-1 font-mono text-[10px] uppercase tracking-[.12em] text-slate-400">
                Awards
              </h3>
              <AwardsLine bill={bill} verbose />
            </div>
            <div className="text-slate-400">
              Cost to draw: <span className="text-slate-200">{mashBillCost(bill)}¢</span>
              {" · "}
              Rarity: <span className="text-slate-200">{tierOrCommon(bill.tier)}</span>
            </div>
          </div>
        </section>

        <section className="rounded-md border border-slate-700/60 bg-slate-950/50 px-4 py-3 text-sm text-slate-300">
          <h3 className="mb-1 font-mono text-[10px] uppercase tracking-[.12em] text-amber-300">
            About {ctChrome.name.split(" · ")[0]}
          </h3>
          <p>{ctChrome.blurb}</p>
        </section>
      </article>
    </div>
  );
}

function PayoffGrid({ bill, large = false }: { bill: MashBill; large?: boolean }) {
  const headerCellSize = large ? "px-2 py-1 text-[11px]" : "px-1 py-0.5 text-[9.5px]";
  const dataCellSize = large ? "px-2 py-1 text-[12px]" : "px-1 py-0.5 text-[10.5px]";
  return (
    <div className="overflow-x-auto rounded border border-slate-700/60 bg-slate-950/40">
      <table className="w-full border-collapse font-mono text-slate-200">
        <thead>
          <tr>
            <th
              className={`${headerCellSize} border border-slate-800 text-left uppercase tracking-[.08em] text-slate-500`}
            >
              age \ d
            </th>
            {bill.demandBands.map((d, i) => {
              const next = bill.demandBands[i + 1];
              return (
                <th
                  key={i}
                  className={`${headerCellSize} border border-slate-800 text-center uppercase tracking-[.08em] text-slate-400`}
                >
                  {next != null ? `${d}-${next - 1}` : `${d}+`}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {bill.ageBands.map((age, ri) => {
            const nextAge = bill.ageBands[ri + 1];
            return (
              <tr key={ri}>
                <th
                  className={`${headerCellSize} border border-slate-800 text-left uppercase tracking-[.08em] text-slate-400`}
                >
                  {nextAge != null ? `${age}-${nextAge - 1}` : `${age}+`}
                </th>
                {bill.rewardGrid[ri]!.map((cell, ci) => (
                  <td
                    key={ci}
                    className={`${dataCellSize} border border-slate-800 text-center font-semibold ${cell == null ? "text-slate-600" : "text-amber-200"}`}
                  >
                    {cell ?? "—"}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RecipeLine({ bill, verbose = false }: { bill: MashBill; verbose?: boolean }) {
  const r = bill.recipe ?? {};
  const bits: string[] = [];
  if (r.minCorn && r.minCorn > 1) bits.push(`≥${r.minCorn} corn`);
  if (r.minRye) bits.push(`≥${r.minRye} rye`);
  if (r.minBarley) bits.push(`≥${r.minBarley} barley`);
  if (r.minWheat) bits.push(`≥${r.minWheat} wheat`);
  if (r.maxRye === 0) bits.push("no rye");
  else if (r.maxRye != null) bits.push(`≤${r.maxRye} rye`);
  if (r.maxWheat === 0) bits.push("no wheat");
  else if (r.maxWheat != null) bits.push(`≤${r.maxWheat} wheat`);
  if (r.minTotalGrain) bits.push(`grain ≥${r.minTotalGrain}`);
  if (bits.length === 0) {
    return verbose ? (
      <p className="text-slate-300">Universal rule only — 1 cask, ≥1 corn, ≥1 grain.</p>
    ) : (
      <div>recipe: <span className="text-slate-200">universal rule</span></div>
    );
  }
  if (verbose) {
    return (
      <ul className="ml-4 list-disc space-y-0.5 text-slate-200">
        <li>1 cask, ≥1 corn, ≥1 grain (universal)</li>
        {bits.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
    );
  }
  return (
    <div>
      recipe: <span className="text-slate-200">{bits.join(" · ")}</span>
    </div>
  );
}

function AwardsLine({ bill, verbose = false }: { bill: MashBill; verbose?: boolean }) {
  const parts: string[] = [];
  if (bill.silverAward) {
    const cond = condText(bill.silverAward);
    parts.push(`Silver${cond ? ` (${cond})` : ""}`);
  }
  if (bill.goldAward) {
    const cond = condText(bill.goldAward);
    parts.push(`Gold${cond ? ` (${cond})` : ""}`);
  }
  if (parts.length === 0) {
    return verbose ? (
      <p className="text-slate-400">No awards.</p>
    ) : (
      <div className="text-slate-500">awards: —</div>
    );
  }
  if (verbose) {
    return (
      <ul className="ml-4 list-disc space-y-0.5 text-slate-200">
        {parts.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    );
  }
  return (
    <div>
      awards: <span className="text-slate-200">{parts.join(" · ")}</span>
    </div>
  );
}

function condText(c: { minAge?: number; minDemand?: number; minReward?: number }): string {
  const bits: string[] = [];
  if (c.minAge != null) bits.push(`age ≥${c.minAge}`);
  if (c.minDemand != null) bits.push(`demand ≥${c.minDemand}`);
  if (c.minReward != null) bits.push(`reward ≥${c.minReward}`);
  return bits.join(", ");
}
