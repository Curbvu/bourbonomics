import { BOURBON_CARD_IDS, bourbonPayoutFromGrid, getBourbonCardDefById } from "./bourbonCards";
import type { PlayWhen, ResourcePlayOp } from "./resource-play-types";
import {
  countMashCorn,
  countMashSmallGrains,
  mashIncludesRye,
} from "./resource-card-resolve";
import makeData from "./resourceMakeModeled.generated.json";
import sellData from "./resourceSellModeled.generated.json";

const onSellById = sellData.onSellById as Record<string, ResourcePlayOp[]>;
const onMakeById = makeData.onMakeById as Record<string, ResourcePlayOp[]>;

export const MAX_MARKET_DEMAND = 12;

export function clampMarketDemand(d: number): number {
  return Math.min(MAX_MARKET_DEMAND, Math.max(0, Math.floor(d)));
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function popBourbonYamlId(deck: string[]): string {
  if (deck.length === 0) deck.push(...shuffle([...BOURBON_CARD_IDS]));
  return deck.pop()!;
}

function opWhen(op: ResourcePlayOp): PlayWhen | undefined {
  if (typeof op === "object" && op && "when" in op) {
    const w = (op as { when?: PlayWhen }).when;
    return w;
  }
  return undefined;
}

function evalPlayWhen(
  when: PlayWhen | undefined,
  ctx: {
    demandAtSale: number;
    mash: string[];
    otherBaronsBarrelledCount: number;
  }
): boolean {
  if (!when) return true;
  const d = ctx.demandAtSale;
  if (when.demand_lte != null && !(d <= when.demand_lte)) return false;
  if (when.demand_gte != null && !(d >= when.demand_gte)) return false;
  if (when.demand_even === true && d % 2 !== 0) return false;
  if (when.demand_odd === true && d % 2 === 0) return false;
  const corn = countMashCorn(ctx.mash);
  const small = countMashSmallGrains(ctx.mash);
  if (when.mash_corn_count_eq != null && corn !== when.mash_corn_count_eq) return false;
  if (when.mash_corn_count_gte != null && !(corn >= when.mash_corn_count_gte))
    return false;
  if (when.mash_small_grain_count_eq != null && small !== when.mash_small_grain_count_eq)
    return false;
  if (
    when.mash_small_grain_count_gte != null &&
    !(small >= when.mash_small_grain_count_gte)
  )
    return false;
  if (when.mash_includes_rye === true && !mashIncludesRye(ctx.mash)) return false;
  if (when.mash_excludes_rye === true && mashIncludesRye(ctx.mash)) return false;
  if (
    when.other_barons_barrelled_gte != null &&
    !(ctx.otherBaronsBarrelledCount >= when.other_barons_barrelled_gte)
  )
    return false;
  return true;
}

function collectSellOps(mash: string[]): ResourcePlayOp[] {
  const out: ResourcePlayOp[] = [];
  for (const id of mash) {
    const list = onSellById[id];
    if (!list?.length) continue;
    out.push(...list);
  }
  return out;
}

/**
 * Legacy prototype hook for discounted **barrel placement rent**.
 * Table-round rules (GAME_RULES) charge **no placement rent** — ongoing rickhouse fees are Phase 1 only — so this is
 * unused for `roundStructureVersion >= 3` games (see `functions/lib/game.ts` `barrelBourbon`).
 */
export function totalBarrelEntryRentDiscount(mashCardIds: string[]): number {
  let sum = 0;
  for (const id of mashCardIds) {
    const ops = onMakeById[id];
    if (!ops?.length) continue;
    for (const op of ops) {
      if (op.op !== "barrel_entry_rent_discount") continue;
      if (op.limit !== "first_barrel_placement_from_mash") continue;
      sum += op.amount;
    }
  }
  return sum;
}

export type SpecialtySellResolution = {
  chosenYamlId: string;
  bourbonDeck: string[];
  /** Payout from the Market Price Guide (after lookup shifts), before flat revenue bonuses. */
  gridProceeds: number;
  /** After revenue bonuses; floored at 0 before the action fee. */
  finalProceeds: number;
  /** Sum of Tier B global demand deltas from modeled mash cards (applied after the standard −1 sell tick). */
  globalDemandDelta: number;
  lookupAge: number;
  lookupDemandForGrid: number;
};

/**
 * Picks a bourbon card (best of N draws when draw ops fire), applies modeled `on_sell` ops from the mash.
 * When `mashCardIds` is empty (legacy barrels), behaves like a single random draw with no specialty ops.
 */
export function resolveSellWithSpecialtyResources(input: {
  mashCardIds: string[] | undefined;
  barrelAge: number;
  marketDemandAtSale: number;
  bourbonDeck: string[];
  otherBaronsBarrelledCount: number;
}): SpecialtySellResolution {
  const mash = input.mashCardIds ?? [];
  const deck = [...input.bourbonDeck];
  const ctxBase = {
    demandAtSale: input.marketDemandAtSale,
    mash,
    otherBaronsBarrelledCount: input.otherBaronsBarrelledCount,
  };

  if (mash.length === 0) {
    const chosenYamlId = popBourbonYamlId(deck);
    const def = getBourbonCardDefById(chosenYamlId);
    const gridProceeds = def
      ? bourbonPayoutFromGrid(def, input.barrelAge, input.marketDemandAtSale)
      : 0;
    const finalProceeds = Math.max(0, gridProceeds);
    return {
      chosenYamlId,
      bourbonDeck: deck,
      gridProceeds,
      finalProceeds,
      globalDemandDelta: 0,
      lookupAge: input.barrelAge,
      lookupDemandForGrid: input.marketDemandAtSale,
    };
  }

  const ops = collectSellOps(mash);
  let demandLookupShift = 0;
  let ageLookupShift = 0;
  let extraBourbonDraws = 0;
  let revenueBonus = 0;
  let globalDemandDelta = 0;

  for (const op of ops) {
    if (op.op === "noop" || op.op === "legacy_manual") continue;
    const w = opWhen(op);
    if (!evalPlayWhen(w, ctxBase)) continue;

    switch (op.op) {
      case "demand_lookup_shift":
        demandLookupShift += op.delta;
        break;
      case "age_lookup_shift_years":
        ageLookupShift += op.years;
        break;
      case "draw_bourbon_cards":
        extraBourbonDraws += op.count;
        break;
      case "revenue_bonus":
        revenueBonus += op.amount;
        break;
      case "market_demand_global_delta":
        globalDemandDelta += op.delta;
        break;
      default:
        break;
    }
  }

  const lookupAge = Math.min(12, Math.max(0, input.barrelAge + ageLookupShift));
  const md = input.marketDemandAtSale;
  let lookupDemandForGrid = md;
  if (md > 0) {
    lookupDemandForGrid = clampMarketDemand(md + demandLookupShift);
  }

  const totalDraws = 1 + extraBourbonDraws;
  let bestId = "";
  let bestGrid = -Infinity;

  for (let i = 0; i < totalDraws; i++) {
    const id = popBourbonYamlId(deck);
    const def = getBourbonCardDefById(id);
    const g = def
      ? bourbonPayoutFromGrid(def, lookupAge, md <= 0 ? 0 : lookupDemandForGrid)
      : 0;
    if (g > bestGrid) {
      bestGrid = g;
      bestId = id;
    }
  }

  if (!bestId) {
    bestId = BOURBON_CARD_IDS[0] ?? "01";
    bestGrid = 0;
  }

  const chosenDef = getBourbonCardDefById(bestId);
  const gridProceeds = chosenDef
    ? bourbonPayoutFromGrid(
        chosenDef,
        lookupAge,
        md <= 0 ? 0 : lookupDemandForGrid
      )
    : bestGrid;

  const finalProceeds = Math.max(0, gridProceeds + revenueBonus);

  return {
    chosenYamlId: bestId,
    bourbonDeck: deck,
    gridProceeds,
    finalProceeds,
    globalDemandDelta,
    lookupAge,
    lookupDemandForGrid: md <= 0 ? md : lookupDemandForGrid,
  };
}
