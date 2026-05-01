"use client";

/**
 * Rickhouse grid — six region cards laid out 3 columns × 2 rows.
 *
 * Spec: design_handoff_bourbon_blend/README.md §RickhouseGrid.
 *
 * Each card has a Cormorant Garamond name, a `{filled}/{capacity} barrels`
 * subtitle, an optional "+N you" callout in the player's seat colour, and a
 * row of 28×28 barrel chips. Filled chips show their age in white mono;
 * empty slots are 1px-dashed slate-700 squares.
 *
 * Phase 2 of the make-bourbon flow: when `useUiStore.makeBourbon.active`
 * is true and the player has a valid mash selected in their hand, the
 * rickhouses with capacity light up amber and become click-to-place. The
 * click dispatches MAKE_BOURBON with the selected resource ids and clears
 * the mode.
 *
 * The component name is kept (`RickhouseRow`) for import compatibility with
 * existing consumers — the layout is no longer a single row.
 */

import type { RickhouseId } from "@/lib/engine/rickhouses";
import { RICKHOUSES } from "@/lib/engine/rickhouses";
import { validateMash } from "@/lib/rules/mash";
import { useGameStore } from "@/lib/store/gameStore";
import { useUiStore } from "@/lib/store/uiStore";
import { PLAYER_BG_CLASS, paletteIndex } from "./playerColors";

const TOTAL_SLOTS = RICKHOUSES.reduce((n, r) => n + r.capacity, 0);

export default function RickhouseRow() {
  const state = useGameStore((s) => s.state)!;
  const dispatch = useGameStore((s) => s.dispatch);
  const makeBourbon = useUiStore((s) => s.makeBourbon);
  const cancelMakeBourbon = useUiStore((s) => s.cancelMakeBourbon);
  const humanId = state.playerOrder.find(
    (id) => state.players[id].kind === "human",
  );

  // Per-player barrel totals across all rickhouses, used for the heading tally.
  const totals: Record<string, number> = {};
  for (const id of state.playerOrder) totals[id] = 0;
  for (const h of state.rickhouses) {
    for (const b of h.barrels) {
      if (totals[b.ownerId] != null) totals[b.ownerId] += 1;
    }
  }

  const tallyParts = state.playerOrder.map((id) => {
    const p = state.players[id];
    const label = id === humanId ? "you" : p.name.toLowerCase();
    return `${label} ${totals[id]}`;
  });

  // Compute mash validity once per render so each rickhouse card can
  // light up consistently. Both pieces — a valid resource mash AND a
  // chosen mash bill from the bourbon hand — are required before the
  // rickhouse becomes a click target.
  const me = humanId ? state.players[humanId] : null;
  const selectedSet = new Set(makeBourbon.selectedIds);
  const selectedMash =
    makeBourbon.active && me
      ? me.resourceHand.filter((r) => selectedSet.has(r.instanceId))
      : [];
  const mashOk = makeBourbon.active && validateMash(selectedMash).ok;
  const billOk =
    makeBourbon.active &&
    !!makeBourbon.mashBillId &&
    !!me?.bourbonHand.includes(makeBourbon.mashBillId);
  const mashValid = mashOk && billOk;

  const placeInRickhouse = (rickhouseId: RickhouseId) => {
    if (!mashValid || !humanId || !makeBourbon.mashBillId) return;
    dispatch({
      t: "MAKE_BOURBON",
      playerId: humanId,
      rickhouseId,
      resourceInstanceIds: makeBourbon.selectedIds,
      mashBillId: makeBourbon.mashBillId,
    });
    cancelMakeBourbon();
  };

  const sectionClass = makeBourbon.active ? "relative z-40" : "";

  return (
    <section className={sectionClass}>
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[.18em] text-slate-400">
          Rickhouses · {RICKHOUSES.length} regions · {TOTAL_SLOTS} slots
          {mashValid ? (
            <span className="ml-2 rounded border border-amber-500 bg-amber-700/[0.20] px-1.5 py-0.5 text-amber-200">
              Click a rickhouse to barrel
            </span>
          ) : makeBourbon.active && mashOk && !billOk ? (
            <span className="ml-2 rounded border border-amber-500/60 bg-amber-700/[0.10] px-1.5 py-0.5 text-amber-200/90">
              Pick a mash bill
            </span>
          ) : null}
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-[.12em] tabular-nums text-slate-500">
          {tallyParts.join(" · ")}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {state.rickhouses.map((h, idx) => {
          const def = RICKHOUSES[idx];
          const filled = h.barrels.length;
          const yoursHere = humanId
            ? h.barrels.filter((b) => b.ownerId === humanId).length
            : 0;
          const freeSlots = def.capacity - filled;
          const targetable = mashValid && freeSlots > 0;
          return (
            <div
              key={h.id}
              role={targetable ? "button" : undefined}
              tabIndex={targetable ? 0 : undefined}
              onClick={targetable ? () => placeInRickhouse(h.id) : undefined}
              onKeyDown={
                targetable
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        placeInRickhouse(h.id);
                      }
                    }
                  : undefined
              }
              title={
                makeBourbon.active && !mashValid
                  ? "Mash isn't valid yet"
                  : makeBourbon.active && freeSlots === 0
                    ? "No room here"
                    : targetable
                      ? `Barrel mash in ${def.name}`
                      : undefined
              }
              className={[
                "flex flex-col gap-2.5 rounded-lg border bg-slate-900/60 px-3.5 py-3 transition-all",
                targetable
                  ? "cursor-pointer border-amber-500 shadow-[0_0_0_3px_rgba(245,158,11,.15)] hover:-translate-y-0.5 hover:shadow-[0_0_0_3px_rgba(245,158,11,.35)]"
                  : makeBourbon.active && freeSlots === 0
                    ? "border-rose-700/40 opacity-60"
                    : "border-slate-800",
              ].join(" ")}
            >
              <div className="flex items-baseline justify-between gap-2">
                <div>
                  <div className="font-display text-[16px] font-semibold leading-tight tracking-[.01em] text-amber-100">
                    {def.name}
                  </div>
                  <div className="font-mono text-[10.5px] tabular-nums text-slate-500">
                    {filled}/{def.capacity} barrels
                  </div>
                </div>
                {yoursHere > 0 ? (
                  <span className="font-mono text-[10px] font-bold text-indigo-400">
                    +{yoursHere} you
                  </span>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-1">
                {h.barrels.map((b) => {
                  const seatIdx = paletteIndex(
                    state.players[b.ownerId]?.seatIndex ?? 0,
                  );
                  return (
                    <div
                      key={b.barrelId}
                      title={`${state.players[b.ownerId]?.name ?? "?"} · age ${b.age}`}
                      className={`grid h-7 w-7 place-items-center rounded-[5px] font-mono text-[10px] font-bold leading-none text-white shadow-[inset_0_1px_0_rgba(255,255,255,.18)] ring-2 ring-slate-950 ${PLAYER_BG_CLASS[seatIdx]}`}
                    >
                      {b.age}
                    </div>
                  );
                })}
                {Array.from({ length: freeSlots }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className={[
                      "h-7 w-7 rounded-[5px] border border-dashed",
                      targetable
                        ? "border-amber-400/70"
                        : "border-slate-700",
                    ].join(" ")}
                    aria-hidden
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
