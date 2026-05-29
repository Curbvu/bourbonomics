import type {
  Barrel,
  Bottle,
  GameState,
  Line,
  MashBill,
  PlayerState,
  SlotState,
} from "../types";
import { getLineBoardDef } from "./boards";
import { FLAGSHIP_SLOT_COUNT } from "./defs";
import { deriveBottleProfile } from "./tags";

/**
 * v3.1 — the leftmost slot that's empty, or -1 if the line is full
 * (or hasn't been seeded with slots yet). Slots must fill in order;
 * this is the only legal target for a fresh placement.
 */
export function nextOpenSlotIndex(line: Line): number {
  if (!line.slots) return -1;
  for (let i = 0; i < line.slots.length; i++) {
    if (!line.slots[i]!.filled) return i;
  }
  return -1;
}

/**
 * v3.1 — true iff the bottle is legal at the given slot on a flagship
 * Bourbon Line. Checks:
 *   1. The slot index is the next-open one (left-to-right enforcement).
 *   2. The board's Line Restriction (if any).
 *   3. The slot's individual Placement Requirement.
 *
 * The flagship's board is looked up via `line.lineBoardId`; an unknown
 * id (corrupted save) fails closed.
 */
export function canPlaceInFlagshipSlot(
  bottle: Bottle,
  line: Line,
  slotIndex: number,
  player: PlayerState,
): boolean {
  if (!line.slots) return false;
  if (slotIndex < 0 || slotIndex >= line.slots.length) return false;
  if (line.slots[slotIndex]!.filled) return false;
  if (slotIndex !== nextOpenSlotIndex(line)) return false;
  if (!line.lineBoardId) return false;
  const board = getLineBoardDef(line.lineBoardId);
  if (!board) return false;
  if (board.lineRestriction) {
    if (!board.lineRestriction.check({ bottle, line, player })) return false;
  }
  const slotDef = board.slots[slotIndex];
  if (!slotDef) return false;
  return slotDef.requirement.check({ bottle, line, slotIndex, player });
}

/**
 * Compatibility wrapper. Routes flagship placement to the slot-aware
 * helper; secondaries return false in v3.2 (the v3.1 Line Card stack
 * model is removed and the v3.2 Portfolio replacement lands in a
 * follow-on phase).
 */
export function canPlaceOnLine(
  bottle: Bottle,
  line: Line,
  player: PlayerState,
): boolean {
  if (!line.slots) return false;
  if (!line.lineBoardId) return false;
  const idx = nextOpenSlotIndex(line);
  if (idx < 0) return false;
  return canPlaceInFlagshipSlot(bottle, line, idx, player);
}

/**
 * Create a Bottle from the sold bill + barrel. Derives recipe tags
 * once and freezes them — every downstream predicate reads the
 * frozen array. Also captures v3.2 `cornCount` (the actual corn
 * committed at production, which feeds the strength axis on Brand
 * Portfolio slot requirements). `bottleId` is minted from the
 * GameState's idCounter (mutated by the caller).
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
  // v3.2 — count corn cards in the production pile. Plain, Specialty,
  // and Heritage corn all carry `subtype === "corn"`. Wild Mash tokens
  // swapped to "corn" stay in their original card identity in the
  // pile; the swap intent isn't persisted on the barrel, so this
  // undercounts by 1 in the rare Wild Mash → corn case. Bills relying
  // on a strict corn count at sale should not depend on Wild Mash
  // substitution for that count.
  const cornCount = barrel.productionCards.filter(
    (c) => c.type === "resource" && c.subtype === "corn",
  ).length;
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
    cornCount,
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
export function mintLineId(
  draft: { idCounter: number },
  kind: "secondary",
): string {
  return `line_${kind}_${draft.idCounter++}`;
}

/** Mint a fresh bottle id from the game's idCounter. */
export function mintBottleId(draft: { idCounter: number }): string {
  return `bottle_${draft.idCounter++}`;
}

/**
 * Build a fresh flagship line for a player. When `lineBoardId` resolves
 * to a known board, the line ships with `FLAGSHIP_SLOT_COUNT` empty
 * slots and is ready to receive bottles. When the id is empty / unknown
 * (pre-distillery-selection state), slots stays undefined and the line
 * is inert until `bindFlagshipBoard` is called.
 */
export function buildFlagshipLine(lineBoardId: string, playerId: string): Line {
  const slots = emptySlots(lineBoardId);
  return {
    id: `line_flagship_${playerId}`,
    lineBoardId: lineBoardId || null,
    stackedCards: [],
    bottles: [],
    slots,
    completionBonusTriggered: false,
  };
}

/**
 * Switch a flagship line's bound board (called during SELECT_DISTILLERY
 * once a player picks their distillery). Resets slots to empty since
 * the new board may have a different slot count / requirement set.
 */
export function bindFlagshipBoard(line: Line, lineBoardId: string): void {
  line.lineBoardId = lineBoardId;
  line.slots = emptySlots(lineBoardId);
  line.bottles = [];
  line.completionBonusTriggered = false;
}

function emptySlots(lineBoardId: string): SlotState[] | undefined {
  if (!lineBoardId) return undefined;
  const board = getLineBoardDef(lineBoardId);
  if (!board) return undefined;
  return Array.from({ length: board.slots.length }, () => ({
    filled: false,
    bottle: null,
    rewardFired: false,
  }));
}

// Re-export the constant so consumers don't need a separate import.
export { FLAGSHIP_SLOT_COUNT };

/**
 * True if `state` is mid-pending for the named player. In v3.2 only
 * the bottle-placement pending state remains.
 */
export function isPlayerBlockedByLinePending(player: PlayerState): boolean {
  return player.pendingBottlePlacement !== null;
}

// re-export GameState to keep imports tidy on callers
export type { GameState };
