import type {
  Bottle,
  DistilleryBonus,
  GameAction,
  GameState,
  Line,
  LineCardInstance,
  PlayerState,
} from "../types";
import {
  canPlaceOnLine,
  type LineCardDef,
  getLineCardDef,
  scoreLine,
} from "../lines";

// ============================================================
// v3.0 Line system — bot heuristics
// ============================================================
//
// Pure, side-effect-free decision helpers consumed by `bot.ts`.
// Every function here returns a plain action descriptor or a score;
// the bot's main `chooseAction` does the dispatching.
//
// Tuning knobs are deliberate constants at the top — bump them in
// playtest rather than rewriting structure.

/**
 * Themes the distillery's flagship board (and its identity) actively
 * pull toward. Cards whose `themeTag` lands in this list get a draft
 * + draw + extend bonus. Order doesn't matter; presence is what's
 * checked.
 */
const DISTILLERY_THEME_PREFS: Record<DistilleryBonus, readonly string[]> = {
  vanilla: ["heritage-recipe", "common-cask", "volume"],
  wheated_baron: [
    "wheated",
    "heritage-cask",
    "specialty-cask",
    "depth",
    "aged-4",
    "aged-5",
    "single-grain",
  ],
  high_rye_house: [
    "rye",
    "high-rye",
    "heritage-cask",
    "specialty-cask",
    "depth",
    "aged-4",
    "aged-5",
    "single-grain",
  ],
  connoisseur_estate: [
    "triple-grain",
    "premium",
    "boutique",
    "premium-press",
    "variety",
    "aged-8",
  ],
};

/**
 * Themes that score well for any distillery (broad utility cards).
 * Scored lower than distillery-specific matches so identity bias
 * still drives the pick.
 */
const UNIVERSAL_GOOD_THEMES = new Set<string>(["volume", "demand-high"]);

/**
 * High-ceiling cards with very narrow predicates. Without distillery
 * support these tend to brick on an empty line for −2 rep, so we
 * dock them.
 */
const NARROW_THEMES = new Set<string>([
  "boutique",
  "triple-grain",
  "premium-press",
  "aged-8",
  "demand-leader",
]);

const THEME_MATCH_SCORE = 5;
const UNIVERSAL_THEME_SCORE = 2;
const NARROW_PENALTY = 2;
const BASE_CARD_SCORE = 1;
const FLAGSHIP_REINFORCE_BONUS_PER_MATCH = 1;
const FLAGSHIP_REINFORCE_CAP = 3;

/**
 * Heuristic score for an unowned Line Card def, evaluated against
 * the player's distillery + current flagship contents. Higher = more
 * attractive to keep.
 *
 * Used by:
 *   - initial 4→2 draft pick
 *   - mid-game DRAW_LINE_CARDS keep decision
 *   - DRAW_LINE_CARDS gate (deck-quality check)
 */
export function scoreLineCardForPlayer(
  def: LineCardDef,
  player: PlayerState,
): number {
  let score = BASE_CARD_SCORE;
  const distilleryBonus = player.distillery?.bonus;
  if (distilleryBonus) {
    const prefs = DISTILLERY_THEME_PREFS[distilleryBonus];
    if (prefs.includes(def.themeTag)) {
      score += THEME_MATCH_SCORE;
    }
  }
  if (UNIVERSAL_GOOD_THEMES.has(def.themeTag)) {
    score += UNIVERSAL_THEME_SCORE;
  }
  if (NARROW_THEMES.has(def.themeTag)) {
    const isWantedNarrow =
      distilleryBonus &&
      DISTILLERY_THEME_PREFS[distilleryBonus].includes(def.themeTag);
    if (!isWantedNarrow) score -= NARROW_PENALTY;
  }
  // Flagship reinforcement: a card whose predicate matches bottles
  // already on the flagship is a free score multiplier.
  const flagshipMatches = player.flagshipLine.bottles.filter((b) =>
    def.predicate(b, player.flagshipLine),
  ).length;
  score +=
    Math.min(flagshipMatches, FLAGSHIP_REINFORCE_CAP) *
    FLAGSHIP_REINFORCE_BONUS_PER_MATCH;
  return score;
}

