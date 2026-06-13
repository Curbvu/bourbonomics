// Bourbonomics — the reducer (ground-up revision).
//
// applyAction(state, action) is the engine's only mutation surface. It is
// pure: it deep-clones the incoming state, applies the action to the clone,
// advances the phase / round / end-of-game machinery, and returns either the
// new state or a typed refusal.
//
// A round runs Demand → Collect → Play:
//   • Demand : lay out the round's demand (auto on entry); BEGIN_COLLECT advances.
//   • Collect: most-Capital-first dice draft (COLLECT_REROLL / COLLECT_CLAIM).
//   • Play   : round-robin, unlimited actions (DRAW_MASH_BILLS / MAKE_BOURBON /
//              SELL / IMPROVE / END_TURN). When all pass, age +1 and next round.

import { CONFIG, improvementCost } from "./config";
import { buildDemandDeck, expressionToTags } from "./content";
import { rankPlayers } from "./scoring";
import { rngRange, shuffle } from "./rng";
import type {
  Action,
  ActionResult,
  Bourbon,
  DemandCard,
  Department,
  DepartmentId,
  Die,
  DieFace,
  GameState,
  Player,
  Quality,
  ResourceCard,
  ResourceKind,
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
// Department helpers
// ---------------------------------------------------------------------

function dept(player: Player, id: DepartmentId): Department | undefined {
  return player.distillery.departments.find((d) => d.id === id);
}

/** Current effect magnitude of a department at its level (0 if absent). */
function deptValue(player: Player, id: DepartmentId): number {
  const d = dept(player, id);
  return d ? d.values[d.level]! : 0;
}

const rickhouseCapacity = (p: Player): number => deptValue(p, "rickhouse");
const supplyCap = (p: Player): number => deptValue(p, "supply");
const warehouseCap = (p: Player): number => deptValue(p, "warehouse");
const officeDraw = (p: Player): number => deptValue(p, "distillingOffice");
const tastingBonus = (p: Player): number => deptValue(p, "tastingRoom");
const marketingCards = (p: Player): number => deptValue(p, "marketing");

/** A Supply upgrade (level ≥ 1) grants a second reroll. */
const rerollsFor = (p: Player): number => (dept(p, "supply")!.level >= 1 ? 2 : 1);

/** Apply the distillery's signature ability for one sale. */
function applySignature(player: Player, bourbon: Bourbon, isFinal: boolean): void {
  switch (player.distillery.signature) {
    case "volumeBonus":
      player.capital += CONFIG.VOLUME_BONUS;
      break;
    case "ryeBonus":
      if (bourbon.recipeTags.includes("rye")) player.capital += CONFIG.RYE_BONUS;
      break;
    case "agedPrestige":
      if (isFinal && bourbon.age >= CONFIG.AGED_PRESTIGE_MIN_AGE) {
        player.prestige += CONFIG.AGED_PRESTIGE;
      }
      break;
    case "none":
      break;
  }
}

// ---------------------------------------------------------------------
// Resource piles (five, face-down; blind quality off the top)
// ---------------------------------------------------------------------

/**
 * Draw one card blind off the top of a pile. When the pile empties, reshuffle
 * its own per-type discard back in (config-gated). Returns null only if both
 * the pile and its discard are empty.
 */
function drawFromPile(draft: GameState, kind: ResourceKind): ResourceCard | null {
  if (draft.piles[kind].length === 0) {
    if (!CONFIG.PILE_RESHUFFLE_ON_EMPTY || draft.pileDiscards[kind].length === 0) {
      return null;
    }
    const [reshuffled, seed] = shuffle(draft.pileDiscards[kind], draft.rngSeed);
    draft.piles[kind] = reshuffled;
    draft.pileDiscards[kind] = [];
    draft.rngSeed = seed;
    draft.log.push(`The ${kind} discard was reshuffled into its pile.`);
  }
  return draft.piles[kind].shift() ?? null;
}

// ---------------------------------------------------------------------
// Quality / recipe helpers
// ---------------------------------------------------------------------

const QUALITY_RANK: Record<Quality, number> = { common: 0, specialty: 1, heritage: 2 };

/** Highest tier among committed resources sets the bourbon's quality. */
function deriveQuality(cards: ResourceCard[]): Quality {
  let best: Quality = "common";
  for (const c of cards) if (QUALITY_RANK[c.quality] > QUALITY_RANK[best]) best = c.quality;
  return best;
}

function recipeText(recipe: Partial<Record<ResourceKind, number>>): string {
  const parts: string[] = [];
  for (const k of ALL_KINDS) {
    const n = recipe[k] ?? 0;
    if (n > 0) parts.push(`${n} ${k}`);
  }
  return parts.length ? parts.join(" + ") : "nothing";
}

function countByKind(cards: ResourceCard[]): Record<ResourceKind, number> {
  const counts: Record<ResourceKind, number> = { cask: 0, corn: 0, rye: 0, wheat: 0, barley: 0 };
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
  for (const k of ALL_KINDS) {
    const need = recipe[k] ?? 0;
    if (have[k] !== need) {
      return { ok: false, reason: `recipe for ${name} needs ${need} ${k} (got ${have[k]})` };
    }
  }
  return { ok: true };
}

/** matrix[age][demand], clamped to the grid's bounds. */
export function matrixValue(matrix: number[][], age: number, demand: number): number {
  if (matrix.length === 0) return 0;
  const row = matrix[Math.max(0, Math.min(matrix.length - 1, age))]!;
  if (row.length === 0) return 0;
  return row[Math.max(0, Math.min(row.length - 1, demand))]!;
}

// ---------------------------------------------------------------------
// Demand (PLACEHOLDER) — lay out the round's demand picture
// ---------------------------------------------------------------------

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

/**
 * Lay out the round's demand. Marketing shapes how many cards are laid down —
 * with a shared market, the table's best marketer sets the count (`[PH]`). The
 * round's matrix demand level is the highest level among the laid-out cards.
 * Holds for the whole round (forecastable). 🚧 PLACEHOLDER demand content.
 */
function layOutDemand(draft: GameState): void {
  const count = Math.max(1, ...draft.players.map((p) => marketingCards(p)));
  draft.demandCards = drawDemandCards(draft, count);
  draft.demand = clampDemand(
    draft.demandCards.reduce<number>((m, c) => Math.max(m, c.level), CONFIG.DEMAND_FALLBACK),
  );
  draft.log.push(
    `Demand laid out: ${draft.demandCards.map((c) => c.label).join(", ")} → demand level ${draft.demand}.`,
  );
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

/** Player order for the Collect pass: most Capital first, ties by seat index. */
function capitalOrder(draft: GameState): number[] {
  return draft.players
    .map((_, i) => i)
    .sort((a, b) => draft.players[b]!.capital - draft.players[a]!.capital || a - b);
}

/**
 * Begin a collect turn for the player at `collect.pos`, inheriting `inherited`
 * leftover dice. Fresh dice are rolled to fill up to the player's Supply cap
 * (inherited-kept + fresh ≤ cap). Sets the active player as current.
 */
function startCollectTurn(draft: GameState, inherited: Die[]): void {
  const c = draft.collect!;
  const pIndex = c.order[c.pos]!;
  const player = draft.players[pIndex]!;
  draft.currentPlayerIndex = pIndex;
  const fresh = rollDice(draft, Math.max(0, supplyCap(player) - inherited.length));
  c.dice = [...inherited, ...fresh];
  c.rerollsUsed = 0;
  c.maxRerolls = rerollsFor(player);
  draft.log.push(
    `${player.name} collects — rolled ${c.dice.map((d) => d.face).join(", ")}` +
      `${inherited.length ? ` (incl. ${inherited.length} inherited)` : ""}.`,
  );
}

/** Enter the Collect Phase: compute the pass order and start the first turn. */
function enterCollect(draft: GameState): void {
  draft.roundPhase = "collect";
  draft.collect = { order: capitalOrder(draft), pos: 0, dice: [], rerollsUsed: 0, maxRerolls: 1 };
  startCollectTurn(draft, []);
}

// ---------------------------------------------------------------------
// Play Phase
// ---------------------------------------------------------------------

/** Enter the Play Phase: round-robin from the start player, reset per-turn flags. */
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

/** Once the bill supply empties, schedule one final equal-turn round. */
function maybeTriggerFinalRound(draft: GameState): void {
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
        `(${winner.capital} capital + ${winner.prestigeAsCapital} from prestige).`,
    );
  }
}

