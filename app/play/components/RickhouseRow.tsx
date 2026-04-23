"use client";

import { RICKHOUSES } from "@/lib/engine/rickhouses";
import { useGameStore } from "@/lib/store/gameStore";

const PLAYER_COLOURS = [
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-slate-400",
];

export default function RickhouseRow() {
  const state = useGameStore((s) => s.state)!;
  const seatColour = (playerId: string) => {
    const idx = state.players[playerId]?.seatIndex ?? 0;
    return PLAYER_COLOURS[idx % PLAYER_COLOURS.length];
  };

  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Rickhouses
      </h2>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
        {state.rickhouses.map((h, idx) => {
          const def = RICKHOUSES[idx];
          const freeSlots = def.capacity - h.barrels.length;
          return (
            <div
              key={h.id}
              className="flex flex-col gap-2 rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2"
            >
              <div>
                <div className="text-sm font-semibold">{def.name}</div>
                <div className="text-xs text-slate-500">
                  {h.barrels.length}/{def.capacity} barrels
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {h.barrels.map((b) => (
                  <div
                    key={b.barrelId}
                    className={`h-4 w-4 rounded-full ${seatColour(b.ownerId)} ring-2 ring-slate-950`}
                    title={`${state.players[b.ownerId]?.name ?? "?"} · age ${b.age}`}
                  >
                    <span className="sr-only">
                      {state.players[b.ownerId]?.name} age {b.age}
                    </span>
                  </div>
                ))}
                {Array.from({ length: freeSlots }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="h-4 w-4 rounded-full border border-dashed border-slate-700"
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
