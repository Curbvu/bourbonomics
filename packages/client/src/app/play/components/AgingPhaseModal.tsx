"use client";

/**
 * AgingPhaseModal — one-shot intro for the per-turn aging window.
 *
 * The engine forces aging via the `needsAgeBarrels` flag on the local
 * seat. Before the (now buttonless) picker takes over, this modal
 * explains the phase and primes the user to pick card → barrel.
 *
 * Renders only on the first render after the aging window opens.
 * "Begin aging" marks the intro seen, so subsequent picks happen
 * against the board with just the AgeOverlay banner for chrome.
 */

import { useGameStore } from "@/lib/store/game";

export default function AgingPhaseModal() {
  const {
    state,
    multiplayerMode,
    ageIntroSeen,
    ageTotalThisPhase,
    markAgeIntroSeen,
  } = useGameStore();

  if (!state) return null;
  if (state.phase !== "action") return null;
  if (ageIntroSeen) return null;

  const seatId = multiplayerMode
    ? multiplayerMode.playerId
    : state.players.find((p) => !p.isBot)?.id;
  if (!seatId) return null;
  const me = state.players.find((p) => p.id === seatId);
  if (!me) return null;
  if (state.players[state.currentPlayerIndex]?.id !== seatId) return null;
  if (!me.needsAgeBarrels) return null;
  if (me.needsDemandRoll) return null; // demand modal still owns the screen

  const total = ageTotalThisPhase ?? 0;
  const barrelWord = total === 1 ? "barrel" : "barrels";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Aging phase — review and begin"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-6 backdrop-blur animate-bb-spot-fade"
    >
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(251,191,36,0.28) 0%, transparent 65%)",
        }}
      />

      <div className="relative flex max-w-[560px] flex-col items-center gap-5 text-center">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[.18em] text-amber-300">
            Aging Phase
          </div>
          <div className="mt-1 font-display text-3xl font-semibold text-amber-100">
            Age Your Barrels
          </div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[.14em] text-slate-400">
            {me.name} ·{" "}
            <span className="text-amber-200">
              {total} {barrelWord} to age
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-amber-700/40 bg-slate-950/60 px-5 py-4 text-left">
          <ol className="space-y-2 font-mono text-[12px] leading-snug text-slate-200">
            <li>
              <span className="mr-2 font-bold text-amber-300">1.</span>
              Pick any card from your hand.
            </li>
            <li>
              <span className="mr-2 font-bold text-amber-300">2.</span>
              Click an ageable barrel in your rickhouse — it commits
              instantly.
            </li>
            <li>
              <span className="mr-2 font-bold text-amber-300">3.</span>
              Repeat until every eligible barrel has aged this round.
            </li>
          </ol>
          <p className="mt-3 font-mono text-[10.5px] italic leading-snug text-slate-400">
            You can cancel mid-phase to pass your turn. Bourbon doesn't
            sleep.
          </p>
        </div>

        <button
          type="button"
          onClick={markAgeIntroSeen}
          className="rounded-md border border-amber-400 bg-gradient-to-b from-amber-300 to-amber-500 px-6 py-2 font-sans text-sm font-bold uppercase tracking-[.05em] text-slate-950 shadow-[0_0_0_3px_rgba(251,191,36,0.30),inset_0_1px_0_rgba(255,255,255,0.25)] transition-all hover:from-amber-200 hover:to-amber-400"
        >
          Begin aging ↵
        </button>
      </div>
    </div>
  );
}