/** End the round: age every built barrel, then start the next round (or end). */
function endRound(draft: GameState): void {
  for (const p of draft.players) {
    for (const b of p.rickhouse) if (b.built) b.age += 1;
  }
  draft.log.push(`Year passes — every aging barrel +1.`);

  if (draft.finalRound !== null && draft.roundNumber >= draft.finalRound) {
    endGame(draft);
    return;
  }

  draft.roundNumber += 1;
  draft.startPlayerIndex = (draft.startPlayerIndex + 1) % draft.players.length;
  draft.log.push(`— Round ${draft.roundNumber} begins —`);

  // Demand Phase of the new round: lay out demand, await BEGIN_COLLECT.
  draft.roundPhase = "demand";
  draft.currentPlayerIndex = draft.startPlayerIndex;
  layOutDemand(draft);
}

/** Advance the Play round-robin to the next player who hasn't ended their turn. */
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
  // Everyone has ended their Play turn → close the round.
  endRound(draft);
}

// ---------------------------------------------------------------------
// Action handlers — return null on success or a refusal reason string.
// ---------------------------------------------------------------------

function handleCollectReroll(draft: GameState, diceIds: string[]): string | null {
  const c = draft.collect!;
  if (c.rerollsUsed >= c.maxRerolls) {
    return `no rerolls left (used ${c.rerollsUsed}/${c.maxRerolls})`;
  }
  if (diceIds.length === 0) return "choose at least one die to reroll";
  const ids = new Set(diceIds);
  if (ids.size !== diceIds.length) return "duplicate die ids";
  for (const id of ids) {
    if (!c.dice.some((d) => d.id === id)) return `die ${id} is not in play`;
  }
  c.dice = c.dice.map((d) => (ids.has(d.id) ? rollDie(draft) : d));
  c.rerollsUsed += 1;
  draft.log.push(
    `${draft.players[draft.currentPlayerIndex]!.name} rerolled ${ids.size} die/dice ` +
      `(${c.rerollsUsed}/${c.maxRerolls}) → ${c.dice.map((d) => d.face).join(", ")}.`,
  );
  return null;
}

