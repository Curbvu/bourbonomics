"use client";

/**
 * Between-rounds interstitial — fires at the top of every round AFTER
 * round 1 to mark the year passing, recap the round that just ended,
 * and preview the upcoming turn order.
 *
 * Stack order: this modal sits at z-55, above DrawPhaseModal (z-50).
 * Both render on `phase === "draw"`. The player reads the recap, hits
 * Continue, this modal returns null, and DrawPhaseModal underneath
 * becomes interactive — no coordination state needed beyond a per-round
 * "I've seen this" guard.
 *
 * Skipped on round 1 (no previous round to summarize), in autoplay,
 * and for any seat that doesn't have a human attached (bots auto-step
 * straight through draw).
 */

import { useEffect, useState } from "react";

import type { GameAction, GameState } from "@bourbonomics/engine";
import { useGameStore, type LogEntry } from "@/lib/store/game";
import PlayerSwatch from "./PlayerSwatch";

interface PlayerRoundSummary {
  playerId: string;
  name: string;
  seatIndex: number;
  logoId: string | null | undefined;
  barrelsSold: number;
  repGained: number;
  totalRep: number;
}

interface RoundSummary {
  prevRound: number;
  demandStart: number;
  demandEnd: number;
  demandRises: number;
  demandHolds: number;
  perPlayer: PlayerRoundSummary[];
}

function summarizeRound(
  state: GameState,
  log: LogEntry[],
  seatMeta: { id: string; logoId?: string }[],
  prevRound: number,
): RoundSummary {
  const prevRolls = state.demandRolls.filter((r) => r.round === prevRound);
  const demandRises = prevRolls.filter((r) => r.result === "rise").length;
  const demandHolds = prevRolls.filter((r) => r.result === "hold").length;

  // Reconstruct demand at the start of prevRound by walking the rolls
  // forward from a known anchor. We don't snapshot demand per round, so
  // approximate: demandStart = demandEnd - rises + sales (rough), since
  // each sale drops demand by 1 and each rise lifts it by 1. Floor at 0.
  // Sales come from the prevRound log; ignore Demand Surge / ops cards
  // that suppress the drop — a perfect recap would need engine-side
  // snapshots, which is a larger change.
  const prevLog = log.filter((entry) => entry.round === prevRound);
  const sales = prevLog.filter((entry) => entry.action.type === "SELL_BOURBON");
  const demandEnd = state.demand;
  const demandStart = Math.max(
    0,
    Math.min(12, demandEnd - demandRises + sales.length),
  );

  // SELL_BOURBON no longer carries the rep total in its
  // payload. We count barrels sold from the action log and report 0
  // repGained for the per-round delta — the recap chip will show
  // sales count but not the exact rep delta until the engine
  // surfaces it on a future state snapshot.
  const perPlayer: PlayerRoundSummary[] = state.players.map((p, seatIndex) => {
    const meta = seatMeta.find((m) => m.id === p.id);
    let barrelsSold = 0;
    const repGained = 0;
    for (const entry of prevLog) {
      const a = entry.action as GameAction;
      if (a.type === "SELL_BOURBON" && a.playerId === p.id) {
        barrelsSold += 1;
      }
    }
    return {
      playerId: p.id,
      name: p.name,
      seatIndex,
      logoId: meta?.logoId,
      barrelsSold,
      repGained,
      totalRep: p.reputation,
    };
  });

  return {
    prevRound,
    demandStart,
    demandEnd,
    demandRises,
    demandHolds,
    perPlayer,
  };
}

