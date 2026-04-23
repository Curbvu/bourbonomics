/**
 * New-game construction: builds a fresh GameState at the opening phase.
 */

import {
  buildBourbonDeck,
  buildEventDeck,
  buildInvestmentDeck,
  buildOperationsDeck,
  buildResourcePiles,
  drawTop,
  resetInstanceCounter,
} from "./decks";
import { RICKHOUSES } from "./rickhouses";
import { createRng } from "./rng";
import type { BotDifficulty, GameState, Player, PlayerKind } from "./state";
import { DEFAULT_STARTING_CASH, STARTING_DEMAND } from "./state";

export type SeatSpec = {
  name: string;
  kind: PlayerKind;
  botDifficulty?: BotDifficulty;
};

export type NewGameConfig = {
  id: string;
  seed: number;
  seats: SeatSpec[];
  startingCash?: number;
  createdAt?: number;
};

export function createInitialState(config: NewGameConfig): GameState {
  if (config.seats.length < 2 || config.seats.length > 6) {
    throw new Error(
      `Bourbonomics supports 2–6 barons; got ${config.seats.length}`,
    );
  }

  resetInstanceCounter(0);
  const rng = createRng(config.seed);
  const startingCash = config.startingCash ?? DEFAULT_STARTING_CASH;
  const createdAt = config.createdAt ?? 0;

  // Build all decks + piles deterministically from the seed.
  const piles = buildResourcePiles(rng);
  let bourbonDeck = buildBourbonDeck(rng);
  const investmentDeck = buildInvestmentDeck(rng);
  const operationsDeck = buildOperationsDeck(rng);
  const eventDeck = buildEventDeck(rng);

  // Flip the top of the bourbon deck face up.
  const [faceUp, rest] = drawTop(bourbonDeck);
  bourbonDeck = rest;

  // Players.
  const players: Record<string, Player> = {};
  const playerOrder: string[] = [];
  config.seats.forEach((seat, idx) => {
    const id = `p${idx + 1}`;
    playerOrder.push(id);
    players[id] = {
      id,
      name: seat.name,
      kind: seat.kind,
      botDifficulty: seat.botDifficulty,
      seatIndex: idx,
      cash: startingCash,
      resourceHand: [],
      bourbonHand: [],
      investments: [],
      operations: [],
      silverAwards: [],
      goldAwards: [],
      eliminated: false,
      marketResolved: false,
      hasTakenPaidActionThisRound: false,
      openingDraft: null,
      openingKeptBeforeAuction: null,
    };
  });

  // Opening-phase draft: draw 6 investments for each player. They will choose 3 to keep.
  for (const pid of playerOrder) {
    const draft: string[] = [];
    for (let i = 0; i < 6; i++) {
      const [top, rem] = drawTop(investmentDeck);
      if (top === null) break;
      draft.push(top);
      investmentDeck.length = 0;
      investmentDeck.push(...rem);
    }
    players[pid].openingDraft = draft;
  }

  const rickhouses = RICKHOUSES.map((r) => ({
    id: r.id,
    capacity: r.capacity,
    barrels: [],
  }));

  const state: GameState = {
    version: 1,
    id: config.id,
    createdAt,
    seed: config.seed,
    rngState: rng.state,
    mode: "kentucky_straight",
    round: 1,
    phase: "opening",
    startPlayerId: playerOrder[0],
    firstPasserId: null,
    players,
    playerOrder,
    currentPlayerId: playerOrder[0],
    rickhouses,
    market: {
      cask: piles.cask,
      corn: piles.corn,
      barley: piles.barley,
      rye: piles.rye,
      wheat: piles.wheat,
      bourbonDeck,
      bourbonFaceUp: faceUp,
      bourbonDiscard: [],
      investmentDeck,
      operationsDeck,
      eventDeck,
    },
    demand: STARTING_DEMAND,
    actionPhase: {
      freeWindowActive: true,
      paidLapTier: 0,
      consecutivePasses: 0,
      passedPlayerIds: [],
      actionsThisLapPlayerIds: [],
    },
    feesPhase: {
      resolvedPlayerIds: [],
      paidBarrelIds: [],
      unpaidDebt: {},
    },
    winnerIds: [],
    winReason: null,
    log: [],
    logSeq: 0,
  };
  return state;
}
