"use client";

/**
 * BourbonInspectModal — full-card view of a mash bill.
 *
 * Opened in two contexts:
 *   - From the bourbon hand: click any mash bill in HandTray (when not
 *     in make-bourbon or audit-discard mode) → "bill" inspect.
 *   - From a rickhouse: click any barrel chip in RickhouseRow → "barrel"
 *     inspect, which adds barrel-specific info (age, current sale
 *     price, Gold alt-payout) and a Sell button when the player can
 *     dispatch SELL_BOURBON for that barrel.
 *
 * Both paths converge on the same modal so the player has one place to
 * read a bill's full grid + awards + Brand Value.
 */

import { useEffect } from "react";

import { BOURBON_CARDS_BY_ID } from "@/lib/catalogs/bourbon.generated";
import { pickBestGoldAlt } from "@/lib/ai/evaluators";
import { handSize } from "@/lib/engine/checks";
import { lookupSalePrice } from "@/lib/rules/pricing";
import { brandValueFor } from "@/lib/rules/scoring";
import { HAND_LIMIT } from "@/lib/engine/state";
import { useGameStore } from "@/lib/store/gameStore";
import { useUiStore } from "@/lib/store/uiStore";
import BourbonCardFace from "./BourbonCardFace";
import PlayerSwatch from "./PlayerSwatch";

