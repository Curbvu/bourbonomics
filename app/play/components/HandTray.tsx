"use client";

/**
 * HandTray — bottom-of-canvas horizontal strip showing the human player's
 * hand, with the action affordances co-located with what they act on.
 *
 * Per-section contextual buttons:
 *   - Make ↵       enters the in-place "make bourbon" mode. The dashboard
 *                  blurs except for the hand and rickhouses; the player
 *                  ticks resource chips in their hand to build the mash,
 *                  then clicks a rickhouse on the board to barrel it.
 *                  Cancel via Esc, the Cancel button, or clicking the
 *                  dim overlay.
 *   - Sell ↵       sells the oldest sellable barrel using the displayed
 *                  bourbon card (face-up if available, else first in hand)
 *   - Implement ↵  pays printed capital on the first unbuilt investment
 *   - Pass ↵       dispatches PASS_ACTION
 *
 * Each button is enabled only when the action is legal for the current
 * turn / phase / cash state; otherwise it sits in a disabled slate
 * treatment with a tooltip explaining why.
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

  // Total cards visible in tray (resources + every kind of card-in-hand).
  // The 10-card hand limit only counts mash bills + unbuilt investments +
  // operations (not resources, not Gold trophies); `cappedHandSize` is what
  // the Audit cares about.
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

  // Bourbon hand is multi-card; soft-capped at HAND_LIMIT (combined with
  // unbuilt investments + ops). Drawing past the cap is allowed but
  // exposes you to the next Audit.
  const overHandLimit = cappedHandSize > HAND_LIMIT;
  const auditPending =
    me.pendingAuditOverage != null && me.pendingAuditOverage > 0;
  const loanFrozen = me.loanSiphonActive;

  // ---- Action eligibility checks ----------------------------------------

  // Make Bourbon — gate on "minimum viable mash possible". The mash gets
  // built inline by ticking chips while make-bourbon mode is active.
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

  // Live mash status while make-bourbon mode is active.
  const selectedSet = new Set(makeBourbon.selectedIds);
  const selectedMash = me.resourceHand.filter((r) =>
    selectedSet.has(r.instanceId),
  );
  const mashValidation = validateMash(selectedMash);
  const mashBreakdown = summarizeMash(selectedMash);
  const mashValid = mashValidation.ok;

  // Sell — pick the highest-paying sellable barrel as the default. With
  // mash bills locked at production, every barrel has a known sale price
  // right now; the Sell ↵ button is a "sell the obvious best one"
  // shortcut. Players can also click any individual barrel chip directly
  // in the rickhouse grid to sell that specific barrel.
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

  // Implement — auto-pick the first unbuilt investment. Cap at 3 active.
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

  // Audit — any player whose turn it is may call once per round if they
  // can afford the action and don't owe a discard themselves.
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

  // Audit discard — auto-entered via the top-level useEffect above; this
  // block just exposes the derived selection counts to the render tree.

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
        "hand-scrollbar flex items-center gap-[14px] overflow-x-auto border-t border-slate-800 bg-slate-950 px-[22px] py-3",
        // Lift above the make-bourbon dim overlay so the chips remain
        // interactive while the rest of the dashboard is blurred out.
        makeBourbon.active ? "relative z-40" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* 1 — identity */}
      <div className="flex min-w-[120px] flex-shrink-0 flex-col gap-0.5">
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
        {auditPending ? (
          <span className="font-mono text-[10px] uppercase tracking-[.12em] text-rose-400">
            audit: discard {me.pendingAuditOverage}
          </span>
        ) : null}
        {me.loanRemaining > 0 ? (
          <span
            className={[
              "font-mono text-[10px] uppercase tracking-[.12em]",
              loanFrozen ? "text-rose-300" : "text-amber-300",
            ].join(" ")}
            title={
              loanFrozen
                ? `Frozen by loan — every income siphons to bank, no spending until $${me.loanRemaining} clears`
                : `Loan repayment due next Phase 1: $${me.loanRemaining}`
            }
          >
            {loanFrozen ? "FROZEN " : "loan "}${me.loanRemaining}
          </span>
        ) : null}
      </div>

      {/* 2 — resources, with Make stacked above */}
      <div className="flex flex-shrink-0 items-stretch gap-2">
        <VerticalCaption>resources</VerticalCaption>
        <div className="flex flex-col items-start gap-1.5">
          <div className="flex items-center gap-2">
            <ContextButton
              enabled={canStartMake || makeBourbon.active}
              onClick={
                makeBourbon.active ? cancelMakeBourbon : startMakeBourbon
              }
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
              />
            ) : null}
          </div>
          {/* Chips flow continuously; if total HandTray width exceeds the
              viewport, the parent section's `overflow-x-auto` provides a
              styled thin amber scrollbar at the bottom. */}
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
      </div>

      <Divider />

      {/* 4 — bourbon hand, with Sell stacked above. The full 4-card hand
            is rendered. While make-bourbon mode is active, clicking a
            card picks it as the locked-in mash bill for the new barrel. */}
      <div className="flex flex-shrink-0 items-stretch gap-2">
        <VerticalCaption>bourbon</VerticalCaption>
        <div className="flex flex-col items-start gap-1.5">
          <div className="flex items-center gap-2">
            <ContextButton enabled={canSell} onClick={sell} title={sellReason}>
              Sell ↵
            </ContextButton>
            {makeBourbon.active ? (
              <span
                title={
                  makeBourbon.mashBillId
                    ? "Mash bill picked"
                    : "Pick a mash bill to commit to the barrel"
                }
                className={[
                  "rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-[.10em]",
                  makeBourbon.mashBillId
                    ? "border-emerald-500/50 bg-emerald-500/[0.10] text-emerald-200"
                    : "border-amber-500/50 bg-amber-500/[0.10] text-amber-200",
                ].join(" ")}
              >
                {makeBourbon.mashBillId ? "bill ✓" : "pick bill ↓"}
              </span>
            ) : (
              <span className="font-mono text-[10px] uppercase tracking-[.10em] text-slate-500 tabular-nums">
                {me.bourbonHand.length} bills
              </span>
            )}
          </div>
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
                const auditSelected = auditDiscard.mashBillIds.includes(id);
                const makeSelected = makeBourbon.mashBillId === id;
                const selectable = makeMode || auditMode;
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
                        : "ring-1 ring-amber-500/40 hover:-translate-y-0.5"
                      : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                if (selectable) {
                  return (
                    <button
                      key={`${id}-${i}`}
                      type="button"
                      aria-pressed={selected}
                      title={
                        auditMode
                          ? `${card.name} — toggle for audit discard`
                          : `${card.name} — pick as mash bill`
                      }
                      onClick={() =>
                        auditMode
                          ? toggleAuditMashBill(id)
                          : pickMashBill(id)
                      }
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
            {me.goldBourbons.length > 0 ? (
              <div
                className="ml-1 flex items-center gap-1 rounded-md border border-amber-400/50 bg-amber-500/[0.10] px-2 py-1"
                title={`${me.goldBourbons.length} unlocked Gold Bourbon${me.goldBourbons.length === 1 ? "" : "s"} — score brand value at game end.`}
              >
                <span className="font-mono text-[10px] uppercase tracking-[.12em] text-amber-300">
                  gold
                </span>
                <span className="font-mono text-[12px] font-bold text-amber-200 tabular-nums">
                  {me.goldBourbons.length}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <Divider />

      {/* 6 — play (ops + invest), with Implement stacked above */}
      <div className="flex flex-shrink-0 items-stretch gap-2">
        <VerticalCaption>play</VerticalCaption>
        <div className="flex flex-col items-start gap-1.5">
          <ContextButton
            enabled={canImplement}
            onClick={implement}
            title={implementReason}
          >
            Implement ↵
          </ContextButton>
          <div className="flex max-w-[220px] flex-col gap-1.5">
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

      {/* 7 — spacer */}
      <span className="flex-1" />

      {/* 8 — end-turn cluster */}
      <div className="flex flex-shrink-0 items-center gap-2">
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

    </section>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents

/**
 * Per-section contextual primary button. Same amber gradient as the End-turn
 * Pass button so each section's "do the thing" affordance reads as primary.
 * Disabled state matches the Pass button — slate-on-slate with a tooltip
 * explaining why.
 */
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

/**
 * Live mash readout pill shown next to the Cancel button while make-bourbon
 * mode is active. Mirrors the ✓/! styling from the modal version so the
 * player gets immediate feedback as they tick chips.
 */
function MashStatusPill({
  valid,
  cask,
  corn,
  grain,
  total,
  reason,
}: {
  valid: boolean;
  cask: number;
  corn: number;
  grain: number;
  total: number;
  reason: string | null;
}) {
  return (
    <span
      title={reason ?? undefined}
      className={[
        "flex items-center gap-2 rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-[.10em]",
        valid
          ? "border-emerald-500/50 bg-emerald-500/[0.10] text-emerald-200"
          : "border-slate-700 bg-slate-900 text-slate-400",
      ].join(" ")}
    >
      <span
        className={[
          "grid h-3.5 w-3.5 place-items-center rounded-full font-bold",
          valid ? "bg-emerald-500 text-slate-950" : "bg-slate-700 text-slate-300",
        ].join(" ")}
        aria-hidden
      >
        {valid ? "✓" : "·"}
      </span>
      <span className="tabular-nums">
        {cask}c · {corn}🌽 · {grain}g · {total}/6
      </span>
      {valid ? (
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
      className="block h-[60px] w-px flex-shrink-0 bg-slate-800"
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
