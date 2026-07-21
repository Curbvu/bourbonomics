// Bourbonomics: Map Game — pure derived queries (brief §4, §6, §8).
//
// Everything here is computed from state, never stored. The engine enforces
// with these and the UI reads the same numbers — no parallel logic.

import { CONFIG } from "./config";
import { hexDistance, hexNeighbors, hexKey } from "./hex";
import type { GameState, NicheFlag, Tile } from "./types";

export function tileById(state: GameState, id: string): Tile | undefined {
  return state.tiles.find((t) => t.id === id);
}

export function tileByHex(state: GameState, hex: { q: number; r: number }): Tile | undefined {
  return state.tiles.find((t) => t.hex.q === hex.q && t.hex.r === hex.r);
}

export function playerById(state: GameState, id: string) {
  return state.players.find((p) => p.id === id);
}

export function dpsOnTile(state: GameState, tileId: string) {
  return state.dps.filter((d) => d.tileId === tileId);
}

/** LIVE DP count on a tile — for one owner, or everyone. Only LIVE counts (§16.3). */
export function liveDPCount(state: GameState, tileId: string, owner?: string): number {
  return state.dps.filter(
    (d) => d.tileId === tileId && d.state === "LIVE" && (owner === undefined || d.owner === owner),
  ).length;
}

/**
 * Control = strictly more LIVE DPs than any single rival; ties → null
 * (brief §17.4). Applies to ALL tiles, including WILDCARD ones — ownership
 * (the slot) is a SEPARATE concept from control (see tileOwner).
 */
export function tileController(state: GameState, tileId: string): string | null {
  const tile = tileById(state, tileId);
  if (!tile) return null;
  if (tile.category === "BLOCKING") return null;

  const counts = new Map<string, number>();
  for (const d of state.dps) {
    if (d.tileId === tileId && d.state === "LIVE") {
      counts.set(d.owner, (counts.get(d.owner) ?? 0) + 1);
    }
  }
  let best: string | null = null;
  let bestN = 0;
  let tied = false;
  for (const [owner, n] of counts) {
    if (n > bestN) {
      best = owner;
      bestN = n;
      tied = false;
    } else if (n === bestN) {
      tied = true;
    }
  }
  return tied || bestN === 0 ? null : best;
}

export function controlledTiles(state: GameState, playerId: string): Tile[] {
  return state.tiles.filter((t) => tileController(state, t.id) === playerId);
}

/**
 * Owner of a WILDCARD tile's ownership slot (brief §7) — the player whose DP
 * sits in the slot, or null. Distinct from control. Non-slot tiles have no owner.
 */
export function tileOwner(state: GameState, tileId: string): string | null {
  const tile = tileById(state, tileId);
  if (!tile || !tile.ownershipSlot || !tile.ownerSlotDP) return null;
  const dp = state.dps.find((d) => d.id === tile.ownerSlotDP);
  return dp ? dp.owner : null;
}

/** Monopoly on a tile: you have >=1 LIVE DP and no rival has any LIVE DP (§6). */
export function hasMonopoly(state: GameState, tileId: string, playerId: string): boolean {
  let mine = 0;
  for (const d of state.dps) {
    if (d.tileId !== tileId || d.state !== "LIVE") continue;
    if (d.owner === playerId) mine += 1;
    else return false; // a rival LIVE DP present
  }
  return mine >= 1;
}

// ── Adjacency & contiguity ───────────────────────────────────────────
/** Hex-adjacent AND neither is a BLOCKING tile (blocking breaks chains, §12). */
export function tilesAdjacent(a: Tile, b: Tile): boolean {
  if (a.category === "BLOCKING" || b.category === "BLOCKING") return false;
  return hexDistance(a.hex, b.hex) === 1;
}

/** Occupied neighbor tiles of a hex (any category — used for the ≥2 placement rule). */
export function neighborTiles(state: GameState, hex: { q: number; r: number }): Tile[] {
  const keys = new Set(hexNeighbors(hex).map(hexKey));
  return state.tiles.filter((t) => keys.has(hexKey(t.hex)));
}

/** Are the given tiles one connected group (blocking tiles never connect)? */
export function tilesContiguous(state: GameState, tileIds: string[]): boolean {
  if (tileIds.length === 0) return false;
  const set = new Set(tileIds);
  const tiles = tileIds.map((id) => tileById(state, id)).filter(Boolean) as Tile[];
  if (tiles.length !== tileIds.length) return false;
  const seen = new Set<string>([tiles[0]!.id]);
  const stack = [tiles[0]!];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const other of tiles) {
      if (!seen.has(other.id) && set.has(other.id) && tilesAdjacent(cur, other)) {
        seen.add(other.id);
        stack.push(other);
      }
    }
  }
  return seen.size === tiles.length;
}

