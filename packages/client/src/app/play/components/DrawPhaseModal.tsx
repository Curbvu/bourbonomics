"use client";

/**
 * Draw-phase modal — interactive 8-card draw for the human player at the
 * start of every round. Bots auto-resolve their draws in the background
 * via the store's setup-phase auto-step (extended to cover round-loop
 * draws too).
 *
 * Renders only when:
 *   - state.phase === "draw"
 *   - the human seat hasn't drawn yet this round
 *   - autoplay is OFF (autoplay handles draws automatically)
 */

import { useEffect, useRef, useState } from "react";

import { useGameStore } from "@/lib/store/game";

const FAN_REVEAL_MS = 700;

export default function DrawPhaseModal() {
  const { state, autoplay, humanSeatPlayerId, dispatch } = useGameStore();
  const [stage, setStage] = useState<"idle" | "drawing" | "settled">("idle");
  // Guard against React strict-mode double-dispatching the same draw.
  const dispatchedRef = useRef<number>(-1);

  const round = state?.round ?? 0;
  useEffect(() => {
    setStage("idle");
  }, [round]);

  // After the fan animation, dispatch DRAW_HAND once per round.
  // `humanSeatPlayerId` is THIS connection's seat — in MP each
  // client draws for its own seat, not for "the first non-bot"
  // (which would always resolve to the host on every screen).
  useEffect(() => {
    if (stage !== "settled") return;
    if (!state) return;
    if (dispatchedRef.current === round) return;
    if (!humanSeatPlayerId) return;
    const id = window.setTimeout(() => {
      dispatchedRef.current = round;
      dispatch({ type: "DRAW_HAND", playerId: humanSeatPlayerId });
      setStage("idle");
    }, 220);
    return () => window.clearTimeout(id);
  }, [stage, state, dispatch, round, humanSeatPlayerId]);

  if (!state) return null;
  if (state.phase !== "draw") return null;
  if (autoplay) return null;

  const human = humanSeatPlayerId
    ? state.players.find((p) => p.id === humanSeatPlayerId)
    : null;
  if (!human) return null;
  if (state.playerIdsCompletedPhase.includes(human.id)) return null;

  const startDraw = () => {
    if (stage !== "idle") return;
    if (dispatchedRef.current === round) return;
    setStage("drawing");
    window.setTimeout(() => setStage("settled"), FAN_REVEAL_MS);
  };

  const willDrawCount = Math.min(human.handSize, human.deck.length + human.discard.length);
  const willDrawOps = state.operationsDeck.length > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Draw your round hand"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-6 backdrop-blur"
    >
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[440px] w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(99,102,241,0.28) 0%, transparent 65%)",
        }}
      />

      <div className="relative flex flex-col items-center gap-5">
        <div className="text-center">
          <div className="font-mono text-[11px] uppercase tracking-[.18em] text-indigo-300">
            Round {round} · Draw phase
          </div>
          <div className="mt-1 font-display text-2xl font-semibold text-amber-100">
            Draw your round hand
          </div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[.14em] text-slate-400">
            {human.name} · {willDrawCount} resource cards
            {willDrawOps ? " + 1 operations card" : ""}
          </div>
        </div>

        <CardFan
          stage={stage}
          count={willDrawCount}
          drawsOpsCard={willDrawOps}
          deckLeft={human.deck.length}
          discardLeft={human.discard.length}
        />

        <button
          type="button"
          onClick={startDraw}
          disabled={stage !== "idle"}
          className={[
            "rounded-md border px-6 py-2.5 font-sans text-sm font-bold uppercase tracking-[.05em] transition-all",
            stage === "idle"
              ? "border-amber-400 bg-gradient-to-b from-amber-300 to-amber-500 text-slate-950 shadow-[0_0_0_3px_rgba(251,191,36,0.30),inset_0_1px_0_rgba(255,255,255,0.25)] hover:from-amber-200 hover:to-amber-400"
              : "cursor-not-allowed border-slate-700 bg-slate-900 text-slate-600 shadow-none",
          ].join(" ")}
        >
          {stage === "idle"
            ? "Draw cards ↵"
            : stage === "drawing"
              ? "Drawing…"
              : "Drawn ✓"}
        </button>
      </div>
    </div>
  );
}

