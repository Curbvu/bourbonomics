"use client";

/**
 * v3 "Distillery-first" top bar.
 *
 * Three-cluster header: brand block (left), phase pip row (center),
 * bourbon chip + Step/Auto/Quit (right). Reputation moved off the
 * top bar — the human's rep lives in DistilleryStage and opponent
 * rep lives in OpponentRail under the new layout. Demand moved
 * off the top bar too — it's now the vertical thermometer column
 * between the Rivals rail and the Stage area (DemandThermometer).
 *
 * Phase pips:
 *   - Past phases: slate fill, check icon, mute label.
 *   - Current phase: brass gradient fill (animated via `pip-pulse`),
 *     index number in ink-dark, gold label.
 *   - Future phases: outline only.
 *
 * Bourbon chip:
 *   - Pill with brass border + warm gradient fill. Shows the bourbon
 *     deck count (the doomsday clock).
 *
 * Preserves `data-bb-zone="supply-counter"` for tutorial spotlight
 * anchors. (`data-bb-zone="demand"` now lives on DemandThermometer.)
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import type { GamePhase, GameState } from "@bourbonomics/engine";
import { useGameStore } from "@/lib/store/game";

type DisplayPhase = "draw" | "age" | "action" | "cleanup";

const PHASES: { k: DisplayPhase; l: string }[] = [
  { k: "draw", l: "Draw" },
  { k: "age", l: "Age" },
  { k: "action", l: "Action" },
  { k: "cleanup", l: "Cleanup" },
];

/**
 * v3.1: the engine no longer has a dedicated "age" phase — the per-turn
 * aging commit lives inside the action phase, gated by the active
 * player's `needsAgeBarrels` (and `needsDemandRoll` before it). Stay on
 * "Age" while either of those gates is open so the chip reflects what
 * the player is actually doing.
 */
function visiblePhase(state: GameState): DisplayPhase | null {
  switch (state.phase) {
    case "draw":
      return "draw";
    case "action": {
      const current = state.players[state.currentPlayerIndex];
      if (current && (current.needsDemandRoll || current.needsAgeBarrels)) {
        return "age";
      }
      return "action";
    }
    case "cleanup":
      return "cleanup";
    default:
      return null;
  }
}

export default function GameTopBar() {
  const { state, autoplay, setAutoplay, step, clear } = useGameStore();
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  // The modal portals to document.body to escape ScalingHost's
  // `transform: scale(...)` containing block (otherwise the backdrop
  // anchors to the 1680px design canvas and leaves the rest of the
  // viewport uncovered). Mounted only after first client paint to
  // avoid SSR-side `document` access.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!confirmOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfirmOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmOpen]);

  if (!state) return null;

  const quit = () => {
    clear();
    setConfirmOpen(false);
    router.push("/");
  };

  const active = visiblePhase(state);
  const inSetup =
    state.phase === "distillery_selection" || state.phase === "starter_deck_draft";
  const showRoundChrome = state.phase !== "ended" && !inSetup && active != null;

  return (
    <header
      className="relative z-10 grid items-center gap-5 border-b border-[#3b2818] px-[18px] py-[10px]"
      style={{
        gridTemplateColumns: "auto 1fr auto",
        background: "linear-gradient(180deg, #15100a 0%, #0c0805 100%)",
        boxShadow:
          "0 1px 0 rgba(240,201,112,.10) inset, 0 4px 14px rgba(0,0,0,.5)",
      }}
    >
      {/* Brand block — brass tile + name + year/round */}
      <div className="flex items-center gap-3">
        <div
          aria-hidden
          className="grid h-[38px] w-[38px] place-items-center rounded-md font-display text-[22px] font-bold leading-none"
          style={{
            background:
              "radial-gradient(circle at 35% 30%, #f0c970, #b06a38 70%, #2a1a10)",
            color: "#1a120b",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,.25), 0 2px 6px rgba(0,0,0,.6)",
          }}
        >
          B
        </div>
        <div className="hidden flex-col leading-tight md:flex">
          <span className="font-display text-[22px] font-semibold tracking-[.01em] text-[#f0e3c8]">
            Bourbonomics
          </span>
          <span className="label-sm" style={{ color: "var(--brass)" }}>
            Year {state.round} · Round {state.round}
          </span>
        </div>
      </div>

      {/* Phase pip row (center) or setup banner */}
      {showRoundChrome ? (
        <PhaseStrip activeKey={active!} />
      ) : inSetup ? (
        <SetupBanner phase={state.phase as "distillery_selection" | "starter_deck_draft"} />
      ) : (
        <span aria-hidden />
      )}

      {/* Right cluster: bourbon + controls. Demand has moved to the
          vertical thermometer between the Rivals rail and the
          Stage area — see DemandThermometer.tsx. */}
      <div className="flex items-center gap-3">
        {showRoundChrome ? (
          <>
            <BourbonChip
              remaining={state.bourbonDeck.length}
              finalRound={state.finalRoundTriggered}
            />
          </>
        ) : null}

        <div className="flex gap-1.5">
          {showRoundChrome ? (
            <>
              <ChromeBtn onClick={step}>Step</ChromeBtn>
              <ChromeBtn
                onClick={() => setAutoplay(!autoplay)}
                tone={autoplay ? "active" : undefined}
              >
                {autoplay ? "Pause" : "Auto"}
              </ChromeBtn>
            </>
          ) : null}
          <ChromeBtn onClick={() => setConfirmOpen(true)} tone="danger">
            Quit
          </ChromeBtn>
        </div>
      </div>

      {confirmOpen && mounted
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Quit current game"
              className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 backdrop-blur-sm"
              onClick={() => setConfirmOpen(false)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setConfirmOpen(false);
              }}
            >
              <div
                role="document"
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md rounded-lg border border-rose-700 bg-slate-900 p-5 shadow-[0_8px_32px_rgba(0,0,0,.5)]"
              >
                <h2 className="font-display text-xl font-semibold text-amber-100">
                  Quit this game?
                </h2>
                <p className="mt-2 text-sm text-slate-300">
                  The current round-{state.round} match will be cleared from your
                  browser. The main menu will let you start fresh.
                </p>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmOpen(false)}
                    className="rounded border border-slate-700 bg-slate-900 px-3 py-1.5 font-mono text-[13px] font-semibold uppercase tracking-[.05em] text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={quit}
                    className="rounded-md border border-rose-700 bg-gradient-to-b from-rose-500 to-rose-700 px-3.5 py-1.5 font-sans text-xs font-bold uppercase tracking-[.05em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.2)] transition-colors hover:from-rose-400 hover:to-rose-600"
                  >
                    Quit game ↵
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </header>
  );
}

