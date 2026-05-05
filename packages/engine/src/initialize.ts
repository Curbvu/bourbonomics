import { produce, type Draft } from "immer";
import type {
  Card,
  Distillery,
  GameConfig,
  GameState,
  PlayerState,
} from "./types";
import {
  defaultMarketSupply,
  defaultMashBillCatalog,
} from "./defaults";
import { defaultDistilleryPool, buildRickhouseSlots } from "./distilleries";
import { defaultOperationsDeck } from "./operations";
import { shuffleCards } from "./deck";
import {
  applyDistilleryStarterModifications,
  enterStarterDeckDraftPhase,
  placeStartingBarrel,
  topUpMashBillsForDistillery,
} from "./starter-pool";

const DEFAULT_HAND_SIZE = 8;
const DEFAULT_DEMAND = 0;
const MARKET_CONVEYOR_SIZE = 10;

/**
 * Build a fresh GameState. Setup phases are skipped per-player when the
 * relevant config field is supplied:
 *   - `startingDistilleries[i]` skips the distillery pick for player i
 *   - `starterDecks[i]`         skips the starter-deck random deal for player i
 *
 * If every player has both pre-assigned, the game lands directly in the
 * demand phase. Otherwise the engine walks distillery_selection →
 * starter_deck_draft → demand. Distillery picks resolve via
 * SELECT_DISTILLERY in reverse-snake order; the starter draft phase
 * deals 16 face-up cards to each remaining drafter at phase entry and
 * resolves via STARTER_TRADE / STARTER_SWAP / STARTER_PASS until every
 * drafter has passed.
 */