/**
 * Pick the top `n` instances from `pool` ranked by their def's
 * score. Stable: ties resolve in original order.
 */
export function pickBestInstances(
  pool: readonly LineCardInstance[],
  n: number,
  player: PlayerState,
): LineCardInstance[] {
  if (pool.length <= n) return pool.slice();
  const scored = pool.map((inst, idx) => {
    const def = getLineCardDef(inst.defId);
    const score = def ? scoreLineCardForPlayer(def, player) : 0;
    return { inst, score, idx };
  });
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.idx - b.idx;
  });
  return scored.slice(0, n).map((s) => s.inst);
}

/**
 * For a mid-game KEEP decision: keep every instance whose def
 * scores at least the threshold; always keep ≥1 even if all the
 * cards are mediocre (the validator requires it).
 */
const KEEP_THRESHOLD = 3;

export function chooseKeepInstanceIds(
  pool: readonly LineCardInstance[],
  player: PlayerState,
): string[] {
  if (pool.length === 0) return [];
  const scored = pool.map((inst) => {
    const def = getLineCardDef(inst.defId);
    const score = def ? scoreLineCardForPlayer(def, player) : 0;
    return { inst, score };
  });
  const kept = scored.filter((s) => s.score >= KEEP_THRESHOLD).map((s) => s.inst);
  if (kept.length >= 1) return kept.map((c) => c.instanceId);
  // Mandatory keep ≥1: take the best of the bunch.
  scored.sort((a, b) => b.score - a.score);
  return [scored[0]!.inst.instanceId];
}

// ============================================================
// Placement
// ============================================================

/**
 * Score a candidate placement for `bottle` on `line`:
 *   - +N where N is the immediate end-game score delta produced by
 *     adding this bottle (computed against a hypothetical line with
 *     the bottle appended)
 *   - +small base so bonus-firing placements still beat inventory
 *
 * Bonuses (rep, prestige, demand bumps, draws) are modeled implicitly
 * via end-game scoring — most card bonuses converge there anyway.
 *
 * Returns -Infinity if the placement is illegal so it's pruned.
 */
function scorePlacement(
  bottle: Bottle,
  line: Line,
  player: PlayerState,
): number {
  if (!canPlaceOnLine(bottle, line, player)) return -Infinity;
  const before = scoreLine(line, player);
  // v3.1 slot scoring: model the placement by marking the next-open
  // slot filled. v3.0 secondary scoring (still 0 in phase 5) falls
  // through harmlessly.
  const slots = line.slots
    ? line.slots.map((s, i) =>
        i === firstUnfilled(line.slots!) ? { ...s, filled: true, bottle } : s,
      )
    : line.slots;
  const after = scoreLine({ ...line, slots, bottles: [...line.bottles, bottle] }, player);
  return after - before;
}

function firstUnfilled(slots: { filled: boolean }[]): number {
  for (let i = 0; i < slots.length; i++) if (!slots[i]!.filled) return i;
  return -1;
}

/**
 * Decide where the bot should place its just-sold bottle. Priority:
 *   1. Flagship if it accepts and gains rep
 *   2. Any existing secondary that accepts and gains rep
 *   3. New secondary if hand has a strongly-matching card and slot open
 *   4. Inventory (worth +1 rep)
 *
 * Ties go to the line with the lowest current bottle count so the
 * bot spreads investment instead of dogpiling one line.
 */
