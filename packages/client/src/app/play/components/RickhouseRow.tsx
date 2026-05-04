"use client";

/**
 * Rickhouse grid — six region cards laid out 3 columns × 2 rows on lg+
 * screens, dropping to 2 columns on md.
 *
 * Same chrome as v1's RickhouseRow but stripped down for v2: no make /
 * sell click-targeting (bots play themselves), barrel chips show owner
 * colour + age + mash bill name only.
 */

import type { Barrel, GameState } from "@bourbonomics/engine";
import { useGameStore } from "@/lib/store/game";
import { PLAYER_BG_CLASS, paletteIndex } from "./playerColors";

const REGION_DISPLAY_ORDER = [
  "rh_western",
  "rh_northern",
  "rh_central",
  "rh_louisville",
  "rh_bardstown",
  "rh_lexington",
] as const;

export default function RickhouseRow() {
  const { state } = useGameStore();
  if (!state) return null;

  const totalSlots = state.rickhouses.reduce((n, r) => n + r.capacity, 0);

  // Per-player barrel totals across all rickhouses, used for the heading tally.
  const totals: Record<string, number> = {};
  for (const p of state.players) totals[p.id] = 0;
  for (const b of state.allBarrels) {
    totals[b.ownerId] = (totals[b.ownerId] ?? 0) + 1;
  }

  const tallyParts = state.players.map((p) => {
    const label = p.id === "human" ? "you" : p.name.toLowerCase();
    return `${label} ${totals[p.id]}`;
  });

  return (
    <section>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[.18em] text-slate-400">
          Rickhouses · {state.rickhouses.length} regions · {totalSlots} slots
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-[.12em] tabular-nums text-slate-500">
          {tallyParts.join(" · ")}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-1 md:grid-cols-2 lg:grid-cols-[minmax(0,3fr)_minmax(0,3fr)_minmax(0,4fr)]">
        {REGION_DISPLAY_ORDER.map((id) => {
          const h = state.rickhouses.find((r) => r.id === id);
          if (!h) return null;
          const barrels = state.allBarrels.filter((b) => b.rickhouseId === id);
          const filled = barrels.length;
          const yoursHere = barrels.filter((b) => b.ownerId === "human").length;
          return (
            <div
              key={h.id}
              className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2.5 transition-shadow"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-display text-[18px] font-semibold leading-none text-slate-100">
                  {h.name}
                </h3>
                <span className="font-mono text-[11px] tabular-nums text-slate-500">
                  {filled}/{h.capacity}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {barrels.map((b) => (
                  <BarrelChip
                    key={b.id}
                    barrel={b}
                    state={state}
                  />
                ))}
                {Array.from({ length: h.capacity - filled }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="grid h-[60px] w-[80px] place-items-center rounded border border-dashed border-slate-700/60 bg-slate-950/30 font-mono text-[9px] uppercase tracking-[.18em] text-slate-700"
                  >
                    empty
                  </div>
                ))}
              </div>
              {yoursHere > 0 && (
                <div className="font-mono text-[10px] uppercase tracking-[.12em] text-indigo-300">
                  +{yoursHere} you
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function BarrelChip({ barrel, state }: { barrel: Barrel; state: GameState }) {
  const ownerIndex = state.players.findIndex((p) => p.id === barrel.ownerId);
  const palIdx = paletteIndex(ownerIndex < 0 ? 0 : ownerIndex);
  const owner = state.players.find((p) => p.id === barrel.ownerId);
  return (
    <div
      title={`${owner?.name ?? "?"} · ${barrel.attachedMashBill.name} · age ${barrel.age}${
        barrel.agedThisRound ? " (aged this round)" : ""
      }`}
      className={[
        "relative flex h-[60px] w-[80px] flex-col items-center justify-center overflow-hidden rounded text-white shadow-inner",
        PLAYER_BG_CLASS[palIdx]!,
        barrel.agedThisRound ? "ring-2 ring-amber-300/70" : "",
      ].join(" ")}
    >
      <span className="font-display text-[20px] font-bold leading-none">
        {barrel.age}
      </span>
      <span className="mt-0.5 font-mono text-[8px] uppercase tracking-[.10em] opacity-80">
        yrs
      </span>
      <span className="absolute inset-x-0 bottom-0 truncate bg-black/30 px-1 text-center font-mono text-[8px] uppercase tracking-[.04em]">
        {barrel.attachedMashBill.name}
      </span>
    </div>
  );
}
