"use client";

/**
 * /tutorial — guided walkthrough that drops the player into the real
 * GameBoard with a rigged scenario (Backroad + Heritage already slotted,
 * Specialty Rye locked at market slot 0, bot pre-staged with an Aging
 * barrel ready to sell). Beat overlay layers stack on top — intro
 * cinematic, board tour, scripted prompts, false-decision modal,
 * time-skip transitions, Silver celebration, finale.
 *
 * The store's `tutorialActive` flag pauses the orchestrator's auto-step
 * loop and routes every dispatched action through a transform hook —
 * the controller uses that hook to gate off-script plays and to force
 * the rep/draw split on the scripted sales.
 */

import { useEffect } from "react";
import { useGameStore } from "@/lib/store/game";
import GameBoard from "../play/components/GameBoard";
import GameTopBar from "../play/components/GameTopBar";
import GameErrorBoundary from "../play/components/ErrorBoundary";
import ScalingHost from "../play/components/ScalingHost";
import TutorialController from "./TutorialController";

export default function TutorialPage() {
  const { state, startTutorial, endTutorial, dragMake } = useGameStore();

  // Always boot the rigged scenario on mount — never trust whatever
  // state the GameProvider may have hydrated from localStorage. The
  // GameProvider's hydration also self-skips when `tutorialActiveRef`
  // is set, but we belt-and-braces here too.
  useEffect(() => {
    startTutorial();
    return () => {
      endTutorial();
    };
    // Run exactly once on mount — startTutorial / endTutorial are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mirror the play page's drag-state body attribute so make-card
  // dimming still works inside the tutorial.
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

  // v3 refresh — same data-page flag /play uses so the paper-grain
  // overlay shows during the tutorial too.
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
          <p className="font-mono text-[11px] uppercase tracking-[.18em] text-amber-300">
            Tutorial
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
      {/* The tutorial owns its own demand / draw cadence, so we deliberately
          DO NOT mount DemandRollModal here — the controller dispatches
          those actions on its own clock. */}
      <TutorialController />
    </main>
  );
}
