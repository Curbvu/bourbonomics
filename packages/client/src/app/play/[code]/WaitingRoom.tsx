"use client";

/**
 * Pre-game lobby — shown when the room exists but the host hasn't
 * started yet. The host sees a Start button (disabled until at
 * least one human seat is claimed); other claimants and spectators
 * see a "waiting on host" indicator. Roster + share link live in
 * the existing RoomBanner above this.
 */

import { useGameStore } from "@/lib/store/game";

export default function WaitingRoom({ code }: { code: string }) {
  const { multiplayerMode, roster, startMultiplayerGame } = useGameStore();
  if (!multiplayerMode) return null;

  const isHost = multiplayerMode.playerId === multiplayerMode.hostPlayerId;
  const claimedHumans = roster.filter((s) => !s.isBot && s.claimedBy).length;
  const totalHumans = roster.filter((s) => !s.isBot).length;
  const openHumanSeats = totalHumans - claimedHumans;

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12 text-slate-100">
      <div className="w-full max-w-md text-center">
        <p className="font-mono text-[10px] uppercase tracking-[.18em] text-rose-300">
          waiting room
        </p>
        <h1 className="mt-2 font-display text-5xl font-bold tracking-[.08em] text-amber-300 drop-shadow-[0_2px_8px_rgba(0,0,0,.6)]">
          {code}
        </h1>
        <p className="mt-3 text-sm text-slate-400">
          {claimedHumans} of {totalHumans} human {totalHumans === 1 ? "seat" : "seats"}{" "}
          claimed
          {openHumanSeats > 0 ? ` · ${openHumanSeats} open` : ""}
        </p>

        {isHost ? (
          <button
            type="button"
            onClick={startMultiplayerGame}
            className="mt-8 w-full rounded border-2 border-amber-300 bg-gradient-to-b from-amber-300 to-amber-600 px-5 py-3 font-sans text-base font-bold uppercase tracking-[.05em] text-slate-950 transition-colors hover:from-amber-200 hover:to-amber-500"
          >
            Start game →
          </button>
        ) : multiplayerMode.playerId ? (
          <p className="mt-8 rounded border border-slate-600 bg-slate-900/50 px-4 py-3 font-mono text-sm text-slate-300">
            ⏳ Waiting on the host to start the game.
          </p>
        ) : (
          <p className="mt-8 rounded border border-slate-600 bg-slate-900/50 px-4 py-3 font-mono text-sm text-slate-300">
            👁 Spectating. Claim an open seat above to play.
          </p>
        )}

        {isHost && openHumanSeats > 0 ? (
          <p className="mt-4 font-mono text-[10.5px] uppercase tracking-[.14em] text-slate-500">
            (You can start now; open seats stay claim-able mid-game.)
          </p>
        ) : null}
      </div>
    </main>
  );
}
