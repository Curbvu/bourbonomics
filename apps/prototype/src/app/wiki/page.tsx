"use client";

/**
 * Bourbon Wiki — read-only browser of the catalogs the engine ships. Three
 * tabs: Mash Bills (recipes + batch size), Distilleries (departments + offered
 * ultimates), and Demand (the market cards — requirement, zone payouts, rep).
 * Everything reads from the engine builders so this view never drifts from what
 * the game ships. Pure reference material — no game state.
 */

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  buildDemandDeck,
  buildDistilleryBoard,
  buildMashBillSupply,
  DISTILLERY_ROSTER,
  ULTIMATE_MENU,
} from "@bourbonomics/prototype-engine";
import type { DemandCard, MashBill, ResourceKind, StyleTag, UltimateId } from "@bourbonomics/prototype-engine";

const KIND_ORDER: ResourceKind[] = ["cask", "corn", "rye", "wheat", "barley"];

// Per-resource glyph + colour (matches the in-game cards).
const KIND_CHROME: Record<ResourceKind, { glyph: string; label: string; ink: string; chip: string }> = {
  cask: { glyph: "⌬", label: "Cask", ink: "#f3dcb6", chip: "rgba(160,113,66,.22)" },
  corn: { glyph: "✺", label: "Corn", ink: "#fff0c4", chip: "rgba(240,201,112,.20)" },
  rye: { glyph: "✦", label: "Rye", ink: "#ffdcd2", chip: "rgba(217,107,84,.22)" },
  wheat: { glyph: "❉", label: "Wheat", ink: "#dff3f8", chip: "rgba(143,208,226,.18)" },
  barley: { glyph: "❦", label: "Barley", ink: "#d6f2e2", chip: "rgba(127,208,164,.18)" },
};

// Per-style chrome — each house style gets its own hue (oak/amber/crimson/
// cyan/violet/teal) so the gallery reads at a glance.
const STYLE_CHROME: Record<StyleTag, { label: string; border: string; tint: string; ink: string; glow: string }> = {
  classic: { label: "Classic Bourbon", border: "#c69d52", tint: "linear-gradient(180deg,rgba(198,157,82,.20),rgba(20,14,8,.92))", ink: "#f3dcb6", glow: "0 0 22px rgba(198,157,82,.18)" },
  highCorn: { label: "High-Corn", border: "#f0c970", tint: "linear-gradient(180deg,rgba(240,201,112,.20),rgba(20,14,8,.92))", ink: "#fff0c4", glow: "0 0 22px rgba(240,201,112,.18)" },
  rye: { label: "High-Rye", border: "#e08a78", tint: "linear-gradient(180deg,rgba(217,107,84,.22),rgba(20,12,8,.92))", ink: "#ffdcd2", glow: "0 0 22px rgba(217,107,84,.18)" },
  wheat: { label: "Wheated", border: "#8fd0e2", tint: "linear-gradient(180deg,rgba(82,166,189,.20),rgba(8,16,20,.92))", ink: "#dff3f8", glow: "0 0 22px rgba(143,208,226,.16)" },
  fourGrain: { label: "Four-Grain", border: "#c79df0", tint: "linear-gradient(180deg,rgba(157,111,208,.22),rgba(14,10,20,.92))", ink: "#ecdcfa", glow: "0 0 22px rgba(199,157,240,.18)" },
  barley: { label: "Malt-Forward", border: "#7fd0a4", tint: "linear-gradient(180deg,rgba(78,162,122,.20),rgba(8,18,12,.92))", ink: "#d6f2e2", glow: "0 0 22px rgba(127,208,164,.16)" },
};

const STYLE_FILTER_ORDER: StyleTag[] = ["classic", "highCorn", "rye", "wheat", "fourGrain", "barley"];

function recipeChips(recipe: Partial<Record<ResourceKind, number>>) {
  return KIND_ORDER.filter((k) => (recipe[k] ?? 0) > 0).map((k) => ({ kind: k, count: recipe[k]! }));
}

function reqText(req: DemandCard["requirement"]): string {
  const parts: string[] = [];
  if (req.tags) for (const t of req.tags) parts.push(STYLE_CHROME[t].label);
  if (req.quality) parts.push(`${req.quality}+`);
  if (req.minAge !== undefined) parts.push(`age ${req.minAge}+`);
  return parts.join(" · ") || "any bourbon";
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
            Every catalog the game ships — mash bills, departments, and the demand market.
            A sale = (the bourbon&apos;s aged value + the order&apos;s value) × the demand zone (×1/×2/×3).
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
  const [filter, setFilter] = useState<StyleTag | "all">("all");
  const styles = STYLE_FILTER_ORDER.filter((s) => bills.some((b) => b.styleTag === s));
  const visible = filter === "all" ? bills : bills.filter((b) => b.styleTag === filter);

  return (
    <>
      <nav className="mb-5 flex flex-wrap items-center gap-2">
        <StylePill active={filter === "all"} onClick={() => setFilter("all")}>
          All ({bills.length})
        </StylePill>
        {styles.map((s) => {
          const count = bills.filter((b) => b.styleTag === s).length;
          return (
            <StylePill key={s} active={filter === s} onClick={() => setFilter(s)} chrome={STYLE_CHROME[s]}>
              {STYLE_CHROME[s].label} ({count})
            </StylePill>
          );
        })}
      </nav>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((b) => (
          <BillCard key={b.defId} bill={b} />
        ))}
      </div>
    </>
  );
}

