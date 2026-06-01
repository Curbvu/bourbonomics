"use client";

/**
 * v3.2 BrandPortfolioDrawer — full-viewport overlay for the long-game
 * scoring track.
 *
 * Opened from the PortfolioStrip click, the action-bar Portfolio
 * button, or programmatically. Renders both portfolios (flagship +
 * second if drafted), the projected end-game score for each, the
 * face-up secondary draft pool, the inventory, and — when a Generic
 * Labor is available — the Draft Second Portfolio / Retrieve Bottle
 * affordances.
 *
 * Layout: header strip · two-column body (flagship + (second |
 * scoring + pool)) · footer status. Page-root mount so the backdrop
 * covers the whole viewport.
 */

import { useEffect, useState, type ReactNode } from "react";
import type {
  Bottle,
  GameAction,
  Portfolio,
  PortfolioSlotDef,
  PortfolioState,
  PlayerState,
} from "@bourbonomics/engine";
import {
  eligibleSlotsForBottle,
  getPortfolio,
  scorePortfolio,
  slotEligibleForFill,
  tierUnlockedAt,
} from "@bourbonomics/engine";
import { useGameStore } from "@/lib/store/game";
import BottleChip from "./BottleChip";

interface RetrieveContext {
  bottleId: string;
  /** Set of `${kind}:${slotIndex}` keys identifying eligible slots. */
  eligibleSet: Set<string>;
  onPlace: (kind: "flagship" | "second", slotIndex: number) => void;
}

