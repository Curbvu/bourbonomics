// Bourbonomics — the reducer (ground-up rebuild).
//
// applyAction(state, action) is the engine's only mutation surface. It is pure:
// it deep-clones the incoming state, applies the action, advances the
// phase/round/end-of-game machinery, and returns either the new state or a
// typed refusal.
//
// A round runs Demand → Collect → Play:
//   • Demand : draw cards into the persistent market (auto on entry); zones by
//              count; crash at the 10th card; BEGIN_COLLECT advances.
//   • Collect: most-Capital-first dice draft (REROLL / TRIPLE_THREAT / CLAIM).
//   • Play   : round-robin, unlimited actions (DRAW_MASH_BILLS / STAGE / UNSTAGE
//              / MAKE_BOURBON / QUALITY_SORT / SELL / IMPROVE / END_TURN). When
//              all pass, age +1 and the next Demand Phase lays out.

import {
  CONFIG,
  activeSlotsForPlayerCount,
  barrelValue,
  improvementCost,
  zoneForCardCount,
  zoneMultiplier,
} from "./config";
import { buildDemandDeck, buildMashBillSupply, buildPile } from "./content";
import { rankPlayers } from "./scoring";
import { rngRange, shuffle } from "./rng";
import type {
  Action,
  ActionResult,
  Bourbon,
  DemandCard,
  DemandRequirement,
  Department,
  DepartmentId,
  Die,
  DieFace,
  GameState,
  Player,
  Quality,
  ResourceCard,
  ResourceKind,
  UltimateId,
} from "./types";

const ALL_KINDS: ResourceKind[] = ["cask", "corn", "rye", "wheat", "barley"];
const DIE_FACES: DieFace[] = ["cask", "corn", "rye", "wheat", "barley", "anything"];

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${idCounter}`;
}

function refuse(reason: string): ActionResult {
  return { ok: false, reason };
}

// ---------------------------------------------------------------------
// Department / ultimate helpers
// ---------------------------------------------------------------------

export function dept(player: Player, id: DepartmentId): Department {
  return player.distillery.departments.find((d) => d.id === id)!;
}

/** Quantitative effect magnitude at the department's current level. */
export function deptValue(player: Player, id: DepartmentId): number {
  const d = dept(player, id);
  return d.values[d.level]!;
}

/** True if the player chose `ult` for that branch's ultimate (branch is maxed). */
export function hasUlt(player: Player, id: DepartmentId, ult: UltimateId): boolean {
  return dept(player, id).chosenUltimate === ult;
}

// Department-driven capacities/effects (ultimate-aware). Exported so the UI
// reads the same numbers the engine enforces — no parallel cap logic.
export const rickhouseCapacity = (p: Player): number =>
  deptValue(p, "rickhouse") + (hasUlt(p, "rickhouse", "megaExpansion") ? CONFIG.ULT_MEGA_EXPANSION : 0);
export const supplyCap = (p: Player): number =>
  deptValue(p, "supply") + (hasUlt(p, "supply", "overflowRoll") ? CONFIG.ULT_OVERFLOW_ROLL : 0);
export const warehouseCap = (p: Player): number =>
  deptValue(p, "warehouse") + (hasUlt(p, "warehouse", "grandWarehouse") ? CONFIG.ULT_GRAND_WAREHOUSE : 0);
export const mashFloorDraw = (p: Player): number => deptValue(p, "mashFloor");
export const marketingDraw = (p: Player): number => deptValue(p, "marketing");
export const distributionBonus = (p: Player): number => deptValue(p, "distribution");
export const countingDiscount = (p: Player): number => deptValue(p, "countingHouse");
// Base level gets NO extra reroll after the first (free) roll; the Second
// Reroll ultimate grants one.
export const rerollsFor = (p: Player): number => (hasUlt(p, "supply", "secondReroll") ? 1 : 0);

// ---------------------------------------------------------------------
// Resource piles (five, face-down; blind quality off the top)
// ---------------------------------------------------------------------

function drawFromPile(draft: GameState, kind: ResourceKind): ResourceCard {
  if (draft.piles[kind].length === 0) {
    if (CONFIG.PILE_RESHUFFLE_ON_EMPTY && draft.pileDiscards[kind].length > 0) {
      const [reshuffled, seed] = shuffle(draft.pileDiscards[kind], draft.rngSeed);
      draft.piles[kind] = reshuffled;
      draft.pileDiscards[kind] = [];
      draft.rngSeed = seed;
      draft.log.push(`The ${kind} discard was reshuffled into its pile.`);
    } else {
      // Resources are effectively infinite — mint a fresh shuffled stack so a
      // claim never dead-ends on an empty pile (no empty-pile handling, per the
      // rules). Quality odds are preserved by buildPile.
      const [fresh, seed] = shuffle(buildPile(kind), draft.rngSeed);
      for (const c of fresh) c.id = nextId(`res_${kind}`);
      draft.piles[kind] = fresh;
      draft.rngSeed = seed;
      draft.log.push(`The ${kind} pile was replenished (resources are effectively infinite).`);
    }
  }
  return draft.piles[kind].shift()!;
}

const QUALITY_RANK: Record<Quality, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };

/**
 * Draw from a pile for a claim. The Prospector ultimate (on its chosen pile)
 * draws 2 and keeps the higher quality; the loser goes to that pile's discard.
 */
function drawForClaim(draft: GameState, player: Player, kind: ResourceKind): ResourceCard {
  const prospect =
    hasUlt(player, "supply", "prospector") && dept(player, "supply").ultimatePile === kind;
  if (!prospect) return drawFromPile(draft, kind);
  const a = drawFromPile(draft, kind);
  const b = drawFromPile(draft, kind);
  const better = QUALITY_RANK[a.quality] >= QUALITY_RANK[b.quality] ? a : b;
  const worse = better === a ? b : a;
  draft.pileDiscards[kind].push(worse);
  draft.log.push(`${player.name}'s Prospector drew 2 ${kind} and kept the ${better.quality}.`);
  return better;
}

