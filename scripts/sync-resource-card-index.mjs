/**
 * Reads docs/resource_cards.yaml and writes:
 * - lib/resourceCardIndex.generated.json — kinds, grainSlotCost, dualCornGrainIds
 * - lib/resourceSellModeled.generated.json — id → modeled on_sell ops
 * - lib/resourceMakeModeled.generated.json — id → modeled on_make_bourbon ops
 * - lib/resourceDeckPools.generated.json — specialty ids by deck tier (for buildResourceDeck)
 *
 * Run: npm run sync:resource-cards
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const yamlPath = join(root, "docs", "resource_cards.yaml");
const kindOut = join(root, "lib", "resourceCardIndex.generated.json");
const sellOut = join(root, "lib", "resourceSellModeled.generated.json");
const poolsOut = join(root, "lib", "resourceDeckPools.generated.json");

const DEFAULT_CATEGORY_RESOURCE = {
  cask_specialty: "cask",
  corn_specialty: "corn",
  barley_specialty: "barley",
  rye_specialty: "rye",
  wheat_specialty: "wheat",
  cross_type_rare_promos_optional: "multi",
  strong_special_tier_a: "multi",
  global_swing_tier_b: "multi",
  detrimental_soft: "multi",
};

const SPECIAL_POOL_CATEGORIES = new Set([
  "cask_specialty",
  "corn_specialty",
  "barley_specialty",
  "rye_specialty",
  "wheat_specialty",
  "cross_type_rare_promos_optional",
]);

const raw = readFileSync(yamlPath, "utf8");
const doc = parse(raw);

if (!doc?.categories || !Array.isArray(doc.categories)) {
  throw new Error("resource_cards.yaml: expected categories[]");
}

/** @type {Record<string, string>} */
const kinds = {};
/** @type {Record<string, number>} */
const grainSlotCost = {};
/** @type {string[]} */
const dualCornGrainIds = [];
/** @type {Record<string, unknown[]>} */
const sellModeled = {};
/** @type {Record<string, unknown[]>} */
const makeModeled = {};
const pools = {
  special: /** @type {string[]} */ ([]),
  strong_special: /** @type {string[]} */ ([]),
  global_swing: /** @type {string[]} */ ([]),
  detrimental: /** @type {string[]} */ ([]),
};

for (const cat of doc.categories) {
  const catId = cat.id;
  const fallback = DEFAULT_CATEGORY_RESOURCE[catId] ?? "multi";
  for (const c of cat.cards ?? []) {
    if (!c.id) continue;
    const play = c.play;
    const r = play?.resource ?? fallback;
    kinds[c.id] = r;
    const gsc = play?.grain_slot_cost;
    if (typeof gsc === "number" && gsc > 0) grainSlotCost[c.id] = gsc;
    const flags = play?.flags;
    if (Array.isArray(flags) && flags.includes("counts_as_corn_and_one_grain")) {
      dualCornGrainIds.push(c.id);
    }
    if (play?.engine === "modeled" && Array.isArray(play.on_sell) && play.on_sell.length) {
      sellModeled[c.id] = play.on_sell;
    }
    if (play?.engine === "modeled" && Array.isArray(play.on_make_bourbon) && play.on_make_bourbon.length) {
      makeModeled[c.id] = play.on_make_bourbon;
    }
    if (catId === "strong_special_tier_a") pools.strong_special.push(c.id);
    else if (catId === "global_swing_tier_b") pools.global_swing.push(c.id);
    else if (catId === "detrimental_soft") pools.detrimental.push(c.id);
    else if (SPECIAL_POOL_CATEGORIES.has(catId)) pools.special.push(c.id);
  }
}

const makeOut = join(root, "lib", "resourceMakeModeled.generated.json");

writeFileSync(
  kindOut,
  `${JSON.stringify(
    { version: 1, kinds, grainSlotCost, dualCornGrainIds },
    null,
    2
  )}\n`,
  "utf8"
);
writeFileSync(
  sellOut,
  `${JSON.stringify({ version: 1, onSellById: sellModeled }, null, 2)}\n`,
  "utf8"
);
writeFileSync(
  makeOut,
  `${JSON.stringify({ version: 1, onMakeById: makeModeled }, null, 2)}\n`,
  "utf8"
);
writeFileSync(
  poolsOut,
  `${JSON.stringify({ version: 1, targetTotalCards: 230, pools }, null, 2)}\n`,
  "utf8"
);

console.log(
  `Wrote kinds=${Object.keys(kinds).length}, modeled on_sell=${Object.keys(sellModeled).length}, on_make=${Object.keys(makeModeled).length}, pools=` +
    JSON.stringify({
      special: pools.special.length,
      strong_special: pools.strong_special.length,
      global_swing: pools.global_swing.length,
      detrimental: pools.detrimental.length,
    })
);
