/**
 * Rickhouse definitions per GAME_RULES.md §Rickhouse.
 * Six Kentucky Bourbon Trail regions in play order; capacities [3, 4, 5, 6, 4, 5].
 */

export type RickhouseId =
  | "rickhouse-0"
  | "rickhouse-1"
  | "rickhouse-2"
  | "rickhouse-3"
  | "rickhouse-4"
  | "rickhouse-5";

export type RickhouseDef = {
  id: RickhouseId;
  name: string;
  capacity: number;
};

export const RICKHOUSES: readonly RickhouseDef[] = [
  { id: "rickhouse-0", name: "Northern", capacity: 3 },
  { id: "rickhouse-1", name: "Louisville", capacity: 4 },
  { id: "rickhouse-2", name: "Central", capacity: 5 },
  { id: "rickhouse-3", name: "Lexington", capacity: 6 },
  { id: "rickhouse-4", name: "Bardstown", capacity: 4 },
  { id: "rickhouse-5", name: "Western", capacity: 5 },
];

export function isRickhouseId(value: string): value is RickhouseId {
  return RICKHOUSES.some((r) => r.id === value);
}

export function rickhouseById(id: RickhouseId): RickhouseDef {
  const r = RICKHOUSES.find((h) => h.id === id);
  if (!r) throw new Error(`Unknown rickhouse: ${id}`);
  return r;
}
