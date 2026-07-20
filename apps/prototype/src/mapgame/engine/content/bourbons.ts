// Bourbonomics: Map Game — bourbon content (brief v3 §14a).
//
// 20 bourbons, verbatim from the brief. No PROOF tag. Every tag but PREMIUM is
// factual (licensing invariant). All values [PH].

import { age, bonded, premium, rye, singleBarrel, smallBatch, traditional, wheat, type Tag } from "../tags";
import type { BourbonDef } from "../types";

const SEEDS: { name: string; tags: Tag[] }[] = [
  { name: "House Traditional", tags: [traditional(), age(4)] },
  { name: "Everyday Rye", tags: [rye(), age(4)] },
  { name: "Weller-Style Wheat", tags: [wheat(), age(6)] },
  { name: "Bar Pour", tags: [traditional(), age(4)] },
  { name: "Rye Bomb", tags: [rye(), rye()] },
  { name: "Wheat Whale", tags: [wheat(), wheat()] },
  { name: "Double Rye Bonded", tags: [rye(), rye(), bonded()] },
  { name: "Bonded Rye", tags: [rye(), bonded(), age(8)] },
  { name: "Bonded Wheat", tags: [wheat(), bonded(), age(8)] },
  { name: "Small Batch Rye", tags: [rye(), smallBatch(), age(8)] },
  { name: "Single Barrel Trad", tags: [traditional(), singleBarrel(), age(8)] },
  { name: "Cask Strength Wheat", tags: [wheat(), singleBarrel(), age(10)] },
  { name: "Barrel Proof Rye", tags: [rye(), bonded(), age(8)] },
  { name: "Allocated Rye", tags: [rye(), age(12), premium()] },
  { name: "Allocated Wheat", tags: [wheat(), age(12), premium()] },
  { name: "Barrel Select", tags: [singleBarrel(), age(10), premium()] },
  { name: "The Rye Unicorn", tags: [rye(), singleBarrel(), age(15), premium()] },
  { name: "Pappy-Style 20", tags: [wheat(), smallBatch(), age(20), premium()] },
  { name: "Dusty Legend", tags: [traditional(), bonded(), age(23), premium()] },
  { name: "Gift Shop Grail", tags: [singleBarrel(), bonded(), age(15), premium()] },
];

export function buildBourbonDefs(): BourbonDef[] {
  return SEEDS.map((s, i) => ({ defId: `bourbon_${i + 1}`, name: s.name, tags: s.tags }));
}
