import type { Draft } from "immer";
import type { Barrel, Card, Distillery, GameState, PlayerState } from "./types";
import { makeCapitalCard, makePremiumResource, makeResourceCard } from "./cards";
import { shuffleCards } from "./deck";
import { buildStarterMashBill } from "./defaults";

// ============================================================
// Starter pool (v2.4 Random Deal + Trading)
//
// Each player contributes the per-player composition to a shared
// pool. A small fixed buffer (`POOL_BUFFER`) lives on top so the
// stuck-hand safety valve has undealt cards to draw replacements
// from. The pool is shuffled, dealt 16 face-up to each drafter,
// and the remainder (≥ POOL_BUFFER cards) backs the safety valve.
//
//   per player:  6 cask + 4 corn + 4 grain + 2 capital = 16
//   4 grain split: 2 rye + 1 barley + 1 wheat (≈ equal)
//   buffer (per game): 2 cask + 1 corn + 1 rye + 1 barley + 1 wheat + 2 capital = 8
// ============================================================

export const STARTER_HAND_SIZE = 16;

interface PoolSpec {
  cask: number;
  corn: number;
  rye: number;
  barley: number;
  wheat: number;
  capital: number;
}

const PER_PLAYER: PoolSpec = {
  cask: 6,
  corn: 4,
  rye: 2,
  barley: 1,
  wheat: 1,
  capital: 2,
};

const POOL_BUFFER: PoolSpec = {
  cask: 2,
  corn: 1,
  rye: 1,
  barley: 1,
  wheat: 1,
  capital: 2,
};

/**
 * Build the unshuffled starter pool for `numPlayers`. The pool is
 * sized so that each player can be dealt `STARTER_HAND_SIZE` cards
 * with a small remainder feeding the stuck-hand safety valve.
 *
 * Card ids are deterministic (rooted in `pool` + index) so games
 * with identical seeds produce identical pools.
 */
export function buildStarterPool(numPlayers: number): Card[] {
  const cards: Card[] = [];
  let idx = 0;
  const addSpec = (spec: PoolSpec) => {
    for (let n = 0; n < spec.cask; n++) cards.push(makeResourceCard("cask", "pool", idx++));
    for (let n = 0; n < spec.corn; n++) cards.push(makeResourceCard("corn", "pool", idx++));
    for (let n = 0; n < spec.rye; n++) cards.push(makeResourceCard("rye", "pool", idx++));
    for (let n = 0; n < spec.barley; n++) cards.push(makeResourceCard("barley", "pool", idx++));
    for (let n = 0; n < spec.wheat; n++) cards.push(makeResourceCard("wheat", "pool", idx++));
    for (let n = 0; n < spec.capital; n++) cards.push(makeCapitalCard("pool", idx++));
  };
  for (let i = 0; i < numPlayers; i++) addSpec(PER_PLAYER);
  addSpec(POOL_BUFFER);
  return cards;
}

/**
 * Shuffle a starter pool and deal `STARTER_HAND_SIZE` cards to each
 * of `numPlayers` players. Returns the per-player hands and the
 * undealt remainder (which becomes `state.starterUndealtPool`).
 */
export function dealStarterHands(
  pool: readonly Card[],
  numPlayers: number,
  rngState: number,
): { hands: Card[][]; remainder: Card[]; rngState: number } {
  const shuffleResult = shuffleCards(pool, rngState);
  const shuffled = shuffleResult.shuffled;
  const hands: Card[][] = Array.from({ length: numPlayers }, () => []);
  let cursor = 0;
  for (let p = 0; p < numPlayers; p++) {
    for (let i = 0; i < STARTER_HAND_SIZE; i++) {
      const card = shuffled[cursor++];
      if (!card) {
        throw new Error(
          `dealStarterHands: pool of ${pool.length} cannot deal ${numPlayers}×${STARTER_HAND_SIZE}`,
        );
      }
      hands[p]!.push(card);
    }
  }
  const remainder = shuffled.slice(cursor);
  return { hands, remainder, rngState: shuffleResult.rngState };
}

