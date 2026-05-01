"use client";

import { useEffect } from "react";

import GameBoard from "./components/GameBoard";
import GameErrorBoundary from "./components/ErrorBoundary";
import GameTopBar from "./components/GameTopBar";
import MainMenu from "./components/MainMenu";
import { useGameStore } from "@/lib/store/gameStore";
import { installPersistence } from "@/lib/store/persistence";

export default function PlayPage() {
  const state = useGameStore((s) => s.state);

  // Install persistence on mount; this synchronously loads any saved
  // game from localStorage so the player resumes where they left off.
  // No auto-start — when there's no saved game, MainMenu renders and
  // the player chooses their seats.
  useEffect(() => {
    installPersistence();
  }, []);

  if (!state) return <MainMenu />;

  return (
    <main
      className="min-h-screen text-slate-100"
      style={{
        // Slate canvas with two soft radial gradients per design handoff
        // §Backgrounds — amber lift top-right, indigo lift bottom-left.
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
    </main>
  );
}
