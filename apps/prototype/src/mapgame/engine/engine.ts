// Bourbonomics: Map Game — the reducer.
//
// applyAction(state, action) is the only mutation surface. Pure: it clones the
// state, applies the action, advances the round/age machinery, and returns the
// new state or a typed refusal. Deterministic — no hidden rolls (spec §0).
//
// A round runs: CHOOSE (each player picks one action card, sequentially in seat
// order) → ACT (turns resolve in initiative order; fewer bips = earlier) → the
// round ends, and after ROUNDS_PER_AGE rounds the age ends (harvest, aging,
// clear the distill row, refresh bourbons, deal new hands).

import { CONFIG, totalDistillCost } from "./config";
import { buildDistillDeck, buildHand } from "./content";
import {
  activeDPCount,
  controlledTiles,
  effectiveFit,
  nicheStatus,
  playerById,
  shelfUsed,
  tileById,
  tileController,
  tilesAdjacent,
  tilesContiguous,
} from "./derive";
import { hexNeighbors, hexKey } from "./hex";
import { nextId } from "./ids";
import { rngRange, shuffle } from "./rng";
import { TASTE_TRAITS } from "./types";
import type {
  Action,
  ActionResult,
  Bourbon,
  DistillSlot,
  GameState,
  Niche,
  Player,
  TasteTrait,
  Tile,
} from "./types";

function refuse(reason: string): ActionResult {
  return { ok: false, reason };
}

// ── seat / turn helpers ──────────────────────────────────────────────
function seatOrder(n: number, start: number): number[] {
  return Array.from({ length: n }, (_, i) => (start + i) % n);
}

/** The seat currently acting/choosing. */
export function current(state: GameState): Player {
  return state.players[state.turnOrder[state.turnPos]!]!;
}

/** True if the seat on the clock is a bot. */
export function isBotTurn(state: GameState): boolean {
  if (state.phase !== "playing") return false;
  return current(state).isBot;
}

// ── round / age machinery ────────────────────────────────────────────
function beginRound(draft: GameState): void {
  draft.stage = "choose";
  draft.turnOrder = seatOrder(draft.players.length, draft.startPlayerIndex);
  draft.turnPos = 0;
  for (const p of draft.players) {
    p.hasChosen = false;
    p.playedCard = null;
    p.sacrificed = false;
    p.bips = 0;
    p.done = false;
  }
  draft.log.push(`— Age ${draft.age}, Round ${draft.round} — choose an action card.`);
}

function beginActStage(draft: GameState): void {
  const order = seatOrder(draft.players.length, draft.startPlayerIndex);
  const seatPos = new Map(order.map((seat, i) => [seat, i])); // stable tie-break
  // Initiative: sacrificers last; otherwise fewer bips first; tie by seat order.
  order.sort((a, b) => {
    const pa = draft.players[a]!;
    const pb = draft.players[b]!;
    const sa = pa.sacrificed ? 1 : 0;
    const sb = pb.sacrificed ? 1 : 0;
    if (sa !== sb) return sa - sb;
    const ba = pa.sacrificed ? CONFIG.SACRIFICE_BIPS : pa.playedCard?.bips ?? 99;
    const bb = pb.sacrificed ? CONFIG.SACRIFICE_BIPS : pb.playedCard?.bips ?? 99;
    if (ba !== bb) return ba - bb;
    return seatPos.get(a)! - seatPos.get(b)!;
  });
  draft.turnOrder = order;
  draft.turnPos = 0;
  draft.stage = "act";
  for (const p of draft.players) {
    p.bips = p.sacrificed ? CONFIG.SACRIFICE_BIPS : p.playedCard?.bips ?? 0;
    p.done = false;
  }
  const first = current(draft);
  draft.log.push(
    `Initiative: ${draft.turnOrder.map((i) => draft.players[i]!.name).join(" → ")}. ${first.name} acts first.`,
  );
}

function advanceTurn(draft: GameState): void {
  draft.turnPos += 1;
  if (draft.turnPos < draft.turnOrder.length) return; // next seat acts
  // round over
  if (draft.round >= CONFIG.ROUNDS_PER_AGE) {
    runAgeEnd(draft);
  } else {
    draft.round += 1;
    draft.startPlayerIndex = (draft.startPlayerIndex + 1) % draft.players.length;
    beginRound(draft);
  }
}

