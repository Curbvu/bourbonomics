// Bourbonomics: Map Game — deterministic auto-player.
//
// autoAction() returns a legal-ish action for the CURRENT actor at any stage.
// It is deliberately simple (v0 bots build, flag, bid, and defend; they open
// with light aggression). stepAuto() applies it and falls back to END_TURN if
// the engine refuses, guaranteeing forward progress and termination.

import { applyAction } from "./engine";
import { canPlaceDP, liveDPCount, tileController } from "./derive";
import { fit } from "./fit";
import { firstOpenDPTarget, placementCandidates } from "./setup";
import type { Action, GameState, Player, Tile } from "./types";
import { SUIT_ACTIONS } from "./types";

function actor(state: GameState): Player {
  // The opening draft (snake) and starting-DP step both iterate the setup
  // sequence; other stages iterate `initiative`.
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

/**
 * Step every consecutive bot actor until it's a human's turn or the game ends.
 * Runs through the setup phase too. Used by the UI to hand control back to the
 * human as soon as they must act.
 */
export function autoAdvance(state: GameState, maxSteps = 10000): GameState {
  let s = state;
  let steps = 0;
  while (inProgress(s) && currentActorOf(s).isBot && steps < maxSteps) {
    s = stepAuto(s);
    steps += 1;
  }
  return s;
}

function permits(p: Player, type: Action["type"]): boolean {
  return p.allowedSuits.some((s) => (SUIT_ACTIONS[s] as string[]).includes(actionKind(type)));
}

/** Map an Action.type to the ActionType used in SUIT_ACTIONS. */
function actionKind(type: Action["type"]): string {
  switch (type) {
    case "EXPAND_DRAW":
    case "EXPAND_PLACE":
      return "EXPAND_MARKET";
    case "MOVE_BID":
      return "BID";
    default:
      return type;
  }
}

export function autoAction(state: GameState): Action {
  const p = actor(state);

  // Setup (brief §5): place tiles at the first valid spot; draft the richest
  // bourbon on offer; then plant starting DPs on open ground.
  if (state.stage === "setupPlace") {
    const hex = placementCandidates(state)[0] ?? { q: 0, r: 0 };
    return { type: "SETUP_PLACE_TILE", hex };
  }
  if (state.stage === "setupDraft") {
    const lot = state.market.reduce((a, b) => (b.def.tags.length > a.def.tags.length ? b : a));
    return { type: "SETUP_DRAFT_BOURBON", lotId: lot.id };
  }
  if (state.stage === "setupDP") {
    const target = firstOpenDPTarget(state, p.id);
    if (target) return { type: "SETUP_PLACE_DP", tileId: target.id };
    return { type: "SETUP_PLACE_DP", tileId: state.tiles[0]!.id }; // safeguard
  }

  // Age start: bots offer nothing to the Trade and pass on catch-up (v0).
  if (state.stage === "trade") return { type: "TRADE_OFFER", cardIds: [] };
  if (state.stage === "catchup") return { type: "CATCHUP_SWAP", handCardId: "", boardCardId: null };

  if (state.stage === "planning") return { type: "END_TURN" };

  if (state.stage === "commit") {
    // v0: play a single highest-pips card face-up (no chaining). Deterministic.
    const card = [...p.hand].sort((a, b) => b.pips - a.pips || a.id.localeCompare(b.id))[0];
    if (!card) return { type: "COMMIT_PLAY", faceUpIds: [], sacrificeIds: [], surrender: false };
    return { type: "COMMIT_PLAY", faceUpIds: [card.id], sacrificeIds: [], surrender: false };
  }

  // resolve
  if (p.pipsRemaining <= 0) return { type: "END_TURN" };

  // 1. Push: a tile where we have a LIVE DP, a rival is present, and we own a fitting FRESH bourbon.
  if (permits(p, "PUSH")) {
    const target = pushTarget(state, p);
    if (target) return { type: "PUSH", tileId: target.tileId, bourbonIds: target.bourbonIds };
  }

  // 1b. Refresh a depleted bourbon so we can fight again.
  if (permits(p, "REFRESH")) {
    const dep = p.bourbons.find((b) => b.state === "DEPLETED");
    if (dep) return { type: "REFRESH", bourbonId: dep.id };
  }

  // 2. Build DP on the best available tile.
  if (permits(p, "BUILD_DP") && p.dpSupply > 0) {
    const tile = buildTarget(state, p);
    if (tile) return { type: "BUILD_DP", tileId: tile.id };
  }

  // 3. Add a niche flag on a controlled, unflagged tile.
  if (permits(p, "ADD_NICHE_FLAG")) {
    const tile = state.tiles.find(
      (t) =>
        t.category !== "BLOCKING" &&
        tileController(state, t.id) === p.id &&
        !state.nicheFlags.some((f) => f.owner === p.id && f.tileId === t.id),
    );
    if (tile) return { type: "ADD_NICHE_FLAG", tileId: tile.id };
  }

  // 4. Bid on a market lot with a bourbon that fits something we care about.
  if (permits(p, "BID") && p.dpSupply > 0 && state.market.length > 0) {
    const lot = [...state.market].sort((a, b) => b.def.tags.length - a.def.tags.length)[0]!;
    return { type: "BID", lotId: lot.id };
  }

  // 5. Repair a DARK DP.
  if (permits(p, "REPAIR_DP")) {
    const dp = state.dps.find((d) => d.owner === p.id && d.state === "DARK");
    if (dp) return { type: "REPAIR_DP", dpId: dp.id };
  }

  return { type: "END_TURN" };
}

function buildTarget(state: GameState, p: Player): Tile | undefined {
  const demand = state.tiles.filter((t) => t.category !== "BLOCKING" && canPlaceDP(state, p.id, t.id));
  // prefer uncontrolled tiles we can reach, then our own (reinforce)
  const uncontrolled = demand.filter((t) => tileController(state, t.id) === null);
  return (uncontrolled[0] ?? demand.find((t) => tileController(state, t.id) === p.id) ?? demand[0]);
}

function pushTarget(
  state: GameState,
  p: Player,
): { tileId: string; bourbonIds: string[] } | null {
  for (const t of state.tiles) {
    if (t.category === "BLOCKING") continue;
    if (liveDPCount(state, t.id, p.id) < 1) continue;
    const rival = state.dps.some((d) => d.tileId === t.id && d.owner !== p.id && d.state === "LIVE");
    if (!rival) continue;
    const tags = t.wildcardTag ? [t.wildcardTag] : t.tags;
    const cap = liveDPCount(state, t.id, p.id);
    const usable = p.bourbons
      .filter((b) => b.state === "FRESH") // only FRESH is committable (§7b)
      .map((b) => ({ id: b.id, f: fit(b.tags, tags) }))
      .filter((b) => b.f > 0)
      .sort((a, b) => b.f - a.f || a.id.localeCompare(b.id))
      .slice(0, cap);
    if (usable.length > 0) return { tileId: t.id, bourbonIds: usable.map((b) => b.id) };
  }
  return null;
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
