// Bourbonomics: Map Game — deterministic strategic auto-player.
//
// The bot plays to the win condition: build ONE contiguous niche, control every
// tile in it (v4 tier-2 is all-or-nothing), and flag it. Around that spine it
// pushes only when it will win, refreshes to re-arm, claims ownership slots, and
// bids for bourbons that fit its tiles. It picks cards (chaining when useful) and
// spends tokens to unlock the capability it wants. Fully deterministic — every
// tie is broken by id — and stepAuto() falls back to END_TURN so it can never
// stall or loop.

import { applyAction } from "./engine";
import { CONFIG } from "./config";
import {
  canAddFlag,
  canPlaceDP,
  derivedNiches,
  liveDPCount,
  tileById,
  tileController,
  tileOwner,
  tilesAdjacent,
} from "./derive";
import { fit } from "./fit";
import { hexDistance } from "./hex";
import { firstOpenDPTarget, placementCandidates } from "./setup";
import type { Tag } from "./tags";
import type { Action, GameState, Player, Suit, Tile } from "./types";
import { SUIT_ACTIONS } from "./types";

// ── Turn plumbing ────────────────────────────────────────────────────
function actor(state: GameState): Player {
  const usesSetupSeq = state.stage === "setupDraft" || state.stage === "setupDP";
  const seq = usesSetupSeq ? state.setupDraftSeq : state.initiative;
  return state.players[seq[state.turnPos]!]!;
}

/** The player whose turn it is right now. */
export function currentActorOf(state: GameState): Player {
  return actor(state);
}

/** True while the game still expects actor input (setup or play). */
function inProgress(s: GameState): boolean {
  return s.phase === "playing" || s.phase === "setup";
}

export function autoAdvance(state: GameState, maxSteps = 10000): GameState {
  let s = state;
  let steps = 0;
  while (inProgress(s) && currentActorOf(s).isBot && steps < maxSteps) {
    s = stepAuto(s);
    steps += 1;
  }
  return s;
}

/** Apply one auto action; fall back to END_TURN if the engine refuses. */
export function stepAuto(state: GameState): GameState {
  const action = autoAction(state);
  const res = applyAction(state, action);
  if (res.ok) return res.state;
  const fallback = applyAction(state, { type: "END_TURN" });
  return fallback.ok ? fallback.state : state;
}

/** Drive an all-auto game (setup included) to its end. Guards runaway loops. */
export function playToEnd(state: GameState, maxSteps = 100000): GameState {
  let s = state;
  let steps = 0;
  while (inProgress(s) && steps < maxSteps) {
    s = stepAuto(s);
    steps += 1;
  }
  return s;
}

// ── Capabilities & permissions ───────────────────────────────────────
type Cap = "DP" | "NICHE" | "PUSH" | "BOURBON" | "EXPAND";

/** The suits that grant each capability (v4 §6 — each cap in exactly 2 suits). */
const CAP_SUITS: Record<Cap, Suit[]> = {
  DP: ["DISTRIBUTION", "BUSINESS_DEV"],
  NICHE: ["SALES", "MARKETING"],
  PUSH: ["SALES", "MARKETING"],
  BOURBON: ["SOURCING", "DISTILL"],
  EXPAND: ["BUSINESS_DEV", "SOURCING"],
};

/** Does the player's committed suits permit this raw action type right now? */
function permits(p: Player, type: Action["type"]): boolean {
  return p.allowedSuits.some((s) => (SUIT_ACTIONS[s] as string[]).includes(actionKind(type)));
}

function actionKind(type: Action["type"]): string {
  switch (type) {
    case "EXPAND_DRAW":
    case "EXPAND_PLACE":
      return "EXPAND_MARKET";
    case "MOVE_BID":
      return "BID";
    case "CLAIM_SLOT":
      return "BUILD_DP"; // claiming a slot is gated as a Build DP
    default:
      return type;
  }
}

// ── Board valuation ──────────────────────────────────────────────────
function tileValue(t: Tile): number {
  let v = 1;
  if (t.reward?.kind === "CAPITAL") v += t.reward.amount * 2;
  else if (t.reward?.kind === "TOKEN") v += 2;
  if (t.ownershipSlot) v += 1;
  return v;
}

function targetTags(t: Tile): Tag[] {
  return t.wildcardTag ? [t.wildcardTag] : t.tags;
}

/** The bot's intended niche: a contiguous set of ~NICHE_MIN non-blocking tiles
 *  grown from where it already has flags (or its best foothold). Deterministic. */
