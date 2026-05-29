import type { Draft } from "immer";
import type { Barrel, Card, Distillery, GameState, PlayerState } from "./types";
import { makeLaborCard, makePremiumResource, makeResourceCard } from "./cards";
import { shuffleCards } from "./deck";
import { buildStarterMashBill } from "./defaults";

// ============================================================
// Starter pool (Deterministic per-player composition + Trading)
//
// Each player's starter hand is the canonical `PER_PLAYER` block:
//
//   per player:  6 cask + 4 corn + 3 grain + 3 Generic Labor = 16
//   3 grain split: 1 rye + 1 barley + 1 wheat (symmetric)
//   buffer (per game): 2 cask + 1 corn + 1 rye + 1 barley + 1 wheat
//                      + 2 Generic Labor = 8
//
// v2.14.1 Locked composition: previously the pool was shuffled
// globally and dealt 16 random cards per player — at 3 players that
// meant ~9 labor + 2 buffer = 11 labor floating around, so the deal
// could hand one player 6 labor and another zero. The trade window's
// 1-for-1 swaps couldn't restore balance with that variance, so we
// now build each player's hand from their own `PER_PLAYER` block,
// shuffled internally for draw-order variance. The shared buffer
// stays in `starterUndealtPool` for the stuck-hand safety valve.
//
// v2.14 Smoother Starter: bumped Labor 2→3 per player and dropped
// one rye to keep the total at 16. At 2 Labor the zero-Labor-round
// rate was ~27%; at 3 it drops to ~11%. Expected Labor per round
// rises from 1.0 to 1.5 so the rep-supplement sub-economy stays
// online round-to-round without the v2.13 round-1 rig.
// ============================================================

export const STARTER_HAND_SIZE = 16;

interface PoolSpec {
  cask: number;
  corn: number;
  rye: number;
  barley: number;
  wheat: number;
  /** Generic Labor cards. Finite per starter deck. */
  labor: number;
}

const PER_PLAYER: PoolSpec = {
  cask: 6,
  corn: 4,
  rye: 1,
  barley: 1,
  wheat: 1,
  labor: 3,
};

const POOL_BUFFER: PoolSpec = {
  cask: 2,
  corn: 1,
  rye: 1,
  barley: 1,
  wheat: 1,
  labor: 2,
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
    for (let n = 0; n < spec.labor; n++)
      cards.push(makeLaborCard({ subtype: "generic", ownerLabel: "pool", index: idx++ }));
  };
  for (let i = 0; i < numPlayers; i++) addSpec(PER_PLAYER);
  addSpec(POOL_BUFFER);
  return cards;
}

/**
 * Deal canonical `STARTER_HAND_SIZE`-card hands to each player from a
 * starter pool built with `buildStarterPool(numPlayers)`. The pool is
 * laid out as `[player0's 16][player1's 16]...[playerN's 16][buffer]`
 * — each consecutive `STARTER_HAND_SIZE`-block is one player's
 * canonical PER_PLAYER composition. We shuffle each block internally
 * for draw-order variance but never cross blocks, so every player's
 * starter hand is guaranteed to contain exactly 6 cask + 4 corn + 1
 * rye + 1 barley + 1 wheat + 3 Generic Labor.
 *
 * The remainder is the pool buffer (unshuffled — the safety-valve
 * action shuffles it on draw if needed) which becomes
 * `state.starterUndealtPool` and backs the stuck-hand swap.
 *
 * Each per-player shuffle threads the rng state through so a seeded
 * game still produces identical hands across runs.
 */