function handleCollectClaim(
  draft: GameState,
  player: Player,
  claims: { dieId: string; pile?: ResourceKind }[],
): string | null {
  const c = draft.collect!;
  const claimIds = new Set(claims.map((x) => x.dieId));
  if (claimIds.size !== claims.length) return "duplicate claimed die ids";

  // Validate every claim before drawing anything.
  const plan: { die: Die; pile: ResourceKind }[] = [];
  for (const { dieId, pile } of claims) {
    const die = c.dice.find((d) => d.id === dieId);
    if (!die) return `die ${dieId} is not in play`;
    let target: ResourceKind;
    if (die.face === "anything") {
      if (!pile || !ALL_KINDS.includes(pile)) {
        return "an 'anything' die needs a pile to draw from";
      }
      target = pile;
    } else {
      if (pile && pile !== die.face) return `that die is ${die.face}, not ${pile}`;
      target = die.face;
    }
    plan.push({ die, pile: target });
  }

  // Warehouse cap: held cards + new claims must fit.
  const cap = warehouseCap(player);
  if (player.hand.length + plan.length > cap) {
    return `Warehouse holds ${cap} — you have ${player.hand.length} and tried to claim ${plan.length}`;
  }

  // Draw blind for each claim (a mid-draw empty pile refuses cleanly).
  const drawn: ResourceCard[] = [];
  for (const { pile } of plan) {
    const card = drawFromPile(draft, pile);
    if (!card) return `the ${pile} pile is empty`;
    drawn.push(card);
  }
  player.hand.push(...drawn);

  // Leftover (unclaimed) dice pass to the next player as inheritance.
  const leftovers = c.dice.filter((d) => !claimIds.has(d.id));
  draft.log.push(
    `${player.name} claimed ${plan.length} resource(s)` +
      `${leftovers.length ? `, passed ${leftovers.length} die/dice on` : ""}.`,
  );

  // Advance the pass, or finish the Collect Phase.
  c.pos += 1;
  if (c.pos < c.order.length) {
    startCollectTurn(draft, leftovers);
  } else {
    enterPlay(draft);
  }
  return null;
}

function handleDrawMashBills(
  draft: GameState,
  player: Player,
  keepIndexes: number[],
): string | null {
  if (player.drewMashBillsThisTurn) return "you have already drawn mash bills this turn";

  const reveal = officeDraw(player);
  const offer = draft.mashBillSupply.slice(0, Math.min(reveal, draft.mashBillSupply.length));
  if (offer.length === 0) return "the mash bill supply is empty";

  const keep = new Set(keepIndexes);
  if (keep.size !== keepIndexes.length) return "duplicate keep indexes";
  for (const i of keep) {
    if (i < 0 || i >= offer.length) return `keep index ${i} is out of range (revealed ${offer.length})`;
  }

  const room = rickhouseCapacity(player) - player.rickhouse.length;
  if (keep.size > room) {
    return `rickhouse has room for ${Math.max(0, room)} more barrel(s) — upgrade it to expand`;
  }

  // Remove the whole offer from the supply; kept ones become resting barrels,
  // the rest cycle back (shuffled in) so they aren't re-drawn identically.
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
      recipeTags: expressionToTags(bill.expression),
      recipe: { ...bill.recipe },
      built: false,
      age: 0,
      quality: "common",
      batchQty: bill.batchQty,
      salesRemaining: bill.batchQty,
      matrix: bill.matrix,
      createdRound: draft.roundNumber,
    });
  }
  if (rejected.length > 0) {
    const [reshuffled, seed] = shuffle([...draft.mashBillSupply, ...rejected], draft.rngSeed);
    draft.mashBillSupply = reshuffled;
    draft.rngSeed = seed;
  }

  player.drewMashBillsThisTurn = true;
  maybeTriggerFinalRound(draft);
  draft.log.push(
    `${player.name} drew ${offer.length} bill(s), kept ${keep.size}` +
      `${keep.size ? ` (${[...keep].map((i) => `"${offer[i]!.name}"`).join(", ")})` : ""} — ` +
      `rickhouse ${player.rickhouse.length}/${rickhouseCapacity(player)}, ${draft.mashBillSupply.length} bills left.`,
  );
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
  const cards: ResourceCard[] = [];
  for (const id of resourceCardIds) {
    const card = player.hand.find((c) => c.id === id);
    if (!card) return `resource ${id} is not in hand`;
    cards.push(card);
  }

  const check = recipeSatisfied(barrel.recipe, barrel.name, cards);
  if (!check.ok) return check.reason;

  player.hand = player.hand.filter((c) => !uniqueIds.has(c.id));
  for (const c of cards) draft.pileDiscards[c.kind].push(c);

  barrel.built = true;
  barrel.age = 0;
  barrel.quality = deriveQuality(cards);
  barrel.createdRound = draft.roundNumber;
  draft.log.push(`${player.name} built a ${barrel.quality} "${barrel.name}" — now aging.`);
  return null;
}

