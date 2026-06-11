"use client";

/**
 * Bourbon Wiki (P2) — read-only browser of the catalogs the prototype
 * engine ships. Three tabs: Mash Bills (recipes + payoff peak), Slot
 * Cards (the five brand-line designs with per-slot rewards), and
 * Marketing (trait-gated prestige cards).
 *
 * Everything reads from the engine's `build*Supply/Deck()` builders
 * (deduped by defId) so this view never drifts from what the game ships.
 * Pure reference material — no game state.
 */

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  buildMashBillSupply,
  buildSlotCardSupply,
  buildMarketingDeck,
  CONFIG,
  MAX_MATRIX_AGE,
} from "@bourbonomics/prototype-engine";
import type {
  MarketingCard,
  MashBill,
  RewardLeaf,
  SlotCard,
  SlotRewardSpec,
  ResourceKind,
} from "@bourbonomics/prototype-engine";

// ── reward / recipe formatters ───────────────────────────────────────

const KIND_ORDER: ResourceKind[] = ["cask", "corn", "rye", "wheat", "barley"];

function recipeText(recipe: Partial<Record<ResourceKind, number>>): string {
  const parts = KIND_ORDER.filter((k) => (recipe[k] ?? 0) > 0).map(
    (k) => `${recipe[k]} ${k}`,
  );
  return parts.join(" · ") || "—";
}

function leafText(leaf: RewardLeaf): string {
  const parts: string[] = [];
  if (leaf.capital) parts.push(`+${leaf.capital}฿`);
  if (leaf.prestige) parts.push(`+${leaf.prestige}★`);
  if (leaf.prestigeFromAge) parts.push("+age★");
  if (leaf.resources) parts.push(`draw ${leaf.resources}`);
  return parts.length ? parts.join(" & ") : "—";
}

function rewardText(spec: SlotRewardSpec): string {
  if (spec.kind === "flat") return leafText(spec.reward);
  if (spec.kind === "choice")
    return spec.options.map(leafText).join("  OR  ");
  const gate: string[] = [];
  if (spec.gate.minAge !== undefined) gate.push(`age ≥${spec.gate.minAge}`);
  if (spec.gate.minQuality !== undefined) gate.push(spec.gate.minQuality);
  return `${gate.join(" ")}: ${leafText(spec.hit)}  ·  else ${leafText(spec.miss)}`;
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

// ── tabs ─────────────────────────────────────────────────────────────

type Tab = "mash" | "slots" | "marketing";
const TABS: { id: Tab; label: string }[] = [
  { id: "mash", label: "Mash Bills" },
  { id: "slots", label: "Slot Cards" },
  { id: "marketing", label: "Marketing" },
];

export default function WikiPage() {
  const [tab, setTab] = useState<Tab>("mash");

  const mashBills = useMemo<MashBill[]>(() => dedupe(buildMashBillSupply()), []);
  const slotCards = useMemo<SlotCard[]>(() => dedupe(buildSlotCardSupply()), []);
  const marketing = useMemo<MarketingCard[]>(
    () => dedupe(buildMarketingDeck()),
    [],
  );

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <div className="mx-auto w-full max-w-[1100px] px-6 py-10">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1 font-mono text-[12px] text-[var(--gold)] hover:text-[var(--amber-2)]"
        >
          ← back to menu
        </Link>

        <header className="mb-6">
          <h1 className="font-display text-4xl font-bold tracking-tight text-[var(--gold)]">
            Bourbon Wiki
          </h1>
          <p className="mt-1 text-[var(--ink-muted)]">
            Every catalog the prototype ships — recipes, reward grids, and
            traits. Placeholder content, pre-playtest.
          </p>
        </header>

        {/* tabs */}
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
                  : "border-[var(--rule)] bg-[var(--panel-2)] text-[var(--ink-muted)] hover:border-[var(--amber)] hover:text-[var(--ink)]",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "mash" ? <MashTab bills={mashBills} /> : null}
        {tab === "slots" ? <SlotsTab cards={slotCards} /> : null}
        {tab === "marketing" ? <MarketingTab cards={marketing} /> : null}
      </div>
    </main>
  );
}

// ── chrome ───────────────────────────────────────────────────────────

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[.06em] text-[var(--amber-2)]">
      {children}
    </span>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--rule)] bg-[var(--panel)]/50 p-4">
      {children}
    </div>
  );
}

// ── tab bodies ───────────────────────────────────────────────────────

function MashTab({ bills }: { bills: MashBill[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {bills.map((b) => (
        <Card key={b.defId}>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-[18px] font-semibold text-[var(--ink)]">
              {b.name}
            </h3>
            <span className="font-mono text-[11px] text-[var(--gold)]">
              ~{peakValue(b.matrix)}฿ peak
            </span>
          </div>
          <div className="mt-1 font-mono text-[11px] uppercase tracking-[.1em] text-[var(--sky)]">
            {b.expression}
          </div>
          <div className="mt-2 text-[13px] text-[var(--ink-muted)]">
            <span className="text-[var(--mute)]">Recipe:</span>{" "}
            {recipeText(b.recipe)}
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

function SlotsTab({ cards }: { cards: SlotCard[] }) {
  return (
    <div className="flex flex-col gap-3">
      {cards.map((c) => (
        <Card key={c.defId}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-display text-[19px] font-semibold text-[var(--ink)]">
              {c.name}
            </h3>
            <span className="font-mono text-[11px] text-[var(--mute)]">
              {c.slots.length} slots
              {c.houseStyleBonus !== undefined
                ? ` · house-style +${c.houseStyleBonus}★`
                : ""}
            </span>
          </div>
          <ol className="mt-3 flex flex-col gap-1.5">
            {c.slots.map((s, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded border border-[var(--rule)]/60 bg-[var(--panel-2)]/50 px-3 py-1.5"
              >
                <span className="mt-0.5 font-mono text-[11px] text-[var(--brass)]">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-[12px] text-[var(--ink)]">
                    {rewardText(s.reward)}
                  </div>
                  {(s.optional || s.matchAgeOfSlot !== undefined) && (
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {s.optional ? <Chip>optional</Chip> : null}
                      {s.matchAgeOfSlot !== undefined ? (
                        <Chip>match slot {s.matchAgeOfSlot + 1} age</Chip>
                      ) : null}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </Card>
      ))}
    </div>
  );
}

function MarketingTab({ cards }: { cards: MarketingCard[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((m) => (
        <Card key={m.defId}>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-[17px] font-semibold text-[var(--ink)]">
              {m.name}
            </h3>
            <span className="font-mono text-[12px] text-[var(--gold)]">
              +{m.prestigeOnMatch}★
            </span>
          </div>
          <div className="mt-2 text-[12px] text-[var(--ink-muted)]">
            <span className="text-[var(--mute)]">Fires on:</span>{" "}
            {m.requiredTraits.length ? (
              <span className="inline-flex flex-wrap gap-1 align-middle">
                {m.requiredTraits.map((t) => (
                  <Chip key={t}>{t}</Chip>
                ))}
              </span>
            ) : (
              "any bourbon"
            )}
          </div>
          <div className="mt-2 font-mono text-[11px] text-[var(--mute)]">
            exclusive group: {m.exclusiveGroup}
          </div>
        </Card>
      ))}
    </div>
  );
}
