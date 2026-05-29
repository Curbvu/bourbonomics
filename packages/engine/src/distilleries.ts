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
//                                 bills. The prestige specialist: gains
//                                 +1 extra prestige on every Silver or
//                                 Gold sale (Silver → 1 prestige,
//                                 Gold → 2 prestige).
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
  // ─── Standard (v3.4 — beginner, human-only) ─────────────────
  // The simplest pick. No ability, no constraint, the engine
  // pre-drafts 2 Tier-1 bills as Staged so a new player has an
  // obvious first-round move. `botPickable: false` keeps bots from
  // claiming it. Modeled on Terraforming Mars's Beginner Corporation.
  {
    defId: "standard",
    name: "Standard Distillery",
    flavorText: "The Easy Pour.",
    bonus: "standard",
    slots: 4,
    // v3.4: engine pre-drafts 2 Tier-1 bills. `mashBillDraftSize: 2`
    // uses the existing setup-draft path; the `preDraftedBillsTier`
    // hint on `starterPoolMods` lets a future pass tighten the
    // selection to Tier-1 bills specifically.
    mashBillDraftSize: 2,
    starterPoolMods: { preDraftedBills: 2, preDraftedBillsTier: 1 },
    startingCapital: 8,
    cardText:
      "Four open slots with two Tier-1 mash bills already Staged. No permanent ability, no constraint. Recommended for first games.",
    description:
      "The easiest pick. You start with a healthy stake and two of the simplest bills in the deck already attached to slots — your first turn picks up cards and starts committing. No quirks to read around, no penalties to dodge. The Standard Distillery is the on-ramp.",
    strategyNote:
      "Pick this for your first game. It removes the early-turn decisions about which bills to draft and which to skip; you just play the engine.",
    difficulty: "beginner",
    axis: "baseline / beginner",
    implemented: true,
    // v3.4 — Human-only pick. Bots pass over this entry; their
    // preference list (Connoisseur > Vanilla > High-Rye > Wheated)
    // does not include Standard.
    botPickable: false,
  },

  // ─── Vanilla (v3.4 — retuned with a real ability) ───────────
  {
    defId: "vanilla",
    name: "Vanilla Distillery",
    flavorText: "The Symmetric Option.",
    bonus: "vanilla",
    slots: DEFAULT_SLOTS,
    mashBillDraftSize: 0,
    startingCapital: 5,
    cardText:
      "Four open slots. Once per round, the first bourbon you sell this round adds +1 to its grid value before the tier-floor clamp.",
    description:
      "A working distillery, neither famous nor forgotten. You start with four open slots and no inheritance — every barrel you ever sell is one you built from scratch. The first sale each round catches a little extra wind — a single +1 on the grid before the tier floor binds. Pick Vanilla when you want a clean game with a small, consistent edge.",
    strategyNote:
      "The +1 fires once per round on your first sale — bank it for a high-grid bill rather than burning it on a low-payout flush. Round-1 sales rarely benefit (grid is small + floor binds anyway); round 4+ sales nearly always do.",
    difficulty: "beginner",
    axis: "baseline / first-sale bump",
    implemented: true,
  },

  // ─── High-Rye House (v3.4 — Capital lowered + safety valve) ─
  {
    defId: "high_rye_house",
    name: "High-Rye House",
    flavorText: "The Specialist.",
    bonus: "high_rye_house",
    // v3.4 — slot count drops to 3, opening Capital drops to 3,
    // a +1 Generic Labor lands in the dealt hand as the safety valve.
    slots: 3,
    startingBarrel: { age: 1, basicBillKey: "high_rye_basic" },
    starterPoolMods: { bonusSpecialtyRye: 2, bonusGenericLabor: 1 },
    saleMods: { bonusRepOnBill: { kind: "high_rye", rep: 1 } },
    mashBillDraftSize: 0,
    startingCapital: 3,
    cardText:
      "Start with one pre-aged rye barrel (age 1), two free Specialty Rye cards, and one extra Generic Labor. +1 Capital on any sale of a bill with minRye ≥ 1. You cannot draft or draw any mash bill that forbids rye (maxRye: 0).",
    description:
      "Your bottles lead with pepper, baking spice, and a long dry finish. The market knows your label — the buyers who pay for a high-rye pour are the buyers you'll see again. Wheated bills don't fit the house; you ship them straight back to the bourbon discard before they ever touch your rickhouse. The 3-Capital opening is tight — the +1 Generic Labor in your starter pool buys you the round-1 flexibility to land your first sale before Capital becomes a wall.",
    strategyNote:
      "+1 Capital on every rye-bill sale is your engine — every barrel you push compounds into your wallet. The tight 3-slot rickhouse forces a focused production line; you can't dilute into off-theme bills. The wheated-bill ban thins your draft pool — you'll see fewer Epic options. Pre-aged starter sells at round 2 once it picks up its second year.",
    difficulty: "intermediate",
    axis: "specialty / rye",
    implemented: true,
  },

  // ─── Wheated Baron (v3.4 — slot count lowered to 3) ─────────
  {
    defId: "wheated_baron",
    name: "Wheated Baron",
    flavorText: "The Smooth Operator.",
    bonus: "wheated_baron",
    slots: 3,
    startingBarrel: { age: 1, basicBillKey: "wheated_basic" },
    mashBillDraftSize: 0,
    startingCapital: 4,
    cardText:
      "Start with one pre-aged wheated barrel (age 1) and three open slots. Wheated bills (maxRye: 0) cost 1 fewer wheat to complete (floor 0). You cannot commit rye cards (Common, Specialty, or Heritage) to any production pile. Rye is still legal to spend at the market or trade away.",
    description:
      "Soft front, gentle finish, the pour grandmother poured. The Baron's brand is built on wheat — the bills you make taste like vanilla and caramel, never pepper, and the buyers who ask for them ask for them by name. Three slots and a wheated head start force a tight, themed rickhouse — there's no room for off-theme experiments.",
    strategyNote:
      "The wheat discount makes wheated Epics cheaper than they look. The rye ban is brutal against four-grain bills — read recipes before drafting. Rye in hand still spends at the market, so don't trash it. The 3-slot rickhouse is tight — every drafted bill needs to earn its slot.",
    difficulty: "intermediate",
    axis: "specialty / wheat",
    implemented: true,
  },

  // ─── Connoisseur Estate (v3.4 — Capital raised to 7) ────────
  {
    defId: "connoisseur_estate",
    name: "Connoisseur Estate",
    flavorText: "The Diversified.",
    bonus: "connoisseur_estate",
    slots: DEFAULT_SLOTS,
    mashBillDraftSize: 4,
    maxSlottedBills: 4,
    startingCapital: 7,
    cardText:
      "Drafts 4 mash bills at setup instead of 3. Slotted-bill cap is 4 (Rickhouse Expansion Permit unlocks slots 5–6 for transferred barrels only). When you trigger a Silver award you gain 1 prestige; when you trigger a Gold award you gain 2 prestige (every other distillery gains 0 / 1).",
    description:
      "A diversified portfolio: four bills in the rickhouse from day one, four buyers on retainer, and a prestige bonus that turns every premium sale into compounding upside. The Estate plays diversification as identity — every barrel is a brick in the brand. A larger starting stake reflects the strategic depth and the timing pressure of running four production lines at once.",
    strategyNote:
      "Setup ships you Staged on every slot, so first-turn options are wider than anyone's. Every Silver or Gold you land grows the prestige multiplier — chase bills with reachable awards and the +1-per-sale floor adds up fast.",
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
