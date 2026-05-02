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

export default function PhaseBanner({
  subBar = false,
}: {
  /**
   * When true, render flush as a sub-bar inside GameTopBar — no outer
   * border, no rounded corners, transparent backdrop. The default
   * (false) keeps the original card chrome for any standalone usage.
   */
  subBar?: boolean;
}) {
  const state = useGameStore((s) => s.state)!;

  // Game-over has its own panel; no phase strip in that state.
  if (state.phase === "gameover") return null;

  const currentIndex = PHASES.findIndex((p) => p.k === state.phase);
  const rawTier = state.actionPhase.freeWindowActive
    ? 0
    : state.actionPhase.paidLapTier;
  const paid = Math.min(rawTier, COST_TIERS.length - 1);
  // Once we cross the $3+ chip, the ladder visually "runs out". Surface the
  // overshoot — actual dollar amount of the current tier, plus how many laps
  // past the cap we are — so the escalation reads at a glance.
  const escalating = rawTier >= 3;
  const escalationOvershoot = Math.max(0, rawTier - 3);
  const dynamicLastLabel =
    escalating && rawTier > 3 ? `$${rawTier}` : "$3+";

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
      className={
        subBar
          ? "flex overflow-hidden rounded-md border border-slate-800/60 bg-slate-900/40"
          : "flex overflow-hidden rounded-lg border border-slate-800 bg-slate-900"
      }
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
                  {COST_TIERS.map((label, idx) => {
                    const isLast = idx === COST_TIERS.length - 1;
                    const chipLabel = isLast ? dynamicLastLabel : label;
                    const chipState =
                      idx === paid ? "next" : idx < paid ? "spent" : "future";
                    return (
                      <CostChip
                        key={label}
                        label={chipLabel}
                        caret={idx > 0}
                        state={chipState}
                        escalating={isLast && escalating && chipState === "next"}
                      />
                    );
                  })}
                  {escalationOvershoot > 0 ? (
                    <span
                      className="ml-1 inline-flex animate-pulse items-center gap-0.5 rounded-full border border-rose-500/70 bg-rose-700/[0.30] px-1.5 py-px font-mono text-[9px] font-bold uppercase tracking-[.10em] text-rose-100"
                      title={`Lap tier has overrun the $3+ cap by ${escalationOvershoot} ${escalationOvershoot === 1 ? "lap" : "laps"} — every action this lap costs $${rawTier}`}
                    >
                      <span aria-hidden>↑</span>
                      <span>+{escalationOvershoot}</span>
                    </span>
                  ) : null}
                </div>
                {/* Demand lives in the action sub-bar — the strategic
                    centrepiece of the action phase. Smooth gradient bar
                    with a live marker so the player can read where the
                    market is at a glance. */}
                <span
                  className="ml-3 mr-1 h-[18px] w-px bg-amber-700 opacity-50"
                  aria-hidden
                />
                <DemandBar value={state.demand} />
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

/**
 * Smooth-gradient demand readout for the action sub-bar. Renders a
 * single bar tinted with a continuous slate→emerald→amber→rose ramp
 * (cool when low, hot when high), filled to the current demand
 * percentage, with a marker at the live value and a tiny "N/12" label.
 *
 * Replaces the previous chunky 12-cell strip in MarketPanel — same
 * data, much less visual noise, and now sits inline with the cost
 * ladder where strategic decisions actually happen.
 */
function DemandBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, (value / 12) * 100));
  // Same cool→warm→hot ramp colour-wise the player will recognise from
  // the old 3-band chunks, but as one smooth gradient so the
  // transition between bands isn't visually quantised.
  const ramp =
    "linear-gradient(90deg, rgb(71,85,105) 0%, rgb(16,185,129) 25%, rgb(245,158,11) 60%, rgb(244,63,94) 100%)";
  const valueClass =
    value >= 9
      ? "text-rose-400"
      : value >= 6
        ? "text-amber-300"
        : value >= 3
          ? "text-emerald-300"
          : "text-slate-300";
  return (
    <div
      className="flex min-w-[180px] items-center gap-2"
      title={`Market demand ${value} of 12`}
    >
      <span className="font-mono text-[10px] uppercase tracking-[.12em] text-slate-500">
        demand
      </span>
      <div
        className="relative h-[10px] flex-1 overflow-hidden rounded-full border border-slate-700 bg-slate-900/80"
        aria-hidden
      >
        {/* Filled portion — gradient is fixed across the full track,
            we just clip with width so the colour at the leading edge
            tracks the value. */}
        <div
          className="h-full"
          style={{ width: `${pct}%`, background: ramp }}
        />
        {/* Live marker at the value — small white tick. */}
        <div
          className="absolute top-1/2 h-[14px] w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-sm bg-white/90 shadow-[0_0_6px_rgba(255,255,255,.7)]"
          style={{ left: `${pct}%` }}
        />
      </div>
      <span
        className={`font-mono text-[12px] font-bold tabular-nums ${valueClass}`}
      >
        {value}/12
      </span>
    </div>
  );
}

function CostChip({
  label,
  caret,
  state,
  escalating = false,
}: {
  label: string;
  caret: boolean;
  state: "next" | "spent" | "future";
  /**
   * When true and state === "next", the chip is the live "$3+" cap and
   * the lap tier has met or exceeded $3 — render in rose with an
   * animated escalation glow so the player sees costs running away.
   */
  escalating?: boolean;
}) {
  const cls =
    state === "next" && escalating
      ? "border-rose-500 bg-rose-500 text-slate-950 shadow-[0_0_0_3px_rgba(244,63,94,.25)] animate-[escalate_1.2s_ease-in-out_infinite] motion-reduce:animate-none"
      : state === "next"
        ? "border-amber-500 bg-amber-500 text-slate-950 shadow-[0_0_0_3px_rgba(245,158,11,.18)] transition-shadow duration-300"
        : state === "spent"
          ? "border-slate-700 bg-slate-800 text-slate-500 line-through"
          : "border-slate-700 bg-transparent text-slate-300";
  return (
    <>
      {caret && (
        <span
          className={[
            "font-mono text-[11px] transition-colors",
            escalating ? "text-rose-400" : "text-slate-600",
          ].join(" ")}
          aria-hidden
        >
          ›
        </span>
      )}
      <span
        className={`rounded border px-2 py-[3px] font-mono text-[10px] font-bold leading-none transition-colors duration-300 ${cls}`}
      >
        {label}
      </span>
    </>
  );
}
