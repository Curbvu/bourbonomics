import type {
  Card,
  GameAction,
  GameState,
  GrainSubtype,
  MashBill,
  PlayerState,
  Rickhouse,
} from "../types.js";
import { capitalUnits, resourceUnits, suppliesResource } from "../cards.js";
import { computeReward } from "../rewards.js";
import { getPlayerBarrels } from "../state.js";

// ---------------------------------------------------------------
// Heuristic bot — chooses one action for the current player.
// Action priority (highest first):
//   1. SELL_BOURBON if a saleable barrel pays well at current demand
//   2. MAKE_BOURBON if any mash bill in hand can be satisfied
//   3. AGE_BOURBON if there's an unaged-this-round barrel and a spare card
//   4. BUY_FROM_MARKET if a useful conveyor card is affordable
//   5. DRAW_MASH_BILL if mash-bill hand is empty (last resort — speeds endgame)
//   6. PASS_TURN otherwise
// ---------------------------------------------------------------

const SELL_REWARD_THRESHOLD = 3;
const SELL_PRESSURE_AGE = 6; // sell aged barrels even at low reward

export function chooseAction(state: GameState, playerId: string): GameAction {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return { type: "PASS_TURN", playerId };
  if (player.hand.length === 0) return { type: "PASS_TURN", playerId };
  if (state.phase !== "action") return { type: "PASS_TURN", playerId };

  // 1) Sell a barrel if it's worth it.
  const sale = chooseSale(state, player);
  if (sale) return sale;

  // 2) Make bourbon if possible.
  const make = chooseMakeBourbon(state, player);
  if (make) return make;

  // 3) Age a young barrel.
  const age = chooseAge(state, player);
  if (age) return age;

  // 4) Buy a useful card from the market.
  const buy = chooseBuy(state, player);
  if (buy) return buy;

  // 5) Draw a mash bill if we've run out of recipes.
  const draw = chooseDrawMashBill(state, player);
  if (draw) return draw;

  // 6) Otherwise, pass.
  return { type: "PASS_TURN", playerId };
}

// -----------------------------
// SELL_BOURBON
// -----------------------------

function chooseSale(state: GameState, player: PlayerState): GameAction | null {
  const barrels = getPlayerBarrels(state, player.id).filter((b) => b.age >= 2);
  if (barrels.length === 0) return null;

  let best: { barrelId: string; reward: number; age: number } | null = null;
  for (const b of barrels) {
    const reward = computeReward(b.attachedMashBill, b.age, state.demand);
    if (best === null || reward > best.reward) {
      best = { barrelId: b.id, reward, age: b.age };
    }
  }
  if (!best) return null;

  const finalRound = state.finalRoundTriggered;
  const passesThreshold =
    best.reward >= SELL_REWARD_THRESHOLD ||
    (best.age >= SELL_PRESSURE_AGE && best.reward > 0) ||
    (finalRound && best.reward > 0);
  if (!passesThreshold) return null;

  return {
    type: "SELL_BOURBON",
    playerId: player.id,
    barrelId: best.barrelId,
    reputationSplit: best.reward,
    cardDrawSplit: 0,
  };
}

// -----------------------------
// MAKE_BOURBON
// -----------------------------

interface ProductionPlan {
  mashBill: MashBill;
  cardIds: string[];
  rickhouse: Rickhouse;
}

function chooseMakeBourbon(state: GameState, player: PlayerState): GameAction | null {
  if (player.mashBills.length === 0) return null;
  const rickhouse = firstAvailableRickhouse(state);
  if (!rickhouse) return null;

  // Try each mash bill; pick the one with the highest peak reward whose
  // recipe we can satisfy from our current hand.
  let best: { plan: ProductionPlan; peak: number } | null = null;
  for (const mb of player.mashBills) {
    const cardIds = planProductionCards(player, mb);
    if (!cardIds) continue;
    const peak = peakReward(mb);
    if (!best || peak > best.peak) {
      best = { plan: { mashBill: mb, cardIds, rickhouse }, peak };
    }
  }
  if (!best) return null;
  return {
    type: "MAKE_BOURBON",
    playerId: player.id,
    cardIds: best.plan.cardIds,
    mashBillId: best.plan.mashBill.id,
    rickhouseId: best.plan.rickhouse.id,
  };
}

