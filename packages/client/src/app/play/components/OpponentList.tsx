"use client";

/**
 * Barons tab — at-a-glance status for every player at the table.
 */

import { useGameStore } from "@/lib/store/game";
import PlayerSwatch from "./PlayerSwatch";

export default function OpponentList() {
  const { state, seatMeta, scores } = useGameStore();
  if (!state) return null;

  return (
    <div className="flex flex-col gap-2 p-4">
      {state.players.map((p, i) => {
        const meta = seatMeta.find((m) => m.id === p.id);
        const isCurrent =
          state.phase === "action" && i === state.currentPlayerIndex;
        const rank = scores?.find((s) => s.playerId === p.id)?.rank;
        return (
          <div
            key={p.id}
            className={[
              "flex flex-col gap-2 rounded border px-3 py-2.5 transition",
              isCurrent
                ? "border-amber-500/60 bg-amber-700/[0.10]"
                : "border-slate-800 bg-slate-950/40",
            ].join(" ")}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PlayerSwatch seatIndex={i} logoId={meta?.logoId} size="sm" />
                <span className="font-display text-[15px] font-semibold text-slate-100">
                  {p.name}
                </span>
                {rank != null && (
                  <span className="rounded bg-amber-700/30 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[.08em] text-amber-200">
                    #{rank}
                  </span>
                )}
              </div>
              <span className="font-mono text-[16px] font-bold tabular-nums text-amber-300">
                {p.reputation}
                <span className="ml-0.5 font-sans text-[10px] font-medium text-amber-300/70">
                  rep
                </span>
              </span>
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[.10em] text-slate-500">
              🏠 {p.distillery?.name ?? "—"}
            </div>
            <div className="grid grid-cols-3 gap-1.5 font-mono text-[10px] uppercase tracking-[.10em] text-slate-500">
              <Stat label="hand" value={p.hand.length} />
              <Stat label="deck" value={p.deck.length} />
              <Stat label="discard" value={p.discard.length} />
            </div>
            <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[.10em] text-slate-500">
              <span>
                <span className="text-slate-300">📜 {p.mashBills.length}</span> bills
              </span>
              <span>
                <span className="text-violet-300">🃏 {p.operationsHand.length}</span> ops
              </span>
              <span>
                <span className="text-amber-300">🥇 {p.unlockedGoldBourbons.length}</span> gold
              </span>
              <span>
                <span className="text-slate-300">🛢 {p.barrelsSold}</span> sold
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-1">
      <span>{label}</span>
      <span className="font-sans text-[12px] tabular-nums text-slate-200">
        {value}
      </span>
    </div>
  );
}
