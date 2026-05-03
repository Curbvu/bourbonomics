/**
 * Bourbon-centric logo catalog. Each player picks one at game setup; it
 * becomes their visual identifier across the dashboard (top bar, opponent
 * panel, event log, barrel chips). Emoji glyphs were chosen so the catalog
 * ships with zero asset overhead and renders inline in any text context.
 *
 * The catalog is intentionally a small, curated set — distillery, grain,
 * cooperage, and serving motifs — so the picker stays scannable and every
 * choice reads as "bourbon" at a glance.
 */

export type PlayerLogo = {
  id: string;
  name: string;
  glyph: string;
  /** One-line evocation shown in the picker tooltip. */
  blurb: string;
};

export const PLAYER_LOGOS: readonly PlayerLogo[] = [
  { id: "still", name: "Still", glyph: "⚗️", blurb: "The copper alembic — where the spirit is born." },
  { id: "barrel", name: "Barrel", glyph: "🛢️", blurb: "Charred oak, where time does the work." },
  { id: "tumbler", name: "Tumbler", glyph: "🥃", blurb: "Two fingers, neat." },
  { id: "corn", name: "Corn", glyph: "🌽", blurb: "The sweet heart of every mash." },
  { id: "rye", name: "Grain", glyph: "🌾", blurb: "Rye, wheat, barley — the small grains." },
  { id: "oak", name: "Oak", glyph: "🪵", blurb: "American white oak. Stave and stay." },
  { id: "char", name: "Char", glyph: "🔥", blurb: "Alligator char — caramel and vanilla in waiting." },
  { id: "mash", name: "Mash", glyph: "🍯", blurb: "Sour-mash sweetness, cooked low and slow." },
  { id: "tub", name: "Mash Tub", glyph: "🪣", blurb: "Cypress wood, stirred by hand." },
  { id: "rickhouse", name: "Rickhouse", glyph: "🏛️", blurb: "Multi-story warehouse where the angels take their share." },
  { id: "decanter", name: "Decanter", glyph: "🏺", blurb: "House pour, bottled for the table." },
  { id: "baron", name: "Baron", glyph: "🎩", blurb: "The bourbon baron themselves." },
] as const;

export const PLAYER_LOGOS_BY_ID: Record<string, PlayerLogo> = PLAYER_LOGOS.reduce(
  (acc, logo) => {
    acc[logo.id] = logo;
    return acc;
  },
  {} as Record<string, PlayerLogo>,
);

/** Default logo derived from a seat index — used when a player has no chosen logo (older saves). */
export function defaultLogoForSeat(seatIndex: number): PlayerLogo {
  const n = PLAYER_LOGOS.length;
  const i = ((seatIndex % n) + n) % n;
  return PLAYER_LOGOS[i];
}

/**
 * Resolve a logoId to its PlayerLogo, with a deterministic seatIndex
 * fallback. Centralised so every render site agrees on the lookup rules.
 */
export function logoFor(
  logoId: string | undefined | null,
  seatIndex: number,
): PlayerLogo {
  if (logoId && PLAYER_LOGOS_BY_ID[logoId]) return PLAYER_LOGOS_BY_ID[logoId];
  return defaultLogoForSeat(seatIndex);
}
