"use client";

import { useEffect } from "react";
import BotTurnBanner from "./components/BotTurnBanner";
import CardInspectModal from "./components/CardInspectModal";
import GameOverPanel from "./components/GameOverPanel";
import ToastStack from "./components/ToastStack";
import DemandRollModal from "./components/DemandRollModal";
import DistilleryDraftModal from "./components/DistilleryDraftModal";
import DraftPickFlight from "./components/DraftPickFlight";
import DrawBillOverlay from "./components/DrawBillOverlay";
import GameBoard from "./components/GameBoard";
import GameErrorBoundary from "./components/ErrorBoundary";
import GameTopBar from "./components/GameTopBar";
import GameSetupMenu from "./components/GameSetupMenu";
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

  // v3 distillery-first refresh: tag the body so the globals.css paper
  // grain overlay (body[data-page="play"]::before) activates. Cleared
  // on unmount so other pages stay clean.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.dataset.page = "play";
    return () => {
      delete document.body.dataset.page;
    };
  }, []);

  if (!state) return <GameSetupMenu />;

  return (
    <main
      className="h-screen overflow-hidden text-[#f0e3c8]"
      style={{
        // v3 warm bourbon canvas — replaces the old cool slate
        // (#0f172a) + indigo radials with the mockup's atmospheric
        // amber radials over deep bourbon dark.
        backgroundColor: "#0c0805",
        backgroundImage: `
          radial-gradient(140% 90% at 50% 110%, rgba(213,150,80,.10), transparent 60%),
          radial-gradient(80% 60% at 50% -10%, rgba(213,150,80,.05), transparent 50%)
        `,
      }}
    >
      {/* GameTopBar lives OUTSIDE ScalingHost so its header strip spans
          the full viewport width on wide monitors. Inside ScalingHost
          it was clamped to the 1680px design canvas, leaving a bright
          uncovered strip to its right. */}
      <div className="flex h-full flex-col">
        <GameTopBar />
        <div className="flex-1 overflow-hidden">
          <ScalingHost>
            <GameErrorBoundary>
              <GameBoard />
            </GameErrorBoundary>
          </ScalingHost>
        </div>
      </div>
      {/* Setup-phase modals — render unconditionally; each component
          self-gates on phase + humanWaitingOn (or autoplay). */}
      <DistilleryDraftModal />
      <StarterDeckDraftModal />
      <DemandRollModal />
      {/* Drafting-loop modal — mounted at the page root (outside
          ScalingHost) so its `fixed inset-0` covers the full viewport
          rather than being scoped to the scaled design canvas. */}
      <DrawBillOverlay />
      {/* CardInspectModal — same containing-block reason: a fullscreen
          backdrop that needs to cover the right rail (which sits
          outside ScalingHost on wide screens). */}
      <CardInspectModal />
      {/* Game-over standings — same containing-block reason. */}
      <GameOverPanel />
      {/* Bot-turn banner + Toast stack — both anchor to the true
          viewport via page-root mount (ScalingHost would otherwise
          scope their position: fixed to the design canvas). */}
      <BotTurnBanner />
      <ToastStack />
      {/* Draft-pick flight — fires when the human commits a bill.
          Page-root mount for the same containing-block reason; sibling
          to the modal so the flight starts the same frame the modal
          unmounts. */}
      <DraftPickFlight />
      {/* Year-pass interstitial — z-55, mounted last so it sits over
          the rest of the canvas. The player reads the year-pass recap, hits
          Begin year, and the draw modal underneath becomes interactive. */}
      <YearPassModal />
    </main>
  );
}