function targetRegion(state: GameState, p: Player): Tile[] {
  const nonBlocking = state.tiles.filter((t) => t.category !== "BLOCKING");
  if (nonBlocking.length === 0) return [];

  const niches = derivedNiches(state, p.id).sort(
    (a, b) => b.tileIds.length - a.tileIds.length || a.tileIds[0]!.localeCompare(b.tileIds[0]!),
  );
  let seedIds: string[];
  if (niches.length > 0) {
    seedIds = niches[0]!.tileIds;
  } else {
    // No flags yet — seed on my best DP tile, else the best value tile anywhere.
    const myDP = nonBlocking.filter((t) => state.dps.some((d) => d.owner === p.id && d.tileId === t.id));
    const pool = myDP.length ? myDP : nonBlocking;
    const seed = [...pool].sort((a, b) => tileValue(b) - tileValue(a) || a.id.localeCompare(b.id))[0]!;
    seedIds = [seed.id];
  }

  const region = new Set(seedIds);
  while (region.size < CONFIG.NICHE_MIN_TILES) {
    let best: Tile | null = null;
    for (const nb of nonBlocking) {
      if (region.has(nb.id)) continue;
      const touches = [...region].some((id) => {
        const rt = tileById(state, id);
        return rt ? tilesAdjacent(rt, nb) : false;
      });
      if (!touches) continue;
      if (!best || tileValue(nb) > tileValue(best) || (tileValue(nb) === tileValue(best) && nb.id < best.id)) {
        best = nb;
      }
    }
    if (!best) break; // region is walled off — take what we have
    region.add(best.id);
  }
  return [...region].map((id) => tileById(state, id)!).filter(Boolean);
}

// ── Combat evaluation ────────────────────────────────────────────────
/** The strongest commitment a player could field on a tile (best FRESH bourbons
 *  up to their LIVE-DP count + owner defense). Mirrors the engine's resolver. */
function bestCommit(state: GameState, tile: Tile, playerId: string): { ids: string[]; strength: number } {
  const p = state.players.find((pl) => pl.id === playerId);
  if (!p) return { ids: [], strength: 0 };
  const cap = liveDPCount(state, tile.id, playerId);
  const tags = targetTags(tile);
  const ranked = p.bourbons
    .filter((b) => b.state === "FRESH")
    .map((b) => ({ id: b.id, f: fit(b.tags, tags) }))
    .filter((b) => b.f > 0)
    .sort((a, b) => b.f - a.f || a.id.localeCompare(b.id))
    .slice(0, cap);
  let strength = ranked.reduce((n, b) => n + b.f, 0);
  if (strength > 0 && tileOwner(state, tile.id) === playerId) strength += tile.defenseBonus;
  return { ids: ranked.map((b) => b.id), strength };
}

/** A winnable push: a tile where I have a LIVE DP, a rival has LIVE DPs, and my
 *  best commitment strictly beats every rival's best. Region tiles come first. */
function pickPush(
  state: GameState,
  p: Player,
  region: Tile[],
): { tileId: string; bourbonIds: string[] } | null {
  const regionIds = new Set(region.map((t) => t.id));
  const candidates = state.tiles
    .filter((t) => t.category !== "BLOCKING" && liveDPCount(state, t.id, p.id) >= 1)
    .sort((a, b) => Number(regionIds.has(b.id)) - Number(regionIds.has(a.id)) || tileValue(b) - tileValue(a) || a.id.localeCompare(b.id));

  for (const t of candidates) {
    const rivals = state.players.filter((r) => r.id !== p.id && liveDPCount(state, t.id, r.id) >= 1);
    if (rivals.length === 0) continue; // nothing to push out
    const mine = bestCommit(state, t, p.id);
    if (mine.strength <= 0) continue;
    const rivalBest = Math.max(...rivals.map((r) => bestCommit(state, t, r.id).strength));
    if (mine.strength > rivalBest) return { tileId: t.id, bourbonIds: mine.ids };
  }
  return null;
}

// ── Non-combat picks ─────────────────────────────────────────────────
/** A region tile I can legally flag and haven't — highest value first. */
function pickFlag(state: GameState, p: Player, region: Tile[]): Tile | null {
  const flagged = new Set(state.nicheFlags.filter((f) => f.owner === p.id).map((f) => f.tileId));
  return (
    [...region]
      .filter((t) => !flagged.has(t.id) && canAddFlag(state, p.id, t.id))
      .sort((a, b) => tileValue(b) - tileValue(a) || a.id.localeCompare(b.id))[0] ?? null
  );
}

