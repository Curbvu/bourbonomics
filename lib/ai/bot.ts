/**
 * Weighted-scoring bot for Bourbonomics.
 *
 * Decision points handled here:
 *   - Action phase: `pickActionPhaseMove` — scores all legal moves and picks one.
 *   - Fees: `pickFeePayment` — pick which barrels to pay for given cash.
 *   - Market: `pickMarketMove` — drives the Phase 3 draw-and-keep flow.
 *
 * Each `botDifficulty` level tunes exploration via a softmax-ish temperature:
 *   - easy:   high noise, often picks below-optimal
 *   - normal: moderate noise
 *   - hard:   near-optimal
 *
 * All PRNG use runs through the state's rngState so decisions are deterministic
 * for a given seed (critical for save/load and replay).
 */

import type { Action } from "@/lib/engine/actions";
import {
  BOURBON_CARDS_BY_ID,
  drawTop,
  MARKET_CARDS_BY_ID,
} from "@/lib/engine/decks";
import {
  BOURBON_HAND_LIMIT,
  type BotDifficulty,
  type GameState,
  type Player,
} from "@/lib/engine/state";
import { lookupSalePrice } from "@/lib/rules/pricing";
import {
  actionCostNow,
  estimateSalePayout,
  expectedFeesNextRound,
  firstOpenRickhouse,
  hasLegalMash,
  investmentCapital,
  ownedBarrels,
} from "./evaluators";
import { feesForPlayer } from "@/lib/rules/fees";

/**
 * Hard bots take #1, normal bots take from top 2, easy bots take from top 4
 * (capped to the list length). The index within the window is chosen
 * deterministically from the game's logSeq + round, so given a seed the bot
 * is replayable without mutating game state.
 */
function windowForDifficulty(d: BotDifficulty | undefined): number {
  switch (d) {
    case "easy":
      return 4;
    case "hard":
      return 1;
    case "normal":
    default:
      return 2;
  }
}

type ScoredAction = { action: Action; score: number; reason: string };

function pickBest(
  scored: ScoredAction[],
  state: GameState,
  difficulty: BotDifficulty | undefined,
): ScoredAction | null {
  if (scored.length === 0) return null;
  const sorted = scored.slice().sort((a, b) => b.score - a.score);
  const window = Math.min(windowForDifficulty(difficulty), sorted.length);
  const idx = (state.logSeq + state.round) % window;
  return sorted[idx];
}

// ---------- Action phase ----------

export function pickActionPhaseMove(
  state: GameState,
  playerId: string,
): Action {
  const player = state.players[playerId];
  const scored: ScoredAction[] = [];
  const cost = actionCostNow(state);

  // Sell: the most valuable old barrel if possible and we can afford the action.
  for (const { barrel } of ownedBarrels(state, playerId)) {
    if (barrel.age < 2) continue;
    if (player.cash < cost) continue;
    const payout = estimateSalePayout(state, barrel);
    if (payout <= cost) continue;
    scored.push({
      action: {
        t: "SELL_BOURBON",
        playerId,
        barrelId: barrel.barrelId,
      },
      score: payout - cost,
      reason: `sell age ${barrel.age} for ~$${payout}`,
    });
  }

  // Make bourbon: if legal mash + open slot, a mash bill in hand, and we can pay.
  if (
    hasLegalMash(player) &&
    player.bourbonHand.length > 0 &&
    player.cash >= cost
  ) {
    const rickhouseId = firstOpenRickhouse(state);
    if (rickhouseId) {
      const mash = pickMashFromHand(player);
      if (mash.length >= 3) {
        const mashBillId = pickBestMashBill(state, player);
        if (mashBillId) {
          // Value of aging ≈ expected future sale minus expected fees.
          const score = 14 - cost - expectedFeesNextRound(state, playerId) * 0.3;
          scored.push({
            action: {
              t: "MAKE_BOURBON",
              playerId,
              rickhouseId,
              resourceInstanceIds: mash,
              mashBillId,
            },
            score,
            reason: `make bourbon at ${rickhouseId} with ${mashBillId}`,
          });
        }
      }
    }
  }

  // Draw resources: valuable if hand is missing a mash ingredient; dwindles as hand grows.
  if (player.cash >= cost) {
    const handSize = player.resourceHand.length;
    // Past 5 cards, drawing has negative value (overloaded hand).
    const handPenalty = Math.max(0, handSize - 3) * 2;
    for (const pile of ["cask", "corn", "barley", "rye", "wheat"] as const) {
      const missing = !player.resourceHand.some((r) => r.resource === pile);
      // If the bot already has a complete mash, don't chase more resources.
      const base = hasLegalMash(player) ? 0.5 : missing ? 3 : 1;
      const score = base - cost - handPenalty;
      scored.push({
        action: { t: "DRAW_RESOURCE", playerId, pile },
        score,
        reason: `draw ${pile}${missing ? " (missing)" : ""}`,
      });
    }
  }

  // Draw bourbon: most useful when the player has room in their bourbon
  // hand and isn't yet ready to barrel. Stronger when they're empty,
  // weaker (but still > 0) when they're partially full.
  if (
    player.cash >= cost &&
    player.bourbonHand.length < BOURBON_HAND_LIMIT &&
    state.market.bourbonDeck.length + state.market.bourbonDiscard.length > 0
  ) {
    const handGap = BOURBON_HAND_LIMIT - player.bourbonHand.length;
    const score = handGap * 1.2 - cost;
    scored.push({
      action: { t: "DRAW_BOURBON", playerId },
      score,
      reason: `draw bourbon — hand ${player.bourbonHand.length}/${BOURBON_HAND_LIMIT}`,
    });
  }

  // Implement investment: only if we have cash + no pressing fees.
  for (const inv of player.investments) {
    if (inv.status !== "unbuilt") continue;
    const capital = investmentCapital(inv.cardId);
    if (capital === 0) continue;
    const buffer = player.cash - capital - cost - expectedFeesNextRound(state, playerId);
    if (buffer < 2) continue;
    scored.push({
      action: {
        t: "IMPLEMENT_INVESTMENT",
        playerId,
        investmentInstanceId: inv.instanceId,
      },
      score: capital * 0.5 - cost,
      reason: `implement ${inv.cardId}`,
    });
  }

  // Resolve operations: simple heuristic — always positive EV.
  for (const ops of player.operations) {
    if (player.cash < cost) break;
    scored.push({
      action: {
        t: "RESOLVE_OPERATIONS",
        playerId,
        operationsInstanceId: ops.instanceId,
      },
      score: 3 - cost,
      reason: `resolve ops ${ops.cardId}`,
    });
  }

  // Pass: gets stronger once the bot has nothing productive left to do.
  const sellableBarrels = ownedBarrels(state, playerId).filter((b) => b.barrel.age >= 2).length;
  const makeReady = hasLegalMash(player) && firstOpenRickhouse(state) !== null;
  const nothingProductive = sellableBarrels === 0 && !makeReady && player.resourceHand.length >= 4;
  scored.push({
    action: { t: "PASS_ACTION", playerId },
    score: nothingProductive ? 8 : 1 - cost * 0.2,
    reason: "pass",
  });

  const best = pickBest(scored, state, player.botDifficulty);
  return best?.action ?? { t: "PASS_ACTION", playerId };
}

