"use client";

/**
 * AgeOverlay — sticky control bar for interactive Age mode.
 *
 * Aging is conceptually the "Age Phase" of a round (one card committed
 * face-down per barrel), distinct from the main Action Phase actions —
 * but the engine collapses it into the action phase as `AGE_BOURBON`.
 * This overlay surfaces the picker so the player can choose:
 *
 *   1. Which of their barrels to age (click a chip in the Rickhouse).
 *   2. Which one card from hand to commit on top of it.
 *
 * The Rickhouse + HandTray wire their own clicks; this component is the
 * contract surface — it prompts the player and lets them commit.
 */

import { useGameStore } from "@/lib/store/game";

export default function AgeOverlay() {
  const { state, ageMode, cancelAgeMode, confirmAge } = useGameStore();
  if (!state || !ageMode) return null;
  const human = state.players.find((p) => !p.isBot);
  if (!human) return null;

  const barrel = ageMode.pickedBarrelId
    ? state.allBarrels.find((b) => b.id === ageMode.pickedBarrelId)
    : null;
  const card = ageMode.pickedCardId
    ? human.hand.find((c) => c.id === ageMode.pickedCardId)
    : null;

  const canConfirm = barrel != null && card != null;

  let prompt: string;
  if (!barrel) {
    prompt = "Pick one of your barrels in the Rickhouse to age.";
  } else if (!card) {
    prompt = "Pick one card from your hand to commit on top of the barrel.";
  } else {
    prompt = "Ready to age. Confirm to dispatch.";
  }

  return (
    <div className="border-t border-amber-700/60 bg-gradient-to-b from-amber-950/50 to-slate-950 px-[18px] py-2">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded border border-amber-500 bg-amber-700/30 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[.14em] text-amber-100">
          Aging
        </span>
        <span className="font-display text-[13px] font-semibold text-amber-100">
          {barrel
            ? `${barrel.attachedMashBill?.name ?? "barrel"} · age ${barrel.age} → ${barrel.age + 1}`
            : "no barrel picked"}
        </span>
        {card ? (
          <span className="font-mono text-[11px] uppercase tracking-[.10em] text-slate-300">
            paying with{" "}
            <span className="font-bold text-emerald-300">
              {cardLabel(card)}
            </span>
          </span>
        ) : null}
        <span className="font-mono text-[10px] italic text-slate-400">
          {prompt}
        </span>
        <span className="flex-1" />
        <button
          type="button"
          onClick={cancelAgeMode}
          className="rounded-md border border-rose-700/60 bg-rose-900/30 px-3 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[.08em] text-rose-100 transition-colors hover:border-rose-400 hover:bg-rose-800/40"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!canConfirm}
          onClick={canConfirm ? confirmAge : undefined}
          className={
            canConfirm
              ? "confirm-ready rounded-md border border-amber-300 bg-gradient-to-b from-amber-300 to-amber-600 px-5 py-1.5 font-sans text-[13px] font-bold uppercase tracking-[.07em] text-slate-950 hover:from-amber-200 hover:to-amber-500"
              : "rounded-md border border-slate-800 bg-slate-900 px-5 py-1.5 font-sans text-[13px] font-bold uppercase tracking-[.07em] text-slate-600 cursor-not-allowed"
          }
        >
          Confirm ↵
        </button>
      </div>
    </div>
  );
}

function cardLabel(card: { type: string; subtype?: string; capitalValue?: number; resourceCount?: number; displayName?: string }): string {
  if (card.displayName) return card.displayName;
  if (card.type === "capital") return `Capital $${card.capitalValue ?? 1}`;
  const sub = card.subtype ?? "";
  const subCap = sub ? sub[0]!.toUpperCase() + sub.slice(1) : "Resource";
  const count = card.resourceCount && card.resourceCount > 1 ? `${card.resourceCount}× ` : "";
  return `${count}${subCap}`;
}