/** A region tile to build on: gain control of an uncontrolled tile, else reinforce
 *  a controlled-but-contested one. Never waste DARK DPs on rival strongholds. */
function pickBuild(state: GameState, p: Player, region: Tile[]): Tile | null {
  if (p.dpSupply <= 0) return null;
  const buildable = region.filter((t) => canPlaceDP(state, p.id, t.id));
  const uncontrolled = buildable
    .filter((t) => tileController(state, t.id) === null)
    .sort((a, b) => tileValue(b) - tileValue(a) || a.id.localeCompare(b.id));
  if (uncontrolled[0]) return uncontrolled[0];
  // reinforce mine where a rival is closing in (has any LIVE DP)
  const contested = buildable
    .filter(
      (t) =>
        tileController(state, t.id) === p.id &&
        state.players.some((r) => r.id !== p.id && liveDPCount(state, t.id, r.id) >= 1),
    )
    .sort((a, b) => tileValue(b) - tileValue(a) || a.id.localeCompare(b.id));
  return contested[0] ?? null;
}

/** An empty ownership slot in the region I can seat a DP into. */
function pickSlot(state: GameState, p: Player, region: Tile[]): Tile | null {
  if (p.dpSupply <= 0) return null;
  return (
    region
      .filter((t) => t.ownershipSlot && !t.ownerSlotDP && canPlaceDP(state, p.id, t.id))
      .sort((a, b) => tileValue(b) - tileValue(a) || a.id.localeCompare(b.id))[0] ?? null
  );
}

/** A depleted bourbon worth refreshing: I have no fresh ammo but a live front. */
function pickRefresh(state: GameState, p: Player): string | null {
  const fresh = p.bourbons.some((b) => b.state === "FRESH");
  if (fresh) return null;
  const depleted = p.bourbons.filter((b) => b.state === "DEPLETED");
  if (depleted.length === 0) return null;
  const front = state.tiles.some(
    (t) =>
      t.category !== "BLOCKING" &&
      liveDPCount(state, t.id, p.id) >= 1 &&
      state.players.some((r) => r.id !== p.id && liveDPCount(state, t.id, r.id) >= 1),
  );
  if (!front) return null;
  // refresh the bourbon with the broadest reach across contested tiles
  return [...depleted]
    .map((b) => ({ id: b.id, r: state.tiles.reduce((n, t) => n + fit(b.tags, targetTags(t)), 0) }))
    .sort((a, b) => b.r - a.r || a.id.localeCompare(b.id))[0]!.id;
}

