/**
 * Tutorial step machine.
 *
 * Each step describes one beat of the walkthrough: the heading, the
 * body copy, optionally a CSS selector to spotlight (everything else
 * dims), and an `advance` predicate over the current GameState that
 * tells the controller when to roll forward to the next step. Steps
 * with `advance: "manual"` show a "Next" button instead.
 *
 * Keep the list short. The point is to land the player on their
 * first sale, not to lecture them on every mechanic.
 */

import type { GameState } from "@bourbonomics/engine";

export interface TutorialStep {
  id: string;
  title: string;
  body: string;
  /** CSS selector for the focus zone. null = full-screen, no spotlight. */
  spotlight: string | null;
  /**
   * Where the tooltip sits relative to the spotlight. "center" means
   * dead-center of the viewport (used for the welcome / done splashes).
   */
  anchor: "center" | "below" | "above";
  /**
   * Either "manual" (show Next button) or a predicate over GameState
   * that, when true, automatically advances to the next step.
   * `prev` is the state at the moment we entered this step — useful
   * for "advance when X changed" comparisons.
   */
  advance:
    | "manual"
    | ((state: GameState, prev: GameState | null) => boolean);
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    title: "Welcome to Bourbonomics",
    body:
      "You run a bourbon distillery. Build a recipe, age it for years, and sell it when demand is hot. We'll walk you through your first sale step by step.",
    spotlight: null,
    anchor: "center",
    advance: "manual",
  },
  // Setup beats first — the player needs cards in hand and a rolled
  // demand before the board tour spotlights make any sense (otherwise
  // the hand-tray bbox is empty and the cutout dim ends up framing
  // nothing).
  {
    id: "starter-pass",
    title: "Accept your starter hand",
    body:
      "Before the game begins you get one chance to look at your dealt 16-card starter pool. Click 'Pass — accept this hand' on the modal to lock it in.",
    spotlight: null,
    // "below" with null spotlight → tooltip floats bottom-right so the
    // centered modal stays clickable.
    anchor: "below",
    advance: (s) => s.phase !== "starter_deck_draft",
  },
  {
    id: "draw",
    title: "Draw your round hand",
    body:
      "Each round you draw 8 cards from your deck. Click 'Draw cards' on the fan that just popped up — your bot opponent will draw on their own.",
    spotlight: null,
    anchor: "below",
    advance: (s) => s.phase === "action",
  },
  {
    id: "roll-demand",
    title: "Roll your demand dice",
    body:
      "Each turn opens with you rolling 2d6 against the demand track. If the roll beats current demand, the market heats up by 1. Click 'Roll dice' — the modal dispatches automatically once the dice settle.",
    spotlight: null,
    anchor: "below",
    advance: (s) => {
      const me = s.players.find((p) => !p.isBot);
      return s.phase === "action" && me != null && !me.needsDemandRoll;
    },
  },
  // Board tour — runs after the demand roll, when the rickhouse, hand,
  // and market are all fully populated and no modal is in the way.
  {
    id: "rickhouse",
    title: "Your rickhouse",
    body:
      "These are your barrel slots. Each one can hold one mash bill (a bourbon recipe). You drafted three bills at setup — they sit in your slots as 'staged' projects waiting for you to commit cards.",
    spotlight: "[data-rickhouse-row='true']",
    anchor: "below",
    advance: "manual",
  },
  {
    id: "hand",
    title: "Your hand",
    body:
      "Your eight-card round hand. You spend casks, corn, and grain to build bourbon, capital to buy from the market, and any card to age or sell. Resource and capital cards left over at end of round go to your discard.",
    spotlight: "[data-hand-tray='true']",
    anchor: "above",
    advance: "manual",
  },
  {
    id: "market",
    title: "The market",
    body:
      "Buy more cards from the market conveyor. Mash bills sit beside the deck — drawing one is the doomsday clock that ends the game. We'll skip the market for now.",
    spotlight: "[data-bb-zone='market']",
    anchor: "above",
    advance: "manual",
  },
  {
    id: "make-bourbon",
    title: "Build your first barrel",
    body:
      "Click 'Make bourbon' in the action bar, pick your bill in the rickhouse, then commit one cask + one corn + one grain (rye / wheat / barley) from your hand. Once the recipe is satisfied the barrel transitions to aging.",
    spotlight: "[data-bb-zone='action-bar']",
    anchor: "above",
    advance: (s) => {
      const me = s.players.find((p) => !p.isBot);
      if (!me) return false;
      return s.allBarrels.some(
        (b) => b.ownerId === me.id && b.phase === "aging",
      );
    },
  },
  {
    id: "end-turn-1",
    title: "End your turn",
    body:
      "A barrel just finished construction can't age until next round — completion isn't a free aging year. End your turn so the bot can play and the round can wrap.",
    spotlight: "[data-bb-zone='action-bar']",
    anchor: "above",
    advance: (s, prev) => {
      // Advance when round ticks forward (cleanup happened).
      if (!prev) return false;
      return s.round > prev.round;
    },
  },
  {
    id: "age-barrel",
    title: "Pay the holding cost",
    body:
      "New rule (v2.9): every turn one of your aging barrels takes a fresh card on top — the cost of keeping inventory while you wait for demand to rise. After your demand roll, the Age overlay opens automatically. Pick a barrel, then a card to commit.",
    spotlight: "[data-rickhouse-row='true']",
    anchor: "below",
    advance: (s) => {
      const me = s.players.find((p) => !p.isBot);
      if (!me) return false;
      const myBarrel = s.allBarrels.find(
        (b) => b.ownerId === me.id && b.phase === "aging",
      );
      return myBarrel != null && myBarrel.age >= 1;
    },
  },
  {
    id: "second-end-turn",
    title: "End your turn again",
    body:
      "Aging takes time. End your turn — when you come back next round you'll age once more, hit age 2, and the barrel will be saleable.",
    spotlight: "[data-bb-zone='action-bar']",
    anchor: "above",
    advance: (s) => {
      const me = s.players.find((p) => !p.isBot);
      if (!me) return false;
      const myBarrel = s.allBarrels.find(
        (b) => b.ownerId === me.id && b.phase === "aging",
      );
      return myBarrel != null && myBarrel.age >= 2;
    },
  },
  {
    id: "sell",
    title: "Sell your bourbon",
    body:
      "Your barrel is age 2 — saleable! Click 'Sell bourbon', pick the barrel, then pick any card from your hand to spend on the sale. The grid pays out as reputation, then the barrel ships.",
    spotlight: "[data-bb-zone='action-bar']",
    anchor: "above",
    advance: (s) => {
      const me = s.players.find((p) => !p.isBot);
      if (!me) return false;
      return me.barrelsSold >= 1;
    },
  },
  {
    id: "done",
    title: "You shipped a bourbon!",
    body:
      "That's the whole loop: roll demand → age → take actions → sell when ripe. Reputation is the win condition; barrels sold is the tiebreaker. From here you can play full games, fight bots, or jump online for multiplayer.",
    spotlight: null,
    anchor: "center",
    advance: "manual",
  },
];