// ── Placement legality (brief §6, §16.5) ─────────────────────────────
/**
 * After setup, a new DP must be placed adjacent to a tile you control, OR onto
 * an uncontrolled tile. You may NOT anchor on mere presence inside a
 * rival-controlled tile — no growing through a rival.
 */
export function canPlaceDP(state: GameState, playerId: string, tileId: string): boolean {
  const tile = tileById(state, tileId);
  if (!tile || tile.category === "BLOCKING") return false;

  const controller = tileController(state, tileId);
  // Onto an uncontrolled tile — always allowed.
  if (controller === null) return true;
  // Onto a tile you already control — allowed.
  if (controller === playerId) return true;
  // Rival-controlled: allowed only if adjacent to a tile you control (§16.5).
  return controlledTiles(state, playerId).some((c) => tilesAdjacent(c, tile));
}

/**
 * Flag legality (brief §9 / §17.6): a claim must be adjacent to one of your
 * existing flags; your FIRST flag may go anywhere. Never on a blocking tile,
 * never a tile you already flag.
 */
export function canAddFlag(state: GameState, playerId: string, tileId: string): boolean {
  const tile = tileById(state, tileId);
  if (!tile || tile.category === "BLOCKING") return false;
  const mine = state.nicheFlags.filter((f) => f.owner === playerId);
  if (mine.some((f) => f.tileId === tileId)) return false; // already flagged
  if (mine.length === 0) return true; // first flag — anywhere
  const myTiles = mine.map((f) => tileById(state, f.tileId)).filter(Boolean) as Tile[];
  return myTiles.some((mt) => tilesAdjacent(mt, tile));
}

// ── Niches — derived from flags (brief §8) ───────────────────────────
export interface DerivedNiche {
  owner: string;
  tileIds: string[];
}

/**
 * A player's niches = connected components of their flags, blocking-aware.
 * Every component is returned; harvest only applies to those >= NICHE_MIN_TILES.
 */
export function derivedNiches(state: GameState, ownerId: string): DerivedNiche[] {
  const flags = state.nicheFlags.filter((f) => f.owner === ownerId);
  const flaggedTileIds = new Set(flags.map((f) => f.tileId));
  const remaining = new Set(flaggedTileIds);
  const niches: DerivedNiche[] = [];

  while (remaining.size > 0) {
    const start = remaining.values().next().value as string;
    remaining.delete(start);
    const component: string[] = [start];
    const stack = [start];
    while (stack.length) {
      const curId = stack.pop()!;
      const cur = tileById(state, curId);
      if (!cur) continue;
      for (const otherId of Array.from(remaining)) {
        const other = tileById(state, otherId);
        if (other && tilesAdjacent(cur, other)) {
          remaining.delete(otherId);
          component.push(otherId);
          stack.push(otherId);
        }
      }
    }
    niches.push({ owner: ownerId, tileIds: component });
  }
  return niches;
}

export function qualifyingNiches(state: GameState, ownerId: string): DerivedNiche[] {
  return derivedNiches(state, ownerId).filter((n) => n.tileIds.length >= CONFIG.NICHE_MIN_TILES);
}

// ── Harvest status (brief §8) ────────────────────────────────────────
export type NicheStatus = "monopoly" | "control" | "none";

/**
 * For a qualifying niche:
 *  - monopoly: you control a majority AND zero rival LIVE DPs anywhere in it → take ALL rewards.
 *  - control:  you control a majority (a rival LIVE DP exists) → take 1 reward.
 *  - none:     you do not control a majority of its tiles.
 * DARK rival DPs do NOT block monopoly (§8, §16).
 */
export function nicheStatus(state: GameState, niche: DerivedNiche): NicheStatus {
  const tiles = niche.tileIds.map((id) => tileById(state, id)).filter(Boolean) as Tile[];
  const controlled = tiles.filter((t) => tileController(state, t.id) === niche.owner).length;
  if (controlled * 2 <= tiles.length) return "none"; // need a strict majority

  const rivalLive = tiles.some((t) =>
    state.dps.some((d) => d.tileId === t.id && d.state === "LIVE" && d.owner !== niche.owner),
  );
  return rivalLive ? "control" : "monopoly";
}
