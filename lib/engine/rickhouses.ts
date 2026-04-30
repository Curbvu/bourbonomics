/**
 * Rickhouse definitions per GAME_RULES.md §Rickhouses.
 * Six Kentucky bourbon regions in play order; capacities [3, 5, 4, 4, 6, 5] = 27 slots total.
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
  { id: "rickhouse-1", name: "Louisville", capacity: 5 },
  { id: "rickhouse-2", name: "Central", capacity: 4 },
  { id: "rickhouse-3", name: "Lexington", capacity: 4 },
  { id: "rickhouse-4", name: "Bardstown", capacity: 6 },
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
