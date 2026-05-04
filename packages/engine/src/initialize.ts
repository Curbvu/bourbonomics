import type { GameConfig, GameState, PlayerState } from "./types";
import {
  defaultMarketSupply,
  defaultMashBillCatalog,
  defaultRickhouses,
  defaultStarterCards,
} from "./defaults";
import { shuffleCards } from "./deck";

const DEFAULT_HAND_SIZE = 8;
const DEFAULT_DEMAND = 6;
const MARKET_CONVEYOR_SIZE = 6;

/**
 * Build a fresh GameState. Phase 8 will add the interactive draft layer on top
 * of this; until then callers can pre-supply starter decks / mash bills via
 * GameConfig (defaults are sensible enough for engine tests).
 */
export function initializeGame(config: GameConfig): GameState {
  let rngState = config.seed;
  const startingHandSize = config.startingHandSize ?? DEFAULT_HAND_SIZE;
  const startingDemand = config.startingDemand ?? DEFAULT_DEMAND;
  const rickhouses = config.rickhouses ?? defaultRickhouses();

  // Players (with shuffled starter decks)
  const players: PlayerState[] = config.players.map((p, i) => {
    const startingDeck = config.starterDecks?.[i] ?? defaultStarterCards(p.id);
    const { shuffled, rngState: nextRng } = shuffleCards(startingDeck, rngState);
    rngState = nextRng;
    const startingMash = config.startingMashBills?.[i] ?? [];
    return {
      id: p.id,
      name: p.name,
      isBot: p.isBot ?? false,
      hand: [],
      deck: shuffled,
      discard: [],
      trashed: [],
      mashBills: startingMash.slice(),
      unlockedGoldBourbons: [],
      reputation: 0,
      handSize: startingHandSize,
      barrelsSold: 0,
      outForRound: false,
    };
  });

  // Bourbon deck (mash bills NOT already drafted to players)
  const bourbonSeed = config.bourbonDeck ?? defaultMashBillCatalog();
  const bourbonShuffle = shuffleCards(bourbonSeed, rngState);
  rngState = bourbonShuffle.rngState;

  // Market supply: 6 to conveyor, rest stay in supply deck face-down.
  const supplySeed = config.marketSupply ?? defaultMarketSupply();
  const supplyShuffle = shuffleCards(supplySeed, rngState);
  rngState = supplyShuffle.rngState;
  const conveyorCount = Math.min(MARKET_CONVEYOR_SIZE, supplyShuffle.shuffled.length);
  const conveyorSrc = supplyShuffle.shuffled.slice(supplyShuffle.shuffled.length - conveyorCount);
  const marketConveyor = conveyorSrc.slice().reverse();
  const marketSupplyDeck = supplyShuffle.shuffled.slice(0, supplyShuffle.shuffled.length - conveyorCount);

  return {
    seed: config.seed,
    rngState,
    round: 1,
    phase: "demand",
    currentPlayerIndex: 0,
    players,
    rickhouses,
    allBarrels: [],
    marketConveyor,
    marketSupplyDeck,
    marketDiscard: [],
    bourbonDeck: bourbonShuffle.shuffled,
    bourbonDiscard: [],
    demand: startingDemand,
    demandRolls: [],
    finalRoundTriggered: false,
    finalRoundTriggerPlayerIndex: null,
    playerIdsCompletedPhase: [],
    idCounter: 1,
    actionHistory: [],
  };
}
