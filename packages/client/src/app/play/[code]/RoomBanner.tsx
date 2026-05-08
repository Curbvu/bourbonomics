"use client";

/**
 * Banner above the GameBoard when bound to a multi-player room.
 * Shows the room code, click-to-copy share link, live connection
 * status, the per-seat roster (open seats / claimed names / bots),
 * and a leave action. The visiting player can click an open seat
 * pill to claim it; once claimed, the rep + game UI below works as
 * usual.
 */

import { useState } from "react";
import { useGameStore } from "@/lib/store/game";
import type { SeatInfo } from "@/lib/store/socket";

export default function RoomBanner({ code }: { code: string }) {
  const {
    state,
    multiplayerStatus,
    multiplayerMode,
    roster,
    claimSeat,
    releaseSeat,
    leaveMultiplayer,
  } = useGameStore();
  const [copied, setCopied] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);

  const onCopy = async () => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/play/${code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copy this URL:", url);
    }
  };

  const onClaim = async (seat: SeatInfo) => {
    setClaiming(seat.playerId);
    setClaimError(null);
    try {
      await claimSeat(seat.playerId);
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : "Failed to claim seat.");
    } finally {
      setClaiming(null);
    }
  };

  const myPlayerId = multiplayerMode?.playerId ?? "";

  // Surface "waiting on a human who hasn't claimed yet" so the room
  // doesn't feel stuck. Reads the engine's currentPlayerIndex against
  // the roster to find the on-clock seat.
  const waitingForUnclaimedSeat = (() => {
    if (!state || state.phase !== "action") return null;
    const onClock = state.players[state.currentPlayerIndex];
    if (!onClock) return null;
    if (onClock.isBot) return null;
    if (onClock.id === myPlayerId) return null; // it's your turn
    const seat = roster.find((s) => s.playerId === onClock.id);
    if (!seat || seat.claimedBy) return null;
    return seat;
  })();

  return (
    <div className="border-b border-amber-800/40 bg-gradient-to-r from-amber-950/40 via-slate-950 to-rose-950/30 px-[18px] py-1.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-rose-300">
          Room
        </span>
        <span className="font-display text-xl font-bold tabular-nums tracking-[0.2em] text-amber-200">
          {code}
        </span>
        <button
          type="button"
          onClick={onCopy}
          className="rounded border border-amber-500/60 bg-amber-900/30 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[.14em] text-amber-200 transition-colors hover:border-amber-300 hover:bg-amber-800/40"
        >
          {copied ? "copied!" : "copy share link"}
        </button>
        <StatusPill status={multiplayerStatus} />
        <span className="flex-1" />
        {myPlayerId ? (
          <button
            type="button"
            onClick={releaseSeat}
            className="font-mono text-[10px] uppercase tracking-[.14em] text-slate-400 hover:text-rose-300"
            title="Drop your seat — opens it back up for someone else to claim."
          >
            release seat
          </button>
        ) : null}
        <button
          type="button"
          onClick={leaveMultiplayer}
          className="font-mono text-[10px] uppercase tracking-[.14em] text-slate-400 hover:text-rose-300"
        >
          leave
        </button>
      </div>

      {/* Roster strip — one chip per seat. Open seats are clickable
          when this connection has no seat yet. */}
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        {roster.map((seat) => (
          <SeatChip
            key={seat.playerId}
            seat={seat}
            mine={seat.playerId === myPlayerId}
            canClaim={!myPlayerId && !seat.isBot && !seat.claimedBy}
            claiming={claiming === seat.playerId}
            onClaim={() => onClaim(seat)}
          />
        ))}
      </div>

      {waitingForUnclaimedSeat ? (
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[.14em] text-amber-300">
          ⏳ Waiting on{" "}
          <span className="font-bold">{waitingForUnclaimedSeat.name}</span>{" "}
          — share the room link to fill the seat.
        </p>
      ) : null}

      {claimError ? (
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[.14em] text-rose-300">
          {claimError}
        </p>
      ) : null}
    </div>
  );
}

function SeatChip({
  seat,
  mine,
  canClaim,
  claiming,
  onClaim,
}: {
  seat: SeatInfo;
  mine: boolean;
  canClaim: boolean;
  claiming: boolean;
  onClaim: () => void;
}) {
  const tone = seat.isBot
    ? "border-slate-600 bg-slate-900/60 text-slate-300"
    : seat.claimedBy
      ? mine
        ? "border-emerald-400 bg-emerald-900/40 text-emerald-100"
        : "border-amber-500/70 bg-amber-900/30 text-amber-100"
      : "border-rose-500/60 bg-rose-950/40 text-rose-200";

  const label = seat.isBot
    ? `${seat.name} · bot`
    : seat.claimedBy
      ? mine
        ? `${seat.claimedBy} · you`
        : seat.claimedBy
      : "open seat";

  if (canClaim) {
    return (
      <button
        type="button"
        onClick={onClaim}
        disabled={claiming}
        className={`rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[.14em] transition-colors hover:bg-rose-900/50 disabled:opacity-50 ${tone}`}
      >
        {claiming ? "claiming…" : `claim ${label}`}
      </button>
    );
  }
  return (
    <span
      className={`rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[.14em] ${tone}`}
    >
      {label}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "open"
      ? "border-emerald-500/70 text-emerald-300"
      : status === "connecting"
        ? "border-amber-500/70 text-amber-300"
        : status === "closed" || status === "error"
          ? "border-rose-500/70 text-rose-300"
          : "border-slate-600 text-slate-400";
  return (
    <span
      className={`rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[.14em] ${tone}`}
    >
      {status}
    </span>
  );
}
