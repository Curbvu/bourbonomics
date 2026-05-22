"use client";

import { useEffect } from "react";
import DemandRollModal from "./components/DemandRollModal";
import DistilleryDraftModal from "./components/DistilleryDraftModal";
import DrawPhaseModal from "./components/DrawPhaseModal";
import GameBoard from "./components/GameBoard";
import GameErrorBoundary from "./components/ErrorBoundary";
import GameTopBar from "./components/GameTopBar";
import MainMenu from "./components/MainMenu";
import ScalingHost from "./components/ScalingHost";
import StarterDeckDraftModal from "./components/StarterDeckDraftModal";
import YearPassModal from "./components/YearPassModal";
import { useGameStore } from "@/lib/store/game";

export default function PlayPage() {
  const { state, dragMake } = useGameStore();

  // v2.6: surface the drag state on <body> so global CSS rules can
  // dim non-receiving zones during a make-card drag. Cleared on the
  // component's unmount (e.g. when the player navigates away mid-drag).
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (dragMake) {
      document.body.dataset.draggingMake = "true";
    } else {
      delete document.body.dataset.draggingMake;
    }
    return () => {
      delete document.body.dataset.draggingMake;
    };
  }, [dragMake]);

  if (!state) return <MainMenu />;

  return (
    <main
      className="h-screen overflow-hidden text-slate-100"
      style={{
        backgroundColor: "#0f172a",
        backgroundImage: `
          radial-gradient(1200px 600px at 70% -10%, rgba(180,83,9,.10), transparent 60%),
          radial-gradient(800px 500px at -10% 110%, rgba(99,102,241,.06), transparent 60%)
        `,
      }}
    >
      <ScalingHost>
        <div className="flex h-full flex-col">
          <GameTopBar />
          <GameErrorBoundary>
            <GameBoard />
          </GameErrorBoundary>
        </div>
      </ScalingHost>
      {/* Setup-phase modals — render unconditionally; each component
          self-gates on phase + humanWaitingOn (or autoplay). */}
      <DistilleryDraftModal />
      <StarterDeckDraftModal />
      <DemandRollModal />
      <DrawPhaseModal />
      {/* Mounted last so it sits above DrawPhaseModal in the DOM stack
          (z-55 vs z-50). The player reads the year-pass recap, hits
          Begin year, and the draw modal underneath becomes interactive. */}
      <YearPassModal />
    </main>
  );
}
