// Bourbonomics: Map Game — the reducer and turn/stage machine.
//
// Pure: applyAction(state, action) deep-clones, mutates the draft, returns a new
// state or a typed refusal. The acting player is always the current actor —
// initiative[turnPos] — so actions carry no playerId (single-client / hotseat).
//
// Round shape (brief §4): planning → commit → resolve, each iterating players in
// initiative order. The initiative MARKER (last icon-card played) sets who leads
// next round; sticky if none. Age end is delegated to ageLoop.ts.

import { catchUpOrder, catchUpSwap, performTrade, runAgeEnd } from "./ageLoop";
import { CONFIG } from "./config";
import { canAddFlag, canPlaceDP, neighborTiles, tileById, tileController } from "./derive";
import { runDistilleryTrigger } from "./distilleries";
import { resolvePush } from "./push";
import type { Hex } from "./hex";
import { hexKey } from "./hex";
import { mintId } from "./ids";
import { finalizeSetup, placeBlockingTerrain, refillMarket, setupDPOrder, snakeOrder, tileFromDef } from "./setup";
import type {
  Action,
  ActionResult,
  ActionType,
  GameState,
  Player,
  Suit,
  Tile,
  TokenType,
} from "./types";
import { SUITS, SUIT_ACTIONS } from "./types";

const clone = (s: GameState): GameState => structuredClone(s);
const refuse = (reason: string): ActionResult => ({ ok: false, reason });
const commit = (state: GameState): ActionResult => ({ ok: true, state });

function currentActor(draft: GameState): Player {
  // The opening draft (snake) and starting-DP step (round-robin) both iterate the
  // stored setup sequence; every other stage iterates `initiative`.
  const usesSetupSeq = draft.stage === "setupDraft" || draft.stage === "setupDP";
  const seq = usesSetupSeq ? draft.setupDraftSeq : draft.initiative;
  return draft.players[seq[draft.turnPos]!]!;
}

function log(draft: GameState, message: string): void {
  draft.log.push({ age: draft.age, round: draft.round, message });
}

// ── Suit / pip gating ────────────────────────────────────────────────
function actionPermitted(actor: Player, type: ActionType): boolean {
  return actor.allowedSuits.some((s) => SUIT_ACTIONS[s].includes(type));
}

function spendPips(actor: Player, cost: number, type: ActionType): string | null {
  if (!actionPermitted(actor, type)) return `no committed card or token permits ${type}`;
  if (actor.pipsRemaining < cost) return "not enough pips remaining";
  actor.pipsRemaining -= cost;
  return null;
}

// ── Turn advancement ─────────────────────────────────────────────────
/** Advance to the next not-done actor in initiative; return false if all done. */
function advance(draft: GameState): boolean {
  for (let step = 1; step <= draft.initiative.length; step++) {
    const pos = (draft.turnPos + step) % draft.initiative.length;
    if (!draft.players[draft.initiative[pos]!]!.turnDone) {
      draft.turnPos = pos;
      return true;
    }
  }
  return false;
}

function allPlayers(draft: GameState): Player[] {
  return draft.players;
}

// ── Stage transitions ────────────────────────────────────────────────
function toCommit(draft: GameState): void {
  draft.stage = "commit";
  for (const p of allPlayers(draft)) p.turnDone = false;
  draft.turnPos = 0; // initiative[0] is the lead; iterate from the front
  autoPassCardless(draft);
}

/**
 * A player who has exhausted their hand (chaining spends several cards a round)
 * cannot commit — they sit the round out. Mark every cardless, not-yet-committed
 * player as done with an empty play. Returns true if that leaves everyone done.
 */
function autoPassCardless(draft: GameState): boolean {
  for (const p of allPlayers(draft)) {
    if (!p.hasCommitted && p.hand.length === 0) {
      p.committedFaceUp = [];
      p.committedSacrificed = [];
      p.surrendered = false;
      p.hasCommitted = true;
      p.turnDone = true;
    }
  }
  if (allPlayers(draft).every((p) => p.turnDone)) {
    toResolve(draft);
    return true;
  }
  // Ensure the current actor is a live (not-done) player.
  if (draft.players[draft.initiative[draft.turnPos]!]!.turnDone) advance(draft);
  return false;
}

