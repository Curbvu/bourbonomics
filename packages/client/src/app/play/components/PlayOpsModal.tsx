"use client";

/**
 * v3.6 PlayOpsModal — first human-playable ops card flow.
 *
 * Before v3.6 the operations hand rendered grey-pending — only the
 * bot AI ever dispatched PLAY_OPERATIONS_CARD. This modal opens when
 * the human clicks an ops card in HandTray (setting
 * `playOpsCardId` on the store) and walks per-defId targeting:
 *
 *   - No target (bourbon_boom, glut, demand_surge, allocation,
 *     kentucky_connection, wild_mash, rating_boost) → Confirm.
 *   - Direction (market_manipulation) → Up / Down.
 *   - Self aging barrel (rushed_shipment) → pick from own aging.
 *   - Any aging barrel (regulatory_inspection, slow_pour) → pick
 *     from all aging.
 *   - Opponent only (spoiled_batch, counterfeit_bottles) → pick
 *     opponent.
 *   - Opponent + card (audit, federal_inspector) → pick opponent,
 *     then pick card from their hand.
 *   - Aging barrel + committed card (sabotage) → pick barrel, then
 *     pick a card committed to it.
 *
 * Whiskey Raid / Cooper's Contract / Grain Futures are engine-
 * design-only at this point and won't appear in the human's hand
 * yet — but if they do, this modal surfaces a "design only" notice
 * instead of letting the player attempt an illegal dispatch.
 */

import { useEffect, useState } from "react";
import type {
  Card,
  GameAction,
  OperationsCard,
  OperationsCardDefId,
  PlayerState,
} from "@bourbonomics/engine";
import { useGameStore } from "@/lib/store/game";

