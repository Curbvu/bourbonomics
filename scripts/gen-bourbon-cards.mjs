import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import YAML from "yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, "..", "docs", "bourbon_cards.yaml");

const cards = [
  ["Knob's End 90", "Standard"],
  ["Mammoth Cave Malt", "Standard"],
  ["Bardstown Boiler", "Standard"],
  ["Limestone Ledger", "Standard"],
  ["Charred Oak Exchange", "Standard"],
  ["Riverbend Rye Signal", "Standard"],
  ["Stave & Story", "Standard"],
  ["Cooper's Quorum", "Standard"],
  ["Mash Bill No. 7", "Standard"],
  ["High Rickhouse Select", "Standard"],
  ["Warehouse E Batch", "Standard"],
  ["Foggy Bottom Forge", "Standard"],
  ["Cornbread Line", "Standard"],
  ["Rye Ladder 95", "Standard"],
  ["Wheat Whisper", "Standard"],
  ["Barley Bastion", "Standard"],
  ["Two Charring Points", "Standard"],
  ["Angel's Trace", "Standard"],
  ["Bonded & Bold", "Standard"],
  ["Cork & Crown", "Standard"],
  ["Proof Positive 100", "Standard"],
  ["Sour Mash Society", "Standard"],
  ["Stillhouse Sonnet", "Standard"],
  ["Patent Still 04", "Standard"],
  ["Kentucky Crosscut", "Standard"],
  ["Oak Algebra", "Standard"],
  ["Bottled Lightning 86", "Standard"],
  ["Copper Trace", "Standard"],
  ["Bluegrass Boiler", "Standard"],
  ["Rickhouse Arithmetic", "Standard"],
  ["Filtered Lore", "Standard"],
  ["Low Gauge Legacy", "Standard"],
  ["Steam Furnace Five", "Standard"],
  ["Grist Galaxy", "Standard"],
  ["Turf & Tarnish", "Standard"],
  ["Copper Crossings 107", "Rare"],
  ["Seven Stars Odd Lot", "Rare"],
  ["State Line BiB", "Rare"],
  ["Barrel Thief Reserve", "Rare"],
  ["Ghost Warehouse", "Rare"],
  ["Double Stack Destiny", "Rare"],
  ["Crimson Corn Covenant", "Rare"],
  ["Platinum Rick Proof", "Rare"],
  ["Infinite Stave", "Rare"],
  ["Crown Compass", "Rare"],
  ["Ledger Luxe", "Rare"],
  ["Wild Rickhouse", "Rare"],
  ["Bonded Beyond", "Rare"],
  ["Oak Oracle", "Rare"],
  ["The Last Rick", "Rare"],
];

const STANDARD_WITH_AWARDS = new Set([
  "Cooper's Quorum",
  "High Rickhouse Select",
  "Angel's Trace",
  "Bonded & Bold",
  "Proof Positive 100",
  "Grist Galaxy",
]);

const demandPresets = [
  [4, 8, 12],
  [2, 6, 10],
  [3, 7, 11],
  [5, 9, 12],
  [4, 6, 12],
  [2, 8, 12],
  [3, 6, 10],
  [4, 7, 12],
];

function steppy(base, ri, ci, seed, rarity) {
  const bump = (seed * (ri + 3) * (ci + 5)) % 9;
  const zig = ((ri * 5 + ci * 7 + seed) % 6) - 2;
  let v = base + bump + zig;
  if (rarity === "Rare") v = Math.round(v * 2.25) + ((seed + ri + ci) % 7);
  return Math.max(rarity === "Rare" ? 8 : 2, v);
}

function buildGrid(rarity, index) {
  const seed = index * 17 + 31;
  const use4Age = index % 7 === 0 || index % 11 === 0;
  const ages = use4Age ? [2, 3, 4, 6] : [2, 4, 6];
  const d = demandPresets[index % demandPresets.length];
  const rows = ages.map((_, ri) =>
    d.map((_, ci) => {
      const base = 3 + ri * 4 + ci * 3 + (index % 4) * 2;
      return steppy(base, ri, ci, seed + index + ri * 10 + ci, rarity);
    })
  );
  return { ages, demand: d, rows };
}

function maxCell(rows) {
  return Math.max(...rows.flat());
}

function hasAwards(rarity, name) {
  if (rarity === "Rare") return true;
  return STANDARD_WITH_AWARDS.has(name);
}

const introBody = [
  "Named **Bourbon Market Price Guide** cards for *Bourbonomics*. Each card is a specific product line. Grids use **2–4** age rows (top age **6** max) and **2–4** demand columns; payoffs are **steppy** (uneven jumps). **Standard** cards are common; **Rare** cards are fewer copies with higher ceilings.",
  "",
  "**Silver / Gold awards** appear only on **Rare** cards and a small set of **flagship Standard** lines—not every bottle chases a medal. Cards without award lines still sell using the Market Price Guide only.",
  "",
  "Lookup matches **GAME_RULES.md** (highest age row ≤ your bourbon age, highest demand column ≤ market demand). **Demand 0** uses **GAME_RULES**.",
].join("\n");

const cardDocs = cards.map(([name, rarity], idx) => {
  const { ages, demand, rows } = buildGrid(rarity, idx);
  const id = String(idx + 1).padStart(2, "0");
  const peak = maxCell(rows);
  let awards = null;
  if (hasAwards(rarity, name)) {
    const silverTh =
      rarity === "Rare" ? Math.max(20, peak - 16) : Math.max(9, peak - 7);
    const goldTh = peak;
    const silverLine =
      rarity === "Rare"
        ? `Market demand is **odd** at sale, **or** sell price **≥ $${silverTh}** on this card.`
        : `sell price **≥ $${silverTh}** on this card.`;
    const goldLine = `Sell **≥ $${goldTh}** on this card (any qualifying cell; grid **maximum** is **$${goldTh}**).`;
    awards = { silver: silverLine, gold: goldLine };
  }
  return {
    id,
    name,
    rarity,
    demand,
    ages,
    grid: rows,
    awards,
  };
});

const doc = {
  version: 1,
  kind: "bourbon_cards_v1",
  intro: {
    title: "Bourbon cards",
    body: introBody,
  },
  cards: cardDocs,
};

const yamlText = YAML.stringify(doc, {
  aliasDuplicateObjects: false,
  lineWidth: 120,
  defaultKeyType: "PLAIN",
  defaultStringType: "PLAIN",
});

fs.writeFileSync(outPath, yamlText, "utf8");
console.log("Wrote", outPath);
