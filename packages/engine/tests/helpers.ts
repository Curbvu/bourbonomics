import { initializeGame } from "../src/initialize.js";
import { defaultMashBillCatalog } from "../src/defaults.js";
import { applyAction } from "../src/engine.js";
import type { Card, GameConfig, GameState } from "../src/types.js";

/**
 * Build a deterministic test game.
 *
 * Defaults: 2 players, seed=1, default starter decks (14 cards each), each
 * player drafted 3 mash bills, the rest in the bourbon deck.
 */
export function makeTestGame(overrides: Partial<GameConfig> = {}): GameState {
  const baseConfig: GameConfig = {
    seed: 1,
    players: [
      { id: "p1", name: "Alice" },
      { id: "p2", name: "Bob" },
    ],
    ...overrides,
  };

  // Pre-allocate 3 mash bills per player from the default catalog so engine
  // tests have meaningful starting hands without running the draft.
  if (!baseConfig.startingMashBills) {
    const catalog = defaultMashBillCatalog();
    baseConfig.startingMashBills = baseConfig.players.map((_, i) =>
      catalog.slice(i * 3, i * 3 + 3),
    );
    if (!baseConfig.bourbonDeck) {
      const drafted = baseConfig.players.length * 3;
      baseConfig.bourbonDeck = catalog.slice(drafted);
    }
  }

  return initializeGame(baseConfig);
}

/** Run ROLL_DEMAND + one DRAW_HAND per player to land in the action phase. */
export function advanceToActionPhase(
  state: GameState,
  roll: [number, number] = [3, 3],
): GameState {
  let s = applyAction(state, { type: "ROLL_DEMAND", roll });
  for (const p of s.players) {
    s = applyAction(s, { type: "DRAW_HAND", playerId: p.id });
  }
  return s;
}

/**
 * Replace a player's hand and deck for deterministic testing.
 * `cards` becomes the player's hand verbatim; deck is cleared so reshuffles
 * don't re-introduce surprises.
 */
export function giveHand(state: GameState, playerId: string, cards: Card[]): GameState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.id === playerId ? { ...p, hand: cards.slice(), deck: [], discard: [] } : p,
    ),
  };
}

/**
 * Inject a fully-aged barrel directly into state. Used by sale/aging tests so
 * we don't have to grind through N rounds to get a saleable barrel.
 */
export function placeBarrel(
  state: GameState,
  ownerId: string,
  mashBill: { id: string; defId: string; name: string; ageBands: readonly [number, number, number]; demandBands: readonly [number, number, number]; rewardGrid: readonly (readonly (number | null)[])[]; recipe?: unknown; silverAward?: unknown; goldAward?: unknown },
  age: number,
  rickhouseId = "rh_central",
): GameState {
  const barrelIndex = state.allBarrels.length;
  const barrelId = `barrel_test_${barrelIndex}`;
  const agingCards: Card[] = Array.from({ length: age }, (_, i) => ({
    id: `agingcard_${ownerId}_${barrelIndex}_${i}`,
    cardDefId: "corn",
    type: "resource",
    subtype: "corn",
    resourceCount: 1,
  }));
  return {
    ...state,
    allBarrels: [
      ...state.allBarrels,
      {
        id: barrelId,
        ownerId,
        rickhouseId,
        attachedMashBill: mashBill as never,
        productionCardDefIds: [],
        agingCards,
        age,
        productionRound: state.round,
        agedThisRound: false,
      },
    ],
  };
}
