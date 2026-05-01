"use client";

/**
 * HandTray — bottom-of-canvas horizontal strip showing the human player's
 * hand, with the action affordances co-located with what they act on.
 *
 * Layout (left → right):
 *   1. Identity     — colored dot + "Your hand" + caption
 *   2. Resources    — chips + amber "Make ↵" button (opens MakeBourbonModal)
 *   3. Divider
 *   4. Bourbon      — small BourbonCardFace + amber "Sell ↵" button
 *   5. Divider
 *   6. Ops + Invest — pills + amber "Implement ↵" button
 *   7. Spacer (flex-1)
 *   8. End-turn cluster — "discard" ghost pill + amber primary "Pass ↵"
 *
 * Per-section contextual buttons replace what used to live in ActionBar:
 *   - Make ↵       opens the mash-builder modal
 *   - Sell ↵       sells the oldest sellable barrel using the displayed
 *                  bourbon card (face-up if available, else first in hand)
 *   - Implement ↵  pays printed capital on the first unbuilt investment
 *   - Pass ↵       dispatches PASS_ACTION
 *
 * Each button is enabled only when the action is legal for the current
 * turn / phase / cash state; otherwise it sits in a disabled slate
 * treatment with a tooltip explaining why.
 */

import { useState } from "react";

import { BOURBON_CARDS_BY_ID } from "@/lib/catalogs/bourbon.generated";
import { INVESTMENT_CARDS_BY_ID } from "@/lib/catalogs/investment.generated";
import { OPERATIONS_CARDS_BY_ID } from "@/lib/catalogs/operations.generated";
import { SPECIALTY_RESOURCES_BY_ID } from "@/lib/catalogs/resource.generated";
import type { ResourceCardDef, ResourceType } from "@/lib/catalogs/types";
import { MAX_ACTIVE_INVESTMENTS } from "@/lib/engine/state";
import { useGameStore } from "@/lib/store/gameStore";
import { PLAYER_BG_CLASS, paletteIndex } from "./playerColors";
import BourbonCardFace from "./BourbonCardFace";
import MakeBourbonModal from "./MakeBourbonModal";

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
  const [makeBourbonOpen, setMakeBourbonOpen] = useState(false);

  const humanId = state.playerOrder.find(
    (id) => state.players[id].kind === "human",
  );
  if (!humanId) return null;
  const me = state.players[humanId];
  const seatIdx = paletteIndex(me.seatIndex);

  const handSize =
    me.resourceHand.length +
    me.bourbonHand.length +
    me.investments.length +
    me.operations.length;
  const isMyActionTurn =
    state.currentPlayerId === humanId && state.phase === "action";
  const cost = state.actionPhase.freeWindowActive
    ? 0
    : state.actionPhase.paidLapTier;
  const canAfford = me.cash >= cost;

  const headBourbonId = me.bourbonHand[0];
  const headBourbon = headBourbonId ? BOURBON_CARDS_BY_ID[headBourbonId] : null;
  const extraBourbon = Math.max(0, me.bourbonHand.length - 1);

  // ---- Action eligibility checks ----------------------------------------

  // Make Bourbon — gate on "minimum viable mash possible". The actual
  // mash gets built in the modal.
  const handHasCask = me.resourceHand.some((r) => r.resource === "cask");
  const handHasCorn = me.resourceHand.some((r) => r.resource === "corn");
  const handHasGrain = me.resourceHand.some(
    (r) =>
      r.resource === "barley" || r.resource === "rye" || r.resource === "wheat",
  );
  const hasOpenRickhouse = state.rickhouses.some(
    (h) => h.barrels.length < h.capacity,
  );
  const canMake =
    isMyActionTurn &&
    canAfford &&
    handHasCask &&
    handHasCorn &&
    handHasGrain &&
    hasOpenRickhouse;
  const makeReason = !isMyActionTurn
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
              : "Build a mash and barrel it";

  // Sell — auto-pick oldest sellable barrel + face-up bourbon card or first
  // bourbon card in hand. Same logic ActionBar's "Sell" used to use.
  const ownedBarrels = state.rickhouses.flatMap((h) =>
    h.barrels.filter((b) => b.ownerId === humanId),
  );
  const sellableBarrel = ownedBarrels.find((b) => b.age >= 2);
  const bourbonCardForSale =
    state.market.bourbonFaceUp ?? me.bourbonHand[0] ?? null;
  const canSell =
    isMyActionTurn && canAfford && !!sellableBarrel && !!bourbonCardForSale;
  const sellReason = !isMyActionTurn
    ? "Wait for your turn"
    : !canAfford
      ? `Need $${cost} to act`
      : !sellableBarrel
        ? "No barrel is 2+ years aged"
        : !bourbonCardForSale
          ? "Need a bourbon card (draw one or use the face-up)"
          : `Sell ${sellableBarrel.age}y barrel using ${
              BOURBON_CARDS_BY_ID[bourbonCardForSale]?.name ?? "card"
            }`;

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

  // ---- Action dispatchers -----------------------------------------------

  const sell = () => {
    if (!canSell || !sellableBarrel || !bourbonCardForSale) return;
    dispatch({
      t: "SELL_BOURBON",
      playerId: humanId,
      barrelId: sellableBarrel.barrelId,
      bourbonCardId: bourbonCardForSale,
    });
  };

  const implement = () => {
    if (!canImplement || !unbuiltInv) return;
    dispatch({
      t: "IMPLEMENT_INVESTMENT",
      playerId: humanId,
      investmentInstanceId: unbuiltInv.instanceId,
    });
  };

  return (
    <section className="flex items-center gap-[14px] border-t border-slate-800 bg-slate-950 px-[22px] py-3">
      {/* 1 — identity */}
      <div className="flex min-w-[120px] flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span
            className={`block h-2.5 w-2.5 rounded-full ring-2 ring-slate-950 ${PLAYER_BG_CLASS[seatIdx]}`}
            aria-hidden
          />
          <span className="font-display text-base font-semibold text-amber-100">
            Your hand
          </span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[.12em] text-slate-500">
          {handSize} cards
        </span>
      </div>

      {/* 2 — resources, with Make stacked above */}
      <div className="flex items-stretch gap-2">
        <VerticalCaption>resources</VerticalCaption>
        <div className="flex flex-col items-start gap-1.5">
          <ContextButton
            enabled={canMake}
            onClick={() => setMakeBourbonOpen(true)}
            title={makeReason}
          >
            Make ↵
          </ContextButton>
          <div className="flex max-w-[260px] gap-1.5 overflow-x-auto">
            {me.resourceHand.length === 0 ? (
              <EmptyTallChip>no resources</EmptyTallChip>
            ) : (
              me.resourceHand.map((r) => {
                const meta = RESOURCE_META[r.resource];
                if (!meta) return null;
                const specialty = r.specialtyId
                  ? SPECIALTY_RESOURCES_BY_ID[r.specialtyId]
                  : null;
                return (
                  <ResourceChip
                    key={r.instanceId}
                    meta={meta}
                    resource={r.resource}
                    specialty={specialty}
                  />
                );
              })
            )}
          </div>
        </div>
      </div>

      <Divider />

      {/* 4 — bourbon, with Sell stacked above */}
      <div className="flex items-stretch gap-2">
        <VerticalCaption>bourbon</VerticalCaption>
        <div className="flex flex-col items-start gap-1.5">
          <ContextButton enabled={canSell} onClick={sell} title={sellReason}>
            Sell ↵
          </ContextButton>
          <div className="flex items-center gap-2">
            {headBourbon ? (
              <div className="w-[110px]">
                <BourbonCardFace card={headBourbon} size="sm" />
              </div>
            ) : (
              <div className="grid h-[76px] w-[110px] place-items-center rounded-md border border-dashed border-slate-700 px-2 text-center font-mono text-[10px] uppercase tracking-[.12em] text-slate-500">
                no bourbon card
              </div>
            )}
            {extraBourbon > 0 ? (
              <span className="font-mono text-[10px] uppercase tracking-[.12em] text-slate-500">
                +{extraBourbon}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <Divider />

      {/* 6 — play (ops + invest), with Implement stacked above */}
      <div className="flex items-stretch gap-2">
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
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled
          aria-label="Discard (not implemented)"
          className="rounded border border-slate-700 bg-transparent px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-[.05em] text-slate-300 opacity-50"
        >
          discard
        </button>
        <button
          type="button"
          disabled={!isMyActionTurn}
          onClick={() => dispatch({ t: "PASS_ACTION", playerId: humanId })}
          title={
            isMyActionTurn
              ? "Pass — finish your action loop"
              : "Wait for your turn"
          }
          className="rounded-md border border-amber-700 bg-gradient-to-b from-amber-500 to-amber-700 px-3.5 py-1.5 font-sans text-xs font-bold uppercase tracking-[.05em] text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,.2)] transition-colors hover:from-amber-400 hover:to-amber-600 disabled:cursor-not-allowed disabled:border-slate-700 disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-500 disabled:shadow-none"
        >
          Pass ↵
        </button>
      </div>

      {/* Make-bourbon modal — only mounted while open. */}
      {makeBourbonOpen ? (
        <MakeBourbonModal onClose={() => setMakeBourbonOpen(false)} />
      ) : null}
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
}: {
  children: React.ReactNode;
  enabled: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={enabled ? onClick : undefined}
      disabled={!enabled}
      title={title}
      className={[
        "rounded-md border px-3 py-1 font-sans text-[11px] font-bold uppercase tracking-[.05em] transition-all",
        enabled
          ? "border-amber-700 bg-gradient-to-b from-amber-500 to-amber-700 text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,.2),0_2px_8px_rgba(245,158,11,.25)] hover:-translate-y-0.5 hover:from-amber-400 hover:to-amber-600 hover:shadow-[inset_0_1px_0_rgba(255,255,255,.25),0_4px_12px_rgba(245,158,11,.35)]"
          : "cursor-not-allowed border-slate-800 bg-slate-900 text-slate-600 shadow-none",
      ].join(" ")}
    >
      {children}
    </button>
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
  return <span className="block h-[60px] w-px bg-slate-800" aria-hidden />;
}

function ResourceChip({
  meta,
  resource,
  specialty,
}: {
  meta: ResourceMeta;
  resource: string;
  specialty: ResourceCardDef | null;
}) {
  return (
    <div
      className={`flex h-[76px] w-[56px] flex-shrink-0 flex-col rounded-md border p-1.5 shadow-md ${meta.tint} ${meta.border}`}
      title={specialty?.rule}
      role="img"
      aria-label={specialty ? `${resource}: ${specialty.name}` : resource}
    >
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
    </div>
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
