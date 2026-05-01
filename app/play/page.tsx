"use client";

import { useEffect } from "react";

import GameBoard from "./components/GameBoard";
import GameErrorBoundary from "./components/ErrorBoundary";
import GameTopBar from "./components/GameTopBar";
import { useGameStore } from "@/lib/store/gameStore";
import { installPersistence } from "@/lib/store/persistence";

export default function PlayPage() {
  const state = useGameStore((s) => s.state);
  const newGame = useGameStore((s) => s.newGame);

  useEffect(() => {
    installPersistence();
    // After loading, if there is still no game, start a default one.
    if (useGameStore.getState().state) return;
    newGame({
      id: "quickstart",
      seed: Math.floor(Math.random() * 0xffff_ffff),
      seats: [
        { name: "You", kind: "human" },
        { name: "Clyde", kind: "bot", botDifficulty: "normal" },
        { name: "Dell", kind: "bot", botDifficulty: "easy" },
      ],
    });
  }, [newGame]);

  if (!state) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 text-slate-100">
        <h1 className="font-display text-2xl font-semibold text-amber-100">
          Starting new game…
        </h1>
      </main>
    );
  }

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
      <div className="mx-auto flex min-h-screen max-w-[1440px] flex-col">
        <GameTopBar />
        <GameErrorBoundary>
          <GameBoard />
        </GameErrorBoundary>
      </div>
    </main>
  );
}
