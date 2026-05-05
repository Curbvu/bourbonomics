"use client";

/**
 * GameBoard — dashboard layout container.
 *
 *   ┌────────────────────────────────────┬──────────────┐
 *   │ Rickhouses (top of left column)    │              │
 *   │ ────────────────────────────────── │  Action log  │
 *   │ MarketCenter (bottom of left,      │  (full       │
 *   │ flex-1, takes spare height)        │   height)    │
 *   └────────────────────────────────────┴──────────────┘
 *   [HandTray]              flush bottom, full bleed
 */

import { useGameStore } from "@/lib/store/game";
import CardInspectModal from "./CardInspectModal";
import GameOverPanel from "./GameOverPanel";
import HandTray from "./HandTray";
import MarketCenter from "./MarketCenter";
import PurchaseFlight from "./PurchaseFlight";
import RickhouseRow from "./RickhouseRow";
import RightRail from "./RightRail";

export default function GameBoard() {
  const { state } = useGameStore();
  if (!state) return null;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-[12px] overflow-hidden px-[18px] pb-[12px] pt-[12px]">
        {state.phase === "ended" ? <GameOverPanel /> : null}

        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Left column: rickhouses on top (compact), market below (fills). */}
          <div className="flex min-h-0 flex-col gap-3">
            <RickhouseRow />
            <div className="flex min-h-0 flex-1 flex-col">
              <MarketCenter />
            </div>
          </div>

          {/* Right column: action log spans full height. */}
          <RightRail />
        </div>
      </div>

      {/* HandTray bleeds to canvas edges. */}
      <HandTray />

      {/* Click-any-card inspect modal — mounts at top level so it sits
          above every panel. Renders only when `inspect` is set. */}
      <CardInspectModal />

      {/* Purchase animation — fires on every BUY_FROM_MARKET (bot or
          human) and self-clears when the keyframe finishes. */}
      <PurchaseFlight />
    </div>
  );
}
