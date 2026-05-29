import type { Draft } from "immer";
import type {
  Bottle,
  BrandRestriction,
  Card,
  DistilleryBonus,
  GameState,
  MasteryCondition,
  Portfolio,
  PortfolioSlotDef,
  PortfolioSlotRequirement,
  PortfolioSlotReward,
  PortfolioState,
  TierDef,
  PlayerState,
} from "../types";
import { drawWithReshuffle } from "../deck";

// ═══════════════════════════════════════════════════════════════════
// v3.2 Brand Portfolios — catalog
// ═══════════════════════════════════════════════════════════════════
//
// One canonical flagship (Wheated Baron's "Baron's Lineup," matching
// the spec's illustrative table) plus placeholder flagships for the
// other three distilleries that preserve the spec's thematic anchors
// (Brand Restriction + Mastery Condition direction). The v3.2 spec
// explicitly defers their detailed slot design to a follow-on pass;
// the rulebook is authoritative for identity, this catalog is the
// "engine ships placeholder slot definitions so games complete"
// minimum noted in GAME_RULES.md.
//
// Secondary pool portfolios at the bottom of the file — six base-game
// designs spanning a range of identities and slot counts.

// ─── Restriction helpers ─────────────────────────────────────────

const noRestriction: BrandRestriction | null = null;

const restrictWheated: BrandRestriction = {
  label: "wheated bottles",
  check: ({ bottle }) => bottle.recipeTags.includes("wheated"),
};

const restrictRyeHeavy: BrandRestriction = {
  label: "rye-heavy bottles",
  check: ({ bottle }) =>
    bottle.primaryRecipeTag === "high-rye" || bottle.primaryRecipeTag === "rye",
};

const restrictUniquePrimaryTag: BrandRestriction = {
  label: "no two bottles share their primary recipe tag",
  check: ({ bottle, portfolio }) => {
    const seen = portfolio.slots
      .filter((s) => s.filled && s.bottle)
      .map((s) => s.bottle!.primaryRecipeTag);
    return !seen.includes(bottle.primaryRecipeTag);
  },
};

// ─── Mastery condition helpers ───────────────────────────────────

const masteryWheatedNoRyeAged4: MasteryCondition = {
  label: "wheated AND no rye in recipe AND aged 4+",
  check: ({ bottle }) =>
    bottle.recipeTags.includes("wheated") &&
    !bottle.recipeTags.includes("rye") &&
    bottle.ageAtSale >= 4,
};

const masteryRyeNoBarley: MasteryCondition = {
  label: "rye-heavy AND no barley in recipe",
  check: ({ bottle }) =>
    (bottle.primaryRecipeTag === "rye" ||
      bottle.primaryRecipeTag === "high-rye") &&
    !bottle.recipeTags.includes("barley"),
};

const masteryAllPrimaryAndCaskUnique: MasteryCondition = {
  label: "every filled slot has a unique primary grain tag AND a unique cask rarity",
  check: ({ bottle, portfolio }) => {
    const grains = portfolio.slots
      .filter((s) => s.filled && s.bottle)
      .map((s) => s.bottle!.primaryRecipeTag);
    const casks = portfolio.slots
      .filter((s) => s.filled && s.bottle)
      .map((s) => s.bottle!.caskTag);
    return !grains.includes(bottle.primaryRecipeTag) && !casks.includes(bottle.caskTag);
  },
};

// Vanilla's Mastery references "every slot in your second portfolio is
// also filled" — but that requires cross-portfolio context the slot-
// requirement signature doesn't carry. The check here approximates it:
// every filled flagship slot is "anything" (the condition is always
// true when evaluated per-bottle). The end-game cross-portfolio check
// will be a separate scoring rule layered on top in a future pass.
const masteryVanillaAlwaysTrue: MasteryCondition = {
  label: "every filled slot in your second portfolio is also filled (deferred)",
  check: () => true,
};

// ─── Requirement helpers ─────────────────────────────────────────

const anyBottle: PortfolioSlotRequirement = {
  label: "any bottle",
  check: () => true,
};

