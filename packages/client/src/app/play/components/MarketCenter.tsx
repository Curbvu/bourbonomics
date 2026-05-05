"use client";

/**
 * Center column — the public face of the table.
 *
 * Top: Market conveyor (6 face-up cards available for purchase) plus the
 * doomsday clock + demand chip.
 *
 * Below: three sub-sections side by side — Mash bills (with the next 3
 * face-up bills previewed from the bourbon deck), Operations (deck count
 * + the 8 ops card types), and Investments (placeholder until the
 * mechanic ships in v2.2).
 *
 * Every card uses the dev-branch portrait silhouette via handCardStyles
 * so the visual idiom matches the HandTray.
 */

import type { Card, MashBill, OperationsCardDefId, ResourceSubtype } from "@bourbonomics/engine";
import { operationsCardSpecs } from "@bourbonomics/engine";
import { useMemo } from "react";
import { useGameStore } from "@/lib/store/game";
import {
  CAPITAL_CHROME,
  OPS_CHROME,
  RESOURCE_CHROME,
  RESOURCE_GLYPH,
  RESOURCE_LABEL,
} from "./handCardStyles";
import { TIER_CHROME, tierOrCommon } from "./tierStyles";

const CONVEYOR_SIZE = 6;

export default function MarketCenter() {
  const { state } = useGameStore();
  const opsCatalog = useMemo(() => operationsCardSpecs(), []);
  if (!state) return null;

  // Top 3 of the bourbon deck (engine convention: top is end of array).
  const faceUpBills = state.bourbonDeck.slice(-3).reverse();

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/50 p-3">
      {/* Market conveyor */}
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[.18em] text-slate-300">
            Market conveyor
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-[.12em] text-slate-500">
            supply {state.marketSupplyDeck.length} · demand{" "}
            <span className="text-amber-300 tabular-nums">{state.demand}</span>/12
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {state.marketConveyor.map((c) => (
            <ConveyorCard key={c.id} card={c} />
          ))}
          {Array.from({
            length: Math.max(0, CONVEYOR_SIZE - state.marketConveyor.length),
          }).map((_, i) => (
            <EmptyMarketSlot key={`empty-${i}`} />
          ))}
        </div>
      </section>

      {/* Sub-sections: Mash bills · Operations · Investments */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* Mash bills */}
        <Subsection
          title="Mash bills"
          subtitle={`bourbon deck · ${state.bourbonDeck.length} left`}
          tag={state.finalRoundTriggered ? "final round" : undefined}
        >
          {faceUpBills.length === 0 ? (
            <EmptyState>bourbon supply exhausted</EmptyState>
          ) : (
            <div className="flex flex-wrap gap-2">
              {faceUpBills.map((b) => (
                <MashBillTile key={b.id} bill={b} />
              ))}
            </div>
          )}
        </Subsection>

        {/* Operations */}
        <Subsection
          title="Operations"
          subtitle={`ops deck · ${state.operationsDeck.length} · discard ${state.operationsDiscard.length}`}
        >
          <div className="flex flex-wrap gap-2">
            {opsCatalog.map((spec) => (
              <OpsTypeTile key={spec.defId} defId={spec.defId} name={spec.name} description={spec.description} />
            ))}
          </div>
        </Subsection>

        {/* Investments — placeholder until the mechanic ships. */}
        <Subsection title="Investments" subtitle="coming in v2.2" muted>
          <div className="flex flex-1 items-center justify-center py-6 text-center font-mono text-[11px] italic leading-relaxed text-slate-500">
            <span>
              Investment cards are designed but not yet implemented.
              <br />
              See <code className="text-slate-400">PLANNED_MECHANICS.md</code>.
            </span>
          </div>
        </Subsection>
      </div>
    </div>
  );
}

// -----------------------------
// Layout helpers
// -----------------------------

function Subsection({
  title,
  subtitle,
  tag,
  muted = false,
  children,
}: {
  title: string;
  subtitle?: string;
  tag?: string;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={[
        "flex min-h-[140px] flex-col rounded-lg border bg-slate-950/40 p-3",
        muted ? "border-slate-800/60 opacity-80" : "border-slate-800",
      ].join(" ")}
    >
      <header className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="font-mono text-[11px] font-semibold uppercase tracking-[.18em] text-slate-300">
          {title}
        </h3>
        <div className="flex items-baseline gap-2">
          {tag ? (
            <span className="rounded border border-amber-500 bg-amber-700/[0.20] px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[.10em] text-amber-200">
              {tag}
            </span>
          ) : null}
          {subtitle ? (
            <span className="font-mono text-[10px] uppercase tracking-[.10em] text-slate-500">
              {subtitle}
            </span>
          ) : null}
        </div>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </section>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center text-center font-mono text-[11px] italic text-slate-500">
      {children}
    </div>
  );
}

// -----------------------------
// Card tiles
// -----------------------------

const baseTile =
  "relative flex h-[140px] w-[100px] flex-shrink-0 flex-col overflow-hidden rounded-lg border-2 p-2 text-left shadow-[0_8px_20px_rgba(0,0,0,.4)] ring-1 ring-white/10 transition-transform duration-150 hover:-translate-y-1 hover:scale-[1.05]";