/**
 * Sell (Extract) one sale from a built, aged batch. Every sale banks the
 * age × demand matrix value plus the Tasting Room bonus. The FINAL sale frees
 * the rickhouse slot. 🚧 The completion bonus / collection enshrinement on the
 * final sale is STUBBED (CONFIG.COMPLETION_BONUS held at 0).
 */
function handleSell(draft: GameState, player: Player, bourbonId: string): string | null {
  const idx = player.rickhouse.findIndex((b) => b.id === bourbonId);
  if (idx < 0) return "bourbon not found in your rickhouse";
  const bourbon = player.rickhouse[idx]!;

  if (!bourbon.built) return "barrel is not built yet — make bourbon first";
  if (bourbon.age < CONFIG.MIN_SELL_AGE) {
    return `bourbon must be aged at least ${CONFIG.MIN_SELL_AGE} (age ${bourbon.age})`;
  }
  if (bourbon.salesRemaining <= 0) return "this batch is already fully sold";

  const isFinal = bourbon.salesRemaining === 1;
  const value = matrixValue(bourbon.matrix, bourbon.age, draft.demand) + tastingBonus(player);
  player.capital += value;
  bourbon.salesRemaining -= 1;
  player.bourbonsSold += 1;
  applySignature(player, bourbon, isFinal);

  if (isFinal) {
    player.capital += CONFIG.COMPLETION_BONUS;
    player.rickhouse.splice(idx, 1);
    draft.log.push(
      `${player.name} sold out "${bourbon.name}" (age ${bourbon.age}) — final sale ${value}; rickhouse slot freed.`,
    );
  } else {
    draft.log.push(
      `${player.name} sold "${bourbon.name}" (age ${bourbon.age}) for ${value} — ${bourbon.salesRemaining}/${bourbon.batchQty} left.`,
    );
  }
  return null;
}

function handleImprove(draft: GameState, player: Player, departmentId: DepartmentId): string | null {
  const d = dept(player, departmentId);
  if (!d) return `unknown department "${departmentId}"`;
  if (d.level >= d.maxLevel) return `${d.name} is already fully grown`;

  const cost = improvementCost(player.improvements, d.discount);
  if (player.capital < cost) {
    return `improving ${d.name} costs ${cost} capital (have ${player.capital})`;
  }
  player.capital -= cost;
  d.level += 1;
  player.improvements += 1;
  draft.log.push(
    `${player.name} improved ${d.name} to level ${d.level} for ${cost} capital ` +
      `(effect now ${d.values[d.level]}; next improvement costs ${improvementCost(player.improvements)}).`,
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

  switch (action.type) {
    case "BEGIN_COLLECT": {
      if (draft.roundPhase !== "demand") return refuse("not the Demand Phase");
      enterCollect(draft);
      return { ok: true, state: draft };
    }

    case "COLLECT_REROLL": {
      if (draft.roundPhase !== "collect") return refuse("not the Collect Phase");
      const error = handleCollectReroll(draft, action.diceIds);
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

    case "MAKE_BOURBON": {
      if (draft.roundPhase !== "play") return refuse("not the Play Phase");
      const error = handleMakeBourbon(draft, player, action.barrelId, action.resourceCardIds);
      return error ? refuse(error) : { ok: true, state: draft };
    }

    case "SELL": {
      if (draft.roundPhase !== "play") return refuse("not the Play Phase");
      const error = handleSell(draft, player, action.bourbonId);
      return error ? refuse(error) : { ok: true, state: draft };
    }

    case "IMPROVE": {
      if (draft.roundPhase !== "play") return refuse("not the Play Phase");
      const error = handleImprove(draft, player, action.departmentId);
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