// ---------------------------------------------------------------------
// Quality / recipe helpers
// ---------------------------------------------------------------------

function deriveQuality(cards: ResourceCard[]): Quality {
  let best: Quality = "common";
  for (const c of cards) if (QUALITY_RANK[c.quality] > QUALITY_RANK[best]) best = c.quality;
  return best;
}

function countByKind(cards: ResourceCard[]): Record<ResourceKind, number> {
  const counts: Record<ResourceKind, number> = { cask: 0, corn: 0, rye: 0, wheat: 0, barley: 0 };
  for (const c of cards) counts[c.kind] += 1;
  return counts;
}

function recipeSatisfied(
  recipe: Partial<Record<ResourceKind, number>>,
  name: string,
  cards: ResourceCard[],
): { ok: true } | { ok: false; reason: string } {
  const have = countByKind(cards);
  for (const k of ALL_KINDS) {
    const need = recipe[k] ?? 0;
    if (have[k] !== need) {
      return { ok: false, reason: `recipe for ${name} needs ${need} ${k} (got ${have[k]})` };
    }
  }
  return { ok: true };
}

function remainingNeed(barrel: Bourbon, kind: ResourceKind): number {
  const need = barrel.recipe[kind] ?? 0;
  const staged = barrel.staged.filter((c) => c.kind === kind).length;
  return Math.max(0, need - staged);
}

/** Does a built bourbon satisfy a demand card's Requirement section? */
export function meetsRequirement(bourbon: Bourbon, req: DemandRequirement): boolean {
  if (req.styleTag && bourbon.styleTag !== req.styleTag) return false;
  if (req.minAge !== undefined && bourbon.age < req.minAge) return false;
  if (req.quality && QUALITY_RANK[bourbon.quality] < QUALITY_RANK[req.quality]) return false;
  return true;
}

// ---------------------------------------------------------------------
// Demand market — persistent card pile, zones, crash, the clock
// ---------------------------------------------------------------------

/** Draw up to `n` demand cards, reshuffling the discard back in when the deck runs dry. */
function drawDemandCards(draft: GameState, n: number): DemandCard[] {
  const out: DemandCard[] = [];
  for (let i = 0; i < n; i++) {
    if (draft.demandDeck.length === 0) {
      if (draft.demandDiscard.length === 0) break; // pool exhausted (clock)
      const [reshuffled, seed] = shuffle(draft.demandDiscard, draft.rngSeed);
      draft.demandDeck = reshuffled;
      draft.demandDiscard = [];
      draft.rngSeed = seed;
      draft.log.push(`The demand discard reshuffled into the deck.`);
    }
    const card = draft.demandDeck.shift();
    if (card) out.push(card);
  }
  return out;
}

/** Activate a freshly-drawn card's slots: slotMultiple × player count. */
function activateCard(card: DemandCard, playerCount: number): void {
  card.slotsActive = activeSlotsForPlayerCount(playerCount, card.slotMultiple);
  card.filledBy = Array.from({ length: card.slotsActive }, () => null);
}

/** How many cards the Demand Phase draws (the spine, raised by the best Marketing). */
function demandDrawCount(draft: GameState): number {
  return Math.max(CONFIG.DEMAND_DRAW_PER_ROUND, ...draft.players.map((p) => marketingDraw(p)));
}

