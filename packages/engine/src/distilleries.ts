import type { Distillery, RickhouseSlot } from "./types";

// ============================================================
// Distillery catalog (v3 starting roster).
//
// Each distillery is a full asymmetric package: a starting state, a
// permanent ability, and a constraint. Players pick at setup; the
// choice shapes the whole game.
//
// v3 wire-up status: most abilities and constraints are documented on
// the card (`cardText`) but not yet resolved by the engine —
// `implemented: false` flags those entries. Structural fields the
// engine already supports (slots, maxSlots) ARE applied, so e.g. The
// Estate's 5 slots and Artisanal's hard 3-slot cap take effect today.
// The picker surfaces every distillery in the catalog regardless.
//
// v2.7: gameplay flow remains feature-flagged off
// (`DISTILLERIES_ENABLED = false`) — Vanilla is auto-assigned to every
// player while the rest of the roster's effects land. Flip the flag
// once the new abilities are resolved end-to-end.
//
// Source of truth: `packages/engine/content/distilleries.yaml`. Keep
// this file and the YAML in sync by hand until a build script lands.
// ============================================================

/** Feature flag — when false, the play flow pre-assigns Vanilla to every player. */
export const DISTILLERIES_ENABLED = false;

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
    cardText: "No starting state, no permanent ability, no constraint.",
    description:
      "A working distillery, neither famous nor forgotten. You make bourbon the way the books say to make it — no shortcuts, no specialties, no inherited reputation. The ledger is yours to write. Choose Vanilla for a level playing field, an introductory game, or when you want the game itself to be the only variable.",
    difficulty: "beginner",
    axis: "baseline",
    implemented: true,
  },

  // ─── The Quick-Turn Bottler (time / tempo, early) ───────────
  {
    defId: "quick_turn",
    name: "The Quick-Turn Bottler",
    flavorText: "The Hustler.",
    bonus: "quick_turn",
    slots: DEFAULT_SLOTS,
    cardText:
      "When a barrel of yours first receives an aging card, that card advances the barrel by 2 years instead of 1 — but costs 2 cards from your hand to commit, not 1. Subsequent aging commits work normally (1 card → 1 year).",
    description:
      "You don't have time for tradition. You have inventory, a route, and accounts that pay net-30. The Hustler runs the warehouse like a logistics operation — every barrel is a unit moving toward a sale, and the only question is how fast you can flip it. You pay extra for the express lane. The bourbon doesn't mind.",
    strategyNote:
      "Your throughput edge is real but front-loaded — by the time a barrel reaches age 4, you're aging at the same rate as everyone else. Play pattern: complete a barrel, jump it to age 2, sell into demand, repeat. The 2-card aging cost makes you hand-hungry, so deck thinning and Distribution Deal–type investments pair naturally.",
    difficulty: "beginner",
    axis: "time / tempo",
    implemented: false,
  },

  // ─── The Patient Cooper (time / patience) ────────────────────
  {
    defId: "patient_cooper",
    name: "The Patient Cooper",
    flavorText: "The Long Game.",
    bonus: "patient_cooper",
    slots: DEFAULT_SLOTS,
    cardText:
      "When you sell, treat current demand as if it were 1 higher when reading the grid (a value adjustment, not a column promotion). Your barrels cannot be sold until they reach age 4.",
    description:
      "Your warehouse smells like time. Generations of cooperage, slow oxidation, and the quiet certainty that good bourbon happens to those who wait. The market knows your name — when a Patient Cooper barrel hits the dock, buyers pay a premium without asking. You don't chase trends. You set them, four years late.",
    strategyNote:
      "Age-4 minimum forces a slower rhythm — you'll typically ship 4–5 barrels in a game where Hustlers ship 7+. The demand+1 effectively buys you a free column promotion when current demand sits on a band boundary. Pairs naturally with Bonded Warehouse, Tasting Room, and Vintage Reserve. Hardest part: rounds 1–3, where you can't sell anything yet but everyone else can.",
    difficulty: "intermediate",
    axis: "time / patience",
    implemented: false,
  },

  // ─── The Single-Barrel House (specialty) ─────────────────────
  {
    defId: "single_barrel",
    name: "The Single-Barrel House",
    flavorText: "The Perfectionist.",
    bonus: "single_barrel",
    slots: DEFAULT_SLOTS,
    cardText:
      "Each Specialty or Double Specialty card committed to a barrel grants +2 reputation on sale (instead of the standard +1). You may have at most 1 barrel in the Aging phase at any time — additional completed barrels cannot transition from Building to Aging until the existing aging barrel is sold.",
    description:
      "One barrel at a time. That's the whole philosophy. Your tasting room sells exactly what you make, and you make exactly what you can stand behind. Other distilleries run pipelines; you run a meditation. Each cask is a project, each grain bill a question, each year a deepening of the answer. When the bottle finally ships, it's signed.",
    strategyNote:
      "A barrel with 3 Specialty cards pays grid + 6 rep on sale (instead of grid + 3). The 1-aging-barrel constraint forces serial play: build, age, sell, build again. While your one barrel ages, you can keep multiple slots in Building phase ready to promote once aging frees up. Pairs naturally with R&D Department and Premium Label investments.",
    difficulty: "intermediate-advanced",
    axis: "specialty",
    implemented: false,
  },

  // ─── The Estate (slots / capacity, wide) ─────────────────────
  {
    defId: "estate",
    name: "The Estate",
    flavorText: "The Sprawling.",
    bonus: "estate",
    slots: 5,
    cardText:
      "Your rickhouse has 5 slots instead of 4. Selling a barrel costs 2 cards from your hand (instead of 1) — both cards go to your discard.",
    description:
      "Rolling acreage, a smokehouse, a creek. Three rickhouses if you count the old one. The Estate is bourbon the way the founding families ran it — wide, slow, expensive, and with more bottles in storage than the books admit. The doubled sell cost is just the ledger catching up: every sale rides a fleet of trucks, and every truck has a driver.",
    strategyNote:
      "The 5-slot rickhouse lets you run more parallel projects than anyone else, which compounds across the game. The doubled sell cost is the catch: every sale is more expensive in hand-cards, which discourages high-volume 'sell every turn' plays. The Estate wants to ship fewer, larger sales. Pairs naturally with Land Acquisition (pushing toward the 6-slot cap) and Brand Equity.",
    difficulty: "intermediate",
    axis: "slots / capacity",
    // Slot count is structural and applies today. The doubled sell cost
    // is design-only — flip implemented to true when SELL_BOURBON
    // resolves the per-distillery cost.
    implemented: false,
  },

  // ─── The Storm Chaser (demand) ───────────────────────────────
  {
    defId: "storm_chaser",
    name: "The Storm Chaser",
    flavorText: "The Volatility Player.",
    bonus: "storm_chaser",
    slots: DEFAULT_SLOTS,
    cardText:
      "On your demand roll at the start of your turn, after seeing both dice, you may re-roll one of the two dice (you must keep the new result). You cannot sell barrels when current demand is exactly 5 or 6.",
    description:
      "You know what bourbon costs at 3 a.m. on a slow Tuesday and what it sells for during a Derby weekend. The middle of the road is where bad bets live. Storm Chaser doesn't sell into a steady market — Storm Chaser sells into the storm. Crash or boom, both make you money. It's the calm that kills.",
    strategyNote:
      "The re-roll lets you push demand past 5–6 toward the booms or back down toward crashes. The dead-zone constraint forces active demand manipulation when demand parks at 5–6 — you'll buy ops cards (Bourbon Boom, Glut, Market Manipulation) to get the track moving. Other players have to react to your market moves, which raises the table's overall tempo. The hardest distillery to play well; the most disruptive to play around.",
    difficulty: "advanced",
    axis: "demand",
    implemented: false,
  },

  // ─── The Mothballed House (recipe constraint / inheritance) ──
  {
    defId: "mothballed",
    name: "The Mothballed House",
    flavorText: "The Inheritance.",
    bonus: "mothballed",
    slots: DEFAULT_SLOTS,
    cardText:
      "Your starting rickhouse contains 2 Open slots and 2 Aging slots (each with a basic bill at age 2). Your starter deck is exactly 8 cards — drawn directly into your round-1 hand with no deck behind them. You may not draw mash bills (face-up or blind) during rounds 1, 2, or 3 — the bourbon supply is closed to you until round 4.",
    description:
      "Grandfather's distillery, mothballed for thirty years, opened on the morning the will cleared probate. Two barrels in the rickhouse, eight cards in hand, and a stack of old paperwork the regulators won't honor for another three rounds. You're not building a brand — you're rebuilding an estate. What's already in the rickhouse is what you have to work with.",
    strategyNote:
      "The 8-card starter is brutal — you have exactly half the deck size of every other distillery. But the two pre-aged barrels at age 2 are a genuine advantage: you can sell from round 1. The strategic question is timing: sell early at low demand for cash flow, or hold and risk aging your starter inventory while waiting for a boom? The embargo lifts at round 4, after which you play roughly normally — but your deck composition is permanently shaped by which market cards you bought during the lean years.",
    difficulty: "advanced",
    axis: "recipe constraint / inheritance",
    implemented: false,
  },

  // ─── The Bourbon Purist (recipe constraint / specialization) ─
  {
    defId: "bourbon_purist",
    name: "The Bourbon Purist",
    flavorText: "The Rye-Forward Traditionalist.",
    bonus: "bourbon_purist",
    slots: DEFAULT_SLOTS,
    cardText:
      "Rye and barley cards are interchangeable for each other's recipe minimums (a minRye: 2 recipe can be satisfied by 2 rye, 2 barley, or 1 of each). Specialty gates are unaffected — a minSpecialty: { rye: 1 } recipe still requires a Specialty Rye specifically. You may never commit a wheat card to a barrel; bills with minWheat ≥ 1 cannot be completed by you.",
    description:
      "You make whiskey the old way. Pre-Prohibition, pre-soft-bourbon, pre-marketing-departments. Rye and barley are your grains: rye for the spice and the structure, barley for the conversion that makes the whole mash work. Wheat is for bakers. The bottles you ship lead with black pepper, baking spice, dried herbs, and a long dry finish — the kind of whiskey that built the Manhattan and the Old Fashioned.",
    strategyNote:
      "Rye/barley pool makes high-rye bills dramatically easier — a minRye: 3 recipe completes with any 3 rye, 3 barley, or any combination. Four-grain bills with minRye + minBarley play loose for you. Wheated bills are dead inventory: prefer the face-up bill row over blind-deck draws so you can read recipes first. Specialty Wheat / Double Specialty Wheat are useless on production but still legal market currency. Pairs with Cooperage Stake and Premium Label; tense against Single-Barrel House (both want Specialty Rye).",
    difficulty: "intermediate-advanced",
    axis: "recipe constraint / specialization",
    implemented: false,
  },

  // ─── The Artisanal Distillery (slots / quality, narrow) ─────
  {
    defId: "artisanal",
    name: "The Artisanal Distillery",
    flavorText: "The Boutique.",
    bonus: "artisanal",
    slots: 3,
    maxSlots: 3,
    cardText:
      "Your rickhouse has exactly 3 slots, and this number cannot increase by any effect — Rickhouse Expansion Permit and Land Acquisition both fail when targeted at your rickhouse (the cards are still consumed). Each barrel you sell pays +1 reputation in addition to the grid value.",
    description:
      "You make bourbon the way it should be made: in small batches, signed, dated, and sold to people who will recognize the difference. You don't expand. You won't expand. There's a list of buyers who will pay for what you bottle, and they're the only ones who matter. The Estate might ship a thousand cases on a slow week. You ship eighty, and they're talked about.",
    strategyNote:
      "With 3 slots instead of 4, you'll typically ship one fewer barrel per game than Vanilla — the +1 rep per sale roughly closes that volume gap and rewards quality over quantity. The constraint matters most against The Estate (whose 5-slot ability creates a wide gap with you) and against Land Acquisition (a strong investment you simply can't use). Plays well with Patient Cooper–style strategies and with investments that reward each individual sale (Brand Equity, Tasting Room).",
    difficulty: "intermediate",
    axis: "slots / quality",
    // Slot count + hard cap apply structurally today; the +1 rep per
    // sale is design-only until SELL_BOURBON resolves it.
    implemented: false,
  },
];

export function defaultDistilleryPool(): Distillery[] {
  return SPECS.map((spec, i) => ({ ...spec, id: `dist_${spec.defId}_${i}` }));
}

/**
 * Build a fresh Vanilla Distillery for `playerId`. Used by the v2.7
 * play flow to pre-assign every player to Vanilla while the full
 * roster is disabled. Each call mints a unique id so multiple players
 * can hold the "same" distillery without colliding.
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
