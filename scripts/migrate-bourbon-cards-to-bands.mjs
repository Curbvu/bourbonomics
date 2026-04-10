/**
 * One-off: convert docs/bourbon_cards.yaml from legacy stepped demand/ages columns
 * to a fixed 3×3 grid (age bands × demand bands). Preserves awards/intro.
 *
 * Run: node scripts/migrate-bourbon-cards-to-bands.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse, stringify } from "yaml";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const yamlPath = join(root, "docs", "bourbon_cards.yaml");

function oldIndices(card, barrelAge, marketDemand) {
  let row = 0;
  for (let i = 0; i < card.ages.length; i++) {
    if (card.ages[i] <= barrelAge) row = i;
  }
  let col = 0;
  if (marketDemand > 0) {
    for (let j = 0; j < card.demand.length; j++) {
      if (card.demand[j] <= marketDemand) col = j;
    }
  }
  return { row, col };
}

function oldPayoutAt(card, barrelAge, marketDemand) {
  if (marketDemand <= 0) {
    return Math.min(Math.max(0, barrelAge), 12);
  }
  const { row, col } = oldIndices(card, barrelAge, marketDemand);
  const rowVals = card.grid[row];
  if (!rowVals) return 0;
  return rowVals[col] ?? 0;
}

/** Representative ages/demands for each new band (matches game rules). */
const AGE_REPS = [3, 6, 10];
const DEM_REPS = [3, 5, 12];

const raw = readFileSync(yamlPath, "utf8");
const doc = parse(raw);

if (!doc?.cards || !Array.isArray(doc.cards)) {
  throw new Error("Expected bourbon_cards.yaml with cards[]");
}

for (const c of doc.cards) {
  if (!c.grid || !Array.isArray(c.ages) || !Array.isArray(c.demand)) {
    console.warn(`Skip ${c.id} (already migrated or invalid)`);
    continue;
  }
  const newGrid = [];
  for (let ri = 0; ri < 3; ri++) {
    const row = [];
    for (let ci = 0; ci < 3; ci++) {
      row.push(oldPayoutAt(c, AGE_REPS[ri], DEM_REPS[ci]));
    }
    newGrid.push(row);
  }
  delete c.demand;
  delete c.ages;
  c.grid = newGrid;
}

const out = stringify(doc, {
  lineWidth: 0,
  defaultStringType: "QUOTE_DOUBLE",
  defaultKeyType: "PLAIN",
});

writeFileSync(yamlPath, out, "utf8");
console.log(`Migrated ${doc.cards.length} cards → fixed 3×3 bands in ${yamlPath}`);
