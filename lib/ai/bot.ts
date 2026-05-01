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
import { handSize } from "@/lib/engine/checks";
import {
  HAND_LIMIT,
  STARTING_BOURBON_HAND,
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
  pickBestGoldAlt,
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

// ---------- Audit discard ----------

/**
 * Pick which cards to dump when the bot owes an Audit overage. Strategy:
 *   1. Drop operations cards first (lowest expected value).
 *   2. Then unbuilt investments with low capital (we already know we
 *      probably can't afford expensive ones soon).
 *   3. Then mash bills with the worst age-4 grid value.
 * Stops once we've selected `overage` cards.
 */
export function pickAuditDiscard(
  state: GameState,
  playerId: string,
): Extract<Action, { t: "AUDIT_DISCARD" }> {
  const player = state.players[playerId];
  const overage = player.pendingAuditOverage ?? 0;
  const ops = player.operations.map((o) => o.instanceId);
  const unbuiltInv = player.investments
    .filter((i) => i.status === "unbuilt")
    .sort((a, b) => investmentCapital(a.cardId) - investmentCapital(b.cardId))
    .map((i) => i.instanceId);
  const bills = player.bourbonHand.slice().sort((a, b) => {
    const ca = BOURBON_CARDS_BY_ID[a];
    const cb = BOURBON_CARDS_BY_ID[b];
    if (!ca && !cb) return 0;
    if (!ca) return -1;
    if (!cb) return 1;
    return (
      lookupSalePrice(ca, 4, state.demand).price -
      lookupSalePrice(cb, 4, state.demand).price
    );
  });

  const opsToDiscard: string[] = [];
  const invToDiscard: string[] = [];
  const billsToDiscard: string[] = [];
  let need = overage;

  for (const id of ops) {
    if (need <= 0) break;
    opsToDiscard.push(id);
    need -= 1;
  }
  for (const id of unbuiltInv) {
    if (need <= 0) break;
    invToDiscard.push(id);
    need -= 1;
  }
  for (const id of bills) {
    if (need <= 0) break;
    billsToDiscard.push(id);
    need -= 1;
  }
  return {
    t: "AUDIT_DISCARD",
    playerId,
    mashBillIds: billsToDiscard,
    investmentInstanceIds: invToDiscard,
    operationsInstanceIds: opsToDiscard,
  };
}

// ---------- Action phase ----------

export function pickActionPhaseMove(
  state: GameState,
  playerId: string,
): Action {
  const player = state.players[playerId];

  // If the bot owes an audit discard, that's the only legal next move.
  if (player.pendingAuditOverage != null && player.pendingAuditOverage > 0) {
    return pickAuditDiscard(state, playerId);
  }

  const scored: ScoredAction[] = [];
  const cost = actionCostNow(state);

  // Sell: the most valuable old barrel if possible and we can afford the action.
  for (const { barrel } of ownedBarrels(state, playerId)) {
    if (barrel.age < 2) continue;
    if (player.cash < cost) continue;
    const basePayout = estimateSalePayout(state, barrel);
    const altPick = pickBestGoldAlt(state, player, barrel);
    const payout = altPick ? altPick.payout : basePayout;
    if (payout <= cost) continue;
    scored.push({
      action: altPick
        ? {
            t: "SELL_BOURBON",
            playerId,
            barrelId: barrel.barrelId,
            applyGoldBourbonId: altPick.goldId,
          }
        : {
            t: "SELL_BOURBON",
            playerId,
            barrelId: barrel.barrelId,
          },
      score: payout - cost,
      reason: altPick
        ? `sell age ${barrel.age} via Gold for ~$${payout}`
        : `sell age ${barrel.age} for ~$${payout}`,
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
    const handSizeNow = player.resourceHand.length;
    // Past 5 cards, drawing has negative value (overloaded hand).
    const handPenalty = Math.max(0, handSizeNow - 3) * 2;
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

  // Draw bourbon: most useful when the player has a small bourbon hand.
  // Soft cap means the engine no longer blocks this past 10 — but the bot
  // still doesn't want to bloat past the hand limit (Audit risk).
  const totalHand = handSize(player);
  if (
    player.cash >= cost &&
    state.market.bourbonDeck.length + state.market.bourbonDiscard.length > 0
  ) {
    const bourbonHandGap = STARTING_BOURBON_HAND - player.bourbonHand.length;
    const overflowPenalty = Math.max(0, totalHand - HAND_LIMIT) * 4;
    const score = bourbonHandGap * 1.2 - cost - overflowPenalty;
    scored.push({
      action: { t: "DRAW_BOURBON", playerId },
      score,
      reason: `draw bourbon — bills ${player.bourbonHand.length}, hand ${totalHand}/${HAND_LIMIT}`,
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

  // Call Audit: positive EV when at least one opponent is over the hand
  // limit. The auditor pays nothing they wouldn't pay otherwise (cost
  // matches a normal action), but forces a hand dump on opponents.
  // Self-audit is fine if we're under-cap (no penalty to us).
  if (player.cash >= cost && !state.actionPhase.auditCalledThisRound) {
    let opponentOver = 0;
    for (const id of state.playerOrder) {
      if (id === playerId) continue;
      const op = state.players[id];
      if (op.eliminated) continue;
      if (handSize(op) > HAND_LIMIT) opponentOver += 1;
    }
    const selfPenalty = handSize(player) > HAND_LIMIT ? 3 : 0;
    const score = opponentOver * 5 - cost - selfPenalty;
    if (opponentOver > 0) {
      scored.push({
        action: { t: "CALL_AUDIT", playerId },
        score,
        reason: `call audit — ${opponentOver} opponent(s) over ${HAND_LIMIT}`,
      });
    }
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
