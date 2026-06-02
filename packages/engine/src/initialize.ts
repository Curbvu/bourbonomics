import { produce, type Draft } from "immer";
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
import { shuffleCards } from "./deck";
import {
  applyDistilleryStarterModifications,
  enterStarterDeckDraftPhase,
  placeBillInSlot,
  placeStartingBarrel,
  topUpSlottedBillsForDistillery,
} from "./starter-pool";
import {
  buildFlagshipLine,
  buildInitialFlagshipPortfolio,
} from "./lines/placement";
import { secondaryPoolIds } from "./lines/boards";
import { dealInitialHands } from "./state";

const DEFAULT_HAND_SIZE = 8;
const DEFAULT_DEMAND = 0;
const MARKET_SIZE = 10;

/**
 * v3.3 — Each player starts with this much Capital on their track
 * unless their distillery overrides via `startingCapital`. Vanilla
 * = 5 by spec. End-game Reputation always starts at 0.
 */
const DEFAULT_STARTING_CAPITAL = 5;

function distilleryStartingCapital(d: Distillery | null): number {
  return d?.startingCapital ?? DEFAULT_STARTING_CAPITAL;
}

/**
 * Build a fresh GameState. Setup phases are skipped per-player when the
 * relevant config field is supplied:
 *   - `startingDistilleries[i]` skips the distillery pick for player i
 *   - `starterDecks[i]`         skips the starter-deck random deal for player i
 *
 * If every player has both pre-assigned, the game lands directly in the
 * demand phase. Otherwise the engine walks distillery_selection →
 * starter_deck_draft → demand. Distillery picks resolve via
 * SELECT_DISTILLERY in reverse-snake order; the starter draft phase
 * deals 16 face-up cards to each remaining drafter at phase entry and
 * resolves via STARTER_TRADE / STARTER_SWAP / STARTER_PASS until every
 * drafter has passed.
 */
