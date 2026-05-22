"use client";

/**
 * v2.14 Drafting Loop overlay.
 *
 * Two modes:
 *
 *   1. **Initiate** — the human has clicked "Draft" but no loop is
 *      active yet. The bar prompts them to tag one card from hand;
 *      Confirm dispatches `INITIATE_DRAFTING_LOOP` and the engine
 *      transitions into the loop sub-phase.
 *
 *   2. **Loop active** — `state.draftingLoop` is non-null. The bar
 *      shows the pile + revealed bills + buttons. If it's the human's
 *      turn in the loop, the action buttons are live; otherwise a
 *      "waiting on X" indicator is shown.
 *
 * The legacy name DrawBillOverlay is kept so existing imports in
 * GameBoard / play page continue to resolve without churn.
 */

import { useEffect, useMemo, useState } from "react";
import type { Card, MashBill } from "@bourbonomics/engine";
import { useGameStore } from "@/lib/store/game";

export default function DraftingLoopOverlay() {
  const {
    state,
    drawBillMode,
    cancelDrawBillMode,
    confirmDrawBill,
    dispatch,
    multiplayerMode,
  } = useGameStore();

  // Track body data-attr so existing CSS focus-modes still apply.
  useEffect(() => {
    const root = typeof document !== "undefined" ? document.body : null;
    if (!root) return;
    if (drawBillMode || state?.draftingLoop) {
      root.setAttribute("data-draw-mode", "drafting-loop");
    } else {
      root.removeAttribute("data-draw-mode");
    }
    return () => {
      root.removeAttribute("data-draw-mode");
    };
  }, [drawBillMode, state?.draftingLoop]);

  if (!state) return null;
  const loop = state.draftingLoop;

  // Loop is active — render the loop bar (takes priority over an
  // initiate picker that somehow lingers).
  if (loop) {
    const humanId = multiplayerMode
      ? multiplayerMode.playerId
      : state.players.find((p) => !p.isBot)?.id;
    return <LoopBar humanId={humanId ?? null} dispatch={dispatch} />;
  }

  // Initiate picker.
  if (!drawBillMode) return null;
  const human = state.players.find((p) => !p.isBot);
  if (!human) return null;
  const picked = drawBillMode.spendCardIds[0]
    ? human.hand.find((c) => c.id === drawBillMode.spendCardIds[0])
    : null;
  const canConfirm = picked != null;
  return (
    <div className="border-t border-amber-700/60 bg-gradient-to-b from-amber-950/50 to-slate-950 px-[18px] py-2">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded border border-amber-500 bg-amber-700/30 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[.14em] text-amber-100">
          Drafting loop
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[.10em] text-slate-300">
          Tag one card to seed the draft pile and reveal 3 bills.
        </span>
        {picked ? (
          <span className="font-display text-[13px] font-semibold text-amber-100">
            Seed: {cardLabel(picked)}
          </span>
        ) : (
          <span className="font-mono text-[10px] italic text-slate-400">
            (click a card in your hand)
          </span>
        )}
        <button
          type="button"
          onClick={cancelDrawBillMode}
          className="rounded-md border border-rose-700/60 bg-rose-900/30 px-3 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[.08em] text-rose-100 transition-colors hover:border-rose-400 hover:bg-rose-800/40"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!canConfirm}
          onClick={canConfirm ? confirmDrawBill : undefined}
          className={
            canConfirm
              ? "rounded-md border border-amber-300 bg-gradient-to-b from-amber-300 to-amber-600 px-5 py-1.5 font-sans text-[13px] font-bold uppercase tracking-[.07em] text-slate-950 hover:from-amber-200 hover:to-amber-500"
              : "rounded-md border border-slate-800 bg-slate-900 px-5 py-1.5 font-sans text-[13px] font-bold uppercase tracking-[.07em] text-slate-600 cursor-not-allowed"
          }
        >
          Initiate ↵
        </button>
      </div>
    </div>
  );
}

/**
 * Active-loop bar. Surfaces the pile + revealed bills + per-picker
 * controls. Reads the loop straight off `state.draftingLoop` so the
 * UI always mirrors the engine.
 */
