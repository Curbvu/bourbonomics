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
import HandCardTile from "./HandCardTile";
import {
  RESOURCE_GLYPH,
  RESOURCE_LABEL,
  laborGlyphFor,
} from "./handCardStyles";
import { TIER_CHROME, TIER_INK } from "./tierStyles";

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
          <span className="rounded border border-amber-500 bg-amber-700/30 px-2 py-0.5 font-mono text-[12px] font-bold uppercase tracking-[.14em] text-amber-100">
            Buying
          </span>
          <span className="font-mono text-[13px] uppercase tracking-[.10em] text-slate-300">
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
  const canAfford = repPortion <= human.capital;
  // Belt-and-suspenders: the store's toggleBuySpend already rejects
  // selections that would overpay, but gate the Confirm button
  // explicitly too so a stale selection can never resolve into a
  // wasteful dispatch.
  const canConfirm =
    !overpaid &&
    canAfford &&
    (cost === 0 || repPortion > 0 || selectedLabor.length > 0);

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

      {/* No scroll: the modal is designed to fit at the canvas scale
          (CLAUDE.md rule 1). The previous `overflow-y-auto` was a
          safety fallback that would surface a scrollbar if content
          ever spilled — exactly the gameplay scrollbar the rules
          forbid. Switch to `overflow-hidden` so layout regressions
          surface as a visual clip during dev (drives a tightening
          pass) rather than a silent UX violation in prod. */}
      <div
        className="relative flex w-full flex-col gap-4 overflow-hidden rounded-xl border-[3px] border-amber-300 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 p-5"
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
            className="rounded-md border border-[#3b2818] bg-[rgba(34,23,16,.7)] px-3 py-1 font-mono text-[12px] font-bold uppercase tracking-[.18em] text-[var(--ink-muted)] transition-colors hover:border-rose-400/60 hover:text-rose-200"
          >
            Cancel ✕
          </button>
        </header>

        {/* ─ Body ─ three big areas: Hero · Apply · Rep ──────────────── */}
        <div className="grid min-h-0 flex-1 gap-6 md:grid-cols-[minmax(190px,240px)_1fr_minmax(220px,280px)]">
          <CardHero card={target.card} chrome={chrome} tierChrome={tierChrome} tierInk={tierInk} />
          <ApplyPanel
            laborInHand={laborInHand}
            laborDomain={laborDomain}
            tagged={buyMode.spendCardIds}
            onToggle={toggleBuySpend}
          />
          <RepPanel
            repPortion={repPortion}
            available={human.capital}
            canAfford={canAfford}
            overpaid={overpaid}
            laborGross={laborContrib}
            cost={cost}
          />
        </div>

        {/* ─ Footer ─ hint · Cancel · Confirm ────────────────────────── */}
        <footer className="flex items-center gap-3 border-t border-[#3b2818] pt-3">
          <Hint
            cost={cost}
            repPortion={repPortion}
            available={human.capital}
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
                ? "confirm-ready rounded-md border border-amber-300 bg-gradient-to-b from-amber-300 to-amber-600 px-6 py-2 font-mono text-[13px] font-extrabold uppercase tracking-[.22em] text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,.5),0_6px_18px_rgba(240,201,112,.35)] transition-transform hover:-translate-y-px"
                : "rounded-md border border-[#3b2818] bg-[rgba(34,23,16,.7)] px-6 py-2 font-mono text-[13px] font-extrabold uppercase tracking-[.22em] text-[var(--whisper)] cursor-not-allowed"
            }
          >
            Confirm Purchase ↵
          </button>
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
          className="font-mono text-[11px] font-bold uppercase tracking-[.18em]"
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
          className={`rounded border px-[7px] py-px font-mono text-[11px] font-bold uppercase tracking-[.14em] ${tierChrome.pill}`}
        >
          {tierChrome.label_text}
        </span>
        <span className="label-sm">You're buying</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Apply panel — middle column. Real card tiles for every Labor card
// in hand, each toggleable as payment with a "covers ฿N" badge below.
// Non-Labor cards live in the hand strip outside the modal — only
// applicable cards surface here so the player's eye goes to actions.
// ─────────────────────────────────────────────────────────────────────

