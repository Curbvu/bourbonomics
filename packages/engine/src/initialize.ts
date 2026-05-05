import type {
  Card,
  Distillery,
  GameConfig,
  GameState,
  OperationsCard,
  PlayerState,
} from "./types";
import {
  defaultMarketSupply,
  defaultMashBillCatalog,
  defaultStarterCards,
} from "./defaults";
import { defaultDistilleryPool, buildRickhouseSlots } from "./distilleries";
import { defaultOperationsDeck } from "./operations";
import { drawCards, shuffleCards } from "./deck";
import { makeResourceCard } from "./cards";

const DEFAULT_HAND_SIZE = 8;
const DEFAULT_DEMAND = 0;
const DEFAULT_STARTING_OPS_CARDS = 2;
const MARKET_CONVEYOR_SIZE = 6;

/**
 * Build a fresh GameState. If `startingDistilleries` is provided, the game
 * skips the selection phase and lands directly in the demand phase. Otherwise
 * the game starts in `distillery_selection` and resolves picks in reverse-
 * snake order via SELECT_DISTILLERY.
 */
export function initializeGame(config: GameConfig): GameState {
  let rngState = config.seed;
  const startingHandSize = config.startingHandSize ?? DEFAULT_HAND_SIZE;
  const startingDemand = config.startingDemand ?? DEFAULT_DEMAND;
  const startingOpsCount = config.startingOperationsCardCount ?? DEFAULT_STARTING_OPS_CARDS;

  // Players (with shuffled starter decks; distillery may be assigned now or later)
  const players: PlayerState[] = config.players.map((p, i) => {
    const distillery = config.startingDistilleries?.[i] ?? null;
    const startingDeck = config.starterDecks?.[i] ?? defaultStarterCards(p.id);
    // Apply High-Rye House bonus: prepend a free 2-rye to the starter deck before shuffle.
    const deckWithBonus =
      distillery?.bonus === "high_rye"
        ? [...startingDeck, makeResourceCard("rye", p.id, 999, true, 2)]
        : startingDeck;
    const { shuffled, rngState: nextRng } = shuffleCards(deckWithBonus, rngState);
    rngState = nextRng;
    const startingMash = config.startingMashBills?.[i] ?? [];
    return {
      id: p.id,
      name: p.name,
      isBot: p.isBot ?? false,
      distillery,
      rickhouseSlots: distillery ? buildRickhouseSlots(p.id, distillery) : [],
      hand: [],
      deck: shuffled,
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
      pendingRushBarrelId: null,
    };
  });

  // Bourbon deck (mash bills NOT already drafted to players)
  const bourbonSeed = config.bourbonDeck ?? defaultMashBillCatalog();
  const bourbonShuffle = shuffleCards(bourbonSeed, rngState);
  rngState = bourbonShuffle.rngState;

  // Operations deck. Shuffle once then deal `startingOpsCount` to each player.
  const opsSeed = config.operationsDeck ?? defaultOperationsDeck();
  const opsShuffle = shuffleCards(opsSeed, rngState);
  rngState = opsShuffle.rngState;
  let operationsDeck = opsShuffle.shuffled;
  for (const p of players) {
    const drawResult = drawCards<OperationsCard>(operationsDeck, startingOpsCount);
    p.operationsHand = drawResult.drawn.map((c) => ({ ...c, drawnInRound: 0 }));
    operationsDeck = drawResult.remaining;
  }

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

  // Reverse snake selection order (last player picks first).
  const distillerySelectionOrder = players
    .filter((p) => !p.distillery)
    .map((p) => p.id)
    .reverse();

  const phase: GameState["phase"] =
    distillerySelectionOrder.length > 0 ? "distillery_selection" : "demand";

  return {
    seed: config.seed,
    rngState,
    round: 1,
    phase,
    currentPlayerIndex: 0,
    players,
    distilleryPool,
    distillerySelectionOrder,
    distillerySelectionCursor: 0,
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
