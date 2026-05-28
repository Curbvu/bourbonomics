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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  TUTORIAL_HUMAN_ID,
  validateAction,
  type GameAction,
  type GameState,
} from "@bourbonomics/engine";
import { useGameStore } from "@/lib/store/game";
import IntroSequence from "./IntroSequence";
import BoardTour from "./BoardTour";
import Confetti from "./Confetti";
import Dice from "./Dice";
import DragHintAnimation from "./DragHintAnimation";
import TapHintAnimation from "./TapHintAnimation";
import { TUTORIAL_BEATS, chapterProgressFor, spotlightSpecialtyRye } from "./beats";
import type { Beat, SpotlightTarget } from "./types";
import { RichText, SpotlightLayer, findSpotlightElement } from "./Spotlight";

export const TUTORIAL_COMPLETE_KEY = "bourbonomics:tutorial-complete";

type Phase = "intro" | "tour" | "play" | "done";

export default function TutorialController() {
  const {
    state,
    dispatch,
    mutateState,
    setTutorialActionTransform,
    setTutorialSpotlight,
    setTutorialHandFilter,
    sellMode,
    makeMode,
    buyMode,
    ageMode,
    drawBillMode,
    inspect,
    setInspect,
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

  // Walk backwards through the beat list to the most recent prompt
  // beat before `from`. Returns -1 if there isn't one. The Back button
  // on PromptCard uses this so the player can re-read content they
  // clicked through too quickly. Only prompts are considered targets:
  // walking back into an await-action beat would land the player on a
  // matcher that's already been satisfied (state has moved past it).
  const findPreviousPromptIndex = useCallback((from: number): number => {
    for (let i = from - 1; i >= 0; i--) {
      if (TUTORIAL_BEATS[i]?.kind === "prompt") return i;
    }
    return -1;
  }, []);

  const goBackToPreviousPrompt = useCallback(() => {
    const target = findPreviousPromptIndex(beatIndexRef.current);
    if (target < 0) return;
    setBeatIndex(target);
    beatIndexRef.current = target;
  }, [findPreviousPromptIndex]);

  const beat: Beat | undefined = TUTORIAL_BEATS[beatIndex];

  // Track the previous beat index so we can detect forward advances
  // (used to close lingering inspect modals on a "walk through the
  // card" beat — see the effect below).
  const prevBeatIndexRef = useRef(0);
  useEffect(() => {
    const prevIdx = prevBeatIndexRef.current;
    if (beatIndex > prevIdx) {
      const prevBeat = TUTORIAL_BEATS[prevIdx];
      if (
        prevBeat?.kind === "prompt" &&
        prevBeat.closeInspectOnAdvance
      ) {
        setInspect(null);
      }
    }
    prevBeatIndexRef.current = beatIndex;
  }, [beatIndex, setInspect]);

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
      const hasAdvanceWhen = beat.advanceWhen != null;
      setTutorialActionTransform((action, current) => {
        if (!beat.matches(action, current)) return null;
        const rewritten = beat.rewrite ? beat.rewrite(action, current) : null;
        const final = rewritten ?? action;
        // If the beat has an `advanceWhen` predicate, leave progression
        // to the state-watch effect — the player may need to dispatch
        // several partial actions (e.g. drag-and-drop one card at a
        // time) before the goal state lands.
        //
        // Without `advanceWhen`, a single matching+legal action means
        // the goal is reached. We pre-run the engine's pure
        // `validateAction` before scheduling advance so a malformed
        // dispatch that passes the beat's loose `matches` predicate
        // but the engine then throws on (illegal repSpend shape,
        // missing seat, stale snapshot) doesn't silently advance the
        // tutorial while leaving state unchanged. The dispatch path
        // re-validates inside `applyAction`; this is the gate that
        // gives advance() the same authority.
        if (!hasAdvanceWhen) {
          const validation = validateAction(current, final);
          if (validation.legal) {
            setTimeout(() => advance(), 0);
          }
        }
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

  // ── State-watch advancement for await-action beats with advanceWhen ──
  // Some Make beats accept several partial commits before the goal is
  // reached (drag-and-drop adds one card at a time). For those, the
  // transform passes the action through but doesn't advance — this
  // effect re-evaluates the predicate on every state change and
  // advances exactly once when the goal state lands.
  useEffect(() => {
    if (phase !== "play") return;
    if (!beat || beat.kind !== "await-action") return;
    if (!beat.advanceWhen) return;
    if (!state) return;
    if (beat.advanceWhen(state)) {
      advance();
    }
  }, [state, beat, phase, advance]);

  // ── Auto-advance prompt beats that gate on an inspect target ─────
  // When a prompt declares `awaitInspectBarrelDefId`, the user must
  // right-click the matching barrel to advance. The Continue button
  // is hidden until that happens; this effect fires the auto-advance
  // the moment the inspect state lands on the right barrel.
  useEffect(() => {
    if (phase !== "play") return;
    if (!beat || beat.kind !== "prompt") return;
    const wantedDefId = beat.awaitInspectBarrelDefId;
    if (!wantedDefId) return;
    if (!inspect || inspect.kind !== "barrel") return;
    if (inspect.barrel.attachedMashBill.defId !== wantedDefId) return;
    advance();
  }, [beat, phase, inspect, advance]);

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
  // Memoized on STABLE inputs so the resulting object reference doesn't
  // change every render. The previous version returned a fresh object
  // for the rigged-rye case on every render, and the store-mirror
  // useEffect below has it in its deps — that combo blew up React's
  // re-render guard with "Maximum update depth exceeded".
  const ryeIdForSpotlight =
    state && beat?.spotlight?.kind === "hand-card" && beat.spotlight.cardId === ""
      ? spotlightSpecialtyRye(state)
      : null;
  // For action-button spotlights, the corresponding picker mode being
  // active means the player has already clicked the button — flip the
  // spotlight to the beat's `postEngageSpotlight` so the next click
  // target gets the highlight (e.g. Sell button → rickhouse slot).
  const isActionButton = beat?.spotlight?.kind === "action-button";
  const actionButtonAction =
    beat?.spotlight?.kind === "action-button" ? beat.spotlight.action : null;
  const actionButtonModeActive =
    actionButtonAction === "sell"
      ? sellMode != null
      : actionButtonAction === "make"
        ? makeMode != null
        : actionButtonAction === "buy"
          ? buyMode != null
          : actionButtonAction === "age"
            ? ageMode != null
            : actionButtonAction === "draw-bill"
              ? drawBillMode != null
              : false;
  const liveSpotlight = useMemo<SpotlightTarget | undefined>(() => {
    if (!beat || !beat.spotlight) return undefined;
    if (beat.spotlight.kind === "hand-card" && beat.spotlight.cardId === "") {
      return ryeIdForSpotlight
        ? { kind: "hand-card", cardId: ryeIdForSpotlight }
        : { kind: "none" };
    }
    if (
      isActionButton &&
      actionButtonModeActive &&
      beat.postEngageSpotlight
    ) {
      return beat.postEngageSpotlight;
    }
    return beat.spotlight;
  }, [
    beat,
    ryeIdForSpotlight,
    isActionButton,
    actionButtonModeActive,
  ]);

  // Mirror the active spotlight into the store so non-tutorial board
  // components (ConveyorCard's click gate, the shimmer animation, …)
  // can react to it without prop-drilling through GameBoard.
  useEffect(() => {
    setTutorialSpotlight(liveSpotlight ?? null);
  }, [liveSpotlight, setTutorialSpotlight]);

  // Same for the per-beat hand-card filter (Make beats narrow the hand
  // to the resource cards / specialty rye that the recipe needs).
  useEffect(() => {
    if (beat && beat.kind === "await-action" && beat.handCardFilter) {
      setTutorialHandFilter(beat.handCardFilter);
    } else {
      setTutorialHandFilter(null);
    }
  }, [beat, setTutorialHandFilter]);

  const quitToMenu = useCallback(() => {
    endTutorial();
    window.location.href = "/";
  }, [endTutorial]);

  // Has the player satisfied the active prompt's inspect gate? While
  // false, the prompt's Continue button is hidden and the user has to
  // right-click the named barrel to proceed.
  const inspectGateOpen =
    !beat ||
    beat.kind !== "prompt" ||
    !beat.awaitInspectBarrelDefId ||
    (inspect != null &&
      inspect.kind === "barrel" &&
      inspect.barrel.attachedMashBill.defId === beat.awaitInspectBarrelDefId);

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

  // Per-beat drag demonstration. Make sub-beats opt in via `beat.dragHint`
  // — the controller picks the first hand card matching the predicate and
  // animates a ghost cursor from that card to the target slot, so the
  // player SEES the gesture without us having to spell it out in copy.
  const dragHint = (() => {
    if (!beat || beat.kind !== "await-action" || !beat.dragHint) return null;
    const human = state?.players.find((p) => p.id === TUTORIAL_HUMAN_ID);
    const source = human?.hand.find(beat.dragHint.pickHandCard);
    if (!source) return null;
    return (
      <DragHintAnimation
        fromSelector={`[data-card-id="${source.id}"]`}
        toSelector={`[data-slot-id="slot_${TUTORIAL_HUMAN_ID}_${beat.dragHint.slotIndex}"]`}
      />
    );
  })();

  const tapHint =
    beat && beat.kind === "await-action" && beat.tapHint ? (
      <TapHintAnimation selector={beat.tapHint.selector} />
    ) : null;

  return (
    <>
      <SpotlightLayer target={liveSpotlight} />
      {dragHint}
      {tapHint}
      <BeatOverlay
        beat={beat}
        decisionReply={decisionReply}
        beatIndex={beatIndex}
        totalBeats={TUTORIAL_BEATS.length}
        canGoBack={findPreviousPromptIndex(beatIndex) >= 0}
        onContinue={advance}
        onBack={goBackToPreviousPrompt}
        onPickDecision={(reply) => setDecisionReply(reply)}
        onConfirmDecision={() => {
          setDecisionReply(null);
          advance();
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
        inspectGateOpen={inspectGateOpen}
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
  canGoBack,
  onContinue,
  onBack,
  onPickDecision,
  onConfirmDecision,
  onFinaleClose,
  onFinaleReplay,
  inspectGateOpen,
}: {
  beat: Beat | undefined;
  decisionReply: string | null;
  beatIndex: number;
  totalBeats: number;
  canGoBack: boolean;
  onContinue: () => void;
  onBack: () => void;
  onPickDecision: (reply: string) => void;
  onConfirmDecision: () => void;
  onFinaleClose: () => void;
  onFinaleReplay: () => void;
  inspectGateOpen: boolean;
}) {
  if (!beat) return null;
  if (beat.kind === "scripted") return null;

  if (beat.kind === "await-action") {
    return (
      <CoachMark
        beat={beat}
        beatIndex={beatIndex}
        totalBeats={totalBeats}
        canGoBack={canGoBack}
        onBack={onBack}
      />
    );
  }
  if (beat.kind === "prompt") {
    return (
      <PromptCard
        beat={beat}
        canGoBack={canGoBack}
        onBack={onBack}
        onContinue={onContinue}
        inspectGateOpen={inspectGateOpen}
      />
    );
  }
  if (beat.kind === "decision") {
    return (
      <DecisionCard
        beat={beat}
        reply={decisionReply}
        onPick={(branch) =>
          onPickDecision(branch === "A" ? beat.optionA.reply ?? "" : beat.optionB.reply ?? "")
        }
        onContinue={onConfirmDecision}
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

/**
 * small chapter-scoped progress chip. Shows "Make bourbon ·
 * 2/5" instead of the total "Tutorial · 13/45" so each phase feels
 * manageable. Counts only visible beats (prompts / awaits / decisions
 * / transitions / celebrate / finale) — scripted plumbing doesn't
 * register with the player and shouldn't bloat the denominator.
 */
function ChapterProgress({
  beatIndex,
  totalBeats: _totalBeats,
}: {
  beatIndex: number;
  totalBeats: number;
}) {
  const prog = chapterProgressFor(beatIndex);
  if (!prog) return <span>Tutorial</span>;
  return (
    <span>
      {prog.chapterLabel} · {prog.position}/{prog.total}
    </span>
  );
}

/**
 * Hook: track the live bounding box of the beat's spotlight target.
 * Returns `null` for beats whose spotlight is "none" / "action-button"
 * (those positions are handled separately) so the caller can fall
 * through to the static positioning.
 *
 * Polled 4× per second to mirror SpotlightLayer — layout shifts from
 * mode toggles, drawer opens, hand reshuffles keep both the ring and
 * the callout glued to the target without listening for every event.
 */
function useSpotlightBox(target: SpotlightTarget | undefined): DOMRect | null {
  const [box, setBox] = useState<DOMRect | null>(null);
  useEffect(() => {
    if (!target || target.kind === "none" || target.kind === "action-button") {
      setBox(null);
      return;
    }
    const measure = () => {
      const el = findSpotlightElement(target);
      const next = el?.getBoundingClientRect() ?? null;
      setBox((prev) => {
        if (!prev || !next) return next;
        if (
          Math.abs(prev.top - next.top) < 0.5 &&
          Math.abs(prev.left - next.left) < 0.5 &&
          Math.abs(prev.width - next.width) < 0.5 &&
          Math.abs(prev.height - next.height) < 0.5
        ) {
          return prev;
        }
        return next;
      });
    };
    measure();
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    const id = window.setInterval(measure, 250);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
      window.clearInterval(id);
    };
  }, [target]);
  return box;
}

const COACH_MARK_WIDTH = 320;
const COACH_MARK_GAP = 16;

/**
 * Convert a spotlight bounding box into absolute top/left for the
 * coach-mark card. Prefer placing the card to the RIGHT of the
 * spotlight (most layouts have the rickhouse / market on the left
 * half), fall back to the LEFT when there's no room. When the box
 * is wider than half the viewport (full-row targets like the hand
 * tray) place the card ABOVE the target instead.
 */
function pinCoachMarkToBox(
  box: DOMRect,
  viewport: { w: number; h: number },
): { top: number; left: number } {
  const rightSpace = viewport.w - box.right - COACH_MARK_GAP * 2;
  const leftSpace = box.left - COACH_MARK_GAP * 2;
  const isWideTarget = box.width > viewport.w * 0.55;

  // Centered vertical anchor on the target, clamped so the card
  // never tucks under the top bar or runs off the bottom of the
  // viewport (estimated card height ~180px).
  const verticalAnchor = box.top + box.height / 2 - 80;
  const clampedTop = Math.max(72, Math.min(viewport.h - 220, verticalAnchor));

  if (isWideTarget) {
    // Stack above the target — leaves the spotlight ring uncovered
    // and centers the card over the row.
    return {
      top: Math.max(72, box.top - 200),
      left: Math.max(
        COACH_MARK_GAP,
        Math.min(viewport.w - COACH_MARK_WIDTH - COACH_MARK_GAP, box.left + box.width / 2 - COACH_MARK_WIDTH / 2),
      ),
    };
  }
  if (rightSpace >= COACH_MARK_WIDTH) {
    return { top: clampedTop, left: box.right + COACH_MARK_GAP };
  }
  if (leftSpace >= COACH_MARK_WIDTH) {
    return { top: clampedTop, left: box.left - COACH_MARK_WIDTH - COACH_MARK_GAP };
  }
  // No room either side — fall back to centered-above.
  return {
    top: Math.max(72, box.top - 200),
    left: Math.max(
      COACH_MARK_GAP,
      Math.min(viewport.w - COACH_MARK_WIDTH - COACH_MARK_GAP, box.left + box.width / 2 - COACH_MARK_WIDTH / 2),
    ),
  };
}

function CoachMark({
  beat,
  beatIndex,
  totalBeats,
  canGoBack,
  onBack,
}: {
  beat: Beat;
  beatIndex: number;
  totalBeats: number;
  canGoBack: boolean;
  onBack: () => void;
}) {
  // Action-button beats spotlight a control in the bottom action bar
  // (Sell, Make, Buy, etc.). Anchor just above the action bar so the
  // spotlight ring and the instructions sit in the same visual cluster.
  const nearActionBar =
    beat.kind === "await-action" && beat.spotlight?.kind === "action-button";

  // Every other spotlight (rickhouse-slot, market-slot, hand-card, …)
  // is anchored next to the spotlit element so the player's eyes
  // don't have to ping-pong between top-right copy and bottom-left
  // target. Box updates poll on a 250ms interval so the card tracks
  // layout shifts (drawer open, hand reshuffle).
  const box = useSpotlightBox(beat.spotlight);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const apply = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);

  // Animation key flips when the position changes meaningfully so the
  // pop-in plays each time the card relocates instead of just on
  // beat change.
  const positioned = box && viewport.w > 0 ? pinCoachMarkToBox(box, viewport) : null;

  const baseClass =
    "animate-bb-tour-pop pointer-events-auto fixed z-50 w-[320px] rounded-xl border-2 border-amber-400/80 bg-slate-900 p-4 shadow-[0_8px_30px_rgba(0,0,0,.7),0_0_28px_rgba(251,191,36,.16),inset_0_1px_0_rgba(251,191,36,.10)] transition-[top,left] duration-200 ease-out";
  const wrapperClass = nearActionBar
    ? `${baseClass} inset-x-0 bottom-52 mx-auto`
    : positioned
      ? baseClass
      : `${baseClass} right-6 top-20`;
  const wrapperStyle =
    !nearActionBar && positioned
      ? { top: positioned.top, left: positioned.left }
      : undefined;
  return (
    <div
      key={beat.id}
      className={wrapperClass}
      style={wrapperStyle}
    >
      <div className="flex items-center justify-between font-mono text-[12px] uppercase tracking-[.14em] text-amber-300/85">
        <ChapterProgress beatIndex={beatIndex} totalBeats={totalBeats} />
        <SkipLink />
      </div>
      {beat.title ? (
        <h3 className="mt-1 font-display text-lg font-bold text-amber-100">{beat.title}</h3>
      ) : null}
      <RichText className="mt-2 text-sm leading-snug text-slate-100">{beat.body}</RichText>
      {canGoBack ? (
        <div className="mt-3 flex justify-start">
          <button
            type="button"
            onClick={onBack}
            className="font-mono text-[12px] uppercase tracking-[.16em] text-slate-400 hover:text-amber-200"
          >
            ← Back to previous step
          </button>
        </div>
      ) : null}
    </div>
  );
}

function PromptCard({
  beat,
  canGoBack,
  onBack,
  onContinue,
  inspectGateOpen,
}: {
  beat: Beat;
  canGoBack: boolean;
  onBack: () => void;
  onContinue: () => void;
  inspectGateOpen: boolean;
}) {
  if (beat.kind !== "prompt") return null;
  // Chapter title-card — full-screen dim + centered big card. Mirrors
  // the BoardTour's interstitial style so each new lesson reads as a
  // chapter break rather than another bottom-of-screen coachmark.
  if (beat.chapter) {
    return (
      <ChapterCard
        beat={beat}
        chapter={beat.chapter}
        canGoBack={canGoBack}
        onBack={onBack}
        onContinue={onContinue}
      />
    );
  }
  // Position chrome — `top-right` is a smaller corner card that
  // doesn't collide with a centered inspect / decision modal.
  const isCorner = beat.position === "top-right";
  const wrapperClass = isCorner
    ? "pointer-events-auto fixed right-6 top-20 z-50 w-[360px]"
    : "pointer-events-auto fixed inset-x-0 bottom-24 z-50 mx-auto w-full max-w-md px-6";
  const cardClass = isCorner
    ? "animate-bb-tour-pop rounded-xl border-2 border-amber-400/80 bg-slate-900 p-4 shadow-[0_8px_30px_rgba(0,0,0,.7),0_0_28px_rgba(251,191,36,.16),inset_0_1px_0_rgba(251,191,36,.10)]"
    : "animate-bb-tour-pop rounded-xl border-2 border-amber-400/80 bg-slate-900 p-5 shadow-[0_8px_30px_rgba(0,0,0,.7),0_0_32px_rgba(251,191,36,.18),inset_0_1px_0_rgba(251,191,36,.10)]";
  return (
    <div className={wrapperClass}>
      <div key={beat.id} className={cardClass}>
        {beat.title ? (
          <h3 className={isCorner ? "font-display text-lg font-bold text-amber-100" : "font-display text-xl font-bold text-amber-100"}>{beat.title}</h3>
        ) : null}
        <RichText className={isCorner ? "mt-2 text-sm leading-snug text-slate-100" : "mt-2 text-sm leading-relaxed text-slate-100"}>{beat.body}</RichText>
        <div className="mt-4 flex items-center justify-between gap-3">
          <SkipLink />
          <div className="flex items-center gap-2">
            {canGoBack ? (
              <button
                type="button"
                onClick={onBack}
                className="rounded-md border-2 border-slate-600 bg-slate-900 px-4 py-2 font-mono text-[13px] uppercase tracking-[.14em] text-slate-200 hover:border-slate-400"
              >
                ← Back
              </button>
            ) : null}
            {/* Continue is hidden while an inspect-gate is unmet — the
                player has to right-click the named barrel to advance.
                The controller's auto-advance fires the moment the
                inspect lands on the right target, so this branch
                exists mainly for the gated copy that nudges the
                player toward the action. */}
            {inspectGateOpen ? (
              <button
                type="button"
                onClick={onContinue}
                className="rounded-md border border-amber-400 bg-gradient-to-b from-amber-300 to-amber-500 px-5 py-2 font-mono text-[13px] uppercase tracking-[.14em] text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,.25)] transition hover:from-amber-200 hover:to-amber-400"
              >
                {beat.ctaLabel ?? "Continue ↵"}
              </button>
            ) : (
              <span className="font-mono text-[12px] italic text-amber-200/70">
                Right-click to continue
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChapterCard({
  beat,
  chapter,
  canGoBack,
  onBack,
  onContinue,
}: {
  beat: Beat;
  chapter: { number: number; label: string };
  canGoBack: boolean;
  onBack: () => void;
  onContinue: () => void;
}) {
  if (beat.kind !== "prompt") return null;
  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-40 animate-bb-spot-fade bg-slate-950/85" />
      <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center px-6">
        <div
          key={beat.id}
          className="animate-bb-tour-pop w-full max-w-lg rounded-xl border-2 border-amber-400/80 bg-slate-900 p-7 shadow-[0_8px_40px_rgba(0,0,0,.7),0_0_36px_rgba(251,191,36,.18),inset_0_1px_0_rgba(251,191,36,.10)]"
        >
          <div className="flex items-center justify-between font-mono text-[12px] uppercase tracking-[.20em] text-amber-300">
            <span>Lesson {chapter.number} · {chapter.label}</span>
            <SkipLink />
          </div>
          {beat.title ? (
            <h2 className="mt-3 font-display text-3xl font-bold text-amber-100">
              {beat.title}
            </h2>
          ) : null}
          <RichText className="mt-3 text-base leading-relaxed text-slate-100">
            {beat.body}
          </RichText>
          <div className="mt-6 flex items-center justify-between gap-3">
            {canGoBack ? (
              <button
                type="button"
                onClick={onBack}
                className="rounded-md border-2 border-slate-600 bg-slate-900 px-4 py-2 font-mono text-[13px] uppercase tracking-[.14em] text-slate-200 hover:border-slate-400"
              >
                ← Back
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={onContinue}
              className="rounded-md border border-amber-400 bg-gradient-to-b from-amber-300 to-amber-500 px-6 py-2 font-mono text-[13px] uppercase tracking-[.14em] text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,.25)] transition hover:from-amber-200 hover:to-amber-400"
            >
              {beat.ctaLabel ?? "Let's go ↵"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function DecisionCard({
  beat,
  reply,
  onPick,
  onContinue,
}: {
  beat: Beat;
  reply: string | null;
  onPick: (which: "A" | "B") => void;
  onContinue: () => void;
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
          <>
            <RichText className="mt-4 rounded-md border border-amber-700/40 bg-amber-950/30 p-3 text-sm leading-relaxed text-amber-100">
              {reply}
            </RichText>
            {/* Was a 1800ms auto-close — players couldn't finish reading
                the longer reply. Now waits for an explicit Continue. */}
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={onContinue}
                className="rounded-md border border-amber-400 bg-gradient-to-b from-amber-300 to-amber-500 px-5 py-2 font-mono text-[13px] uppercase tracking-[.14em] text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,.25)] transition hover:from-amber-200 hover:to-amber-400"
              >
                Continue ↵
              </button>
            </div>
          </>
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
        <div className="font-mono text-[13px] uppercase tracking-[.20em] text-amber-300">
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
        <div className="font-mono text-[13px] uppercase tracking-[.20em] text-amber-300">
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
            className="rounded-md border border-amber-400 bg-gradient-to-b from-amber-300 to-amber-500 px-6 py-2 font-mono text-[13px] uppercase tracking-[.14em] text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,.25)] transition hover:from-amber-200 hover:to-amber-400"
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
            className="rounded-md border-2 border-slate-600 bg-slate-900 px-5 py-2 font-mono text-[13px] uppercase tracking-[.14em] text-slate-200 hover:border-slate-400"
          >
            {beat.replayLabel ?? "Replay tutorial"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-amber-400 bg-gradient-to-b from-amber-300 to-amber-500 px-5 py-2 font-mono text-[13px] uppercase tracking-[.14em] text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,.25)] hover:from-amber-200 hover:to-amber-400"
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
            className="rounded-md border-2 border-slate-600 bg-slate-900 px-5 py-2 font-mono text-[13px] uppercase tracking-[.14em] text-slate-200"
          >
            Replay
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-amber-400 bg-gradient-to-b from-amber-300 to-amber-500 px-5 py-2 font-mono text-[13px] uppercase tracking-[.14em] text-slate-950"
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
      className="font-mono text-[12px] uppercase tracking-[.16em] text-slate-500 hover:text-amber-200"
    >
      Skip tutorial ↵
    </Link>
  );
}

// Suppress unused-warning in CI; the export is intentional.
void TUTORIAL_HUMAN_ID;
