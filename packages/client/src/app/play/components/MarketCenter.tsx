"use client";

/**
 * Center column — the public face of the table.
 *
 * Unified market: a single 10-tile face-up row holding resources,
 * Labor, ops, and investments. Mash bills live in a separate column
 * to the right with their own deck (the doomsday clock).
 *
 * **Every card on the table is the exact same fixed silhouette
 * (CARD_W × CARD_H).** The hand uses a slightly larger size; market
 * tiles run a bit smaller for density.
 */

import {
  type Card,
  type InvestmentCard,
  type MashBill,
  type OperationsCard,
  type ResourceSubtype,
} from "@bourbonomics/engine";
import { useGameStore } from "@/lib/store/game";
import {
  CARD_SIZE_CLASS,
  LABOR_CHROME,
  OPS_CHROME,
  RESOURCE_CHROME,
  RESOURCE_GLYPH,
  RESOURCE_LABEL,
  laborGlyphFor,
} from "./handCardStyles";
import { TIER_CHROME, tierOrCommon } from "./tierStyles";
import { CornerCost } from "./cardCorners";
import { useZoneFocusClass } from "./pickerFocus";
import RecipePips from "./RecipePips";
import { MoneyText } from "./money";

const MARKET_SIZE = 10;
const FACEUP_PER_SECTION = 3;

