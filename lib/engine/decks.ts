/**
 * Deck construction and manipulation helpers.
 *
 * Resource decks are built from plain-type cards + specialty cards keyed by resource type.
 * Bourbon / investment / operations decks use the card ids directly; investment includes
 * duplicates according to `deckCopies`.
 */

import {
  BOURBON_CARDS,
  BOURBON_CARDS_BY_ID,
} from "@/lib/catalogs/bourbon.generated";
import {
  INVESTMENT_CARDS,
  INVESTMENT_CARDS_BY_ID,
} from "@/lib/catalogs/investment.generated";
import { MARKET_CARDS, MARKET_CARDS_BY_ID } from "@/lib/catalogs/market.generated";
import { DISTILLERY_CARDS } from "@/lib/catalogs/distillery.generated";
import { OPERATIONS_CARDS } from "@/lib/catalogs/operations.generated";
import { SPECIALTY_RESOURCES } from "@/lib/catalogs/resource.generated";
import type { ResourceType } from "@/lib/catalogs/types";
import type { Rng } from "./rng";
import { shuffle } from "./rng";
import type { ResourceCardInstance } from "./state";

export { BOURBON_CARDS_BY_ID, INVESTMENT_CARDS_BY_ID, MARKET_CARDS_BY_ID };

let instanceCounter = 0;
/**
 * The instance id must be globally unique for save/load to round-trip.
 * We use a prefix + monotonic counter shared across all prefixes; the prefix
 * exists for human readability only.
 */
export function resetInstanceCounter(base = 0): void {
  instanceCounter = base;
}

export function mintInstanceId(prefix: string): string {
  return `${prefix}-${instanceCounter++}`;
}

/**
 * Reconcile the in-memory counter against a freshly-loaded `GameState`.
 *
 * The counter lives in module scope (not in `GameState`), so a page refresh
 * restores all the existing `<prefix>-<n>` ids from localStorage but resets
 * the counter back to 0. After enough new draws the counter would catch up
 * and start producing collisions. Call this whenever a state is loaded from
 * outside the reducer (persistence, save/load, replay) to set the counter
 * to `max(existing numeric suffixes) + 1`.
 */
export function recoverInstanceCounter(state: unknown): void {
  let max = -1;
  const seen = new WeakSet<object>();
  const visit = (v: unknown): void => {
    if (typeof v === "string") {
      const m = v.match(/-(\d+)$/);
      if (m) {
        const n = Number(m[1]);
        if (Number.isFinite(n) && n > max) max = n;
      }
      return;
    }
    if (!v || typeof v !== "object") return;
    if (seen.has(v as object)) return;
    seen.add(v as object);
    if (Array.isArray(v)) {
      for (const item of v) visit(item);
      return;
    }
    for (const k of Object.keys(v)) {
      visit((v as Record<string, unknown>)[k]);
    }
  };
  visit(state);
  instanceCounter = max + 1;
}

const RESOURCE_TYPES: ResourceType[] = [
  "cask",
  "corn",
  "barley",
  "rye",
  "wheat",
];

/** Reference mix from GAME_RULES §Resources: ~64% plain + specialty by type. */
const PLAIN_COPIES_PER_TYPE: Record<ResourceType, number> = {
  cask: 14,
  corn: 14,
  barley: 10,
  rye: 10,
  wheat: 10,
};

export function buildResourcePiles(rng: Rng): {
  cask: ResourceCardInstance[];
  corn: ResourceCardInstance[];
  barley: ResourceCardInstance[];
  rye: ResourceCardInstance[];
  wheat: ResourceCardInstance[];
} {
  const out: Record<ResourceType, ResourceCardInstance[]> = {
    cask: [],
    corn: [],
    barley: [],
    rye: [],
    wheat: [],
  };

  for (const type of RESOURCE_TYPES) {
    const plainCount = PLAIN_COPIES_PER_TYPE[type];
    for (let i = 0; i < plainCount; i++) {
      out[type].push({
        instanceId: mintInstanceId("r"),
        resource: type,
        specialtyId: null,
      });
    }
  }

  for (const card of SPECIALTY_RESOURCES) {
    const type = card.play.resource;
    // Skip "multi" / cross-type specialty cards for now — they don't cleanly belong
    // to a single market pile. Reintroduce once the draw UX supports picking a type.
    if (type !== "cask" && type !== "corn" && type !== "barley" && type !== "rye" && type !== "wheat") {
      continue;
    }
    out[type].push({
      instanceId: mintInstanceId("r"),
      resource: type,
      specialtyId: card.id,
    });
  }

  return {
    cask: shuffle(rng, out.cask),
    corn: shuffle(rng, out.corn),
    barley: shuffle(rng, out.barley),
    rye: shuffle(rng, out.rye),
    wheat: shuffle(rng, out.wheat),
  };
}

export function buildBourbonDeck(rng: Rng): string[] {
  const ids: string[] = [];
  for (const c of BOURBON_CARDS) {
    const copies = c.rarity === "Rare" ? 1 : 2;
    for (let i = 0; i < copies; i++) ids.push(c.id);
  }
  return shuffle(rng, ids);
}

export function buildInvestmentDeck(rng: Rng): string[] {
  const ids: string[] = [];
  for (const c of INVESTMENT_CARDS) {
    for (let i = 0; i < c.deckCopies; i++) ids.push(c.id);
  }
  return shuffle(rng, ids);
}

export function buildOperationsDeck(rng: Rng): string[] {
  const ids = OPERATIONS_CARDS.map((c) => c.id);
  return shuffle(rng, ids);
}

/**
 * Phase 3 market deck. Built from MARKET_CARDS catalog with per-card copies.
 */
export function buildMarketDeck(rng: Rng): string[] {
  const ids: string[] = [];
  for (const c of MARKET_CARDS) {
    for (let i = 0; i < c.deckCopies; i++) ids.push(c.id);
  }
  return shuffle(rng, ids);
}

/**
 * Distillery draft deck. One copy of every Distillery card. Each baron
 * draws 2 face-down at game start; the unkept card returns to the deck
 * and the deck is reshuffled before the next baron drafts (handled in
 * setup, not here).
 */
export function buildDistilleryDeck(rng: Rng): string[] {
  const ids = DISTILLERY_CARDS.map((c) => c.id);
  return shuffle(rng, ids);
}

/** Draw the top card from a pile; returns [drawn, rest]. Null if empty. */
export function drawTop<T>(pile: T[]): [T | null, T[]] {
  if (pile.length === 0) return [null, pile];
  const rest = pile.slice(0, -1);
  const drawn = pile[pile.length - 1];
  return [drawn, rest];
}
