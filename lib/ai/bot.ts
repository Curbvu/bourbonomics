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
  const cost = actionCostNow(state, playerId);

  // Sell: the most valuable old barrel if possible and we can afford the action.
  // Selling also frees a rickhouse slot, which means avoiding next round's
  // rent on that barrel — that saved rent counts toward the score so a
  // break-even or even slightly-negative cash sale can still be the right
  // move when rent would have been worse.
  const rentPerBarrelHere: Record<string, number> = {};
  for (const h of state.rickhouses) rentPerBarrelHere[h.id] = h.barrels.length;
  for (const { rickhouseId, barrel } of ownedBarrels(state, playerId)) {
    if (barrel.age < 2) continue;
    if (player.cash < cost) continue;
    const basePayout = estimateSalePayout(state, barrel);
    const altPick = pickBestGoldAlt(state, player, barrel);
    const payout = altPick ? altPick.payout : basePayout;
    const rentSaved = rentPerBarrelHere[rickhouseId] ?? 0;
    const netValue = payout - cost + rentSaved;
    // Skip only if the move loses cash AND saves no rent.
    if (netValue <= 0) continue;
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
      score: netValue,
      reason: altPick
        ? `sell age ${barrel.age} via Gold for ~$${payout} (rent saved ~$${rentSaved})`
        : `sell age ${barrel.age} for ~$${payout} (rent saved ~$${rentSaved})`,
    });
  }

  // Make bourbon: pick a (bill, mash) PAIR that satisfies the bill's
  // recipe, not just any 3-card mash with any bill. Previously the bot
  // would happily score the highest-grid bill in hand and then build a
  // generic 1+1+1 mash for it — but ~19 of 65 bills carry recipes
  // ("rye ≥ 2", "no rye", "wheat ≥ 1", etc.), so the engine rejected
  // every MAKE attempt with `make_invalid`. Hard bots with full hands
  // would log dozens of failed makes and end the round at 0 barrels.
  const openRickhouse = firstOpenRickhouse(state);
  if (
    openRickhouse &&
    player.bourbonHand.length > 0 &&
    player.cash >= cost
  ) {
    const pair = pickBestBillAndMash(state, player);
    if (pair) {
      const score = 28 - cost - expectedFeesNextRound(state, playerId) * 0.3;
      scored.push({
        action: {
          t: "MAKE_BOURBON",
          playerId,
          rickhouseId: openRickhouse,
          resourceInstanceIds: pair.mashInstanceIds,
          mashBillId: pair.billId,
        },
        score,
        reason: `make ${pair.billId} (${pair.mashInstanceIds.length}-card mash)`,
      });
    }
  }

  // Draw resources: valuable if hand is missing a mash ingredient; dwindles
  // as hand grows. The previous scoring went negative under paid laps
  // (`3 - cost`) so a bot one resource short of a barrel would just pass
  // instead of paying $1 to finish the mash. Now: when the bot has a bill
  // + an open rickhouse + a missing piece, drawing that piece is "almost
  // a make in waiting" and scores high enough to beat PASS even at $3+.
  if (player.cash >= cost) {
    const handSizeNow = player.resourceHand.length;
    const handPenalty = Math.max(0, handSizeNow - 5) * 2;
    const wantsMake = !!openRickhouse && player.bourbonHand.length > 0;
    const hasCask = player.resourceHand.some((r) => r.resource === "cask");
    const hasCorn = player.resourceHand.some((r) => r.resource === "corn");
    const hasGrain = player.resourceHand.some(
      (r) => r.resource === "rye" || r.resource === "wheat" || r.resource === "barley",
    );
    for (const pile of ["cask", "corn", "barley", "rye", "wheat"] as const) {
      const missing = !player.resourceHand.some((r) => r.resource === pile);
      // What does THIS draw unblock toward a make?
      const completesMash =
        wantsMake &&
        ((pile === "cask" && !hasCask && hasCorn && hasGrain) ||
          (pile === "corn" && hasCask && !hasCorn && hasGrain) ||
          ((pile === "rye" || pile === "wheat" || pile === "barley") &&
            hasCask &&
            hasCorn &&
            !hasGrain));
      const fillsMissingPiece =
        wantsMake &&
        ((pile === "cask" && !hasCask) ||
          (pile === "corn" && !hasCorn) ||
          ((pile === "rye" || pile === "wheat" || pile === "barley") && !hasGrain));
      let base: number;
      if (completesMash) base = 14; // basically a primed make
      else if (fillsMissingPiece) base = 8; // makes the make possible
      else if (hasLegalMash(player)) base = 0.5; // already legal — extra is fluff
      else base = missing ? 3 : 1;
      const score = base - cost * 0.6 - handPenalty;
      scored.push({
        action: { t: "DRAW_RESOURCE", playerId, pile },
        score,
        reason: `draw ${pile}${completesMash ? " (completes)" : fillsMissingPiece ? " (needed)" : missing ? " (missing)" : ""}`,
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

  // Pass: gets stronger when (a) nothing productive left, OR (b) the bot
  // is running out of cash relative to next-round rent. Without (b) the
  // bot would happily spend its last $5 on a $3 paid draw and then default
  // on rent next round — exactly the "burn cash on actions" failure mode
  // we saw. Now: once cash drops to ≤ projected rent + buffer, PASS is
  // the dominant move regardless of what else is on the board.
  const sellableBarrels = ownedBarrels(state, playerId).filter((b) => b.barrel.age >= 2).length;
  const makeReady = hasLegalMash(player) && firstOpenRickhouse(state) !== null;
  const nothingProductive = sellableBarrels === 0 && !makeReady && player.resourceHand.length >= 4;
  const projectedRent = expectedFeesNextRound(state, playerId);
  const cashAfterAction = player.cash - cost;
  const cashTight = cashAfterAction < projectedRent + 2; // need rent + small buffer
  const cashCritical = cashAfterAction < projectedRent; // would default on rent
  let passScore: number;
  let passReason: string;
  if (cashCritical) {
    passScore = 30; // fold immediately — cannot afford rent if we keep spending
    passReason = `pass — cash ${player.cash} below rent ${projectedRent} + cost ${cost}`;
  } else if (cashTight) {
    passScore = 12;
    passReason = `pass — cash tight vs rent ${projectedRent}`;
  } else if (nothingProductive) {
    passScore = 8;
    passReason = "pass — nothing productive";
  } else {
    passScore = 1 - cost * 0.2;
    passReason = "pass";
  }
  scored.push({
    action: { t: "PASS_ACTION", playerId },
    score: passScore,
    reason: passReason,
  });

  const best = pickBest(scored, state, player.botDifficulty);
  return best?.action ?? { t: "PASS_ACTION", playerId };
}

/**
 * Pick the best (bill, mash-instance-ids) pair the player can actually
 * legally play right now. Checks every bill in hand, builds the
 * cheapest legal mash that satisfies the bill's recipe + universal
 * rules, and scores by the bill's mid-age sale price at current demand.
 *
 * Returns null if no bill can be satisfied with the resources in hand.
 */
function pickBestBillAndMash(
  state: GameState,
  player: Player,
): { billId: string; mashInstanceIds: string[] } | null {
  let best: {
    billId: string;
    mashInstanceIds: string[];
    score: number;
  } | null = null;
  for (const id of player.bourbonHand) {
    const card = BOURBON_CARDS_BY_ID[id];
    if (!card) continue;
    const mash = tryBuildMashForBill(player, card);
    if (!mash) continue;
    const middleAge = card.ageBands[Math.min(1, card.ageBands.length - 1)];
    const ceiling = Math.max(...card.grid.flatMap((row) => row));
    const score =
      lookupSalePrice(card, middleAge, state.demand).price + ceiling * 0.05;
    if (!best || score > best.score) {
      best = { billId: id, mashInstanceIds: mash, score };
    }
  }
  return best ? { billId: best.billId, mashInstanceIds: best.mashInstanceIds } : null;
}

/**
 * Build the smallest legal mash for a specific bill from the player's
 * resource hand. Honors per-grain mins/maxes (max=0 = forbidden), the
 * universal "1 cask + ≥1 corn + ≥1 small grain + ≤MAX_MASH_CARDS" rule,
 * and the optional `recipe.grain` total-grain constraint.
 *
 * Returns null when the hand can't satisfy the bill — the bot will
 * fall back to drawing more resources or picking a different bill.
 */
function tryBuildMashForBill(
  player: Player,
  card: import("@/lib/catalogs/types").BourbonCardDef,
): string[] | null {
  const cask = player.resourceHand.find((r) => r.resource === "cask");
  if (!cask) return null;

  type Grain = "corn" | "barley" | "rye" | "wheat";
  const recipe = card.recipe;
  const minOf = (k: Grain): number => recipe?.[k]?.min ?? 0;
  const maxOf = (k: Grain): number | null => {
    const m = recipe?.[k]?.max;
    return typeof m === "number" ? m : null;
  };
  const grainMin = recipe?.grain?.min ?? 0; // total grain (corn + small grains)
  const grainMax = typeof recipe?.grain?.max === "number" ? recipe.grain.max : null;

  // Per-grain targets. Universal rules require ≥1 corn and ≥1 small
  // grain regardless of recipe.
  const target: Record<Grain, number> = {
    corn: Math.max(1, minOf("corn")),
    barley: minOf("barley"),
    rye: minOf("rye"),
    wheat: minOf("wheat"),
  };

  // If the recipe didn't already require a small grain, add one we have
  // (and aren't forbidden by max=0).
  if (target.barley + target.rye + target.wheat < 1) {
    for (const g of ["rye", "wheat", "barley"] as const) {
      if (maxOf(g) === 0) continue;
      const have = player.resourceHand.some(
        (r) => r.resource === g && r.instanceId !== cask.instanceId,
      );
      if (have) {
        target[g] = 1;
        break;
      }
    }
  }

  // Hard universal rule: at least one small grain must end up in the
  // mash. If we still have 0 small-grain target after the bump above —
  // either because every small grain is forbidden by recipe or because
  // the hand simply contains none — abort and let the bot draw more.
  if (target.barley + target.rye + target.wheat < 1) return null;

  // Refuse forbidden grains hard.
  for (const g of ["corn", "barley", "rye", "wheat"] as const) {
    if (maxOf(g) === 0 && target[g] > 0) return null; // recipe contradicts itself
  }

  // Bump corn (or available small grain) to satisfy a `grain` total min.
  let totalGrain =
    target.corn + target.barley + target.rye + target.wheat;
  while (totalGrain < grainMin) {
    // Greedy: add to the grain with the most slack vs. its max + most
    // copies in hand. Try corn first since it's almost always available.
    let added = false;
    for (const g of ["corn", "rye", "wheat", "barley"] as const) {
      const cap = maxOf(g);
      if (cap !== null && target[g] >= cap) continue;
      const inHand = player.resourceHand.filter(
        (r) => r.resource === g && r.instanceId !== cask.instanceId,
      ).length;
      if (inHand <= target[g]) continue;
      target[g] += 1;
      totalGrain += 1;
      added = true;
      break;
    }
    if (!added) return null;
  }

  // Verify hand has enough of each.
  const handByType: Record<Grain, number> = {
    corn: 0,
    barley: 0,
    rye: 0,
    wheat: 0,
  };
  for (const r of player.resourceHand) {
    if (r.instanceId === cask.instanceId) continue;
    if (r.resource === "cask") continue;
    handByType[r.resource as Grain] += 1;
  }
  for (const g of ["corn", "barley", "rye", "wheat"] as const) {
    if (handByType[g] < target[g]) return null;
  }

  // Universal cap: 1 cask + grain total ≤ MAX_MASH_CARDS (= 9 currently).
  const total = 1 + target.corn + target.barley + target.rye + target.wheat;
  if (total > 9) return null;
  if (grainMax !== null && totalGrain > grainMax) return null;

  // Allocate actual instances from hand.
  const used: string[] = [cask.instanceId];
  const remaining: Record<Grain, number> = { ...target };
  for (const r of player.resourceHand) {
    if (r.instanceId === cask.instanceId) continue;
    if (r.resource === "cask") continue;
    const g = r.resource as Grain;
    if (remaining[g] > 0) {
      used.push(r.instanceId);
      remaining[g] -= 1;
    }
  }
  return used;
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
