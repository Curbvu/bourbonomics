import type { Card, InvestmentCard, MashBill, StarterBillKey } from "./types";
import {
  makeLaborCard,
  makeMashBill,
  makePremiumResource,
  makeResourceCard,
  wrapInvestmentForMarket,
  wrapOperationsForMarket,
} from "./cards";
import { defaultOperationsDeck } from "./operations";

// ============================================================
// Starter mash bills (v2.4) — NOT part of the Bourbon deck. Used
// only for distillery starting barrels. Three "basic" bills cover
// the workhorse, high-rye, and wheated lanes; pre-aged starting
// barrels ship with one of these attached.
// ============================================================

export function buildStarterMashBill(key: StarterBillKey, instance: number): MashBill {
  const specs: Record<StarterBillKey, Parameters<typeof makeMashBill>[0]> = {
    workhorse: {
      defId: "starter_workhorse",
      name: "Backroad Batch",
      slogan: "Built for the long haul.",
      flavorText: "A ship-it-anyway corn-rye workhorse. The bill the founder cooked first.",
      tier: "common",
      ageBands: [2, 4, 6],
      demandBands: [2, 4, 6],
      rewardGrid: [
        [1, 2, 3],
        [2, 3, 4],
        [3, 4, 5],
      ],
    },
    high_rye_basic: {
      defId: "starter_high_rye",
      name: "House High-Rye",
      slogan: "Pepper, pepper, pepper.",
      flavorText: "The estate's standing high-rye recipe. Pungent and predictable.",
      tier: "common",
      ageBands: [2, 4, 6],
      demandBands: [3, 5, 7],
      rewardGrid: [
        [1, 2, 3],
        [2, 4, 5],
        [3, 5, 6],
      ],
      recipe: { minRye: 2 },
    },
    wheated_basic: {
      defId: "starter_wheated",
      name: "Soft Front",
      slogan: "Smooth from the first drop.",
      flavorText: "House wheated bill — the gentle pour.",
      tier: "common",
      ageBands: [2, 4, 6],
      demandBands: [2, 4, 6],
      rewardGrid: [
        [1, 2, 3],
        [2, 3, 5],
        [3, 4, 6],
      ],
      recipe: { minWheat: 1, maxRye: 0 },
    },
  };
  return makeMashBill(specs[key], instance);
}

// ============================================================
// Investment catalog — v3.5 "Investment Rebuild."
//
// 32 cards distributed 8 small / 13 medium / 11 large, grounded in
// real-world distillery capital expenditures: stills, mash tuns,
// fermenters, warehouses, cooperages, climate control, bottling
// lines, visitor centers, sales offices, marketing departments.
//
// All entries are `implemented: false` for v3.5. They appear in the
// market and the Card Inspect modal but the engine does not yet
// resolve their effects — the v3.6 wave wires effect resolution
// per category (on_sell bonuses, on_make refunds, on_buy_market
// discounts, passive_permanent flags, …). The ONLY on-buy effect
// that fires today is the Warehouse unlock (see buy-from-market.ts).
//
// Source of truth: `packages/engine/content/investments.yaml`. Keep
// the YAML and this catalog in sync by hand until a build script lands.
// ============================================================

