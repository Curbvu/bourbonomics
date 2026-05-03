/**
 * New-game construction: builds a fresh GameState ready for the
 * Distillery draft (which precedes round 1's action phase).
 *
 * Setup order:
 *   1. Shuffle every deck deterministically from the seed.
 *   2. Deal each baron 4 mash bills (STARTING_BOURBON_HAND).
 *   3. Deal each baron DISTILLERY_DEAL_COUNT (= 2) Distillery cards
 *      face-down. The "deal-2-pick-1" draft resolves via
 *      DISTILLERY_CONFIRM actions; on the first confirmation the
 *      starting bonuses apply and play moves to round 1's action
 *      phase. Phase 1 is still skipped in round 1 because no one
 *      has barrels yet.
 */

import {
  buildBourbonDeck,
  buildDistilleryDeck,
  buildInvestmentDeck,
  buildMarketDeck,
  buildOperationsDeck,
  buildResourcePiles,
  drawTop,
  resetInstanceCounter,
} from "./decks";
import { RICKHOUSES } from "./rickhouses";
import { createRng } from "./rng";
import type { BotDifficulty, GameState, Player, PlayerKind } from "./state";
import {
  DISTILLERY_DEAL_COUNT,
  STARTING_BOURBON_HAND,
  DEFAULT_STARTING_CASH,
  STARTING_DEMAND,
} from "./state";

export type SeatSpec = {
  name: string;
  kind: PlayerKind;
  botDifficulty?: BotDifficulty;
  /** Bourbon-themed icon id chosen for this seat. Optional — falls back to seatIndex-derived logo. */
  logoId?: string;
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
  const marketDeck = buildMarketDeck(rng);
  let distilleryDeck = buildDistilleryDeck(rng);

  // Players. Each player draws STARTING_BOURBON_HAND mash bills and is
  // dealt DISTILLERY_DEAL_COUNT distillery cards face-down. The
  // distillery draft resolves through DISTILLERY_CONFIRM dispatches
  // before the action phase begins.
  const players: Record<string, Player> = {};
  const playerOrder: string[] = [];
  config.seats.forEach((seat, idx) => {
    const id = `p${idx + 1}`;
    playerOrder.push(id);
    const bourbonHand: string[] = [];
    for (let i = 0; i < STARTING_BOURBON_HAND; i += 1) {
      const [card, rest] = drawTop(bourbonDeck);
      if (card == null) break;
      bourbonHand.push(card);
      bourbonDeck = rest;
    }
    const dealtDistilleryIds: string[] = [];
    for (let i = 0; i < DISTILLERY_DEAL_COUNT; i += 1) {
      const [card, rest] = drawTop(distilleryDeck);
      if (card == null) break;
      dealtDistilleryIds.push(card);
      distilleryDeck = rest;
    }
    players[id] = {
      id,
      name: seat.name,
      kind: seat.kind,
      botDifficulty: seat.botDifficulty,
      seatIndex: idx,
      logoId: seat.logoId,
      cash: startingCash,
      resourceHand: [],
      bourbonHand,
      investments: [],
      operations: [],
      silverAwards: [],
      goldBourbons: [],
      eliminated: false,
      marketResolved: false,
      hasTakenPaidActionThisRound: false,
      loanRemaining: 0,
      loanSiphonActive: false,
      loanUsed: false,
      pendingAuditOverage: null,
      dealtDistilleryIds,
      chosenDistilleryId: undefined,
      perkUsedThisRound: {},
    };
  });

  const rickhouses = RICKHOUSES.map((r) => ({
    id: r.id,
    capacity: r.capacity,
    barrels: [],
  }));

  const state: GameState = {
    version: 8,
    id: config.id,
    createdAt,
    seed: config.seed,
    rngState: rng.state,
    round: 1,
    // Game starts in the Distillery draft. Once every baron has
    // confirmed, the reducer transitions to "action" (round 1 still
    // skips Phase 1 fees because no one has barrels).
    phase: "distillery_draft",
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
      bourbonDiscard: [],
      investmentDeck,
      investmentDiscard: [],
      operationsDeck,
      operationsDiscard: [],
      marketDeck,
      marketDiscard: [],
      distilleryDeck,
    },
    demand: STARTING_DEMAND,
    actionPhase: {
      freeWindowActive: true,
      paidLapTier: 0,
      consecutivePasses: 0,
      passedPlayerIds: [],
      actionsThisLapPlayerIds: [],
      auditCalledThisRound: false,
    },
    feesPhase: {
      resolvedPlayerIds: [],
      paidBarrelIds: [],
    },
    marketPhase: {},
    currentRoundEffects: { resourceShortages: [] },
    pendingRoundEffects: { resourceShortages: [] },
    finalRoundTriggered: false,
    finalRoundEndsOnRound: null,
    winnerIds: [],
    winReason: null,
    finalScores: null,
    log: [],
    logSeq: 0,
  };
  return state;
}
