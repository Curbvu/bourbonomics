// Bourbonomics: Map Game — the Push (brief v3 §8). Deterministic combat.
//
// A Push is a fight for one TILE. The initiator is the attacker; everyone with
// LIVE DPs on the tile takes part. Pushing is FREE (1 Sales action, no Capital).
//
// Strength = summed fit of committed FRESH bourbons; the tile's OWNER adds its
// defense bonus. Highest wins. A TIE does nothing (no DP removal, no tile
// change). Margin = winner − loser removes that many of the loser's DPs, 1:1
// OUTRIGHT (one step). ALL committed bourbons DEPLETE (win/lose/tie).
//
// Ownership capture (§8): to take a WILDCARD tile's slot you must remove ALL the
// owner's DPs with the ownership-slot DP removed LAST; once the slot is clear the
// winner immediately seats one of their LIVE DPs in it.
//
// v0 defender policy (deterministic): each defender fields its best FRESH
// bourbons (up to its LIVE-DP count) if that would win, or tie-to-hold when it
// owns/controls the tile; otherwise it retreats to keep its bourbons.

import { liveDPCount, tileById, tileController, tileOwner } from "./derive";
import { runDistilleryTrigger } from "./distilleries";
import { fit } from "./fit";
import type { Tag } from "./tags";
import type { Bourbon, GameState, Tile } from "./types";

export interface PushResult {
  ok: true;
  winner: string | null; // null = tie (nothing happens)
  log: string;
}
export interface PushRefusal {
  ok: false;
  reason: string;
}

/** The demand a bourbon is scored against: a claimed wildcard, else the tags. */
function targetTags(tile: Tile): Tag[] {
  return tile.wildcardTag ? [tile.wildcardTag] : tile.tags;
}

/** FRESH bourbons a player may commit (brief §7b — only FRESH is committable). */
function freshBourbons(state: GameState, playerId: string): Bourbon[] {
  const p = state.players.find((pl) => pl.id === playerId);
  return p ? p.bourbons.filter((b) => b.state === "FRESH") : [];
}

function strengthOf(state: GameState, tile: Tile, playerId: string, bourbonIds: string[]): number {
  const p = state.players.find((pl) => pl.id === playerId)!;
  const tags = targetTags(tile);
  let s = 0;
  for (const id of bourbonIds) {
    const b = p.bourbons.find((x) => x.id === id);
    if (b) s += fit(b.tags, tags);
  }
  // The tile's owner adds its defense bonus when committing a defense.
  if (s > 0 && tileOwner(state, tile.id) === playerId) s += tile.defenseBonus;
  return s;
}

/**
 * Remove `margin` of a loser's DPs, 1:1 outright. Oldest-first (by seq). For the
 * tile's OWNER the ownership-slot DP is removed LAST (its other DPs shield it).
 * Returns whether the slot DP was removed (owner cleared).
 */
function applyDamage(draft: GameState, loserId: string, tile: Tile, margin: number): boolean {
  const slotId = tile.ownerSlotDP;
  const mine = draft.dps
    .filter((d) => d.tileId === tile.id && d.owner === loserId)
    .sort((a, b) => {
      // slot DP always sorts last
      if (a.id === slotId) return 1;
      if (b.id === slotId) return -1;
      return a.seq - b.seq;
    });
  const toRemove = mine.slice(0, margin).map((d) => d.id);
  const removedSet = new Set(toRemove);
  draft.dps = draft.dps.filter((d) => !removedSet.has(d.id));
  return slotId !== null && removedSet.has(slotId);
}

