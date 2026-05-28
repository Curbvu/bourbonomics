import type { Draft } from "immer";
import type {
  Bottle,
  DistilleryBonus,
  GameState,
  Line,
  PlayerState,
} from "../types";

/**
 * Shared shape for a placement predicate. Reads only from the
 * candidate Bottle and (for Variety/Depth-style cards) the existing
 * line.
 */
export type PlacementPredicate = (bottle: Bottle, line: Line) => boolean;

/**
 * Placement bonus — fires when a Bottle joins a line. Mutates the
 * Immer draft directly. Pure-data deltas would compose better but
 * we're matching the rest of the engine's apply-style convention.
 *
 * `lineRef` is read-only-conceptually — bonuses should never mutate
 * the line's bottles or stackedCards directly (placement does that).
 */
export type PlacementBonus = (args: {
  bottle: Bottle;
  lineRef: Line;
  draft: Draft<GameState>;
  player: Draft<PlayerState>;
}) => void;

/**
 * End-game scoring rule — called for each Line Board and each
 * stacked Line Card on a line that has at least one bottle. The
 * −2/card empty-line penalty is applied by `scoreLine` directly
 * (not by the rule), so rules need not check for emptiness.
 */
export type ScoringRule = (line: Line, player: PlayerState) => number;

export interface LineBoardDef {
  id: string;
  name: string;
  flavorText: string;
  /** Distillery this board is bound to. Pre-claimed at setup. */
  distilleryBonus: DistilleryBonus;
  /** Soft cap on bottles. Overflow allowed but doesn't score. */
  capacity: number;
  predicate: PlacementPredicate;
  perBottleBonus: PlacementBonus;
  endGameScore: ScoringRule;
}

export interface LineCardDef {
  id: string;
  name: string;
  flavorText: string;
  themeTag: string;
  predicate: PlacementPredicate;
  perBottleBonus: PlacementBonus;
  endGameScore: ScoringRule;
}
