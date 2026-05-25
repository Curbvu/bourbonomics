"use client";

/**
 * BuyOverlay — purchase panel that overlays the distillery stage.
 *
 * Opens once the player has picked a market card while in Buy mode.
 * Mounts as an `absolute inset-0` child of the distillery section so
 * it covers exactly that rectangle — the market row and action bar
 * stay visible above/below while the purchase reads as the moment
 * that matters.
 *
 * Layout (v3.9): a brass ledger at the bar.
 *   ─ Header   : PURCHASE · TIER · name · slogan · Cancel ✕
 *   ─ Body     : <CardHero/> (left) · <Ledger/> (right, dotted leaders
 *                  + horizontal rep meter)
 *   ─ Footer   : "Apply from your hand" chip wrap · contextual hint ·
 *                  Cancel + Confirm
 *
 * Pre-pick state (Buy mode active but no target yet) shows a small
 * floating hint anchored to the bottom of the same panel — picking
 * the actual market card happens through the normal market click
 * handlers up in MarketRow.
 */

import { useEffect, type ReactNode } from "react";
import { useGameStore } from "@/lib/store/game";
import {
  laborContribution,
  type Card,
  type GameState,
  type ResourceSubtype,
} from "@bourbonomics/engine";
import { buyDomainForTarget } from "./buyDomain";
import {
  RESOURCE_GLYPH,
  RESOURCE_LABEL,
  laborGlyphFor,
} from "./handCardStyles";
import { TIER_CHROME, TIER_INK, tierOrCommon } from "./tierStyles";

