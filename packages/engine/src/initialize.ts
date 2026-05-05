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
import { makeResourceCard } from "./cards";

const DEFAULT_HAND_SIZE = 8;
const DEFAULT_DEMAND = 0;
const MARKET_CONVEYOR_SIZE = 10;

/**
 * Build a fresh GameState. Setup phases are skipped per-player when the
 * relevant config field is supplied:
 *   - `startingDistilleries[i]` skips the distillery pick for player i
 *   - `starterDecks[i]`         skips the starter-deck draft for player i
 *
 * If every player has both pre-assigned, the game lands directly in the
 * demand phase. Otherwise the engine walks distillery_selection →
 * starter_deck_draft → demand, resolving picks via SELECT_DISTILLERY and
 * COMPOSE_STARTER_DECK actions in reverse-snake order.
 */
export function initializeGame(config: GameConfig): GameState {
  let rngState = config.seed;
  const startingHandSize = config.startingHandSize ?? DEFAULT_HAND_SIZE;
  const startingDemand = config.startingDemand ?? DEFAULT_DEMAND;

  // Players. A player whose starter deck wasn't pre-built starts with an
  // empty deck and joins the starter_deck_draft phase to compose theirs.
  const players: PlayerState[] = config.players.map((p, i) => {
    const distillery = config.startingDistilleries?.[i] ?? null;
    const explicitDeck = config.starterDecks?.[i];

    let deck: Card[] = [];
    if (explicitDeck) {
      // Apply High-Rye House bonus to the supplied deck before shuffle.
      const deckWithBonus =
        distillery?.bonus === "high_rye"
          ? [...explicitDeck, makeResourceCard("rye", p.id, 999, true, 2)]
          : explicitDeck;
      const shuffled = shuffleCards(deckWithBonus, rngState);
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
      reputation: 0,
      handSize: startingHandSize,
      barrelsSold: 0,
      outForRound: false,
      demandSurgeActive: false,
      brokerFreeTradeUsed: false,
      pendingHalfCostMarketBuy: false,
    };
  });

  // Bourbon deck (mash bills NOT already drafted to players)
  const bourbonSeed = config.bourbonDeck ?? defaultMashBillCatalog();
  const bourbonShuffle = shuffleCards(bourbonSeed, rngState);
  rngState = bourbonShuffle.rngState;

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

  return {
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
    starterDeckDraftCursor: 0,
    allBarrels: [],
    marketConveyor,
    marketSupplyDeck,
    marketDiscard: [],
    bourbonDeck: bourbonShuffle.shuffled,
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
