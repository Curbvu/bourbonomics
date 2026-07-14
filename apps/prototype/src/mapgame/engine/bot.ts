// Bourbonomics: Map Game — v0 bot driver.
//
// Returns ONE action for the seat currently on the clock (choose or act). The UI
// driver applies it and calls again until it's the human's turn. v0 bots are
// NON-AGGRESSIVE (spec/impl note): they choose a card, expand DPs, distill
// bourbons, and declare niches — but never initiate a Push. Defense is handled
// automatically inside the engine when the human attacks. Flagged for tuning.

import { CONFIG, totalDistillCost } from "./config";
import { current } from "./engine";
import { activeDPCount, tileController, tilesContiguous } from "./derive";
import type { Action, GameState, Player, Tile } from "./types";

/** A connected component (≥min) of tiles this player controls, else null. */
function controlledCluster(state: GameState, playerId: string, min: number): string[] | null {
  const controlled = state.tiles.filter((t) => tileController(state, t.id) === playerId);
  const ids = new Set(controlled.map((t) => t.id));
  const seen = new Set<string>();
  for (const start of controlled) {
    if (seen.has(start.id)) continue;
    // BFS this component
    const comp: string[] = [];
    const stack = [start];
    seen.add(start.id);
    while (stack.length) {
      const cur = stack.pop()!;
      comp.push(cur.id);
      for (const t of controlled) {
        if (!seen.has(t.id) && ids.has(t.id)) {
          const dq = Math.abs(cur.hex.q - t.hex.q);
          const dr = Math.abs(cur.hex.r - t.hex.r);
          const ds = Math.abs(cur.hex.q + cur.hex.r - t.hex.q - t.hex.r);
          if ((dq + dr + ds) / 2 === 1) {
            seen.add(t.id);
            stack.push(t);
          }
        }
      }
    }
    if (comp.length >= min && tilesContiguous(state, comp.slice(0, min))) {
      return comp.slice(0, min);
    }
  }
  return null;
}

function cheapestDistill(state: GameState, p: Player): number | null {
  let best: number | null = null;
  let bestCost = Infinity;
  for (let i = 0; i < state.distillRow.length; i++) {
    const cost = totalDistillCost(state.distillRow[i]!.def.basePrice, i);
    if (cost <= p.capital && cost < bestCost) {
      bestCost = cost;
      best = i;
    }
  }
  return best;
}

function buildTarget(state: GameState, p: Player): string | null {
  const tilesWithAccess = state.tiles.filter((t) => activeDPCount(state, t.id, p.id) >= 1);
  // Prefer a contested tile the bot doesn't yet control (reinforce toward control).
  const contested = tilesWithAccess.find((t) => tileController(state, t.id) !== p.id);
  if (contested) return contested.id;
  return tilesWithAccess[0]?.id ?? null;
}

/** One action for the bot on the clock, or null if it shouldn't be driven. */
export function botAction(state: GameState): Action | null {
  if (state.phase !== "playing") return null;
  const p = current(state);
  if (!p.isBot) return null;

  // Choose stage: take the most-bips card (v0 bots value actions over initiative).
  if (state.stage === "choose") {
    if (p.hasChosen) return null;
    const card = [...p.hand].sort((a, b) => b.bips - a.bips)[0];
    if (!card) return { type: "SACRIFICE_CARD", cardId: p.hand[0]?.id ?? "" };
    return { type: "CHOOSE_CARD", cardId: card.id };
  }

  // Act stage.
  if (state.stage !== "act") return null;
  if (p.bips < 1) return { type: "END_TURN" };

  // Declare a niche if a controlled 5-cluster exists and the bot has none.
  const hasNiche = state.niches.some((n) => n.owner === p.id);
  if (!hasNiche) {
    const cluster = controlledCluster(state, p.id, CONFIG.NICHE_MIN_TILES);
    if (cluster) return { type: "DECLARE_NICHE", tileIds: cluster };
  }

  // Distill the cheapest affordable offer.
  if (p.agents >= 1 && p.cellar.length < CONFIG.CELLAR_CAPACITY) {
    const slot = cheapestDistill(state, p);
    if (slot !== null) return { type: "DISTILL", slotIndex: slot, method: "grab" };
  }

  // Build a DP to grow presence.
  if (p.bips >= CONFIG.COST_BUILD_DP) {
    const target = buildTarget(state, p);
    if (target) return { type: "BUILD_DP", tileId: target };
  }

  // Repair a downed DP.
  const downed = state.dps.find((d) => d.owner === p.id && d.status === "inactive");
  if (downed) return { type: "REPAIR_DP", dpId: downed.id };

  return { type: "END_TURN" };
}
