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
  buildPile,
  PILE_KINDS,
  buildSlotCardSupply,
  DISTILLERY_ROSTER,
} from "./content";
import { shuffle } from "./rng";
import type { GameState, Player, ResourceCard, ResourceKind } from "./types";

export interface NewGameOptions {
  seed?: number;
  playerNames?: string[];
  startingCapital?: number;
  /** Distillery id per player (by index). Falls back to a rotating default. */
  distilleryIds?: string[];
}

/** Resolve player i's distillery: explicit choice, else rotate the roster. */
function resolveDistillery(ids: string[] | undefined, i: number): string {
  return ids?.[i] ?? DISTILLERY_ROSTER[i % DISTILLERY_ROSTER.length]!.id;
}

function makePlayer(
  id: string,
  name: string,
  startingCapital: number,
  distilleryId: string,
): Player {
  return {
    id,
    name,
    capital: startingCapital,
    prestige: 0,
    hand: [],
    slotCards: [],
    rickhouse: [],
    brandLines: [],
    distillery: buildDistilleryBoard(distilleryId),
    actionsRemaining: CONFIG.ACTIONS_PER_ROUND,
    usedFreeMarketing: false,
    overflowDrawsThisRound: 0,
    bourbonsSold: 0,
  };
}

export function createGame(options: NewGameOptions = {}): GameState {
  const seed = options.seed ?? 1;
  const names = options.playerNames?.length ? options.playerNames : ["Player 1"];
  const startingCapital = options.startingCapital ?? 5;

  let s = seed | 0;

  // Build the five face-down piles, each its own shuffled stack (blind quality).
  const piles = {} as Record<ResourceKind, ResourceCard[]>;
  const pileDiscards = {} as Record<ResourceKind, ResourceCard[]>;
  for (const kind of PILE_KINDS) {
    const [shuffled, sNext] = shuffle(buildPile(kind), s);
    s = sNext;
    piles[kind] = shuffled;
    pileDiscards[kind] = [];
  }
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
    makePlayer(
      `p${i + 1}`,
      name,
      startingCapital,
      resolveDistillery(options.distilleryIds, i),
    ),
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
    piles,
    pileDiscards,
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
