import { describe, expect, it } from "vitest";
import { canMakeBourbon } from "@/lib/engine/checks";
import { reduce } from "@/lib/engine/reducer";
import { feesForPlayer } from "@/lib/rules/fees";
import { createInitialState } from "@/lib/engine/setup";
import type { GameState } from "@/lib/engine/state";

function gs(): {
  state: GameState;
  human: string;
  bot: string;
} {
  const state = createInitialState({
    id: "g",
    seed: 7,
    seats: [
      { name: "Alice", kind: "human" },
      { name: "Bob", kind: "bot", botDifficulty: "easy" },
    ],
  });
  const [human, bot] = state.playerOrder;
  return { state, human, bot };
}

describe("market effects — engine resolution", () => {
  it("rent_surcharge from a kept market card adds to next round's per-barrel fee", () => {
    const { state, human } = gs();
    state.currentRoundEffects.rentSurchargePerBarrel = 1;
    const northern = state.rickhouses.find((r) => r.id === "rickhouse-0")!;
    northern.barrels.push({
      barrelId: "b1",
      ownerId: human,
      rickhouseId: "rickhouse-0",
      mash: [],
      mashBillId: state.players[human].bourbonHand[0],
      age: 0,
      barreledOnRound: 1,
    });
    // 1 barrel in the rickhouse → base rent = 1; +1 surcharge = $2.
    const fees = feesForPlayer(state, human);
    expect(fees).toHaveLength(1);
    expect(fees[0].amount).toBe(2);
  });

  it("playersBlockedFromMake stops MAKE_BOURBON before any other check", () => {
    const { state, human } = gs();
    state.currentRoundEffects.playersBlockedFromMake = [human];
    const result = canMakeBourbon(
      state,
      human,
      "rickhouse-0",
      [],
      state.players[human].bourbonHand[0],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/strike/i);
    }
  });

  it("salesThisRound counter increments after a successful SELL_BOURBON", () => {
    const { state, human } = gs();
    const billId = state.players[human].bourbonHand[0];
    const northern = state.rickhouses.find((r) => r.id === "rickhouse-0")!;
    northern.barrels.push({
      barrelId: "b1",
      ownerId: human,
      rickhouseId: "rickhouse-0",
      mash: [],
      mashBillId: billId,
      age: 5,
      barreledOnRound: 0,
    });
    state.players[human].cash = 20;
    expect(state.currentRoundEffects.salesThisRound ?? 0).toBe(0);
    // Override currentPlayerId to the human so the action passes turn checks.
    state.currentPlayerId = human;
    const next = reduce(state, {
      t: "SELL_BOURBON",
      playerId: human,
      barrelId: "b1",
    });
    expect(next.currentRoundEffects.salesThisRound).toBe(1);
  });
});
