/**
 * Seat-indexed player palette per design_handoff_bourbon_blend/README.md.
 *
 *   seat 0 (You)    indigo-500   #6366f1
 *   seat 1 (Clyde)  sky-500      #0ea5e9
 *   seat 2 (Dell)   violet-500   #a855f7
 *
 * Seats 3–5 are overflow slots for 4–6 player games — those colours aren't
 * specified by the design (the handoff is for a 3-player dashboard) so they
 * fall through to a neutral sequence (emerald / amber / slate) that still
 * reads cleanly against the slate-950 background.
 *
 * Class strings are listed statically so Tailwind v4's content scanner picks
 * them up at build time — never construct these by string interpolation.
 */

export const PLAYER_HEX = [
  "#6366f1", // indigo-500 — You
  "#0ea5e9", // sky-500    — Clyde
  "#a855f7", // violet-500 — Dell
  "#10b981", // emerald-500 (overflow)
  "#f59e0b", // amber-500   (overflow)
  "#94a3b8", // slate-400   (overflow)
] as const;

export const PLAYER_BG_CLASS = [
  "bg-indigo-500",
  "bg-sky-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-slate-400",
] as const;

export const PLAYER_BORDER_CLASS = [
  "border-indigo-500",
  "border-sky-500",
  "border-violet-500",
  "border-emerald-500",
  "border-amber-500",
  "border-slate-400",
] as const;

export const PLAYER_TINT_CLASS = [
  "bg-indigo-500/12",
  "bg-sky-500/12",
  "bg-violet-500/12",
  "bg-emerald-500/12",
  "bg-amber-500/12",
  "bg-slate-400/12",
] as const;

export const PLAYER_TEXT_CLASS = [
  "text-indigo-300",
  "text-sky-300",
  "text-violet-300",
  "text-emerald-300",
  "text-amber-300",
  "text-slate-300",
] as const;

/** Wrap a seatIndex into the palette range (handles negatives / overflow). */
export function paletteIndex(seatIndex: number): number {
  const n = PLAYER_HEX.length;
  return ((seatIndex % n) + n) % n;
}
