import generated from "./resourceCardIndex.generated.json";

const LEGACY_KIND: Record<string, string> = {
  Cask: "cask",
  Corn: "corn",
  Barley: "barley",
  Rye: "rye",
  Wheat: "wheat",
};

const dualCornGrainSet = new Set(generated.dualCornGrainIds ?? []);
const grainSlotCostMap: Record<string, number> =
  (generated as { grainSlotCost?: Record<string, number> }).grainSlotCost ?? {};
const kinds: Record<string, string> = generated.kinds ?? {};

/** Base resource kind (lowercase), for pile routing and mash typing. */
export function resourceBaseKind(cardId: string): string {
  const legacy = LEGACY_KIND[cardId];
  if (legacy) return legacy;
  return kinds[cardId] ?? "multi";
}

export function isCaskResource(cardId: string): boolean {
  return resourceBaseKind(cardId) === "cask";
}

export function isDualCornGrainCard(cardId: string): boolean {
  return dualCornGrainSet.has(cardId);
}

/** Corn contribution toward mash (includes heritage dual). */
export function mashCountsAsCorn(cardId: string): boolean {
  if (isDualCornGrainCard(cardId)) return true;
  return resourceBaseKind(cardId) === "corn";
}

/** Grain contribution: small grains, multi, and heritage dual. */
export function mashCountsAsGrain(cardId: string): boolean {
  if (isDualCornGrainCard(cardId)) return true;
  const k = resourceBaseKind(cardId);
  return k === "barley" || k === "rye" || k === "wheat" || k === "multi";
}

/** Barley / Rye / Wheat only (specialty ids included). */
export function isSmallGrainResource(cardId: string): boolean {
  const k = resourceBaseKind(cardId);
  return k === "barley" || k === "rye" || k === "wheat";
}

export function mashGrainSlotCost(cardId: string): number {
  return grainSlotCostMap[cardId] ?? 1;
}

export function cornGrainSlotsUsed(mashCardIds: string[]): number {
  let n = 0;
  for (const id of mashCardIds) {
    if (isCaskResource(id)) continue;
    n += mashGrainSlotCost(id);
  }
  return n;
}

export type MarketPileKey = "cask" | "corn" | "grain";

export function marketPileForResourceCard(cardId: string): MarketPileKey {
  const k = resourceBaseKind(cardId);
  if (k === "cask") return "cask";
  if (k === "corn") return "corn";
  return "grain";
}

/** Corn cards in mash (dual corn+grain counts as one corn). */
export function countMashCorn(mash: string[]): number {
  let n = 0;
  for (const id of mash) {
    if (isDualCornGrainCard(id)) n += 1;
    else if (resourceBaseKind(id) === "corn") n += 1;
  }
  return n;
}

/** Barley / Rye / Wheat cards only (specialty ids included). */
export function countMashSmallGrains(mash: string[]): number {
  let n = 0;
  for (const id of mash) {
    if (isSmallGrainResource(id)) n += 1;
  }
  return n;
}

export function mashIncludesRye(mash: string[]): boolean {
  return mash.some((id) => resourceBaseKind(id) === "rye");
}
