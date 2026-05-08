// ============================================================
// Tutorial scenario builder.
//
// Constructs a fully-deterministic GameConfig for the on-rails tutorial.
// Tutorial-only mash bills (Backroad Batch, Heritage Reserve) live here
// rather than the public catalog so they never appear in real games or
// the Bourbon Cards gallery. The scenario pre-assigns distilleries,
// pre-deals the human's hand and the bot's pre-aged barrel, hand-stacks
// the market conveyor, and drops demand at 2.
//
// The returned GameState already has both human mash bills slotted as
// "ready" barrels and the bot's pre-aged Aging barrel placed. The
// orchestrator's autoplay loop is bypassed by the tutorial controller,
// so RNG is irrelevant for the scripted path — every dice roll, bot
// action, and card draw is supplied by the tutorial controller itself.
// ============================================================

import type { Card, GameState, MashBill } from "./types";
import {
  makeCapitalCard,
  makeMashBill,
  makePremiumResource,
  makeResourceCard,
} from "./cards";
import { buildVanillaDistilleryFor } from "./distilleries";
import { initializeGame } from "./initialize";

export const TUTORIAL_HUMAN_ID = "human";
export const TUTORIAL_BOT_ID = "bot1";

/**
 * Backroad Batch (tutorial). Common, no awards, no recipe constraints
 * beyond the universal rule. A small forgiving grid so Beat 9's small-
 * sale moment lands on a clean integer.
 */
export function buildTutorialBackroadBill(idx = 0): MashBill {
  return makeMashBill(
    {
      defId: "tutorial_backroad_batch",
      name: "Backroad Batch",
      slogan: "Built for the long haul.",
      flavorText: "A ship-it-anyway corn-rye workhorse. Your founder's first recipe.",
      tier: "common",
      complexityTier: 1,
      // Lower band starts at age 1 so the tutorial's Beat-9 sale lands
      // on a clean 2 even if the player's Backroad has only had one
      // year to settle. The bot's pre-staged barrel still slots into
      // the upper band at age 4.
      ageBands: [1, 4],
      demandBands: [1, 3],
      rewardGrid: [
        [2, 3],
        [3, 4],
      ],
    },
    idx,
  );
}

/**
 * Heritage Reserve (tutorial). Fake bill with a Silver award at age 3.
 * Recipe: ≥2 rye + 1 Specialty Rye. Pays meaningfully better at high
 * demand so Beat 11's age-3, demand-5 sale lands on 5 reputation.
 */
export function buildTutorialHeritageBill(idx = 0): MashBill {
  return makeMashBill(
    {
      defId: "tutorial_heritage_reserve",
      name: "Heritage Reserve",
      slogan: "Patience, with pepper.",
      flavorText: "The estate's own — rye-forward, single specialty cut, locked behind a Silver.",
      tier: "uncommon",
      complexityTier: 2,
      ageBands: [2, 3],
      demandBands: [2, 4],
      rewardGrid: [
        [2, 3],
        [3, 5],
      ],
      recipe: { minRye: 2, minSpecialty: { rye: 1 } },
      silverAward: { minAge: 3 },
    },
    idx,
  );
}

/**
 * The Specialty Rye card the player buys in Beat 3. Built once with a
 * stable id so the tutorial controller can find it on the conveyor and
 * later re-locate it in the player's discard / deck for the rigged
 * round-2 draw.
 */
export function buildTutorialSpecialtyRye(): Card {
  return makePremiumResource({
    defId: "superior_rye",
    displayName: "Superior Rye",
    flavor: "Reserve cut, sharper edge.",
    subtype: "rye",
    resourceCount: 1,
    cost: 3,
    effect: { kind: "rep_on_sale_flat", when: "on_sale", rep: 1 },
    specialty: true,
    ownerLabel: "tutorial",
    index: 1,
  });
}

/**
 * The exact 8 cards the player begins the tutorial holding.
 *
 *   2 cask + 2 corn + 2 rye(common) + 1×$3 capital + 1×$1 capital
 *
 * Sizing rationale: enough resources to fully build Backroad Batch
 * (Beat 1) AND commit a partial pile to Heritage (Beat 2) AND afford
 * the Specialty Rye buy (Beat 3) with $1 left over for cleanup. After
 * round-1 cleanup, hand → discard → reshuffled into deck for the round-2
 * draw, where the controller manually re-orders the deck so the
 * Specialty Rye is on top.
 */