/**
 * Apply post-deal distillery modifications to a player's starter
 * cards. Centralizes the per-distillery rules so init /
 * select-distillery / starter setup can't drift apart.
 *
 * `target` is the array to modify (the dealt `starterHand` during
 * the trade window, or `deck` when the deck was pre-built via
 * config.starterDecks). Reads `distillery.starterPoolMods` —
 * adding free 2-rye cards (High-Rye, +2; existing High-Rye behaviour
 * was +1 in v2.3) or removing/adding capital cards (Old-Line: -1;
 * The Broker: +2).
 */
export function applyDistilleryStarterModifications(
  target: Draft<Card[]>,
  player: Pick<PlayerState, "id">,
  distillery: Distillery,
): void {
  const mods = distillery.starterPoolMods;
  if (!mods) return;

  if (mods.bonusTwoRye && mods.bonusTwoRye > 0) {
    for (let i = 0; i < mods.bonusTwoRye; i++) {
      target.push(
        makePremiumResource({
          defId: "rye_x2",
          displayName: "2× Rye",
          subtype: "rye",
          resourceCount: 2,
          cost: 3,
          ownerLabel: player.id,
          index: 900 + i,
        }),
      );
    }
  }

  if (mods.capitalDelta) {
    if (mods.capitalDelta > 0) {
      for (let i = 0; i < mods.capitalDelta; i++) {
        target.push(makeCapitalCard(player.id, 950 + i));
      }
    } else {
      // Remove `|capitalDelta|` capital cards, lowest face value first
      // so the cost to the player is minimized. (Old-Line: -1.)
      let toRemove = -mods.capitalDelta;
      target.sort((a, b) => {
        if (a.type !== b.type) return a.type === "capital" ? -1 : 1;
        return (a.capitalValue ?? 1) - (b.capitalValue ?? 1);
      });
      for (let i = 0; i < target.length && toRemove > 0; ) {
        if (target[i]!.type === "capital") {
          target.splice(i, 1);
          toRemove--;
          continue;
        }
        i++;
      }
    }
  }
}

/**
 * v2.6: place a freshly-drawn bill into one of the player's open slots
 * as a "ready" barrel (bill present, no committed cards). Returns the
 * created barrel id, or null if the player has no open slot. Used by
 * setup, DRAW_MASH_BILL, and the Allocation ops card.
 */
export function placeBillInSlot(
  draft: Draft<GameState>,
  player: Draft<PlayerState>,
  bill: import("./types").MashBill,
  slotId?: string,
): string | null {
  const taken = new Set(
    draft.allBarrels.filter((b) => b.ownerId === player.id).map((b) => b.slotId),
  );
  const targetSlot = slotId
    ? player.rickhouseSlots.find((s) => s.id === slotId && !taken.has(s.id))
    : player.rickhouseSlots.find((s) => !taken.has(s.id));
  if (!targetSlot) return null;

  const barrelId = `barrel_${draft.idCounter++}`;
  const barrel: Barrel = {
    id: barrelId,
    ownerId: player.id,
    slotId: targetSlot.id,
    // v2.6: bill present, no commits — barrel is "ready" until cards
    // arrive via MAKE_BOURBON. Does not age in this state.
    phase: "ready",
    completedInRound: null,
    attachedMashBill: bill,
    productionCardDefIds: [],
    productionCards: [],
    agingCards: [],
    age: 0,
    productionRound: draft.round,
    agedThisRound: false,
    committedThisTurn: false,
    inspectedThisRound: false,
    extraAgesAvailable: 0,
    gridRepOffset: 0,
    demandBandOffset: 0,
  };
  draft.allBarrels.push(barrel);
  return barrelId;
}

/**
 * v2.6: top up the player's slotted bills to `distillery.mashBillDraftSize`
 * (default 3, Connoisseur Estate 4) by drawing from the bourbon deck and
 * placing each bill into an open slot as a "ready" barrel. Called at
 * distillery binding time. Stops early if the bourbon deck runs out or
 * the player runs out of open slots.
 */
