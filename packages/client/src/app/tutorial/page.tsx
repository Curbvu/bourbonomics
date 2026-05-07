"use client";

/**
 * /tutorial — guided walkthrough that gets a fresh player to their
 * first sale.
 *
 * Mounts the same GameBoard the real game uses, but on top of it
 * renders TutorialOverlay — a dim+spotlight system that narrates each
 * beat and auto-advances when the player satisfies the step's exit
 * condition (rolled demand, finished a barrel, sold one, etc.).
 *
 * The starting state is plain `newGame` with a fixed seed and 1 bot.
 * Deterministic enough for the script; the player still drives every
 * action themselves — the overlay never automates clicks.
 */

import { useEffect, useRef } from "react";
import { useGameStore } from "@/lib/store/game";
import GameBoard from "../play/components/GameBoard";
import GameTopBar from "../play/components/GameTopBar";
import GameErrorBoundary from "../play/components/ErrorBoundary";
import DemandRollModal from "../play/components/DemandRollModal";
import DistilleryDraftModal from "../play/components/DistilleryDraftModal";
import DrawPhaseModal from "../play/components/DrawPhaseModal";
import StarterDeckDraftModal from "../play/components/StarterDeckDraftModal";
import TutorialOverlay from "./TutorialOverlay";

const TUTORIAL_SEED = 42;

export default function TutorialPage() {
  const { state, newGame, dragMake } = useGameStore();
  const startedRef = useRef(false);

  // Mint a fresh tutorial game on first paint. Skipping when one's
  // already there means a hot reload doesn't kick the player back to
  // step 1 mid-walk.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    newGame({
      human: { name: "You" },
      bots: [{ name: "Tutor", difficulty: "easy" }],
      seed: TUTORIAL_SEED,
    });
  }, [newGame]);

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
      {/* Setup-phase modals — the starter draft modal pops first; the
          tutorial overlay walks the player through clicking it. */}
      <DistilleryDraftModal />
      <StarterDeckDraftModal />
      <DemandRollModal />
      <DrawPhaseModal />
      {/* Narrating layer — sits above the modals so its dim doesn't
          black out the modal it's pointing at. */}
      <TutorialOverlay />
    </main>
  );
}