export default function BourbonInspectModal() {
  const inspect = useUiStore((s) => s.inspect);
  const close = useUiStore((s) => s.closeInspect);
  const makeBourbonActive = useUiStore((s) => s.makeBourbon.active);
  const auditActive = useUiStore((s) => s.auditDiscard.active);
  const state = useGameStore((s) => s.state);
  const dispatch = useGameStore((s) => s.dispatch);

  // Esc dismiss.
  useEffect(() => {
    if (!inspect) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inspect, close]);

  // Don't compete with make-bourbon or audit-discard modes — those need
  // exclusive use of the hand cards. The click handlers gate themselves
  // on these flags too, so reaching here without them is a no-op safety.
  if (!inspect || !state || makeBourbonActive || auditActive) return null;
  // Other inspect kinds (resource / operations / investment) belong to
  // the HandInspectModal — bail so both modals don't paint at once.
  if (inspect.kind !== "bill" && inspect.kind !== "barrel") return null;

  const humanId = state.playerOrder.find(
    (id) => state.players[id].kind === "human",
  );
  const me = humanId ? state.players[humanId] : null;

  // Resolve the modal target.
  let cardId: string;
  let barrel: ReturnType<typeof findBarrel> | null = null;
  if (inspect.kind === "bill") {
    cardId = inspect.cardId;
  } else {
    const found = findBarrel(state, inspect.barrelId);
    if (!found) {
      // Barrel disappeared (sold + removed). Auto-dismiss.
      return null;
    }
    barrel = found;
    cardId = found.barrel.mashBillId;
  }
  const card = BOURBON_CARDS_BY_ID[cardId];
  if (!card) return null;

  // ── Sell action wiring (barrel-mode only) ─────────────────────────────
  let sellable = false;
  let goldAltId: string | null = null;
  let payoutNow = 0;
  let sellReason = "";
  if (barrel && me && humanId) {
    const isMine = barrel.barrel.ownerId === humanId;
    const isMyTurn =
      state.currentPlayerId === humanId && state.phase === "action";
    const cost = state.actionPhase.freeWindowActive
      ? 0
      : state.actionPhase.paidLapTier;
    const canAfford = me.cash >= cost;
    const auditPending =
      me.pendingAuditOverage != null && me.pendingAuditOverage > 0;
    const ageOk = barrel.barrel.age >= 2;
    sellable =
      isMine && isMyTurn && canAfford && ageOk && !auditPending && !me.loanSiphonActive;
    if (isMine && ageOk) {
      const altPick = pickBestGoldAlt(state, me, barrel.barrel);
      goldAltId = altPick?.goldId ?? null;
      const basePrice = lookupSalePrice(card, barrel.barrel.age, state.demand).price;
      payoutNow = altPick ? altPick.payout : basePrice;
    }
    sellReason = !isMine
      ? `Owned by ${state.players[barrel.barrel.ownerId]?.name ?? "another baron"}`
      : !isMyTurn
        ? "Wait for your turn"
        : !canAfford
          ? `Need $${cost} to act`
          : !ageOk
            ? "Bourbon must age ≥ 2 years before selling"
            : auditPending
              ? "Resolve your audit discard first"
              : me.loanSiphonActive
                ? "Frozen by distressed loan"
                : `Sell ${barrel.barrel.age}y barrel for $${payoutNow}${goldAltId ? " via Gold trophy" : ""}`;
  }

  const sell = () => {
    if (!sellable || !barrel || !humanId) return;
    if (goldAltId) {
      dispatch({
        t: "SELL_BOURBON",
        playerId: humanId,
        barrelId: barrel.barrel.barrelId,
        applyGoldBourbonId: goldAltId,
      });
    } else {
      dispatch({
        t: "SELL_BOURBON",
        playerId: humanId,
        barrelId: barrel.barrel.barrelId,
      });
    }
    close();
  };

  // ── Footer summary lines ──────────────────────────────────────────────
  const ownerPlayer = barrel
    ? state.players[barrel.barrel.ownerId] ?? null
    : null;
  const ownerName = ownerPlayer?.name ?? (barrel ? "—" : null);
  const billGoldAware = card.awards?.gold != null;
  const billBrandValue = billGoldAware ? brandValueFor(cardId) : 0;
  const heldByMe =
    me != null && (me.bourbonHand.includes(cardId) || me.goldBourbons.includes(cardId));
  const heldAsTrophy = me != null && me.goldBourbons.includes(cardId);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${card.name} — bourbon card details`}
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onClick={close}
    >
      <div
        role="document"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md"
      >
        {/* Close pin — floats outside the card silhouette so it doesn't
            intrude on the bourbon-label aesthetic. */}
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute -right-1 -top-1 z-10 grid h-8 w-8 place-items-center rounded-full border border-slate-700 bg-slate-900 font-mono text-sm text-slate-300 shadow-lg transition-colors hover:border-amber-500 hover:text-amber-200"
        >
          ✕
        </button>

        {/* Card face — primary visual centerpiece. Live-demand column is
            tinted softly when no sale-resolution highlight is in play. */}
        <BourbonCardFace card={card} size="lg" currentDemand={state.demand} />

        {/* Brand-value + held badges */}
        <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[.12em]">
          {billGoldAware ? (
            <span className="rounded-md border border-amber-500/55 bg-amber-700/[0.20] px-2 py-1 text-amber-200">
              brand value <span className="font-bold text-amber-100">${billBrandValue}</span>
            </span>
          ) : (
            <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-slate-400">
              no gold award
            </span>
          )}
          {heldAsTrophy ? (
            <span className="rounded-md border border-amber-500 bg-amber-500/[0.20] px-2 py-1 text-amber-100">
              unlocked gold bourbon
            </span>
          ) : heldByMe ? (
            <span className="rounded-md border border-emerald-500/55 bg-emerald-500/[0.15] px-2 py-1 text-emerald-200">
              in your hand
            </span>
          ) : null}
        </div>

        {/* Barrel context */}
        {barrel && ownerName != null && ownerPlayer != null ? (
          <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/70 p-3 font-mono text-[11px] shadow-[inset_0_1px_0_rgba(255,255,255,.04)]">
            <div className="flex items-center gap-2">
              <PlayerSwatch
                seatIndex={ownerPlayer.seatIndex}
                logoId={ownerPlayer.logoId}
                size="sm"
              />
              <span className="font-semibold text-amber-100">
                {barrel.barrel.ownerId === humanId
                  ? "Your barrel"
                  : `${ownerName}'s barrel`}
              </span>
              <span className="ml-auto tabular-nums text-slate-400">
                age <span className="text-slate-100">{barrel.barrel.age}y</span>
              </span>
            </div>
            {barrel.barrel.age >= 2 ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-slate-400">
                <span>
                  sells now for{" "}
                  <span className="font-bold text-emerald-300">
                    ${payoutNow}
                  </span>
                </span>
                {goldAltId ? (
                  <span className="rounded border border-amber-500/55 bg-amber-700/[0.20] px-1.5 py-px text-[10px] text-amber-200">
                    via Gold trophy
                  </span>
                ) : null}
                <span className="ml-auto text-slate-500">
                  demand {state.demand}/12
                </span>
              </div>
            ) : (
              <div className="mt-2 flex items-center gap-2 text-slate-400">
                <span aria-hidden className="text-amber-400/70">⏳</span>
                <span>still aging — needs ≥2 years before sale</span>
                <span className="ml-auto text-slate-500">
                  demand {state.demand}/12
                </span>
              </div>
            )}
            {me ? (
              <div className="mt-2 text-[10px] uppercase tracking-[.12em] text-slate-500">
                hand size {handSize(me)}/{HAND_LIMIT}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Actions */}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={close}
            className="rounded border border-slate-700 bg-slate-900 px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[.05em] text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800"
          >
            Close
          </button>
          {barrel ? (
            <button
              type="button"
              onClick={sell}
              disabled={!sellable}
              title={sellReason}
              className="rounded-md border border-amber-700 bg-gradient-to-b from-amber-500 to-amber-700 px-3.5 py-1.5 font-sans text-xs font-bold uppercase tracking-[.05em] text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,.2)] transition-colors hover:from-amber-400 hover:to-amber-600 disabled:cursor-not-allowed disabled:border-slate-700 disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-500 disabled:shadow-none"
            >
              {sellable ? `Sell for $${payoutNow} ↵` : "Sell ↵"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// Keep this local — RickhouseRow's findBarrel is inline there and we
// don't want to leak engine/checks types into the modal's surface area.
function findBarrel(
  state: NonNullable<ReturnType<typeof useGameStore.getState>["state"]>,
  barrelId: string,
) {
  for (let i = 0; i < state.rickhouses.length; i++) {
    const b = state.rickhouses[i].barrels.find((x) => x.barrelId === barrelId);
    if (b) return { barrel: b, rickhouseIdx: i };
  }
  return null;
}