function grantAgeIncome(draft: GameState): void {
  for (const p of draft.players) {
    const income = controlledTiles(draft, p.id).length * CONFIG.TILE_CAPITAL_INCOME;
    if (income > 0) {
      p.capital += income;
      draft.log.push(`${p.name} collects ${income} Capital from controlled tiles.`);
    }
  }
}

function runHarvest(draft: GameState): void {
  for (const niche of draft.niches) {
    const status = nicheStatus(draft, niche);
    if (status !== "control" && status !== "monopoly") continue;
    const owner = playerById(draft, niche.owner)!;
    const rewards = niche.tileIds
      .map((id) => tileById(draft, id)?.reward)
      .filter(Boolean) as ("capital" | "token")[];
    if (rewards.length === 0) continue;
    const take = status === "monopoly" ? rewards : rewards.includes("capital") ? ["capital"] : [rewards[0]!];
    for (const r of take) {
      if (r === "capital") owner.capital += 1;
      else owner.tokens += 1;
    }
    draft.log.push(
      `🌾 ${owner.name} harvests ${niche.tileIds.length}-tile niche (${status}): +${take.length} reward icon(s).`,
    );
  }
}

function ageBourbons(draft: GameState): void {
  for (const p of draft.players) {
    for (const b of p.cellar) b.maturitySlot = Math.min(5, b.maturitySlot + 1);
  }
}

function refillDistillRow(draft: GameState): void {
  // Return all committed agents, discard unclaimed offers, deal a fresh row.
  for (const slot of draft.distillRow) {
    for (const [pid, a] of Object.entries(slot.agents)) {
      const pl = playerById(draft, pid);
      if (pl) pl.agents += a.count;
    }
  }
  if (draft.distillDeck.length < CONFIG.DISTILL_ROW) {
    const [fresh, s] = shuffle(buildDistillDeck(), draft.rngSeed);
    draft.rngSeed = s;
    draft.distillDeck.push(...fresh);
  }
  draft.distillRow = [];
  for (let i = 0; i < CONFIG.DISTILL_ROW && draft.distillDeck.length; i++) {
    draft.distillRow.push({ def: draft.distillDeck.shift()!, agents: {} });
  }
}

function refreshBourbons(draft: GameState): void {
  for (const p of draft.players) {
    for (const b of p.cellar) {
      b.state = "fresh";
      b.locked = false;
    }
  }
}

function endGame(draft: GameState): void {
  draft.phase = "ended";
  const ranked = [...draft.players].sort((a, b) => b.capital - a.capital);
  const w = ranked[0]!;
  draft.log.push(`🏁 Game over — ${w.name} wins with ${w.capital} Capital.`);
}

function runAgeEnd(draft: GameState): void {
  draft.log.push(`— Age ${draft.age} ends —`);
  runHarvest(draft);
  ageBourbons(draft);
  refillDistillRow(draft);
  refreshBourbons(draft);

  if (draft.age >= CONFIG.AGES) {
    endGame(draft);
    return;
  }
  // Begin the next age.
  draft.age += 1;
  draft.round = 1;
  draft.startPlayerIndex = (draft.startPlayerIndex + 1) % draft.players.length;
  for (const p of draft.players) p.hand = buildHand(p.id, draft.age);
  grantAgeIncome(draft);
  draft.log.push(`— Age ${draft.age} begins — new hands dealt, bourbons refreshed.`);
  beginRound(draft);
}

// ── choose stage ─────────────────────────────────────────────────────
function handleChoose(draft: GameState, cardId: string, sacrifice: boolean): string | null {
  if (draft.stage !== "choose") return "not the card-choice stage";
  const chooser = current(draft);
  if (chooser.hasChosen) return "you already chose a card";
  const idx = chooser.hand.findIndex((c) => c.id === cardId);
  if (idx < 0) return "that card is not in your hand";
  const [card] = chooser.hand.splice(idx, 1);
  chooser.playedCard = sacrifice ? null : card!;
  chooser.sacrificed = sacrifice;
  chooser.hasChosen = true;
  draft.log.push(
    sacrifice
      ? `${chooser.name} sacrifices a card face-down (1 bip, last initiative).`
      : `${chooser.name} commits a ${card!.bips}-bip card.`,
  );
  draft.turnPos += 1;
  if (draft.turnPos >= draft.players.length) beginActStage(draft);
  return null;
}

