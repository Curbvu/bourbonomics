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
import { billCostByTier } from "../types";
import { resourceUnits, suppliesResource } from "../cards";
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

// v3.1: lowered both thresholds — at 3 / 6 the bot was sitting on
// barrels for most of a game. Most bills pay 1–2 rep at low/mid
// demand and 3+ only when age and demand both align, which is a
// rare coincidence in the early-mid game. The bot would wait,
// rarely sell, and the human had no opponent pressure on the
// market. Lowered to 2 / 4 so the bot:
//   - sells anything paying ≥2 rep (typical mid-demand cell)
//   - sells age 4+ for any positive reward (don't sit on stale)
//   - still sells aggressively in the final round (unchanged).
const SELL_REWARD_THRESHOLD = 2;
const SELL_PRESSURE_AGE = 4; // sell aged barrels even at low reward

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

  // Bills cost rep. If the player has NO in-progress barrel
  // (no ready / construction slot) AND the bourbon deck still has
  // bills, drawing one is the priority — production depends on it.
  // Otherwise the bot will spend its rep on cheap market cards and
  // never advance the doomsday clock.
  const myBarrels = getPlayerBarrels(state, player.id);
  const needsBill =
    !myBarrels.some((b) => b.phase === "ready" || b.phase === "construction") &&
    (state.bourbonDeck.length > 0 || state.bourbonFaceUp.length > 0) &&
    emptySlotsFor(state, player.id).length > 0;
  if (needsBill) {
    const drawFirst = chooseDrawMashBill(state, player);
    if (drawFirst) return drawFirst;
  }

  // 5b) Buy a useful card from the market — but reserve at least 1
  // rep for a future bill draw whenever bills are still available
  // and the player isn't sitting on a sale-ready barrel.
  const buy = chooseBuy(state, player);
  if (buy && buy.type === "BUY_FROM_MARKET" && !shouldReserveRep(state, player, buy.rep)) return buy;

  // 6) Ops buying disabled — pending future release.
  // const buyOps = chooseBuyOpsCard(state, player);
  // if (buyOps) return buyOps;

  // 7) Draw a mash bill if we still can.
  const draw = chooseDrawMashBill(state, player);
  if (draw) return draw;

  return { type: "PASS_TURN", playerId };
}

/**
 * v2.11: should the bot hold off on a buy to save rep for a bill
 * draw? True when the buy would push rep below 1 AND the bourbon
 * deck still has bills AND the player has an open slot to receive
 * one AND no aging-phase barrel is ready to sell.
 */
function shouldReserveRep(
  state: GameState,
  player: PlayerState,
  buyRep: number,
): boolean {
  if (buyRep === 0) return false; // free buy — no rep concern
  const postRep = player.reputation - buyRep;
  if (postRep >= 1) return false;
  const billsLeft = state.bourbonDeck.length + state.bourbonFaceUp.length;
  if (billsLeft === 0) return false;
  if (emptySlotsFor(state, player.id).length === 0) return false;
  // If we have an aging barrel that's about to sell, the rep will
  // refill — buying first is fine.
  const hasSaleable = getPlayerBarrels(state, player.id).some(
    (b) =>
      b.phase === "aging" &&
      b.age >= 2 &&
      (b.completedInRound == null || state.round > b.completedInRound),
  );
  if (hasSaleable) return false;
  return true;
}

// -----------------------------
// Distillery selection
// -----------------------------