export default function PlayOpsModal() {
  const {
    state,
    humanSeatPlayerId,
    playOpsCardId,
    setPlayOpsCardId,
    dispatch,
  } = useGameStore();
  const player = humanSeatPlayerId
    ? state?.players.find((p) => p.id === humanSeatPlayerId)
    : null;
  const card = player && playOpsCardId
    ? player.operationsHand.find((c) => c.id === playOpsCardId) ?? null
    : null;

  // Targeting picks live as local state; reset whenever the modal
  // closes or the active card changes.
  const [targetPlayerId, setTargetPlayerId] = useState<string | null>(null);
  const [targetBarrelId, setTargetBarrelId] = useState<string | null>(null);
  const [targetCardId, setTargetCardId] = useState<string | null>(null);
  const [direction, setDirection] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    setTargetPlayerId(null);
    setTargetBarrelId(null);
    setTargetCardId(null);
    setDirection(null);
  }, [playOpsCardId]);

  // Esc closes.
  useEffect(() => {
    if (!playOpsCardId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPlayOpsCardId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playOpsCardId, setPlayOpsCardId]);

  if (!state || !player || !card) return null;

  const close = () => setPlayOpsCardId(null);
  const opponents = state.players.filter((p) => p.id !== player.id);
  const allAgingBarrels = state.allBarrels.filter((b) => b.phase === "aging");
  const myAgingBarrels = allAgingBarrels.filter((b) => b.ownerId === player.id);
  const opponentAgingBarrels = allAgingBarrels.filter(
    (b) => b.ownerId !== player.id,
  );

  const flow = flowForCard(card.defId);

  const targetPlayer = targetPlayerId
    ? state.players.find((p) => p.id === targetPlayerId) ?? null
    : null;
  const targetBarrel = targetBarrelId
    ? state.allBarrels.find((b) => b.id === targetBarrelId) ?? null
    : null;

  const ready = isReady(flow, {
    targetPlayerId,
    targetBarrelId,
    targetCardId,
    direction,
  });

  const confirm = () => {
    const action = buildAction(player.id, card, {
      targetPlayerId,
      targetBarrelId,
      targetCardId,
      direction,
    });
    if (!action) return;
    dispatch(action);
    close();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Play ${card.name}`}
      className="fixed inset-0 z-[57] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur"
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[calc(100vh-2rem)] w-full max-w-[760px] flex-col gap-3 overflow-hidden rounded-xl border border-amber-700/50 bg-gradient-to-b from-slate-950 to-slate-900/95 px-5 py-4 shadow-[0_24px_64px_rgba(0,0,0,.55)]"
      >
        {/* Header */}
        <header className="flex flex-shrink-0 items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[12px] uppercase tracking-[.18em] text-amber-300">
              Play Operations Card
            </div>
            <div className="mt-1 font-display text-2xl font-semibold text-amber-100">
              {card.name}
            </div>
            <div className="mt-1 font-sans text-[12.5px] text-slate-300">
              {card.description}
            </div>
            {card.flavor ? (
              <div className="mt-0.5 font-display text-[11.5px] italic text-slate-500">
                "{card.flavor}"
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-md border border-slate-600 bg-slate-800/70 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[.16em] text-slate-100 hover:bg-slate-700/60"
          >
            Cancel ✕
          </button>
        </header>

        {/* Targeting body */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
          {flow === "none" ? (
            <div className="rounded-lg border border-slate-700/50 bg-slate-950/55 px-3 py-2 font-mono text-[11.5px] text-slate-300">
              No target needed — click Play to resolve this card.
            </div>
          ) : null}

          {flow === "direction" ? (
            <Group label="Move the demand track">
              <ChoiceBtn
                active={direction === "up"}
                onClick={() => setDirection("up")}
                label="↑ Up by 1"
                hint={`Demand becomes ${Math.min(12, state.demand + 1)}`}
              />
              <ChoiceBtn
                active={direction === "down"}
                onClick={() => setDirection("down")}
                label="↓ Down by 1"
                hint={`Demand becomes ${Math.max(0, state.demand - 1)}`}
              />
            </Group>
          ) : null}

          {flow === "self-aging-barrel" || flow === "any-aging-barrel" ? (
            <Group
              label={
                flow === "self-aging-barrel"
                  ? "Choose one of your aging barrels"
                  : "Choose any aging barrel"
              }
            >
              {(flow === "self-aging-barrel"
                ? myAgingBarrels
                : allAgingBarrels
              ).map((b) => (
                <BarrelChoice
                  key={b.id}
                  barrel={b}
                  ownerName={
                    state.players.find((p) => p.id === b.ownerId)?.name ?? b.ownerId
                  }
                  active={targetBarrelId === b.id}
                  onClick={() => setTargetBarrelId(b.id)}
                />
              ))}
              {(flow === "self-aging-barrel" ? myAgingBarrels : allAgingBarrels)
                .length === 0 ? (
                <EmptyHint>No eligible aging barrel — try another card.</EmptyHint>
              ) : null}
            </Group>
          ) : null}

          {flow === "opponent" ||
          flow === "opponent-and-card" ? (
            <Group label="Choose an opponent">
              {opponents.map((opp) => (
                <PlayerChoice
                  key={opp.id}
                  player={opp}
                  active={targetPlayerId === opp.id}
                  onClick={() => {
                    setTargetPlayerId(opp.id);
                    setTargetCardId(null);
                  }}
                />
              ))}
            </Group>
          ) : null}

          {flow === "opponent-and-card" && targetPlayer ? (
            <Group label={`Choose a card from ${targetPlayer.name}'s hand`}>
              {targetPlayer.hand.length === 0 ? (
                <EmptyHint>Their hand is empty.</EmptyHint>
              ) : (
                targetPlayer.hand.map((c) => (
                  <CardChoice
                    key={c.id}
                    card={c}
                    active={targetCardId === c.id}
                    onClick={() => setTargetCardId(c.id)}
                  />
                ))
              )}
            </Group>
          ) : null}

          {flow === "barrel-and-committed-card" ? (
            <>
              <Group label="Choose an opponent's aging barrel">
                {opponentAgingBarrels.map((b) => (
                  <BarrelChoice
                    key={b.id}
                    barrel={b}
                    ownerName={
                      state.players.find((p) => p.id === b.ownerId)?.name ?? b.ownerId
                    }
                    active={targetBarrelId === b.id}
                    onClick={() => {
                      setTargetBarrelId(b.id);
                      setTargetCardId(null);
                    }}
                  />
                ))}
                {opponentAgingBarrels.length === 0 ? (
                  <EmptyHint>No opponent has an aging barrel right now.</EmptyHint>
                ) : null}
              </Group>
              {targetBarrel ? (
                <Group label="Choose a committed card to call out">
                  {[...targetBarrel.productionCards, ...targetBarrel.agingCards].length === 0 ? (
                    <EmptyHint>This barrel has no committed cards.</EmptyHint>
                  ) : (
                    [...targetBarrel.productionCards, ...targetBarrel.agingCards].map(
                      (c) => (
                        <CardChoice
                          key={c.id}
                          card={c}
                          active={targetCardId === c.id}
                          onClick={() => setTargetCardId(c.id)}
                        />
                      ),
                    )
                  )}
                </Group>
              ) : null}
            </>
          ) : null}

          {flow === "design-only" ? (
            <div className="rounded-lg border border-rose-500/40 bg-rose-950/30 px-3 py-2 font-mono text-[11.5px] text-rose-200">
              {card.name} is design-only — the handler is pending. Cancel
              and play a different card.
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <footer className="flex flex-shrink-0 items-center justify-end gap-2 border-t border-amber-900/40 pt-3">
          {!ready ? (
            <span className="mr-auto font-mono text-[11px] uppercase tracking-[.12em] text-slate-500">
              {whyNotReady(flow, { targetPlayerId, targetBarrelId, targetCardId, direction })}
            </span>
          ) : null}
          <button
            type="button"
            onClick={close}
            className="rounded-md border border-slate-600 bg-slate-800/70 px-4 py-1.5 font-mono text-[12px] font-semibold uppercase tracking-[.14em] text-slate-100 hover:bg-slate-700/60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!ready}
            className={
              ready
                ? "rounded-md border border-amber-400 bg-gradient-to-b from-amber-300 to-amber-500 px-5 py-1.5 font-mono text-[12px] font-bold uppercase tracking-[.14em] text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,.25)] hover:brightness-110"
                : "cursor-not-allowed rounded-md border border-slate-700 bg-slate-900 px-5 py-1.5 font-mono text-[12px] font-bold uppercase tracking-[.14em] text-slate-600"
            }
          >
            Play ↵
          </button>
        </footer>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Per-defId targeting flow + payload builder.
// ─────────────────────────────────────────────────────────────────────

type Flow =
  | "none"
  | "direction"
  | "self-aging-barrel"
  | "any-aging-barrel"
  | "opponent"
  | "opponent-and-card"
  | "barrel-and-committed-card"
  | "design-only";

function flowForCard(defId: OperationsCardDefId): Flow {
  switch (defId) {
    case "market_manipulation":
      return "direction";
    case "rushed_shipment":
      return "self-aging-barrel";
    case "regulatory_inspection":
    case "slow_pour":
      return "any-aging-barrel";
    case "spoiled_batch":
    case "counterfeit_bottles":
      return "opponent";
    case "audit":
    case "federal_inspector":
      return "opponent-and-card";
    case "sabotage":
      return "barrel-and-committed-card";
    case "whiskey_raid":
    case "coopers_contract":
    case "grain_futures":
      return "design-only";
    // No-target cards.
    case "bourbon_boom":
    case "glut":
    case "demand_surge":
    case "allocation":
    case "kentucky_connection":
    case "rating_boost":
    case "wild_mash":
      return "none";
  }
}

interface Picks {
  targetPlayerId: string | null;
  targetBarrelId: string | null;
  targetCardId: string | null;
  direction: "up" | "down" | null;
}

function isReady(flow: Flow, picks: Picks): boolean {
  switch (flow) {
    case "none":
      return true;
    case "direction":
      return picks.direction != null;
    case "self-aging-barrel":
    case "any-aging-barrel":
      return picks.targetBarrelId != null;
    case "opponent":
      return picks.targetPlayerId != null;
    case "opponent-and-card":
      return picks.targetPlayerId != null && picks.targetCardId != null;
    case "barrel-and-committed-card":
      return picks.targetBarrelId != null && picks.targetCardId != null;
    case "design-only":
      return false;
  }
}

function whyNotReady(flow: Flow, picks: Picks): string {
  switch (flow) {
    case "direction":
      return "Pick a direction";
    case "self-aging-barrel":
    case "any-aging-barrel":
      return "Pick a barrel";
    case "opponent":
      return "Pick an opponent";
    case "opponent-and-card":
      return picks.targetPlayerId ? "Pick a card" : "Pick an opponent";
    case "barrel-and-committed-card":
      return picks.targetBarrelId ? "Pick a committed card" : "Pick a barrel";
    case "design-only":
      return "Handler pending";
    case "none":
      return "";
  }
}

function buildAction(
  playerId: string,
  card: OperationsCard,
  picks: Picks,
): GameAction | null {
  const cardId = card.id;
  switch (card.defId) {
    case "market_manipulation":
      if (picks.direction == null) return null;
      return {
        type: "PLAY_OPERATIONS_CARD",
        playerId,
        cardId,
        defId: card.defId,
        direction: picks.direction,
      };
    case "rushed_shipment":
    case "regulatory_inspection":
      if (picks.targetBarrelId == null) return null;
      return {
        type: "PLAY_OPERATIONS_CARD",
        playerId,
        cardId,
        defId: card.defId,
        targetBarrelId: picks.targetBarrelId,
      };
    case "slow_pour":
      if (picks.targetBarrelId == null) return null;
      return {
        type: "PLAY_OPERATIONS_CARD",
        playerId,
        cardId,
        defId: "slow_pour",
        targetBarrelId: picks.targetBarrelId,
      };
    case "spoiled_batch":
      if (picks.targetPlayerId == null) return null;
      return {
        type: "PLAY_OPERATIONS_CARD",
        playerId,
        cardId,
        defId: "spoiled_batch",
        targetPlayerId: picks.targetPlayerId,
      };
    case "counterfeit_bottles":
      if (picks.targetPlayerId == null) return null;
      return {
        type: "PLAY_OPERATIONS_CARD",
        playerId,
        cardId,
        defId: "counterfeit_bottles",
        targetPlayerId: picks.targetPlayerId,
      };
    case "audit":
      if (picks.targetPlayerId == null || picks.targetCardId == null) return null;
      return {
        type: "PLAY_OPERATIONS_CARD",
        playerId,
        cardId,
        defId: "audit",
        targetPlayerId: picks.targetPlayerId,
        targetCardId: picks.targetCardId,
      };
    case "federal_inspector":
      if (picks.targetPlayerId == null || picks.targetCardId == null) return null;
      return {
        type: "PLAY_OPERATIONS_CARD",
        playerId,
        cardId,
        defId: "federal_inspector",
        targetPlayerId: picks.targetPlayerId,
        targetCardId: picks.targetCardId,
      };
    case "sabotage":
      if (picks.targetBarrelId == null || picks.targetCardId == null) return null;
      return {
        type: "PLAY_OPERATIONS_CARD",
        playerId,
        cardId,
        defId: "sabotage",
        targetBarrelId: picks.targetBarrelId,
        targetCardId: picks.targetCardId,
      };
    case "bourbon_boom":
    case "glut":
    case "demand_surge":
    case "allocation":
    case "kentucky_connection":
    case "rating_boost":
    case "wild_mash":
      return {
        type: "PLAY_OPERATIONS_CARD",
        playerId,
        cardId,
        defId: card.defId,
      };
    case "whiskey_raid":
    case "coopers_contract":
    case "grain_futures":
      // Design-only — engine validator rejects. Never dispatch.
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Layout bits
// ─────────────────────────────────────────────────────────────────────

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-700/55 bg-slate-950/55 px-3 py-2">
      <header className="mb-1.5 flex items-baseline gap-2">
        <span className="font-mono text-[10.5px] font-bold uppercase tracking-[.18em] text-amber-300">
          {label}
        </span>
      </header>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  );
}

function ChoiceBtn({
  active,
  onClick,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex flex-col items-start gap-0.5 rounded border px-3 py-2 text-left transition-colors",
        active
          ? "border-amber-400 bg-amber-900/30 text-amber-100"
          : "border-slate-700/55 bg-slate-950/60 text-slate-200 hover:border-amber-500/60 hover:bg-amber-950/20",
      ].join(" ")}
    >
      <span className="font-display text-[14px] font-semibold">{label}</span>
      {hint ? (
        <span className="font-mono text-[10px] uppercase tracking-[.1em] text-slate-400">
          {hint}
        </span>
      ) : null}
    </button>
  );
}

