"use client";

/**
 * BottlePlacementModal — fires after the human sells a barrel, when
 * `pendingBottlePlacement` is set on their player. Surfaces every
 * valid destination as a clickable card; clicking dispatches
 * PLACE_BOTTLE with the chosen destination.
 *
 * Destinations:
 *   - Flagship (if the bottle satisfies its constraints)
 *   - Each existing secondary line (same gate)
 *   - "New secondary line" — one button per Line Card in hand that
 *     accepts the bottle (each button creates a single-card secondary
 *     line stacked with that card)
 *   - Inventory (always available; scores +1 rep)
 *
 * No EXTEND_LINE here yet — extending the flagship/secondary mid-game
 * lands in a follow-up.
 */

import type {
  GameAction,
  GameState,
  Line,
  PlayerState,
} from "@bourbonomics/engine";
import {
  canPlaceOnLine,
  getLineBoardDef,
  getLineCardDef,
} from "@bourbonomics/engine";
import { useGameStore } from "@/lib/store/game";
import BottleChip from "./BottleChip";

export default function BottlePlacementModal() {
  const { state, humanSeatPlayerId, dispatch } = useGameStore();
  const seatId = humanSeatPlayerId;
  const player = seatId
    ? state?.players.find((p) => p.id === seatId)
    : null;
  if (!state || !player) return null;
  const pending = player.pendingBottlePlacement;
  if (!pending) return null;
  const bottle = pending.bottle;

  const onPick = (action: GameAction) => () => dispatch(action);

  // Build the option list.
  const flagshipBoard = player.flagshipLine.lineBoardId
    ? getLineBoardDef(player.flagshipLine.lineBoardId)
    : null;
  const flagshipOk = canPlaceOnLine(bottle, player.flagshipLine, player);
  const flagshipAction: GameAction = {
    type: "PLACE_BOTTLE",
    playerId: player.id,
    destination: { kind: "flagship" },
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Place your bottle"
      className="fixed inset-0 z-[56] flex items-center justify-center bg-slate-950/85 p-6 backdrop-blur"
    >
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(251,191,36,0.22) 0%, transparent 65%)",
        }}
      />
      <div className="relative flex max-h-[calc(100vh-3rem)] w-full max-w-[860px] flex-col items-center gap-4">
        <div className="text-center">
          <div className="font-mono text-[12px] uppercase tracking-[.18em] text-amber-300">
            Sale resolved · Place the bottle
          </div>
          <div className="mt-1 font-display text-2xl font-semibold text-amber-100">
            {bottle.name} — bottled and ready
          </div>
          <div className="mt-1 font-mono text-[11.5px] uppercase tracking-[.12em] text-slate-400">
            Choose a line for the bottle to join. Each line you build
            scores rep at game end; inventory bottles score +1 each.
          </div>
        </div>

        <div className="w-full rounded-lg border border-slate-800 bg-slate-950/60 p-4">
          <div className="flex flex-wrap justify-center gap-3">
            {/* Flagship */}
            <PlacementCard
              title={`★ ${flagshipBoard?.name ?? "Flagship"}`}
              subtitle="Your distillery's flagship line"
              bottleCount={player.flagshipLine.bottles.length}
              accent="gold"
              enabled={flagshipOk}
              disabledReason="bottle doesn't match the flagship's constraints"
              onClick={onPick(flagshipAction)}
            />

            {/* Existing secondaries */}
            {player.secondaryLines.map((line, idx) => {
              const ok = canPlaceOnLine(bottle, line, player);
              const action: GameAction = {
                type: "PLACE_BOTTLE",
                playerId: player.id,
                destination: { kind: "secondary", lineId: line.id },
              };
              const themesLabel = describeStack(line);
              return (
                <PlacementCard
                  key={line.id}
                  title={`Secondary ${idx + 1}`}
                  subtitle={themesLabel}
                  bottleCount={line.bottles.length}
                  accent="brass"
                  enabled={ok}
                  disabledReason="bottle doesn't fit this line's constraints"
                  onClick={onPick(action)}
                />
              );
            })}

            {/* New-secondary options (one per accepting Line Card in hand) */}
            {player.secondaryLines.length < 2
              ? player.lineCardHand.map((inst) => {
                  const def = getLineCardDef(inst.defId);
                  if (!def) return null;
                  const candidate: Line = {
                    id: "candidate",
                    lineBoardId: null,
                    stackedCards: [inst],
                    bottles: [],
                  };
                  if (!canPlaceOnLine(bottle, candidate, player)) return null;
                  const action: GameAction = {
                    type: "PLACE_BOTTLE",
                    playerId: player.id,
                    destination: {
                      kind: "new-secondary",
                      lineCardInstanceIds: [inst.instanceId],
                    },
                  };
                  return (
                    <PlacementCard
                      key={`new-${inst.instanceId}`}
                      title={`+ New: ${def.name}`}
                      subtitle="Plays this Line Card from your hand"
                      bottleCount={0}
                      accent="emerald"
                      enabled
                      onClick={onPick(action)}
                    />
                  );
                })
              : null}

            {/* Inventory (always available) */}
            <PlacementCard
              title="Send to inventory"
              subtitle="+1 rep at game end · always legal"
              bottleCount={player.inventory.length}
              accent="slate"
              enabled
              onClick={onPick({
                type: "PLACE_BOTTLE",
                playerId: player.id,
                destination: { kind: "inventory" },
              })}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 text-center">
          <span className="font-mono text-[11px] uppercase tracking-[.1em] text-slate-500">
            Bottle:
          </span>
          <BottleChip bottle={bottle} />
          <span className="font-mono text-[11px] text-slate-300">
            {bottle.rarity} · age {bottle.ageAtSale} · demand{" "}
            {bottle.demandAtSale}
          </span>
        </div>
      </div>
    </div>
  );
}

