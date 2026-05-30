"use client";

/**
 * /tutorial/advanced — the 14-chapter advanced walkthrough.
 *
 * Mirrors /tutorial's page wiring but injects:
 *   - the advanced scenario builder (drops into distillery_selection)
 *   - the advanced beats list (14 chapters covering distillery picks,
 *     starter draft, mash bills, Drafting Loop, Specialty resources,
 *     demand, ops cards, Warehouse, trade, awards, portfolios, 2nd
 *     portfolios, endgame)
 *   - the advanced chapter-progress helper
 *   - a separate localStorage completion key
 *   - skipIntroTour=true so the player doesn't sit through the
 *     basic-tutorial intro cinematic again
 */

import { useEffect } from "react";
import { buildTutorialAdvancedInitialState } from "@bourbonomics/engine";
import { useGameStore } from "@/lib/store/game";
import GameBoard from "../../play/components/GameBoard";
import GameTopBar from "../../play/components/GameTopBar";
import GameErrorBoundary from "../../play/components/ErrorBoundary";
import ScalingHost from "../../play/components/ScalingHost";
import DistilleryDraftModal from "../../play/components/DistilleryDraftModal";
import StarterDeckDraftModal from "../../play/components/StarterDeckDraftModal";
import BottlePlacementModal from "../../play/components/BottlePlacementModal";
import TutorialController from "../TutorialController";
import {
  TUTORIAL_ADVANCED_BEATS,
  chapterProgressForAdvanced,
} from "./beats";

export const TUTORIAL_ADVANCED_COMPLETE_KEY =
  "bourbonomics:tutorial-advanced-complete";

export default function AdvancedTutorialPage() {
  const { state, startTutorial, endTutorial, dragMake } = useGameStore();

  useEffect(() => {
    startTutorial(buildTutorialAdvancedInitialState);
    return () => {
      endTutorial();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.dataset.page = "play";
    return () => {
      delete document.body.dataset.page;
    };
  }, []);

  if (!state) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
        <div className="mx-auto max-w-md text-center">
          <p className="font-mono text-[13px] uppercase tracking-[.18em] text-amber-300">
            Advanced Tutorial
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold">
            Spinning up your distillery…
          </h1>
        </div>
      </main>
    );
  }

  return (
    <main
      className="h-screen overflow-hidden text-[#f0e3c8]"
      style={{
        backgroundColor: "#0c0805",
        backgroundImage: `
          radial-gradient(140% 90% at 50% 110%, rgba(213,150,80,.10), transparent 60%),
          radial-gradient(80% 60% at 50% -10%, rgba(213,150,80,.05), transparent 50%)
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
      {/* Setup-phase modals — the advanced tutorial actually walks
          through distillery_selection and starter_deck_draft, so
          these need to mount (unlike the basic tutorial which pre-
          skips both phases via its rigged scenario). */}
      <DistilleryDraftModal />
      <StarterDeckDraftModal />
      <BottlePlacementModal />
      <TutorialController
        beats={TUTORIAL_ADVANCED_BEATS}
        progressFor={chapterProgressForAdvanced}
        completeKey={TUTORIAL_ADVANCED_COMPLETE_KEY}
        skipIntroTour
      />
    </main>
  );
}
