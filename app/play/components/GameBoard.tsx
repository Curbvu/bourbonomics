"use client";

/**
 * GameBoard — the dashboard layout container.
 *
 * Vertical structure (top → bottom):
 *
 *   [TopBar]                              ← rendered by app/play/page.tsx
 *   PhaseStrip          (gutter: pt 14, sides 22)
 *   contextual decision panel (FeesPanel / MarketPhasePanel / GameOverPanel)
 *   ──────────────────────────────────────────────
 *   ┌──────────────────────────┐  ┌────────────┐
 *   │ RickhouseRow             │  │ RightRail  │
 *   │  (rickhouses)            │  │ (380px)    │
 *   │                          │  │            │
 *   └──────────────────────────┘  └────────────┘
 *   ActionBar             (when phase === "action")
 *   ──────────────────────────────────────────────
 *   [HandTray]                           ← flush bottom, full bleed
 *
 * Spec: design_handoff_bourbon_blend/README.md §Layout.
 *
 * Spacing:
 *   - 22px side gutter on all of: PhaseStrip, decision panel, main grid, ActionBar.
 *   - 14px between PhaseStrip and the next block.
 *   - 14px between blocks within the padded content area.
 *   - HandTray has its own 12px×22px padding and slate-950 bg, so it bleeds
 *     to the canvas edges with a slate-800 top border separating it from
 *     the content above.
 */

import { useGameStore } from "@/lib/store/gameStore";
import ActionBar from "./ActionBar";
import CardDrawOverlay from "./CardDrawOverlay";
import FeesPanel from "./FeesPanel";
import GameOverPanel from "./GameOverPanel";
import HandTray from "./HandTray";
import MarketRevealModal from "./MarketRevealModal";
import PhaseBanner from "./PhaseBanner";
import RickhouseRow from "./RickhouseRow";
import RightRail from "./RightRail";
import SaleRevealModal from "./SaleRevealModal";

export default function GameBoard() {
  const state = useGameStore((s) => s.state);
  if (!state) return null;

  return (
    <div className="flex flex-1 flex-col">
      {/* Padded content area — sits between TopBar (above, in page.tsx) and
          HandTray (below). 22px side gutter; 14px top; 14px bottom; 14px gap
          between sibling blocks. */}
      <div className="flex flex-1 flex-col gap-[14px] px-[22px] pb-[14px] pt-[14px]">
        <PhaseBanner />

        {state.phase === "gameover" ? <GameOverPanel /> : null}
        {state.phase === "fees" ? <FeesPanel /> : null}
        {/* Phase 3 (market) is fully owned by MarketRevealModal — no inline
            decision panel needed; the modal auto-draws and forces a choice. */}

        {/* Main grid — rickhouses left (1fr), right rail right (380px). */}
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex min-h-0 flex-col">
            <RickhouseRow />
          </div>
          <RightRail />
        </div>

        {state.phase === "action" ? <ActionBar /> : null}
      </div>

      {/* HandTray bleeds to canvas edges. */}
      <HandTray />

      {/* Modal-style overlays (always mounted, render conditionally). */}
      <SaleRevealModal />
      <CardDrawOverlay />
      <MarketRevealModal />
    </div>
  );
}
