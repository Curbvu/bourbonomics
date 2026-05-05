import type {
  Card,
  Distillery,
  GameAction,
  GameState,
  GrainSubtype,
  MashBill,
  OperationsCard,
  PlayerState,
  RickhouseSlot,
} from "../types";
import { isWheatedBill } from "../types";
import { capitalUnits, resourceUnits, suppliesResource } from "../cards";
import { computeReward } from "../rewards";
import { emptySlotsFor, getPlayerBarrels, playerRickhouseFull } from "../state";

// ---------------------------------------------------------------
// Heuristic bot.
//
// Distillery-selection phase: pick the next distillery in pool order,
// ranked by a tiny preference table.
//
// Action phase priority (highest first):
//   0. RUSH_TO_MARKET if there's a forced rush pending.
//   1. PLAY_OPERATIONS_CARD if a high-value play is obvious.
//   2. SELL_BOURBON if a saleable barrel pays well at current demand.
//   3. MAKE_BOURBON if any mash bill in hand can be satisfied.
//   4. AGE_BOURBON if there's an unaged-this-round barrel and a spare card.
//   5. RUSH_TO_MARKET on a 1yo barrel if rickhouse is full.
//   6. BUY_FROM_MARKET if a useful conveyor card is affordable.
//   7. DRAW_MASH_BILL if mash-bill hand is empty (last resort — speeds endgame).
//   8. PASS_TURN otherwise.
// ---------------------------------------------------------------

const SELL_REWARD_THRESHOLD = 3;
const SELL_PRESSURE_AGE = 6; // sell aged barrels even at low reward

export function chooseAction(state: GameState, playerId: string): GameAction {
  // Setup phase: distillery picks come through the runner, but expose a helper.
  if (state.phase === "distillery_selection") {
    return chooseDistilleryAction(state, playerId);
  }

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return { type: "PASS_TURN", playerId };
  if (state.phase !== "action") return { type: "PASS_TURN", playerId };

  // 0) Resolve a forced rush before anything else — it's mandatory.
  if (player.pendingRushBarrelId) {
    const barrel = state.allBarrels.find((b) => b.id === player.pendingRushBarrelId);
    if (barrel) {
      return { type: "RUSH_TO_MARKET", playerId, barrelId: barrel.id };
    }
    // Stale pointer — clear by passing.
    return { type: "PASS_TURN", playerId };
  }

  if (player.hand.length === 0 && player.operationsHand.length === 0) {
    return { type: "PASS_TURN", playerId };
  }

  // 1) Play an obviously-valuable ops card.
  const opsPlay = chooseOpsPlay(state, player);
  if (opsPlay) return opsPlay;

  if (player.hand.length === 0) {
    return { type: "PASS_TURN", playerId };
  }

  // 2) Sell a barrel if it's worth it.
  const sale = chooseSale(state, player);
  if (sale) return sale;

  // 3) Make bourbon if possible.
  const make = chooseMakeBourbon(state, player);
  if (make) return make;

  // 4) Age a young barrel.
  const age = chooseAge(state, player);
  if (age) return age;

  // 5) Voluntary Rush to Market when the rickhouse is locked up by 1yos.
  const rush = chooseVoluntaryRush(state, player);
  if (rush) return rush;

  // 6) Buy a useful card from the market.
  const buy = chooseBuy(state, player);
  if (buy) return buy;

  // 7) Draw a mash bill if we've run out of recipes.
  const draw = chooseDrawMashBill(state, player);
  if (draw) return draw;

  return { type: "PASS_TURN", playerId };
}

// -----------------------------
// Distillery selection
// -----------------------------

const DISTILLERY_PREFERENCE: Distillery["bonus"][] = [
  "warehouse",      // capacity is always useful
  "old_line",       // bonded slots are inviolable
  "broker",         // free trade is high-value when player count is high
  "high_rye",       // a free 2-rye accelerates rye strategies
  "wheated_baron",  // fine in the right meta
  "vanilla",        // last resort
];

