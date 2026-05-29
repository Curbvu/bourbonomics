import type {
  BotDifficulty,
  Card,
  Distillery,
  GameAction,
  GameState,
  GrainSubtype,
  MashBill,
  OperationsCard,
  PlayerState,
} from "../types";
import { resourceUnits, suppliesResource } from "../cards";
import { computeReward } from "../rewards";
import { emptySlotsFor, getPlayerBarrels, slottedBillCount } from "../state";

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
//   7. INITIATE_DRAFTING_LOOP if no in-progress barrel + slot room +
//      junk card to seed (last resort — speeds endgame).
//   8. PASS_TURN otherwise.
//
// During an active Drafting Loop the runner routes pick actions to
// `chooseDraftAction` instead of the main `chooseAction` planner.
// ---------------------------------------------------------------

// v3.6: tuned again after a 26-round playtest where two bots ended
// with 0 rep. The 2/4 split (sell at ≥2 rep, or age 4+ at ≥1) still
// stranded bots on age-2-3 barrels paying 1 rep that they treated as
// "not worth selling." Lowered to 1/3 so:
//   - bot sells the moment a barrel pays ≥1 rep (rep IS the score)
//   - age 3+ barrels close out at any positive reward
//   - final round still flushes everything reward > 0 (unchanged).
const SELL_REWARD_THRESHOLD = 1;
const SELL_PRESSURE_AGE = 3; // sell aged barrels even at low reward
// Endgame closeout: when fewer than this many rounds remain on the
// bourbon clock, the bot also flushes barrels that pay 0 rep — better
// to clear the slot for a reusable bill than to die holding stock.
const ENDGAME_FLUSH_ROUNDS = 3;

// Difficulty knob for the buy heuristic. Reputation is both currency
// AND victory points (see PlayerState.reputation docs), so a "buy"
// that nets negative value is a direct VP leak. Every potential
// purchase becomes an EV-vs-cost decision:
//   net = evForCard(card) - card.cost
//   buy only if net >= NET_THRESHOLD[difficulty]
// (An earlier draft also enforced a per-difficulty rep floor, but
// that deadlocked long games — a bot with a ready bill and no
// matching cards in hand couldn't buy and couldn't initiate another
// draft either, so the bourbon deck never drained. The EV gate
// already kills the "buy junk to bottom-out rep" pattern by itself.)
const NET_THRESHOLD: Record<BotDifficulty, number> = {
  easy: -1,
  normal: 0,
  hard: 0,
};

function difficultyOf(player: PlayerState): BotDifficulty {
  return player.difficulty ?? "normal";
}

export function chooseAction(state: GameState, playerId: string): GameAction {
  // v3.0 Line system — auto-resolve any pending Line choice the bot
  // is sitting on. Sensible defaults only; richer heuristics ship in
  // a follow-up PR. Runs BEFORE phase checks so initial drafts (held
  // through setup) clear in time for the first action turn.
  const pendingResolver = resolvePendingLineChoice(state, playerId);
  if (pendingResolver) return pendingResolver;

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

  // Bills are acquired via the Drafting Loop now (1 card per bill,
  // no rep cost). If the player has NO in-progress barrel AND has
  // slot room AND hasn't already used their loop this round, initiate.
  // Otherwise the bot will keep buying cheap commons and never advance
  // the doomsday clock.
  const myBarrels = getPlayerBarrels(state, player.id);
  const wantsBill =
    !myBarrels.some((b) => b.phase === "ready" || b.phase === "construction") &&
    state.bourbonDeck.length > 0 &&
    emptySlotsFor(state, player.id).length > 0;
  if (wantsBill) {
    const initiateFirst = chooseInitiateDraftingLoop(state, player);
    if (initiateFirst) return initiateFirst;
  }

  // 5b) Buy a useful card from the market.
  const buy = chooseBuy(state, player);
  if (buy) return buy;

  // 6) Ops buying disabled — pending future release.
  // const buyOps = chooseBuyOpsCard(state, player);
  // if (buyOps) return buyOps;

  // v3.2: Line Card draw heuristic retired alongside the Line Card
  // subsystem. The Draft Second Portfolio heuristic will land in the
  // Brand Portfolio implementation phase.

  // 8) Initiate the Drafting Loop as a fallback (last legal main action).
  const initiate = chooseInitiateDraftingLoop(state, player);
  if (initiate) return initiate;

  return { type: "PASS_TURN", playerId };
}

// -----------------------------
// Distillery selection
// -----------------------------

