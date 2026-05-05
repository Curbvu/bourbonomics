"use client";

/**
 * Per-player rickhouse panel — one card per player, slots split by tier.
 *
 * Bonded slots are inviolable; upper-tier slots can be affected by ops
 * cards. The bot plays both seats so click-targeting isn't needed.
 */

import type { Barrel, GameState, RickhouseSlot } from "@bourbonomics/engine";
import { useGameStore } from "@/lib/store/game";
import { PLAYER_BG_CLASS, paletteIndex } from "./playerColors";

export default function RickhouseRow() {
  const { state } = useGameStore();
  if (!state) return null;

  return (
    <section>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[.18em] text-slate-400">
          Rickhouses · {state.players.length} distilleries
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-[.12em] tabular-nums text-slate-500">
          {state.players
            .map((p) => {
              const used = state.allBarrels.filter((b) => b.ownerId === p.id).length;
              const cap = p.rickhouseSlots.length;
              return `${(p.id === "human" ? "you" : p.name.toLowerCase())} ${used}/${cap}`;
            })
            .join(" · ")}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        {state.players.map((p, i) => (
          <PlayerRickhouse key={p.id} state={state} playerId={p.id} seatIndex={i} />
        ))}
      </div>
    </section>
  );
}

function PlayerRickhouse({
  state,
  playerId,
  seatIndex,
}: {
  state: GameState;
  playerId: string;
  seatIndex: number;
}) {
  const player = state.players.find((p) => p.id === playerId)!;
  const palIdx = paletteIndex(seatIndex);
  const myBarrels = state.allBarrels.filter((b) => b.ownerId === playerId);
  const bondedSlots = player.rickhouseSlots.filter((s) => s.tier === "bonded");
  const upperSlots = player.rickhouseSlots.filter((s) => s.tier === "upper");

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h3 className="font-display text-[16px] font-semibold leading-none text-slate-100">
            {player.name}
          </h3>
          <span className="font-mono text-[10px] uppercase tracking-[.10em] text-slate-500">
            {player.distillery?.name ?? "no distillery"}
          </span>
        </div>
        <span className="font-mono text-[11px] tabular-nums text-slate-500">
          {myBarrels.length}/{player.rickhouseSlots.length}
        </span>
      </div>

      <SlotTier
        label="Upper"
        slots={upperSlots}
        barrels={myBarrels}
        state={state}
        palIdx={palIdx}
      />
      <SlotTier
        label="Bonded"
        slots={bondedSlots}
        barrels={myBarrels}
        state={state}
        palIdx={palIdx}
      />
    </div>
  );
}

function SlotTier({
  label,
  slots,
  barrels,
  state,
  palIdx,
}: {
  label: string;
  slots: RickhouseSlot[];
  barrels: Barrel[];
  state: GameState;
  palIdx: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="font-mono text-[9px] uppercase tracking-[.18em] text-slate-500">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {slots.map((s) => {
          const barrel = barrels.find((b) => b.slotId === s.id);
          if (!barrel) {
            return (
              <div
                key={s.id}
                className="grid h-[60px] w-[80px] place-items-center rounded border border-dashed border-slate-700/60 bg-slate-950/30 font-mono text-[9px] uppercase tracking-[.18em] text-slate-700"
              >
                empty
              </div>
            );
          }
          return <BarrelChip key={barrel.id} barrel={barrel} state={state} palIdx={palIdx} />;
        })}
      </div>
    </div>
  );
}

function BarrelChip({
  barrel,
  state,
  palIdx,
}: {
  barrel: Barrel;
  state: GameState;
  palIdx: number;
}) {
  const owner = state.players.find((p) => p.id === barrel.ownerId);
  const ringHints: string[] = [];
  if (barrel.agedThisRound) ringHints.push("aged this round");
  if (barrel.inspectedThisRound) ringHints.push("under inspection");
  if (barrel.extraAgesAvailable > 0) ringHints.push("rushed shipment");
  return (
    <div
      title={`${owner?.name ?? "?"} · ${barrel.attachedMashBill.name} · age ${barrel.age}${
        ringHints.length ? " (" + ringHints.join(", ") + ")" : ""
      }`}
      className={[
        "relative flex h-[60px] w-[80px] flex-col items-center justify-center overflow-hidden rounded text-white shadow-inner",
        PLAYER_BG_CLASS[palIdx]!,
        barrel.inspectedThisRound ? "ring-2 ring-rose-300/70" : barrel.agedThisRound ? "ring-2 ring-amber-300/70" : "",
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
