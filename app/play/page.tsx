"use client";

import { useEffect } from "react";
import Link from "next/link";

import GameBoard from "./components/GameBoard";
import GameErrorBoundary from "./components/ErrorBoundary";
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
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-2xl font-semibold">Starting new game…</h1>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <nav className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900/95 px-4 py-2 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4">
          <Link href="/" className="text-sm font-semibold text-amber-400 hover:text-amber-300">
            Bourbonomics
          </Link>
          <span className="text-xs text-slate-500">·</span>
          <span className="text-xs text-slate-400">solo vs computer</span>
          <Link href="/rules" className="ml-auto text-xs text-slate-400 hover:text-slate-200">
            Rules
          </Link>
        </div>
      </nav>
      <div className="mx-auto max-w-7xl px-4 py-6">
        <GameErrorBoundary>
          <GameBoard />
        </GameErrorBoundary>
      </div>
    </main>
  );
}
