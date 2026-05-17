import type { Distillery, RickhouseSlot } from "./types";

// ============================================================
// Distillery catalog (v2.10 — "Identity & Economy").
//
// Four-distillery roster: Vanilla (the symmetric default) plus three
// asymmetric profiles built around the v2.10 economy:
//
//   • Vanilla Distillery        — 4 open slots; no ability, no constraint.
//   • High-Rye House            — 1 pre-aged rye starter, +1 rep on rye
//                                 bills, cannot draft wheated bills, +2
//                                 free Specialty Rye in the starter pool.
//   • Wheated Baron             — 1 pre-aged wheated starter, -1 wheat
//                                 floor on wheated bills, cannot commit
//                                 rye cards to barrels.
//   • Connoisseur Estate        — Drafts 4 bills at setup, max-4 slotted
//                                 bills, Gold Convert can land in an
//                                 Open slot.
//
// Source of truth: `packages/engine/content/distilleries.yaml`. Keep
// this file and the YAML in sync by hand.
// ============================================================

/**
 * v2.10: distillery selection is live. Setup runs the picker for every
 * seat (humans + bots). The flag is kept as a forward-compatible kill
 * switch — flipping to false pre-assigns Vanilla and skips the
 * distillery_selection phase entirely.
 */
export const DISTILLERIES_ENABLED = true;

const DEFAULT_SLOTS = 4;

interface DistillerySpec extends Omit<Distillery, "id"> {}

const SPECS: DistillerySpec[] = [
  // ─── Vanilla (baseline) ──────────────────────────────────────
  {
    defId: "vanilla",
    name: "Vanilla Distillery",
    flavorText: "The Symmetric Option.",
    bonus: "vanilla",
    slots: DEFAULT_SLOTS,
    mashBillDraftSize: 0,
    cardText: "Four open slots. No permanent ability, no constraint.",
    description:
      "A working distillery, neither famous nor forgotten. You start with four open slots and no inheritance — every barrel you ever sell is one you built from scratch. Choose Vanilla for a level playing field, an introductory game, or when you want the game itself to be the only variable.",
    strategyNote:
      "The baseline. No quirks to read around — pure economy play.",
    difficulty: "beginner",
    axis: "baseline",
    implemented: true,
  },

  // ─── High-Rye House ───────────────────────────────────────────
  {
    defId: "high_rye_house",
    name: "High-Rye House",
    flavorText: "The Specialist.",
    bonus: "high_rye_house",
    slots: DEFAULT_SLOTS,
    startingBarrel: { age: 1, basicBillKey: "high_rye_basic" },
    starterPoolMods: { bonusSpecialtyRye: 2 },
    saleMods: { bonusRepOnBill: { kind: "high_rye", rep: 1 } },
    mashBillDraftSize: 0,
    cardText:
      "Start with one pre-aged rye barrel (age 1) and two free Specialty Rye cards. +1 rep on any sale of a bill with minRye ≥ 1. You cannot draft or draw any mash bill that forbids rye (maxRye: 0).",
    description:
      "Your bottles lead with pepper, baking spice, and a long dry finish. The market knows your label — the buyers who pay for a high-rye pour are the buyers you'll see again. Wheated bills don't fit the house; you ship them straight back to the bourbon discard before they ever touch your rickhouse.",
    strategyNote:
      "+1 rep on every rye-bill sale is your engine. With v2.11's uniform Specialty bonus retired, the distillery's bonus is the rye player's headline sale upside — stacks only with per-card Heritage bonuses and ops/investment effects. The wheated-bill ban thins your draft pool — you'll see fewer Epic options. Pre-aged starter sells at round 2 once it picks up its second year.",
    difficulty: "intermediate",
    axis: "specialty / rye",
    implemented: true,
  },

  // ─── Wheated Baron ────────────────────────────────────────────
  {
    defId: "wheated_baron",
    name: "Wheated Baron",
    flavorText: "The Smooth Operator.",
    bonus: "wheated_baron",
    slots: DEFAULT_SLOTS,
    startingBarrel: { age: 1, basicBillKey: "wheated_basic" },
    mashBillDraftSize: 0,
    cardText:
      "Start with one pre-aged wheated barrel (age 1). Wheated bills (maxRye: 0) cost 1 fewer wheat to complete (floor 0). You cannot commit rye cards (Common, Specialty, or Heritage) to any production pile. Rye is still legal to spend at the market or trade away.",
    description:
      "Soft front, gentle finish, the pour grandmother poured. The Baron's brand is built on wheat — the bills you make taste like vanilla and caramel, never pepper, and the buyers who ask for them ask for them by name.",
    strategyNote:
      "The wheat discount makes wheated Epics cheaper than they look. The rye ban is brutal against four-grain bills — read recipes before drafting. Rye in hand still spends at the market, so don't trash it.",
    difficulty: "intermediate",
    axis: "specialty / wheat",
    implemented: true,
  },

  // ─── Connoisseur Estate ───────────────────────────────────────
  {
    defId: "connoisseur_estate",
    name: "Connoisseur Estate",
    flavorText: "The Diversified.",
    bonus: "connoisseur_estate",
    slots: DEFAULT_SLOTS,
    mashBillDraftSize: 4,
    maxSlottedBills: 4,
    cardText:
      "Drafts 4 mash bills at setup instead of 3. Slotted-bill cap is 4 (Rickhouse Expansion Permit unlocks slots 5–6 for transferred barrels only). When you trigger a Gold award, Convert may land the Gold bill in an Open slot (no recipe check).",
    description:
      "A diversified portfolio: four bills in the rickhouse from day one, four buyers on retainer, and a Gold award that can reshape the lineup mid-game. The Estate plays diversification as identity — never put all your bourbon in one bill.",
    strategyNote:
      "Setup ships you Staged on every slot, so first-turn options are wider than anyone's. The Open-slot Convert is the deck-shaping move — sell a Gold, paste the recipe into an empty slot, build it next round.",
    difficulty: "intermediate-advanced",
    axis: "slots / deck-shaping",
    implemented: true,
  },
];

export function defaultDistilleryPool(): Distillery[] {
  return SPECS.map((spec, i) => ({ ...spec, id: `dist_${spec.defId}_${i}` }));
}

/**
 * Build a fresh Vanilla Distillery for `playerId`. Used when the
 * `DISTILLERIES_ENABLED` kill switch is off — every player gets a
 * unique Vanilla so the engine can skip distillery_selection.
 */
export function buildVanillaDistilleryFor(playerId: string): Distillery {
  const spec = SPECS.find((s) => s.bonus === "vanilla")!;
  return { ...spec, id: `dist_vanilla_${playerId}` };
}

/** Build the per-player rickhouse slot list from a chosen distillery. */
export function buildRickhouseSlots(playerId: string, distillery: Distillery): RickhouseSlot[] {
  const slots: RickhouseSlot[] = [];
  for (let i = 0; i < distillery.slots; i++) {
    slots.push({ id: `slot_${playerId}_${i}`, ownerId: playerId });
  }
  return slots;
}
