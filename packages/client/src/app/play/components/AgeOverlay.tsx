"use client";

/**
 * AgeOverlay — progress banner for the per-turn Aging window.
 *
 * Aging is forced when `needsAgeBarrels` is true on the local seat —
 * the store auto-engages ageMode the moment that flips true. This
 * banner prompts the player through each card→barrel commit (AGE_BOURBON
 * auto-fires on the second pick; no Confirm button), so the banner is
 * purely informational + a Cancel escape.
 */

import { useGameStore } from "@/lib/store/game";

export default function AgeOverlay() {
  const {
    state,
    ageMode,
    cancelAgeMode,
    ageTotalThisPhase,
    multiplayerMode,
  } = useGameStore();
  if (!state || !ageMode) return null;

  const seatId = multiplayerMode
    ? multiplayerMode.playerId
    : state.players.find((p) => !p.isBot)?.id;
  if (!seatId) return null;
  const me = state.players.find((p) => p.id === seatId);
  if (!me) return null;

  const barrel = ageMode.pickedBarrelId
    ? state.allBarrels.find((b) => b.id === ageMode.pickedBarrelId)
    : null;
  const card = ageMode.pickedCardId
    ? me.hand.find((c) => c.id === ageMode.pickedCardId)
    : null;

  // Remaining ageable barrels = same predicate as canEnterAgeMode in
  // ActionBar.tsx; mirrored here so the count drops as barrels finish.
  const remaining = state.allBarrels.filter(
    (b) =>
      b.ownerId === seatId &&
      b.phase === "aging" &&
      !(b.completedInRound != null && state.round <= b.completedInRound) &&
      !b.inspectedThisRound &&
      (!b.agedThisRound || b.extraAgesAvailable > 0),
  ).length;
  const total = ageTotalThisPhase ?? remaining;
  const done = Math.max(0, total - remaining);

  let prompt: string;
  if (!card && !barrel) {
    prompt = "Pick a card from your hand, then a barrel in your rickhouse.";
  } else if (!card) {
    prompt = "Now pick a card from your hand — it commits instantly.";
  } else if (!barrel) {
    prompt = "Now pick a barrel in your rickhouse — it commits instantly.";
  } else {
    prompt = "Aging…";
  }

  return (
    <div
      className="relative border-t border-amber-700/60 bg-gradient-to-b from-amber-950/55 to-slate-950 px-[18px] py-2.5"
    >
      {/* Glowing left rule so the banner reads as a "live phase strip" */}
      <span
        aria-hidden
        className="absolute inset-y-1 left-0 w-[3px] rounded-r-sm"
        style={{
          background:
            "linear-gradient(180deg, rgba(240,201,112,.9), rgba(176,106,56,.5))",
          boxShadow: "0 0 10px rgba(240,201,112,.55)",
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded border border-amber-500 bg-amber-700/30 px-2 py-0.5 font-mono text-[12px] font-bold uppercase tracking-[.16em] text-amber-100">
          Aging Phase
        </span>
        <span className="font-display text-[15px] font-semibold text-amber-100">
          {barrel
            ? `${barrel.attachedMashBill?.name ?? "barrel"} · age ${barrel.age} → ${barrel.age + 1}`
            : "Commit a card to a barrel"}
        </span>
        <span
          className="rounded border border-amber-700/60 bg-slate-950/60 px-2 py-0.5 font-mono text-[12px] font-bold uppercase tracking-[.14em] text-amber-200"
          aria-label={`Aged ${done} of ${total}`}
        >
          {done} of {total} aged
        </span>
        {card ? (
          <span className="font-mono text-[13px] uppercase tracking-[.10em] text-slate-300">
            paying with{" "}
            <span className="font-bold text-emerald-300">
              {cardLabel(card)}
            </span>
          </span>
        ) : null}
        <button
          type="button"
          onClick={cancelAgeMode}
          className="rounded-md border border-rose-700/60 bg-rose-900/30 px-3 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[.08em] text-rose-100 transition-colors hover:border-rose-400 hover:bg-rose-800/40"
        >
          Cancel
        </button>
        <span className="font-mono text-[10.5px] italic text-slate-400">
          {prompt}
        </span>
      </div>
    </div>
  );
}

function cardLabel(card: { type: string; subtype?: string; laborSubtype?: string; resourceCount?: number; displayName?: string }): string {
  if (card.displayName) return card.displayName;
  if (card.type === "labor") {
    const sub = card.laborSubtype ?? "labor";
    return `Labor · ${sub[0]!.toUpperCase()}${sub.slice(1)}`;
  }
  const sub = card.subtype ?? "";
  const subCap = sub ? sub[0]!.toUpperCase() + sub.slice(1) : "Resource";
  const count = card.resourceCount && card.resourceCount > 1 ? `${card.resourceCount}× ` : "";
  return `${count}${subCap}`;
}
