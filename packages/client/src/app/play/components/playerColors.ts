/**
 * Seat-indexed player palette. Six visually distinct hues so that a default
 * 3-player game (seats 0/1/2) gets three obviously different colours rather
 * than the old indigo/sky/violet "three blues" cluster, and a 6-player game
 * still has unique identities at every seat.
 *
 *   seat 0 (You)     indigo-500   #6366f1
 *   seat 1           rose-500     #f43f5e
 *   seat 2           emerald-500  #10b981
 *   seat 3           amber-500    #f59e0b
 *   seat 4           sky-500      #0ea5e9
 *   seat 5           violet-500   #a855f7
 *
 * Class strings are listed statically so Tailwind v4's content scanner picks
 * them up at build time — never construct these by string interpolation.
 */

export const PLAYER_HEX = [
  "#6366f1", // indigo-500 — You
  "#f43f5e", // rose-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#0ea5e9", // sky-500
  "#a855f7", // violet-500
] as const;

export const PLAYER_BG_CLASS = [
  "bg-indigo-500",
  "bg-rose-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-sky-500",
  "bg-violet-500",
] as const;

export const PLAYER_BORDER_CLASS = [
  "border-indigo-500",
  "border-rose-500",
  "border-emerald-500",
  "border-amber-500",
  "border-sky-500",
  "border-violet-500",
] as const;

export const PLAYER_TEXT_CLASS = [
  "text-indigo-300",
  "text-rose-300",
  "text-emerald-300",
  "text-amber-300",
  "text-sky-300",
  "text-violet-300",
] as const;

/** Wrap a seatIndex into the palette range (handles negatives / overflow). */
export function paletteIndex(seatIndex: number): number {
  const n = PLAYER_HEX.length;
  return ((seatIndex % n) + n) % n;
}