function CardFan({
  stage,
  count,
  drawsOpsCard,
  deckLeft,
  discardLeft,
}: {
  stage: "idle" | "drawing" | "settled";
  count: number;
  drawsOpsCard: boolean;
  deckLeft: number;
  discardLeft: number;
}) {
  // Fan up to `count + (1 if drawsOpsCard)` card backs across an arc.
  const total = count + (drawsOpsCard ? 1 : 0);
  const slots = Array.from({ length: total }, (_, i) => i);
  const isDrawing = stage !== "idle";
  return (
    <div className="relative flex h-[160px] w-[520px] items-center justify-center">
      {/* Source deck (left) */}
      <DeckBack label={`Deck · ${deckLeft}`} tone="amber" hidden={stage === "settled"} />
      {/* Fanned cards arc out from the deck on click */}
      <div className="relative h-full w-full">
        {slots.map((i) => {
          const t = total > 1 ? i / (total - 1) : 0.5;
          // Final landing positions: spread across center
          const finalX = -130 + t * 260;
          const finalY = Math.sin(t * Math.PI) * -16;
          const finalRot = -16 + t * 32;
          const isOps = drawsOpsCard && i === total - 1;
          return (
            <div
              key={i}
              className="absolute left-1/2 top-1/2"
              style={
                isDrawing
                  ? {
                      transform: `translate(calc(-50% + ${finalX}px), calc(-50% + ${finalY}px)) rotate(${finalRot}deg)`,
                      opacity: 1,
                      transitionProperty: "transform, opacity",
                      transitionDuration: "0.7s, 0.4s",
                      transitionTimingFunction:
                        "cubic-bezier(0.34, 1.2, 0.64, 1), ease-out",
                      transitionDelay: `${i * 50}ms, ${i * 50}ms`,
                    }
                  : {
                      transform: `translate(calc(-50% + ${finalX}px), calc(-50% + ${finalY}px)) rotate(${finalRot}deg)`,
                      opacity: 0,
                    }
              }
            >
              <CardBack tone={isOps ? "violet" : "indigo"} />
            </div>
          );
        })}
      </div>
      {/* Discard reshuffle hint (right) */}
      {discardLeft > 0 && deckLeft < count ? (
        <DeckBack label={`Reshuffle ${discardLeft}`} tone="slate" hidden={stage === "settled"} />
      ) : null}
    </div>
  );
}

function DeckBack({
  label,
  tone,
  hidden,
}: {
  label: string;
  tone: "amber" | "slate";
  hidden: boolean;
}) {
  const chrome =
    tone === "amber"
      ? "border-amber-500/70 bg-[linear-gradient(160deg,rgba(120,53,15,.65)_0%,rgba(15,23,42,.95)_75%)] text-amber-100"
      : "border-slate-600/70 bg-[linear-gradient(160deg,rgba(51,65,85,.6)_0%,rgba(15,23,42,.95)_75%)] text-slate-200";
  return (
    <div
      className={[
        "absolute top-1/2 flex h-[100px] w-[72px] -translate-y-1/2 flex-col items-center justify-center rounded-md border-2 shadow-[0_4px_12px_rgba(0,0,0,.5)] ring-1 ring-white/10 transition-opacity duration-200",
        chrome,
        hidden ? "opacity-30" : "opacity-100",
        tone === "amber" ? "left-2" : "right-2",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-2 rounded border border-white/10" aria-hidden />
      <span className="font-display text-[16px] font-bold tabular-nums">
        {label.replace(/^[A-Za-z]+ · |^[A-Za-z]+ /, "")}
      </span>
      <span className="mt-0.5 font-mono text-[8px] uppercase tracking-[.14em] opacity-70">
        {label.split(" ")[0]}
      </span>
    </div>
  );
}

function CardBack({ tone }: { tone: "indigo" | "violet" }) {
  const chrome =
    tone === "violet"
      ? "border-violet-400 bg-[linear-gradient(160deg,rgba(76,29,149,.85)_0%,rgba(15,23,42,.95)_75%)]"
      : "border-indigo-400 bg-[linear-gradient(160deg,rgba(49,46,129,.85)_0%,rgba(15,23,42,.95)_75%)]";
  return (
    <div
      className={[
        "h-[100px] w-[72px] rounded-md border-2 shadow-[0_8px_22px_rgba(0,0,0,.5),inset_0_1px_0_rgba(255,255,255,.15)]",
        chrome,
      ].join(" ")}
    >
      <div className="pointer-events-none m-2 h-[calc(100%-1rem)] rounded border border-white/15" aria-hidden />
    </div>
  );
}
