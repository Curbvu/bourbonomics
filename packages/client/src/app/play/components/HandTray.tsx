"use client";

/**
 * HandTray — bottom-of-canvas strip showing the focused player's hand.
 *
 * Visual idiom ported from the dev branch: every hand item is a
 * portrait-oriented mini card (112×128) with a type-coloured gradient,
 * a centered glyph, and an accordion-fan layout (cards overlap left-to-
 * right; hover lifts and lifts to z-50). Three sections are stacked:
 * Resources / Capital / Bourbon-bills · Ops / Reputation summary.
 *
 * v2 is computer-driven during the action phase, so cards aren't click
 * targets — they're informational. The setup-phase modals own all human
 * input.
 */

import type {
  Card,
  GameState,
  MashBill,
  OperationsCard,
  PlayerState,
  ResourceSubtype,
} from "@bourbonomics/engine";
import { useGameStore } from "@/lib/store/game";
import ActionBar from "./ActionBar";
import BuyOverlay from "./BuyOverlay";
import PlayerSwatch from "./PlayerSwatch";
import {
  CAPITAL_CHROME,
  CARD_SIZE_CLASS,
  HAND_CARD_OVERLAP,
  OPS_CHROME,
  RESOURCE_CHROME,
  RESOURCE_GLYPH,
  RESOURCE_LABEL,
} from "./handCardStyles";
import { TIER_CHROME, tierOrCommon } from "./tierStyles";

export default function HandTray() {
  const { state, seatMeta } = useGameStore();
  if (!state) return null;
  const focused = focusedPlayer(state);
  if (!focused) return null;
  const playerIndex = state.players.findIndex((p) => p.id === focused.id);
  const meta = seatMeta.find((m) => m.id === focused.id);

  // Capital is a resource — render them in a single mixed row, sorted
  // so the row reads consistently (capital first, then by subtype).
  const handCards = [...focused.hand].sort((a, b) => {
    const order = (c: typeof a) =>
      c.type === "capital" ? 0 : SUBTYPE_ORDER[c.subtype ?? "cask"] ?? 99;
    return order(a) - order(b);
  });

  return (
    <div className="border-t border-slate-800 bg-slate-950/90">
      {/* Interactive Buy mode — sticky bar above the action bar; only
          paints when the player has clicked Buy market. */}
      <BuyOverlay />
      {/* Action bar — controls for the human seat during the action phase. */}
      <ActionBar />

      {/* Identity + reputation strip */}
      <div className="flex items-center gap-4 border-b border-slate-900 px-[22px] py-2.5">
        <div className="flex items-center gap-2">
          <PlayerSwatch
            seatIndex={playerIndex}
            logoId={meta?.logoId}
            size="md"
          />
          <div className="flex flex-col leading-tight">
            <span className="font-display text-[16px] font-semibold text-slate-100">
              {focused.name}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[.12em] text-slate-500">
              {focused.distillery?.name ?? "no distillery"}
              {" · "}
              hand {focused.hand.length}/{focused.handSize}
            </span>
          </div>
        </div>
        <span className="mx-2 h-[26px] w-px bg-slate-800" aria-hidden />
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[.18em] text-amber-300/80">
            Reputation
          </span>
          <span className="font-display text-[34px] font-bold leading-none tabular-nums text-amber-300 drop-shadow-[0_3px_6px_rgba(0,0,0,.55)]">
            {focused.reputation}
          </span>
        </div>
        <span className="flex-1" />
        <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[.10em] text-slate-500">
          <Stat label="deck" value={focused.deck.length} />
          <Stat label="disc" value={focused.discard.length} />
          <Stat label="sold" value={focused.barrelsSold} />
          <Stat label="🥇" value={focused.unlockedGoldBourbons.length} />
        </div>
      </div>

      {/* Card sections — laid out left-to-right with the deck pile
          anchored at the far-left, and the (mixed) Resources accordion
          taking the remaining space. No horizontal scrollbar: the
          accordion clips overflow and the cards fan tighter via
          HAND_CARD_OVERLAP. */}
      <div className="flex items-stretch gap-[14px] overflow-hidden px-[22px] py-3">
        {/* Deck pile — far left. Two stacked counters: deck + discard. */}
        <DeckPile deckCount={focused.deck.length} discardCount={focused.discard.length} />

        <Divider />

        {/* Resources (capital folded in — capital is a resource). Takes
            the remaining space; flex-1 + min-w-0 lets it shrink instead
            of overflowing the row. */}
        <Section caption="resources" count={handCards.length} grow>
          {handCards.length === 0 ? (
            <EmptyPill>no cards</EmptyPill>
          ) : (
            <CardAccordion>
              {handCards.map((c, i) =>
                c.type === "capital" ? (
                  <CapitalCard key={c.id} card={c} indexInRow={i} />
                ) : (
                  <ResourceCard key={c.id} card={c} indexInRow={i} />
                ),
              )}
            </CardAccordion>
          )}
        </Section>

        <Divider />

        {/* Mash bills */}
        <Section caption="mash bills" count={focused.mashBills.length}>
          {focused.mashBills.length === 0 ? (
            <EmptyPill>no mash bills</EmptyPill>
          ) : (
            <CardAccordion>
              {focused.mashBills.map((m, i) => (
                <MashBillCard key={m.id} bill={m} indexInRow={i} />
              ))}
            </CardAccordion>
          )}
        </Section>

        <Divider />

        {/* Operations */}
        <Section caption="ops" count={focused.operationsHand.length}>
          {focused.operationsHand.length === 0 ? (
            <EmptyPill>no ops</EmptyPill>
          ) : (
            <CardAccordion>
              {focused.operationsHand.map((c, i) => (
                <OpsCard key={c.id} card={c} indexInRow={i} />
              ))}
            </CardAccordion>
          )}
        </Section>
      </div>
    </div>
  );
}

