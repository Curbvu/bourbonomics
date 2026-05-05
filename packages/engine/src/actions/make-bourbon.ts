import type { Draft } from "immer";
import type {
  Card,
  ConvertSpec,
  GameAction,
  GameState,
  MashBill,
  PlayerState,
  ResourceSubtype,
  ValidationResult,
} from "../types";
import { isWheatedBill } from "../types";
import { resourceUnits, suppliesResource } from "../cards";
import { endPlayerTurn, isCurrentPlayer } from "../state";

type MakeBourbonAction = Extract<GameAction, { type: "MAKE_BOURBON" }>;

const BASIC_RESOURCES: ResourceSubtype[] = ["cask", "corn", "rye", "barley", "wheat"];

interface ResourceTotals {
  caskSources: number;
  corn: number;
  rye: number;
  barley: number;
  wheat: number;
}

function emptyTotals(): ResourceTotals {
  return { caskSources: 0, corn: 0, rye: 0, barley: 0, wheat: 0 };
}

function totalGrain(t: ResourceTotals): number {
  return t.rye + t.barley + t.wheat;
}

/**
 * Returns the recipe minimums for this player + bill, after distillery bonuses.
 * Wheated Baron knocks 1 off the wheat min on wheated bills (floor 0; the
 * universal min-1-grain still applies separately).
 */
function effectiveRecipeMins(
  player: PlayerState,
  bill: MashBill,
): { minCorn: number; minRye: number; minBarley: number; minWheat: number; maxRye: number; maxWheat: number; minTotalGrain: number } {
  const recipe = bill.recipe ?? {};
  let minWheat = recipe.minWheat ?? 0;
  if (player.distillery?.bonus === "wheated_baron" && isWheatedBill(bill)) {
    minWheat = Math.max(0, minWheat - 1);
  }
  return {
    minCorn: Math.max(1, recipe.minCorn ?? 0),
    minRye: recipe.minRye ?? 0,
    minBarley: recipe.minBarley ?? 0,
    minWheat,
    maxRye: recipe.maxRye ?? Infinity,
    maxWheat: recipe.maxWheat ?? Infinity,
    minTotalGrain: recipe.minTotalGrain ?? 0,
  };
}

export function validateMakeBourbon(
  state: GameState,
  action: MakeBourbonAction,
): ValidationResult {
  if (state.phase !== "action") {
    return { legal: false, reason: `phase is "${state.phase}", expected "action"` };
  }
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return { legal: false, reason: `unknown player ${action.playerId}` };
  if (!isCurrentPlayer(state, action.playerId)) {
    return { legal: false, reason: "it is not your turn" };
  }

  const mashBill = player.mashBills.find((m) => m.id === action.mashBillId);
  if (!mashBill) {
    return { legal: false, reason: `mash bill ${action.mashBillId} not in hand` };
  }

  // Slot must belong to player and be empty.
  const slot = player.rickhouseSlots.find((s) => s.id === action.slotId);
  if (!slot) {
    return { legal: false, reason: `slot ${action.slotId} is not on your distillery card` };
  }
  const slotOccupied = state.allBarrels.some((b) => b.slotId === action.slotId);
  if (slotOccupied) {
    return { legal: false, reason: `slot ${action.slotId} is already occupied` };
  }
  // Personal rickhouse full check (informational — slot occupancy already covers it).
  const used = state.allBarrels.filter((b) => b.ownerId === player.id).length;
  if (used >= player.rickhouseSlots.length) {
    return { legal: false, reason: "your rickhouse is full" };
  }

  // ---- Card-id integrity (uniqueness, hand membership) ----
  const productionIds = action.cardIds;
  if (productionIds.length === 0) {
    return { legal: false, reason: "no production cards specified" };
  }
  if (new Set(productionIds).size !== productionIds.length) {
    return { legal: false, reason: "duplicate card id in production list" };
  }

  const conversions = action.conversions ?? [];
  const allConversionIds: string[] = [];
  for (const conv of conversions) {
    const conversionCheck = checkConversion(conv);
    if (conversionCheck) return conversionCheck;
    allConversionIds.push(...conv.spendCardIds);
  }
  if (new Set(allConversionIds).size !== allConversionIds.length) {
    return { legal: false, reason: "a card was used in more than one conversion" };
  }
  for (const id of allConversionIds) {
    if (productionIds.includes(id)) {
      return { legal: false, reason: "a card was used in both production and a conversion" };
    }
  }

  const handIds = new Set(player.hand.map((c) => c.id));
  const allSpent = [...productionIds, ...allConversionIds];
  for (const id of allSpent) {
    if (!handIds.has(id)) {
      return { legal: false, reason: `card ${id} is not in your hand` };
    }
  }

  // ---- Resource accounting ----
  const cardById = new Map(player.hand.map((c) => [c.id, c]));
  const totals = emptyTotals();

  for (const id of productionIds) {
    const card = cardById.get(id)!;
    if (card.type !== "resource") {
      return { legal: false, reason: `card ${id} is not a resource card` };
    }
    if (suppliesResource(card, "cask")) totals.caskSources += 1;
    totals.corn += resourceUnits(card, "corn");
    totals.rye += resourceUnits(card, "rye");
    totals.barley += resourceUnits(card, "barley");
    totals.wheat += resourceUnits(card, "wheat");
  }
  for (const conv of conversions) {
    addConversionToTotals(totals, conv.resourceType);
  }

  if (totals.caskSources !== 1) {
    return {
      legal: false,
      reason: `must use exactly 1 cask source per barrel (got ${totals.caskSources})`,
    };
  }
  if (totals.corn < 1) return { legal: false, reason: "need at least 1 corn" };
  const grain = totalGrain(totals);
  if (grain < 1) return { legal: false, reason: "need at least 1 grain" };

  // ---- Per-bill recipe (with distillery bonus applied) ----
  const mins = effectiveRecipeMins(player, mashBill);
  if (totals.corn < mins.minCorn) {
    return { legal: false, reason: `recipe requires corn >= ${mins.minCorn}` };
  }
  if (totals.rye < mins.minRye) {
    return { legal: false, reason: `recipe requires rye >= ${mins.minRye}` };
  }
  if (totals.barley < mins.minBarley) {
    return { legal: false, reason: `recipe requires barley >= ${mins.minBarley}` };
  }
  if (totals.wheat < mins.minWheat) {
    return { legal: false, reason: `recipe requires wheat >= ${mins.minWheat}` };
  }
  if (totals.rye > mins.maxRye) {
    return { legal: false, reason: `recipe forbids rye > ${mins.maxRye}` };
  }
  if (totals.wheat > mins.maxWheat) {
    return { legal: false, reason: `recipe forbids wheat > ${mins.maxWheat}` };
  }
  if (grain < mins.minTotalGrain) {
    return { legal: false, reason: `recipe requires total grain >= ${mins.minTotalGrain}` };
  }

  return { legal: true };
}

