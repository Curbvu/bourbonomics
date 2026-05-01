"use client";

/**
 * Make-bourbon dialog.
 *
 * Replaces the old auto-pick behaviour where ActionBar's "Make bourbon"
 * button silently grabbed the first viable mash from hand. Now the player
 * sees their full resource hand, ticks the cards they want in the mash,
 * gets live validation feedback against the rules in lib/rules/mash.ts
 * (1 cask, ≥1 corn, ≥1 grain, total ≤ 6), picks a destination rickhouse
 * if more than one is open, and confirms.
 *
 * Mounted by ActionBar via local state — opens when the player clicks the
 * "Make bourbon" button there.
 */

import { useEffect, useMemo, useState } from "react";

import { SPECIALTY_RESOURCES_BY_ID } from "@/lib/catalogs/resource.generated";
import type { ResourceType } from "@/lib/catalogs/types";
import type { RickhouseId } from "@/lib/engine/rickhouses";
import { RICKHOUSES } from "@/lib/engine/rickhouses";
import { summarizeMash, validateMash } from "@/lib/rules/mash";
import { useGameStore } from "@/lib/store/gameStore";

const RESOURCE_TINT: Record<
  ResourceType,
  { border: string; bg: string; ink: string; selectedBg: string }
> = {
  cask: {
    border: "border-amber-700",
    bg: "bg-amber-700/[0.18]",
    ink: "text-amber-200",
    selectedBg: "bg-amber-500/[0.40]",
  },
  corn: {
    border: "border-yellow-500/45",
    bg: "bg-yellow-500/[0.15]",
    ink: "text-yellow-100",
    selectedBg: "bg-yellow-500/[0.40]",
  },
  barley: {
    border: "border-lime-500/45",
    bg: "bg-lime-500/[0.15]",
    ink: "text-lime-100",
    selectedBg: "bg-lime-500/[0.40]",
  },
  rye: {
    border: "border-rose-600/45",
    bg: "bg-rose-600/[0.15]",
    ink: "text-rose-100",
    selectedBg: "bg-rose-600/[0.40]",
  },
  wheat: {
    border: "border-sky-500/45",
    bg: "bg-sky-500/[0.15]",
    ink: "text-sky-100",
    selectedBg: "bg-sky-500/[0.40]",
  },
};

/**
 * The component is only mounted while the modal should be visible — the
 * parent renders <MakeBourbonModal /> conditionally. That way fresh state
 * (selection, chosen rickhouse) comes free with every mount; no reset
 * effect needed.
 */