/** Schedule the final round if the configured clock is exhausted. */
function scheduleEndIfClockDone(draft: GameState): void {
  if (draft.finalRound !== null) return;
  const deckExhausted =
    CONFIG.CLOCK_MODE === "demand_deck" &&
    draft.demandDeck.length === 0 &&
    draft.demandDiscard.length === 0;
  if (deckExhausted) {
    draft.finalRound = draft.roundNumber;
    draft.log.push(`Demand deck exhausted — round ${draft.finalRound} is the final round.`);
  }
}

/**
 * Lay out the Demand Phase: check the crash (a draw that would reach the crash
 * count wipes the table — uncompleted cards reshuffle — and the fresh cards
 * become the new Low market), then draw and activate this round's cards.
 */
function runDemandPhase(draft: GameState): void {
  const n = demandDrawCount(draft);
  if (draft.demandCards.length + n >= CONFIG.DEMAND_CRASH_AT) {
    draft.demandDiscard.push(...draft.demandCards);
    const lost = draft.demandCards.length;
    draft.demandCards = [];
    draft.log.push(`📉 MARKET CRASH — ${lost} card(s) wiped (uncompleted orders lost).`);
  }
  const drawn = drawDemandCards(draft, n);
  for (const c of drawn) activateCard(c, draft.players.length);
  draft.demandCards.push(...drawn);
  draft.log.push(
    `Demand: drew ${drawn.length} card(s) — ${draft.demandCards.length} on the table (${zoneForCardCount(
      draft.demandCards.length,
    )} zone).`,
  );
  scheduleEndIfClockDone(draft);
}

// ---------------------------------------------------------------------
// Collect Phase — most-Capital-first dice draft
// ---------------------------------------------------------------------

function rollDie(draft: GameState): Die {
  const [pick, seed] = rngRange(draft.rngSeed, DIE_FACES.length);
  draft.rngSeed = seed;
  return { id: nextId("die"), face: DIE_FACES[pick]! };
}

function rollDice(draft: GameState, n: number): Die[] {
  const dice: Die[] = [];
  for (let i = 0; i < n; i++) dice.push(rollDie(draft));
  return dice;
}

function capitalOrder(draft: GameState): number[] {
  return draft.players
    .map((_, i) => i)
    .sort((a, b) => draft.players[b]!.capital - draft.players[a]!.capital || a - b);
}

function startCollectTurn(draft: GameState, inherited: Die[]): void {
  const c = draft.collect!;
  const pIndex = c.order[c.pos]!;
  const player = draft.players[pIndex]!;
  draft.currentPlayerIndex = pIndex;
  c.inherited = inherited.map((d) => ({ ...d }));
  c.dice = inherited.map((d) => ({ ...d })); // inherited dice go straight onto the table
  c.rerollsUsed = 0;
  c.maxRerolls = rerollsFor(player);
  c.tripleThreatUsed = false;
  if (inherited.length === 0) {
    // Nothing to keep — roll a full fresh set right away (first player / no leftovers).
    c.dice = rollDice(draft, supplyCap(player));
    c.rolled = true;
    draft.log.push(`${player.name} collects — rolled ${c.dice.map((d) => d.face).join(", ")}.`);
  } else {
    // Inherited dice await the player's keep-then-roll choice.
    c.rolled = false;
    draft.log.push(
      `${player.name} inherits ${inherited.length} die/dice (${inherited.map((d) => d.face).join(", ")}) — keep what you want, then roll.`,
    );
  }
}

function enterCollect(draft: GameState): void {
  draft.roundPhase = "collect";
  draft.collect = {
    order: capitalOrder(draft),
    pos: 0,
    inherited: [],
    dice: [],
    rolled: false,
    rerollsUsed: 0,
    maxRerolls: 0,
    tripleThreatUsed: false,
  };
  startCollectTurn(draft, []);
}

function handleCollectRoll(draft: GameState, keepDiceIds: string[]): string | null {
  const c = draft.collect!;
  const player = draft.players[draft.currentPlayerIndex]!;
  const keep = new Set(keepDiceIds);
  if (keep.size !== keepDiceIds.length) return "duplicate die ids";
  for (const id of keep) if (!c.dice.some((d) => d.id === id)) return `die ${id} is not in play`;
  const cap = supplyCap(player);
  const kept = c.dice.filter((d) => keep.has(d.id));

  if (!c.rolled) {
    // First (free) roll of the turn: keep chosen dice, fill the rest up to the cap.
    if (kept.length > cap) return `you may keep at most ${cap} dice`;
    c.dice = [...kept.map((d) => ({ ...d })), ...rollDice(draft, Math.max(0, cap - kept.length))];
    c.rolled = true;
    draft.log.push(`${player.name} rolls — ${c.dice.map((d) => d.face).join(", ")}.`);
    return null;
  }

  // A reroll after the first roll — costs a reroll allowance.
  if (c.rerollsUsed >= c.maxRerolls) return `no rerolls left (used ${c.rerollsUsed}/${c.maxRerolls})`;
  if (kept.length === c.dice.length) return "choose at least one die to reroll";
  c.dice = [...kept.map((d) => ({ ...d })), ...rollDice(draft, c.dice.length - kept.length)];
  c.rerollsUsed += 1;
  draft.log.push(
    `${player.name} rerolled ${c.dice.length - kept.length} ` +
      `(${c.rerollsUsed}/${c.maxRerolls}) → ${c.dice.map((d) => d.face).join(", ")}.`,
  );
  return null;
}