// ── act stage: spending bips ─────────────────────────────────────────
function requireActing(draft: GameState): Player | string {
  if (draft.stage !== "act") return "not the action stage";
  return current(draft);
}

function spend(player: Player, cost: number): string | null {
  if (player.bips < cost) return `not enough bips (need ${cost}, have ${player.bips})`;
  player.bips -= cost;
  return null;
}

function handlePlaceTile(draft: GameState, player: Player, nearTileId: string): string | null {
  const near = tileById(draft, nearTileId);
  if (!near) return "unknown tile";
  if (activeDPCount(draft, near.id, player.id) < 1) return "place tiles adjacent to a tile you have access to";
  // find an empty neighbor hex
  const occupied = new Set(draft.tiles.map((t) => hexKey(t.hex)));
  const spot = hexNeighbors(near.hex).find((h) => !occupied.has(hexKey(h)));
  if (!spot) return "no open space beside that tile";
  const err = spend(player, CONFIG.COST_PLACE_TILE);
  if (err) return err;
  // roll traits for the new blue-ocean tile
  let s = draft.rngSeed;
  const [nT, s1] = rngRange(s, 2);
  s = s1;
  const traits = new Set<TasteTrait>();
  while (traits.size < 1 + nT) {
    const [ti, sn] = rngRange(s, TASTE_TRAITS.length);
    s = sn;
    traits.add(TASTE_TRAITS[ti]!);
  }
  const [shelfR, s2] = rngRange(s, CONFIG.SHELF_MAX - CONFIG.SHELF_MIN + 1);
  s = s2;
  const [rew, s3] = rngRange(s, 100);
  s = s3;
  draft.rngSeed = s;
  const tile: Tile = {
    id: nextId("tile"),
    hex: spot,
    traits: [...traits],
    averse: null,
    reward: rew < CONFIG.REWARD_DENSITY * 100 ? "capital" : null,
    shelfCapacity: CONFIG.SHELF_MIN + shelfR,
  };
  draft.tiles.push(tile);
  draft.log.push(`${player.name} opens new market space (blue ocean) beside "${near.id}".`);
  return null;
}

/** Is a tile inside any rival's declared niche? */
function inRivalNiche(draft: GameState, tileId: string, playerId: string): boolean {
  return draft.niches.some((n) => n.owner !== playerId && n.tileIds.includes(tileId));
}

function handleBuildDP(draft: GameState, player: Player, tileId: string): string | null {
  const tile = tileById(draft, tileId);
  if (!tile) return "unknown tile";
  if (shelfUsed(draft, tileId) >= tile.shelfCapacity) return "that tile's shelf is full";
  const err = spend(player, CONFIG.COST_BUILD_DP);
  if (err) return err;
  // Rival DPs entering a declared niche enter INACTIVE (spec §3).
  const status = inRivalNiche(draft, tileId, player.id) ? "inactive" : "active";
  draft.dps.push({ id: nextId("dp"), owner: player.id, tileId, status });
  draft.log.push(
    `${player.name} builds a Distribution Point on "${tileId}"${status === "inactive" ? " (enters inactive — rival niche)" : ""}.`,
  );
  return null;
}

function handleRepairDP(draft: GameState, player: Player, dpId: string): string | null {
  const dp = draft.dps.find((d) => d.id === dpId);
  if (!dp) return "unknown DP";
  if (dp.owner !== player.id) return "that DP isn't yours";
  if (dp.status === "active") return "that DP is already active";
  const err = spend(player, CONFIG.COST_REPAIR_DP);
  if (err) return err;
  dp.status = "active";
  draft.log.push(`${player.name} repairs a DP on "${dp.tileId}".`);
  return null;
}

function handleDeclareNiche(draft: GameState, player: Player, tileIds: string[]): string | null {
  if (tileIds.length < CONFIG.NICHE_MIN_TILES) return `a niche needs ≥${CONFIG.NICHE_MIN_TILES} tiles`;
  if (new Set(tileIds).size !== tileIds.length) return "duplicate tiles";
  if (!tilesContiguous(draft, tileIds)) return "niche tiles must be contiguous";
  for (const id of tileIds) {
    if (tileController(draft, id) !== player.id) return `you don't control "${id}"`;
  }
  const err = spend(player, CONFIG.COST_DECLARE_NICHE);
  if (err) return err;
  const niche: Niche = { id: nextId("niche"), owner: player.id, tileIds: [...tileIds] };
  draft.niches.push(niche);
  draft.log.push(`${player.name} declares a ${tileIds.length}-tile niche.`);
  return null;
}