function toResolve(draft: GameState): void {
  // Grant pips from face-up cards; widen allowed suits. Then move the marker.
  for (const p of allPlayers(draft)) {
    if (p.surrendered) {
      p.pipsRemaining += CONFIG.SURRENDER_PIPS;
      p.allowedSuits = [...SUITS];
    } else {
      for (const c of p.committedFaceUp) {
        p.pipsRemaining += c.pips;
        if (!p.allowedSuits.includes(c.suit)) p.allowedSuits.push(c.suit);
      }
    }
    p.turnDone = false;
  }
  updateMarker(draft);
  draft.stage = "resolve";
  draft.turnPos = 0;
}

/** Seating order starting from a given player index (brief §4). */
export function initiativeOrderFrom(n: number, start: number): number[] {
  return Array.from({ length: n }, (_, i) => (start + i) % n);
}

/**
 * The initiative marker moves to whoever played an icon card LAST — the latest,
 * in this round's initiative order, whose face-up cards include an icon. Sticky:
 * if no one played an icon, the marker doesn't move (brief §4, §17.14).
 */
function updateMarker(draft: GameState): void {
  for (const idx of draft.initiative) {
    const p = draft.players[idx]!;
    if (!p.surrendered && p.committedFaceUp.some((c) => c.icon)) {
      draft.initiativeMarker = idx; // later players overwrite → last wins
    }
  }
}

function endRound(draft: GameState): void {
  // The marker (updated at reveal) sets who leads next round.
  const next = initiativeOrderFrom(draft.players.length, draft.initiativeMarker);

  // Spent cards (face-up + sacrificed) go to the discard; clear per-round state.
  for (const p of allPlayers(draft)) {
    draft.actionDiscard.push(...p.committedFaceUp, ...p.committedSacrificed);
    p.committedFaceUp = [];
    p.committedSacrificed = [];
    p.surrendered = false;
    p.pipsRemaining = 0;
    p.allowedSuits = [];
    p.hasCommitted = false;
    p.turnDone = false;
  }

  const handsEmpty = allPlayers(draft).every((p) => p.hand.length === 0);
  if (draft.round >= CONFIG.ROUNDS_PER_AGE || handsEmpty) {
    runAgeEnd(draft, next); // sets up next age's round 1, or ends the game
    return;
  }

  draft.round += 1;
  draft.initiative = next;
  draft.turnPos = 0;
  draft.stage = "planning";
  runDistilleryTrigger(draft, "onRoundStart");
  log(draft, `Round ${draft.round} begins.`);
}

// ── Non-contest action handlers (mutate draft; return error string or null) ──
function doBuildDP(draft: GameState, actor: Player, tileId: string): string | null {
  const tile = tileById(draft, tileId);
  if (!tile) return "no such tile";
  if (tile.category === "BLOCKING") return "blocking tiles cannot hold DPs";
  if (actor.dpSupply <= 0) return "no DPs left in supply";
  if (!canPlaceDP(draft, actor.id, tileId)) return "cannot place there — no controlled/uncontrolled anchor";
  const err = spendPips(actor, CONFIG.COST_BUILD_DP, "BUILD_DP");
  if (err) return err;

  const controller = tileController(draft, tileId);
  const state = controller !== null && controller !== actor.id ? "DARK" : "LIVE";
  actor.dpSupply -= 1;
  draft.dps.push({ id: mintId(draft, "dp"), owner: actor.id, tileId, state, seq: draft.idCounter });
  log(draft, `${actor.name} builds a ${state} DP on ${tile.name}.`);
  return null;
}

function doRepairDP(draft: GameState, actor: Player, dpId: string): string | null {
  const dp = draft.dps.find((d) => d.id === dpId);
  if (!dp || dp.owner !== actor.id) return "not your DP";
  if (dp.state !== "DARK") return "DP is already LIVE";
  const err = spendPips(actor, CONFIG.COST_REPAIR_DP, "REPAIR_DP");
  if (err) return err;
  dp.state = "LIVE";
  log(draft, `${actor.name} repairs a DP.`);
  return null;
}

function doExpandDraw(draft: GameState, actor: Player): string | null {
  if (actor.heldTile) return "already holding a tile (cap 1)";
  if (draft.tileSupply.length === 0) return "tile supply is empty";
  const err = spendPips(actor, CONFIG.COST_EXPAND_DRAW, "EXPAND_MARKET");
  if (err) return err;
  actor.heldTile = draft.tileSupply.shift()!;
  log(draft, `${actor.name} draws a market tile.`);
  return null;
}