export function defaultInvestmentCatalog(): InvestmentCard[] {
  const specs: Omit<InvestmentCard, "id">[] = [
    // ─────────────── Small (cost 3–4) ───────────────
    {
      defId: "tasting_room",
      name: "Tasting Room",
      cost: 4,
      tier: "small",
      category: "sales",
      triggers: ["on_sell"],
      archetype: "patience",
      rateLimited: false,
      short: "Patient sales pay extra",
      text: "When you sell a barrel aged 5 or older, gain +1 Capital.",
      description:
        "Reliable small bonus for patient cellar play. Pairs with Vintage Reserve and Tasting Notes. Repriced from the v3.4 catalog (3→4) and per-sale value (2→1).",
      implemented: false,
    },
    {
      defId: "grain_contract",
      name: "Grain Contract",
      cost: 4,
      tier: "small",
      category: "deck",
      triggers: ["on_make"],
      archetype: "volume",
      rateLimited: true,
      rateLimitScope: "1/round",
      short: "First grain refunds a card",
      text: "The first time each round you commit any grain card to a barrel, draw 1 card.",
      description:
        "Deck-cycling engine for production-heavy players. Once per round, your first grain commitment pays you back a card — slightly offsetting the holding cost of running multiple barrels in parallel.",
      implemented: false,
    },
    {
      defId: "tasting_notes",
      name: "Tasting Notes",
      cost: 3,
      tier: "small",
      category: "deck",
      triggers: ["on_sell"],
      archetype: "engine",
      rateLimited: false,
      short: "Reward placement over inventory",
      text: "When you sell a barrel AND place the resulting bottle on a portfolio slot, draw 2 cards. If the bottle goes to inventory instead, draw 1 card.",
      description:
        "Pushes against the 'stash everything in inventory' pattern. Direct portfolio interaction — the only Small-tier card that touches the v3.2 portfolio system.",
      implemented: false,
    },
    {
      defId: "field_office",
      name: "Field Office",
      cost: 4,
      tier: "small",
      category: "info",
      triggers: ["on_purchase"],
      archetype: "flex",
      rateLimited: false,
      short: "Scout the secondary pool",
      text: "On purchase, look at every face-up secondary portfolio's full slot table. Reveal any one to all players (the rest stay your private knowledge until they're drafted).",
      description:
        "Information card for second-portfolio meta. Asymmetric — you know more, you control disclosure.",
      implemented: false,
    },
    {
      defId: "warehouse",
      name: "Warehouse",
      cost: 4,
      tier: "small",
      category: "deck",
      triggers: ["passive_permanent"],
      archetype: "flex",
      rateLimited: false,
      short: "Carry one card between rounds",
      text:
        "On purchase, gain a private Warehouse slot. At any time during your turn, you may set aside one card from your hand into your Warehouse. The Warehouse holds at most one card. The stored card persists across rounds and is not discarded at End Turn. On any future turn, you may move the Warehouse card back into your hand as a free action.",
      description:
        "The only persistent-card-storage option in v3.5 — the free Save Slot is gone. Every player will want one. The Warehouse unlock fires immediately on buy (see PlayerState.warehouseUnlocked); the in/out flow lands with the v3.6 effect wave.",
      implemented: false,
    },
    {
      defId: "visitor_center",
      name: "Visitor Center",
      cost: 4,
      tier: "small",
      category: "sales",
      triggers: ["on_sell"],
      archetype: "flex",
      rateLimited: false,
      short: "Tourists buy bottles",
      text:
        "When you sell a barrel, gain +1 Capital. If the barrel's source bill carries the `gold-eligible` or `silver-eligible` tag, gain +2 Capital instead.",
      description:
        "Tag-aware (v3.4). Bourbon tourism is real revenue. Pays on every sale regardless of age; bigger payoff on award-eligible bills.",
      implemented: false,
    },
    {
      defId: "rail_spur",
      name: "Rail Spur",
      cost: 3,
      tier: "small",
      category: "market",
      triggers: ["on_buy_market"],
      archetype: "tempo",
      rateLimited: true,
      rateLimitScope: "1/round",
      short: "Direct shipments",
      text: "The first market purchase you make each round costs 1 less Capital (floor 1).",
      description:
        "Persistent buy discount. Works on any market card.",
      implemented: false,
    },
    {
      defId: "cellar_foreman",
      name: "Cellar Foreman",
      cost: 4,
      tier: "small",
      category: "deck",
      triggers: ["turn_start"],
      archetype: "flex",
      rateLimited: true,
      rateLimitScope: "1/round",
      short: "Draw before aging",
      text: "At the start of your turn, after rolling demand but before paying aging costs, draw 1 card. Once per round.",
      description:
        "Repurposed in v3.5 from a broken 'skip aging' design. Aging cards ARE age (v3.5 invariant), so no card can advance age without committing one. Cellar Foreman now pays a small draw instead — helps cover aging commits.",
      implemented: false,
    },

    // ─────────────── Medium (cost 5–8) ───────────────
    {
      defId: "marketing_department",
      name: "Marketing Department",
      cost: 5,
      tier: "medium",
      category: "demand",
      triggers: ["turn_start"],
      archetype: "flex",
      rateLimited: true,
      rateLimitScope: "1/round",
      short: "Reroll one demand die",
      text: "At the start of your turn, after rolling your 2d6 demand roll, you may reroll one of the two dice. Once per round.",
      description:
        "Smooths variance on the demand check that opens your turn. Useful for hot-market specialists who need a specific demand to fire their on-sell bonuses.",
      implemented: false,
    },
    {
      defId: "trade_lobby",
      name: "Trade Lobby",
      cost: 6,
      tier: "medium",
      category: "demand",
      triggers: ["turn_start"],
      archetype: "flex",
      rateLimited: true,
      rateLimitScope: "1/round",
      short: "Nudge demand each round",
      text: "At the start of your turn, after rolling demand, you may shift demand by ±1 (your choice). Once per round.",
      description:
        "Direct demand control. Asymmetric — only the owner gets the nudge.",
      implemented: false,
    },
    {
      defId: "distillery_tour_program",
      name: "Distillery Tour Program",
      cost: 6,
      tier: "medium",
      category: "demand",
      triggers: ["passive_permanent"],
      archetype: "flex",
      rateLimited: false,
      short: "Personal demand floor of 4",
      text:
        "For all of your own bourbon sales and grid lookups, treat current demand as 4 if it would otherwise be lower. Other players' sales and demand interactions are unaffected.",
      description:
        "Asymmetric, single-player benefit. Doesn't modify the shared demand track. Repurposed in v3.5 from a clunkier draft.",
      implemented: false,
    },
    {
      defId: "hedge_fund",
      name: "Hedge Fund",
      cost: 7,
      tier: "medium",
      category: "sales",
      triggers: ["on_sell"],
      archetype: "tempo",
      rateLimited: false,
      short: "Hot markets pay extra",
      text: "When you sell at demand 8 or higher, gain +3 Capital. Demand does not drop from your sale.",
      description:
        "A boom-time amplifier. Sells into hot markets are already the best sales — Hedge Fund makes them dramatically better, and prevents the usual 'selling tanks demand' feedback loop. Useless if you sell into low markets.",
      implemented: false,
    },
    {
      defId: "rd_department",
      name: "R&D Department",
      cost: 8,
      tier: "medium",
      category: "market",
      triggers: ["on_buy_market"],
      archetype: "specialty",
      rateLimited: false,
      short: "Specialty cards, half off",
      text:
        "When you buy a Specialty or Heritage card from the market, that card costs 1 less Capital (floor 1).",
      description:
        "v3.5 simplification — the old 'plus to hand' clause is redundant now that all market purchases route to hand by default. Only the Capital discount remains.",
      implemented: false,
    },
    {
      defId: "master_blender",
      name: "Master Blender",
      cost: 7,
      tier: "medium",
      category: "production",
      triggers: ["on_make"],
      archetype: "flex",
      rateLimited: false,
      short: "Corn extremes pay off",
      text:
        "When you complete a recipe with committed corn count ≤ 2 or ≥ 5, gain +2 Capital and +1 Reputation. The +1 Reputation banks immediately and is not subject to portfolio scoring.",
      description:
        "One of two cards in the catalog that pays Reputation directly (the other is the endgame trio). Plays into the corn-extreme tags (`corn-light` / `corn-heavy`).",
      implemented: false,
    },
    {
      defId: "estate_bottling",
      name: "Estate Bottling",
      cost: 8,
      tier: "medium",
      category: "endgame",
      triggers: ["on_purchase", "passive_permanent"],
      archetype: "engine",
      rateLimited: false,
      short: "Make secondaries safer",
      text:
        "On purchase: the next time you take the Draft Second Portfolio action, it costs 0 Generic Labor instead of 1. For the rest of the game, your second portfolio's failure penalty is reduced to 1 Reputation per unfilled required slot (cap −5 instead of −10).",
      description:
        "Dedicated second-portfolio enabler. Mandatory for Vanilla's flagship Mastery, which requires a second portfolio. The free draft is a one-shot; the reduced penalty is permanent.",
      implemented: false,
    },
    {
      defId: "heritage_cooperage",
      name: "Heritage Cooperage",
      cost: 7,
      tier: "medium",
      category: "production",
      triggers: ["on_sell"],
      archetype: "specialty",
      rateLimited: false,
      short: "Heritage commits return on sale",
      text:
        "When you sell a barrel whose completed recipe used at least one Heritage card, return all Heritage cards from that barrel to your hand instead of to discard.",
      description:
        "Heritage recycling. Renamed from 'Heritage Cellars' in v3.5 for thematic accuracy — a cooperage builds casks, which is where the Heritage component lives.",
      implemented: false,
    },
    {
      defId: "bottling_line",
      name: "Bottling Line",
      cost: 8,
      tier: "medium",
      category: "sales",
      triggers: ["on_sell"],
      archetype: "engine",
      rateLimited: true,
      rateLimitScope: "1/round",
      short: "Reclaim your cask",
      text:
        "The first time each round you sell a barrel, return the cask card from that barrel to your hand instead of your discard.",
      description:
        "Cask-recycling engine. Pairs with Cooperage (which refunds the first cask commit each round) for tight cask economy.",
      implemented: false,
    },
    {
      defId: "yeast_lab",
      name: "Yeast Lab",
      cost: 6,
      tier: "medium",
      category: "production",
      triggers: ["on_make"],
      archetype: "patience",
      rateLimited: true,
      rateLimitScope: "1/round",
      short: "Reliable fermentation",
      text:
        "The first time each round you complete a recipe (the barrel transitions from Building to Aging), draw 2 cards.",
      description:
        "Pays the completion moment, not the commit moment — rewards finishing recipes rather than starting them.",
      implemented: false,
    },
    {
      defId: "bottling_plant",
      name: "Bottling Plant",
      cost: 7,
      tier: "medium",
      category: "sales",
      triggers: ["on_sell"],
      archetype: "volume",
      rateLimited: false,
      short: "Streamlined operations",
      text: "When you sell a barrel, draw 1 card and gain +1 Capital. No round limit.",
      description:
        "Steady sales engine — pays per barrel, every barrel, no gates. The volume-archetype workhorse at this price point.",
      implemented: false,
    },
    {
      defId: "sales_office",
      name: "Sales Office",
      cost: 7,
      tier: "medium",
      category: "market",
      triggers: ["turn_start"],
      archetype: "flex",
      rateLimited: true,
      rateLimitScope: "1/round",
      short: "Pre-market briefing",
      text:
        "At the start of your turn, look at the top 3 cards of the market supply deck. You may rearrange them or discard one (refill from supply if discarded). Once per round.",
      description:
        "Information + light control over the market refresh. Useful for timing a Specialty/Heritage drop.",
      implemented: false,
    },
    {
      defId: "rickhouse_office",
      name: "Rickhouse Office",
      cost: 6,
      tier: "medium",
      category: "deck",
      triggers: ["turn_start"],
      archetype: "tempo",
      rateLimited: true,
      rateLimitScope: "1/round",
      short: "Draw two before aging",
      text: "At the start of your turn, after rolling demand but before paying aging costs, draw 2 cards. Once per round.",
      description:
        "Repurposed in v3.5 from a broken 'skip aging' design — under the v3.5 invariant, aging cards ARE age. Rickhouse Office now buys you the cards to pay the cost, two at a time. Steeper price than Cellar Foreman; doubled draw.",
      implemented: false,
    },
    {
      defId: "cooperage",
      name: "Cooperage",
      cost: 6,
      tier: "medium",
      category: "production",
      triggers: ["on_make"],
      archetype: "engine",
      rateLimited: true,
      rateLimitScope: "1/round",
      short: "First cask, free",
      text:
        "The first time each round you commit any cask card (Common, Specialty, or Heritage) to a barrel, return that cask to your hand instead of locking it with the barrel.",
      description:
        "Cask-side engine — the cask is literally not spent on the first commit. Pairs with Bottling Line for double cask recycling.",
      implemented: false,
    },
    {
      defId: "climate_controlled_warehouse",
      name: "Climate-Controlled Warehouse",
      cost: 7,
      tier: "medium",
      category: "aging",
      triggers: ["on_purchase", "passive_permanent"],
      archetype: "patience",
      rateLimited: false,
      short: "Consistent aging, no surprises",
      text:
        "On purchase, designate one of your slots as 'climate-controlled.' Barrels in this slot are immune to ops cards that target aging negatively (Regulatory Inspection, Forced Cure, others). Other players cannot interfere with this slot's aging.",
      description:
        "Real-world AC warehouses are a controversial industry move — they produce more consistent but arguably less complex bourbon. In game terms: defensive immunity.",
      implemented: false,
    },

    // ─────────────── Large (cost 9–15) ───────────────
    {
      defId: "brand_ambassador",
      name: "Brand Ambassador",
      cost: 9,
      tier: "large",
      category: "sales",
      triggers: ["on_purchase", "passive_permanent"],
      archetype: "patience",
      rateLimited: false,
      short: "One barrel reads +2 demand",
      text:
        "On purchase, choose one of your aging barrels. For the rest of the game, that specific barrel reads its grid as if demand were +2 when sold.",
      description:
        "Strong pick for patient players who plan to age a single high-value barrel for many rounds.",
      implemented: false,
    },
    {
      defId: "premium_label",
      name: "Premium Label",
      cost: 10,
      tier: "large",
      category: "sales",
      triggers: ["on_sell"],
      archetype: "specialty",
      rateLimited: false,
      short: "Specialty barrels pay extra",
      text:
        "When you sell a barrel containing 2 or more Specialty or Heritage cards, gain +3 Capital.",
      description:
        "Rewards specialty-heavy production lines. Stacks per sale.",
      implemented: false,
    },
    {
      defId: "aging_warehouse",
      name: "Aging Warehouse",
      cost: 11,
      tier: "large",
      category: "slots",
      triggers: ["on_purchase"],
      archetype: "engine",
      rateLimited: false,
      short: "+1 permanent rickhouse slot",
      text:
        "Permanently +1 rickhouse slot (max 6, stacks with Rickhouse Expansion Permit and similar effects).",
      description:
        "Renamed from 'Land Acquisition' in v3.5 for thematic accuracy — actual physical warehouses, not real estate plays.",
      implemented: false,
    },
    {
      defId: "bonded_warehouse",
      name: "Bonded Warehouse",
      cost: 12,
      tier: "large",
      category: "aging",
      triggers: ["on_purchase", "passive_permanent"],
      archetype: "patience",
      rateLimited: false,
      short: "Bonded slot returns aging cards",
      text:
        "On purchase, designate one of your slots as 'bonded.' When a barrel in the bonded slot sells, all aging cards committed to it return to your hand instead of going to discard.",
      description:
        "Repurposed in v3.5 from a broken 'auto-age' draft. Now an aging-card recycler — every long-hold barrel in the bonded slot pays back its aging cost on sale.",
      implemented: false,
    },
    {
      defId: "vintage_reserve",
      name: "Vintage Reserve",
      cost: 13,
      tier: "large",
      category: "sales",
      triggers: ["on_sell"],
      archetype: "patience",
      rateLimited: false,
      short: "Triple grid at age 7+",
      text:
        "When you sell a barrel age 7 or older, triple the grid value of that sale (applied before tier-floor clamping).",
      description:
        "Late-game patience payoff. The grid value gets tripled BEFORE the tier floor clamps, so high-grid bills benefit; low-grid bills still floor.",
      implemented: false,
    },
    {
      defId: "bourbon_hall_of_fame",
      name: "Bourbon Hall of Fame",
      cost: 15,
      tier: "large",
      category: "endgame",
      triggers: ["final_scoring"],
      archetype: "flex",
      rateLimited: false,
      short: "+1 Reputation per distinct bill sold",
      text:
        "At the end of the game, gain +1 Reputation per distinct mash bill name you sold during the game (cap +6 Reputation).",
      description:
        "End-game scoring card. Rewards diversification across distinct bills rather than repetition of one bill.",
      implemented: false,
    },
    {
      defId: "master_distiller",
      name: "Master Distiller",
      cost: 12,
      tier: "large",
      category: "production",
      triggers: ["passive_permanent"],
      archetype: "patience",
      rateLimited: false,
      short: "Your bills' tags expand",
      text:
        "On purchase, choose any one tag from: `wheated`, `rye-heavy`, `single-grain`, `triple-grain`. For the rest of the game, every barrel you complete is treated as if its source bill carried that tag for slot eligibility, Brand Restriction, and Mastery Condition purposes.",
      description:
        "Tag-expansion engine (v3.4). Lets a high-rye player pretend to be wheated for slot purposes, etc. The chosen tag is locked at purchase.",
      implemented: false,
    },
    {
      defId: "column_still",
      name: "Column Still",
      cost: 10,
      tier: "large",
      category: "production",
      triggers: ["on_make"],
      archetype: "volume",
      rateLimited: false,
      short: "Industrial-scale production",
      text:
        "When you Make Bourbon, you may commit to up to TWO different Staged or Building slots in a single Make Bourbon action (your commit cards split across the two slots however you choose).",
      description:
        "Renamed from 'Distillery Expansion' in v3.5. A column still is the real-world large-scale production unit — pairs with multi-bill build pushes.",
      implemented: false,
    },
    {
      defId: "climate_controlled_rickhouse",
      name: "Climate-Controlled Rickhouse",
      cost: 12,
      tier: "large",
      category: "aging",
      triggers: ["on_purchase", "passive_permanent"],
      archetype: "patience",
      rateLimited: false,
      short: "All slots immune to aging interference",
      text:
        "All of your rickhouse slots are treated as climate-controlled — barrels in any of your slots are immune to ops cards that target aging negatively (Regulatory Inspection, Forced Cure, others).",
      description:
        "All-slots scaled version of Climate-Controlled Warehouse. Defensive blockbuster.",
      implemented: false,
    },
  ];
  return specs.map((s, i) => ({ ...s, id: `inv_${s.defId}_${i}` }));
}

