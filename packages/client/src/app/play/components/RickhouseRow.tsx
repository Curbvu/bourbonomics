"use client";

/**
 * Per-player rickhouse panel — one card per player.
 *
 * Replaces the standalone "Barons" tab: each panel now folds in the
 * player's full status (reputation, distillery name, hand/deck/discard
 * counts, bills/ops/gold/sold counters) on top of the slot grid.
 *
 * Slots split by tier: bonded (inviolable) vs upper. Visual tells
 * highlight the current player (action phase) and the round-end rank
 * once the game is over.
 */

import type { Barrel, GameState, RickhouseSlot } from "@bourbonomics/engine";
import { useGameStore } from "@/lib/store/game";
import { PLAYER_BG_CLASS, paletteIndex } from "./playerColors";
import PlayerSwatch from "./PlayerSwatch";

export default function RickhouseRow() {
  const { state } = useGameStore();
  if (!state) return null;

  return (
    <section className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[.18em] text-slate-400">
          Rickhouses · {state.players.length} distilleries
        </h2>
        <span className="font-mono text-[9px] uppercase tracking-[.12em] tabular-nums text-slate-500">
          {state.players
            .map((p) => {
              const used = state.allBarrels.filter((b) => b.ownerId === p.id).length;
              const cap = p.rickhouseSlots.length;
              return `${(p.id === "human" ? "you" : p.name.toLowerCase())} ${used}/${cap}`;
            })
            .join(" · ")}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
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
  const { seatMeta, scores } = useGameStore();
  const player = state.players.find((p) => p.id === playerId)!;
  const palIdx = paletteIndex(seatIndex);
  const myBarrels = state.allBarrels.filter((b) => b.ownerId === playerId);
  const bondedSlots = player.rickhouseSlots.filter((s) => s.tier === "bonded");
  const upperSlots = player.rickhouseSlots.filter((s) => s.tier === "upper");
  const isCurrent = state.phase === "action" && state.players[state.currentPlayerIndex]?.id === playerId;
  const meta = seatMeta.find((m) => m.id === playerId);
  const rank = scores?.find((s) => s.playerId === playerId)?.rank;

  return (
    <div
      className={[
        "flex flex-col gap-1.5 rounded-lg border bg-slate-900/60 px-2.5 py-2 transition-colors",
        isCurrent ? "border-amber-500/70 bg-amber-700/[0.10]" : "border-slate-800",
      ].join(" ")}
    >
      {/* Identity strip — name, distillery, reputation, capacity */}
      <header className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <PlayerSwatch seatIndex={seatIndex} logoId={meta?.logoId} size="sm" />
          <div className="flex min-w-0 flex-col leading-tight">
            <div className="flex items-baseline gap-1.5">
              <span className="truncate font-display text-[14px] font-semibold text-slate-100">
                {player.name}
              </span>
              {rank != null ? (
                <span className="rounded bg-amber-700/30 px-1 py-px font-mono text-[9px] font-bold uppercase tracking-[.06em] text-amber-200">
                  #{rank}
                </span>
              ) : null}
            </div>
            <span className="truncate font-mono text-[9px] uppercase tracking-[.10em] text-slate-500">
              {player.distillery?.name ?? "no distillery"}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end leading-tight">
          <span className="font-display text-[20px] font-bold tabular-nums text-amber-300 drop-shadow-[0_2px_4px_rgba(0,0,0,.45)]">
            {player.reputation}
          </span>
          <span className="font-mono text-[8.5px] uppercase tracking-[.14em] text-amber-300/70">
            {myBarrels.length}/{player.rickhouseSlots.length} slots
          </span>
        </div>
      </header>

      {/* Single-row slot grid: upper · | · bonded */}
      <SlotRow
        upperSlots={upperSlots}
        bondedSlots={bondedSlots}
        barrels={myBarrels}
        state={state}
        palIdx={palIdx}
      />

      {/* Counters strip */}
      <div className="grid grid-cols-3 gap-1 font-mono text-[9px] uppercase tracking-[.10em] text-slate-500">
        <Stat label="hand" value={player.hand.length} />
        <Stat label="deck" value={player.deck.length} />
        <Stat label="disc" value={player.discard.length} />
      </div>
      <div className="flex items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-[.08em] text-slate-500">
        <span>
          <span className="text-slate-300">📜 {player.mashBills.length}</span> bills
        </span>
        <span>
          <span className="text-violet-300">🃏 {player.operationsHand.length}</span> ops
        </span>
        <span>
          <span className="text-amber-300">🥇 {player.unlockedGoldBourbons.length}</span>
        </span>
        <span>
          <span className="text-slate-300">🛢 {player.barrelsSold}</span>
        </span>
      </div>
    </div>
  );
}

function SlotRow({
  upperSlots,
  bondedSlots,
  barrels,
  state,
  palIdx,
}: {
  upperSlots: RickhouseSlot[];
  bondedSlots: RickhouseSlot[];
  barrels: Barrel[];
  state: GameState;
  palIdx: number;
}) {
  const renderSlot = (s: RickhouseSlot) => {
    const barrel = barrels.find((b) => b.slotId === s.id);
    if (!barrel) {
      return (
        <div
          key={s.id}
          className={[
            "grid h-[42px] w-[52px] place-items-center rounded border border-dashed font-mono text-[8px] uppercase tracking-[.16em]",
            s.tier === "bonded"
              ? "border-amber-700/40 bg-amber-950/20 text-amber-700/60"
              : "border-slate-700/60 bg-slate-950/30 text-slate-700",
          ].join(" ")}
          title={`${s.tier} slot · empty`}
        >
          empty
        </div>
      );
    }
    return <BarrelChip key={barrel.id} barrel={barrel} state={state} palIdx={palIdx} />;
  };

  return (
    <div className="flex items-center gap-1">
      {upperSlots.map(renderSlot)}
      {/* Delimiter between upper and bonded — labeled, hairline divider */}
      <div
        className="mx-1 flex h-[42px] flex-col items-center justify-center"
        aria-hidden
      >
        <span className="-mb-0.5 font-mono text-[7px] font-bold uppercase tracking-[.16em] text-amber-500/80">
          bond
        </span>
        <div className="h-full w-px bg-amber-700/50" />
      </div>
      {bondedSlots.map(renderSlot)}
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
        "relative flex h-[42px] w-[56px] flex-col items-center justify-center overflow-hidden rounded text-white shadow-inner",
        PLAYER_BG_CLASS[palIdx]!,
        barrel.inspectedThisRound
          ? "ring-2 ring-rose-300/70"
          : barrel.agedThisRound
            ? "ring-2 ring-amber-300/70"
            : "",
      ].join(" ")}
    >
      <span className="font-display text-[15px] font-bold leading-none">{barrel.age}</span>
      <span className="mt-px font-mono text-[7px] uppercase tracking-[.10em] opacity-80">yrs</span>
      <span className="absolute inset-x-0 bottom-0 truncate bg-black/30 px-0.5 text-center font-mono text-[7px] uppercase tracking-[.04em]">
        {barrel.attachedMashBill.name}
      </span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-1 rounded bg-slate-950/40 px-1.5 py-0.5">
      <span>{label}</span>
      <span className="font-sans text-[11px] tabular-nums text-slate-200">{value}</span>
    </div>
  );
}
