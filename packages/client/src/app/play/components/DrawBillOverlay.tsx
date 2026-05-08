"use client";

/**
 * DrawBillOverlay — sticky control bar for the two-step Draw-Bill picker.
 *
 *   Step 1 — pick which bourbon you want. Either click one of the 3
 *            face-up bills (engine state: `bourbonFaceUp`) or click the
 *            "blind top of deck" tile to pull the unknown top card.
 *   Step 2 — tag the cards from your hand to pay with. Blind draws
 *            need exactly 1 card; face-up picks need cards summing to
 *            ≥ the bill's printed cost. Capital cards pay face value.
 *
 * Other regions of the board (rickhouse, market conveyor, ops row, etc.)
 * are dimmed via a global `body[data-draw-mode]` attribute that the
 * stylesheet picks up. The bourbon row + hand stay full opacity in the
 * relevant step so the focus is unambiguous.
 */

import { useEffect } from "react";
import { mashBillCost } from "@bourbonomics/engine";
import { useGameStore } from "@/lib/store/game";
import { formatMoney, MoneyText } from "./money";

export default function DrawBillOverlay() {
  const {
    state,
    drawBillMode,
    cancelDrawBillMode,
    confirmDrawBill,
    resetDrawBillTarget,
  } = useGameStore();

  // Reflect mode state on <body> so the CSS layer can mute the regions
  // that aren't the focus this step.
  useEffect(() => {
    const root = typeof document !== "undefined" ? document.body : null;
    if (!root) return;
    if (!drawBillMode) {
      root.removeAttribute("data-draw-mode");
      return;
    }
    if (!drawBillMode.blind && !drawBillMode.pickedMashBillId) {
      root.setAttribute("data-draw-mode", "pick-bourbon");
    } else {
      root.setAttribute("data-draw-mode", "pick-payment");
    }
    return () => {
      root.removeAttribute("data-draw-mode");
    };
  }, [drawBillMode]);

  if (!state || !drawBillMode) return null;
  const human = state.players.find((p) => !p.isBot);
  if (!human) return null;

  const step1 = !drawBillMode.blind && !drawBillMode.pickedMashBillId;

  const pickedBill = drawBillMode.pickedMashBillId
    ? state.bourbonFaceUp.find((b) => b.id === drawBillMode.pickedMashBillId)
    : null;
  const cost = pickedBill ? mashBillCost(pickedBill) : drawBillMode.blind ? 1 : 0;

  const tagged = human.hand.filter((c) =>
    drawBillMode.spendCardIds.includes(c.id),
  );
  const paid = tagged.reduce(
    (acc, c) => acc + (c.type === "capital" ? c.capitalValue ?? 1 : 1),
    0,
  );
  const blindOk = drawBillMode.blind && tagged.length === 1;
  const faceUpOk = pickedBill != null && paid >= cost;
  const canConfirm = blindOk || faceUpOk;

  let prompt: string;
  if (step1) {
    prompt = "Step 1 — pick a bourbon (face-up bill, or the blind deck top).";
  } else if (drawBillMode.blind) {
    prompt = `Step 2 — tag exactly 1 card to sacrifice (blind draw, ${formatMoney(1)}).`;
  } else if (pickedBill) {
    prompt =
      paid < cost
        ? `Step 2 — tag ${formatMoney(cost - paid)} more (capital pays face, others = ${formatMoney(1)}).`
        : "Ready. Confirm to dispatch.";
  } else {
    prompt = "Pick a bourbon to continue.";
  }

  return (
    <div className="border-t border-amber-700/60 bg-gradient-to-b from-amber-950/50 to-slate-950 px-[18px] py-2">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded border border-amber-500 bg-amber-700/30 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[.14em] text-amber-100">
          Drawing bill
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[.10em] text-slate-300">
          {step1 ? (
            <>
              <span className="rounded bg-amber-500 px-1.5 py-px text-[9px] font-bold text-slate-950">
                1
              </span>{" "}
              pick bourbon
            </>
          ) : (
            <>
              <span className="rounded bg-slate-700 px-1.5 py-px text-[9px] font-bold text-slate-300">
                1
              </span>{" "}
              <span className="text-slate-500">→</span>{" "}
              <span className="rounded bg-amber-500 px-1.5 py-px text-[9px] font-bold text-slate-950">
                2
              </span>{" "}
              pay
            </>
          )}
        </span>
        <span className="font-display text-[13px] font-semibold text-amber-100">
          {pickedBill
            ? pickedBill.name
            : drawBillMode.blind
              ? "📜 Top of deck (blind)"
              : "no target picked"}
        </span>
        {pickedBill ? (
          <span className="font-mono text-[11px] uppercase tracking-[.10em] text-slate-300">
            cost{" "}
            <MoneyText n={cost} className="font-bold text-amber-200" />
            {" · paid "}
            <MoneyText
              n={paid}
              className={`font-bold ${paid >= cost ? "text-emerald-300" : "text-rose-300"}`}
            />
          </span>
        ) : null}
        {drawBillMode.blind ? (
          <span className="font-mono text-[11px] uppercase tracking-[.10em] text-slate-300">
            tagged{" "}
            <span
              className={`font-bold ${tagged.length === 1 ? "text-emerald-300" : "text-rose-300"}`}
            >
              {tagged.length}/1
            </span>
          </span>
        ) : null}
        {/* Action buttons sit next to the data — was previously pushed
            far right by a flex-1 spacer. */}
        {!step1 ? (
          <button
            type="button"
            onClick={resetDrawBillTarget}
            className="rounded-md border border-slate-600 bg-slate-800/60 px-3 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[.08em] text-slate-200 transition-colors hover:border-slate-400 hover:bg-slate-700/60"
          >
            ← Back
          </button>
        ) : null}
        <button
          type="button"
          onClick={cancelDrawBillMode}
          className="rounded-md border border-rose-700/60 bg-rose-900/30 px-3 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[.08em] text-rose-100 transition-colors hover:border-rose-400 hover:bg-rose-800/40"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!canConfirm}
          onClick={canConfirm ? confirmDrawBill : undefined}
          className={
            canConfirm
              ? "confirm-ready rounded-md border border-amber-300 bg-gradient-to-b from-amber-300 to-amber-600 px-5 py-1.5 font-sans text-[13px] font-bold uppercase tracking-[.07em] text-slate-950 hover:from-amber-200 hover:to-amber-500"
              : "rounded-md border border-slate-800 bg-slate-900 px-5 py-1.5 font-sans text-[13px] font-bold uppercase tracking-[.07em] text-slate-600 cursor-not-allowed"
          }
        >
          Confirm ↵
        </button>
        <span className="font-mono text-[10px] italic text-slate-400">
          {prompt}
        </span>
      </div>
    </div>
  );
}
