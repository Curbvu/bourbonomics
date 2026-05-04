"use client";

/**
 * GameBoard — the dashboard layout container.
 *
 * Same vertical structure as v1:
 *   [TopBar + Phase sub-bar]              ← rendered by play/page.tsx
 *   contextual decision panel             ← GameOverPanel only
 *   ──────────────────────────────────────────────
 *   ┌──────────────────────────┐  ┌────────────┐
 *   │ RickhouseRow             │  │ RightRail  │
 *   │  (rickhouses)            │  │ (380px)    │
 *   └──────────────────────────┘  └────────────┘
 *   ──────────────────────────────────────────────
 *   [HandTray]                           ← flush bottom, full bleed
 */

import { useGameStore } from "@/lib/store/game";
import GameOverPanel from "./GameOverPanel";
import HandTray from "./HandTray";
import RickhouseRow from "./RickhouseRow";
import RightRail from "./RightRail";

export default function GameBoard() {
  const { state } = useGameStore();
  if (!state) return null;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-[14px] px-[22px] pb-[14px] pt-[14px]">
        {state.phase === "ended" ? <GameOverPanel /> : null}

        {/* Main grid — rickhouses left (1fr), right rail right (380px). */}
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex min-h-0 flex-col">
            <RickhouseRow />
          </div>
          <RightRail />
        </div>
      </div>

      {/* HandTray bleeds to canvas edges. */}
      <HandTray />
    </div>
  );
}
