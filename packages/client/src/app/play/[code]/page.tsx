"use client";

/**
 * `/play/[code]` — multi-player room view.
 *
 * Joins the room named in the URL (or stays bound if the lobby just
 * created it). Renders the same `GameBoard` the solo flow uses; the
 * store knows it's in multiplayer mode and routes dispatches over
 * the socket instead of applying locally.
 *
 * Setup-phase modals are intentionally suppressed here for the v1
 * MVP: bots seat-fill and the engine skips the distillery selection
 * phase via the DISTILLERIES_ENABLED flag, so the human only sees
 * action-phase UI. Setup-phase multi-client coordination ships in
 * a later iteration.
 */

import { use, useEffect, useState } from "react";

import GameBoard from "../components/GameBoard";
import GameErrorBoundary from "../components/ErrorBoundary";
import GameTopBar from "../components/GameTopBar";
import RoomBanner from "./RoomBanner";
import { useGameStore } from "@/lib/store/game";

interface Props {
  params: Promise<{ code: string }>;
}

export default function PlayCodePage({ params }: Props) {
  const { code: rawCode } = use(params);
  const code = rawCode.toUpperCase();
  const { state, multiplayerMode, multiplayerStatus, joinMultiplayer, dragMake } =
    useGameStore();
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  // Auto-join on mount if we're not already bound to this room. The
  // host arriving from the lobby will already be bound; deep-link
  // visitors from a share URL hit this branch and prompt for a name.
  useEffect(() => {
    if (multiplayerMode && multiplayerMode.code === code) return;
    let cancelled = false;
    setJoining(true);
    setJoinError(null);
    // Default to a generic display name. A future iteration adds a
    // pre-join name prompt; for the MVP, getting people in fast wins
    // over personalization.
    const defaultName =
      typeof window !== "undefined"
        ? window.localStorage.getItem("bourbonomics:displayName") ?? "Guest"
        : "Guest";
    joinMultiplayer(code, defaultName)
      .then(() => {
        if (cancelled) return;
        setJoining(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setJoinError(err instanceof Error ? err.message : "Failed to join room.");
        setJoining(false);
      });
    return () => {
      cancelled = true;
    };
    // Intentionally only run when the URL code changes — `joinMultiplayer`
    // is stable because the store memos it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Same drag-class hookup as the solo `/play` page.
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

  // Loading / error gates.
  if (joinError) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
        <div className="mx-auto max-w-xl rounded border-2 border-rose-500/70 bg-rose-950/30 px-6 py-5">
          <h1 className="font-display text-2xl font-bold text-rose-200">
            Couldn't join room {code}
          </h1>
          <p className="mt-2 text-sm text-slate-300">{joinError}</p>
          <a
            href="/multiplayer"
            className="mt-4 inline-block font-mono text-xs text-amber-400 hover:text-amber-300"
          >
            ← back to lobby
          </a>
        </div>
      </main>
    );
  }

  if (!state || joining) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
        <div className="mx-auto max-w-xl text-center">
          <p className="font-mono text-[11px] uppercase tracking-[.18em] text-slate-500">
            {multiplayerStatus === "connecting"
              ? "connecting…"
              : multiplayerStatus === "open"
                ? "joining…"
                : multiplayerStatus}
          </p>
          <h1 className="mt-3 font-display text-3xl font-bold text-amber-300">
            Room {code}
          </h1>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen text-slate-100"
      style={{
        backgroundColor: "#0f172a",
        backgroundImage: `
          radial-gradient(1200px 600px at 70% -10%, rgba(180,83,9,.10), transparent 60%),
          radial-gradient(800px 500px at -10% 110%, rgba(99,102,241,.06), transparent 60%)
        `,
      }}
    >
      <div className="flex min-h-screen flex-col">
        <GameTopBar />
        <RoomBanner code={code} />
        <GameErrorBoundary>
          <GameBoard />
        </GameErrorBoundary>
      </div>
    </main>
  );
}