// Distillery preference. Bot picks the leftmost match available in
// the pool. Connoisseur Estate is now the prestige specialist (+1
// extra prestige on Silver, +1 extra on Gold) on top of its 4-bill
// setup, so it stays the strongest opener; Vanilla is the safe
// baseline.
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

  // Rating Boost: play right before a planned sale to amplify the payout.
  const ratingBoost = playable.find((c) => c.defId === "rating_boost");
  if (ratingBoost && player.pendingRatingBoost === 0) {
    const sale = chooseSale(state, player);
    if (sale && sale.type === "SELL_BOURBON") {
      return {
        type: "PLAY_OPERATIONS_CARD",
        playerId: player.id,
        cardId: ratingBoost.id,
        defId: "rating_boost",
      };
    }
  }

  // Wild Mash: pre-play when we're holding extra cask but short a
  // named grain. The conservative gate: hand has 2+ casks AND a
  // planned in-flight bill demands a named grain we're under-served
  // on. The bot won't actually invoke the swap on MAKE_BOURBON (not
  // plumbed through `chooseMakeBourbon`), so this gate is mostly to
  // surface the card; v1 acceptance.
  const wild = playable.find((c) => c.defId === "wild_mash");
  if (wild && !player.pendingWildMashToken) {
    const caskInHand = player.hand.filter(
      (c) => c.type === "resource" && suppliesResource(c, "cask"),
    ).length;
    if (caskInHand >= 2) {
      return {
        type: "PLAY_OPERATIONS_CARD",
        playerId: player.id,
        cardId: wild.id,
        defId: "wild_mash",
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
    // Prestige era: Gold-eligible sales grant +1 permanent prestige
    // (Connoisseur +2) AND retire the bill — a structurally large
    // upside even at the same grid cell. Silver triggers also matter
    // because prestige adds +1 rep to every future Silver/Gold sale.
    const goldEligibleHere =
      bill.goldAward != null &&
      b.age >= (bill.goldAward.minAge ?? 0) &&
      state.demand >= (bill.goldAward.minDemand ?? 0) &&
      grid >= (bill.goldAward.minReward ?? 0);
    const silverEligibleHere =
      !goldEligibleHere &&
      bill.silverAward != null &&
      b.age >= (bill.silverAward.minAge ?? 0) &&
      state.demand >= (bill.silverAward.minDemand ?? 0) &&
      grid >= (bill.silverAward.minReward ?? 0);
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
    // Prestige already earned adds directly to this sale's rep when
    // Silver or Gold triggers; chase that bonus first.
    const prestigeBonus =
      (goldEligibleHere || silverEligibleHere) ? player.prestige : 0;
    // EV bump for *gaining* prestige: 1 prestige × ~4 future premium
    // sales = +4 expected rep. Connoisseur gains 2 prestige on Gold
    // and 1 on Silver, so the multiplier scales.
    const isConnoisseur = player.distillery?.bonus === "connoisseur_estate";
    const prestigeGainedHere = goldEligibleHere
      ? (isConnoisseur ? 2 : 1)
      : silverEligibleHere && isConnoisseur
        ? 1
        : 0;
    const PRESTIGE_FUTURE_EV = 4;
    const score =
      grid +
      distilleryBonus +
      prestigeBonus +
      prestigeGainedHere * PRESTIGE_FUTURE_EV;
    if (best === null || score > best.score) {
      best = { barrelId: b.id, reward: grid, age: b.age, bill, score };
    }
  }
  if (!best) return null;

  const finalRound = state.finalRoundTriggered;
  // Endgame closeout: when the bourbon deck is almost dry the game's
  // last few rounds are imminent. Flush even reward-0 sales so we
  // don't end with stock that became un-sellable.
  const endgameFlush =
    state.bourbonDeck.length <= ENDGAME_FLUSH_ROUNDS || finalRound;
  const passesThreshold =
    best.reward >= SELL_REWARD_THRESHOLD ||
    (best.age >= SELL_PRESSURE_AGE && best.reward > 0) ||
    (finalRound && best.reward > 0) ||
    endgameFlush; // age≥2 already gated above; this captures 0-rep flush
  if (!passesThreshold) return null;

  return {
    type: "SELL_BOURBON",
    playerId: player.id,
    barrelId: best.barrelId,
  };
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
  // v3.7: when Specialty is *required* (sp.corn >= 1) and the bot
  // has none, do NOT fall back to a common — committing a common
  // would brick the slot for the Specialty floor (the recipe's
  // exact-count rules forbid adding a second corn later).
  while (tally.corn < minCorn) {
    const taken = takeBySubtype(player.hand, "corn", 1, used, spCornReq > 0);
    if (!taken || taken.length === 0) break;
    if (spCornReq > 0 && !taken[0]!.specialty) {
      used.delete(taken[0]!.id);
      break;
    }
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
    if (spRyeReq > 0 && !c.specialty) {
      used.delete(c.id);
      break;
    }
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
    if (spBarleyReq > 0 && !c.specialty) {
      used.delete(c.id);
      break;
    }
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
    if (spWheatReq > 0 && !c.specialty) {
      used.delete(c.id);
      break;
    }
    const units = resourceUnits(c, "wheat");
    if (totalGrainNow() + units > minTotalGrain) {
      used.delete(c.id);
      break;
    }
    picks.push(c.id);
    tally.wheat += units;
  }
  // v2.10 wildcard-grain fill — top up to the recipe's exact total
  // grain. The wildcard quota is the portion of minTotalGrain NOT
  // claimed by per-grain mins; only THAT many cards may go in this
  // loop. v3.7: previously the loop also fired when the per-grain
  // section bailed (e.g. recipe needs 2 barley but hand has none),
  // adding wrong-grain cards that bricked the slot for the still-
  // unmet per-grain min. Now we cap by wildcardQuota AND require
  // every per-grain min to already be met before wildcard fill.
  const wildcardQuota = Math.max(
    0,
    minTotalGrain - (minRye + minBarley + minWheat),
  );
  const perGrainMinsMet =
    tally.rye >= minRye &&
    tally.barley >= minBarley &&
    tally.wheat >= minWheat;
  let grain = totalGrainNow();
  let wildcardPicked = 0;
  if (
    perGrainMinsMet &&
    wildcardQuota > 0 &&
    grain < minTotalGrain
  ) {
    const grainKinds: GrainSubtype[] = ["rye", "barley", "wheat"];
    outer: while (grain < minTotalGrain && wildcardPicked < wildcardQuota) {
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
            wildcardPicked += units;
            // Stop if a multi-unit specialty card overshoots — the
            // engine would reject this commit. Bail so the planner
            // returns whatever it has so far (commit may still be
            // partial-build legal under floors).
            if (grain > minTotalGrain || wildcardPicked > wildcardQuota) {
              picks.pop();
              used.delete(c.id);
              tally[sub] -= units;
              grain -= units;
              wildcardPicked -= units;
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
 * `preferSpecialty` pulls Specialty / Heritage cards first when
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
 * Bills currently asking for cards (not yet aging). The bot's buy EV is
 * scored against these — a resource card is "worth buying" only when it
 * advances one of these recipes.
 */
function inFlightBillsFor(
  state: GameState,
  player: PlayerState,
): { bill: MashBill; pile: Card[] }[] {
  const out: { bill: MashBill; pile: Card[] }[] = [];
  for (const b of getPlayerBarrels(state, player.id)) {
    if (b.phase === "ready" || b.phase === "construction") {
      out.push({ bill: b.attachedMashBill, pile: b.productionCards });
    }
  }
  return out;
}

/**
 * For a single bill + existing pile, return the remaining unit demand
 * per subtype (and per specialty floor). All values clamped at 0.
 */
function neededUnits(bill: MashBill, pile: Card[]) {
  const recipe = bill.recipe ?? {};
  const sp = recipe.minSpecialty ?? {};
  const minCorn = Math.max(Math.max(1, recipe.minCorn ?? 0), sp.corn ?? 0);
  const minRye = Math.max(recipe.minRye ?? 0, sp.rye ?? 0);
  const minBarley = Math.max(recipe.minBarley ?? 0, sp.barley ?? 0);
  const minWheat = Math.max(recipe.minWheat ?? 0, sp.wheat ?? 0);

  const tally = tallyPile(pile);
  const spTally = { cask: 0, corn: 0, rye: 0, barley: 0, wheat: 0 };
  for (const c of pile) {
    if (c.type !== "resource" || !c.specialty) continue;
    const sub = c.subtype;
    if (!sub) continue;
    spTally[sub] += c.resourceCount ?? 1;
  }

  return {
    cask: Math.max(0, 1 - tally.cask),
    caskSp: Math.max(0, (sp.cask ?? 0) - spTally.cask),
    corn: Math.max(0, minCorn - tally.corn),
    cornSp: Math.max(0, (sp.corn ?? 0) - spTally.corn),
    rye: Math.max(0, minRye - tally.rye),
    ryeSp: Math.max(0, (sp.rye ?? 0) - spTally.rye),
    barley: Math.max(0, minBarley - tally.barley),
    barleySp: Math.max(0, (sp.barley ?? 0) - spTally.barley),
    wheat: Math.max(0, minWheat - tally.wheat),
    wheatSp: Math.max(0, (sp.wheat ?? 0) - spTally.wheat),
  };
}

/**
 * How much this market card is worth to `player` *right now*, independent
 * of its price. Higher = more useful. Negative = actively bad.
 *   - Resource (relevant subtype, needed by an in-flight bill): +1/+2 per
 *     covered unit, +1 bonus per covered Specialty floor.
 *   - Resource that no current bill needs: 0.25–1 (deck filler).
 *   - Generic Labor: +2 (flexible: aging fuel or buy supplement).
 *   - Specialty Labor (cooper/architect/marketing): +1.5 (situational).
 *   - Investment: -2 (on-buy effects not implemented yet — see bot.ts:75).
 *   - Operations: 0 (bought via the separate chooser; skipped here).
 *
 * The caller computes `net = ev - card.cost` and compares to a
 * difficulty-scaled threshold; ev is intentionally on the same axis as
 * rep so the math is interpretable.
 */
function evForCard(state: GameState, player: PlayerState, card: Card): number {
  if (card.type === "operations") return 0;
  if (card.type === "investment") return -2;

  if (card.type === "resource") {
    const sub = card.subtype;
    if (!sub) return 0;
    const inFlight = inFlightBillsFor(state, player);
    // Reputation is VP — buying a resource that no current recipe
    // needs is a direct VP leak. Score 0 when there's nothing to
    // advance; the bot will either save its rep, draft a new bill,
    // or pass. (Cheap commons may still slip through the net gate
    // on easy via the jitter, which is the point of easy.)
    if (inFlight.length === 0) return 0;
    const units = card.resourceCount ?? 1;
    let bestEv = 0;
    for (const { bill, pile } of inFlight) {
      const need = neededUnits(bill, pile);
      let ev = 0;
      // Specialty-floor coverage is weighted heavily: without it, the
      // entire bill is stranded in construction forever (no other card
      // can substitute). The bill's eventual sale reward dwarfs the
      // card's $2-$3 cost, so the EV here intentionally beats it.
      const SPECIALTY_UNLOCK_EV = 3;
      if (sub === "cask") {
        const useCask = Math.min(units, need.cask);
        ev += useCask * 2; // cask is mandatory exactly-1 per barrel
        if (card.specialty) {
          ev += Math.min(units, need.caskSp) * SPECIALTY_UNLOCK_EV;
        }
      } else {
        const baseNeed = need[sub];
        ev += Math.min(units, baseNeed) * 1;
        if (card.specialty) {
          const spKey = `${sub}Sp` as const;
          const spNeed = need[spKey];
          ev += Math.min(units, spNeed) * SPECIALTY_UNLOCK_EV;
        }
      }
      if (ev > bestEv) bestEv = ev;
    }
    // Card's subtype isn't needed by any in-flight bill.
    return bestEv;
  }

  if (card.type === "labor") {
    // Generic Labor is broadly useful (aging fuel + buy supplement).
    // Specialty Labor is only useful when its domain matches a near-
    // term buy — otherwise it's dead weight at $4 a card.
    return card.laborSubtype === "generic" ? 1.5 : 0.5;
  }

  return 0;
}

function chooseBuy(state: GameState, player: PlayerState): GameAction | null {
  const difficulty = difficultyOf(player);
  // Endgame: rep at game-end is wasted — relax the threshold so the
  // bot will burn surplus rep into anything mildly useful instead
  // of riding out the last rounds holding cash.
  const endgame =
    state.finalRoundTriggered ||
    state.bourbonDeck.length <= ENDGAME_FLUSH_ROUNDS;
  const netThreshold = endgame ? -2 : NET_THRESHOLD[difficulty];

  // rep is the currency. Labor cards in hand supplement rep — Cooper
  // +2 toward market resources (domain "market_resource"), Architect
  // +2 toward investments (domain "investment"), Generic +1 anywhere.
  // Specialty Labor with a non-matching domain contributes 0, so each
  // candidate card needs its own affordability calculation against
  // its own purchase domain.
  const cooperLabor = player.hand.filter(
    (c) => c.type === "labor" && c.laborSubtype === "cooper",
  );
  const architectLabor = player.hand.filter(
    (c) => c.type === "labor" && c.laborSubtype === "architect",
  );
  const genericLabor = player.hand.filter(
    (c) => c.type === "labor" && c.laborSubtype === "generic",
  );

  type Domain = "market_resource" | "investment";
  type Candidate = {
    slotIndex: number;
    netScore: number;
    cost: number;
    domain: Domain;
  };
  let best: Candidate | null = null;
  for (let i = 0; i < state.market.length; i++) {
    const card = state.market[i]!;
    // BUY_FROM_MARKET handles resource/labor/investment; ops cards
    // are bought via the separate chooser/action.
    if (card.type === "operations") continue;
    const domain: Domain =
      card.type === "investment" ? "investment" : "market_resource";
    const matchedLabor =
      domain === "investment"
        ? architectLabor.length * 2
        : cooperLabor.length * 2;
    const maxAffordable =
      player.reputation + matchedLabor + genericLabor.length;
    const cost = card.cost ?? 1;
    if (cost > maxAffordable) continue;

    // Sanity: cost must be coverable by rep after burning matched
    // Labor + Generic Labor in that order. (`maxAffordable` already
    // gates total affordability; this catches the matched-Labor edge
    // case where Specialty pays only into its domain.)
    const repCost = computeRepCost(
      cost,
      domain === "investment" ? architectLabor : cooperLabor,
      genericLabor,
    );
    if (repCost > player.reputation) continue;

    let ev = evForCard(state, player, card);
    if (difficulty === "easy") {
      // Deterministic ±1 jitter so easy plays make visibly varied picks
      // without going off the rails. Salted by rng state + slot index
      // so the same game seed reproduces identically.
      const salt = ((state.rngState ^ (i * 0x9e3779b1)) >>> 0) & 0xff;
      ev += (salt / 255) * 2 - 1;
    }
    const netScore = ev - cost;
    if (netScore < netThreshold) continue;
    if (!best || netScore > best.netScore) {
      best = { slotIndex: i, netScore, cost, domain };
    }
  }
  if (!best) return null;

  // Pay matched-domain Specialty first, then Generic, then rep.
  const laborIds: string[] = [];
  let covered = 0;
  const matchedLabor =
    best.domain === "investment" ? architectLabor : cooperLabor;
  for (const c of matchedLabor) {
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

/**
 * Rep portion of a buy after burning matched-domain Labor (+2 each) and
 * Generic Labor (+1 each), in that order. Mirrors the payment plan in
 * `chooseBuy` so the rep-floor gate uses the same number.
 */
function computeRepCost(cost: number, matched: Card[], generic: Card[]): number {
  let covered = 0;
  for (let i = 0; i < matched.length && covered < cost; i++) covered += 2;
  for (let i = 0; i < generic.length && covered < cost; i++) covered += 1;
  return Math.max(0, cost - covered);
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
  const heldDefIds = new Set(player.operationsHand.map((c) => c.defId));

  // Ops buys pay rep + Marketing/Generic Labor. Marketing contributes
  // +2 toward ops; Cooper / Architect contribute 0.
  const marketingLabor = player.hand.filter(
    (c) => c.type === "labor" && c.laborSubtype === "marketing",
  );
  const genericLabor = player.hand.filter(
    (c) => c.type === "labor" && c.laborSubtype === "generic",
  );
  const laborMax = marketingLabor.length * 2 + genericLabor.length;
  const maxAffordable = player.reputation + laborMax;

  let best: { slotIndex: number; cost: number; rank: number } | null = null;
  for (let i = 0; i < state.market.length; i++) {
    const card = state.market[i]!;
    if (card.type !== "operations" || !card.opSpec) continue;
    const spec = card.opSpec;
    if (heldDefIds.has(spec.defId)) continue;
    if (!OPS_BOT_PLAYABLE.has(spec.defId)) continue;
    const cost = card.cost ?? spec.cost;
    if (cost > maxAffordable) continue;
    const rank = OPS_BUY_PREFERENCE.indexOf(spec.defId);
    const effectiveRank = rank === -1 ? OPS_BUY_PREFERENCE.length : rank;
    if (
      !best ||
      effectiveRank < best.rank ||
      (effectiveRank === best.rank && cost < best.cost)
    ) {
      best = { slotIndex: i, cost, rank: effectiveRank };
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
    marketSlotIndex: best.slotIndex,
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
  "demand_surge",
  "market_manipulation",
  "bourbon_boom",
  "rushed_shipment",
  "kentucky_connection",
  "rating_boost",
  "allocation",
  "wild_mash",
  "glut",
  "regulatory_inspection",
];

const OPS_BOT_PLAYABLE = new Set<OperationsCard["defId"]>([
  "demand_surge",
  "market_manipulation",
  "bourbon_boom",
  "rushed_shipment",
  "kentucky_connection",
  "rating_boost",
  "allocation",
  "wild_mash",
  "glut",
  "regulatory_inspection",
]);

// -----------------------------
// INITIATE_DRAFTING_LOOP + sub-phase actions (DRAFT_*)
// -----------------------------
//
// Initiate when (a) we have slot room, (b) the deck has bills, (c) we
// haven't used the loop this round, (d) we're not already sitting on a
// "ready" barrel waiting for resources, and (e) we have a junk card to
// seed the pile. Once inside the loop, `chooseDraftAction` handles each
// of our picks (initiator or subsequent picker).

function chooseInitiateDraftingLoop(
  state: GameState,
  player: PlayerState,
): GameAction | null {
  if (state.finalRoundTriggered) return null;
  if (player.draftingLoopUsedThisRound) return null;
  if (state.bourbonDeck.length === 0) return null;
  if (emptySlotsFor(state, player.id).length === 0) return null;
  const difficulty = difficultyOf(player);
  // Cap concurrent unfinished bills. Without this the bot greedily
  // pulls Epic bills until every slot is a construction barrel, then
  // deadlocks when it has 0 rep and no way to buy the Specialty cards
  // those recipes demand. The cap forces the bot to age & sell what
  // it already started before taking on more.
  const inProgress = getPlayerBarrels(state, player.id).filter(
    (b) => b.phase === "ready" || b.phase === "construction",
  ).length;
  const inProgressCap = difficulty === "easy" ? 3 : 2;
  if (inProgress >= inProgressCap) return null;
  // Don't initiate just to add another ready slot if we already have
  // one — more slots = more recipe cards we owe. (Earlier drafts let
  // hard bypass this and pull a second bill cheaply, but combined
  // with the in-progress cap it just deadlocked hard games — the
  // existing ready bill never got finished while the new one stacked
  // up demands.)
  const hasReady = getPlayerBarrels(state, player.id).some(
    (b) => b.phase === "ready",
  );
  if (hasReady) return null;
  // Respect the slotted-bill cap (Connoisseur Estate).
  const billCap = player.distillery?.maxSlottedBills;
  if (billCap !== undefined && slottedBillCount(state, player.id) >= billCap) {
    return null;
  }
  const cardId = pickJunkCardForPile(player);
  if (!cardId) return null;
  return { type: "INITIATE_DRAFTING_LOOP", playerId: player.id, cardId };
}

/**
 * Pick a pick action (TAKE_CARD / TAKE_BILL / PASS) on behalf of a bot
 * picker inside an active Drafting Loop. Called by the runner whenever
 * `state.draftingLoop` is non-null and the current picker is a bot.
 */
export function chooseDraftAction(
  state: GameState,
  pickerId: string,
): GameAction {
  const loop = state.draftingLoop;
  if (!loop) return { type: "DRAFT_PASS", playerId: pickerId };
  const player = state.players.find((p) => p.id === pickerId);
  if (!player) return { type: "DRAFT_PASS", playerId: pickerId };
  const isInitiator = loop.initiatorId === pickerId;

  // 1) Subsequent pickers scavenge useful cards from the pile first.
  if (!isInitiator && loop.pickerStage === "card") {
    const usefulIds = pickUsefulPileCards(state, player, loop.draftPile);
    if (usefulIds.length > 0) {
      return { type: "DRAFT_TAKE_CARD", playerId: pickerId, cardIds: usefulIds };
    }
  }

  // 2) Initiator budget: at most 2 bills per loop (spec). Their seed
  //    card is in the pile at index 0; each additional card beyond that
  //    came from a bill take, so cap once they've added 3 cards total.
  const INITIATOR_PILE_CAP = 3;
  if (isInitiator && loop.draftPile.length >= INITIATOR_PILE_CAP) {
    return { type: "DRAFT_PASS", playerId: pickerId };
  }

  // 3) Try to take the best-scoring bill we can legally take.
  const billPick = pickBestRevealedBill(state, player, loop.revealedBills);
  if (billPick) {
    return {
      type: "DRAFT_TAKE_BILL",
      playerId: pickerId,
      mashBillId: billPick.billId,
      paymentCardId: billPick.paymentCardId,
    };
  }

  // 4) Nothing useful — pass and let the pile move along.
  return { type: "DRAFT_PASS", playerId: pickerId };
}

/**
 * Cards in the pile worth scavenging into our hand:
 *   - Labor (Generic or Specialty) — always valuable, scarce
 *   - Specialty / Heritage resources — premium cards we'd otherwise pay
 *     $2 / $3 for in the market
 *
 * Plain Commons are skipped — taking them is deck dilution. The spec's
 * "deck thinning" benefit only works when we leave junk in the pile.
 */
function pickUsefulPileCards(
  _state: GameState,
  _player: PlayerState,
  pile: Card[],
): string[] {
  const picks: string[] = [];
  for (const c of pile) {
    if (c.type === "labor") {
      picks.push(c.id);
      continue;
    }
    if (c.type === "resource" && c.specialty === true) {
      picks.push(c.id);
      continue;
    }
  }
  return picks;
}

interface BillPick {
  billId: string;
  paymentCardId: string;
}

/**
 * Score each revealed bill against the player's strategy and return the
 * top-scoring legal one (paired with a junk payment card). Returns null
 * when no bill clears the take-threshold or the player cannot pay.
 */
function pickBestRevealedBill(
  state: GameState,
  player: PlayerState,
  revealed: MashBill[],
): BillPick | null {
  if (revealed.length === 0) return null;
  if (emptySlotsFor(state, player.id).length === 0) return null;
  const billCap = player.distillery?.maxSlottedBills;
  if (billCap !== undefined && slottedBillCount(state, player.id) >= billCap) {
    return null;
  }
  const difficulty = difficultyOf(player);
  // Same in-progress cap as `chooseInitiateDraftingLoop`. The cap
  // gates new loops the bot starts; this gate prevents a bot from
  // gorging on bills from someone *else's* loop and ending up with
  // 4 construction barrels it can't finish.
  const inProgress = getPlayerBarrels(state, player.id).filter(
    (b) => b.phase === "ready" || b.phase === "construction",
  ).length;
  const inProgressCap = difficulty === "easy" ? 3 : 2;
  if (inProgress >= inProgressCap) return null;
  let best: { bill: MashBill; score: number } | null = null;
  for (const bill of revealed) {
    // High-Rye House cannot take wheated bills.
    if (
      player.distillery?.bonus === "high_rye_house" &&
      bill.recipe?.maxRye === 0
    ) {
      continue;
    }
    // Normal / hard: reject bills whose Specialty floors the bot
    // cannot reasonably satisfy. Easy can still snap up unreachable
    // bills (a visible mistake that costs them the slot — that's the
    // point of easy mode).
    if (difficulty !== "easy" && !canReachSpecialtyFloors(bill, player, state)) {
      continue;
    }
    const score = scoreBillForPlayer(bill, player, state);
    if (!best || score > best.score) best = { bill, score };
  }
  if (!best) return null;
  const paymentCardId = pickJunkCardForPile(player);
  if (!paymentCardId) return null;
  return { billId: best.bill.id, paymentCardId };
}

/**
 * Returns true when the bot has a plausible path to every Specialty
 * subtype floor on `bill`: at least one Specialty card of that subtype
 * sitting in the player's hand/deck/discard OR visible in the market
 * (where it can be bought before the recipe is committed). Bills that
 * fail this check should not be drafted on normal/hard — they tend to
 * land in a slot and never progress.
 */
function canReachSpecialtyFloors(
  bill: MashBill,
  player: PlayerState,
  state: GameState,
): boolean {
  const sp = bill.recipe?.minSpecialty;
  if (!sp) return true;
  // Approximate rep we could spend toward Specialty buys: current rep
  // plus Labor in hand (each Labor saves up to its contribution from
  // a buy). Slightly optimistic, but mirrors `chooseBuy`'s affordability.
  const cooperLabor = player.hand.filter(
    (c) => c.type === "labor" && c.laborSubtype === "cooper",
  ).length;
  const genericLabor = player.hand.filter(
    (c) => c.type === "labor" && c.laborSubtype === "generic",
  ).length;
  const buyBudget = player.reputation + cooperLabor * 2 + genericLabor;
  let unmetFromMarket = 0;
  for (const sub of ["cask", "corn", "rye", "barley", "wheat"] as const) {
    if ((sp[sub] ?? 0) === 0) continue;
    const inPersonalPool =
      player.hand.some(
        (c) => c.type === "resource" && c.specialty && c.subtype === sub,
      ) ||
      player.deck.some(
        (c) => c.type === "resource" && c.specialty && c.subtype === sub,
      ) ||
      player.discard.some(
        (c) => c.type === "resource" && c.specialty && c.subtype === sub,
      );
    if (inPersonalPool) continue;
    // Need to source from market. Cheapest Specialty of this subtype.
    const marketOpt = state.market.find(
      (c) => c.type === "resource" && c.specialty && c.subtype === sub,
    );
    if (!marketOpt) return false;
    unmetFromMarket += marketOpt.cost ?? 2;
  }
  return unmetFromMarket <= buyBudget;
}

function scoreBillForPlayer(
  bill: MashBill,
  player: PlayerState,
  state?: GameState,
): number {
  let score = peakReward(bill);
  const bonus = player.distillery?.bonus;
  const difficulty = difficultyOf(player);
  // Distillery synergy nudges — bumped on hard so the bot doubles
  // down on its archetype's strongest bills.
  const synergyBonus = difficulty === "hard" ? 2 : 1;
  if (bonus === "high_rye_house" && (bill.recipe?.minRye ?? 0) >= 1) {
    score += synergyBonus;
  }
  if (bonus === "wheated_baron" && bill.recipe?.maxRye === 0) {
    score += synergyBonus;
  }
  // Prestige-aware drafting: a Gold-eligible bill that the bot can
  // plausibly reach is worth +1 prestige (Connoisseur: +2) every time
  // it sells. Treat a reachable Gold as +4 expected rep (1 prestige
  // × ~4 future premium sales). Silver gets a smaller nudge (+1) —
  // it doesn't grant prestige outside Connoisseur, but it does
  // trigger the prestige multiplier on this sale.
  if (bill.goldAward != null) {
    const goldNudge = bonus === "connoisseur_estate" ? 8 : 4;
    score += goldNudge;
  } else if (bill.silverAward != null) {
    score += 1;
    if (bonus === "connoisseur_estate") score += 3; // grants prestige too
  }
  // Hard only: reachability penalty. If the bill demands a Specialty
  // subtype the player has neither in hand, in deck, nor visible in
  // the current market, drafting it sets up a stuck barrel — dock it.
  if (difficulty === "hard" && state) {
    const sp = bill.recipe?.minSpecialty;
    if (sp) {
      for (const sub of ["cask", "corn", "rye", "barley", "wheat"] as const) {
        if ((sp[sub] ?? 0) === 0) continue;
        const haveInHand = player.hand.some(
          (c) => c.type === "resource" && c.specialty && c.subtype === sub,
        );
        const haveInDeck =
          player.deck.some(
            (c) => c.type === "resource" && c.specialty && c.subtype === sub,
          ) ||
          player.discard.some(
            (c) => c.type === "resource" && c.specialty && c.subtype === sub,
          );
        const inMarket = state.market.some(
          (c) => c.type === "resource" && c.specialty && c.subtype === sub,
        );
        if (!haveInHand && !haveInDeck && !inMarket) {
          score -= 1;
        }
      }
    }
  }
  return score;
}

/**
 * Choose the junkiest card from the player's hand for use as a
 * pile-seed or bill payment. Preference order:
 *   1. Plain Common resources (lowest market cost, replaceable)
 *   2. Specialty resources (more valuable but still spendable)
 *   3. Labor cards (most valuable — finite, only as a last resort)
 *
 * Returns null when the player's hand is empty.
 */
function pickJunkCardForPile(player: PlayerState): string | null {
  if (player.hand.length === 0) return null;
  const commons = player.hand.filter(
    (c) => c.type === "resource" && c.specialty !== true,
  );
  if (commons.length > 0) return commons[0]!.id;
  const specialties = player.hand.filter(
    (c) => c.type === "resource" && c.specialty === true,
  );
  if (specialties.length > 0) return specialties[0]!.id;
  return player.hand[0]!.id;
}

// -----------------------------
// v3.0 Line system — pending-choice resolver
// -----------------------------
//
// Delegates to `ai/line-heuristics.ts` for the actual scoring. This
// function is invoked at the top of `chooseAction` so it can also
// short-circuit setup phases (a bot whose initial draft is still
// pending will resolve it here before the runner emits anything else).

import { chooseBottlePlacement } from "./line-heuristics";

function resolvePendingLineChoice(
  state: GameState,
  playerId: string,
): GameAction | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;
  if (player.pendingBottlePlacement) {
    const placement = chooseBottlePlacement(state, player);
    if (placement) return placement;
    // Defensive fallback — every game should reach the inventory leg
    // of chooseBottlePlacement; this only fires if a future refactor
    // forgets it.
    return {
      type: "PLACE_BOTTLE",
      playerId,
      destination: { kind: "inventory" },
    };
  }
  return null;
}
