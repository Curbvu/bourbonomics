/**
 * The scripted tutorial beats. Each beat is fully self-contained: the
 * controller in `TutorialController.tsx` walks them in order and
 * renders the right surface per beat kind.
 *
 * The tutorial teaches one barrel end-to-end (Backroad Batch) across
 * four player-visible chapters:
 *
 *   Chapter 1 — Make bourbon (3 ingredient commits)
 *   Chapter 2 — Buy a resource from the market (Specialty Wheat, $2)
 *   Chapter 3 — Age your barrel (after the round rolls over)
 *   Chapter 4 — Sell
 *
 * The Make + Buy chapters live inside Year 1: the player makes the
 * barrel and then spends their leftover Labor on Specialty Wheat
 * before passing the turn. Year 2 is the "what happens to the
 * barrel" half of the lesson — Age, then Sell. The second round
 * roll-over (Year 2 → engine round 3) is invisible plumbing so the
 * player perceives Age + Sell as one continuous Year-2 beat.
 *
 * Why not ship as a tree / branching script? Every player gets the
 * same path. There IS a "false decision" but both branches advance
 * to the same beat — the branch only changes the reply copy.
 */

import {
  TUTORIAL_BOT_ID,
  TUTORIAL_HUMAN_ID,
  type Card,
  type GameAction,
  type GameState,
} from "@bourbonomics/engine";
import type { Beat, BeatKind } from "./types";

/** Helper: locate the human's barrel for a given bill defId. */
function findHumanBarrelByBillDef(
  state: GameState,
  billDefId: string,
): { barrelId: string; slotId: string } | null {
  const barrel = state.allBarrels.find(
    (b) => b.ownerId === TUTORIAL_HUMAN_ID && b.attachedMashBill.defId === billDefId,
  );
  return barrel ? { barrelId: barrel.id, slotId: barrel.slotId } : null;
}

/** Tally cumulative resource counts in a barrel's production pile. */
function pileTotals(
  state: GameState,
  billDefId: string,
): { cask: number; corn: number; rye: number; cardCount: number } | null {
  const barrel = state.allBarrels.find(
    (b) =>
      b.ownerId === TUTORIAL_HUMAN_ID &&
      b.attachedMashBill.defId === billDefId,
  );
  if (!barrel) return null;
  let cask = 0;
  let corn = 0;
  let rye = 0;
  for (const c of barrel.productionCards) {
    if (c.type !== "resource") continue;
    const n = c.resourceCount ?? 1;
    if (c.subtype === "cask") cask += n;
    if (c.subtype === "corn") corn += n;
    if (c.subtype === "rye") rye += n;
  }
  return { cask, corn, rye, cardCount: barrel.productionCards.length };
}

/**
 * Shared matcher factory — a Make sub-beat accepts any MAKE_BOURBON
 * to the right barrel's slot. Composition is gated through
 * `advanceWhen` (per-step "has the new ingredient landed?" predicates).
 */
function matchMakeForBill(billDefId: string) {
  return (action: GameAction, state: GameState) => {
    if (action.type !== "MAKE_BOURBON") return false;
    if (action.playerId !== TUTORIAL_HUMAN_ID) return false;
    const target = findHumanBarrelByBillDef(state, billDefId);
    return target != null && action.slotId === target.slotId;
  };
}

/** Pick out any hand card (used for visual hints during aging). */
function findHandCard(state: GameState, predicate: (c: Card) => boolean): string | null {
  const human = state.players.find((p) => p.id === TUTORIAL_HUMAN_ID);
  if (!human) return null;
  return human.hand.find(predicate)?.id ?? null;
}

