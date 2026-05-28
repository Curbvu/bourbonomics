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

import type { CSSProperties } from "react";
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
  | "rickhouse-others"
  | "log-rail";

function useFocusedZones(): Set<FocusZone> | null {
  const { makeMode, ageMode, draftingLoopMode, buyMode, sellMode } = useGameStore();

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
  if (sellMode) {
    return sellMode.pickedBarrelId
      ? new Set<FocusZone>(["hand-resources"])
      : new Set<FocusZone>(["rickhouse-self"]);
  }
  if (draftingLoopMode) {
    // v2.14: the Drafting Loop initiate picker is a single-step hand-
    // card pick. Always focus the hand.
    return new Set<FocusZone>(["hand-resources"]);
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
    return "transition-[opacity,filter] duration-300 bb-zone-focus";
  }
  // Use a globals.css utility — Tailwind v4's JIT was inconsistently
  // omitting opacity-N / saturate-N from the bundle when the only
  // reference was in this hook's return string.
  return "transition-[opacity,filter] duration-300 bb-zone-dim";
}

/**
 * Style-prop counterpart to `useZoneFocusClass`. Returns an inline
 * style object that consumers can spread onto their root element.
 * Robust against Tailwind/Turbopack tree-shaking — the dim chrome
 * is set via concrete CSSStyleDeclaration properties, not utility
 * classes the scanner has to recognise.
 */
export function useZoneFocusStyle(zone: FocusZone): CSSProperties {
  const focus = useFocusedZones();
  if (!focus) {
    // Explicit reset so a recent dim/focus transition lands cleanly
    // when the picker closes — without `opacity: 1` etc, React leaves
    // the previous values painted on the element.
    return { opacity: 1, filter: "none", pointerEvents: "auto", transition: "none" };
  }
  if (focus.has(zone)) {
    // Explicit opacity/pointerEvents/transition so transitioning OUT
    // of dim state lands cleanly at 1 (otherwise the previous dim's
    // 0.3 stays painted because of the transition quirk).
    return {
      opacity: 1,
      filter: "brightness(1.05)",
      pointerEvents: "auto",
      transition: "none",
    };
  }
  // `transition: none` defeats the `transition-[opacity,filter]`
  // baseline on these panels — a cascade quirk leaves transitioned
  // values pinned at the start state, so dim style would otherwise
  // never reach 0.3 / saturate(0.5) (it would read as opacity 1).
  return {
    opacity: 0.3,
    filter: "saturate(0.5)",
    pointerEvents: "none",
    transition: "none",
  };
}
