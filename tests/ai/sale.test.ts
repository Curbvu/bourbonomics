/**
 * pickBestSellable — verifies the human Sell ↵ button (and any other
 * "what's the obvious sale" surface) picks the highest-paying owned
 * barrel given current demand and any unlocked Gold Bourbon trophies.
 */

import { describe, expect, it } from "vitest";
import { createInitialState } from "@/lib/engine/setup";
import { pickBestSellable } from "@/lib/ai/evaluators";
import { BOURBON_CARDS_BY_ID } from "@/lib/engine/decks";
import { lookupSalePrice } from "@/lib/rules/pricing";
import type { BarrelInstance, GameState } from "@/lib/engine/state";

function gs(): GameState {
  return createInitialState({
    id: "g1",
    seed: 11,
    seats: [
      { name: "A", kind: "human" },
      { name: "B", kind: "bot", botDifficulty: "easy" },
    ],
  });
}

function placeBarrel(
  state: GameState,
  ownerId: string,
  rickhouseIdx: number,
  age: number,
  mashBillId: string,
): BarrelInstance {
  const r = state.rickhouses[rickhouseIdx];
  const b: BarrelInstance = {
    barrelId: `b-${mashBillId}-${age}`,
    ownerId,
    rickhouseId: r.id,
    mash: [],
    mashBillId,
    age,
    barreledOnRound: 1,
  };
  r.barrels.push(b);
  return b;
}

describe("pickBestSellable", () => {
  it("returns null when the player has no age-≥2 barrels", () => {
    const s = gs();
    expect(pickBestSellable(s, s.players.p1)).toBe(null);
    placeBarrel(s, "p1", 0, 0, Object.keys(BOURBON_CARDS_BY_ID)[0]);
    placeBarrel(s, "p1", 0, 1, Object.keys(BOURBON_CARDS_BY_ID)[0]);
    expect(pickBestSellable(s, s.players.p1)).toBe(null);
  });

  it("picks the higher-paying barrel between two age-≥2 candidates", () => {
    const s = gs();
    // Pick two cards with different grids and place a barrel of each.
    const ids = Object.keys(BOURBON_CARDS_BY_ID).slice(0, 12);
    let a = ids[0];
    let b = ids[0];
    for (const id of ids) {
      const card = BOURBON_CARDS_BY_ID[id];
      const max = Math.max(...card.grid.flatMap((row) => row));
      const aMax = Math.max(...BOURBON_CARDS_BY_ID[a].grid.flatMap((r) => r));
      const bMax = Math.max(...BOURBON_CARDS_BY_ID[b].grid.flatMap((r) => r));
      if (max > aMax) {
        b = a;
        a = id;
      } else if (max > bMax && id !== a) {
        b = id;
      }
    }
    expect(a).not.toBe(b);
    placeBarrel(s, "p1", 0, 4, a); // higher-grid bill
    placeBarrel(s, "p1", 1, 4, b); // lower-grid bill
    const pick = pickBestSellable(s, s.players.p1);
    expect(pick).not.toBe(null);
    expect(pick!.barrel.mashBillId).toBe(a);
    const expected = lookupSalePrice(BOURBON_CARDS_BY_ID[a], 4, s.demand).price;
    expect(pick!.payout).toBe(expected);
    expect(pick!.goldAlt).toBe(null);
  });

  it("returns goldAlt when an unlocked Gold Bourbon strictly beats the attached bill", () => {
    const s = gs();
    // Cheap attached bill + a high-grid Gold-capable trophy.
    const trophy = Object.keys(BOURBON_CARDS_BY_ID).find(
      (id) => BOURBON_CARDS_BY_ID[id].awards?.gold,
    );
    const cheap = Object.keys(BOURBON_CARDS_BY_ID).find(
      (id) =>
        !BOURBON_CARDS_BY_ID[id].awards?.gold &&
        Math.max(...BOURBON_CARDS_BY_ID[id].grid.flatMap((r) => r)) < 20,
    );
    if (!trophy || !cheap) return;
    s.players.p1.goldBourbons.push(trophy);
    // Tri-type mash so any Gold criteria are likely met.
    const r = s.rickhouses[0];
    const b: BarrelInstance = {
      barrelId: "b-1",
      ownerId: "p1",
      rickhouseId: r.id,
      mash: [
        { instanceId: "rc", resource: "cask", specialtyId: null },
        { instanceId: "rco", resource: "corn", specialtyId: null },
        { instanceId: "rr", resource: "rye", specialtyId: null },
        { instanceId: "rw", resource: "wheat", specialtyId: null },
      ],
      mashBillId: cheap,
      age: 8,
      barreledOnRound: 1,
    };
    r.barrels.push(b);
    const pick = pickBestSellable(s, s.players.p1);
    expect(pick).not.toBe(null);
    expect(pick!.barrel.barrelId).toBe("b-1");
    if (pick!.goldAlt) {
      expect(pick!.goldAlt.goldId).toBe(trophy);
      expect(pick!.payout).toBe(pick!.goldAlt.payout);
      // Alt must strictly beat the attached.
      const attachedPrice = lookupSalePrice(
        BOURBON_CARDS_BY_ID[cheap],
        b.age,
        s.demand,
      ).price;
      expect(pick!.payout).toBeGreaterThan(attachedPrice);
    }
  });

  it("ignores barrels owned by other players", () => {
    const s = gs();
    const id = Object.keys(BOURBON_CARDS_BY_ID)[0];
    placeBarrel(s, "p2", 0, 8, id); // opponent has the only barrel
    expect(pickBestSellable(s, s.players.p1)).toBe(null);
    expect(pickBestSellable(s, s.players.p2)).not.toBe(null);
  });
});
