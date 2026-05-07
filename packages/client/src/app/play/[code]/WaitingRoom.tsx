"use client";

/**
 * Pre-game lobby — shown when the room exists but the host hasn't
 * started yet. Visual idiom mirrors the in-game Rickhouse: one
 * row per seat with a player swatch + name + tag (you / bot /
 * open). The host sees a Start Game button below the seat list;
 * other players see a "waiting on host" line.
 */

import { useGameStore } from "@/lib/store/game";
import PlayerSwatch from "../components/PlayerSwatch";
import type { SeatInfo } from "@/lib/store/socket";

export default function WaitingRoom({ code }: { code: string }) {
  const { multiplayerMode, roster, startMultiplayerGame } = useGameStore();
  if (!multiplayerMode) return null;

  const isHost = multiplayerMode.playerId === multiplayerMode.hostPlayerId;
  const claimedHumans = roster.filter((s) => !s.isBot && s.claimedBy).length;
  const totalHumans = roster.filter((s) => !s.isBot).length;
  const openHumanSeats = totalHumans - claimedHumans;

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-10 text-slate-100">
      <div className="w-full max-w-2xl">
        {/* Heading — room code + claim count, same chrome as the
            in-game RickhouseRow header. */}
        <div className="text-center">
          <p className="font-mono text-[10px] uppercase tracking-[.18em] text-rose-300">
            waiting room
          </p>
          <h1 className="mt-2 font-display text-6xl font-bold tracking-[.1em] text-amber-300 drop-shadow-[0_2px_8px_rgba(0,0,0,.6)]">
            {code}
          </h1>
          <p className="mt-3 font-mono text-[11px] uppercase tracking-[.14em] text-slate-400">
            {claimedHumans} of {totalHumans} human{" "}
            {totalHumans === 1 ? "seat" : "seats"} claimed
            {openHumanSeats > 0 ? (
              <>
                {" · "}
                <span className="text-rose-300">{openHumanSeats} open</span>
              </>
            ) : null}
          </p>
        </div>

        {/* Seat list. */}
        <div className="mt-6 flex flex-col gap-1.5">
          {roster.map((seat, i) => (
            <SeatRow
              key={seat.playerId}
              seat={seat}
              seatIndex={i}
              mine={seat.playerId === multiplayerMode.playerId}
              isHostSeat={seat.playerId === multiplayerMode.hostPlayerId}
            />
          ))}
        </div>

        {/* Action area — Start Game (host) / wait line (others). */}
        <div className="mt-8 flex flex-col items-center gap-3">
          {isHost ? (
            <>
              <button
                type="button"
                onClick={startMultiplayerGame}
                className="w-full max-w-sm rounded-md border-2 border-amber-300 bg-gradient-to-b from-amber-300 to-amber-600 px-5 py-3 font-sans text-base font-bold uppercase tracking-[.06em] text-slate-950 shadow-[0_8px_20px_rgba(251,191,36,.25)] transition-colors hover:from-amber-200 hover:to-amber-500"
              >
                Start game →
              </button>
              {openHumanSeats > 0 ? (
                <p className="font-mono text-[10px] uppercase tracking-[.14em] text-slate-500">
                  Heads up — {openHumanSeats} unclaimed{" "}
                  {openHumanSeats === 1 ? "seat becomes a bot" : "seats become bots"}{" "}
                  when you start.
                </p>
              ) : null}
            </>
          ) : multiplayerMode.playerId ? (
            <p className="rounded border border-slate-700 bg-slate-900/60 px-4 py-3 font-mono text-sm text-slate-300">
              ⏳ Waiting on the host to start the game.
            </p>
          ) : (
            <p className="rounded border border-slate-700 bg-slate-900/60 px-4 py-3 font-mono text-sm text-slate-300">
              👁 Spectating — claim an open seat above to play.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

function SeatRow({
  seat,
  seatIndex,
  mine,
  isHostSeat,
}: {
  seat: SeatInfo;
  seatIndex: number;
  mine: boolean;
  isHostSeat: boolean;
}) {
  const tag = seat.isBot
    ? "bot"
    : mine
      ? "you"
      : seat.claimedBy
        ? "joined"
        : "open";
  const tagTone =
    tag === "you"
      ? "border-emerald-400 bg-emerald-900/40 text-emerald-200"
      : tag === "joined"
        ? "border-amber-400/70 bg-amber-900/30 text-amber-200"
        : tag === "bot"
          ? "border-slate-600 bg-slate-900/60 text-slate-300"
          : "border-rose-500/60 bg-rose-950/40 text-rose-200";

  const displayName = seat.isBot
    ? seat.name
    : seat.claimedBy ?? "Open seat";

  return (
    <div
      className={[
        "flex items-center gap-3 rounded-lg border bg-slate-900/60 px-4 py-3 transition-colors",
        mine
          ? "border-emerald-500/70 ring-1 ring-emerald-500/40"
          : "border-slate-800",
      ].join(" ")}
    >
      <PlayerSwatch seatIndex={seatIndex} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate font-display text-lg font-semibold text-slate-100">
            {displayName}
          </span>
          {isHostSeat ? (
            <span className="rounded bg-amber-700/30 px-1.5 py-px font-mono text-[9px] font-bold uppercase tracking-[.08em] text-amber-200">
              host
            </span>
          ) : null}
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[.12em] text-slate-500">
          Seat {seatIndex + 1} · {seat.isBot ? "Computer" : "Human"}
        </p>
      </div>
      <span
        className={`rounded border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[.14em] ${tagTone}`}
      >
        {tag}
      </span>
    </div>
  );
}