function ConveyorCard({ card }: { card: Card }) {
  if (card.type === "capital") {
    const value = card.capitalValue ?? 1;
    const chrome = CAPITAL_CHROME;
    return (
      <div
        title={`Capital · pays $${value} · costs ${card.cost ?? value} to buy`}
        className={[baseTile, chrome.gradient, chrome.border].join(" ")}
      >
        <Sheen />
        <div className="flex items-baseline justify-between">
          <span className={`text-[9px] font-semibold uppercase tracking-[0.18em] ${chrome.label}`}>
            Capital
          </span>
          <CostChip value={card.cost ?? value} chrome={chrome} />
        </div>
        <div className={`mt-auto flex flex-col items-center ${chrome.ink}`}>
          <span className="font-display text-[34px] font-bold leading-none tabular-nums drop-shadow-[0_2px_6px_rgba(0,0,0,.45)]">
            ${value}
          </span>
          <span className={`mt-1 font-mono text-[9px] uppercase tracking-[.18em] ${chrome.label}`}>
            spend
          </span>
        </div>
      </div>
    );
  }
  // Resource card
  const subtype = card.subtype as ResourceSubtype;
  const chrome = RESOURCE_CHROME[subtype];
  const count = card.resourceCount ?? 1;
  return (
    <div
      title={`${RESOURCE_LABEL[subtype]}${count > 1 ? ` ×${count}` : ""} · cost ${card.cost ?? 1}`}
      className={[baseTile, chrome.gradient, chrome.border].join(" ")}
    >
      <Sheen />
      <div className="flex items-baseline justify-between">
        <span className={`text-[9px] font-semibold uppercase tracking-[0.18em] ${chrome.label}`}>
          {RESOURCE_LABEL[subtype]}
        </span>
        <CostChip value={card.cost ?? 1} chrome={chrome} />
      </div>
      <h4 className={`mt-1 font-display text-[12px] font-bold leading-tight drop-shadow-[0_1px_4px_rgba(0,0,0,.35)] ${chrome.ink}`}>
        {count > 1 ? `${count}× ${RESOURCE_LABEL[subtype]}` : RESOURCE_LABEL[subtype]}
      </h4>
      <div
        className={`mt-auto grid h-10 w-10 self-center place-items-center rounded-full border-2 bg-white/10 text-xl shadow-[inset_0_1px_4px_rgba(255,255,255,.15)] backdrop-blur-sm ${chrome.border} ${chrome.ink}`}
      >
        {RESOURCE_GLYPH[subtype]}
      </div>
    </div>
  );
}

function EmptyMarketSlot() {
  return (
    <div className="grid h-[140px] w-[100px] place-items-center rounded-lg border-2 border-dashed border-slate-800 bg-slate-950/30 font-mono text-[9px] uppercase tracking-[.18em] text-slate-700">
      empty
    </div>
  );
}

function MashBillTile({ bill }: { bill: MashBill }) {
  const tier = tierOrCommon(bill.tier);
  const chrome = TIER_CHROME[tier];
  const cells: number[] = [];
  for (const row of bill.rewardGrid) for (const c of row) if (c !== null) cells.push(c);
  const peak = cells.length ? Math.max(...cells) : 0;
  const floor = cells.length ? Math.min(...cells) : 0;
  return (
    <div
      title={`${bill.name} · ${chrome.label_text} · age bands ${bill.ageBands.join("/")} · demand bands ${bill.demandBands.join("/")}`}
      className={[baseTile, chrome.gradient, chrome.border, chrome.glow].join(" ")}
    >
      <Sheen />
      <div className="flex items-baseline justify-between">
        <span className={`text-[9px] font-semibold uppercase tracking-[0.18em] ${chrome.label}`}>
          {chrome.label_text}
        </span>
        {bill.goldAward ? (
          <span className="text-[10px]" aria-hidden>🥇</span>
        ) : bill.silverAward ? (
          <span className="text-[10px]" aria-hidden>🥈</span>
        ) : null}
      </div>
      <h4 className={`mt-1 line-clamp-2 font-display text-[12px] font-bold leading-tight drop-shadow-[0_1px_4px_rgba(0,0,0,.35)] ${chrome.titleInk}`}>
        {bill.name}
      </h4>
      <div className="mt-auto flex items-baseline justify-center gap-1">
        <span className={`font-display text-[20px] font-bold leading-none tabular-nums ${chrome.titleInk}`}>
          {floor}–{peak}
        </span>
        <span className={`font-mono text-[9px] uppercase tracking-[.18em] ${chrome.label}`}>
          rep
        </span>
      </div>
    </div>
  );
}

function OpsTypeTile({
  defId,
  name,
  description,
}: {
  defId: OperationsCardDefId;
  name: string;
  description: string;
}) {
  const chrome = OPS_CHROME;
  return (
    <div
      title={`${name} — ${description}`}
      className={[baseTile, chrome.gradient, chrome.border].join(" ")}
    >
      <Sheen />
      <div className="flex items-baseline justify-between">
        <span className={`text-[9px] font-semibold uppercase tracking-[0.18em] ${chrome.label}`}>
          Ops
        </span>
      </div>
      <h4 className={`mt-1 line-clamp-3 font-display text-[11px] font-bold leading-tight drop-shadow-[0_1px_4px_rgba(0,0,0,.35)] ${chrome.ink}`}>
        {name}
      </h4>
      <div
        className={`mt-auto grid h-10 w-10 self-center place-items-center rounded-full border-2 bg-white/10 text-xl font-bold ${chrome.border} ${chrome.ink}`}
        aria-hidden
        data-def-id={defId}
      >
        ⚡
      </div>
    </div>
  );
}

function CostChip({ value, chrome }: { value: number; chrome: { borderSoft: string; ink: string } }) {
  return (
    <span
      className={`rounded border px-1 py-px font-mono text-[8px] font-bold uppercase tracking-[.10em] ${chrome.borderSoft} ${chrome.ink}`}
    >
      {value}¢
    </span>
  );
}

function Sheen() {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
      aria-hidden
    />
  );
}
