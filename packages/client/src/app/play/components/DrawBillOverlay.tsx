"use client";

/**
 * Drafting Loop modal.
 *
 * Replaces the older inline drafting strip. The whole loop interaction
 * (seed pick → bill reveal → bill take / card take / pass) happens
 * inside a single centered modal so the player can see every relevant
 * surface — revealed bills, draft pile, hand — at once.
 *
 * The component name `DrawBillOverlay` is kept for the existing
 * imports in HandTray / GameBoard.
 *
 * Click flow:
 *   1. ActionBar "Draft bills" opens the modal in **seed** state.
 *   2. Clicking any card in the modal's hand row immediately
 *      dispatches `INITIATE_DRAFTING_LOOP` — no separate confirm step.
 *   3. With the loop active and on your turn:
 *        - stage "bill": click a bill card → click a hand card to pay
 *          → dispatches `DRAFT_TAKE_BILL`.
 *        - stage "card": tap cards in the draft pile to multi-select,
 *          then "Take N cards" dispatches `DRAFT_TAKE_CARD`.
 *      The "Pass" button always dispatches `DRAFT_PASS` on your turn.
 *   4. Off-turn picks (bots) keep the modal open but inert — every
 *      surface renders as a read-only preview with "Waiting on X…".
 */

import { useEffect, useMemo, useState } from "react";
import type {
  Card,
  GameAction,
  MashBill,
  ResourceSubtype,
} from "@bourbonomics/engine";
import { useGameStore } from "@/lib/store/game";
import {
  LABOR_CHROME,
  RESOURCE_CHROME,
  RESOURCE_GLYPH,
  RESOURCE_LABEL,
  laborGlyphFor,
} from "./handCardStyles";
import { TIER_CHROME, tierOrCommon } from "./tierStyles";
import RecipePips from "./RecipePips";