function handleAddTile(draft: GameState, player: Player, nicheId: string, tileId: string): string | null {
  const niche = draft.niches.find((n) => n.id === nicheId);
  if (!niche || niche.owner !== player.id) return "that's not your niche";
  if (niche.tileIds.includes(tileId)) return "tile already in the niche";
  if (tileController(draft, tileId) !== player.id) return "you must control the tile you add";
  const tile = tileById(draft, tileId);
  const adjacent = niche.tileIds.some((id) => {
    const t = tileById(draft, id);
    return t && tile && tilesAdjacent(t, tile);
  });
  if (!adjacent) return "the tile must be adjacent to the niche";
  const err = spend(player, CONFIG.COST_ADD_TILE_TO_NICHE);
  if (err) return err;
  niche.tileIds.push(tileId);
  draft.log.push(`${player.name} grows a niche to ${niche.tileIds.length} tiles.`);
  return null;
}

function handleRemoveTile(draft: GameState, player: Player, nicheId: string, tileId: string): string | null {
  const niche = draft.niches.find((n) => n.id === nicheId);
  if (!niche || niche.owner !== player.id) return "that's not your niche";
  if (!niche.tileIds.includes(tileId)) return "tile isn't in the niche";
  const err = spend(player, CONFIG.COST_REMOVE_TILE_FROM_NICHE);
  if (err) return err;
  niche.tileIds = niche.tileIds.filter((id) => id !== tileId);
  if (niche.tileIds.length < CONFIG.NICHE_MIN_TILES) {
    draft.niches = draft.niches.filter((n) => n.id !== nicheId);
    draft.log.push(`${player.name} consolidates — the niche drops below ${CONFIG.NICHE_MIN_TILES} tiles and collapses.`);
  } else {
    draft.log.push(`${player.name} trims a niche to ${niche.tileIds.length} tiles.`);
  }
  return null;
}

function handleDistill(
  draft: GameState,
  player: Player,
  slotIndex: number,
  method: "grab" | "court",
): string | null {
  const slot = draft.distillRow[slotIndex];
  if (!slot) return "no offer in that slot";
  if (player.agents < 1) return "no agents in your supply";
  const existing = slot.agents[player.id];
  if (existing && existing.method !== method) return `you're already ${existing.method}ing that offer`;
  const threshold = method === "grab" ? CONFIG.GRAB_AGENTS : CONFIG.COURT_AGENTS;
  const newCount = (existing?.count ?? 0) + 1;
  const wouldClaim = newCount >= threshold;
  const cost = totalDistillCost(slot.def.basePrice, slotIndex);
  if (wouldClaim) {
    if (player.cellar.length >= CONFIG.CELLAR_CAPACITY) return "your cellar is full";
    if (player.capital < cost) return `claiming costs ${cost} Capital (have ${player.capital})`;
  }
  const err = spend(player, CONFIG.COST_DISTILL);
  if (err) return err;

  // place the agent
  player.agents -= 1;
  slot.agents[player.id] = { count: newCount, method };

  if (!wouldClaim) {
    draft.log.push(
      `${player.name} places an agent (${method}) on "${slot.def.name}" — ${newCount}/${threshold}.`,
    );
    return null;
  }

  // claim!
  player.capital -= cost;
  const entrySlot = method === "grab" ? CONFIG.GRAB_ENTRY_SLOT : CONFIG.COURT_ENTRY_SLOT;
  const bourbon: Bourbon = {
    id: nextId("bourbon"),
    defId: slot.def.defId,
    name: slot.def.name,
    traits: [...slot.def.traits],
    basePrice: slot.def.basePrice,
    ceiling: slot.def.ceiling,
    state: "fresh",
    locked: false,
    maturitySlot: entrySlot,
    owner: player.id,
  };
  player.cellar.push(bourbon);
  player.agents += newCount; // agents come home after a claim
  // return rival agents on this slot
  for (const [pid, a] of Object.entries(slot.agents)) {
    if (pid !== player.id) {
      const pl = playerById(draft, pid);
      if (pl) pl.agents += a.count;
    }
  }
  // remove the claimed slot; slide left; deal a fresh offer at the end
  draft.distillRow.splice(slotIndex, 1);
  if (draft.distillDeck.length === 0) {
    const [fresh, s] = shuffle(buildDistillDeck(), draft.rngSeed);
    draft.rngSeed = s;
    draft.distillDeck.push(...fresh);
  }
  const nextDef = draft.distillDeck.shift();
  if (nextDef) draft.distillRow.push({ def: nextDef, agents: {} });
  draft.log.push(
    `${player.name} ${method === "court" ? "courts" : "grabs"} "${bourbon.name}" for ${cost} Capital ` +
      `(enters at maturity ${entrySlot}).`,
  );
  return null;
}