// ============================================================
// Default starter deck — 16 cards =
//   4 cask + 5 corn + 5 grain (3 rye, 1 barley, 1 wheat) + 2 Generic Labor.
//
// Labor is scarce and finite per player: 2 in the starter deck is all
// the Generic Labor a player will ever own. New Labor only enters via
// Specialty Labor cards (Cooper, Marketing, future Architect) bought
// from the market. No central Hire pile, no top-up.
// ============================================================

export function defaultStarterCards(playerLabel: string): Card[] {
  const cards: Card[] = [];
  let idx = 0;
  for (let i = 0; i < 4; i++) cards.push(makeResourceCard("cask", playerLabel, idx++));
  for (let i = 0; i < 5; i++) cards.push(makeResourceCard("corn", playerLabel, idx++));
  for (let i = 0; i < 3; i++) cards.push(makeResourceCard("rye", playerLabel, idx++));
  cards.push(makeResourceCard("barley", playerLabel, idx++));
  cards.push(makeResourceCard("wheat", playerLabel, idx++));
  for (let i = 0; i < 2; i++)
    cards.push(makeLaborCard({ subtype: "generic", ownerLabel: playerLabel, index: idx++ }));
  return cards;
}

// ============================================================
// Default mash bill catalog — difficulty/payoff curve with a
// specialty-gate ramp by rarity.
//
// Pool is split roughly into thirds across complexityTiers, with
// constraints ramping by rarity:
//
//   common      universal rule only (just 1 cask + 1 corn + 1 grain)
//   uncommon    transition — ≥2 named grain (or minTotalGrain 2),
//               with light specialty pressure (≤1 grain slot gated)
//   rare        semi-gated — 1–2 `minSpecialty` entries
//   epic        fully gated — every cask + named grain slot demands
//               Specialty or Heritage
//   legendary   fully gated AND broader — more slots gated than epics,
//               often with tighter unit counts on a single slot
//
// **Reward grids** are monotonically non-decreasing across both axes —
// older bourbon never pays less than younger; hotter demand never pays
// less than colder. (v2.8: dropped the earlier "grain character" curves
// where wheat peaked mid-demand and barley peaked low — backward steps
// read as "this card is broken" at a glance.)
//
// Awards correlate with rarity (Gold lives in epics + legendary).
// ============================================================

