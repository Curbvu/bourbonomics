// Bourbonomics PROTOTYPE — game setup.
//
// Builds a fresh GameState from a seed + player names. All shuffling
// threads the seed so a given (seed, names) pair always produces the
// same game.

import { CONFIG } from "./config";
import {
  buildDemandDeck,
  buildDistilleryBoard,
  buildMarketingDeck,
  buildMashBillSupply,
  buildResourceDeck,
  buildSlotCardSupply,
} from "./content";
import { shuffle } from "./rng";
import type { GameState, Player } from "./types";

export interface NewGameOptions {
  seed?: number;
  playerNames?: string[];
  startingCapital?: number;
}

function makePlayer(id: string, name: string, startingCapital: number): Player {
  return {
    id,
    name,
    capital: startingCapital,
    prestige: 0,
    hand: [],
    slotCards: [],
    rickhouse: [],
    brandLines: [],
    distillery: buildDistilleryBoard(),
    actionsRemaining: CONFIG.ACTIONS_PER_ROUND,
    usedFreeMarketing: false,
    bourbonsSold: 0,
  };
}

export function createGame(options: NewGameOptions = {}): GameState {
  const seed = options.seed ?? 1;
  const names = options.playerNames?.length ? options.playerNames : ["Player 1"];
  const startingCapital = options.startingCapital ?? 5;

  let s = seed | 0;

  const [shuffledResources, s1] = shuffle(buildResourceDeck(), s);
  s = s1;
  // Deal the face-up resource market off the top of the shuffled deck.
  const resourceMarket = shuffledResources.slice(0, CONFIG.RESOURCE_MARKET_SIZE);
  const resourceDeck = shuffledResources.slice(CONFIG.RESOURCE_MARKET_SIZE);
  const [allBills, s2] = shuffle(buildMashBillSupply(), s);
  s = s2;
  const [marketingDeck, s3] = shuffle(buildMarketingDeck(), s);
  s = s3;
  const [demandDeck, s4] = shuffle(buildDemandDeck(), s);
  s = s4;

  // Slot supply is abundant and undifferentiated; no need to shuffle.
  const slotCardSupply = buildSlotCardSupply();

  // Deal the face-up mash bill tray off the top of the shuffled supply.
  const mashBillTray = allBills.slice(0, CONFIG.MASH_BILL_TRAY_SIZE);
  const mashBillSupply = allBills.slice(CONFIG.MASH_BILL_TRAY_SIZE);

  // Deal the marketing tray.
  const marketingTray = marketingDeck.slice(0, CONFIG.MARKETING_TRAY_SIZE);
  const marketingDeckRest = marketingDeck.slice(CONFIG.MARKETING_TRAY_SIZE);

  // Draw this round's demand cards (one per player) and sum the flood lines.
  const playerCount = names.length;
  const demandCards = demandDeck.slice(0, playerCount);
  const demandDeckRest = demandDeck.slice(playerCount);
  const blueLine = demandCards.reduce((sum, c) => sum + c.blueCapacity, 0);
  const redLine = demandCards.reduce((sum, c) => sum + c.redCapacity, 0);

  const players = names.map((name, i) =>
    makePlayer(`p${i + 1}`, name, startingCapital),
  );

  return {
    phase: "playing",
    players,
    demand: CONFIG.DEMAND_START,
    demandCards,
    demandDeck: demandDeckRest,
    cubesPlaced: 0,
    blueLine,
    redLine,
    resourceDeck,
    resourceDiscard: [],
    resourceMarket,
    mashBillTray,
    mashBillSupply,
    slotCardSupply,
    marketingTray,
    marketingDeck: marketingDeckRest,
    roundNumber: 1,
    startPlayerIndex: 0,
    currentPlayerIndex: 0,
    actionsRemaining: CONFIG.ACTIONS_PER_ROUND,
    finalRound: null,
    rngSeed: s,
    log: [`Game created (seed ${seed}, ${players.length} player(s)).`],
  };
}
