"use client";

/**
 * Body of the RightRail "Market" tab.
 *
 * Spec: design_handoff_bourbon_blend/README.md §Market tab.
 *
 * Three sections separated by 1px slate-800 dividers:
 *   1. Demand bar — 12 cells, banded low/mid/high with rose tip at 9+
 *   2. Resource piles — 3 deck stacks (cask / corn / grain)
 *   3. Business decks — 4 deck stacks (bourbon / invest / ops / market)
 *
 * Direct-interaction wiring:
 *   - When it's the human's action-phase turn AND they can afford the
 *     current cost, the cask / corn / grain / bourbon / invest / ops decks
 *     are *drawable* — clicking dispatches the matching draw action.
 *   - Grain opens a sub-picker (barley / rye / wheat) since the engine has
 *     three grain piles but the design renders one combined stack.
 *   - The market deck (Phase 3 only) is always non-interactive here; that
 *     draw happens via MarketPhasePanel.
 *   - When draws aren't legal (other phase, opponent's turn, can't afford),
 *     all decks render in their muted state.
 *   - Empty decks are also muted — there's nothing to draw.
 */

import type { Action, ResourcePileName } from "@/lib/engine/actions";
import { HAND_LIMIT } from "@/lib/engine/state";
import { handSize } from "@/lib/engine/checks";
import { useGameStore } from "@/lib/store/gameStore";
import DeckStack from "./DeckStack";

const GRAIN_SUB_PILES = ["barley", "rye", "wheat"] as const satisfies readonly ResourcePileName[];

/**
 * Pick a random non-empty grain pile from the market. Returns null if every
 * grain pile is empty (in which case the grain deck shouldn't be drawable
 * at all). Uses Math.random — the *which-pile* choice is non-deterministic
 * by design ("you don't get to choose"), but the engine still records the
 * specific pile in the dispatched action so save/load round-trips cleanly.
 */
function pickRandomGrain(
  state: {
    market: { barley: unknown[]; rye: unknown[]; wheat: unknown[] };
  },
  shortages: ResourcePileName[] = [],
): ResourcePileName | null {
  const candidates = GRAIN_SUB_PILES.filter(
    (id) => state.market[id].length > 0 && !shortages.includes(id),
  );
  if (candidates.length === 0) return null;
  const idx = Math.floor(Math.random() * candidates.length);
  return candidates[idx];
}

