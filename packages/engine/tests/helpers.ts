import { initializeGame } from "../src/initialize.js";
import { defaultMashBillCatalog, defaultStarterCards } from "../src/defaults.js";
import { defaultDistilleryPool } from "../src/distilleries.js";
import { applyAction } from "../src/engine.js";
import type { Card, GameConfig, GameState } from "../src/types.js";

/**
 * Build a deterministic test game.
 *
 * Defaults: 2 players, seed=1, default starter decks (16 cards each), each
 * player drafted 3 mash bills, and Vanilla distilleries pre-assigned so tests
 * skip distillery_selection and land directly in the demand phase.
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

  if (!baseConfig.startingDistilleries) {
    const pool = defaultDistilleryPool();
    const vanilla = pool.find((d) => d.bonus === "vanilla")!;
    // Give every test player a distinct Vanilla-equivalent distillery so
    // selection state is fully resolved without changing slot counts.
    baseConfig.startingDistilleries = baseConfig.players.map((_, i) => ({
      ...vanilla,
      id: `dist_test_vanilla_${i}`,
    }));
  }

  if (!baseConfig.starterDecks) {
    baseConfig.starterDecks = baseConfig.players.map((p) => defaultStarterCards(p.id));
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
 * Inject a fully-aged barrel directly into one of the player's slots. Used by
 * sale/aging tests so we don't have to grind through N rounds to get a
 * saleable barrel.
 *
 * Pass `productionCards` to override the default empty production pile, and
 * `agingCards` to override the auto-generated corn aging cards (in which
 * case `age` is ignored — barrel.age becomes `agingCards.length`).
 */
export function placeBarrel(
  state: GameState,
  ownerId: string,
  mashBill: { id: string; defId: string; name: string; ageBands: readonly [number, number, number]; demandBands: readonly [number, number, number]; rewardGrid: readonly (readonly (number | null)[])[]; recipe?: unknown; silverAward?: unknown; goldAward?: unknown },
  age: number,
  slotId?: string,
  options: { productionCards?: Card[]; agingCards?: Card[] } = {},
): GameState {
  const owner = state.players.find((p) => p.id === ownerId);
  if (!owner) throw new Error(`placeBarrel: unknown player ${ownerId}`);
  let targetSlot = slotId;
  if (!targetSlot) {
    const taken = new Set(state.allBarrels.filter((b) => b.ownerId === ownerId).map((b) => b.slotId));
    const free = owner.rickhouseSlots.find((s) => !taken.has(s.id));
    if (!free) throw new Error(`placeBarrel: ${ownerId} has no free slots`);
    targetSlot = free.id;
  }
  const barrelIndex = state.allBarrels.length;
  const barrelId = `barrel_test_${barrelIndex}`;
  const agingCards: Card[] = options.agingCards ?? Array.from({ length: age }, (_, i) => ({
    id: `agingcard_${ownerId}_${barrelIndex}_${i}`,
    cardDefId: "corn",
    type: "resource",
    subtype: "corn",
    resourceCount: 1,
  }));
  const effectiveAge = options.agingCards ? options.agingCards.length : age;
  return {
    ...state,
    allBarrels: [
      ...state.allBarrels,
      {
        id: barrelId,
        ownerId,
        slotId: targetSlot,
        attachedMashBill: mashBill as never,
        productionCardDefIds: [],
        productionCards: options.productionCards ?? [],
        agingCards,
        age: effectiveAge,
        productionRound: state.round,
        agedThisRound: false,
        inspectedThisRound: false,
        extraAgesAvailable: 0,
        gridRepOffset: 0,
        demandBandOffset: 0,
      },
    ],
  };
}

/** Convenience: get a player's first empty slot id. */
export function firstEmptySlot(state: GameState, playerId: string): string {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) throw new Error(`firstEmptySlot: unknown player ${playerId}`);
  const taken = new Set(state.allBarrels.filter((b) => b.ownerId === playerId).map((b) => b.slotId));
  const free = player.rickhouseSlots.find((s) => !taken.has(s.id));
  if (!free) throw new Error(`firstEmptySlot: ${playerId} has no free slots`);
  return free.id;
}
