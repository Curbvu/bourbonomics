"use client";

/**
 * TutorialOverlay — fades the rest of the board, paints a tooltip
 * card next to the spotlit zone, and watches game state to advance
 * automatically when the player satisfies a step's `advance`
 * predicate.
 *
 * Spotlight technique: a transparent box positioned over the target
 * element gets a 9999px-radius box-shadow with `rgba(0,0,0,.7)` —
 * everything around the box dims, the box itself stays a clean cutout.
 * `pointer-events-none` on the overlay lets clicks pass through to the
 * actual UI (the player still drives the game; the overlay just
 * narrates).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useGameStore } from "@/lib/store/game";
import type { GameState } from "@bourbonomics/engine";
import { TUTORIAL_STEPS, type TutorialStep } from "./steps";

interface Bbox {
  top: number;
  left: number;
  width: number;
  height: number;
}

const TOOLTIP_W = 360;

export default function TutorialOverlay() {
  const { state, clear } = useGameStore();
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [bbox, setBbox] = useState<Bbox | null>(null);
  // Snapshot of the GameState at the moment we entered the current
  // step — predicates compare against this to detect transitions
  // ("round increased", "barrel started aging", etc.).
  const enteredAtRef = useRef<GameState | null>(state);

  const step: TutorialStep | null = TUTORIAL_STEPS[stepIndex] ?? null;

  // Reset the entry snapshot when we move to a new step.
  useEffect(() => {
    enteredAtRef.current = state ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  // Auto-advance: when the current step's predicate fires, roll forward.
  useEffect(() => {
    if (!step || step.advance === "manual") return;
    if (!state) return;
    if (step.advance(state, enteredAtRef.current)) {
      setStepIndex((i) => Math.min(i + 1, TUTORIAL_STEPS.length - 1));
    }
  }, [state, step]);

  // Recompute the spotlight bbox whenever the step or layout changes.
  useEffect(() => {
    if (!step || !step.spotlight) {
      setBbox(null);
      return;
    }
    const recompute = () => {
      const el = document.querySelector(step.spotlight!);
      if (!el) {
        setBbox(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setBbox({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    recompute();
    window.addEventListener("resize", recompute);
    // Also poll once after a frame — components mounted in the same
    // tick may not have laid out yet when the effect runs.
    const raf = window.requestAnimationFrame(recompute);
    return () => {
      window.removeEventListener("resize", recompute);
      window.cancelAnimationFrame(raf);
    };
  }, [step, state]);

  if (!step) return null;

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === TUTORIAL_STEPS.length - 1;

  const onNext = () => {
    if (isLast) {
      clear();
      router.push("/");
      return;
    }
    setStepIndex((i) => i + 1);
  };

  const onSkip = () => {
    clear();
    router.push("/");
  };

  // Three dim modes:
  //   • spotlight + manual advance → cutout dim (the static board tour
  //     pages — the player just reads, so blacking out everything else
  //     focuses attention without blocking play).
  //   • spotlight + auto advance → glow ring only (the player needs
  //     to click cards / slots that may sit outside the spotlight, so
  //     we don't black them out — just halo the primary call-to-action).
  //   • no spotlight + center anchor → full-screen modal moment.
  //   • no spotlight + other anchor → tooltip floats, no dim.
  type DimMode = "cutout" | "ring" | "modal" | "none";
  const dimMode: DimMode = bbox
    ? step.advance === "manual"
      ? "cutout"
      : "ring"
    : step.anchor === "center"
      ? "modal"
      : "none";

  return (
    <>
      {(dimMode === "cutout" || dimMode === "ring") && bbox ? (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[60] rounded-md ring-2 ring-amber-300/80"
          style={{
            top: bbox.top - 4,
            left: bbox.left - 4,
            width: bbox.width + 8,
            height: bbox.height + 8,
            boxShadow:
              dimMode === "cutout"
                ? "0 0 0 9999px rgba(2, 6, 23, 0.78)"
                : "0 0 32px 4px rgba(252, 211, 77, 0.55)",
            transition: "all 200ms ease-out",
          }}
        />
      ) : null}
      {dimMode === "modal" ? (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-sm"
        />
      ) : null}

      <Tooltip
        step={step}
        bbox={bbox}
        stepIndex={stepIndex}
        total={TUTORIAL_STEPS.length}
        isFirst={isFirst}
        isLast={isLast}
        onNext={onNext}
        onSkip={onSkip}
      />
    </>
  );
}

function Tooltip({
  step,
  bbox,
  stepIndex,
  total,
  isFirst,
  isLast,
  onNext,
  onSkip,
}: {
  step: TutorialStep;
  bbox: Bbox | null;
  stepIndex: number;
  total: number;
  isFirst: boolean;
  isLast: boolean;
  onNext: () => void;
  onSkip: () => void;
}) {
  // Position the tooltip:
  //   anchor=center                   → dead-center of the viewport
  //                                     (welcome / done splashes)
  //   anchor=above/below, no bbox     → float bottom-right so an
  //                                     existing centered modal (the
  //                                     starter-draft / demand-roll /
  //                                     draw modals) stays clickable
  //   anchor=above/below, with bbox   → above/below the spotlight
  const pos = useMemo(() => {
    if (step.anchor === "center") {
      return {
        top: "50%" as const,
        left: "50%" as const,
        transform: "translate(-50%, -50%)",
      };
    }
    if (!bbox) {
      // Float bottom-right so the live modal mid-screen stays usable.
      return {
        top: window.innerHeight - 220,
        left: window.innerWidth - TOOLTIP_W - 24,
        transform: "none" as const,
      };
    }
    const cx = bbox.left + bbox.width / 2;
    const left = Math.max(
      16,
      Math.min(window.innerWidth - TOOLTIP_W - 16, cx - TOOLTIP_W / 2),
    );
    if (step.anchor === "above") {
      return {
        top: Math.max(16, bbox.top - 16),
        left,
        transform: "translateY(-100%)",
      };
    }
    return {
      top: bbox.top + bbox.height + 16,
      left,
      transform: "none" as const,
    };
  }, [bbox, step.anchor]);

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={step.title}
      className="pointer-events-auto fixed z-[70] rounded-lg border-2 border-amber-400 bg-slate-950/95 px-5 py-4 shadow-[0_18px_42px_rgba(0,0,0,.6)]"
      style={{
        top: pos.top,
        left: pos.left,
        transform: pos.transform,
        width: TOOLTIP_W,
      }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-amber-300">
          Tutorial · {stepIndex + 1} / {total}
        </span>
        <button
          type="button"
          onClick={onSkip}
          className="font-mono text-[10px] uppercase tracking-[.14em] text-slate-500 hover:text-rose-300"
        >
          Skip
        </button>
      </div>
      <h2 className="mt-2 font-display text-xl font-bold text-amber-100">
        {step.title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-200">
        {step.body}
      </p>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[.14em] text-slate-500">
          {step.advance === "manual"
            ? "Press Next when ready"
            : "Do the highlighted action to continue"}
        </span>
        {step.advance === "manual" || isLast ? (
          <button
            type="button"
            onClick={onNext}
            className="rounded-md border-2 border-amber-300 bg-gradient-to-b from-amber-300 to-amber-500 px-4 py-1.5 font-sans text-sm font-bold uppercase tracking-[.05em] text-slate-950 shadow-[0_4px_10px_rgba(251,191,36,.25)] hover:from-amber-200 hover:to-amber-400"
          >
            {isLast ? "Finish" : isFirst ? "Begin" : "Next"} →
          </button>
        ) : null}
      </div>
    </div>
  );
}