export default function YearPassModal() {
  const { state, autoplay, humanSeatPlayerId, log, seatMeta } = useGameStore();
  const [dismissedRound, setDismissedRound] = useState<number | null>(null);

  // Reset the dismissal guard whenever the round actually changes —
  // otherwise dismissing on round 4 would auto-dismiss round 5.
  const round = state?.round ?? 0;
  useEffect(() => {
    if (dismissedRound != null && dismissedRound !== round) {
      setDismissedRound(null);
    }
  }, [round, dismissedRound]);

  // Compute visibility BEFORE the early returns so the keyboard effect
  // can gate on the same condition. Avoids attaching a global keydown
  // listener when the modal isn't even on screen.
  const human = state?.players.find((p) => p.id === humanSeatPlayerId);
  const isVisible = Boolean(
    state &&
      state.phase === "draw" &&
      state.round > 1 &&
      !autoplay &&
      humanSeatPlayerId &&
      human &&
      !state.playerIdsCompletedPhase.includes(human.id) &&
      dismissedRound !== state.round,
  );

  // Keyboard: Enter / Space dismisses, matching the other phase modals'
  // ↵ affordance. Only attach while the modal is showing — otherwise
  // we'd intercept Enter on every page (including focused buttons in
  // other modals, which would dispatch them AND dismiss us at once).
  // preventDefault / stopPropagation so a focused "Draw cards" button
  // underneath doesn't fire from the same keypress.
  useEffect(() => {
    if (!isVisible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        if (state) setDismissedRound(state.round);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [isVisible, state]);

  if (!isVisible || !state || !human) return null;

  const summary = summarizeRound(state, log, seatMeta, state.round - 1);

  // Turn order for the upcoming round — walk forward from the engine's
  // already-rotated startPlayerIndex. README's worked example: 4-player
  // game runs 1234 → 4123 → 3412 → 2341 → 1234 (CCW each round).
  const n = state.players.length;
  const turnOrder = Array.from({ length: n }, (_, i) => {
    const idx = (state.startPlayerIndex + i) % n;
    const player = state.players[idx]!;
    const meta = seatMeta.find((m) => m.id === player.id);
    return { player, seatIndex: idx, logoId: meta?.logoId };
  });

  const demandDelta = summary.demandEnd - summary.demandStart;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Year ${state.round} begins`}
      className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-950/85 p-6 backdrop-blur"
    >
      {/* Soft amber glow behind the year headline. */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[480px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(180,83,9,0.30) 0%, transparent 65%)",
        }}
      />

      <div className="relative flex w-full max-w-2xl flex-col items-stretch gap-6">
        {/* Headline. */}
        <div className="text-center">
          <div className="font-mono text-[11px] uppercase tracking-[.20em] text-amber-300">
            A new year begins
          </div>
          <h1 className="mt-1 font-display text-6xl font-bold tracking-tight text-amber-100 drop-shadow-[0_3px_12px_rgba(0,0,0,.6)]">
            Year {state.round}
          </h1>
        </div>

        {/* Last-round recap. */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 shadow-[0_8px_32px_rgba(0,0,0,.45)]">
          <div className="flex items-baseline justify-between">
            <div className="font-mono text-[10px] uppercase tracking-[.18em] text-slate-400">
              Round {summary.prevRound} recap
            </div>
            <DemandSummary
              start={summary.demandStart}
              end={summary.demandEnd}
              delta={demandDelta}
              rises={summary.demandRises}
              holds={summary.demandHolds}
            />
          </div>

          <div className="mt-3 grid gap-2">
            {summary.perPlayer.map((p) => (
              <PlayerRecapRow key={p.playerId} summary={p} />
            ))}
          </div>
        </section>

        {/* Turn order for the upcoming round. */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 shadow-[0_8px_32px_rgba(0,0,0,.45)]">
          <div className="font-mono text-[10px] uppercase tracking-[.18em] text-slate-400">
            Turn order · Round {state.round}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {turnOrder.map((t, i) => (
              <TurnOrderChip
                key={t.player.id}
                seatIndex={t.seatIndex}
                logoId={t.logoId}
                name={t.player.name}
                position={i + 1}
                isStart={i === 0}
                isHuman={t.player.id === humanSeatPlayerId}
              />
            ))}
          </div>
          <div className="mt-2 font-mono text-[9px] uppercase tracking-[.14em] text-slate-500">
            Last round&apos;s closer opens this one — the bookend rule.
          </div>
        </section>

        {/* Dismiss. */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setDismissedRound(state.round)}
            className="rounded-md border border-amber-400 bg-gradient-to-b from-amber-300 to-amber-500 px-8 py-2.5 font-sans text-sm font-bold uppercase tracking-[.05em] text-slate-950 shadow-[0_0_0_3px_rgba(251,191,36,0.30),inset_0_1px_0_rgba(255,255,255,0.25)] transition hover:from-amber-200 hover:to-amber-400"
          >
            Begin year ↵
          </button>
        </div>
      </div>
    </div>
  );
}

function DemandSummary({
  start,
  end,
  delta,
  rises,
  holds,
}: {
  start: number;
  end: number;
  delta: number;
  rises: number;
  holds: number;
}) {
  const arrow = delta > 0 ? "↑" : delta < 0 ? "↓" : "·";
  const arrowColor =
    delta > 0
      ? "text-emerald-300"
      : delta < 0
        ? "text-rose-300"
        : "text-slate-500";
  return (
    <div
      title={`${rises} roll${rises === 1 ? "" : "s"} rose · ${holds} held`}
      className="flex items-baseline gap-1.5 font-mono text-[10px] uppercase tracking-[.10em] text-slate-400"
    >
      <span>demand</span>
      <span className="font-bold tabular-nums text-slate-200">{start}</span>
      <span className={`font-bold ${arrowColor}`}>{arrow}</span>
      <span className="font-bold tabular-nums text-amber-200">{end}</span>
      <span className="text-slate-500">
        · {rises}↑ {holds}·
      </span>
    </div>
  );
}

function PlayerRecapRow({ summary }: { summary: PlayerRoundSummary }) {
  const sold = summary.barrelsSold;
  const banked = summary.repGained;
  return (
    <div className="flex items-center gap-3 rounded-md border border-slate-800/80 bg-slate-950/40 px-3 py-2">
      <PlayerSwatch
        seatIndex={summary.seatIndex}
        logoId={summary.logoId}
        size="sm"
        ring={false}
      />
      <span className="flex-1 truncate font-display text-sm font-semibold text-slate-100">
        {summary.name}
      </span>
      {sold > 0 ? (
        <span className="font-mono text-[10px] uppercase tracking-[.10em] text-amber-200">
          sold {sold}
        </span>
      ) : (
        <span className="font-mono text-[10px] uppercase tracking-[.10em] text-slate-600">
          held
        </span>
      )}
      {banked > 0 ? (
        <span className="font-mono text-[10px] uppercase tracking-[.10em] text-emerald-300">
          +{banked} rep
        </span>
      ) : (
        <span className="font-mono text-[10px] uppercase tracking-[.10em] text-slate-700">
          +0
        </span>
      )}
      <span className="font-mono text-[11px] font-bold tabular-nums text-amber-300">
        {summary.totalRep}
      </span>
    </div>
  );
}

function TurnOrderChip({
  seatIndex,
  logoId,
  name,
  position,
  isStart,
  isHuman,
}: {
  seatIndex: number;
  logoId: string | null | undefined;
  name: string;
  position: number;
  isStart: boolean;
  isHuman: boolean;
}) {
  return (
    <span
      className={[
        "flex items-center gap-1.5 rounded border px-2 py-1 transition-colors",
        isStart
          ? "border-amber-500 bg-amber-700/[0.20] shadow-[0_0_0_1px_rgba(251,191,36,.35)]"
          : "border-slate-700 bg-slate-900/60",
      ].join(" ")}
    >
      <span
        className={[
          "grid h-4 w-4 place-items-center rounded-full font-mono text-[9px] font-bold leading-none",
          isStart
            ? "bg-amber-400 text-slate-950"
            : "bg-slate-800 text-slate-400",
        ].join(" ")}
        aria-hidden
      >
        {position}
      </span>
      <PlayerSwatch
        seatIndex={seatIndex}
        logoId={logoId}
        size="xs"
        ring={false}
      />
      <span
        className={[
          "font-mono text-[10px] uppercase tracking-[.08em]",
          isStart ? "text-amber-100" : "text-slate-300",
        ].join(" ")}
      >
        {name}
      </span>
      {isHuman ? (
        <span className="font-mono text-[8px] uppercase tracking-[.10em] text-slate-500">
          you
        </span>
      ) : null}
    </span>
  );
}