// ── combat: the Push ─────────────────────────────────────────────────
/** Bot/auto defense: commit fresh, unlocked bourbons with the best fit here. */
function autoDefense(draft: GameState, defender: Player, tile: Tile, attackFit: number): string[] {
  const usable = defender.cellar
    .filter((b) => b.state === "fresh" && !b.locked)
    .map((b) => ({ b, fit: effectiveFit(b, tile) }))
    .filter((x) => x.fit > 0)
    .sort((a, b) => b.fit - a.fit);
  // Commit only enough to plausibly hold; retreat (commit nothing) if outmatched badly.
  const defDP = activeDPCount(draft, tile.id, defender.id);
  if (defDP === 0) return [];
  const picked: string[] = [];
  let sum = 0;
  for (const { b, fit } of usable) {
    if (defDP * Math.max(1, sum) > attackFit) break; // already ahead of the floor estimate
    picked.push(b.id);
    sum += fit;
    if (picked.length >= 2) break; // don't over-commit in v0
  }
  return picked;
}

function handlePush(
  draft: GameState,
  attacker: Player,
  variant: "attack" | "purge",
  tileId: string,
  defenderId: string,
  bourbonIds: string[],
): string | null {
  const tile = tileById(draft, tileId);
  if (!tile) return "unknown tile";
  const defender = playerById(draft, defenderId);
  if (!defender) return "unknown defender";
  if (defender.id === attacker.id) return "you can't push yourself";
  if (activeDPCount(draft, tileId, attacker.id) < 1) return "you need an active DP on the tile to push";

  const atkDP = activeDPCount(draft, tileId, attacker.id);
  const defActive = activeDPCount(draft, tileId, defender.id);
  const defInactive = draft.dps.filter((d) => d.tileId === tileId && d.owner === defender.id && d.status === "inactive").length;
  if (variant === "attack" && defActive < 1) return "no active rival DP to attack here";
  if (variant === "purge" && defInactive < 1) return "no inactive rival DP to purge here";

  if (bourbonIds.length < 1) return "commit at least one bourbon";
  const committed: Bourbon[] = [];
  for (const id of bourbonIds) {
    const b = attacker.cellar.find((x) => x.id === id);
    if (!b) return "a committed bourbon isn't in your cellar";
    if (b.state !== "fresh") return `"${b.name}" is already flipped this age`;
    if (b.locked) return `"${b.name}" is locked to a tile`;
    committed.push(b);
  }

  const capitalCost = defActive; // pay Capital = defender's active DPs
  if (attacker.capital < capitalCost) return `attacking costs ${capitalCost} Capital (have ${attacker.capital})`;

  const err = spend(attacker, CONFIG.COST_PUSH);
  if (err) return err;
  attacker.capital -= capitalCost;

  // flip attacker's committed bourbons
  for (const b of committed) b.state = "flipped";
  const atkFit = committed.reduce((s, b) => s + effectiveFit(b, tile), 0);

  // defender commits (auto/bot heuristic in v0)
  const defIds = autoDefense(draft, defender, tile, atkDP * atkFit);
  const defCommitted = defender.cellar.filter((b) => defIds.includes(b.id));
  for (const b of defCommitted) b.state = "flipped";
  const defFit = defCommitted.reduce((s, b) => s + effectiveFit(b, tile), 0);

  const atkStrength = atkDP * atkFit;
  const defStrength = defActive * Math.max(1, defFit);
  const attackerWins = atkStrength > defStrength; // tie → defender
  const margin = Math.abs(atkStrength - defStrength);

  draft.log.push(
    `⚔ ${attacker.name} ${variant === "purge" ? "purges" : "attacks"} "${tileId}": ` +
      `${attacker.name} ${atkStrength} (${atkDP}×${atkFit}) vs ${defender.name} ${defStrength} ` +
      `(${defActive}×${Math.max(1, defFit)})${defCommitted.length ? "" : " [retreat]"} → ` +
      `${attackerWins ? attacker.name : defender.name} wins by ${margin}.`,
  );

  // damage: knock the loser's active DPs down, one per point of margin (capped)
  const loser = attackerWins ? defender : attacker;
  const loserActive = draft.dps.filter((d) => d.tileId === tileId && d.owner === loser.id && d.status === "active");
  const dmg = Math.min(margin, loserActive.length);
  for (let i = 0; i < dmg; i++) loserActive[i]!.status = "inactive";
  if (dmg > 0) draft.log.push(`   ${loser.name} loses ${dmg} DP(s) → inactive.`);

  // purge success removes all defender inactive DPs on the tile
  if (variant === "purge" && attackerWins) {
    const before = draft.dps.length;
    draft.dps = draft.dps.filter(
      (d) => !(d.tileId === tileId && d.owner === defender.id && d.status === "inactive"),
    );
    draft.log.push(`   Purge clears ${before - draft.dps.length} inactive DP(s).`);
  }

  // costs: attacker's committed bourbons are burned regardless
  const burnIds = new Set(committed.map((b) => b.id));
  // defender's committed: locked if they won, burned if they lost
  if (attackerWins) {
    for (const b of defCommitted) burnIds.add(b.id);
  } else {
    for (const b of defCommitted) b.locked = true;
  }
  attacker.cellar = attacker.cellar.filter((b) => !burnIds.has(b.id));
  defender.cellar = defender.cellar.filter((b) => !burnIds.has(b.id));
  return null;
}

