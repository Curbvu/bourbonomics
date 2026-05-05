"use client";

import DemandRollModal from "./components/DemandRollModal";
import DistilleryDraftModal from "./components/DistilleryDraftModal";
import GameBoard from "./components/GameBoard";
import GameErrorBoundary from "./components/ErrorBoundary";
import GameTopBar from "./components/GameTopBar";
import MainMenu from "./components/MainMenu";
import StarterDeckDraftModal from "./components/StarterDeckDraftModal";
import { useGameStore } from "@/lib/store/game";

export default function PlayPage() {
  const { state } = useGameStore();

  if (!state) return <MainMenu />;

  return (
    <main
      className="min-h-screen text-slate-100"
      style={{
        backgroundColor: "#0f172a",
        backgroundImage: `
          radial-gradient(1200px 600px at 70% -10%, rgba(180,83,9,.10), transparent 60%),
          radial-gradient(800px 500px at -10% 110%, rgba(99,102,241,.06), transparent 60%)
        `,
      }}
    >
      <div className="flex min-h-screen flex-col">
        <GameTopBar />
        <GameErrorBoundary>
          <GameBoard />
        </GameErrorBoundary>
      </div>
      {/* Setup-phase modals — render unconditionally; each component
          self-gates on phase + humanWaitingOn (or autoplay). */}
      <DistilleryDraftModal />
      <StarterDeckDraftModal />
      <DemandRollModal />
    </main>
  );
}