// v2.10 distillery preference. Bot picks the leftmost match available
// in the pool. Connoisseur Estate's deck-shaping edge and 4-bill draft
// give it the strongest opening; Vanilla is the safe baseline.
const DISTILLERY_PREFERENCE: Distillery["bonus"][] = [
  "connoisseur_estate",
  "vanilla",
  "high_rye_house",
  "wheated_baron",
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
  // v2.11: "afford" = current rep (Labor cards we don't model here as
  // a hard discount; this is a rough upper bound).
  const mc = playable.find((c) => c.defId === "market_corner");
  if (mc) {
    const spending = player.reputation;
    let bestSlot = -1;
    let bestCost = 0;
    for (let i = 0; i < state.marketConveyor.length; i++) {
      const card = state.marketConveyor[i]!;
      const cost = card.cost ?? 1;
      if (cost > spending && cost > bestCost) {
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
  // expensive AND we have rep to buy the refreshed offerings.
  const ib = playable.find((c) => c.defId === "insider_buyer");
  if (ib) {
    const spending = player.reputation;
    const cheapestVisible = state.marketConveyor.reduce(
      (lo, c) => Math.min(lo, c.cost ?? 1),
      Infinity,
    );
    if (spending >= cheapestVisible) {
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
  // v2.10: round-gap rule — only aging barrels whose completion round
  // is strictly older than the current round are sellable.
  const barrels = getPlayerBarrels(state, player.id).filter(
    (b) =>
      b.phase === "aging" &&
      b.age >= 2 &&
      (b.completedInRound == null || state.round > b.completedInRound),
  );
  if (barrels.length === 0) return null;

  let best:
    | {
        barrelId: string;
        reward: number;
        age: number;
        bill: MashBill;
        score: number;
      }
    | null = null;
  for (const b of barrels) {
    const bill = b.attachedMashBill;
    const grid = computeReward(bill, b.age, state.demand, {
      demandBandOffset: b.demandBandOffset,
      gridRepOffset: b.gridRepOffset,
    });
    // v2.10: Gold-eligible sales are the only path to mid-game deck
    // shaping (Convert / split into card draws). Score them higher
    // so the bot prefers Gold-eligible barrels at equal grid value.
    const goldEligibleHere =
      bill.goldAward != null &&
      b.age >= (bill.goldAward.minAge ?? 0) &&
      state.demand >= (bill.goldAward.minDemand ?? 0) &&
      grid >= (bill.goldAward.minReward ?? 0);
    // v2.10 High-Rye House: +1 rep on rye-bill sales nudges these
    // forward at equal grid.
    const distilleryBonus =
      player.distillery?.saleMods?.bonusRepOnBill?.kind === "high_rye" &&
      (bill.recipe?.minRye ?? 0) >= 1
        ? player.distillery.saleMods.bonusRepOnBill.rep
        : player.distillery?.saleMods?.bonusRepOnBill?.kind === "wheated" &&
            bill.recipe?.maxRye === 0
          ? player.distillery.saleMods.bonusRepOnBill.rep
          : 0;
    const score = grid + (goldEligibleHere ? Math.ceil(grid * 0.5) : 0) + distilleryBonus;
    if (best === null || score > best.score) {
      best = { barrelId: b.id, reward: grid, age: b.age, bill, score };
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
    // v2.11: single-step sale — rep total + tier floor are applied
    // by the engine. No split fields.
    ...(goldChoice ? { goldChoice } : {}),
    ...(goldConvertTargetSlotId ? { goldConvertTargetSlotId } : {}),
  };
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
  // v2.10 Connoisseur Estate: empty slots count as Convert targets —
  // no recipe check (no committed cards) and no displaced bill, so
  // they're strictly better than overwriting an existing slot.
  if (player.distillery?.bonus === "connoisseur_estate") {
    const sellingSlotId = state.allBarrels.find((b) => b.id === sellingBarrelId)?.slotId;
    const occupied = new Set(
      state.allBarrels
        .filter((b) => b.ownerId === player.id && b.id !== sellingBarrelId)
        .map((b) => b.slotId),
    );
    const emptySlot = player.rickhouseSlots.find(
      (s) => !occupied.has(s.id) && s.id !== sellingSlotId,
    );
    if (emptySlot) return emptySlot.id;
  }
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
 * Predicate: does `pile` **exactly** satisfy `bill`'s recipe under the
 * v2.10 rules? Mirrors `make-bourbon.recipeSatisfied`. Used by the
 * bot's Gold Convert picker to decide whether a slot's current pile
 * would survive a recipe relabel.
 */
function recipeSatisfiedByPile(
  player: PlayerState,
  bill: MashBill,
  pile: Card[],
): boolean {
  const recipe = bill.recipe ?? {};
  let cask = 0,
    plainCask = 0,
    corn = 0,
    rye = 0,
    barley = 0,
    wheat = 0;
  let spCask = 0,
    spCorn = 0,
    spRye = 0,
    spBarley = 0,
    spWheat = 0;
  for (const c of pile) {
    if (c.type !== "resource") continue;
    const count = c.resourceCount ?? 1;
    if (c.subtype === "cask") {
      cask += count;
      if (!c.specialty) plainCask += count;
    }
    if (c.subtype === "corn") corn += count;
    if (c.subtype === "rye") rye += count;
    if (c.subtype === "barley") barley += count;
    if (c.subtype === "wheat") wheat += count;
    if (c.specialty) {
      if (c.subtype === "cask") spCask += count;
      if (c.subtype === "corn") spCorn += count;
      if (c.subtype === "rye") spRye += count;
      if (c.subtype === "barley") spBarley += count;
      if (c.subtype === "wheat") spWheat += count;
    }
  }
  const sp = recipe.minSpecialty ?? {};
  const minCorn = Math.max(Math.max(1, recipe.minCorn ?? 0), sp.corn ?? 0);
  const minRye = Math.max(recipe.minRye ?? 0, sp.rye ?? 0);
  const minBarley = Math.max(recipe.minBarley ?? 0, sp.barley ?? 0);
  const minWheat = Math.max(recipe.minWheat ?? 0, sp.wheat ?? 0);
  const namedGrainSum = minRye + minBarley + minWheat;
  const minTotal = Math.max(
    recipe.minTotalGrain ?? 0,
    namedGrainSum === 0 ? 1 : namedGrainSum,
  );
  if (cask !== 1) return false;
  if ((sp.cask ?? 0) >= 1 && plainCask > 0) return false;
  // Corn exact; per-grain floors; total grain exact (matches engine).
  if (corn !== minCorn) return false;
  if (rye < minRye) return false;
  if (barley < minBarley) return false;
  if (wheat < minWheat) return false;
  if (recipe.maxRye !== undefined && rye > recipe.maxRye) return false;
  if (recipe.maxWheat !== undefined && wheat > recipe.maxWheat) return false;
  const grain = rye + barley + wheat;
  if (grain !== minTotal) return false;
  if (spCask < (sp.cask ?? 0)) return false;
  if (spCorn < (sp.corn ?? 0)) return false;
  if (spRye < (sp.rye ?? 0)) return false;
  if (spBarley < (sp.barley ?? 0)) return false;
  if (spWheat < (sp.wheat ?? 0)) return false;
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
  const sp = recipe.minSpecialty ?? {};
  // v2.10 exact-recipe: bake specialty floors into per-subtype mins
  // so a `minRye: 0, minSpecialty.rye: 1` recipe registers as
  // "needs 1 rye total" — the planner picks one Specialty Rye and
  // satisfies both gates with a single card.
  const minCorn = Math.max(Math.max(1, recipe.minCorn ?? 0), sp.corn ?? 0);
  const minRye = Math.max(recipe.minRye ?? 0, sp.rye ?? 0);
  const minBarley = Math.max(recipe.minBarley ?? 0, sp.barley ?? 0);
  let minWheat = Math.max(recipe.minWheat ?? 0, sp.wheat ?? 0);
  // Mirror the engine's Wheated Baron / Mash Futures discount here so
  // the planner's effective totals match what `recipeSatisfied` will
  // accept. Otherwise the planner picks one more wheat than the
  // engine expects and the commit gets rejected.
  if (
    player.distillery?.bonus === "wheated_baron" &&
    recipe.maxRye === 0 &&
    minWheat > 0
  ) {
    minWheat = Math.max(0, minWheat - 1);
  }
  const maxRye = recipe.maxRye ?? Infinity;
  const maxWheat = recipe.maxWheat ?? Infinity;
  const spCaskReq = sp.cask ?? 0;
  const spCornReq = sp.corn ?? 0;
  const spRyeReq = sp.rye ?? 0;
  const spBarleyReq = sp.barley ?? 0;
  const spWheatReq = sp.wheat ?? 0;

  const tally = tallyPile(existingPile);
  const used = new Set<string>();
  const picks: string[] = [];
  // v2.10 Wheated Baron: rye cards are not legal commits. Mark every
  // rye in hand as used so the planner never reaches for one.
  if (player.distillery?.bonus === "wheated_baron") {
    for (const c of player.hand) {
      if (c.type === "resource" && c.subtype === "rye") used.add(c.id);
    }
  }

  // Cask first — exactly 1 needed per barrel (Cooper's Contract aside).
  // v2.10: if the recipe demands a Specialty cask, only a Specialty
  // cask is legal (plain casks would brick the barrel).
  if (tally.cask < 1) {
    const cask = player.hand.find((c) => {
      if (used.has(c.id) || !suppliesResource(c, "cask")) return false;
      if (spCaskReq >= 1) return c.specialty === true;
      return true;
    });
    if (cask) {
      used.add(cask.id);
      picks.push(cask.id);
      tally.cask += 1;
    }
  }
  // Corn up to recipe min. Pull Specialty Corn first if the recipe
  // demands any so a single card ticks both boxes.
  while (tally.corn < minCorn) {
    const taken = takeBySubtype(player.hand, "corn", 1, used, spCornReq > 0);
    if (!taken || taken.length === 0) break;
    for (const c of taken) {
      picks.push(c.id);
      tally.corn += resourceUnits(c, "corn");
    }
  }
  // Rye / Barley / Wheat up to recipe min (Specialty-preferred when gated).
  // v2.10 exact-recipe: each per-grain loop also caps against the
  // recipe's total-grain ceiling so a multi-unit specialty pick can't
  // overshoot the whole barrel.
  const minTotalGrain = Math.max(
    recipe.minTotalGrain ?? 0,
    minRye + minBarley + minWheat || 1,
  );
  const totalGrainNow = () => tally.rye + tally.barley + tally.wheat;
  while (tally.rye < minRye) {
    if (tally.rye + 1 > maxRye) break;
    if (totalGrainNow() >= minTotalGrain) break;
    const taken = takeBySubtype(player.hand, "rye", 1, used, spRyeReq > 0);
    if (!taken || taken.length === 0) break;
    const c = taken[0]!;
    const units = resourceUnits(c, "rye");
    if (totalGrainNow() + units > minTotalGrain) {
      // multi-unit specialty would overshoot the total; back out
      used.delete(c.id);
      break;
    }
    picks.push(c.id);
    tally.rye += units;
  }
  while (tally.barley < minBarley) {
    if (totalGrainNow() >= minTotalGrain) break;
    const taken = takeBySubtype(player.hand, "barley", 1, used, spBarleyReq > 0);
    if (!taken || taken.length === 0) break;
    const c = taken[0]!;
    const units = resourceUnits(c, "barley");
    if (totalGrainNow() + units > minTotalGrain) {
      used.delete(c.id);
      break;
    }
    picks.push(c.id);
    tally.barley += units;
  }
  while (tally.wheat < minWheat) {
    if (tally.wheat + 1 > maxWheat) break;
    if (totalGrainNow() >= minTotalGrain) break;
    const taken = takeBySubtype(player.hand, "wheat", 1, used, spWheatReq > 0);
    if (!taken || taken.length === 0) break;
    const c = taken[0]!;
    const units = resourceUnits(c, "wheat");
    if (totalGrainNow() + units > minTotalGrain) {
      used.delete(c.id);
      break;
    }
    picks.push(c.id);
    tally.wheat += units;
  }
  // v2.10 wildcard-grain fill — top up to the recipe's exact total
  // grain. The wildcard portion (minTotalGrain − sum of per-grain
  // mins) can be any grain not capped at 0. One-card-at-a-time so the
  // planner stops the instant the total is satisfied (the engine
  // rejects over-commit, so any overshoot would brick the commit).
  let grain = totalGrainNow();
  if (grain < minTotalGrain) {
    const grainKinds: GrainSubtype[] = ["rye", "barley", "wheat"];
    outer: while (grain < minTotalGrain) {
      let added = false;
      for (const sub of grainKinds) {
        if (sub === "rye" && maxRye === 0) continue;
        if (sub === "wheat" && maxWheat === 0) continue;
        if (sub === "rye" && tally.rye >= maxRye) continue;
        if (sub === "wheat" && tally.wheat >= maxWheat) continue;
        const taken = takeBySubtype(player.hand, sub, 1, used);
        if (taken && taken.length > 0) {
          for (const c of taken) {
            picks.push(c.id);
            const units = resourceUnits(c, sub);
            tally[sub] += units;
            grain += units;
            // Stop if a multi-unit specialty card overshoots — the
            // engine would reject this commit. Bail so the planner
            // returns whatever it has so far (commit may still be
            // partial-build legal under floors).
            if (grain > minTotalGrain) {
              picks.pop();
              used.delete(c.id);
              tally[sub] -= units;
              grain -= units;
              break outer;
            }
          }
          added = true;
          if (grain >= minTotalGrain) break outer;
        }
      }
      if (!added) break; // no more legal grain in hand
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
 *
 * v2.11: `preferSpecialty` pulls Specialty / Heritage cards first when
 * the recipe has a specialty floor on this subtype, so a single card
 * can satisfy both the regular min and the floor.
 */
function takeBySubtype(
  hand: Card[],
  subtype: "cask" | "corn" | GrainSubtype,
  minUnits: number,
  used: Set<string>,
  preferSpecialty = false,
): Card[] | null {
  if (minUnits <= 0) return [];
  const taken: Card[] = [];
  let count = 0;
  const candidates = hand
    .filter((c) => !used.has(c.id) && c.subtype === subtype)
    .sort((a, b) => {
      if (preferSpecialty) {
        const sa = a.specialty ? 1 : 0;
        const sb = b.specialty ? 1 : 0;
        if (sa !== sb) return sb - sa; // specialty first
      }
      return (a.resourceCount ?? 1) - (b.resourceCount ?? 1);
    });
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

  // Prefer a Generic Labor card (cheap aging fuel)
  // when paying the aging cost; otherwise reach for any 1-unit resource.
  const card =
    player.hand.find((c) => c.type === "labor" && c.laborSubtype === "generic") ??
    player.hand.find((c) => c.type === "resource" && (c.resourceCount ?? 1) === 1) ??
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

/**
 * Which Specialty subtypes the bot can still profit from buying — pulled
 * from any unfinished bills in the player's slots. A subtype is "needed"
 * when the bill's `minSpecialty.<subtype>` floor exceeds the matching
 * count of specialty cards already committed to the barrel.
 */
function neededSpecialtySubtypes(
  state: GameState,
  player: PlayerState,
): Set<"cask" | "corn" | "rye" | "barley" | "wheat"> {
  const out = new Set<"cask" | "corn" | "rye" | "barley" | "wheat">();
  for (const barrel of getPlayerBarrels(state, player.id)) {
    if (barrel.phase === "aging") continue;
    const sp = barrel.attachedMashBill.recipe?.minSpecialty;
    if (!sp) continue;
    const tally = { cask: 0, corn: 0, rye: 0, barley: 0, wheat: 0 };
    for (const c of barrel.productionCards) {
      if (c.type !== "resource" || !c.specialty) continue;
      const sub = c.subtype;
      if (!sub) continue;
      tally[sub] += c.resourceCount ?? 1;
    }
    for (const sub of ["cask", "corn", "rye", "barley", "wheat"] as const) {
      const need = sp[sub] ?? 0;
      if (need > tally[sub]) out.add(sub);
    }
  }
  return out;
}

function chooseBuy(state: GameState, player: PlayerState): GameAction | null {
  // v2.11 (Unified Rep): rep is the currency. Labor cards in hand
  // supplement rep — Cooper +2 toward market resources, Generic +1
  // anywhere. The bot prefers to pay with Labor first (cards in hand
  // are cheaper than rep, which is also VPs) and tops up with rep.
  const cooperLabor = player.hand.filter(
    (c) => c.type === "labor" && c.laborSubtype === "cooper",
  );
  const genericLabor = player.hand.filter(
    (c) => c.type === "labor" && c.laborSubtype === "generic",
  );
  const laborMaxContribution = cooperLabor.length * 2 + genericLabor.length;
  const maxAffordable = player.reputation + laborMaxContribution;
  if (maxAffordable === 0) return null;

  // Down-weight Specialty when no slotted bill demands its subtype.
  const specialtyDemand = neededSpecialtySubtypes(state, player);

  let best: { slotIndex: number; score: number; cost: number } | null = null;
  for (let i = 0; i < state.marketConveyor.length; i++) {
    const card = state.marketConveyor[i]!;
    const cost = card.cost ?? 1;
    if (cost > maxAffordable) continue;
    let score = cost;
    if (
      card.type === "resource" &&
      card.specialty === true &&
      card.cardDefId.startsWith("superior_")
    ) {
      const sub = card.subtype;
      if (!sub || !specialtyDemand.has(sub)) {
        score -= 1;
      }
    }
    if (!best || score > best.score) best = { slotIndex: i, score, cost };
  }
  if (!best) return null;

  // Pay Cooper first (matched-domain, +2 each), then Generic (+1
  // each), then rep. Labor is scarce now (no central pile), so the
  // bot should prefer rep when it has plenty; tune later if needed.
  const laborIds: string[] = [];
  let covered = 0;
  for (const c of cooperLabor) {
    if (covered >= best.cost) break;
    laborIds.push(c.id);
    covered += 2;
  }
  for (const c of genericLabor) {
    if (covered >= best.cost) break;
    laborIds.push(c.id);
    covered += 1;
  }
  const rep = Math.max(0, best.cost - covered);
  if (rep > player.reputation) return null;

  return {
    type: "BUY_FROM_MARKET",
    playerId: player.id,
    marketSlotIndex: best.slotIndex,
    rep,
    laborCardIds: laborIds,
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

  // v2.11: ops buys pay rep + Marketing/Generic Labor. Marketing
  // contributes +2 toward ops; Cooper / Architect contribute 0.
  const marketingLabor = player.hand.filter(
    (c) => c.type === "labor" && c.laborSubtype === "marketing",
  );
  const genericLabor = player.hand.filter(
    (c) => c.type === "labor" && c.laborSubtype === "generic",
  );
  const laborMax = marketingLabor.length * 2 + genericLabor.length;
  const maxAffordable = player.reputation + laborMax;

  let best: { uiSlot: number; cost: number; rank: number } | null = null;
  for (let ui = 0; ui < FACEUP_OPS_SIZE; ui++) {
    const idx = state.operationsDeck.length - 1 - ui;
    if (idx < 0) break;
    const card = state.operationsDeck[idx];
    if (!card) continue;
    if (heldDefIds.has(card.defId)) continue;
    if (!OPS_BOT_PLAYABLE.has(card.defId)) continue;
    if (card.cost > maxAffordable) continue;
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

  const laborIds: string[] = [];
  let covered = 0;
  for (const c of marketingLabor) {
    if (covered >= best.cost) break;
    laborIds.push(c.id);
    covered += 2;
  }
  for (const c of genericLabor) {
    if (covered >= best.cost) break;
    laborIds.push(c.id);
    covered += 1;
  }
  const rep = Math.max(0, best.cost - covered);
  if (rep > player.reputation) return null;

  return {
    type: "BUY_OPERATIONS_CARD",
    playerId: player.id,
    opsSlotIndex: best.uiSlot,
    rep,
    laborCardIds: laborIds,
  };
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

  // Bills pay rep + Labor. Generic Labor (+1 anywhere) helps; Cooper
  // / Marketing / Architect don't (domain mismatch).
  const genericLabor = player.hand.filter(
    (c) => c.type === "labor" && c.laborSubtype === "generic",
  );
  const blindCost = 1;
  // Blind draw is the cheapest path when the deck has bills left.
  if (state.bourbonDeck.length > 0) {
    const plan = planBillPayment(player, blindCost, genericLabor);
    if (plan) {
      return {
        type: "DRAW_MASH_BILL",
        playerId: player.id,
        rep: plan.rep,
        laborCardIds: plan.laborCardIds,
      };
    }
  }
  // Face-up only — pick the cheapest legal bill we can afford.
  for (const bill of state.bourbonFaceUp) {
    // v2.10 High-Rye House: cannot draft wheated bills.
    if (
      player.distillery?.bonus === "high_rye_house" &&
      bill.recipe?.maxRye === 0
    ) {
      continue;
    }
    const cost = billCostByTier(bill);
    const plan = planBillPayment(player, cost, genericLabor);
    if (!plan) continue;
    return {
      type: "DRAW_MASH_BILL",
      playerId: player.id,
      mashBillId: bill.id,
      rep: plan.rep,
      laborCardIds: plan.laborCardIds,
    };
  }
  return null;
}

/**
 * Plan a bill-draw payment of `cost` using the player's rep + Generic
 * Labor cards. Returns `null` when the player cannot afford the cost.
 */
function planBillPayment(
  player: PlayerState,
  cost: number,
  genericLabor: Card[],
): { rep: number; laborCardIds: string[] } | null {
  const laborIds: string[] = [];
  let covered = 0;
  for (const c of genericLabor) {
    if (covered >= cost) break;
    laborIds.push(c.id);
    covered += 1;
  }
  const rep = Math.max(0, cost - covered);
  if (rep > player.reputation) return null;
  return { rep, laborCardIds: laborIds };
}