function doExpandPlace(draft: GameState, actor: Player, hex: Hex): string | null {
  if (!actor.heldTile) return "no held tile to place";
  if (draft.tiles.some((t) => t.hex.q === hex.q && t.hex.r === hex.r)) return "hex is occupied";
  if (neighborTiles(draft, hex).length < CONFIG.TILE_MIN_ADJACENCY) {
    return `a placed tile must touch >= ${CONFIG.TILE_MIN_ADJACENCY} existing tiles`;
  }
  const err = spendPips(actor, CONFIG.COST_EXPAND_PLACE, "EXPAND_MARKET");
  if (err) return err;
  const def = actor.heldTile;
  actor.heldTile = null;
  const tile: Tile = {
    id: mintId(draft, "tile"),
    defId: def.defId,
    name: def.name,
    category: def.category,
    hex,
    tags: def.tags,
    reward: def.reward,
    defenseBonus: def.defenseBonus,
    keystoneTokensPerAge: def.keystoneTokensPerAge,
    convertsToLoyalty: def.convertsToLoyalty,
    ownershipSlot: def.ownershipSlot,
    ownerSlotDP: null,
    wildcardTag: null,
    uncontestedSinceAge: null,
  };
  draft.tiles.push(tile);
  log(draft, `${actor.name} places ${tile.name} on the frontier.`);
  return null;
}

function doAddFlag(draft: GameState, actor: Player, tileId: string): string | null {
  const tile = tileById(draft, tileId);
  if (!tile) return "no such tile";
  if (!canAddFlag(draft, actor.id, tileId)) {
    return "a claim must be adjacent to your existing flags (first flag anywhere)";
  }
  const err = spendPips(actor, CONFIG.COST_ADD_NICHE_FLAG, "ADD_NICHE_FLAG");
  if (err) return err;
  draft.nicheFlags.push({ id: mintId(draft, "flag"), owner: actor.id, tileId });
  log(draft, `${actor.name} flags ${tile.name}.`);
  return null;
}

function doRefresh(draft: GameState, actor: Player, bourbonId: string): string | null {
  const b = actor.bourbons.find((x) => x.id === bourbonId);
  if (!b) return "not your bourbon";
  if (b.state !== "DEPLETED") return "bourbon is already FRESH";
  const err = spendPips(actor, CONFIG.COST_REFRESH, "REFRESH");
  if (err) return err;
  b.state = "FRESH";
  log(draft, `${actor.name} refreshes ${b.name}.`);
  return null;
}

/** Claim an EMPTY ownership slot by seating a DP in it (brief §7, confirmed). */
function doClaimSlot(draft: GameState, actor: Player, tileId: string, tag: Tile["wildcardTag"]): string | null {
  const tile = tileById(draft, tileId);
  if (!tile) return "no such tile";
  if (!tile.ownershipSlot) return "tile has no ownership slot";
  if (tile.ownerSlotDP) return "slot is already owned — take it by Push";
  // Claiming seats a DP; gated as a Build DP (any suit that permits it).
  if (!canPlaceDP(draft, actor.id, tileId)) return "cannot place there";
  const err = spendPips(actor, CONFIG.COST_CLAIM_SLOT, "BUILD_DP");
  if (err) return err;
  if (actor.dpSupply <= 0) {
    actor.pipsRemaining += CONFIG.COST_CLAIM_SLOT;
    return "no DPs left in supply";
  }
  actor.dpSupply -= 1;
  const dp = { id: mintId(draft, "dp"), owner: actor.id, tileId, state: "LIVE" as const, seq: draft.idCounter };
  draft.dps.push(dp);
  tile.ownerSlotDP = dp.id;
  if (tag) tile.wildcardTag = tag;
  log(draft, `${actor.name} claims the ${tile.name} ownership slot.`);
  return null;
}

function doRemoveFlag(draft: GameState, actor: Player, tileId: string): string | null {
  const flag = draft.nicheFlags.find((f) => f.owner === actor.id && f.tileId === tileId);
  if (!flag) return "you have no flag there";
  const err = spendPips(actor, CONFIG.COST_REMOVE_NICHE_FLAG, "REMOVE_NICHE_FLAG");
  if (err) return err;
  draft.nicheFlags = draft.nicheFlags.filter((f) => f.id !== flag.id);
  log(draft, `${actor.name} removes a niche flag.`);
  return null;
}