export function chooseDistillery(state: GameState, playerId: string): GameAction {
  return chooseDistilleryAction(state, playerId);
}

function chooseDistilleryAction(state: GameState, playerId: string): GameAction {
  // Whatever the cursor is, we still emit on behalf of the requested player —
  // the validator will reject if it's not their turn. The runner is expected
  // to ask only the on-the-clock player.
  let best: Distillery | null = null;
  let bestRank = Infinity;
  for (const d of state.distilleryPool) {
    const rank = DISTILLERY_PREFERENCE.indexOf(d.bonus);
    const effective = rank === -1 ? DISTILLERY_PREFERENCE.length : rank;
    if (effective < bestRank) {
      bestRank = effective;
      best = d;
    }
  }
  if (!best) {
    // Pool empty — nothing legal; emit a select that will fail validation.
    return { type: "SELECT_DISTILLERY", playerId, distilleryId: "none" };
  }
  return { type: "SELECT_DISTILLERY", playerId, distilleryId: best.id };
}

// -----------------------------
// Operations card decisions
// -----------------------------

function isPlayableOps(state: GameState, card: OperationsCard): boolean {
  if (state.finalRoundTriggered && card.drawnInRound >= state.round) return false;
  return true;
}

function chooseOpsPlay(state: GameState, player: PlayerState): GameAction | null {
  const playable = player.operationsHand.filter((c) => isPlayableOps(state, c));
  if (playable.length === 0) return null;

  // Demand Surge: play right before a sale, not gratuitously.
  // Heuristic: if we plan to sell this turn AND we're not already protected, surge first.
  const surge = playable.find((c) => c.defId === "demand_surge");
  if (surge && !player.demandSurgeActive) {
    const sale = chooseSale(state, player);
    if (sale && sale.type === "SELL_BOURBON") {
      return {
        type: "PLAY_OPERATIONS_CARD",
        playerId: player.id,
        cardId: surge.id,
        defId: "demand_surge",
      };
    }
  }

  // Market Manipulation: nudge demand toward where our best aged barrel scores well.
  const mm = playable.find((c) => c.defId === "market_manipulation");
  if (mm) {
    const direction = chooseDemandDirection(state, player);
    if (direction) {
      return {
        type: "PLAY_OPERATIONS_CARD",
        playerId: player.id,
        cardId: mm.id,
        defId: "market_manipulation",
        direction,
      };
    }
  }

  // Rushed Shipment: speed up our oldest unaged barrel if we're aiming for a band threshold.
  const rs = playable.find((c) => c.defId === "rushed_shipment");
  if (rs) {
    const myBarrels = getPlayerBarrels(state, player.id);
    const target = myBarrels.find((b) => b.age >= 1 && b.extraAgesAvailable === 0);
    if (target) {
      return {
        type: "PLAY_OPERATIONS_CARD",
        playerId: player.id,
        cardId: rs.id,
        defId: "rushed_shipment",
        targetBarrelId: target.id,
      };
    }
  }

  // Market Corner: only if there's a high-value premium we can't otherwise afford.
  const mc = playable.find((c) => c.defId === "market_corner");
  if (mc) {
    const totalCapital = player.hand.reduce((acc, c) => acc + capitalUnits(c), 0);
    let bestSlot = -1;
    let bestCost = 0;
    for (let i = 0; i < state.marketConveyor.length; i++) {
      const card = state.marketConveyor[i]!;
      const cost = card.cost ?? 1;
      if (cost > totalCapital && cost > bestCost) {
        bestCost = cost;
        bestSlot = i;
      }
    }
    if (bestSlot >= 0) {
      return {
        type: "PLAY_OPERATIONS_CARD",
        playerId: player.id,
        cardId: mc.id,
        defId: "market_corner",
        marketSlotIndex: bestSlot,
      };
    }
  }

  // Regulatory Inspection: target an opponent's most-aged upper-tier barrel.
  const ri = playable.find((c) => c.defId === "regulatory_inspection");
  if (ri) {
    let targetId: string | null = null;
    let bestAge = 0;
    for (const b of state.allBarrels) {
      if (b.ownerId === player.id) continue;
      if (b.inspectedThisRound) continue;
      const owner = state.players.find((p) => p.id === b.ownerId)!;
      const slot = owner.rickhouseSlots.find((s) => s.id === b.slotId);
      if (!slot || slot.tier !== "upper") continue;
      if (b.age >= bestAge) {
        bestAge = b.age;
        targetId = b.id;
      }
    }
    if (targetId) {
      return {
        type: "PLAY_OPERATIONS_CARD",
        playerId: player.id,
        cardId: ri.id,
        defId: "regulatory_inspection",
        targetBarrelId: targetId,
      };
    }
  }

  // Distressed Sale Notice: target an opponent with a full rickhouse holding a 1yo barrel.
  const dsn = playable.find((c) => c.defId === "distressed_sale_notice");
  if (dsn) {
    for (const opp of state.players) {
      if (opp.id === player.id) continue;
      if (!playerRickhouseFull(state, opp.id)) continue;
      const oneYear = state.allBarrels.find((b) => b.ownerId === opp.id && b.age === 1);
      if (oneYear) {
        return {
          type: "PLAY_OPERATIONS_CARD",
          playerId: player.id,
          cardId: dsn.id,
          defId: "distressed_sale_notice",
          targetPlayerId: opp.id,
          targetBarrelId: oneYear.id,
        };
      }
    }
  }

  // Blend: only if we have two underperforming non-bonded barrels.
  const bl = playable.find((c) => c.defId === "blend");
  if (bl) {
    const myBarrels = getPlayerBarrels(state, player.id).filter((b) => {
      const slot = player.rickhouseSlots.find((s) => s.id === b.slotId);
      return slot?.tier === "upper";
    });
    if (myBarrels.length >= 2) {
      return {
        type: "PLAY_OPERATIONS_CARD",
        playerId: player.id,
        cardId: bl.id,
        defId: "blend",
        barrel1Id: myBarrels[0]!.id,
        barrel2Id: myBarrels[1]!.id,
      };
    }
  }

  // Barrel Broker is omitted — needs cross-player negotiation we don't model.

  return null;
}

