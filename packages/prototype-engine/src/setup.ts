// Bourbonomics — game setup (ground-up rebuild).
//
// Builds a fresh GameState from a seed + player names. All shuffling threads the
// seed so a given (seed, names) pair always produces the same game. The game
// opens in the Demand Phase of round 1 with the starting market laid out,
// awaiting BEGIN_COLLECT.

import { CONFIG } from "./config";
import {
  buildDemandDeck,
  buildDistilleryBoard,
  buildMashBillSupply,
  buildPile,
  DISTILLERY_ROSTER,
  PILE_KINDS,
} from "./content";
import { layoutInitialDemand } from "./engine";
import { shuffle } from "./rng";
import type { GameState, Player, ResourceCard, ResourceKind } from "./types";

export interface NewGameOptions {
  seed?: number;
  playerNames?: string[];
  startingCapital?: number;
  /** Distillery id per player (by index). Falls back to a rotating default. */
  distilleryIds?: string[];
  /** Which seats are AI-played (by index). Omitted = all human. */
  botFlags?: boolean[];
}

function resolveDistillery(ids: string[] | undefined, i: number): string {
  return ids?.[i] ?? DISTILLERY_ROSTER[i % DISTILLERY_ROSTER.length]!.id;
}

function makePlayer(id: string, name: string, startingCapital: number, distilleryId: string, isBot: boolean): Player {
  return {
    id,
    name,
    isBot,
    capital: startingCapital,
    hand: [],
    rickhouse: [],
    distillery: buildDistilleryBoard(distilleryId),
    keptCards: [],
    privateCards: [],
    improvements: 0,
    drewMashBillsThisTurn: false,
    donePlayThisRound: false,
    qualitySortUsedThisRound: false,
    openBillUsedThisRound: false,
    bourbonsSold: 0,
    cardsCompleted: 0,
  };
}

export function createGame(options: NewGameOptions = {}): GameState {
  const seed = options.seed ?? 1;
  const names = options.playerNames?.length ? options.playerNames : ["Player 1"];
  const startingCapital = options.startingCapital ?? CONFIG.STARTING_CAPITAL;

  let s = seed | 0;

  const piles = {} as Record<ResourceKind, ResourceCard[]>;
  const pileDiscards = {} as Record<ResourceKind, ResourceCard[]>;
  for (const kind of PILE_KINDS) {
    const [shuffled, sNext] = shuffle(buildPile(kind), s);
    s = sNext;
    piles[kind] = shuffled;
    pileDiscards[kind] = [];
  }

  const [mashBillSupply, s2] = shuffle(buildMashBillSupply(), s);
  s = s2;
  const [demandDeck, s3] = shuffle(buildDemandDeck(), s);
  s = s3;

  const players = names.map((name, i) =>
    makePlayer(`p${i + 1}`, name, startingCapital, resolveDistillery(options.distilleryIds, i), options.botFlags?.[i] ?? false),
  );

  const state: GameState = {
    phase: "playing",
    roundPhase: "demand",
    players,
    demandCards: [],
    demandDeck,
    demandDiscard: [],
    piles,
    pileDiscards,
    mashBillSupply,
    collect: null,
    roundNumber: 1,
    startPlayerIndex: 0,
    currentPlayerIndex: 0,
    finalRound: null,
    rngSeed: s,
    log: [`Game created (seed ${seed}, ${players.length} player(s)).`],
  };

  // Demand Phase of round 1: lay out the starting market.
  layoutInitialDemand(state);
  return state;
}