function handleTripleThreat(
  draft: GameState,
  player: Player,
  discardDiceIds: string[],
  face: DieFace,
): string | null {
  const c = draft.collect!;
  if (!hasUlt(player, "supply", "tripleThreat")) return "you don't have the Triple Threat ultimate";
  if (c.tripleThreatUsed) return "Triple Threat already used this turn";
  if (discardDiceIds.length !== 2) return "Triple Threat discards exactly 2 dice";
  const ids = new Set(discardDiceIds);
  if (ids.size !== 2) return "duplicate die ids";
  for (const id of ids) if (!c.dice.some((d) => d.id === id)) return `die ${id} is not in play`;
  if (!DIE_FACES.includes(face)) return `invalid face "${face}"`;
  c.dice = c.dice.filter((d) => !ids.has(d.id));
  c.dice.push({ id: nextId("die"), face });
  c.tripleThreatUsed = true;
  draft.log.push(`${player.name} used Triple Threat: discarded 2, took a ${face} die.`);
  return null;
}

function handleCollectClaim(
  draft: GameState,
  player: Player,
  claims: { dieId: string; pile?: ResourceKind }[],
): string | null {
  const c = draft.collect!;
  if (!c.rolled) return "roll your dice before drafting";
  const claimIds = new Set(claims.map((x) => x.dieId));
  if (claimIds.size !== claims.length) return "duplicate claimed die ids";

  const plan: { die: Die; pile: ResourceKind }[] = [];
  for (const { dieId, pile } of claims) {
    const die = c.dice.find((d) => d.id === dieId);
    if (!die) return `die ${dieId} is not in play`;
    let target: ResourceKind;
    if (die.face === "anything") {
      if (!pile || !ALL_KINDS.includes(pile)) return "an 'anything' die needs a pile to draw from";
      target = pile;
    } else {
      if (pile && pile !== die.face) return `that die is ${die.face}, not ${pile}`;
      target = die.face;
    }
    plan.push({ die, pile: target });
  }

  const cap = warehouseCap(player);
  if (player.hand.length + plan.length > cap) {
    return `Warehouse holds ${cap} — you have ${player.hand.length} and tried to claim ${plan.length}`;
  }

  const drawn: ResourceCard[] = plan.map(({ pile }) => drawForClaim(draft, player, pile));
  player.hand.push(...drawn);

  const leftovers = c.dice.filter((d) => !claimIds.has(d.id));
  draft.log.push(
    `${player.name} claimed ${plan.length} resource(s)` +
      `${leftovers.length ? `, passed ${leftovers.length} die/dice on` : ""}.`,
  );

  c.pos += 1;
  if (c.pos < c.order.length) startCollectTurn(draft, leftovers);
  else enterPlay(draft);
  return null;
}

// ---------------------------------------------------------------------
// Play Phase
// ---------------------------------------------------------------------

function enterPlay(draft: GameState): void {
  draft.roundPhase = "play";
  draft.collect = null;
  draft.currentPlayerIndex = draft.startPlayerIndex;
  for (const p of draft.players) {
    p.drewMashBillsThisTurn = false;
    p.donePlayThisRound = false;
  }
  draft.log.push(`— Play Phase (round ${draft.roundNumber}) —`);
}

/** In mash-bill-supply clock mode, schedule a final round when the supply empties. */
function maybeTriggerMashClock(draft: GameState): void {
  if (CONFIG.CLOCK_MODE !== "mash_bill_supply") return;
  if (draft.finalRound === null && draft.mashBillSupply.length === 0) {
    draft.finalRound = draft.roundNumber + 1;
    draft.log.push(`Mash bill supply exhausted — final round will be round ${draft.finalRound}.`);
  }
}