function firstAvailableRickhouse(state: GameState): Rickhouse | null {
  for (const r of state.rickhouses) {
    const used = state.allBarrels.filter((b) => b.rickhouseId === r.id).length;
    if (used < r.capacity) return r;
  }
  return null;
}

function peakReward(mb: MashBill): number {
  let max = 0;
  for (const row of mb.rewardGrid) {
    for (const cell of row) {
      if (cell !== null && cell > max) max = cell;
    }
  }
  return max;
}

/**
 * Greedy production planner. Returns the minimum card-ids that satisfy:
 *   - 1 cask source
 *   - 1+ corn (or recipe.minCorn)
 *   - per-grain minimums
 *   - total grain >= 1
 *   - max constraints (e.g. maxRye=0 means recipe forbids rye)
 * Returns null if the hand can't satisfy the recipe.
 */
function planProductionCards(player: PlayerState, mb: MashBill): string[] | null {
  const recipe = mb.recipe ?? {};
  const minCorn = Math.max(1, recipe.minCorn ?? 0);
  const minRye = recipe.minRye ?? 0;
  const minBarley = recipe.minBarley ?? 0;
  const minWheat = recipe.minWheat ?? 0;
  const maxRye = recipe.maxRye ?? Infinity;
  const maxWheat = recipe.maxWheat ?? Infinity;

  const used = new Set<string>();

  // 1 cask
  const cask = player.hand.find((c) => suppliesResource(c, "cask"));
  if (!cask) return null;
  used.add(cask.id);

  // Gather corn cards (greedy, smallest resourceCount first to conserve big cards)
  const cornCards = takeBySubtype(player.hand, "corn", minCorn, used);
  if (cornCards === null) return null;

  // Gather grain cards per recipe minimums
  const ryeCards = takeBySubtype(player.hand, "rye", minRye, used);
  if (ryeCards === null) return null;

  const barleyCards = takeBySubtype(player.hand, "barley", minBarley, used);
  if (barleyCards === null) return null;

  const wheatCards = takeBySubtype(player.hand, "wheat", minWheat, used);
  if (wheatCards === null) return null;

  // Universal: total grain >= 1 (might already be satisfied by recipe minimums)
  let totalGrain =
    sumUnits(ryeCards, "rye") + sumUnits(barleyCards, "barley") + sumUnits(wheatCards, "wheat");
  const extras: Card[] = [];
  if (totalGrain < 1) {
    // Need any 1 grain — prefer one not forbidden by maxRye/maxWheat
    const candidates: GrainSubtype[] = ["rye", "barley", "wheat"];
    let added = false;
    for (const sub of candidates) {
      if (sub === "rye" && maxRye === 0) continue;
      if (sub === "wheat" && maxWheat === 0) continue;
      const taken = takeBySubtype(player.hand, sub, 1, used);
      if (taken && taken.length > 0) {
        extras.push(...taken);
        totalGrain += sumUnits(taken, sub);
        added = true;
        break;
      }
    }
    if (!added) return null;
  }

  // Verify max constraints aren't already violated by recipe-pinned picks
  if (sumUnits(ryeCards, "rye") > maxRye) return null;
  if (sumUnits(wheatCards, "wheat") > maxWheat) return null;

  return [
    cask.id,
    ...cornCards.map((c) => c.id),
    ...ryeCards.map((c) => c.id),
    ...barleyCards.map((c) => c.id),
    ...wheatCards.map((c) => c.id),
    ...extras.map((c) => c.id),
  ];
}

