// Bourbonomics: Map Game — the tag system (brief §3).
//
// Tiles and bourbons are both bags of tags. Tags are a MULTISET: a doubled tag
// (e.g. [RYE, RYE]) is two entries, and depth only pays on a tile that also
// doubles it. See fit.ts for the matching rule.
//
// Licensing invariant (brief §17.10): every tag except PREMIUM is a factual
// product spec. No brand can be mechanically advantaged or insulted by a factual
// tag. Never add a branded or judgemental tag.
//
// v3: PROOF was removed. Five slots in canonical order: Grain · Batch · Bonded ·
// Age · Premium (Premium last, the only non-factual tag).
//
// v4: tile-side WILDCARD demand tags — ANYGRAIN / ANYBATCH (brief §3). They sit
// in the grain / batch slot and are satisfied by ANY bourbon carrying that
// category. They are the combat floor (nobody is locked out of common tiles) and
// exist ONLY on tiles; bourbons never carry them. (Distinct from the LOYALTY /
// KEYSTONE owner-declared wildcard, which resolves to a concrete Tag on claim.)

export type Grain = "RYE" | "WHEAT" | "TRADITIONAL";
export type Batch = "SINGLE_BARREL" | "SMALL_BATCH";
export type Quality = "BONDED" | "PREMIUM";
export type Wild = "ANYGRAIN" | "ANYBATCH";

export type Tag =
  | { kind: "GRAIN"; value: Grain }
  | { kind: "BATCH"; value: Batch }
  | { kind: "QUALITY"; value: Quality }
  | { kind: "AGE"; value: number }
  | { kind: "WILD"; value: Wild };

/** The bourbon-side category a tile wildcard draws from (ANYGRAIN → GRAIN). */
export const WILD_CATEGORY: Record<Wild, "GRAIN" | "BATCH"> = {
  ANYGRAIN: "GRAIN",
  ANYBATCH: "BATCH",
};

/** AGE is meet-or-exceed; the rest are exact matches. */
export const THRESHOLD_KINDS = ["AGE"] as const;
export type ThresholdKind = (typeof THRESHOLD_KINDS)[number];

export function isThreshold(tag: Tag): tag is Tag & { kind: ThresholdKind } {
  return tag.kind === "AGE";
}

// ── Constructors ─────────────────────────────────────────────────────
export const rye = (): Tag => ({ kind: "GRAIN", value: "RYE" });
export const wheat = (): Tag => ({ kind: "GRAIN", value: "WHEAT" });
export const traditional = (): Tag => ({ kind: "GRAIN", value: "TRADITIONAL" });
export const singleBarrel = (): Tag => ({ kind: "BATCH", value: "SINGLE_BARREL" });
export const smallBatch = (): Tag => ({ kind: "BATCH", value: "SMALL_BATCH" });
export const bonded = (): Tag => ({ kind: "QUALITY", value: "BONDED" });
export const premium = (): Tag => ({ kind: "QUALITY", value: "PREMIUM" });
export const age = (n: number): Tag => ({ kind: "AGE", value: n });
export const anyGrain = (): Tag => ({ kind: "WILD", value: "ANYGRAIN" });
export const anyBatch = (): Tag => ({ kind: "WILD", value: "ANYBATCH" });

/**
 * Identity of a tag's match SLOT (used by fit). Exact tags match on kind+value;
 * thresholds match on kind alone (the value is a bar to clear, not a key). The
 * canonical GRAIN·BATCH·BONDED·AGE·PREMIUM render order lives in the UI's
 * TagGrid (see ui/theme.tsx), which is the only place order matters.
 */
export function slotKey(tag: Tag): string {
  return isThreshold(tag) ? tag.kind : `${tag.kind}:${tag.value}`;
}

/** Shared by tiles and bourbons so one tag reads identically everywhere. */
export function tagColor(tag: Tag): string {
  switch (tag.kind) {
    case "GRAIN":
      return tag.value === "RYE" ? "#9c3a2e" : tag.value === "WHEAT" ? "#c69749" : "#7a8c3a";
    case "BATCH":
      return tag.value === "SINGLE_BARREL" ? "#3a4a6b" : "#5a6a8b";
    case "QUALITY":
      return tag.value === "BONDED" ? "#5a3e2b" : "#b8912e";
    case "AGE":
      return "#5a3e2b";
    case "WILD":
      return "#6b5a8a";
  }
}
