/**
 * Tutorial state machine — shared types.
 *
 * Beats are addressed by id (string) so that branching, skipping, and
 * jumping back during dev all stay legible. The controller in
 * TutorialApp.tsx walks `BEAT_ORDER` linearly, advancing on the right
 * trigger for each beat type.
 */

import type { GameAction, GameState } from "@bourbonomics/engine";

export type SpotlightTarget =
  | { kind: "rickhouse-slot"; ownerId: string; slotIndex: number }
  | { kind: "rickhouse-row"; ownerId: string }
  | { kind: "hand-card"; cardId: string }
  | { kind: "hand-cards"; cardIds: string[] }
  | { kind: "market-slot"; slotIndex: number }
  | { kind: "market-row" }
  | { kind: "demand" }
  | { kind: "reputation" }
  | { kind: "supply" }
  | { kind: "none" };

export type BeatKind =
  /** Modal-style prompt with one Continue button. */
  | "prompt"
  /** Wait for the player to dispatch a specific action. */
  | "await-action"
  /** Two buttons, both advance to the next beat (illusion of choice). */
  | "decision"
  /** Controller fires a scripted action automatically with a delay. */
  | "scripted"
  /** Cinematic transition (Time passes…). */
  | "transition"
  /** Big celebration (Silver award). */
  | "celebrate"
  /** Final modal — finish or replay. */
  | "finale";

export interface BeatBase {
  id: string;
  kind: BeatKind;
  /** Headline shown in bold above the body copy. */
  title?: string;
  /** Body copy — supports markdown-ish bold via **word** segments. */
  body: string;
  /** Optional element to highlight while this beat is active. */
  spotlight?: SpotlightTarget;
}

export interface PromptBeat extends BeatBase {
  kind: "prompt";
  /** Continue button label (default "Continue"). */
  ctaLabel?: string;
}

export interface AwaitActionBeat extends BeatBase {
  kind: "await-action";
  /**
   * Predicate matched against the action the player tries to dispatch.
   * Returning `true` advances the beat; returning `false` ignores the
   * action (UI shows "Locked during tutorial" guidance).
   */
  matches: (action: GameAction, state: GameState) => boolean;
  /**
   * Optional override for the dispatched action — e.g. force the
   * sell-action's reputationSplit to a specific value. Returns null
   * to dispatch the action as-is.
   */
  rewrite?: (action: GameAction, state: GameState) => GameAction | null;
}

export interface DecisionBeat extends BeatBase {
  kind: "decision";
  optionA: { label: string; reply?: string };
  optionB: { label: string; reply?: string };
}

export interface ScriptedBeat extends BeatBase {
  kind: "scripted";
  /** Returns the action to dispatch. State is the live engine state. */
  build: (state: GameState) => GameAction | GameAction[];
  /** Optional intermediate state mutator (deck rigging, etc.). */
  mutate?: (state: GameState) => GameState;
  /** Delay before dispatch in ms (default 600). */
  delayMs?: number;
}

export interface TransitionBeat extends BeatBase {
  kind: "transition";
  /** Subtitle shown beneath the title (e.g. "Year 2 · Demand rising"). */
  subtitle?: string;
  /** Optional state mutator that runs at the start (e.g. force demand). */
  mutate?: (state: GameState) => GameState;
  /** Faked dice rolls to display, in order, before advancing. */
  fakeRolls?: { dice: [number, number]; commitToDemand?: boolean }[];
  /** Total visible duration in ms (default 2400). */
  durationMs?: number;
}

export interface CelebrateBeat extends BeatBase {
  kind: "celebrate";
  /** Lines stacked in the celebration. */
  lines: string[];
  ctaLabel?: string;
}

export interface FinaleBeat extends BeatBase {
  kind: "finale";
  bullets: string[];
  closeLabel?: string;
  replayLabel?: string;
}

export type Beat =
  | PromptBeat
  | AwaitActionBeat
  | DecisionBeat
  | ScriptedBeat
  | TransitionBeat
  | CelebrateBeat
  | FinaleBeat;
