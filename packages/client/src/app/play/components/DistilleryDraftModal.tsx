"use client";

/**
 * Distillery draft modal — pre-round-1 identity pick.
 *
 * Visual style ported from the dev branch's DistilleryDraftModal. The
 * mechanic differs: the v2.1 rules have all distilleries available in a
 * shared pool that each player picks from in reverse-snake order with no
 * duplicates. The modal renders only when it's the human's turn to pick.
 *
 * Flow: click a card to *select*, then click "Start {Distillery}" below
 * to commit via SELECT_DISTILLERY.
 */

import { useEffect, useState } from "react";

import { useGameStore } from "@/lib/store/game";
import type { Distillery } from "@bourbonomics/engine";

export default function DistilleryDraftModal() {
  const { state, humanWaitingOn, dispatch } = useGameStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Reset the local selection whenever the cursor moves so a stale tile
  // doesn't stay highlighted between picks.
  const cursor = state?.distillerySelectionCursor ?? 0;
  useEffect(() => {
    setSelectedId(null);
  }, [cursor]);

  if (!state) return null;
  if (state.phase !== "distillery_selection") return null;
  if (!humanWaitingOn) return null;

  const pool = state.distilleryPool;
  const selectedDef = selectedId ? pool.find((d) => d.id === selectedId) ?? null : null;

  const confirm = () => {
    if (!selectedId) return;
    dispatch({
      type: "SELECT_DISTILLERY",
      playerId: humanWaitingOn.id,
      distilleryId: selectedId,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pick your distillery"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur"
    >
      <div
        className="pointer-events-none fixed left-1/2 top-1/2 h-[560px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(251,191,36,0.32) 0%, transparent 65%)",
        }}
      />

      <div className="relative flex max-h-full w-full max-w-[1240px] flex-col items-center gap-3">
        <div className="text-center">
          <div className="font-mono text-[12px] uppercase tracking-[.18em] text-amber-300">
            Setup · Distillery selection
          </div>
          <div className="mt-0.5 font-display text-xl font-semibold text-amber-100">
            Pick your distillery
          </div>
          <div className="mt-0.5 font-mono text-[12px] uppercase tracking-[.14em] text-slate-400">
            {humanWaitingOn.name} on the clock · {pool.length} remaining · every player picks a different one
          </div>
        </div>

        {/* v3.7: 4-column layout so all 4 distillery cards land in one
            row and the modal never scrolls. Cards shrink horizontally
            and lose the bottom CTA strip (the Start button below is
            the single source of truth for committing). */}
        <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-4">
          {pool.map((def) => (
            <DistilleryCardTile
              key={def.id}
              def={def}
              selected={selectedId === def.id}
              onSelect={() => setSelectedId(def.id)}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={confirm}
          disabled={!selectedDef}
          className={[
            "rounded-md border px-6 py-2 font-sans text-sm font-bold uppercase tracking-[.05em] transition-all",
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
      </div>
    </div>
  );
}

function DistilleryCardTile({
  def,
  selected,
  onSelect,
}: {
  def: Distillery;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`Select ${def.name}`}
      className={[
        "group flex h-[360px] cursor-pointer flex-col rounded-xl border-2 p-3.5 text-left shadow-[0_6px_18px_rgba(0,0,0,0.45)] transition-all",
        selected
          ? "-translate-y-0.5 border-amber-300 bg-gradient-to-b from-amber-700/50 via-amber-900/50 to-slate-950 shadow-[0_0_0_3px_rgba(251,191,36,0.55),0_8px_24px_rgba(0,0,0,0.45)]"
          : "border-amber-700 bg-gradient-to-b from-amber-700/30 via-amber-900/40 to-slate-950 hover:border-amber-400 hover:shadow-[0_0_0_3px_rgba(251,191,36,0.25),0_8px_24px_rgba(0,0,0,0.45)]",
      ].join(" ")}
    >
      <header className="flex items-baseline justify-between gap-1">
        <span className="font-mono text-[12px] font-semibold uppercase tracking-[.16em] text-amber-300">
          Distillery · {def.difficulty}
        </span>
        {selected ? (
          <span className="rounded border border-amber-300 bg-amber-300/20 px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-[.10em] text-amber-100">
            Selected
          </span>
        ) : null}
      </header>

      <h3 className="mt-2 font-display text-[19px] font-semibold leading-tight text-amber-100">
        {def.name}
      </h3>
      {def.flavorText ? (
        <p className="mt-0.5 line-clamp-2 font-display text-[12px] italic leading-snug text-amber-200/85">
          {def.flavorText}
        </p>
      ) : null}

      <div className="mt-2.5 flex flex-1 flex-col gap-2 text-[11.5px] leading-snug">
        <div className="flex-1">
          <div className="font-mono text-[12px] font-semibold uppercase tracking-[.14em] text-emerald-300">
            Card text
          </div>
          <p className="mt-0.5 line-clamp-6 text-emerald-100/95">{def.cardText}</p>
        </div>
        <div className="flex items-baseline justify-between gap-2 pt-1">
          <div>
            <div className="font-mono text-[12px] font-semibold uppercase tracking-[.14em] text-sky-300">
              Slots
            </div>
            <div className="text-sky-100/95">
              {def.slots}
              {def.maxSlots != null && def.maxSlots === def.slots ? " (capped)" : ""}
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[12px] font-semibold uppercase tracking-[.14em] text-fuchsia-300">
              Axis
            </div>
            <div className="text-fuchsia-100/95">{def.axis}</div>
          </div>
        </div>
        {!def.implemented ? (
          <p className="font-mono text-[11px] uppercase tracking-[.12em] text-amber-300/80">
            Preview · ability not yet resolved
          </p>
        ) : null}
      </div>
    </button>
  );
}