function endGame(draft: GameState): void {
  draft.phase = "ended";
  const winner = rankPlayers(draft)[0];
  if (winner) {
    draft.log.push(
      `Game over. Winner: ${winner.name} with ${winner.total} ` +
        `(${winner.capital} capital + ${winner.reputation} prestige).`,
    );
  }
}

function handleDrawMashBills(draft: GameState, player: Player, keepIndexes: number[]): string | null {
  if (player.drewMashBillsThisTurn) return "you have already drawn mash bills this turn";

  const reveal = mashFloorDraw(player);
  // The mash-bill supply reshuffles when drawn-from is exhausted (it is the
  // CLOCK only in mash_bill_supply mode; in the default demand-deck mode it is
  // effectively infinite, so production never deadlocks before the deck does).
  if (CONFIG.CLOCK_MODE !== "mash_bill_supply" && draft.mashBillSupply.length < reveal) {
    const [fresh, seed] = shuffle(buildMashBillSupply(), draft.rngSeed);
    for (const b of fresh) b.id = nextId(`mb_${b.defId}`);
    draft.mashBillSupply.push(...fresh);
    draft.rngSeed = seed;
    draft.log.push(`A fresh batch of mash bills was shuffled into the supply.`);
  }

  const offer = draft.mashBillSupply.slice(0, Math.min(reveal, draft.mashBillSupply.length));
  if (offer.length === 0) return "the mash bill supply is empty";

  const keep = new Set(keepIndexes);
  if (keep.size !== keepIndexes.length) return "duplicate keep indexes";
  for (const i of keep) if (i < 0 || i >= offer.length) return `keep index ${i} is out of range (revealed ${offer.length})`;

  const room = rickhouseCapacity(player) - player.rickhouse.length;
  if (keep.size > room) return `rickhouse has room for ${Math.max(0, room)} more barrel(s) — upgrade it to expand`;

  draft.mashBillSupply = draft.mashBillSupply.slice(offer.length);
  const rejected = offer.filter((_, i) => !keep.has(i));
  for (const i of keep) {
    const bill = offer[i]!;
    player.rickhouse.push({
      id: nextId("bourbon"),
      mashBillId: bill.id,
      name: bill.name,
      traits: [...bill.traits],
      expression: bill.expression,
      styleTag: bill.styleTag,
      recipe: { ...bill.recipe },
      staged: [],
      built: false,
      age: 0,
      quality: "common",
      batchQty: bill.batchQty,
      saleBonus: bill.saleBonus,
      salesRemaining: bill.batchQty,
      createdRound: draft.roundNumber,
      maturationBoosted: false,
    });
  }
  if (rejected.length > 0) {
    const [reshuffled, seed] = shuffle([...draft.mashBillSupply, ...rejected], draft.rngSeed);
    draft.mashBillSupply = reshuffled;
    draft.rngSeed = seed;
  }

  player.drewMashBillsThisTurn = true;
  maybeTriggerMashClock(draft);
  draft.log.push(
    `${player.name} drew ${offer.length} bill(s), kept ${keep.size} — ` +
      `rickhouse ${player.rickhouse.length}/${rickhouseCapacity(player)}.`,
  );
  return null;
}

function handleStage(
  draft: GameState,
  player: Player,
  barrelId: string,
  resourceCardId: string,
): string | null {
  const barrel = player.rickhouse.find((b) => b.id === barrelId);
  if (!barrel) return "barrel not found in your rickhouse";
  if (barrel.built) return "that barrel is already built";
  const card = player.hand.find((c) => c.id === resourceCardId);
  if (!card) return `resource ${resourceCardId} is not in hand`;
  if (remainingNeed(barrel, card.kind) <= 0) return `"${barrel.name}" doesn't need any more ${card.kind}`;
  player.hand = player.hand.filter((c) => c.id !== resourceCardId);
  barrel.staged.push(card);
  const need = Object.values(barrel.recipe).reduce((s, n) => s + (n ?? 0), 0);
  draft.log.push(`${player.name} staged a ${card.kind} onto "${barrel.name}" (${barrel.staged.length}/${need}).`);
  return null;
}

function handleUnstage(
  draft: GameState,
  player: Player,
  barrelId: string,
  resourceCardId: string,
): string | null {
  if (!hasUlt(player, "warehouse", "longCellar")) {
    return "staged cards are locked — the Long Cellar ultimate unlocks them";
  }
  const barrel = player.rickhouse.find((b) => b.id === barrelId);
  if (!barrel) return "barrel not found in your rickhouse";
  if (barrel.built) return "that barrel is already built";
  const idx = barrel.staged.findIndex((c) => c.id === resourceCardId);
  if (idx < 0) return `card ${resourceCardId} is not staged on "${barrel.name}"`;
  if (player.hand.length + 1 > warehouseCap(player)) return "Warehouse is full — no room to pull the card back";
  const [card] = barrel.staged.splice(idx, 1);
  player.hand.push(card!);
  draft.log.push(`${player.name} pulled a ${card!.kind} back off "${barrel.name}" (Long Cellar).`);
  return null;
}

