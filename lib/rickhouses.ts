/**
 * Kentucky Bourbon Trail® regions — index 0…5 matches in-game ids **rickhouse-0** … **rickhouse-5**.
 * @see https://kybourbontrail.com/regions/
 */
export const KENTUCKY_BOURBON_TRAIL_REGIONS = [
  "Northern Region",
  "Louisville Region",
  "Central Region",
  "Lexington Region",
  "Bardstown Region",
  "Western Region",
] as const;

export function rickhouseIndexFromId(id: string): number | null {
  const m = /^rickhouse-(\d+)$/.exec(id);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n >= 0 && n < KENTUCKY_BOURBON_TRAIL_REGIONS.length ? n : null;
}

/** Display label for a rickhouse id, e.g. `rickhouse-2` → `Central Region`. */
export function rickhouseRegionLabel(id: string): string {
  const i = rickhouseIndexFromId(id);
  if (i === null) return id;
  return KENTUCKY_BOURBON_TRAIL_REGIONS[i];
}
