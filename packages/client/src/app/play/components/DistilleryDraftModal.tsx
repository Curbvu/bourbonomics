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
import type { Distillery, DistilleryBonus } from "@bourbonomics/engine";

const BONUS_LABELS: Record<DistilleryBonus, { perk: string }> = {
  warehouse: {
    perk: "+1 rickhouse slot. Constraint: first sale must be a barrel aged 4+ years.",
  },
  high_rye: {
    perk:
      "Pre-aged high-rye barrel + 2 free 2-rye in your hand. +1 rep on every high-rye sale. Wheat counts as 0 toward composition.",
  },
  wheated_baron: {
    perk:
      "Pre-aged wheated barrel. Wheated bills cost 1 fewer grain. Single-grain composition buff fires at 2+. Rye counts as 0.",
  },
  old_line: {
    perk: "Pre-aged workhorse barrel — sale-ready in round 1. Starter pool has 1 fewer capital.",
  },
  broker: {
    perk:
      "Starter pool has 2 extra capital. May still trade in the final round. Rickhouse cap fixed at 4 (no expansion).",
  },
  connoisseur: {
    perk:
      "Drafts 4 mash bills (cap 4 in hand). All-grains composition buff fires at 3-of-4 distinct grain types and grants +3 rep.",
  },
  vanilla: {
    perk: "No starting bonus, no constraint. Pure symmetric play.",
  },
};

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-6 backdrop-blur"
    >
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(251,191,36,0.32) 0%, transparent 65%)",
        }}
      />

      <div className="relative flex max-w-[1180px] flex-col items-center gap-6">
        <div className="text-center">
          <div className="font-mono text-[11px] uppercase tracking-[.18em] text-amber-300">
            Setup · Distillery selection
          </div>
          <div className="mt-1 font-display text-2xl font-semibold text-amber-100">
            Pick your distillery — every other player will pick a different one
          </div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[.14em] text-slate-400">
            {humanWaitingOn.name} is on the clock · {pool.length} cards remaining
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
  selected,
  onSelect,
}: {
  def: Distillery;
  selected: boolean;
  onSelect: () => void;
}) {
  const perk = BONUS_LABELS[def.bonus]?.perk ?? "—";
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`Select ${def.name}`}
      className={[
        "group flex h-[360px] w-[300px] cursor-pointer flex-col rounded-xl border-2 p-5 text-left shadow-[0_8px_24px_rgba(0,0,0,0.45)] transition-all",
        selected
          ? "-translate-y-1 border-amber-300 bg-gradient-to-b from-amber-700/50 via-amber-900/50 to-slate-950 shadow-[0_0_0_3px_rgba(251,191,36,0.55),0_8px_24px_rgba(0,0,0,0.45)]"
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
      {def.flavorText ? (
        <p className="mt-1 font-display text-[13px] italic leading-snug text-amber-200/85">
          {def.flavorText}
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 text-[12.5px] leading-snug">
        <div>
          <div className="font-mono text-[9.5px] font-semibold uppercase tracking-[.16em] text-emerald-300">
            Starting bonus
          </div>
          <div className="mt-1 text-emerald-100/95">{perk}</div>
        </div>
        <div>
          <div className="font-mono text-[9.5px] font-semibold uppercase tracking-[.16em] text-sky-300">
            Rickhouse layout
          </div>
          <div className="mt-1 text-sky-100/95">
            {def.slots} {def.slots === 1 ? "slot" : "slots"} total
          </div>
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