function StylePill({
  active,
  onClick,
  children,
  chrome,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  chrome?: { border: string; ink: string };
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border-2 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[.10em] transition-colors"
      style={{
        borderColor: active ? chrome?.border ?? "var(--gold)" : "var(--rule)",
        background: active ? `${(chrome?.border ?? "#f0c970")}22` : "var(--panel)",
        color: active ? chrome?.ink ?? "var(--gold)" : "var(--ink-muted)",
      }}
    >
      {children}
    </button>
  );
}

function BillCard({ bill }: { bill: MashBill }) {
  const chrome = STYLE_CHROME[bill.styleTag];
  return (
    <article
      className="flex flex-col rounded-xl border-2 p-4 transition-transform hover:-translate-y-0.5"
      style={{ borderColor: chrome.border, background: chrome.tint, boxShadow: chrome.glow }}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[19px] font-bold leading-tight" style={{ color: chrome.ink }}>
            {bill.name}
          </h3>
          {bill.slogan ? (
            <p className="mt-0.5 font-display text-[12.5px] italic leading-snug text-[var(--ink-muted)]">
              “{bill.slogan}”
            </p>
          ) : null}
        </div>
        <span
          className="flex-shrink-0 rounded-md border px-2 py-1 text-center font-mono text-[10px] font-bold uppercase leading-tight tracking-[.08em]"
          style={{ borderColor: chrome.border, color: chrome.ink, background: "rgba(8,5,3,.5)" }}
          title="Sales scale with the built barrel's quality (Common 1 → Legendary 3) · per-sale complexity premium"
        >
          {1 + bill.batchQtyBias}–3 sales
          {bill.saleBonus > 0 ? <><br />+{bill.saleBonus}/sale</> : null}
        </span>
      </header>

      <div
        className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[.12em]"
        style={{ background: "rgba(8,5,3,.4)", color: chrome.border }}
      >
        {chrome.label}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {recipeChips(bill.recipe).map(({ kind, count }) => {
          const k = KIND_CHROME[kind];
          return (
            <span
              key={kind}
              className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-display text-[14px] font-bold"
              style={{ borderColor: `${k.ink}55`, background: k.chip, color: k.ink }}
            >
              <span className="text-[15px] leading-none">{k.glyph}</span>
              <span className="tabular-nums">{count}</span>
              <span className="font-mono text-[10px] uppercase tracking-[.08em] opacity-90">{k.label}</span>
            </span>
          );
        })}
      </div>

      {bill.traits.length ? (
        <div className="mt-3 flex flex-wrap gap-1 border-t border-white/10 pt-3">
          {bill.traits.map((t) => (
            <Chip key={t}>{t}</Chip>
          ))}
        </div>
      ) : null}
    </article>
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
              <span className="font-mono text-[11px] text-[var(--gold)]">{d.blurb}</span>
            </div>
            <ol className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {board.departments.map((dep) => {
                const ults = dep.ultimateOptions.filter((u: UltimateId) => u !== "ph");
                return (
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
                        {dep.values.join(" → ")}
                        {ults.length ? ` · ult: ${ults.join(", ")}` : " · ult TBD"}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>
        );
      })}
      <p className="font-mono text-[10px] italic text-[var(--mute)]">
        Full ultimate menus per branch:{" "}
        {(Object.keys(ULTIMATE_MENU) as (keyof typeof ULTIMATE_MENU)[])
          .map((k) => `${k} (${ULTIMATE_MENU[k].filter((u) => u !== "ph").length})`)
          .join(" · ")}
      </p>
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
            <span className="font-mono text-[12px] text-[var(--emerald)]" title="Prestige kept by whoever completes this order">★ {c.reputation} Prestige</span>
          </div>
          <div className="mt-2 text-[13px] text-[var(--ink-muted)]">
            <span className="text-[var(--mute)]">Requirement:</span> {reqText(c.requirement)}
          </div>
          <div className="mt-1 font-mono text-[11px] text-[var(--gold)]" title="Added to the bourbon's age value, then multiplied by the demand zone (×1 / ×2 / ×3)">
            order value +{c.orderValue} · ×zone at sale (low ×1 · mid ×2 · high ×3)
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            <Chip>{c.slotMultiple}× players slots</Chip>
          </div>
        </Card>
      ))}
    </div>
  );
}