export const TUTORIAL_BEATS: Beat[] = [
  // ════════════════════════════════════════════════════════════════
  // CHAPTER 1 — Make bourbon (Year 1)
  // ════════════════════════════════════════════════════════════════
  {
    id: "lesson-1-intro",
    kind: "prompt",
    title: "Make your first bourbon",
    body: "We'll add the ingredients one at a time. Start with the corn.",
    spotlight: { kind: "none" },
    chapter: { number: 1, label: "Make bourbon" },
  },
  {
    id: "beat-1a-add-corn",
    kind: "await-action",
    title: "Add the corn",
    body: "Drag a **corn** card onto **Backroad Batch**.",
    spotlight: { kind: "rickhouse-slot", ownerId: TUTORIAL_HUMAN_ID, slotIndex: 0 },
    handCardFilter: (c) => c.type === "resource" && c.subtype === "corn",
    dragHint: {
      pickHandCard: (c) => c.type === "resource" && c.subtype === "corn",
      slotIndex: 0,
    },
    matches: matchMakeForBill("tutorial_backroad_batch"),
    advanceWhen: (state) => {
      const t = pileTotals(state, "tutorial_backroad_batch");
      return t != null && t.corn >= 1;
    },
  },
  {
    id: "beat-1b-add-rye",
    kind: "await-action",
    title: "Now the rye",
    body: "Drag a **rye** card onto Backroad Batch. Rye is one of the grains that gives bourbon its flavor.",
    spotlight: { kind: "rickhouse-slot", ownerId: TUTORIAL_HUMAN_ID, slotIndex: 0 },
    handCardFilter: (c) =>
      c.type === "resource" && c.subtype === "rye" && !c.specialty,
    dragHint: {
      pickHandCard: (c) =>
        c.type === "resource" && c.subtype === "rye" && !c.specialty,
      slotIndex: 0,
    },
    matches: matchMakeForBill("tutorial_backroad_batch"),
    advanceWhen: (state) => {
      const t = pileTotals(state, "tutorial_backroad_batch");
      return t != null && t.rye >= 1;
    },
  },
  {
    id: "beat-1c-add-cask",
    kind: "await-action",
    title: "Last, the cask",
    body: "Drag a **cask** card onto Backroad Batch. That's where the bourbon will age.",
    spotlight: { kind: "rickhouse-slot", ownerId: TUTORIAL_HUMAN_ID, slotIndex: 0 },
    handCardFilter: (c) => c.type === "resource" && c.subtype === "cask",
    dragHint: {
      pickHandCard: (c) => c.type === "resource" && c.subtype === "cask",
      slotIndex: 0,
    },
    matches: matchMakeForBill("tutorial_backroad_batch"),
    // Once the cask lands the barrel has cask + corn + grain — the
    // engine flips it to "aging" automatically.
    advanceWhen: (state) => {
      const barrel = state.allBarrels.find(
        (b) =>
          b.ownerId === TUTORIAL_HUMAN_ID &&
          b.attachedMashBill.defId === "tutorial_backroad_batch",
      );
      return barrel != null && barrel.phase === "aging";
    },
  },
  {
    id: "beat-1-aftermath",
    kind: "prompt",
    title: "That's it for year 1",
    body: "Backroad Batch is now **aging**. But before we end the year, let's grab a resource from the market — you'll need it for future recipes.",
    spotlight: { kind: "rickhouse-slot", ownerId: TUTORIAL_HUMAN_ID, slotIndex: 0 },
  },

  // ════════════════════════════════════════════════════════════════
  // CHAPTER 2 — Buy a resource (still Year 1)
  // ════════════════════════════════════════════════════════════════
  {
    id: "lesson-2-intro",
    kind: "prompt",
    title: "Buy a resource",
    body: "The market has **Superior Wheat** today — a premium *specialty* wheat that counts toward any 'specialty wheat' recipe gate. You'll always need fresh resources to keep making bourbon.",
    spotlight: { kind: "none" },
    chapter: { number: 2, label: "Buy" },
  },
  {
    id: "beat-buy-wheat",
    kind: "await-action",
    title: "Buy Superior Wheat",
    body: "Click **Superior Wheat**, then tag **both Labor cards** (🔨) from your hand to cover the $2 cost and Confirm Purchase.",
    spotlight: { kind: "market-slot", slotIndex: 0 },
    // Once the purchase panel opens, move the halo onto it — otherwise
    // the ring stays stuck on the conveyor tile now hidden behind the
    // modal, and the screen the player actually acts on goes un-lit.
    postEngageSpotlight: { kind: "buy-overlay" },
    tapHint: { selector: "[data-market-slot-index='0']" },
    // Narrow the hand to Labor cards so a stray click on a resource
    // can't tag it as payment (engine would reject the eventual
    // BUY_FROM_MARKET — silent dead-end from the player's POV). The
    // tutorial scenario seeds two Generic Labor cards in the starter
    // hand, both costing $1 each, which together cover the $2 buy.
    handCardFilter: (c) => c.type === "labor",
    matches: (action) => {
      if (action.type !== "BUY_FROM_MARKET") return false;
      if (action.playerId !== TUTORIAL_HUMAN_ID) return false;
      return action.marketSlotIndex === 0;
    },
  },
  {
    id: "beat-buy-aftermath",
    kind: "prompt",
    title: "Wheat in your hand",
    body: "Superior Wheat is in your hand — ready to use this turn. (Unused cards in hand get discarded at End Turn — if you want to carry a single card across rounds, the **Warehouse** investment card in the market gives you a private 1-card slot that persists.)",
    spotlight: { kind: "none" },
  },

  // ════════════════════════════════════════════════════════════════
  // CHAPTER 3 — End Turn → Aging (Year 2)
  // The player ends the year explicitly, then we silently roll over
  // into Year 2 and announce the Aging Phase as a chapter card.
  // ════════════════════════════════════════════════════════════════
  {
    // Single await-action beat — the player clicks End Turn, the
    // matcher catches PASS_TURN, and we advance. A prompt beat preceded
    // this one historically; the player would click End Turn during
    // the prompt, dispatch through, and the next beat (this one) would
    // miss the already-fired action. Removing the prompt is the fix.
    id: "beat-end-turn-await",
    kind: "await-action",
    title: "End the year",
    body: "That's all our actions for year 1. Click **End Turn** in the action bar.",
    spotlight: { kind: "action-button", action: "pass" },
    matches: (action) => {
      if (action.type !== "PASS_TURN") return false;
      return action.playerId === TUTORIAL_HUMAN_ID;
    },
  },
  {
    id: "beat-r1-bot-pass",
    kind: "scripted",
    body: "(internal — bot passes so the round can flip)",
    delayMs: 80,
    build: (state) => {
      const current = state.players[state.currentPlayerIndex];
      if (!current || current.outForRound) return [];
      if (current.id !== TUTORIAL_BOT_ID) return [];
      return [{ type: "PASS_TURN", playerId: TUTORIAL_BOT_ID }];
    },
  },
  {
    id: "beat-r2-time-passes",
    kind: "transition",
    title: "Time passes…",
    subtitle: "Year 2",
    body: "Round ends. Decks reshuffle.",
    fakeRolls: [{ dice: [1, 1] }],
    durationMs: 2400,
  },
  {
    id: "beat-r2-pin-start-player",
    kind: "scripted",
    body: "(internal — round-2 opens on the human)",
    delayMs: 40,
    mutate: (state) => {
      const next = structuredClone(state);
      next.startPlayerIndex = 0;
      return next;
    },
    build: () => [],
  },
  {
    id: "beat-r2-draw-human",
    kind: "scripted",
    body: "(internal — human draws round-2 hand)",
    delayMs: 80,
    build: (state) => {
      if (state.phase !== "draw") return [];
      if (state.playerIdsCompletedPhase.includes(TUTORIAL_HUMAN_ID)) return [];
      return [{ type: "DRAW_HAND", playerId: TUTORIAL_HUMAN_ID }];
    },
  },
  {
    id: "beat-r2-draw-bot",
    kind: "scripted",
    body: "(internal — bot draws)",
    delayMs: 80,
    build: (state) => {
      if (state.phase !== "draw") return [];
      if (state.playerIdsCompletedPhase.includes(TUTORIAL_BOT_ID)) return [];
      return [{ type: "DRAW_HAND", playerId: TUTORIAL_BOT_ID }];
    },
  },
  {
    id: "lesson-3-intro",
    kind: "prompt",
    title: "Aging",
    body: "Every year, your aging barrels need a card to keep maturing. Older bourbon pays more when you sell.",
    spotlight: { kind: "none" },
    chapter: { number: 3, label: "Age" },
  },
  {
    id: "beat-age-backroad",
    kind: "await-action",
    title: "Age Backroad Batch",
    body: "Drag any card onto **Backroad Batch** to age it 1 year.",
    spotlight: { kind: "rickhouse-slot", ownerId: TUTORIAL_HUMAN_ID, slotIndex: 0 },
    // Same ghost-card+cursor drag animation as the Make sub-beats
    // (beat-1a/1b/1c). Any hand card is a legal age payment, so the
    // picker just grabs the first one for the demonstration loop.
    dragHint: {
      pickHandCard: () => true,
      slotIndex: 0,
    },
    matches: (action, state) => {
      if (action.type !== "AGE_BOURBON") return false;
      if (action.playerId !== TUTORIAL_HUMAN_ID) return false;
      const target = findHumanBarrelByBillDef(state, "tutorial_backroad_batch");
      return target != null && action.barrelId === target.barrelId;
    },
    advanceWhen: (state) => {
      const backroad = state.allBarrels.find(
        (b) =>
          b.ownerId === TUTORIAL_HUMAN_ID &&
          b.attachedMashBill.defId === "tutorial_backroad_batch",
      );
      return backroad != null && backroad.agedThisRound;
    },
  },
  {
    id: "beat-age-aftermath",
    kind: "prompt",
    title: "+1 year",
    body: "Backroad just picked up a year. Now let's sell it.",
    spotlight: { kind: "rickhouse-slot", ownerId: TUTORIAL_HUMAN_ID, slotIndex: 0 },
  },

  // ════════════════════════════════════════════════════════════════
  // CHAPTER 4 — Sell (still Year 2 for the player)
  // Engine plumbing: we silently roll the round once more so Backroad
  // lands on MIN_SELL_AGE. No visible transition — the player still
  // perceives this as the same "year 2" beat.
  // ════════════════════════════════════════════════════════════════
  {
    id: "beat-sell-silent-human-pass",
    kind: "scripted",
    body: "(internal — silent round-flip prep, human side)",
    delayMs: 60,
    build: (state) => {
      const current = state.players[state.currentPlayerIndex];
      if (!current || current.outForRound) return [];
      if (current.id !== TUTORIAL_HUMAN_ID) return [];
      return [{ type: "PASS_TURN", playerId: TUTORIAL_HUMAN_ID }];
    },
  },
  {
    id: "beat-sell-silent-bot-pass",
    kind: "scripted",
    body: "(internal — silent round-flip prep, bot side)",
    delayMs: 60,
    build: (state) => {
      const current = state.players[state.currentPlayerIndex];
      if (!current || current.outForRound) return [];
      if (current.id !== TUTORIAL_BOT_ID) return [];
      return [{ type: "PASS_TURN", playerId: TUTORIAL_BOT_ID }];
    },
  },
  {
    id: "beat-sell-pin-start-player",
    kind: "scripted",
    body: "(internal — next round opens on the human)",
    delayMs: 40,
    mutate: (state) => {
      const next = structuredClone(state);
      next.startPlayerIndex = 0;
      return next;
    },
    build: () => [],
  },
  {
    id: "beat-sell-draw-human",
    kind: "scripted",
    body: "(internal)",
    delayMs: 60,
    build: (state) =>
      state.phase === "draw" && !state.playerIdsCompletedPhase.includes(TUTORIAL_HUMAN_ID)
        ? [{ type: "DRAW_HAND", playerId: TUTORIAL_HUMAN_ID }]
        : [],
  },
  {
    id: "beat-sell-draw-bot",
    kind: "scripted",
    body: "(internal)",
    delayMs: 60,
    build: (state) =>
      state.phase === "draw" && !state.playerIdsCompletedPhase.includes(TUTORIAL_BOT_ID)
        ? [{ type: "DRAW_HAND", playerId: TUTORIAL_BOT_ID }]
        : [],
  },
  {
    id: "beat-sell-passive-age-backroad",
    kind: "scripted",
    body: "(internal — Backroad picks up its second year across the silent round break so it lands on MIN_SELL_AGE)",
    delayMs: 40,
    mutate: (state) => {
      const next = structuredClone(state);
      const backroad = next.allBarrels.find(
        (b) =>
          b.ownerId === TUTORIAL_HUMAN_ID &&
          b.attachedMashBill.defId === "tutorial_backroad_batch",
      );
      if (backroad && backroad.age < 2) {
        backroad.age = 2;
        backroad.agingCards = [
          ...backroad.agingCards,
          {
            id: "agingcard_tutorial_backroad_passive",
            cardDefId: "corn",
            type: "resource",
            subtype: "corn",
            resourceCount: 1,
          },
        ];
      }
      return next;
    },
    build: () => [],
  },
  {
    id: "lesson-4-intro",
    kind: "prompt",
    title: "Sell your bourbon",
    body: "Time to cash in. Selling Backroad earns Capital — your spendable currency. Banked Capital also counts toward your final score at game end.",
    spotlight: { kind: "none" },
    chapter: { number: 4, label: "Sell" },
  },
  {
    id: "beat-sell-backroad",
    kind: "await-action",
    title: "Sell Backroad",
    body: "Click **Sell**, then **Backroad Batch**. Tier-1 floor pays at least **3 rep**.",
    spotlight: { kind: "action-button", action: "sell" },
    postEngageSpotlight: {
      kind: "rickhouse-slot",
      ownerId: TUTORIAL_HUMAN_ID,
      slotIndex: 0,
    },
    matches: (action, state) => {
      if (action.type !== "SELL_BOURBON") return false;
      if (action.playerId !== TUTORIAL_HUMAN_ID) return false;
      const target = findHumanBarrelByBillDef(state, "tutorial_backroad_batch");
      return target != null && action.barrelId === target.barrelId;
    },
    rewrite: (action) => {
      if (action.type !== "SELL_BOURBON") return null;
      return action;
    },
    advanceWhen: (state) => {
      const backroad = state.allBarrels.find(
        (b) =>
          b.ownerId === TUTORIAL_HUMAN_ID &&
          b.attachedMashBill.defId === "tutorial_backroad_batch",
      );
      return backroad == null;
    },
  },
  {
    id: "beat-sell-aftermath",
    kind: "prompt",
    title: "Capital banked",
    body: "**+3 Capital** (the tier-1 floor). Backroad's a Common — no award — so the slot opens for a fresh recipe.",
    spotlight: { kind: "reputation" },
  },
  {
    id: "beat-finale",
    kind: "finale",
    title: "That's the game.",
    body: "Highest final score (Capital you've banked + Reputation you've earned from your portfolio) when the supply dries up wins. Patience and timing.",
    bullets: [
      "Built a recipe.",
      "Aged your barrel.",
      "Sold for Capital.",
    ],
    closeLabel: "Start a real game",
    replayLabel: "Replay tutorial",
  },
];

