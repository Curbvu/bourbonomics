"use client";

/**
 * Center column — the public face of the table.
 *
 * Top: Market conveyor (10 face-up cards available for purchase).
 *
 * Below: three subsections — Mash bills, Operations, Investments. Each
 * shows 3 face-up cards plus a face-down "draw from pile" tile with a
 * remaining-cards counter. Investments is a placeholder until v2.2.
 *
 * **Every card on the table is the exact same fixed silhouette
 * (CARD_W × CARD_H).** The hand uses a slightly larger size; market
 * tiles run a bit smaller for density.
 */

import type { Card, MashBill, OperationsCard, ResourceSubtype } from "@bourbonomics/engine";
import { useGameStore } from "@/lib/store/game";
import {
  CAPITAL_CHROME,
  CARD_SIZE_CLASS,
  OPS_CHROME,
  RESOURCE_CHROME,
  RESOURCE_GLYPH,
  RESOURCE_LABEL,
} from "./handCardStyles";
import { TIER_CHROME, tierOrCommon } from "./tierStyles";

const CONVEYOR_SIZE = 10;
const FACEUP_PER_SECTION = 3;

export default function MarketCenter() {
  const { state } = useGameStore();
  if (!state) return null;

  const faceUpBills = state.bourbonDeck.slice(-FACEUP_PER_SECTION).reverse();
  const remainingBills = Math.max(0, state.bourbonDeck.length - faceUpBills.length);
  const faceUpOps = state.operationsDeck.slice(-FACEUP_PER_SECTION).reverse();
  const remainingOps = Math.max(0, state.operationsDeck.length - faceUpOps.length);

  return (
    <div className="flex h-full min-h-0 flex-col gap-1.5 overflow-hidden rounded-lg border border-slate-800 bg-slate-900/50 p-2">
      {/* Market conveyor */}
      <section>
        <div className="mb-1 flex items-baseline justify-between">
          <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[.18em] text-slate-300">
            Market conveyor
          </h2>
          <span className="font-mono text-[9px] uppercase tracking-[.12em] text-slate-500">
            supply {state.marketSupplyDeck.length} · demand{" "}
            <span className="text-amber-300 tabular-nums">{state.demand}</span>/12
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          {state.marketConveyor.map((c) => (
            <ConveyorCard key={c.id} card={c} />
          ))}
          {Array.from({
            length: Math.max(0, CONVEYOR_SIZE - state.marketConveyor.length),
          }).map((_, i) => (
            <EmptySlot key={`empty-${i}`} />
          ))}
        </div>
      </section>

      {/* Three subsections, each with 3 face-up + 1 draw-from-pile */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-1.5 lg:grid-cols-3">
        <Subsection
          title="Mash bills"
          tag={state.finalRoundTriggered ? "final round" : undefined}
        >
          <FaceUpRow
            faceUp={faceUpBills.map((b) => (
              <MashBillTile key={b.id} bill={b} />
            ))}
            placeholders={Math.max(0, FACEUP_PER_SECTION - faceUpBills.length)}
            pileLabel="Bourbon deck"
            pileRemaining={remainingBills}
            pileTone="amber"
          />
        </Subsection>

        <Subsection title="Operations">
          <FaceUpRow
            faceUp={faceUpOps.map((c) => (
              <OpsCardTile key={c.id} card={c} />
            ))}
            placeholders={Math.max(0, FACEUP_PER_SECTION - faceUpOps.length)}
            pileLabel="Ops deck"
            pileRemaining={remainingOps}
            pileSubLabel={`discard ${state.operationsDiscard.length}`}
            pileTone="violet"
          />
        </Subsection>

        <Subsection title="Investments" muted>
          <FaceUpRow
            faceUp={[]}
            placeholders={FACEUP_PER_SECTION}
            pileLabel="Coming v2.2"
            pileRemaining={0}
            pileTone="slate"
            mutedPile
          />
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
  tag,
  muted = false,
  children,
}: {
  title: string;
  tag?: string;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={[
        "flex min-h-0 flex-col rounded-lg border bg-slate-950/40 p-1.5",
        muted ? "border-slate-800/60 opacity-80" : "border-slate-800",
      ].join(" ")}
    >
      <header className="mb-1 flex items-baseline justify-between gap-2">
        <h3 className="font-mono text-[10px] font-semibold uppercase tracking-[.18em] text-slate-300">
          {title}
        </h3>
        {tag ? (
          <span className="rounded border border-amber-500 bg-amber-700/[0.20] px-1.5 py-0.5 font-mono text-[8.5px] font-semibold uppercase tracking-[.10em] text-amber-200">
            {tag}
          </span>
        ) : null}
      </header>
      <div className="flex flex-1 items-start">{children}</div>
    </section>
  );
}

function FaceUpRow({
  faceUp,
  placeholders,
  pileLabel,
  pileRemaining,
  pileSubLabel,
  pileTone,
  mutedPile = false,
}: {
  faceUp: React.ReactNode[];
  placeholders: number;
  pileLabel: string;
  pileRemaining: number;
  pileSubLabel?: string;
  pileTone: "amber" | "violet" | "slate";
  mutedPile?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-start gap-1">
      {faceUp}
      {Array.from({ length: placeholders }).map((_, i) => (
        <EmptySlot key={`empty-${i}`} />
      ))}
      <DrawPile
        label={pileLabel}
        remaining={pileRemaining}
        subLabel={pileSubLabel}
        tone={pileTone}
        muted={mutedPile}
      />
    </div>
  );
}

// -----------------------------
// Card tiles — all share CARD_SIZE_CLASS
// -----------------------------

const baseTile = `relative flex flex-shrink-0 flex-col overflow-hidden rounded-md border-2 p-1.5 text-left shadow-[0_4px_12px_rgba(0,0,0,.4)] ring-1 ring-white/10 transition-transform duration-150 hover:-translate-y-0.5 hover:scale-[1.04] ${CARD_SIZE_CLASS}`;

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
          <span className={`text-[8px] font-semibold uppercase tracking-[0.16em] ${chrome.label}`}>
            Capital
          </span>
          <CostChip value={card.cost ?? value} chrome={chrome} />
        </div>
        <div className={`mt-auto flex flex-col items-center ${chrome.ink}`}>
          <span className="font-display text-[20px] font-bold leading-none tabular-nums drop-shadow-[0_2px_6px_rgba(0,0,0,.45)]">
            ${value}
          </span>
          <span className={`mt-0.5 font-mono text-[7.5px] uppercase tracking-[.16em] ${chrome.label}`}>
            spend
          </span>
        </div>
      </div>
    );
  }
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
        <span className={`text-[8px] font-semibold uppercase tracking-[0.16em] ${chrome.label}`}>
          {RESOURCE_LABEL[subtype]}
        </span>
        <CostChip value={card.cost ?? 1} chrome={chrome} />
      </div>
      <h4 className={`mt-0.5 font-display text-[10px] font-bold leading-tight drop-shadow-[0_1px_4px_rgba(0,0,0,.35)] ${chrome.ink}`}>
        {count > 1 ? `${count}×` : ""} {RESOURCE_LABEL[subtype]}
      </h4>
      <div
        className={`mt-auto grid h-7 w-7 self-center place-items-center rounded-full border-2 bg-white/10 text-base shadow-[inset_0_1px_4px_rgba(255,255,255,.15)] backdrop-blur-sm ${chrome.border} ${chrome.ink}`}
      >
        {RESOURCE_GLYPH[subtype]}
      </div>
    </div>
  );
}