/**
 * The Bourbon deck for real games + the source for the Bourbon Cards
 * gallery. Tutorial-only bills are filtered out at the bottom of this
 * function as a defense in depth — the catalog never lists them
 * regardless, but the filter makes the contract explicit.
 */
export function defaultMashBillCatalog(): MashBill[] {
  return ([
    // ──────────────── Tier 1 — Starter bills ────────────────
    // Forgiving payouts, no recipe constraints beyond the universal
    // rule. **Small grids** — five 1×2 / 2×1 single-axis ladders
    // beginners can scan at a glance, plus a couple of compact 2×2
    // bills for variety. Reward range ~2–5.
    makeMashBill(
      {
        defId: "knobs_end_90",
        name: "Knob's End 90",
        slogan: "Last knob in the rack.",
        flavorText: "Bottled barrel-proof, sold at 90. The end of a long dump day.",
        tier: "common",
        complexityTier: 1,
        // 2×1 — age-driven. The end of a dump day reads better with
        // a few extra years on it.
        ageBands: [2, 4],
        demandBands: [3],
        rewardGrid: [[2], [4]],
      },
      0,
    ),
    makeMashBill(
      {
        defId: "bardstown_boiler",
        name: "Bardstown Boiler",
        slogan: "Where the steam never sleeps.",
        flavorText: "Bardstown's main street, bottled. Workhorse pour at weeknight pricing.",
        tier: "common",
        complexityTier: 1,
        // 1×2 — demand-driven. Workhorse pour catches a tailwind on
        // hot weeknight markets.
        ageBands: [2],
        demandBands: [3, 6],
        rewardGrid: [[3, 5]],
      },
      0,
    ),
    makeMashBill(
      {
        defId: "warehouse_e_batch",
        name: "Warehouse E Batch",
        slogan: "E for excellent. Or extra.",
        flavorText: "Whatever the rickhouse manager grabbed last. Consistent enough to ship.",
        tier: "common",
        complexityTier: 1,
        // 2×2 — slightly richer common; rewards both age and demand.
        // The "manager grabbed something" bill earns a fuller grid.
        ageBands: [2, 4],
        demandBands: [3, 6],
        rewardGrid: [
          [2, 3],
          [3, 5],
        ],
      },
      0,
    ),
    makeMashBill(
      {
        defId: "mammoth_cave_malt",
        name: "Mammoth Cave Malt",
        slogan: "Aged in the dark.",
        flavorText: "Limestone water, malted barley, and one very large echo.",
        tier: "common",
        complexityTier: 1,
        // 2×1 — age-driven. The patient pour rewards the wait.
        ageBands: [2, 4],
        demandBands: [3],
        rewardGrid: [[2], [4]],
      },
      0,
    ),
    makeMashBill(
      {
        defId: "limestone_ledger",
        name: "Limestone Ledger",
        slogan: "Filtered through Kentucky.",
        flavorText: "Hard water, soft mouthfeel, accountant's clarity.",
        tier: "common",
        complexityTier: 1,
        // 1×2 — demand-driven. The accountant's pour: clean payout
        // either way.
        ageBands: [2],
        demandBands: [3, 6],
        rewardGrid: [[2, 4]],
      },
      0,
    ),
    makeMashBill(
      {
        defId: "foggy_bottom_forge",
        name: "Foggy Bottom Forge",
        slogan: "Distilled in the river fog.",
        flavorText: "Bottled when the cooper couldn't see the next building.",
        tier: "common",
        complexityTier: 1,
        // 2×1 — age-driven. Older fog forge cuts through the haze.
        ageBands: [2, 4],
        demandBands: [3],
        rewardGrid: [[2], [5]],
      },
      0,
    ),
    makeMashBill(
      {
        defId: "cornbread_line",
        name: "Cornbread Line",
        slogan: "Sweet, hot, simple.",
        flavorText: "Eighty percent corn, twenty percent everything else.",
        tier: "common",
        complexityTier: 1,
        // 2×2 — most varied common; corn-forward bill earns both
        // axes. Easy recipe constraint (≥2 corn).
        ageBands: [2, 4],
        demandBands: [3, 6],
        rewardGrid: [
          [2, 4],
          [3, 5],
        ],
        recipe: { minCorn: 2 },
      },
      0,
    ),

    // ──────────────── Tier 2 — Mid bills ────────────────
    // One real constraint (rye ≥ 2-3, wheat ≥ 1, no rye, etc.). Best
    // payouts pushed to age 4+. Demand bands matter. Spread ~3-5.
    // Peak 8-9. Silver awards live mostly here.
    makeMashBill(
      {
        defId: "wheat_whisper",
        name: "Wheat Whisper",
        slogan: "Soft, slow, certain.",
        flavorText: "Wheated mash bill that doesn't argue.",
        tier: "uncommon",
        complexityTier: 2,
        // 1×3 — flat-age, demand-driven. Wheated bills don't change
        // much with age — the soft pour just rides the market.
        // ≥2 wheat, no rye. Silver still rewards aging the barrel
        // even though the grid doesn't (silver reads the barrel's
        // raw age, not the grid bin).
        ageBands: [3],
        demandBands: [3, 5, 8],
        rewardGrid: [[3, 5, 7]],
        recipe: { minWheat: 2, maxRye: 0 },
        silverAward: { minAge: 5, minDemand: 5 },
      },
      0,
    ),
    makeMashBill(
      {
        defId: "stave_and_story",
        name: "Stave & Story",
        slogan: "One barrel, one tale.",
        flavorText: "Each stave numbered, each pour narrated.",
        tier: "uncommon",
        complexityTier: 2,
        // 2×2 — narrated stave, hot-demand pour. ≥2 rye.
        ageBands: [3, 6],
        demandBands: [5, 8],
        rewardGrid: [
          [3, 5],
          [4, 8],
        ],
        recipe: { minRye: 2 },
        silverAward: { minAge: 5, minDemand: 6 },
      },
      0,
    ),
    makeMashBill(
      {
        defId: "charred_oak_exchange",
        name: "Charred Oak Exchange",
        slogan: "Trade in the burn.",
        flavorText: "A blender's standby — char level four, vanilla up front.",
        tier: "uncommon",
        complexityTier: 2,
        // 1×3 — flat-age, demand-driven. The blender's standby pours
        // the same at any reasonable age; market sets the price.
        // ≥2 barley, with light specialty pressure on one barley slot —
        // the uncommon-tier transition signal (≤1 grain slot
        // gated; commons gate nothing, rares gate 1–2 entries).
        ageBands: [3],
        demandBands: [3, 5, 8],
        rewardGrid: [[3, 5, 7]],
        recipe: { minBarley: 2, minSpecialty: { barley: 1 } },
        silverAward: { minAge: 5 },
      },
      0,
    ),
    makeMashBill(
      {
        defId: "riverbend_rye_signal",
        name: "Riverbend Rye Signal",
        slogan: "When the rye whistles, drink.",
        flavorText: "Spicy rye-forward bend with a citrus undercurrent.",
        tier: "uncommon",
        complexityTier: 2,
        // 2×2 — rye whistle reads two-by-two: age × hot demand.
        // ≥2 rye, with one rye slot gated to Specialty/Heritage —
        // the uncommon-tier light-pressure signal.
        ageBands: [3, 6],
        demandBands: [3, 7],
        rewardGrid: [
          [3, 5],
          [4, 8],
        ],
        recipe: { minRye: 2, minSpecialty: { rye: 1 } },
        silverAward: { minAge: 5, minDemand: 5 },
      },
      0,
    ),
    makeMashBill(
      {
        defId: "barley_bastion",
        name: "Barley Bastion",
        slogan: "Holding the malt line.",
        flavorText: "Barley-heavy pot still that refuses to be subtle.",
        tier: "uncommon",
        complexityTier: 2,
        // 3×1 — pure aging play, demand-flat. The barley bastion
        // is patience-priced: the market doesn't move it; the
        // calendar does. ≥2 barley.
        ageBands: [2, 4, 6],
        demandBands: [3],
        rewardGrid: [[3], [5], [7]],
        recipe: { minBarley: 2 },
        silverAward: { minAge: 6 },
      },
      0,
    ),
    makeMashBill(
      {
        defId: "knob_creek_cousin",
        name: "Knob Creek Cousin",
        slogan: "Aging gracefully, charging accordingly.",
        flavorText: "Two stories down from the namesake. Same patience, friendlier ask.",
        tier: "uncommon",
        complexityTier: 2,
        // Mixed rye/barley character — broader payoff curve, modest
        // peak at hot demand. ≥1 rye + ≥1 barley = 2 grain total.
        ageBands: [4, 6],
        demandBands: [3, 5, 8],
        rewardGrid: [
          [3, 5, 7],
          [4, 6, 9],
        ],
        recipe: { minRye: 1, minBarley: 1 },
        silverAward: { minAge: 6 },
      },
      0,
    ),
    makeMashBill(
      {
        defId: "two_charring_points",
        name: "Two Charring Points",
        slogan: "Twice toasted, never burnt.",
        flavorText: "Char two on the staves, char three on the heads.",
        tier: "rare",
        complexityTier: 2,
        // Specialty cask is the rare gate (the cooper's hand-picked
        // stave). Age-skewed payoff curve.
        ageBands: [4, 6, 8],
        demandBands: [3, 7],
        rewardGrid: [
          [3, 5],
          [4, 7],
          [6, 9],
        ],
        recipe: { minBarley: 2, minSpecialty: { cask: 1 } },
        silverAward: { minAge: 6 },
      },
      0,
    ),

    // ──────────────── Tier 3 — Specialty bills ────────────────
    // Multi-constraint or sharply skewed demand. Best payouts gated
    // behind age 6+. Spread ~5-8, peak 10-12. Most Gold awards live
    // here.
    makeMashBill(
      {
        defId: "rye_ladder_95",
        name: "Rye Ladder 95",
        slogan: "Climb to the spice.",
        flavorText: "Ninety-five percent rye — pepper, mint, and a long ladder down the throat.",
        tier: "rare",
        complexityTier: 3,
        // 3×2 — climbs hard with age, two clear demand bands. 95%
        // rye is a one-axis-of-character bill. 3 rye + 1 specialty
        // rye gates the Gold pour.
        ageBands: [3, 5, 7],
        demandBands: [3, 7],
        rewardGrid: [
          [3, 6],
          [4, 8],
          [6, 12],
        ],
        recipe: { minRye: 3, minSpecialty: { rye: 1 } },
        silverAward: { minAge: 5, minDemand: 6 },
        goldAward: { minAge: 7, minDemand: 8 },
      },
      0,
    ),
    makeMashBill(
      {
        defId: "coopers_quorum",
        name: "Cooper's Quorum",
        slogan: "Five staves agreed.",
        flavorText: "Built by hand, voted on by committee. The cooperage's house pour.",
        tier: "rare",
        complexityTier: 3,
        // 2×3 — committee-priced, smooth across demand. Three-grain
        // commitment + specialty cask gates the rare pour.
        ageBands: [3, 6],
        demandBands: [3, 5, 8],
        rewardGrid: [
          [3, 5, 7],
          [5, 8, 10],
        ],
        recipe: {
          minRye: 1,
          minBarley: 1,
          minWheat: 1,
          // rare-tier semi-gate: two specialty entries (cask +
          // rye). Sits at the top of the rare gating range; epics
          // step up to a full cask + every-named-grain gate.
          minSpecialty: { cask: 1, rye: 1 },
        },
        silverAward: { minAge: 5 },
        goldAward: { minAge: 7, minDemand: 6 },
      },
      0,
    ),
    makeMashBill(
      {
        defId: "angels_trace",
        name: "Angel's Trace",
        slogan: "What evaporated, signed in.",
        flavorText: "The barrel left a watermark in the air. The bottle preserves what stayed.",
        tier: "rare",
        complexityTier: 3,
        // 2×2 — sparse high-stakes grid. Specialty wheat is the
        // rare ingredient that makes the angel's share worth
        // signing for.
        ageBands: [4, 7],
        demandBands: [4, 8],
        rewardGrid: [
          [4, 7],
          [6, 11],
        ],
        recipe: { minWheat: 1, minBarley: 1, minSpecialty: { wheat: 1 } },
        silverAward: { minAge: 6, minDemand: 6 },
        goldAward: { minAge: 8, minDemand: 6 },
      },
      0,
    ),
    makeMashBill(
      {
        defId: "mash_bill_no_7",
        name: "Mash Bill No. 7",
        slogan: "Lucky number, regular price.",
        flavorText: "Reliable corn-rye-malt at 70/20/10. The seventh recipe, the first standard.",
        tier: "epic",
        complexityTier: 3,
        // Four-grain flagship; rye-leaning so the curve tips toward
        // high demand. Epic-tier specialty gate: 1 specialty rye.
        ageBands: [3, 5, 7],
        demandBands: [3, 5, 8],
        rewardGrid: [
          [2, 4, 6],
          [3, 6, 9],
          [4, 8, 11],
        ],
        recipe: {
          minBarley: 1,
          minRye: 1,
          minWheat: 1,
          // epic full gate: cask + every named-grain subtype
          // (rye, barley, wheat) all demand Specialty or Heritage.
          minSpecialty: { cask: 1, rye: 1, barley: 1, wheat: 1 },
        },
        silverAward: { minAge: 5 },
        goldAward: { minAge: 7, minDemand: 8 },
      },
      0,
    ),
    makeMashBill(
      {
        defId: "bonded_and_bold",
        name: "Bonded & Bold",
        slogan: "Four years, one distillery, one season.",
        flavorText: "Bottled-in-bond standard with a heavier proof.",
        tier: "epic",
        complexityTier: 3,
        // 3×2 — bonded character is about age, not demand swings.
        // Pairs with Mash Bill No. 7 (3×3) so the two epics read
        // as distinct shapes at a glance. Specialty rye gates the
        // Gold pour.
        ageBands: [4, 6, 8],
        demandBands: [4, 8],
        rewardGrid: [
          [4, 7],
          [5, 9],
          [6, 12],
        ],
        // epic full gate: cask + every named-grain subtype
        // (rye + barley) all gated to Specialty or Heritage.
        recipe: {
          minBarley: 1,
          minRye: 1,
          minSpecialty: { cask: 1, rye: 1, barley: 1 },
        },
        silverAward: { minAge: 6 },
        goldAward: { minAge: 8, minDemand: 8 },
      },
      0,
    ),
    makeMashBill(
      {
        defId: "wheated_estate",
        name: "Wheated Estate",
        slogan: "Soft on the palate, sharp at the till.",
        flavorText: "An estate-only wheated reserve. Demand a real summer to peak.",
        tier: "epic",
        complexityTier: 3,
        // The estate wheat (specialty) is the price of admission.
        ageBands: [4, 6, 8],
        demandBands: [4, 7, 10],
        rewardGrid: [
          [3, 5, 8],
          [4, 7, 10],
          [5, 8, 12],
        ],
        recipe: {
          minWheat: 2,
          maxRye: 0,
          // epic full gate: cask + the wheat subtype (the only
          // named grain) gated. Wheated Baron's -1 wheat discount
          // still applies to the second (plain) wheat slot.
          minSpecialty: { cask: 1, wheat: 1 },
        },
        silverAward: { minAge: 6, minDemand: 7 },
        goldAward: { minAge: 8, minDemand: 7 },
      },
      0,
    ),
    makeMashBill(
      {
        defId: "high_rickhouse_select",
        name: "High Rickhouse Select",
        slogan: "Top of the rack, top of the bill.",
        flavorText: "Pulled from the seventh story. Hotter summers, faster aging, premium ask.",
        tier: "legendary",
        complexityTier: 3,
        // Flagship four-grain; the catalog's tallest peak. Two
        // specialty grains (rye + wheat) — the legendary gate.
        ageBands: [3, 5, 7, 9],
        demandBands: [3, 5, 8, 11],
        rewardGrid: [
          [1, 2, 3, 5],
          [2, 4, 6, 8],
          [4, 6, 9, 11],
          [6, 9, 11, 12],
        ],
        recipe: {
          minRye: 1,
          minBarley: 1,
          minWheat: 1,
          minTotalGrain: 4,
          // legendary: broader than any epic — gates every
          // subtype (cask + corn + every named grain) AND tightens
          // the rye cap to 2 (the wildcard grain slot becomes the
          // second specialty rye). Five entries, six specialty units
          // total.
          minSpecialty: {
            cask: 1,
            corn: 1,
            rye: 2,
            barley: 1,
            wheat: 1,
          },
        },
        silverAward: { minAge: 7, minDemand: 8 },
        goldAward: { minAge: 8, minDemand: 8, minReward: 9 },
      },
      0,
    ),
  ] as MashBill[]).filter((b) => !b.tutorialOnly);
}

