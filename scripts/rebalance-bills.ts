/**
 * One-off bill rebalance for the post-free-resources economy.
 *
 *   1. Replace 7 specific cards with explicit archetypes (workhorse,
 *      mid-range, patient, demand specialist, gold candidate, specialty,
 *      wheated) — fresh ageBands/demandBands + grid + awards (where
 *      relevant). These names already exist in the YAML; we keep the id
 *      and name and overwrite the rest.
 *
 *   2. For every other card, inject the legacy default bands
 *      (`[2, 4, 8]` / `[0, 4, 7]`) if missing AND scale the grid down by
 *      a flat factor so the existing pool stops printing money. A scaled
 *      cell rounds with `Math.round`; nonzero cells floor at $1 so the
 *      printed grid keeps its shape (and `0` continues to mean blank).
 *
 * Run once: `npx tsx scripts/rebalance-bills.ts`. After this lands the
 * file becomes orphan code; it stays in `scripts/` so the rebalance is
 * reproducible and so future rebalances have a template.
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

type Archetype = {
  id: string;
  ageBands: Triple;
  demandBands: Triple;
  grid: Grid;
  silver?: string;
  gold?: string;
  /** Recipe bounds, written as inline objects in YAML. */
  recipe?: Record<string, { min?: number; max?: number }>;
};

// Existing card IDs we're overwriting. Names are preserved.
//   01 Knob's End 90              → Workhorse "Backroad Batch" feel
//   09 Mash Bill No. 7            → Mid-Range Reliable
//   46 Bonded Beyond              → Patient House
//   36 Copper Crossings 107       → Demand Specialist
//   58 Heirloom 1899? → use 58 Copper Cadence (Rare)  → Gold Candidate
//   45 Wild Rickhouse             → Specialty / Risky
//   15 Wheat Whisper              → Wheated Comfort
const ARCHETYPES: Archetype[] = [
  // Workhorse — modest payouts, no blanks, easy bands
  {
    id: "01",
    ageBands: [2, 4, 6],
    demandBands: [2, 4, 6],
    grid: [
      [1, 2, 3],
      [2, 4, 5],
      [3, 5, 6],
    ],
  },
  // Mid-range reliable — vanilla balanced bill
  {
    id: "09",
    ageBands: [3, 5, 8],
    demandBands: [3, 5, 8],
    grid: [
      [2, 3, 4],
      [3, 5, 7],
      [4, 7, 10],
    ],
  },
  // Patient house — pays nothing young, big late
  {
    id: "46",
    ageBands: [6, 8, 10],
    demandBands: [6, 8, 12],
    grid: [
      [0, 5, 9],
      [5, 11, 16],
      [9, 16, 22],
    ],
    silver:
      "Barrel **≥8 years** **and** mash includes **≥2 small grains** (barley + rye + wheat)."
      ,
    gold:
      "Barrel **≥10 years** **and** mash **≥2 small grains** **and** demand **12** at sale (grid **maximum** **$22**).",
  },
  // Demand specialist — narrow band, blank below demand 7
  {
    id: "36",
    ageBands: [3, 6, 9],
    demandBands: [7, 9, 11],
    grid: [
      [0, 4, 7],
      [4, 9, 13],
      [6, 13, 18],
    ],
    silver:
      "Barrel **≥6 years** **and** demand **≥9** at sale.",
  },
  // Gold candidate — clear gold path
  {
    id: "58",
    ageBands: [6, 9, 12],
    demandBands: [6, 9, 12],
    grid: [
      [0, 4, 9],
      [5, 11, 17],
      [10, 18, 26],
    ],
    silver:
      "Barrel **≥9 years** **and** mash includes **≥2 distinct small grains**.",
    gold:
      "Barrel **≥12 years** **and** mash **≥2 distinct small grains** **and** demand **12** at sale (grid **maximum** **$26**).",
  },
  // Specialty / risky — single-grain rye, quirky band stagger
  {
    id: "45",
    ageBands: [2, 5, 8],
    demandBands: [4, 7, 10],
    grid: [
      [2, 4, 7],
      [0, 5, 9],
      [3, 9, 14],
    ],
    silver:
      "All-rye mash **and** demand **≥7** at sale.",
    gold:
      "Barrel **≥10 years** **and** all-rye mash **and** demand **≥10** at sale (grid **maximum** **$14**).",
    recipe: { rye: { min: 3 } },
  },
  // Wheated comfort — smooth, dependable, no spike
  {
    id: "15",
    ageBands: [3, 6, 9],
    demandBands: [4, 6, 8],
    grid: [
      [2, 4, 5],
      [3, 6, 8],
      [4, 8, 11],
    ],
    recipe: { wheat: { min: 1 }, rye: { max: 0 } },
  },
];