function EmptySlot() {
  return (
    <div
      className={`grid place-items-center rounded-md border-2 border-dashed border-slate-800 bg-slate-950/30 font-mono text-[8px] uppercase tracking-[.18em] text-slate-700 ${CARD_SIZE_CLASS}`}
    >
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
        <span className={`text-[8px] font-semibold uppercase tracking-[0.16em] ${chrome.label}`}>
          {chrome.label_text}
        </span>
        {bill.goldAward ? (
          <span className="text-[9px]" aria-hidden>🥇</span>
        ) : bill.silverAward ? (
          <span className="text-[9px]" aria-hidden>🥈</span>
        ) : null}
      </div>
      <h4 className={`mt-0.5 line-clamp-2 font-display text-[10px] font-bold leading-tight drop-shadow-[0_1px_4px_rgba(0,0,0,.35)] ${chrome.titleInk}`}>
        {bill.name}
      </h4>
      <div className="mt-auto flex items-baseline justify-center gap-1">
        <span className={`font-display text-[14px] font-bold leading-none tabular-nums ${chrome.titleInk}`}>
          {floor}–{peak}
        </span>
        <span className={`font-mono text-[7.5px] uppercase tracking-[.16em] ${chrome.label}`}>
          rep
        </span>
      </div>
    </div>
  );
}