function ageGte(n: number): PortfolioSlotRequirement {
  return {
    label: `aged ${n}+ years`,
    check: ({ bottle }) => bottle.ageAtSale >= n,
  };
}

function cornGte(n: number): PortfolioSlotRequirement {
  return {
    label: `corn ${n}+`,
    check: ({ bottle }) => bottle.cornCount >= n,
  };
}

function demandAtSaleGte(n: number): PortfolioSlotRequirement {
  return {
    label: `sold at demand ${n}+`,
    check: ({ bottle }) => bottle.demandAtSale >= n,
  };
}

function and(label: string, parts: PortfolioSlotRequirement[]): PortfolioSlotRequirement {
  return {
    label,
    check: (args) => parts.every((p) => p.check(args)),
  };
}

const wheated: PortfolioSlotRequirement = {
  label: "wheated bottle",
  check: ({ bottle }) => bottle.recipeTags.includes("wheated"),
};

const heritageCask: PortfolioSlotRequirement = {
  label: "Heritage cask",
  check: ({ bottle }) => bottle.caskTag === "heritage-cask",
};

const ryeHeavy: PortfolioSlotRequirement = {
  label: "rye-heavy bottle",
  check: ({ bottle }) =>
    bottle.primaryRecipeTag === "high-rye" || bottle.primaryRecipeTag === "rye",
};

// ─── Reward helpers ──────────────────────────────────────────────

function drawCards(n: number): PortfolioSlotReward {
  return {
    label: `draw ${n} card${n === 1 ? "" : "s"}`,
    fire: ({ draft, player }) => {
      drawIntoHand(draft, player, n);
    },
  };
}

function bumpDemand(n: number): PortfolioSlotReward {
  return {
    label: `+${n} demand on next sale`,
    fire: ({ draft }) => {
      draft.demand = Math.max(0, Math.min(12, draft.demand + n));
    },
  };
}

function givePrestige(n: number): PortfolioSlotReward {
  return {
    label: `+${n} prestige`,
    fire: ({ player }) => {
      player.prestige += n;
    },
  };
}

function gainGenericLabor(): PortfolioSlotReward {
  // Generic Labor is finite in v3.1+: there is no central pile. As a
  // proxy for "gain 1 worker," mint a one-shot Generic Labor card
  // directly into the player's hand. This is intentionally a slight
  // power bump over the spec; the v3.2 design pass will likely
  // formalize a worker reservoir.
  return {
    label: "gain 1 worker",
    fire: ({ draft, player }) => {
      const id = `gen_labor_${draft.idCounter++}`;
      player.hand.push({
        id,
        cardDefId: "generic_labor",
        type: "labor",
        laborSubtype: "generic",
        laborContribution: 1,
      } as Card);
    },
  };
}

const persistentDemandNeverDrops: PortfolioSlotReward = {
  label: "persistent: demand never drops on your sales",
  fire: ({ player }) => {
    player.commonSalesIgnoreDemandDrop = true;
  },
};

const persistentNextSaleDemandBump: PortfolioSlotReward = {
  label: "persistent: next sale +2 demand at sale",
  fire: ({ draft }) => {
    // Approximation — bump demand now, persistent flag wiring lands
    // alongside the proper "next sale" demand modifier.
    draft.demand = Math.min(12, draft.demand + 2);
  },
};

function gainFreeMarketCard(): PortfolioSlotReward {
  return {
    label: "gain 1 market card free",
    fire: ({ draft, player }) => {
      // Same shape as High-Rye's market scavenge: pull the first
      // Specialty or any card from the market into hand, refill.
      if (draft.market.length === 0) return;
      const [taken] = draft.market.splice(0, 1);
      if (!taken) return;
      player.hand.push(taken);
      if (
        draft.marketSupplyDeck.length === 0 &&
        draft.marketDiscard.length > 0
      ) {
        const reshuffled = drawWithReshuffle(
          draft.marketSupplyDeck.slice(),
          draft.marketDiscard.slice(),
          0,
          draft.rngState,
        );
        draft.marketSupplyDeck = reshuffled.deck;
        draft.marketDiscard = reshuffled.discard;
        draft.rngState = reshuffled.rngState;
      }
      const refill = draft.marketSupplyDeck.pop();
      if (refill) draft.market.splice(0, 0, refill);
    },
  };
}