// ============================================================
// Default market supply — Unified Rep economy.
//
// Resources sit in three pricing bands, every card 1 unit. Costs are
// paid in reputation (the unified currency) — Labor cards from hand
// can supplement rep on each buy.
//
//   Common ($1)     1 unit, basic, no effect          (Labor-buyable)
//   Specialty ($2)  1 unit, satisfies minSpecialty    (≥1 rep required)
//   Heritage ($3)   1 unit, satisfies minSpecialty,   (≥1 rep required)
//                   per-card bonus hook (empty)
//
// Plus a Labor strip on the supply:
//
//   Marketing       ($4, 1 copy)      +2 toward ops card buys
//   Cooper          ($4, 1 copy)      +2 toward market resource buys
//   Architect       ($4, 1 copy)      +2 toward investment buys
//
// Generic Labor is NOT for sale — players start with 2 in their
// starter deck and that's all the Generic Labor they'll ever own.
// The unified market supply also wraps every ops card + every
// investment card into Card-shaped entries (see
// `wrapOperationsForMarket` / `wrapInvestmentForMarket`).
// ============================================================

interface BandCardSpec {
  defId: string;
  displayName: string;
  flavor: string;
  subtype: "cask" | "corn" | "rye" | "barley" | "wheat";
  copies: number;
}

