/**
 * Tier-shaped bourbon rebalance — overwrites every card in
 * data/bourbon_cards.yaml with grid + bands + recipe + awards
 * appropriate to its tier.
 *
 * Distribution (designed-against, 65 cards):
 *   common     40%  →  26
 *   uncommon   30%  →  20
 *   rare       15%  →  10
 *   epic       10%  →   7
 *   legendary   5%  →   3
 *                    ──
 *                    66 (rounds to 65 with one fewer common)
 *
 * Tier shapes (per design direction):
 *   common      "Always a little money." Demand-insensitive flat grid;
 *               every cell pays the same modest amount. No recipe.
 *   uncommon    Slight lift when demand ≥ middle band. Mid-narrow
 *               dispersion, demand 4–6 vs 7+ matters. No recipe.
 *   rare        Age starts to matter — older bands jump up. One
 *               recipe constraint, optional Silver award.
 *   epic        Both age AND demand matter. Lower-left blanks; big
 *               upper-right. Recipe is a 2-grain requirement;
 *               Silver+Gold path.
 *   legendary   Full matrix. Demand < 4 = no sell. Demand 8–9 great,
 *               10+ massive. Age 8/10/15 thresholds. Requires a
 *               complex mash (≥4 grain cards) and a specialty cask.
 *
 * Run once: `npx tsx scripts/retier-bills.ts`. The script preserves
 * existing card ids and names; only data fields are overwritten.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  Document,
  parseDocument,
  isMap,
  isSeq,
  YAMLSeq,
  type YAMLMap,
} from "yaml";

type Triple = [number, number, number];
type Grid = number[][];
type Tier = "common" | "uncommon" | "rare" | "epic" | "legendary";

type Plan = {
  tier: Tier;
  ageBands: Triple;
  demandBands: Triple;
  grid: Grid;
  silver?: string;
  gold?: string;
  recipe?: Record<string, { min?: number; max?: number }>;
};

// ──────────────────────────────────────────────────────────────────────
// Tier templates — each takes a per-card index for light variation.

function commonPlan(i: number): Plan {
  // Mild dispersion across age × demand. Per the design direction:
  //   Age 2: $3 $4 $5 (low / mid / high demand)
  //   Age 3: $4 $5 $6
  //   Age 4+: $6 $7 $8
  // Three flavour variants per cycle so the deck has slight variety
  // even within commons (one bill might pay 1 less or 1 more across
  // the board).
  const cycle = i % 3;
  const bump = cycle - 1; // -1, 0, +1
  const row = (a: number, b: number, c: number) =>
    [a + bump, b + bump, c + bump];
  return {
    tier: "common",
    ageBands: [2, 3, 4],
    demandBands: [0, 4, 6],
    grid: [
      row(3, 4, 5),
      row(4, 5, 6),
      row(6, 7, 8),
    ],
  };
}

function uncommonPlan(i: number): Plan {
  // Slightly more dispersion. Age and demand both matter modestly;
  // every cell still pays. No recipe constraint.
  const cycle = i % 3;
  const bump = cycle - 1; // -1, 0, +1
  const row = (a: number, b: number, c: number) =>
    [a + bump, b + bump, c + bump];
  return {
    tier: "uncommon",
    ageBands: [2, 4, 6],
    demandBands: [0, 4, 7],
    grid: [
      row(4, 5, 7),
      row(5, 7, 9),
      row(7, 9, 12),
    ],
  };
}

function rarePlan(i: number, name: string): Plan {
  // Age starts to really pay off. Every cell still has a value; the
  // top-right corner is genuinely rewarding. Recipe constraint
  // matches the card's name; Silver award for hitting demand + recipe.
  const cycle = i % 3;
  const bump = cycle - 1; // -1, 0, +1
  const row = (a: number, b: number, c: number) =>
    [a + bump, b + bump, c + bump];
  return {
    tier: "rare",
    ageBands: [2, 5, 8],
    demandBands: [0, 5, 8],
    grid: [
      row(5, 7, 10),
      row(7, 10, 14),
      row(10, 15, 20),
    ],
    silver: "Sell at demand **≥5** **and** mash satisfies the bill recipe.",
    recipe: pickRecipeTheme(name) ?? { rye: { min: 2 } },
  };
}

function epicPlan(i: number, name: string): Plan {
  // Per the design direction:
  //   demand bands 4 / 6 / 8
  //   Age 4 row:  10 12 14
  //   Age 7 row:  12 16 20
  //   Age 10+ row: 15 20 25
  // Every cell pays; values escalate sharply with both axes. Recipe
  // is a 2-grain requirement; Silver+Gold path.
  const cycle = i % 3;
  const bump = cycle - 1; // -1, 0, +1
  const row = (a: number, b: number, c: number) =>
    [a + bump, b + bump, c + bump];
  return {
    tier: "epic",
    ageBands: [4, 7, 10],
    demandBands: [4, 6, 8],
    grid: [
      row(10, 12, 14),
      row(12, 16, 20),
      row(15, 20, 25),
    ],
    silver:
      "Barrel **≥7 years** **and** sell at demand **≥6** **and** mash satisfies the recipe.",
    gold:
      "Barrel **≥10 years** **and** demand **≥8** at sale **and** mash satisfies the recipe (grid **maximum** **$" +
      (25 + bump) +
      "**).",
    recipe:
      pickRecipeTheme(name) ?? {
        rye: { min: 2 },
        wheat: { min: 1 },
      },
  };
}

function legendaryPlan(i: number, name: string): Plan {
  // Flagship pieces. Age 8 / 10 / 15 thresholds; demand 4 / 7 / 10.
  // Every cell pays — even a low-demand sale of an 8-year barrel
  // returns something — but the dispersion is huge: the top-right
  // cell pays MASSIVELY, demanding the full recipe (≥4 grain cards
  // + small-grain blend) and the patience to age the barrel 15
  // years through whatever demand swings come.
  const cycle = i % 3;
  const bump = cycle * 2; // 0, +2, +4 (legendaries vary more)
  const row = (a: number, b: number, c: number) =>
    [a + bump, b + bump, c + bump];
  return {
    tier: "legendary",
    ageBands: [8, 10, 15],
    demandBands: [4, 7, 10],
    grid: [
      row(15, 25, 35),
      row(20, 35, 50),
      row(30, 50, 70),
    ],
    silver:
      "Barrel **≥10 years** **and** demand **≥7** at sale **and** mash satisfies the recipe.",
    gold:
      "Barrel **≥15 years** **and** demand **≥10** at sale **and** mash uses **≥4 grain cards** with a specialty cask (grid **maximum** **$" +
      (70 + bump) +
      "**).",
    recipe:
      pickRecipeTheme(name) ?? {
        grain: { min: 4 },
        rye: { min: 1 },
        wheat: { min: 1 },
      },
  };
}

function pickRecipeTheme(
  name: string,
): Record<string, { min?: number; max?: number }> | null {
  const n = name.toLowerCase();
  if (n.includes("rye")) return { rye: { min: 3 } };
  if (n.includes("wheat") || n.includes("foggy")) {
    return { wheat: { min: 1 }, rye: { max: 0 } };
  }
  if (n.includes("corn") || n.includes("crimson")) return { corn: { min: 3 } };
  if (n.includes("barley") || n.includes("malt") || n.includes("bastion")) {
    return { barley: { min: 2 } };
  }
  if (n.includes("grist") || n.includes("quorum") || n.includes("galaxy")) {
    return { barley: { min: 1 }, rye: { min: 1 }, wheat: { min: 1 } };
  }
  return null;
}

// ──────────────────────────────────────────────────────────────────────
// Tier assignment for 65 cards: 26 common, 20 uncommon, 10 rare, 7 epic,
// 3 legendary. Distributed deterministically by index so the result is
// stable across runs and the deck mixes tiers visually.

function tierForIndex(i: number, total: number): Tier {
  // Walk a target table and bucket by index ratio.
  const tiers: Array<{ tier: Tier; count: number }> = [
    { tier: "common", count: 26 },
    { tier: "uncommon", count: 20 },
    { tier: "rare", count: 10 },
    { tier: "epic", count: 7 },
    { tier: "legendary", count: 3 },
  ];
  // Interleave by mod so the deck mixes tiers — not all commons first.
  // Build an order array of tier slots, then shuffle deterministically.
  const slots: Tier[] = [];
  for (const { tier, count } of tiers) {
    for (let k = 0; k < count; k++) slots.push(tier);
  }
  // Trim to exact total (should match 66 → trim to 65 by dropping one
  // common from the end of the slot list).
  while (slots.length > total) slots.pop();
  // Stable mix: pick a coprime stride so position-to-slot is a
  // bijection over `total`. 7 is coprime with 65.
  const stride = 7;
  const mixed: Tier[] = new Array(total);
  for (let p = 0; p < total; p++) {
    const idx = (p * stride) % total;
    mixed[p] = slots[idx];
  }
  return mixed[i] ?? "common";
}

function planFor(i: number, name: string, total: number): Plan {
  const tier = tierForIndex(i, total);
  switch (tier) {
    case "common":
      return commonPlan(i);
    case "uncommon":
      return uncommonPlan(i);
    case "rare":
      return rarePlan(i, name);
    case "epic":
      return epicPlan(i, name);
    case "legendary":
      return legendaryPlan(i, name);
  }
}

function applyPlan(node: YAMLMap, plan: Plan): void {
  node.set("ageBands", flowArray(plan.ageBands));
  node.set("demandBands", flowArray(plan.demandBands));
  node.set("grid", buildGridNode(plan.grid));
  if (plan.silver || plan.gold) {
    const awards: Record<string, string | null> = {};
    if (plan.silver) awards.silver = plan.silver;
    if (plan.gold) awards.gold = plan.gold;
    node.set("awards", awards);
  } else {
    node.set("awards", null);
  }
  if (plan.recipe) {
    node.set("recipe", plan.recipe);
  } else if (node.has("recipe")) {
    node.delete("recipe");
  }
  node.set("tier", plan.tier);
  if (node.has("brandValue")) node.delete("brandValue");
}

function flowArray(t: Triple) {
  const seq = new YAMLSeq<number>();
  seq.flow = true;
  for (const v of t) seq.add(v);
  return seq;
}

function buildGridNode(grid: Grid) {
  const outer = new YAMLSeq();
  for (const row of grid) {
    const inner = new YAMLSeq<number>();
    inner.flow = true;
    for (const v of row) inner.add(v);
    outer.add(inner);
  }
  return outer;
}

function rebalance(doc: Document): { count: number; tally: Record<Tier, number> } {
  const root = doc.contents;
  if (!isMap(root)) throw new Error("Expected a YAML map at the root");
  const cardsNode = root.get("cards", true);
  if (!isSeq(cardsNode)) throw new Error("Expected `cards` to be a sequence");
  const total = cardsNode.items.filter(isMap).length;
  const tally: Record<Tier, number> = {
    common: 0,
    uncommon: 0,
    rare: 0,
    epic: 0,
    legendary: 0,
  };
  let i = 0;
  for (const item of cardsNode.items) {
    if (!isMap(item)) continue;
    const name = (item.get("name") as string) ?? "";
    const plan = planFor(i, name, total);
    applyPlan(item, plan);
    tally[plan.tier] += 1;
    i += 1;
  }
  return { count: i, tally };
}

function main() {
  const path = resolve(process.cwd(), "data", "bourbon_cards.yaml");
  const src = readFileSync(path, "utf8");
  const doc = parseDocument(src);
  const { count, tally } = rebalance(doc);
  const out = doc.toString({
    lineWidth: 0,
    minContentWidth: 0,
    doubleQuotedAsJSON: false,
  });
  writeFileSync(path, out, "utf8");
  console.log(`retiered ${count} cards`);
  for (const tier of [
    "common",
    "uncommon",
    "rare",
    "epic",
    "legendary",
  ] as const) {
    const pct = ((tally[tier] / count) * 100).toFixed(1);
    console.log(`  ${tier}: ${tally[tier]} (${pct}%)`);
  }
}

main();