export function chooseBottlePlacement(
  state: GameState,
  player: PlayerState,
): GameAction | null {
  const pending = player.pendingBottlePlacement;
  if (!pending) return null;
  const bottle = pending.bottle;

  type Candidate = {
    score: number;
    bottleCount: number;
    action: GameAction;
  };
  const candidates: Candidate[] = [];

  // Existing lines (flagship + secondaries)
  const flagshipScore = scorePlacement(bottle, player.flagshipLine, player);
  if (flagshipScore > -Infinity) {
    candidates.push({
      score: flagshipScore,
      bottleCount: player.flagshipLine.bottles.length,
      action: {
        type: "PLACE_BOTTLE",
        playerId: player.id,
        destination: { kind: "flagship" },
      },
    });
  }
  for (const line of player.secondaryLines) {
    const s = scorePlacement(bottle, line, player);
    if (s > -Infinity) {
      candidates.push({
        score: s,
        bottleCount: line.bottles.length,
        action: {
          type: "PLACE_BOTTLE",
          playerId: player.id,
          destination: { kind: "secondary", lineId: line.id },
        },
      });
    }
  }

  // Potential new secondary: pick the single best card in hand whose
  // predicate accepts this bottle. Only meaningful when the player
  // has slot room and at least one accepting card.
  const NEW_SECONDARY_THRESHOLD = 3;
  if (
    player.secondaryLines.length < 2 &&
    player.lineCardHand.length > 0
  ) {
    let bestInst: LineCardInstance | null = null;
    let bestProjected = 0;
    for (const inst of player.lineCardHand) {
      const def = getLineCardDef(inst.defId);
      if (!def) continue;
      const candidateLine: Line = {
        id: "candidate",
        lineBoardId: null,
        stackedCards: [inst],
        bottles: [],
      };
      const s = scorePlacement(bottle, candidateLine, player);
      if (s > bestProjected) {
        bestProjected = s;
        bestInst = inst;
      }
    }
    if (bestInst && bestProjected >= NEW_SECONDARY_THRESHOLD) {
      candidates.push({
        score: bestProjected,
        bottleCount: 0,
        action: {
          type: "PLACE_BOTTLE",
          playerId: player.id,
          destination: {
            kind: "new-secondary",
            lineCardInstanceIds: [bestInst.instanceId],
          },
        },
      });
    }
  }

  // Inventory baseline (always +1 rep per bottle).
  candidates.push({
    score: 1,
    bottleCount: 0,
    action: {
      type: "PLACE_BOTTLE",
      playerId: player.id,
      destination: { kind: "inventory" },
    },
  });

  // Best score wins; ties go to the leaner line.
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.bottleCount - b.bottleCount;
  });
  return candidates[0]!.action;
}

// ============================================================
// Mid-game DRAW_LINE_CARDS timing
// ============================================================

/**
 * Should the bot reach for a Line Card draw this turn? Gates:
 *   - Not the final round (no time to fulfill new cards)
 *   - Bourbon deck has runway (drawing a card you can't satisfy is
 *     a −2 rep loss if it lands on an empty line at game end)
 *   - Player hasn't drawn this round
 *   - Deck has cards
 *   - The player isn't already drowning in unplayed cards
 *     (exposure cap)
 *
 * Returns the DRAW_LINE_CARDS action when conditions are met,
 * otherwise null. Caller decides where to slot the call into its
 * priority list.
 */
const EXPOSURE_CAP = 3;
const MIN_BOURBON_DECK_FOR_DRAW = 4;

export function chooseDrawLineCards(
  state: GameState,
  player: PlayerState,
): GameAction | null {
  if (state.finalRoundTriggered) return null;
  if (player.hasDrawnLineCardsThisRound) return null;
  if (state.lineCardDeck.length === 0) return null;
  if (player.pendingLineCardDraw) return null;
  if (state.bourbonDeck.length < MIN_BOURBON_DECK_FOR_DRAW) return null;
  // Exposure = cards in hand + cards stacked on EMPTY lines (which
  // would penalize at game end). Cards stacked on lines with bottles
  // don't count — they're earning their keep.
  const stackedOnEmpty =
    (player.flagshipLine.bottles.length === 0
      ? player.flagshipLine.stackedCards.length
      : 0) +
    player.secondaryLines.reduce(
      (sum, l) => sum + (l.bottles.length === 0 ? l.stackedCards.length : 0),
      0,
    );
  const exposure = player.lineCardHand.length + stackedOnEmpty;
  if (exposure >= EXPOSURE_CAP) return null;
  return { type: "DRAW_LINE_CARDS", playerId: player.id };
}