function LoopBar({
  humanId,
  dispatch,
}: {
  humanId: string | null;
  dispatch: (action: import("@bourbonomics/engine").GameAction) => void;
}) {
  const { state } = useGameStore();
  const loop = state?.draftingLoop;
  // Selected bill (for take-bill flow) and selected pile cards (for
  // take-card scavenging). Reset whenever the active picker changes.
  const [pickedBillId, setPickedBillId] = useState<string | null>(null);
  const [selectedPileIds, setSelectedPileIds] = useState<string[]>([]);
  const currentPickerId = loop?.pickOrder[loop.pickerIndex] ?? null;
  useEffect(() => {
    setPickedBillId(null);
    setSelectedPileIds([]);
  }, [currentPickerId]);

  const picker = useMemo(
    () =>
      currentPickerId
        ? state?.players.find((p) => p.id === currentPickerId) ?? null
        : null,
    [state, currentPickerId],
  );
  if (!loop || !currentPickerId) return null;

  const isHumansTurn = humanId != null && currentPickerId === humanId;
  const human = humanId
    ? state?.players.find((p) => p.id === humanId) ?? null
    : null;

  const pickedBill = pickedBillId
    ? loop.revealedBills.find((b) => b.id === pickedBillId)
    : null;

  return (
    <div className="border-t border-amber-700/60 bg-gradient-to-b from-amber-950/50 to-slate-950 px-[18px] py-2">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded border border-amber-500 bg-amber-700/30 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[.14em] text-amber-100">
          Drafting loop
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[.10em] text-slate-300">
          Picker:{" "}
          <span className="font-bold text-amber-200">
            {picker?.name ?? currentPickerId}
          </span>
          {loop.initiatorId === currentPickerId ? " (initiator)" : ""}
          {" · stage "}
          <span className="text-amber-200">{loop.pickerStage}</span>
        </span>

        <PileStrip
          pile={loop.draftPile}
          interactive={isHumansTurn && loop.pickerStage === "card"}
          selectedIds={selectedPileIds}
          onToggle={(id) =>
            setSelectedPileIds((cur) =>
              cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
            )
          }
        />

        <BillStrip
          bills={loop.revealedBills}
          pickedId={pickedBillId}
          interactive={isHumansTurn}
          onPick={setPickedBillId}
        />

        {!isHumansTurn ? (
          <span className="font-mono text-[10px] italic text-slate-400">
            Waiting on {picker?.name ?? currentPickerId}…
          </span>
        ) : pickedBill && human ? (
          <PayBillPrompt
            bill={pickedBill}
            hand={human.hand}
            onPay={(cardId) => {
              dispatch({
                type: "DRAFT_TAKE_BILL",
                playerId: humanId!,
                mashBillId: pickedBill.id,
                paymentCardId: cardId,
              });
              setPickedBillId(null);
            }}
            onCancel={() => setPickedBillId(null)}
          />
        ) : (
          <>
            {selectedPileIds.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  dispatch({
                    type: "DRAFT_TAKE_CARD",
                    playerId: humanId!,
                    cardIds: selectedPileIds,
                  });
                  setSelectedPileIds([]);
                }}
                className="rounded-md border border-emerald-500 bg-emerald-900/40 px-3 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[.08em] text-emerald-100 hover:bg-emerald-800/50"
              >
                Take {selectedPileIds.length} card{selectedPileIds.length === 1 ? "" : "s"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() =>
                dispatch({ type: "DRAFT_PASS", playerId: humanId! })
              }
              className="rounded-md border border-slate-500 bg-slate-800/60 px-3 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[.08em] text-slate-100 hover:bg-slate-700/60"
            >
              Pass →
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function PileStrip({
  pile,
  interactive,
  selectedIds,
  onToggle,
}: {
  pile: Card[];
  interactive: boolean;
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      <span className="font-mono text-[9px] uppercase tracking-[.14em] text-slate-500">
        pile
      </span>
      {pile.length === 0 ? (
        <span className="font-mono text-[10px] italic text-slate-500">empty</span>
      ) : (
        pile.map((c) => {
          const selected = selectedIds.includes(c.id);
          const className = interactive
            ? `rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[.06em] cursor-pointer ${
                selected
                  ? "border-amber-300 bg-amber-700/40 text-amber-100"
                  : "border-slate-600 bg-slate-800/60 text-slate-200 hover:border-amber-300"
              }`
            : "rounded border border-slate-700 bg-slate-900/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[.06em] text-slate-400";
          return (
            <button
              key={c.id}
              type="button"
              disabled={!interactive}
              onClick={interactive ? () => onToggle(c.id) : undefined}
              className={className}
              title={cardLabel(c)}
            >
              {cardLabel(c)}
            </button>
          );
        })
      )}
    </span>
  );
}

function BillStrip({
  bills,
  pickedId,
  interactive,
  onPick,
}: {
  bills: MashBill[];
  pickedId: string | null;
  interactive: boolean;
  onPick: (id: string) => void;
}) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      <span className="font-mono text-[9px] uppercase tracking-[.14em] text-slate-500">
        bills
      </span>
      {bills.length === 0 ? (
        <span className="font-mono text-[10px] italic text-slate-500">none</span>
      ) : (
        bills.map((b) => {
          const selected = pickedId === b.id;
          const className = interactive
            ? `rounded border px-2 py-0.5 font-display text-[11px] font-semibold cursor-pointer ${
                selected
                  ? "border-amber-300 bg-amber-700/40 text-amber-100"
                  : "border-slate-600 bg-slate-800/60 text-amber-200 hover:border-amber-300"
              }`
            : "rounded border border-slate-700 bg-slate-900/60 px-2 py-0.5 font-display text-[11px] font-semibold text-amber-200/70";
          return (
            <button
              key={b.id}
              type="button"
              disabled={!interactive}
              onClick={interactive ? () => onPick(b.id) : undefined}
              className={className}
              title={b.name}
            >
              {b.name}
            </button>
          );
        })
      )}
    </span>
  );
}

function PayBillPrompt({
  bill,
  hand,
  onPay,
  onCancel,
}: {
  bill: MashBill;
  hand: Card[];
  onPay: (cardId: string) => void;
  onCancel: () => void;
}) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[.10em] text-amber-200">
        Pay for {bill.name}:
      </span>
      {hand.length === 0 ? (
        <span className="font-mono text-[10px] italic text-rose-300">no cards in hand</span>
      ) : (
        hand.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onPay(c.id)}
            className="rounded border border-emerald-700/60 bg-emerald-900/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[.06em] text-emerald-100 hover:border-emerald-400"
            title={cardLabel(c)}
          >
            {cardLabel(c)}
          </button>
        ))
      )}
      <button
        type="button"
        onClick={onCancel}
        className="rounded-md border border-slate-600 bg-slate-800/60 px-3 py-1 font-mono text-[10px] uppercase tracking-[.06em] text-slate-200 hover:bg-slate-700/60"
      >
        ← Back
      </button>
    </span>
  );
}

function cardLabel(c: Card): string {
  if (c.displayName) return c.displayName;
  if (c.type === "labor") {
    const sub = c.laborSubtype ?? "labor";
    return `${sub} Labor`;
  }
  if (c.subtype) {
    const prefix = c.specialty ? "Sp. " : "";
    return `${prefix}${c.subtype}`;
  }
  return c.cardDefId;
}
