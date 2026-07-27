// Bourbonomics: Map Game — the age loop (brief v3 §4, §9).
//
// Age end order: market resolves → niche scoring. Then either the next age opens
// (deal / Trade / catch-up / market refresh) or, after age 5, the game ends
// (most Capital wins; tiebreak most controlled tiles). Capital comes ONLY from
// niche scoring — there is no per-tile income, and bourbons are NOT released
// (depletion persists across ages, §7b).

import { CONFIG } from "./config";
import {
  controlledTiles,
  qualifyingNiches,
  tileById,
  tileController,
  tileOwner,
} from "./derive";
import { runDistilleryTrigger } from "./distilleries";
import { mintId } from "./ids";
import { refillMarket, dealActionHands } from "./setup";
import type { GameState, Player, Reward } from "./types";

function log(draft: GameState, message: string): void {
  draft.log.push({ age: draft.age, round: draft.round, message });
}

function grantReward(player: Player, reward: Reward): void {
  if (reward.kind === "CAPITAL") player.capital += reward.amount;
  else player.tokens[reward.token] += 1;
}

// ── Age end ──────────────────────────────────────────────────────────
function resolveMarket(draft: GameState): void {
  for (const lot of draft.market) {
    // return every marker to its owner's supply
    let winner: string | null = null;
    let best = 0;
    let tied = false;
    for (const [owner, count] of Object.entries(lot.bids)) {
      const p = draft.players.find((pl) => pl.id === owner);
      if (p) p.dpSupply += count;
      if (count > best) {
        best = count;
        winner = owner;
        tied = false;
      } else if (count === best && count > 0) {
        tied = true;
      }
    }
    if (winner && !tied && best > 0) {
      const p = draft.players.find((pl) => pl.id === winner)!;
      p.bourbons.push({
        id: mintId(draft, "bourbon"),
        defId: lot.def.defId,
        name: lot.def.name,
        tags: lot.def.tags,
        owner: winner,
        state: "FRESH",
      });
      log(draft, `${p.name} wins ${lot.def.name} at market.`);
    } else if (best > 0) {
      log(draft, `${lot.def.name} contested to a tie — discarded.`);
    }
  }
  draft.market = [];
}

/**
 * Niche scoring (brief §10) — the ONLY source of Capital. Two stacking tiers,
 * per qualifying niche (>= NICHE_MIN_TILES contiguous claims):
 *   tier 1 — +1 Capital per claim you CONTROL in the niche.
 *   tier 2 (ALL-OR-NOTHING) — if you control EVERY tile in the niche, collect
 *            ALL of its rewards. Control any fewer → nothing. Control here means
 *            one more LIVE DP than any rival (NOT monopoly).
 * Non-niche tiles score 0.
 */
function scoreNiches(draft: GameState): void {
  for (const player of draft.players) {
    for (const niche of qualifyingNiches(draft, player.id)) {
      const tiles = niche.tileIds.map((id) => tileById(draft, id)!).filter(Boolean);
      const controlled = tiles.filter((t) => tileController(draft, t.id) === player.id);

      // tier 1 — +1 per controlled claim
      const base = controlled.length * CONFIG.CAPITAL_PER_CONTROLLED_CLAIM;
      if (base > 0) {
        player.capital += base;
        log(draft, `${player.name} scores ${base} Capital from a niche (${controlled.length} controlled claims).`);
      }

      // tier 2 — control the WHOLE niche → take every reward in it (else none)
      if (tiles.length > 0 && controlled.length === tiles.length) {
        for (const t of tiles) if (t.reward) grantReward(player, t.reward);
        log(draft, `${player.name} controls an entire niche — collects all its rewards.`);
      }
    }
  }
}

/** Any rival LIVE DP present on a tile (DARK rivals don't count — brief §9). */
function anyRivalLive(draft: GameState, tileId: string, playerId: string): boolean {
  return draft.dps.some((d) => d.tileId === tileId && d.state === "LIVE" && d.owner !== playerId);
}

