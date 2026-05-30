// ============================================================
// Advanced tutorial scenario builder.
//
// Sister to `tutorial.ts`. The basic tutorial teaches one barrel
// end-to-end (Make → Buy → Age → Sell, 4 chapters). The advanced
// tutorial covers everything the basic one skips: distillery picks,
// starter draft + trade, mash-bill anatomy, the Drafting Loop,
// Specialty/Heritage resources, demand mechanics, ops cards,
// Warehouse, player trade, awards, brand portfolios, second
// portfolios, and endgame scoring.
//
// Unlike the basic tutorial, this scenario drops into
// `phase: "distillery_selection"` so chapter 1 is real — the player
// actually picks via the live DistilleryDraftModal. Subsequent
// chapters mutate state forward via the controller's `transition`
// beat `mutate` hooks (jump rounds, age barrels, restock markets).
//
// Pre-stacks: bourbon deck (so chapter 4's Drafting Loop reveals
// the bills we want), bot decks, and a market that gets re-rolled
// chapter-by-chapter via mutate.
// ============================================================

import type { Card, GameState, MashBill } from "./types";
import {
  makeLaborCard,
  makeMashBill,
  makePremiumResource,
  makeResourceCard,
} from "./cards";
import { defaultDistilleryPool } from "./distilleries";
import { initializeGame } from "./initialize";

export const ADV_TUTORIAL_HUMAN_ID = "human";
export const ADV_TUTORIAL_BOT1_ID = "bot1";
export const ADV_TUTORIAL_BOT2_ID = "bot2";
export const ADV_TUTORIAL_BOT3_ID = "bot3";

// ─────────────────────────────────────────────────────────────────
// Tutorial-only mash bills used to demonstrate specific mechanics.
// All flagged `tutorialOnly: true` so they never appear in real
// games or the Bourbon Cards gallery.
// ─────────────────────────────────────────────────────────────────

/**
 * Rare bill used by Chapter 3 ("Read a mash bill") + Chapter 5
 * ("Specialty resources"). Recipe enforces a Specialty Rye gate
 * so the chapter has something concrete to demonstrate; the grid
 * + tier floor are dramatic enough that the inspect modal teaches
 * the 2D lookup cleanly.
 */
export function buildAdvTutorialRareBill(idx = 0): MashBill {
  return makeMashBill(
    {
      defId: "adv_tutorial_rare_rye",
      name: "Pepperbox Rare",
      slogan: "Spice on spice, locked behind specialty.",
      flavorText:
        "A rare four-grain rye — the recipe demands one Specialty Rye to unlock.",
      tier: "rare",
      complexityTier: 3,
      ageBands: [2, 5],
      demandBands: [2, 6],
      rewardGrid: [
        [4, 5],
        [5, 7],
      ],
      recipe: { minRye: 2, minSpecialty: { rye: 1 } },
      silverAward: { minAge: 4 },
      tutorialOnly: true,
    },
    idx,
  );
}

/**
 * Common bill used by Chapter 4's Drafting Loop reveal. Three cheap
 * common bills make the "take 1 for the cost of 1 hand card" action
 * legible without overloading the player with complex recipes.
 */
export function buildAdvTutorialCommonBill(
  defId: string,
  name: string,
  slogan: string,
  idx: number,
): MashBill {
  return makeMashBill(
    {
      defId,
      name,
      slogan,
      flavorText: "A working bill the Drafting Loop turns up.",
      tier: "common",
      complexityTier: 1,
      ageBands: [1, 3],
      demandBands: [1, 4],
      rewardGrid: [
        [2, 3],
        [3, 4],
      ],
      tutorialOnly: true,
    },
    idx,
  );
}

/**
 * Uncommon bill with a Silver award used by Chapter 10 ("Awards").
 * Mirrors the basic tutorial's Heritage Reserve so the Silver hook
 * fires on an age-3 sale.
 */
export function buildAdvTutorialAwardBill(idx = 0): MashBill {
  return makeMashBill(
    {
      defId: "adv_tutorial_award_bill",
      name: "Silvermark Reserve",
      slogan: "Patience, then a polish.",
      flavorText:
        "An uncommon estate bill — sell at age 3+ to trigger the Silver award.",
      tier: "uncommon",
      complexityTier: 2,
      ageBands: [2, 3],
      demandBands: [2, 4],
      rewardGrid: [
        [2, 3],
        [3, 5],
      ],
      recipe: { minRye: 1 },
      silverAward: { minAge: 3 },
      tutorialOnly: true,
    },
    idx,
  );
}