// ── entry point ──────────────────────────────────────────────────────
export function applyAction(state: GameState, action: Action): ActionResult {
  if (state.phase === "ended") return refuse("the game has ended");
  const draft: GameState = structuredClone(state);

  // choice stage
  if (action.type === "CHOOSE_CARD" || action.type === "SACRIFICE_CARD") {
    const err = handleChoose(draft, action.cardId, action.type === "SACRIFICE_CARD");
    return err ? refuse(err) : { ok: true, state: draft };
  }

  // action stage
  const actor = requireActing(draft);
  if (typeof actor === "string") return refuse(actor);
  const player = actor;

  switch (action.type) {
    case "SPEND_TOKEN": {
      if (player.tokens < 1) return refuse("no tokens to spend");
      player.tokens -= 1;
      player.bips += CONFIG.TOKEN_TO_BIP;
      draft.log.push(`${player.name} spends a token for +${CONFIG.TOKEN_TO_BIP} bip.`);
      return { ok: true, state: draft };
    }
    case "PLACE_TILE": {
      const e = handlePlaceTile(draft, player, action.nearTileId);
      return e ? refuse(e) : { ok: true, state: draft };
    }
    case "BUILD_DP": {
      const e = handleBuildDP(draft, player, action.tileId);
      return e ? refuse(e) : { ok: true, state: draft };
    }
    case "REPAIR_DP": {
      const e = handleRepairDP(draft, player, action.dpId);
      return e ? refuse(e) : { ok: true, state: draft };
    }
    case "DECLARE_NICHE": {
      const e = handleDeclareNiche(draft, player, action.tileIds);
      return e ? refuse(e) : { ok: true, state: draft };
    }
    case "ADD_TILE_TO_NICHE": {
      const e = handleAddTile(draft, player, action.nicheId, action.tileId);
      return e ? refuse(e) : { ok: true, state: draft };
    }
    case "REMOVE_TILE_FROM_NICHE": {
      const e = handleRemoveTile(draft, player, action.nicheId, action.tileId);
      return e ? refuse(e) : { ok: true, state: draft };
    }
    case "DISTILL": {
      const e = handleDistill(draft, player, action.slotIndex, action.method);
      return e ? refuse(e) : { ok: true, state: draft };
    }
    case "PUSH": {
      const e = handlePush(draft, player, action.variant, action.tileId, action.defender, action.bourbonIds);
      return e ? refuse(e) : { ok: true, state: draft };
    }
    case "END_TURN": {
      player.done = true;
      draft.log.push(`${player.name} ends their turn.`);
      advanceTurn(draft);
      return { ok: true, state: draft };
    }
    default: {
      const _exhaustive: never = action;
      return refuse(`unknown action ${(_exhaustive as Action).type}`);
    }
  }
}
