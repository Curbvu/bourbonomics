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

import {
  defaultInvestmentCatalog,
  paymentValue,
  type Card,
  type InvestmentCard,
  type MashBill,
  type OperationsCard,
  type ResourceSubtype,
} from "@bourbonomics/engine";
import { useMemo } from "react";
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
import { CornerCost, CornerValue } from "./cardCorners";
import { useZoneFocusClass } from "./pickerFocus";
import RecipePips from "./RecipePips";
import { MoneyText } from "./money";

const CONVEYOR_SIZE = 10;
const FACEUP_PER_SECTION = 3;

export default function MarketCenter() {
  const { state, drawBillMode, setDrawBillTarget } = useGameStore();
  // v2.1 has no in-engine investment deck — show a static catalog so the
  // slot is themed and visible. The mechanic ships in v2.2.
  const investmentDeck = useMemo(() => defaultInvestmentCatalog(), []);

  if (!state) return null;

  // v2.2: face-up bourbon row lives in its own engine slot.
  const faceUpBills = state.bourbonFaceUp;
  const remainingBills = state.bourbonDeck.length;
  // Draw-bill mode wires the bourbon section as a click target during
  // step 1 (pick the bourbon — face-up tile or blind deck top).
  const drawStep1 =
    drawBillMode != null &&
    !drawBillMode.blind &&
    !drawBillMode.pickedMashBillId;
  const blindPicked = drawBillMode != null && drawBillMode.blind;
  const faceUpOps = state.operationsDeck.slice(-FACEUP_PER_SECTION).reverse();
  const remainingOps = Math.max(0, state.operationsDeck.length - faceUpOps.length);
  const faceUpInvest = investmentDeck.slice(0, FACEUP_PER_SECTION);
  const remainingInvest = Math.max(0, investmentDeck.length - faceUpInvest.length);

  const conveyorFocus = useZoneFocusClass("market-conveyor");
  const mashBillsFocus = useZoneFocusClass("market-mash-bills");
  const opsFocus = useZoneFocusClass("market-ops");
  const investFocus = useZoneFocusClass("market-investments");

  return (
    // Top-level: every section (Market, Mash bills, Ops, Investments)
    // is a PEER. They share the same chrome (rounded panel + side
    // caption + cards) so nothing reads as nested under Market. The
    // outer wrapper is a flex column that just stacks them with a
    // tight gap.
    <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
      <Section
        title="Market"
        zone="market-conveyor"
        focusClass={conveyorFocus}
        dataAttr="data-market-conveyor"
      >
        <div className="flex flex-1 flex-wrap items-stretch justify-between gap-2">
          {state.marketConveyor.map((c, i) => (
            <ConveyorCard key={c.id} card={c} slotIndex={i} />
          ))}
          {Array.from({
            length: Math.max(0, CONVEYOR_SIZE - state.marketConveyor.length),
          }).map((_, i) => (
            <EmptySlot key={`empty-${i}`} />
          ))}
        </div>
      </Section>

      {/* Mash bills + Ops + Investments — each is its own peer section,
          laid out in a grid so they share the available row width. */}
      <div className="grid grid-cols-1 gap-1.5 lg:grid-cols-3">
        <Section
          title="Mash bills"
          tag={state.finalRoundTriggered ? "final round" : undefined}
          zone="market-mash-bills"
          focusClass={mashBillsFocus}
          dataAttr="data-bourbon-row"
        >
          <FaceUpRow
            faceUp={faceUpBills.map((b) => (
              <MashBillTile key={b.id} bill={b} />
            ))}
            placeholders={Math.max(0, FACEUP_PER_SECTION - faceUpBills.length)}
            pileLabel="Bourbon deck"
            pileRemaining={remainingBills}
            pileTone="amber"
            pileInteractive={drawStep1 && remainingBills > 0}
            pilePicked={blindPicked}
            onClickPile={() => setDrawBillTarget({ blind: true })}
            pileClickTitle="Draw the top mash bill blind (1 card sacrifice)"
          />
        </Section>

        <Section
          title="Operations"
          tag="pending future release"
          zone="market-ops"
          focusClass={`${opsFocus} relative pointer-events-none [filter:grayscale(1)_brightness(0.5)] opacity-30`}
          dataAttr="data-ops-row"
          overlay={<PendingOverlay />}
        >
          <FaceUpRow
            faceUp={faceUpOps.map((c, i) => (
              <OpsCardTile key={c.id} card={c} slotIndex={i} />
            ))}
            placeholders={Math.max(0, FACEUP_PER_SECTION - faceUpOps.length)}
            pileLabel="Ops deck"
            pileRemaining={remainingOps}
            pileSubLabel={`discard ${state.operationsDiscard.length}`}
            pileTone="violet"
          />
        </Section>

        <Section
          title="Investments"
          tag="pending future release"
          zone="market-investments"
          focusClass={`${investFocus} relative pointer-events-none [filter:grayscale(1)_brightness(0.5)] opacity-30`}
          dataAttr="data-investments-row"
          overlay={<PendingOverlay />}
        >
          <FaceUpRow
            faceUp={faceUpInvest.map((c) => (
              <InvestmentCardTile key={c.id} card={c} />
            ))}
            placeholders={Math.max(0, FACEUP_PER_SECTION - faceUpInvest.length)}
            pileLabel="Invest deck"
            pileRemaining={remainingInvest}
            pileTone="emerald"
          />
        </Section>
      </div>
    </div>
  );
}

