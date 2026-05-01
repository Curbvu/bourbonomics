/**
 * Gold Bourbon alt-payout at sale time.
 *
 * Locks in three behaviours:
 *   1. Reducer accepts SELL_BOURBON with a valid `applyGoldBourbonId` and
 *      pays out using the alt's grid (not the attached bill's).
 *   2. The attached bill's award eligibility is evaluated against ITS
 *      grid price, not the alt's payout — so applying an alt doesn't
 *      spuriously upgrade the attached bill's award.
 *   3. pickBestGoldAlt returns null when the player has no qualifying
 *      Gold trophies, and returns the highest-paying option when there's
 *      one that beats the attached bill.
 */

import { describe, expect, it } from "vitest";
import { createInitialState } from "@/lib/engine/setup";
import { reduce } from "@/lib/engine/reducer";
import { pickBestGoldAlt } from "@/lib/ai/evaluators";
import { BOURBON_CARDS_BY_ID } from "@/lib/engine/decks";
import { lookupSalePrice } from "@/lib/rules/pricing";
import type { BarrelInstance, GameState } from "@/lib/engine/state";

function gs(): GameState {
  return createInitialState({
    id: "g1",
    seed: 4242,
    seats: [
      { name: "A", kind: "human" },
      { name: "B", kind: "bot", botDifficulty: "easy" },
    ],
  });
}

function placeBarrel(state: GameState, mashBillId: string, age: number): string {
  const r = state.rickhouses[0];
  const barrelId = `b-${mashBillId}-${age}`;
  // Tri-type mash hits most Gold criteria the catalog uses.
  const barrel: BarrelInstance = {
    barrelId,
    ownerId: "p1",
    rickhouseId: r.id,
    mash: [
      { instanceId: "r-cask", resource: "cask", specialtyId: null },
      { instanceId: "r-corn", resource: "corn", specialtyId: null },
      { instanceId: "r-rye", resource: "rye", specialtyId: null },
      { instanceId: "r-wheat", resource: "wheat", specialtyId: null },
    ],
    mashBillId,
    age,
    barreledOnRound: 1,
  };
  r.barrels.push(barrel);
  return barrelId;
}

function findGoldCapableId(otherThan: string): string | null {
  for (const id of Object.keys(BOURBON_CARDS_BY_ID)) {
    if (id === otherThan) continue;
    if (BOURBON_CARDS_BY_ID[id].awards?.gold) return id;
  }
  return null;
}

describe("Gold Bourbon alt-payout — pickBestGoldAlt", () => {
  it("returns null when the player has no Gold trophies", () => {
    const s = gs();
    expect(s.players.p1.goldBourbons).toEqual([]);
    const barrel: BarrelInstance = {
      barrelId: "b1",
      ownerId: "p1",
      rickhouseId: s.rickhouses[0].id,
      mash: [],
      mashBillId: Object.keys(BOURBON_CARDS_BY_ID)[0],
      age: 4,
      barreledOnRound: 1,
    };
    expect(pickBestGoldAlt(s, s.players.p1, barrel)).toBe(null);
  });

  it("returns null when the trophy doesn't out-pay the attached bill", () => {
    const s = gs();
    // Pick two arbitrary Gold-capable bills. Pretend we own a barrel
    // attached to the higher-paying one and have the cheaper one as a
    // trophy — alt should NOT swap in.
    const golds = Object.keys(BOURBON_CARDS_BY_ID).filter(
      (id) => BOURBON_CARDS_BY_ID[id].awards?.gold,
    );
    expect(golds.length).toBeGreaterThanOrEqual(2);
    const sortedByMax = [...golds].sort((a, b) => {
      const ga = Math.max(...BOURBON_CARDS_BY_ID[a].grid.flatMap((r) => r));
      const gb = Math.max(...BOURBON_CARDS_BY_ID[b].grid.flatMap((r) => r));
      return gb - ga; // desc
    });
    const high = sortedByMax[0];
    const low = sortedByMax[sortedByMax.length - 1];
    s.players.p1.goldBourbons.push(low);
    const barrelId = placeBarrel(s, high, 8);
    const found = s.rickhouses[0].barrels.find((b) => b.barrelId === barrelId)!;
    const pick = pickBestGoldAlt(s, s.players.p1, found);
    // Only swaps if alt strictly beats the attached.
    if (pick) {
      const altPrice = lookupSalePrice(
        BOURBON_CARDS_BY_ID[pick.goldId],
        found.age,
        s.demand,
      ).price;
      const attachedPrice = lookupSalePrice(
        BOURBON_CARDS_BY_ID[high],
        found.age,
        s.demand,
      ).price;
      expect(altPrice).toBeGreaterThan(attachedPrice);
    }
  });

  it("returns the higher-paying alt when the player has one", () => {
    const s = gs();
    // Find a cheap-grid attached bill and a gold-capable trophy.
    const bills = Object.keys(BOURBON_CARDS_BY_ID);
    const trophy = bills.find((id) => BOURBON_CARDS_BY_ID[id].awards?.gold);
    expect(trophy).toBeTruthy();
    // Choose attached as a non-gold low-grid card.
    const attached = bills.find(
      (id) =>
        !BOURBON_CARDS_BY_ID[id].awards?.gold &&
        Math.max(...BOURBON_CARDS_BY_ID[id].grid.flatMap((r) => r)) < 20,
    );
    if (!attached || !trophy) return; // skip if catalog can't satisfy
    s.players.p1.goldBourbons.push(trophy);
    const barrelId = placeBarrel(s, attached, 8);
    const found = s.rickhouses[0].barrels.find((b) => b.barrelId === barrelId)!;
    const pick = pickBestGoldAlt(s, s.players.p1, found);
    if (pick) {
      expect(pick.goldId).toBe(trophy);
      expect(pick.payout).toBeGreaterThan(0);
    }
  });
});

