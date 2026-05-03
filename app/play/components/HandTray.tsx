"use client";

/**
 * HandTray — bottom-of-canvas strip showing the human player's hand.
 *
 * Two stacked rows:
 *
 *   1. Actions row: identity cluster on the left, then every action button
 *      (Make / Sell / Implement / Audit / Pass) in a single line. Status
 *      pills (mash-status, pick-bill, audit-pending) sit inline next to
 *      the relevant button.
 *
 *   2. Cards row: resources / bourbon / play sections, each a vertical
 *      label + the actual cards or chips. No buttons in this row — the
 *      controls all live in the actions row above.
 *
 * Actions are enabled only when legal for the current turn / phase /
 * cash state; otherwise they sit in a slate disabled treatment with a
 * tooltip explaining why. The make-bourbon flow uses a two-row sweep:
 * tick resource chips in row 2, pick a bill in row 2, then click a
 * rickhouse on the board; "Make ↵" toggles the mode in row 1 and
 * "Cancel ↵" appears in its place while active.
 */

import { useEffect } from "react";

import { BOURBON_CARDS_BY_ID } from "@/lib/catalogs/bourbon.generated";
import { DISTILLERY_CARDS_BY_ID } from "@/lib/catalogs/distillery.generated";
import { INVESTMENT_CARDS_BY_ID } from "@/lib/catalogs/investment.generated";
import { OPERATIONS_CARDS_BY_ID } from "@/lib/catalogs/operations.generated";
import { SPECIALTY_RESOURCES_BY_ID } from "@/lib/catalogs/resource.generated";
import type {
  BourbonCardDef,
  ResourceCardDef,
  ResourceType,
} from "@/lib/catalogs/types";
import { HAND_LIMIT, MAX_ACTIVE_INVESTMENTS } from "@/lib/engine/state";
import { handSize } from "@/lib/engine/checks";
import { pickBestSellable } from "@/lib/ai/evaluators";
import {
  evaluateRecipe,
  MAX_MASH_CARDS,
  summarizeMash,
  validateMash,
  type RecipeCheck,
} from "@/lib/rules/mash";
import { useGameStore } from "@/lib/store/gameStore";
import { useUiStore } from "@/lib/store/uiStore";
import PlayerSwatch from "./PlayerSwatch";
import {
  HAND_CARD_OVERLAP,
  RESOURCE_CHROME,
  RESOURCE_GLYPH,
  RESOURCE_LABEL,
} from "./handCardStyles";
import { TIER_CHROME, tierOrCommon } from "./tierStyles";