export function topUpSlottedBillsForDistillery(
  draft: Draft<GameState>,
  player: Draft<PlayerState>,
  distillery: Distillery,
): void {
  const target = distillery.mashBillDraftSize ?? 3;
  while (
    draft.allBarrels.filter((b) => b.ownerId === player.id).length < target &&
    draft.bourbonDeck.length > 0
  ) {
    const extra = draft.bourbonDeck.pop()!;
    if (placeBillInSlot(draft, player, extra) == null) {
      // No open slot — return the bill to the bottom of the deck.
      draft.bourbonDeck.unshift(extra);
      break;
    }
  }
}

/**
 * Place a pre-aged starting barrel in the player's first empty slot.
 * Called once per player at distillery selection time when their
 * profile has a `startingBarrel`. Aging cards are synthetic corn
 * cards that go to the player's discard when the barrel sells (same
 * convention as test helpers).
 */
export function placeStartingBarrel(
  draft: Draft<GameState>,
  player: Draft<PlayerState>,
  distillery: Distillery,
): void {
  const spec = distillery.startingBarrel;
  if (!spec) return;
  const taken = new Set(
    draft.allBarrels.filter((b) => b.ownerId === player.id).map((b) => b.slotId),
  );
  const freeSlot = player.rickhouseSlots.find((s) => !taken.has(s.id));
  if (!freeSlot) return;

  const bill = buildStarterMashBill(spec.basicBillKey, draft.idCounter++);
  const barrelId = `barrel_starter_${player.id}_${draft.idCounter++}`;
  const agingCards: Card[] = Array.from({ length: spec.age }, (_, i) => ({
    id: `agingcard_starter_${player.id}_${i}`,
    cardDefId: "corn",
    type: "resource",
    subtype: "corn",
    resourceCount: 1,
  }));
  const barrel: Barrel = {
    id: barrelId,
    ownerId: player.id,
    slotId: freeSlot.id,
    // Pre-aged starter barrels skip construction entirely — they
    // ship aging at age N from round 1.
    phase: "aging",
    completedInRound: 0,
    attachedMashBill: bill,
    productionCardDefIds: [],
    productionCards: [],
    agingCards,
    age: spec.age,
    productionRound: 0,
    agedThisRound: false,
    committedThisTurn: false,
    inspectedThisRound: false,
    extraAgesAvailable: 0,
    gridRepOffset: 0,
    demandBandOffset: 0,
  };
  draft.allBarrels.push(barrel);
}

/**
 * Enter the `starter_deck_draft` phase: build the pool sized for the
 * players who need a deck, deal `STARTER_HAND_SIZE` to each, store
 * the remainder for the safety valve, and apply per-distillery
 * post-deal modifications.
 *
 * Idempotent guard: returns immediately if any drafter already has a
 * non-empty `starterHand`. Both initialize() and select-distillery
 * call this when the phase begins; the guard prevents a double-deal
 * if both paths happen to trigger on the same state.
 */
export function enterStarterDeckDraftPhase(draft: Draft<GameState>): void {
  draft.phase = "starter_deck_draft";
  const drafterIds = draft.starterDeckDraftOrder;
  if (drafterIds.length === 0) return;
  const drafters = drafterIds
    .map((id) => draft.players.find((p) => p.id === id))
    .filter((p): p is Draft<PlayerState> => p !== undefined);
  if (drafters.some((p) => p.starterHand.length > 0)) return;

  const pool = buildStarterPool(drafters.length);
  const dealt = dealStarterHands(pool, drafters.length, draft.rngState);
  draft.rngState = dealt.rngState;
  draft.starterUndealtPool = dealt.remainder;

  for (let i = 0; i < drafters.length; i++) {
    const player = drafters[i]!;
    player.starterHand = dealt.hands[i]!;
    if (player.distillery) {
      applyDistilleryStarterModifications(player.starterHand, player, player.distillery);
    }
  }
}