export function initializeGame(config: GameConfig): GameState {
  let rngState = config.seed;
  const startingHandSize = config.startingHandSize ?? DEFAULT_HAND_SIZE;
  const startingDemand = config.startingDemand ?? DEFAULT_DEMAND;

  // Players. A player whose starter deck wasn't pre-built starts with an
  // empty deck and joins the starter_deck_draft phase for the v2.4
  // random-deal-and-trading window.
  const players: PlayerState[] = config.players.map((p, i) => {
    const distillery = config.startingDistilleries?.[i] ?? null;
    const explicitDeck = config.starterDecks?.[i];

    let deck: Card[] = [];
    if (explicitDeck) {
      // Pre-built starter decks bypass the trade window entirely. Apply
      // any post-deal distillery modifications now (idempotent — the
      // starter draft path won't see this player) and shuffle.
      const seedDeck = explicitDeck.slice();
      if (distillery) {
        applyDistilleryStarterModifications(seedDeck, p, distillery);
      }
      const shuffled = shuffleCards(seedDeck, rngState);
      // v2.14: no round-1 Labor rig. The starter composition (3 Labor
      // per player) makes the round-1 zero-Labor case rare enough that
      // a rigged draw isn't worth the special-case in the engine.
      deck = shuffled.shuffled;
      rngState = shuffled.rngState;
    }

    // v3.2 Brand Portfolios — the flagship portfolio is bound to the
    // distillery at distillery-pick time (now if pre-assigned,
    // otherwise inside SELECT_DISTILLERY apply). Players without a
    // distillery yet carry an empty portfolio stub.

    return {
      id: p.id,
      name: p.name,
      isBot: p.isBot ?? false,
      difficulty: p.difficulty,
      distillery,
      rickhouseSlots: distillery ? buildRickhouseSlots(p.id, distillery) : [],
      hand: [],
      deck,
      discard: [],
      operationsHand: [],
      opsDiscard: [],
      starterHand: [],
      starterPassed: false,
      starterSwapUsed: false,
      // v3.3 — Starting Capital is the player's distillery stake.
      // Each distillery's value compensates its setup asymmetries.
      capital: distilleryStartingCapital(distillery),
      // v3.3 — Reputation is the end-game accumulator; starts at 0
      // for every player. Brand Portfolio events at end-of-game
      // populate it via computeFinalScores.
      reputation: 0,
      handSize: startingHandSize,
      barrelsSold: 0,
      // Prestige starts at 0 for everyone (including bots). Earned
      // permanently by Gold awards on sale; +1 Capital on every
      // future Silver/Gold-triggering sale.
      prestige: 0,
      // v3.5 — Warehouse slot starts empty and locked. Only
      // engages once the player buys the Warehouse investment card
      // (effects are `implemented: false` in v3.5, so the unlock
      // path is wired for v3.6 — this field is the storage shape).
      warehouseSlot: null,
      warehouseUnlocked: false,
      // v3.5 — Investments owned by the player. Bought investment
      // cards transfer directly here at BUY_FROM_MARKET (never
      // touching `hand`). Empty at init.
      investments: [],
      // ── v3.6 investment effect state ──
      investmentRoundUses: [],
      climateControlledSlotIds: [],
      bondedSlotIds: [],
      masterDistillerTag: null,
      estateBottlingFreeDraftPending: false,
      pendingInvestmentChoice: null,
      soldBillDefIds: [],
      outForRound: false,
      demandSurgeActive: false,
      pendingHalfCostMarketBuy: false,
      pendingMakeDiscount: null,
      pendingRatingBoost: 0,
      nextSaleDemandPenalty: 0,
      pendingWildMashToken: false,
      // Set when the action-phase cursor lands on the player; cleared
      // by ROLL_DEMAND. False at init since the game enters draw first.
      needsDemandRoll: false,
      // Set by ROLL_DEMAND when the player has any un-aged aging
      // barrels; cleared by AGE_BOURBON.
      needsAgeBarrels: false,
      // v2.14: each player gets one Drafting Loop initiation per round.
      // Reset at cleanup.
      draftingLoopUsedThisRound: false,
      // v3.4 — Vanilla's first-sale-of-round flag starts true so the
      // very first sale on round 1 gets the bump. Reset at cleanup.
      firstSaleOfRoundPending: true,
      // ── v3.2 Brand Portfolios ──
      flagshipPortfolio: buildInitialFlagshipPortfolio({ distillery }),
      secondPortfolio: null,
      secondPortfolioDrafted: false,
      inventory: [],
      pendingBottlePlacement: null,
      // ── v3.1 holdover stubs (no behavior; client UI compat only) ──
      flagshipLine: buildFlagshipLine("", p.id),
      secondaryLines: [],
      // ── v3.1 flagship completion-bonus flags (off until earned) ──
      commonSalesIgnoreDemandDrop: false,
      draftingLoopReveals5Next: false,
      prestigeScoringDoubled: false,
      inventoryBottleBonusActive: false,
    };
  });

  // Bourbon deck (mash bills NOT already drafted to players). All
  // unclaimed bills stay face-down — v2.14 retires the face-up bill
  // row; bills surface only during the Drafting Loop. "Top of deck"
  // is the array tail.
  const bourbonSeed = config.bourbonDeck ?? defaultMashBillCatalog();
  const bourbonShuffle = shuffleCards(bourbonSeed, rngState);
  rngState = bourbonShuffle.rngState;
  const bourbonShuffled = bourbonShuffle.shuffled;

  // Unified market supply: resources + Labor + ops + investments in a
  // single shuffled pool. The top 10 cards form the face-up market;
  // the rest stay in the supply deck (refills market on every buy
  // and gets fully refreshed at end-of-year).
  const supplySeed = config.marketSupply ?? defaultMarketSupply();
  const supplyShuffle = shuffleCards(supplySeed, rngState);
  rngState = supplyShuffle.rngState;
  const marketCount = Math.min(MARKET_SIZE, supplyShuffle.shuffled.length);
  const marketSrc = supplyShuffle.shuffled.slice(supplyShuffle.shuffled.length - marketCount);
  const market = marketSrc.slice().reverse();
  const marketSupplyDeck = supplyShuffle.shuffled.slice(0, supplyShuffle.shuffled.length - marketCount);

  // Distillery pool — exclude any distilleries already pre-assigned.
  const distilleryPool = (config.distilleryPool ?? defaultDistilleryPool()).filter(
    (d) => !players.some((p) => p.distillery && p.distillery.defId === d.defId),
  );

  // Setup pick order: humans first (seat order), then any bots
  // (reverse-snake among themselves to preserve their internal
  // fairness convention).
  //
  // v2.14.2: in solo (1 human + bots) the bot's preference list
  // (Connoisseur > Vanilla > High-Rye > Wheated) meant the human
  // routinely lost both Connoisseur AND Vanilla to bot pre-picks —
  // they could only pick from the two "abilities-heavy" distilleries
  // the bot ranked lowest. Promoting humans to the front of the
  // setup queue restores their access to the simpler picks (notably
  // Vanilla, the level-playing-field baseline). Multiplayer rooms
  // (all-human or human+bot) still let every human pick before any
  // bot does; humans go in seat order, which is fine because the
  // human pool isn't trying to outsmart each other for the "easy"
  // distillery.
  const setupPickOrder = (ids: string[]) => {
    const remaining = players.filter((p) => ids.includes(p.id));
    // Reverse-snake within each group (last seat in the group picks
    // first) preserves the "compensation for going late" convention
    // for any group with internal turn order. With every player human
    // this collapses to the original `players.reverse()` behaviour.
    const humans = remaining
      .filter((p) => !p.isBot)
      .map((p) => p.id)
      .reverse();
    const bots = remaining
      .filter((p) => p.isBot)
      .map((p) => p.id)
      .reverse();
    return [...humans, ...bots];
  };
  const distillerySelectionOrder = setupPickOrder(
    players.filter((p) => !p.distillery).map((p) => p.id),
  );
  const starterDeckDraftOrder = setupPickOrder(
    players.filter((_, i) => !config.starterDecks?.[i]).map((p) => p.id),
  );

  let phase: GameState["phase"];
  if (distillerySelectionOrder.length > 0) phase = "distillery_selection";
  else if (starterDeckDraftOrder.length > 0) phase = "starter_deck_draft";
  // v2.9: demand is rolled per-player at the top of each action turn,
  // not as a separate global phase. Setup lands directly in draw.
  else phase = "draw";

  // v3.2 — the v3.1 Line Card deck is gone. The Brand Portfolio
  // second-portfolio drafting pool replaces it: N+2 portfolios are
  // laid out face-up at setup from the shared secondary-pool supply.
  const lineCardDeck: never[] = [];
  const supplyIds = secondaryPoolIds().slice();
  // Deterministic order by id — the pool layout is public and
  // doesn't depend on per-game RNG (matches the spec's "lay out
  // face-up next to the play area" framing). Future expansions can
  // shuffle if needed.
  supplyIds.sort();
  const poolSize = Math.min(supplyIds.length, players.length + 2);
  const secondPortfolioDraftPool = supplyIds.slice(0, poolSize);
  const secondPortfolioSupply = supplyIds.slice(poolSize);

  const initialState: GameState = {
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
    starterUndealtPool: [],
    allBarrels: [],
    market,
    marketSupplyDeck,
    marketDiscard: [],
    bourbonDeck: bourbonShuffled,
    bourbonDiscard: [],
    retiredBills: [],
    draftingLoop: null,
    pendingRaid: null,
    demand: startingDemand,
    demandRolls: [],
    finalRoundTriggered: false,
    finalRoundTriggerPlayerIndex: null,
    playerIdsCompletedPhase: [],
    idCounter: 1,
    lineCardDeck,
    secondPortfolioDraftPool,
    secondPortfolioSupply,
    actionHistory: [],
  };

  // If every player's distillery is pre-assigned (no `distillery_selection`
  // phase), the per-distillery starting barrel placement happens here
  // since SELECT_DISTILLERY won't run for them. v2.6 also places any
  // pre-supplied `startingMashBills[i]` directly into open slots as
  // "ready" barrels (formerly went to `player.mashBills` hand). Same
  // for entering `starter_deck_draft` from init: deal random hands now
  // so the phase is ready for trade actions.
  const skipsDistillerySelection = distillerySelectionOrder.length === 0;
  const anyStartingMashBills =
    (config.startingMashBills ?? []).some((bills) => bills.length > 0);
  if (skipsDistillerySelection || phase === "starter_deck_draft" || anyStartingMashBills) {
    return produce(initialState, (draft: Draft<GameState>) => {
      if (skipsDistillerySelection) {
        for (const player of draft.players) {
          if (player.distillery) {
            placeStartingBarrel(draft, player, player.distillery);
            // v2.6: place any pre-supplied starting bills BEFORE
            // top-up, so the top-up only fills remaining open slots.
            const preBills = config.startingMashBills?.[
              draft.players.findIndex((p) => p.id === player.id)
            ] ?? [];
            for (const bill of preBills) {
              placeBillInSlot(draft, player, bill);
            }
            topUpSlottedBillsForDistillery(draft, player, player.distillery);
          }
        }
      }
      if (phase === "starter_deck_draft") {
        enterStarterDeckDraftPhase(draft);
      }
      // v3.10 — initial deal happens at setup, not via DRAW_HAND.
      // The draw phase is pure orchestration; end-of-turn redraw is
      // the canonical hand refresh. Only fill hands when round 1
      // opens directly in `draw` (skipped if we still owe a
      // distillery pick or a starter trade).
      if (draft.phase === "draw") {
        dealInitialHands(draft);
      }
    });
  }
  return initialState;
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