export default function HandTray() {
  const state = useGameStore((s) => s.state)!;
  const dispatch = useGameStore((s) => s.dispatch);
  const makeBourbon = useUiStore((s) => s.makeBourbon);
  const startMakeBourbon = useUiStore((s) => s.startMakeBourbon);
  const cancelMakeBourbon = useUiStore((s) => s.cancelMakeBourbon);
  const toggleMashCard = useUiStore((s) => s.toggleMashCard);
  const pickMashBill = useUiStore((s) => s.pickMashBill);
  const auditDiscard = useUiStore((s) => s.auditDiscard);
  const startAuditDiscard = useUiStore((s) => s.startAuditDiscard);
  const toggleAuditMashBill = useUiStore((s) => s.toggleAuditMashBill);
  const toggleAuditInvestment = useUiStore((s) => s.toggleAuditInvestment);
  const toggleAuditOperations = useUiStore((s) => s.toggleAuditOperations);
  const cancelAuditDiscard = useUiStore((s) => s.cancelAuditDiscard);
  const inspectBill = useUiStore((s) => s.inspectBill);
  const inspectResource = useUiStore((s) => s.inspectResource);
  const inspectOperations = useUiStore((s) => s.inspectOperations);
  const inspectInvestment = useUiStore((s) => s.inspectInvestment);
  const inspectDistillery = useUiStore((s) => s.inspectDistillery);
  const implementMode = useUiStore((s) => s.implement);
  const startImplement = useUiStore((s) => s.startImplement);
  const cancelImplement = useUiStore((s) => s.cancelImplement);
  const sellMode = useUiStore((s) => s.sell);
  const startSell = useUiStore((s) => s.startSell);
  const cancelSell = useUiStore((s) => s.cancelSell);

  const humanId = state.playerOrder.find(
    (id) => state.players[id].kind === "human",
  );

  // Esc cancels make-bourbon mode at any time.
  useEffect(() => {
    if (!makeBourbon.active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelMakeBourbon();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [makeBourbon.active, cancelMakeBourbon]);

  // Esc cancels implement mode.
  useEffect(() => {
    if (!implementMode.active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelImplement();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [implementMode.active, cancelImplement]);

  // Esc cancels sell mode.
  useEffect(() => {
    if (!sellMode.active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelSell();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sellMode.active, cancelSell]);

  // Audit-discard mode is auto-entered for whichever player owes an
  // overage. Computed inline (rather than in a derived const) so the
  // effect runs at the top level and respects React's rule-of-hooks.
  const auditOverageForEffect = humanId
    ? state.players[humanId].pendingAuditOverage
    : null;
  const auditPendingForEffect =
    auditOverageForEffect != null && auditOverageForEffect > 0;
  useEffect(() => {
    if (auditPendingForEffect && !auditDiscard.active) {
      startAuditDiscard();
    }
    if (!auditPendingForEffect && auditDiscard.active) {
      cancelAuditDiscard();
    }
  }, [auditPendingForEffect, auditDiscard.active, startAuditDiscard, cancelAuditDiscard]);

  if (!humanId) return null;
  const me = state.players[humanId];

  const traySize =
    me.resourceHand.length +
    me.bourbonHand.length +
    me.investments.length +
    me.operations.length;
  const cappedHandSize = handSize(me);
  const isMyActionTurn =
    state.currentPlayerId === humanId && state.phase === "action";
  const cost = state.actionPhase.freeWindowActive
    ? 0
    : state.actionPhase.paidLapTier;
  const canAfford = me.cash >= cost;
  const overHandLimit = cappedHandSize > HAND_LIMIT;
  const auditPending =
    me.pendingAuditOverage != null && me.pendingAuditOverage > 0;
  const loanFrozen = me.loanSiphonActive;

  // ---- Action eligibility checks ----------------------------------------

  const handHasCask = me.resourceHand.some((r) => r.resource === "cask");
  const handHasCorn = me.resourceHand.some((r) => r.resource === "corn");
  const handHasGrain = me.resourceHand.some(
    (r) =>
      r.resource === "barley" || r.resource === "rye" || r.resource === "wheat",
  );
  const hasOpenRickhouse = state.rickhouses.some(
    (h) => h.barrels.length < h.capacity,
  );
  const canStartMake =
    isMyActionTurn &&
    canAfford &&
    handHasCask &&
    handHasCorn &&
    handHasGrain &&
    hasOpenRickhouse;
  const makeReason = makeBourbon.active
    ? "Cancel mash building"
    : !isMyActionTurn
      ? "Wait for your turn"
      : !canAfford
        ? `Need $${cost} to act`
        : !handHasCask
          ? "Need a cask in hand"
          : !handHasCorn
            ? "Need corn in hand"
            : !handHasGrain
              ? "Need a grain in hand"
              : !hasOpenRickhouse
                ? "Every rickhouse is full"
                : "Build a mash, then click a rickhouse";

  const selectedSet = new Set(makeBourbon.selectedIds);
  const selectedMash = me.resourceHand.filter((r) =>
    selectedSet.has(r.instanceId),
  );
  const mashBreakdown = summarizeMash(selectedMash);
  // Resolve the picked bill so we can pull its (optional) recipe — both
  // for live UI hints AND for the validator, which now enforces per-bill
  // grain min/max alongside the universal rules.
  const pickedBill = makeBourbon.mashBillId
    ? BOURBON_CARDS_BY_ID[makeBourbon.mashBillId]
    : null;
  const pickedRecipe = pickedBill?.recipe ?? null;
  const mashValidation = validateMash(selectedMash, pickedRecipe ?? undefined);
  const mashValid = mashValidation.ok;
  const recipeChecks: RecipeCheck[] = pickedRecipe
    ? evaluateRecipe(mashBreakdown, pickedRecipe)
    : [];
  // Resource-type "wanted" hint: when the picked bill's recipe is unmet
  // for a given grain, every unselected card of that type in the hand
  // pulses amber so the player can see what to click. Cleared once the
  // shortfall is gone.
  const wantedResourceTypes = new Set<ResourceType>(
    recipeChecks
      .filter((c) => c.key !== "grain" && !c.ok && c.current < c.min)
      .map((c) => c.key as ResourceType),
  );

  const bestSellable = pickBestSellable(state, me);
  const goldAlt = bestSellable?.goldAlt ?? null;
  const canSell = isMyActionTurn && canAfford && !!bestSellable;
  const sellReason = sellMode.active
    ? "Cancel sell — exit sell mode"
    : !isMyActionTurn
      ? "Wait for your turn"
      : !canAfford
        ? `Need $${cost} to act`
        : !bestSellable
          ? "No barrel is 2+ years aged"
          : (() => {
              const bill =
                BOURBON_CARDS_BY_ID[bestSellable.barrel.mashBillId]?.name ??
                bestSellable.barrel.mashBillId;
              const ageStr = `${bestSellable.barrel.age}y`;
              const altStr = goldAlt
                ? ` via Gold (${BOURBON_CARDS_BY_ID[goldAlt.goldId]?.name ?? goldAlt.goldId})`
                : "";
              return `Click any of your aged barrels to sell it (best right now: ${ageStr} ${bill} for $${bestSellable.payout}${altStr})`;
            })();

  // Implement — let the player CHOOSE which unbuilt investment to capitalise.
  // Click the button to enter implement mode → the play-row investment cards
  // become click targets → click one to dispatch IMPLEMENT_INVESTMENT for
  // that specific instance.
  const unbuiltInvestments = me.investments.filter(
    (i) => i.status === "unbuilt",
  );
  const activeInvCount = me.investments.filter(
    (i) => i.status === "active",
  ).length;
  // Cheapest unbuilt sets the lower bound the button-enabled check uses.
  const cheapestUnbuiltCapital = unbuiltInvestments.reduce<number | null>(
    (lo, inv) => {
      const cap = INVESTMENT_CARDS_BY_ID[inv.cardId]?.capital ?? 0;
      return lo == null || cap < lo ? cap : lo;
    },
    null,
  );
  const canImplement =
    isMyActionTurn &&
    canAfford &&
    unbuiltInvestments.length > 0 &&
    activeInvCount < MAX_ACTIVE_INVESTMENTS &&
    cheapestUnbuiltCapital != null &&
    me.cash >= cheapestUnbuiltCapital + cost;
  const implementReason = implementMode.active
    ? "Cancel implement"
    : !isMyActionTurn
      ? "Wait for your turn"
      : unbuiltInvestments.length === 0
        ? "No unbuilt investments in hand"
        : activeInvCount >= MAX_ACTIVE_INVESTMENTS
          ? `Already ${MAX_ACTIVE_INVESTMENTS}/3 active`
          : cheapestUnbuiltCapital == null ||
              me.cash < cheapestUnbuiltCapital + cost
            ? `Need $${(cheapestUnbuiltCapital ?? 0) + cost} for the cheapest one`
            : `Click an investment card to implement it`;

  const canCallAudit =
    isMyActionTurn &&
    canAfford &&
    !state.actionPhase.auditCalledThisRound &&
    !auditPending;
  const auditButtonReason = !isMyActionTurn
    ? "Wait for your turn"
    : !canAfford
      ? `Need $${cost} to act`
      : auditPending
        ? "Resolve your audit discard first"
        : state.actionPhase.auditCalledThisRound
          ? "Audit already called this round"
          : `Force every player over ${HAND_LIMIT} cards to discard down to ${HAND_LIMIT}`;

  const auditSelectedCount =
    auditDiscard.mashBillIds.length +
    auditDiscard.investmentInstanceIds.length +
    auditDiscard.operationsInstanceIds.length;
  const auditOverage = me.pendingAuditOverage ?? 0;
  const auditDiscardReady =
    auditDiscard.active && auditSelectedCount === auditOverage;

  // ---- Action dispatchers -----------------------------------------------

  // Sell — toggles sell mode. The actual SELL_BOURBON dispatch happens
  // when the player clicks a specific barrel chip in RickhouseRow,
  // mirroring the Implement/Make pattern of "pick a target on the board."
  const toggleSell = () => {
    if (sellMode.active) {
      cancelSell();
      return;
    }
    if (!canSell) return;
    startSell();
  };

  // The Implement button toggles implement-mode; the actual dispatch
  // happens when the player clicks a specific investment card.
  const toggleImplement = () => {
    if (implementMode.active) {
      cancelImplement();
      return;
    }
    if (!canImplement) return;
    startImplement();
  };
  const implementSpecific = (instanceId: string) => {
    if (!humanId) return;
    const inv = me.investments.find((i) => i.instanceId === instanceId);
    if (!inv || inv.status !== "unbuilt") return;
    const def = INVESTMENT_CARDS_BY_ID[inv.cardId];
    if (!def) return;
    if (me.cash < def.capital + cost) return;
    if (activeInvCount >= MAX_ACTIVE_INVESTMENTS) return;
    dispatch({
      t: "IMPLEMENT_INVESTMENT",
      playerId: humanId,
      investmentInstanceId: instanceId,
    });
    cancelImplement();
  };

  const callAudit = () => {
    if (!canCallAudit) return;
    dispatch({ t: "CALL_AUDIT", playerId: humanId });
  };

  const submitAuditDiscard = () => {
    if (!auditPending || !auditDiscardReady) return;
    dispatch({
      t: "AUDIT_DISCARD",
      playerId: humanId,
      mashBillIds: auditDiscard.mashBillIds,
      investmentInstanceIds: auditDiscard.investmentInstanceIds,
      operationsInstanceIds: auditDiscard.operationsInstanceIds,
    });
    cancelAuditDiscard();
  };

  return (
    <section
      className={[
        "hand-scrollbar flex flex-col gap-1.5 border-t border-slate-800 bg-slate-950 px-[22px] py-2",
        // Lift above the make-bourbon dim overlay so the chips remain
        // interactive while the rest of the dashboard is blurred out.
        makeBourbon.active ? "relative z-40" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* ─── Row 1: identity + every action button in a single line ─── */}
      <div className="flex flex-shrink-0 items-center gap-3 overflow-x-auto">
        {/* Identity / hand-size readout — small companion block to the
            big cash card below. Sits compact so the cash card is the
            visual anchor of the action row. */}
        {(() => {
          const distilleryName = me.chosenDistilleryId
            ? DISTILLERY_CARDS_BY_ID[me.chosenDistilleryId]?.name ?? null
            : null;
          const clickable = !!distilleryName;
          return (
            <button
              type="button"
              onClick={clickable ? () => inspectDistillery(humanId) : undefined}
              disabled={!clickable}
              title={
                clickable
                  ? `Your distillery — ${distilleryName} · click to view bonus + perk`
                  : "Your hand"
              }
              className={[
                "flex min-w-0 flex-shrink-0 flex-col gap-0.5 rounded-lg border bg-slate-950/60 px-3.5 py-2 text-left shadow-[inset_0_1px_0_rgba(255,255,255,.04)] transition-all",
                clickable
                  ? "cursor-pointer border-slate-700 hover:-translate-y-[1px] hover:border-amber-400 hover:shadow-[0_0_0_2px_rgba(251,191,36,.20)]"
                  : "cursor-default border-slate-800",
              ].join(" ")}
            >
              <div className="flex items-center gap-2">
                <PlayerSwatch
                  seatIndex={me.seatIndex}
                  logoId={me.logoId}
                  size="sm"
                />
                <div className="flex flex-col leading-tight">
                  <span className="font-display text-[14px] font-semibold leading-tight text-amber-100">
                    Your hand
                  </span>
                  {distilleryName ? (
                    <span className="-mt-0.5 font-display text-[10px] italic leading-tight text-amber-200/80">
                      {distilleryName}
                    </span>
                  ) : null}
                </div>
              </div>
              <span
                className={[
                  "font-mono text-[10px] uppercase tracking-[.12em]",
                  overHandLimit ? "text-rose-400" : "text-slate-500",
                ].join(" ")}
                title={
                  overHandLimit
                    ? `Over hand limit (${cappedHandSize}/${HAND_LIMIT}). An Audit will force a discard.`
                    : `Cards in hand: ${cappedHandSize}/${HAND_LIMIT}`
                }
              >
                {traySize} cards · {cappedHandSize}/{HAND_LIMIT}
              </span>
            </button>
          );
        })()}

        {/* Loan / audit-pending status badges */}
        {auditPending ? (
          <span className="rounded-md border border-rose-500/60 bg-rose-700/[0.20] px-2 py-1 font-mono text-[10px] uppercase tracking-[.12em] text-rose-200">
            audit · pick {me.pendingAuditOverage} to discard
          </span>
        ) : null}
        {me.loanRemaining > 0 ? (
          <span
            className={[
              "rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-[.12em]",
              loanFrozen
                ? "border-rose-500/60 bg-rose-700/[0.20] text-rose-200"
                : "border-amber-500/60 bg-amber-700/[0.20] text-amber-200",
            ].join(" ")}
            title={
              loanFrozen
                ? `Frozen by loan — every income siphons to bank, no spending until $${me.loanRemaining} clears`
                : `Loan repayment due next Phase 1: $${me.loanRemaining}`
            }
          >
            {loanFrozen ? "FROZEN" : "loan"} ${me.loanRemaining}
          </span>
        ) : null}

        {/* Action buttons. Order: Make · Sell · Implement · (gap) · Audit · Pass */}
        <ContextButton
          enabled={canStartMake || makeBourbon.active}
          onClick={makeBourbon.active ? cancelMakeBourbon : startMakeBourbon}
          title={makeReason}
          variant={makeBourbon.active ? "danger" : "primary"}
        >
          {makeBourbon.active ? "Cancel ↵" : "Make ↵"}
        </ContextButton>
        {makeBourbon.active ? (
          <>
            <MashStatusPill
              valid={mashValid}
              cask={mashBreakdown.cask}
              corn={mashBreakdown.corn}
              grain={mashBreakdown.grain}
              total={mashBreakdown.total}
              reason={mashValidation.ok ? null : mashValidation.reason}
              billPicked={!!makeBourbon.mashBillId}
            />
            {pickedRecipe ? (
              <RecipeChecklist
                billName={pickedBill?.name ?? "this bill"}
                checks={recipeChecks}
              />
            ) : null}
          </>
        ) : null}

        <ContextButton
          enabled={canSell || sellMode.active}
          onClick={toggleSell}
          title={sellReason}
          variant={sellMode.active ? "danger" : "primary"}
        >
          {sellMode.active ? "Cancel ↵" : "Sell ↵"}
        </ContextButton>

        <ContextButton
          enabled={canImplement || implementMode.active}
          onClick={toggleImplement}
          title={implementReason}
          variant={implementMode.active ? "danger" : "primary"}
        >
          {implementMode.active ? "Cancel ↵" : "Implement ↵"}
        </ContextButton>

        {/* End-turn cluster: Audit (or Discard submit if pending) +
            Pass. Co-located with Make / Sell / Implement so every
            action lives in the same row instead of being pushed to
            the right edge. */}
        {auditPending ? (
          <button
            type="button"
            disabled={!auditDiscardReady}
            onClick={submitAuditDiscard}
            title={
              auditDiscardReady
                ? `Discard ${auditOverage} card${auditOverage === 1 ? "" : "s"} to resolve the Audit`
                : `Pick exactly ${auditOverage} card${auditOverage === 1 ? "" : "s"} to discard`
            }
            className="rounded-md border border-rose-700 bg-gradient-to-b from-rose-500 to-rose-700 px-3.5 py-1.5 font-sans text-xs font-bold uppercase tracking-[.05em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.2)] transition-colors hover:from-rose-400 hover:to-rose-600 disabled:cursor-not-allowed disabled:border-slate-700 disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-500 disabled:shadow-none"
          >
            Discard {auditSelectedCount}/{auditOverage}
          </button>
        ) : (
          <button
            type="button"
            disabled={!canCallAudit}
            onClick={callAudit}
            title={auditButtonReason}
            className="rounded border border-rose-500/60 bg-rose-700/[0.20] px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-[.05em] text-rose-100 transition-colors hover:bg-rose-700/[0.35] disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-transparent disabled:text-slate-500"
          >
            Audit ↵
          </button>
        )}
        <button
          type="button"
          disabled={!isMyActionTurn || auditPending}
          onClick={() => dispatch({ t: "PASS_ACTION", playerId: humanId })}
          title={
            auditPending
              ? "Resolve your audit discard first"
              : isMyActionTurn
                ? "Pass — finish your action loop"
                : "Wait for your turn"
          }
          className="rounded-md border border-amber-700 bg-gradient-to-b from-amber-500 to-amber-700 px-3.5 py-1.5 font-sans text-xs font-bold uppercase tracking-[.05em] text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,.2)] transition-colors hover:from-amber-400 hover:to-amber-600 disabled:cursor-not-allowed disabled:border-slate-700 disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-500 disabled:shadow-none"
        >
          Pass ↵
        </button>
      </div>

      {/* ─── Row 2: cards (cash / resources / bourbon / play / active) ─── */}
      {/* Every section uses the same accordion-fan layout so the player
          scans one visual idiom across resources, bourbon, and play.
          Cash sits as the FIRST section — sized like a card area, with
          a very large dollar number — so the player's bankroll is the
          visual anchor of the whole hand row. */}
      <div className="flex items-stretch gap-[14px] overflow-x-auto">
        {/* Cash — fills its section, no inner box framing */}
        <div className="flex flex-shrink-0 items-stretch gap-2">
          <VerticalCaption>cash</VerticalCaption>
          <div
            className="flex h-[128px] w-[160px] flex-col items-center justify-center gap-1 px-3"
            title="Cash on hand — pays action costs, rent, and investment capital."
          >
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[.22em] text-emerald-300/85">
              Cash
            </span>
            <span className="font-display text-[60px] font-bold leading-none tabular-nums text-emerald-300 drop-shadow-[0_3px_6px_rgba(0,0,0,.55)]">
              ${me.cash}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[.18em] text-emerald-400/60">
              on hand
            </span>
          </div>
        </div>

        <Divider />

        {/* Resources */}
        <div className="flex flex-shrink-0 items-stretch gap-2">
          <VerticalCaption>resources</VerticalCaption>
          <CardAccordion>
            {me.resourceHand.length === 0 ? (
              <EmptyPill>no resources</EmptyPill>
            ) : null}
            {me.resourceHand.map((r, idx) => {
              const specialty = r.specialtyId
                ? SPECIALTY_RESOURCES_BY_ID[r.specialtyId] ?? null
                : null;
              const makeMode = makeBourbon.active;
              const selected = selectedSet.has(r.instanceId);
              const onClick = makeMode
                ? () => toggleMashCard(r.instanceId)
                : () => inspectResource(r.instanceId);
              // Surface bills' recipe shortfalls on the cards the
              // player should be clicking next.
              const wanted =
                makeMode && !selected && wantedResourceTypes.has(r.resource);
              return (
                <MiniResourceCard
                  key={r.instanceId}
                  resource={r.resource}
                  specialty={specialty}
                  indexInRow={idx}
                  makeMode={makeMode}
                  selected={selected}
                  wanted={wanted}
                  onClick={onClick}
                />
              );
            })}
          </CardAccordion>
        </div>

        <Divider />

        {/* Bourbon hand */}
        <div className="flex flex-shrink-0 items-stretch gap-2">
          <VerticalCaption>bourbon</VerticalCaption>
          <div className="flex flex-col items-start gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[.12em] text-slate-500 tabular-nums">
              {me.bourbonHand.length} bills
              {me.goldBourbons.length > 0 ? (
                <span className="ml-1.5 text-amber-300">
                  · {me.goldBourbons.length} gold
                </span>
              ) : null}
            </span>
            <CardAccordion>
              {me.bourbonHand.length === 0 ? (
                <EmptyPill>no mash bills</EmptyPill>
              ) : null}
              {me.bourbonHand.map((id, i) => {
                const card = BOURBON_CARDS_BY_ID[id];
                if (!card) return null;
                const auditMode = auditDiscard.active;
                const makeMode = makeBourbon.active && !auditMode;
                const auditSelected = auditDiscard.mashBillIds.includes(id);
                const makeSelected = makeBourbon.mashBillId === id;
                const onClick = auditMode
                  ? () => toggleAuditMashBill(id)
                  : makeMode
                    ? () => pickMashBill(id)
                    : () => inspectBill(id);
                return (
                  <MiniBourbonCard
                    key={`${id}-${i}`}
                    card={card}
                    demand={state.demand}
                    indexInRow={i}
                    auditMode={auditMode}
                    auditSelected={auditSelected}
                    makeMode={makeMode}
                    makeSelected={makeSelected}
                    onClick={onClick}
                  />
                );
              })}
            </CardAccordion>
          </div>
        </div>

        <Divider />

        {/* Play (ops + investments) */}
        <div className="flex flex-shrink-0 items-stretch gap-2">
          <VerticalCaption>play</VerticalCaption>
          <div className="flex flex-col gap-1.5">
            <CardAccordion>
              {me.operations.length === 0 && me.investments.length === 0 ? (
                <EmptyPill>no plays</EmptyPill>
              ) : null}
              {me.operations.map((ops, idx) => {
                const def = OPERATIONS_CARDS_BY_ID[ops.cardId];
                const auditMode = auditDiscard.active;
                const auditSelected =
                  auditDiscard.operationsInstanceIds.includes(ops.instanceId);
                const onClick = auditMode
                  ? () => toggleAuditOperations(ops.instanceId)
                  : () => inspectOperations(ops.instanceId);
                return (
                  <MiniOperationsCard
                    key={ops.instanceId}
                    title={def?.title ?? ops.cardId}
                    concept={def?.concept}
                    effect={def?.effect}
                    indexInRow={idx}
                    auditMode={auditMode}
                    auditSelected={auditSelected}
                    onClick={onClick}
                  />
                );
              })}
              {/* Unbuilt investments are candidates for Implement mode
                  and live alongside operations. Active ones get their
                  own section to the right (see "active" below). */}
              {me.investments
                .filter((inv) => inv.status !== "active")
                .map((inv, idx) => {
                  const def = INVESTMENT_CARDS_BY_ID[inv.cardId];
                  const auditMode = auditDiscard.active;
                  const auditSelected =
                    auditDiscard.investmentInstanceIds.includes(inv.instanceId);
                  const isImplementable =
                    implementMode.active &&
                    isMyActionTurn &&
                    canAfford &&
                    activeInvCount < MAX_ACTIVE_INVESTMENTS &&
                    me.cash >= (def?.capital ?? 0) + cost;
                  const onClick = auditMode
                    ? () => toggleAuditInvestment(inv.instanceId)
                    : isImplementable
                      ? () => implementSpecific(inv.instanceId)
                      : () => inspectInvestment(inv.instanceId);
                  return (
                    <MiniInvestmentCard
                      key={inv.instanceId}
                      name={def?.name ?? inv.cardId}
                      short={def?.short}
                      effect={def?.effect}
                      capital={def?.capital ?? 0}
                      rarity={def?.rarity}
                      isActive={false}
                      indexInRow={me.operations.length + idx}
                      auditMode={auditMode}
                      auditSelected={auditSelected}
                      implementable={isImplementable}
                      canAffordImplement={
                        def != null && me.cash >= def.capital + cost
                      }
                      onClick={onClick}
                    />
                  );
                })}
            </CardAccordion>
          </div>
        </div>

        {/* Spacer — pushes the Active section to the far right. The
            cash / resources / bourbon / play sections (the player's
            "hand") absorb all the slack so they can breathe and the
            fixed-size active investment slots anchor the right edge. */}
        <span className="flex-1" aria-hidden />

        <Divider />

        {/* Active investments — built upgrades that persist on the
            table. Pinned to the FAR RIGHT of the hand row since the
            cap is fixed (MAX_ACTIVE_INVESTMENTS = 3 explicit slots);
            no need for it to consume hand-row real estate. Each
            unfilled slot renders as a dashed empty placeholder so the
            cap is visible at a glance. Clicking a built card opens
            the inspect modal. */}
        <div className="flex flex-shrink-0 items-stretch gap-2">
          <VerticalCaption>active</VerticalCaption>
          <div className="flex flex-col items-start gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[.12em] text-slate-500 tabular-nums">
              {activeInvCount}/{MAX_ACTIVE_INVESTMENTS} built
            </span>
            <div className="flex items-end gap-2 py-2 pl-2 pr-3">
              {Array.from({ length: MAX_ACTIVE_INVESTMENTS }).map((_, slot) => {
                const inv = me.investments.filter((x) => x.status === "active")[slot];
                if (!inv) {
                  return (
                    <EmptyInvestmentSlot key={`empty-${slot}`} />
                  );
                }
                const def = INVESTMENT_CARDS_BY_ID[inv.cardId];
                return (
                  <MiniInvestmentCard
                    key={inv.instanceId}
                    name={def?.name ?? inv.cardId}
                    short={def?.short}
                    effect={def?.effect}
                    capital={def?.capital ?? 0}
                    rarity={def?.rarity}
                    isActive={true}
                    indexInRow={0}
                    auditMode={false}
                    auditSelected={false}
                    implementable={false}
                    canAffordImplement={false}
                    onClick={() => inspectInvestment(inv.instanceId)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents

function ContextButton({
  children,
  enabled,
  onClick,
  title,
  variant = "primary",
}: {
  children: React.ReactNode;
  enabled: boolean;
  onClick: () => void;
  title: string;
  variant?: "primary" | "danger";
}) {
  const enabledStyle =
    variant === "danger"
      ? "border-rose-700 bg-gradient-to-b from-rose-500 to-rose-700 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.2),0_2px_8px_rgba(244,63,94,.25)] hover:-translate-y-0.5 hover:from-rose-400 hover:to-rose-600 hover:shadow-[inset_0_1px_0_rgba(255,255,255,.25),0_4px_12px_rgba(244,63,94,.35)]"
      : "border-amber-700 bg-gradient-to-b from-amber-500 to-amber-700 text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,.2),0_2px_8px_rgba(245,158,11,.25)] hover:-translate-y-0.5 hover:from-amber-400 hover:to-amber-600 hover:shadow-[inset_0_1px_0_rgba(255,255,255,.25),0_4px_12px_rgba(245,158,11,.35)]";
  return (
    <button
      type="button"
      onClick={enabled ? onClick : undefined}
      disabled={!enabled}
      title={title}
      className={[
        "rounded-md border px-3 py-1 font-sans text-[11px] font-bold uppercase tracking-[.05em] transition-all",
        enabled
          ? enabledStyle
          : "cursor-not-allowed border-slate-800 bg-slate-900 text-slate-600 shadow-none",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function MashStatusPill({
  valid,
  cask,
  corn,
  grain,
  total,
  reason,
  billPicked,
}: {
  valid: boolean;
  cask: number;
  corn: number;
  grain: number;
  total: number;
  reason: string | null;
  billPicked: boolean;
}) {
  // While make-bourbon mode is active, surface BOTH the mash validity AND
  // whether the player has picked a bill yet. Both are required to land a
  // barrel; missing either freezes the rickhouse click target.
  const mashOk = valid;
  const allOk = valid && billPicked;
  const tooltip = !valid
    ? (reason ?? undefined)
    : !billPicked
      ? "Pick a mash bill from your bourbon hand below"
      : "Mash + bill ready — click a rickhouse to barrel";
  return (
    <span
      title={tooltip}
      className={[
        "flex items-center gap-2 rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-[.10em]",
        allOk
          ? "border-emerald-500/50 bg-emerald-500/[0.10] text-emerald-200"
          : "border-slate-700 bg-slate-900 text-slate-400",
      ].join(" ")}
    >
      <span
        className={[
          "grid h-3.5 w-3.5 place-items-center rounded-full font-bold",
          mashOk ? "bg-emerald-500 text-slate-950" : "bg-slate-700 text-slate-300",
        ].join(" ")}
        aria-hidden
      >
        {mashOk ? "✓" : "·"}
      </span>
      <span className="tabular-nums">
        {cask}c · {corn}🌽 · {grain}g · {total}/{MAX_MASH_CARDS}
      </span>
      <span
        className={[
          "rounded border px-1 py-px text-[9px]",
          billPicked
            ? "border-emerald-500/50 text-emerald-200"
            : "border-amber-500/50 text-amber-200",
        ].join(" ")}
      >
        {billPicked ? "bill ✓" : "pick bill ↓"}
      </span>
      {allOk ? (
        <span className="text-amber-300">click a rickhouse →</span>
      ) : null}
    </span>
  );
}

/**
 * Live recipe checklist that appears next to MashStatusPill while the
 * picked mash bill carries an explicit recipe. Each requirement renders
 * as a pill — emerald when satisfied, amber when not — so the player
 * can scan "what does this bill still need?" at a glance.
 */
function RecipeChecklist({
  billName,
  checks,
}: {
  billName: string;
  checks: RecipeCheck[];
}) {
  if (checks.length === 0) return null;
  return (
    <span
      title={`${billName} recipe — every requirement must be satisfied to barrel`}
      className="flex flex-wrap items-center gap-1.5 rounded-md border border-amber-700/50 bg-amber-900/[0.18] px-2 py-1 font-mono text-[10px] uppercase tracking-[.08em] text-amber-200"
    >
      <span className="text-amber-300/80">recipe</span>
      {checks.map((c) => (
        <RecipePill key={c.key} check={c} />
      ))}
    </span>
  );
}

function RecipePill({ check }: { check: RecipeCheck }) {
  const label = check.label;
  // Compact text: "rye 1/3", "wheat 0/1 max", "no rye"
  const body =
    check.max === 0
      ? `no ${label}`
      : check.max != null && check.min === 0
        ? `${label} ${check.current}/${check.max} max`
        : `${label} ${check.current}/${check.min}`;
  return (
    <span
      className={[
        "flex items-center gap-1 rounded border px-1.5 py-px tabular-nums",
        check.ok
          ? "border-emerald-500/55 bg-emerald-500/[0.15] text-emerald-200"
          : "border-amber-500/60 bg-amber-700/[0.18] text-amber-100",
      ].join(" ")}
      title={check.ok ? `${label} requirement met` : check.failureReason}
    >
      <span aria-hidden>{check.ok ? "✓" : "•"}</span>
      <span>{body}</span>
    </span>
  );
}

function VerticalCaption({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="self-stretch font-mono text-[10px] uppercase tracking-[.12em] text-slate-500"
      style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
    >
      {children}
    </span>
  );
}

function Divider() {
  return (
    <span
      className="block w-px flex-shrink-0 self-stretch bg-slate-800"
      aria-hidden
    />
  );
}

function EmptyPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-dashed border-slate-700 px-2.5 py-1 font-mono text-[11px] italic text-slate-500">
      {children}
    </span>
  );
}

/**
 * Empty placeholder for an unfilled active-investment slot. Sized to
 * match MiniInvestmentCard (112×148) so all three slots are visually
 * present at all times — players can see the cap immediately without
 * having to remember "you can have up to 3."
 */
function EmptyInvestmentSlot() {
  return (
    <div
      aria-label="Empty investment slot"
      className="flex h-[128px] w-[112px] flex-shrink-0 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-700 bg-slate-950/40 font-mono text-[9px] uppercase tracking-[.18em] text-slate-600"
    >
      <span aria-hidden className="text-2xl text-slate-700">+</span>
      <span>Empty slot</span>
    </div>
  );
}

/**
 * Accordion fan layout shared by the resources / bourbon / play sections.
 * Children overlap horizontally via {@link HAND_CARD_OVERLAP}; on hover,
 * each card lifts + scales + jumps to z-50 via its own classes. The
 * container scrolls horizontally when a section overflows the tray.
 */
function CardAccordion({ children }: { children: React.ReactNode }) {
  return (
    <div className="hand-scrollbar flex max-w-[460px] items-end overflow-x-auto py-2 pl-2 pr-3">
      <div className="flex items-end">{children}</div>
    </div>
  );
}

/**
 * Card-styled resource — shares silhouette and hover behaviour with the
 * play-row mini cards. In make-bourbon mode the card becomes a toggle
 * for the mash; in idle mode it opens HandInspectModal.
 */
function MiniResourceCard({
  resource,
  specialty,
  indexInRow,
  makeMode,
  selected,
  wanted = false,
  onClick,
}: {
  resource: ResourceType;
  specialty: ResourceCardDef | null;
  indexInRow: number;
  makeMode: boolean;
  selected: boolean;
  /** True when the picked bill's recipe still needs more of this type. */
  wanted?: boolean;
  onClick?: () => void;
}) {
  const chrome = RESOURCE_CHROME[resource];
  const overlapMargin = indexInRow === 0 ? "" : HAND_CARD_OVERLAP;
  const baseChrome =
    "relative flex h-[128px] w-[112px] flex-shrink-0 flex-col overflow-hidden rounded-lg border-2 p-2 text-left shadow-[0_8px_20px_rgba(0,0,0,.4)] ring-1 ring-white/10 transition-all duration-200";
  const stateBorder = selected
    ? "border-amber-300 ring-2 ring-amber-300"
    : wanted
      ? "border-amber-300 ring-2 ring-amber-300/80 shadow-[0_0_18px_rgba(245,158,11,.45)]"
      : makeMode
        ? `${chrome.border} opacity-90`
        : chrome.border;
  const liftClass = selected
    ? "z-40 -translate-y-2"
    : wanted
      ? "z-30 -translate-y-1 cursor-pointer hover:z-50 hover:-translate-y-3 hover:scale-[1.08]"
      : "cursor-pointer hover:z-50 hover:-translate-y-3 hover:scale-[1.08]";
  const title = wanted
    ? `${RESOURCE_LABEL[resource]} — bill needs this · click to add to mash`
    : specialty
      ? `${RESOURCE_LABEL[resource]} · ${specialty.name} — click to inspect`
      : `${RESOURCE_LABEL[resource]} — plain resource · click to inspect`;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={makeMode ? selected : undefined}
      title={title}
      className={[
        baseChrome,
        chrome.gradient,
        overlapMargin,
        stateBorder,
        liftClass,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
        aria-hidden
      />
      {selected ? (
        <span
          className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-amber-300 font-mono text-[10px] font-bold text-slate-950 shadow"
          aria-hidden
        >
          ✓
        </span>
      ) : null}
      <div className="flex items-baseline">
        <span
          className={`text-[9px] font-semibold uppercase tracking-[0.18em] ${chrome.label}`}
        >
          {RESOURCE_LABEL[resource]}
        </span>
      </div>
      <h4
        className={`mt-1 line-clamp-2 font-display text-[13px] font-bold leading-tight drop-shadow-[0_1px_4px_rgba(0,0,0,.35)] ${chrome.ink}`}
      >
        {specialty?.name ?? RESOURCE_LABEL[resource]}
      </h4>
      {specialty?.hook ? (
        <p
          className={`mt-0.5 line-clamp-2 text-[9px] italic leading-snug ${chrome.ink} opacity-80`}
        >
          {specialty.hook}
        </p>
      ) : null}
      <div
        className={`mt-auto grid h-9 w-9 self-center place-items-center rounded-full border-2 bg-white/10 text-lg shadow-[inset_0_1px_4px_rgba(255,255,255,.15)] backdrop-blur-sm ${chrome.border} ${chrome.ink}`}
      >
        {RESOURCE_GLYPH[resource]}
      </div>
      {specialty ? (
        <p
          className={`mt-1 line-clamp-2 text-[8.5px] leading-snug ${chrome.ink} opacity-90`}
        >
          {specialty.rule}
        </p>
      ) : (
        <p
          className={`mt-1 line-clamp-2 text-[8.5px] italic leading-snug ${chrome.ink} opacity-70`}
        >
          plain · spend in a mash
        </p>
      )}
    </button>
  );
}

/**
 * Card-styled bourbon mash bill. Same silhouette as the other hand
 * minis, with a price preview circle showing the typical-band payout
 * (mid age, mid demand) for at-a-glance scanning. The full 3×3 grid
 * lives in BourbonInspectModal — click the card to inspect.
 */
function MiniBourbonCard({
  card,
  demand,
  indexInRow,
  auditMode,
  auditSelected,
  makeMode,
  makeSelected,
  onClick,
}: {
  card: BourbonCardDef;
  demand: number;
  indexInRow: number;
  auditMode: boolean;
  auditSelected: boolean;
  makeMode: boolean;
  makeSelected: boolean;
  onClick?: () => void;
}) {
  const tier = tierOrCommon(card.tier);
  const chrome = TIER_CHROME[tier];
  const overlapMargin = indexInRow === 0 ? "" : HAND_CARD_OVERLAP;
  // Resolve current demand against THIS bill's bands (each card defines
  // its own thresholds, length 1–3). Show a price preview from the
  // middle age row when the bill has 3 age bands; otherwise just take
  // the last available row (the most aged the card cares about).
  let demandBand = 0;
  for (let i = card.demandBands.length - 1; i >= 0; i -= 1) {
    if (demand >= card.demandBands[i]) {
      demandBand = i;
      break;
    }
  }
  const previewRow = card.grid[Math.min(1, card.grid.length - 1)];
  const previewPrice = previewRow[Math.min(demandBand, previewRow.length - 1)];
  const baseChrome =
    "relative flex h-[128px] w-[112px] flex-shrink-0 flex-col overflow-hidden rounded-lg border-2 p-2 text-left shadow-[0_8px_20px_rgba(0,0,0,.4)] ring-1 ring-white/10 transition-all duration-200";
  const stateBorder = auditSelected
    ? "border-rose-400 ring-2 ring-rose-400"
    : auditMode
      ? "border-rose-500/50"
      : makeSelected
        ? "border-amber-200 ring-2 ring-amber-200"
        : makeMode
          ? `${chrome.border} opacity-90`
          : chrome.border;
  const liftClass = makeSelected || auditSelected
    ? "z-40 -translate-y-2"
    : "cursor-pointer hover:z-50 hover:-translate-y-3 hover:scale-[1.08]";
  const title = auditMode
    ? `${card.name} — toggle for audit discard`
    : makeMode
      ? `${card.name} — pick as mash bill`
      : `${card.name} — click to inspect full grid`;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={
        auditMode ? auditSelected : makeMode ? makeSelected : undefined
      }
      title={title}
      className={[
        baseChrome,
        chrome.gradient,
        chrome.glow,
        chrome.shimmer,
        overlapMargin,
        stateBorder,
        liftClass,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
        aria-hidden
      />
      <div className="flex items-baseline justify-between">
        <span className={`text-[8px] font-semibold uppercase tracking-[0.18em] ${chrome.label}`}>
          Bourbon
        </span>
        <span className={`text-[7px] uppercase tracking-wide ${chrome.label} opacity-80`}>
          {chrome.label_text}
        </span>
      </div>
      <h4 className={`mt-1 line-clamp-2 font-display text-[13px] font-bold leading-tight ${chrome.titleInk} drop-shadow-[0_1px_4px_rgba(0,0,0,.35)]`}>
        {card.name}
      </h4>
      <p className={`mt-0.5 text-[9px] italic leading-snug ${chrome.label} opacity-90`}>
        mash bill
      </p>
      <div className={`mt-auto grid h-9 w-9 self-center place-items-center rounded-full border-2 ${chrome.border} bg-white/10 font-mono text-[12px] font-black tabular-nums text-white shadow-[inset_0_1px_4px_rgba(255,255,255,.15)] backdrop-blur-sm`}>
        ${previewPrice}
      </div>
      <p className={`mt-1 line-clamp-2 text-[8.5px] leading-snug ${chrome.titleInk} opacity-90`}>
        {demandBand === 0
          ? "Low demand · mid-age price"
          : demandBand === 1
            ? "Mid demand · mid-age price"
            : "High demand · mid-age price"}
      </p>
    </button>
  );
}

/**
 * Mini operations card — violet gradient, ~110×148, fits inline in the
 * hand. Uses negative left margin to overlap with siblings (accordion
 * fan); on hover, lifts + scales + rises above siblings via z-50.
 */
function MiniOperationsCard({
  title,
  concept,
  effect,
  indexInRow,
  auditMode,
  auditSelected,
  onClick,
}: {
  title: string;
  concept?: string;
  effect?: string;
  indexInRow: number;
  auditMode: boolean;
  auditSelected: boolean;
  onClick?: () => void;
}) {
  const interactive = !!onClick;
  const baseChrome =
    "relative flex h-[128px] w-[112px] flex-shrink-0 flex-col overflow-hidden rounded-lg border-2 bg-gradient-to-b from-violet-600/90 via-violet-900/90 to-slate-950 p-2 text-left shadow-[0_8px_20px_rgba(0,0,0,.4)] ring-1 ring-white/10 transition-all duration-200";
  const overlapMargin = indexInRow === 0 ? "" : "-ml-9";
  const stateBorder = auditSelected
    ? "border-rose-400 ring-2 ring-rose-400"
    : auditMode
      ? "border-rose-500/50"
      : "border-violet-400";
  const interactiveAffordance = interactive
    ? "cursor-pointer hover:z-50 hover:-translate-y-3 hover:scale-[1.08]"
    : "hover:z-50 hover:-translate-y-2 hover:scale-[1.05]";
  return (
    <button
      type="button"
      disabled={!interactive && !auditMode}
      onClick={onClick}
      title={effect ? `${title} — ${effect}` : title}
      aria-pressed={auditMode ? auditSelected : undefined}
      className={[baseChrome, overlapMargin, stateBorder, interactiveAffordance]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
        aria-hidden
      />
      <div className="flex items-baseline justify-between">
        <span className="text-[8px] font-semibold uppercase tracking-[0.18em] text-violet-200">
          Ops
        </span>
        <span className="text-[7px] uppercase tracking-wide text-violet-200/70">
          one-shot
        </span>
      </div>
      <h4 className="mt-1 line-clamp-2 font-display text-[13px] font-bold leading-tight text-white drop-shadow-[0_1px_4px_rgba(0,0,0,.35)]">
        {title}
      </h4>
      {concept ? (
        <p className="mt-0.5 line-clamp-2 text-[9px] italic leading-snug text-violet-100/80">
          {concept}
        </p>
      ) : null}
      <div className="mt-auto grid h-9 w-9 self-center place-items-center rounded-full border border-violet-300 bg-white/10 text-lg shadow-[inset_0_1px_4px_rgba(255,255,255,.15)] backdrop-blur-sm">
        ⚡
      </div>
      {effect ? (
        <p className="mt-1 line-clamp-2 text-[8.5px] leading-snug text-white/85">
          {effect}
        </p>
      ) : null}
    </button>
  );
}

/**
 * Mini investment card — emerald gradient. Implementable variant gets
 * a strong amber ring + lifted state in implement mode. Active (already
 * built) cards render in a duller "applied" treatment with no overlap
 * lift since they're table-state, not hand-state. Rare investments get
 * the .rare-shimmer keyframe.
 */
function MiniInvestmentCard({
  name,
  short,
  effect,
  capital,
  rarity,
  isActive,
  indexInRow,
  auditMode,
  auditSelected,
  implementable,
  canAffordImplement,
  onClick,
}: {
  name: string;
  short?: string;
  effect?: string;
  capital: number;
  rarity?: string;
  isActive: boolean;
  indexInRow: number;
  auditMode: boolean;
  auditSelected: boolean;
  implementable: boolean;
  canAffordImplement: boolean;
  onClick?: () => void;
}) {
  const interactive = !!onClick;
  const isRare = rarity === "Rare";
  const baseChrome =
    "relative flex h-[128px] w-[112px] flex-shrink-0 flex-col overflow-hidden rounded-lg border-2 p-2 text-left shadow-[0_8px_20px_rgba(0,0,0,.4)] ring-1 ring-white/10 transition-all duration-200";
  const gradient = isActive
    ? "bg-gradient-to-b from-emerald-700/70 via-emerald-900/80 to-slate-950"
    : "bg-gradient-to-b from-emerald-600/90 via-emerald-900/90 to-slate-950";
  const overlapMargin = indexInRow === 0 ? "" : "-ml-9";
  const stateBorder = auditSelected
    ? "border-rose-400 ring-2 ring-rose-400"
    : auditMode
      ? "border-rose-500/50"
      : implementable
        ? "border-amber-300 ring-2 ring-amber-300"
        : isActive
          ? "border-emerald-400"
          : "border-emerald-400/70";
  const interactiveAffordance = interactive
    ? implementable
      ? "cursor-pointer hover:z-50 hover:-translate-y-4 hover:scale-[1.10]"
      : "cursor-pointer hover:z-50 hover:-translate-y-3 hover:scale-[1.08]"
    : "hover:z-50 hover:-translate-y-2 hover:scale-[1.05]";
  return (
    <button
      type="button"
      disabled={!interactive && !auditMode}
      onClick={onClick}
      title={
        implementable
          ? `Click to implement (pays $${capital} capital + action)`
          : !isActive && !canAffordImplement && !auditMode
            ? `${name} — can't afford implement`
            : effect
              ? `${name} — ${effect}`
              : name
      }
      aria-pressed={auditMode ? auditSelected : undefined}
      className={[
        baseChrome,
        gradient,
        overlapMargin,
        stateBorder,
        interactiveAffordance,
        isRare ? "rare-shimmer" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
        aria-hidden
      />
      <div className="flex items-baseline justify-between">
        <span className="text-[8px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
          {isActive ? "Built" : "Invest"}
        </span>
        <span className="text-[7px] uppercase tracking-wide text-emerald-200/70">
          {rarity ?? ""}
        </span>
      </div>
      <h4 className="mt-1 line-clamp-2 font-display text-[13px] font-bold leading-tight text-white drop-shadow-[0_1px_4px_rgba(0,0,0,.35)]">
        {name}
      </h4>
      {short ? (
        <p className="mt-0.5 line-clamp-2 text-[9px] italic leading-snug text-emerald-100/80">
          {short}
        </p>
      ) : null}
      <div className="mt-auto grid h-9 w-9 self-center place-items-center rounded-full border-2 border-emerald-300 bg-white/10 font-mono text-[13px] font-black tabular-nums text-white shadow-[inset_0_1px_4px_rgba(255,255,255,.15)] backdrop-blur-sm">
        ${capital}
      </div>
      {effect ? (
        <p className="mt-1 line-clamp-2 text-[8.5px] leading-snug text-white/85">
          {effect}
        </p>
      ) : null}
    </button>
  );
}