const ARCHETYPE_BY_ID = new Map(ARCHETYPES.map((a) => [a.id, a]));

// Scaling factor for the rest of the pool. Picked so that a $26 ceiling
// becomes ~$10 (matches the mid-range archetype) and a $48 ceiling
// becomes ~$19 (close to a gold-candidate ceiling). Nonzero cells floor
// at $1 so the printed grid retains its shape.
const SCALE = 0.4;

function scaleCell(v: number): number {
  if (v <= 0) return 0;
  const scaled = Math.round(v * SCALE);
  return scaled < 1 ? 1 : scaled;
}

function scaleGrid(grid: Grid): Grid {
  return grid.map((row) => row.map(scaleCell));
}

function rebalance(doc: Document): number {
  const root = doc.contents;
  if (!isMap(root)) throw new Error("Expected a YAML map at the root");
  const cardsNode = root.get("cards", true);
  if (!isSeq(cardsNode)) throw new Error("Expected `cards` to be a sequence");

  let touched = 0;
  for (const item of cardsNode.items) {
    if (!isMap(item)) continue;
    const id = item.get("id");
    if (typeof id !== "string") continue;
    const archetype = ARCHETYPE_BY_ID.get(id);
    if (archetype) {
      applyArchetype(item, archetype);
    } else {
      scaleCard(item);
    }
    touched += 1;
  }
  return touched;
}

function applyArchetype(node: YAMLMap, a: Archetype): void {
  // Bands as flow-style inline arrays (compact in YAML output).
  node.set("ageBands", flowArray(a.ageBands));
  node.set("demandBands", flowArray(a.demandBands));
  node.set("grid", buildGridNode(a.grid));
  if (a.silver || a.gold) {
    const awards: Record<string, string | null> = {};
    if (a.silver) awards.silver = a.silver;
    if (a.gold) awards.gold = a.gold;
    node.set("awards", awards);
  } else {
    node.set("awards", null);
  }
  if (a.recipe) {
    node.set("recipe", a.recipe);
  } else if (node.has("recipe")) {
    node.delete("recipe");
  }
  // Drop any stale brandValue — generator will recompute from gridMax.
  if (node.has("brandValue")) node.delete("brandValue");
}

function scaleCard(node: YAMLMap): void {
  const grid = node.get("grid", true);
  if (!isSeq(grid)) return;
  const raw: Grid = grid.toJSON();
  if (!Array.isArray(raw) || raw.length !== 3) return;
  const scaled = scaleGrid(raw);
  node.set("grid", buildGridNode(scaled));

  // Inject legacy defaults so the data file is self-describing post-rebalance.
  if (!node.has("ageBands")) node.set("ageBands", flowArray([2, 4, 8]));
  if (!node.has("demandBands")) node.set("demandBands", flowArray([0, 4, 7]));

  // brandValue is regenerated from the new grid.
  if (node.has("brandValue")) node.delete("brandValue");
}

function flowArray(t: Triple) {
  // Build a compact flow-style sequence node so the YAML reads
  // `ageBands: [2, 4, 6]` instead of three child lines. The yaml
  // package preserves the `flow` flag we set on a Seq.
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

function main() {
  const path = resolve(process.cwd(), "data", "bourbon_cards.yaml");
  const src = readFileSync(path, "utf8");
  const doc = parseDocument(src);
  const touched = rebalance(doc);
  const out = doc.toString({
    lineWidth: 0,
    minContentWidth: 0,
    doubleQuotedAsJSON: false,
  });
  writeFileSync(path, out, "utf8");
  console.log(`rebalanced ${touched} cards`);
  console.log(`  archetypes overwritten: ${ARCHETYPES.length}`);
  console.log(`  legacy cards scaled:    ${touched - ARCHETYPES.length}`);
}

main();
