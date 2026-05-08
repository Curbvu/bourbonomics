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
    // v2.6: by default give each player 1 starting bill in slot 0 so
    // tests that want to MAKE_BOURBON have a "ready" target. Tests
    // that don't want a ready barrel can override with [] explicitly.
    const catalog = defaultMashBillCatalog();
    baseConfig.startingMashBills = baseConfig.players.map((_, i) =>
      catalog.slice(i, i + 1),
    );
    if (!baseConfig.bourbonDeck) {
      const drafted = baseConfig.players.length;
      baseConfig.bourbonDeck = catalog.slice(drafted);
    }
  }

  if (!baseConfig.startingDistilleries) {
    const pool = defaultDistilleryPool();
    const vanilla = pool.find((d) => d.bonus === "vanilla")!;
    // Give every test player a distinct Vanilla-equivalent distillery so
    // selection state is fully resolved without changing slot counts.
    // v2.6: pin mashBillDraftSize to 0 so tests that supply
    // `startingMashBills` get exactly that count of slotted bills (no
    // auto top-up from the bourbon deck).
    baseConfig.startingDistilleries = baseConfig.players.map((_, i) => ({
      ...vanilla,
      id: `dist_test_vanilla_${i}`,
      mashBillDraftSize: 0,
    }));
  }

  if (!baseConfig.starterDecks) {
    baseConfig.starterDecks = baseConfig.players.map((p) => defaultStarterCards(p.id));
  }

  return initializeGame(baseConfig);
}

/**
 * Pass turn for `playerId`, transparently rolling demand first if the
 * cursor just landed on them and the v2.9 per-turn flag still asks for
 * a roll. Tests that don't care about demand should use this instead
 * of dispatching PASS_TURN directly.
 */
export function passTurn(
  state: GameState,
  playerId: string,
  roll: [number, number] = [3, 3],
): GameState {
  let s = state;
  const player = s.players.find((p) => p.id === playerId);
  if (player?.needsDemandRoll) {
    s = applyAction(s, { type: "ROLL_DEMAND", playerId, roll });
  }
  return applyAction(s, { type: "PASS_TURN", playerId });
}

/**
 * Land a fresh game in the action phase ready for tests to dispatch.
 *
 * v2.9: demand is rolled per-player at the top of each action turn, so
 * the helper draws for everyone, fires the start player's first ROLL_
 * DEMAND, and then clears `needsDemandRoll` on every other seat too —
 * tests that don't care about demand can PASS_TURN around the table
 * without having to roll for every player. Tests that DO care about
 * the per-turn roll mechanic should re-arm the flag explicitly.
 */
export function advanceToActionPhase(
  state: GameState,
  roll: [number, number] = [3, 3],
): GameState {
  let s = state;
  for (const p of s.players) {
    s = applyAction(s, { type: "DRAW_HAND", playerId: p.id });
  }
  // Now phase=action, current player has needsDemandRoll=true.
  const current = s.players[s.currentPlayerIndex]!;
  s = applyAction(s, { type: "ROLL_DEMAND", playerId: current.id, roll });
  // Pre-clear the flag on every other seat so PASS_TURN-driven tests
  // don't have to roll for every player.
  return {
    ...s,
    players: s.players.map((p) => ({ ...p, needsDemandRoll: false })),
  };
}

/**
 * Wrap the current round by passing every still-active player's turn,
 * then re-enter the action phase of the next round. Used by tests that
 * need to age a barrel completed in round N — under v2.5 those barrels
 * first age in round N+1.
 *
 * Pass `seedDecks` to seed each player's deck with a few cards before
 * the round flip so the next round's DRAW_HAND doesn't auto-skip when
 * every deck is empty (which happens often in handcrafted unit tests).
 */
export function advanceToNextRound(
  state: GameState,
  options: {
    roll?: [number, number];
    seedDecks?: Record<string, Card[]>;
  } = {},
): GameState {
  const roll = options.roll ?? [3, 3];
  let s = state;
  if (options.seedDecks) {
    s = {
      ...s,
      players: s.players.map((p) =>
        options.seedDecks![p.id] ? { ...p, deck: options.seedDecks![p.id]!.slice() } : p,
      ),
    };
  }
  for (const p of s.players) {
    if (s.phase !== "action") break;
    if (p.outForRound) continue;
    if (s.players[s.currentPlayerIndex]!.id !== p.id) {
      s = { ...s, currentPlayerIndex: s.players.findIndex((q) => q.id === p.id) };
    }
    // v2.9: any player handed the cursor mid-round still needs to
    // satisfy the per-turn demand roll before they can PASS_TURN.
    const cur = s.players[s.currentPlayerIndex]!;
    if (cur.needsDemandRoll) {
      s = applyAction(s, { type: "ROLL_DEMAND", playerId: cur.id, roll });
    }
    s = applyAction(s, { type: "PASS_TURN", playerId: p.id });
  }
  // v2.9: cleanup wraps to `draw` (no separate demand phase). Run the
  // per-player draws + first-turn demand roll to land back in action.
  if (s.phase === "draw") {
    s = advanceToActionPhase(s, roll);
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
  mashBill: { id: string; defId: string; name: string; ageBands: readonly number[]; demandBands: readonly number[]; rewardGrid: readonly (readonly (number | null)[])[]; recipe?: unknown; silverAward?: unknown; goldAward?: unknown },
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
        // Test helpers always produce already-aging barrels. Tests
        // that need a construction-phase barrel can override after.
        phase: "aging",
        completedInRound: 0,
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

/**
 * v2.6: get the slot id holding the player's barrel attached to the
 * given mash bill. Tests use this to dispatch MAKE_BOURBON against a
 * specific bill that was draft-placed during setup.
 */
export function slotForBill(state: GameState, playerId: string, billId: string): string {
  const barrel = state.allBarrels.find(
    (b) => b.ownerId === playerId && b.attachedMashBill.id === billId,
  );
  if (!barrel) {
    throw new Error(
      `slotForBill: no barrel for player ${playerId} with bill ${billId}`,
    );
  }
  return barrel.slotId;
}

/**
 * v2.7.1: id of any spendable card (resource or capital) in the
 * player's hand — used to fill SELL_BOURBON's `spendCardId` cost
 * field in tests that don't otherwise care which card they spend.
 * Throws if the hand has no eligible card.
 */
export function spendCardId(state: GameState, playerId: string): string {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) throw new Error(`spendCardId: unknown player ${playerId}`);
  const card = player.hand.find(
    (c) => c.type === "resource" || c.type === "capital",
  );
  if (!card) {
    throw new Error(
      `spendCardId: ${playerId} has no resource or capital card in hand`,
    );
  }
  return card.id;
}
