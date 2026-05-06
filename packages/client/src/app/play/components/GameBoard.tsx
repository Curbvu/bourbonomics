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
import MakeFlight from "./MakeFlight";
import MarketCenter from "./MarketCenter";
import PurchaseFlight from "./PurchaseFlight";
import RickhouseRow from "./RickhouseRow";
import RightRail from "./RightRail";

export default function GameBoard() {
  const { state } = useGameStore();
  if (!state) return null;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-[6px] overflow-hidden px-[12px] pb-[6px] pt-[6px]">
        {state.phase === "ended" ? <GameOverPanel /> : null}

        <div className="grid min-h-0 flex-1 gap-1.5 lg:grid-cols-[minmax(0,1fr)_300px]">
          {/* Left column: rickhouses on top (compact), market below (fills). */}
          <div className="flex min-h-0 flex-col gap-1.5">
            <RickhouseRow />
            <div className="flex min-h-0 flex-1 flex-col">
              <MarketCenter />
            </div>
          </div>

          {/* Right column: action log matches the left column's height
              exactly — the rail is absolutely positioned so its log
              content can never push the grid row taller. */}
          <div className="relative min-h-0">
            <div className="absolute inset-0">
              <RightRail />
            </div>
          </div>
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

      {/* Make-bourbon animation — card flies from screen center into the
          target rickhouse slot whenever MAKE_BOURBON dispatches. */}
      <MakeFlight />
    </div>
  );
}