export default function BuyOverlay() {
  const { state, buyMode, cancelBuyMode, confirmBuy, toggleBuySpend } = useGameStore();

  // Esc closes the modal. Wired up unconditionally before any early
  // returns so React's hook order stays stable across the "buy mode
  // off / hint only / full modal" render paths.
  useEffect(() => {
    if (!buyMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelBuyMode();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [buyMode, cancelBuyMode]);

  if (!state || !buyMode) return null;
  const human = state.players.find((p) => !p.isBot);
  if (!human) return null;

  const target = resolveTarget(state, buyMode.pickedTarget);

  // Pre-pick hint — small chip pinned to the bottom of the distillery
  // panel telling the player to click a market card. The full modal
  // only mounts once a target exists so the panel doesn't go dark
  // while the player is still picking.
  if (!target) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none absolute inset-x-0 bottom-3 z-40 flex justify-center"
      >
        <div className="pointer-events-auto mx-3 flex items-center gap-3 rounded-lg border border-amber-500/70 bg-gradient-to-b from-amber-900/85 to-slate-950/95 px-4 py-2 shadow-[0_-2px_24px_rgba(240,201,112,.25)] backdrop-blur-md">
          <span className="rounded border border-amber-500 bg-amber-700/30 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[.14em] text-amber-100">
            Buying
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[.10em] text-slate-300">
            Pick a card from the market or operations row.
          </span>
          <button
            type="button"
            onClick={cancelBuyMode}
            className="rounded-md border border-rose-700/60 bg-rose-900/30 px-3 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[.08em] text-rose-100 transition-colors hover:border-rose-400 hover:bg-rose-800/40"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const cost = target.cost;
  const laborDomain = buyDomainForTarget(target.card);

  // Labor cards in hand the player can apply. Non-Labor cards cannot
  // pay for purchases under the unified rep system — chips for them
  // still render but disabled.
  const laborInHand = human.hand.filter((c) => c.type === "labor");
  const selectedLabor = laborInHand.filter((c) => buyMode.spendCardIds.includes(c.id));
  const laborContrib = selectedLabor.reduce(
    (acc, c) => acc + laborContribution(c, laborDomain),
    0,
  );
  const repPortion = Math.max(0, cost - laborContrib);
  const overpaid = laborContrib > cost;
  const canAfford = repPortion <= human.reputation;
  const canConfirm =
    canAfford && (cost === 0 || repPortion > 0 || selectedLabor.length > 0);

  const chrome = resolveCardChrome(target.card);
  const tierChrome = TIER_CHROME[chrome.tier];
  const tierInk = TIER_INK[chrome.tier];
  const flavor = target.card.flavor;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Confirm purchase"
      className="absolute inset-0 z-40 flex items-stretch justify-center overflow-hidden rounded-[12px] bg-slate-950/95 p-3 backdrop-blur-md"
    >
      {/* Ambient glow behind the dialog — tier-tinted so the panel
          inherits the colour temperature of whatever's being bought.
          v3.10: punched up so the modal reads as the focal point of
          the screen, not just another panel laid over the distillery. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[460px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{
          background: `radial-gradient(circle, ${tierInk}80 0%, ${tierInk}33 35%, transparent 70%)`,
        }}
      />
      {/* Second halo — narrower amber wash on top of the tier tint so
          the brass border has something to glow against. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[300px] w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
        style={{
          background:
            "radial-gradient(circle, rgba(252,211,77,.30) 0%, transparent 65%)",
        }}
      />

      <div
        className="relative flex w-full flex-col gap-4 overflow-y-auto rounded-xl border-[3px] border-amber-300 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 p-5"
        style={{
          boxShadow:
            "inset 0 1px 0 rgba(252,211,77,.35), inset 0 0 0 1px rgba(252,211,77,.18), 0 0 48px rgba(252,211,77,.45), 0 24px 64px rgba(0,0,0,.75)",
        }}
      >
        {/* ─ Header ────────────────────────────────────────────────── */}
        <header className="flex items-start gap-4 border-b border-[#3b2818] pb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-3">
              <span className="stage-tag" style={{ color: tierInk }}>
                Purchase · {tierChrome.label_text}
              </span>
              <span
                aria-hidden
                className="h-px flex-1"
                style={{
                  background: `linear-gradient(90deg, ${tierInk}55, transparent)`,
                }}
              />
            </div>
            <h2
              className="mt-1.5 font-display text-3xl font-semibold leading-tight tracking-[.005em]"
              style={{ color: "var(--ink)" }}
            >
              {targetLabel(target)}
            </h2>
            {flavor ? (
              <p
                className="mt-0.5 font-display text-[13.5px] italic leading-snug"
                style={{ color: "var(--brass)" }}
              >
                {flavor}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={cancelBuyMode}
            aria-label="Cancel purchase"
            className="rounded-md border border-[#3b2818] bg-[rgba(34,23,16,.7)] px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[.18em] text-[var(--ink-muted)] transition-colors hover:border-rose-400/60 hover:text-rose-200"
          >
            Cancel ✕
          </button>
        </header>

        {/* ─ Body ─ Hero card · Ledger ────────────────────────────── */}
        <div className="grid min-h-0 flex-1 gap-6 md:grid-cols-[minmax(180px,230px)_1fr]">
          <CardHero card={target.card} chrome={chrome} tierChrome={tierChrome} tierInk={tierInk} />
          <Ledger
            cost={cost}
            laborCovered={Math.min(laborContrib, cost)}
            laborGross={laborContrib}
            overpaid={overpaid}
            repPortion={repPortion}
            available={human.reputation}
            canAfford={canAfford}
          />
        </div>

        {/* ─ Footer ─ Hand chips · hint · buttons ───────────────────── */}
        <footer className="flex flex-col gap-3 border-t border-[#3b2818] pt-3">
          <div className="flex items-baseline gap-3">
            <span className="stage-tag">Apply from your hand</span>
            <span
              aria-hidden
              className="h-px flex-1"
              style={{
                background:
                  "linear-gradient(90deg, var(--rule), transparent)",
              }}
            />
            <span className="label-sm">
              <span style={{ color: "var(--gold)" }}>
                {selectedLabor.length}
              </span>
              <span style={{ color: "var(--mute)" }}>
                {" "}
                of {human.hand.length} tagged
              </span>
            </span>
          </div>

          {human.hand.length === 0 ? (
            <div className="rounded border border-dashed border-[#3b2818] px-3 py-3 text-center font-mono text-[11px] italic text-[var(--mute)]">
              Hand is empty — pay the full rep cost or cancel.
            </div>
          ) : (
            <div className="flex flex-wrap items-stretch gap-1.5">
              {human.hand.map((c) => (
                <HandChip
                  key={c.id}
                  card={c}
                  laborDomain={laborDomain}
                  tagged={buyMode.spendCardIds.includes(c.id)}
                  onToggle={() => toggleBuySpend(c.id)}
                />
              ))}
            </div>
          )}

          <div className="mt-1 flex items-center gap-3">
            <Hint
              cost={cost}
              repPortion={repPortion}
              available={human.reputation}
              canAfford={canAfford}
              overpaid={overpaid}
            />
            <span className="flex-1" />
            <button
              type="button"
              onClick={cancelBuyMode}
              className="rounded-md border border-[#3b2818] bg-[rgba(34,23,16,.7)] px-4 py-2 font-mono text-[10.5px] font-bold uppercase tracking-[.18em] text-[var(--ink-muted)] transition-colors hover:bg-[rgba(46,32,22,.85)]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canConfirm}
              onClick={canConfirm ? confirmBuy : undefined}
              className={
                canConfirm
                  ? "confirm-ready rounded-md border border-amber-300 bg-gradient-to-b from-amber-300 to-amber-600 px-6 py-2 font-mono text-[11px] font-extrabold uppercase tracking-[.22em] text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,.5),0_6px_18px_rgba(240,201,112,.35)] transition-transform hover:-translate-y-px"
                  : "rounded-md border border-[#3b2818] bg-[rgba(34,23,16,.7)] px-6 py-2 font-mono text-[11px] font-extrabold uppercase tracking-[.22em] text-[var(--whisper)] cursor-not-allowed"
              }
            >
              Confirm Purchase ↵
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Card hero — tier-tinted preview on the left side of the body.
// ─────────────────────────────────────────────────────────────────────

function CardHero({
  card,
  chrome,
  tierChrome,
  tierInk,
}: {
  card: Card;
  chrome: CardChrome;
  tierChrome: (typeof TIER_CHROME)[keyof typeof TIER_CHROME];
  tierInk: string;
}) {
  return (
    <div
      className="relative flex min-h-0 flex-col rounded-xl px-3.5 pb-4 pt-3.5"
      style={{
        border: `1px solid ${tierInk}66`,
        background: `linear-gradient(180deg, ${tierInk}1a 0%, rgba(14,10,6,.95) 70%)`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,.06), 0 12px 28px ${tierInk}33, 0 0 0 1px ${tierInk}22`,
      }}
    >
      {/* Kind label + brass price */}
      <div className="mb-1.5 flex items-baseline justify-between">
        <span
          className="font-mono text-[8.5px] font-bold uppercase tracking-[.18em]"
          style={{ color: tierInk }}
        >
          {chrome.kindLabel}
        </span>
        <BrassPrice amount={card.cost ?? 0} />
      </div>

      {/* Centered glyph plate */}
      <div
        className="my-2 grid min-h-[110px] flex-1 place-items-center rounded-lg"
        style={{
          background: `radial-gradient(80% 80% at 50% 40%, ${tierInk}22, transparent 70%)`,
          border: `1px dashed ${tierInk}40`,
        }}
      >
        <span
          className="font-display leading-none"
          style={{
            fontSize: 64,
            color: chrome.subInk,
            textShadow: `0 0 24px ${chrome.subInk}55`,
          }}
        >
          {chrome.glyph}
        </span>
      </div>

      {/* Name + tier badge + "you're buying" */}
      <div
        className="font-display text-[19px] font-semibold leading-tight"
        style={{ color: "var(--ink)" }}
      >
        {card.displayName ?? chrome.kindLabel}
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <span
          className={`rounded border px-[7px] py-px font-mono text-[8.5px] font-bold uppercase tracking-[.14em] ${tierChrome.pill}`}
        >
          {tierChrome.label_text}
        </span>
        <span className="label-sm">You're buying</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Ledger — itemized receipt + horizontal rep meter.
// ─────────────────────────────────────────────────────────────────────

function Ledger({
  cost,
  laborCovered,
  laborGross,
  overpaid,
  repPortion,
  available,
  canAfford,
}: {
  cost: number;
  /** Labor applied to the cost (capped at `cost`). */
  laborCovered: number;
  /** Total Labor contribution before capping — used to flag overpayment. */
  laborGross: number;
  overpaid: boolean;
  repPortion: number;
  available: number;
  canAfford: boolean;
}) {
  return (
    <div
      className="flex min-w-0 flex-col rounded-xl px-5 pb-3.5 pt-4"
      style={{
        border: "1px solid rgba(110,80,50,.45)",
        background:
          "repeating-linear-gradient(0deg, transparent 0 28px, rgba(110,80,50,.06) 28px 29px), linear-gradient(180deg, rgba(28,18,11,.85), rgba(18,12,8,.95))",
        boxShadow:
          "inset 0 1px 0 rgba(240,201,112,.10), 0 8px 22px rgba(0,0,0,.45)",
      }}
    >
      <div className="flex items-baseline gap-3">
        <span className="stage-tag">Ledger</span>
        <span
          aria-hidden
          className="h-px flex-1"
          style={{
            background:
              "linear-gradient(90deg, rgba(110,80,50,.5), transparent)",
          }}
        />
        <span className="label-sm">Itemized for the table</span>
      </div>

      <div className="mt-3 flex flex-col gap-0.5">
        <LedgerLine
          label="Card lists at"
          right={<Coin amount={cost} />}
        />
        <LedgerLine
          label="Labor applied"
          dim={laborCovered === 0}
          right={<Delta amount={laborCovered} dim={laborCovered === 0} />}
        />
        {/* Capital from hand — placeholder until the engine grows that
            affordance. Reads ฿0 today so the ledger structure stays
            stable; the chip row below already disables non-Labor cards. */}
        <LedgerLine label="Capital from hand" dim right={<Delta amount={0} dim />} />
        <div
          aria-hidden
          className="my-1.5 h-px"
          style={{ background: "rgba(110,80,50,.45)" }}
        />
        <LedgerLine
          big
          label="Rep you'll spend"
          right={
            <Coin
              amount={repPortion}
              big
              tone={repPortion === 0 ? "gold" : canAfford ? "ink" : "rose"}
            />
          }
        />
      </div>

      {/* Rep meter */}
      <div className="mt-auto pt-3">
        <RepMeter
          spend={repPortion}
          available={available}
          canAfford={canAfford}
          overpaid={overpaid}
          laborGross={laborGross}
          cost={cost}
        />
      </div>
    </div>
  );
}

function LedgerLine({
  label,
  right,
  big,
  dim,
}: {
  label: string;
  right: ReactNode;
  big?: boolean;
  dim?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between ${big ? "py-1" : "py-[3px]"} ${dim ? "opacity-55" : ""}`}
    >
      <span
        className={
          big
            ? "font-display text-base font-semibold tracking-[.005em]"
            : "font-sans text-[13px] font-medium"
        }
        style={{ color: big ? "var(--ink)" : "var(--ink-muted)" }}
      >
        {label}
      </span>
      <span
        aria-hidden
        className="mx-2.5 -translate-y-[3px] flex-1 border-b border-dotted"
        style={{
          borderColor: big
            ? "rgba(110,80,50,.45)"
            : "rgba(110,80,50,.25)",
        }}
      />
      {right}
    </div>
  );
}

function Coin({
  amount,
  big = false,
  tone = "ink",
}: {
  amount: number;
  big?: boolean;
  tone?: "ink" | "gold" | "rose";
}) {
  const fontSize = big ? 28 : 14;
  const color =
    tone === "gold"
      ? "var(--gold)"
      : tone === "rose"
        ? "var(--rose)"
        : "var(--ink)";
  return (
    <span
      className="inline-flex items-baseline gap-1 font-display font-semibold tabular-nums tracking-[.01em]"
      style={{ fontSize, color }}
    >
      <span
        className="font-mono"
        style={{ fontSize: fontSize * 0.55, color: "var(--brass)", opacity: 0.8 }}
      >
        ฿
      </span>
      <span>{amount}</span>
    </span>
  );
}

function Delta({
  amount,
  dim,
}: {
  amount: number;
  dim?: boolean;
}) {
  const sign = amount === 0 ? "" : "−";
  const abs = Math.abs(amount);
  return (
    <span
      className="inline-flex items-baseline gap-[3px] font-mono text-[13px] font-bold tabular-nums"
      style={{
        color: dim
          ? "var(--whisper)"
          : "var(--emerald)",
      }}
    >
      {sign ? <span>{sign}</span> : null}
      <span className="font-mono text-[10px] opacity-80">฿</span>
      <span>{abs}</span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Rep meter — horizontal pour. Track = available rep, fill = the spend
// portion, copper-rose gradient so it reads as "this is leaving you."
// ─────────────────────────────────────────────────────────────────────

function RepMeter({
  spend,
  available,
  canAfford,
  overpaid,
  laborGross,
  cost,
}: {
  spend: number;
  available: number;
  canAfford: boolean;
  overpaid: boolean;
  laborGross: number;
  cost: number;
}) {
  const pct = available > 0 ? Math.min(100, (spend / available) * 100) : 0;
  const after = available - spend;
  const isFree = spend === 0 && cost > 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="label-sm">Reputation</span>
        <span
          className="font-mono text-[10.5px] tracking-[.08em]"
          style={{ color: "var(--ink-muted)" }}
        >
          <span
            className="font-bold"
            style={{ color: isFree ? "var(--gold)" : canAfford ? "var(--ink)" : "var(--rose)" }}
          >
            {Math.max(0, after)}
          </span>
          <span style={{ color: "var(--mute)" }}> / {available} after purchase</span>
        </span>
      </div>
      <div
        className="relative h-[10px] overflow-hidden rounded-full border"
        style={{
          background: "rgba(34,23,16,.85)",
          borderColor: "rgba(110,80,50,.45)",
          boxShadow: "inset 0 1px 2px rgba(0,0,0,.6)",
        }}
      >
        {/* Available rep — full bar, gold tint */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(240,201,112,.20), rgba(198,157,82,.10))",
          }}
        />
        {/* What we're about to spend — copper fill */}
        <div
          aria-hidden
          className="absolute bottom-0 left-0 top-0 transition-[width] duration-200 ease-out"
          style={{
            width: `${pct}%`,
            background: canAfford
              ? "linear-gradient(180deg, #d96b54 0%, #8a3a23 100%)"
              : "linear-gradient(180deg, #ef4444 0%, #7f1d1d 100%)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,.15)",
          }}
        />
      </div>
      {overpaid ? (
        <span className="font-mono text-[10px] tracking-[.08em] text-rose-300">
          Overpaying by ฿{laborGross - cost} — untag a chip to clean up.
        </span>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Hand chip — one toggle per card in hand. Labor pays via
// laborContribution; non-Labor renders disabled with a "pays nothing"
// affordance so the player sees why they can't tag it.
// ─────────────────────────────────────────────────────────────────────

function HandChip({
  card,
  laborDomain,
  tagged,
  onToggle,
}: {
  card: Card;
  laborDomain: ReturnType<typeof buyDomainForTarget>;
  tagged: boolean;
  onToggle: () => void;
}) {
  const isLabor = card.type === "labor";
  const covers = isLabor ? laborContribution(card, laborDomain) : 0;
  const subInkRaw =
    card.type === "labor"
      ? "#c69d52"
      : SUB_INK[(card.subtype as ResourceSubtype | undefined) ?? "cask"];
  const glyph: ReactNode = isLabor
    ? laborGlyphFor(card.laborSubtype)
    : RESOURCE_GLYPH[(card.subtype as ResourceSubtype) ?? "cask"] ?? "◇";
  const label = isLabor
    ? labelForLabor(card.laborSubtype)
    : RESOURCE_LABEL[(card.subtype as ResourceSubtype) ?? "cask"] ?? "Card";
  // Why "pays nothing": only Labor cards contribute to a purchase under
  // the unified rep system; non-Labor are visible but inert.
  const disabled = !isLabor || covers === 0;
  const reasonDisabled = !isLabor
    ? "Only Labor cards can pay for purchases."
    : covers === 0
      ? `${labelForLabor(card.laborSubtype)} Labor doesn't apply to this purchase (wrong domain).`
      : "";
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onToggle}
      disabled={disabled}
      title={
        disabled
          ? reasonDisabled
          : `Tag this card to cover ฿${covers} of the cost.`
      }
      className={[
        "inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 transition-transform",
        tagged
          ? "border border-amber-300 bg-gradient-to-b from-[rgba(240,201,112,.18)] to-[rgba(176,106,56,.08)] shadow-[inset_0_1px_0_rgba(255,255,255,.08),0_4px_14px_rgba(240,201,112,.25)]"
          : disabled
            ? "border border-[#3b2818] bg-[rgba(20,14,8,.55)] opacity-55 cursor-not-allowed"
            : "border border-[#3b2818] bg-gradient-to-b from-[rgba(34,23,16,.75)] to-[rgba(20,14,8,.85)] hover:-translate-y-px hover:border-emerald-500/60",
      ].join(" ")}
    >
      <span
        className="grid h-[18px] w-[18px] place-items-center rounded font-display text-[13px] font-bold leading-none"
        style={{
          background: tagged
            ? "var(--gold)"
            : "rgba(34,23,16,.5)",
          color: tagged ? "#1a120b" : subInkRaw,
          border: tagged ? "0" : `1px solid ${subInkRaw}55`,
        }}
        aria-hidden
      >
        {tagged ? "✓" : glyph}
      </span>
      <span
        className="font-sans text-[12px] font-semibold"
        style={{ color: tagged ? "var(--ink)" : "var(--ink-muted)" }}
      >
        {card.displayName ?? label}
      </span>
      <span
        className="font-mono text-[9.5px] font-bold uppercase tracking-[.10em]"
        style={{
          color: !isLabor
            ? "var(--whisper)"
            : covers === 0
              ? "var(--whisper)"
              : "var(--gold)",
          opacity: tagged ? 1 : 0.7,
        }}
      >
        {!isLabor
          ? "pays nothing"
          : covers === 0
            ? "wrong domain"
            : `covers ฿${covers}`}
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Hint line — single italic sentence keyed off the affordability state.
// ─────────────────────────────────────────────────────────────────────

function Hint({
  cost,
  repPortion,
  available,
  canAfford,
  overpaid,
}: {
  cost: number;
  repPortion: number;
  available: number;
  canAfford: boolean;
  overpaid: boolean;
}) {
  let text: string;
  let color: string;
  if (overpaid) {
    text = "Untag a chip — overpaying the table.";
    color = "var(--rose)";
  } else if (!canAfford) {
    text = `You need ฿${repPortion} rep but only have ฿${available}. Tag labor to cover the gap.`;
    color = "var(--rose)";
  } else if (cost > 0 && repPortion === 0) {
    text = "Fully covered by hand — no rep spent.";
    color = "var(--gold)";
  } else {
    text = `Spend ฿${repPortion} rep to finish the purchase.`;
    color = "var(--ink-muted)";
  }
  return (
    <span
      className="font-display text-[13.5px] italic"
      style={{ color }}
    >
      {text}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Brass price medallion — small gold pill with the ฿ + amount. Used
// in the top-right of the CardHero so the cost reads at a glance.
// ─────────────────────────────────────────────────────────────────────

function BrassPrice({ amount }: { amount: number }) {
  return (
    <span
      className="inline-flex items-baseline gap-[3px] rounded-full bg-gradient-to-b from-[#f0c970] to-[#c69d52] px-2.5 py-[2px] font-mono text-[12px] font-bold tabular-nums text-[#1a120b]"
      style={{
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,.45), 0 2px 4px rgba(0,0,0,.5)",
      }}
    >
      <span className="text-[10px] opacity-75">฿</span>
      <span>{amount}</span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Helpers — target resolution, card chrome lookup.
// ─────────────────────────────────────────────────────────────────────

interface TargetView {
  cost: number;
  type: "resource" | "labor" | "operations" | "investment";
  card: Card;
}

function resolveTarget(
  state: GameState,
  picked: { slotIndex: number } | null,
): TargetView | null {
  if (!picked) return null;
  const card = state.market[picked.slotIndex];
  if (!card) return null;
  return {
    cost: card.cost ?? 1,
    type: card.type,
    card,
  };
}

function targetLabel(t: TargetView): string {
  const card = t.card;
  if (card.displayName) return card.displayName;
  if (t.type === "operations" && card.opSpec) return `Ops · ${card.opSpec.name}`;
  if (t.type === "investment" && card.investmentSpec)
    return `Invest · ${card.investmentSpec.name}`;
  if (card.type === "labor") {
    return `Labor · ${labelForLabor(card.laborSubtype)}`;
  }
  const sub = card.subtype ?? "";
  const subCap = sub ? sub[0]!.toUpperCase() + sub.slice(1) : "Resource";
  const count =
    card.resourceCount && card.resourceCount > 1 ? `${card.resourceCount}× ` : "";
  return `${count}${subCap}`;
}

interface CardChrome {
  kindLabel: string;
  glyph: ReactNode;
  subInk: string;
  tier: "common" | "uncommon" | "rare" | "epic" | "legendary";
}

// Mirrors MarketRow's resolveCardKind — kept local so BuyOverlay doesn't
// reach into MarketRow's private helpers. Tier defaults: ops/invest
// = uncommon (they're not commodity grain), specialty resource = uncommon,
// everything else = common. Mash bills aren't sold in the market, so we
// don't need to mirror their tier here.
const SUB_INK: Record<string, string> = {
  cask: "#d59650",
  corn: "#e9c46e",
  rye: "#d96b54",
  barley: "#82c9a3",
  wheat: "#7da6df",
  labor: "#c69d52",
};

function resolveCardChrome(card: Card): CardChrome {
  if (card.type === "labor") {
    return {
      kindLabel: labelForLabor(card.laborSubtype),
      glyph: laborGlyphFor(card.laborSubtype),
      subInk: SUB_INK.labor ?? "#c69d52",
      tier: "common",
    };
  }
  if (card.type === "operations") {
    return {
      kindLabel: "Ops",
      glyph: "⚡",
      subInk: "#c69df0",
      tier: "uncommon",
    };
  }
  if (card.type === "investment") {
    return {
      kindLabel: "Invest",
      glyph: "📈",
      subInk: "#82c9a3",
      tier: "uncommon",
    };
  }
  const subtype = (card.subtype as ResourceSubtype | undefined) ?? "cask";
  return {
    kindLabel: RESOURCE_LABEL[subtype] ?? "Resource",
    glyph: RESOURCE_GLYPH[subtype] ?? "◇",
    subInk: SUB_INK[subtype] ?? "#d59650",
    tier: card.specialty ? "uncommon" : "common",
  };
}

function labelForLabor(sub: string | undefined): string {
  if (sub === "marketing") return "Marketing";
  if (sub === "cooper") return "Cooper";
  if (sub === "architect") return "Architect";
  return "Worker";
}

// Keep tierOrCommon referenced so future tier widening (e.g., legendary
// market specials) doesn't need a separate import line.
void tierOrCommon;