function doBid(draft: GameState, actor: Player, lotId: string): string | null {
  const lot = draft.market.find((l) => l.id === lotId);
  if (!lot) return "no such market lot";
  if (actor.dpSupply <= 0) return "no DP markers left to bid";
  const err = spendPips(actor, CONFIG.COST_BID, "BID");
  if (err) return err;
  actor.dpSupply -= 1;
  lot.bids[actor.id] = (lot.bids[actor.id] ?? 0) + 1;
  log(draft, `${actor.name} bids on ${lot.def.name}.`);
  return null;
}

function doMoveBid(draft: GameState, actor: Player, fromLotId: string, toLotId: string): string | null {
  const from = draft.market.find((l) => l.id === fromLotId);
  const to = draft.market.find((l) => l.id === toLotId);
  if (!from || !to) return "no such market lot";
  if ((from.bids[actor.id] ?? 0) <= 0) return "no marker to move there";
  const err = spendPips(actor, CONFIG.COST_MOVE_BID, "BID");
  if (err) return err;
  from.bids[actor.id] = (from.bids[actor.id] ?? 0) - 1;
  to.bids[actor.id] = (to.bids[actor.id] ?? 0) + 1;
  log(draft, `${actor.name} moves a bid.`);
  return null;
}

// ── Dispatch ─────────────────────────────────────────────────────────
export function applyAction(state: GameState, action: Action): ActionResult {
  if (state.phase !== "playing" && state.phase !== "setup") return refuse("game is not in play");
  const draft = clone(state);
  const actor = currentActor(draft);

  switch (draft.stage) {
    case "setupPlace":
      return setupPlaceStage(draft, actor, action);
    case "setupDraft":
      return setupDraftStage(draft, actor, action);
    case "setupDP":
      return setupDPStage(draft, actor, action);
    case "trade":
      return tradeStage(draft, actor, action);
    case "catchup":
      return catchupStage(draft, actor, action);
    case "planning":
      return planning(draft, actor, action);
    case "commit":
      return commitStage(draft, actor, action);
    case "resolve":
      return resolve(draft, actor, action);
    default:
      return refuse(`cannot act during ${draft.stage}`);
  }
}

// ── Setup phase (brief §13/§15) ──────────────────────────────────────
/** Round-robin: hop to the next player who still has setup tiles to place. */
function advanceSetupPlace(draft: GameState): boolean {
  const n = draft.players.length;
  for (let step = 1; step <= n; step++) {
    const pos = (draft.turnPos + step) % n;
    if (draft.players[draft.initiative[pos]!]!.setupTiles.length > 0) {
      draft.turnPos = pos;
      return true;
    }
  }
  return false; // every setup tile placed
}

function setupPlaceStage(draft: GameState, actor: Player, action: Action): ActionResult {
  if (action.type !== "SETUP_PLACE_TILE") return refuse("place a setup tile now");
  if (actor.setupTiles.length === 0) return refuse("you have no setup tiles left");
  const { hex } = action;
  if (draft.tiles.some((t) => hexKey(t.hex) === hexKey(hex))) return refuse("hex is occupied");
  if (neighborTiles(draft, hex).length < CONFIG.TILE_MIN_ADJACENCY) {
    return refuse(`a placed tile must touch >= ${CONFIG.TILE_MIN_ADJACENCY} existing tiles`);
  }
  // The player may choose WHICH held tile to place (tileIndex); bots omit it → 0.
  const idx = Math.min(Math.max(action.tileIndex ?? 0, 0), actor.setupTiles.length - 1);
  const def = actor.setupTiles.splice(idx, 1)[0]!;
  const tile = tileFromDef(draft, def, hex);
  draft.tiles.push(tile);
  log(draft, `${actor.name} places ${tile.name}.`);

  if (!advanceSetupPlace(draft)) {
    // Board is built — drop the fixed blocking terrain, then open the draft.
    placeBlockingTerrain(draft);
    draft.stage = "setupDraft";
    draft.setupDraftSeq = snakeOrder(draft.players.length, CONFIG.OPENING_DRAFT_PICKS);
    draft.turnPos = 0;
    log(draft, "Terrain settles — opening draft: take a bourbon.");
  }
  return commit(draft);
}

/** Opening draft (brief §5.5): a snake of OPENING_DRAFT_PICKS bourbons each, from
 *  the non-premium pool. Bourbons only — DPs are seeded in the setupDP step. */
