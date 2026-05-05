import type { Distillery, DistilleryBonus, RickhouseSlot } from "./types";

// ============================================================
// Distillery catalog. Each distillery card maps to a concrete
// game element (extra slot, recipe discount, etc.).
// ============================================================

interface DistillerySpec {
  defId: string;
  name: string;
  flavorText?: string;
  bonus: DistilleryBonus;
  bondedSlots: number;
  upperSlots: number;
}

const SPECS: DistillerySpec[] = [
  {
    defId: "warehouse",
    name: "Warehouse Distillery",
    flavorText: "More space, more patience.",
    bonus: "warehouse",
    bondedSlots: 2,
    upperSlots: 3,
  },
  {
    defId: "high_rye_house",
    name: "High-Rye House",
    flavorText: "Spice from day one — start with a 2-rye in the bank.",
    bonus: "high_rye",
    bondedSlots: 2,
    upperSlots: 2,
  },
  {
    defId: "wheated_baron",
    name: "Wheated Baron",
    flavorText: "Soft mash, lean recipe.",
    bonus: "wheated_baron",
    bondedSlots: 2,
    upperSlots: 2,
  },
  {
    defId: "the_broker",
    name: "The Broker",
    flavorText: "First trade of the round is on the house.",
    bonus: "broker",
    bondedSlots: 2,
    upperSlots: 2,
  },
  {
    defId: "old_line",
    name: "Old-Line Distillery",
    flavorText: "Three bonded slots — built for steady output.",
    bonus: "old_line",
    bondedSlots: 3,
    upperSlots: 2,
  },
  {
    defId: "vanilla",
    name: "Vanilla Distillery",
    flavorText: "No bonus. The challenge option.",
    bonus: "vanilla",
    bondedSlots: 2,
    upperSlots: 2,
  },
];

export function defaultDistilleryPool(): Distillery[] {
  return SPECS.map((spec, i) => ({
    id: `dist_${spec.defId}_${i}`,
    defId: spec.defId,
    name: spec.name,
    flavorText: spec.flavorText,
    bonus: spec.bonus,
    bondedSlots: spec.bondedSlots,
    upperSlots: spec.upperSlots,
  }));
}

/** Build the per-player rickhouse slot list from a chosen distillery. */
export function buildRickhouseSlots(playerId: string, distillery: Distillery): RickhouseSlot[] {
  const slots: RickhouseSlot[] = [];
  for (let i = 0; i < distillery.bondedSlots; i++) {
    slots.push({ id: `slot_${playerId}_bonded_${i}`, ownerId: playerId, tier: "bonded" });
  }
  for (let i = 0; i < distillery.upperSlots; i++) {
    slots.push({ id: `slot_${playerId}_upper_${i}`, ownerId: playerId, tier: "upper" });
  }
  return slots;
}
