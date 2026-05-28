import type { Draft } from "immer";
import type {
  Bottle,
  DistilleryBonus,
  GameState,
  Line,
  PlayerState,
} from "../types";

// ═════════════════════════════════════════════════════════════════
// v3.0 LEGACY (kept for in-flight Line Card hand mechanics; the
// flagship boards no longer use these — see FlagshipLineBoardDef
// below). The 25-card v3.0 catalog is still loaded into the deck
// during initialize and shuffled into each player's lineCardHand;
// PLAY_LINE_CARD / repurposing for slot positions is phase 6.
// ═════════════════════════════════════════════════════════════════

/** @deprecated v3.0 — kept only so the deprecated LineBoardDef below compiles. */
export type PlacementPredicate = (bottle: Bottle, line: Line) => boolean;

/** @deprecated v3.0 — kept only so the deprecated LineBoardDef below compiles. */
export type PlacementBonus = (args: {
  bottle: Bottle;
  lineRef: Line;
  draft: Draft<GameState>;
  player: Draft<PlayerState>;
}) => void;

/** @deprecated v3.0 — kept only so the deprecated LineBoardDef below compiles. */
export type ScoringRule = (line: Line, player: PlayerState) => number;

/**
 * v3.1 Line Card definition. Each card is one named slot at a fixed
 * position (1..FLAGSHIP_SLOT_COUNT). Stack cards in slot order onto a
 * secondary line: slot-1 establishes the line (and locks in the
 * optional Line Restriction), higher-position cards extend it one
 * slot at a time.
 *
 * `themeTag` retains the v3.0 fine-grained string (rye / heritage-cask
 * / volume / etc.) so DISTILLERY_THEME_PREFS in the bot heuristics
 * keeps working; the new `themeFamily` is the five-family taxonomy
 * the v3.1 spec calls out for synergy framing.
 */
export interface LineCardDef {
  id: string;
  name: string;
  flavorText: string;
  themeTag: string;
  themeFamily:
    | "heritage"
    | "high-rye"
    | "counter-cyclical"
    | "volume"
    | "wild";
  slotPosition: 1 | 2 | 3 | 4 | 5;
  requirement: SlotRequirement;
  reward: SlotReward;
  endGameValue: number;
  /**
   * Set only on slot-1 cards. When the card is played to open a new
   * secondary Bourbon Line, this Restriction binds to the whole line
   * and gates every subsequent slot.
   */
  lineRestriction?: LineRestriction;
}

/**
 * @deprecated v3.0 board shape. Retained only so legacy callers in
 * scoring.ts / placement.ts / bonuses.ts continue to type-check during
 * the phase-by-phase v3.1 migration. New code should use
 * FlagshipLineBoardDef.
 */
export interface LineBoardDef {
  id: string;
  name: string;
  flavorText: string;
  distilleryBonus: DistilleryBonus;
  capacity: number;
  predicate: PlacementPredicate;
  perBottleBonus: PlacementBonus;
  endGameScore: ScoringRule;
}

// ═════════════════════════════════════════════════════════════════
// v3.1 BOURBON LINES — slotted boards.
//
// A flagship Bourbon Line is a fixed 5-slot board bound to the
// player's distillery. Slots fill left-to-right with bottles that
// satisfy BOTH the board's Line Restriction AND the slot's
// individual Placement Requirement. The slot's Reward fires the
// moment it transitions empty → filled. When the final slot fills,
// the board's Completion Bonus fires.
// ═════════════════════════════════════════════════════════════════

/**
 * Placement gate on a single slot. `check` reads the bottle and may
 * read the line's existing slots for compound predicates (e.g.,
 * "all prior slots filled with bottles from your own production").
 * `label` is the rule text the UI surfaces.
 */
export interface SlotRequirement {
  label: string;
  check: (args: {
    bottle: Bottle;
    line: Line;
    slotIndex: number;
    player: PlayerState;
  }) => boolean;
}

/**
 * Line-level gate. Applies to every slot on the line — a bottle
 * placed in slot N must satisfy BOTH the LineRestriction AND the
 * slot's SlotRequirement.
 */
export interface LineRestriction {
  label: string;
  check: (args: { bottle: Bottle; line: Line; player: PlayerState }) => boolean;
}

/**
 * Reward effect that fires exactly once, on the moment a slot
 * transitions empty → filled. Mutates the Immer draft directly,
 * matching the rest of the engine's apply convention. `label` is
 * the rule text surfaced by the UI.
 */
export interface SlotReward {
  label: string;
  fire: (args: {
    bottle: Bottle;
    line: Line;
    slotIndex: number;
    draft: Draft<GameState>;
    player: Draft<PlayerState>;
  }) => void;
}

/**
 * Effect that fires the moment the final slot of a Line fills.
 * Typically combines immediate rep with one or more persistent
 * flags on PlayerState (commonSalesIgnoreDemandDrop, etc.) that
 * downstream code reads at the relevant trigger points.
 */
export interface LineCompletionBonus {
  label: string;
  /** Immediate rep paid alongside the persistent effect. UI surfaces this. */
  immediateRep: number;
  fire: (args: {
    line: Line;
    draft: Draft<GameState>;
    player: Draft<PlayerState>;
  }) => void;
}

/**
 * One slot's design data: the product name, the gate, the reward
 * fired on fill, and the rep contributed at end-game if filled.
 */
export interface SlotDef {
  name: string;
  requirement: SlotRequirement;
  reward: SlotReward;
  endGameValue: number;
}

/**
 * v3.1 flagship board definition. Replaces the v3.0 LineBoardDef.
 * Pre-claimed at setup (one per distillery), drives all flagship
 * placement validation, slot reward resolution, and the completion
 * bonus trigger.
 */
export interface FlagshipLineBoardDef {
  id: string;
  name: string;
  flavorText: string;
  distilleryBonus: DistilleryBonus;
  /** Null when the board has no overarching restriction (Vanilla). */
  lineRestriction: LineRestriction | null;
  /** Always length 5. Slot 0 is leftmost / first to fill. */
  slots: SlotDef[];
  completionBonus: LineCompletionBonus;
}

/** Fixed slot count for a v3.1 flagship line. Sized for the spec. */
export const FLAGSHIP_SLOT_COUNT = 5;