const SPECIALTY_SPECS: BandCardSpec[] = [
  { defId: "superior_cask", displayName: "Superior Cask", flavor: "Hand-picked stave, certified char.", subtype: "cask", copies: 4 },
  { defId: "superior_corn", displayName: "Superior Corn", flavor: "Heirloom kernels, single-farm.", subtype: "corn", copies: 4 },
  { defId: "superior_rye", displayName: "Superior Rye", flavor: "Reserve cut, sharper edge.", subtype: "rye", copies: 4 },
  { defId: "superior_barley", displayName: "Superior Barley", flavor: "Floor-malted, water-blessed.", subtype: "barley", copies: 4 },
  { defId: "superior_wheat", displayName: "Superior Wheat", flavor: "Estate harvest, soft as silk.", subtype: "wheat", copies: 4 },
];

const HERITAGE_SPECS: BandCardSpec[] = [
  { defId: "heritage_cask", displayName: "Heritage Cask", flavor: "Cooper's reserve stave, decades seasoned.", subtype: "cask", copies: 2 },
  { defId: "heritage_corn", displayName: "Heritage Corn", flavor: "Pre-prohibition kernel, hand-saved.", subtype: "corn", copies: 2 },
  { defId: "heritage_rye", displayName: "Heritage Rye", flavor: "The headline rye, top of the bill.", subtype: "rye", copies: 2 },
  { defId: "heritage_barley", displayName: "Heritage Barley", flavor: "Heirloom strain, floor-malted by name.", subtype: "barley", copies: 2 },
  { defId: "heritage_wheat", displayName: "Heritage Wheat", flavor: "Estate wheat, hand-threshed.", subtype: "wheat", copies: 2 },
];

