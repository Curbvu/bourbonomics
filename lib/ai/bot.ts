/**
 * Weighted-scoring bot for Bourbonomics.
 *
 * Decision points handled here:
 *   - Opening: `pickOpeningKeep` (3 of 6) and `pickOpeningCommit` (implement vs hold).
 *   - Action phase: `pickActionPhaseMove` — scores all legal moves and picks one.
 *   - Fees: `pickFeePayment` — pick which barrels to pay for given cash.
 *   - Market: `pickMarketMove` — roll or event.
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
import { drawTop } from "@/lib/engine/decks";
import type { BotDifficulty, GameState, Player } from "@/lib/engine/state";
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

// ---------- Opening ----------

export function pickOpeningKeep(player: Player): string[] {
  const draft = player.openingDraft ?? [];
  // Prefer high-capital (higher ceiling) cards — bot will hold cheap ones.
  const ranked = draft
    .slice()
    .sort((a, b) => investmentCapital(b) - investmentCapital(a));
  return ranked.slice(0, 3);
}

export function pickOpeningCommit(player: Player): Array<"implement" | "hold"> {
  const kept = player.openingKeptBeforeAuction ?? [];
  const budget = Math.floor(player.cash * 0.4); // don't sink more than 40% of cash into round-1 implements
  const out: Array<"implement" | "hold"> = [];
  let spent = 0;
  for (const cardId of kept) {
    const cost = investmentCapital(cardId);
    if (cost > 0 && spent + cost <= budget) {
      out.push("implement");
      spent += cost;
    } else {
      out.push("hold");
    }
  }
  return out;
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
    const payout = estimateSalePayout(state, barrel.age);
    if (payout <= cost) continue;
    const bourbonCardId =
      state.market.bourbonFaceUp ?? player.bourbonHand[0];
    if (!bourbonCardId) continue;
    scored.push({
      action: {
        t: "SELL_BOURBON",
        playerId,
        barrelId: barrel.barrelId,
        bourbonCardId,
      },
      score: payout - cost,
      reason: `sell age ${barrel.age} for ~$${payout}`,
    });
  }

  // Make bourbon: if legal mash + open slot, and demand profile is reasonable.
  if (hasLegalMash(player) && player.cash >= cost) {
    const rickhouseId = firstOpenRickhouse(state);
    if (rickhouseId) {
      const mash = pickMashFromHand(player);
      if (mash.length >= 3) {
        // Value of aging ≈ expected future sale minus expected fees.
        const score = 14 - cost - expectedFeesNextRound(state, playerId) * 0.3;
        scored.push({
          action: {
            t: "MAKE_BOURBON",
            playerId,
            rickhouseId,
            resourceInstanceIds: mash,
          },
          score,
          reason: `make bourbon at ${rickhouseId}`,
        });
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

  // Draw bourbon: useful if we have a sellable barrel but no card in hand or face-up.
  if (player.cash >= cost && !state.market.bourbonFaceUp && state.market.bourbonDeck.length > 0) {
    const sellableAges = ownedBarrels(state, playerId).filter((b) => b.barrel.age >= 2);
    if (sellableAges.length > 0 && player.bourbonHand.length === 0) {
      scored.push({
        action: { t: "DRAW_BOURBON", playerId, source: "deck" },
        score: 4 - cost,
        reason: "draw bourbon — sellable barrel waiting",
      });
    }
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

export function pickMarketMove(state: GameState, playerId: string): Action {
  // Events not yet authored; always roll.
  if (state.market.eventDeck.length === 0) {
    return { t: "ROLL_DEMAND", playerId };
  }
  // With events present: 50/50 bias toward rolling.
  return { t: "ROLL_DEMAND", playerId };
}

// Re-export for tests.
export { drawTop };
