"use client";

/**
 * LineCardDraftModal — handles both v3.0 Line system card-keep
 * decisions:
 *
 *   1. Initial draft (4 dealt at game init, keep EXACTLY 2)
 *   2. Mid-game DRAW (up to 3 revealed, keep AT LEAST 1)
 *
 * Self-gates on the local human's pending state. In multiplayer, the
 * local connection's seat is computed via `humanSeatPlayerId`; bots
 * (and other humans in MP) handle their own drafts and never trigger
 * this modal for the local viewer.
 *
 * Mirrors the chrome of StarterDeckDraftModal: backdrop blur + center
 * panel + confirm button. No scrollbars inside the panel.
 */

import { useEffect, useState } from "react";
import type { GameAction, LineCardInstance } from "@bourbonomics/engine";
import { useGameStore } from "@/lib/store/game";
import LineCardTile from "./LineCardTile";

type Mode =
  | { kind: "initial"; cards: LineCardInstance[] }
  | { kind: "draw"; cards: LineCardInstance[] };

export default function LineCardDraftModal() {
  const { state, humanSeatPlayerId, dispatch } = useGameStore();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const seatId = humanSeatPlayerId;
  const player = seatId
    ? state?.players.find((p) => p.id === seatId)
    : null;

  // Determine which mode (or no modal) every render. Effect resets
  // the local selection whenever the underlying pending state changes.
  const mode: Mode | null = player?.pendingInitialLineCardDraft
    ? { kind: "initial", cards: player.pendingInitialLineCardDraft.cards }
    : player?.pendingLineCardDraw
      ? { kind: "draw", cards: player.pendingLineCardDraw.cards }
      : null;

  // Reset selection when the card set changes (new modal opens).
  const modeKey = mode
    ? `${mode.kind}:${mode.cards.map((c) => c.instanceId).join(",")}`
    : "none";
  useEffect(() => {
    setSelected(new Set());
  }, [modeKey]);

  if (!state) return null;
  if (!player) return null;
  if (!mode) return null;
  // Don't compete with the distillery / starter-deck modals during
  // setup — wait until play opens. The engine allows
  // CHOOSE_INITIAL_LINE_CARDS in any phase, but UX-wise the draft
  // belongs to the same beat as the first turn.
  if (state.phase === "distillery_selection") return null;
  if (state.phase === "starter_deck_draft") return null;

  const requiredCount = mode.kind === "initial" ? 2 : null;
  const minCount = mode.kind === "draw" ? 1 : 2;
  const maxCount = mode.kind === "draw" ? mode.cards.length : 2;
  const canConfirm =
    requiredCount != null
      ? selected.size === requiredCount
      : selected.size >= minCount;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (requiredCount != null && next.size >= requiredCount) return prev;
        if (next.size >= maxCount) return prev;
        next.add(id);
      }
      return next;
    });
  };

  const onConfirm = () => {
    if (!canConfirm) return;
    const ids = Array.from(selected);
    const action: GameAction =
      mode.kind === "initial"
        ? {
            type: "CHOOSE_INITIAL_LINE_CARDS",
            playerId: player.id,
            keepInstanceIds: ids,
          }
        : {
            type: "KEEP_LINE_CARDS",
            playerId: player.id,
            keepInstanceIds: ids,
          };
    dispatch(action);
  };

  const title =
    mode.kind === "initial"
      ? "Choose 2 Line Cards to keep"
      : "Keep at least 1 Line Card";
  const subtitle =
    mode.kind === "initial"
      ? "Setup · Line Card draft"
      : "Line Card draw — round " + state.round;
  const hint =
    mode.kind === "initial"
      ? "These shape your brand portfolio. Match your distillery's style or hedge for variety."
      : "Any cards you don't keep return to the bottom of the deck.";

  const confirmLabel =
    mode.kind === "initial"
      ? `Keep ${selected.size} / 2 ↵`
      : `Keep ${selected.size} card${selected.size === 1 ? "" : "s"} ↵`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[56] flex items-center justify-center bg-slate-950/85 p-6 backdrop-blur"
    >
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[640px] w-[1100px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(251,191,36,0.22) 0%, transparent 65%)",
        }}
      />
      <div className="relative flex max-h-[calc(100vh-3rem)] w-full max-w-[1180px] flex-col items-center gap-6">
        <div className="text-center">
          <div className="font-mono text-[14px] uppercase tracking-[.22em] text-amber-300">
            {subtitle}
          </div>
          <div className="mt-2 font-display text-4xl font-semibold text-amber-100">
            {title}
          </div>
          <div className="mt-2 max-w-[820px] font-mono text-[13px] uppercase tracking-[.14em] text-slate-400">
            {hint}
          </div>
        </div>

        <div className="w-full rounded-xl border border-slate-800 bg-slate-950/60 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,.04),0_12px_36px_rgba(0,0,0,.55)]">
          <div className="flex flex-wrap justify-center gap-5">
            {mode.cards.map((inst) => (
              <LineCardTile
                key={inst.instanceId}
                instance={inst}
                selected={selected.has(inst.instanceId)}
                interactive
                onClick={() => toggle(inst.instanceId)}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={!canConfirm}
            onClick={onConfirm}
            className={
              canConfirm
                ? "rounded-md border border-amber-400 bg-gradient-to-b from-amber-300 to-amber-500 px-9 py-3 font-sans text-base font-bold uppercase tracking-[.06em] text-slate-950 shadow-[0_0_0_3px_rgba(251,191,36,0.30),inset_0_1px_0_rgba(255,255,255,0.25)] transition-all hover:from-amber-200 hover:to-amber-400"
                : "cursor-not-allowed rounded-md border border-slate-800 bg-slate-900 px-9 py-3 font-sans text-base font-bold uppercase tracking-[.06em] text-slate-600"
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
