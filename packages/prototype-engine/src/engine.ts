// Bourbonomics PROTOTYPE — the reducer.
//
// applyAction(state, action) is the engine's only mutation surface. It is
// pure: it deep-clones the incoming state, applies the action to the clone
// (the current player is always state.currentPlayerIndex), advances the
// round-robin / round / end-of-game machinery, and returns either the new
// state or a typed refusal. Bots and the network layer will drive this same
// Action shape in later batches.

import { CONFIG, openLineCost } from "./config";
import { buildDemandDeck, expressionToTags } from "./content";
import { rankPlayers } from "./scoring";
import { shuffle } from "./rng";
import type {
  Action,
  ActionResult,
  Bourbon,
  BrandLine,
  DemandCard,
  GameState,
  Player,
  Quality,
  ResourceCard,
  ResourceKind,
  RewardLeaf,
  SlotRewardSpec,
  StationId,
  Tag,
} from "./types";

// ---------------------------------------------------------------------
// Distillery stations
// ---------------------------------------------------------------------

/** Current effect magnitude of a player's station at its built tier (0 if absent). */
function stationLevel(player: Player, id: StationId): number {
  const st = player.distillery.stations.find((s) => s.id === id);
  return st ? st.levels[st.builtTier]! : 0;
}

/** Total barrel capacity = the rickhouse station's current level. */
function rickhouseCapacity(player: Player): number {
  return stationLevel(player, "rickhouse");
}

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

/** Human-readable recipe summary, e.g. "1 cask + 2 corn". */
function recipeText(recipe: Partial<Record<ResourceKind, number>>): string {
  const parts: string[] = [];
  for (const k of ["cask", "corn", "grain"] as ResourceKind[]) {
    const n = recipe[k] ?? 0;
    if (n > 0) parts.push(`${n} ${k}`);
  }
  return parts.length ? parts.join(" + ") : "nothing";
}

/** Count committed cards by kind. */
function countByKind(cards: ResourceCard[]): Record<ResourceKind, number> {
  const counts: Record<ResourceKind, number> = { cask: 0, corn: 0, grain: 0 };
  for (const c of cards) counts[c.kind] += 1;
  return counts;
}