function handleQualitySort(draft: GameState, player: Player, pile: ResourceKind): string | null {
  if (!hasUlt(player, "warehouse", "qualitySort")) return "you don't have the Quality Sort ultimate";
  if (player.qualitySortUsedThisRound) return "Quality Sort already used this round";
  if (!ALL_KINDS.includes(pile)) return `invalid pile "${pile}"`;
  if (player.hand.length + 1 > warehouseCap(player)) return "Warehouse is full — Quality Sort respects the cap";
  const card = drawFromPile(draft, pile);
  player.hand.push(card);
  player.qualitySortUsedThisRound = true;
  draft.log.push(`${player.name} used Quality Sort — a free ${card.quality} ${pile}.`);
  return null;
}

function handleMakeBourbon(
  draft: GameState,
  player: Player,
  barrelId: string,
  resourceCardIds: string[],
): string | null {
  const barrel = player.rickhouse.find((b) => b.id === barrelId);
  if (!barrel) return "barrel not found in your rickhouse";
  if (barrel.built) return "that barrel is already built and aging";

  const uniqueIds = new Set(resourceCardIds);
  if (uniqueIds.size !== resourceCardIds.length) return "duplicate resource card ids";
  const loose: ResourceCard[] = [];
  for (const id of resourceCardIds) {
    const card = player.hand.find((c) => c.id === id);
    if (!card) return `resource ${id} is not in hand`;
    loose.push(card);
  }

  const cards = [...barrel.staged, ...loose];
  const check = recipeSatisfied(barrel.recipe, barrel.name, cards);
  if (!check.ok) return check.reason;

  player.hand = player.hand.filter((c) => !uniqueIds.has(c.id));
  for (const c of cards) draft.pileDiscards[c.kind].push(c);

  barrel.staged = [];
  barrel.built = true;
  barrel.age = hasUlt(player, "rickhouse", "charToast") ? CONFIG.ULT_CHAR_TOAST_START_AGE : 0;
  barrel.quality = deriveQuality(cards);
  barrel.createdRound = draft.roundNumber;
  draft.log.push(`${player.name} built a ${barrel.quality} "${barrel.name}" (age ${barrel.age}) — now aging.`);
  return null;
}

/**
 * Sell (Extract) one sale from a built, aged batch into a matching demand-card
 * slot. Payoff = barrel value (quality base + age, capped by the quality
 * ceiling) + the card's zone effect + Distribution bonus. (There is no glut —
 * every sale fills an order.) Filling a card's FINAL slot hands the card to the
 * seller (Reputation). The final SALE of a batch frees the rickhouse slot.
 */
function handleSell(
  draft: GameState,
  player: Player,
  bourbonId: string,
  demandCardId: string | undefined,
): string | null {
  const idx = player.rickhouse.findIndex((b) => b.id === bourbonId);
  if (idx < 0) return "bourbon not found in your rickhouse";
  const bourbon = player.rickhouse[idx]!;

  if (!bourbon.built) return "barrel is not built yet — make bourbon first";
  if (bourbon.age < CONFIG.MIN_SELL_AGE) return `bourbon must be aged at least ${CONFIG.MIN_SELL_AGE} (age ${bourbon.age})`;
  if (bourbon.salesRemaining <= 0) return "this batch is already fully sold";

  // Every sale routes to a matching demand order (the glut is gone).
  if (demandCardId === undefined) return "choose a demand order to sell into";
  const card = draft.demandCards.find((c) => c.id === demandCardId);
  if (!card) return "that demand card is not on the table";
  if (!meetsRequirement(bourbon, card.requirement)) return `"${bourbon.name}" does not meet "${card.label}"`;
  const slot = card.filledBy.indexOf(null);
  if (slot < 0) return `"${card.label}" has no open slot`;

  const zone = zoneForCardCount(draft.demandCards.length);
  card.filledBy[slot] = player.id;
  // Payoff = (age-track value + the matched order's value) × the demand-zone
  // MULTIPLIER (×1/×2/×3 for Low/Mid/High), then the recipe-complexity premium
  // and Distribution added flat on top. The zone scales the bourbon-plus-order
  // core; the premium and distribution stay outside the multiply.
  const payoff =
    (barrelValue(bourbon.quality, bourbon.age) + card.orderValue) * zoneMultiplier(zone) +
    bourbon.saleBonus +
    distributionBonus(player);
  const completed = card.filledBy.every((f) => f !== null);

  player.capital += payoff;
  bourbon.salesRemaining -= 1;
  player.bourbonsSold += 1;
  const isFinal = bourbon.salesRemaining === 0;

  draft.log.push(`${player.name} sold "${bourbon.name}" (age ${bourbon.age}, ${bourbon.quality}) → "${card.label}" (${zone}) for ${payoff}.`);

  if (completed) {
    draft.demandCards = draft.demandCards.filter((c) => c.id !== card.id);
    player.keptCards.push(card);
    player.cardsCompleted += 1;
    draft.log.push(`🏅 ${player.name} completed "${card.label}" — kept for ${card.reputation} Prestige.`);
  }

  if (isFinal) {
    player.rickhouse.splice(idx, 1);
    draft.log.push(`"${bourbon.name}" is sold out — rickhouse slot freed.`);
  }
  return null;
}

