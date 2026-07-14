// Bourbonomics: Map Game — pure derived queries.
//
// Everything here is computed from state, never stored (spec §4: access,
// control, fit, niche status are all derived). The engine enforces with these
// and the UI reads the same numbers — no parallel logic.

import { maturityAllowance } from "./config";
import { hexDistance } from "./hex";
import type { Bourbon, GameState, Niche, Player, TasteTrait, Tile } from "./types";

export function tileById(state: GameState, id: string): Tile | undefined {
  return state.tiles.find((t) => t.id === id);
}

export function playerById(state: GameState, id: string): Player | undefined {
  return state.players.find((p) => p.id === id);
}

export function dpsOnTile(state: GameState, tileId: string) {
  return state.dps.filter((d) => d.tileId === tileId);
}

/** Active DP count on a tile — for a given owner, or everyone. */
export function activeDPCount(state: GameState, tileId: string, owner?: string): number {
  return state.dps.filter(
    (d) => d.tileId === tileId && d.status === "active" && (owner === undefined || d.owner === owner),
  ).length;
}

/** Access = ≥1 active DP on the tile. */
export function hasAccess(state: GameState, tileId: string, owner: string): boolean {
  return activeDPCount(state, tileId, owner) >= 1;
}

/** Control = strictly most active DPs. Ties → null (nobody controls). */
export function tileController(state: GameState, tileId: string): string | null {
  const counts = new Map<string, number>();
  for (const d of state.dps) {
    if (d.tileId === tileId && d.status === "active") {
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

/** True if the two tiles are hex-adjacent. */
export function tilesAdjacent(a: Tile, b: Tile): boolean {
  return hexDistance(a.hex, b.hex) === 1;
}

/** Are all the given tiles a single contiguous cluster? */
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

// ── Fit ──────────────────────────────────────────────────────────────
export function traitFit(traits: TasteTrait[], tile: Tile): number {
  if (tile.averse && traits.includes(tile.averse)) return 0;
  const shared = traits.filter((t) => tile.traits.includes(t)).length;
  if (shared === 0) return 1;
  if (shared === 1) return 2;
  return 3;
}

/** effectiveFit = min(traitFit, ceiling, maturityAllowance(slot)). */
export function effectiveFit(bourbon: Bourbon, tile: Tile): number {
  return Math.min(
    traitFit(bourbon.traits, tile),
    bourbon.ceiling,
    maturityAllowance(bourbon.maturitySlot),
  );
}

// ── Niches ───────────────────────────────────────────────────────────
export type NicheStatus = "monopoly" | "control" | "collapsed" | "none";

/** Current standing of a declared niche for its owner. */
export function nicheStatus(state: GameState, niche: Niche): NicheStatus {
  const tiles = niche.tileIds.map((id) => tileById(state, id)).filter(Boolean) as Tile[];
  if (tiles.length < 5) return "collapsed";
  const controlled = tiles.filter((t) => tileController(state, t.id) === niche.owner).length;
  if (controlled <= tiles.length / 2) return "none";
  // monopoly: zero rival ACTIVE DPs anywhere in the niche
  const anyRival = tiles.some((t) =>
    state.dps.some((d) => d.tileId === t.id && d.status === "active" && d.owner !== niche.owner),
  );
  return anyRival ? "control" : "monopoly";
}