export default function MarketCenter() {
  const { state, drawBillMode, setDrawBillTarget } = useGameStore();

  if (!state) return null;

  const faceUpBills = state.bourbonFaceUp;
  const remainingBills = state.bourbonDeck.length;
  // Draw-bill mode wires the bourbon section as a click target during
  // step 1 (pick the bourbon — face-up tile or blind deck top).
  const drawStep1 =
    drawBillMode != null &&
    !drawBillMode.blind &&
    !drawBillMode.pickedMashBillId;
  const blindPicked = drawBillMode != null && drawBillMode.blind;

  const conveyorFocus = useZoneFocusClass("market-conveyor");
  const mashBillsFocus = useZoneFocusClass("market-mash-bills");

  return (
    // Unified market on top (10 tiles), bills column below. Both are
    // peer sections sharing chrome.
    <div data-bb-zone="market" className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
      <Section
        title="Market"
        zone="market-conveyor"
        focusClass={conveyorFocus}
        dataAttr="data-market-conveyor"
      >
        <div className="flex flex-1 flex-wrap items-stretch justify-between gap-2">
          {state.market.map((c, i) => (
            <ConveyorCard key={c.id} card={c} slotIndex={i} />
          ))}
          {Array.from({
            length: Math.max(0, MARKET_SIZE - state.market.length),
          }).map((_, i) => (
            <EmptySlot key={`empty-${i}`} />
          ))}
        </div>
      </Section>

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
 *   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
 *   â”‚ T â”‚ â•Ž  [card] [card] [card] ...                     â”‚
 *   â”‚ I â”‚ â•Ž                                                â”‚
 *   â”‚ T â”‚ â•Ž                                                â”‚
 *   â”‚ L â”‚ â•Ž                                                â”‚
 *   â”‚ E â”‚ â•Ž                                                â”‚
 *   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
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
        // Fixed height = card (140) + padding (p-1.5 â†’ 12) + border (2)
        // + 4px breathing room. Locks the box to card-and-a-half-buffer
        // so the layout never tries to stretch a row taller than its
        // contents and start a vertical scrollbar.
        "relative flex h-[158px] items-stretch gap-2 rounded-lg border border-slate-800 bg-slate-950/40 p-1.5",
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
      {/* Vertical lining â€” anchors the title against the card row. */}
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
// Card tiles â€” all share CARD_SIZE_CLASS
// -----------------------------

const baseTile = `relative flex flex-shrink-0 flex-col overflow-hidden rounded-md border-2 p-1.5 text-left shadow-[0_4px_12px_rgba(0,0,0,.4)] ring-1 ring-white/10 transition-transform duration-150 cursor-pointer hover:-translate-y-1 hover:scale-[1.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${CARD_SIZE_CLASS}`;

/**
 * Visual modifiers + click target for a conveyor card while the human
 * is in interactive buy mode. Returns the per-card class additions and
 * the click handler.
 *
 * Click semantics (Pass 2 of the card-interaction overhaul):
 * - In buy mode: click picks this slot as the buy target (existing).
 * - Outside buy mode, on the human's turn, with the card affordable:
 *   click STARTS buy mode, pre-targets this slot, and carries any
 *   currently multi-selected hand cards over as the proposed spend.
 *   This lets the player skip the toolbar's BUY MARKET button entirely
 *   â€” the muted picker was hard to find.
 * - Otherwise (not your turn, can't afford, or no useful action): click
 *   falls back to the inspect modal so the card is still readable.
 */
function useMarketBuyState(
  _source: "conveyor" | "operations",
  slotIndex: number,
  cost: number,
) {
  const {
    state,
    buyMode,
    startBuyMode,
    setBuyTarget,
    setInspect,
    selectedHandCardIds,
    toggleBuySpend,
    multiplayerMode,
    tutorialSpotlight,
  } = useGameStore();
  const inBuyMode = buyMode != null;
  const picked = buyMode?.pickedTarget;
  const isPicked = inBuyMode && picked != null && picked.slotIndex === slotIndex;
  // Some other slot is the picked target — used to mute me hard so the
  // single picked card and the chosen hand cards are the only bright
  // things on screen.
  const someoneElsePicked =
    inBuyMode && picked != null && picked.slotIndex !== slotIndex;
  // Wallet for affordability dimming: rep + Labor in hand cover the
  // posted cost (the engine enforces the precise rules at apply time).
  const human = state?.players.find((p) => !p.isBot);
  const wallet = human
    ? human.reputation +
      human.hand.reduce(
        (acc, c) =>
          c.type === "labor" ? acc + (c.laborContribution ?? 1) : acc,
        0,
      )
    : 0;
  const affordable = wallet >= cost;
  // Turn gate for direct-buy. Mirrors ActionBar's `disabledByTurn` rule
  // so the click can't smuggle the player into buy mode while a bot is
  // on the clock or the game is between phases. The bail-out useEffect
  // in the store would clear the mode anyway, but blocking up-front
  // avoids a one-frame flicker of the BuyOverlay.
  const seatId = multiplayerMode ? multiplayerMode.playerId : human?.id;
  const isMyTurn =
    !!state &&
    state.phase === "action" &&
    state.players[state.currentPlayerIndex]?.id === seatId;
  // Tutorial gating. When an await-action beat spotlights a specific
  // market slot, lock the OTHER slots out of any buy action â€” clicks
  // on non-spotlit cards fall through to inspect, and the cards mute
  // hard. Only the conveyor is gated this way; the ops row is gated
  // independently if a future beat spotlights it.
  const tutorialMarketSlot =
    tutorialSpotlight?.kind === "market-slot"
      ? tutorialSpotlight.slotIndex
      : null;
  const isTutorialBlocked =
    tutorialMarketSlot != null && tutorialMarketSlot !== slotIndex;
  const isTutorialSpotlit =
    tutorialMarketSlot != null && tutorialMarketSlot === slotIndex;
  const buyClass = isTutorialBlocked
    ? "opacity-30 saturate-50"
    : !inBuyMode
      ? ""
      : isPicked
        ? "ring-4 ring-amber-300 ring-offset-1 ring-offset-slate-950 shadow-[0_0_24px_rgba(252,211,77,.55)]"
        : someoneElsePicked
          ? // Some other card is picked â€” focus collapses onto the picked
            // card + the hand spend cards. Mute me hard so the eye lands
            // on the BuyOverlay's Confirm without distraction.
            "opacity-30 saturate-50"
          : affordable
            ? "ring-2 ring-emerald-400/60"
            : "opacity-40 saturate-50";
  // Shimmer stops the moment the spotlit tile becomes the picked buy
  // target â€” the picked-card ring + BuyOverlay carry the focus from
  // there, no need to keep pulsing.
  const shouldShimmer = isTutorialSpotlit && !isPicked;
  return {
    inBuyMode,
    affordable,
    buyClass,
    isTutorialBlocked,
    shouldShimmer,
    onClickCard: (payload: () => void) => () => {
      if (isTutorialBlocked) {
        // Inspect-only during a tutorial that locks this slot out.
        payload();
        return;
      }
      if (inBuyMode) {
        if (affordable) setBuyTarget({ slotIndex });
        return;
      }
      if (isMyTurn && affordable) {
        // Snapshot the multi-selection now — startBuyMode clears it.
        const preSelected = [...selectedHandCardIds];
        startBuyMode();
        setBuyTarget({ slotIndex });
        for (const id of preSelected) toggleBuySpend(id);
        return;
      }
      payload();
    },
    setInspect,
  };
}

function ConveyorCard({ card, slotIndex }: { card: Card; slotIndex: number }) {
  const cost = card.cost ?? 1;
  const { buyClass, onClickCard, setInspect, shouldShimmer } =
    useMarketBuyState("conveyor", slotIndex, cost);
  // `data-market-slot-index` is consumed by the tutorial SpotlightLayer
  // to focus a specific tile (instead of the whole conveyor row).
  // `animate-bb-shimmer` flags the spotlit tile during the tutorial so
  // the player's eye snaps to it.
  const slotAttr = { "data-market-slot-index": slotIndex } as Record<
    string,
    number
  >;
  const shimmer = shouldShimmer ? "animate-bb-shimmer" : "";
  if (card.type === "labor") {
    const chrome = LABOR_CHROME;
    const sub = card.laborSubtype;
    const subtypeLabel =
      sub === "marketing" ? "Marketing" :
      sub === "cooper" ? "Cooper" :
      sub === "architect" ? "Architect" :
      "Worker";
    const contribution = card.laborContribution ?? 1;
    const titleLabel = card.displayName ?? `${subtypeLabel} Labor`;
    return (
      <button
        type="button"
        {...slotAttr}
        onClick={onClickCard(() => setInspect({ kind: "labor", card }))}
        onContextMenu={(e) => {
          e.preventDefault();
          setInspect({ kind: "labor", card });
        }}
        title={`${titleLabel} Â· contributes +${contribution} toward ${sub === "generic" || !sub ? "any" : sub.replace("_", " ")} buys Â· costs ${cost} rep to acquire`}
        className={[baseTile, chrome.gradient, chrome.border, buyClass, shimmer].join(" ")}
      >
        <Sheen />
        <CornerCost cost={cost} />
        <div className="flex items-baseline justify-center px-7">
          <span className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${chrome.label}`}>
            Labor
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
        <div className={`mt-auto flex flex-col items-center ${chrome.ink}`}>
          <span
            aria-hidden
            className="font-display text-[20px] leading-none drop-shadow-[0_2px_6px_rgba(0,0,0,.45)]"
          >
            {laborGlyphFor(sub)}
          </span>
          <span className={`mt-0.5 font-mono text-[8px] uppercase tracking-[.16em] ${chrome.label}`}>
            +{contribution} Â· {subtypeLabel === "Worker" ? "any buy" : subtypeLabel.toLowerCase()}
          </span>
        </div>
      </button>
    );
  }
  if (card.type === "operations" && card.opSpec) {
    return (
      <OpsTileFromMarket
        card={card}
        slotIndex={slotIndex}
        cost={cost}
        buyClass={buyClass}
        shimmer={shimmer}
        onClickCard={onClickCard}
        setInspect={setInspect}
      />
    );
  }
  if (card.type === "investment" && card.investmentSpec) {
    return (
      <InvestmentTileFromMarket
        card={card}
        slotIndex={slotIndex}
        cost={cost}
        buyClass={buyClass}
        shimmer={shimmer}
        onClickCard={onClickCard}
        setInspect={setInspect}
      />
    );
  }
  const subtype = card.subtype as ResourceSubtype;
  const chrome = RESOURCE_CHROME[subtype];
  const count = card.resourceCount ?? 1;
  const titleLabel = card.displayName ?? `${count > 1 ? `${count}Ã— ` : ""}${RESOURCE_LABEL[subtype]}`;
  const isWildcard = (card.aliases?.length ?? 0) > 0;
  return (
    <button
      type="button"
      {...slotAttr}
      onClick={onClickCard(() => setInspect({ kind: "resource", card }))}
      onContextMenu={(e) => {
        e.preventDefault();
        setInspect({ kind: "resource", card });
      }}
      title={`${titleLabel} · costs ${cost} rep`}
      className={[baseTile, chrome.gradient, chrome.border, buyClass, shimmer].join(" ")}
    >
      <Sheen />
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

interface TileFromMarketProps {
  card: Card;
  slotIndex: number;
  cost: number;
  buyClass: string;
  shimmer: string;
  onClickCard: (payload: () => void) => () => void;
  setInspect: (
    payload:
      | { kind: "operations"; card: OperationsCard }
      | { kind: "investment"; card: InvestmentCard },
  ) => void;
}

function OpsTileFromMarket({
  card,
  slotIndex,
  cost,
  buyClass,
  shimmer,
  onClickCard,
  setInspect,
}: TileFromMarketProps) {
  const spec = card.opSpec!;
  const chrome = OPS_CHROME;
  return (
    <button
      type="button"
      data-market-slot-index={slotIndex}
      onClick={onClickCard(() => setInspect({ kind: "operations", card: spec }))}
      onContextMenu={(e) => {
        e.preventDefault();
        setInspect({ kind: "operations", card: spec });
      }}
      title={`${spec.name} — ${spec.description}`}
      className={[baseTile, chrome.gradient, chrome.border, buyClass, shimmer].join(" ")}
    >
      <Sheen />
      <CornerCost cost={cost} />
      <div className="flex items-baseline justify-between pr-7">
        <span className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${chrome.label}`}>
          Ops
        </span>
      </div>
      <h4 className={`mt-0.5 line-clamp-2 font-display text-[15px] font-bold leading-tight drop-shadow-[0_1px_4px_rgba(0,0,0,.35)] ${chrome.ink}`}>
        {spec.name}
      </h4>
      {spec.flavor ? (
        <p className={`mt-0.5 line-clamp-2 font-display text-[7.5px] italic leading-snug ${chrome.label} opacity-90`}>
          {spec.flavor}
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

function InvestmentTileFromMarket({
  card,
  slotIndex,
  cost,
  buyClass,
  shimmer,
  onClickCard,
  setInspect,
}: TileFromMarketProps) {
  const spec = card.investmentSpec!;
  // Reuse the Labor slate palette with an emerald accent — investments
  // share the "infrastructure" feel.
  return (
    <button
      type="button"
      data-market-slot-index={slotIndex}
      onClick={onClickCard(() => setInspect({ kind: "investment", card: spec }))}
      onContextMenu={(e) => {
        e.preventDefault();
        setInspect({ kind: "investment", card: spec });
      }}
      title={`${spec.name} · ${spec.short} · effect pending`}
      className={[
        baseTile,
        "bg-gradient-to-b from-emerald-900/55 via-slate-800/90 to-slate-950",
        "border-emerald-500/60",
        buyClass,
        shimmer,
      ].join(" ")}
    >
      <Sheen />
      <CornerCost cost={cost} />
      <div className="flex items-baseline justify-between pr-7">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300">
          Invest
        </span>
      </div>
      <h4 className="mt-0.5 line-clamp-2 font-display text-[14px] font-bold leading-tight drop-shadow-[0_1px_4px_rgba(0,0,0,.35)] text-emerald-50">
        {spec.name}
      </h4>
      <p className="mt-0.5 line-clamp-3 font-display text-[8px] italic leading-snug text-emerald-200 opacity-90">
        {spec.short}
      </p>
      <div className="mt-auto flex flex-col items-center text-emerald-100">
        <span aria-hidden className="font-display text-[18px] leading-none">📈</span>
        <span className="mt-0.5 font-mono text-[7.5px] uppercase tracking-[.14em] text-emerald-300">
          effect pending
        </span>
      </div>
    </button>
  );
}

function MashBillTile({ bill }: { bill: MashBill }) {
  const {
    state,
    setInspect,
    drawBillMode,
    startDrawBillMode,
    setDrawBillTarget,
    selectedHandCardIds,
    toggleDrawBillSpend,
    multiplayerMode,
    buyMode,
    ageMode,
    sellMode,
    makeMode,
  } = useGameStore();
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
  // Auto-engage gate. Mirrors the click-to-buy in `useMarketBuyState`:
  // outside any picker mode, on the human's turn, with at least one
  // open rickhouse slot (DRAW_MASH_BILL needs somewhere to land), a
  // click on a bill enters draw-bill mode and pre-targets it. The
  // hand multi-selection (Pass 1) is carried into the sacrifice list.
  // No always-on ring for the auto-draw affordance â€” `baseTile`'s
  // cursor-pointer + hover lift already telegraph "clickable", and a
  // permanent amber glow on every face-up bill would be too noisy.
  const inAnyOtherPicker =
    buyMode != null || ageMode != null || sellMode != null || makeMode != null;
  const human = state?.players.find((p) => !p.isBot);
  const seatId = multiplayerMode ? multiplayerMode.playerId : human?.id;
  const isMyTurn =
    state != null &&
    state.phase === "action" &&
    state.players[state.currentPlayerIndex]?.id === seatId;
  const hasOpenSlot =
    state != null &&
    human != null &&
    human.rickhouseSlots.some(
      (s) => !state.allBarrels.some((b) => b.slotId === s.id),
    );
  const canAutoDraw =
    !drawBillMode && !inAnyOtherPicker && isMyTurn && hasOpenSlot;
  const drawRing = isPickedDraw
    ? "ring-4 ring-amber-300 ring-offset-1 ring-offset-slate-950 shadow-[0_0_24px_rgba(252,211,77,.55)]"
    : inDrawStep1
      ? "ring-2 ring-amber-300/70 hover:ring-amber-200"
      : "";
  const onClick = () => {
    if (inDrawStep1) {
      setDrawBillTarget({ mashBillId: bill.id });
      return;
    }
    if (canAutoDraw) {
      const preSelected = [...selectedHandCardIds];
      startDrawBillMode();
      setDrawBillTarget({ mashBillId: bill.id });
      for (const id of preSelected) toggleDrawBillSpend(id);
      return;
    }
    setInspect({ kind: "mashbill", bill });
  };
  return (
    <button
      type="button"
      data-bourbon-row="true"
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        setInspect({ kind: "mashbill", bill });
      }}
      title={
        inDrawStep1
          ? `Pick ${bill.name} â€” costs B$${bill.cost ?? 2}`
          : canAutoDraw
            ? `${bill.name}${bill.slogan ? ` â€” ${bill.slogan}` : ""} Â· click to draw (sacrifices a hand card), right-click to inspect`
            : `${bill.name}${bill.slogan ? ` â€” ${bill.slogan}` : ""} Â· ${chrome.label_text}`
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
          <span className="text-[9px]" aria-hidden>ðŸ¥‡</span>
        ) : bill.silverAward ? (
          <span className="text-[9px]" aria-hidden>ðŸ¥ˆ</span>
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
          {floor}â€“{peak}
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
  const chrome = toneByTier[card.tier];
  return (
    <button
      type="button"
      onClick={() => setInspect({ kind: "investment", card })}
      onContextMenu={(e) => {
        e.preventDefault();
        setInspect({ kind: "investment", card });
      }}
      title={`${card.name} â€” ${card.short}\n\n${card.text}`}
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
      onContextMenu={(e) => {
        e.preventDefault();
        setInspect({ kind: "operations", card });
      }}
      title={`${card.name} â€” ${card.description}`}
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
        âš¡
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
      : `${label} Â· ${remaining} card${remaining === 1 ? "" : "s"} remaining`;
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
