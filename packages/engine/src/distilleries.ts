import type { Distillery, DistilleryBonus, RickhouseSlot } from "./types";

// ============================================================
// Distillery catalog. Each distillery card maps to a concrete
// game element (extra slot, recipe discount, etc.).
//
// v2.2 update: bonded/upper tier distinction has been removed.
// Every rickhouse is a flat row of slots. The Warehouse and
// Old-Line distilleries simply add a slot (5 instead of the
// default 4); they no longer sit in any tier.
// ============================================================

interface DistillerySpec {
  defId: string;
  name: string;
  flavorText?: string;
  bonus: DistilleryBonus;
  slots: number;
}

const DEFAULT_SLOTS = 4;
const EXTRA_SLOT = 5;

const SPECS: DistillerySpec[] = [
  {
    defId: "warehouse",
    name: "Warehouse Distillery",
    flavorText: "More space, more patience.",
    bonus: "warehouse",
    slots: EXTRA_SLOT,
  },
  {
    defId: "high_rye_house",
    name: "High-Rye House",
    flavorText: "Spice from day one — start with a 2-rye in the bank.",
    bonus: "high_rye",
    slots: DEFAULT_SLOTS,
  },
  {
    defId: "wheated_baron",
    name: "Wheated Baron",
    flavorText: "Soft mash, lean recipe.",
    bonus: "wheated_baron",
    slots: DEFAULT_SLOTS,
  },
  {
    defId: "the_broker",
    name: "The Broker",
    flavorText: "First trade of the round is on the house.",
    bonus: "broker",
    slots: DEFAULT_SLOTS,
  },
  {
    defId: "old_line",
    name: "Old-Line Distillery",
    flavorText: "An extra rack — built for steady output.",
    bonus: "old_line",
    slots: EXTRA_SLOT,
  },
  {
    defId: "vanilla",
    name: "Vanilla Distillery",
    flavorText: "No bonus. The challenge option.",
    bonus: "vanilla",
    slots: DEFAULT_SLOTS,
  },
];

export function defaultDistilleryPool(): Distillery[] {
  return SPECS.map((spec, i) => ({
    id: `dist_${spec.defId}_${i}`,
    defId: spec.defId,
    name: spec.name,
    flavorText: spec.flavorText,
    bonus: spec.bonus,
    slots: spec.slots,
  }));
}

/** Build the per-player rickhouse slot list from a chosen distillery. */
export function buildRickhouseSlots(playerId: string, distillery: Distillery): RickhouseSlot[] {
  const slots: RickhouseSlot[] = [];
  for (let i = 0; i < distillery.slots; i++) {
    slots.push({ id: `slot_${playerId}_${i}`, ownerId: playerId });
  }
  return slots;
}
