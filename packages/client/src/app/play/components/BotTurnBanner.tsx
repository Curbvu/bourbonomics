"use client";

/**
 * BotTurnBanner — small floating chip that surfaces "X is taking their
 * turn…" while a bot acts under autoplay.
 *
 * Without this, the board sometimes just twitches with no clear signal
 * of who's moving. The chip pairs with the gold halo pulse the
 * OpponentRail tile picks up (.bb-onclock-pulse) so the player has
 * both a row-level cue and a banner-level cue.
 *
 * Self-gates on: phase === "action" + current player is a bot +
 * autoplay is on. Mounted at page root so its `position: fixed`
 * anchors to the true viewport (ScalingHost would otherwise scope it).
 */

import { useGameStore } from "@/lib/store/game";

export default function BotTurnBanner() {
  const { state, autoplay } = useGameStore();
  if (!state) return null;
  if (!autoplay) return null;
  if (state.phase !== "action") return null;
  const current = state.players[state.currentPlayerIndex];
  if (!current || !current.isBot) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed left-1/2 top-3 z-40 -translate-x-1/2 animate-bb-spot-fade"
    >
      <span className="flex items-center gap-2 rounded-full border border-amber-500/70 bg-gradient-to-b from-amber-900/85 to-slate-950/95 px-3.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[.14em] text-amber-100 shadow-[0_4px_14px_rgba(0,0,0,.5),inset_0_1px_0_rgba(255,255,255,.08)] backdrop-blur-md">
        <span aria-hidden className="text-[13px] leading-none">🎲</span>
        <span>
          {current.name} is taking their turn
          <span className="bb-onclock-dots" aria-hidden>
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </span>
        </span>
      </span>
    </div>
  );
}
