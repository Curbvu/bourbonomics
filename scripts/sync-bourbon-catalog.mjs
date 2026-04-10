/**
 * Reads canonical `docs/bourbon_cards.yaml` and writes `lib/bourbonCatalog.bundled.json`
 * (grid payout fields only) for bundlers / Lambda. Run via `npm run sync:cards`
 * or automatically from prebuild / predev.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const yamlPath = join(root, "docs", "bourbon_cards.yaml");
const outPath = join(root, "lib", "bourbonCatalog.bundled.json");

const raw = readFileSync(yamlPath, "utf8");
const doc = parse(raw);

if (!doc || typeof doc !== "object" || !Array.isArray(doc.cards)) {
  throw new Error(`Expected bourbon_cards.yaml with a top-level cards[] array`);
}

const cards = doc.cards.map((c) => {
  if (!c || typeof c !== "object") throw new Error("Invalid card entry");
  const { id, name, rarity, grid } = c;
  if (
    typeof id !== "string" ||
    typeof name !== "string" ||
    typeof rarity !== "string" ||
    !Array.isArray(grid)
  ) {
    throw new Error(`Card ${String(id)} missing id, name, rarity, or grid`);
  }
  if (grid.length !== 3 || grid.some((row) => !Array.isArray(row) || row.length !== 3)) {
    throw new Error(
      `Card ${id}: grid must be 3×3 (age bands × demand bands), got ${grid.length} rows`
    );
  }
  return { id, name, rarity, grid };
});

const payload = {
  meta: {
    source: "docs/bourbon_cards.yaml",
    note: "Generated — edit the YAML only, then run npm run sync:cards",
  },
  cards,
};

writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`Wrote ${cards.length} cards → lib/bourbonCatalog.bundled.json`);