/**
 * Greedy: take cards of a given subtype until the cumulative unit count meets
 * `minUnits`. Returns the cards taken (and adds their ids to `used`), or
 * `null` if there aren't enough units in hand.
 */
function takeBySubtype(
  hand: Card[],
  subtype: "cask" | "corn" | GrainSubtype,
  minUnits: number,
  used: Set<string>,
): Card[] | null {
  if (minUnits <= 0) return [];
  const taken: Card[] = [];
  let count = 0;
  // Smallest-first so big premium cards stay in hand for future plays.
  const candidates = hand
    .filter((c) => !used.has(c.id) && c.subtype === subtype)
    .sort((a, b) => (a.resourceCount ?? 1) - (b.resourceCount ?? 1));
  for (const c of candidates) {
    taken.push(c);
    used.add(c.id);
    count += c.resourceCount ?? 1;
    if (count >= minUnits) break;
  }
  return count >= minUnits ? taken : null;
}

function sumUnits(cards: Card[], subtype: "cask" | "corn" | GrainSubtype): number {
  let n = 0;
  for (const c of cards) n += resourceUnits(c, subtype);
  return n;
}

// -----------------------------
// AGE_BOURBON
// -----------------------------

function chooseAge(state: GameState, player: PlayerState): GameAction | null {
  const barrels = getPlayerBarrels(state, player.id).filter(
    (b) => !b.agedThisRound && b.age < SELL_PRESSURE_AGE,
  );
  if (barrels.length === 0) return null;

  // Pick the cheapest card to commit (prefer 1-capital, then any single resource).
  const card =
    player.hand.find((c) => c.type === "capital" && (c.capitalValue ?? 1) === 1) ??
    player.hand.find((c) => (c.resourceCount ?? 1) === 1) ??
    player.hand[0];
  if (!card) return null;

  return {
    type: "AGE_BOURBON",
    playerId: player.id,
    barrelId: barrels[0]!.id,
    cardId: card.id,
  };
}

// -----------------------------
// BUY_FROM_MARKET
// -----------------------------

function chooseBuy(state: GameState, player: PlayerState): GameAction | null {
  const totalCapital = player.hand.reduce((acc, c) => acc + capitalUnits(c), 0);
  if (totalCapital === 0) return null;

  // Look for the highest-value card we can afford.
  let best: { slotIndex: number; cost: number } | null = null;
  for (let i = 0; i < state.marketConveyor.length; i++) {
    const card = state.marketConveyor[i]!;
    const cost = card.cost ?? 1;
    if (cost > totalCapital) continue;
    // Prefer 2-cost premium cards over 1-cost duplicates of what we already have.
    if (!best || cost > best.cost) best = { slotIndex: i, cost };
  }
  if (!best) return null;

  // Pay using the smallest combination of capital cards meeting the cost.
  const capitalCards = player.hand
    .filter((c) => c.type === "capital")
    .sort((a, b) => (a.capitalValue ?? 1) - (b.capitalValue ?? 1));
  const spend: string[] = [];
  let paid = 0;
  for (const c of capitalCards) {
    spend.push(c.id);
    paid += capitalUnits(c);
    if (paid >= best.cost) break;
  }
  if (paid < best.cost) return null;

  return {
    type: "BUY_FROM_MARKET",
    playerId: player.id,
    marketSlotIndex: best.slotIndex,
    spendCardIds: spend,
  };
}

// -----------------------------
// DRAW_MASH_BILL
// -----------------------------

function chooseDrawMashBill(state: GameState, player: PlayerState): GameAction | null {
  if (player.mashBills.length > 0) return null;
  if (state.bourbonDeck.length === 0) return null;
  // Prefer to spend the lowest-value capital card.
  const spendCard =
    player.hand.find((c) => c.type === "capital" && (c.capitalValue ?? 1) === 1) ??
    player.hand[0];
  if (!spendCard) return null;
  return {
    type: "DRAW_MASH_BILL",
    playerId: player.id,
    spendCardId: spendCard.id,
  };
}