function compound(label: string, parts: PortfolioSlotReward[]): PortfolioSlotReward {
  return {
    label,
    fire: (args) => {
      for (const r of parts) r.fire(args);
    },
  };
}

// ─── Slot factory ────────────────────────────────────────────────

function slot(args: {
  index: number;
  name: string;
  required: boolean;
  tierIndex: number;
  requirement: PortfolioSlotRequirement;
  signatureBillDefId: string | null;
  onFillReward: PortfolioSlotReward;
  signatureBonus: PortfolioSlotReward | null;
  endGameValue: number;
}): PortfolioSlotDef {
  return args;
}

// ─── Catalog ─────────────────────────────────────────────────────

const PORTFOLIOS: Portfolio[] = [
  // ═══ Wheated Baron — "The Baron's Lineup" (canonical) ═══════════
  // Matches the v3.2 spec's illustrative table verbatim. Signature
  // bill defIds are placeholders ("baron_select", "baron_cs", etc.)
  // until the bourbon-deck side of the signature integration lands
  // — for now no bill in the default deck has these defIds, so the
  // signature bonus path is reachable only via tests / future bills.
  {
    id: "pf_barons_lineup",
    name: "The Baron's Lineup",
    flavorText: "Soft front, gentle finish, the pour she pours.",
    distilleryBonus: "wheated_baron",
    brandRestriction: restrictWheated,
    masteryCondition: masteryWheatedNoRyeAged4,
    slots: [
      slot({
        index: 0,
        name: "Baron's Select",
        required: true,
        tierIndex: 0,
        requirement: and("wheated, age 2+", [wheated, ageGte(2)]),
        signatureBillDefId: "baron_select",
        onFillReward: bumpDemand(1),
        signatureBonus: drawCards(1),
        endGameValue: 2,
      }),
      slot({
        index: 1,
        name: "Baron's Reserve",
        required: false, // optional / dotted
        tierIndex: 0,
        requirement: and("wheated, age 3+, corn 3+", [wheated, ageGte(3), cornGte(3)]),
        signatureBillDefId: null,
        onFillReward: drawCards(2),
        signatureBonus: null,
        endGameValue: 3,
      }),
      slot({
        index: 2,
        name: "Baron's Cask Strength",
        required: true,
        tierIndex: 1,
        requirement: and("wheated, age 4+, corn 4+", [wheated, ageGte(4), cornGte(4)]),
        signatureBillDefId: "baron_cs",
        onFillReward: compound("gain 1 worker, +1 prestige", [
          gainGenericLabor(),
          givePrestige(1),
        ]),
        signatureBonus: givePrestige(1),
        endGameValue: 5,
      }),
      slot({
        index: 3,
        name: "Baron's Heritage",
        required: true,
        tierIndex: 2,
        requirement: and("wheated, Heritage cask, age 5+", [wheated, heritageCask, ageGte(5)]),
        signatureBillDefId: "baron_heritage",
        onFillReward: compound("+2 prestige; persistent: next sale +2 demand", [
          givePrestige(2),
          persistentNextSaleDemandBump,
        ]),
        signatureBonus: gainFreeMarketCard(),
        endGameValue: 7,
      }),
      slot({
        index: 4,
        name: "Baron's Vintage Reserve",
        required: true,
        tierIndex: 2,
        requirement: and("wheated, Heritage cask, age 7+, corn 5+", [
          wheated,
          heritageCask,
          ageGte(7),
          cornGte(5),
        ]),
        signatureBillDefId: "baron_vintage",
        onFillReward: persistentDemandNeverDrops,
        signatureBonus: compound("+3 prestige, draw 3 cards", [
          givePrestige(3),
          drawCards(3),
        ]),
        endGameValue: 10,
      }),
    ],
    tiers: [
      { index: 0, slotIndices: [0, 1] },
      { index: 1, slotIndices: [2] },
      { index: 2, slotIndices: [3, 4] },
    ],
    completionBonus: 8,
    themeBonus: 6,
    masteryBonus: 10,
  },

  // ═══ High-Rye House — "The House Lineup" (placeholder) ══════════
  // 3-slot placeholder until the design pass authors the full table.
  // Preserves the spec's brand-restriction and mastery direction.
  {
    id: "pf_house_lineup",
    name: "The House Lineup",
    flavorText: "Pepper, baking spice, the long dry finish.",
    distilleryBonus: "high_rye_house",
    brandRestriction: restrictRyeHeavy,
    masteryCondition: masteryRyeNoBarley,
    slots: [
      slot({
        index: 0,
        name: "House Original",
        required: true,
        tierIndex: 0,
        requirement: ryeHeavy,
        signatureBillDefId: null,
        onFillReward: drawCards(1),
        signatureBonus: null,
        endGameValue: 2,
      }),
      slot({
        index: 1,
        name: "House Reserve",
        required: true,
        tierIndex: 1,
        requirement: and("rye-heavy, age 4+", [ryeHeavy, ageGte(4)]),
        signatureBillDefId: null,
        onFillReward: givePrestige(1),
        signatureBonus: null,
        endGameValue: 4,
      }),
      slot({
        index: 2,
        name: "House Master's Cut",
        required: true,
        tierIndex: 2,
        requirement: and("rye-heavy, age 7+, corn 4+", [ryeHeavy, ageGte(7), cornGte(4)]),
        signatureBillDefId: null,
        onFillReward: compound("draw 3 cards, +2 prestige", [drawCards(3), givePrestige(2)]),
        signatureBonus: null,
        endGameValue: 8,
      }),
    ],
    tiers: [
      { index: 0, slotIndices: [0] },
      { index: 1, slotIndices: [1] },
      { index: 2, slotIndices: [2] },
    ],
    completionBonus: 8,
    themeBonus: 6,
    masteryBonus: 10,
  },

  // ═══ Connoisseur Estate — "Estate Collection" (placeholder) ════
  // 4-slot placeholder. Brand Restriction: no-repeat-primary-tag.
  // Mastery: every filled slot has a unique cask rarity AND a unique
  // primary grain tag.
  {
    id: "pf_estate_collection",
    name: "The Estate Collection",
    flavorText: "Four bills, four buyers, four brick lines.",
    distilleryBonus: "connoisseur_estate",
    brandRestriction: restrictUniquePrimaryTag,
    masteryCondition: masteryAllPrimaryAndCaskUnique,
    slots: [
      slot({
        index: 0,
        name: "Estate Foundation",
        required: true,
        tierIndex: 0,
        requirement: anyBottle,
        signatureBillDefId: null,
        onFillReward: drawCards(1),
        signatureBonus: null,
        endGameValue: 2,
      }),
      slot({
        index: 1,
        name: "Estate Heritage Series",
        required: true,
        tierIndex: 1,
        requirement: heritageCask,
        signatureBillDefId: null,
        onFillReward: drawCards(1),
        signatureBonus: null,
        endGameValue: 5,
      }),
      slot({
        index: 2,
        name: "Estate Master Blend",
        required: false,
        tierIndex: 1,
        requirement: ageGte(5),
        signatureBillDefId: null,
        onFillReward: givePrestige(2),
        signatureBonus: null,
        endGameValue: 6,
      }),
      slot({
        index: 3,
        name: "Estate Curator's Choice",
        required: true,
        tierIndex: 2,
        requirement: and("aged 6+, demand 5+", [ageGte(6), demandAtSaleGte(5)]),
        signatureBillDefId: null,
        onFillReward: compound("+3 prestige, draw 2", [givePrestige(3), drawCards(2)]),
        signatureBonus: null,
        endGameValue: 9,
      }),
    ],
    tiers: [
      { index: 0, slotIndices: [0] },
      { index: 1, slotIndices: [1, 2] },
      { index: 2, slotIndices: [3] },
    ],
    completionBonus: 10,
    themeBonus: 8,
    masteryBonus: 12,
  },

  // ═══ Vanilla Distillery — "Standard Reserve" (placeholder) ═════
  // No Brand Restriction. Mastery defers to a cross-portfolio rule
  // (see masteryVanillaAlwaysTrue note). 4-slot placeholder.
  {
    id: "pf_vanilla_standard",
    name: "Standard Reserve",
    flavorText: "Every label, every shelf. The house pour.",
    distilleryBonus: "vanilla",
    brandRestriction: noRestriction,
    masteryCondition: masteryVanillaAlwaysTrue,
    slots: [
      slot({
        index: 0,
        name: "Standard",
        required: true,
        tierIndex: 0,
        requirement: anyBottle,
        signatureBillDefId: null,
        onFillReward: drawCards(1),
        signatureBonus: null,
        endGameValue: 2,
      }),
      slot({
        index: 1,
        name: "Standard Reserve",
        required: false,
        tierIndex: 0,
        requirement: ageGte(3),
        signatureBillDefId: null,
        onFillReward: drawCards(1),
        signatureBonus: null,
        endGameValue: 3,
      }),
      slot({
        index: 2,
        name: "Standard Premium",
        required: true,
        tierIndex: 1,
        requirement: ageGte(5),
        signatureBillDefId: null,
        onFillReward: givePrestige(1),
        signatureBonus: null,
        endGameValue: 4,
      }),
      slot({
        index: 3,
        name: "Standard Master",
        required: true,
        tierIndex: 2,
        requirement: and("Heritage cask, age 7+", [heritageCask, ageGte(7)]),
        signatureBillDefId: null,
        onFillReward: compound("+2 prestige, draw 2", [givePrestige(2), drawCards(2)]),
        signatureBonus: null,
        endGameValue: 7,
      }),
    ],
    tiers: [
      { index: 0, slotIndices: [0, 1] },
      { index: 1, slotIndices: [2] },
      { index: 2, slotIndices: [3] },
    ],
    completionBonus: 8,
    themeBonus: 0,
    masteryBonus: 10,
  },

  // ═══ Secondary pool — Single-Origin Series ════════════════════
  {
    id: "pf_single_origin",
    name: "Single-Origin Series",
    flavorText: "One grain, one story.",
    distilleryBonus: null,
    brandRestriction: {
      label: "single-grain bottles only",
      check: ({ bottle }) => bottle.recipeTags.includes("single-grain"),
    },
    masteryCondition: {
      label: "single-grain AND aged 5+",
      check: ({ bottle }) =>
        bottle.recipeTags.includes("single-grain") && bottle.ageAtSale >= 5,
    },
    slots: [
      slot({
        index: 0,
        name: "Origin Foundation",
        required: true,
        tierIndex: 0,
        requirement: {
          label: "single-grain",
          check: ({ bottle }) => bottle.recipeTags.includes("single-grain"),
        },
        signatureBillDefId: null,
        onFillReward: drawCards(1),
        signatureBonus: null,
        endGameValue: 3,
      }),
      slot({
        index: 1,
        name: "Origin Reserve",
        required: true,
        tierIndex: 1,
        requirement: ageGte(4),
        signatureBillDefId: null,
        onFillReward: givePrestige(1),
        signatureBonus: null,
        endGameValue: 5,
      }),
      slot({
        index: 2,
        name: "Origin Master",
        required: true,
        tierIndex: 2,
        requirement: ageGte(7),
        signatureBillDefId: null,
        onFillReward: drawCards(2),
        signatureBonus: null,
        endGameValue: 8,
      }),
    ],
    tiers: [
      { index: 0, slotIndices: [0] },
      { index: 1, slotIndices: [1] },
      { index: 2, slotIndices: [2] },
    ],
    completionBonus: 8,
    themeBonus: 6,
    masteryBonus: 10,
  },

  // ═══ Secondary pool — Counter-Cyclical ════════════════════════
  {
    id: "pf_counter_cyclical",
    name: "Counter-Cyclical",
    flavorText: "Sold when nobody else is buying.",
    distilleryBonus: null,
    brandRestriction: {
      label: "sold at demand ≤ 4",
      check: ({ bottle }) => bottle.demandAtSale <= 4,
    },
    masteryCondition: {
      label: "every filled slot sold at demand ≤ 2",
      check: ({ bottle }) => bottle.demandAtSale <= 2,
    },
    slots: [
      slot({
        index: 0,
        name: "Working Class",
        required: true,
        tierIndex: 0,
        requirement: anyBottle,
        signatureBillDefId: null,
        onFillReward: drawCards(1),
        signatureBonus: null,
        endGameValue: 2,
      }),
      slot({
        index: 1,
        name: "Hidden Gem",
        required: true,
        tierIndex: 1,
        requirement: ageGte(3),
        signatureBillDefId: null,
        onFillReward: givePrestige(1),
        signatureBonus: null,
        endGameValue: 4,
      }),
      slot({
        index: 2,
        name: "The Quiet Legend",
        required: true,
        tierIndex: 2,
        requirement: ageGte(5),
        signatureBillDefId: null,
        onFillReward: drawCards(2),
        signatureBonus: null,
        endGameValue: 7,
      }),
    ],
    tiers: [
      { index: 0, slotIndices: [0] },
      { index: 1, slotIndices: [1] },
      { index: 2, slotIndices: [2] },
    ],
    completionBonus: 8,
    themeBonus: 7,
    masteryBonus: 12,
  },

  // ═══ Secondary pool — Heritage Collection ═════════════════════
  {
    id: "pf_heritage_collection",
    name: "Heritage Collection",
    flavorText: "Cooperage as art form.",
    distilleryBonus: null,
    brandRestriction: {
      label: "Heritage cask bottles",
      check: ({ bottle }) => bottle.caskTag === "heritage-cask",
    },
    masteryCondition: {
      label: "Heritage cask AND aged 6+",
      check: ({ bottle }) => bottle.caskTag === "heritage-cask" && bottle.ageAtSale >= 6,
    },
    slots: [
      slot({
        index: 0,
        name: "Heritage Foundation",
        required: true,
        tierIndex: 0,
        requirement: heritageCask,
        signatureBillDefId: null,
        onFillReward: drawCards(1),
        signatureBonus: null,
        endGameValue: 3,
      }),
      slot({
        index: 1,
        name: "Heritage Reserve",
        required: true,
        tierIndex: 1,
        requirement: ageGte(5),
        signatureBillDefId: null,
        onFillReward: givePrestige(1),
        signatureBonus: null,
        endGameValue: 5,
      }),
      slot({
        index: 2,
        name: "Heritage Master's Reserve",
        required: false,
        tierIndex: 1,
        requirement: ageGte(6),
        signatureBillDefId: null,
        onFillReward: drawCards(1),
        signatureBonus: null,
        endGameValue: 4,
      }),
      slot({
        index: 3,
        name: "Heritage Legacy",
        required: true,
        tierIndex: 2,
        requirement: ageGte(8),
        signatureBillDefId: null,
        onFillReward: compound("+2 prestige, draw 2", [givePrestige(2), drawCards(2)]),
        signatureBonus: null,
        endGameValue: 8,
      }),
    ],
    tiers: [
      { index: 0, slotIndices: [0] },
      { index: 1, slotIndices: [1, 2] },
      { index: 2, slotIndices: [3] },
    ],
    completionBonus: 9,
    themeBonus: 7,
    masteryBonus: 12,
  },

  // ═══ Secondary pool — Volume Brand ════════════════════════════
  {
    id: "pf_volume_brand",
    name: "Volume Brand",
    flavorText: "On every shelf in every state.",
    distilleryBonus: null,
    brandRestriction: {
      label: "any bottle qualifies",
      check: () => true,
    },
    masteryCondition: {
      label: "every filled slot is Common bill rarity",
      check: ({ bottle }) => bottle.rarity === "common",
    },
    slots: [
      slot({
        index: 0,
        name: "Daily Sipper",
        required: true,
        tierIndex: 0,
        requirement: anyBottle,
        signatureBillDefId: null,
        onFillReward: drawCards(1),
        signatureBonus: null,
        endGameValue: 1,
      }),
      slot({
        index: 1,
        name: "House Standard",
        required: true,
        tierIndex: 0,
        requirement: anyBottle,
        signatureBillDefId: null,
        onFillReward: drawCards(1),
        signatureBonus: null,
        endGameValue: 2,
      }),
      slot({
        index: 2,
        name: "Bartender's Pick",
        required: true,
        tierIndex: 1,
        requirement: ageGte(3),
        signatureBillDefId: null,
        onFillReward: drawCards(1),
        signatureBonus: null,
        endGameValue: 3,
      }),
      slot({
        index: 3,
        name: "Crowd Favorite",
        required: false,
        tierIndex: 1,
        requirement: demandAtSaleGte(4),
        signatureBillDefId: null,
        onFillReward: bumpDemand(1),
        signatureBonus: null,
        endGameValue: 3,
      }),
      slot({
        index: 4,
        name: "America's Bourbon",
        required: true,
        tierIndex: 2,
        requirement: and("aged 4+, demand 5+", [ageGte(4), demandAtSaleGte(5)]),
        signatureBillDefId: null,
        onFillReward: drawCards(2),
        signatureBonus: null,
        endGameValue: 5,
      }),
    ],
    tiers: [
      { index: 0, slotIndices: [0, 1] },
      { index: 1, slotIndices: [2, 3] },
      { index: 2, slotIndices: [4] },
    ],
    completionBonus: 7,
    themeBonus: 4,
    masteryBonus: 12,
  },

  // ═══ Secondary pool — Boutique Limited Release ═══════════════
  {
    id: "pf_boutique_limited",
    name: "Boutique Limited Release",
    flavorText: "Three barrels a year. Reserved at allocation.",
    distilleryBonus: null,
    brandRestriction: {
      label: "Rare+ bill rarity",
      check: ({ bottle }) =>
        bottle.rarity === "rare" ||
        bottle.rarity === "epic" ||
        bottle.rarity === "legendary",
    },
    masteryCondition: {
      label: "Epic+ bill rarity AND aged 6+",
      check: ({ bottle }) =>
        (bottle.rarity === "epic" || bottle.rarity === "legendary") &&
        bottle.ageAtSale >= 6,
    },
    slots: [
      slot({
        index: 0,
        name: "Boutique Inaugural",
        required: true,
        tierIndex: 0,
        requirement: ageGte(4),
        signatureBillDefId: null,
        onFillReward: givePrestige(1),
        signatureBonus: null,
        endGameValue: 4,
      }),
      slot({
        index: 1,
        name: "Boutique Master Reserve",
        required: true,
        tierIndex: 1,
        requirement: ageGte(6),
        signatureBillDefId: null,
        onFillReward: compound("+2 prestige, draw 1", [givePrestige(2), drawCards(1)]),
        signatureBonus: null,
        endGameValue: 7,
      }),
      slot({
        index: 2,
        name: "Boutique Curator's Pick",
        required: true,
        tierIndex: 2,
        requirement: ageGte(8),
        signatureBillDefId: null,
        onFillReward: compound("+3 prestige, draw 2", [givePrestige(3), drawCards(2)]),
        signatureBonus: null,
        endGameValue: 10,
      }),
    ],
    tiers: [
      { index: 0, slotIndices: [0] },
      { index: 1, slotIndices: [1] },
      { index: 2, slotIndices: [2] },
    ],
    completionBonus: 10,
    themeBonus: 8,
    masteryBonus: 14,
  },

  // ═══ Secondary pool — Aged Statement ══════════════════════════
  {
    id: "pf_aged_statement",
    name: "Aged Statement",
    flavorText: "The longer the better.",
    distilleryBonus: null,
    brandRestriction: {
      label: "aged 5+",
      check: ({ bottle }) => bottle.ageAtSale >= 5,
    },
    masteryCondition: {
      label: "every filled slot aged 8+",
      check: ({ bottle }) => bottle.ageAtSale >= 8,
    },
    slots: [
      slot({
        index: 0,
        name: "5-Year Statement",
        required: true,
        tierIndex: 0,
        requirement: ageGte(5),
        signatureBillDefId: null,
        onFillReward: drawCards(1),
        signatureBonus: null,
        endGameValue: 3,
      }),
      slot({
        index: 1,
        name: "7-Year Statement",
        required: true,
        tierIndex: 1,
        requirement: ageGte(7),
        signatureBillDefId: null,
        onFillReward: givePrestige(1),
        signatureBonus: null,
        endGameValue: 5,
      }),
      slot({
        index: 2,
        name: "10-Year Statement",
        required: true,
        tierIndex: 2,
        requirement: ageGte(10),
        signatureBillDefId: null,
        onFillReward: compound("+2 prestige, draw 2", [givePrestige(2), drawCards(2)]),
        signatureBonus: null,
        endGameValue: 9,
      }),
    ],
    tiers: [
      { index: 0, slotIndices: [0] },
      { index: 1, slotIndices: [1] },
      { index: 2, slotIndices: [2] },
    ],
    completionBonus: 10,
    themeBonus: 6,
    masteryBonus: 12,
  },
];

