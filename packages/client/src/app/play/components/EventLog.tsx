"use client";

/**
 * Log tab — streaming engine action history.
 */

import { useEffect, useRef } from "react";
import type { GameAction } from "@bourbonomics/engine";

import { useGameStore } from "@/lib/store/game";

export default function EventLog() {
  const { log } = useGameStore();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [log.length]);

  return (
    <div ref={ref} className="h-full overflow-auto p-4">
      {log.length === 0 ? (
        <p className="font-mono text-[11px] italic text-slate-500">
          No actions yet — press Step or Auto in the phase strip.
        </p>
      ) : (
        <ul className="space-y-1 font-mono text-[11px] leading-snug">
          {log.map((e) => (
            <li key={e.seq} className="flex gap-2">
              <span className="w-9 text-right tabular-nums text-slate-600">
                R{e.round}
              </span>
              <span className="w-20 shrink-0 truncate text-slate-400">
                {e.action.type}
              </span>
              <span className="flex-1 text-slate-300">{describe(e.action)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function describe(a: GameAction): string {
  switch (a.type) {
    case "ROLL_DEMAND":
      return `roll ${a.roll[0]} + ${a.roll[1]}`;
    case "DRAW_HAND":
      return a.playerId;
    case "MAKE_BOURBON":
      return `${a.playerId} → barrel from ${a.cardIds.length} cards`;
    case "AGE_BOURBON":
      return `${a.playerId} ages ${shortBarrel(a.barrelId)}`;
    case "SELL_BOURBON":
      return `${a.playerId} sells ${shortBarrel(a.barrelId)} for ${
        a.reputationSplit + a.cardDrawSplit
      }`;
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
