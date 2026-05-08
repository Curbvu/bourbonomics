"use client";

/**
 * Self-contained tutorial board. Renders the same conceptual surfaces
 * as the live game (rickhouse, hand, market, demand, reputation) but
 * with simpler chrome — every interaction fits into one of four modes
 * (make / buy / age / sell), gated by the active tutorial beat.
 *
 * The board doesn't reuse the live game's components on purpose: the
 * production board reads from `useGameStore`, which we don't run here.
 * Forking those reads would mean either two stores or wiring up an
 * adapter context across 20+ components — both more risk than reward
 * for an on-rails surface that only ever needs the slim feature set.
 */

import { useMemo } from "react";
import {
  TUTORIAL_BOT_ID,
  TUTORIAL_HUMAN_ID,
  type Barrel,
  type Card,
  type GameAction,
  type GameState,
  type MashBill,
  type PlayerState,
} from "@bourbonomics/engine";
import type { SpotlightTarget } from "./types";

interface InteractionState {
  mode:
    | { kind: "idle" }
    | { kind: "make"; slotId: string; selectedCardIds: string[] }
    | { kind: "buy"; marketSlotIndex: number; selectedCardIds: string[] }
    | { kind: "age"; barrelId: string; cardId: string | null }
    | { kind: "sell"; barrelId: string; spendCardId: string | null };
}

type Mode = InteractionState["mode"];

interface TutorialBoardProps {
  state: GameState;
  spotlight: SpotlightTarget | undefined;
  /** Whether the current beat is a player-action beat (gating). */
  awaitingAction: boolean;
  /** Called when the player tries to dispatch an action. */
  onTryAction: (action: GameAction) => void;
  /** Persistent UI mode — held in the parent so beat changes can clear it. */
  mode: Mode;
  setMode: (m: Mode) => void;
  /** Last-fired animation snapshots, keyed by seq for re-trigger. */
  lastSale: { slotId: string; ownerId: string; seq: number } | null;
  lastMake: { slotId: string; seq: number } | null;
}

const SUBTYPE_COLOR: Record<string, { bg: string; border: string; text: string }> = {
  cask: { bg: "bg-amber-950/80", border: "border-amber-700", text: "text-amber-100" },
  corn: { bg: "bg-yellow-900/70", border: "border-yellow-600", text: "text-yellow-50" },
  rye: { bg: "bg-rose-900/70", border: "border-rose-600", text: "text-rose-50" },
  barley: { bg: "bg-orange-900/70", border: "border-orange-600", text: "text-orange-50" },
  wheat: { bg: "bg-stone-700/80", border: "border-stone-500", text: "text-stone-50" },
  capital: { bg: "bg-emerald-900/80", border: "border-emerald-600", text: "text-emerald-50" },
};

function colorFor(card: Card): { bg: string; border: string; text: string } {
  if (card.type === "capital") return SUBTYPE_COLOR.capital!;
  return SUBTYPE_COLOR[card.subtype ?? "cask"] ?? SUBTYPE_COLOR.cask!;
}

function cardLabel(card: Card): string {
  if (card.displayName) return card.displayName;
  if (card.type === "capital") return `$${card.capitalValue ?? 1}`;
  return card.subtype ?? "card";
}

function cardCorner(card: Card): string {
  if (card.type === "capital") return `$${card.capitalValue ?? 1}`;
  if (card.specialty) return "★";
  if ((card.resourceCount ?? 1) > 1) return `×${card.resourceCount}`;
  return "•";
}