export default function MarketPanel() {
  const state = useGameStore((s) => s.state)!;
  const dispatch = useGameStore((s) => s.dispatch);
  const m = state.market;

  const humanId = state.playerOrder.find(
    (id) => state.players[id].kind === "human",
  );
  const me = humanId ? state.players[humanId] : null;
  const cost = state.actionPhase.freeWindowActive
    ? 0
    : state.actionPhase.paidLapTier;
  const canAfford = !!me && me.cash >= cost;
  const drawable =
    !!humanId &&
    state.currentPlayerId === humanId &&
    state.phase === "action" &&
    canAfford;

  // Combined "grain" deck for the visual (the engine still uses three
  // sub-piles). Cask is its own pile / pile-stack on the design.
  const grainCount = m.barley.length + m.rye.length + m.wheat.length;

  const bourbonCount = m.bourbonDeck.length;
  // Soft cap — drawing past 10 is still legal but exposes you to the next
  // Audit. We surface the over-cap state with a warning tooltip rather
  // than blocking the draw.
  const overHandLimit = !!me && handSize(me) >= HAND_LIMIT;

  // Resource shortages: market cards from last round can lock specific
  // piles for this round. We render those piles in a "shut down" state.
  const shortages = state.currentRoundEffects.resourceShortages;
  const caskShortage = shortages.includes("cask");
  const cornShortage = shortages.includes("corn");
  const grainShortage =
    shortages.includes("barley") &&
    shortages.includes("rye") &&
    shortages.includes("wheat");
  // Note: a single grain pile being shorted doesn't lock the combined
  // grain stack visually — the player can still pull from the others.
  // Only when ALL three are shorted does the combined display read as
  // shut down. (We can refine to per-grain chips later if desired.)

  const dispatchDraw = (action: Action) => {
    if (!drawable) return;
    dispatch(action);
  };

  return (
    <div>
      {/* Demand has moved to the action sub-bar — see PhaseBanner. */}

      {/* 1. Resource piles */}
      <div className="border-b border-slate-800 px-3.5 py-3.5">
        <div className="mb-2.5 flex items-baseline justify-between">
          <Caption>resource piles</Caption>
          <DrawableBadge active={drawable} />
        </div>
        <div className="flex gap-2">
          <DeckStack
            label="cask"
            count={m.cask.length}
            tone="amber"
            disabled={!drawable || m.cask.length === 0}
            shutdown={caskShortage}
            title={
              caskShortage
                ? "Cask pile shut down this round (market shortage)"
                : !drawable
                  ? notDrawableReason(state, humanId, canAfford)
                  : m.cask.length === 0
                    ? "Cask pile is empty"
                    : `Draw a cask${cost > 0 ? ` ($${cost})` : ""}`
            }
            onClick={
              drawable && humanId && m.cask.length > 0 && !caskShortage
                ? () =>
                    dispatchDraw({
                      t: "DRAW_RESOURCE",
                      playerId: humanId,
                      pile: "cask",
                    })
                : undefined
            }
          />
          <DeckStack
            label="corn"
            count={m.corn.length}
            tone="yellow"
            disabled={!drawable || m.corn.length === 0}
            shutdown={cornShortage}
            title={
              cornShortage
                ? "Corn pile shut down this round (market shortage)"
                : !drawable
                  ? notDrawableReason(state, humanId, canAfford)
                  : m.corn.length === 0
                    ? "Corn pile is empty"
                    : `Draw corn${cost > 0 ? ` ($${cost})` : ""}`
            }
            onClick={
              drawable && humanId && m.corn.length > 0 && !cornShortage
                ? () =>
                    dispatchDraw({
                      t: "DRAW_RESOURCE",
                      playerId: humanId,
                      pile: "corn",
                    })
                : undefined
            }
          />
          {/* Grain — picks a random non-empty, non-shorted grain pile
              (barley / rye / wheat). The user doesn't choose which grain. */}
          <DeckStack
            label="grain"
            count={grainCount}
            tone="lime"
            disabled={!drawable || grainCount === 0}
            shutdown={grainShortage}
            title={
              grainShortage
                ? "All grain piles shut down this round (market shortages)"
                : !drawable
                  ? notDrawableReason(state, humanId, canAfford)
                  : grainCount === 0
                    ? "All grain piles empty"
                    : (() => {
                        const partial = GRAIN_SUB_PILES.filter((p) =>
                          shortages.includes(p),
                        );
                        const partialNote = partial.length
                          ? ` · ${partial.join(", ")} shut down`
                          : "";
                        return `Draw a random grain${cost > 0 ? ` ($${cost})` : ""}${partialNote}`;
                      })()
            }
            onClick={
              drawable && humanId && grainCount > 0 && !grainShortage
                ? () => {
                    const pile = pickRandomGrain(state, shortages);
                    if (!pile) return;
                    dispatchDraw({
                      t: "DRAW_RESOURCE",
                      playerId: humanId,
                      pile,
                    });
                  }
                : undefined
            }
          />
        </div>
      </div>

      {/* 3. Business decks */}
      <div className="px-3.5 py-3.5">
        <div className="mb-2.5 flex items-baseline justify-between">
          <Caption>business decks</Caption>
          <DrawableBadge active={drawable} />
        </div>
        <div className="grid grid-cols-4 gap-2">
          <DeckStack
            label="bourbon"
            count={bourbonCount}
            tone="amber"
            disabled={!drawable || bourbonCount === 0}
            title={
              !drawable
                ? notDrawableReason(state, humanId, canAfford)
                : bourbonCount === 0
                  ? "Bourbon deck empty"
                  : overHandLimit
                    ? `Hand at ${HAND_LIMIT}+; an Audit will force a discard`
                    : `Draw a mash bill${cost > 0 ? ` ($${cost})` : ""}`
            }
            onClick={
              drawable && humanId && bourbonCount > 0
                ? () =>
                    dispatchDraw({
                      t: "DRAW_BOURBON",
                      playerId: humanId,
                    })
                : undefined
            }
          />
          <DeckStack
            label="invest"
            count={m.investmentDeck.length}
            tone="emerald"
            disabled={!drawable || m.investmentDeck.length === 0}
            title={
              !drawable
                ? notDrawableReason(state, humanId, canAfford)
                : m.investmentDeck.length === 0
                  ? "Investment deck empty"
                  : `Draw an investment${cost > 0 ? ` ($${cost})` : ""}`
            }
            onClick={
              drawable && humanId && m.investmentDeck.length > 0
                ? () =>
                    dispatchDraw({
                      t: "DRAW_INVESTMENT",
                      playerId: humanId,
                    })
                : undefined
            }
          />
          <DeckStack
            label="ops"
            count={m.operationsDeck.length}
            tone="violet"
            disabled={!drawable || m.operationsDeck.length === 0}
            title={
              !drawable
                ? notDrawableReason(state, humanId, canAfford)
                : m.operationsDeck.length === 0
                  ? "Operations deck empty"
                  : `Draw an operations card${cost > 0 ? ` ($${cost})` : ""}`
            }
            onClick={
              drawable && humanId && m.operationsDeck.length > 0
                ? () =>
                    dispatchDraw({
                      t: "DRAW_OPERATIONS",
                      playerId: humanId,
                    })
                : undefined
            }
          />
          {/* Market deck is Phase-3-only; never click-draw from here. */}
          <DeckStack
            label="market"
            count={m.marketDeck.length}
            disabled
            title="Phase 3 only"
          />
        </div>
      </div>
    </div>
  );
}

function Caption({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`font-mono text-[10px] uppercase tracking-[.12em] text-slate-500 ${className}`}
    >
      {children}
    </span>
  );
}

/**
 * Right-aligned hint that appears next to a section caption when its decks
 * are currently drawable. Subtle amber accent encourages clicks without
 * dominating the panel.
 */
function DrawableBadge({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <span className="font-mono text-[10px] uppercase tracking-[.12em] text-amber-300">
      click to draw
    </span>
  );
}

/**
 * Build a tooltip explaining *why* a deck isn't drawable right now, so the
 * muted state is informative rather than mysterious.
 */
function notDrawableReason(
  state: ReturnType<typeof useGameStore.getState>["state"],
  humanId: string | undefined,
  canAfford: boolean,
): string {
  if (!state) return "Game not ready";
  if (!humanId) return "No human player";
  if (state.phase !== "action") {
    if (state.phase === "fees") return "Fees phase — pay rent first";
    if (state.phase === "market") return "Market phase — draw from market";
    if (state.phase === "gameover") return "Game over";
    return "Not the action phase";
  }
  if (state.currentPlayerId !== humanId) {
    const cur = state.players[state.currentPlayerId];
    return `Waiting on ${cur?.name ?? "opponent"}`;
  }
  if (!canAfford) {
    const cost = state.actionPhase.paidLapTier;
    return `Need $${cost} to act`;
  }
  return "Not drawable right now";
}
