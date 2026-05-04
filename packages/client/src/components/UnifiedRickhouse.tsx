"use client";

import type { Barrel, GameState } from "@bourbonomics/engine";
import { colorFor } from "@/lib/colors";

export function UnifiedRickhouse({ state }: { state: GameState }) {
  const total = state.rickhouses.reduce((acc, r) => acc + r.capacity, 0);
  const used = state.allBarrels.length;
  const empties = Math.max(0, total - used);

  // Index players by id so we know each barrel's color.
  const indexById = new Map(state.players.map((p, i) => [p.id, i]));

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50">
      <header className="px-4 py-2 border-b border-neutral-800 flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h3 className="text-sm font-semibold tracking-wide">Rickhouse</h3>
          <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">
            shared aging space
          </span>
        </div>
        <span className="text-xs text-neutral-500 tabular-nums">
          <span className="text-neutral-200 font-medium">{used}</span>/{total}
        </span>
      </header>
      <div className="p-4 grid grid-cols-13 gap-2" style={{ gridTemplateColumns: "repeat(13, minmax(0, 1fr))" }}>
        {state.allBarrels.map((b) => (
          <BarrelChip
            key={b.id}
            barrel={b}
            ownerIndex={indexById.get(b.ownerId) ?? 0}
            ownerName={state.players.find((p) => p.id === b.ownerId)?.name ?? "?"}
          />
        ))}
        {Array.from({ length: empties }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="aspect-square rounded border border-dashed border-neutral-800/80"
          />
        ))}
      </div>
    </section>
  );
}

function BarrelChip({
  barrel,
  ownerIndex,
  ownerName,
}: {
  barrel: Barrel;
  ownerIndex: number;
  ownerName: string;
}) {
  const color = colorFor(ownerIndex);
  return (
    <div
      title={`${ownerName} · ${barrel.attachedMashBill.name} · age ${barrel.age}${
        barrel.agedThisRound ? " (aged this round)" : ""
      }`}
      className={`aspect-square rounded ${color.barrelBg} flex flex-col items-center justify-center text-white font-semibold text-sm shadow-inner ${
        barrel.agedThisRound ? "ring-2 ring-amber-400/60" : ""
      }`}
    >
      <span className="leading-none">{barrel.age}</span>
      <span className="text-[8px] uppercase tracking-wider opacity-70 mt-0.5">
        yrs
      </span>
    </div>
  );
}
