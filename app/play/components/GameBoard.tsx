"use client";

import { useGameStore } from "@/lib/store/gameStore";
import PhaseBanner from "./PhaseBanner";
import RickhouseRow from "./RickhouseRow";
import MarketPanel from "./MarketPanel";
import OpponentList from "./OpponentList";
import HandTray from "./HandTray";
import ActionBar from "./ActionBar";
import FeesPanel from "./FeesPanel";
import MarketPhasePanel from "./MarketPhasePanel";
import GameOverPanel from "./GameOverPanel";
import EventLog from "./EventLog";
import SaleRevealModal from "./SaleRevealModal";

export default function GameBoard() {
  const state = useGameStore((s) => s.state);
  if (!state) return null;

  return (
    <div className="flex flex-col gap-4">
      <PhaseBanner />

      {state.phase === "gameover" ? <GameOverPanel /> : null}

      {state.phase === "fees" ? <FeesPanel /> : null}
      {state.phase === "market" ? <MarketPhasePanel /> : null}

      <RickhouseRow />

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-4">
          <MarketPanel />
          <OpponentList />
        </div>
        <EventLog />
      </div>

      <HandTray />
      {state.phase === "action" ? <ActionBar /> : null}

      <SaleRevealModal />
    </div>
  );
}
