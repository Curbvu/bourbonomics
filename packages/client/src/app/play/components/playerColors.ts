/**
 * Seat-indexed player palette. v3 "Distillery-first" refresh re-tints
 * seat 0 ("You") to warm amber so it sits inside the bourbon palette —
 * the player's identity is now expressed by the DistilleryStage hero,
 * not by their seat color, and an indigo "You" chip clashed with the
 * warm canvas. Opponent seats keep visually-distinct hues but pulled
 * to match the warm tokens in globals.css.
 *
 *   seat 0 (You)     warm amber   #d59650
 *   seat 1           rose         #d96b54
 *   seat 2           emerald      #6db28c
 *   seat 3           amber-2      #e9b46e
 *   seat 4           sky          #6fa4d6
 *   seat 5           violet       #b08fd8
 *
 * Class strings are listed statically so Tailwind v4's content scanner
 * picks them up at build time — never construct these by string
 * interpolation. The arbitrary-value `bg-[#hex]` form is used so we
 * can match the bourbon palette tokens precisely rather than snap to
 * a Tailwind named color.
 */

export const PLAYER_HEX = [
  "#d59650", // amber — You
  "#d96b54", // rose
  "#6db28c", // emerald
  "#e9b46e", // amber-2
  "#6fa4d6", // sky
  "#b08fd8", // violet
] as const;

export const PLAYER_BG_CLASS = [
  "bg-[#d59650]",
  "bg-[#d96b54]",
  "bg-[#6db28c]",
  "bg-[#e9b46e]",
  "bg-[#6fa4d6]",
  "bg-[#b08fd8]",
] as const;

export const PLAYER_BORDER_CLASS = [
  "border-[#d59650]",
  "border-[#d96b54]",
  "border-[#6db28c]",
  "border-[#e9b46e]",
  "border-[#6fa4d6]",
  "border-[#b08fd8]",
] as const;

export const PLAYER_TEXT_CLASS = [
  "text-[#d59650]",
  "text-[#d96b54]",
  "text-[#6db28c]",
  "text-[#e9b46e]",
  "text-[#6fa4d6]",
  "text-[#b08fd8]",
] as const;

/** Wrap a seatIndex into the palette range (handles negatives / overflow). */
export function paletteIndex(seatIndex: number): number {
  const n = PLAYER_HEX.length;
  return ((seatIndex % n) + n) % n;
}