const BY_ID = new Map(PORTFOLIOS.map((p) => [p.id, p]));
const FLAGSHIPS_BY_BONUS = new Map<DistilleryBonus, Portfolio>(
  PORTFOLIOS.filter((p) => p.distilleryBonus !== null).map((p) => [
    p.distilleryBonus as DistilleryBonus,
    p,
  ]),
);

export function getPortfolio(id: string): Portfolio | undefined {
  return BY_ID.get(id);
}

export function flagshipPortfolioForDistillery(
  bonus: DistilleryBonus,
): Portfolio | undefined {
  return FLAGSHIPS_BY_BONUS.get(bonus);
}

export function allPortfolios(): readonly Portfolio[] {
  return PORTFOLIOS;
}

export function secondaryPoolIds(): readonly string[] {
  return PORTFOLIOS.filter((p) => p.distilleryBonus === null).map((p) => p.id);
}

// ─── Backwards-compatible exports for clients still calling v3.1 names ───
//
// LineStrip + BottlePlacementModal in the client read `getLineBoardDef`
// (returning something with a `.name`). v3.2 portfolios still satisfy
// that minimal surface area.

export function getLineBoardDef(id: string): { name: string } | undefined {
  return BY_ID.get(id);
}

export function lineBoardForDistillery(
  bonus: DistilleryBonus,
): { id: string; name: string } | undefined {
  const pf = FLAGSHIPS_BY_BONUS.get(bonus);
  if (!pf) return undefined;
  return { id: pf.id, name: pf.name };
}

