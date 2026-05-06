"use client";

/**
 * Step-aware focus for the interactive pickers (MAKE, AGE, DRAW BILL,
 * BUY MARKET). Each picker has 1–2 distinct steps, and each step calls
 * for the user's eye to be in a specific zone of the board (mash bills
 * in hand, resource cards, the market conveyor, etc.). We surface the
 * "what should I be looking at right now?" answer as a set of zone
 * tokens so individual zone containers can dim themselves out of the
 * way when the picker is not asking for them.
 *
 * `useFocusedZones()` returns `null` when there's no active picker —
 * in that case zones render normally, no dimming. When non-null, every
 * registered zone is implicitly dimmed UNLESS its token is in the set.
 */

import { useGameStore } from "@/lib/store/game";

export type FocusZone =
  | "hand-resources"
  | "hand-bills"
  | "hand-ops"
  | "market-conveyor"
  | "market-mash-bills"
  | "market-ops"
  | "market-investments"
  | "rickhouse-self"
  | "rickhouse-others";

const ALL_ZONES: FocusZone[] = [
  "hand-resources",
  "hand-bills",
  "hand-ops",
  "market-conveyor",
  "market-mash-bills",
  "market-ops",
  "market-investments",
  "rickhouse-self",
  "rickhouse-others",
];

export function useFocusedZones(): Set<FocusZone> | null {
  const { makeMode, ageMode, drawBillMode, buyMode } = useGameStore();

  if (makeMode) {
    return makeMode.pickedMashBillId
      ? new Set<FocusZone>(["hand-resources"])
      : new Set<FocusZone>(["hand-bills"]);
  }
  if (ageMode) {
    return ageMode.pickedBarrelId
      ? new Set<FocusZone>(["hand-resources"])
      : new Set<FocusZone>(["rickhouse-self"]);
  }
  if (drawBillMode) {
    const step1 = !drawBillMode.blind && !drawBillMode.pickedMashBillId;
    return step1
      ? new Set<FocusZone>(["market-mash-bills"])
      : new Set<FocusZone>(["hand-resources"]);
  }
  if (buyMode) {
    return buyMode.pickedTarget
      ? new Set<FocusZone>(["hand-resources"])
      : new Set<FocusZone>(["market-conveyor", "market-ops"]);
  }
  return null;
}

/**
 * Class string applied by a zone container to fade itself when a picker
 * is active and this zone isn't in the focus set. Uses opacity +
 * saturation rather than `display: none` so the dimmed content still
 * gives spatial context (the player can see WHERE the rickhouses are
 * even while they're picking a card from hand). Pointer events disabled
 * on dimmed zones so the player can't accidentally click through.
 */
export function useZoneFocusClass(zone: FocusZone): string {
  const focus = useFocusedZones();
  if (!focus) return "transition-[opacity,filter] duration-300";
  if (focus.has(zone)) {
    return "transition-[opacity,filter] duration-300 [filter:brightness(1.05)]";
  }
  return "transition-[opacity,filter] duration-300 opacity-30 saturate-50 pointer-events-none";
}

/** Test-only — exported so future zones don't drift from the master list. */
export const __ALL_ZONES_FOR_TESTING = ALL_ZONES;