export default function TutorialBoard({
  state,
  spotlight,
  awaitingAction,
  onTryAction,
  mode,
  setMode,
  lastSale,
  lastMake,
}: TutorialBoardProps) {
  const human = state.players.find((p) => p.id === TUTORIAL_HUMAN_ID)!;
  const bot = state.players.find((p) => p.id === TUTORIAL_BOT_ID)!;

  return (
    <div className="flex h-full flex-col gap-3 px-6 pb-6 pt-4">
      <TopStrip
        round={state.round}
        demand={state.demand}
        humanRep={human.reputation}
        botRep={bot.reputation}
        spotlight={spotlight}
      />

      {/* Bot rickhouse on top, human on the bottom-of-board so the eye
          travels naturally from opponent to your own hand. */}
      <RickhouseRow
        title="Rival Distillery"
        owner={bot}
        barrels={state.allBarrels.filter((b) => b.ownerId === bot.id)}
        spotlight={spotlight}
        ownerId={bot.id}
        interactive={false}
        mode={mode}
        setMode={setMode}
        animate={lastSale && lastSale.ownerId === bot.id ? lastSale : null}
      />

      <RickhouseRow
        title="Your Distillery"
        owner={human}
        barrels={state.allBarrels.filter((b) => b.ownerId === human.id)}
        spotlight={spotlight}
        ownerId={human.id}
        interactive={awaitingAction}
        mode={mode}
        setMode={setMode}
        animate={lastMake ?? null}
        primary
      />

      <Market
        conveyor={state.marketConveyor}
        spotlight={spotlight}
        interactive={awaitingAction}
        mode={mode}
        setMode={setMode}
      />

      <Hand
        hand={human.hand}
        spotlight={spotlight}
        interactive={awaitingAction}
        mode={mode}
        setMode={setMode}
      />

      <ActionFooter
        state={state}
        mode={mode}
        setMode={setMode}
        onCommit={(action) => {
          onTryAction(action);
          // Optimistically clear; if the action was rejected by the gate
          // the parent will leave state untouched and the user can retry.
          setMode({ kind: "idle" });
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Top strip — round, demand, reputations, supply ticker
// ─────────────────────────────────────────────────────────────────
function TopStrip({
  round,
  demand,
  humanRep,
  botRep,
  spotlight,
}: {
  round: number;
  demand: number;
  humanRep: number;
  botRep: number;
  spotlight: SpotlightTarget | undefined;
}) {
  const demandLit = spotlight?.kind === "demand";
  const repLit = spotlight?.kind === "reputation";
  return (
    <div className="flex items-center justify-between rounded-xl border border-amber-900/40 bg-slate-900/60 px-4 py-2.5 font-mono text-xs uppercase tracking-[.18em]">
      <span className="text-slate-400">Round <span className="text-amber-200 tabular-nums">{round}</span></span>
      <Pill label="Demand" value={`${demand} / 12`} lit={demandLit} accent="amber" />
      <Pill label="Your reputation" value={String(humanRep)} lit={repLit} accent="emerald" />
      <Pill label="Rival" value={String(botRep)} lit={false} accent="slate" />
    </div>
  );
}

function Pill({
  label,
  value,
  lit,
  accent,
}: {
  label: string;
  value: string;
  lit: boolean;
  accent: "amber" | "emerald" | "slate";
}) {
  const ring =
    accent === "amber"
      ? "ring-amber-400/70"
      : accent === "emerald"
        ? "ring-emerald-400/70"
        : "ring-slate-400/40";
  return (
    <span
      className={[
        "flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 transition",
        lit ? `ring-2 ${ring} shadow-[0_0_18px_rgba(251,191,36,0.45)]` : "",
      ].join(" ")}
    >
      <span className="text-slate-500">{label}</span>
      <span className="text-amber-100 tabular-nums">{value}</span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────
// Rickhouse row — slots for one player
// ─────────────────────────────────────────────────────────────────
function RickhouseRow({
  title,
  owner,
  barrels,
  spotlight,
  ownerId,
  interactive,
  mode,
  setMode,
  animate,
  primary,
}: {
  title: string;
  owner: PlayerState;
  barrels: Barrel[];
  spotlight: SpotlightTarget | undefined;
  ownerId: string;
  interactive: boolean;
  mode: Mode;
  setMode: (m: Mode) => void;
  animate: { slotId: string; seq: number } | null;
  primary?: boolean;
}) {
  const rowLit = spotlight?.kind === "rickhouse-row" && spotlight.ownerId === ownerId;
  return (
    <section
      className={[
        "rounded-xl border bg-slate-950/40 p-3",
        primary ? "border-amber-900/40" : "border-slate-800",
        rowLit ? "ring-2 ring-amber-400/60 shadow-[0_0_24px_rgba(251,191,36,0.30)]" : "",
      ].join(" ")}
    >
      <header className="mb-2 flex items-center justify-between">
        <h3 className="font-mono text-[11px] uppercase tracking-[.18em] text-slate-400">{title}</h3>
        <span className="font-mono text-[10px] tracking-[.14em] text-slate-500">
          {barrels.length} / {owner.rickhouseSlots.length}
        </span>
      </header>
      <div className="grid grid-cols-4 gap-2">
        {owner.rickhouseSlots.map((slot, i) => {
          const barrel = barrels.find((b) => b.slotId === slot.id) ?? null;
          const slotLit =
            spotlight?.kind === "rickhouse-slot" &&
            spotlight.ownerId === ownerId &&
            spotlight.slotIndex === i;
          return (
            <Slot
              key={slot.id}
              slotId={slot.id}
              barrel={barrel}
              lit={slotLit || rowLit}
              interactive={interactive && primary === true}
              mode={mode}
              setMode={setMode}
              flying={animate?.slotId === slot.id ? animate.seq : null}
            />
          );
        })}
      </div>
    </section>
  );
}

function Slot({
  slotId,
  barrel,
  lit,
  interactive,
  mode,
  setMode,
  flying,
}: {
  slotId: string;
  barrel: Barrel | null;
  lit: boolean;
  interactive: boolean;
  mode: Mode;
  setMode: (m: Mode) => void;
  flying: number | null;
}) {
  const selected =
    (mode.kind === "make" && mode.slotId === slotId) ||
    (mode.kind === "age" && barrel?.id === mode.barrelId) ||
    (mode.kind === "sell" && barrel?.id === mode.barrelId);

  const onClick = () => {
    if (!interactive || !barrel) return;
    if (barrel.phase === "ready" || barrel.phase === "construction") {
      setMode({ kind: "make", slotId, selectedCardIds: [] });
    } else if (barrel.phase === "aging") {
      // Two interactions on an aging barrel: age (click → pick card) or
      // sell (click → pick card). The footer disambiguates via two
      // buttons. For now default to age; sell is reachable via the
      // footer's "Sell instead" toggle when in age mode.
      setMode({ kind: "age", barrelId: barrel.id, cardId: null });
    }
  };

  if (!barrel) {
    return (
      <div
        className={[
          "h-[88px] rounded-lg border-2 border-dashed border-slate-700 bg-slate-900/30 p-2 font-mono text-[10px] uppercase tracking-[.14em] text-slate-600",
          lit ? "ring-2 ring-amber-400/60" : "",
        ].join(" ")}
      >
        Open slot
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      className={[
        "group relative flex h-[88px] flex-col justify-between rounded-lg border-2 p-2 text-left transition",
        barrel.phase === "aging" ? "border-amber-700 bg-amber-950/40" : "border-slate-700 bg-slate-900/60",
        lit ? "ring-2 ring-amber-400/80 shadow-[0_0_22px_rgba(251,191,36,0.55)]" : "",
        selected ? "ring-2 ring-emerald-400/80" : "",
        interactive && barrel.phase !== "aging"
          ? "hover:border-amber-500 hover:bg-amber-950/30"
          : "",
        flying !== null ? "animate-pulse" : "",
      ].join(" ")}
    >
      <div className="font-display text-sm font-bold leading-tight text-amber-100">
        {barrel.attachedMashBill.name}
      </div>
      <div className="flex items-center justify-between">
        <span
          className={[
            "rounded-sm px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[.16em]",
            barrel.phase === "aging"
              ? "bg-amber-900/60 text-amber-200"
              : barrel.phase === "construction"
                ? "bg-sky-900/60 text-sky-200"
                : "bg-slate-800 text-slate-300",
          ].join(" ")}
        >
          {barrel.phase}
        </span>
        <span className="font-mono text-[10px] text-slate-300">
          {barrel.phase === "aging" ? `${barrel.age}y` : `${barrel.productionCards.length}c`}
        </span>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────
// Market — 10 conveyor slots
// ─────────────────────────────────────────────────────────────────
function Market({
  conveyor,
  spotlight,
  interactive,
  mode,
  setMode,
}: {
  conveyor: Card[];
  spotlight: SpotlightTarget | undefined;
  interactive: boolean;
  mode: Mode;
  setMode: (m: Mode) => void;
}) {
  const rowLit = spotlight?.kind === "market-row";
  return (
    <section
      className={[
        "rounded-xl border border-slate-800 bg-slate-950/40 p-3",
        rowLit ? "ring-2 ring-amber-400/60" : "",
      ].join(" ")}
    >
      <header className="mb-2 flex items-center justify-between">
        <h3 className="font-mono text-[11px] uppercase tracking-[.18em] text-slate-400">Market conveyor</h3>
        <span className="font-mono text-[10px] tracking-[.14em] text-slate-500">10 cards face-up</span>
      </header>
      <div className="grid grid-cols-10 gap-2">
        {conveyor.map((card, i) => {
          const lit = spotlight?.kind === "market-slot" && spotlight.slotIndex === i;
          const selected = mode.kind === "buy" && mode.marketSlotIndex === i;
          return (
            <button
              key={card.id}
              type="button"
              disabled={!interactive}
              onClick={() => {
                if (!interactive) return;
                setMode({ kind: "buy", marketSlotIndex: i, selectedCardIds: [] });
              }}
              className={[
                "group flex flex-col items-stretch rounded-md border-2 p-1.5 text-left transition",
                colorFor(card).bg,
                colorFor(card).border,
                lit ? "ring-2 ring-amber-400/80 shadow-[0_0_18px_rgba(251,191,36,0.55)]" : "",
                selected ? "ring-2 ring-emerald-400/80" : "",
                interactive ? "hover:scale-[1.04]" : "",
              ].join(" ")}
            >
              <div className="flex items-center justify-between font-mono text-[9px]">
                <span className="text-slate-400">${card.cost ?? 1}</span>
                <span className="text-slate-200">{cardCorner(card)}</span>
              </div>
              <div
                className={[
                  "mt-1 line-clamp-2 font-display text-[10px] font-bold leading-tight",
                  colorFor(card).text,
                ].join(" ")}
              >
                {cardLabel(card)}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────
// Hand — player's resource + capital cards
// ─────────────────────────────────────────────────────────────────
function Hand({
  hand,
  spotlight,
  interactive,
  mode,
  setMode,
}: {
  hand: Card[];
  spotlight: SpotlightTarget | undefined;
  interactive: boolean;
  mode: Mode;
  setMode: (m: Mode) => void;
}) {
  const litCardIds = useMemo<Set<string>>(() => {
    if (!spotlight) return new Set();
    if (spotlight.kind === "hand-card") return new Set([spotlight.cardId]);
    if (spotlight.kind === "hand-cards") return new Set(spotlight.cardIds);
    return new Set();
  }, [spotlight]);

  const toggle = (cardId: string) => {
    if (!interactive) return;
    if (mode.kind === "make") {
      const has = mode.selectedCardIds.includes(cardId);
      setMode({
        ...mode,
        selectedCardIds: has
          ? mode.selectedCardIds.filter((id) => id !== cardId)
          : [...mode.selectedCardIds, cardId],
      });
    } else if (mode.kind === "buy") {
      const has = mode.selectedCardIds.includes(cardId);
      setMode({
        ...mode,
        selectedCardIds: has
          ? mode.selectedCardIds.filter((id) => id !== cardId)
          : [...mode.selectedCardIds, cardId],
      });
    } else if (mode.kind === "age") {
      setMode({ ...mode, cardId: mode.cardId === cardId ? null : cardId });
    } else if (mode.kind === "sell") {
      setMode({ ...mode, spendCardId: mode.spendCardId === cardId ? null : cardId });
    }
  };

  const isSelected = (cardId: string): boolean => {
    if (mode.kind === "make") return mode.selectedCardIds.includes(cardId);
    if (mode.kind === "buy") return mode.selectedCardIds.includes(cardId);
    if (mode.kind === "age") return mode.cardId === cardId;
    if (mode.kind === "sell") return mode.spendCardId === cardId;
    return false;
  };

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
      <header className="mb-2 flex items-center justify-between">
        <h3 className="font-mono text-[11px] uppercase tracking-[.18em] text-slate-400">Your hand</h3>
        <span className="font-mono text-[10px] tracking-[.14em] text-slate-500">{hand.length} cards</span>
      </header>
      <div className="flex flex-wrap gap-2">
        {hand.length === 0 ? (
          <div className="font-mono text-[10px] uppercase tracking-[.14em] text-slate-600">— empty —</div>
        ) : null}
        {hand.map((card) => {
          const lit = litCardIds.has(card.id);
          const selected = isSelected(card.id);
          return (
            <button
              key={card.id}
              type="button"
              disabled={!interactive}
              onClick={() => toggle(card.id)}
              className={[
                "group flex h-[68px] w-[88px] flex-col items-stretch rounded-md border-2 p-1.5 text-left transition",
                colorFor(card).bg,
                colorFor(card).border,
                lit ? "ring-2 ring-amber-400/80 shadow-[0_0_16px_rgba(251,191,36,0.55)]" : "",
                selected ? "ring-2 ring-emerald-400/90" : "",
                interactive ? "hover:translate-y-[-2px]" : "opacity-80",
              ].join(" ")}
            >
              <div className="flex items-center justify-between font-mono text-[9px]">
                <span className="text-slate-400">${card.cost ?? 1}</span>
                <span className="text-slate-200">{cardCorner(card)}</span>
              </div>
              <div
                className={[
                  "mt-1 line-clamp-2 font-display text-[11px] font-bold leading-tight",
                  colorFor(card).text,
                ].join(" ")}
              >
                {cardLabel(card)}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────
// Action footer — context-sensitive Commit / Sell buttons
// ─────────────────────────────────────────────────────────────────
function ActionFooter({
  state,
  mode,
  setMode,
  onCommit,
}: {
  state: GameState;
  mode: Mode;
  setMode: (m: Mode) => void;
  onCommit: (action: GameAction) => void;
}) {
  if (mode.kind === "idle") {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-2 font-mono text-[11px] uppercase tracking-[.16em] text-slate-500">
        Pick a slot, market card, or barrel to begin.
      </div>
    );
  }

  if (mode.kind === "make") {
    return (
      <FooterRow
        primary={{
          label: `Commit ${mode.selectedCardIds.length} card${mode.selectedCardIds.length === 1 ? "" : "s"}`,
          disabled: mode.selectedCardIds.length === 0,
          onClick: () =>
            onCommit({
              type: "MAKE_BOURBON",
              playerId: TUTORIAL_HUMAN_ID,
              slotId: mode.slotId,
              cardIds: mode.selectedCardIds,
            }),
        }}
        cancel={() => setMode({ kind: "idle" })}
      />
    );
  }

  if (mode.kind === "buy") {
    const total = totalSpendValue(state, mode.selectedCardIds);
    const card = state.marketConveyor[mode.marketSlotIndex];
    const cost = card?.cost ?? 1;
    return (
      <FooterRow
        primary={{
          label: `Buy · paid ${total}¢ / ${cost}¢`,
          disabled: total < cost || mode.selectedCardIds.length === 0,
          onClick: () =>
            onCommit({
              type: "BUY_FROM_MARKET",
              playerId: TUTORIAL_HUMAN_ID,
              marketSlotIndex: mode.marketSlotIndex,
              spendCardIds: mode.selectedCardIds,
            }),
        }}
        cancel={() => setMode({ kind: "idle" })}
      />
    );
  }

  if (mode.kind === "age") {
    return (
      <FooterRow
        primary={{
          label: mode.cardId ? "Age this barrel" : "Pick a card to age with",
          disabled: !mode.cardId,
          onClick: () =>
            mode.cardId &&
            onCommit({
              type: "AGE_BOURBON",
              playerId: TUTORIAL_HUMAN_ID,
              barrelId: mode.barrelId,
              cardId: mode.cardId,
            }),
        }}
        secondary={{
          label: "Sell instead",
          onClick: () => setMode({ kind: "sell", barrelId: mode.barrelId, spendCardId: null }),
        }}
        cancel={() => setMode({ kind: "idle" })}
      />
    );
  }

  // sell
  return (
    <FooterRow
      primary={{
        label: mode.spendCardId ? "Sell this barrel" : "Pick a card to spend",
        disabled: !mode.spendCardId,
        onClick: () => {
          if (!mode.spendCardId) return;
          const barrel = state.allBarrels.find((b) => b.id === mode.barrelId);
          if (!barrel) return;
          // Default split: full reputation. Beat-9 rewrite hook will
          // override to 1/1 if applicable.
          const reward = computeReputationReward(barrel, state.demand);
          onCommit({
            type: "SELL_BOURBON",
            playerId: TUTORIAL_HUMAN_ID,
            barrelId: mode.barrelId,
            reputationSplit: reward,
            cardDrawSplit: 0,
            spendCardId: mode.spendCardId,
          });
        },
      }}
      secondary={{
        label: "Age instead",
        onClick: () => setMode({ kind: "age", barrelId: mode.barrelId, cardId: null }),
      }}
      cancel={() => setMode({ kind: "idle" })}
    />
  );
}

function FooterRow({
  primary,
  secondary,
  cancel,
}: {
  primary: { label: string; disabled?: boolean; onClick: () => void };
  secondary?: { label: string; onClick: () => void };
  cancel: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-2 rounded-lg border border-amber-900/40 bg-slate-900/70 px-3 py-2">
      <button
        type="button"
        onClick={cancel}
        className="font-mono text-[11px] uppercase tracking-[.16em] text-slate-400 hover:text-slate-200"
      >
        Cancel
      </button>
      {secondary ? (
        <button
          type="button"
          onClick={secondary.onClick}
          className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[.14em] text-slate-200 hover:border-slate-400"
        >
          {secondary.label}
        </button>
      ) : null}
      <button
        type="button"
        onClick={primary.onClick}
        disabled={primary.disabled}
        className={[
          "rounded-md border px-4 py-1.5 font-mono text-[11px] uppercase tracking-[.14em]",
          primary.disabled
            ? "cursor-not-allowed border-slate-700 bg-slate-900 text-slate-600"
            : "border-amber-400 bg-gradient-to-b from-amber-300 to-amber-500 text-slate-950 shadow-[0_0_0_2px_rgba(251,191,36,.30),inset_0_1px_0_rgba(255,255,255,.25)] hover:from-amber-200 hover:to-amber-400",
        ].join(" ")}
      >
        {primary.label}
      </button>
    </div>
  );
}

function totalSpendValue(state: GameState, cardIds: string[]): number {
  const human = state.players.find((p) => p.id === TUTORIAL_HUMAN_ID);
  if (!human) return 0;
  let total = 0;
  for (const id of cardIds) {
    const card = human.hand.find((c) => c.id === id);
    if (!card) continue;
    if (card.type === "capital") total += card.capitalValue ?? 1;
    else total += 1;
  }
  return total;
}

function computeReputationReward(barrel: Barrel, demand: number): number {
  const bill = barrel.attachedMashBill;
  return gridLookup(bill, barrel.age, demand);
}

function gridLookup(bill: MashBill, age: number, demand: number): number {
  let row = -1;
  for (let i = 0; i < bill.ageBands.length; i++) {
    if (age >= bill.ageBands[i]!) row = i;
    else break;
  }
  let col = -1;
  for (let i = 0; i < bill.demandBands.length; i++) {
    if (demand >= bill.demandBands[i]!) col = i;
    else break;
  }
  if (row < 0 || col < 0) return 0;
  return bill.rewardGrid[row]?.[col] ?? 0;
}
