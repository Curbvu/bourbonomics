/**
 * Final-round scoring per GAME_RULES.md §Winning the Game / Scoring.
 *
 * Each player's total = cash + sum(installed-investment install costs)
 *                       + sum(unlocked Gold Bourbon brand values)
 * Cards in hand (mash bills, unbuilt investments, operations) score $0.
 * Unsold barrels score $0 in the current ruleset.
 *
 * Tiebreak: most unlocked Gold Bourbons → most cash → tie (shared win).
 */

import { INVESTMENT_CARDS_BY_ID, BOURBON_CARDS_BY_ID } from "@/lib/engine/decks";
import {
  DEFAULT_GOLD_BRAND_VALUE,
  type GameState,
  type Player,
  type ScoreBreakdown,
} from "@/lib/engine/state";

/**
 * Return the catalog brand value for a Gold Bourbon. Today's catalog has no
 * `brandValue` column (it would be plumbed through `BourbonCardDef` plus the
 * YAML build), so every unlocked Gold scores `DEFAULT_GOLD_BRAND_VALUE`.
 * When the catalog is enriched, the per-card override will land here.
 */
export function brandValueFor(bourbonCardId: string): number {
  const card = BOURBON_CARDS_BY_ID[bourbonCardId];
  if (!card) return 0;
  // Allow per-card override via a future `brandValue` field, falling back to
  // the default. We read it dynamically so a plumbed-in field is honoured
  // without retypifying call sites.
  const candidate = (card as unknown as { brandValue?: number }).brandValue;
  if (typeof candidate === "number" && candidate >= 0) return candidate;
  return DEFAULT_GOLD_BRAND_VALUE;
}

function investmentScore(player: Player): number {
  let total = 0;
  for (const inv of player.investments) {
    if (inv.status !== "active") continue;
    const def = INVESTMENT_CARDS_BY_ID[inv.cardId];
    if (!def) continue;
    total += def.capital;
  }
  return total;
}

function goldScore(player: Player): { total: number; count: number } {
  let total = 0;
  let count = 0;
  for (const id of player.goldBourbons) {
    total += brandValueFor(id);
    count += 1;
  }
  return { total, count };
}

export function scorePlayer(player: Player): ScoreBreakdown {
  const cash = Math.max(0, player.cash);
  const investments = investmentScore(player);
  const golds = goldScore(player);
  return {
    cash,
    investments,
    goldBourbons: golds.total,
    total: cash + investments + golds.total,
    goldCount: golds.count,
  };
}

export function computeFinalScores(
  state: GameState,
): Record<string, ScoreBreakdown> {
  const out: Record<string, ScoreBreakdown> = {};
  for (const id of state.playerOrder) {
    out[id] = scorePlayer(state.players[id]);
  }
  return out;
}

/**
 * Return the player ids that win — usually one, but ties produce a
 * shared-win array. Tiebreak order: total → most golds → most cash.
 */
export function pickWinners(
  state: GameState,
  scores: Record<string, ScoreBreakdown>,
): string[] {
  const candidates = state.playerOrder.filter(
    (id) => !state.players[id].eliminated,
  );
  if (candidates.length === 0) return [];

  const sorted = candidates.slice().sort((a, b) => {
    const sa = scores[a];
    const sb = scores[b];
    if (sb.total !== sa.total) return sb.total - sa.total;
    if (sb.goldCount !== sa.goldCount) return sb.goldCount - sa.goldCount;
    return sb.cash - sa.cash;
  });

  const top = sorted[0];
  const topScore = scores[top];
  return sorted.filter((id) => {
    const s = scores[id];
    return (
      s.total === topScore.total &&
      s.goldCount === topScore.goldCount &&
      s.cash === topScore.cash
    );
  });
}
