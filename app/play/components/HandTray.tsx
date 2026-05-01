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
import { INVESTMENT_CARDS_BY_ID } from "@/lib/catalogs/investment.generated";
import { OPERATIONS_CARDS_BY_ID } from "@/lib/catalogs/operations.generated";
import { SPECIALTY_RESOURCES_BY_ID } from "@/lib/catalogs/resource.generated";
import type { ResourceCardDef, ResourceType } from "@/lib/catalogs/types";
import { HAND_LIMIT, MAX_ACTIVE_INVESTMENTS } from "@/lib/engine/state";
import { handSize } from "@/lib/engine/checks";
import { pickBestSellable } from "@/lib/ai/evaluators";
import { summarizeMash, validateMash } from "@/lib/rules/mash";
import { useGameStore } from "@/lib/store/gameStore";
import { useUiStore } from "@/lib/store/uiStore";
import { PLAYER_BG_CLASS, paletteIndex } from "./playerColors";
import BourbonCardFace from "./BourbonCardFace";

type ResourceMeta = {
  glyph: string;
  short: string;
  tint: string;
  border: string;
  ink: string;
};

const RESOURCE_META: Record<ResourceType, ResourceMeta> = {
  cask: {
    glyph: "◯",
    short: "C",
    tint: "bg-amber-700/[0.20]",
    border: "border-amber-700",
    ink: "text-amber-200",
  },
  corn: {
    glyph: "◆",
    short: "C",
    tint: "bg-yellow-500/[0.18]",
    border: "border-yellow-500/45",
    ink: "text-yellow-100",
  },
  barley: {
    glyph: "★",
    short: "B",
    tint: "bg-lime-500/[0.18]",
    border: "border-lime-500/45",
    ink: "text-lime-100",
  },
  rye: {
    glyph: "▲",
    short: "R",
    tint: "bg-rose-600/[0.18]",
    border: "border-rose-600/45",
    ink: "text-rose-100",
  },
  wheat: {
    glyph: "▼",
    short: "W",
    tint: "bg-sky-500/[0.18]",
    border: "border-sky-500/45",
    ink: "text-sky-100",
  },
};

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
  const seatIdx = paletteIndex(me.seatIndex);

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
  const mashValidation = validateMash(selectedMash);
  const mashBreakdown = summarizeMash(selectedMash);
  const mashValid = mashValidation.ok;

  const bestSellable = pickBestSellable(state, me);
  const goldAlt = bestSellable?.goldAlt ?? null;
  const canSell = isMyActionTurn && canAfford && !!bestSellable;
  const sellReason = !isMyActionTurn
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
            return `Sell ${ageStr} barrel (${bill}) for $${bestSellable.payout}${altStr} — or click any barrel in a rickhouse to sell it directly`;
          })();

  const unbuiltInv = me.investments.find((i) => i.status === "unbuilt");
  const activeInvCount = me.investments.filter(
    (i) => i.status === "active",
  ).length;
  const investCapital = unbuiltInv
    ? (INVESTMENT_CARDS_BY_ID[unbuiltInv.cardId]?.capital ?? 0)
    : 0;
  const canImplement =
    isMyActionTurn &&
    canAfford &&
    !!unbuiltInv &&
    activeInvCount < MAX_ACTIVE_INVESTMENTS &&
    me.cash >= investCapital + cost;
  const implementReason = !isMyActionTurn
    ? "Wait for your turn"
    : !unbuiltInv
      ? "No unbuilt investments in hand"
      : activeInvCount >= MAX_ACTIVE_INVESTMENTS
        ? `Already ${MAX_ACTIVE_INVESTMENTS}/3 active`
        : me.cash < investCapital + cost
          ? `Need $${investCapital + cost} to implement (capital + action)`
          : `Pay $${investCapital} to implement ${
              INVESTMENT_CARDS_BY_ID[unbuiltInv.cardId]?.name ?? unbuiltInv.cardId
            }`;

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

  const sell = () => {
    if (!canSell || !bestSellable) return;
    if (goldAlt) {
      dispatch({
        t: "SELL_BOURBON",
        playerId: humanId,
        barrelId: bestSellable.barrel.barrelId,
        applyGoldBourbonId: goldAlt.goldId,
      });
    } else {
      dispatch({
        t: "SELL_BOURBON",
        playerId: humanId,
        barrelId: bestSellable.barrel.barrelId,
      });
    }
  };

  const implement = () => {
    if (!canImplement || !unbuiltInv) return;
    dispatch({
      t: "IMPLEMENT_INVESTMENT",
      playerId: humanId,
      investmentInstanceId: unbuiltInv.instanceId,
    });
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
        "hand-scrollbar flex flex-col gap-2 border-t border-slate-800 bg-slate-950 px-[22px] py-3",
        // Lift above the make-bourbon dim overlay so the chips remain
        // interactive while the rest of the dashboard is blurred out.
        makeBourbon.active ? "relative z-40" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* ─── Row 1: identity + every action button in a single line ─── */}
      <div className="flex flex-shrink-0 items-center gap-3 overflow-x-auto">
        {/* Identity cluster */}
        <div className="flex min-w-[140px] flex-shrink-0 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span
              className={`block h-2.5 w-2.5 rounded-full ring-2 ring-slate-950 ${PLAYER_BG_CLASS[seatIdx]}`}
              aria-hidden
            />
            <span className="font-display text-base font-semibold text-amber-100">
              Your hand
            </span>
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
        </div>

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
          <MashStatusPill
            valid={mashValid}
            cask={mashBreakdown.cask}
            corn={mashBreakdown.corn}
            grain={mashBreakdown.grain}
            total={mashBreakdown.total}
            reason={mashValidation.ok ? null : mashValidation.reason}
            billPicked={!!makeBourbon.mashBillId}
          />
        ) : null}

        <ContextButton enabled={canSell} onClick={sell} title={sellReason}>
          Sell ↵
        </ContextButton>

        <ContextButton
          enabled={canImplement}
          onClick={implement}
          title={implementReason}
        >
          Implement ↵
        </ContextButton>

        <span className="flex-1" />

        {/* End-turn cluster: Audit (or Discard submit if pending) + Pass */}
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

      {/* ─── Row 2: cards (resources / bourbon / play) ─── */}
      <div className="flex items-stretch gap-[14px] overflow-x-auto">
        {/* Resources */}
        <div className="flex flex-shrink-0 items-stretch gap-2">
          <VerticalCaption>resources</VerticalCaption>
          <div className="flex gap-1.5">
            {me.resourceHand.length === 0 ? (
              <EmptyTallChip>no resources</EmptyTallChip>
            ) : (
              me.resourceHand.map((r) => {
                const meta = RESOURCE_META[r.resource];
                if (!meta) return null;
                const specialty = r.specialtyId
                  ? SPECIALTY_RESOURCES_BY_ID[r.specialtyId]
                  : null;
                const selectable = makeBourbon.active;
                const selected = selectedSet.has(r.instanceId);
                return (
                  <ResourceChip
                    key={r.instanceId}
                    meta={meta}
                    resource={r.resource}
                    specialty={specialty}
                    selectable={selectable}
                    selected={selected}
                    onSelect={
                      selectable
                        ? () => toggleMashCard(r.instanceId)
                        : undefined
                    }
                  />
                );
              })
            )}
          </div>
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
            <div className="flex items-center gap-1.5">
              {me.bourbonHand.length === 0 ? (
                <div className="grid h-[76px] w-[110px] place-items-center rounded-md border border-dashed border-slate-700 px-2 text-center font-mono text-[10px] uppercase tracking-[.12em] text-slate-500">
                  no mash bills
                </div>
              ) : (
                me.bourbonHand.map((id, i) => {
                  const card = BOURBON_CARDS_BY_ID[id];
                  if (!card) return null;
                  const auditMode = auditDiscard.active;
                  const makeMode = makeBourbon.active && !auditMode;
                  const idle = !auditMode && !makeMode;
                  const auditSelected = auditDiscard.mashBillIds.includes(id);
                  const makeSelected = makeBourbon.mashBillId === id;
                  // In idle mode every bourbon card is clickable to open
                  // the inspect modal. In make/audit modes the click does
                  // its mode-specific thing instead.
                  const selectable = makeMode || auditMode || idle;
                  const selected = auditMode ? auditSelected : makeSelected;
                  const className = [
                    "w-[110px] rounded-md transition-all",
                    selectable ? "cursor-pointer" : "",
                    selected
                      ? auditMode
                        ? "ring-2 ring-rose-400 -translate-y-0.5"
                        : "ring-2 ring-amber-300 -translate-y-0.5"
                      : selectable
                        ? auditMode
                          ? "ring-1 ring-rose-500/40 hover:-translate-y-0.5"
                          : makeMode
                            ? "ring-1 ring-amber-500/40 hover:-translate-y-0.5"
                            : "hover:-translate-y-0.5 hover:ring-1 hover:ring-amber-500/40"
                        : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  const onClick = auditMode
                    ? () => toggleAuditMashBill(id)
                    : makeMode
                      ? () => pickMashBill(id)
                      : () => inspectBill(id);
                  const title = auditMode
                    ? `${card.name} — toggle for audit discard`
                    : makeMode
                      ? `${card.name} — pick as mash bill`
                      : `${card.name} — click to inspect`;
                  if (selectable) {
                    return (
                      <button
                        key={`${id}-${i}`}
                        type="button"
                        aria-pressed={selected}
                        title={title}
                        onClick={onClick}
                        className={className}
                      >
                        <BourbonCardFace card={card} size="sm" />
                      </button>
                    );
                  }
                  return (
                    <div key={`${id}-${i}`} className={className}>
                      <BourbonCardFace card={card} size="sm" />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <Divider />

        {/* Play (ops + investments) */}
        <div className="flex flex-shrink-0 items-stretch gap-2">
          <VerticalCaption>play</VerticalCaption>
          <div className="flex max-w-[260px] flex-col gap-1.5">
            <div className="flex flex-wrap gap-1.5">
              {me.operations.length === 0 ? (
                <EmptyPill>no ops</EmptyPill>
              ) : (
                me.operations.map((ops) => {
                  const def = OPERATIONS_CARDS_BY_ID[ops.cardId];
                  const auditMode = auditDiscard.active;
                  const auditSelected = auditDiscard.operationsInstanceIds.includes(
                    ops.instanceId,
                  );
                  if (auditMode) {
                    return (
                      <button
                        key={ops.instanceId}
                        type="button"
                        aria-pressed={auditSelected}
                        title={
                          def?.effect
                            ? `${def.effect} — toggle for audit discard`
                            : "toggle for audit discard"
                        }
                        onClick={() => toggleAuditOperations(ops.instanceId)}
                        className={[
                          "rounded border px-2.5 py-1 font-mono text-[11px] font-semibold transition-all",
                          auditSelected
                            ? "border-rose-400 bg-rose-500/[0.20] text-rose-100 ring-2 ring-rose-400"
                            : "border-violet-500/45 bg-violet-500/[0.15] text-violet-200 hover:border-rose-500/60",
                        ].join(" ")}
                      >
                        {def?.title ?? ops.cardId}
                        <span className="ml-1.5 opacity-60">OPS</span>
                      </button>
                    );
                  }
                  return (
                    <span
                      key={ops.instanceId}
                      title={def?.effect}
                      className="rounded border border-violet-500/45 bg-violet-500/[0.15] px-2.5 py-1 font-mono text-[11px] font-semibold text-violet-200"
                    >
                      {def?.title ?? ops.cardId}
                      <span className="ml-1.5 opacity-60">OPS</span>
                    </span>
                  );
                })
              )}
            </div>
            {me.investments.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {me.investments.map((inv) => {
                  const def = INVESTMENT_CARDS_BY_ID[inv.cardId];
                  const isActive = inv.status === "active";
                  const auditMode = auditDiscard.active && !isActive;
                  const auditSelected = auditDiscard.investmentInstanceIds.includes(
                    inv.instanceId,
                  );
                  if (auditMode) {
                    return (
                      <button
                        key={inv.instanceId}
                        type="button"
                        aria-pressed={auditSelected}
                        title={
                          def?.effect
                            ? `${def.effect} — toggle for audit discard`
                            : "toggle for audit discard"
                        }
                        onClick={() => toggleAuditInvestment(inv.instanceId)}
                        className={[
                          "rounded border bg-emerald-500/[0.15] px-2.5 py-1 font-mono text-[11px] font-semibold transition-all",
                          auditSelected
                            ? "border-rose-400 bg-rose-500/[0.20] text-rose-100 ring-2 ring-rose-400"
                            : "border-slate-600 text-slate-300 opacity-80 hover:border-rose-500/60",
                        ].join(" ")}
                      >
                        {def?.name ?? inv.cardId}
                        <span className="ml-1.5 opacity-60">
                          ${def?.capital ?? 0} · UNBUILT
                        </span>
                      </button>
                    );
                  }
                  return (
                    <span
                      key={inv.instanceId}
                      title={def?.effect}
                      className={`rounded border bg-emerald-500/[0.15] px-2.5 py-1 font-mono text-[11px] font-semibold ${
                        isActive
                          ? "border-emerald-500/45 text-emerald-200"
                          : "border-slate-600 text-slate-300 opacity-80"
                      }`}
                    >
                      {def?.name ?? inv.cardId}
                      <span className="ml-1.5 opacity-60">
                        ${def?.capital ?? 0} ·{" "}
                        {isActive ? "ACTIVE" : "UNBUILT"}
                      </span>
                    </span>
                  );
                })}
              </div>
            ) : null}
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
        {cask}c · {corn}🌽 · {grain}g · {total}/6
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

function ResourceChip({
  meta,
  resource,
  specialty,
  selectable = false,
  selected = false,
  onSelect,
}: {
  meta: ResourceMeta;
  resource: string;
  specialty: ResourceCardDef | null;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const Element = selectable ? "button" : "div";
  return (
    <Element
      type={selectable ? "button" : undefined}
      onClick={selectable ? onSelect : undefined}
      aria-pressed={selectable ? selected : undefined}
      className={[
        "relative flex h-[76px] w-[56px] flex-shrink-0 flex-col rounded-md border-2 p-1.5 shadow-md transition-all",
        meta.tint,
        selected ? "border-amber-300 ring-2 ring-amber-300" : meta.border,
        selectable && !selected ? "cursor-pointer hover:-translate-y-0.5" : "",
        selectable && selected ? "-translate-y-0.5" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      title={specialty?.rule}
      aria-label={specialty ? `${resource}: ${specialty.name}` : resource}
    >
      {selected ? (
        <span
          className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-amber-300 font-mono text-[9px] font-bold text-slate-950 shadow"
          aria-hidden
        >
          ✓
        </span>
      ) : null}
      <div className="flex items-center justify-between">
        <span
          className={`font-mono text-[9px] font-bold tracking-[.1em] ${meta.ink}`}
        >
          {meta.short}
        </span>
        <span className={`text-[10px] opacity-70 ${meta.ink}`}>
          {meta.glyph}
        </span>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-0.5 text-center">
        <span
          className={`font-mono text-[11px] font-semibold uppercase tracking-[.05em] ${meta.ink}`}
        >
          {resource}
        </span>
        {specialty ? (
          <span
            className={`line-clamp-2 px-0.5 text-[8px] leading-[1.1] ${meta.ink} opacity-75`}
          >
            {specialty.name}
          </span>
        ) : null}
      </div>
    </Element>
  );
}

function EmptyTallChip({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid h-[76px] place-items-center rounded-md border border-dashed border-slate-700 px-3 font-mono text-[9px] uppercase tracking-[.12em] text-slate-500">
      {children}
    </div>
  );
}

function EmptyPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-dashed border-slate-700 px-2.5 py-1 font-mono text-[11px] italic text-slate-500">
      {children}
    </span>
  );
}
