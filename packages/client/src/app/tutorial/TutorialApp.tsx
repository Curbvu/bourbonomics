"use client";

/**
 * Top-level tutorial orchestrator. Owns:
 *   - high-level phase: intro → tour → play → done
 *   - the engine GameState (we drive applyAction directly here, not
 *     via the live GameProvider — the production store carries
 *     concerns the tutorial doesn't need)
 *   - beat cursor + advancement
 *   - persistent UI mode (which interaction the player is mid-flight)
 *   - localStorage completion flag
 *
 * Action gating happens at three layers:
 *   1. The board only fires actions while `awaitingAction === true`.
 *   2. `tryDispatch` checks the active beat's `matches` predicate
 *      before forwarding to the engine.
 *   3. Each action runs through `applyAction`, which throws on
 *      illegality — we swallow those silently rather than crash the
 *      tutorial so a misclick is never fatal.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  applyAction,
  buildTutorialInitialState,
  TUTORIAL_HUMAN_ID,
  type GameAction,
  type GameState,
} from "@bourbonomics/engine";
import IntroSequence from "./IntroSequence";
import BoardTour, { RichText } from "./BoardTour";
import TutorialBoard from "./TutorialBoard";
import Confetti from "./Confetti";
import Dice from "./Dice";
import { TUTORIAL_BEATS, spotlightSpecialtyRye } from "./beats";
import type { Beat, SpotlightTarget } from "./types";

export const TUTORIAL_COMPLETE_KEY = "bourbonomics:tutorial-complete";

type Phase = "intro" | "tour" | "play" | "done";

type Mode =
  | { kind: "idle" }
  | { kind: "make"; slotId: string; selectedCardIds: string[] }
  | { kind: "buy"; marketSlotIndex: number; selectedCardIds: string[] }
  | { kind: "age"; barrelId: string; cardId: string | null }
  | { kind: "sell"; barrelId: string; spendCardId: string | null };

interface AnimSale {
  slotId: string;
  ownerId: string;
  seq: number;
}
interface AnimMake {
  slotId: string;
  seq: number;
}

export default function TutorialApp() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [state, setState] = useState<GameState>(() => buildTutorialInitialState());
  const [beatIndex, setBeatIndex] = useState(0);
  const [mode, setMode] = useState<Mode>({ kind: "idle" });
  const [decisionReply, setDecisionReply] = useState<string | null>(null);
  const [confetti, setConfetti] = useState(false);
  const [lastSale, setLastSale] = useState<AnimSale | null>(null);
  const [lastMake, setLastMake] = useState<AnimMake | null>(null);
  const seqRef = useRef(0);

  const beat: Beat | undefined = TUTORIAL_BEATS[beatIndex];

  // Reset the interaction mode whenever the beat changes — never carry
  // a half-finished selection from one prompt to the next.
  useEffect(() => {
    setMode({ kind: "idle" });
    setDecisionReply(null);
  }, [beatIndex]);

  const advance = useCallback(() => {
    setBeatIndex((i) => i + 1);
  }, []);

  const dispatch = useCallback((action: GameAction) => {
    setState((prev) => {
      try {
        const next = applyAction(prev, action);
        captureAnimations(prev, action);
        return next;
      } catch (err) {
        // Illegal during tutorial — leave state alone. Console-log so
        // we still notice in dev.
        if (process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.warn("[tutorial] illegal action", action, err);
        }
        return prev;
      }
    });
  }, []);

  const captureAnimations = useCallback((prev: GameState, action: GameAction) => {
    seqRef.current += 1;
    const seq = seqRef.current;
    if (action.type === "MAKE_BOURBON") {
      setLastMake({ slotId: action.slotId, seq });
    }
    if (action.type === "SELL_BOURBON") {
      const barrel = prev.allBarrels.find((b) => b.id === action.barrelId);
      if (barrel) setLastSale({ slotId: barrel.slotId, ownerId: barrel.ownerId, seq });
    }
  }, []);

  const tryDispatch = useCallback(
    (action: GameAction) => {
      if (!beat || beat.kind !== "await-action") return;
      if (!beat.matches(action, state)) {
        // Not the action this beat is waiting for. The board's "Locked
        // during tutorial" copy in the prompt body already explains this;
        // silently no-op so the user can adjust.
        return;
      }
      const final = beat.rewrite ? (beat.rewrite(action, state) ?? action) : action;
      dispatch(final);
      // Defer advance by one tick so the dispatched state lands first.
      setTimeout(() => advance(), 0);
    },
    [beat, state, dispatch, advance],
  );

  // ── Auto-advance scripted + transition beats ────────────────────
  useEffect(() => {
    if (!beat) return;
    if (beat.kind === "scripted") {
      const delay = beat.delayMs ?? 600;
      const t = setTimeout(() => {
        let live = state;
        if (beat.mutate) {
          live = beat.mutate(live);
          setState(live);
        }
        const out = beat.build(live);
        const list = Array.isArray(out) ? out : [out];
        let cur = live;
        for (const a of list) {
          try {
            cur = applyAction(cur, a);
            captureAnimations(live, a);
          } catch (err) {
            if (process.env.NODE_ENV !== "production") {
              // eslint-disable-next-line no-console
              console.warn("[tutorial scripted] failed", a, err);
            }
          }
        }
        if (list.length > 0 || beat.mutate) {
          setState(cur);
        }
        advance();
      }, delay);
      return () => clearTimeout(t);
    }
    if (beat.kind === "transition") {
      // Mutate at the START so the board behind the transition shows
      // the post-skip state. Then auto-advance when the duration ends.
      if (beat.mutate) {
        setState((prev) => beat.mutate!(prev));
      }
      const t = setTimeout(() => advance(), beat.durationMs ?? 2400);
      return () => clearTimeout(t);
    }
    if (beat.kind === "celebrate") {
      setConfetti(true);
      const t = setTimeout(() => setConfetti(false), 3500);
      return () => clearTimeout(t);
    }
  }, [beat, advance, captureAnimations]);
  /* eslint-disable-next-line react-hooks/exhaustive-deps */

  // Mark tutorial complete + jump phase when we've walked past the
  // last beat.
  useEffect(() => {
    if (phase !== "play") return;
    if (beat) return;
    setPhase("done");
    try {
      window.localStorage.setItem(TUTORIAL_COMPLETE_KEY, "true");
    } catch {
      /* private mode, etc. */
    }
  }, [beat, phase]);

  // ── Spotlight derivation ────────────────────────────────────────
  const liveSpotlight = useMemo<SpotlightTarget | undefined>(() => {
    if (!beat || !beat.spotlight) return undefined;
    if (beat.spotlight.kind === "hand-card" && beat.spotlight.cardId === "") {
      const ryeId = spotlightSpecialtyRye(state);
      return ryeId ? { kind: "hand-card", cardId: ryeId } : { kind: "none" };
    }
    return beat.spotlight;
  }, [beat, state]);

  // ── Phase routing ──────────────────────────────────────────────
  if (phase === "intro") {
    return <IntroSequence onDone={() => setPhase("tour")} />;
  }
  if (phase === "tour") {
    return <BoardTour state={state} onDone={() => setPhase("play")} />;
  }
  if (phase === "done") {
    return <TutorialDoneScreen onReplay={() => location.reload()} />;
  }

  return (
    <main className="relative flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-6 py-3">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-xl font-bold tracking-tight text-amber-300">
            Bourbonomics · Tutorial
          </h1>
          <span className="font-mono text-[10px] uppercase tracking-[.18em] text-slate-500">
            Beat {beatIndex + 1} / {TUTORIAL_BEATS.length}
          </span>
        </div>
        <Link
          href="/"
          className="font-mono text-[11px] uppercase tracking-[.18em] text-slate-500 hover:text-amber-200"
        >
          Skip tutorial ↵
        </Link>
      </header>

      <div className="relative flex-1 overflow-hidden">
        <TutorialBoard
          state={state}
          spotlight={liveSpotlight}
          awaitingAction={beat?.kind === "await-action"}
          onTryAction={tryDispatch}
          mode={mode}
          setMode={setMode}
          lastSale={lastSale}
          lastMake={lastMake}
        />

        <BeatOverlay
          beat={beat}
          decisionReply={decisionReply}
          onContinue={advance}
          onPickDecision={(reply) => {
            setDecisionReply(reply);
            // Auto-advance after the reply has had ~1.6s to read.
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
            window.location.href = "/";
          }}
          onFinaleReplay={() => location.reload()}
        />

        <Confetti shown={confetti} />
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────
// BeatOverlay — renders the right surface for the active beat
// ─────────────────────────────────────────────────────────────────
function BeatOverlay({
  beat,
  decisionReply,
  onContinue,
  onPickDecision,
  onFinaleClose,
  onFinaleReplay,
}: {
  beat: Beat | undefined;
  decisionReply: string | null;
  onContinue: () => void;
  onPickDecision: (reply: string) => void;
  onFinaleClose: () => void;
  onFinaleReplay: () => void;
}) {
  if (!beat) return null;

  // Scripted beats render no overlay — they advance silently.
  if (beat.kind === "scripted") return null;

  // Await-action beats render a slim coach-mark, not a blocking modal.
  if (beat.kind === "await-action") {
    return <CoachMark beat={beat} />;
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

// Minor surfaces ────────────────────────────────────────────────────
function CoachMark({ beat }: { beat: Beat }) {
  return (
    <div className="pointer-events-auto absolute right-6 top-6 z-30 w-[360px] rounded-xl border-2 border-amber-700/60 bg-slate-900/95 p-4 shadow-[0_8px_30px_rgba(0,0,0,.55)]">
      <div className="font-mono text-[10px] uppercase tracking-[.18em] text-amber-300">
        {beat.title ? "Tutorial" : "Next step"}
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
    <div className="pointer-events-auto absolute inset-x-0 bottom-6 mx-auto w-full max-w-md px-6">
      <div className="rounded-xl border-2 border-amber-700/60 bg-slate-900/95 p-5 shadow-[0_8px_30px_rgba(0,0,0,.55)]">
        {beat.title ? (
          <h3 className="font-display text-xl font-bold text-amber-100">{beat.title}</h3>
        ) : null}
        <RichText className="mt-2 text-sm leading-relaxed text-slate-200">{beat.body}</RichText>
        <div className="mt-4 flex justify-end">
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
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-slate-950/70 px-6 backdrop-blur">
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
    <div className="pointer-events-auto absolute inset-0 z-40 flex flex-col items-center justify-center gap-8 bg-slate-950/95 px-6 text-center backdrop-blur">
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
        <div className="flex flex-col items-center gap-3">
          <RollStream rolls={beat.fakeRolls.map((r) => r.dice)} totalMs={beat.durationMs ?? 2400} />
        </div>
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
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-slate-950/80 px-6 backdrop-blur">
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
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-slate-950/85 px-6 backdrop-blur">
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

function TutorialDoneScreen({ onReplay }: { onReplay: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
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
          <Link
            href="/new-game"
            className="rounded-md border border-amber-400 bg-gradient-to-b from-amber-300 to-amber-500 px-5 py-2 font-mono text-[11px] uppercase tracking-[.14em] text-slate-950"
          >
            New game ↵
          </Link>
        </div>
      </div>
    </main>
  );
}

// Suppress the deps warning above — `state` would loop the effect as we
// mutate it inside. The intentional dep set is `[beat]`; we read state
// off the ref / closure inside.
TutorialApp.displayName = "TutorialApp";
