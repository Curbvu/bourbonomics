import type {
  Card,
  Distillery,
  GameAction,
  GameState,
  GrainSubtype,
  MashBill,
  OperationsCard,
  PlayerState,
} from "../types";
import { isWheatedBill } from "../types";
import { capitalUnits, resourceUnits, suppliesResource } from "../cards";
import { computeCompositionBuffs } from "../composition";
import { computeReward } from "../rewards";
import { emptySlotsFor, getPlayerBarrels } from "../state";

const RICKHOUSE_SLOT_HARD_CAP = 6;

// ---------------------------------------------------------------
// Heuristic bot.
//
// Distillery-selection phase: pick the next distillery in pool order,
// ranked by a tiny preference table.
//
// Action phase priority (highest first). Under v2.2 the active player
// takes their full sequence of actions in one turn — `chooseAction` is
// invoked repeatedly by the runner until the bot returns PASS_TURN.
// Picking the highest-value action available, executing it, and then
// re-evaluating the new state implements a greedy turn planner without
// any explicit lookahead.
//
//   1. PLAY_OPERATIONS_CARD if a high-value play is obvious.
//   2. SELL_BOURBON before MARKET buys — sale proceeds can fund a buy.
//   3. MAKE_BOURBON if any mash bill in hand can be satisfied.
//   4. AGE_BOURBON if there's an unaged-this-round barrel and a spare card.
//   5. BUY_FROM_MARKET if a useful conveyor card is affordable.
//   6. BUY_OPERATIONS_CARD if a face-up ops card looks worthwhile.
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
  if (state.phase === "starter_deck_draft") {
    return chooseStarterPassAction(playerId);
  }

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return { type: "PASS_TURN", playerId };
  if (state.phase !== "action") return { type: "PASS_TURN", playerId };

  if (player.hand.length === 0 && player.operationsHand.length === 0) {
    return { type: "PASS_TURN", playerId };
  }

  // 1) Operations cards are pending future release — bots don't play
  //    them and don't buy them. (Card pool still mints them so the
  //    market chrome stays consistent; just nothing interacts.)
  // const opsPlay = chooseOpsPlay(state, player);
  // if (opsPlay) return opsPlay;

  if (player.hand.length === 0) {
    return { type: "PASS_TURN", playerId };
  }

  // 2) Sell a barrel if it's worth it. Sales come BEFORE buys so the
  //    fresh purchasing-power split (cards drawn on sale) can fund a
  //    follow-up market buy on the same turn.
  const sale = chooseSale(state, player);
  if (sale) return sale;

  // 3) Make bourbon if possible.
  const make = chooseMakeBourbon(state, player);
  if (make) return make;

  // 4) Age a young barrel.
  const age = chooseAge(state, player);
  if (age) return age;

  // 5) Buy a useful card from the market.
  const buy = chooseBuy(state, player);
  if (buy) return buy;

  // 6) Ops buying disabled — pending future release.
  // const buyOps = chooseBuyOpsCard(state, player);
  // if (buyOps) return buyOps;

  // 7) Draw a mash bill if we've run out of recipes.
  const draw = chooseDrawMashBill(state, player);
  if (draw) return draw;

  return { type: "PASS_TURN", playerId };
}

// -----------------------------
// Distillery selection
// -----------------------------

const DISTILLERY_PREFERENCE: Distillery["bonus"][] = [
  "high_rye",       // pre-aged + 2 free 2-rye + bill bonus
  "wheated_baron",  // pre-aged + lower single-grain threshold
  "connoisseur",    // diversified scoring; harder to pilot
  "vanilla",        // last resort
];

export function chooseDistillery(state: GameState, playerId: string): GameAction {
  return chooseDistilleryAction(state, playerId);
}

export function chooseStarterPass(playerId: string): GameAction {
  return chooseStarterPassAction(playerId);
}

