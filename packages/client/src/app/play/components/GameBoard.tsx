"use client";

/**
 * GameBoard — dashboard layout container.
 *
 * Three-column main grid (top section):
 *   ┌────────────────┬────────────────────┬───────────────┐
 *   │ Rickhouses     │ Market center      │ Right rail    │
 *   │ (per-player)   │ (conveyor + bills) │ (Barons / Log)│
 *   └────────────────┴────────────────────┴───────────────┘
 *   [HandTray]              flush bottom, full bleed
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

        {/* Main grid — 3 columns: rickhouses · market center · right rail */}
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_320px]">
          <div className="flex min-h-0 flex-col">
            <RickhouseRow />
          </div>
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
