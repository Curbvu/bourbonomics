// Bourbonomics PROTOTYPE — the reducer.
//
// applyAction(state, action) is the engine's only mutation surface. It is
// pure: it deep-clones the incoming state, applies the action to the clone
// (the current player is always state.currentPlayerIndex), advances the
// round-robin / round / end-of-game machinery, and returns either the new
// state or a typed refusal. Bots and the network layer will drive this same
// Action shape in later batches.

import { CONFIG, openLineCost } from "./config";
import { buildForecastDeck } from "./content";
import { rankPlayers } from "./scoring";
import { shuffle } from "./rng";
import type {
  Action,
  ActionResult,
  Bourbon,
  BrandLine,
  ForecastCard,
  GameState,
  MashBill,
  Player,
  Quality,
  ResourceCard,
  ResourceKind,
} from "./types";

let idCounter = 0;
/** Monotonic id helper for runtime entities (bourbons, lines). */
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${idCounter}`;
}

function refuse(reason: string): ActionResult {
  return { ok: false, reason };
}

// ---------------------------------------------------------------------
// Communal resource pool
// ---------------------------------------------------------------------

/** Draw up to n cards, reshuffling the communal discard when the deck empties. */
function drawResources(draft: GameState, n: number): ResourceCard[] {
  const drawn: ResourceCard[] = [];
  for (let i = 0; i < n; i++) {
    if (draft.resourceDeck.length === 0) {
      if (draft.resourceDiscard.length === 0) break; // pool fully exhausted
      const [reshuffled, seed] = shuffle(draft.resourceDiscard, draft.rngSeed);
      draft.resourceDeck = reshuffled;
      draft.resourceDiscard = [];
      draft.rngSeed = seed;
      draft.log.push("Resource discard reshuffled into the deck.");
    }
    const card = draft.resourceDeck.shift();
    if (card) drawn.push(card);
  }
  return drawn;
}

/** Top up the face-up resource market from the communal deck. */
function refillResourceMarket(draft: GameState): void {
  const need = CONFIG.RESOURCE_MARKET_SIZE - draft.resourceMarket.length;
  if (need <= 0) return;
  draft.resourceMarket.push(...drawResources(draft, need));
}

// ---------------------------------------------------------------------
// Quality / recipe helpers
// ---------------------------------------------------------------------

const QUALITY_RANK: Record<Quality, number> = {
  common: 0,
  specialty: 1,
  heritage: 2,
};

/** Highest tier among committed resources sets the bourbon's quality. */
function deriveQuality(cards: ResourceCard[]): Quality {
  let best: Quality = "common";
  for (const c of cards) {
    if (QUALITY_RANK[c.quality] > QUALITY_RANK[best]) best = c.quality;
  }
  return best;
}

/** Count committed cards by kind. */
function countByKind(cards: ResourceCard[]): Record<ResourceKind, number> {
  const counts: Record<ResourceKind, number> = { cask: 0, corn: 0, grain: 0 };
  for (const c of cards) counts[c.kind] += 1;
  return counts;
}

/** The committed cards must satisfy the recipe exactly (no missing, no extras). */
function recipeSatisfied(
  bill: MashBill,
  cards: ResourceCard[],
): { ok: true } | { ok: false; reason: string } {
  const have = countByKind(cards);
  const kinds: ResourceKind[] = ["cask", "corn", "grain"];
  for (const k of kinds) {
    const need = bill.recipe[k] ?? 0;
    if (have[k] !== need) {
      return {
        ok: false,
        reason: `recipe for ${bill.name} needs ${need} ${k} (got ${have[k]})`,
      };
    }
  }
  return { ok: true };
}

// ---------------------------------------------------------------------
// Matrix lookup (clamped direct index)
// ---------------------------------------------------------------------

/** matrix[age][demand], clamped to the grid's bounds. */
export function matrixValue(matrix: number[][], age: number, demand: number): number {
  if (matrix.length === 0) return 0;
  const row = matrix[Math.max(0, Math.min(matrix.length - 1, age))]!;
  if (row.length === 0) return 0;
  return row[Math.max(0, Math.min(row.length - 1, demand))]!;
}

// ---------------------------------------------------------------------
// Brand-line placement
// ---------------------------------------------------------------------

/** Highest filled age in a line, or null if empty. */
function highestAge(line: BrandLine): number | null {
  let max: number | null = null;
  for (const slot of line.slots) {
    if (slot && (max === null || slot.age > max)) max = slot.age;
  }
  return max;
}

/**
 * First empty slot index where placing a bourbon of `age` keeps the line's
 * ages non-decreasing left→right (ties allowed). null if none fits.
 */
function eligibleSlotIndex(line: BrandLine, age: number): number | null {
  for (let i = 0; i < line.slots.length; i++) {
    if (line.slots[i] !== null) continue;
    // Nearest filled neighbor to the left must be <= age.
    let leftOk = true;
    for (let l = i - 1; l >= 0; l--) {
      const s = line.slots[l];
      if (s) {
        leftOk = s.age <= age;
        break;
      }
    }
    // Nearest filled neighbor to the right must be >= age.
    let rightOk = true;
    for (let r = i + 1; r < line.slots.length; r++) {
      const s = line.slots[r];
      if (s) {
        rightOk = s.age >= age;
        break;
      }
    }
    if (leftOk && rightOk) return i;
  }
  return null;
}

interface Placement {
  line: BrandLine;
  slotIndex: number;
}

/** Find a brand line + slot for a bourbon; honor an explicit line if given. */
function findPlacement(
  player: Player,
  bourbon: Bourbon,
  brandLineId?: string,
): Placement | null {
  const lines = brandLineId
    ? player.brandLines.filter((l) => l.id === brandLineId)
    : player.brandLines;
  for (const line of lines) {
    const idx = eligibleSlotIndex(line, bourbon.age);
    if (idx !== null) return { line, slotIndex: idx };
  }
  return null;
}

/** Place a bottle, fire the slot reward + trait-matched marketing. Mutates player. */
function placeBourbon(player: Player, placement: Placement, bourbon: Bourbon): void {
  const { line, slotIndex } = placement;
  line.slots[slotIndex] = bourbon;
  line.ageCeiling = highestAge(line);

  const reward = line.slotCard.slotRewards[slotIndex];
  if (reward) {
    player.capital += reward.capital ?? 0;
    player.prestige += reward.prestige ?? 0;
  }

  for (const mkt of line.marketingCards) {
    const matches = mkt.requiredTraits.every((t) => bourbon.traits.includes(t));
    if (matches) player.prestige += mkt.prestigeOnMatch;
  }
}

// ---------------------------------------------------------------------
// Trays / forecast / round machinery
// ---------------------------------------------------------------------

/** Top up the mash bill tray from the face-down supply (drains the end clock). */
function refillMashBillTray(draft: GameState): void {
  while (
    draft.mashBillTray.length < CONFIG.MASH_BILL_TRAY_SIZE &&
    draft.mashBillSupply.length > 0
  ) {
    draft.mashBillTray.push(draft.mashBillSupply.shift()!);
  }
}

function refillMarketingTray(draft: GameState): void {
  while (
    draft.marketingTray.length < CONFIG.MARKETING_TRAY_SIZE &&
    draft.marketingDeck.length > 0
  ) {
    draft.marketingTray.push(draft.marketingDeck.shift()!);
  }
}

/** Once the bill supply empties, schedule one final equal-turn round. */
function maybeTriggerFinalRound(draft: GameState): void {
  if (draft.finalRound === null && draft.mashBillSupply.length === 0) {
    draft.finalRound = draft.roundNumber + 1;
    draft.log.push(
      `Mash bill supply exhausted — final round will be round ${draft.finalRound}.`,
    );
  }
}

function drawForecast(draft: GameState): ForecastCard | undefined {
  if (draft.forecastDeck.length === 0) {
    const [fresh, seed] = shuffle(buildForecastDeck(), draft.rngSeed);
    draft.forecastDeck = fresh;
    draft.rngSeed = seed;
  }
  return draft.forecastDeck.shift();
}

/** End-of-round: age, move demand, refill, rotate, maybe end the game. */
function endRound(draft: GameState): void {
  // 1. Age every barrel.
  for (const p of draft.players) {
    for (const b of p.rickhouse) b.age += 1;
  }

  // 2. Advance demand by the front forecast card, then refill the forecast.
  const card = draft.demandForecast.shift();
  if (card) {
    const applies =
      card.onlyIfDemandBelow === undefined || draft.demand < card.onlyIfDemandBelow;
    if (applies) {
      draft.demand = Math.max(
        CONFIG.DEMAND_FLOOR,
        Math.min(CONFIG.DEMAND_CAP, draft.demand + card.delta),
      );
    }
    draft.log.push(`Demand forecast "${card.label}" → demand ${draft.demand}.`);
  }
  while (draft.demandForecast.length < CONFIG.FORECAST_VISIBLE) {
    const next = drawForecast(draft);
    if (!next) break;
    draft.demandForecast.push(next);
  }

  // 3. Refill trays (the mash bill refill drains the end clock).
  refillMashBillTray(draft);
  refillMarketingTray(draft);
  maybeTriggerFinalRound(draft);

  // 4. End the game after the scheduled final round completes.
  if (draft.finalRound !== null && draft.roundNumber >= draft.finalRound) {
    endGame(draft);
    return;
  }

  // 5. Start the next round: rotate start player, refresh actions.
  draft.roundNumber += 1;
  draft.startPlayerIndex = (draft.startPlayerIndex + 1) % draft.players.length;
  draft.currentPlayerIndex = draft.startPlayerIndex;
  for (const p of draft.players) p.actionsRemaining = CONFIG.ACTIONS_PER_ROUND;
  draft.actionsRemaining = CONFIG.ACTIONS_PER_ROUND;
  draft.log.push(`— Round ${draft.roundNumber} begins —`);
}

function endGame(draft: GameState): void {
  draft.phase = "ended";
  const ranked = rankPlayers(draft);
  const winner = ranked[0];
  if (winner) {
    draft.log.push(
      `Game over. Winner: ${winner.name} with ${winner.total} ` +
        `(${winner.capital} capital + ${winner.prestigeAsCapital} from prestige).`,
    );
  }
}

/**
 * After a successful action, consume one of the current player's actions and
 * advance the round-robin: next player with actions remaining, or end the
 * round when everyone is spent.
 */
function consumeActionAndAdvance(draft: GameState): void {
  const current = draft.players[draft.currentPlayerIndex]!;
  current.actionsRemaining -= 1;

  const n = draft.players.length;
  for (let step = 1; step <= n; step++) {
    const idx = (draft.currentPlayerIndex + step) % n;
    if (draft.players[idx]!.actionsRemaining > 0) {
      draft.currentPlayerIndex = idx;
      draft.actionsRemaining = draft.players[idx]!.actionsRemaining;
      return;
    }
  }
  // Nobody has actions left → the round is over.
  endRound(draft);
}

// ---------------------------------------------------------------------
// Action handlers — each returns null on success or a refusal reason string.
// They mutate `draft` directly (the clone owned by applyAction).
// ---------------------------------------------------------------------

function handleDrawResources(draft: GameState, player: Player): string | null {
  const drawn = drawResources(draft, CONFIG.RESOURCE_DRAW_COUNT);
  if (drawn.length === 0) return "resource pool is empty";
  player.hand.push(...drawn);
  draft.log.push(`${player.name} drew ${drawn.length} resource(s).`);
  return null;
}

function handleTakeMarketResources(
  draft: GameState,
  player: Player,
  cardIds: string[],
): string | null {
  const ids = new Set(cardIds);
  if (ids.size !== cardIds.length) return "duplicate resource card ids";
  if (draft.resourceMarket.length === 0) return "the market is empty";

  // Must take exactly RESOURCE_DRAW_COUNT, unless the market is running low.
  const want = Math.min(CONFIG.RESOURCE_DRAW_COUNT, draft.resourceMarket.length);
  if (cardIds.length !== want) {
    return `select exactly ${want} resource card(s) from the market`;
  }

  const picked: ResourceCard[] = [];
  for (const id of cardIds) {
    const card = draft.resourceMarket.find((c) => c.id === id);
    if (!card) return `resource ${id} is not in the market`;
    picked.push(card);
  }

  // Remove from market, hand to the player, then refill from the deck.
  draft.resourceMarket = draft.resourceMarket.filter((c) => !ids.has(c.id));
  player.hand.push(...picked);
  refillResourceMarket(draft);
  draft.log.push(`${player.name} took ${picked.length} resource(s) from the market.`);
  return null;
}

function handleDrawMashBills(
  draft: GameState,
  player: Player,
  keepIndex: number,
): string | null {
  if (draft.mashBillTray.length === 0) return "mash bill tray is empty";
  if (keepIndex < 0 || keepIndex >= draft.mashBillTray.length) {
    return `keepIndex ${keepIndex} out of range`;
  }
  const [kept] = draft.mashBillTray.splice(keepIndex, 1);
  player.mashBills.push(kept!);
  // Take-and-refill: pull one replacement from the face-down supply.
  refillMashBillTray(draft);
  maybeTriggerFinalRound(draft);
  draft.log.push(`${player.name} kept mash bill "${kept!.name}".`);
  return null;
}

function handleDrawSlotCard(
  draft: GameState,
  player: Player,
  slotDefId?: string,
): string | null {
  const idx = slotDefId
    ? draft.slotCardSupply.findIndex((c) => c.defId === slotDefId)
    : 0;
  if (idx < 0 || draft.slotCardSupply.length === 0) {
    return "no matching slot card available";
  }
  const [card] = draft.slotCardSupply.splice(idx, 1);
  player.slotCards.push(card!);
  draft.log.push(`${player.name} took slot card "${card!.name}".`);
  return null;
}

function handleMakeBourbon(
  draft: GameState,
  player: Player,
  mashBillId: string,
  resourceCardIds: string[],
): string | null {
  if (player.rickhouse.length >= CONFIG.RICKHOUSE_CAPACITY) {
    return `rickhouse is full (cap ${CONFIG.RICKHOUSE_CAPACITY})`;
  }
  const bill = player.mashBills.find((b) => b.id === mashBillId);
  if (!bill) return "you do not hold that mash bill";

  const uniqueIds = new Set(resourceCardIds);
  if (uniqueIds.size !== resourceCardIds.length) {
    return "duplicate resource card ids";
  }
  const cards: ResourceCard[] = [];
  for (const id of resourceCardIds) {
    const card = player.hand.find((c) => c.id === id);
    if (!card) return `resource ${id} is not in hand`;
    cards.push(card);
  }

  const check = recipeSatisfied(bill, cards);
  if (!check.ok) return check.reason;

  // Commit: remove from hand, push to COMMUNAL discard.
  player.hand = player.hand.filter((c) => !uniqueIds.has(c.id));
  draft.resourceDiscard.push(...cards);

  const bourbon: Bourbon = {
    id: nextId("bourbon"),
    mashBillId: bill.id,
    name: bill.name,
    traits: [...bill.traits],
    age: 0,
    quality: deriveQuality(cards),
    matrix: bill.matrix,
    createdRound: draft.roundNumber,
  };
  player.rickhouse.push(bourbon);
  draft.log.push(
    `${player.name} made a ${bourbon.quality} "${bourbon.name}" (rickhouse ${player.rickhouse.length}/${CONFIG.RICKHOUSE_CAPACITY}).`,
  );
  return null;
}

function handleDrawMarketing(
  draft: GameState,
  player: Player,
  keepIndex: number,
  brandLineId: string,
): string | null {
  if (draft.marketingTray.length === 0) return "marketing tray is empty";
  if (keepIndex < 0 || keepIndex >= draft.marketingTray.length) {
    return `keepIndex ${keepIndex} out of range`;
  }
  const line = player.brandLines.find((l) => l.id === brandLineId);
  if (!line) return "target brand line not found";

  const card = draft.marketingTray[keepIndex]!;

  // Validate attachment BEFORE paying or mutating the tray.
  if (line.marketingCards.length >= CONFIG.MARKETING_STACK_CAP) {
    return `brand line already at marketing cap (${CONFIG.MARKETING_STACK_CAP})`;
  }
  if (line.marketingCards.some((m) => m.exclusiveGroup === card.exclusiveGroup)) {
    return `a conflicting "${card.exclusiveGroup}" marketing card is already attached`;
  }

  const free = !player.usedFreeMarketing;
  if (!free && player.capital < CONFIG.MARKETING_DRAW_COST) {
    return `not enough capital (need ${CONFIG.MARKETING_DRAW_COST})`;
  }

  // Commit.
  if (free) {
    player.usedFreeMarketing = true;
  } else {
    player.capital -= CONFIG.MARKETING_DRAW_COST;
  }
  draft.marketingTray.splice(keepIndex, 1);
  refillMarketingTray(draft);
  line.marketingCards.push(card);
  draft.log.push(
    `${player.name} attached "${card.name}"${free ? " (free)" : ""} to a brand line.`,
  );
  return null;
}

function handleOpenBrandLine(
  draft: GameState,
  player: Player,
  slotCardId: string,
): string | null {
  const cardIdx = player.slotCards.findIndex((c) => c.id === slotCardId);
  if (cardIdx < 0) return "you do not hold that slot card";

  const cost = openLineCost(player.brandLines.length);
  if (player.capital < cost) {
    return `opening a line costs ${cost} capital (have ${player.capital})`;
  }
  player.capital -= cost;

  const [slotCard] = player.slotCards.splice(cardIdx, 1);
  const line: BrandLine = {
    id: nextId("line"),
    slotCard: slotCard!,
    slots: slotCard!.slotRewards.map(() => null),
    ageCeiling: null,
    marketingCards: [],
  };
  player.brandLines.push(line);
  draft.log.push(
    `${player.name} opened brand line "${slotCard!.name}" for ${cost} capital.`,
  );
  return null;
}

function handleSellBourbon(
  draft: GameState,
  player: Player,
  bourbonId: string,
  brandLineId?: string,
): string | null {
  const idx = player.rickhouse.findIndex((b) => b.id === bourbonId);
  if (idx < 0) return "bourbon not found in your rickhouse";
  const bourbon = player.rickhouse[idx]!;

  if (bourbon.age < CONFIG.MIN_SELL_AGE) {
    return `bourbon must be aged at least ${CONFIG.MIN_SELL_AGE} (age ${bourbon.age})`;
  }

  // Must be placeable — Batch 1 sells into a brand-line slot.
  const placement = findPlacement(player, bourbon, brandLineId);
  if (!placement) {
    return brandLineId
      ? "no eligible slot in the chosen brand line (age order)"
      : "no eligible brand-line slot — open a line first";
  }

  // Bank capital from the age×demand matrix, then drop demand.
  const value = matrixValue(bourbon.matrix, bourbon.age, draft.demand);
  player.capital += value;
  draft.demand = Math.max(CONFIG.DEMAND_FLOOR, draft.demand - 1);
  player.bourbonsSold += 1;

  // Remove from rickhouse and place the bottle (fires slot + marketing rewards).
  player.rickhouse.splice(idx, 1);
  placeBourbon(player, placement, bourbon);

  draft.log.push(
    `${player.name} sold "${bourbon.name}" (age ${bourbon.age}) for ${value} capital; demand ${draft.demand}.`,
  );
  return null;
}

// ---------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------

export function applyAction(state: GameState, action: Action): ActionResult {
  if (state.phase === "ended") return refuse("game has ended");

  const draft: GameState = structuredClone(state);
  const player = draft.players[draft.currentPlayerIndex];
  if (!player) return refuse("no current player");
  if (player.actionsRemaining <= 0) return refuse("no actions remaining");

  let error: string | null;
  switch (action.type) {
    case "DRAW_RESOURCES":
      error = handleDrawResources(draft, player);
      break;
    case "TAKE_MARKET_RESOURCES":
      error = handleTakeMarketResources(draft, player, action.cardIds);
      break;
    case "DRAW_MASH_BILLS":
      error = handleDrawMashBills(draft, player, action.keepIndex);
      break;
    case "DRAW_SLOT_CARD":
      error = handleDrawSlotCard(draft, player, action.slotDefId);
      break;
    case "MAKE_BOURBON":
      error = handleMakeBourbon(draft, player, action.mashBillId, action.resourceCardIds);
      break;
    case "DRAW_MARKETING":
      error = handleDrawMarketing(draft, player, action.keepIndex, action.brandLineId);
      break;
    case "OPEN_BRAND_LINE":
      error = handleOpenBrandLine(draft, player, action.slotCardId);
      break;
    case "SELL_BOURBON":
      error = handleSellBourbon(draft, player, action.bourbonId, action.brandLineId);
      break;
    default: {
      const _exhaustive: never = action;
      return refuse(`unknown action ${(_exhaustive as Action).type}`);
    }
  }

  if (error) return refuse(error);

  consumeActionAndAdvance(draft);
  return { ok: true, state: draft };
}
