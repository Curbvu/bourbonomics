// Bourbonomics — game setup (ground-up revision).
//
// Builds a fresh GameState from a seed + player names. All shuffling threads
// the seed so a given (seed, names) pair always produces the same game. The
// game opens in the Demand Phase of round 1 with the demand laid out, awaiting
// BEGIN_COLLECT.

import { CONFIG } from "./config";
import {
  buildDemandDeck,
  buildDistilleryBoard,
  buildMashBillSupply,
  buildPile,
  DISTILLERY_ROSTER,
  PILE_KINDS,
} from "./content";
import { shuffle } from "./rng";
import type { DemandCard, GameState, Player, ResourceCard, ResourceKind } from "./types";

export interface NewGameOptions {
  seed?: number;
  playerNames?: string[];
  startingCapital?: number;
  /** Distillery id per player (by index). Falls back to a rotating default. */
  distilleryIds?: string[];
}

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
    rickhouse: [],
    distillery: buildDistilleryBoard(distilleryId),
    improvements: 0,
    drewMashBillsThisTurn: false,
    donePlayThisRound: false,
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

  const [mashBillSupply, s2] = shuffle(buildMashBillSupply(), s);
  s = s2;
  const [demandDeck, s3] = shuffle(buildDemandDeck(), s);
  s = s3;

  const players = names.map((name, i) =>
    makePlayer(`p${i + 1}`, name, startingCapital, resolveDistillery(options.distilleryIds, i)),
  );

  // Demand Phase of round 1: lay out demand. Every player starts at Marketing
  // level 0 (1 card), so one card is laid down; demand = its level.
  const marketingCount = Math.max(
    1,
    ...players.map((p) => p.distillery.departments.find((d) => d.id === "marketing")!.values[0]!),
  );
  const demandCards: DemandCard[] = demandDeck.slice(0, marketingCount);
  const demandDeckRest = demandDeck.slice(marketingCount);
  const demand = Math.max(
    CONFIG.DEMAND_FALLBACK,
    ...demandCards.map((c) => c.level),
    CONFIG.DEMAND_FLOOR,
  );

  return {
    phase: "playing",
    roundPhase: "demand",
    players,
    demand: Math.min(demand, CONFIG.DEMAND_CAP),
    demandCards,
    demandDeck: demandDeckRest,
    piles,
    pileDiscards,
    mashBillSupply,
    collect: null,
    roundNumber: 1,
    startPlayerIndex: 0,
    currentPlayerIndex: 0,
    finalRound: null,
    rngSeed: s,
    log: [
      `Game created (seed ${seed}, ${players.length} player(s)).`,
      `Demand laid out: ${demandCards.map((c) => c.label).join(", ")} → demand level ${Math.min(demand, CONFIG.DEMAND_CAP)}.`,
    ],
  };
}
