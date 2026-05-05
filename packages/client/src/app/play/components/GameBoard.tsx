"use client";

/**
 * GameBoard — dashboard layout container.
 *
 *   ┌──────────────────────────────────┬──────────────┐
 *   │ Rickhouses (per-player panels)   │ Action log   │
 *   │ Top row, ~1fr                    │ ~320px wide  │
 *   ├──────────────────────────────────┴──────────────┤
 *   │ MarketCenter — full canvas width                │
 *   │ (conveyor + mash bills · ops · investments)     │
 *   └─────────────────────────────────────────────────┘
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
      <div className="flex flex-1 flex-col gap-[12px] overflow-hidden px-[18px] pb-[12px] pt-[12px]">
        {state.phase === "ended" ? <GameOverPanel /> : null}

        {/* Top row: rickhouses (wide) + action log (narrow). */}
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
          <RickhouseRow />
          <RightRail />
        </div>

        {/* Below: market center spans the full canvas width. */}
        <div className="flex min-h-0 flex-1 flex-col">
          <MarketCenter />
        </div>
      </div>

      {/* HandTray bleeds to canvas edges. */}
      <HandTray />
    </div>
  );
}