function handleImprove(
  draft: GameState,
  player: Player,
  departmentId: DepartmentId,
  ultimateId: UltimateId | undefined,
  ultimatePile: ResourceKind | undefined,
): string | null {
  const d = dept(player, departmentId);
  if (!d) return `unknown department "${departmentId}"`;
  if (d.level >= d.maxLevel) return `${d.name} is already fully grown`;

  const discount = d.discount + countingDiscount(player);
  const cost = improvementCost(player.improvements, discount);
  if (player.capital < cost) return `improving ${d.name} costs ${cost} capital (have ${player.capital})`;

  const advancingToUltimate = d.level + 1 === d.maxLevel;
  let chosen: UltimateId | null = null;
  if (advancingToUltimate) {
    const options = d.ultimateOptions;
    if (options.length === 1) {
      chosen = options[0]!;
    } else {
      if (!ultimateId) return `choose an ultimate for ${d.name}: ${options.join(", ")}`;
      if (!options.includes(ultimateId)) return `"${ultimateId}" is not offered for ${d.name}`;
      chosen = ultimateId;
    }
    if (chosen === "prospector") {
      if (!ultimatePile || !ALL_KINDS.includes(ultimatePile)) return "Prospector needs a pile to commit to";
      d.ultimatePile = ultimatePile;
    }
  }

  player.capital -= cost;
  d.level += 1;
  player.improvements += 1;
  if (chosen) d.chosenUltimate = chosen;
  draft.log.push(
    `${player.name} improved ${d.name} to level ${d.level} for ${cost} capital` +
      `${chosen && chosen !== "ph" ? ` — ultimate: ${chosen}` : ""} ` +
      `(next improvement costs ${improvementCost(player.improvements, discount)}).`,
  );
  return null;
}

// ---------------------------------------------------------------------
// Round / end-of-game machinery
// ---------------------------------------------------------------------

/** End the round: age every built barrel (+ultimates), then start the next round (or end). */
function endRound(draft: GameState): void {
  for (const p of draft.players) {
    const built = p.rickhouse.filter((b) => b.built);
    // Climate Controlled designates the oldest aging barrel for +extra age.
    const designated = hasUlt(p, "rickhouse", "climateControlled")
      ? built.reduce<Bourbon | null>((old, b) => (!old || b.age > old.age ? b : old), null)
      : null;
    for (const b of built) {
      b.age += 1 + (b === designated ? CONFIG.ULT_CLIMATE_EXTRA_AGE : 0);
    }
    if (hasUlt(p, "rickhouse", "doubleMaturation")) {
      for (const b of built) {
        if (b.age >= CONFIG.ULT_DOUBLE_MATURATION_AGE && !b.maturationBoosted) {
          b.batchQty += CONFIG.ULT_DOUBLE_MATURATION_BONUS;
          b.salesRemaining += CONFIG.ULT_DOUBLE_MATURATION_BONUS;
          b.maturationBoosted = true;
          draft.log.push(`${p.name}'s "${b.name}" hit age ${b.age} — Double Maturation +1 batch.`);
        }
      }
    }
    if (hasUlt(p, "rickhouse", "warehouseTasting") && built.length >= CONFIG.ULT_WAREHOUSE_TASTING_MIN) {
      p.capital += CONFIG.ULT_WAREHOUSE_TASTING_CAPITAL;
    }
    p.qualitySortUsedThisRound = false;
  }
  draft.log.push(`Year passes — every aging barrel +1.`);

  // Backstop so the game always terminates (demand-deck clock stays primary).
  if (draft.finalRound === null && CONFIG.MAX_ROUNDS !== null && draft.roundNumber >= CONFIG.MAX_ROUNDS) {
    draft.finalRound = draft.roundNumber;
    draft.log.push(`Round limit (${CONFIG.MAX_ROUNDS}) reached — round ${draft.finalRound} is the final round.`);
  }

  if (draft.finalRound !== null && draft.roundNumber >= draft.finalRound) {
    endGame(draft);
    return;
  }

  draft.roundNumber += 1;
  draft.startPlayerIndex = (draft.startPlayerIndex + 1) % draft.players.length;
  draft.log.push(`— Round ${draft.roundNumber} begins —`);

  draft.roundPhase = "demand";
  draft.currentPlayerIndex = draft.startPlayerIndex;
  runDemandPhase(draft);
}

