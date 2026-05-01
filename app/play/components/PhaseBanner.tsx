"use client";

/**
 * Phase strip — the second band on the dashboard, immediately below the
 * top bar. Visualises the three round phases (Fees / Action / Market), the
 * step the table is on, and (when the action phase is active) inlines the
 * cost ladder that previews the next paid action's tier.
 *
 * Spec: design_handoff_bourbon_blend/README.md §PhaseStrip.
 *
 * The component reads `state.actionPhase.freeWindowActive` and
 * `state.actionPhase.paidLapTier` to decide which cost tier is "next":
 *
 *   freeWindowActive=true                         → paid=0 (FREE upcoming)
 *   freeWindowActive=false, paidLapTier=1         → paid=1 ($1 upcoming, FREE spent)
 *   freeWindowActive=false, paidLapTier=2         → paid=2 ($2 upcoming, FREE+$1 spent)
 *   freeWindowActive=false, paidLapTier>=3        → paid=3 ($3+ upcoming, all earlier spent)
 */

import { feesForPlayer } from "@/lib/rules/fees";
import { useGameStore } from "@/lib/store/gameStore";

const PHASES = [
  { k: "fees", l: "Fees" },
  { k: "action", l: "Action" },
  { k: "market", l: "Market" },
] as const;

const COST_TIERS = ["FREE", "$1", "$2", "$3+"] as const;

export default function PhaseBanner() {
  const state = useGameStore((s) => s.state)!;

  // Game-over has its own panel; no phase strip in that state.
  if (state.phase === "gameover") return null;

  const currentIndex = PHASES.findIndex((p) => p.k === state.phase);
  const paid = state.actionPhase.freeWindowActive
    ? 0
    : Math.min(state.actionPhase.paidLapTier, COST_TIERS.length - 1);

  // Accumulated fees inline under the Fees cell.
  const humanId = state.playerOrder.find((id) => state.players[id].kind === "human");
  const humanFees = humanId ? feesForPlayer(state, humanId) : [];
  const totalOwed = humanFees.reduce((n, f) => n + f.amount, 0);
  const aged = humanId
    ? humanFees.filter((f) =>
        state.feesPhase.paidBarrelIds.includes(f.barrelId),
      ).length
    : 0;
  // Round 1 has no fees at all (rules skip Phase 1). Show nothing in that case.
  const hasFeesThisRound = state.round > 1 && humanFees.length > 0;

  return (
    <div
      className="flex overflow-hidden rounded-lg border border-slate-800 bg-slate-900"
      role="navigation"
      aria-label="Round phases"
    >
      {PHASES.map((p, i) => {
        const active = p.k === state.phase;
        const past = currentIndex > i;
        const isAction = p.k === "action";
        const isFees = p.k === "fees";
        const expandActive = active && isAction;
        // Show fees breakdown inline on the Fees cell when there are fees
        // in play this round. Doesn't matter whether the cell is active or
        // past — once Phase 1 has run, the player wants to see what they
        // paid / owe.
        const showFeesInline = isFees && hasFeesThisRound;
        return (
          <div
            key={p.k}
            className={[
              "flex min-w-0 items-center gap-2.5 px-3.5 py-2.5",
              expandActive ? "flex-[3]" : "flex-1",
              i < PHASES.length - 1 ? "border-r border-slate-800" : "",
              active ? "bg-amber-700/[0.18]" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-current={active ? "step" : undefined}
          >
            {/* Step indicator (circle) */}
            <span
              className={[
                "grid h-[22px] w-[22px] flex-shrink-0 place-items-center rounded-full font-mono text-[10px] font-bold leading-none",
                active
                  ? "bg-amber-500 text-slate-950"
                  : past
                    ? "bg-slate-700 text-slate-300"
                    : "border-[1.5px] border-slate-700 text-slate-400",
              ].join(" ")}
              aria-hidden
            >
              {past ? "✓" : i + 1}
            </span>

            {/* Phase label */}
            <span
              className={[
                "flex-shrink-0 text-[13px]",
                active
                  ? "font-semibold text-amber-100"
                  : past
                    ? "font-medium text-slate-300"
                    : "font-medium text-slate-500",
              ].join(" ")}
            >
              {p.l}
            </span>

            {/* Inline fees summary on the Fees cell. */}
            {showFeesInline ? (
              <FeesSummary
                active={active}
                totalOwed={totalOwed}
                aged={aged}
                totalBarrels={humanFees.length}
              />
            ) : null}

            {/* Action-cell-only inline ladder */}
            {expandActive && (
              <>
                <span
                  className="ml-1.5 mr-1 h-[18px] w-px bg-amber-700 opacity-50"
                  aria-hidden
                />
                <span className="font-mono text-[10px] uppercase tracking-[.12em] text-slate-500">
                  next costs
                </span>
                <div className="flex items-center gap-1">
                  {COST_TIERS.map((label, idx) => (
                    <CostChip
                      key={label}
                      label={label}
                      caret={idx > 0}
                      state={
                        idx === paid ? "next" : idx < paid ? "spent" : "future"
                      }
                    />
                  ))}
                </div>
                <span className="flex-1" />
                <span className="font-mono text-[10px] uppercase tracking-[.12em] text-slate-500">
                  tap a pile to act
                </span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Compact summary of the human player's accumulated rent for the round.
 * Active (Phase 1 in progress): shows "$N owed across M barrels".
 * Past (Phase 2 / 3): shows "$N paid · K aged" (K = how many barrels were
 * paid for and gained an age token).
 */
function FeesSummary({
  active,
  totalOwed,
  aged,
  totalBarrels,
}: {
  active: boolean;
  totalOwed: number;
  aged: number;
  totalBarrels: number;
}) {
  if (active) {
    return (
      <span
        className="ml-1 truncate font-mono text-[10px] uppercase tracking-[.12em] text-amber-200"
        title={`$${totalOwed} owed across ${totalBarrels} barrel${totalBarrels === 1 ? "" : "s"}`}
      >
        ${totalOwed} owed
      </span>
    );
  }
  // Past — already resolved this round.
  return (
    <span
      className="ml-1 truncate font-mono text-[10px] uppercase tracking-[.12em] text-slate-500"
      title={`${aged} of ${totalBarrels} barrel${totalBarrels === 1 ? "" : "s"} aged this round`}
    >
      {aged}/{totalBarrels} aged
    </span>
  );
}

function CostChip({
  label,
  caret,
  state,
}: {
  label: string;
  caret: boolean;
  state: "next" | "spent" | "future";
}) {
  const cls =
    state === "next"
      ? "border-amber-500 bg-amber-500 text-slate-950 shadow-[0_0_0_3px_rgba(245,158,11,.18)]"
      : state === "spent"
        ? "border-slate-700 bg-slate-800 text-slate-500 line-through"
        : "border-slate-700 bg-transparent text-slate-300";
  return (
    <>
      {caret && (
        <span className="font-mono text-[11px] text-slate-600" aria-hidden>
          ›
        </span>
      )}
      <span
        className={`rounded border px-2 py-[3px] font-mono text-[10px] font-bold leading-none ${cls}`}
      >
        {label}
      </span>
    </>
  );
}
