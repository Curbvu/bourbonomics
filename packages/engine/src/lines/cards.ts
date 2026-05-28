import type { LineCardInstance } from "../types";
import type {
  LineCardDef,
  LineRestriction,
  SlotRequirement,
  SlotReward,
} from "./defs";
import { drawOneFor } from "./boards";

// ─── Reward primitives ─────────────────────────────────────────

function giveRep(n: number): SlotReward {
  return {
    label: `+${n} rep`,
    fire: ({ player }) => {
      player.reputation += n;
    },
  };
}

function givePrestige(n: number): SlotReward {
  return {
    label: `+${n} prestige`,
    fire: ({ player }) => {
      player.prestige += n;
    },
  };
}

function drawCards(n: number): SlotReward {
  return {
    label: `draw ${n} card${n === 1 ? "" : "s"}`,
    fire: ({ draft, player }) => {
      for (let i = 0; i < n; i++) drawOneFor(draft, player);
    },
  };
}

function compound(label: string, parts: SlotReward[]): SlotReward {
  return {
    label,
    fire: (args) => {
      for (const r of parts) r.fire(args);
    },
  };
}

// ─── Requirement primitives ────────────────────────────────────

const anyBottle: SlotRequirement = {
  label: "any bottle",
  check: () => true,
};

function ageGte(n: number): SlotRequirement {
  return {
    label: `aged ${n}+ years`,
    check: ({ bottle }) => bottle.ageAtSale >= n,
  };
}

function ageBetween(lo: number, hi: number): SlotRequirement {
  return {
    label: `aged ${lo}–${hi} years`,
    check: ({ bottle }) =>
      bottle.ageAtSale >= lo && bottle.ageAtSale <= hi,
  };
}

function demandLte(n: number): SlotRequirement {
  return {
    label: `sold at demand ≤ ${n}`,
    check: ({ bottle }) => bottle.demandAtSale <= n,
  };
}

function demandGte(n: number): SlotRequirement {
  return {
    label: `sold at demand ${n}+`,
    check: ({ bottle }) => bottle.demandAtSale >= n,
  };
}

const heritageCask: SlotRequirement = {
  label: "Heritage cask",
  check: ({ bottle }) => bottle.caskTag === "heritage-cask",
};

const specialtyOrHeritageCask: SlotRequirement = {
  label: "Specialty or Heritage cask",
  check: ({ bottle }) =>
    bottle.caskTag === "specialty-cask" || bottle.caskTag === "heritage-cask",
};

const RARITY_RANK: Record<string, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
};

function rarityGte(min: "uncommon" | "rare" | "epic"): SlotRequirement {
  const threshold = RARITY_RANK[min] ?? 0;
  return {
    label: `bill rarity ${min[0]!.toUpperCase()}${min.slice(1)}+`,
    check: ({ bottle }) => (RARITY_RANK[bottle.rarity] ?? 0) >= threshold,
  };
}

function rarityLte(max: "common" | "uncommon"): SlotRequirement {
  const threshold = RARITY_RANK[max] ?? 0;
  return {
    label: `bill rarity ${max[0]!.toUpperCase()}${max.slice(1)} or lower`,
    check: ({ bottle }) => (RARITY_RANK[bottle.rarity] ?? 0) <= threshold,
  };
}

const ryeHeavy: SlotRequirement = {
  label: "rye-heavy bottle",
  check: ({ bottle }) =>
    bottle.primaryRecipeTag === "high-rye" || bottle.primaryRecipeTag === "rye",
};

function and(label: string, parts: SlotRequirement[]): SlotRequirement {
  return {
    label,
    check: (args) => parts.every((p) => p.check(args)),
  };
}

function or(label: string, parts: SlotRequirement[]): SlotRequirement {
  return {
    label,
    check: (args) => parts.some((p) => p.check(args)),
  };
}

// ─── Line Restriction primitives ───────────────────────────────

const restrictHeritageCask: LineRestriction = {
  label: "every bottle must be Heritage cask",
  check: ({ bottle }) => bottle.caskTag === "heritage-cask",
};

