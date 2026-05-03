"use client";

/**
 * Distillery draft modal — pre-round-1 identity pick.
 *
 * The flow mirrors `MarketRevealModal` (two cards revealed with a
 * Hearthstone-style flip-in) with one critical difference: it's a
 * **double-commit**. First the player clicks one of the two dealt
 * cards to *select* it, then a "Start {Distillery}" button below
 * commits the choice and resolves the starting bonuses.
 *
 * Only renders during `state.phase === "distillery_draft"` for the
 * human player who hasn't yet confirmed. Auto-dismisses once the
 * `DISTILLERY_CONFIRM` reducer call sets `chosenDistilleryId`.
 */

import { useEffect, useState } from "react";

import { DISTILLERY_CARDS_BY_ID } from "@/lib/catalogs/distillery.generated";
import type { DistilleryCardDef } from "@/lib/catalogs/types";
import { useGameStore } from "@/lib/store/gameStore";

export default function DistilleryDraftModal() {
  const state = useGameStore((s) => s.state);
  const dispatch = useGameStore((s) => s.dispatch);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Reset the local selection whenever the dealt cards change (e.g. on
  // a fresh game) so we don't leave a stale highlight from the
  // previous draft.
  const humanId = state?.playerOrder.find(
    (id) => state.players[id].kind === "human",
  );
  const dealt = humanId ? state?.players[humanId]?.dealtDistilleryIds ?? [] : [];
  const dealtKey = dealt.join("|");
  useEffect(() => {
    setSelectedId(null);
  }, [dealtKey]);

  if (!state) return null;
  if (!humanId) return null;
  if (state.phase !== "distillery_draft") return null;
  const me = state.players[humanId];
  if (me.eliminated) return null;
  if (me.chosenDistilleryId) return null;
  if (dealt.length === 0) return null;

  const selectedDef = selectedId ? DISTILLERY_CARDS_BY_ID[selectedId] : null;

  const confirm = () => {
    if (!selectedId) return;
    dispatch({ t: "DISTILLERY_CONFIRM", playerId: humanId, chosenId: selectedId });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pick one of two distillery cards"
      className="market-reveal-stage fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-6 backdrop-blur"
    >
      <div
        className="market-reveal-glow pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(251,191,36,0.32) 0%, transparent 65%)",
        }}
      />

      <div className="relative flex max-w-[920px] flex-col items-center gap-6">
        <div className="text-center">
          <div className="font-mono text-[11px] uppercase tracking-[.18em] text-amber-300">
            Pre-round 1 · Distillery draft
          </div>
          <div className="mt-1 font-display text-2xl font-semibold text-amber-100">
            Pick your distillery — the other returns to the deck
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {dealt.map((cardId, idx) => {
            const def = DISTILLERY_CARDS_BY_ID[cardId];
            if (!def) return null;
            return (
              <DistilleryCardTile
                key={`${cardId}-${idx}`}
                def={def}
                delayMs={idx * 120}
                selected={selectedId === cardId}
                onSelect={() => setSelectedId(cardId)}
              />
            );
          })}
        </div>

        <button
          type="button"
          onClick={confirm}
          disabled={!selectedDef}
          className={[
            "rounded-md border px-6 py-2.5 font-sans text-sm font-bold uppercase tracking-[.05em] transition-all",
            selectedDef
              ? "border-amber-400 bg-gradient-to-b from-amber-300 to-amber-500 text-slate-950 shadow-[0_0_0_3px_rgba(251,191,36,0.30),inset_0_1px_0_rgba(255,255,255,0.25)] hover:from-amber-200 hover:to-amber-400"
              : "cursor-not-allowed border-slate-700 bg-slate-900 text-slate-600 shadow-none",
          ].join(" ")}
          title={
            selectedDef
              ? `Lock in ${selectedDef.name} and resolve its starting bonus`
              : "Click a card above to select it"
          }
        >
          {selectedDef ? `Start ${selectedDef.name} ↵` : "Select a distillery"}
        </button>

        <div className="font-mono text-[10px] uppercase tracking-[.14em] text-slate-400">
          {selectedDef ? "click Start to confirm" : "click a card to select it"}
        </div>
      </div>
    </div>
  );
}

function DistilleryCardTile({
  def,
  delayMs,
  selected,
  onSelect,
}: {
  def: DistilleryCardDef;
  delayMs: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{ animationDelay: `${delayMs}ms` }}
      aria-pressed={selected}
      aria-label={`Select ${def.name}`}
      className={[
        "market-reveal-card group flex h-[400px] w-[320px] cursor-pointer flex-col rounded-xl border-2 p-5 text-left shadow-[0_8px_24px_rgba(0,0,0,0.45)] transition-all",
        selected
          ? "border-amber-300 bg-gradient-to-b from-amber-700/50 via-amber-900/50 to-slate-950 shadow-[0_0_0_3px_rgba(251,191,36,0.55),0_8px_24px_rgba(0,0,0,0.45)] -translate-y-1"
          : "border-amber-700 bg-gradient-to-b from-amber-700/30 via-amber-900/40 to-slate-950 hover:border-amber-400 hover:shadow-[0_0_0_3px_rgba(251,191,36,0.25),0_8px_24px_rgba(0,0,0,0.45)]",
      ].join(" ")}
    >
      <header className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[.18em] text-amber-300">
          Distillery
        </span>
        {selected ? (
          <span className="rounded border border-amber-300 bg-amber-300/20 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[.10em] text-amber-100">
            Selected
          </span>
        ) : null}
      </header>

      <h3 className="mt-3 font-display text-2xl font-semibold leading-tight text-amber-100">
        {def.name}
      </h3>
      <p className="mt-1 font-display text-[13px] italic leading-snug text-amber-200/85">
        {def.flavor}
      </p>

      <div className="mt-4 flex flex-col gap-3 text-[12.5px] leading-snug">
        <div>
          <div className="font-mono text-[9.5px] font-semibold uppercase tracking-[.16em] text-emerald-300">
            Starting bonus
          </div>
          <div className="mt-1 text-emerald-100/95">{def.bonus_text}</div>
        </div>
        <div>
          <div className="font-mono text-[9.5px] font-semibold uppercase tracking-[.16em] text-sky-300">
            Ongoing perk
          </div>
          <div className="mt-1 text-sky-100/95">{def.perk_text}</div>
        </div>
      </div>

      <div className="mt-auto pt-4">
        <span
          className={[
            "inline-flex items-center gap-2 rounded-md border px-4 py-1.5 font-sans text-xs font-bold uppercase tracking-[.05em] shadow-[inset_0_1px_0_rgba(255,255,255,.2)] transition-colors",
            selected
              ? "border-amber-300 bg-gradient-to-b from-amber-200 to-amber-400 text-slate-950"
              : "border-amber-500 bg-gradient-to-b from-amber-500 to-amber-700 text-slate-950 group-hover:from-amber-400 group-hover:to-amber-600",
          ].join(" ")}
        >
          {selected ? "Selected ✓" : "Select this card"}
        </span>
      </div>
    </button>
  );
}