export function initializeGame(config: GameConfig): GameState {
  let rngState = config.seed;
  const startingHandSize = config.startingHandSize ?? DEFAULT_HAND_SIZE;
  const startingDemand = config.startingDemand ?? DEFAULT_DEMAND;

  // Players. A player whose starter deck wasn't pre-built starts with an
  // empty deck and joins the starter_deck_draft phase for the v2.4
  // random-deal-and-trading window.
  const players: PlayerState[] = config.players.map((p, i) => {
    const distillery = config.startingDistilleries?.[i] ?? null;
    const explicitDeck = config.starterDecks?.[i];

    let deck: Card[] = [];
    if (explicitDeck) {
      // Pre-built starter decks bypass the trade window entirely. Apply
      // any post-deal distillery modifications now (idempotent — the
      // starter draft path won't see this player) and shuffle.
      const seedDeck = explicitDeck.slice();
      if (distillery) {
        applyDistilleryStarterModifications(seedDeck as unknown as Draft<Card[]>, p, distillery);
      }
      const shuffled = shuffleCards(seedDeck, rngState);
      deck = shuffled.shuffled;
      rngState = shuffled.rngState;
    }

    const startingMash = config.startingMashBills?.[i] ?? [];
    return {
      id: p.id,
      name: p.name,
      isBot: p.isBot ?? false,
      distillery,
      rickhouseSlots: distillery ? buildRickhouseSlots(p.id, distillery) : [],
      hand: [],
      deck,
      discard: [],
      mashBills: startingMash.slice(),
      unlockedGoldBourbons: [],
      operationsHand: [],
      starterHand: [],
      starterPassed: false,
      starterSwapUsed: false,
      reputation: 0,
      handSize: startingHandSize,
      barrelsSold: 0,
      firstSaleResolved: false,
      outForRound: false,
      demandSurgeActive: false,
      brokerFreeTradeUsed: false,
      pendingHalfCostMarketBuy: false,
      pendingMakeDiscount: null,
      pendingRatingBoost: 0,
    };
  });

  // Bourbon deck (mash bills NOT already drafted to players). After
  // shuffle we deal the top 3 bills to a face-up row beside the deck;
  // the rest stay face-down. "Top of deck" is the array tail.
  const bourbonSeed = config.bourbonDeck ?? defaultMashBillCatalog();
  const bourbonShuffle = shuffleCards(bourbonSeed, rngState);
  rngState = bourbonShuffle.rngState;
  const bourbonShuffled = bourbonShuffle.shuffled;
  const FACEUP_BOURBON_SIZE = 3;
  const faceUpCount = Math.min(FACEUP_BOURBON_SIZE, bourbonShuffled.length);
  // Pop from the tail (top) so the face-up row reflects the deck order.
  const bourbonFaceUp = bourbonShuffled.splice(
    bourbonShuffled.length - faceUpCount,
    faceUpCount,
  );

  // Operations deck. Players start with empty operations hands — they
  // acquire ops cards by purchasing them from the face-up market row
  // (BUY_OPERATIONS_CARD) using their resource / capital cards.
  const opsSeed = config.operationsDeck ?? defaultOperationsDeck();
  const opsShuffle = shuffleCards(opsSeed, rngState);
  rngState = opsShuffle.rngState;
  const operationsDeck = opsShuffle.shuffled;

  // Market supply: 6 to conveyor, rest stay in supply deck face-down.
  const supplySeed = config.marketSupply ?? defaultMarketSupply();
  const supplyShuffle = shuffleCards(supplySeed, rngState);
  rngState = supplyShuffle.rngState;
  const conveyorCount = Math.min(MARKET_CONVEYOR_SIZE, supplyShuffle.shuffled.length);
  const conveyorSrc = supplyShuffle.shuffled.slice(supplyShuffle.shuffled.length - conveyorCount);
  const marketConveyor = conveyorSrc.slice().reverse();
  const marketSupplyDeck = supplyShuffle.shuffled.slice(0, supplyShuffle.shuffled.length - conveyorCount);

  // Distillery pool — exclude any distilleries already pre-assigned.
  const distilleryPool = (config.distilleryPool ?? defaultDistilleryPool()).filter(
    (d) => !players.some((p) => p.distillery && p.distillery.defId === d.defId),
  );

  // Reverse-snake order for setup phases (last seat picks first).
  const distillerySelectionOrder = players
    .filter((p) => !p.distillery)
    .map((p) => p.id)
    .reverse();
  const starterDeckDraftOrder = players
    .filter((_, i) => !config.starterDecks?.[i])
    .map((p) => p.id)
    .reverse();

  let phase: GameState["phase"];
  if (distillerySelectionOrder.length > 0) phase = "distillery_selection";
  else if (starterDeckDraftOrder.length > 0) phase = "starter_deck_draft";
  else phase = "demand";

  const initialState: GameState = {
    seed: config.seed,
    rngState,
    round: 1,
    phase,
    startPlayerIndex: 0,
    currentPlayerIndex: 0,
    players,
    distilleryPool,
    distillerySelectionOrder,
    distillerySelectionCursor: 0,
    starterDeckDraftOrder,
    starterUndealtPool: [],
    allBarrels: [],
    marketConveyor,
    marketSupplyDeck,
    marketDiscard: [],
    bourbonDeck: bourbonShuffled,
    bourbonFaceUp,
    bourbonDiscard: [],
    operationsDeck,
    operationsDiscard: [],
    demand: startingDemand,
    demandRolls: [],
    finalRoundTriggered: false,
    finalRoundTriggerPlayerIndex: null,
    playerIdsCompletedPhase: [],
    idCounter: 1,
    actionHistory: [],
  };

  // If every player's distillery is pre-assigned (no `distillery_selection`
  // phase), the per-distillery starting barrel placement happens here
  // since SELECT_DISTILLERY won't run for them. Same for entering
  // `starter_deck_draft` from init: deal random hands now so the
  // phase is ready for trade actions.
  const skipsDistillerySelection = distillerySelectionOrder.length === 0;
  if (skipsDistillerySelection || phase === "starter_deck_draft") {
    return produce(initialState, (draft: Draft<GameState>) => {
      if (skipsDistillerySelection) {
        for (const player of draft.players) {
          if (player.distillery) {
            placeStartingBarrel(draft, player, player.distillery);
            topUpMashBillsForDistillery(draft, player, player.distillery);
          }
        }
      }
      if (phase === "starter_deck_draft") {
        enterStarterDeckDraftPhase(draft);
      }
    });
  }
  return initialState;
}

/** Helper for tests / programmatic auto-pick: assign distilleries from the pool head. */
export function autoAssignDistilleries(
  pool: Distillery[],
  numPlayers: number,
): { assigned: Distillery[]; remaining: Distillery[] } {
  const assigned = pool.slice(0, numPlayers);
  const remaining = pool.slice(numPlayers);
  return { assigned, remaining };
}