// -----------------------------
// Layout helpers
// -----------------------------

/**
 * Top-level peer section in the market column. Every section (Market,
 * Mash bills, Operations, Investments) shares the same chrome:
 *
 *   ┌─────────────────────────────────────────────────────┐
 *   │ T │ ╎  [card] [card] [card] ...                     │
 *   │ I │ ╎                                                │
 *   │ T │ ╎                                                │
 *   │ L │ ╎                                                │
 *   │ E │ ╎                                                │
 *   └─────────────────────────────────────────────────────┘
 *
 * The vertical title (writing-mode: vertical-rl) anchors the section
 * without eating a full row of vertical space. A thin vertical lining
 * (`border-r`) separates the title from the cards so each section
 * reads as a discrete unit and the layout doesn't look nested.
 */
function Section({
  title,
  tag,
  zone,
  focusClass,
  dataAttr,
  overlay,
  children,
}: {
  title: string;
  tag?: string;
  zone?: string;
  focusClass?: string;
  dataAttr?: string;
  overlay?: React.ReactNode;
  children: React.ReactNode;
}) {
  const dataProps = dataAttr ? { [dataAttr]: "true" } : {};
  return (
    <section
      data-zone={zone}
      {...dataProps}
      className={[
        "relative flex items-stretch gap-2 rounded-lg border border-slate-800 bg-slate-950/40 p-1.5",
        focusClass ?? "",
      ].join(" ")}
    >
      <SideCaption title={title} tag={tag} />
      <div className="flex flex-1 items-start">{children}</div>
      {overlay}
    </section>
  );
}

/**
 * Vertical-rl section caption + a thin lining separator pinned to the
 * left of a row. Reads bottom-to-top so the text length doesn't eat
 * horizontal space, and the lining gives each section a clear visual
 * anchor.
 */
function SideCaption({ title, tag }: { title: string; tag?: string }) {
  return (
    <div className="flex flex-shrink-0 items-stretch">
      <div className="flex flex-col items-center justify-between gap-1 px-1 py-0.5">
        <span
          className="font-mono text-[10px] font-semibold uppercase tracking-[.18em] text-slate-200"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          {title}
        </span>
        {tag ? (
          <span
            className="rounded border border-amber-500 bg-amber-700/[0.20] px-1 py-0.5 font-mono text-[7.5px] font-semibold uppercase tracking-[.10em] text-amber-200"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            {tag}
          </span>
        ) : null}
      </div>
      {/* Vertical lining — anchors the title against the card row. */}
      <div className="w-px self-stretch bg-slate-700/60" aria-hidden />
    </div>
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
  pileInteractive = false,
  pilePicked = false,
  onClickPile,
  pileClickTitle,
}: {
  faceUp: React.ReactNode[];
  placeholders: number;
  pileLabel: string;
  pileRemaining: number;
  pileSubLabel?: string;
  pileTone: "amber" | "violet" | "slate" | "emerald";
  mutedPile?: boolean;
  pileInteractive?: boolean;
  pilePicked?: boolean;
  onClickPile?: () => void;
  pileClickTitle?: string;
}) {
  return (
    <div className="flex w-full flex-wrap items-stretch justify-between gap-2">
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
        interactive={pileInteractive}
        picked={pilePicked}
        onClick={onClickPile}
        clickTitle={pileClickTitle}
      />
    </div>
  );
}

