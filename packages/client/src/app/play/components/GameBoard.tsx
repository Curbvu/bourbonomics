"use client";

/**
 * GameBoard — dashboard layout container.
 *
 *   ┌─────────────────────────────────────────────────┐
 *   │ Rickhouses (full-width top row, per-player)     │
 *   ├──────────────────────────────────┬──────────────┤
 *   │ MarketCenter (wide middle)       │ Right rail   │
 *   │  conveyor + bills + ops + invest │ (Barons/Log) │
 *   └──────────────────────────────────┴──────────────┘
 *   [HandTray]                  flush bottom, full bleed
 */

import { useGameStore } from "@/lib/store/game";
import GameOverPanel from "./GameOverPanel";
import HandTray from "./HandTray";
import MarketCenter from "./MarketCenter";
import RickhouseRow from "./RickhouseRow";
import RightRail from "./RightRail";

export default function GameBoard() {
  const { state } = useGameStore();
  if (!state) return null;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-[14px] px-[22px] pb-[14px] pt-[14px]">
        {state.phase === "ended" ? <GameOverPanel /> : null}

        {/* Top: rickhouses spanning the full width. */}
        <RickhouseRow />

        {/* Bottom: market center (wide) + right rail (320px). */}
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-h-0 flex-col">
            <MarketCenter />
          </div>
          <RightRail />
        </div>
      </div>

      {/* HandTray bleeds to canvas edges. */}
      <HandTray />
    </div>
  );
}
