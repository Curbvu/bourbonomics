"use client";

/**
 * Tutorial controller — drives the 12-beat walkthrough on top of the
 * live game store. Owns no engine state of its own; every action goes
 * through `store.dispatch` and mutates / off-script gates flow through
 * `store.mutateState` / `store.setTutorialActionTransform`.
 *
 * Beat lifecycle:
 *   - intro / tour: full-screen overlays mounted before the play phase.
 *   - await-action: install a transform that rejects everything except
 *     the matching action (or its rewritten form for forced sale splits)
 *     and advances on dispatch.
 *   - prompt / decision / celebrate / finale: render an overlay surface.
 *   - scripted: clear the transform, fire `build(state)` actions
 *     programmatically, advance.
 *   - transition: full-screen "time passes" with a state mutate at the
 *     start; auto-advance after the duration.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  TUTORIAL_HUMAN_ID,
  type GameAction,
  type GameState,
} from "@bourbonomics/engine";
import { useGameStore } from "@/lib/store/game";
import IntroSequence from "./IntroSequence";
import BoardTour from "./BoardTour";
import Confetti from "./Confetti";
import Dice from "./Dice";
import { TUTORIAL_BEATS, spotlightSpecialtyRye } from "./beats";
import type { Beat, SpotlightTarget } from "./types";
import { RichText, SpotlightLayer } from "./Spotlight";

export const TUTORIAL_COMPLETE_KEY = "bourbonomics:tutorial-complete";

type Phase = "intro" | "tour" | "play" | "done";

export default function TutorialController() {
  const {
    state,
    dispatch,
    mutateState,
    setTutorialActionTransform,
    endTutorial,
  } = useGameStore();

  const [phase, setPhase] = useState<Phase>("intro");
  const [beatIndex, setBeatIndex] = useState(0);
  const [decisionReply, setDecisionReply] = useState<string | null>(null);
  const [confetti, setConfetti] = useState(false);

  // Ref for the live beat — used by the transform closure (which is
  // installed once per beat) and by the post-dispatch state-watch
  // useEffect. Updates synchronously alongside the React state.
  const beatIndexRef = useRef(0);
  beatIndexRef.current = beatIndex;

  // Keep the latest GameState reachable from non-render contexts
  // (setTimeout callbacks, scripted-beat builders). Plain useRef
  // mutated in render is the simplest way — the setTimeout that
  // fires on a delay will read whatever render-cycle had last set it.
  const stateRef = useRef<GameState | null>(null);
  stateRef.current = state ?? null;

  // Increment a counter when a scripted/transition beat finishes its
  // setTimeout so React re-runs the per-beat effect after a state mutate.
  const advance = useCallback(() => {
    setBeatIndex((i) => {
      const next = i + 1;
      beatIndexRef.current = next;
      return next;
    });
  }, []);

  const beat: Beat | undefined = TUTORIAL_BEATS[beatIndex];

  // Reset transient UI on every beat change.
  useEffect(() => {
    setDecisionReply(null);
  }, [beatIndex]);

  // ── Action transform install ────────────────────────────────────
  // For await-action beats, install a transform that:
  //   - drops the action if the beat's matcher rejects it;
  //   - rewrites the action via beat.rewrite (if any);
  //   - schedules advance() so the next beat fires AFTER the engine
  //     has applied the action and React has flushed the state.
  // For non-await beats, clear the transform.
  useEffect(() => {
    if (phase !== "play") return;
    if (!beat) {
      setTutorialActionTransform(null);
      return;
    }
    if (beat.kind === "await-action") {
      setTutorialActionTransform((action, current) => {
        if (!beat.matches(action, current)) return null;
        const rewritten = beat.rewrite ? beat.rewrite(action, current) : null;
        const final = rewritten ?? action;
        // Defer to next tick so the dispatch's setStore has flushed
        // before we move on — predicate-driven beats need to see the
        // post-action state.
        setTimeout(() => advance(), 0);
        return final;
      });
    } else {
      setTutorialActionTransform(null);
    }
    // Cleanup on unmount or beat change.
    return () => {
      setTutorialActionTransform(null);
    };
  }, [beat, phase, setTutorialActionTransform, advance]);

  // ── Auto-advance scripted + transition + celebrate beats ─────────
  useEffect(() => {
    if (phase !== "play") return;
    if (!beat) return;

    if (beat.kind === "scripted") {
      const delay = beat.delayMs ?? 600;
      const t = setTimeout(() => {
        // Run mutate first so build() sees the post-mutate world.
        // mutateState's setStore updater is synchronous on its own tick;
        // by the time the next microtask reads stateRef, the ref has
        // been updated by the next render that the mutate triggered.
        // To dodge that race we apply mutate directly via the
        // mutateState callback and capture its return inline.
        let live = stateRef.current;
        if (beat.mutate && live) {
          live = beat.mutate(live);
          mutateState(() => live!);
        }
        if (!live) return;
        const out = beat.build(live);
        const list = Array.isArray(out) ? out : [out];
        for (const a of list) {
          dispatch(a);
        }
        // Advance after dispatch flushes.
        setTimeout(() => advance(), 50);
      }, delay);
      return () => clearTimeout(t);
    }

    if (beat.kind === "transition") {
      if (beat.mutate) {
        mutateState(beat.mutate);
      }
      const t = setTimeout(() => advance(), beat.durationMs ?? 2400);
      return () => clearTimeout(t);
    }

    if (beat.kind === "celebrate") {
      setConfetti(true);
      const t = setTimeout(() => setConfetti(false), 3500);
      return () => clearTimeout(t);
    }
  }, [beat, phase, mutateState, dispatch, advance]);

  // ── End-of-walkthrough hand-off ──────────────────────────────────
  useEffect(() => {
    if (phase !== "play") return;
    if (beat) return;
    setPhase("done");
    try {
      window.localStorage.setItem(TUTORIAL_COMPLETE_KEY, "true");
    } catch {
      /* private mode — no-op */
    }
  }, [beat, phase]);

  // ── Spotlight derivation ─────────────────────────────────────────
  const liveSpotlight: SpotlightTarget | undefined = (() => {
    if (!beat || !beat.spotlight || !state) return undefined;
    if (beat.spotlight.kind === "hand-card" && beat.spotlight.cardId === "") {
      const ryeId = spotlightSpecialtyRye(state);
      return ryeId ? { kind: "hand-card", cardId: ryeId } : { kind: "none" };
    }
    return beat.spotlight;
  })();

  const quitToMenu = useCallback(() => {
    endTutorial();
    window.location.href = "/";
  }, [endTutorial]);

  // ── Phase routing ────────────────────────────────────────────────
  if (phase === "intro") {
    return <IntroSequence onDone={() => setPhase("tour")} onQuit={quitToMenu} />;
  }
  if (phase === "tour") {
    return <BoardTour onDone={() => setPhase("play")} onQuit={quitToMenu} />;
  }
  if (phase === "done") {
    return (
      <DoneScreen
        onReplay={() => location.reload()}
        onClose={() => {
          endTutorial();
          window.location.href = "/";
        }}
      />
    );
  }

  return (
    <>
      <SpotlightLayer target={liveSpotlight} />
      <BeatOverlay
        beat={beat}
        decisionReply={decisionReply}
        beatIndex={beatIndex}
        totalBeats={TUTORIAL_BEATS.length}
        onContinue={advance}
        onPickDecision={(reply) => {
          setDecisionReply(reply);
          setTimeout(() => {
            setDecisionReply(null);
            advance();
          }, 1800);
        }}
        onFinaleClose={() => {
          try {
            window.localStorage.setItem(TUTORIAL_COMPLETE_KEY, "true");
          } catch {
            /* ignore */
          }
          endTutorial();
          window.location.href = "/";
        }}
        onFinaleReplay={() => location.reload()}
      />
      <Confetti shown={confetti} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// Beat overlay — picks the right surface for the active beat
// ─────────────────────────────────────────────────────────────────
function BeatOverlay({
  beat,
  decisionReply,
  beatIndex,
  totalBeats,
  onContinue,
  onPickDecision,
  onFinaleClose,
  onFinaleReplay,
}: {
  beat: Beat | undefined;
  decisionReply: string | null;
  beatIndex: number;
  totalBeats: number;
  onContinue: () => void;
  onPickDecision: (reply: string) => void;
  onFinaleClose: () => void;
  onFinaleReplay: () => void;
}) {
  if (!beat) return null;
  if (beat.kind === "scripted") return null;

  if (beat.kind === "await-action") {
    return (
      <CoachMark
        beat={beat}
        beatIndex={beatIndex}
        totalBeats={totalBeats}
      />
    );
  }
  if (beat.kind === "prompt") {
    return <PromptCard beat={beat} onContinue={onContinue} />;
  }
  if (beat.kind === "decision") {
    return (
      <DecisionCard
        beat={beat}
        reply={decisionReply}
        onPick={(branch) =>
          onPickDecision(branch === "A" ? beat.optionA.reply ?? "" : beat.optionB.reply ?? "")
        }
      />
    );
  }
  if (beat.kind === "transition") {
    return <TransitionScreen beat={beat} />;
  }
  if (beat.kind === "celebrate") {
    return <CelebrateCard beat={beat} onContinue={onContinue} />;
  }
  if (beat.kind === "finale") {
    return <FinaleCard beat={beat} onClose={onFinaleClose} onReplay={onFinaleReplay} />;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────
// Surface primitives
// ─────────────────────────────────────────────────────────────────
function CoachMark({
  beat,
  beatIndex,
  totalBeats,
}: {
  beat: Beat;
  beatIndex: number;
  totalBeats: number;
}) {
  return (
    <div className="pointer-events-auto fixed right-6 top-20 z-50 w-[360px] rounded-xl border-2 border-amber-700/60 bg-slate-900/95 p-4 shadow-[0_8px_30px_rgba(0,0,0,.55)]">
      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[.18em] text-amber-300">
        <span>Tutorial · {beatIndex + 1} / {totalBeats}</span>
        <SkipLink />
      </div>
      {beat.title ? (
        <h3 className="mt-1 font-display text-lg font-bold text-amber-100">{beat.title}</h3>
      ) : null}
      <RichText className="mt-2 text-sm leading-snug text-slate-200">{beat.body}</RichText>
    </div>
  );
}

function PromptCard({ beat, onContinue }: { beat: Beat; onContinue: () => void }) {
  if (beat.kind !== "prompt") return null;
  return (
    <div className="pointer-events-auto fixed inset-x-0 bottom-24 z-50 mx-auto w-full max-w-md px-6">
      <div className="rounded-xl border-2 border-amber-700/60 bg-slate-900/95 p-5 shadow-[0_8px_30px_rgba(0,0,0,.55)]">
        {beat.title ? (
          <h3 className="font-display text-xl font-bold text-amber-100">{beat.title}</h3>
        ) : null}
        <RichText className="mt-2 text-sm leading-relaxed text-slate-200">{beat.body}</RichText>
        <div className="mt-4 flex items-center justify-between">
          <SkipLink />
          <button
            type="button"
            onClick={onContinue}
            className="rounded-md border border-amber-400 bg-gradient-to-b from-amber-300 to-amber-500 px-5 py-2 font-mono text-[11px] uppercase tracking-[.14em] text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,.25)] transition hover:from-amber-200 hover:to-amber-400"
          >
            {beat.ctaLabel ?? "Continue ↵"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DecisionCard({
  beat,
  reply,
  onPick,
}: {
  beat: Beat;
  reply: string | null;
  onPick: (which: "A" | "B") => void;
}) {
  if (beat.kind !== "decision") return null;
  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-6 backdrop-blur">
      <div className="w-full max-w-lg rounded-xl border-2 border-amber-700/60 bg-slate-900/95 p-6 shadow-[0_8px_40px_rgba(0,0,0,.55)]">
        {beat.title ? (
          <h3 className="font-display text-2xl font-bold text-amber-100">{beat.title}</h3>
        ) : null}
        <RichText className="mt-2 text-sm leading-relaxed text-slate-200">{beat.body}</RichText>
        {reply ? (
          <RichText className="mt-4 rounded-md border border-amber-700/40 bg-amber-950/30 p-3 text-sm leading-relaxed text-amber-100">
            {reply}
          </RichText>
        ) : (
          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => onPick("A")}
              className="rounded-md border-2 border-amber-700/60 bg-slate-950/60 px-4 py-3 text-left font-display text-base font-semibold text-amber-100 transition hover:bg-amber-950/40"
            >
              {beat.optionA.label}
            </button>
            <button
              type="button"
              onClick={() => onPick("B")}
              className="rounded-md border-2 border-slate-600 bg-slate-950/60 px-4 py-3 text-left font-display text-base font-semibold text-slate-200 transition hover:bg-slate-800"
            >
              {beat.optionB.label}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TransitionScreen({ beat }: { beat: Beat }) {
  if (beat.kind !== "transition") return null;
  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-slate-950/95 px-6 text-center backdrop-blur">
      <div>
        <div className="font-mono text-[11px] uppercase tracking-[.20em] text-amber-300">
          {beat.subtitle ?? "Time passes…"}
        </div>
        <h2 className="mt-2 font-display text-4xl font-bold text-amber-100">
          {beat.title ?? "Time passes…"}
        </h2>
        <RichText className="mt-3 max-w-md text-sm leading-relaxed text-slate-300">
          {beat.body}
        </RichText>
      </div>
      {beat.fakeRolls && beat.fakeRolls.length > 0 ? (
        <RollStream rolls={beat.fakeRolls.map((r) => r.dice)} totalMs={beat.durationMs ?? 2400} />
      ) : null}
    </div>
  );
}

function RollStream({
  rolls,
  totalMs,
}: {
  rolls: [number, number][];
  totalMs: number;
}) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (rolls.length <= 1) return;
    const slot = Math.max(700, Math.floor(totalMs / rolls.length));
    const t = setInterval(() => {
      setIdx((i) => Math.min(rolls.length - 1, i + 1));
    }, slot);
    return () => clearInterval(t);
  }, [rolls.length, totalMs]);
  const current = rolls[idx]!;
  return <Dice key={`roll-${idx}`} values={current} />;
}

function CelebrateCard({ beat, onContinue }: { beat: Beat; onContinue: () => void }) {
  if (beat.kind !== "celebrate") return null;
  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-6 backdrop-blur">
      <div className="w-full max-w-md rounded-xl border-2 border-amber-400 bg-gradient-to-br from-amber-950/95 to-slate-900/95 p-6 text-center shadow-[0_0_60px_rgba(251,191,36,.45)]">
        <div className="font-mono text-[11px] uppercase tracking-[.20em] text-amber-300">
          Award unlocked
        </div>
        <h3 className="mt-1 font-display text-3xl font-bold text-amber-100">
          {beat.title ?? "Silver award"}
        </h3>
        <RichText className="mt-3 text-sm leading-relaxed text-amber-100/90">{beat.body}</RichText>
        <ul className="mt-4 space-y-1 font-mono text-[12px] tracking-[.04em] text-amber-200/90">
          {beat.lines.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={onContinue}
            className="rounded-md border border-amber-400 bg-gradient-to-b from-amber-300 to-amber-500 px-6 py-2 font-mono text-[11px] uppercase tracking-[.14em] text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,.25)] transition hover:from-amber-200 hover:to-amber-400"
          >
            {beat.ctaLabel ?? "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FinaleCard({
  beat,
  onClose,
  onReplay,
}: {
  beat: Beat;
  onClose: () => void;
  onReplay: () => void;
}) {
  if (beat.kind !== "finale") return null;
  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 px-6 backdrop-blur">
      <div className="w-full max-w-xl rounded-2xl border-2 border-amber-700/60 bg-slate-900/95 p-7 shadow-[0_8px_50px_rgba(0,0,0,.6)]">
        <h2 className="font-display text-3xl font-bold tracking-tight text-amber-200">
          {beat.title ?? "You just learned the whole game."}
        </h2>
        <RichText className="mt-3 text-sm leading-relaxed text-slate-200">{beat.body}</RichText>
        <ul className="mt-5 space-y-2">
          {beat.bullets.map((b, i) => (
            <li
              key={i}
              className="rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-200"
            >
              <span className="mr-2 text-amber-400">✦</span>
              {b}
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onReplay}
            className="rounded-md border-2 border-slate-600 bg-slate-900 px-5 py-2 font-mono text-[11px] uppercase tracking-[.14em] text-slate-200 hover:border-slate-400"
          >
            {beat.replayLabel ?? "Replay tutorial"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-amber-400 bg-gradient-to-b from-amber-300 to-amber-500 px-5 py-2 font-mono text-[11px] uppercase tracking-[.14em] text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,.25)] hover:from-amber-200 hover:to-amber-400"
          >
            {beat.closeLabel ?? "Start a real game"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DoneScreen({
  onReplay,
  onClose,
}: {
  onReplay: () => void;
  onClose: () => void;
}) {
  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 px-6 backdrop-blur">
      <div className="text-center">
        <h1 className="font-display text-3xl font-bold text-amber-300">Tutorial complete</h1>
        <p className="mt-3 text-sm text-slate-300">Ready for a real game?</p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={onReplay}
            className="rounded-md border-2 border-slate-600 bg-slate-900 px-5 py-2 font-mono text-[11px] uppercase tracking-[.14em] text-slate-200"
          >
            Replay
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-amber-400 bg-gradient-to-b from-amber-300 to-amber-500 px-5 py-2 font-mono text-[11px] uppercase tracking-[.14em] text-slate-950"
          >
            Back to menu
          </button>
        </div>
      </div>
    </div>
  );
}

function SkipLink() {
  return (
    <Link
      href="/"
      className="font-mono text-[10px] uppercase tracking-[.16em] text-slate-500 hover:text-amber-200"
    >
      Skip tutorial ↵
    </Link>
  );
}

// Suppress unused-warning in CI; the export is intentional.
void TUTORIAL_HUMAN_ID;
