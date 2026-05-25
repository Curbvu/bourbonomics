"use client";

/**
 * BuyOverlay — purchase panel that overlays the distillery stage.
 *
 * Opens once the player has picked a market card while in Buy mode.
 * Mounts as an `absolute inset-0` child of the distillery section so
 * it covers exactly that rectangle — the player keeps the market row
 * and action bar visible above/below while the purchase reads as the
 * moment that matters: target card large, rep being spent in huge
 * type, any Labor cards from their hand they're applying. Confirming
 * dispatches BUY_FROM_MARKET.
 *
 * Pre-pick state (Buy mode active but no target yet) shows a small
 * floating hint anchored to the bottom of the same panel — picking
 * the actual market card happens through the normal market click
 * handlers up in MarketRow.
 */

import { useEffect } from "react";
import { useGameStore } from "@/lib/store/game";
import { type Card, type GameState } from "@bourbonomics/engine";
import { buyDomainForTarget } from "./buyDomain";
import { MoneyText } from "./money";
import HandCardTile from "./HandCardTile";

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
  // pay for purchases under the unified rep system — they're filtered
  // out so the modal hand row reads truthfully.
  const laborInHand = human.hand.filter((c) => c.type === "labor");
  const selectedLabor = laborInHand.filter((c) => buyMode.spendCardIds.includes(c.id));
  const laborContrib = selectedLabor.reduce((acc, c) => {
    if (c.laborDomain === "any") return acc + (c.laborContribution ?? 1);
    if (c.laborDomain === laborDomain) return acc + (c.laborContribution ?? 2);
    return acc;
  }, 0);
  const repPortion = Math.max(0, cost - laborContrib);
  const overpaid = laborContrib > cost;
  const canAfford = repPortion <= human.reputation;
  const canConfirm =
    canAfford && (cost === 0 || repPortion > 0 || selectedLabor.length > 0);

  // Build a one-line readable summary of the labor selection so the
  // big rep number isn't the only feedback the player gets.
  const laborSummary = selectedLabor.length
    ? selectedLabor
        .map((c) => {
          const sub = c.laborSubtype ?? "labor";
          return sub[0]!.toUpperCase() + sub.slice(1);
        })
        .join(" + ")
    : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Confirm purchase"
      className="absolute inset-0 z-40 flex items-stretch justify-center overflow-hidden rounded-[12px] bg-slate-950/85 p-3 backdrop-blur"
    >
      {/* Ambient glow behind the modal — sized to the distillery panel
          rather than the viewport. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(251,191,36,0.22) 0%, transparent 65%)",
        }}
      />

      <div className="relative flex w-full flex-col gap-4 overflow-y-auto rounded-xl border-2 border-amber-500/60 bg-gradient-to-b from-slate-950 to-slate-900/95 p-5 shadow-[0_24px_64px_rgba(0,0,0,.55)]">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[.20em] text-amber-300">
              Purchase
            </div>
            <div className="mt-1 font-display text-3xl font-semibold text-amber-100">
              {targetLabel(target)}
            </div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-[.14em] text-slate-400">
              {target.card.flavor ?? "Tag Labor cards from hand to reduce the rep cost, then confirm."}
            </div>
          </div>
          <button
            type="button"
            onClick={cancelBuyMode}
            aria-label="Cancel purchase"
            className="rounded-md border border-rose-700/60 bg-rose-900/30 px-3 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[.08em] text-rose-100 transition-colors hover:border-rose-400 hover:bg-rose-800/40"
          >
            Cancel ✕
          </button>
        </div>

        {/* Body — target card on the left, huge rep stat on the right */}
        <div className="grid items-stretch gap-4 md:grid-cols-[auto_1fr]">
          <div className="flex flex-col items-center gap-3 rounded-xl border border-amber-700/40 bg-slate-950/55 p-4">
            <div className="font-mono text-[10px] uppercase tracking-[.18em] text-amber-300/80">
              You're buying
            </div>
            <HandCardTile
              card={target.card}
              size="lg"
              interactive={false}
              selected
              tone="amber"
              showCost
            />
          </div>

          <div className="flex flex-col items-stretch gap-3 rounded-xl border border-amber-700/40 bg-slate-950/55 p-5">
            <div className="text-center">
              <div className="font-mono text-[11px] uppercase tracking-[.22em] text-amber-300/85">
                Rep you'll spend
              </div>
              <div
                className={`mt-1 font-display text-[72px] font-bold leading-none tabular-nums drop-shadow-[0_4px_12px_rgba(0,0,0,.55)] ${
                  canAfford ? "text-amber-100" : "text-rose-300"
                }`}
              >
                {repPortion}
              </div>
              <div className="mt-1 font-mono text-[11px] uppercase tracking-[.14em] text-slate-400">
                of <span className="text-amber-200">{human.reputation}</span> available
                {cost !== repPortion ? (
                  <>
                    {" · "}
                    <span className="text-slate-500">card lists at</span>{" "}
                    <MoneyText n={cost} className="font-bold text-amber-200" />
                  </>
                ) : null}
              </div>
            </div>

            {laborContrib > 0 ? (
              <div className="rounded-lg border border-emerald-700/50 bg-emerald-950/40 px-4 py-2 text-center font-mono text-[11px] uppercase tracking-[.12em] text-emerald-200">
                <span className="font-bold text-emerald-100">
                  −{Math.min(laborContrib, cost)}
                </span>{" "}
                rep covered by Labor{laborSummary ? ` (${laborSummary})` : ""}
                {overpaid ? (
                  <span className="ml-1 text-amber-200/90">
                    · {laborContrib - cost} wasted
                  </span>
                ) : null}
              </div>
            ) : null}

            {!canAfford ? (
              <div className="rounded-lg border border-rose-700/60 bg-rose-950/40 px-4 py-2 text-center font-mono text-[11px] uppercase tracking-[.12em] text-rose-200">
                Need {repPortion} rep — you have {human.reputation}. Tag a Labor card.
              </div>
            ) : null}
          </div>
        </div>

        {/* Labor row from hand — the only cards that can pay. Renders
            the real card visuals so the player sees specialty/heritage
            status as they shop. */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/55 p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="font-mono text-[11px] uppercase tracking-[.18em] text-slate-300">
              Apply Labor from your hand
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[.12em] text-slate-500">
              {laborInHand.length === 0
                ? "no Labor cards in hand"
                : `${selectedLabor.length} of ${laborInHand.length} tagged`}
            </span>
          </div>
          {laborInHand.length === 0 ? (
            <div className="rounded border border-dashed border-slate-700/70 px-3 py-5 text-center font-mono text-[11px] italic text-slate-500">
              No Labor cards to apply — pay the full rep cost or cancel.
            </div>
          ) : (
            <div className="flex flex-wrap items-stretch gap-2">
              {laborInHand.map((card) => {
                const isSelected = buyMode.spendCardIds.includes(card.id);
                return (
                  <HandCardTile
                    key={card.id}
                    card={card}
                    size="md"
                    interactive
                    selected={isSelected}
                    onClick={() => toggleBuySpend(card.id)}
                    tone="emerald"
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={cancelBuyMode}
            className="rounded-md border border-slate-600 bg-slate-800/60 px-4 py-2 font-mono text-[12px] font-semibold uppercase tracking-[.08em] text-slate-200 hover:bg-slate-700/60"
          >
            ← Back
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={canConfirm ? confirmBuy : undefined}
            className={
              canConfirm
                ? "confirm-ready rounded-md border-2 border-amber-300 bg-gradient-to-b from-amber-300 to-amber-600 px-8 py-2.5 font-sans text-[15px] font-bold uppercase tracking-[.10em] text-slate-950 shadow-[0_4px_16px_rgba(252,211,77,.4)] hover:from-amber-200 hover:to-amber-500"
                : "rounded-md border-2 border-slate-800 bg-slate-900 px-8 py-2.5 font-sans text-[15px] font-bold uppercase tracking-[.10em] text-slate-600 cursor-not-allowed"
            }
          >
            Confirm purchase ↵
          </button>
        </div>
      </div>
    </div>
  );
}

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
    const sub = card.laborSubtype ?? "labor";
    return `Labor · ${sub[0]!.toUpperCase()}${sub.slice(1)}`;
  }
  const sub = card.subtype ?? "";
  const subCap = sub ? sub[0]!.toUpperCase() + sub.slice(1) : "Resource";
  const count = card.resourceCount && card.resourceCount > 1 ? `${card.resourceCount}× ` : "";
  return `${count}${subCap}`;
}
