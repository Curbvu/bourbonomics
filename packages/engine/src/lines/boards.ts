import type { Draft } from "immer";
import type {
  Bottle,
  Card,
  DistilleryBonus,
  GameState,
  Line,
  PlayerState,
} from "../types";
import type {
  FlagshipLineBoardDef,
  LineCompletionBonus,
  LineRestriction,
  SlotDef,
  SlotRequirement,
  SlotReward,
} from "./defs";
import { drawWithReshuffle } from "../deck";

// ─── Restriction helpers ─────────────────────────────────────────

const noRestriction: LineRestriction | null = null;

const minWheat1: LineRestriction = {
  label: "every bottle must have minWheat ≥ 1",
  check: ({ bottle }) => bottle.recipeTags.includes("wheated"),
};

const minRye2: LineRestriction = {
  label: "every bottle must have minRye ≥ 2",
  // The "rye" tag is derived from minRye ≥ 1, "high-rye" from minRye ≥ 3.
  // minRye ≥ 2 sits between them; the closest available gate is the
  // rye tag (minRye ≥ 1) — every rye-tagged bottle on a House Lineup
  // ought to clear the bar in practice, and bills with minRye ≥ 2 will
  // always carry the tag.
  check: ({ bottle }) => bottle.recipeTags.includes("rye"),
};

const uniquePrimaryRecipeTag: LineRestriction = {
  label: "no two bottles on this Line may share their primary recipe tag",
  check: ({ bottle, line }) => {
    if (!line.slots) return true;
    return !line.slots.some(
      (s) =>
        s.filled &&
        s.bottle &&
        s.bottle.primaryRecipeTag === bottle.primaryRecipeTag,
    );
  },
};

// ─── Requirement helpers ─────────────────────────────────────────

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

function demandAtSaleGte(n: number): SlotRequirement {
  return {
    label: `sold at demand ${n}+`,
    check: ({ bottle }) => bottle.demandAtSale >= n,
  };
}

const specialtyOrHeritageCask: SlotRequirement = {
  label: "Specialty or Heritage cask",
  check: ({ bottle }) =>
    bottle.caskTag === "specialty-cask" || bottle.caskTag === "heritage-cask",
};

const specialtyCask: SlotRequirement = {
  label: "Specialty cask",
  check: ({ bottle }) => bottle.caskTag === "specialty-cask",
};

const heritageCask: SlotRequirement = {
  label: "Heritage cask",
  check: ({ bottle }) => bottle.caskTag === "heritage-cask",
};

const RARITY_RANK: Record<string, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
};

function rarityGte(min: "rare" | "epic"): SlotRequirement {
  const threshold = RARITY_RANK[min] ?? 0;
  return {
    label: `bill rarity ${min[0]!.toUpperCase()}${min.slice(1)}+`,
    check: ({ bottle }) => (RARITY_RANK[bottle.rarity] ?? 0) >= threshold,
  };
}

const singleGrain: SlotRequirement = {
  label: "single-grain bottle (one grain type only)",
  check: ({ bottle }) => bottle.recipeTags.includes("single-grain"),
};

const tripleGrain: SlotRequirement = {
  label: "bill uses all 3 grain types",
  check: ({ bottle }) => bottle.recipeTags.includes("triple-grain"),
};

const ryeHeavy: SlotRequirement = {
  label: "rye-heavy bottle",
  // Rye-heavy = primaryRecipeTag prioritizes high-rye or rye over wheated/etc.
  check: ({ bottle }) =>
    bottle.primaryRecipeTag === "high-rye" || bottle.primaryRecipeTag === "rye",
};

const wheatedOnly: SlotRequirement = {
  label: "any wheated bottle",
  check: ({ bottle }) => bottle.recipeTags.includes("wheated"),
};

/**
 * Compound requirement for Wheated Baron slot 5: Heritage cask, aged
 * 7+, all four prior slots filled. The spec also asks for "filled with
 * bottles from your own production (not received via trade or Barrel
 * Broker)"; the own-production qualifier is deferred until a Bottle
 * carries provenance metadata (planned alongside Barrel Broker rework).
 */
const baronVintageReserve: SlotRequirement = {
  label: "Heritage cask, aged 7+, all prior slots filled",
  check: ({ bottle, line, slotIndex }) => {
    if (bottle.caskTag !== "heritage-cask") return false;
    if (bottle.ageAtSale < 7) return false;
    if (!line.slots) return false;
    for (let i = 0; i < slotIndex; i++) {
      if (!line.slots[i]!.filled) return false;
    }
    return true;
  },
};

