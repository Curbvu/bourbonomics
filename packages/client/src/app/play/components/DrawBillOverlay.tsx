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

import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  AwardCondition,
  Card,
  GameAction,
  MashBill,
} from "@bourbonomics/engine";
import { useGameStore } from "@/lib/store/game";
import {
  RESOURCE_CHROME,
  RESOURCE_GLYPH,
} from "./handCardStyles";
import { TIER_CHROME, tierOrCommon, type TierChrome } from "./tierStyles";
import RecipePips from "./RecipePips";
import HandCardTile from "./HandCardTile";
import HandFan from "./HandFan";

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur"
    >
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[1000px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(251,191,36,0.20) 0%, transparent 65%)",
        }}
      />

      <div className="relative flex max-h-[calc(100vh-2rem)] w-full max-w-[1180px] flex-col overflow-hidden rounded-xl border border-amber-700/50 bg-gradient-to-b from-slate-950 to-slate-900/95 px-5 py-4 shadow-[0_24px_64px_rgba(0,0,0,.55)]">
        {/* Header — flex-shrink-0 so it stays pinned at the top even
            when the body shrinks. */}
        <div className="flex flex-shrink-0 items-start justify-between gap-4">
          <div>
            <div className="font-mono text-[13px] uppercase tracking-[.18em] text-amber-300">
              Drafting loop
            </div>
            <div className="mt-1 font-display text-2xl font-semibold text-amber-100">
              {status.title}
            </div>
            <div className="mt-1 font-mono text-[12px] uppercase tracking-[.14em] text-slate-400">
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

        {/* Body — flex-1 min-h-0 lets the sections collectively share
            the remaining height between header and footer without
            pushing the footer off-screen. `overflow-visible` here is
            intentional: the modal root keeps the rounded-corner clip,
            but a hover-lifted hand card needs to extend past the
            hand-section's bottom edge into the footer gutter without
            being sheared. */}
        <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3 overflow-visible">
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
            flex
            minHeight={260}
          >
            {revealedBills.length === 0 ? (
              <EmptyRow message="The bourbon deck had nothing more to reveal." />
            ) : (
              <div className="flex h-full w-full items-stretch gap-3 overflow-x-auto">
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
            height={180}
          >
            {draftPile.length === 0 ? (
              <EmptyRow message="No cards in the pile yet." />
            ) : (
              <div className="flex w-full items-center gap-1.5 overflow-x-auto">
                {draftPile.map((card) => (
                  <HandCardTile
                    key={card.id}
                    card={card}
                    size="md"
                    selected={selectedPileIds.includes(card.id)}
                    interactive={pileInteractive}
                    onClick={() => onPileToggle(card.id)}
                    tone="amber"
                  />
                ))}
              </div>
            )}
          </Section>
        ) : null}

        {/* Your hand — same fan layout as the in-game HandTray so the
            modal hand reads as the player's actual hand. */}
        <Section
          label={
            handMode === "seed"
              ? "Your hand — click a card to seed the loop"
              : handMode === "pay" && pickedBill
                ? `Pay for ${pickedBill.name} — click a card`
                : "Your hand"
          }
          hint={`${hand.length} card${hand.length === 1 ? "" : "s"}`}
          height={loop ? 220 : 240}
          allowOverflow
        >
          {hand.length === 0 ? (
            <EmptyRow message="Your hand is empty." />
          ) : (
            <HandFan>
              {hand.map((card) => (
                <HandCardTile
                  key={card.id}
                  card={card}
                  size="md"
                  interactive={handMode !== "view"}
                  selected={false}
                  onClick={() => onHandClick(card.id)}
                  tone={handMode === "pay" ? "emerald" : "amber"}
                />
              ))}
            </HandFan>
          )}
        </Section>
        </div>

        {/* Action footer — pinned with flex-shrink-0 so Pass / Take /
            Back / status are always reachable even when the modal is
            squeezed. */}
        <div className="mt-3 flex flex-shrink-0 flex-wrap items-center justify-end gap-3 border-t border-slate-800 pt-3">
          {loop ? (
            isHumansTurn ? (
              <>
                {stage === "card" && selectedPileIds.length > 0 ? (
                  <button
                    type="button"
                    onClick={takeCards}
                    className="rounded-md border border-emerald-500 bg-emerald-900/40 px-4 py-1.5 font-mono text-[13px] font-semibold uppercase tracking-[.08em] text-emerald-100 hover:bg-emerald-800/50"
                  >
                    Take {selectedPileIds.length} card{selectedPileIds.length === 1 ? "" : "s"} →
                  </button>
                ) : null}
                {pickedBill ? (
                  <button
                    type="button"
                    onClick={() => setPickedBillId(null)}
                    className="rounded-md border border-slate-600 bg-slate-800/60 px-3 py-1.5 font-mono text-[13px] uppercase tracking-[.06em] text-slate-200 hover:bg-slate-700/60"
                  >
                    ← Back
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onPass}
                  className="rounded-md border border-slate-500 bg-slate-800/60 px-4 py-1.5 font-mono text-[13px] font-semibold uppercase tracking-[.08em] text-slate-100 hover:bg-slate-700/60"
                >
                  Pass →
                </button>
              </>
            ) : (
              <span className="font-mono text-[13px] italic text-slate-400">
                Waiting on {picker?.name ?? currentPickerId}…
              </span>
            )
          ) : seedMode ? (
            <span className="font-mono text-[12px] italic text-slate-500">
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
  height,
  minHeight,
  flex,
  allowOverflow,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  /** Fixed pixel height so the modal layout is deterministic — the
   *  section keeps this height regardless of viewport size. Mutually
   *  exclusive with `flex`. */
  height?: number;
  /** Lower bound when `flex` is true — the section can shrink to this
   *  but no further. */
  minHeight?: number;
  /** If true, the section becomes `flex-1 min-h-0` so it absorbs
   *  viewport squeeze instead of pushing siblings off-screen. Use on
   *  the section whose content is OK to clip / scroll internally. */
  flex?: boolean;
  /** If true, drop the outer + inner `overflow-hidden` so children can
   *  visibly lift past the section's bottom edge (used by the hand row
   *  so hover-lifted cards aren't sheared). */
  allowOverflow?: boolean;
}) {
  return (
    <div
      className={[
        "flex flex-col rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2",
        flex ? "min-h-0 flex-1" : "flex-shrink-0",
        allowOverflow ? "overflow-visible" : "overflow-hidden",
      ].join(" ")}
      style={{
        ...(height != null ? { height } : null),
        ...(minHeight != null ? { minHeight } : null),
      }}
    >
      <div className="mb-1.5 flex flex-shrink-0 items-baseline justify-between">
        <span className="font-mono text-[12px] uppercase tracking-[.18em] text-slate-400">
          {label}
        </span>
        {hint ? (
          <span className="font-mono text-[12px] uppercase tracking-[.12em] text-slate-500">
            {hint}
          </span>
        ) : null}
      </div>
      <div
        className={[
          "flex min-h-0 flex-1 items-stretch",
          allowOverflow ? "overflow-visible" : "overflow-hidden",
        ].join(" ")}
      >
        {children}
      </div>
    </div>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <div className="rounded border border-dashed border-slate-700/70 px-3 py-4 text-center font-mono text-[12px] italic text-slate-500">
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

  // Pull every non-null cell so we can quote the floor/peak rep range
  // in the table footer.
  const cells: number[] = [];
  for (const row of bill.rewardGrid) {
    for (const c of row) if (c != null) cells.push(c);
  }
  const peak = cells.length ? Math.max(...cells) : 0;
  const floor = cells.length ? Math.min(...cells) : 0;

  const ingredients = buildIngredientChips(bill);

  return (
    <button
      type="button"
      onClick={interactive ? onClick : undefined}
      disabled={!interactive}
      data-revealed-bill-id={bill.id}
      className={[
        "flex h-full w-[260px] flex-shrink-0 flex-col overflow-hidden rounded-xl border-2 px-3 py-2.5 text-left transition-transform duration-150",
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
          <div className={`font-display text-[16px] font-bold leading-tight ${chrome.titleInk}`}>
            {bill.name}
          </div>
          {bill.slogan ? (
            <div className="mt-0.5 line-clamp-1 font-display text-[11.5px] italic leading-snug text-slate-400">
              “{bill.slogan}”
            </div>
          ) : null}
        </div>
        <span
          className={`flex-shrink-0 rounded border px-1.5 py-[2px] font-mono text-[11px] font-bold uppercase tracking-[.10em] ${chrome.pill}`}
        >
          {chrome.label_text}
        </span>
      </div>

      {/* Rep table — the full age × demand payout grid, so a player can
          see exactly what each (age band, demand band) cell is worth and
          which cells trigger Silver / Gold. */}
      <div className="mt-2 rounded border border-amber-700/40 bg-slate-950/55 px-2 py-1.5">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[.14em] text-amber-300/80">
            Rep payout
          </span>
          <span className="font-mono text-[11px] tracking-[.10em] text-slate-400">
            <span className={chrome.titleInk}>{floor}–{peak}</span>
          </span>
        </div>
        <MiniRepTable bill={bill} chrome={chrome} />
      </div>

      {/* Ingredients — pip glance + chip-style breakdown showing exactly
          which cards the bill consumes. */}
      <div className="mt-1.5 rounded border border-slate-800/70 bg-slate-950/40 px-2 py-1.5">
        <div className="mb-1 text-center font-mono text-[11px] uppercase tracking-[.16em] text-slate-500">
          Ingredients
        </div>
        <RecipePips bill={bill} />
        <div className="mt-1.5 grid grid-cols-2 gap-1">
          {ingredients.map((chip, i) => (
            <span
              key={i}
              className={[
                "inline-flex items-center justify-center gap-1 rounded border px-1 py-[1px] font-mono text-[11px] uppercase tracking-[.04em]",
                chip.specialty
                  ? "border-amber-300/70 bg-amber-700/30 text-amber-100"
                  : chip.forbidden
                    ? "border-rose-700/50 bg-rose-950/30 opacity-80"
                    : chip.wild
                      ? "border-slate-600/60 bg-slate-900/60 text-slate-200"
                      : "border-white/10 bg-slate-950/70 text-slate-100",
              ].join(" ")}
            >
              <span className={`relative inline-block text-[13px] leading-none ${chip.tint}`}>
                {chip.glyph}
                {chip.forbidden ? (
                  <span
                    aria-hidden
                    className="absolute inset-0 grid place-items-center text-[12px] font-bold leading-none text-rose-300"
                  >
                    ✕
                  </span>
                ) : null}
              </span>
              <span>
                {chip.count && chip.count > 1 ? `${chip.count}× ` : ""}
                {chip.label}
              </span>
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Mini rep table — compact version of CardInspectModal's RewardMatrix.
// Same axis convention (age ↓, demand →) and same gold/silver tinting
// so a player who's studied bills in the inspect modal reads this
// the same way at a glance.
// ─────────────────────────────────────────────────────────────────────

function MiniRepTable({
  bill,
  chrome,
}: {
  bill: MashBill;
  chrome: TierChrome;
}) {
  const ageLabels = bill.ageBands.map((_, i) => bandLabel(bill.ageBands, i, "y"));
  const demandLabels = bill.demandBands.map((_, i) => bandLabel(bill.demandBands, i));
  const cols = bill.demandBands.length;
  return (
    <div
      className="grid items-stretch gap-[3px]"
      style={{ gridTemplateColumns: `auto repeat(${cols}, minmax(0, 1fr))` }}
    >
      <div
        className="flex items-end justify-end pr-0.5 font-mono text-[11px] font-semibold uppercase leading-tight tracking-[.10em] text-slate-500"
      >
        <span className="text-right">
          age ↓<br />dem →
        </span>
      </div>
      {demandLabels.map((label, ci) => (
        <div
          key={`dh-${ci}`}
          className={`grid place-items-center rounded-[3px] bg-slate-900/60 py-[2px] font-mono text-[12px] font-bold uppercase tabular-nums ${chrome.label}`}
        >
          {label}
        </div>
      ))}

      {bill.rewardGrid.map((row, ri) => {
        const nextAge = bill.ageBands[ri + 1];
        const ageHi = nextAge ?? Infinity;
        return (
          <Fragment key={`r-${ri}`}>
            <div
              className={`grid place-items-center rounded-[3px] bg-slate-900/60 px-1 font-mono text-[12px] font-bold uppercase tabular-nums ${chrome.label}`}
            >
              {ageLabels[ri]}
            </div>
            {row.map((cell, ci) => {
              const nextDemand = bill.demandBands[ci + 1];
              const demandHi = nextDemand ?? Infinity;
              const award = cellAward(bill, cell, ageHi, demandHi);
              return (
                <div
                  key={`${ri}-${ci}`}
                  className={[
                    "relative grid h-7 place-items-center rounded-[3px] border border-white/10",
                    awardCellBg(award, cell),
                  ].join(" ")}
                >
                  <span
                    className={[
                      "font-display text-[15px] font-bold leading-none tabular-nums drop-shadow-[0_1px_3px_rgba(0,0,0,.5)]",
                      cell == null
                        ? "text-slate-600"
                        : award != null
                          ? "text-slate-950"
                          : chrome.titleInk,
                    ].join(" ")}
                  >
                    {cell ?? "—"}
                  </span>
                  {award ? (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute right-[1px] top-[1px] text-[12px] leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,.55)]"
                    >
                      {award === "gold" ? "🥇" : "🥈"}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </Fragment>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Ingredient chip builder — mirrors CardInspectModal's RecipeGrid so
// the bill reads the same way in both surfaces. Specialty cards
// satisfy both their per-subtype minimum AND the `minSpecialty` floor,
// so the plain chip count is reduced by the specialty count for that
// subtype (no phantom "1 cask + 1 specialty cask" double-count).
// ─────────────────────────────────────────────────────────────────────

interface IngredientChip {
  glyph: ReactNode;
  label: string;
  count?: number;
  tint: string;
  wild?: boolean;
  specialty?: boolean;
  forbidden?: boolean;
}

function buildIngredientChips(bill: MashBill): IngredientChip[] {
  const r = bill.recipe ?? {};
  const sp = r.minSpecialty ?? {};
  const items: IngredientChip[] = [];

  const minCorn = Math.max(1, r.minCorn ?? 0);
  const minRye = r.minRye ?? 0;
  const minBarley = r.minBarley ?? 0;
  const minWheat = r.minWheat ?? 0;

  const plainCask = Math.max(0, 1 - (sp.cask ?? 0));
  const plainCorn = Math.max(0, minCorn - (sp.corn ?? 0));
  const plainRye = Math.max(0, minRye - (sp.rye ?? 0));
  const plainBarley = Math.max(0, minBarley - (sp.barley ?? 0));
  const plainWheat = Math.max(0, minWheat - (sp.wheat ?? 0));

  if (plainCask > 0) {
    items.push({
      glyph: RESOURCE_GLYPH.cask,
      label: "Cask",
      count: plainCask > 1 ? plainCask : undefined,
      tint: RESOURCE_CHROME.cask.label,
    });
  }
  if (plainCorn > 0) {
    items.push({
      glyph: RESOURCE_GLYPH.corn,
      label: "Corn",
      count: plainCorn,
      tint: RESOURCE_CHROME.corn.label,
    });
  }
  if (plainRye > 0) {
    items.push({
      glyph: RESOURCE_GLYPH.rye,
      label: "Rye",
      count: plainRye,
      tint: RESOURCE_CHROME.rye.label,
    });
  }
  if (plainBarley > 0) {
    items.push({
      glyph: RESOURCE_GLYPH.barley,
      label: "Barley",
      count: plainBarley,
      tint: RESOURCE_CHROME.barley.label,
    });
  }
  if (plainWheat > 0) {
    items.push({
      glyph: RESOURCE_GLYPH.wheat,
      label: "Wheat",
      count: plainWheat,
      tint: RESOURCE_CHROME.wheat.label,
    });
  }

  // Wild grain — when no specific grain is required, the universal
  // rule still demands ≥1 grain of any kind.
  const namedGrain = minRye + minBarley + minWheat;
  const minTotal = r.minTotalGrain ?? 0;
  const wildGrain = namedGrain === 0 ? 1 : Math.max(0, minTotal - namedGrain);
  if (wildGrain > 0) {
    items.push({
      glyph: "✦",
      label: "Any grain",
      count: wildGrain,
      tint: "text-slate-300",
      wild: true,
    });
  }

  for (const s of ["cask", "corn", "rye", "barley", "wheat"] as const) {
    const n = sp[s];
    if (n && n > 0) {
      items.push({
        glyph: RESOURCE_GLYPH[s],
        label: `★ Spec ${s.charAt(0).toUpperCase() + s.slice(1)}`,
        count: n > 1 ? n : undefined,
        tint: RESOURCE_CHROME[s].label,
        specialty: true,
      });
    }
  }

  if (r.maxRye === 0) {
    items.push({
      glyph: RESOURCE_GLYPH.rye,
      label: "No rye",
      tint: RESOURCE_CHROME.rye.label,
      forbidden: true,
    });
  }
  if (r.maxWheat === 0) {
    items.push({
      glyph: RESOURCE_GLYPH.wheat,
      label: "No wheat",
      tint: RESOURCE_CHROME.wheat.label,
      forbidden: true,
    });
  }

  return items;
}

// ─────────────────────────────────────────────────────────────────────
// Award / band helpers — light copies of CardInspectModal's versions
// so the BillTile renders the same gold/silver tinting and band labels
// without pulling in the modal's whole detail layout.
// ─────────────────────────────────────────────────────────────────────

function bandLabel(bands: readonly number[], idx: number, suffix = ""): string {
  const lo = bands[idx]!;
  const next = bands[idx + 1];
  if (next == null) return `${lo}+${suffix}`;
  return next - 1 === lo ? `${lo}${suffix}` : `${lo}–${next - 1}${suffix}`;
}

function cellAward(
  bill: MashBill,
  reward: number | null,
  ageHi: number,
  demandHi: number,
): "gold" | "silver" | null {
  if (reward == null) return null;
  const fires = (cond: AwardCondition | undefined): boolean => {
    if (!cond) return false;
    if (cond.minAge != null && cond.minAge >= ageHi) return false;
    if (cond.minDemand != null && cond.minDemand >= demandHi) return false;
    if (cond.minReward != null && reward < cond.minReward) return false;
    return true;
  };
  if (fires(bill.goldAward)) return "gold";
  if (fires(bill.silverAward)) return "silver";
  return null;
}

function awardCellBg(award: "gold" | "silver" | null, cell: number | null): string {
  if (cell == null) return "bg-slate-900/40";
  if (award === "gold") {
    return "bg-gradient-to-b from-amber-300 to-amber-500 shadow-[0_0_8px_rgba(252,211,77,.35)]";
  }
  if (award === "silver") {
    return "bg-gradient-to-b from-slate-300 to-slate-400";
  }
  return "bg-slate-950/70";
}