// -----------------------------
// Card tiles — all share CARD_SIZE_CLASS
// -----------------------------

const baseTile = `relative flex flex-shrink-0 flex-col overflow-hidden rounded-md border-2 p-1.5 text-left shadow-[0_4px_12px_rgba(0,0,0,.4)] ring-1 ring-white/10 transition-transform duration-150 cursor-pointer hover:-translate-y-1 hover:scale-[1.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${CARD_SIZE_CLASS}`;

/**
 * Visual modifiers + click target for a conveyor card while the human
 * is in interactive buy mode. Returns the per-card class additions and
 * the click handler — when in buy mode the card picks the slot, when
 * not it opens the inspect modal.
 */
function useMarketBuyState(
  source: "conveyor" | "operations",
  slotIndex: number,
  cost: number,
) {
  const { state, buyMode, setBuyTarget, setInspect } = useGameStore();
  const inBuyMode = buyMode != null;
  const picked = buyMode?.pickedTarget;
  const isPicked =
    inBuyMode &&
    picked != null &&
    picked.source === source &&
    picked.slotIndex === slotIndex;
  // Wallet for affordability dimming: capital cards pay face value,
  // resource cards pay 1¢ each — same rules the engine enforces.
  const human = state?.players.find((p) => !p.isBot);
  const wallet = human
    ? human.hand.reduce((acc, c) => acc + paymentValue(c), 0)
    : 0;
  const affordable = wallet >= cost;
  const buyClass = !inBuyMode
    ? ""
    : isPicked
      ? "ring-4 ring-amber-300 ring-offset-1 ring-offset-slate-950 shadow-[0_0_24px_rgba(252,211,77,.55)]"
      : affordable
        ? "ring-2 ring-emerald-400/60"
        : "opacity-40 saturate-50";
  return {
    inBuyMode,
    affordable,
    buyClass,
    onClickCard: (payload: () => void) => () => {
      if (inBuyMode) {
        if (affordable) setBuyTarget({ source, slotIndex });
      } else {
        payload();
      }
    },
    setInspect,
  };
}

