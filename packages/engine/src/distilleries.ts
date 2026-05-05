import type { Distillery, RickhouseSlot } from "./types";

// ============================================================
// Distillery catalog (v2.4 rebuild).
//
// Each distillery is a full asymmetric opening package: a starting
// state (pre-aged barrel and/or starter pool modifications), a
// permanent ability (composition / sale / draft modifiers), and a
// constraint (first-sale age, capacity cap, mash-bill hand cap).
//
// All ability/constraint data lives on the `Distillery` value so
// systems can react without a `switch (bonus)` everywhere — see
// composition.ts, sell-bourbon.ts, draw-deck.ts, and starter-pool.ts.
// ============================================================

const DEFAULT_SLOTS = 4;
const EXTRA_SLOT = 5;

interface DistillerySpec extends Omit<Distillery, "id"> {}

const SPECS: DistillerySpec[] = [
  {
    defId: "warehouse",
    name: "Warehouse Distillery",
    flavorText: "The Capacity King — more space, more patience.",
    bonus: "warehouse",
    slots: EXTRA_SLOT,
    firstSaleMinAge: 4,
  },
  {
    defId: "high_rye_house",
    name: "High-Rye House",
    flavorText: "The Specialist — pepper from day one.",
    bonus: "high_rye",
    slots: DEFAULT_SLOTS,
    startingBarrel: { age: 1, basicBillKey: "high_rye_basic" },
    starterPoolMods: { bonusTwoRye: 2 },
    saleMods: { bonusRepOnBill: { kind: "high_rye", rep: 1 } },
    compositionMods: { excludeFromComposition: ["wheat"] },
  },
  {
    defId: "wheated_baron",
    name: "Wheated Baron",
    flavorText: "The Smooth Operator — soft mash, lean recipe.",
    bonus: "wheated_baron",
    slots: DEFAULT_SLOTS,
    startingBarrel: { age: 1, basicBillKey: "wheated_basic" },
    compositionMods: {
      excludeFromComposition: ["rye"],
      singleGrainThreshold: 2,
    },
  },
  {
    defId: "old_line",
    name: "Old-Line Distillery",
    flavorText: "The Heritage Brand — sale-ready out of the gate.",
    bonus: "old_line",
    slots: EXTRA_SLOT,
    startingBarrel: { age: 2, basicBillKey: "workhorse" },
    starterPoolMods: { capitalDelta: -1 },
  },
  {
    defId: "the_broker",
    name: "The Broker",
    flavorText: "The Dealmaker — final-round trade is on the house.",
    bonus: "broker",
    slots: DEFAULT_SLOTS,
    maxSlots: DEFAULT_SLOTS, // capped, no Rickhouse Expansion Permit
    starterPoolMods: { capitalDelta: 2 },
  },
  {
    defId: "connoisseur",
    name: "Connoisseur Estate",
    flavorText: "The Diversified — three of four grains is enough.",
    bonus: "connoisseur",
    slots: DEFAULT_SLOTS,
    mashBillDraftSize: 4,
    maxMashBillHandSize: 4,
    compositionMods: {
      allGrainsDistinctThreshold: 3,
      allGrainsRep: 3,
    },
  },
  {
    defId: "vanilla",
    name: "Vanilla Distillery",
    flavorText: "No starting state, no permanent ability, no constraint.",
    bonus: "vanilla",
    slots: DEFAULT_SLOTS,
  },
];

export function defaultDistilleryPool(): Distillery[] {
  return SPECS.map((spec, i) => ({ ...spec, id: `dist_${spec.defId}_${i}` }));
}

/** Build the per-player rickhouse slot list from a chosen distillery. */
export function buildRickhouseSlots(playerId: string, distillery: Distillery): RickhouseSlot[] {
  const slots: RickhouseSlot[] = [];
  for (let i = 0; i < distillery.slots; i++) {
    slots.push({ id: `slot_${playerId}_${i}`, ownerId: playerId });
  }
  return slots;
}
