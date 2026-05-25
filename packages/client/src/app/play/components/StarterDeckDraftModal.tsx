"use client";

/**
 * Starter-deck trade window — v2.4 Random Deal + Trading.
 *
 * The engine deals each drafter 16 face-up cards at phase entry. This
 * modal lets the human review their dealt hand and pass when ready.
 *
 * Trade UI (proposing 1-for-1 swaps with other players) and the
 * stuck-hand safety valve (returning up to 3 cards for replacements)
 * are not yet wired into this modal — bots auto-pass during the
 * window so the phase still advances. Both will land in a follow-up
 * frontend pass.
 */

import { useGameStore } from "@/lib/store/game";
import HandCardTile from "./HandCardTile";

export default function StarterDeckDraftModal() {
  const { state, humanWaitingOn, humanSeatPlayerId, dispatch } = useGameStore();

  if (!state) return null;
  if (state.phase !== "starter_deck_draft") return null;
  if (!humanWaitingOn) return null;
  // In multiplayer the engine cycles through every human seat — only
  // fire the modal on the connection whose seat is currently on the
  // clock, otherwise everyone in the room would see (and could click)
  // someone else's draft prompt.
  if (humanSeatPlayerId && humanWaitingOn.id !== humanSeatPlayerId) return null;

  const player = state.players.find((p) => p.id === humanWaitingOn.id);
  if (!player) return null;

  const handTiles = player.starterHand.slice();

  const onPass = () => {
    dispatch({ type: "STARTER_PASS", playerId: player.id });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Review your starter hand and pass when ready"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-6 backdrop-blur"
    >
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(251,191,36,0.28) 0%, transparent 65%)",
        }}
      />

      <div className="relative flex max-h-[calc(100vh-3rem)] w-full max-w-[1180px] flex-col items-center gap-4 overflow-hidden">
        <div className="text-center">
          <div className="font-mono text-[13px] uppercase tracking-[.18em] text-amber-300">
            Setup · Starter trade window
          </div>
          <div className="mt-1 font-display text-2xl font-semibold text-amber-100">
            Review your dealt starter hand
          </div>
          <div className="mt-1 font-mono text-[12px] uppercase tracking-[.14em] text-slate-400">
            {humanWaitingOn.name}
            {humanWaitingOn.distillery ? <> · {humanWaitingOn.distillery.name}</> : null}
            {" · "}
            <span className="text-amber-200">{handTiles.length} cards</span>
          </div>
        </div>

        <div className="w-full rounded-lg border border-slate-800 bg-slate-950/60 p-3">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="font-mono text-[12px] uppercase tracking-[.18em] text-slate-400">
              Your starter hand
            </span>
            <span className="font-mono text-[12px] uppercase tracking-[.12em] text-slate-500">
              face-up · trade UI coming soon
            </span>
          </div>
          <div className="flex flex-wrap justify-center gap-1.5">
            {handTiles.map((c) => (
              <HandCardTile key={c.id} card={c} size="sm" />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onPass}
            className="rounded-md border border-amber-400 bg-gradient-to-b from-amber-300 to-amber-500 px-6 py-2 font-sans text-sm font-bold uppercase tracking-[.05em] text-slate-950 shadow-[0_0_0_3px_rgba(251,191,36,0.30),inset_0_1px_0_rgba(255,255,255,0.25)] transition-all hover:from-amber-200 hover:to-amber-400"
          >
            Shuffle deck ↵
          </button>
        </div>
      </div>
    </div>
  );
}