function ConveyorCard({ card, slotIndex }: { card: Card; slotIndex: number }) {
  const cost = card.cost ?? (card.type === "capital" ? card.capitalValue ?? 1 : 1);
  const value = paymentValue(card);
  const { buyClass, onClickCard, setInspect } = useMarketBuyState(
    "conveyor",
    slotIndex,
    cost,
  );
  if (card.type === "capital") {
    const chrome = CAPITAL_CHROME;
    const titleLabel = card.displayName ?? "Capital";
    return (
      <button
        type="button"
        onClick={onClickCard(() => setInspect({ kind: "capital", card }))}
        title={`${titleLabel} · pays B$${value} · costs B$${cost} to buy`}
        className={[baseTile, chrome.gradient, chrome.border, buyClass].join(" ")}
      >
        <Sheen />
        <CornerValue value={value} />
        <CornerCost cost={cost} />
        <div className="flex items-baseline justify-center px-7">
          <span className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${chrome.label}`}>
            Capital
          </span>
        </div>
        {card.displayName ? (
          <h4 className={`mt-0.5 line-clamp-2 font-display text-[15px] font-bold leading-tight drop-shadow-[0_1px_4px_rgba(0,0,0,.35)] ${chrome.ink}`}>
            {card.displayName}
          </h4>
        ) : null}
        {card.flavor ? (
          <p className={`mt-0.5 line-clamp-2 font-display text-[7.5px] italic leading-snug ${chrome.label} opacity-90`}>
            {card.flavor}
          </p>
        ) : null}
        <div className={`mt-auto flex flex-col items-center ${chrome.ink}`}>
          <MoneyText
            n={value}
            className="font-display text-[20px] font-bold leading-none drop-shadow-[0_2px_6px_rgba(0,0,0,.45)]"
          />
          <span className={`mt-0.5 font-mono text-[8px] uppercase tracking-[.16em] ${chrome.label}`}>
            spend
          </span>
        </div>
      </button>
    );
  }
  const subtype = card.subtype as ResourceSubtype;
  const chrome = RESOURCE_CHROME[subtype];
  const count = card.resourceCount ?? 1;
  const titleLabel = card.displayName ?? `${count > 1 ? `${count}× ` : ""}${RESOURCE_LABEL[subtype]}`;
  const isWildcard = (card.aliases?.length ?? 0) > 0;
  return (
    <button
      type="button"
      onClick={onClickCard(() => setInspect({ kind: "resource", card }))}
      title={`${titleLabel} · pays B$${value} · cost B$${cost}`}
      className={[baseTile, chrome.gradient, chrome.border, buyClass].join(" ")}
    >
      <Sheen />
      <CornerValue value={value} />
      <CornerCost cost={cost} />
      <div className="flex items-baseline justify-center px-7">
        <span className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${chrome.label}`}>
          {RESOURCE_LABEL[subtype]}
        </span>
      </div>
      <h4 className={`mt-0.5 line-clamp-2 font-display text-[15px] font-bold leading-tight drop-shadow-[0_1px_4px_rgba(0,0,0,.35)] ${chrome.ink}`}>
        {titleLabel}
      </h4>
      {card.flavor ? (
        <p className={`mt-0.5 line-clamp-2 font-display text-[7.5px] italic leading-snug ${chrome.label} opacity-90`}>
          {card.flavor}
        </p>
      ) : null}
      {isWildcard ? (
        <span className={`mt-0.5 font-mono text-[8px] uppercase tracking-[.10em] ${chrome.label} opacity-90`}>
          wildcard
        </span>
      ) : null}
      <div
        className={`mt-auto grid h-8 w-8 self-center place-items-center rounded-full border-2 bg-white/10 text-base shadow-[inset_0_1px_4px_rgba(255,255,255,.15)] backdrop-blur-sm ${chrome.border} ${chrome.ink}`}
      >
        {RESOURCE_GLYPH[subtype]}
      </div>
    </button>
  );
}

function EmptySlot() {
  return (
    <div
      className={`grid flex-shrink-0 cursor-default place-items-center rounded-md border-2 border-dashed border-slate-800 bg-slate-950/30 font-mono text-[8px] uppercase tracking-[.18em] text-slate-700 ${CARD_SIZE_CLASS}`}
    >
      empty
    </div>
  );
}