function setupDraftStage(draft: GameState, actor: Player, action: Action): ActionResult {
  if (action.type !== "SETUP_DRAFT_BOURBON") return refuse("draft a bourbon now");
  const lot = draft.market.find((l) => l.id === action.lotId);
  if (!lot) return refuse("no such market lot");
  draft.market = draft.market.filter((l) => l.id !== lot.id);
  actor.bourbons.push({
    id: mintId(draft, "bourbon"),
    defId: lot.def.defId,
    name: lot.def.name,
    tags: lot.def.tags,
    owner: actor.id,
    state: "FRESH",
  });
  refillMarket(draft, CONFIG.marketLots(draft.players.length));
  log(draft, `${actor.name} drafts ${lot.def.name}.`);

  draft.turnPos += 1;
  if (draft.turnPos >= draft.setupDraftSeq.length) {
    // Draft done — each player now plants their starting DPs, in turn order.
    draft.stage = "setupDP";
    draft.setupDraftSeq = setupDPOrder(draft.players.length, CONFIG.STARTING_DPS);
    draft.turnPos = 0;
    log(draft, "Draft complete — place your starting DPs.");
  }
  return commit(draft);
}

/** Starting DPs (brief §5.6): each player plants STARTING_DPS LIVE DPs in turn
 *  order, exempt from the control-adjacency rule. Then age 1 opens. */
function setupDPStage(draft: GameState, actor: Player, action: Action): ActionResult {
  if (action.type !== "SETUP_PLACE_DP") return refuse("place a starting DP now");
  const tile = tileById(draft, action.tileId);
  if (!tile) return refuse("no such tile");
  if (tile.category === "BLOCKING") return refuse("blocking tiles cannot hold DPs");
  if (actor.dpSupply <= 0) return refuse("no DPs left in supply");
  actor.dpSupply -= 1;
  draft.dps.push({ id: mintId(draft, "dp"), owner: actor.id, tileId: tile.id, state: "LIVE", seq: draft.idCounter });
  log(draft, `${actor.name} places a DP on ${tile.name}.`);

  draft.turnPos += 1;
  if (draft.turnPos >= draft.setupDraftSeq.length) finalizeSetup(draft);
  return commit(draft);
}

// ── Age-start stages ─────────────────────────────────────────────────
function startPlanning(draft: GameState): void {
  draft.stage = "planning";
  draft.initiative = draft.pendingInitiative.length ? draft.pendingInitiative : draft.players.map((_, i) => i);
  draft.turnPos = 0;
  for (const p of allPlayers(draft)) {
    p.pipsRemaining = 0;
    p.allowedSuits = [];
    p.turnDone = false;
  }
  runDistilleryTrigger(draft, "onRoundStart");
  log(draft, `Round ${draft.round} begins.`);
}

function tradeStage(draft: GameState, actor: Player, action: Action): ActionResult {
  if (action.type !== "TRADE_OFFER") return refuse("offer trade cards now (may be empty)");
  const ids = action.cardIds.slice(0, CONFIG.TRADE_MAX);
  for (const id of ids) {
    if (!actor.hand.some((c) => c.id === id)) return refuse("offered card not in hand");
  }
  if (new Set(ids).size !== ids.length) return refuse("duplicate card in offer");
  draft.tradeOffers[actor.id] = ids;
  actor.turnDone = true;
  if (!advance(draft)) {
    performTrade(draft, draft.tradeOffers);
    log(draft, "The Trade resolves.");
    // → catch-up, least-Capital first
    draft.stage = "catchup";
    draft.initiative = catchUpOrder(draft);
    draft.turnPos = 0;
    for (const p of allPlayers(draft)) p.turnDone = false;
  }
  return commit(draft);
}

function catchupStage(draft: GameState, actor: Player, action: Action): ActionResult {
  if (action.type !== "CATCHUP_SWAP") return refuse("swap a catch-up card or pass now");
  if (action.boardCardId !== null) {
    const ok = catchUpSwap(draft, actor.id, action.handCardId, action.boardCardId);
    if (!ok) return refuse("invalid catch-up swap");
    log(draft, `${actor.name} swaps a card from the catch-up board.`);
  }
  actor.turnDone = true;
  if (!advance(draft)) startPlanning(draft);
  return commit(draft);
}

