"use client";

/**
 * v3.2 GameBoard — distillery-first layout with persistent MarketRow.
 *
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │ TopBar                                                       │
 *   ├──────────┬───────────────────────────────────────┬───────────┤
 *   │          │ ┌───────────────────────────────────┐ │           │
 *   │ Rivals   │ │ MarketRow  (persistent shelf)     │ │ LogRail   │
 *   │ Rail     │ ├───────────────────────────────────┤ │ (Tasting  │
 *   │          │ │ DistilleryStage (hero)            │ │  Notes)   │
 *   │          │ └───────────────────────────────────┘ │           │
 *   │          │ ┌───────────────────────────────────┐ │           │
 *   │  230px   │ │ HandStrip                         │ │   290px   │
 *   │          │ └───────────────────────────────────┘ │           │
 *   └──────────┴───────────────────────────────────────┴───────────┘
 *
 * v2 changes from v1:
 *   - Each region renders as its own floating panel (`.bb-panel` +
 *     region modifier in globals.css) — 12px radius, brass border,
 *     inset top highlight, drop shadow.
 *   - Main grid carries `gap: 12px` + `padding: 12px` instead of the
 *     old shared 1px rule lines.
 *   - Stage area is a flex column containing MarketRow stacked above
 *     DistilleryStage, each in its own panel.
 *   - MarketRow is always visible above the distillery, so BUY MARKET
 *     now opens the drawer for full browsing only (inline buys happen
 *     by clicking a card in the row).
 *
 * `marketOpen` is still derived from `buyMode`: the drawer is open
 * whenever the player clicked BUY MARKET (or the row's OPEN FULL /
 * +N more tile) but hasn't picked a slot yet. Picking a slot fires
 * `setBuyTarget(slotIndex)` which closes the drawer and engages the
 * BuyOverlay payment selection.
 */

import { useEffect } from "react";
import { useGameStore } from "@/lib/store/game";
import HandTray from "./HandTray";
import AgeFlight from "./AgeFlight";
import DemandThermometer from "./DemandThermometer";
import MakeFlight from "./MakeFlight";
import MarketDrawer from "./MarketDrawer";
import MarketRow from "./MarketRow";
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
    draftingLoopMode,
    cancelBuyMode,
    cancelMakeMode,
    cancelAgeMode,
    cancelSellMode,
    cancelDraftingLoopMode,
  } = useGameStore();

  // Esc → cancel the active picker mode. MarketDrawer also handles
  // Esc to close itself; the outer listener stops there because the
  // drawer captures keydown before it bubbles up here.
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
      } else if (draftingLoopMode) {
        e.preventDefault();
        cancelDraftingLoopMode();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    buyMode,
    makeMode,
    ageMode,
    sellMode,
    draftingLoopMode,
    cancelBuyMode,
    cancelMakeMode,
    cancelAgeMode,
    cancelSellMode,
    cancelDraftingLoopMode,
  ]);

  if (!state) return null;

  // Drawer is open when buyMode is engaged but no slot has been picked.
  // - Clicking BUY MARKET in ActionBar fires `startBuyMode()` only →
  //   drawer opens for full browsing.
  // - Clicking `OPEN FULL ↗` / `+N more` in MarketRow also fires
  //   `startBuyMode()` only → drawer opens.
  // - Clicking a card in MarketRow fires `startBuyMode()` +
  //   `setBuyTarget({ slotIndex })` → pickedTarget != null → drawer
  //   stays closed, BuyOverlay engages.
  const marketOpen = buyMode != null && buyMode.pickedTarget == null;

  return (
    <div className="flex flex-1 flex-col" style={{ minHeight: 0 }}>
      {/* GameOverPanel mounts at the page root (play/page.tsx) so its
          fullscreen modal backdrop covers the entire viewport rather
          than being scoped to the scaled design canvas. */}

      {/* Horizontal demand bar — full-width row above the play grid.
          Replaces the vertical 96px thermometer column. `flex-shrink:0`
          on the bar (set in the component) keeps it from collapsing
          when the stage stretches; the dropped column hands its 96px +
          gap back to the stage. */}
      <DemandThermometer rolled={state.demand} target={12} />

      {/* Two-area grid: left rail (rivals + tasting notes) · stage+hand.
          Each region wears a .bb-panel class for the floating-card
          chrome; the 12px gap + padding on this main grid separates
          them visually. */}
      <main
        className="grid min-h-0 flex-1"
        style={{
          // Rivals 280px so opponent cards' name + handle + mini-
          // rickhouse range strips don't crowd. The right log column
          // already folded into the left rail; the demand thermometer
          // moved out of the grid into the horizontal bar above, so
          // the play grid is now down to two columns.
          //
          // `minmax(0, 1fr)` instead of `1fr` so the stage column can
          // SHRINK to its share of the remaining width. Plain `1fr` is
          // `minmax(auto, 1fr)`, which lets the column grow to fit its
          // content's intrinsic min-width and would push the whole
          // board past the 1680px design canvas (BuyOverlay /
          // MakeOverlay panels then escape the centered sleeve).
          gridTemplateColumns: "280px minmax(0, 1fr)",
          gridTemplateRows: "1fr auto",
          gridTemplateAreas: '"left stage" "left hand"',
          gap: 12,
          padding: 12,
          background:
            "radial-gradient(120% 70% at 50% 0%, rgba(176,106,56,.05), transparent 50%)",
        }}
      >
        {/* Left column — Rivals on top, Tasting Notes filling the rest.
            Both child panels keep their own `gridArea` style attrs,
            but those become no-ops inside this flex wrapper (which is
            the actual grid item) and the components stay reusable
            elsewhere (tutorial routes, etc.). */}
        <div
          className="flex min-h-0 flex-col gap-3"
          style={{ gridArea: "left" }}
        >
          <OpponentRail />
          <RightRail />
        </div>

        {/* Stage area — flex column with MarketRow above DistilleryStage.
            Each child is its own floating panel; the wrapper just stacks
            them and forwards `gridArea: "stage"`. */}
        <div
          className="flex min-h-0 flex-col gap-3"
          style={{ gridArea: "stage" }}
        >
          <MarketRow />
          <DistilleryStage />
        </div>

        {/* HandTray stamps `gridArea: "hand"` on its own root so it
            slots into the bottom-center area of this grid. */}
        <HandTray />
      </main>

      {/* Market drawer — opens above the board for full browsing when
          BUY MARKET / OPEN FULL ↗ / +N more is clicked. Inline buys
          via MarketRow cards skip the drawer entirely. */}
      <MarketDrawer open={marketOpen} onClose={cancelBuyMode} />

      {/* CardInspectModal mounts at the page root (see play/page.tsx)
          so its `position: fixed` covers the full viewport rather
          than being scoped to the scaled design canvas (ScalingHost). */}

      {/* Flight animations — preserved unchanged. */}
      <PurchaseFlight />
      <MakeFlight />
      <SaleFlight />
      <AgeFlight />
    </div>
  );
}
