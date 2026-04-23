"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import Link from "next/link";
import { clearSavedGame } from "@/lib/store/persistence";
import { useGameStore } from "@/lib/store/gameStore";

type State = { hasError: boolean; error: Error | null };

/**
 * Catches render-time errors in the /play tree. Offers to clear the saved game
 * so a corrupted localStorage payload can't trap the user forever.
 */
export default class GameErrorBoundary extends Component<
  { children: ReactNode },
  State
> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Bourbonomics game crashed:", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="mx-auto my-16 max-w-lg rounded-lg border border-rose-700 bg-slate-900 p-6 text-center">
        <h2 className="text-xl font-semibold text-rose-200">
          Something went wrong
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          The game hit an error. You can reset the board and start fresh.
        </p>
        {this.state.error ? (
          <pre className="mt-3 max-h-32 overflow-auto rounded bg-slate-950 p-2 text-left text-xs text-rose-300">
            {this.state.error.message}
          </pre>
        ) : null}
        <div className="mt-4 flex justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              clearSavedGame();
              useGameStore.getState().clear();
              window.location.reload();
            }}
            className="rounded-md bg-rose-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-rose-400"
          >
            Reset game
          </button>
          <Link
            href="/"
            className="rounded-md border border-slate-700 px-4 py-1.5 text-sm font-semibold text-slate-200 hover:bg-slate-800"
          >
            Back to lobby
          </Link>
        </div>
      </div>
    );
  }
}