function keystonePayout(draft: GameState): void {
  for (const tile of draft.tiles) {
    if (tile.keystoneTokensPerAge <= 0) continue;
    const owner = tileOwner(draft, tile.id);
    if (!owner) continue;
    const p = draft.players.find((pl) => pl.id === owner);
    if (p) {
      p.tokens.ANY += tile.keystoneTokensPerAge;
      log(draft, `${p.name} collects ${tile.keystoneTokensPerAge} ANY token from ${tile.name}.`);
    }
  }
}

/** "Word of Mouth": earns its owner bonus if held uncontested a full age (§13). */
function convertLoyalty(draft: GameState): void {
  for (const tile of draft.tiles) {
    if (!tile.convertsToLoyalty || tile.ownerSlotDP) continue;
    const owner = tileController(draft, tile.id);
    if (!owner) continue;
    if (anyRivalLive(draft, tile.id, owner)) continue;
    // seat the uncontested controller's LIVE DP in the slot
    const dp = draft.dps.find((d) => d.tileId === tile.id && d.owner === owner && d.state === "LIVE");
    if (dp) {
      tile.ownerSlotDP = dp.id;
      log(draft, `${tile.name} converts — its owner earns the loyalty bonus.`);
    }
  }
}

function declareWinner(draft: GameState): void {
  draft.phase = "ended";
  const ranked = [...draft.players].sort(
    (a, b) => b.capital - a.capital || controlledTiles(draft, b.id).length - controlledTiles(draft, a.id).length,
  );
  const top = ranked[0]!;
  log(draft, `Game over — ${top.name} wins with ${top.capital} Capital.`);
}

/**
 * Runs the whole age-end sequence, then opens the next age (or ends the game).
 * carryInitiative is the rank order from the final round (survey Q11): later
 * ages' round 1 carries it.
 */
export function runAgeEnd(draft: GameState, carryInitiative: number[]): void {
  log(draft, `Age ${draft.age} ends.`);
  runDistilleryTrigger(draft, "onAgeEnd");
  resolveMarket(draft);
  keystonePayout(draft);
  convertLoyalty(draft);
  runDistilleryTrigger(draft, "onScoring");
  scoreNiches(draft); // the ONLY source of Capital (brief §9)
  // Bourbons are NOT released — depletion persists across ages (§7b).

  if (draft.age >= CONFIG.AGES) {
    declareWinner(draft);
    return;
  }

  // — open the next age: deal, then the interactive trade → catch-up stages —
  draft.age += 1;
  draft.round = 1;
  draft.pendingInitiative = carryInitiative;
  log(draft, `Age ${draft.age} begins.`);
  beginAgeStart(draft);
}

/**
 * Age-start setup shared by age 1 (from createGame) and later ages (from
 * runAgeEnd): refresh the market and deal HAND_DRAW cards, then open the
 * interactive CULL stage where each player discards down to HAND_SIZE (brief
 * §4/§12 — draw 6, keep 5). Culling completes → beginPlanning opens round 1.
 * pendingInitiative holds the round-1 order.
 */
export function beginAgeStart(draft: GameState): void {
  runDistilleryTrigger(draft, "onAgeStart");
  refillMarket(draft, CONFIG.marketLots(draft.players.length));
  dealActionHands(draft);
  draft.stage = "cull";
  draft.initiative = draft.pendingInitiative.length ? draft.pendingInitiative : draft.players.map((_, i) => i);
  draft.turnPos = 0;
  log(draft, `Age ${draft.age}, round ${draft.round} — draw ${CONFIG.HAND_DRAW}, keep ${CONFIG.HAND_SIZE}.`);
}

/**
 * The cull stage is done — every player is down to HAND_SIZE. Open round-1
 * planning proper: reset the acting order and each player's pip/suit state.
 */
export function beginPlanning(draft: GameState): void {
  draft.stage = "planning";
  draft.initiative = draft.pendingInitiative.length ? draft.pendingInitiative : draft.players.map((_, i) => i);
  draft.turnPos = 0;
  for (const p of draft.players) {
    p.pipsRemaining = 0;
    p.allowedSuits = [];
    p.turnDone = false;
  }
  runDistilleryTrigger(draft, "onRoundStart");
  log(draft, `Round ${draft.round} begins.`);
}