function advancePlay(draft: GameState): void {
  const n = draft.players.length;
  for (let step = 1; step <= n; step++) {
    const idx = (draft.currentPlayerIndex + step) % n;
    if (!draft.players[idx]!.donePlayThisRound) {
      draft.currentPlayerIndex = idx;
      draft.players[idx]!.drewMashBillsThisTurn = false;
      return;
    }
  }
  endRound(draft);
}

// ---------------------------------------------------------------------
// Public entry points
// ---------------------------------------------------------------------

/** Lay out the very first Demand Phase (called by setup on a fresh state). */
export function layoutInitialDemand(draft: GameState): void {
  runDemandPhase(draft);
}

export function applyAction(state: GameState, action: Action): ActionResult {
  if (state.phase === "ended") return refuse("game has ended");

  const draft: GameState = structuredClone(state);
  const player = draft.players[draft.currentPlayerIndex];
  if (!player) return refuse("no current player");

  switch (action.type) {
    case "BEGIN_COLLECT": {
      if (draft.roundPhase !== "demand") return refuse("not the Demand Phase");
      enterCollect(draft);
      return { ok: true, state: draft };
    }
    case "COLLECT_ROLL": {
      if (draft.roundPhase !== "collect") return refuse("not the Collect Phase");
      const error = handleCollectRoll(draft, action.keepDiceIds);
      return error ? refuse(error) : { ok: true, state: draft };
    }
    case "TRIPLE_THREAT": {
      if (draft.roundPhase !== "collect") return refuse("not the Collect Phase");
      const error = handleTripleThreat(draft, player, action.discardDiceIds, action.face);
      return error ? refuse(error) : { ok: true, state: draft };
    }
    case "COLLECT_CLAIM": {
      if (draft.roundPhase !== "collect") return refuse("not the Collect Phase");
      const error = handleCollectClaim(draft, player, action.claims);
      return error ? refuse(error) : { ok: true, state: draft };
    }
    case "DRAW_MASH_BILLS": {
      if (draft.roundPhase !== "play") return refuse("not the Play Phase");
      const error = handleDrawMashBills(draft, player, action.keepIndexes);
      return error ? refuse(error) : { ok: true, state: draft };
    }
    case "STAGE": {
      if (draft.roundPhase !== "play") return refuse("not the Play Phase");
      const error = handleStage(draft, player, action.barrelId, action.resourceCardId);
      return error ? refuse(error) : { ok: true, state: draft };
    }
    case "UNSTAGE": {
      if (draft.roundPhase !== "play") return refuse("not the Play Phase");
      const error = handleUnstage(draft, player, action.barrelId, action.resourceCardId);
      return error ? refuse(error) : { ok: true, state: draft };
    }
    case "QUALITY_SORT": {
      if (draft.roundPhase !== "play") return refuse("not the Play Phase");
      const error = handleQualitySort(draft, player, action.pile);
      return error ? refuse(error) : { ok: true, state: draft };
    }
    case "MAKE_BOURBON": {
      if (draft.roundPhase !== "play") return refuse("not the Play Phase");
      const error = handleMakeBourbon(draft, player, action.barrelId, action.resourceCardIds);
      return error ? refuse(error) : { ok: true, state: draft };
    }
    case "SELL": {
      if (draft.roundPhase !== "play") return refuse("not the Play Phase");
      const error = handleSell(draft, player, action.bourbonId, action.demandCardId);
      return error ? refuse(error) : { ok: true, state: draft };
    }
    case "IMPROVE": {
      if (draft.roundPhase !== "play") return refuse("not the Play Phase");
      const error = handleImprove(draft, player, action.departmentId, action.ultimateId, action.ultimatePile);
      return error ? refuse(error) : { ok: true, state: draft };
    }
    case "END_TURN": {
      if (draft.roundPhase !== "play") return refuse("not the Play Phase");
      player.donePlayThisRound = true;
      draft.log.push(`${player.name} ends their turn.`);
      advancePlay(draft);
      return { ok: true, state: draft };
    }
    default: {
      const _exhaustive: never = action;
      return refuse(`unknown action ${(_exhaustive as Action).type}`);
    }
  }
}
