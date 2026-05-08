"use client";

/**
 * AgeOverlay — sticky status bar for interactive Age mode.
 *
 * Aging is conceptually the "Age Phase" of a round (one card committed
 * face-down per barrel), distinct from the main Action Phase actions —
 * but the engine collapses it into the action phase as `AGE_BOURBON`.
 *
 * v2.8: **auto-fire on completion** — the moment the player has both
 * picks (barrel from Rickhouse + card from hand), the store dispatches
 * AGE_BOURBON without a Confirm click. This overlay is now purely
 * informational: it tells the player what step they're on and lets
 * them bail out, but never blocks on a button press.
 */

import { useGameStore } from "@/lib/store/game";

export default function AgeOverlay() {
  const { state, ageMode, cancelAgeMode } = useGameStore();
  if (!state || !ageMode) return null;
  const human = state.players.find((p) => !p.isBot);
  if (!human) return null;

  const barrel = ageMode.pickedBarrelId
    ? state.allBarrels.find((b) => b.id === ageMode.pickedBarrelId)
    : null;
  const card = ageMode.pickedCardId
    ? human.hand.find((c) => c.id === ageMode.pickedCardId)
    : null;

  let prompt: string;
  if (!barrel && !card) {
    prompt =
      "Pick an aging barrel in your Rickhouse and any card in your hand — either order is fine. Auto-confirms on second pick.";
  } else if (!barrel) {
    prompt = "Now pick an aging barrel in your Rickhouse — it'll commit instantly.";
  } else if (!card) {
    prompt = "Now pick any card in your hand — it'll commit instantly.";
  } else {
    // Both picked — auto-fire is on the way; this state is transient.
    prompt = "Aging…";
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
        {/* Cancel button sits next to the picks, not pushed to the far
            right — keeps the mouse close to where the player just
            clicked. Age auto-fires on the second pick (no Confirm). */}
        <button
          type="button"
          onClick={cancelAgeMode}
          className="rounded-md border border-rose-700/60 bg-rose-900/30 px-3 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[.08em] text-rose-100 transition-colors hover:border-rose-400 hover:bg-rose-800/40"
        >
          Cancel
        </button>
        <span className="font-mono text-[10px] italic text-slate-400">
          {prompt}
        </span>
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