const houseMastersCut: SlotRequirement = {
  label: "aged 7+, bill rarity Epic+, demand 6+ at sale",
  check: ({ bottle }) =>
    bottle.ageAtSale >= 7 &&
    (RARITY_RANK[bottle.rarity] ?? 0) >= RARITY_RANK.epic! &&
    bottle.demandAtSale >= 6,
};

const estateCuratorsChoice: SlotRequirement = {
  label: "bill rarity Epic+, aged 6+",
  check: ({ bottle }) =>
    bottle.ageAtSale >= 6 &&
    (RARITY_RANK[bottle.rarity] ?? 0) >= RARITY_RANK.epic!,
};

const standardHeritage: SlotRequirement = {
  label: "Heritage cask, aged 5+",
  check: ({ bottle }) =>
    bottle.caskTag === "heritage-cask" && bottle.ageAtSale >= 5,
};

const standardMaster: SlotRequirement = {
  label: "Heritage cask, aged 7+, demand 5+ at sale",
  check: ({ bottle }) =>
    bottle.caskTag === "heritage-cask" &&
    bottle.ageAtSale >= 7 &&
    bottle.demandAtSale >= 5,
};

// ─── Reward helpers ──────────────────────────────────────────────

function giveRep(n: number, label?: string): SlotReward {
  return {
    label: label ?? `+${n} rep`,
    fire: ({ player }) => {
      player.reputation += n;
    },
  };
}

function givePrestige(n: number, label?: string): SlotReward {
  return {
    label: label ?? `+${n} prestige`,
    fire: ({ player }) => {
      player.prestige += n;
    },
  };
}

