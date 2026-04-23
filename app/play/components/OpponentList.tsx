"use client";

import { useGameStore } from "@/lib/store/gameStore";

export default function OpponentList() {
  const state = useGameStore((s) => s.state)!;
  const human = state.playerOrder.find((id) => state.players[id].kind === "human");
  const bots = state.playerOrder.filter((id) => id !== human);

  return (
    <section className="rounded-md border border-slate-800 bg-slate-900/60 p-3">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Opponents
      </h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {bots.map((id) => {
          const p = state.players[id];
          const barrels = state.rickhouses.reduce(
            (n, h) => n + h.barrels.filter((b) => b.ownerId === id).length,
            0,
          );
          return (
            <div
              key={id}
              className={`rounded-md border px-3 py-2 ${
                state.currentPlayerId === id
                  ? "border-amber-500 bg-amber-950/30"
                  : "border-slate-800 bg-slate-950"
              }`}
            >
              <div className="flex items-baseline justify-between">
                <span className="font-semibold">{p.name}</span>
                <span className="text-xs text-slate-500">
                  {p.botDifficulty ?? "bot"}
                </span>
              </div>
              <div className="mt-1 grid grid-cols-4 gap-1 text-xs text-slate-400">
                <Stat label="Cash" value={`$${p.cash}`} />
                <Stat label="Barrels" value={`${barrels}`} />
                <Stat label="Silver" value={`${p.silverAwards.length}`} />
                <Stat label="Gold" value={`${p.goldAwards.length}`} />
              </div>
              {p.eliminated ? (
                <div className="mt-2 text-xs font-semibold text-rose-400">
                  Bankrupt
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="uppercase tracking-wide text-slate-500">{label}</span>
      <span className="font-semibold text-slate-200">{value}</span>
    </div>
  );
}