/** The committed cards must satisfy the recipe exactly (no missing, no extras). */
function recipeSatisfied(
  recipe: Partial<Record<ResourceKind, number>>,
  name: string,
  cards: ResourceCard[],
): { ok: true } | { ok: false; reason: string } {
  const have = countByKind(cards);
  const kinds: ResourceKind[] = ["cask", "corn", "grain"];
  for (const k of kinds) {
    const need = recipe[k] ?? 0;
    if (have[k] !== need) {
      return {
        ok: false,
        reason: `recipe for ${name} needs ${need} ${k} (got ${have[k]})`,
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
 * Whether placing a bottle of `age` into empty slot `i` keeps the line's ages
 * non-decreasing left→right (ties allowed). Empty slots between are skipped —
 * only the nearest FILLED neighbors constrain the placement.
 */
function slotAgeEligible(line: BrandLine, i: number, age: number): boolean {
  if (i < 0 || i >= line.slots.length) return false;
  if (line.slots[i] !== null) return false;
  for (let l = i - 1; l >= 0; l--) {
    const s = line.slots[l];
    if (s) {
      if (s.age > age) return false;
      break;
    }
  }
  for (let r = i + 1; r < line.slots.length; r++) {
    const s = line.slots[r];
    if (s) {
      if (s.age < age) return false;
      break;
    }
  }
  return true;
}

/** Resolve a slot's reward spec into a concrete leaf, honoring a player choice. */
function resolveReward(
  spec: SlotRewardSpec,
  bourbon: Bourbon,
  rewardChoice: number | undefined,
): RewardLeaf {
  switch (spec.kind) {
    case "flat":
      return spec.reward;
    case "choice":
      return spec.options[rewardChoice ?? 0] ?? spec.options[0]!;
    case "gated": {
      const ageOk =
        spec.gate.minAge === undefined || bourbon.age >= spec.gate.minAge;
      const qualityOk =
        spec.gate.minQuality === undefined ||
        QUALITY_RANK[bourbon.quality] >= QUALITY_RANK[spec.gate.minQuality];
      return ageOk && qualityOk ? spec.hit : spec.miss;
    }
  }
}

/** Pay out a concrete reward leaf (capital / prestige / age-prestige / resources). */
function payReward(
  draft: GameState,
  player: Player,
  leaf: RewardLeaf,
  bourbon: Bourbon,
): void {
  player.capital += leaf.capital ?? 0;
  player.prestige += leaf.prestige ?? 0;
  if (leaf.prestigeFromAge) player.prestige += bourbon.age;
  if (leaf.resources && leaf.resources > 0) {
    player.hand.push(...drawResources(draft, leaf.resources));
  }
}

interface Placement {
  line: BrandLine;
  slotIndex: number;
}

/**
 * Place a bottle into a chosen slot, fire its (possibly chosen/gated) reward
 * and any trait-matched marketing. Mutates player/draft. Assumes the slot has
 * already been validated as eligible by the caller.
 */
function placeBourbon(
  draft: GameState,
  player: Player,
  placement: Placement,
  bourbon: Bourbon,
  rewardChoice: number | undefined,
): void {
  const { line, slotIndex } = placement;
  line.slots[slotIndex] = bourbon;
  line.ageCeiling = highestAge(line);

  const spec = line.slotCard.slots[slotIndex];
  if (spec) {
    payReward(draft, player, resolveReward(spec.reward, bourbon, rewardChoice), bourbon);
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

/** Clamp a demand level into [floor, cap]. */
function clampDemand(v: number): number {
  return Math.max(CONFIG.DEMAND_FLOOR, Math.min(CONFIG.DEMAND_CAP, v));
}

/** Draw n demand cards, rebuilding + reshuffling a fresh deck when it empties. */
function drawDemandCards(draft: GameState, n: number): DemandCard[] {
  const out: DemandCard[] = [];
  for (let i = 0; i < n; i++) {
    if (draft.demandDeck.length === 0) {
      const [fresh, seed] = shuffle(buildDemandDeck(), draft.rngSeed);
      draft.demandDeck = fresh;
      draft.rngSeed = seed;
    }
    const card = draft.demandDeck.shift();
    if (card) out.push(card);
  }
  return out;
}

/** Deal a fresh demand row (one card per player) and recompute the flood lines. */
function dealDemandRow(draft: GameState): void {
  draft.demandCards = drawDemandCards(draft, draft.players.length);
  draft.blueLine = draft.demandCards.reduce((sum, c) => sum + c.blueCapacity, 0);
  draft.redLine = draft.demandCards.reduce((sum, c) => sum + c.redCapacity, 0);
}

/**
 * Resolve the round's flood band into next round's deferred demand move. The
 * heavy-flood IMMEDIATE drop already fired live during the round (the cliff in
 * handleExtract); this applies only the deferred part:
 *   underserved (cubes < blue)     → +1
 *   moderate    (blue ≤ cubes < red)→ −1
 *   heavy       (cubes ≥ red)       → −1 (extended pain; immediate already hit)
 */
function resolveDemandBand(draft: GameState): void {
  let delta: number;
  let band: string;
  if (draft.cubesPlaced < draft.blueLine) {
    delta = 1;
    band = "underserved";
  } else if (draft.cubesPlaced < draft.redLine) {
    delta = -1;
    band = "moderate flood";
  } else {
    delta = -1;
    band = "heavy flood (extended)";
  }
  draft.demand = clampDemand(draft.demand + delta);
  draft.log.push(
    `Demand ${band}: ${draft.cubesPlaced} sold vs blue ${draft.blueLine}/red ${draft.redLine} → demand ${draft.demand}.`,
  );
}

/** Global rising trend: +1 every DEMAND_RISE_EVERY rounds at the Year Pass. */
function applyGlobalRise(draft: GameState): void {
  if (draft.roundNumber % CONFIG.DEMAND_RISE_EVERY !== 0) return;
  const before = draft.demand;
  draft.demand = clampDemand(draft.demand + 1);
  if (draft.demand !== before) {
    draft.log.push(`The market drifts up (rising trend) → demand ${draft.demand}.`);
  }
}

/**
 * Whether a batch with these tags can sell into the market this round: some
 * drawn card must demand its style — an exact-tag slot, or an "open" slot on
 * the broad card. A tagless batch (no recipeTags) is universally eligible.
 * Non-consuming: eligibility is a per-round signal, not a limited resource.
 */
function canSellTags(state: GameState, tags: Tag[]): boolean {
  if (tags.length === 0) return true;
  return state.demandCards.some((card) =>
    card.slots.some(
      (slot) => slot.tagRestriction === "open" || tags.includes(slot.tagRestriction),
    ),
  );
}

/** UI/bot helper: can a batch with these tags sell into the market right now? */
export function hasEligibleDemandSlot(state: GameState, tags: Tag[]): boolean {
  return canSellTags(state, tags);
}

/** End-of-round: age, move demand, refill, rotate, maybe end the game. */
function endRound(draft: GameState): void {
  // 1. Age every BUILT barrel. Unbuilt barrels (recipe placeholders) don't age.
  for (const p of draft.players) {
    for (const b of p.rickhouse) if (b.built) b.age += 1;
  }

  // 2. Resolve the round's flood band + apply the global rising trend, then
  //    clear the flood meter and deal a fresh demand row for next round. (Any
  //    heavy-flood IMMEDIATE drop already fired live during the round.)
  resolveDemandBand(draft);
  applyGlobalRise(draft);
  draft.cubesPlaced = 0;
  dealDemandRow(draft);

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
  const cap = rickhouseCapacity(player);
  if (player.rickhouse.length >= cap) {
    return `rickhouse is full (cap ${cap}) — upgrade the rickhouse to expand`;
  }
  const [kept] = draft.mashBillTray.splice(keepIndex, 1);
  // Keeping a mash bill lays down an UNBUILT barrel: it shows the recipe it
  // needs and does NOT age until MAKE_BOURBON commits the resources.
  const barrel: Bourbon = {
    id: nextId("bourbon"),
    mashBillId: kept!.id,
    name: kept!.name,
    traits: [...kept!.traits],
    expression: kept!.expression,
    recipeTags: expressionToTags(kept!.expression),
    recipe: { ...kept!.recipe },
    built: false,
    age: 0,
    quality: "common",
    batchQty: kept!.batchQty,
    salesRemaining: kept!.batchQty,
    matrix: kept!.matrix,
    createdRound: draft.roundNumber,
  };
  player.rickhouse.push(barrel);
  // Take-and-refill: pull one replacement from the face-down supply.
  refillMashBillTray(draft);
  maybeTriggerFinalRound(draft);
  draft.log.push(
    `${player.name} laid down "${kept!.name}" to rest — needs ${recipeText(kept!.recipe)} (rickhouse ${player.rickhouse.length}/${cap}).`,
  );
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
  barrelId: string,
  resourceCardIds: string[],
): string | null {
  // Target an UNBUILT barrel already resting in the rickhouse.
  const barrel = player.rickhouse.find((b) => b.id === barrelId);
  if (!barrel) return "barrel not found in your rickhouse";
  if (barrel.built) return "that barrel is already built and aging";

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

  const check = recipeSatisfied(barrel.recipe, barrel.name, cards);
  if (!check.ok) return check.reason;

  // Commit all required cards in one action: remove from hand → COMMUNAL
  // discard, build the barrel, and start it aging. Quality = best committed.
  player.hand = player.hand.filter((c) => !uniqueIds.has(c.id));
  draft.resourceDiscard.push(...cards);

  barrel.built = true;
  barrel.age = 0;
  barrel.quality = deriveQuality(cards);
  barrel.createdRound = draft.roundNumber;
  draft.log.push(
    `${player.name} built a ${barrel.quality} "${barrel.name}" — now aging.`,
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
    slots: slotCard!.slots.map(() => null),
    ageCeiling: null,
    marketingCards: [],
  };
  player.brandLines.push(line);
  draft.log.push(
    `${player.name} opened brand line "${slotCard!.name}" for ${cost} capital.`,
  );
  return null;
}

/**
 * Extract one sale from a built, aged batch. Every extraction banks the
 * age×demand matrix value. An INTERMEDIATE extraction (salesRemaining > 1)
 * stops there: no demand cool, no placement, the batch stays in the rickhouse.
 * The FINAL extraction (salesRemaining → 0) additionally cools demand, pays
 * the flat completion bonus, frees the rickhouse slot, and mints + places the
 * bottle into a brand line (the placement/staircase rules are unchanged).
 */
function handleExtract(
  draft: GameState,
  player: Player,
  bourbonId: string,
  brandLineId: string | undefined,
  slotIndex: number | undefined,
  rewardChoice: number | undefined,
): string | null {
  const idx = player.rickhouse.findIndex((b) => b.id === bourbonId);
  if (idx < 0) return "bourbon not found in your rickhouse";
  const bourbon = player.rickhouse[idx]!;

  if (!bourbon.built) return "barrel is not built yet — make bourbon first";
  if (bourbon.age < CONFIG.MIN_SELL_AGE) {
    return `bourbon must be aged at least ${CONFIG.MIN_SELL_AGE} (age ${bourbon.age})`;
  }
  if (bourbon.salesRemaining <= 0) return "this batch is already fully sold";

  // Tag gate: a batch can sell only if its style is demanded this round (a
  // matching focused card or the broad card is on the table). No demand → hold.
  if (!canSellTags(draft, bourbon.recipeTags)) {
    return "no demand for this batch's style this round";
  }

  const isFinal = bourbon.salesRemaining === 1;

  // The final sale mints a bottle, so it needs a valid placement. Validate it
  // up-front (before any mutation) so a refusal leaves the batch untouched.
  let placement: Placement | null = null;
  if (isFinal) {
    if (brandLineId === undefined || slotIndex === undefined) {
      return "the final sale of a batch must be placed into a brand line";
    }
    const line = player.brandLines.find((l) => l.id === brandLineId);
    if (!line) return "target brand line not found — open a line first";
    if (slotIndex < 0 || slotIndex >= line.slots.length) {
      return `slot ${slotIndex} is out of range`;
    }
    if (line.slots[slotIndex] !== null) return "that slot is already filled";
    if (!slotAgeEligible(line, slotIndex, bourbon.age)) {
      return "that slot would break the line's age order (staircase)";
    }
    const spec = line.slotCard.slots[slotIndex]!;
    // Expressions: an optional slot must match its paired required's age.
    if (spec.matchAgeOfSlot !== undefined) {
      const paired = line.slots[spec.matchAgeOfSlot];
      if (!paired) return "the paired slot must be filled first";
      if (paired.age !== bourbon.age) {
        return `this slot must match the paired bottle's age (${paired.age})`;
      }
    }
    // Validate an explicit choice index against the option count.
    if (spec.reward.kind === "choice" && rewardChoice !== undefined) {
      if (rewardChoice < 0 || rewardChoice >= spec.reward.options.length) {
        return `reward choice ${rewardChoice} is out of range`;
      }
    }
    placement = { line, slotIndex };
  }

  // Place the sale-cube and re-check the flood cliff IMMEDIATELY: if this cube
  // reaches the red line, the demand level drops now — so this very sale (and
  // any later one this round) cashes at the reduced level. Completed sales are
  // never clawed back.
  draft.cubesPlaced += 1;
  if (draft.cubesPlaced === draft.redLine) {
    draft.demand = clampDemand(draft.demand - 1);
  }

  // Bank the age×demand matrix value at the current (possibly just-cut) level.
  const value = matrixValue(bourbon.matrix, bourbon.age, draft.demand);
  player.capital += value;
  bourbon.salesRemaining -= 1;
  player.bourbonsSold += 1;

  if (!isFinal) {
    // Intermediate: banks Capital and floods the market, but mints no bottle —
    // the batch stays in the rickhouse to keep aging.
    draft.log.push(
      `${player.name} extracted a sale of "${bourbon.name}" (age ${bourbon.age}) for ${value} — ${bourbon.salesRemaining}/${bourbon.batchQty} left; flood ${draft.cubesPlaced}/${draft.redLine}, demand ${draft.demand}.`,
    );
    return null;
  }

  // Final sale: pay the completion bonus (flat base + the bottling station),
  // tick the tasting-room prestige, free the rickhouse slot, and mint + place
  // the bottle. All demand cooling runs through the flood meter above.
  const completionBonus = CONFIG.COMPLETION_BONUS + stationLevel(player, "bottling");
  player.capital += completionBonus;
  player.prestige += stationLevel(player, "tastingRoom");
  player.rickhouse.splice(idx, 1);
  placeBourbon(draft, player, placement!, bourbon, rewardChoice);

  draft.log.push(
    `${player.name} sold out "${bourbon.name}" (age ${bourbon.age}) — final sale ${value} +${completionBonus} bonus into "${placement!.line.slotCard.name}" slot ${placement!.slotIndex + 1}; flood ${draft.cubesPlaced}/${draft.redLine}, demand ${draft.demand}.`,
  );
  return null;
}

function handleBuildUpgrade(
  draft: GameState,
  player: Player,
  stationId: StationId,
): string | null {
  const station = player.distillery.stations.find((s) => s.id === stationId);
  if (!station) return `unknown station "${stationId}"`;
  if (station.builtTier >= station.maxTier) {
    return `${station.name} is already fully upgraded`;
  }
  const next = station.builtTier + 1;
  const cost = station.costs[next] ?? 0;
  if (player.capital < cost) {
    return `upgrading ${station.name} costs ${cost} capital (have ${player.capital})`;
  }
  // Pay Capital and remove the cover — permanent, no upkeep.
  player.capital -= cost;
  station.builtTier = next;
  draft.log.push(
    `${player.name} upgraded ${station.name} to tier ${next} for ${cost} capital (effect now ${station.levels[next]}).`,
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
      error = handleMakeBourbon(draft, player, action.barrelId, action.resourceCardIds);
      break;
    case "DRAW_MARKETING":
      error = handleDrawMarketing(draft, player, action.keepIndex, action.brandLineId);
      break;
    case "OPEN_BRAND_LINE":
      error = handleOpenBrandLine(draft, player, action.slotCardId);
      break;
    case "BUILD_UPGRADE":
      error = handleBuildUpgrade(draft, player, action.stationId);
      break;
    case "EXTRACT":
      error = handleExtract(
        draft,
        player,
        action.bourbonId,
        action.brandLineId,
        action.slotIndex,
        action.rewardChoice,
      );
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
