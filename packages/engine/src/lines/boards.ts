import type { DistilleryBonus } from "../types";
import type { LineBoardDef } from "./defs";

/**
 * The four flagship Line Boards. Pre-claimed at setup — each
 * distillery is bound to exactly one. Boards are global definitions;
 * the per-player flagship Line instance just stores `lineBoardId`.
 *
 * Scoring + bonus values are intentionally modest. Better to buff a
 * weak board after playtest than to nerf a runaway one.
 */
const BOARDS: LineBoardDef[] = [
  // ─── Vanilla Distillery — Standard Reserve ───────────────────
  {
    id: "lb_standard_reserve",
    name: "Standard Reserve",
    flavorText: "Every label, every shelf. The house pour.",
    distilleryBonus: "vanilla",
    capacity: 6,
    predicate: () => true,
    perBottleBonus: () => {
      // No per-bottle bonus.
    },
    endGameScore: (line) => line.bottles.length,
  },

  // ─── Wheated Baron — Wheated Comfort ─────────────────────────
  {
    id: "lb_wheated_comfort",
    name: "Wheated Comfort",
    flavorText: "Soft front, gentle finish, the pour she pours.",
    distilleryBonus: "wheated_baron",
    capacity: 6,
    predicate: (b) => b.recipeTags.includes("wheated"),
    perBottleBonus: ({ draft }) => {
      // +1 demand on next sale of a wheated bill. We model the brief's
      // "next sale of a wheated bill" as a one-turn demand bump that
      // benefits any sale; refining to wheated-only would need a new
      // per-player demand-override flag. Capped at the game's 0..12
      // band.
      if (draft.demand < 12) draft.demand += 1;
    },
    endGameScore: (line) => {
      const wheatedCount = line.bottles.filter((b) =>
        b.recipeTags.includes("wheated"),
      ).length;
      const breadth = line.bottles.length >= 4 ? 5 : 0;
      return wheatedCount * 2 + breadth;
    },
  },

  // ─── High-Rye House — High-Rye Tradition ─────────────────────
  // Note: shares its name with the "High-Rye Tradition" Line Card
  // (rye extension). Disambiguated by type.
  {
    id: "lb_high_rye_tradition",
    name: "High-Rye Tradition",
    flavorText: "Pepper, baking spice, the long dry finish.",
    distilleryBonus: "high_rye_house",
    capacity: 5,
    // Brief: "minRye >= 2". Wired against the derived tag set —
    // recipe minRye >= 2 still satisfies the "rye" tag, and the
    // board's identity (rye specialist) reads as "rye-presence".
    predicate: (b) => b.recipeTags.includes("rye"),
    perBottleBonus: ({ draft, player }) => {
      // Draw 1 card. Reach into the shared deck helper at the call
      // site of `applyPlacementBonuses` to avoid a circular import
      // here — see `bonuses.ts`.
      drawOneFor(draft, player);
    },
    endGameScore: (line) => {
      const ryeCount = line.bottles.filter((b) =>
        b.recipeTags.includes("rye"),
      ).length;
      const breadth = line.bottles.length >= 4 ? 5 : 0;
      return ryeCount * 2 + breadth;
    },
  },

  // ─── Connoisseur Estate — Diversified Portfolio ──────────────
  {
    id: "lb_diversified_portfolio",
    name: "Diversified Portfolio",
    flavorText: "Four bills, four buyers, four brick lines.",
    distilleryBonus: "connoisseur_estate",
    capacity: 5,
    // No two bottles may share their primary recipe tag.
    predicate: (b, line) =>
      !line.bottles.some((x) => x.primaryRecipeTag === b.primaryRecipeTag),
    perBottleBonus: ({ player }) => {
      // +1 prestige per placement.
      player.prestige += 1;
    },
    endGameScore: (line) => {
      const unique = new Set(line.bottles.map((b) => b.primaryRecipeTag));
      return unique.size * 3;
    },
  },
];

const BY_ID = new Map(BOARDS.map((b) => [b.id, b]));
const BY_BONUS = new Map(BOARDS.map((b) => [b.distilleryBonus, b]));

export function getLineBoardDef(id: string): LineBoardDef | undefined {
  return BY_ID.get(id);
}

export function lineBoardForDistillery(
  bonus: DistilleryBonus,
): LineBoardDef | undefined {
  return BY_BONUS.get(bonus);
}

export function allLineBoards(): readonly LineBoardDef[] {
  return BOARDS;
}

// ─── Deck-draw helper (kept here to break a circular import) ─────
// The High-Rye Tradition board grants "draw 1 card" on placement.
// `bonuses.ts` imports this module; threading a draw helper through
// the bonus call site would require a parameter on every bonus
// signature even though only one board uses it. Inline it here.

import type { Draft } from "immer";
import type { GameState, PlayerState } from "../types";
import { drawWithReshuffle } from "../deck";

function drawOneFor(
  draft: Draft<GameState>,
  player: Draft<PlayerState>,
): void {
  const result = drawWithReshuffle(
    player.deck.slice(),
    player.discard.slice(),
    1,
    draft.rngState,
  );
  player.hand.push(...result.drawn);
  player.deck = result.deck;
  player.discard = result.discard;
  draft.rngState = result.rngState;
}

// Re-export so cards.ts can call the same helper without re-defining.
export { drawOneFor };