export default function MakeBourbonModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const state = useGameStore((s) => s.state);
  const dispatch = useGameStore((s) => s.dispatch);

  const humanId = state?.playerOrder.find(
    (id) => state.players[id].kind === "human",
  );
  const me = humanId ? state?.players[humanId] : null;

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [chosenRickhouse, setChosenRickhouse] = useState<RickhouseId | null>(
    null,
  );

  // Esc-to-close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const openRickhouses = useMemo(() => {
    if (!state) return [];
    return state.rickhouses
      .map((h, idx) => ({
        h,
        idx,
        def: RICKHOUSES[idx],
        free: RICKHOUSES[idx].capacity - h.barrels.length,
      }))
      .filter((row) => row.free > 0);
  }, [state]);

  const defaultRickhouseId = openRickhouses[0]?.h.id ?? null;
  const effectiveRickhouseId = chosenRickhouse ?? defaultRickhouseId;

  const mash = useMemo(() => {
    if (!me) return [];
    return me.resourceHand.filter((r) => selected.has(r.instanceId));
  }, [me, selected]);

  const validation = validateMash(mash);
  const breakdown = summarizeMash(mash);

  if (!me || !humanId) return null;

  const toggle = (instanceId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(instanceId)) next.delete(instanceId);
      else next.add(instanceId);
      return next;
    });
  };

  const make = () => {
    if (!validation.ok || !effectiveRickhouseId) return;
    dispatch({
      t: "MAKE_BOURBON",
      playerId: humanId,
      rickhouseId: effectiveRickhouseId,
      resourceInstanceIds: Array.from(selected),
    });
    onClose();
  };

  const noResources = me.resourceHand.length === 0;
  const noRickhouse = openRickhouses.length === 0;
  const canMake = validation.ok && !!effectiveRickhouseId && !noResources;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Make bourbon"
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/85 p-6 backdrop-blur"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-amber-700 bg-slate-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="mb-4 flex items-baseline justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[.18em] text-amber-300">
              Action · Make bourbon
            </div>
            <h2 className="mt-1 font-display text-2xl font-semibold text-amber-100">
              Build your mash
            </h2>
            <p className="mt-1 font-mono text-[11px] text-slate-400">
              1 cask + ≥1 corn + ≥1 grain · max 6 cards
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md border border-slate-700 px-2 py-0.5 font-mono text-[11px] text-slate-400 hover:border-slate-500 hover:text-slate-200"
          >
            ✕
          </button>
        </header>

        {/* Resource grid */}
        {noResources ? (
          <div className="rounded-md border border-dashed border-slate-700 px-4 py-8 text-center font-mono text-[11px] uppercase tracking-[.12em] text-slate-500">
            no resources in hand · draw some first
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {me.resourceHand.map((r) => {
              const tint = RESOURCE_TINT[r.resource];
              const isSelected = selected.has(r.instanceId);
              const specialty = r.specialtyId
                ? SPECIALTY_RESOURCES_BY_ID[r.specialtyId]
                : null;
              // If the player already has a cask selected, additional casks
              // can be ticked but are visually marked as "would invalidate".
              return (
                <button
                  key={r.instanceId}
                  type="button"
                  onClick={() => toggle(r.instanceId)}
                  title={specialty?.rule}
                  aria-pressed={isSelected}
                  className={[
                    "flex h-[88px] flex-col rounded-md border-2 p-2 text-left transition-transform",
                    tint.border,
                    isSelected
                      ? `${tint.selectedBg} -translate-y-0.5 ring-2 ring-amber-300`
                      : `${tint.bg} hover:-translate-y-0.5`,
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-mono text-[9px] font-bold uppercase tracking-[.12em] ${tint.ink}`}
                    >
                      {r.resource}
                    </span>
                    {isSelected ? (
                      <span className="grid h-4 w-4 place-items-center rounded-full bg-amber-300 font-mono text-[9px] font-bold text-slate-950">
                        ✓
                      </span>
                    ) : null}
                  </div>
                  <div
                    className={`mt-auto font-mono text-[10px] leading-tight ${tint.ink}`}
                  >
                    {specialty ? (
                      <span className="line-clamp-2 opacity-80">
                        {specialty.name}
                      </span>
                    ) : (
                      <span className="opacity-60 italic">plain</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Live validation + breakdown */}
        <div className="mt-4 flex items-center gap-3 rounded-md border border-slate-800 bg-slate-950/60 px-3.5 py-2.5">
          <StatusDot ok={validation.ok && !noResources} />
          <div className="flex-1 font-mono text-[11px] text-slate-300">
            {noResources
              ? "No resources to draft from."
              : validation.ok
                ? "Valid mash."
                : validation.reason}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[.12em] tabular-nums text-slate-500">
            {breakdown.cask}c · {breakdown.corn}🌽 ·{" "}
            {breakdown.grain}g · {breakdown.total}/6
          </div>
        </div>

        {/* Rickhouse picker */}
        <div className="mt-4">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-[.12em] text-slate-500">
            destination rickhouse
          </div>
          {noRickhouse ? (
            <div className="rounded-md border border-dashed border-rose-700 px-3 py-2 font-mono text-[11px] text-rose-300">
              No open slot — every rickhouse is full.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {openRickhouses.map(({ h, def, free }) => {
                const isChosen = h.id === effectiveRickhouseId;
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setChosenRickhouse(h.id)}
                    aria-pressed={isChosen}
                    className={[
                      "flex items-baseline justify-between rounded-md border px-3 py-2 text-left transition-colors",
                      isChosen
                        ? "border-amber-500 bg-amber-700/[0.20]"
                        : "border-slate-700 bg-slate-900 hover:border-amber-500/60 hover:bg-amber-700/[0.10]",
                    ].join(" ")}
                  >
                    <span className="font-display text-sm font-semibold text-amber-100">
                      {def.name}
                    </span>
                    <span className="font-mono text-[10px] tabular-nums text-slate-500">
                      {free} open
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <footer className="mt-5 flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-700 px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[.05em] text-slate-300 hover:border-slate-500 hover:text-slate-100"
          >
            Cancel
          </button>
          <span className="flex-1" />
          <button
            type="button"
            onClick={make}
            disabled={!canMake}
            className="rounded-md border border-amber-700 bg-gradient-to-b from-amber-500 to-amber-700 px-4 py-1.5 font-sans text-xs font-bold uppercase tracking-[.05em] text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,.2)] transition-colors hover:from-amber-400 hover:to-amber-600 disabled:cursor-not-allowed disabled:border-slate-700 disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-500 disabled:shadow-none"
          >
            Make bourbon ↵
          </button>
        </footer>
      </div>
    </div>
  );
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={[
        "grid h-5 w-5 place-items-center rounded-full font-mono text-[10px] font-bold",
        ok ? "bg-emerald-500 text-slate-950" : "bg-rose-500 text-slate-950",
      ].join(" ")}
      aria-hidden
    >
      {ok ? "✓" : "!"}
    </span>
  );
}
