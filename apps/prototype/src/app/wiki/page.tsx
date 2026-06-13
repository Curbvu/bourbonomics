"use client";

/**
 * Bourbon Wiki — read-only browser of the catalogs the engine ships. Three
 * tabs: Mash Bills (recipes + payoff peak), Distilleries (departments +
 * signatures), and Demand (the round's market cards). Everything reads from
 * the engine builders so this view never drifts from what the game ships.
 * Pure reference material — no game state.
 */

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  buildDemandDeck,
  buildDistilleryBoard,
  buildMashBillSupply,
  CONFIG,
  DISTILLERY_ROSTER,
  MAX_MATRIX_AGE,
} from "@bourbonomics/prototype-engine";
import type { DemandCard, MashBill, ResourceKind } from "@bourbonomics/prototype-engine";

const KIND_ORDER: ResourceKind[] = ["cask", "corn", "rye", "wheat", "barley"];

function recipeText(recipe: Partial<Record<ResourceKind, number>>): string {
  const parts = KIND_ORDER.filter((k) => (recipe[k] ?? 0) > 0).map((k) => `${recipe[k]} ${k}`);
  return parts.join(" · ") || "—";
}

/** Top-right matrix cell = peak (full age × full demand). */
function peakValue(matrix: number[][]): number {
  return matrix[MAX_MATRIX_AGE]?.[CONFIG.DEMAND_CAP] ?? 0;
}

function dedupe<T extends { defId: string }>(cards: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const c of cards) {
    if (seen.has(c.defId)) continue;
    seen.add(c.defId);
    out.push(c);
  }
  return out;
}

type Tab = "mash" | "distilleries" | "demand";
const TABS: { id: Tab; label: string }[] = [
  { id: "mash", label: "Mash Bills" },
  { id: "distilleries", label: "Distilleries" },
  { id: "demand", label: "Demand" },
];

export default function WikiPage() {
  const [tab, setTab] = useState<Tab>("mash");

  const mashBills = useMemo<MashBill[]>(() => dedupe(buildMashBillSupply()), []);
  const demandCards = useMemo<DemandCard[]>(() => dedupe(buildDemandDeck()), []);

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <div className="mx-auto w-full max-w-[1100px] px-6 py-10">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1 font-mono text-[12px] text-[var(--gold)] hover:text-[var(--amber)]"
        >
          ← back to menu
        </Link>

        <header className="mb-6">
          <h1 className="font-display text-4xl font-bold tracking-tight text-[var(--gold)]">
            Bourbon Wiki
          </h1>
          <p className="mt-1 text-[var(--ink-muted)]">
            Every catalog the game ships — recipes, departments, and the demand market.
            Placeholder content, pre-playtest.
          </p>
        </header>

        <div className="mb-6 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={[
                "rounded-md border px-4 py-2 font-mono text-[12px] font-semibold uppercase tracking-[.12em] transition",
                tab === t.id
                  ? "border-[var(--gold)] bg-gradient-to-b from-[#f0c970] to-[#c69d52] text-[#1a120b]"
                  : "border-[var(--rule)] bg-[var(--panel)] text-[var(--ink-muted)] hover:border-[var(--amber)] hover:text-[var(--ink)]",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "mash" ? <MashTab bills={mashBills} /> : null}
        {tab === "distilleries" ? <DistilleriesTab /> : null}
        {tab === "demand" ? <DemandTab cards={demandCards} /> : null}
      </div>
    </main>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[.06em] text-[var(--amber)]">
      {children}
    </span>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--rule)] bg-[var(--panel)] p-4">{children}</div>
  );
}

function MashTab({ bills }: { bills: MashBill[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {bills.map((b) => (
        <Card key={b.defId}>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-[18px] font-semibold text-[var(--ink)]">{b.name}</h3>
            <span className="font-mono text-[11px] text-[var(--gold)]">~{peakValue(b.matrix)} peak</span>
          </div>
          <div className="mt-1 font-mono text-[11px] uppercase tracking-[.1em] text-[var(--sky)]">
            {b.expression} · {b.batchQty} sales
          </div>
          <div className="mt-2 text-[13px] text-[var(--ink-muted)]">
            <span className="text-[var(--mute)]">Recipe:</span> {recipeText(b.recipe)}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {b.traits.map((t) => (
              <Chip key={t}>{t}</Chip>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

function DistilleriesTab() {
  return (
    <div className="flex flex-col gap-3">
      {DISTILLERY_ROSTER.map((d) => {
        const board = buildDistilleryBoard(d.id);
        return (
          <Card key={d.id}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-display text-[19px] font-semibold text-[var(--ink)]">{d.name}</h3>
              <span className="font-mono text-[11px] text-[var(--gold)]">{d.signatureBlurb}</span>
            </div>
            <ol className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {board.departments.map((dep) => (
                <li
                  key={dep.id}
                  className="flex items-start gap-3 rounded border border-[var(--rule)] bg-[var(--panel)] px-3 py-1.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[12px] text-[var(--ink)]">
                      {dep.name}
                      {dep.discount > 0 && (
                        <span className="ml-1 text-[var(--emerald)]">(−{dep.discount})</span>
                      )}
                    </div>
                    <div className="font-mono text-[10px] text-[var(--mute)]">
                      {dep.values.join(" → ")} · {dep.blurb}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        );
      })}
    </div>
  );
}

function DemandTab({ cards }: { cards: DemandCard[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => (
        <Card key={c.defId}>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-[17px] font-semibold text-[var(--ink)]">{c.label}</h3>
            <span className="font-mono text-[12px] text-[var(--gold)]">demand {c.level}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            <Chip>{c.tag}</Chip>
          </div>
          <p className="mt-2 font-mono text-[10px] italic text-[var(--mute)]">
            🚧 Placeholder. The Demand Phase lays out Marketing-many of these; the round&apos;s
            matrix level is the highest among them.
          </p>
        </Card>
      ))}
    </div>
  );
}