function drawCards(n: number, label?: string): SlotReward {
  return {
    label: label ?? `draw ${n} card${n === 1 ? "" : "s"}`,
    fire: ({ draft, player }) => {
      drawIntoHand(draft, player, n);
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

/**
 * Scavenge the first Specialty resource card from the face-up market
 * into the player's hand. Spec: "gain 1 Specialty card from the market
 * into hand." Refills the vacated market slot from the supply deck.
 * No-op if no Specialty card is currently face-up.
 */
const scavengeSpecialtyFromMarket: SlotReward = {
  label: "gain 1 Specialty card from the market into hand",
  fire: ({ draft, player }) => {
    const idx = draft.market.findIndex(
      (c: Card) => c.type === "resource" && c.specialty === true,
    );
    if (idx < 0) return;
    const [taken] = draft.market.splice(idx, 1);
    if (!taken) return;
    player.hand.push(taken);
    // Refill from the supply deck; if empty, reshuffle the discard.
    if (draft.marketSupplyDeck.length === 0 && draft.marketDiscard.length > 0) {
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
    if (refill) draft.market.splice(idx, 0, refill);
  },
};

// ─── Completion bonus primitives ─────────────────────────────────

const baronCompletion: LineCompletionBonus = {
  label:
    "+10 rep; all your Common-bill sales no longer drop demand for the rest of the game",
  immediateRep: 10,
  fire: ({ player }) => {
    player.reputation += 10;
    player.commonSalesIgnoreDemandDrop = true;
  },
};

const houseCompletion: LineCompletionBonus = {
  label:
    "+10 rep; your next Drafting Loop reveals 5 bills instead of 3",
  immediateRep: 10,
  fire: ({ player }) => {
    player.reputation += 10;
    player.draftingLoopReveals5Next = true;
  },
};

const estateCompletion: LineCompletionBonus = {
  label:
    "+12 rep; end-game prestige scoring doubles (2 rep per prestige)",
  immediateRep: 12,
  fire: ({ player }) => {
    player.reputation += 12;
    player.prestigeScoringDoubled = true;
  },
};

const vanillaCompletion: LineCompletionBonus = {
  label:
    "+10 rep; +5 rep at end of game for each bottle in your inventory",
  immediateRep: 10,
  fire: ({ player }) => {
    player.reputation += 10;
    player.inventoryBottleBonusActive = true;
  },
};

// ─── Boards ──────────────────────────────────────────────────────

const BOARDS: FlagshipLineBoardDef[] = [
  // ─── Wheated Baron — The Baron's Lineup ──────────────────────
  {
    id: "lb_barons_lineup",
    name: "The Baron's Lineup",
    flavorText: "Soft front, gentle finish, the pour she pours.",
    distilleryBonus: "wheated_baron",
    lineRestriction: minWheat1,
    slots: [
      slot("Baron's Select", wheatedOnly, giveRep(1), 1),
      slot("Baron's Reserve", ageGte(3), drawCards(2), 2),
      slot("Baron's Cask Strength", demandAtSaleGte(5), giveRep(3), 3),
      slot("Baron's Heritage", heritageCask, givePrestige(2), 5),
      slot(
        "Baron's Vintage Reserve",
        baronVintageReserve,
        compound("+5 rep, +2 prestige, draw 3 cards", [
          giveRep(5),
          givePrestige(2),
          drawCards(3),
        ]),
        8,
      ),
    ],
    completionBonus: baronCompletion,
  },

  // ─── High-Rye House — The House Lineup ───────────────────────
  {
    id: "lb_house_lineup",
    name: "The House Lineup",
    flavorText: "Pepper, baking spice, the long dry finish.",
    distilleryBonus: "high_rye_house",
    lineRestriction: minRye2,
    slots: [
      slot("House Original", ryeHeavy, drawCards(1), 1),
      slot("House Reserve", ageGte(4), giveRep(2), 2),
      slot("House Single Barrel", specialtyOrHeritageCask, givePrestige(1), 4),
      slot(
        "House Limited Release",
        rarityGte("rare"),
        compound("+3 rep, gain 1 Specialty card from the market", [
          giveRep(3),
          scavengeSpecialtyFromMarket,
        ]),
        6,
      ),
      slot(
        "House Master's Cut",
        houseMastersCut,
        compound("+5 rep, draw 3 cards, +2 prestige", [
          giveRep(5),
          drawCards(3),
          givePrestige(2),
        ]),
        8,
      ),
    ],
    completionBonus: houseCompletion,
  },

  // ─── Connoisseur Estate — The Estate Collection ──────────────
  {
    id: "lb_estate_collection",
    name: "The Estate Collection",
    flavorText: "Four bills, four buyers, four brick lines.",
    distilleryBonus: "connoisseur_estate",
    lineRestriction: uniquePrimaryRecipeTag,
    slots: [
      slot("Estate Foundation", anyBottle, giveRep(1), 2),
      slot("Estate Single Origin", singleGrain, givePrestige(1), 3),
      slot(
        "Estate Heritage Series",
        heritageCask,
        compound("+2 rep, draw 1 card", [giveRep(2), drawCards(1)]),
        5,
      ),
      slot(
        "Estate Master Blend",
        tripleGrain,
        compound("+2 prestige, +2 rep", [givePrestige(2), giveRep(2)]),
        7,
      ),
      slot(
        "Estate Curator's Choice",
        estateCuratorsChoice,
        compound("+5 rep, +3 prestige", [giveRep(5), givePrestige(3)]),
        10,
      ),
    ],
    completionBonus: estateCompletion,
  },

  // ─── Vanilla Distillery — The Vanilla Standard ───────────────
  {
    id: "lb_vanilla_standard",
    name: "The Vanilla Standard",
    flavorText: "Every label, every shelf. The house pour.",
    distilleryBonus: "vanilla",
    lineRestriction: noRestriction,
    slots: [
      slot("Standard", anyBottle, giveRep(1), 2),
      slot("Standard Reserve", ageGte(3), giveRep(1), 3),
      slot("Standard Premium", specialtyCask, giveRep(2), 4),
      slot(
        "Standard Heritage",
        standardHeritage,
        compound("+3 rep, draw 2 cards", [giveRep(3), drawCards(2)]),
        5,
      ),
      slot(
        "Standard Master",
        standardMaster,
        compound("+5 rep, +2 prestige", [giveRep(5), givePrestige(2)]),
        8,
      ),
    ],
    completionBonus: vanillaCompletion,
  },
];

function slot(
  name: string,
  requirement: SlotRequirement,
  reward: SlotReward,
  endGameValue: number,
): SlotDef {
  return { name, requirement, reward, endGameValue };
}

const BY_ID = new Map(BOARDS.map((b) => [b.id, b]));
const BY_BONUS = new Map(BOARDS.map((b) => [b.distilleryBonus, b]));

export function getLineBoardDef(id: string): FlagshipLineBoardDef | undefined {
  return BY_ID.get(id);
}

export function lineBoardForDistillery(
  bonus: DistilleryBonus,
): FlagshipLineBoardDef | undefined {
  return BY_BONUS.get(bonus);
}

export function allLineBoards(): readonly FlagshipLineBoardDef[] {
  return BOARDS;
}

// ─── Shared draw helper used by legacy v3.0 Line Cards too ───────

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

/** Used by legacy v3.0 Line Card per-bottle bonuses. */
export function drawOneFor(
  draft: Draft<GameState>,
  player: Draft<PlayerState>,
): void {
  drawIntoHand(draft, player, 1);
}