/** Stable ordering inside the mixed Resources row. */
const SUBTYPE_ORDER: Record<string, number> = {
  cask: 1,
  corn: 2,
  rye: 3,
  barley: 4,
  wheat: 5,
};

/**
 * Two-card silhouette showing the player's deck + discard counts in the
 * dev-branch "cash" position. Self-contained — no clicks. The visuals
 * are intentionally minimal: a stacked deck back + the running totals.
 */
function DeckPile({ deckCount, discardCount }: { deckCount: number; discardCount: number }) {
  return (
    <div className="flex flex-shrink-0 items-stretch gap-3">
      <div className="flex flex-col items-end justify-between py-1">
        <VerticalCaption>deck</VerticalCaption>
      </div>
      <div className="flex items-end gap-2">
        <PileTile label="Deck" count={deckCount} accent="emerald" />
        <PileTile label="Discard" count={discardCount} accent="amber" />
      </div>
    </div>
  );
}

function PileTile({
  label,
  count,
  accent,
}: {
  label: string;
  count: number;
  accent: "emerald" | "amber";
}) {
  const palette =
    accent === "emerald"
      ? {
          border: "border-emerald-500/70",
          gradient:
            "bg-[linear-gradient(160deg,rgba(6,78,59,.65)_0%,rgba(15,23,42,.95)_75%)]",
          ink: "text-emerald-100",
          label: "text-emerald-300",
        }
      : {
          border: "border-amber-500/70",
          gradient:
            "bg-[linear-gradient(160deg,rgba(120,53,15,.65)_0%,rgba(15,23,42,.95)_75%)]",
          ink: "text-amber-100",
          label: "text-amber-300",
        };
  return (
    <div
      title={`${label} · ${count} card${count === 1 ? "" : "s"}`}
      className={[
        "relative flex flex-col items-center justify-between overflow-hidden rounded-md border-2 p-1.5 ring-1 ring-white/10",
        palette.border,
        palette.gradient,
        CARD_SIZE_CLASS,
      ].join(" ")}
    >
      {/* Faux stacked-cards depth */}
      <span
        className={`pointer-events-none absolute inset-2 rounded border ${palette.border} opacity-60`}
        aria-hidden
      />
      <span
        className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent`}
        aria-hidden
      />
      <span className={`mt-0.5 font-mono text-[9px] font-semibold uppercase tracking-[.18em] ${palette.label}`}>
        {label}
      </span>
      <span className={`font-display text-[40px] font-bold leading-none tabular-nums drop-shadow-[0_3px_6px_rgba(0,0,0,.55)] ${palette.ink}`}>
        {count}
      </span>
      <span className={`mb-0.5 font-mono text-[8px] uppercase tracking-[.14em] ${palette.label}`}>
        cards
      </span>
    </div>
  );
}

function focusedPlayer(state: GameState): PlayerState | null {
  if (state.players.length === 0) return null;
  const human = state.players.find((p) => !p.isBot);
  if (human) return human;
  if (state.phase === "action") {
    return state.players[state.currentPlayerIndex] ?? state.players[0]!;
  }
  return state.players[0]!;
}

// -----------------------------
// Layout helpers
// -----------------------------

function Section({
  caption,
  count,
  grow = false,
  children,
}: {
  caption: string;
  count?: number;
  /** When true, the section expands to absorb the remaining row width. */
  grow?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={[
        "flex items-stretch gap-2",
        grow ? "min-w-0 flex-1" : "flex-shrink-0",
      ].join(" ")}
    >
      <div className="flex flex-col items-end justify-between py-1">
        <VerticalCaption>{caption}</VerticalCaption>
        {count !== undefined ? (
          <span className="font-mono text-[9px] uppercase tracking-[.12em] tabular-nums text-slate-600">
            {count}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function VerticalCaption({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="self-stretch font-mono text-[10px] uppercase tracking-[.12em] text-slate-500"
      style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
    >
      {children}
    </span>
  );
}

function Divider() {
  return (
    <span
      className="block w-px flex-shrink-0 self-stretch bg-slate-800"
      aria-hidden
    />
  );
}

function EmptyPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="self-center rounded border border-dashed border-slate-700 px-2.5 py-1 font-mono text-[11px] italic text-slate-500">
      {children}
    </span>
  );
}

/**
 * Accordion fan — children overlap horizontally; hovering lifts the
 * card and pops it to z-50 so it can be read in full. The container
 * shrinks to fit the available row width (no horizontal scrollbar);
 * if the hand grows past what fits, rightmost cards clip into the
 * neighbouring section but stay hover-readable.
 */
function CardAccordion({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 items-end py-2 pl-2 pr-3">
      <div className="flex min-w-0 items-end">{children}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span className="flex items-baseline gap-1">
      <span>{label}</span>
      <span className="font-sans text-[12px] tabular-nums text-slate-200">
        {value}
      </span>
    </span>
  );
}

// -----------------------------
// Mini cards
// -----------------------------

const baseCardChrome = `relative flex flex-shrink-0 flex-col overflow-hidden rounded-md border-2 p-1.5 text-left shadow-[0_4px_12px_rgba(0,0,0,.4)] ring-1 ring-white/10 transition-all duration-200 ${CARD_SIZE_CLASS}`;

const liftClass =
  "cursor-pointer hover:z-50 hover:-translate-y-3 hover:scale-[1.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300";

function ResourceCard({ card, indexInRow }: { card: Card; indexInRow: number }) {
  const { setInspect, buyMode, toggleBuySpend } = useGameStore();
  const subtype = card.subtype as ResourceSubtype;
  const chrome = RESOURCE_CHROME[subtype];
  const overlap = indexInRow === 0 ? "" : HAND_CARD_OVERLAP;
  const count = card.resourceCount ?? 1;
  const inBuyMode = buyMode != null;
  const isSelected = inBuyMode && buyMode!.spendCardIds.includes(card.id);
  const buyClass = !inBuyMode
    ? ""
    : isSelected
      ? "ring-4 ring-amber-300 ring-offset-1 ring-offset-slate-950 shadow-[0_0_24px_rgba(252,211,77,.55)]"
      : "ring-2 ring-emerald-400/60";
  const onClick = () => {
    if (inBuyMode) toggleBuySpend(card.id);
    else setInspect({ kind: "resource", card });
  };
  return (
    <button
      type="button"
      onClick={onClick}
      title={
        inBuyMode
          ? `${isSelected ? "Unselect" : "Select"} this card to pay 1¢`
          : `${RESOURCE_LABEL[subtype]}${count > 1 ? ` · counts as ${count}` : ""}`
      }
      className={[baseCardChrome, chrome.gradient, chrome.border, overlap, liftClass, buyClass].join(" ")}
    >
      {inBuyMode && isSelected ? (
        <span
          className="pointer-events-none absolute right-1 top-1 z-10 grid h-5 w-5 place-items-center rounded-full bg-amber-400 text-slate-950 text-[10px] font-bold shadow-md"
          aria-hidden
        >
          ✓
        </span>
      ) : null}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
        aria-hidden
      />
      <div className="flex items-baseline justify-between">
        <span className={`text-[9px] font-semibold uppercase tracking-[0.18em] ${chrome.label}`}>
          {RESOURCE_LABEL[subtype]}
        </span>
        {count > 1 ? (
          <span className={`rounded border px-1 py-px font-mono text-[8px] font-bold uppercase tracking-[.10em] ${chrome.borderSoft} ${chrome.ink}`}>
            ×{count}
          </span>
        ) : null}
      </div>
      <h4 className={`mt-1 font-display text-[13px] font-bold leading-tight drop-shadow-[0_1px_4px_rgba(0,0,0,.35)] ${chrome.ink}`}>
        {count > 1 ? `${count}× ${RESOURCE_LABEL[subtype]}` : RESOURCE_LABEL[subtype]}
      </h4>
      <div
        className={`mt-auto grid h-10 w-10 self-center place-items-center rounded-full border-2 bg-white/10 text-xl shadow-[inset_0_1px_4px_rgba(255,255,255,.15)] backdrop-blur-sm ${chrome.border} ${chrome.ink}`}
      >
        {RESOURCE_GLYPH[subtype]}
      </div>
    </button>
  );
}

function CapitalCard({ card, indexInRow }: { card: Card; indexInRow: number }) {
  const { setInspect, buyMode, toggleBuySpend } = useGameStore();
  const value = card.capitalValue ?? 1;
  const chrome = CAPITAL_CHROME;
  const overlap = indexInRow === 0 ? "" : HAND_CARD_OVERLAP;
  const inBuyMode = buyMode != null;
  const isSelected = inBuyMode && buyMode!.spendCardIds.includes(card.id);
  const buyClass = !inBuyMode
    ? ""
    : isSelected
      ? "ring-4 ring-amber-300 ring-offset-1 ring-offset-slate-950 shadow-[0_0_24px_rgba(252,211,77,.55)]"
      : "ring-2 ring-emerald-400/60";
  const onClick = () => {
    if (inBuyMode) toggleBuySpend(card.id);
    else setInspect({ kind: "capital", card });
  };
  return (
    <button
      type="button"
      onClick={onClick}
      title={
        inBuyMode
          ? `${isSelected ? "Unselect" : "Select"} this $${value} capital card to spend`
          : `Capital · pays $${value} at the market`
      }
      className={[baseCardChrome, chrome.gradient, chrome.border, overlap, liftClass, buyClass].join(" ")}
    >
      {inBuyMode && isSelected ? (
        <span
          className="pointer-events-none absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-amber-400 text-slate-950 text-[10px] font-bold shadow-md"
          aria-hidden
        >
          ✓
        </span>
      ) : null}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
        aria-hidden
      />
      <div className="flex items-baseline justify-between">
        <span className={`text-[9px] font-semibold uppercase tracking-[0.18em] ${chrome.label}`}>
          Capital
        </span>
      </div>
      <div className={`mt-auto flex flex-col items-center ${chrome.ink}`}>
        <span className="font-display text-[34px] font-bold leading-none tabular-nums drop-shadow-[0_2px_6px_rgba(0,0,0,.45)]">
          ${value}
        </span>
        <span className={`mt-1 font-mono text-[9px] uppercase tracking-[.18em] ${chrome.label}`}>
          spend
        </span>
      </div>
    </button>
  );
}

function MashBillCard({ bill, indexInRow }: { bill: MashBill; indexInRow: number }) {
  const { setInspect } = useGameStore();
  const tier = tierOrCommon(bill.tier);
  const chrome = TIER_CHROME[tier];
  const overlap = indexInRow === 0 ? "" : HAND_CARD_OVERLAP;
  // Compact reward range from the grid for a single glance.
  const cells: number[] = [];
  for (const row of bill.rewardGrid) {
    for (const c of row) if (c !== null) cells.push(c);
  }
  const peak = cells.length ? Math.max(...cells) : 0;
  const floor = cells.length ? Math.min(...cells) : 0;
  return (
    <button
      type="button"
      onClick={() => setInspect({ kind: "mashbill", bill })}
      title={`${bill.name}${bill.slogan ? ` — ${bill.slogan}` : ""} · ${chrome.label_text}`}
      className={[baseCardChrome, chrome.gradient, chrome.border, chrome.glow, overlap, liftClass].join(" ")}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
        aria-hidden
      />
      <div className="flex items-baseline justify-between">
        <span className={`text-[8px] font-semibold uppercase tracking-[0.16em] ${chrome.label}`}>
          {chrome.label_text}
        </span>
        {bill.goldAward ? <span className="text-[9px]" aria-hidden>🥇</span> : bill.silverAward ? <span className="text-[9px]" aria-hidden>🥈</span> : null}
      </div>
      <h4 className={`mt-0.5 line-clamp-2 font-display text-[10px] font-bold leading-tight drop-shadow-[0_1px_4px_rgba(0,0,0,.35)] ${chrome.titleInk}`}>
        {bill.name}
      </h4>
      {bill.slogan ? (
        <p className={`mt-0.5 line-clamp-2 font-display text-[8px] italic leading-snug ${chrome.label} opacity-90`}>
          {bill.slogan}
        </p>
      ) : null}
      <div className="mt-auto flex items-baseline justify-center gap-1">
        <span className={`font-display text-[14px] font-bold leading-none tabular-nums ${chrome.titleInk}`}>
          {floor}–{peak}
        </span>
        <span className={`font-mono text-[7.5px] uppercase tracking-[.16em] ${chrome.label}`}>
          rep
        </span>
      </div>
    </button>
  );
}

function OpsCard({ card, indexInRow }: { card: OperationsCard; indexInRow: number }) {
  const { setInspect } = useGameStore();
  const chrome = OPS_CHROME;
  const overlap = indexInRow === 0 ? "" : HAND_CARD_OVERLAP;
  return (
    <button
      type="button"
      onClick={() => setInspect({ kind: "operations", card })}
      title={`${card.name} — ${card.description}`}
      className={[baseCardChrome, chrome.gradient, chrome.border, overlap, liftClass].join(" ")}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
        aria-hidden
      />
      <div className="flex items-baseline justify-between">
        <span className={`text-[9px] font-semibold uppercase tracking-[0.18em] ${chrome.label}`}>
          Ops
        </span>
      </div>
      <h4 className={`mt-1 line-clamp-3 font-display text-[12px] font-bold leading-tight drop-shadow-[0_1px_4px_rgba(0,0,0,.35)] ${chrome.ink}`}>
        {card.name}
      </h4>
      <div className={`mt-auto grid h-10 w-10 self-center place-items-center rounded-full border-2 bg-white/10 text-xl font-bold ${chrome.border} ${chrome.ink}`}>
        ⚡
      </div>
    </button>
  );
}