function ApplyPanel({
  laborInHand,
  laborDomain,
  tagged,
  onToggle,
}: {
  laborInHand: Card[];
  laborDomain: ReturnType<typeof buyDomainForTarget>;
  tagged: string[];
  onToggle: (id: string) => void;
}) {
  const selectedCount = laborInHand.reduce(
    (n, c) => (tagged.includes(c.id) ? n + 1 : n),
    0,
  );
  return (
    <div
      className="flex min-w-0 flex-col rounded-xl px-5 pb-4 pt-4"
      style={{
        border: "1px solid rgba(110,80,50,.45)",
        background:
          "linear-gradient(180deg, rgba(28,18,11,.78), rgba(18,12,8,.92))",
        boxShadow:
          "inset 0 1px 0 rgba(240,201,112,.10), 0 8px 22px rgba(0,0,0,.45)",
      }}
    >
      <div className="flex items-baseline gap-3">
        <span className="stage-tag">Apply toward purchase</span>
        <span
          aria-hidden
          className="h-px flex-1"
          style={{
            background:
              "linear-gradient(90deg, rgba(110,80,50,.5), transparent)",
          }}
        />
        <span className="label-sm">
          <span style={{ color: "var(--gold)" }}>{selectedCount}</span>
          <span style={{ color: "var(--mute)" }}>
            {" "}
            of {laborInHand.length} tagged
          </span>
        </span>
      </div>

      {laborInHand.length === 0 ? (
        <div
          className="mt-4 flex flex-1 items-center justify-center rounded-md border border-dashed px-4 py-6 text-center font-display text-[13.5px] italic"
          style={{
            borderColor: "rgba(110,80,50,.45)",
            color: "var(--mute)",
          }}
        >
          No Labor cards in hand — pay the full rep cost or cancel.
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-stretch gap-2.5">
          {laborInHand.map((c) => {
            const covers = laborContribution(c, laborDomain);
            const wrongDomain = covers === 0;
            const isTagged = tagged.includes(c.id);
            return (
              <div key={c.id} className="flex flex-col items-center gap-1.5">
                <HandCardTile
                  card={c}
                  size="md"
                  interactive={!wrongDomain}
                  selected={isTagged}
                  onClick={
                    wrongDomain ? undefined : () => onToggle(c.id)
                  }
                  tone="amber"
                  dim={wrongDomain}
                />
                <span
                  className="rounded-md border px-2 py-[2px] font-mono text-[12px] font-bold uppercase tracking-[.12em]"
                  style={
                    wrongDomain
                      ? {
                          borderColor: "rgba(110,80,50,.45)",
                          color: "var(--whisper)",
                          background: "rgba(34,23,16,.55)",
                        }
                      : isTagged
                        ? {
                            borderColor: "rgba(252,211,77,.7)",
                            color: "#1a120b",
                            background:
                              "linear-gradient(180deg, #f0c970, #c69d52)",
                          }
                        : {
                            borderColor: "rgba(252,211,77,.4)",
                            color: "var(--gold)",
                            background: "rgba(240,201,112,.08)",
                          }
                  }
                >
                  {wrongDomain ? "wrong domain" : `covers ฿${covers}`}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Rep panel — right column. Big "rep you'll spend" stat with the meter
// underneath; the whole purchase resolves to this single number.
// ─────────────────────────────────────────────────────────────────────

function RepPanel({
  repPortion,
  available,
  canAfford,
  overpaid,
  laborGross,
  cost,
}: {
  repPortion: number;
  available: number;
  canAfford: boolean;
  overpaid: boolean;
  laborGross: number;
  cost: number;
}) {
  const isFree = repPortion === 0 && cost > 0;
  const bigColor = !canAfford
    ? "var(--rose)"
    : isFree
      ? "var(--gold)"
      : "var(--ink)";
  return (
    <div
      className="flex min-w-0 flex-col items-stretch rounded-xl px-5 pb-4 pt-4"
      style={{
        border: "1px solid rgba(110,80,50,.45)",
        background:
          "radial-gradient(120% 80% at 50% 0%, rgba(240,201,112,.10), transparent 65%), linear-gradient(180deg, rgba(28,18,11,.85), rgba(18,12,8,.95))",
        boxShadow:
          "inset 0 1px 0 rgba(240,201,112,.18), 0 8px 22px rgba(0,0,0,.45)",
      }}
    >
      <div className="flex items-baseline gap-3">
        <span className="stage-tag">Rep you'll spend</span>
        <span
          aria-hidden
          className="h-px flex-1"
          style={{
            background:
              "linear-gradient(90deg, rgba(110,80,50,.5), transparent)",
          }}
        />
      </div>

      {/* Big number */}
      <div className="flex flex-1 flex-col items-center justify-center py-2">
        <div
          className="flex items-baseline gap-2 font-display font-bold leading-none tabular-nums tracking-[.005em]"
          style={{
            color: bigColor,
            textShadow:
              "0 2px 0 rgba(0,0,0,.45), 0 0 28px rgba(240,201,112,.22)",
          }}
        >
          <span
            className="font-mono"
            style={{
              fontSize: 36,
              color: "var(--brass)",
              opacity: 0.85,
            }}
          >
            ฿
          </span>
          <span style={{ fontSize: 96 }}>{repPortion}</span>
        </div>
        <div
          className="mt-1 font-mono text-[10.5px] uppercase tracking-[.16em]"
          style={{ color: "var(--ink-muted)" }}
        >
          of <span style={{ color: "var(--gold)" }}>{available}</span> available
        </div>
      </div>

      <RepMeter
        spend={repPortion}
        available={available}
        canAfford={canAfford}
        overpaid={overpaid}
        laborGross={laborGross}
        cost={cost}
      />
    </div>
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
        <span className="font-mono text-[12px] tracking-[.08em] text-rose-300">
          Overpaying by ฿{laborGross - cost} — untag a chip to clean up.
        </span>
      ) : null}
    </div>
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
      <span className="text-[12px] opacity-75">฿</span>
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