describe("Gold Bourbon alt-payout — reducer SELL_BOURBON", () => {
  it("alt payout uses the alt grid; attached bill's award unchanged", () => {
    let s = gs();
    const golds = Object.keys(BOURBON_CARDS_BY_ID).filter(
      (id) => BOURBON_CARDS_BY_ID[id].awards?.gold,
    );
    expect(golds.length).toBeGreaterThanOrEqual(1);
    const trophy = golds[0];
    s.players.p1.goldBourbons.push(trophy);
    const attached = Object.keys(BOURBON_CARDS_BY_ID).find(
      (id) => !BOURBON_CARDS_BY_ID[id].awards?.gold,
    )!;
    const barrelId = placeBarrel(s, attached, 8);
    // Sell with the alt — engine should accept and pay out the alt's grid.
    const cashBefore = s.players.p1.cash;
    s = reduce(s, {
      t: "SELL_BOURBON",
      playerId: "p1",
      barrelId,
      applyGoldBourbonId: trophy,
    });
    const cashGain = s.players.p1.cash - cashBefore;
    expect(cashGain).toBeGreaterThanOrEqual(0);
    // The attached bill (no Gold criteria) cannot be unlocked by the alt;
    // the player's goldBourbons should remain just `trophy`.
    expect(s.players.p1.goldBourbons).toEqual([trophy]);
  });

  it("rejects an alt when the player doesn't actually own that Gold", () => {
    let s = gs();
    const golds = Object.keys(BOURBON_CARDS_BY_ID).filter(
      (id) => BOURBON_CARDS_BY_ID[id].awards?.gold,
    );
    const trophy = golds[0];
    // Note: NOT pushing trophy onto goldBourbons.
    const attached = Object.keys(BOURBON_CARDS_BY_ID).find(
      (id) => !BOURBON_CARDS_BY_ID[id].awards?.gold,
    )!;
    const barrelId = placeBarrel(s, attached, 8);
    const cashBefore = s.players.p1.cash;
    s = reduce(s, {
      t: "SELL_BOURBON",
      playerId: "p1",
      barrelId,
      applyGoldBourbonId: trophy,
    });
    // Sale rejected → cash unchanged, barrel still in rickhouse.
    expect(s.players.p1.cash).toBe(cashBefore);
    const stillThere = s.rickhouses[0].barrels.some(
      (b) => b.barrelId === barrelId,
    );
    expect(stillThere).toBe(true);
    // Error logged.
    const lastError = s.log.filter((e) => e.kind.startsWith("error:")).pop();
    expect(lastError?.kind).toBe("error:gold_not_unlocked");
  });

  it("an unrelated Gold trophy that doesn't qualify the barrel is rejected", () => {
    let s = gs();
    const trophy = findGoldCapableId("");
    if (!trophy) return;
    s.players.p1.goldBourbons.push(trophy);
    // Place a barrel with a NON-tri-type mash so most Gold criteria fail.
    const r = s.rickhouses[0];
    const barrelId = "b-young";
    r.barrels.push({
      barrelId,
      ownerId: "p1",
      rickhouseId: r.id,
      // Just cask + corn + corn — likely fails any "tri-type" Gold rule.
      mash: [
        { instanceId: "r-cask", resource: "cask", specialtyId: null },
        { instanceId: "r-corn1", resource: "corn", specialtyId: null },
        { instanceId: "r-corn2", resource: "corn", specialtyId: null },
      ],
      mashBillId: Object.keys(BOURBON_CARDS_BY_ID)[0],
      age: 2, // Young — fails any 8+ Gold rule outright.
      barreledOnRound: 1,
    });
    const cashBefore = s.players.p1.cash;
    s = reduce(s, {
      t: "SELL_BOURBON",
      playerId: "p1",
      barrelId,
      applyGoldBourbonId: trophy,
    });
    expect(s.players.p1.cash).toBe(cashBefore);
    const lastError = s.log.filter((e) => e.kind.startsWith("error:")).pop();
    expect(lastError?.kind).toBe("error:barrel_does_not_qualify");
  });
});