export default function BrandPortfolioDrawer() {
  const {
    state,
    humanSeatPlayerId,
    portfolioDrawerOpen,
    setPortfolioDrawerOpen,
    dispatch,
  } = useGameStore();
  const player = humanSeatPlayerId
    ? state?.players.find((p) => p.id === humanSeatPlayerId)
    : null;

  // Local retrieve-from-inventory mode. When set, the drawer shows
  // eligible slots glowing and clicking one dispatches RETRIEVE_BOTTLE.
  const [retrievingBottleId, setRetrievingBottleId] = useState<string | null>(
    null,
  );

  // Esc → cancel retrieve first, otherwise close the drawer.
  useEffect(() => {
    if (!portfolioDrawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (retrievingBottleId) {
        setRetrievingBottleId(null);
      } else {
        setPortfolioDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [portfolioDrawerOpen, setPortfolioDrawerOpen, retrievingBottleId]);

  // If the drawer just closed (or the inventory bottle disappeared from
  // state because some other path moved it), drop the retrieve target.
  useEffect(() => {
    if (!portfolioDrawerOpen && retrievingBottleId) {
      setRetrievingBottleId(null);
    }
  }, [portfolioDrawerOpen, retrievingBottleId]);

  if (!portfolioDrawerOpen || !state || !player) return null;
  const flagship = getPortfolio(player.flagshipPortfolio.portfolioId);
  if (!flagship) return null;
  const second = player.secondPortfolio
    ? getPortfolio(player.secondPortfolio.portfolioId) ?? null
    : null;

  const close = () => setPortfolioDrawerOpen(false);

  // Generic Labor in hand — required to spend for Draft Second
  // Portfolio and Retrieve Bottle.
  const genericLaborCardId = (() => {
    const labor = player.hand.find(
      (c) => c.type === "labor" && c.laborSubtype === "generic",
    );
    return labor?.id ?? null;
  })();

  const draftPool = state.secondPortfolioDraftPool ?? [];
  const finalRound = state.finalRoundTriggered;
  const canDraftSecond =
    !player.secondPortfolioDrafted &&
    player.secondPortfolio == null &&
    !finalRound &&
    genericLaborCardId != null &&
    draftPool.length > 0;

  const onDraftSecond = (portfolioId: string) => {
    if (!canDraftSecond || !genericLaborCardId) return;
    const action: GameAction = {
      type: "DRAFT_SECOND_PORTFOLIO",
      playerId: player.id,
      portfolioId,
      laborCardId: genericLaborCardId,
    };
    dispatch(action);
  };

  // Retrieve flow. Build a RetrieveContext only when there's an active
  // target AND the player can actually pay (Generic Labor in hand). If
  // labor is missing we still let the player *select* a bottle so they
  // can see the eligibility highlights for planning, but the slots
  // themselves stay un-clickable (canDispatch=false drops the onPlace).
  const retrieveBottle = retrievingBottleId
    ? player.inventory.find((b) => b.bottleId === retrievingBottleId) ?? null
    : null;
  const retrieveEligible = retrieveBottle
    ? eligibleSlotsForBottle(retrieveBottle, player)
    : [];
  const onRetrievePlace = (
    kind: "flagship" | "second",
    slotIndex: number,
  ) => {
    if (!retrieveBottle || !genericLaborCardId) return;
    const action: GameAction = {
      type: "RETRIEVE_BOTTLE",
      playerId: player.id,
      bottleId: retrieveBottle.bottleId,
      destination: { kind, slotIndex },
      laborCardId: genericLaborCardId,
    };
    dispatch(action);
    setRetrievingBottleId(null);
  };
  const retrieveContext: RetrieveContext | null =
    retrieveBottle && genericLaborCardId
      ? {
          bottleId: retrieveBottle.bottleId,
          eligibleSet: new Set(
            retrieveEligible.map((e) => `${e.kind}:${e.slotIndex}`),
          ),
          onPlace: onRetrievePlace,
        }
      : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Brand Portfolio"
      className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur"
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[calc(100vh-2rem)] w-full max-w-[1320px] flex-col gap-3 overflow-hidden rounded-xl border border-amber-700/50 bg-gradient-to-b from-slate-950 to-slate-900/95 px-5 py-4 shadow-[0_24px_64px_rgba(0,0,0,.55)]"
      >
        {/* Header */}
        <header className="flex flex-shrink-0 items-start justify-between gap-4 border-b border-amber-900/40 pb-3">
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[12px] uppercase tracking-[.18em] text-amber-300">
              Brand Portfolios
            </div>
            <div className="mt-1 font-display text-2xl font-semibold text-amber-100">
              Your Product Lineup
            </div>
            <div className="mt-1 font-mono text-[11px] uppercase tracking-[.12em] text-slate-400">
              Bottle your sales · climb the tiers · banked rep + portfolio scoring = final score
            </div>
          </div>
          <div className="flex items-center gap-2">
            <InventoryChip count={player.inventory.length} />
            <button
              type="button"
              onClick={close}
              className="rounded-md border border-slate-600 bg-slate-800/70 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[.16em] text-slate-100 hover:bg-slate-700/60"
            >
              Close ✕
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
          {/* Retrieve banner — shown while a bottle is selected for
              retrieve. Displays the bottle + Cancel; tells the player
              how many slots are eligible (or why nothing's clickable). */}
          {retrieveBottle ? (
            <RetrieveBanner
              bottle={retrieveBottle}
              eligibleCount={retrieveEligible.length}
              hasLabor={genericLaborCardId != null}
              onCancel={() => setRetrievingBottleId(null)}
            />
          ) : null}

          <PortfolioBoard
            kind="flagship"
            portfolio={flagship}
            state={player.flagshipPortfolio}
            player={player}
            retrieveContext={retrieveContext}
            hero
          />

          <div className="grid min-h-0 flex-1 gap-3" style={{ gridTemplateColumns: "minmax(0, 1.35fr) minmax(0, 1fr)" }}>
            {second && player.secondPortfolio ? (
              <PortfolioBoard
                kind="second"
                portfolio={second}
                state={player.secondPortfolio}
                player={player}
                retrieveContext={retrieveContext}
              />
            ) : (
              <DraftPoolPanel
                draftPool={draftPool}
                canDraft={canDraftSecond}
                hasLabor={genericLaborCardId != null}
                finalRound={finalRound}
                onDraft={onDraftSecond}
              />
            )}
            <ScoringReadout flagship={flagship} second={second} player={player} />
          </div>

          {/* Inventory section — always visible. Bottles become
              clickable when at least one slot is eligible (otherwise
              the click would always fail). The Generic Labor cost is
              surfaced in the header. */}
          <InventoryPanel
            inventory={player.inventory}
            hasLabor={genericLaborCardId != null}
            selectedBottleId={retrievingBottleId}
            onSelect={setRetrievingBottleId}
            playerEligibleCount={(bottle) =>
              eligibleSlotsForBottle(bottle, player).length
            }
          />

          {/* When a second is drafted, the pool moves to a compact
              footer chip so the player can still see what's undrafted. */}
          {second && player.secondPortfolio ? (
            <CompactPool draftPool={draftPool} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// PortfolioBoard — full portfolio rendering with all slots visible.
// ─────────────────────────────────────────────────────────────────────

function PortfolioBoard({
  kind,
  portfolio,
  state,
  player,
  retrieveContext,
  hero,
}: {
  kind: "flagship" | "second";
  portfolio: Portfolio;
  state: PortfolioState;
  player: PlayerState;
  retrieveContext: RetrieveContext | null;
  hero?: boolean;
}) {
  const score = scorePortfolio(portfolio, state, player);
  const tiers = portfolio.tiers.map((tier) => ({
    index: tier.index,
    slotDefs: tier.slotIndices
      .map((i) => portfolio.slots[i])
      .filter((s): s is PortfolioSlotDef => !!s),
    unlocked: tierUnlockedAt(portfolio, state, tier.index),
  }));
  return (
    <section
      className={[
        "flex flex-col gap-2 rounded-lg border px-3 py-2.5",
        hero
          ? "border-amber-600/55 bg-gradient-to-b from-amber-950/30 to-slate-950/65"
          : "border-slate-700/60 bg-slate-950/55",
      ].join(" ")}
    >
      <header className="flex items-baseline gap-3">
        <span
          className="font-mono text-[10.5px] font-bold uppercase tracking-[.18em]"
          style={{ color: hero ? "var(--gold)" : "var(--brass)" }}
        >
          {kind === "flagship" ? "Flagship Portfolio" : "Second Portfolio · Drafted"}
        </span>
        <span className="font-display text-[20px] font-semibold leading-none text-amber-100">
          {portfolio.name}
        </span>
        <span aria-hidden className="h-px flex-1" style={{ background: "linear-gradient(90deg, var(--rule), transparent)" }} />
        <BonusChip label="Completion" value={portfolio.completionBonus} met={score.tier !== "none"} />
        <BonusChip label="Theme" value={portfolio.themeBonus} met={score.tier === "theme" || score.tier === "mastery"} />
        <BonusChip label="Mastery" value={portfolio.masteryBonus} met={score.tier === "mastery"} />
      </header>

      <div className="flex flex-wrap items-stretch gap-3">
        {tiers.map((tier, ti) => (
          <div key={tier.index} className="flex items-stretch gap-3">
            {ti > 0 ? <TierDivider /> : null}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span
                  className="font-mono text-[9.5px] font-bold uppercase tracking-[.16em]"
                  style={{ color: tier.unlocked ? "var(--brass)" : "var(--ink-muted)" }}
                >
                  Tier {tier.index + 1}
                </span>
                <span
                  className={[
                    "rounded border px-1.5 py-[1px] font-mono text-[9px] font-bold uppercase tracking-[.10em]",
                    tier.unlocked
                      ? "border-emerald-500/60 bg-emerald-900/20 text-emerald-200"
                      : "border-slate-700/50 bg-slate-900/40 text-slate-500",
                  ].join(" ")}
                >
                  {tier.unlocked ? "Unlocked" : "Locked"}
                </span>
              </div>
              <div className="flex gap-2">
                {tier.slotDefs.map((slotDef) => {
                  const isRetrieveTarget =
                    retrieveContext?.eligibleSet.has(
                      `${kind}:${slotDef.index}`,
                    ) ?? false;
                  return (
                    <SlotCard
                      key={slotDef.index}
                      slotDef={slotDef}
                      portfolio={portfolio}
                      state={state}
                      isRetrieveTarget={isRetrieveTarget}
                      onRetrieveClick={
                        isRetrieveTarget
                          ? () => retrieveContext!.onPlace(kind, slotDef.index)
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Restriction + mastery footer */}
      <div className="mt-1 flex flex-wrap gap-2 border-t border-slate-800/70 pt-2">
        {portfolio.brandRestriction ? (
          <ConditionPill
            label="Brand Restriction"
            value={portfolio.brandRestriction.label}
            met={score.tier === "theme" || score.tier === "mastery"}
          />
        ) : (
          <ConditionPill
            label="Brand Restriction"
            value="None — any bottle qualifies for Theme"
            met={score.tier !== "none"}
          />
        )}
        <ConditionPill
          label="Mastery Condition"
          value={portfolio.masteryCondition.label}
          met={score.tier === "mastery"}
        />
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// SlotCard — full slot rendering (taller than the strip's MiniSlot).
// ─────────────────────────────────────────────────────────────────────

function SlotCard({
  slotDef,
  portfolio,
  state,
  isRetrieveTarget,
  onRetrieveClick,
}: {
  slotDef: PortfolioSlotDef;
  portfolio: Portfolio;
  state: PortfolioState;
  isRetrieveTarget?: boolean;
  onRetrieveClick?: () => void;
}) {
  const slot = state.slots[slotDef.index];
  if (!slot) return null;
  const isOpen = slotEligibleForFill(portfolio, state, slotDef.index);
  const locked = !slot.filled && !isOpen;
  const borderStyle = slotDef.required ? "solid" : "dashed";
  // Retrieve target wins the border color so the eligible-for-this-
  // bottle glow stands out from the regular open/filled palette.
  const borderColor = isRetrieveTarget
    ? "var(--gold)"
    : slot.filled
      ? "rgba(198,157,82,.6)"
      : isOpen
        ? "rgba(198,157,82,.45)"
        : "rgba(110,80,50,.4)";
  const sharedStyle = {
    borderWidth: 1.5,
    borderStyle,
    borderColor,
    background: isRetrieveTarget
      ? "radial-gradient(70% 80% at 50% 30%, rgba(240,201,112,.2), rgba(20,14,8,.85) 65%)"
      : slot.filled
        ? "linear-gradient(180deg, rgba(58,40,24,.7), rgba(26,18,11,.9))"
        : "linear-gradient(180deg, rgba(28,18,11,.7), rgba(16,11,7,.9))",
    boxShadow: isRetrieveTarget
      ? "0 0 0 2px rgba(240,201,112,.55), 0 8px 22px rgba(240,201,112,.3)"
      : ("none" as const),
    opacity: locked && !isRetrieveTarget ? 0.58 : 1,
  };
  const sharedClass = [
    "flex w-[164px] flex-col gap-1 rounded-lg px-2 py-2 text-left",
    onRetrieveClick
      ? "cursor-pointer transition-transform hover:-translate-y-[2px] hover:brightness-110"
      : "",
  ].join(" ");
  // Render as <button> only when a retrieve target click is actually
  // wired — otherwise stay a non-interactive <div> to keep keyboard
  // focus order clean.
  const inner = (
    <>
      <div className="flex items-baseline justify-between gap-1">
        <span
          className="font-mono text-[8.5px] font-bold uppercase tracking-[.12em]"
          style={{ color: slotDef.required ? "var(--brass)" : "var(--mute)" }}
        >
          {slotDef.required ? "Required" : "Optional"}
        </span>
        <span
          className="rounded-full border px-1.5 py-px font-mono text-[9px] font-bold tabular-nums"
          style={{
            borderColor: slot.filled ? "var(--gold)" : "rgba(110,80,50,.5)",
            color: slot.filled ? "var(--gold)" : "var(--mute)",
            background: slot.filled
              ? "linear-gradient(180deg, rgba(240,201,112,.22), rgba(176,106,56,.1))"
              : "rgba(34,23,16,.5)",
          }}
        >
          +{slotDef.endGameValue}
        </span>
      </div>
      <div className="font-display text-[13px] font-semibold leading-tight text-amber-100">
        {slotDef.name}
      </div>
      <div className="font-mono text-[9.5px] leading-tight text-slate-400">
        {slotDef.requirement.label}
      </div>
      <div className="mt-auto flex flex-col gap-1 border-t border-slate-800/70 pt-1.5">
        {isRetrieveTarget ? (
          <span className="font-mono text-[10px] font-bold uppercase tracking-[.14em] text-amber-300">
            ↓ Place here
          </span>
        ) : slot.filled && slot.bottle ? (
          <div className="flex items-center gap-1.5">
            <BottleChip bottle={slot.bottle} size="xs" />
            <span className="truncate font-display text-[11px] italic text-slate-300">
              {slot.bottle.name}
            </span>
            {slot.signatureMatched ? (
              <span title="Signature bonus matched" aria-hidden className="ml-auto text-[12px] text-amber-300">
                ★
              </span>
            ) : null}
          </div>
        ) : locked ? (
          <span className="font-mono text-[9px] uppercase tracking-[.14em] text-slate-600">
            🔒 Locked
          </span>
        ) : (
          <span className="font-mono text-[9px] uppercase tracking-[.14em] text-amber-300/80">
            ○ Open
          </span>
        )}
        <div className="font-mono text-[8.5px] leading-tight text-slate-500">
          <span className="text-amber-300/70">⚐</span> {slotDef.onFillReward.label}
        </div>
        {slotDef.signatureBonus ? (
          <div className="font-mono text-[8.5px] leading-tight text-amber-300/70">
            <span>★</span> {slotDef.signatureBonus.label}
          </div>
        ) : null}
      </div>
    </>
  );
  if (onRetrieveClick) {
    return (
      <button
        type="button"
        onClick={onRetrieveClick}
        className={sharedClass}
        style={sharedStyle}
      >
        {inner}
      </button>
    );
  }
  return (
    <div className={sharedClass} style={sharedStyle}>
      {inner}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// DraftPoolPanel — when no second portfolio is drafted, show the
// face-up pool and a TWO-STEP draft flow: first click selects (no
// dispatch), second click on the same card (or pressing the
// confirm CTA) commits via DRAFT_SECOND_PORTFOLIO. Drafting the
// second portfolio is permanent + irreversible, so the extra tap
// is a safety rail against fat-fingers.
// ─────────────────────────────────────────────────────────────────────

function DraftPoolPanel({
  draftPool,
  canDraft,
  hasLabor,
  finalRound,
  onDraft,
}: {
  draftPool: readonly string[];
  canDraft: boolean;
  hasLabor: boolean;
  finalRound: boolean;
  onDraft: (portfolioId: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Clear the staged selection if the pool changes underneath (e.g.
  // some other player drafts and the row reshuffles) so a stale id
  // can't fire the wrong portfolio on the next click.
  useEffect(() => {
    if (selectedId && !draftPool.includes(selectedId)) {
      setSelectedId(null);
    }
  }, [draftPool, selectedId]);
  // Esc clears the staged selection without committing.
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);
  const onCardClick = (id: string) => {
    if (!canDraft) return;
    // Tap-tap: second tap on the SAME selected card commits.
    if (selectedId === id) {
      onDraft(id);
      setSelectedId(null);
      return;
    }
    // Tap on a different card just switches the selection.
    setSelectedId(id);
  };
  const onConfirm = () => {
    if (!selectedId || !canDraft) return;
    onDraft(selectedId);
    setSelectedId(null);
  };
  const selectedPortfolio = selectedId ? getPortfolio(selectedId) : null;
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-slate-700/60 bg-slate-950/55 px-3 py-2">
      <header className="flex items-baseline gap-3">
        <span className="font-mono text-[10.5px] font-bold uppercase tracking-[.18em] text-amber-300">
          Secondary Pool
        </span>
        <span className="font-display text-[14px] italic text-slate-400">
          {draftPool.length} board{draftPool.length === 1 ? "" : "s"} face-up · draft 1 per game with 1 Generic Labor
        </span>
        <span aria-hidden className="h-px flex-1" style={{ background: "linear-gradient(90deg, var(--rule), transparent)" }} />
        {finalRound ? (
          <span className="rounded border border-rose-500/50 bg-rose-900/30 px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[.12em] text-rose-200">
            Drafting closed · final round
          </span>
        ) : !hasLabor ? (
          <span className="rounded border border-slate-700/60 bg-slate-900/50 px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[.12em] text-slate-400">
            Need 1 Generic Labor
          </span>
        ) : null}
      </header>
      <div className="flex flex-wrap gap-2">
        {draftPool.map((id) => {
          const p = getPortfolio(id);
          if (!p) return null;
          return (
            <DraftCard
              key={id}
              portfolio={p}
              eligible={canDraft}
              selected={selectedId === id}
              onClick={() => onCardClick(id)}
            />
          );
        })}
        {draftPool.length === 0 ? (
          <div className="rounded border border-dashed border-slate-700/70 px-3 py-4 text-center font-mono text-[10px] italic text-slate-500">
            The pool is empty.
          </div>
        ) : null}
      </div>
      {/* Confirm strip — only paints when a portfolio is staged. The
          stripe gives the player a second-click target that's bigger
          and more discoverable than the tap-the-same-card path, and
          spells out which board the click will commit to. */}
      {selectedPortfolio && canDraft ? (
        <div
          className="mt-1 flex items-center justify-between gap-3 rounded-md border border-amber-500/60 px-3 py-1.5"
          style={{
            background:
              "linear-gradient(180deg, rgba(240,201,112,.12), rgba(34,23,16,.55))",
          }}
        >
          <span className="flex flex-col gap-0.5 leading-tight">
            <span className="font-mono text-[9px] font-bold uppercase tracking-[.18em] text-amber-300">
              Selected
            </span>
            <span className="font-display text-[13px] font-semibold text-amber-100">
              {selectedPortfolio.name}
            </span>
          </span>
          <span className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="rounded border border-slate-600 bg-slate-800/60 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[.12em] text-slate-300 hover:bg-slate-700/60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="rounded border px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[.14em]"
              style={{
                borderColor: "var(--gold)",
                background: "linear-gradient(180deg, #f0c970, #c69d52)",
                color: "#1a120b",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,.4), 0 4px 12px rgba(240,201,112,.35)",
              }}
            >
              Confirm draft ↵
            </button>
          </span>
        </div>
      ) : null}
    </section>
  );
}

function DraftCard({
  portfolio,
  eligible,
  selected,
  onClick,
}: {
  portfolio: Portfolio;
  eligible: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  // Compute a quick "ceiling" estimate: sum of slot values + bonuses.
  const slotSum = portfolio.slots.reduce((n, s) => n + s.endGameValue, 0);
  const ceiling =
    slotSum + portfolio.completionBonus + portfolio.themeBonus + portfolio.masteryBonus;
  return (
    <button
      type="button"
      onClick={eligible ? onClick : undefined}
      disabled={!eligible}
      aria-pressed={selected}
      className={[
        "flex w-[178px] flex-col gap-1 rounded-lg border px-2.5 py-2 text-left transition-all",
        !eligible
          ? "border-slate-700/50 bg-slate-950/60 opacity-75"
          : selected
            ? "-translate-y-[2px] border-amber-300 bg-amber-950/40 shadow-[0_0_0_2px_rgba(240,201,112,.55),0_10px_24px_rgba(240,201,112,.25)]"
            : "border-amber-700/55 bg-slate-950/70 hover:-translate-y-[1px] hover:border-amber-400 hover:bg-amber-950/30",
      ].join(" ")}
    >
      <div className="flex items-baseline justify-between gap-1">
        <span className="font-mono text-[8.5px] font-bold uppercase tracking-[.12em] text-slate-400">
          {portfolio.slots.length} slots
        </span>
        {eligible ? (
          <span
            className="rounded-full px-1.5 py-px font-mono text-[8.5px] font-bold uppercase tracking-[.1em]"
            style={
              selected
                ? {
                    background:
                      "linear-gradient(180deg, #f0c970, #c69d52)",
                    color: "#1a120b",
                    boxShadow: "0 0 8px rgba(240,201,112,.5)",
                  }
                : {
                    background:
                      "linear-gradient(180deg, rgba(240,201,112,.22), rgba(176,106,56,.12))",
                    color: "var(--gold)",
                  }
            }
          >
            {selected ? "Confirm ↵" : "Select"}
          </span>
        ) : null}
      </div>
      <div className="font-display text-[14px] font-semibold leading-tight text-amber-100">
        {portfolio.name}
      </div>
      <div className="font-display text-[11px] italic leading-snug text-slate-400" style={{ minHeight: 28 }}>
        {portfolio.brandRestriction?.label ?? "No restriction"}
      </div>
      <div className="mt-1 flex items-center justify-between gap-1 border-t border-slate-800/70 pt-1">
        <span className="label-sm" style={{ color: "var(--mute)" }}>
          Ceiling
        </span>
        <span className="font-display text-[14px] font-bold text-amber-300 tabular-nums">
          ~{ceiling}
          <span className="ml-1 font-mono text-[8.5px] text-amber-300/70">REP</span>
        </span>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────
// ScoringReadout — projected end-game across both portfolios.
// ─────────────────────────────────────────────────────────────────────

function ScoringReadout({
  flagship,
  second,
  player,
}: {
  flagship: Portfolio;
  second: Portfolio | null;
  player: PlayerState;
}) {
  const fs = scorePortfolio(flagship, player.flagshipPortfolio, player);
  const ss = second && player.secondPortfolio
    ? scorePortfolio(second, player.secondPortfolio, player)
    : null;
  // Failure penalty — only if drafted but completion not reached.
  let penalty = 0;
  if (player.secondPortfolioDrafted && player.secondPortfolio && second) {
    const unfilledReq = second.slots
      .filter((s) => s.required)
      .filter((s) => !player.secondPortfolio!.slots[s.index]?.filled).length;
    if (unfilledReq > 0) {
      penalty = Math.max(-10, unfilledReq * -2);
    }
  }
  const grand = player.capital + player.reputation + fs.total + (ss ? ss.total + penalty : 0);
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-slate-700/60 bg-slate-950/55 px-3 py-2">
      <header className="flex items-baseline gap-3">
        <span className="font-mono text-[10.5px] font-bold uppercase tracking-[.18em] text-amber-300">
          End-Game Scoring
        </span>
        <span className="font-display text-[12.5px] italic text-slate-400">
          Projected if the game ended now
        </span>
      </header>
      <div className="flex flex-col gap-1 text-[11.5px]">
        <ScoreLine label="Banked Capital" value={player.capital} muted />
        <ScoreLine label="Banked Reputation" value={player.reputation} muted />
        <ScoreLine label={`${flagship.name}`} value={fs.total} />
        {ss && second ? (
          <ScoreLine
            label={`${second.name}${penalty < 0 ? ` (penalty ${penalty})` : ""}`}
            value={ss.total + penalty}
            warn={ss.total + penalty < 0}
          />
        ) : null}
      </div>
      <div className="flex items-baseline justify-between border-t border-amber-900/50 pt-2">
        <span className="font-display text-[15px] font-semibold text-amber-100">
          Projected total
        </span>
        <span
          className="font-display text-[28px] font-bold tabular-nums"
          style={{ color: "var(--gold)", textShadow: "0 0 16px rgba(240,201,112,.3)" }}
        >
          {grand}
          <span className="ml-1 font-mono text-[10px] text-amber-300/80">REP</span>
        </span>
      </div>
    </section>
  );
}

function ScoreLine({
  label,
  value,
  muted,
  warn,
}: {
  label: string;
  value: number;
  muted?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span
        className="truncate font-sans"
        style={{ color: muted ? "var(--mute)" : "var(--ink-muted)" }}
      >
        {label}
      </span>
      <span
        className="font-mono font-bold tabular-nums"
        style={{ color: warn ? "var(--rose)" : muted ? "var(--ink-muted)" : "var(--ink)" }}
      >
        {value >= 0 ? "+" : ""}
        {value}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// InventoryPanel — bottles waiting to be retrieved. Clicking a bottle
// (when at least one slot is eligible) sets the drawer into retrieve
// mode; the selected bottle's eligible slots glow above.
// ─────────────────────────────────────────────────────────────────────

function InventoryPanel({
  inventory,
  hasLabor,
  selectedBottleId,
  onSelect,
  playerEligibleCount,
}: {
  inventory: Bottle[];
  hasLabor: boolean;
  selectedBottleId: string | null;
  onSelect: (id: string | null) => void;
  playerEligibleCount: (bottle: Bottle) => number;
}) {
  return (
    <section className="flex-shrink-0 rounded-lg border border-slate-700/60 bg-slate-950/55 px-3 py-2">
      <header className="mb-1.5 flex items-baseline gap-2">
        <span className="font-mono text-[10.5px] font-bold uppercase tracking-[.18em] text-amber-300">
          Inventory
        </span>
        <span className="font-mono text-[11px] text-slate-400">
          {inventory.length} bottle{inventory.length === 1 ? "" : "s"} · scores 0 · retrieve for 1 Generic Labor
        </span>
        <span aria-hidden className="h-px flex-1" style={{ background: "linear-gradient(90deg, var(--rule), transparent)" }} />
        {!hasLabor && inventory.length > 0 ? (
          <span className="rounded border border-slate-700/60 bg-slate-900/50 px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[.12em] text-slate-400">
            Need 1 Generic Labor to retrieve
          </span>
        ) : null}
      </header>
      <div className="flex flex-wrap gap-2">
        {inventory.length === 0 ? (
          <span className="font-mono text-[10px] italic text-slate-500">
            empty
          </span>
        ) : (
          inventory.map((b) => {
            const eligibleCount = playerEligibleCount(b);
            const isSelected = b.bottleId === selectedBottleId;
            const clickable = hasLabor && eligibleCount > 0;
            return (
              <button
                key={b.bottleId}
                type="button"
                onClick={
                  clickable
                    ? () => onSelect(isSelected ? null : b.bottleId)
                    : undefined
                }
                disabled={!clickable}
                title={
                  !hasLabor
                    ? "Need 1 Generic Labor to retrieve"
                    : eligibleCount === 0
                      ? "No eligible slot for this bottle right now"
                      : isSelected
                        ? "Click again to cancel"
                        : `${eligibleCount} eligible slot${eligibleCount === 1 ? "" : "s"} — click to highlight them`
                }
                className={[
                  "inline-flex items-center gap-2 rounded border px-2 py-1 transition-all",
                  isSelected
                    ? "border-amber-400 bg-amber-900/30"
                    : clickable
                      ? "border-amber-900/50 bg-slate-950/60 hover:border-amber-500/70 hover:bg-amber-950/20"
                      : "border-slate-700/40 bg-slate-950/40 opacity-65",
                ].join(" ")}
              >
                <BottleChip bottle={b} size="xs" />
                <span className="font-display text-[11px] italic text-slate-200">
                  {b.name}
                </span>
                <span className="font-mono text-[9px] uppercase tracking-[.08em] text-slate-500">
                  {b.ageAtSale}y · {caskShort(b.caskTag)}
                </span>
                {isSelected ? (
                  <span className="font-mono text-[9px] font-bold uppercase tracking-[.14em] text-amber-300">
                    Retrieving →
                  </span>
                ) : clickable ? (
                  <span className="font-mono text-[9px] font-bold uppercase tracking-[.14em] text-amber-400/70">
                    {eligibleCount} slot{eligibleCount === 1 ? "" : "s"} →
                  </span>
                ) : null}
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}

function caskShort(tag: string): string {
  if (tag === "heritage-cask") return "Heritage";
  if (tag === "specialty-cask") return "Specialty";
  return "Common";
}

// Compact pool chip row shown beneath the inventory when a second is
// drafted — keeps the remaining pool visible without claiming a full
// panel.
function CompactPool({ draftPool }: { draftPool: readonly string[] }) {
  if (draftPool.length === 0) return null;
  return (
    <div className="flex flex-shrink-0 flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/45 px-3 py-1.5">
      <span className="font-mono text-[9.5px] uppercase tracking-[.14em] text-slate-400">
        Pool remaining:
      </span>
      {draftPool.map((id) => {
        const p = getPortfolio(id);
        return p ? (
          <span
            key={id}
            className="rounded border border-slate-700/60 bg-slate-950/60 px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[.08em] text-slate-300"
          >
            {p.name}
          </span>
        ) : null;
      })}
    </div>
  );
}

function RetrieveBanner({
  bottle,
  eligibleCount,
  hasLabor,
  onCancel,
}: {
  bottle: Bottle;
  eligibleCount: number;
  hasLabor: boolean;
  onCancel: () => void;
}) {
  return (
    <div
      className="flex flex-shrink-0 items-center gap-3 rounded-lg border border-amber-500/70 bg-amber-950/30 px-3 py-2"
      style={{
        boxShadow: "0 0 0 1px rgba(240,201,112,.3), 0 8px 22px rgba(240,201,112,.18)",
      }}
    >
      <BottleChip bottle={bottle} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[10px] uppercase tracking-[.16em] text-amber-300">
          Retrieve from inventory
        </div>
        <div className="truncate font-display text-[15px] font-semibold text-amber-100">
          {bottle.name}
        </div>
        <div className="font-mono text-[10.5px] uppercase tracking-[.1em] text-slate-300">
          {!hasLabor
            ? "Need 1 Generic Labor — placement disabled"
            : eligibleCount === 0
              ? "No eligible slot — wait for a tier to unlock or stash a different bottle"
              : `${eligibleCount} eligible slot${eligibleCount === 1 ? "" : "s"} glowing — click one to place (costs 1 Generic Labor)`}
        </div>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="flex-shrink-0 rounded-md border border-slate-600 bg-slate-800/70 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[.16em] text-slate-100 hover:bg-slate-700/60"
      >
        Cancel ✕
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Small bits
// ─────────────────────────────────────────────────────────────────────

function BonusChip({ label, value, met }: { label: string; value: number; met: boolean }) {
  return (
    <span
      className="flex flex-col items-center gap-0.5 rounded-md border px-2 py-0.5"
      style={{
        borderColor: met ? "var(--gold)" : "rgba(110,80,50,.45)",
        background: met
          ? "linear-gradient(180deg, rgba(240,201,112,.22), rgba(176,106,56,.1))"
          : "rgba(20,14,8,.5)",
      }}
    >
      <span
        className="font-mono text-[8px] font-bold uppercase tracking-[.12em]"
        style={{ color: met ? "var(--gold)" : "var(--mute)" }}
      >
        {label}
      </span>
      <span
        className="font-display text-[13px] font-bold leading-none tabular-nums"
        style={{ color: met ? "var(--gold)" : "var(--ink-muted)" }}
      >
        +{value}
      </span>
    </span>
  );
}

function ConditionPill({ label, value, met }: { label: string; value: string; met: boolean }) {
  return (
    <span className="flex items-center gap-2 rounded border px-2 py-1" style={{
      borderColor: met ? "rgba(109,178,140,.5)" : "rgba(110,80,50,.4)",
      background: met ? "rgba(109,178,140,.12)" : "rgba(20,14,8,.45)",
    }}>
      <span aria-hidden className="grid h-3.5 w-3.5 place-items-center rounded-full font-mono text-[9px] font-bold" style={{
        border: met ? "1px solid var(--emerald)" : "1px solid var(--whisper)",
        background: met ? "var(--emerald)" : "transparent",
        color: "#1a120b",
      }}>
        {met ? "✓" : ""}
      </span>
      <span className="font-mono text-[9px] font-bold uppercase tracking-[.12em]" style={{ color: met ? "var(--emerald)" : "var(--mute)" }}>
        {label}:
      </span>
      <span className="font-sans text-[11px] text-slate-200">{value}</span>
    </span>
  );
}

function TierDivider() {
  return (
    <span
      aria-hidden
      className="w-px self-stretch"
      style={{
        background:
          "linear-gradient(180deg, transparent, rgba(198,157,82,.35) 20%, rgba(198,157,82,.35) 80%, transparent)",
      }}
    />
  );
}

function InventoryChip({ count }: { count: number }) {
  return (
    <span className="flex items-center gap-2 rounded-md border border-slate-700/60 bg-slate-900/60 px-3 py-1.5">
      <span className="font-mono text-[9.5px] uppercase tracking-[.14em] text-slate-400">
        Inventory
      </span>
      <span className="font-display text-[16px] font-bold leading-none text-amber-100 tabular-nums">
        {count}
      </span>
      <span className="font-mono text-[8px] text-slate-500">scores 0</span>
    </span>
  );
}