function chooseDemandDirection(state: GameState, player: PlayerState): "up" | "down" | null {
  // Pick whichever direction increases the reward for our best barrel.
  const barrels = getPlayerBarrels(state, player.id).filter((b) => b.age >= 2);
  if (barrels.length === 0) return null;
  let bestDelta = 0;
  let direction: "up" | "down" | null = null;
  for (const b of barrels) {
    const cur = computeReward(b.attachedMashBill, b.age, state.demand);
    const up = computeReward(b.attachedMashBill, b.age, Math.min(12, state.demand + 1));
    const down = computeReward(b.attachedMashBill, b.age, Math.max(0, state.demand - 1));
    if (up - cur > bestDelta) {
      bestDelta = up - cur;
      direction = "up";
    }
    if (down - cur > bestDelta) {
      bestDelta = down - cur;
      direction = "down";
    }
  }
  return direction;
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
  slotId: string;
}

function chooseMakeBourbon(state: GameState, player: PlayerState): GameAction | null {
  if (player.mashBills.length === 0) return null;
  const slotId = pickSlot(state, player);
  if (!slotId) return null;

  let best: { plan: ProductionPlan; peak: number } | null = null;
  for (const mb of player.mashBills) {
    const cardIds = planProductionCards(player, mb);
    if (!cardIds) continue;
    const peak = peakReward(mb);
    if (!best || peak > best.peak) {
      best = { plan: { mashBill: mb, cardIds, slotId }, peak };
    }
  }
  if (!best) return null;
  return {
    type: "MAKE_BOURBON",
    playerId: player.id,
    cardIds: best.plan.cardIds,
    mashBillId: best.plan.mashBill.id,
    slotId: best.plan.slotId,
  };
}