export function buildTutorialStartingHand(): Card[] {
  const hand: Card[] = [];
  let idx = 0;
  hand.push(makeResourceCard("cask", "tutorial-hand", idx++));
  hand.push(makeResourceCard("cask", "tutorial-hand", idx++));
  hand.push(makeResourceCard("corn", "tutorial-hand", idx++));
  hand.push(makeResourceCard("corn", "tutorial-hand", idx++));
  hand.push(makeResourceCard("rye", "tutorial-hand", idx++));
  hand.push(makeResourceCard("rye", "tutorial-hand", idx++));
  hand.push(makeCapitalCard("tutorial-hand", idx++, 3));
  hand.push(makeCapitalCard("tutorial-hand", idx++, 1));
  return hand;
}

/**
 * Backup deck for the human, used after the round-1 cleanup. We need a
 * handful of cards to back the round-2/3 draws so the player has cards
 * to spend on aging and the final sell action. The controller will
 * re-stack this around the bought Specialty Rye between rounds.
 */
function buildTutorialHumanDeck(): Card[] {
  const cards: Card[] = [];
  let idx = 100;
  // Enough for Beat 6 (1 age × 2 barrels = 2 cards) + Beat 9 (1 sell
  // cost) + Beat 10 (extra ages on Heritage to push it 2→3) + Beat 11
  // (1 sell cost). Plus a couple of buffers.
  cards.push(makeResourceCard("corn", "tutorial-deck", idx++));
  cards.push(makeResourceCard("corn", "tutorial-deck", idx++));
  cards.push(makeResourceCard("rye", "tutorial-deck", idx++));
  cards.push(makeResourceCard("barley", "tutorial-deck", idx++));
  cards.push(makeResourceCard("wheat", "tutorial-deck", idx++));
  cards.push(makeCapitalCard("tutorial-deck", idx++, 1));
  cards.push(makeCapitalCard("tutorial-deck", idx++, 1));
  cards.push(makeCapitalCard("tutorial-deck", idx++, 1));
  return cards;
}

/**
 * Bot's pre-staged aging barrel. The bot's first scripted action (Beat
 * 7) is to sell this barrel — which forces the demand drop. We seed it
 * with a Backroad Batch bill at age 4 so the sale resolves to a clean
 * 3 reputation at demand 2.
 */
function buildBotStartingBills(): MashBill[] {
  // Just one — the pre-staged Aging barrel.
  return [buildTutorialBackroadBill(99)];
}

/**
 * Conveyor stack for the tutorial. The Specialty Rye lives at slot 0
 * (the only buyable target during Beat 3); the rest are filler. Cards
 * are listed top-down (slot 0 first).
 */
function buildTutorialMarketConveyor(): Card[] {
  const cards: Card[] = [];
  cards.push(buildTutorialSpecialtyRye());
  // Filler — appears in the conveyor but is not interactive during the
  // tutorial. Distinct cards so they look natural rather than a cloned row.
  let idx = 200;
  cards.push(makeResourceCard("corn", "tutorial-market", idx++));
  cards.push(makeResourceCard("rye", "tutorial-market", idx++));
  cards.push(makeResourceCard("barley", "tutorial-market", idx++));
  cards.push(makeResourceCard("wheat", "tutorial-market", idx++));
  cards.push(makeCapitalCard("tutorial-market", idx++, 1));
  cards.push(makeCapitalCard("tutorial-market", idx++, 1));
  cards.push(makeResourceCard("cask", "tutorial-market", idx++));
  cards.push(makeResourceCard("cask", "tutorial-market", idx++));
  cards.push(makeCapitalCard("tutorial-market", idx++, 3));
  return cards;
}

/**
 * Build the initial tutorial GameState. After this call:
 *
 *   - human player has Backroad Batch + Heritage Reserve as "ready"
 *     barrels in slots 0 and 1, an empty 8-card hand (we set a
 *     forced hand below), and a small deck queued for round 2+
 *   - bot player has one Aging barrel at age 4 with Backroad Batch
 *   - market conveyor's slot 0 holds the Specialty Rye for $3
 *   - demand starts at 2; final-round trigger is disabled by virtue
 *     of the supply not running out during the scripted beats
 *   - phase is "action" (we collapse demand + draw — the tutorial
 *     controller skips them on round 1)
 */
