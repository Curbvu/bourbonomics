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
 * The component name is kept (`RickhouseRow`) for import compatibility with
 * existing consumers — the layout is no longer a single row.
 */

import { RICKHOUSES } from "@/lib/engine/rickhouses";
import { useGameStore } from "@/lib/store/gameStore";
import { PLAYER_BG_CLASS, paletteIndex } from "./playerColors";

const TOTAL_SLOTS = RICKHOUSES.reduce((n, r) => n + r.capacity, 0);

export default function RickhouseRow() {
  const state = useGameStore((s) => s.state)!;
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

  return (
    <section>
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[.18em] text-slate-400">
          Rickhouses · {RICKHOUSES.length} regions · {TOTAL_SLOTS} slots
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
          return (
            <div
              key={h.id}
              className="flex flex-col gap-2.5 rounded-lg border border-slate-800 bg-slate-900/60 px-3.5 py-3"
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
                    className="h-7 w-7 rounded-[5px] border border-dashed border-slate-700"
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