function MashBillTile({ bill }: { bill: MashBill }) {
  const { setInspect, drawBillMode, setDrawBillTarget } = useGameStore();
  const tier = tierOrCommon(bill.tier);
  const chrome = TIER_CHROME[tier];
  const cells: number[] = [];
  for (const row of bill.rewardGrid) for (const c of row) if (c !== null) cells.push(c);
  const peak = cells.length ? Math.max(...cells) : 0;
  const floor = cells.length ? Math.min(...cells) : 0;
  // In draw-bill step 1, the face-up bourbon row becomes click targets.
  const inDrawStep1 =
    drawBillMode != null &&
    !drawBillMode.blind &&
    !drawBillMode.pickedMashBillId;
  const isPickedDraw =
    drawBillMode != null && drawBillMode.pickedMashBillId === bill.id;
  const drawRing = isPickedDraw
    ? "ring-4 ring-amber-300 ring-offset-1 ring-offset-slate-950 shadow-[0_0_24px_rgba(252,211,77,.55)]"
    : inDrawStep1
      ? "ring-2 ring-amber-300/70 hover:ring-amber-200"
      : "";
  const onClick = () => {
    if (inDrawStep1) setDrawBillTarget({ mashBillId: bill.id });
    else setInspect({ kind: "mashbill", bill });
  };
  return (
    <button
      type="button"
      data-bourbon-row="true"
      onClick={onClick}
      title={
        inDrawStep1
          ? `Pick ${bill.name} — costs B$${bill.cost ?? 2}`
          : `${bill.name}${bill.slogan ? ` — ${bill.slogan}` : ""} · ${chrome.label_text}`
      }
      className={[baseTile, chrome.gradient, chrome.border, chrome.glow, drawRing].join(" ")}
    >
      <Sheen />
      <CornerCost cost={bill.cost ?? 2} />
      <div className="flex items-baseline justify-between pr-7">
        <span className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${chrome.label}`}>
          {chrome.label_text}
        </span>
        {bill.goldAward ? (
          <span className="text-[9px]" aria-hidden>🥇</span>
        ) : bill.silverAward ? (
          <span className="text-[9px]" aria-hidden>🥈</span>
        ) : null}
      </div>
      <h4 className={`mt-0.5 line-clamp-2 font-display text-[15px] font-bold leading-tight drop-shadow-[0_1px_4px_rgba(0,0,0,.35)] ${chrome.titleInk}`}>
        {bill.name}
      </h4>
      {bill.slogan ? (
        <p className={`mt-0.5 line-clamp-2 font-display text-[8px] italic leading-snug ${chrome.label} opacity-90`}>
          {bill.slogan}
        </p>
      ) : null}
      <RecipePips bill={bill} />
      <div className="mt-auto flex items-baseline justify-center gap-1">
        <span className={`font-display text-[16px] font-bold leading-none tabular-nums ${chrome.titleInk}`}>
          {floor}–{peak}
        </span>
        <span className={`font-mono text-[8px] uppercase tracking-[.16em] ${chrome.label}`}>
          rep
        </span>
      </div>
    </button>
  );
}

function InvestmentCardTile({ card }: { card: InvestmentCard }) {
  const { setInspect } = useGameStore();
  const toneByTier: Record<InvestmentCard["tier"], { border: string; gradient: string; ink: string; label: string }> = {
    cheap: {
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
    expensive: {
      border: "border-amber-400",
      gradient:
        "bg-[radial-gradient(110%_70%_at_50%_-10%,rgba(251,191,36,.22),transparent_55%),linear-gradient(180deg,rgba(146,64,14,.45)_0%,rgba(15,23,42,.95)_75%)]",
      ink: "text-amber-50",
      label: "text-amber-300",
    },
  };
  const chrome = toneByTier[card.tier];
  return (
    <button
      type="button"
      onClick={() => setInspect({ kind: "investment", card })}
      title={`${card.name} — ${card.short}\n\n${card.effect}`}
      className={[baseTile, chrome.gradient, chrome.border].join(" ")}
    >
      <Sheen />
      <CornerCost cost={card.cost} />
      <div className="flex items-baseline justify-between pr-7">
        <span className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${chrome.label}`}>
          Invest
        </span>
      </div>
      <h4 className={`mt-0.5 line-clamp-2 font-display text-[15px] font-bold leading-tight drop-shadow-[0_1px_4px_rgba(0,0,0,.35)] ${chrome.ink}`}>
        {card.name}
      </h4>
      <p className={`mt-0.5 line-clamp-3 font-display text-[9px] italic leading-snug ${chrome.label} opacity-90`}>
        {card.short}
      </p>
    </button>
  );
}