function describeStack(line: Line): string {
  if (line.stackedCards.length === 0) return "no constraints";
  const names = line.stackedCards
    .map((c) => getLineCardDef(c.defId)?.name)
    .filter((n): n is string => Boolean(n));
  return names.join(" + ");
}

function PlacementCard({
  title,
  subtitle,
  bottleCount,
  accent,
  enabled,
  disabledReason,
  onClick,
}: {
  title: string;
  subtitle: string;
  bottleCount: number;
  accent: "gold" | "brass" | "emerald" | "slate";
  enabled: boolean;
  disabledReason?: string;
  onClick: () => void;
}) {
  const accentColors: Record<typeof accent, { border: string; bg: string; text: string }> = {
    gold: {
      border: "var(--gold)",
      bg: "rgba(240,201,112,.08)",
      text: "var(--gold)",
    },
    brass: {
      border: "var(--brass)",
      bg: "rgba(198,157,82,.10)",
      text: "var(--brass)",
    },
    emerald: {
      border: "rgba(130,201,163,.7)",
      bg: "rgba(130,201,163,.10)",
      text: "rgb(167,213,184)",
    },
    slate: {
      border: "var(--rule)",
      bg: "rgba(0,0,0,.30)",
      text: "var(--ink-muted)",
    },
  };
  const colors = accentColors[accent];

  return (
    <button
      type="button"
      disabled={!enabled}
      title={!enabled ? disabledReason : undefined}
      onClick={enabled ? onClick : undefined}
      className={
        enabled
          ? "flex flex-col gap-1 rounded-md border px-3 py-3 text-left transition-transform hover:scale-[1.02]"
          : "flex flex-col gap-1 rounded-md border px-3 py-3 text-left opacity-40 cursor-not-allowed"
      }
      style={{
        borderColor: colors.border,
        background: colors.bg,
        minWidth: 200,
        maxWidth: 240,
      }}
    >
      <span
        className="font-display text-[14px] font-semibold"
        style={{ color: colors.text }}
      >
        {title}
      </span>
      <span
        className="font-mono text-[10.5px] uppercase tracking-[.08em]"
        style={{ color: "var(--ink-muted)" }}
      >
        {subtitle}
      </span>
      {bottleCount > 0 ? (
        <span
          className="font-mono text-[10px]"
          style={{ color: "var(--mute)" }}
        >
          currently {bottleCount} bottle{bottleCount === 1 ? "" : "s"}
        </span>
      ) : null}
    </button>
  );
}
