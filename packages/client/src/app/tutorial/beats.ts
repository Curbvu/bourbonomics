/**
 * The scripted tutorial beats. Each beat is fully self-contained: the
 * controller in `TutorialController.tsx` walks them in order and
 * renders the right surface per beat kind.
 *
 * The tutorial teaches one barrel end-to-end (Backroad Batch) across
 * four chapters:
 *
 *   Chapter 1 — Make bourbon (3 ingredient commits)
 *   Chapter 2 — Hire a Cooper from the market (rep + Labor payment)
 *   Chapter 3 — Age your barrel
 *   Chapter 4 — Sell
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

/** Find the bot's lone aging barrel (the pre-staged one). */
function findBotAgingBarrel(state: GameState): { barrelId: string; cardId: string | null } | null {
  const barrel = state.allBarrels.find(
    (b) => b.ownerId === TUTORIAL_BOT_ID && b.phase === "aging",
  );
  if (!barrel) return null;
  const bot = state.players.find((p) => p.id === TUTORIAL_BOT_ID);
  const card = bot?.hand[0];
  return { barrelId: barrel.id, cardId: card?.id ?? null };
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
  // CHAPTER 1 — Make bourbon
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
    title: "Aging",
    body: "Backroad Batch is **Aging**. You'll add 1 aging card each round to keep it maturing.",
    spotlight: { kind: "rickhouse-slot", ownerId: TUTORIAL_HUMAN_ID, slotIndex: 0 },
  },

  // ════════════════════════════════════════════════════════════════
  // CHAPTER 2 — Hire from the market
  // ════════════════════════════════════════════════════════════════
  {
    id: "lesson-2-intro",
    kind: "prompt",
    title: "Hire a Cooper",
    body: "The market has a **Cooper** today — Specialty Labor (🪓) that gives **+2 toward resource buys**. Specialty Labor is the only way new Labor enters your deck — your 2 Generic Labor (🔨) are all you'd ever own otherwise.",
    spotlight: { kind: "none" },
    chapter: { number: 2, label: "Hire" },
  },
  {
    id: "beat-buy-cooper",
    kind: "await-action",
    title: "Buy the Cooper",
    body: "Click the **Cooper**, then tag a **Labor card** (🔨) from your hand to pay.",
    spotlight: { kind: "market-slot", slotIndex: 0 },
    tapHint: { selector: "[data-market-slot-index='0']" },
    matches: (action) => {
      if (action.type !== "BUY_FROM_MARKET") return false;
      if (action.playerId !== TUTORIAL_HUMAN_ID) return false;
      return action.marketSlotIndex === 0;
    },
  },
  {
    id: "beat-buy-aftermath",
    kind: "prompt",
    title: "Cooper hired",
    body: "Your new Cooper landed in your discard — it'll shuffle into your deck next reshuffle. Generic Labor is finite; Specialty Labor is how your hand grows.",
    spotlight: { kind: "none" },
  },

  // ════════════════════════════════════════════════════════════════
  // CHAPTER 3 — Age your barrel
  // ════════════════════════════════════════════════════════════════
  {
    id: "lesson-3-intro",
    kind: "prompt",
    title: "Age your barrel",
    body: "Every round, an aging barrel needs 1 card to keep maturing. Older bourbon pays more — when you sell at the right time.",
    spotlight: { kind: "none" },
    chapter: { number: 3, label: "Age" },
  },
  {
    id: "beat-age-time-passes",
    kind: "transition",
    title: "Time passes…",
    subtitle: "Round 2",
    body: "Round ends. Decks reshuffle.",
    fakeRolls: [{ dice: [1, 1] }],
    durationMs: 2400,
  },
  {
    id: "beat-age-end-round",
    kind: "scripted",
    body: "(internal — pass turn for both, run cleanup, refresh draws)",
    delayMs: 80,
    build: (state) => {
      const current = state.players[state.currentPlayerIndex];
      if (current && !current.outForRound) {
        return [{ type: "PASS_TURN", playerId: current.id }];
      }
      return [];
    },
  },
  {
    id: "beat-age-bot-pass",
    kind: "scripted",
    body: "(internal — second pass)",
    delayMs: 80,
    build: (state) => {
      const current = state.players[state.currentPlayerIndex];
      if (!current || current.outForRound) return [];
      return [{ type: "PASS_TURN", playerId: current.id }];
    },
  },
  {
    id: "beat-age-pin-start-player",
    kind: "scripted",
    body: "(internal — round-2 opens on the human, not the rotated bookend)",
    delayMs: 40,
    mutate: (state) => {
      const next = structuredClone(state);
      next.startPlayerIndex = 0;
      return next;
    },
    build: () => [],
  },
  {
    id: "beat-age-draw-human",
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
    id: "beat-age-draw-bot",
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
    id: "beat-age-prompt",
    kind: "prompt",
    title: "Aging Phase",
    body: "The **Aging Phase** is now active — barrels age on every turn. Pick any card from your hand and click your barrel to commit 1 year. (Or drag.)",
    spotlight: { kind: "rickhouse-row", ownerId: TUTORIAL_HUMAN_ID },
  },
  {
    id: "beat-age-backroad",
    kind: "await-action",
    title: "Age Backroad Batch",
    body: "Drag any card onto Backroad Batch to age it 1 year.",
    spotlight: { kind: "rickhouse-slot", ownerId: TUTORIAL_HUMAN_ID, slotIndex: 0 },
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
    body: "Backroad just ticked to age 1. Selling needs age 2 — one more year.",
    spotlight: { kind: "rickhouse-slot", ownerId: TUTORIAL_HUMAN_ID, slotIndex: 0 },
  },

  // ════════════════════════════════════════════════════════════════
  // CHAPTER 4 — Sell
  // ════════════════════════════════════════════════════════════════
  {
    id: "lesson-4-intro",
    kind: "prompt",
    title: "Sell at the right time",
    body: "Selling earns reputation — but it also drops the market's demand for everyone. Watch what your opponent does.",
    spotlight: { kind: "none" },
    chapter: { number: 4, label: "Sell" },
  },
  {
    id: "beat-sell-pass-human",
    kind: "scripted",
    body: "(internal — human ends turn so the bot can sell)",
    delayMs: 600,
    build: () => [{ type: "PASS_TURN", playerId: TUTORIAL_HUMAN_ID }],
  },
  {
    id: "beat-sell-bot-sells",
    kind: "scripted",
    body: "(internal — scripted bot sale)",
    delayMs: 800,
    build: (state) => {
      const target = findBotAgingBarrel(state);
      if (!target) return [];
      return [
        {
          type: "SELL_BOURBON",
          playerId: TUTORIAL_BOT_ID,
          barrelId: target.barrelId,
        },
      ];
    },
  },
  {
    id: "beat-sell-modal",
    kind: "prompt",
    title: "Demand dropped",
    body: "Opponent sold. **Demand: 2 → 1.** Now's your moment.",
    spotlight: { kind: "demand" },
    ctaLabel: "What now?",
  },
  {
    id: "beat-sell-bot-pass",
    kind: "scripted",
    body: "(internal — bot finishes its turn after selling)",
    delayMs: 80,
    build: (state) => {
      const current = state.players[state.currentPlayerIndex];
      if (!current || current.id !== TUTORIAL_BOT_ID) return [];
      return [{ type: "PASS_TURN", playerId: TUTORIAL_BOT_ID }];
    },
  },
  {
    id: "beat-sell-round-3-pin-start-player",
    kind: "scripted",
    body: "(internal — round 3 opens on the human)",
    delayMs: 40,
    mutate: (state) => {
      const next = structuredClone(state);
      next.startPlayerIndex = 0;
      return next;
    },
    build: () => [],
  },
  {
    id: "beat-sell-round-3-draw-human",
    kind: "scripted",
    body: "(internal)",
    delayMs: 80,
    build: (state) =>
      state.phase === "draw" && !state.playerIdsCompletedPhase.includes(TUTORIAL_HUMAN_ID)
        ? [{ type: "DRAW_HAND", playerId: TUTORIAL_HUMAN_ID }]
        : [],
  },
  {
    id: "beat-sell-round-3-draw-bot",
    kind: "scripted",
    body: "(internal)",
    delayMs: 80,
    build: (state) =>
      state.phase === "draw" && !state.playerIdsCompletedPhase.includes(TUTORIAL_BOT_ID)
        ? [{ type: "DRAW_HAND", playerId: TUTORIAL_BOT_ID }]
        : [],
  },
  {
    id: "beat-sell-passive-age-backroad",
    kind: "scripted",
    body: "(internal — Backroad picks up its second year across the round break so it lands on MIN_SELL_AGE)",
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
    title: "Reputation banked",
    body: "**+3 reputation** (the tier-1 floor). Backroad's a Common — no award — so the slot opens for a fresh recipe.",
    spotlight: { kind: "reputation" },
  },
  {
    id: "beat-finale",
    kind: "finale",
    title: "That's the game.",
    body: "Most reputation when the supply dries up wins. Patience and timing.",
    bullets: [
      "Built a recipe.",
      "Aged your barrel.",
      "Waited for demand.",
      "Sold for rep.",
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

/** Helper kept for the controller's spotlight injection (legacy). */
export function spotlightSpecialtyRye(_state: GameState): string | null {
  // slim cut: Specialty Rye is no longer purchased in the
  // tutorial. Kept as a noop export so the controller doesn't break
  // on import if it still references it.
  return null;
}

/** Convenience: pick a hand card the player can use to age. */
export function pickAnyHandCard(state: GameState): string | null {
  return findHandCard(state, () => true);
}