// -----------------------------
// Phase pip row
// -----------------------------

function PhaseStrip({ activeKey }: { activeKey: DisplayPhase }) {
  const activeIdx = PHASES.findIndex((p) => p.k === activeKey);
  return (
    <div className="flex items-center justify-center">
      <div
        className="flex items-center gap-0 rounded-[10px] border border-[#3b2818] px-2 py-1.5"
        style={{
          background:
            "linear-gradient(180deg, rgba(34,23,16,.9), rgba(22,15,10,.9))",
          boxShadow: "0 1px 0 rgba(240,201,112,.12) inset",
        }}
      >
        {PHASES.map((p, i) => {
          const isActive = i === activeIdx;
          const isPast = activeIdx > i;
          return (
            <div key={p.k} className="flex items-center">
              <PhasePip label={p.l} index={i + 1} isActive={isActive} isPast={isPast} />
              {i < PHASES.length - 1 ? (
                <span
                  className="mx-1 font-mono text-[var(--whisper)]"
                  aria-hidden
                >
                  —
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PhasePip({
  label,
  index,
  isActive,
  isPast,
}: {
  label: string;
  index: number;
  isActive: boolean;
  isPast: boolean;
}) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-[2px]"
      aria-current={isActive ? "step" : undefined}
    >
      <span
        className={["grid h-[18px] w-[18px] place-items-center rounded-full font-mono text-[12px] font-bold leading-none", isActive ? "pip-active" : ""].join(" ")}
        style={{
          background: isActive
            ? "linear-gradient(180deg,#f0c970,#c69d52)"
            : isPast
              ? "linear-gradient(180deg,#3a2818,#23170d)"
              : "transparent",
          color: isActive ? "#1a120b" : "var(--mute)",
          border: isActive ? "1px solid #f0c970" : "1px solid var(--rule)",
        }}
        aria-hidden
      >
        {isPast ? "✓" : index}
      </span>
      <span
        className="font-mono text-[12px] uppercase tracking-[.18em]"
        style={{
          color: isActive ? "var(--gold)" : "var(--mute)",
          fontWeight: isActive ? 700 : 500,
        }}
      >
        {label}
      </span>
    </div>
  );
}

function SetupBanner({ phase }: { phase: "distillery_selection" | "starter_deck_draft" }) {
  const label =
    phase === "distillery_selection"
      ? "Setup · pick your distillery"
      : "Setup · build your starter deck";
  return (
    <div className="flex flex-1 items-center justify-center font-mono text-[13px] uppercase tracking-[.18em] text-amber-300">
      {label}
    </div>
  );
}

// -----------------------------
// Bourbon chip (deck count = doomsday clock)
// -----------------------------

function BourbonChip({
  remaining,
  finalRound,
}: {
  remaining: number;
  finalRound: boolean;
}) {
  return (
    <div
      title="Bourbon deck remaining (the doomsday clock)"
      data-bb-zone="supply-counter"
      className={[
        "flex items-center gap-2 rounded-md border px-3 py-1.5",
        finalRound ? "border-[var(--gold)]" : "border-[var(--brass)]",
      ].join(" ")}
      style={{
        background:
          "linear-gradient(180deg, rgba(240,201,112,.15), rgba(176,106,56,.08))",
        boxShadow: "inset 0 1px 0 rgba(240,201,112,.35)",
      }}
    >
      <span className="label-sm" style={{ color: "var(--gold)" }}>
        Bourbon
      </span>
      <span
        className="font-display text-[22px] font-bold leading-none tracking-[.01em]"
        style={{ color: "var(--gold)" }}
      >
        {remaining}
      </span>
      {finalRound ? (
        <span className="rounded bg-amber-500 px-1 py-px font-mono text-[11px] font-bold uppercase tracking-[.10em] text-slate-950">
          final
        </span>
      ) : null}
    </div>
  );
}

// -----------------------------
// Chrome buttons (Step / Auto / Quit)
// -----------------------------

function ChromeBtn({
  children,
  onClick,
  tone,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: "danger" | "active";
}) {
  const isDanger = tone === "danger";
  const isActive = tone === "active";
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[7px] border px-3 py-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[.16em]"
      style={{
        borderColor: isDanger
          ? "rgba(217,107,84,.55)"
          : isActive
            ? "var(--gold)"
            : "var(--rule)",
        background: isDanger
          ? "linear-gradient(180deg, rgba(217,107,84,.18), rgba(120,40,32,.18))"
          : isActive
            ? "linear-gradient(180deg, #f0c970, #c69d52)"
            : "linear-gradient(180deg, rgba(34,23,16,.9), rgba(22,15,10,.9))",
        color: isDanger ? "#f4a89a" : isActive ? "#1a120b" : "var(--ink-muted)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.06)",
      }}
    >
      {children}
    </button>
  );
}
