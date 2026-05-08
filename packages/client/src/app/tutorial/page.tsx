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
import TutorialController from "./TutorialController";

export default function TutorialPage() {
  const { state, tutorialActive, startTutorial, endTutorial, dragMake } =
    useGameStore();

  // Boot the rigged scenario on first paint. Re-init if the store is
  // empty (e.g. user hits /tutorial after Skip → /); end the tutorial
  // on unmount so the live store doesn't keep tutorial state around.
  useEffect(() => {
    if (!tutorialActive || !state) {
      startTutorial();
    }
    return () => {
      endTutorial();
    };
    // Run exactly once on mount — startTutorial is stable.
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
      className="h-screen overflow-hidden text-slate-100"
      style={{
        backgroundColor: "#0f172a",
        backgroundImage: `
          radial-gradient(1200px 600px at 70% -10%, rgba(180,83,9,.10), transparent 60%),
          radial-gradient(800px 500px at -10% 110%, rgba(99,102,241,.06), transparent 60%)
        `,
      }}
    >
      <div className="flex h-screen flex-col">
        <GameTopBar />
        <GameErrorBoundary>
          <GameBoard />
        </GameErrorBoundary>
      </div>
      {/* The tutorial owns its own demand / draw cadence, so we deliberately
          DO NOT mount DemandRollModal / DrawPhaseModal here — the controller
          dispatches those actions on its own clock. */}
      <TutorialController />
    </main>
  );
}
