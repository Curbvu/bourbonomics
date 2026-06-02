/**
 * Tutorial state machine — shared types.
 *
 * Beats are addressed by id (string) so that branching, skipping, and
 * jumping back during dev all stay legible. The controller in
 * TutorialApp.tsx walks `BEAT_ORDER` linearly, advancing on the right
 * trigger for each beat type.
 */

import type { Card, GameAction, GameState } from "@bourbonomics/engine";

export type SpotlightTarget =
  | { kind: "rickhouse-slot"; ownerId: string; slotIndex: number }
  | { kind: "rickhouse-row"; ownerId: string }
  | { kind: "hand-card"; cardId: string }
  | { kind: "hand-cards"; cardIds: string[] }
  | { kind: "market-slot"; slotIndex: number }
  | { kind: "market-row" }
  | { kind: "buy-overlay" }
  | { kind: "demand" }
  | { kind: "reputation" }
  | { kind: "supply" }
  | {
      // ActionBar toolbar button. The `action` value matches the
      // `data-bb-action` attribute the button is rendered with.
      kind: "action-button";
      action: "sell" | "make" | "buy" | "age" | "draw-bill" | "pass";
    }
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
  /**
   * Optional secondary spotlight that takes effect once the player has
   * "engaged" the primary target:
   *   - `action-button` spotlight → fires when the matching picker mode
   *     opens (e.g. clicking Sell shifts the spotlight to the rickhouse
   *     slot they pick next).
   *   - `market-slot` spotlight → fires when the buy modal opens with a
   *     picked target (e.g. clicking the market card shifts the
   *     spotlight onto the purchase panel itself).
   */
  postEngageSpotlight?: SpotlightTarget;
}

export interface PromptBeat extends BeatBase {
  kind: "prompt";
  /** Continue button label (default "Continue"). */
  ctaLabel?: string;
  /**
   * Where to render the prompt card. Default `bottom-center` (the
   * standard chrome). `top-right` is a smaller corner card that
   * doesn't collide with a centered inspect / decision modal — used
   * by beats that walk the player through a modal's contents.
   */
  position?: "bottom-center" | "top-right";
  /**
   * If set, the Continue button is hidden until the player has
   * right-clicked a barrel whose mash-bill `defId` matches. The
   * controller watches the inspect state and auto-advances on the
   * transition (so the player doesn't need to click Continue
   * separately). Used to gate "look at this card first" beats.
   */
  awaitInspectBarrelDefId?: string;
  /**
   * Close any open inspect modal when the player advances forward
   * past this beat. Used by walk-through-the-card beats so the
   * modal clears out of the way before the next interaction starts.
   * Going Back doesn't trigger the close (the modal stays
   * dismissed; the player can right-click to reopen).
   */
  closeInspectOnAdvance?: boolean;
  /**
   * When set, render the prompt as a full-screen chapter title-card
   * (mirrors the BoardTour's title cards) — big centered card on a
   * dimmed board, "Lesson N · Label" eyebrow. Used to group the
   * play phase into bite-sized lessons.
   */
  chapter?: { number: number; label: string };
}

export interface AwaitActionBeat extends BeatBase {
  kind: "await-action";
  /**
   * Predicate matched against the action the player tries to dispatch.
   * Returning `true` lets the action through (and advances the beat,
   * unless `advanceWhen` is set — see below). Returning `false`
   * silently drops the action.
   *
   * Use `matches` for *gating*: which actions are legal in this beat?
   * Use `advanceWhen` for *progression*: when has the player satisfied
   * the goal? The two are split because some beats accept multiple
   * partial actions before the goal is reached — e.g. drag-and-drop
   * commits one card at a time, but Beat 1 wants the player to land
   * the full cask + corn + grain pile before advancing.
   */
  matches: (action: GameAction, state: GameState) => boolean;
  /**
   * Optional override for the dispatched action. Returns null to
   * dispatch as-is. the sell-action no longer carries a
   * rep-split payload (engine resolves the total on apply), so the
   * legacy "force a specific split" use-case is gone — left here in
   * case future beats need to massage other action shapes.
   */
  rewrite?: (action: GameAction, state: GameState) => GameAction | null;
  /**
   * Optional state-watch advance predicate. If set, the beat does NOT
   * auto-advance on every successful match — instead, the controller
   * runs this against the live state after every dispatch and advances
   * only when it returns true. Lets the player accumulate partial
   * progress (one drag at a time) without skipping ahead.
   */
  advanceWhen?: (state: GameState) => boolean;
  /**
   * Optional predicate that narrows the hand to a specific subset for
   * the duration of this beat. Cards passing the predicate get an
   * amber tutorial highlight and remain fully interactive (multi-
   * select, drag, click-to-commit). Cards that don't pass mute and
   * fall through to inspect-only — they can't be multi-selected,
   * dragged, or clicked into a picker mode. Used by Make beats to
   * teach the recipe without letting the player accidentally commit
   * the wrong card type.
   */
  handCardFilter?: (card: Card) => boolean;
  /**
   * Optional looping drag demonstration. The controller picks the
   * first card in the human's hand satisfying `pickHandCard` and
   * animates a ghost cursor + card pill from there to the rickhouse
   * slot named by `slotIndex`. Used during Make sub-beats so the
   * player SEES which ingredient to drag next.
   */
  dragHint?: {
    pickHandCard: (card: Card) => boolean;
    slotIndex: number;
  };
  /**
   * Optional stationary click demonstration. The controller renders a
   * pulsing tap cursor over the element matching `selector`. Used when
   * the player just needs to click one spot (a market card, an action
   * button) rather than drag from A to B.
   */
  tapHint?: {
    selector: string;
  };
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
