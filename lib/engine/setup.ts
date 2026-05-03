/**
 * New-game construction: builds a fresh GameState ready for Round 1's action phase.
 *
 * Per current rules there is no opening draft / auction. Phase 1 is skipped in
 * Round 1 (no barrels yet to age), so the new game starts in the action phase.
 */

import {
  buildBourbonDeck,
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
  STARTING_BOURBON_HAND,
  DEFAULT_STARTING_CASH,
  STARTING_DEMAND,
  STARTING_FREE_ACTIONS,
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

  // Players. Each player draws STARTING_BOURBON_HAND mash bills into their
  // starting bourbon hand. The bourbon deck is small enough (and the seat
  // count bounded at 6) that we can drain it in order without worrying
  // about reshuffles here.
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
    };
  });

  const rickhouses = RICKHOUSES.map((r) => ({
    id: r.id,
    capacity: r.capacity,
    barrels: [],
  }));

  const state: GameState = {
    version: 7,
    id: config.id,
    createdAt,
    seed: config.seed,
    rngState: rng.state,
    round: 1,
    // Round 1 skips Phase 1 fees; the game starts directly in the action phase.
    phase: "action",
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
    },
    demand: STARTING_DEMAND,
    actionPhase: {
      freeWindowActive: true,
      paidLapTier: 0,
      consecutivePasses: 0,
      passedPlayerIds: [],
      actionsThisLapPlayerIds: [],
      auditCalledThisRound: false,
      // Round 1 is the "setup" round — every player gets a generous
      // free-action budget so they can stock resources, draw bills, and
      // barrel a few mashes without paying. Subsequent rounds reset to 0
      // in resetActionPhase.
      freeActionsRemainingByPlayer: Object.fromEntries(
        playerOrder.map((id) => [id, STARTING_FREE_ACTIONS]),
      ),
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