/**
 * Specialty Rye resource the player buys in Chapter 5 to satisfy
 * Pepperbox Rare's `minSpecialty.rye: 1` gate.
 */
export function buildAdvTutorialSpecialtyRye(): Card {
  return makePremiumResource({
    defId: "specialty_rye_pepper",
    displayName: "Specialty Rye",
    flavor: "Single-cut, cellar-cured — unlocks the rare recipes.",
    subtype: "rye",
    resourceCount: 1,
    cost: 2,
    specialty: true,
    ownerLabel: "adv-tutorial",
    index: 1,
  });
}

// ─────────────────────────────────────────────────────────────────
// Starter decks
// ─────────────────────────────────────────────────────────────────

/**
 * Human's starter deck for the advanced tutorial. A mix that lets
 * each chapter find the cards it needs from the top of the deck on
 * fresh draws. The chapter controller re-stacks specific cards
 * before chapters that have tight requirements.
 */
function buildAdvHumanDeck(): Card[] {
  const cards: Card[] = [];
  let idx = 100;
  // First eight = round-2 redraw. Mix of grains, casks, and labor.
  cards.push(makeResourceCard("corn", "adv-deck", idx++));
  cards.push(makeResourceCard("corn", "adv-deck", idx++));
  cards.push(makeResourceCard("rye", "adv-deck", idx++));
  cards.push(makeResourceCard("rye", "adv-deck", idx++));
  cards.push(makeResourceCard("cask", "adv-deck", idx++));
  cards.push(makeResourceCard("cask", "adv-deck", idx++));
  cards.push(makeResourceCard("barley", "adv-deck", idx++));
  cards.push(makeResourceCard("wheat", "adv-deck", idx++));
  // Second eight = round-3 redraw.
  cards.push(makeResourceCard("corn", "adv-deck", idx++));
  cards.push(makeResourceCard("rye", "adv-deck", idx++));
  cards.push(makeResourceCard("cask", "adv-deck", idx++));
  cards.push(makeLaborCard({ subtype: "generic", ownerLabel: "adv-deck", index: idx++ }));
  cards.push(makeLaborCard({ subtype: "generic", ownerLabel: "adv-deck", index: idx++ }));
  cards.push(makeResourceCard("corn", "adv-deck", idx++));
  cards.push(makeResourceCard("rye", "adv-deck", idx++));
  cards.push(makeResourceCard("cask", "adv-deck", idx++));
  return cards;
}

function buildAdvBotDeck(label: string, baseIdx: number): Card[] {
  const cards: Card[] = [];
  let idx = baseIdx;
  // Mostly corn — bots' scripted actions only need a card to spend.
  for (let i = 0; i < 12; i++) {
    cards.push(makeResourceCard("corn", label, idx++));
  }
  return cards;
}

// ─────────────────────────────────────────────────────────────────
// Bourbon deck for Chapter 4's Drafting Loop reveal
// ─────────────────────────────────────────────────────────────────

/**
 * The bourbon deck pre-stacks 3 common bills on top so the Drafting
 * Loop reveal in Chapter 4 shows exactly the cards the chapter
 * scripts around. After Chapter 4 the remaining bills are irrelevant
 * because the rest of the tutorial uses scripted state mutations.
 */
function buildAdvBourbonDeck(): MashBill[] {
  // `revealCount=3` pops from the END of the array (tail).
  // We push reveal targets LAST so the player sees them in this order.
  const bills: MashBill[] = [];
  // Filler at the bottom so the deck isn't suspiciously short.
  for (let i = 0; i < 4; i++) {
    bills.push(
      buildAdvTutorialCommonBill(
        `adv_filler_${i}`,
        `Filler Bill ${i + 1}`,
        "Filler — not revealed during the tutorial.",
        50 + i,
      ),
    );
  }
  // Top 3 (revealed in Chapter 4's INITIATE_DRAFTING_LOOP).
  bills.push(
    buildAdvTutorialCommonBill(
      "adv_loop_reveal_1",
      "Riverbend Settlement",
      "A cheap common to scoop on the first pass.",
      60,
    ),
  );
  bills.push(
    buildAdvTutorialCommonBill(
      "adv_loop_reveal_2",
      "Hollow Stave Common",
      "Mid-pack value — what the bot grabs.",
      61,
    ),
  );
  bills.push(
    buildAdvTutorialCommonBill(
      "adv_loop_reveal_3",
      "Quartersawn Whisper",
      "Leftover — gets shuffled back into the deck.",
      62,
    ),
  );
  return bills;
}