function pickSlot(state: GameState, player: PlayerState): string | null {
  const empties = emptySlotsFor(state, player.id);
  if (empties.length === 0) return null;
  // Prefer bonded slots (inviolable) when there's a choice.
  const bondedFirst = empties.sort((a, b) => {
    const aBonded = isBondedSlot(player.rickhouseSlots, a) ? 0 : 1;
    const bBonded = isBondedSlot(player.rickhouseSlots, b) ? 0 : 1;
    return aBonded - bBonded;
  });
  return bondedFirst[0]!;
}

function isBondedSlot(slots: RickhouseSlot[], slotId: string): boolean {
  const s = slots.find((x) => x.id === slotId);
  return s?.tier === "bonded";
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

function planProductionCards(player: PlayerState, mb: MashBill): string[] | null {
  const recipe = mb.recipe ?? {};
  const minCorn = Math.max(1, recipe.minCorn ?? 0);
  const minRye = recipe.minRye ?? 0;
  const minBarley = recipe.minBarley ?? 0;
  // Apply Wheated Baron discount when applicable.
  let minWheat = recipe.minWheat ?? 0;
  if (player.distillery?.bonus === "wheated_baron" && isWheatedBill(mb)) {
    minWheat = Math.max(0, minWheat - 1);
  }
  const maxRye = recipe.maxRye ?? Infinity;
  const maxWheat = recipe.maxWheat ?? Infinity;

  const used = new Set<string>();

  const cask = player.hand.find((c) => suppliesResource(c, "cask"));
  if (!cask) return null;
  used.add(cask.id);

  const cornCards = takeBySubtype(player.hand, "corn", minCorn, used);
  if (cornCards === null) return null;

  const ryeCards = takeBySubtype(player.hand, "rye", minRye, used);
  if (ryeCards === null) return null;
  const barleyCards = takeBySubtype(player.hand, "barley", minBarley, used);
  if (barleyCards === null) return null;
  const wheatCards = takeBySubtype(player.hand, "wheat", minWheat, used);
  if (wheatCards === null) return null;

  let totalGrain =
    sumUnits(ryeCards, "rye") + sumUnits(barleyCards, "barley") + sumUnits(wheatCards, "wheat");
  const extras: Card[] = [];
  if (totalGrain < 1) {
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

function takeBySubtype(
  hand: Card[],
  subtype: "cask" | "corn" | GrainSubtype,
  minUnits: number,
  used: Set<string>,
): Card[] | null {
  if (minUnits <= 0) return [];
  const taken: Card[] = [];
  let count = 0;
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
    (b) =>
      !b.inspectedThisRound &&
      (!b.agedThisRound || b.extraAgesAvailable > 0) &&
      b.age < SELL_PRESSURE_AGE,
  );
  if (barrels.length === 0) return null;

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
// RUSH_TO_MARKET (voluntary)
// -----------------------------

function chooseVoluntaryRush(state: GameState, player: PlayerState): GameAction | null {
  if (!playerRickhouseFull(state, player.id)) return null;
  const oneYear = getPlayerBarrels(state, player.id).find((b) => b.age === 1);
  if (!oneYear) return null;
  return { type: "RUSH_TO_MARKET", playerId: player.id, barrelId: oneYear.id };
}

// -----------------------------
// BUY_FROM_MARKET
// -----------------------------

function chooseBuy(state: GameState, player: PlayerState): GameAction | null {
  const totalCapital = player.hand.reduce((acc, c) => acc + capitalUnits(c), 0);
  if (totalCapital === 0) return null;

  let best: { slotIndex: number; cost: number } | null = null;
  for (let i = 0; i < state.marketConveyor.length; i++) {
    const card = state.marketConveyor[i]!;
    const cost = card.cost ?? 1;
    if (cost > totalCapital) continue;
    if (!best || cost > best.cost) best = { slotIndex: i, cost };
  }
  if (!best) return null;

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