function OpsCardTile({ card }: { card: OperationsCard }) {
  const chrome = OPS_CHROME;
  return (
    <div
      title={`${card.name} — ${card.description}`}
      className={[baseTile, chrome.gradient, chrome.border].join(" ")}
    >
      <Sheen />
      <div className="flex items-baseline justify-between">
        <span className={`text-[8px] font-semibold uppercase tracking-[0.16em] ${chrome.label}`}>
          Ops
        </span>
      </div>
      <h4 className={`mt-0.5 line-clamp-3 font-display text-[10px] font-bold leading-tight drop-shadow-[0_1px_4px_rgba(0,0,0,.35)] ${chrome.ink}`}>
        {card.name}
      </h4>
      <div
        className={`mt-auto grid h-7 w-7 self-center place-items-center rounded-full border-2 bg-white/10 text-base font-bold ${chrome.border} ${chrome.ink}`}
        aria-hidden
      >
        ⚡
      </div>
    </div>
  );
}

function DrawPile({
  label,
  remaining,
  subLabel,
  tone,
  muted = false,
}: {
  label: string;
  remaining: number;
  subLabel?: string;
  tone: "amber" | "violet" | "slate";
  muted?: boolean;
}) {
  const toneChrome =
    tone === "amber"
      ? {
          border: "border-amber-500/70",
          gradient:
            "bg-[linear-gradient(160deg,rgba(120,53,15,.65)_0%,rgba(15,23,42,.95)_75%)]",
          label: "text-amber-300",
          ink: "text-amber-100",
        }
      : tone === "violet"
        ? {
            border: "border-violet-500/70",
            gradient:
              "bg-[linear-gradient(160deg,rgba(76,29,149,.65)_0%,rgba(15,23,42,.95)_75%)]",
            label: "text-violet-300",
            ink: "text-violet-100",
          }
        : {
            border: "border-slate-600/70",
            gradient:
              "bg-[linear-gradient(160deg,rgba(51,65,85,.6)_0%,rgba(15,23,42,.95)_75%)]",
            label: "text-slate-400",
            ink: "text-slate-200",
          };
  return (
    <div
      title={`${label} · ${remaining} card${remaining === 1 ? "" : "s"} remaining`}
      className={[
        baseTile,
        toneChrome.gradient,
        toneChrome.border,
        muted ? "opacity-60" : "",
      ].join(" ")}
      aria-label={label}
    >
      <Sheen />
      <div className="pointer-events-none absolute inset-2 rounded border border-white/10" aria-hidden />
      <div className="flex items-baseline justify-between">
        <span className={`text-[8px] font-semibold uppercase tracking-[0.16em] ${toneChrome.label}`}>
          Draw
        </span>
      </div>
      <div className="mt-auto flex flex-col items-center gap-0.5">
        <span className={`font-display text-[20px] font-bold leading-none tabular-nums ${toneChrome.ink}`}>
          {remaining}
        </span>
        <span className={`font-mono text-[7.5px] uppercase tracking-[.14em] text-center ${toneChrome.label}`}>
          {label}
        </span>
        {subLabel ? (
          <span className={`font-mono text-[7px] uppercase tracking-[.12em] ${toneChrome.label} opacity-70`}>
            {subLabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function CostChip({ value, chrome }: { value: number; chrome: { borderSoft: string; ink: string } }) {
  return (
    <span
      className={`rounded border px-0.5 py-px font-mono text-[7.5px] font-bold uppercase tracking-[.10em] ${chrome.borderSoft} ${chrome.ink}`}
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
