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
              "flex min-w-0 items-center gap-3 px-4 py-2",
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
                "grid h-[30px] w-[30px] flex-shrink-0 place-items-center rounded-full font-mono text-[13px] font-bold leading-none",
                active
                  ? "bg-amber-500 text-slate-950"
                  : past
                    ? "bg-slate-700 text-slate-300"
                    : "border-2 border-slate-700 text-slate-400",
              ].join(" ")}
              aria-hidden
            >
              {past ? "✓" : i + 1}
            </span>

            {/* Phase label */}
            <span
              className={[
                "flex-shrink-0 text-[17px]",
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
                  className="ml-2 mr-1 h-[24px] w-px bg-amber-700 opacity-50"
                  aria-hidden
                />
                <span className="font-mono text-[12px] uppercase tracking-[.14em] text-slate-400">
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
                    centrepiece of the action phase. 12 discrete cells
                    fill across a blue→amber gradient as demand rises. */}
                <span
                  className="ml-3 mr-1 h-[24px] w-px bg-amber-700 opacity-50"
                  aria-hidden
                />
                <DemandBar value={state.demand} />
                <span className="flex-1" />
                <span className="font-mono text-[12px] uppercase tracking-[.14em] text-slate-400">
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
        className="ml-1 truncate font-mono text-[12px] uppercase tracking-[.14em] text-amber-200"
        title={`$${totalOwed} owed across ${totalBarrels} barrel${totalBarrels === 1 ? "" : "s"}`}
      >
        ${totalOwed} owed
      </span>
    );
  }
  // Past — already resolved this round.
  return (
    <span
      className="ml-1 truncate font-mono text-[12px] uppercase tracking-[.14em] text-slate-400"
      title={`${aged} of ${totalBarrels} barrel${totalBarrels === 1 ? "" : "s"} aged this round`}
    >
      {aged}/{totalBarrels} aged
    </span>
  );
}

/**
 * Demand readout — 12 discrete slot cells, each painted with a colour
 * sampled from a continuous **blue → amber** ramp so the fill goes
 * cool at low demand and bourbon-warm at high demand. Inactive
 * (above-current) cells stay slate.
 *
 * Sits inline in the action sub-bar next to the cost ladder, where
 * strategic decisions actually happen — replaces the standalone
 * Demand block that used to live at the top of MarketPanel.
 */
function DemandBar({ value }: { value: number }) {
  // Discrete 12-step blue→amber ramp. Each cell index `i` (0..11)
  // gets its own colour; the player perceives a smooth gradient
  // across the row even though the cells are individually filled.
  // Endpoints: sky-400 (cool low) → amber-400 (bourbon high).
  const cellColor = (i: number) => {
    const t = i / 11; // 0..1
    // sky-400  rgb(56,189,248) → amber-400 rgb(251,191,36)
    const r = Math.round(56 + (251 - 56) * t);
    const g = Math.round(189 + (191 - 189) * t);
    const b = Math.round(248 + (36 - 248) * t);
    return `rgb(${r}, ${g}, ${b})`;
  };
  const valueClass =
    value >= 9
      ? "text-amber-300"
      : value >= 6
        ? "text-amber-200"
        : value >= 3
          ? "text-sky-300"
          : "text-slate-400";
  return (
    <div
      className="flex min-w-[320px] items-center gap-3"
      title={`Market demand ${value} of 12`}
    >
      <span className="font-mono text-[12px] uppercase tracking-[.14em] text-slate-400">
        demand
      </span>
      <div className="flex flex-1 gap-[4px]" aria-hidden>
        {Array.from({ length: 12 }).map((_, i) => {
          const cellNum = i + 1;
          const active = cellNum <= value;
          return (
            <div
              key={i}
              className={[
                "h-[22px] flex-1 rounded-[4px] border transition-colors duration-200",
                active
                  ? "text-slate-950"
                  : "border-slate-800 bg-slate-900",
              ].join(" ")}
              style={
                active
                  ? {
                      backgroundColor: cellColor(i),
                      borderColor: cellColor(i),
                    }
                  : undefined
              }
            />
          );
        })}
      </div>
      <span
        className={`font-mono text-[16px] font-bold tabular-nums ${valueClass}`}
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
            "font-mono text-[14px] transition-colors",
            escalating ? "text-rose-400" : "text-slate-600",
          ].join(" ")}
          aria-hidden
        >
          ›
        </span>
      )}
      <span
        className={`rounded-md border px-2.5 py-[5px] font-mono text-[13px] font-bold leading-none transition-colors duration-300 ${cls}`}
      >
        {label}
      </span>
    </>
  );
}