function chooseStarterPassAction(playerId: string): GameAction {
  // v2.4: bots accept their dealt hand as-is and pass the trade window.
  // Smart trading + safety-valve usage will land in Change 6.
  return { type: "STARTER_PASS", playerId };
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

  // Regulatory Inspection: target an opponent's most-aged barrel.
  const ri = playable.find((c) => c.defId === "regulatory_inspection");
  if (ri) {
    let targetId: string | null = null;
    let bestAge = 0;
    for (const b of state.allBarrels) {
      if (b.ownerId === player.id) continue;
      if (b.inspectedThisRound) continue;
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

  // Blend: combine any two of our barrels.
  const bl = playable.find((c) => c.defId === "blend");
  if (bl) {
    const myBarrels = getPlayerBarrels(state, player.id);
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

  // ── New v2.2.x ops cards ──────────────────────────────────────────

  // Bourbon Boom: same trigger as Market Manipulation up — a saleable
  // barrel benefits from higher demand.
  const boom = playable.find((c) => c.defId === "bourbon_boom");
  if (boom) {
    const direction = chooseDemandDirection(state, player);
    if (direction === "up") {
      return {
        type: "PLAY_OPERATIONS_CARD",
        playerId: player.id,
        cardId: boom.id,
        defId: "bourbon_boom",
      };
    }
  }

  // Glut: only useful if pushing demand DOWN helps us (e.g. a low-band
  // bill we plan to sell into). Same heuristic as Market Manipulation
  // down.
  const glut = playable.find((c) => c.defId === "glut");
  if (glut) {
    const direction = chooseDemandDirection(state, player);
    if (direction === "down") {
      return {
        type: "PLAY_OPERATIONS_CARD",
        playerId: player.id,
        cardId: glut.id,
        defId: "glut",
      };
    }
  }

  // Insider Buyer: refresh the conveyor when at least one card is too
  // expensive AND we're not blocked on capital.
  const ib = playable.find((c) => c.defId === "insider_buyer");
  if (ib) {
    const totalCapital = player.hand.reduce((acc, c) => acc + capitalUnits(c), 0);
    const cheapestVisible = state.marketConveyor.reduce(
      (lo, c) => Math.min(lo, c.cost ?? 1),
      Infinity,
    );
    if (totalCapital >= cheapestVisible) {
      return {
        type: "PLAY_OPERATIONS_CARD",
        playerId: player.id,
        cardId: ib.id,
        defId: "insider_buyer",
      };
    }
  }

  // Kentucky Connection: free draws are always good while we can use
  // them — fire it if our hand has room (under handSize).
  const kc = playable.find((c) => c.defId === "kentucky_connection");
  if (kc && player.hand.length < player.handSize) {
    return {
      type: "PLAY_OPERATIONS_CARD",
      playerId: player.id,
      cardId: kc.id,
      defId: "kentucky_connection",
    };
  }

  // Bottling Run: helps everyone but us first — fire when our hand is
  // small (we benefit relatively most when behind on cards).
  const br = playable.find((c) => c.defId === "bottling_run");
  if (br && player.hand.length <= 3) {
    return {
      type: "PLAY_OPERATIONS_CARD",
      playerId: player.id,
      cardId: br.id,
      defId: "bottling_run",
    };
  }

  // Cash Out: convert junk grain to capital when our hand is mostly
  // resources we won't use this round.
  const co = playable.find((c) => c.defId === "cash_out");
  if (co) {
    const resourceCount = player.hand.filter((c) => c.type === "resource").length;
    const capitalCount = player.hand.filter((c) => c.type === "capital").length;
    if (resourceCount >= 3 && capitalCount === 0) {
      return {
        type: "PLAY_OPERATIONS_CARD",
        playerId: player.id,
        cardId: co.id,
        defId: "cash_out",
      };
    }
  }

  // Allocation: free mash bills are always strong if we have at least
  // one open slot AND the bourbon deck has cards. v2.6: bills land
  // directly in slots, so the trigger is "we have room to receive".
  const al = playable.find((c) => c.defId === "allocation");
  if (al && state.bourbonDeck.length > 0 && emptySlotsFor(state, player.id).length > 0) {
    return {
      type: "PLAY_OPERATIONS_CARD",
      playerId: player.id,
      cardId: al.id,
      defId: "allocation",
    };
  }

  // Rickhouse Expansion Permit: take it whenever we're not already at
  // the cap and our rickhouse is currently full (slot pressure). The
  // distillery may impose a stricter cap (Broker = 4).
  const rep = playable.find((c) => c.defId === "rickhouse_expansion_permit");
  const slotCap = player.distillery?.maxSlots ?? RICKHOUSE_SLOT_HARD_CAP;
  if (rep && player.rickhouseSlots.length < slotCap) {
    const occupied = state.allBarrels.filter((b) => b.ownerId === player.id).length;
    if (occupied >= player.rickhouseSlots.length) {
      return {
        type: "PLAY_OPERATIONS_CARD",
        playerId: player.id,
        cardId: rep.id,
        defId: "rickhouse_expansion_permit",
      };
    }
  }

  return null;
}

function chooseDemandDirection(state: GameState, player: PlayerState): "up" | "down" | null {
  // Pick whichever direction increases the reward for our best barrel.
  const barrels = getPlayerBarrels(state, player.id).filter(
    (b) => b.phase === "aging" && b.attachedMashBill && b.age >= 2,
  );
  if (barrels.length === 0) return null;
  let bestDelta = 0;
  let direction: "up" | "down" | null = null;
  for (const b of barrels) {
    const bill = b.attachedMashBill!;
    const cur = computeReward(bill, b.age, state.demand);
    const up = computeReward(bill, b.age, Math.min(12, state.demand + 1));
    const down = computeReward(bill, b.age, Math.max(0, state.demand - 1));
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
  const barrels = getPlayerBarrels(state, player.id).filter(
    (b) => b.phase === "aging" && b.age >= 2,
  );
  if (barrels.length === 0) return null;
  // v2.7.1: selling costs 1 card from hand. If hand is empty, no sale
  // is possible — bail rather than emit an illegal action.
  const spendable = pickSellSpendCard(player);
  if (!spendable) return null;

  let best:
    | { barrelId: string; reward: number; age: number; bill: MashBill }
    | null = null;
  for (const b of barrels) {
    // v2.4: include composition's bonus reputation in the EV — a 5-rep
    // grid sale that also fires cask_3 + all_grains is worth +3 more.
    const composition = computeCompositionBuffs(b, player.distillery);
    const bill = b.attachedMashBill;
    const grid = computeReward(bill, b.age, state.demand, {
      demandBandOffset: b.demandBandOffset + composition.gridDemandBandOffset,
      gridRepOffset: b.gridRepOffset,
    });
    const evReward = grid + composition.bonusRep;
    if (best === null || evReward > best.reward) {
      best = { barrelId: b.id, reward: grid, age: b.age, bill };
    }
  }
  if (!best) return null;

  const finalRound = state.finalRoundTriggered;
  const passesThreshold =
    best.reward >= SELL_REWARD_THRESHOLD ||
    (best.age >= SELL_PRESSURE_AGE && best.reward > 0) ||
    (finalRound && best.reward > 0);
  if (!passesThreshold) return null;

  // v2.6 Gold-award choice. The bot's preference order:
  //   1. Convert into the highest-peak slot we own whose committed
  //      cards already satisfy the Gold bill's recipe (free upgrade).
  //   2. Keep — bill stays in the now-empty slot for re-use.
  //   3. (Decline only if neither above applies, which currently never
  //      happens since "keep" is always legal.)
  let goldChoice: "convert" | "keep" | "decline" | undefined;
  let goldConvertTargetSlotId: string | undefined;
  const goldEligible =
    best.bill.goldAward != null &&
    best.bill.goldAward.minAge !== undefined &&
    best.age >= (best.bill.goldAward.minAge ?? 0) &&
    state.demand >= (best.bill.goldAward.minDemand ?? 0) &&
    best.reward >= (best.bill.goldAward.minReward ?? 0);
  if (goldEligible) {
    const convertTarget = pickGoldConvertTarget(state, player, best.barrelId, best.bill);
    if (convertTarget) {
      goldChoice = "convert";
      goldConvertTargetSlotId = convertTarget;
    } else {
      goldChoice = "keep";
    }
  }

  return {
    type: "SELL_BOURBON",
    playerId: player.id,
    barrelId: best.barrelId,
    reputationSplit: best.reward,
    cardDrawSplit: 0,
    spendCardId: spendable.id,
    ...(goldChoice ? { goldChoice } : {}),
    ...(goldConvertTargetSlotId ? { goldConvertTargetSlotId } : {}),
  };
}

/**
 * v2.7.1 sell cost: pick the cheapest possible card from hand to spend
 * on the sell action. Prefers the lowest-value capital, then a plain
 * resource. Premium variants and high-value capitals are saved for
 * production / market buys.
 */
function pickSellSpendCard(player: PlayerState): Card | null {
  if (player.hand.length === 0) return null;
  const eligible = player.hand.filter(
    (c) => c.type === "resource" || c.type === "capital",
  );
  if (eligible.length === 0) return null;
  // Cost-to-keep heuristic: prefer plain $1 capitals, then plain
  // (non-premium) resources, then premium resources, then high-value
  // capitals. Sort ascending by that score and grab the cheapest.
  const score = (c: Card): number => {
    if (c.type === "capital") return c.capitalValue ?? 1; // $1 < $3 < $5
    return c.premium ? 10 : 5; // plain resource (5) before premium (10)
  };
  return eligible.slice().sort((a, b) => score(a) - score(b))[0]!;
}

/**
 * v2.6 Gold Convert target picker. Walks the seller's other slots and
 * finds one whose currently-committed cards already satisfy the Gold
 * bill's recipe. Returns the slot id with the highest current peak
 * (most upside from being relabeled with a Gold recipe), or null if
 * no slot qualifies.
 */
function pickGoldConvertTarget(
  state: GameState,
  player: PlayerState,
  sellingBarrelId: string,
  goldBill: MashBill,
): string | null {
  const candidates = state.allBarrels.filter(
    (b) => b.id !== sellingBarrelId && b.ownerId === player.id,
  );
  let best: { slotId: string; existingPeak: number } | null = null;
  for (const b of candidates) {
    if (!recipeSatisfiedByPile(player, goldBill, b.productionCards)) continue;
    const existingPeak = peakReward(b.attachedMashBill);
    if (!best || existingPeak < best.existingPeak) {
      // We want to OVERWRITE the lowest-peak existing bill — that's
      // the slot where converting to Gold gives the biggest upside.
      best = { slotId: b.slotId, existingPeak };
    }
  }
  return best?.slotId ?? null;
}

/**
 * Predicate: does `pile` satisfy `bill`'s recipe under the universal
 * rules? Mirrors the engine's check in sell-bourbon.ts.
 */
function recipeSatisfiedByPile(
  player: PlayerState,
  bill: MashBill,
  pile: Card[],
): boolean {
  const recipe = bill.recipe ?? {};
  let cask = 0,
    corn = 0,
    rye = 0,
    barley = 0,
    wheat = 0;
  for (const c of pile) {
    if (c.type !== "resource") continue;
    if (c.subtype === "cask") cask += c.resourceCount ?? 1;
    if (c.subtype === "corn") corn += c.resourceCount ?? 1;
    if (c.subtype === "rye") rye += c.resourceCount ?? 1;
    if (c.subtype === "barley") barley += c.resourceCount ?? 1;
    if (c.subtype === "wheat") wheat += c.resourceCount ?? 1;
  }
  const minCorn = Math.max(1, recipe.minCorn ?? 0);
  let minWheat = recipe.minWheat ?? 0;
  if (player.distillery?.bonus === "wheated_baron" && isWheatedBill(bill)) {
    minWheat = Math.max(0, minWheat - 1);
  }
  if (cask !== 1) return false;
  if (corn < minCorn) return false;
  if (rye < (recipe.minRye ?? 0)) return false;
  if (barley < (recipe.minBarley ?? 0)) return false;
  if (wheat < minWheat) return false;
  if (recipe.maxRye !== undefined && rye > recipe.maxRye) return false;
  if (recipe.maxWheat !== undefined && wheat > recipe.maxWheat) return false;
  const grain = rye + barley + wheat;
  if (grain < Math.max(recipe.minTotalGrain ?? 0, 1)) return false;
  return true;
}

// -----------------------------
// MAKE_BOURBON  (v2.6 slot-bound bills)
// -----------------------------

/**
 * Bot strategy: bills live on slots already, so MAKE_BOURBON only
 * commits cards. Prefer the slot closest to completion (most cards
 * already committed); fall back to a "ready" slot whose bill we can
 * meaningfully advance with our current hand.
 *
 * Greedy and deliberately simple — the user explicitly asked us not
 * to over-engineer the v1 heuristic. Tune later.
 */
function chooseMakeBourbon(state: GameState, player: PlayerState): GameAction | null {
  const myBarrels = getPlayerBarrels(state, player.id);
  const candidates = myBarrels.filter(
    (b) => b.phase === "ready" || b.phase === "construction",
  );
  // Construction-phase first (closer to completion), then ready slots
  // ranked by their bill's peak reward.
  candidates.sort((a, b) => {
    if (a.phase !== b.phase) return a.phase === "construction" ? -1 : 1;
    if (a.phase === "construction") {
      return b.productionCards.length - a.productionCards.length;
    }
    return peakReward(b.attachedMashBill) - peakReward(a.attachedMashBill);
  });

  for (const barrel of candidates) {
    const cardIds = planCardsTowardRecipe(
      player,
      barrel.attachedMashBill,
      barrel.productionCards,
    );
    if (cardIds.length > 0) {
      return {
        type: "MAKE_BOURBON",
        playerId: player.id,
        slotId: barrel.slotId,
        cardIds,
      };
    }
  }
  return null;
}

/**
 * Return card ids from the player's hand that progress the cumulative
 * pile (`existingPile`) toward the bill's recipe. Greedy: takes the
 * first matching card per requirement until each min is met.
 */
function planCardsTowardRecipe(
  player: PlayerState,
  bill: MashBill,
  existingPile: Card[],
): string[] {
  const recipe = bill.recipe ?? {};
  const minCorn = Math.max(1, recipe.minCorn ?? 0);
  const minRye = recipe.minRye ?? 0;
  const minBarley = recipe.minBarley ?? 0;
  let minWheat = recipe.minWheat ?? 0;
  if (player.distillery?.bonus === "wheated_baron" && isWheatedBill(bill)) {
    minWheat = Math.max(0, minWheat - 1);
  }
  const maxRye = recipe.maxRye ?? Infinity;
  const maxWheat = recipe.maxWheat ?? Infinity;

  const tally = tallyPile(existingPile);
  const used = new Set<string>();
  const picks: string[] = [];

  // Cask first — exactly 1 needed per barrel (Cooper's Contract aside).
  if (tally.cask < 1) {
    const cask = player.hand.find((c) => !used.has(c.id) && suppliesResource(c, "cask"));
    if (cask) {
      used.add(cask.id);
      picks.push(cask.id);
      tally.cask += 1;
    }
  }
  // Corn up to recipe min.
  while (tally.corn < minCorn) {
    const taken = takeBySubtype(player.hand, "corn", 1, used);
    if (!taken || taken.length === 0) break;
    for (const c of taken) {
      picks.push(c.id);
      tally.corn += resourceUnits(c, "corn");
    }
  }
  // Rye / Barley / Wheat up to recipe min.
  while (tally.rye < minRye) {
    if (tally.rye + 1 > maxRye) break;
    const taken = takeBySubtype(player.hand, "rye", 1, used);
    if (!taken || taken.length === 0) break;
    for (const c of taken) {
      picks.push(c.id);
      tally.rye += resourceUnits(c, "rye");
    }
  }
  while (tally.barley < minBarley) {
    const taken = takeBySubtype(player.hand, "barley", 1, used);
    if (!taken || taken.length === 0) break;
    for (const c of taken) {
      picks.push(c.id);
      tally.barley += resourceUnits(c, "barley");
    }
  }
  while (tally.wheat < minWheat) {
    if (tally.wheat + 1 > maxWheat) break;
    const taken = takeBySubtype(player.hand, "wheat", 1, used);
    if (!taken || taken.length === 0) break;
    for (const c of taken) {
      picks.push(c.id);
      tally.wheat += resourceUnits(c, "wheat");
    }
  }
  // Universal min-1-grain: if still missing, take any legal grain.
  let grain = tally.rye + tally.barley + tally.wheat;
  if (grain < 1) {
    const grainKinds: GrainSubtype[] = ["rye", "barley", "wheat"];
    for (const sub of grainKinds) {
      if (sub === "rye" && maxRye === 0) continue;
      if (sub === "wheat" && maxWheat === 0) continue;
      const taken = takeBySubtype(player.hand, sub, 1, used);
      if (taken && taken.length > 0) {
        for (const c of taken) {
          picks.push(c.id);
          tally[sub] += resourceUnits(c, sub);
          grain += resourceUnits(c, sub);
        }
        break;
      }
    }
  }
  return picks;
}

function tallyPile(cards: Card[]) {
  const t = { cask: 0, corn: 0, rye: 0, barley: 0, wheat: 0 };
  for (const c of cards) {
    if (c.type !== "resource") continue;
    if (suppliesResource(c, "cask")) t.cask += 1;
    t.corn += resourceUnits(c, "corn");
    t.rye += resourceUnits(c, "rye");
    t.barley += resourceUnits(c, "barley");
    t.wheat += resourceUnits(c, "wheat");
  }
  return t;
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
 * Take up to `minUnits` worth of `subtype` from `hand`, marking cards
 * as used. Returns whatever it found (possibly empty if nothing
 * matches) — caller decides whether the partial coverage is enough.
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
  const candidates = hand
    .filter((c) => !used.has(c.id) && c.subtype === subtype)
    .sort((a, b) => (a.resourceCount ?? 1) - (b.resourceCount ?? 1));
  for (const c of candidates) {
    taken.push(c);
    used.add(c.id);
    count += c.resourceCount ?? 1;
    if (count >= minUnits) break;
  }
  return taken.length > 0 ? taken : null;
}

// -----------------------------
// AGE_BOURBON
// -----------------------------

function chooseAge(state: GameState, player: PlayerState): GameAction | null {
  const barrels = getPlayerBarrels(state, player.id).filter(
    (b) =>
      // v2.5: only aging-phase barrels are ageable, and a barrel that
      // just finished construction this round skips its first age.
      b.phase === "aging" &&
      (b.completedInRound == null || b.completedInRound < state.round) &&
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
// BUY_OPERATIONS_CARD
// -----------------------------

const FACEUP_OPS_SIZE = 3;

/**
 * Buy a face-up ops card if (a) the bot can pay for it, (b) it doesn't
 * already hold a copy of the same defId in hand, and (c) the card is one
 * the bot's heuristic actually knows how to play. Prefer the cheapest
 * affordable card so we don't drain hand value on a single buy.
 */
function chooseBuyOpsCard(state: GameState, player: PlayerState): GameAction | null {
  if (state.operationsDeck.length === 0) return null;
  const heldDefIds = new Set(player.operationsHand.map((c) => c.defId));

  // The face-up row is the last FACEUP_OPS_SIZE cards of operationsDeck,
  // exposed in UI order [top, top-1, top-2].
  const totalSpend = player.hand.reduce((acc, c) => acc + paymentForOpsBuy(c), 0);

  let best: { uiSlot: number; cost: number; rank: number } | null = null;
  for (let ui = 0; ui < FACEUP_OPS_SIZE; ui++) {
    const idx = state.operationsDeck.length - 1 - ui;
    if (idx < 0) break;
    const card = state.operationsDeck[idx];
    if (!card) continue;
    if (heldDefIds.has(card.defId)) continue;
    if (!OPS_BOT_PLAYABLE.has(card.defId)) continue;
    if (card.cost > totalSpend) continue;
    const rank = OPS_BUY_PREFERENCE.indexOf(card.defId);
    const effectiveRank = rank === -1 ? OPS_BUY_PREFERENCE.length : rank;
    if (
      !best ||
      effectiveRank < best.rank ||
      (effectiveRank === best.rank && card.cost < best.cost)
    ) {
      best = { uiSlot: ui, cost: card.cost, rank: effectiveRank };
    }
  }
  if (!best) return null;

  // Pay with the cheapest combination of resource cards first, falling
  // back to capital cards. We never overpay by a capital card if a
  // pile of resource cards already covers it.
  const sorted = [...player.hand].sort((a, b) => paymentForOpsBuy(a) - paymentForOpsBuy(b));
  const spend: string[] = [];
  let paid = 0;
  for (const c of sorted) {
    spend.push(c.id);
    paid += paymentForOpsBuy(c);
    if (paid >= best.cost) break;
  }
  if (paid < best.cost) return null;

  return {
    type: "BUY_OPERATIONS_CARD",
    playerId: player.id,
    opsSlotIndex: best.uiSlot,
    spendCardIds: spend,
  };
}

function paymentForOpsBuy(card: Card): number {
  return card.type === "capital" ? card.capitalValue ?? 1 : 1;
}

/**
 * Heuristic ranking for ops cards the bot is willing to BUY. Cards
 * whose play target the bot can't pick (e.g. Barrel Broker — needs
 * cross-player negotiation) are intentionally excluded.
 */
const OPS_BUY_PREFERENCE: OperationsCard["defId"][] = [
  "demand_surge",       // straight protection on a planned sale
  "market_manipulation",
  "bourbon_boom",
  "rushed_shipment",
  "kentucky_connection",
  "market_corner",
  "blend",
  "cash_out",
  "regulatory_inspection",
  "glut",
  "insider_buyer",
  "bottling_run",
  "allocation",
  "rickhouse_expansion_permit",
];

const OPS_BOT_PLAYABLE = new Set<OperationsCard["defId"]>([
  "demand_surge",
  "market_manipulation",
  "bourbon_boom",
  "rushed_shipment",
  "kentucky_connection",
  "market_corner",
  "blend",
  "cash_out",
  "regulatory_inspection",
  "glut",
  "insider_buyer",
  "bottling_run",
  "allocation",
  "rickhouse_expansion_permit",
]);

// -----------------------------
// DRAW_MASH_BILL
// -----------------------------

function chooseDrawMashBill(state: GameState, player: PlayerState): GameAction | null {
  // v2.6: only worth drawing when we actually have an open slot to
  // receive the bill AND the bourbon deck/face-up still has bills.
  if (emptySlotsFor(state, player.id).length === 0) return null;
  if (state.bourbonDeck.length === 0 && state.bourbonFaceUp.length === 0) return null;
  // Don't double-draw: skip if we already hold a "ready" slot waiting
  // for resources.
  const myBarrels = getPlayerBarrels(state, player.id);
  const hasReady = myBarrels.some((b) => b.phase === "ready");
  if (hasReady) return null;
  // Prefer the blind draw (cheapest — pay any 1 card) when the deck has
  // bills left. Falls back to a face-up pick once the deck is exhausted.
  if (state.bourbonDeck.length > 0) {
    const spendCard =
      player.hand.find((c) => c.type === "capital" && (c.capitalValue ?? 1) === 1) ??
      player.hand[0];
    if (!spendCard) return null;
    return {
      type: "DRAW_MASH_BILL",
      playerId: player.id,
      spendCardIds: [spendCard.id],
    };
  }
  // Face-up only — pick the cheapest face-up bill we can pay for.
  const sorted = [...player.hand].sort((a, b) => paymentForOpsBuy(b) - paymentForOpsBuy(a));
  for (const bill of state.bourbonFaceUp) {
    const cost = bill.cost ?? 2;
    const spend: string[] = [];
    let paid = 0;
    for (const c of sorted) {
      spend.push(c.id);
      paid += c.type === "capital" ? c.capitalValue ?? 1 : 1;
      if (paid >= cost) break;
    }
    if (paid >= cost) {
      return {
        type: "DRAW_MASH_BILL",
        playerId: player.id,
        mashBillId: bill.id,
        spendCardIds: spend,
      };
    }
  }
  return null;
}