function OpsCardTile({
  card,
  slotIndex,
}: {
  card: OperationsCard;
  slotIndex: number;
}) {
  const { buyClass, onClickCard, setInspect } = useMarketBuyState(
    "operations",
    slotIndex,
    card.cost,
  );
  const chrome = OPS_CHROME;
  return (
    <button
      type="button"
      onClick={onClickCard(() => setInspect({ kind: "operations", card }))}
      title={`${card.name} — ${card.description}`}
      className={[baseTile, chrome.gradient, chrome.border, buyClass].join(" ")}
    >
      <Sheen />
      <CornerCost cost={card.cost} />
      <div className="flex items-baseline justify-between pr-7">
        <span className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${chrome.label}`}>
          Ops
        </span>
      </div>
      <h4 className={`mt-0.5 line-clamp-2 font-display text-[15px] font-bold leading-tight drop-shadow-[0_1px_4px_rgba(0,0,0,.35)] ${chrome.ink}`}>
        {card.name}
      </h4>
      {card.flavor ? (
        <p className={`mt-0.5 line-clamp-2 font-display text-[7.5px] italic leading-snug ${chrome.label} opacity-90`}>
          {card.flavor}
        </p>
      ) : null}
      <div
        className={`mt-auto grid h-8 w-8 self-center place-items-center rounded-full border-2 bg-white/10 text-base font-bold ${chrome.border} ${chrome.ink}`}
        aria-hidden
      >
        ⚡
      </div>
    </button>
  );
}

function DrawPile({
  label,
  remaining,
  subLabel,
  tone,
  muted = false,
  interactive = false,
  picked = false,
  onClick,
  clickTitle,
}: {
  label: string;
  remaining: number;
  subLabel?: string;
  tone: "amber" | "violet" | "slate" | "emerald";
  muted?: boolean;
  interactive?: boolean;
  picked?: boolean;
  onClick?: () => void;
  clickTitle?: string;
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
        : tone === "emerald"
          ? {
              border: "border-emerald-500/70",
              gradient:
                "bg-[linear-gradient(160deg,rgba(6,78,59,.65)_0%,rgba(15,23,42,.95)_75%)]",
              label: "text-emerald-300",
              ink: "text-emerald-100",
            }
          : {
              border: "border-slate-600/70",
              gradient:
                "bg-[linear-gradient(160deg,rgba(51,65,85,.6)_0%,rgba(15,23,42,.95)_75%)]",
              label: "text-slate-400",
              ink: "text-slate-200",
            };
  const ringClass = picked
    ? "ring-4 ring-amber-300 ring-offset-1 ring-offset-slate-950 shadow-[0_0_24px_rgba(252,211,77,.55)]"
    : interactive
      ? "ring-2 ring-amber-300/70 hover:ring-amber-200"
      : "";
  const titleText =
    interactive && clickTitle
      ? clickTitle
      : `${label} · ${remaining} card${remaining === 1 ? "" : "s"} remaining`;
  const baseClass = [
    baseTile,
    interactive ? "" : "cursor-default hover:translate-y-0 hover:scale-100",
    toneChrome.gradient,
    toneChrome.border,
    muted ? "opacity-60" : "",
    ringClass,
  ].join(" ");
  if (interactive && onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={titleText}
        data-bourbon-row="true"
        className={baseClass}
        aria-label={label}
      >
        <PileBody
          toneChrome={toneChrome}
          remaining={remaining}
          label={label}
          subLabel={subLabel}
        />
      </button>
    );
  }
  return (
    <div title={titleText} className={baseClass} aria-label={label}>
      <PileBody
        toneChrome={toneChrome}
        remaining={remaining}
        label={label}
        subLabel={subLabel}
      />
    </div>
  );
}

function PileBody({
  toneChrome,
  remaining,
  label,
  subLabel,
}: {
  toneChrome: { border: string; gradient: string; label: string; ink: string };
  remaining: number;
  label: string;
  subLabel?: string;
}) {
  return (
    <>
      <Sheen />
      <div className="pointer-events-none absolute inset-2 rounded border border-white/10" aria-hidden />
      <div className="flex items-baseline justify-between">
        <span className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${toneChrome.label}`}>
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
    </>
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

/**
 * Diagonal "PENDING FUTURE RELEASE" sash anchored to the parent
 * (which must be `position: relative`). The parent already greys
 * itself out via grayscale + low opacity; this overlay makes the
 * "feature off" status legible from across the room.
 */
function PendingOverlay() {
  return (
    <div
      className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden [filter:grayscale(0)] opacity-100"
      aria-hidden
    >
      <span className="rotate-[-8deg] rounded border-2 border-amber-400/80 bg-slate-950/85 px-4 py-1 font-mono text-[12px] font-bold uppercase tracking-[.18em] text-amber-200 shadow-[0_4px_18px_rgba(0,0,0,.65)]">
        Pending future release
      </span>
    </div>
  );
}