/** A market lot that best fits my region — bid to widen my bourbon coverage. */
function pickBid(state: GameState, p: Player, region: Tile[]): string | null {
  if (p.dpSupply <= 0 || state.market.length === 0) return null;
  const freshCount = p.bourbons.filter((b) => b.state === "FRESH").length;
  if (freshCount >= region.length) return null; // enough ammo already
  const scored = state.market
    .map((lot) => ({ id: lot.id, v: region.reduce((n, t) => n + fit(lot.def.tags, targetTags(t)), 0) }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v || a.id.localeCompare(b.id));
  return scored[0]?.id ?? null;
}

// ── The core action picker (shared by planning + resolve) ────────────
/** Choose one pip-spending action for `p`, or null if nothing worthwhile is
 *  permitted. `p` may be a shallow view with overridden allowedSuits/pips. */
function act(state: GameState, p: Player): Action | null {
  const region = targetRegion(state, p);

  // 1. Flag a region tile — grow the niche toward 5 contiguous claims.
  if (permits(p, "ADD_NICHE_FLAG")) {
    const t = pickFlag(state, p, region);
    if (t) return { type: "ADD_NICHE_FLAG", tileId: t.id };
  }
  // 2. Seize an empty ownership slot in the region.
  if (permits(p, "CLAIM_SLOT")) {
    const t = pickSlot(state, p, region);
    if (t) return { type: "CLAIM_SLOT", tileId: t.id, tag: preferredTag(p) };
  }
  // 3. Build to control a region tile.
  if (permits(p, "BUILD_DP")) {
    const t = pickBuild(state, p, region);
    if (t) return { type: "BUILD_DP", tileId: t.id };
  }
  // 4. Push a rival off a tile I can win.
  if (permits(p, "PUSH")) {
    const push = pickPush(state, p, region);
    if (push) return { type: "PUSH", tileId: push.tileId, bourbonIds: push.bourbonIds };
  }
  // 5. Re-arm so I can push next time.
  if (permits(p, "REFRESH")) {
    const id = pickRefresh(state, p);
    if (id) return { type: "REFRESH", bourbonId: id };
  }
  // 6. Repair a DARK DP of mine.
  if (permits(p, "REPAIR_DP")) {
    const dp = state.dps.find((d) => d.owner === p.id && d.state === "DARK");
    if (dp) return { type: "REPAIR_DP", dpId: dp.id };
  }
  // 7. Bid for a bourbon that fits my region.
  if (permits(p, "BID")) {
    const lotId = pickBid(state, p, region);
    if (lotId) return { type: "BID", lotId };
  }
  // 8. Expand: place a held tile next to the region, or draw if the region is
  //    walled short of a full niche.
  if (permits(p, "EXPAND_DRAW")) {
    if (p.heldTile) {
      const cands = placementCandidates(state);
      const regionHexes = region.map((t) => t.hex);
      const spot =
        cands.find((h) => regionHexes.some((rh) => hexDistance(rh, h) === 1)) ?? cands[0];
      if (spot) return { type: "EXPAND_PLACE", hex: spot };
    } else if (region.length < CONFIG.NICHE_MIN_TILES && state.tileSupply.length > 0) {
      return { type: "EXPAND_DRAW" };
    }
  }
  return null;
}

/** The grain a bot declares on a claimed wildcard slot — its commonest tag. */
function preferredTag(p: Player): Tag {
  const counts = new Map<string, { tag: Tag; n: number }>();
  for (const b of p.bourbons) {
    for (const t of b.tags) {
      if (t.kind !== "GRAIN") continue;
      const k = t.value;
      counts.set(k, { tag: t, n: (counts.get(k)?.n ?? 0) + 1 });
    }
  }
  const best = [...counts.values()].sort((a, b) => b.n - a.n)[0];
  return best?.tag ?? { kind: "GRAIN", value: "TRADITIONAL" };
}

// ── Card / token planning ────────────────────────────────────────────
/** The capabilities the bot wants this round, in priority order. */
function desiredCaps(state: GameState, p: Player): Cap[] {
  const region = targetRegion(state, p);
  const caps: Cap[] = [];
  const need = (c: Cap) => {
    if (!caps.includes(c)) caps.push(c);
  };

  if (p.dpSupply > 0 && region.some((t) => tileController(state, t.id) !== p.id && canPlaceDP(state, p.id, t.id))) need("DP");
  if (pickFlag(state, p, region)) need("NICHE");
  if (pickPush(state, p, region)) need("PUSH");
  if (pickRefresh(state, p) || pickBid(state, p, region)) need("BOURBON");
  if (p.heldTile || region.length < CONFIG.NICHE_MIN_TILES) need("EXPAND");
  // always keep the two scoring levers on the table as fallbacks
  need("DP");
  need("NICHE");
  return caps;
}

/** Highest-pips hand card whose suit serves one of `suits`. */
function bestCardIn(hand: Player["hand"], suits: Suit[], exclude: Set<string>): Player["hand"][number] | null {
  return (
    [...hand]
      .filter((c) => suits.includes(c.suit) && !exclude.has(c.id))
      .sort((a, b) => b.pips - a.pips || a.id.localeCompare(b.id))[0] ?? null
  );
}

/** Choose a commit: a primary card for the top desired capability, optionally
 *  chaining a second card that adds a different capability (paid by a sacrifice). */
function chooseCommit(state: GameState, p: Player): Action {
  const caps = desiredCaps(state, p);
  const empty: Set<string> = new Set();

  let primary = null as ReturnType<typeof bestCardIn>;
  for (const cap of caps) {
    primary = bestCardIn(p.hand, CAP_SUITS[cap], empty);
    if (primary) break;
  }
  if (!primary) primary = bestCardIn(p.hand, [...new Set(Object.values(CAP_SUITS).flat())], empty);
  if (!primary) return { type: "COMMIT_PLAY", faceUpIds: [], sacrificeIds: [], surrender: false };

  const faceUp = [primary.id];
  const sacrifice: string[] = [];

  // Chain a second capability when the hand can spare a card + a sacrifice.
  if (p.hand.length >= 4) {
    const used = new Set([primary.id]);
    for (const cap of caps) {
      if (CAP_SUITS[cap].includes(primary.suit)) continue; // already covered
      const second = bestCardIn(p.hand, CAP_SUITS[cap], used);
      if (!second) continue;
      used.add(second.id);
      const sac = [...p.hand]
        .filter((c) => !used.has(c.id))
        .sort((a, b) => a.pips - b.pips || a.id.localeCompare(b.id))[0];
      if (sac) {
        faceUp.push(second.id);
        sacrifice.push(sac.id);
      }
      break;
    }
  }
  return { type: "COMMIT_PLAY", faceUpIds: faceUp, sacrificeIds: sacrifice, surrender: false };
}

/** A token whose suit would unlock a useful action right now (planning phase). */
function usefulToken(state: GameState, p: Player): Suit | "ANY" | null {
  const caps = desiredCaps(state, p);
  const trySuit = (suit: Suit): boolean => {
    const view: Player = { ...p, allowedSuits: [...p.allowedSuits, suit], pipsRemaining: p.pipsRemaining + 1 };
    return act(state, view) !== null;
  };
  for (const cap of caps) {
    for (const suit of CAP_SUITS[cap]) {
      if ((p.tokens[suit] ?? 0) > 0 && trySuit(suit)) return suit;
    }
  }
  if ((p.tokens.ANY ?? 0) > 0) {
    for (const cap of caps) {
      for (const suit of CAP_SUITS[cap]) {
        if (trySuit(suit)) return "ANY";
      }
    }
  }
  return null;
}

// ── Per-stage dispatch ───────────────────────────────────────────────
export function autoAction(state: GameState): Action {
  const p = actor(state);

  // Setup (brief §5): place tiles, draft bourbons, then plant starting DPs.
  if (state.stage === "setupPlace") {
    const hex = placementCandidates(state)[0] ?? { q: 0, r: 0 };
    return { type: "SETUP_PLACE_TILE", hex };
  }
  if (state.stage === "setupDraft") {
    // draft the bourbon with the widest fit across the current board
    const lot = [...state.market].sort(
      (a, b) =>
        state.tiles.reduce((n, t) => n + fit(b.def.tags, targetTags(t)), 0) -
          state.tiles.reduce((n, t) => n + fit(a.def.tags, targetTags(t)), 0) || a.id.localeCompare(b.id),
    )[0];
    if (lot) return { type: "SETUP_DRAFT_BOURBON", lotId: lot.id };
  }
  if (state.stage === "setupDP") {
    const region = targetRegion(state, p);
    const spot = region.find((t) => !state.dps.some((d) => d.tileId === t.id)) ?? region[0];
    const target = spot ?? firstOpenDPTarget(state, p.id);
    if (target) return { type: "SETUP_PLACE_DP", tileId: target.id };
    return { type: "SETUP_PLACE_DP", tileId: state.tiles[0]!.id };
  }

  // Age start.
  if (state.stage === "trade") return { type: "TRADE_OFFER", cardIds: [] };
  if (state.stage === "catchup") return catchupMove(state, p);

  // Planning: spend a token if it buys a useful action, then take it.
  if (state.stage === "planning") {
    if (p.pipsRemaining > 0) {
      const a = act(state, p);
      return a ?? { type: "END_TURN" };
    }
    const tok = usefulToken(state, p);
    if (tok) return { type: "SPEND_TOKEN", token: tok };
    return { type: "END_TURN" };
  }

  if (state.stage === "commit") return chooseCommit(state, p);

  // Resolve: spend the card's pips on the plan.
  if (state.stage === "resolve") {
    if (p.pipsRemaining <= 0) return { type: "END_TURN" };
    const a = act(state, p);
    return a ?? { type: "END_TURN" };
  }

  return { type: "END_TURN" };
}

/** Catch-up: if my hand can't score (no Sales/Marketing card), grab one. */
function catchupMove(state: GameState, p: Player): Action {
  const scoringSuits: Suit[] = ["SALES", "MARKETING"];
  const hasScoring = p.hand.some((c) => scoringSuits.includes(c.suit));
  if (!hasScoring) {
    const board = bestCardIn(state.catchUpBoard, scoringSuits, new Set());
    if (board) {
      const give = [...p.hand].sort((a, b) => a.pips - b.pips || a.id.localeCompare(b.id))[0];
      if (give) return { type: "CATCHUP_SWAP", handCardId: give.id, boardCardId: board.id };
    }
  }
  return { type: "CATCHUP_SWAP", handCardId: "", boardCardId: null };
}