/**
 * Choose which mash bill to commit to the new barrel. Prefer the bill
 * with the best 4-year × current-demand grid cell — that's the bot's
 * baseline expected payout once aging completes. Falls back to the
 * first card in hand for unknown ids.
 */
function pickBestMashBill(state: GameState, player: Player): string | null {
  if (player.bourbonHand.length === 0) return null;
  let bestId = player.bourbonHand[0];
  let bestScore = -Infinity;
  for (const id of player.bourbonHand) {
    const card = BOURBON_CARDS_BY_ID[id];
    if (!card) continue;
    // Score against age 4 (a reasonable hold target) at current demand.
    const score = lookupSalePrice(card, 4, state.demand).price;
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }
  return bestId;
}

function pickMashFromHand(player: Player): string[] {
  const cask = player.resourceHand.find((r) => r.resource === "cask");
  const corn = player.resourceHand.find((r) => r.resource === "corn");
  const grain = player.resourceHand.find(
    (r) => r.resource === "rye" || r.resource === "wheat" || r.resource === "barley",
  );
  const picks: string[] = [];
  if (cask) picks.push(cask.instanceId);
  if (corn) picks.push(corn.instanceId);
  if (grain) picks.push(grain.instanceId);
  return picks;
}

// ---------- Fees ----------

export function pickFeePayment(state: GameState, playerId: string): string[] {
  const player = state.players[playerId];
  const fees = feesForPlayer(state, playerId).sort((a, b) => {
    // Pay older (more valuable) barrels first; then cheapest fees.
    return a.amount - b.amount;
  });
  const paid: string[] = [];
  let remaining = player.cash;
  for (const fee of fees) {
    if (remaining >= fee.amount) {
      paid.push(fee.barrelId);
      remaining -= fee.amount;
    }
  }
  return paid;
}

// ---------- Market ----------

/**
 * Phase 3 is now "draw 2, keep 1." The bot's choice of which to keep is to
 * pick whichever card raises demand the most (or, if both are non-numeric
 * flavor cards, the first one). When the bot hasn't drawn yet, it draws.
 */
export function pickMarketMove(state: GameState, playerId: string): Action {
  const stash = state.marketPhase[playerId];
  const drawn = stash?.drawnCardIds ?? [];
  if (drawn.length === 0) {
    return { t: "MARKET_DRAW", playerId };
  }
  let bestId = drawn[0];
  let bestScore = -Infinity;
  for (const id of drawn) {
    const def = MARKET_CARDS_BY_ID[id];
    let score = 0;
    if (def && def.resolved.kind === "demand_delta") score = def.resolved.delta;
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }
  return { t: "MARKET_KEEP", playerId, keptCardId: bestId };
}

// Re-export for tests.
export { drawTop };