export function defaultMarketSupply(): Card[] {
  const cards: Card[] = [];
  let idx = 0;

  // ── Common ($1, 1 unit) — basic 5 subtypes ─────────────────────
  // v3.3: bumped from 5 → 7 copies per subtype so commons land at
  // ~54% of the resource pool (per user-set 50% target). Pairs with
  // bumped Specialty (×4) + Heritage (×2) for 65/20/15 across
  // {resources, ops, investments} on a market draw.
  for (let i = 0; i < 7; i++) cards.push(makeResourceCard("cask", "supply", idx++));
  for (let i = 0; i < 7; i++) cards.push(makeResourceCard("corn", "supply", idx++));
  for (let i = 0; i < 7; i++) cards.push(makeResourceCard("rye", "supply", idx++));
  for (let i = 0; i < 7; i++) cards.push(makeResourceCard("barley", "supply", idx++));
  for (let i = 0; i < 7; i++) cards.push(makeResourceCard("wheat", "supply", idx++));

  // ── Specialty ($2, 1 unit) — luxury upgrades that satisfy
  //   `minSpecialty.<subtype>` gates. No uniform on-sale bonus — the
  //   v2.10 band-wide +1 rep is retired.
  for (const spec of SPECIALTY_SPECS) {
    for (let i = 0; i < spec.copies; i++) {
      cards.push(
        makePremiumResource({
          defId: spec.defId,
          displayName: spec.displayName,
          flavor: spec.flavor,
          subtype: spec.subtype,
          resourceCount: 1,
          cost: 2,
          specialty: true,
          index: idx++,
        }),
      );
    }
  }

  // ── Heritage ($3, 1 unit) — flagship variants. Same
  //   `specialty: true` flag (count toward `minSpecialty`). Each
  //   Heritage card is the future home for a per-card on-sale bonus
  //   (the `effect` field is the hook); none of them ship with a
  //   populated bonus yet — they currently differ from Specialty only
  //   in price.
  for (const spec of HERITAGE_SPECS) {
    for (let i = 0; i < spec.copies; i++) {
      cards.push(
        makePremiumResource({
          defId: spec.defId,
          displayName: spec.displayName,
          flavor: spec.flavor,
          subtype: spec.subtype,
          resourceCount: 1,
          cost: 3,
          specialty: true,
          index: idx++,
        }),
      );
    }
  }

  // ── Labor ─────────────────────────────────────────────────────
  // Generic Labor is finite per player (2 in the starter deck, no
  // central pile). Specialty Labor is the only way new Labor enters
  // a deck after setup — rare drops in the unified market.
  //
  //   Marketing       ($4, 1 copy)  +2 toward ops card buys.
  //   Cooper          ($4, 1 copy)  +2 toward market resource buys.
  //   Architect       ($4, 1 copy)  +2 toward investment buys.
  cards.push(
    makeLaborCard({ subtype: "marketing", ownerLabel: "supply", index: idx++ }),
  );
  cards.push(
    makeLaborCard({ subtype: "cooper", ownerLabel: "supply", index: idx++ }),
  );
  cards.push(
    makeLaborCard({ subtype: "architect", ownerLabel: "supply", index: idx++ }),
  );

  // ── Operations cards ──────────────────────────────────────────
  // Wrap every op-card spec from the operations catalog as a
  // unified-market entry. When the player buys one, the engine
  // copies the spec into their operationsHand.
  for (const op of defaultOperationsDeck()) {
    cards.push(wrapOperationsForMarket(op, idx++));
  }

  // ── Investments ───────────────────────────────────────────────
  // The 8-card investment catalog ships as effect-pending stubs
  // (every card has `implemented: false`). Cards enter the unified
  // market and are buyable — the purchase removes the card and
  // charges the cost, but no effect fires yet.
  for (const inv of defaultInvestmentCatalog()) {
    cards.push(wrapInvestmentForMarket(inv, idx++));
  }

  return cards;
}
