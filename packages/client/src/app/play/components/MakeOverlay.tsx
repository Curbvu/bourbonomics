"use client";

/**
 * MakeOverlay — sticky control bar for interactive Make-Bourbon mode.
 *
 * Two-step picker:
 *   1. Click a mash bill in your hand.
 *   2. Tag the resource cards you want to commit (multi-select).
 *
 * The target slot is auto-picked (first free) since v2.2 collapsed the
 * rickhouse tier distinction — every empty slot is equivalent.
 *
 * Confirm uses the engine's own `validateAction(MAKE_BOURBON, …)` to
 * gate so the player gets the canonical recipe error (e.g. "need ≥3
 * rye") if their selection doesn't satisfy the bill.
 */

import type { MashBill, PlayerState } from "@bourbonomics/engine";
import { validateAction } from "@bourbonomics/engine";
import { useGameStore } from "@/lib/store/game";

export default function MakeOverlay() {
  const { state, makeMode, cancelMakeMode, confirmMake } = useGameStore();
  if (!state || !makeMode) return null;
  const human = state.players.find((p) => !p.isBot);
  if (!human) return null;

  const bill = makeMode.pickedMashBillId
    ? human.mashBills.find((m) => m.id === makeMode.pickedMashBillId)
    : null;
  const tagged = human.hand.filter((c) =>
    makeMode.spendCardIds.includes(c.id),
  );

  const slotsTotal = human.rickhouseSlots.length;
  const slotsUsed = state.allBarrels.filter((b) => b.ownerId === human.id).length;
  const slotsFree = slotsTotal - slotsUsed;

  // Pre-flight validation against the engine — gives us the same error
  // copy the engine would surface on dispatch.
  const occupied = new Set(
    state.allBarrels
      .filter((b) => b.ownerId === human.id)
      .map((b) => b.slotId),
  );
  const freeSlot = human.rickhouseSlots.find((s) => !occupied.has(s.id));
  const validation = bill && freeSlot && tagged.length > 0
    ? validateAction(state, {
        type: "MAKE_BOURBON",
        playerId: human.id,
        cardIds: makeMode.spendCardIds,
        mashBillId: bill.id,
        slotId: freeSlot.id,
      })
    : null;

  const canConfirm = validation?.legal === true;

  let prompt: string;
  if (slotsFree === 0) {
    prompt = "Your rickhouse is full — sell a barrel before making another.";
  } else if (human.mashBills.length === 0) {
    prompt = "No mash bills in hand. Draw one before you can make bourbon.";
  } else if (!bill) {
    prompt = "Pick a mash bill from your hand.";
  } else if (tagged.length === 0) {
    prompt = `Tag the cards to commit (recipe: ${recipeSummary(bill, human)}).`;
  } else if (validation && !validation.legal) {
    prompt = validation.reason ?? "Tagged cards don't satisfy the recipe yet.";
  } else {
    prompt = "Ready to make. Confirm to dispatch.";
  }

  return (
    <div className="border-t border-amber-700/60 bg-gradient-to-b from-amber-950/50 to-slate-950 px-[18px] py-2">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded border border-amber-500 bg-amber-700/30 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[.14em] text-amber-100">
          Making
        </span>
        <span className="font-display text-[13px] font-semibold text-amber-100">
          {bill ? bill.name : "no bill picked"}
        </span>
        {bill ? (
          <span className="font-mono text-[10px] uppercase tracking-[.10em] text-slate-400">
            recipe: {recipeSummary(bill, human)}
          </span>
        ) : null}
        {tagged.length > 0 ? (
          <span className="font-mono text-[11px] uppercase tracking-[.10em] text-slate-300">
            tagged{" "}
            <span className="font-bold text-emerald-300">
              {tagged.length} card{tagged.length === 1 ? "" : "s"}
            </span>
          </span>
        ) : null}
        <span className="font-mono text-[10px] italic text-slate-400">
          {prompt}
        </span>
        <span className="flex-1" />
        <span className="font-mono text-[10px] uppercase tracking-[.10em] text-slate-500">
          {slotsFree}/{slotsTotal} free
        </span>
        <button
          type="button"
          onClick={cancelMakeMode}
          className="rounded-md border border-rose-700/60 bg-rose-900/30 px-3 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[.08em] text-rose-100 transition-colors hover:border-rose-400 hover:bg-rose-800/40"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!canConfirm}
          onClick={canConfirm ? confirmMake : undefined}
          className={
            canConfirm
              ? "rounded-md border border-amber-500 bg-gradient-to-b from-amber-500 to-amber-700 px-3.5 py-1 font-sans text-[11px] font-bold uppercase tracking-[.05em] text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,.2)] transition-colors hover:from-amber-400 hover:to-amber-600"
              : "rounded-md border border-slate-800 bg-slate-900 px-3.5 py-1 font-sans text-[11px] font-bold uppercase tracking-[.05em] text-slate-600 cursor-not-allowed"
          }
        >
          Confirm ↵
        </button>
      </div>
    </div>
  );
}

function recipeSummary(bill: MashBill, player: PlayerState): string {
  const r = bill.recipe ?? {};
  const bits: string[] = ["1 cask", "≥1 corn", "≥1 grain"];
  if (r.minCorn && r.minCorn > 1) bits.push(`≥${r.minCorn} corn`);
  if (r.minRye) bits.push(`≥${r.minRye} rye`);
  if (r.minBarley) bits.push(`≥${r.minBarley} barley`);
  if (r.minWheat) {
    const eff = player.distillery?.bonus === "wheated_baron" && (bill.recipe?.maxRye === 0)
      ? Math.max(0, r.minWheat - 1)
      : r.minWheat;
    bits.push(eff === 0 ? "wheat optional" : `≥${eff} wheat`);
  }
  if (r.maxRye === 0) bits.push("no rye");
  else if (r.maxRye != null) bits.push(`≤${r.maxRye} rye`);
  if (r.maxWheat === 0) bits.push("no wheat");
  else if (r.maxWheat != null) bits.push(`≤${r.maxWheat} wheat`);
  if (r.minTotalGrain) bits.push(`grain ≥${r.minTotalGrain}`);
  // Strip the universal-rule prefix when we're showing extra constraints
  // — keeps the line short.
  const extras = bits.slice(3);
  return extras.length > 0 ? `cask + corn + ${extras.join(" · ")}` : "cask + corn + grain";
}