const restrictRye: LineRestriction = {
  label: "every bottle must have minRye ≥ 1",
  check: ({ bottle }) => bottle.recipeTags.includes("rye"),
};

const restrictLowDemand: LineRestriction = {
  label: "every bottle must be sold at demand ≤ 4",
  check: ({ bottle }) => bottle.demandAtSale <= 4,
};

// ─── The 25 base-game Line Cards ───────────────────────────────
// 5 theme families × 5 slot positions = 25 cards. Each family has a
// complete 1→5 progression; drawing within a family creates synergy,
// drawing across families creates challenging hybrid Lines. Wild
// cards are loose-requirement universals useful when a player's
// production drifts between themes. (The spec's suggested
// 11/7/4/2/1 slot-distribution is approximated as 5/5/5/5/5; the
// family completeness is the more useful design property to keep.)

const CARDS: LineCardDef[] = [
  // ═══ Heritage family ═══════════════════════════════════════════
  {
    id: "lc_heritage_foundation",
    name: "Heritage Foundation",
    flavorText: "The cooperage talks; the wood does the work.",
    themeTag: "heritage-cask",
    themeFamily: "heritage",
    slotPosition: 1,
    requirement: heritageCask,
    reward: giveRep(1),
    endGameValue: 1,
    lineRestriction: restrictHeritageCask,
  },
  {
    id: "lc_heritage_aged",
    name: "Heritage Aged",
    flavorText: "Years married to staves the cooper hand-selected.",
    themeTag: "heritage-cask",
    themeFamily: "heritage",
    slotPosition: 2,
    requirement: ageGte(4),
    reward: drawCards(1),
    endGameValue: 2,
  },
  {
    id: "lc_heritage_cask_strength",
    name: "Heritage Cask Strength",
    flavorText: "Uncut, unfiltered, undiluted.",
    themeTag: "heritage-cask",
    themeFamily: "heritage",
    slotPosition: 3,
    requirement: demandGte(5),
    reward: compound("+2 rep, +1 prestige", [giveRep(2), givePrestige(1)]),
    endGameValue: 4,
  },
  {
    id: "lc_heritage_masters_reserve",
    name: "Heritage Master's Reserve",
    flavorText: "Locked away when the stocks first turned amber.",
    themeTag: "heritage-cask",
    themeFamily: "heritage",
    slotPosition: 4,
    requirement: and("Rare+ bill, aged 6+", [rarityGte("rare"), ageGte(6)]),
    reward: compound("+3 rep, +1 prestige", [giveRep(3), givePrestige(1)]),
    endGameValue: 6,
  },
  {
    id: "lc_heritage_legacy",
    name: "Heritage Legacy",
    flavorText: "Three generations argue over which one made it.",
    themeTag: "heritage-cask",
    themeFamily: "heritage",
    slotPosition: 5,
    requirement: and("Epic+ bill, aged 7+", [rarityGte("epic"), ageGte(7)]),
    reward: compound("+5 rep, +2 prestige, draw 2 cards", [
      giveRep(5),
      givePrestige(2),
      drawCards(2),
    ]),
    endGameValue: 8,
  },

  // ═══ High-Rye family ═══════════════════════════════════════════
  {
    id: "lc_rye_original",
    name: "Rye Original",
    flavorText: "Bite. Heat. Dryness on the tail.",
    themeTag: "rye",
    themeFamily: "high-rye",
    slotPosition: 1,
    requirement: ryeHeavy,
    reward: giveRep(1),
    endGameValue: 1,
    lineRestriction: restrictRye,
  },
  {
    id: "lc_rye_reserve",
    name: "Rye Reserve",
    flavorText: "Set aside the day the rickhouse first held.",
    themeTag: "rye",
    themeFamily: "high-rye",
    slotPosition: 2,
    requirement: ageGte(3),
    reward: drawCards(1),
    endGameValue: 2,
  },
  {
    id: "lc_rye_single_barrel",
    name: "Rye Single Barrel",
    flavorText: "One barrel, one signature, one master's pick.",
    themeTag: "specialty-cask",
    themeFamily: "high-rye",
    slotPosition: 3,
    requirement: specialtyOrHeritageCask,
    reward: giveRep(2),
    endGameValue: 3,
  },
  {
    id: "lc_rye_masters_selection",
    name: "Rye Master's Selection",
    flavorText: "Bottled the morning the master called it.",
    themeTag: "rye",
    themeFamily: "high-rye",
    slotPosition: 4,
    requirement: rarityGte("rare"),
    reward: compound("+3 rep, +1 prestige", [giveRep(3), givePrestige(1)]),
    endGameValue: 5,
  },
  {
    id: "lc_rye_legendary_cut",
    name: "Rye Legendary Cut",
    flavorText: "Only one in fifty barrels makes the cut.",
    themeTag: "rye",
    themeFamily: "high-rye",
    slotPosition: 5,
    requirement: and("Epic+ bill, demand 6+", [rarityGte("epic"), demandGte(6)]),
    reward: compound("+5 rep, draw 2 cards, +1 prestige", [
      giveRep(5),
      drawCards(2),
      givePrestige(1),
    ]),
    endGameValue: 8,
  },

  // ═══ Counter-Cyclical family ═══════════════════════════════════
  {
    id: "lc_working_class",
    name: "Working Class",
    flavorText: "The bottle on the bar before the crowd shows up.",
    themeTag: "counter-cyclical",
    themeFamily: "counter-cyclical",
    slotPosition: 1,
    requirement: demandLte(3),
    reward: giveRep(2),
    endGameValue: 2,
    lineRestriction: restrictLowDemand,
  },
  {
    id: "lc_hidden_gem",
    name: "Hidden Gem",
    flavorText: "Not on the menu. Ask the bartender.",
    themeTag: "counter-cyclical",
    themeFamily: "counter-cyclical",
    slotPosition: 2,
    requirement: rarityLte("uncommon"),
    reward: drawCards(1),
    endGameValue: 2,
  },
  {
    id: "lc_bargain_hunters_find",
    name: "Bargain Hunter's Find",
    flavorText: "Six dollars, smuggled in from upstate.",
    themeTag: "counter-cyclical",
    themeFamily: "counter-cyclical",
    slotPosition: 3,
    requirement: ageBetween(2, 4),
    reward: giveRep(3),
    endGameValue: 3,
  },
  {
    id: "lc_underdog_reserve",
    name: "Underdog Reserve",
    flavorText: "The shelf nobody walks past, until they do.",
    themeTag: "counter-cyclical",
    themeFamily: "counter-cyclical",
    slotPosition: 4,
    requirement: and("demand ≤ 3, aged 4+", [demandLte(3), ageGte(4)]),
    reward: compound("+4 rep, draw 1 card", [giveRep(4), drawCards(1)]),
    endGameValue: 5,
  },
  {
    id: "lc_the_quiet_legend",
    name: "The Quiet Legend",
    flavorText: "Whispered about in the back room. Never on the wall.",
    themeTag: "counter-cyclical",
    themeFamily: "counter-cyclical",
    slotPosition: 5,
    requirement: and("Rare+ bill, demand ≤ 3", [rarityGte("rare"), demandLte(3)]),
    reward: compound("+6 rep, +2 prestige", [giveRep(6), givePrestige(2)]),
    endGameValue: 8,
  },

  // ═══ Volume family ═════════════════════════════════════════════
  {
    id: "lc_daily_sipper",
    name: "Daily Sipper",
    flavorText: "First pour after closing, every night.",
    themeTag: "volume",
    themeFamily: "volume",
    slotPosition: 1,
    requirement: anyBottle,
    reward: giveRep(1),
    endGameValue: 1,
  },
  {
    id: "lc_house_standard",
    name: "House Standard",
    flavorText: "When in doubt, this is the answer.",
    themeTag: "volume",
    themeFamily: "volume",
    slotPosition: 2,
    requirement: anyBottle,
    reward: drawCards(1),
    endGameValue: 2,
  },
  {
    id: "lc_bartenders_pick",
    name: "Bartender's Pick",
    flavorText: "When the patron says \"surprise me.\"",
    themeTag: "volume",
    themeFamily: "volume",
    slotPosition: 3,
    requirement: demandGte(4),
    reward: giveRep(2),
    endGameValue: 3,
  },
  {
    id: "lc_crowd_favorite",
    name: "Crowd Favorite",
    flavorText: "The one Saturday night drinks dry.",
    themeTag: "demand-high",
    themeFamily: "volume",
    slotPosition: 4,
    requirement: or("Rare+ OR demand 6+", [rarityGte("rare"), demandGte(6)]),
    reward: compound("+3 rep, draw 1 card", [giveRep(3), drawCards(1)]),
    endGameValue: 4,
  },
  {
    id: "lc_americas_bourbon",
    name: "America's Bourbon",
    flavorText: "Shipped to every state in the union by 1873.",
    themeTag: "demand-high",
    themeFamily: "volume",
    slotPosition: 5,
    requirement: and("Rare+ bill, demand 6+", [rarityGte("rare"), demandGte(6)]),
    reward: compound("+5 rep, draw 3 cards", [giveRep(5), drawCards(3)]),
    endGameValue: 7,
  },

  // ═══ Wild family ═══════════════════════════════════════════════
  {
    id: "lc_open_lot",
    name: "Open Lot",
    flavorText: "Whatever fills the gap.",
    themeTag: "volume",
    themeFamily: "wild",
    slotPosition: 1,
    requirement: anyBottle,
    reward: giveRep(1),
    endGameValue: 1,
  },
  {
    id: "lc_versatile_blend",
    name: "Versatile Blend",
    flavorText: "Fit for any setting, willing for most.",
    themeTag: "volume",
    themeFamily: "wild",
    slotPosition: 2,
    requirement: anyBottle,
    reward: giveRep(1),
    endGameValue: 1,
  },
  {
    id: "lc_all_comers_cask",
    name: "All-Comers Cask",
    flavorText: "Aged 'til it was time to stop arguing.",
    themeTag: "common-cask",
    themeFamily: "wild",
    slotPosition: 3,
    requirement: anyBottle,
    reward: giveRep(2),
    endGameValue: 2,
  },
  {
    id: "lc_free_form_reserve",
    name: "Free-Form Reserve",
    flavorText: "Pulled from whichever rick caught the light.",
    themeTag: "common-cask",
    themeFamily: "wild",
    slotPosition: 4,
    requirement: rarityGte("uncommon"),
    reward: giveRep(3),
    endGameValue: 4,
  },
  {
    id: "lc_independent_spirit",
    name: "Independent Spirit",
    flavorText: "No house, no story, no apology.",
    themeTag: "boutique",
    themeFamily: "wild",
    slotPosition: 5,
    requirement: ageGte(6),
    reward: compound("+5 rep, draw 1 card", [giveRep(5), drawCards(1)]),
    endGameValue: 6,
  },
];

const BY_ID = new Map(CARDS.map((c) => [c.id, c]));

export function getLineCardDef(defId: string): LineCardDef | undefined {
  return BY_ID.get(defId);
}

export function allLineCardDefs(): readonly LineCardDef[] {
  return CARDS;
}

/**
 * Base copies per Line Card defId. 25 unique defs × 1 copy each in
 * the base game. Future expansions can mint multiples via this table.
 */
const BASE_DECK_COPIES: ReadonlyMap<string, number> = new Map(
  CARDS.map((c) => [c.id, 1] as const),
);

/**
 * Build the initial Line Card deck as instances. Caller is
 * responsible for shuffling. Convention matches `bourbonDeck`:
 * top-of-deck = end of array.
 */
export function buildLineCardInstances(): LineCardInstance[] {
  const out: LineCardInstance[] = [];
  let idx = 0;
  for (const [defId, copies] of BASE_DECK_COPIES.entries()) {
    for (let i = 0; i < copies; i++) {
      out.push({
        instanceId: `lci_${defId}_${idx++}`,
        defId,
      });
    }
  }
  return out;
}