function PlayerChoice({
  player,
  active,
  onClick,
}: {
  player: PlayerState;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <ChoiceBtn
      active={active}
      onClick={onClick}
      label={player.name}
      hint={`${player.hand.length} cards · ${player.capital} cap`}
    />
  );
}

function BarrelChoice({
  barrel,
  ownerName,
  active,
  onClick,
}: {
  barrel: { id: string; age: number; attachedMashBill: { name: string } };
  ownerName: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <ChoiceBtn
      active={active}
      onClick={onClick}
      label={`${ownerName} · ${barrel.attachedMashBill.name}`}
      hint={`Age ${barrel.age}y`}
    />
  );
}

function CardChoice({
  card,
  active,
  onClick,
}: {
  card: Card;
  active: boolean;
  onClick: () => void;
}) {
  const name = card.displayName ?? cardTypeLabel(card);
  return (
    <ChoiceBtn
      active={active}
      onClick={onClick}
      label={name}
      hint={cardTypeLabel(card)}
    />
  );
}

function cardTypeLabel(card: Card): string {
  if (card.type === "labor") return `Labor · ${card.laborSubtype ?? ""}`.trim();
  if (card.type === "resource") {
    return `${card.specialty ? "Specialty " : ""}${card.subtype ?? "Resource"}`;
  }
  if (card.type === "operations") return "Ops";
  if (card.type === "investment") return "Investment";
  return card.type;
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded border border-dashed border-slate-700/50 px-3 py-2 font-mono text-[10.5px] italic text-slate-500">
      {children}
    </div>
  );
}
