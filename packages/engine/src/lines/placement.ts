import type {
  Barrel,
  Bottle,
  GameState,
  Line,
  MashBill,
  PlayerState,
} from "../types";
import { getLineBoardDef } from "./boards";
import { getLineCardDef } from "./cards";
import { deriveBottleProfile } from "./tags";

/**
 * True iff `bottle` satisfies every constraint on `line` — the Line
 * Board predicate (if present) AND every stacked Line Card predicate.
 *
 * Unknown defIds are treated as `true` so a corrupted save doesn't
 * brick the placement. The lookup misses are silent; rules will fire
 * during scoring later (where they default to 0) and the loss is
 * obvious from the score breakdown.
 */
export function canPlaceOnLine(bottle: Bottle, line: Line): boolean {
  if (line.lineBoardId) {
    const board = getLineBoardDef(line.lineBoardId);
    if (board && !board.predicate(bottle, line)) return false;
  }
  for (const cardInstance of line.stackedCards) {
    const def = getLineCardDef(cardInstance.defId);
    if (def && !def.predicate(bottle, line)) return false;
  }
  return true;
}

/**
 * Create a Bottle from the sold bill + barrel. Derives recipe tags
 * once and freezes them — every downstream predicate reads the
 * frozen array. `bottleId` is minted from the GameState's idCounter
 * (mutated by the caller).
 */
export function createBottleFromSale(
  bill: MashBill,
  barrel: Pick<Barrel, "productionCards">,
  demandAtSale: number,
  ageAtSale: number,
  round: number,
  bottleId: string,
): Bottle {
  const profile = deriveBottleProfile(bill, barrel);
  return {
    bottleId,
    originalBillId: bill.id,
    billDefId: bill.defId,
    name: bill.name,
    recipeTags: profile.recipeTags,
    primaryRecipeTag: profile.primaryRecipeTag,
    caskTag: profile.caskTag,
    rarity: bill.tier ?? "common",
    ageAtSale,
    demandAtSale,
    placedOnRound: round,
  };
}

/**
 * Find a player's line (flagship or secondary) by id. Returns
 * `undefined` if not found.
 */
export function findLineById(
  player: PlayerState,
  lineId: string,
): Line | undefined {
  if (player.flagshipLine.id === lineId) return player.flagshipLine;
  return player.secondaryLines.find((l) => l.id === lineId);
}

/** Mint a fresh line id from the game's idCounter. */
export function mintLineId(draft: { idCounter: number }, kind: "secondary"): string {
  return `line_${kind}_${draft.idCounter++}`;
}

/** Mint a fresh bottle id from the game's idCounter. */
export function mintBottleId(draft: { idCounter: number }): string {
  return `bottle_${draft.idCounter++}`;
}

/** Build an empty flagship line bound to a Line Board id. */
export function buildFlagshipLine(lineBoardId: string, playerId: string): Line {
  return {
    id: `line_flagship_${playerId}`,
    lineBoardId,
    stackedCards: [],
    bottles: [],
  };
}

/**
 * True if `state` is mid-pending for the named player.
 */
export function isPlayerBlockedByLinePending(player: PlayerState): boolean {
  return (
    player.pendingInitialLineCardDraft !== null ||
    player.pendingLineCardDraw !== null ||
    player.pendingBottlePlacement !== null
  );
}

// re-export GameState to keep imports tidy on callers
export type { GameState };