export function resolvePush(
  draft: GameState,
  attackerId: string,
  tileId: string,
  attackerBourbonIds: string[],
): PushResult | PushRefusal {
  const tile = tileById(draft, tileId);
  if (!tile) return { ok: false, reason: "no such tile" };
  if (tile.category === "BLOCKING") return { ok: false, reason: "blocking tiles cannot be pushed" };

  const attackerDPs = liveDPCount(draft, tileId, attackerId);
  if (attackerDPs < 1) return { ok: false, reason: "you need a LIVE DP on the tile to push it" };

  const avail = new Set(freshBourbons(draft, attackerId).map((b) => b.id));
  for (const id of attackerBourbonIds) {
    if (!avail.has(id)) return { ok: false, reason: `bourbon ${id} is not FRESH / not yours` };
  }
  if (new Set(attackerBourbonIds).size !== attackerBourbonIds.length) {
    return { ok: false, reason: "duplicate bourbon in commitment" };
  }
  if (attackerBourbonIds.length > attackerDPs) {
    return { ok: false, reason: "cannot commit more bourbons than your LIVE DPs on the tile" };
  }

  // — commitments —
  const commits = new Map<string, string[]>();
  commits.set(attackerId, attackerBourbonIds);
  let bestStrength = strengthOf(draft, tile, attackerId, attackerBourbonIds);

  const defenders = draft.players.filter(
    (p) => p.id !== attackerId && liveDPCount(draft, tileId, p.id) >= 1,
  );

  for (const def of defenders) {
    const cap = liveDPCount(draft, tileId, def.id);
    const best = freshBourbons(draft, def.id)
      .map((b) => ({ id: b.id, f: fit(b.tags, targetTags(tile)) }))
      .sort((x, y) => y.f - x.f || x.id.localeCompare(y.id))
      .slice(0, cap)
      .filter((x) => x.f > 0)
      .map((x) => x.id);
    const defStrength = strengthOf(draft, tile, def.id, best);
    const holds = tileController(draft, tileId) === def.id || tileOwner(draft, tileId) === def.id;
    const worth =
      best.length > 0 &&
      (defStrength > bestStrength || (defStrength === bestStrength && holds && defStrength > 0));
    commits.set(def.id, worth ? best : []);
    if (worth) bestStrength = Math.max(bestStrength, defStrength);
  }

  // — deplete every committed bourbon (win/lose/tie) —
  const depleteAll = () => {
    for (const [pid, ids] of commits) {
      const p = draft.players.find((pl) => pl.id === pid)!;
      for (const id of ids) {
        const b = p.bourbons.find((x) => x.id === id);
        if (b) b.state = "DEPLETED";
      }
    }
  };

  // — determine winner —
  const scored = [...commits.entries()].map(([pid, ids]) => ({
    pid,
    strength: strengthOf(draft, tile, pid, ids),
  }));
  const top = Math.max(...scored.map((s) => s.strength));
  const leaders = scored.filter((s) => s.strength === top);

  // TIE (or nobody committed): nothing happens; controller keeps the tile.
  if (leaders.length > 1 || top === 0) {
    depleteAll();
    return { ok: true, winner: null, log: `Push at ${tile.name}: tie — nothing changes.` };
  }

  const winner = leaders[0]!.pid;
  const priorOwner = tileOwner(draft, tile.id);

  // — remove each loser's DPs by margin (1:1, outright) —
  let ownerCleared = false;
  for (const s of scored) {
    if (s.pid === winner) continue;
    const margin = top - s.strength;
    if (margin > 0) {
      const clearedSlot = applyDamage(draft, s.pid, tile, margin);
      if (clearedSlot && s.pid === priorOwner) ownerCleared = true;
    }
  }

  // — ownership capture: prior owner's slot cleared → winner seats a DP in it —
  if (tile.ownershipSlot && ownerCleared) {
    tile.ownerSlotDP = null;
    const winnerDP = draft.dps.find((d) => d.tileId === tile.id && d.owner === winner && d.state === "LIVE");
    if (winnerDP) tile.ownerSlotDP = winnerDP.id; // wildcard tag persists
  }

  depleteAll();
  // Distillery hooks (brief §17) — the winner, then each committed loser.
  runDistilleryTrigger(draft, "onPushWin", winner);
  for (const s of scored) {
    if (s.pid !== winner && (commits.get(s.pid)?.length ?? 0) > 0) {
      runDistilleryTrigger(draft, "onPushLose", s.pid);
    }
  }
  const wName = draft.players.find((p) => p.id === winner)!.name;
  return { ok: true, winner, log: `Push at ${tile.name}: ${wName} wins (strength ${top}).` };
}
