// Bourbonomics: Map Game — bourbon content (brief v4 §15a).
//
// 25 bourbons (8 premium = 32%). No PROOF tag. Every tag but PREMIUM is factual
// (licensing invariant). Premium bourbons are EXCLUDED from the opening draft
// (brief §5.4) — the 17 non-premium are draftable at setup; premium enters the
// market only from age 1 on. All values [PH].

import { age, bonded, premium, rye, singleBarrel, smallBatch, traditional, wheat, type Tag } from "../tags";
import type { BourbonDef } from "../types";

const SEEDS: { name: string; tags: Tag[] }[] = [
  // ── NON-PREMIUM (17, draftable at setup) ──
  { name: "House Traditional", tags: [traditional(), age(4)] },
  { name: "Everyday Rye", tags: [rye(), age(4)] },
  { name: "Weller-Style Wheat", tags: [wheat(), age(6)] },
  { name: "Bar Pour", tags: [traditional(), age(4)] },
  { name: "Well Whiskey", tags: [traditional(), age(4)] },
  { name: "Rail Rye", tags: [rye(), age(4)] },
  { name: "Rye Bomb", tags: [rye(), rye()] },
  { name: "Wheat Whale", tags: [wheat(), wheat()] },
  { name: "Double Rye Bonded", tags: [rye(), rye(), bonded()] },
  { name: "Bonded Rye", tags: [rye(), bonded(), age(8)] },
  { name: "Bonded Wheat", tags: [wheat(), bonded(), age(8)] },
  { name: "Small Batch Rye", tags: [rye(), smallBatch(), age(8)] },
  { name: "Single Barrel Trad", tags: [traditional(), singleBarrel(), age(8)] },
  { name: "Cask Strength Wheat", tags: [wheat(), singleBarrel(), age(10)] },
  { name: "Barrel Proof Rye", tags: [rye(), bonded(), age(8)] },
  { name: "Small Batch Wheat", tags: [wheat(), smallBatch(), age(6)] },
  { name: "Bottled in Bond Trad", tags: [traditional(), bonded(), age(6)] },

  // ── PREMIUM (8, market only — NOT in opening draft) ──
  { name: "Allocated Rye", tags: [rye(), premium(), age(12)] },
  { name: "Allocated Wheat", tags: [wheat(), premium(), age(12)] },
  { name: "Barrel Select", tags: [singleBarrel(), premium(), age(10)] },
  { name: "Reserve Traditional", tags: [traditional(), premium(), age(12)] },
  { name: "The Rye Unicorn", tags: [rye(), singleBarrel(), premium(), age(15)] },
  { name: "Pappy-Style 20", tags: [wheat(), smallBatch(), premium(), age(20)] },
  { name: "Dusty Legend", tags: [traditional(), bonded(), premium(), age(23)] },
  { name: "Gift Shop Grail", tags: [singleBarrel(), bonded(), premium(), age(15)] },
];

export function buildBourbonDefs(): BourbonDef[] {
  return SEEDS.map((s, i) => ({ defId: `bourbon_${i + 1}`, name: s.name, tags: s.tags }));
}

/** True if a bourbon carries the PREMIUM tag (excluded from the opening draft). */
export function isPremiumDef(def: BourbonDef): boolean {
  return def.tags.some((t) => t.kind === "QUALITY" && t.value === "PREMIUM");
}