export function dealStarterHands(
  pool: readonly Card[],
  numPlayers: number,
  rngState: number,
): { hands: Card[][]; remainder: Card[]; rngState: number } {
  if (pool.length < numPlayers * STARTER_HAND_SIZE) {
    throw new Error(
      `dealStarterHands: pool of ${pool.length} cannot deal ${numPlayers}×${STARTER_HAND_SIZE}`,
    );
  }
  const hands: Card[][] = [];
  let state = rngState;
  for (let p = 0; p < numPlayers; p++) {
    const start = p * STARTER_HAND_SIZE;
    const block = pool.slice(start, start + STARTER_HAND_SIZE);
    // Shuffle each player's canonical block independently so draw
    // order is randomised per seat without disturbing composition.
    const shuf = shuffleCards(block, state);
    hands.push(shuf.shuffled);
    state = shuf.rngState;
  }
  const remainder = pool.slice(numPlayers * STARTER_HAND_SIZE);
  return { hands, remainder, rngState: state };
}

/**
 * Apply post-deal distillery modifications to a player's starter
 * cards. Centralizes the per-distillery rules so init /
 * select-distillery / starter setup can't drift apart.
 *
 * `target` is the array to modify (the dealt `starterHand` during
 * the trade window, or `deck` when the deck was pre-built via
 * config.starterDecks). Reads `distillery.starterPoolMods` —
 * currently only `bonusSpecialtyRye` (High-Rye House: +2).
 */
export function applyDistilleryStarterModifications(
  target: Card[] | Draft<Card[]>,
  player: Pick<PlayerState, "id">,
  distillery: Distillery,
): void {
  const mods = distillery.starterPoolMods;
  if (!mods) return;

  // High-Rye House: free Specialty Rye cards. Same shape as the
  // market-minted Superior Rye (cost $2, `specialty: true` so they
  // count toward `minSpecialty.rye`). The v2.10 uniform +1-rep-on-sale
  // bonus is retired — High-Rye House's +1 rep on rye-bill sales is a
  // distillery-driven sale-time mod (DistillerySaleMods), independent
  // of any card-band rule.
  if (mods.bonusSpecialtyRye && mods.bonusSpecialtyRye > 0) {
    for (let i = 0; i < mods.bonusSpecialtyRye; i++) {
      target.push(
        makePremiumResource({
          defId: "superior_rye",
          displayName: "Superior Rye",
          flavor: "Reserve cut, sharper edge.",
          subtype: "rye",
          resourceCount: 1,
          cost: 2,
          ownerLabel: player.id,
          index: 920 + i,
          specialty: true,
        }),
      );
    }
  }

  // v3.4 — High-Rye House safety valve. Their 3-Capital opening is
  // brittle; an extra Generic Labor in the dealt hand widens the
  // first-round play stack. Mint a Generic Labor card with the same
  // shape the starter pool uses everywhere else.
  if (mods.bonusGenericLabor && mods.bonusGenericLabor > 0) {
    for (let i = 0; i < mods.bonusGenericLabor; i++) {
      target.push({
        id: `bonus_labor_${player.id}_${i}`,
        cardDefId: "generic_labor",
        type: "labor",
        laborSubtype: "generic",
        laborDomain: "any",
        laborContribution: 1,
      } as Card);
    }
  }
}

/**
 * Place a freshly-acquired bill into one of the player's open slots as
 * a "ready" barrel (bill present, no committed cards). Returns the
 * created barrel id, or null if the player has no open slot. Used by
 * setup, the Drafting Loop, and the Allocation ops card.
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
    inspectedThisRound: false,
    skipNextRoundAging: false,
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
  // v2.10 High-Rye House cannot draft wheated bills (recipe.maxRye === 0).
  // Skip them during the auto top-up — bills that aren't placeable get
  // shuffled to the bottom of the deck so the rest of the table can
  // still see them.
  const banWheated = distillery.bonus === "high_rye_house";
  let safety = draft.bourbonDeck.length + 4;
  while (
    draft.allBarrels.filter((b) => b.ownerId === player.id).length < target &&
    draft.bourbonDeck.length > 0 &&
    safety-- > 0
  ) {
    const extra = draft.bourbonDeck.pop()!;
    if (banWheated && extra.recipe?.maxRye === 0) {
      // Send the wheated bill to the bottom of the deck — try the next.
      draft.bourbonDeck.unshift(extra);
      continue;
    }
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
    inspectedThisRound: false,
    skipNextRoundAging: false,
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