// Actions that consume pips (usable in planning via tokens, and in resolve).
function takeAction(draft: GameState, actor: Player, action: Action): string | null | "unhandled" {
  switch (action.type) {
    case "BUILD_DP":
      return doBuildDP(draft, actor, action.tileId);
    case "REPAIR_DP":
      return doRepairDP(draft, actor, action.dpId);
    case "EXPAND_DRAW":
      return doExpandDraw(draft, actor);
    case "EXPAND_PLACE":
      return doExpandPlace(draft, actor, action.hex);
    case "ADD_NICHE_FLAG":
      return doAddFlag(draft, actor, action.tileId);
    case "REMOVE_NICHE_FLAG":
      return doRemoveFlag(draft, actor, action.tileId);
    case "BID":
      return doBid(draft, actor, action.lotId);
    case "MOVE_BID":
      return doMoveBid(draft, actor, action.fromLotId, action.toLotId);
    case "REFRESH":
      return doRefresh(draft, actor, action.bourbonId);
    case "CLAIM_SLOT":
      return doClaimSlot(draft, actor, action.tileId, action.tag);
    case "PUSH": {
      const err = spendPips(actor, CONFIG.COST_PUSH, "PUSH");
      if (err) return err;
      const res = resolvePush(draft, actor.id, action.tileId, action.bourbonIds);
      if (!res.ok) {
        actor.pipsRemaining += CONFIG.COST_PUSH; // refund on refusal
        return res.reason;
      }
      log(draft, res.log);
      return null;
    }
    default:
      return "unhandled";
  }
}

function planning(draft: GameState, actor: Player, action: Action): ActionResult {
  if (action.type === "SPEND_TOKEN") {
    const token: TokenType = action.token;
    if ((actor.tokens[token] ?? 0) <= 0) return refuse("no such token");
    actor.tokens[token] -= 1;
    actor.pipsRemaining += CONFIG.TOKEN_TO_ACTION;
    if (token === "ANY") actor.allowedSuits = [...SUITS];
    else if (!actor.allowedSuits.includes(token)) actor.allowedSuits.push(token as Suit);
    log(draft, `${actor.name} spends a ${token} token.`);
    return commit(draft);
  }
  if (action.type === "END_TURN") {
    actor.turnDone = true;
    if (!advance(draft)) {
      toCommit(draft);
      log(draft, "All players commit their cards.");
    }
    return commit(draft);
  }
  const res = takeAction(draft, actor, action);
  if (res === "unhandled") return refuse(`cannot ${action.type} during planning`);
  if (res) return refuse(res);
  return commit(draft);
}

function commitStage(draft: GameState, actor: Player, action: Action): ActionResult {
  if (action.type !== "COMMIT_PLAY") return refuse(`must commit a play now (got ${action.type})`);
  if (actor.hasCommitted) return refuse("already committed this round");

  const { faceUpIds, sacrificeIds, surrender } = action;
  const all = [...faceUpIds, ...sacrificeIds];
  if (new Set(all).size !== all.length) return refuse("a card cannot be played twice");
  for (const id of all) {
    if (!actor.hand.some((c) => c.id === id)) return refuse("card not in hand");
  }

  if (surrender) {
    // A lone face-down = 1 action of any type, no icon (brief §4).
    if (faceUpIds.length !== 0 || sacrificeIds.length !== 1) {
      return refuse("a surrender is exactly one face-down card");
    }
  } else {
    if (faceUpIds.length < 1) return refuse("play at least one face-up card");
    // Each CHAINED card (beyond the primary) costs one face-down sacrifice (§4).
    const needed = (faceUpIds.length - 1) * CONFIG.SACRIFICE_PER_CHAINED;
    if (sacrificeIds.length !== needed) {
      return refuse(`chaining needs ${needed} sacrifice card(s), got ${sacrificeIds.length}`);
    }
  }

  const take = (id: string) => actor.hand.find((c) => c.id === id)!;
  actor.committedFaceUp = faceUpIds.map(take);
  actor.committedSacrificed = sacrificeIds.map(take);
  actor.surrendered = surrender;
  actor.hand = actor.hand.filter((c) => !all.includes(c.id));
  actor.hasCommitted = true;
  actor.turnDone = true;

  const advanced = advance(draft);
  const allDone = autoPassCardless(draft); // skip any cardless players next in line
  if (!advanced || allDone) {
    if (draft.stage === "commit") toResolve(draft);
    log(draft, "Cards revealed — resolving in initiative order.");
  }
  return commit(draft);
}

function resolve(draft: GameState, actor: Player, action: Action): ActionResult {
  if (action.type === "END_TURN") {
    actor.turnDone = true;
    if (!advance(draft)) endRound(draft);
    return commit(draft);
  }
  const res = takeAction(draft, actor, action);
  if (res === "unhandled") return refuse(`cannot ${action.type} during resolve`);
  if (res) return refuse(res);
  return commit(draft);
}