export function buildTutorialInitialState(): GameState {
  const humanDistillery = buildVanillaDistilleryFor(TUTORIAL_HUMAN_ID);
  const botDistillery = buildVanillaDistilleryFor(TUTORIAL_BOT_ID);

  // Pre-built starter decks bypass the trade window. Human gets their
  // backup deck (the round-2+ replenishment); bot gets a few generic
  // cards so its sell-action can pay its 1-card cost.
  const humanDeck = buildTutorialHumanDeck();
  const botDeck: Card[] = (() => {
    const cards: Card[] = [];
    let idx = 300;
    for (let i = 0; i < 4; i++) cards.push(makeCapitalCard("tutorial-bot", idx++, 1));
    for (let i = 0; i < 4; i++) cards.push(makeResourceCard("corn", "tutorial-bot", idx++));
    return cards;
  })();

  // initializeGame doesn't surface a way to skip the demand+draw phase
  // entry point, but our tutorial controller drives the game manually
  // from the action phase onward, so we land in `phase: "action"` by
  // pre-running through demand+draw via an explicit DRAW_HAND mutation
  // below. For now we ask initializeGame to skip the setup phases.
  const startingDistilleries = [humanDistillery, botDistillery];
  const startingMashBills: MashBill[][] = [
    [buildTutorialBackroadBill(0), buildTutorialHeritageBill(0)],
    buildBotStartingBills(),
  ];
  const marketConveyor = buildTutorialMarketConveyor();

  const state = initializeGame({
    seed: 0xb0bb_0220,
    players: [
      { id: TUTORIAL_HUMAN_ID, name: "You", isBot: false },
      { id: TUTORIAL_BOT_ID, name: "Rival Distillery", isBot: true },
    ],
    starterDecks: [humanDeck, botDeck],
    startingDistilleries,
    startingMashBills,
    // No bourbonDeck supplied — the catalog isn't relevant since the
    // tutorial never draws fresh bills. Pass an empty deck so the
    // engine doesn't accidentally surface a real Bourbon card mid-
    // tutorial during a stray DRAW_MASH_BILL we forgot to gate.
    bourbonDeck: [],
    // Hand-stacked conveyor with Specialty Rye at slot 0. Pass it as
    // the supply so init pulls 10 cards into the conveyor; we then
    // overwrite the conveyor below to guarantee slot 0 is the
    // Specialty Rye even after init's reverse() ordering.
    marketSupply: marketConveyor,
    operationsDeck: [],
    startingDemand: 2,
    startingHandSize: 8,
  });

  // initializeGame's market init reverses the supply tail before
  // assigning to the conveyor — we hand-stack our own to lock slot 0
  // to the Specialty Rye irrespective of that internal order.
  // We also seed the human's hand here (initializeGame leaves it empty)
  // and pre-stage the bot's aging barrel.
  return primeTutorialState(state);
}

function primeTutorialState(state: GameState): GameState {
  // Engine state is plain objects with deep mutation safety enforced
  // only via `applyAction`. We're constructing the initial scenario,
  // not transitioning, so a structured clone + direct edits is fine.
  const next: GameState = JSON.parse(JSON.stringify(state)) as GameState;

  // Force the conveyor: slot 0 = Specialty Rye, then 9 filler.
  next.marketConveyor = buildTutorialMarketConveyor();
  next.marketSupplyDeck = [];
  next.marketDiscard = [];

  // Force the human's hand exactly per spec.
  const human = next.players.find((p) => p.id === TUTORIAL_HUMAN_ID)!;
  human.hand = buildTutorialStartingHand();

  // The bot's pre-aged barrel: lift the bill we placed via
  // startingMashBills (a "ready" barrel) into an Aging barrel at age 4
  // so it's saleable from round 1 with a clean grid payout.
  const botBarrels = next.allBarrels.filter((b) => b.ownerId === TUTORIAL_BOT_ID);
  const botBarrel = botBarrels[0];
  if (botBarrel) {
    botBarrel.phase = "aging";
    botBarrel.completedInRound = 0;
    botBarrel.age = 4;
    botBarrel.productionRound = 0;
    // Synthesize four corn cards as the aging stack so the visual
    // age ticker reads correctly when the controller fires the sale.
    botBarrel.agingCards = Array.from({ length: 4 }, (_, i) => ({
      id: `agingcard_tutorial_bot_${i}`,
      cardDefId: "corn",
      type: "resource" as const,
      subtype: "corn" as const,
      resourceCount: 1,
    }));
  }

  // Walk straight to the action phase. v2.9 normally lands init in
  // `draw`; the tutorial collapses through to `action` because Beat 1
  // owns the narrative from there. Both v2.9 per-turn gates
  // (`needsDemandRoll`, `needsAgeBarrels`) start cleared on every
  // player and are kept cleared by the controller's post-dispatch
  // hook — the tutorial teaches voluntary aging instead of the
  // mandatory holding cost.
  next.phase = "action";
  next.currentPlayerIndex = 0;
  next.startPlayerIndex = 0;
  next.playerIdsCompletedPhase = [];
  for (const p of next.players) {
    p.outForRound = false;
    p.needsDemandRoll = false;
    p.needsAgeBarrels = false;
  }

  return next;
}