/**
 * chapter-aware progress for a given beat index. Used by the
 * counter chip in CoachMark / PromptCard so players see e.g.
 * "Make bourbon · 2/5" instead of "Tutorial · 13/45".
 *
 * Counts only "visible" beats (prompt / await-action / decision /
 * transition / celebrate / finale) — scripted beats are invisible
 * plumbing and don't count toward the player's progress.
 *
 * Returns null when the beat isn't reachable (out-of-range index).
 */
const VISIBLE_KINDS: BeatKind[] = [
  "prompt",
  "await-action",
  "decision",
  "transition",
  "celebrate",
  "finale",
];

export function chapterProgressFor(beatIndex: number): {
  chapterLabel: string;
  chapterNumber: number;
  position: number;
  total: number;
} | null {
  if (beatIndex < 0 || beatIndex >= TUTORIAL_BEATS.length) return null;
  // Walk backward to find the most-recent chapter marker.
  let chapterStart = 0;
  let label = "Tutorial";
  let number = 0;
  for (let i = beatIndex; i >= 0; i--) {
    const b = TUTORIAL_BEATS[i];
    if (b?.kind === "prompt" && b.chapter) {
      chapterStart = i;
      label = b.chapter.label;
      number = b.chapter.number;
      break;
    }
  }
  // Walk forward to find the next chapter marker (or end of list).
  let chapterEnd = TUTORIAL_BEATS.length;
  for (let i = chapterStart + 1; i < TUTORIAL_BEATS.length; i++) {
    const b = TUTORIAL_BEATS[i];
    if (b?.kind === "prompt" && b.chapter) {
      chapterEnd = i;
      break;
    }
  }
  // Count visible beats from chapterStart (inclusive) to chapterEnd.
  let total = 0;
  let position = 0;
  for (let i = chapterStart; i < chapterEnd; i++) {
    const b = TUTORIAL_BEATS[i];
    if (!b) continue;
    if (!VISIBLE_KINDS.includes(b.kind)) continue;
    total += 1;
    if (i <= beatIndex) position += 1;
  }
  // If the current beat is scripted (invisible), clamp to the last
  // visible position we've passed.
  return { chapterLabel: label, chapterNumber: number, position, total };
}

/** Convenience: pick a hand card the player can use to age. */
export function pickAnyHandCard(state: GameState): string | null {
  return findHandCard(state, () => true);
}
