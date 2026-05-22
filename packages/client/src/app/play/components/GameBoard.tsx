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

import { useEffect } from "react";
import { useGameStore } from "@/lib/store/game";
import CardInspectModal from "./CardInspectModal";
import GameOverPanel from "./GameOverPanel";
import HandTray from "./HandTray";
import AgeFlight from "./AgeFlight";
import MakeFlight from "./MakeFlight";
import MarketCenter from "./MarketCenter";
import PurchaseFlight from "./PurchaseFlight";
import RickhouseRow from "./RickhouseRow";
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

  // Escape-to-cancel for any active picker overlay. The cancels are
  // safe no-ops when the matching mode isn't active, but we route to
  // the live mode first so the keystroke maps to the player's most
  // recent action intent.
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

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-[6px] overflow-hidden px-[12px] pb-[6px] pt-[6px]">
        {state.phase === "ended" ? <GameOverPanel /> : null}

        <div className="grid min-h-0 flex-1 gap-1.5 lg:grid-cols-[minmax(0,1fr)_300px]">
          {/* Left column, top-to-bottom:
                1. Opponents' rickhouses (someone else's stuff up here).
                2. Market — the shared table.
                3. Your rickhouse, flush against the HandTray below so
                   "your slots ↑ your cards" reads as one zone.
              This rearrangement is paired with dropping the persistent
              Mash Bills row from MarketCenter — under v2.14 bills only
              surface in the Drafting Loop overlay, so the section was
              an empty placeholder eating ~160px. */}
          <div className="flex min-h-0 flex-col gap-1.5">
            <RickhouseRow showOnly="others" />
            <MarketCenter />
            <RickhouseRow showOnly="self" />
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

      {/* Sell-bourbon animation — fan of cards flies from the sold
          slot to the seller's discard pile on every SELL_BOURBON. */}
      <SaleFlight />

      {/* Age-bourbon animation — card flies from the player's hand
          tray up into the destination barrel slot on every
          AGE_BOURBON. Mirrors MakeFlight; uses the hand tray as the
          source so the gesture reads "this card → that barrel." */}
      <AgeFlight />
    </div>
  );
}
