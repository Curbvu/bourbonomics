"use client";

/**
 * v3 GameBoard — distillery-first layout.
 *
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │ TopBar                                                       │
 *   ├──────────┬───────────────────────────────────────┬───────────┤
 *   │          │                                       │           │
 *   │ Rivals   │      DistilleryStage (hero)           │ LogRail   │
 *   │ Rail     │                                       │ (Tasting  │
 *   │          │                                       │  Notes)   │
 *   │  230px   │ ─────────────────────────────────     │   290px   │
 *   │          │      HandStrip                        │           │
 *   │          │                  1fr                  │           │
 *   └──────────┴───────────────────────────────────────┴───────────┘
 *
 * `marketOpen` is derived from the existing `buyMode` state: the
 * drawer is open whenever the player has clicked BUY MARKET but
 * hasn't picked a target tile yet. Clicking a tile in the drawer
 * calls `setBuyTarget(slotIndex)` which completes that condition
 * and closes the drawer; BuyOverlay then handles payment selection.
 * Click backdrop / Cancel → `cancelBuyMode()` → drawer closes too.
 */

import { useEffect } from "react";
import { useGameStore } from "@/lib/store/game";
import CardInspectModal from "./CardInspectModal";
import GameOverPanel from "./GameOverPanel";
import HandTray from "./HandTray";
import AgeFlight from "./AgeFlight";
import MakeFlight from "./MakeFlight";
import MarketDrawer from "./MarketDrawer";
import DistilleryStage from "./DistilleryStage";
import OpponentRail from "./OpponentRail";
import PurchaseFlight from "./PurchaseFlight";
import RightRail from "./RightRail";
import SaleFlight from "./SaleFlight";

export default function GameBoard() {
  const {
    state,
    buyMode,
    makeMode,
    ageMode,
    sellMode,
    drawBillMode,
    cancelBuyMode,
    cancelMakeMode,
    cancelAgeMode,
    cancelSellMode,
    cancelDrawBillMode,
  } = useGameStore();

  // Esc → cancel the active picker mode (no drawer change here;
  // MarketDrawer also handles Esc to close itself).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (buyMode) {
        e.preventDefault();
        cancelBuyMode();
      } else if (makeMode) {
        e.preventDefault();
        cancelMakeMode();
      } else if (ageMode) {
        e.preventDefault();
        cancelAgeMode();
      } else if (sellMode) {
        e.preventDefault();
        cancelSellMode();
      } else if (drawBillMode) {
        e.preventDefault();
        cancelDrawBillMode();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    buyMode,
    makeMode,
    ageMode,
    sellMode,
    drawBillMode,
    cancelBuyMode,
    cancelMakeMode,
    cancelAgeMode,
    cancelSellMode,
    cancelDrawBillMode,
  ]);

  if (!state) return null;

  // Drawer is open when the user clicked BUY MARKET (buyMode is non-
  // null) but hasn't picked a slot yet. Once a slot is picked, the
  // payment-selection UI (BuyOverlay) takes over and the drawer
  // closes. Cancel from anywhere clears buyMode entirely.
  const marketOpen = buyMode != null && buyMode.pickedTarget == null;

  return (
    <div className="flex flex-1 flex-col" style={{ minHeight: 0 }}>
      {/* Game-over overlays sit above everything else when the round ends. */}
      {state.phase === "ended" ? <GameOverPanel /> : null}

      {/* Three-area grid: rivals | stage+hand | log */}
      <main
        className="grid min-h-0 flex-1"
        style={{
          gridTemplateColumns: "230px 1fr 290px",
          gridTemplateRows: "1fr auto",
          gridTemplateAreas: '"rivals stage log" "rivals hand log"',
        }}
      >
        <OpponentRail />
        <DistilleryStage />
        <RightRail />
        {/* HandTray stamps `gridArea: "hand"` on its own root so it
            slots into the bottom-center area of this grid. */}
        <HandTray />
      </main>

      {/* Market drawer — opens above the board when BUY MARKET clicked. */}
      <MarketDrawer open={marketOpen} onClose={cancelBuyMode} />

      {/* Modal stack — preserved unchanged. */}
      <CardInspectModal />

      {/* Flight animations — preserved unchanged. */}
      <PurchaseFlight />
      <MakeFlight />
      <SaleFlight />
      <AgeFlight />
    </div>
  );
}
