"use client";

/**
 * GameBoard — the dashboard layout container.
 *
 * Vertical structure (top → bottom):
 *
 *   [TopBar + Phase sub-bar]              ← rendered by app/play/page.tsx
 *   contextual decision panel (FeesPanel / GameOverPanel / MarketRecapPanel)
 *   ──────────────────────────────────────────────
 *   ┌──────────────────────────┐  ┌────────────┐
 *   │ RickhouseRow             │  │ RightRail  │
 *   │  (rickhouses)            │  │ (380px)    │
 *   │                          │  │            │
 *   └──────────────────────────┘  └────────────┘
 *   ──────────────────────────────────────────────
 *   [HandTray]                           ← flush bottom, full bleed
 *
 * The phase strip used to sit here as a separate band; it's now folded
 * into GameTopBar as a sub-bar since it's purely game-state metadata.
 * Action affordances live in the HandTray itself (Make / Sell /
 * Implement / Audit / Pass) — there's no separate ActionBar. Draws
 * happen by clicking deck stacks in the RightRail Market tab.
 *
 * Spec: design_handoff_bourbon_blend/README.md §Layout.
 *
 * Spacing:
 *   - 22px side gutter on the decision panel and main grid.
 *   - 14px top gutter under the TopBar, 14px between blocks.
 *   - HandTray has its own 12px×22px padding and slate-950 bg, so it bleeds
 *     to the canvas edges with a slate-800 top border separating it from
 *     the content above.
 */

import { useGameStore } from "@/lib/store/gameStore";
import { useUiStore } from "@/lib/store/uiStore";
import BourbonInspectModal from "./BourbonInspectModal";
import CardDrawOverlay from "./CardDrawOverlay";
import FeesPanel from "./FeesPanel";
import GameOverPanel from "./GameOverPanel";
import HandTray from "./HandTray";
import MarketRecapPanel from "./MarketRecapPanel";
import MarketRevealModal from "./MarketRevealModal";
import RickhouseRow from "./RickhouseRow";
import RightRail from "./RightRail";
import SaleRevealModal from "./SaleRevealModal";

export default function GameBoard() {
  const state = useGameStore((s) => s.state);
  const makeBourbonActive = useUiStore((s) => s.makeBourbon.active);
  const cancelMakeBourbon = useUiStore((s) => s.cancelMakeBourbon);
  if (!state) return null;

  return (
    <div className="flex flex-1 flex-col">
      {/* Padded content area — sits between TopBar (above, in page.tsx) and
          HandTray (below). 22px side gutter; 14px top; 14px bottom; 14px gap
          between sibling blocks. */}
      <div className="flex flex-1 flex-col gap-[14px] px-[22px] pb-[14px] pt-[14px]">
        {state.phase === "gameover" ? <GameOverPanel /> : null}
        {state.phase === "fees" ? <MarketRecapPanel /> : null}
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
      </div>

      {/* HandTray bleeds to canvas edges. */}
      <HandTray />

      {/* Make-bourbon dim/blur layer. Sits beneath the HandTray (z-40)
          and RickhouseRow (z-40) so those stay interactive while the
          rest of the dashboard fades out. Click anywhere on the
          overlay to cancel the mode. */}
      {makeBourbonActive ? (
        <div
          aria-label="Cancel make-bourbon"
          role="button"
          tabIndex={0}
          onClick={cancelMakeBourbon}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              cancelMakeBourbon();
            }
          }}
          className="fixed inset-0 z-30 bg-slate-950/55 backdrop-blur-sm transition-opacity"
        />
      ) : null}

      {/* Modal-style overlays (always mounted, render conditionally). */}
      <SaleRevealModal />
      <CardDrawOverlay />
      <MarketRevealModal />
      <BourbonInspectModal />
    </div>
  );
}
