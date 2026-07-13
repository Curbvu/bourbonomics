// Bourbonomics: Map Game — content (bourbon offers, action cards).
//
// No printed quality tier: every bourbon is mechanically peer-level. Price
// encodes SHAPE, not strength — narrow & deep (few traits, high ceiling,
// expensive) vs broad & shallow (many traits, low ceiling, cheap).

import { CONFIG } from "./config";
import type { ActionCard, BourbonDef, TasteTrait } from "./types";

interface BourbonDefSeed {
  name: string;
  traits: TasteTrait[];
  basePrice: number;
  ceiling: number;
}

// A small catalog spanning the shape spectrum. defId is assigned on build.
const CATALOG: BourbonDefSeed[] = [
  // — narrow & deep (1 trait, ceiling 3, dear) —
  { name: "Single-Barrel Rye", traits: ["rye"], basePrice: 6, ceiling: 3 },
  { name: "Cask-Strength Wheat", traits: ["wheat"], basePrice: 6, ceiling: 3 },
  { name: "Estate Reserve", traits: ["premium"], basePrice: 7, ceiling: 3 },
  { name: "20-Year Vault", traits: ["aged"], basePrice: 7, ceiling: 3 },
  { name: "Heirloom Corn", traits: ["corn"], basePrice: 6, ceiling: 3 },
  // — mid (1–2 traits, ceiling 2) —
  { name: "Small-Batch Rye", traits: ["rye", "aged"], basePrice: 4, ceiling: 2 },
  { name: "Wheated Reserve", traits: ["wheat", "premium"], basePrice: 5, ceiling: 2 },
  { name: "Bottled-in-Bond", traits: ["aged", "premium"], basePrice: 5, ceiling: 2 },
  { name: "Bonded Corn", traits: ["corn", "aged"], basePrice: 4, ceiling: 2 },
  { name: "Rye & Rickhouse", traits: ["rye", "corn"], basePrice: 4, ceiling: 2 },
  { name: "Sour Mash", traits: ["corn", "premium"], basePrice: 4, ceiling: 2 },
  { name: "Wheated Field", traits: ["wheat", "corn"], basePrice: 4, ceiling: 2 },
  // — broad & shallow (2–3 traits, ceiling 1–2, cheap) —
  { name: "House Blend", traits: ["corn", "rye", "wheat"], basePrice: 3, ceiling: 1 },
  { name: "Table Bourbon", traits: ["corn", "wheat"], basePrice: 2, ceiling: 1 },
  { name: "Everyday Pour", traits: ["corn", "rye"], basePrice: 2, ceiling: 1 },
  { name: "Roadhouse Rye", traits: ["rye", "wheat"], basePrice: 3, ceiling: 1 },
  { name: "Value Barrel", traits: ["corn", "aged"], basePrice: 3, ceiling: 1 },
  { name: "Party Cask", traits: ["corn", "premium", "rye"], basePrice: 3, ceiling: 1 },
];

/** Build a full distill deck — several copies of the catalog, ids assigned. */
export function buildDistillDeck(): BourbonDef[] {
  const out: BourbonDef[] = [];
  let n = 0;
  for (let copy = 0; copy < 3; copy++) {
    for (const seed of CATALOG) {
      out.push({
        defId: `bd_${n++}`,
        name: seed.name,
        traits: [...seed.traits],
        basePrice: seed.basePrice,
        ceiling: seed.ceiling,
      });
    }
  }
  return out;
}

/** A fresh hand of action cards for an age: fewer-bip cards buy initiative. */
export function buildHand(playerId: string, age: number): ActionCard[] {
  // 5 cards spanning 2–4 bips (spec: 2–4). Spread gives real initiative choices.
  const bipsSpread = [2, 2, 3, 3, 4].slice(0, CONFIG.HAND_SIZE);
  return bipsSpread.map((bips, i) => ({ id: `ac_${playerId}_a${age}_${i}`, bips }));
}
