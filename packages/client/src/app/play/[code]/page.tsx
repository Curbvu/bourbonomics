"use client";

/**
 * `/play/[code]` — multi-player room view.
 *
 * Three states:
 *
 *   1. **Already bound** to this code (the host who just minted it,
 *      or a returning player) → render the GameBoard.
 *   2. **Deep-link arrival** with a remembered display name in
 *      localStorage → auto-join.
 *   3. **Deep-link arrival** with no remembered name → show the
 *      pre-join modal so the player picks their name before we
 *      open the socket.
 *
 * Setup-phase modals (distillery selection, deck draft) are
 * intentionally skipped here for the v1 MVP: DISTILLERIES_ENABLED
 * is false and the engine pre-assigns Vanilla, so the human goes
 * straight to the action phase.
 */

import { use, useEffect, useState } from "react";

import GameBoard from "../components/GameBoard";
import GameErrorBoundary from "../components/ErrorBoundary";
import GameTopBar from "../components/GameTopBar";
import RoomBanner from "./RoomBanner";
import PreJoinPrompt from "./PreJoinPrompt";
import { useGameStore } from "@/lib/store/game";

interface Props {
  params: Promise<{ code: string }>;
}

const NAME_KEY = "bourbonomics:displayName";

export default function PlayCodePage({ params }: Props) {
  const { code: rawCode } = use(params);
  const code = rawCode.toUpperCase();
  const { state, multiplayerMode, multiplayerStatus, joinMultiplayer, dragMake } =
    useGameStore();

  // `null` = haven't decided yet; "" = needs prompt; non-empty = pending
  // / completed join with this name. We split "deciding" from "needs
  // prompt" so the first paint doesn't flash the modal for users who
  // already have a saved name.
  const [pendingName, setPendingName] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  // First paint — figure out which mode we're in.
  useEffect(() => {
    if (multiplayerMode && multiplayerMode.code === code) {
      // Already in this room (host who just minted it, or a tab
      // that survived a hot reload). Skip the prompt.
      setPendingName("__SKIP__");
      return;
    }
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(NAME_KEY);
    if (saved && saved.trim().length > 0) {
      setPendingName(saved.trim());
    } else {
      setPendingName("");
    }
  }, [code, multiplayerMode]);

  // Auto-join the moment we've resolved a name (saved or freshly
  // entered). The "__SKIP__" sentinel means we're already bound and
  // there's nothing to do.
  useEffect(() => {
    if (pendingName == null || pendingName === "" || pendingName === "__SKIP__") return;
    if (multiplayerMode && multiplayerMode.code === code) return;
    let cancelled = false;
    setJoining(true);
    setJoinError(null);
    joinMultiplayer(code, pendingName)
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
    // joinMultiplayer is stable (memoized in the store).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, pendingName]);

  // Drag-class hookup, same as the solo `/play` page.
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

  // Pre-join name prompt — shown when we have no saved name. Submit
  // saves the name to localStorage and triggers the auto-join effect.
  if (pendingName === "") {
    return (
      <PreJoinPrompt
        code={code}
        onSubmit={(name) => {
          if (typeof window !== "undefined") {
            window.localStorage.setItem(NAME_KEY, name);
          }
          setPendingName(name);
        }}
      />
    );
  }

  // Error gate.
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

  // Loading gate.
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
