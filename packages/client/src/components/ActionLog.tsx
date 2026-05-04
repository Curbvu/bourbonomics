"use client";

import { useEffect, useRef } from "react";
import type { GameAction } from "@bourbonomics/engine";

export interface LogEntry {
  seq: number;
  action: GameAction;
  round: number;
  phase: string;
}

export function ActionLog({ entries }: { entries: LogEntry[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [entries]);

  return (
    <div ref={ref} className="h-full overflow-auto font-mono text-xs space-y-1">
      {entries.length === 0 && (
        <div className="text-neutral-500 italic">No actions yet — press Step or Auto.</div>
      )}
      {entries.map((e) => (
        <div key={e.seq} className="flex gap-2 leading-snug">
          <span className="text-neutral-600 tabular-nums w-10 text-right">
            R{e.round}
          </span>
          <span className="text-neutral-400 w-16">{e.action.type}</span>
          <span className="text-neutral-300 flex-1">{describe(e.action)}</span>
        </div>
      ))}
    </div>
  );
}

function describe(a: GameAction): string {
  switch (a.type) {
    case "ROLL_DEMAND":
      return `roll = ${a.roll[0]} + ${a.roll[1]}`;
    case "DRAW_HAND":
      return a.playerId;
    case "MAKE_BOURBON":
      return `${a.playerId} → ${a.cardIds.length} cards into ${a.rickhouseId}`;
    case "AGE_BOURBON":
      return `${a.playerId} ages ${shortBarrel(a.barrelId)}`;
    case "SELL_BOURBON":
      return `${a.playerId} sells ${shortBarrel(a.barrelId)} for ${a.reputationSplit + a.cardDrawSplit}`;
    case "BUY_FROM_MARKET":
      return `${a.playerId} buys slot ${a.marketSlotIndex}`;
    case "DRAW_MASH_BILL":
      return `${a.playerId} draws a mash bill`;
    case "TRADE":
      return `${a.player1Id} ↔ ${a.player2Id}`;
    case "PASS_TURN":
      return `${a.playerId} passes`;
    default:
      return JSON.stringify(a);
  }
}

function shortBarrel(id: string): string {
  return id.replace(/^barrel_/, "B");
}