// ─── Shared draw helper, used by reward primitives ───────────────

function drawIntoHand(
  draft: Draft<GameState>,
  player: Draft<PlayerState>,
  n: number,
): void {
  const result = drawWithReshuffle(
    player.deck.slice(),
    player.discard.slice(),
    n,
    draft.rngState,
  );
  player.hand.push(...result.drawn);
  player.deck = result.deck;
  player.discard = result.discard;
  draft.rngState = result.rngState;
}

/**
 * Build an empty PortfolioState for a player from a portfolio
 * definition. Every slot starts unfilled.
 */
export function buildEmptyPortfolioState(portfolio: Portfolio): PortfolioState {
  return {
    portfolioId: portfolio.id,
    slots: portfolio.slots.map((s) => ({
      index: s.index,
      filled: false,
      bottle: null,
      rewardFired: false,
      signatureMatched: false,
    })),
    completionReached: false,
  };
}

// ─── Placeholder export retained for transient references ─────────

/** @deprecated v3.1 Line Card draw helper. Returns no-op stub. */
export function drawOneFor(
  _draft: Draft<GameState>,
  _player: Draft<PlayerState>,
): void {
  // Line Card system removed in v3.2; no callers remain.
}

// Suppress unused-import lints in case Bottle/PlayerState end up referenced
// only via destructured arg types above.
void ({} as { _b?: Bottle; _p?: PlayerState });