export default function DraftingLoopOverlay() {
  const {
    state,
    drawBillMode,
    cancelDrawBillMode,
    dispatch,
    multiplayerMode,
    triggerDraftPickAnimation,
  } = useGameStore();

  if (!state) return null;
  const loop = state.draftingLoop;

  const humanId = multiplayerMode
    ? multiplayerMode.playerId
    : state.players.find((p) => !p.isBot)?.id ?? null;
  const human = humanId ? state.players.find((p) => p.id === humanId) ?? null : null;

  // New "draft-once-then-close" gate: the modal opens for the human's
  // seed pick and stays open while THEY are the current picker. Once
  // the picker advances to a bot (or the loop closes), the modal
  // unmounts and the bots' picks resolve silently via the autoplay
  // loop — players follow along in the Tasting Notes log. The seed
  // card and chosen bill get a card→pile + bill→slot flight via
  // DraftPickFlight, mounted at the page root.
  const humanIsPicker =
    loop != null &&
    human != null &&
    loop.pickOrder[loop.pickerIndex] === human.id;
  const open = drawBillMode != null || humanIsPicker;

  // Body data-attr is kept so any CSS focus-modes that listened to the
  // legacy overlay continue to apply. Mirrors the modal's open gate.
  useEffect(() => {
    const root = typeof document !== "undefined" ? document.body : null;
    if (!root) return;
    if (open) {
      root.setAttribute("data-draw-mode", "drafting-loop");
    } else {
      root.removeAttribute("data-draw-mode");
    }
    return () => {
      root.removeAttribute("data-draw-mode");
    };
  }, [open]);

  // Clear drawBillMode the instant a Drafting Loop becomes active. The
  // store sets drawBillMode when the human clicks "Draft bills" and
  // never clears it on its own — pre-refactor that didn't matter
  // because the modal stayed open through the whole loop, but the new
  // "close once picker advances past human" gate uses `drawBillMode`
  // as a seed-mode signal. Letting it linger after the loop ends
  // would flip the modal right back into seed mode the moment the
  // bots wrap their picks. The seedMode-vs-active hand-off only
  // works if drawBillMode is dropped on entry to the live loop.
  useEffect(() => {
    if (loop && drawBillMode) cancelDrawBillMode();
  }, [loop, drawBillMode, cancelDrawBillMode]);

  if (!open) return null;
  if (!human) return null;

  return (
    <DraftingLoopModal
      humanId={human.id}
      hand={human.hand}
      loop={loop}
      seedMode={drawBillMode != null && loop == null}
      cancelSeed={cancelDrawBillMode}
      dispatch={dispatch}
      triggerDraftPickAnimation={triggerDraftPickAnimation}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────
// Modal body
// ─────────────────────────────────────────────────────────────────────

function DraftingLoopModal({
  humanId,
  hand,
  loop,
  seedMode,
  cancelSeed,
  dispatch,
  triggerDraftPickAnimation,
}: {
  humanId: string;
  hand: Card[];
  loop: import("@bourbonomics/engine").DraftingLoopState | null;
  seedMode: boolean;
  cancelSeed: () => void;
  dispatch: (action: GameAction) => void;
  triggerDraftPickAnimation: (
    payload: Omit<
      import("@/lib/store/game").LastDraftPick,
      "seq"
    >,
  ) => void;
}) {
  const { state } = useGameStore();
  const currentPickerId = loop?.pickOrder[loop.pickerIndex] ?? null;
  const picker = useMemo(
    () =>
      currentPickerId
        ? state?.players.find((p) => p.id === currentPickerId) ?? null
        : null,
    [state, currentPickerId],
  );

  const isHumansTurn = currentPickerId === humanId;
  const stage = loop?.pickerStage ?? null;

  // Bill take is a 2-click flow inside the modal: pick a bill, then
  // pick a hand card to pay. `pickedBillId` is the in-flight selection.
  const [pickedBillId, setPickedBillId] = useState<string | null>(null);
  // Card-take stage is multi-select against the draft pile.
  const [selectedPileIds, setSelectedPileIds] = useState<string[]>([]);
  // Reset selection whenever the active picker rolls forward — stale
  // selections from the prior picker shouldn't leak across turns.
  useEffect(() => {
    setPickedBillId(null);
    setSelectedPileIds([]);
  }, [currentPickerId, stage]);

  const pickedBill = pickedBillId
    ? loop?.revealedBills.find((b) => b.id === pickedBillId) ?? null
    : null;

  const status = buildStatus({
    seedMode,
    loop,
    isHumansTurn,
    stage,
    pickerName: picker?.name ?? null,
    pickedBill,
    pileSize: loop?.draftPile.length ?? 0,
  });

  // Hand click handler depends on the active phase. In seed mode any
  // hand card immediately initiates the loop. While paying for a bill,
  // a hand card pays. Otherwise the hand row is read-only.
  const handMode: HandMode = seedMode
    ? "seed"
    : pickedBill && isHumansTurn
      ? "pay"
      : "view";

  const onHandClick = (cardId: string) => {
    if (handMode === "seed") {
      // Dispatch and let the engine accept/reject. On success the
      // `loop` effect below clears drawBillMode; on rejection the
      // modal stays in seed mode so the user can pick another card.
      dispatch({
        type: "INITIATE_DRAFTING_LOOP",
        playerId: humanId,
        cardId,
      });
      return;
    }
    if (handMode === "pay" && pickedBill) {
      // Capture the bill's DOM rect BEFORE dispatch — the modal
      // unmounts in the same render cycle (picker advances to a bot
      // on the auto-pass below, which trips the open-gate to false),
      // so the revealed-bill node is gone by the time DraftPickFlight
      // measures positions.
      const billEl = document.querySelector<HTMLElement>(
        `[data-revealed-bill-id="${pickedBill.id}"]`,
      );
      const r = billEl?.getBoundingClientRect();
      const billStartRect = r
        ? { x: r.left, y: r.top, w: r.width, h: r.height }
        : { x: window.innerWidth / 2, y: window.innerHeight / 2, w: 220, h: 140 };

      // The spent card snapshot is for the flight ghost's chrome.
      const spent = hand.find((c) => c.id === cardId);

      // The engine's `placeBillInSlot` deposits into the first empty
      // slot the player owns — mirror that here so the animation
      // knows where to fly to, without waiting on the post-dispatch
      // state. If we miss (e.g. no slot, engine rejects), the flight
      // component bails harmlessly when its slot query returns null.
      const humanPlayer = state?.players.find((p) => p.id === humanId);
      const occupied = new Set(
        (state?.allBarrels ?? [])
          .filter((b) => b.ownerId === humanId)
          .map((b) => b.slotId),
      );
      const destSlot = humanPlayer?.rickhouseSlots.find((s) => !occupied.has(s.id));

      dispatch({
        type: "DRAFT_TAKE_BILL",
        playerId: humanId,
        mashBillId: pickedBill.id,
        paymentCardId: cardId,
      });
      // v3.6: NO auto-pass. The engine keeps pickerIndex on the same
      // player after TAKE_BILL, so the human can keep grabbing bills —
      // one card per pick — until they hit Pass (or until bills run
      // out / they have no rickhouse slots left). The Pass button in
      // the footer is now the only way the loop rotates.
      if (spent && destSlot) {
        triggerDraftPickAnimation({
          spentCard: spent,
          mashBillName: pickedBill.name,
          slotId: destSlot.id,
          ownerId: humanId,
          billStartRect,
        });
      }
      setPickedBillId(null);
    }
  };

  // Bill click — only active when it's your turn and you can still
  // take a bill. Toggling re-selects, clicking the same bill clears.
  const billsInteractive = loop != null && isHumansTurn;
  const onBillClick = (id: string) => {
    if (!billsInteractive) return;
    setPickedBillId((cur) => (cur === id ? null : id));
  };

  const pileInteractive =
    loop != null && isHumansTurn && stage === "card" && handMode !== "pay";
  const onPileToggle = (id: string) => {
    if (!pileInteractive) return;
    setSelectedPileIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  };

  const takeCards = () => {
    if (selectedPileIds.length === 0) return;
    dispatch({
      type: "DRAFT_TAKE_CARD",
      playerId: humanId,
      cardIds: selectedPileIds,
    });
    setSelectedPileIds([]);
  };

  const onPass = () => {
    dispatch({ type: "DRAFT_PASS", playerId: humanId });
    setPickedBillId(null);
    setSelectedPileIds([]);
  };

  // Esc closes the modal in seed-mode (cancel) — but never while a loop
  // is live, because the loop has to resolve via Pass / Take.
  useEffect(() => {
    if (!seedMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelSeed();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [seedMode, cancelSeed]);

  // Once the engine accepts INITIATE_DRAFTING_LOOP and `state.draftingLoop`
  // flips on, drop the lingering seed-mode flag so the modal renders the
  // active loop view (instead of the seed picker still claiming the hand
  // row). If the engine rejects the action `loop` stays null and the
  // modal remains in seed mode for a retry.
  useEffect(() => {
    if (loop && seedMode) cancelSeed();
  }, [loop, seedMode, cancelSeed]);

  const revealedBills = loop?.revealedBills ?? [];
  const draftPile = loop?.draftPile ?? [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Drafting Loop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-6 backdrop-blur"
    >
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[1000px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(251,191,36,0.20) 0%, transparent 65%)",
        }}
      />

      <div className="relative flex max-h-full w-full max-w-[1180px] flex-col gap-5 overflow-y-auto rounded-xl border border-amber-700/50 bg-gradient-to-b from-slate-950 to-slate-900/95 p-6 shadow-[0_24px_64px_rgba(0,0,0,.55)]">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[.18em] text-amber-300">
              Drafting loop
            </div>
            <div className="mt-1 font-display text-2xl font-semibold text-amber-100">
              {status.title}
            </div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-[.14em] text-slate-400">
              {status.subtitle}
            </div>
          </div>
          {seedMode ? (
            <button
              type="button"
              onClick={cancelSeed}
              aria-label="Cancel draft"
              className="rounded-md border border-rose-700/60 bg-rose-900/30 px-3 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[.08em] text-rose-100 transition-colors hover:border-rose-400 hover:bg-rose-800/40"
            >
              Cancel ✕
            </button>
          ) : null}
        </div>

        {/* Revealed mash bills — only after the loop is live. In seed
            mode the bills haven't been pulled yet, so the section would
            sit empty and confuse the read; skip it entirely. */}
        {loop ? (
          <Section
            label="Revealed mash bills"
            hint={
              revealedBills.length === 0
                ? "none left"
                : `${revealedBills.length} on offer`
            }
          >
            {revealedBills.length === 0 ? (
              <EmptyRow message="The bourbon deck had nothing more to reveal." />
            ) : (
              <div className="flex flex-wrap items-stretch gap-3">
                {revealedBills.map((bill) => (
                  <BillTile
                    key={bill.id}
                    bill={bill}
                    selected={pickedBillId === bill.id}
                    interactive={billsInteractive}
                    onClick={() => onBillClick(bill.id)}
                  />
                ))}
              </div>
            )}
          </Section>
        ) : null}

        {/* Draft pile — only when a loop is live (no pile in seed mode) */}
        {loop ? (
          <Section
            label="Draft pile"
            hint={
              draftPile.length === 0
                ? "empty"
                : `${draftPile.length} card${draftPile.length === 1 ? "" : "s"}`
            }
          >
            {draftPile.length === 0 ? (
              <EmptyRow message="No cards in the pile yet." />
            ) : (
              <div className="flex flex-wrap items-stretch gap-1.5">
                {draftPile.map((card) => (
                  <CardTile
                    key={card.id}
                    card={card}
                    selected={selectedPileIds.includes(card.id)}
                    interactive={pileInteractive}
                    onClick={() => onPileToggle(card.id)}
                  />
                ))}
              </div>
            )}
          </Section>
        ) : null}

        {/* Your hand */}
        <Section
          label={
            handMode === "seed"
              ? "Your hand — click a card to seed the loop"
              : handMode === "pay" && pickedBill
                ? `Pay for ${pickedBill.name} — click a card`
                : "Your hand"
          }
          hint={`${hand.length} card${hand.length === 1 ? "" : "s"}`}
        >
          {hand.length === 0 ? (
            <EmptyRow message="Your hand is empty." />
          ) : (
            <div className="flex flex-wrap items-stretch gap-1.5">
              {hand.map((card) => (
                <CardTile
                  key={card.id}
                  card={card}
                  interactive={handMode !== "view"}
                  selected={false}
                  onClick={() => onHandClick(card.id)}
                  tone={handMode === "pay" ? "pay" : handMode === "seed" ? "seed" : "view"}
                />
              ))}
            </div>
          )}
        </Section>

        {/* Action footer */}
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-800 pt-4">
          {loop ? (
            isHumansTurn ? (
              <>
                {stage === "card" && selectedPileIds.length > 0 ? (
                  <button
                    type="button"
                    onClick={takeCards}
                    className="rounded-md border border-emerald-500 bg-emerald-900/40 px-4 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[.08em] text-emerald-100 hover:bg-emerald-800/50"
                  >
                    Take {selectedPileIds.length} card{selectedPileIds.length === 1 ? "" : "s"} →
                  </button>
                ) : null}
                {pickedBill ? (
                  <button
                    type="button"
                    onClick={() => setPickedBillId(null)}
                    className="rounded-md border border-slate-600 bg-slate-800/60 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[.06em] text-slate-200 hover:bg-slate-700/60"
                  >
                    ← Back
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onPass}
                  className="rounded-md border border-slate-500 bg-slate-800/60 px-4 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[.08em] text-slate-100 hover:bg-slate-700/60"
                >
                  Pass →
                </button>
              </>
            ) : (
              <span className="font-mono text-[11px] italic text-slate-400">
                Waiting on {picker?.name ?? currentPickerId}…
              </span>
            )
          ) : seedMode ? (
            <span className="font-mono text-[10px] italic text-slate-500">
              Pick a card from your hand to seed the loop.
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type HandMode = "seed" | "pay" | "view";

// ─────────────────────────────────────────────────────────────────────
// Status line builder
// ─────────────────────────────────────────────────────────────────────

function buildStatus(args: {
  seedMode: boolean;
  loop: import("@bourbonomics/engine").DraftingLoopState | null;
  isHumansTurn: boolean;
  stage: import("@bourbonomics/engine").DraftingLoopPickerStage | null;
  pickerName: string | null;
  pickedBill: MashBill | null;
  pileSize: number;
}): { title: string; subtitle: string } {
  if (args.seedMode) {
    return {
      title: "Seed the draft pile",
      subtitle: "Click a hand card to spend it and reveal 3 mash bills.",
    };
  }
  if (!args.loop) {
    return { title: "Drafting Loop", subtitle: "" };
  }
  if (!args.isHumansTurn) {
    return {
      title: `Picker · ${args.pickerName ?? "—"}`,
      subtitle: "Watching the rest of the table draft.",
    };
  }
  if (args.pickedBill) {
    return {
      title: `Take ${args.pickedBill.name}`,
      subtitle: "Pay one card into the draft pile.",
    };
  }
  if (args.stage === "card") {
    return {
      title: "Your turn — scavenge or pass",
      subtitle: `Take cards from the pile (${args.pileSize}) or pass to lock in.`,
    };
  }
  return {
    title: "Your turn — take a bill",
    subtitle: "Pick one of the revealed mash bills to claim, or pass.",
  };
}

// ─────────────────────────────────────────────────────────────────────
// Section wrapper
// ─────────────────────────────────────────────────────────────────────

function Section({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[.18em] text-slate-400">
          {label}
        </span>
        {hint ? (
          <span className="font-mono text-[10px] uppercase tracking-[.12em] text-slate-500">
            {hint}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <div className="rounded border border-dashed border-slate-700/70 px-3 py-4 text-center font-mono text-[10px] italic text-slate-500">
      {message}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Mash bill card tile (compact)
// ─────────────────────────────────────────────────────────────────────

function BillTile({
  bill,
  selected,
  interactive,
  onClick,
}: {
  bill: MashBill;
  selected: boolean;
  interactive: boolean;
  onClick: () => void;
}) {
  const tier = tierOrCommon(bill.tier);
  const chrome = TIER_CHROME[tier];
  const stateClass = !interactive
    ? "opacity-70 cursor-default"
    : selected
      ? "ring-2 ring-amber-300 ring-offset-2 ring-offset-slate-950 scale-[1.02]"
      : "hover:scale-[1.02] hover:brightness-110 cursor-pointer";

  return (
    <button
      type="button"
      onClick={interactive ? onClick : undefined}
      disabled={!interactive}
      data-revealed-bill-id={bill.id}
      className={[
        "flex w-[220px] flex-col rounded-xl border-2 px-3.5 py-3 text-left transition-transform duration-150",
        chrome.border,
        chrome.gradient,
        chrome.glow,
        stateClass,
      ]
        .filter(Boolean)
        .join(" ")}
      title={bill.name}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className={`font-display text-[15px] font-bold leading-tight ${chrome.titleInk}`}>
            {bill.name}
          </div>
          {bill.slogan ? (
            <div className="mt-0.5 line-clamp-2 font-display text-[11px] italic leading-snug text-slate-400">
              “{bill.slogan}”
            </div>
          ) : null}
        </div>
        <span
          className={`flex-shrink-0 rounded border px-1.5 py-[2px] font-mono text-[9px] font-bold uppercase tracking-[.10em] ${chrome.pill}`}
        >
          {chrome.label_text}
        </span>
      </div>

      <div className="mt-2.5 rounded border border-slate-800/70 bg-slate-950/40 px-2 py-2">
        <div className="mb-1 text-center font-mono text-[8px] uppercase tracking-[.16em] text-slate-500">
          Recipe
        </div>
        <RecipePips bill={bill} />
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Card tile — used for both hand cards and draft-pile cards.
// Mirrors the visual treatment of StarterDeckDraftModal's DealtCardTile
// so cards in the modal read as the same physical objects as the hand.
// ─────────────────────────────────────────────────────────────────────

function CardTile({
  card,
  selected,
  interactive,
  onClick,
  tone = "view",
}: {
  card: Card;
  selected: boolean;
  interactive: boolean;
  onClick: () => void;
  tone?: "view" | "seed" | "pay" | "pile";
}) {
  const isLabor = card.type === "labor";
  const subtype = card.subtype as ResourceSubtype | undefined;
  const chrome = isLabor
    ? LABOR_CHROME
    : subtype
      ? RESOURCE_CHROME[subtype]
      : LABOR_CHROME;
  const laborSubtypeLabel =
    card.laborSubtype === "marketing" ? "Marketing" :
    card.laborSubtype === "cooper" ? "Cooper" :
    card.laborSubtype === "architect" ? "Architect" :
    "Labor";
  const label = isLabor
    ? laborSubtypeLabel
    : subtype
      ? RESOURCE_LABEL[subtype]
      : "Card";
  const glyph = isLabor
    ? laborGlyphFor(card.laborSubtype)
    : subtype
      ? RESOURCE_GLYPH[subtype]
      : "?";
  const count = card.resourceCount ?? 1;
  const showCount = !isLabor && count > 1;

  const ringClass = selected
    ? "ring-2 ring-amber-300 ring-offset-1 ring-offset-slate-950 shadow-[0_0_18px_rgba(251,191,36,.45)]"
    : interactive
      ? tone === "pay"
        ? "hover:ring-2 hover:ring-emerald-300 hover:scale-[1.05] cursor-pointer"
        : "hover:ring-2 hover:ring-amber-300 hover:scale-[1.05] cursor-pointer"
      : "opacity-80 cursor-default";

  return (
    <button
      type="button"
      onClick={interactive ? onClick : undefined}
      disabled={!interactive}
      title={card.displayName ?? label}
      className={[
        "flex h-[110px] w-[78px] flex-col items-center justify-center gap-1 overflow-hidden rounded-md border-2 shadow-[0_4px_10px_rgba(0,0,0,.45)] transition-transform duration-150",
        chrome.gradient,
        chrome.border,
        ringClass,
      ].join(" ")}
    >
      <span className={`text-3xl ${chrome.ink}`}>{glyph}</span>
      <span className={`font-mono text-[9px] uppercase tracking-[.12em] ${chrome.label}`}>
        {label}
        {showCount ? ` ×${count}` : ""}
      </span>
    </button>
  );
}