// ─────────────────────────────────────────────────────────────────
// Market conveyor
// ─────────────────────────────────────────────────────────────────

/**
 * Starting market for the advanced tutorial. Slot 0 = Specialty Rye
 * for Chapter 5's buy step. The rest are common filler that chapters
 * may mutate over to specific cards (ops card for Chapter 7,
 * Warehouse investment for Chapter 8, etc.) via the transition
 * beat's `mutate` hook.
 */
function buildAdvMarketConveyor(): Card[] {
  const cards: Card[] = [];
  cards.push(buildAdvTutorialSpecialtyRye());
  let idx = 200;
  cards.push(makeResourceCard("corn", "adv-market", idx++));
  cards.push(makeResourceCard("rye", "adv-market", idx++));
  cards.push(makeResourceCard("barley", "adv-market", idx++));
  cards.push(makeResourceCard("wheat", "adv-market", idx++));
  cards.push(makeResourceCard("corn", "adv-market", idx++));
  cards.push(makeResourceCard("rye", "adv-market", idx++));
  cards.push(makeResourceCard("cask", "adv-market", idx++));
  cards.push(makeResourceCard("cask", "adv-market", idx++));
  cards.push(makeResourceCard("corn", "adv-market", idx++));
  return cards;
}

// ─────────────────────────────────────────────────────────────────
// Initial state builder
// ─────────────────────────────────────────────────────────────────

/**
 * Build the advanced tutorial's initial GameState. After this call:
 *
 *   - 1 human (last seat) + 3 bots, all with no pre-assigned
 *     distillery → engine lands in `phase: "distillery_selection"`
 *     so Chapter 1 can drive the live DistilleryDraftModal.
 *   - The distillery pool is the full public catalog (so Vanilla,
 *     High-Rye House, Wheated Baron, Connoisseur Estate are all
 *     visible in the picker).
 *   - Bourbon deck is hand-stacked with 3 known common bills at the
 *     top for Chapter 4's Drafting Loop reveal.
 *   - Market starts with Specialty Rye at slot 0 (Chapter 5 target).
 *   - No starter decks supplied → engine deals random hands during
 *     the starter_deck_draft phase the engine auto-walks to after
 *     distillery picks. Chapter 2's mutate hook re-stacks them.
 *   - Demand 0 (rules-canonical start), final-round disabled.
 */
export function buildTutorialAdvancedInitialState(): GameState {
  const distilleryPool = defaultDistilleryPool();
  const bourbonDeck = buildAdvBourbonDeck();
  const market = buildAdvMarketConveyor();

  const state = initializeGame({
    seed: 0xadbb_a920,
    players: [
      { id: ADV_TUTORIAL_HUMAN_ID, name: "You", isBot: false },
      { id: ADV_TUTORIAL_BOT1_ID, name: "Clyde", isBot: true },
      { id: ADV_TUTORIAL_BOT2_ID, name: "Dell", isBot: true },
      { id: ADV_TUTORIAL_BOT3_ID, name: "Mara", isBot: true },
    ],
    // No starterDecks → engine walks the starter_deck_draft phase.
    // We'll re-stack hands in Chapter 2's mutate when needed.
    distilleryPool,
    // Don't pre-assign distilleries → engine walks distillery_selection.
    bourbonDeck,
    marketSupply: market,
    startingDemand: 0,
    startingHandSize: 8,
  });

  return primeAdvTutorialState(state);
}

function primeAdvTutorialState(state: GameState): GameState {
  const next: GameState = JSON.parse(JSON.stringify(state)) as GameState;

  // Force a deterministic market in slot order regardless of engine
  // reverse() ordering — Chapter 5 expects Specialty Rye at slot 0.
  next.market = buildAdvMarketConveyor();
  next.marketSupplyDeck = [];
  next.marketDiscard = [];

  // Pre-stamp deterministic bot decks so any scripted bot dispatch
  // (Drafting Loop pass, Trade response) has a card to spend.
  const bots = [
    ADV_TUTORIAL_BOT1_ID,
    ADV_TUTORIAL_BOT2_ID,
    ADV_TUTORIAL_BOT3_ID,
  ];
  for (let i = 0; i < bots.length; i++) {
    const id = bots[i]!;
    const bot = next.players.find((p) => p.id === id);
    if (!bot) continue;
    bot.deck = buildAdvBotDeck(`adv-${id}`, 300 + i * 100);
    bot.discard = [];
  }

  return next;
}