function checkConversion(conv: ConvertSpec): ValidationResult | null {
  if (conv.spendCardIds.length !== 3) {
    return { legal: false, reason: "each 3:1 conversion must spend exactly 3 cards" };
  }
  if (new Set(conv.spendCardIds).size !== 3) {
    return { legal: false, reason: "duplicate card id within a conversion" };
  }
  if (!BASIC_RESOURCES.includes(conv.resourceType)) {
    return { legal: false, reason: `cannot convert to ${conv.resourceType} (basic types only)` };
  }
  return null;
}

function addConversionToTotals(totals: ResourceTotals, type: ResourceSubtype): void {
  switch (type) {
    case "cask":
      totals.caskSources += 1;
      break;
    case "corn":
      totals.corn += 1;
      break;
    case "rye":
      totals.rye += 1;
      break;
    case "barley":
      totals.barley += 1;
      break;
    case "wheat":
      totals.wheat += 1;
      break;
  }
}

export function applyMakeBourbon(
  draft: Draft<GameState>,
  action: MakeBourbonAction,
): void {
  const player = draft.players.find((p) => p.id === action.playerId)!;

  // Detach the mash bill from the player's hand.
  const mashIdx = player.mashBills.findIndex((m) => m.id === action.mashBillId);
  const mashBill = player.mashBills.splice(mashIdx, 1)[0]! as MashBill;

  // Capture production card-def ids before mutating hand.
  const cardById = new Map(player.hand.map((c) => [c.id, c as Card]));
  const productionCardDefIds = action.cardIds.map((id) => cardById.get(id)!.cardDefId);

  // Partition hand: spent (production+conversion) | remaining.
  const conversionIds = new Set((action.conversions ?? []).flatMap((c) => c.spendCardIds));
  const productionIds = new Set(action.cardIds);

  const newHand: Card[] = [];
  const spent: Card[] = [];
  for (const card of player.hand) {
    if (productionIds.has(card.id) || conversionIds.has(card.id)) {
      spent.push(card);
    } else {
      newHand.push(card);
    }
  }
  player.hand = newHand;
  player.discard.push(...spent);

  // Mint the barrel.
  const barrelId = `barrel_${draft.idCounter}`;
  draft.idCounter += 1;
  draft.allBarrels.push({
    id: barrelId,
    ownerId: player.id,
    slotId: action.slotId,
    attachedMashBill: mashBill,
    productionCardDefIds,
    agingCards: [],
    age: 0,
    productionRound: draft.round,
    agedThisRound: false,
    inspectedThisRound: false,
    extraAgesAvailable: 0,
  });

  endPlayerTurn(draft, action.playerId);
}
