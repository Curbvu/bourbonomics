/**
 * The 12 scripted beats, plus a couple of intra-beat helpers (false-
 * decision reply, time-skip transition). Each beat is fully self-
 * contained: the controller in TutorialApp.tsx walks them in order
 * and renders the right surface per beat kind.
 *
 * Why not ship as a tree / branching script? The original design doc
 * gives every player the same path. There IS a "false decision" but
 * both branches advance to the same beat — the branch only changes
 * the reply copy. That's expressed via the DecisionBeat shape rather
 * than a real branching graph.
 */

import {
  TUTORIAL_BOT_ID,
  TUTORIAL_HUMAN_ID,
  type Card,
  type GameAction,
  type GameState,
} from "@bourbonomics/engine";
import type { Beat } from "./types";

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

/**
 * Move the Specialty Rye from the player's discard onto the top of
 * their deck so the round-2 DRAW_HAND surfaces it on the first card
 * drawn. Engine convention: top-of-deck is the end of the array.
 */
function rigSpecialtyRyeToDeckTop(state: GameState): GameState {
  const next = structuredClone(state);
  const human = next.players.find((p) => p.id === TUTORIAL_HUMAN_ID);
  if (!human) return next;
  const idx = human.discard.findIndex((c) => c.cardDefId === "superior_rye");
  if (idx === -1) return next;
  const [card] = human.discard.splice(idx, 1) as [Card];
  human.deck.push(card);
  return next;
}

/** Find the Specialty Rye in the human's hand (post-rigged-draw). */
function findSpecialtyRyeInHand(state: GameState): string | null {
  const human = state.players.find((p) => p.id === TUTORIAL_HUMAN_ID);
  if (!human) return null;
  return human.hand.find((c) => c.cardDefId === "superior_rye")?.id ?? null;
}

/**
 * Pre-compute card-id helpers for an in-hand card matching a predicate.
 * Used for forcing aging actions in the time-skip transition.
 */
function findHandCard(state: GameState, predicate: (c: Card) => boolean): string | null {
  const human = state.players.find((p) => p.id === TUTORIAL_HUMAN_ID);
  if (!human) return null;
  return human.hand.find(predicate)?.id ?? null;
}

export const TUTORIAL_BEATS: Beat[] = [
  // ── Beat 1 — Make Bourbon, the easy one ─────────────────────────
  {
    id: "beat-1-make-backroad",
    kind: "await-action",
    title: "Make your first barrel",
    body: "**Backroad Batch** needs **1 cask, 1 corn, and any 1 grain.** You have all three in hand. Pick those three cards and commit them to the slot.",
    spotlight: { kind: "rickhouse-slot", ownerId: TUTORIAL_HUMAN_ID, slotIndex: 0 },
    matches: (action, state) => {
      if (action.type !== "MAKE_BOURBON") return false;
      if (action.playerId !== TUTORIAL_HUMAN_ID) return false;
      const target = findHumanBarrelByBillDef(state, "tutorial_backroad_batch");
      return target != null && action.slotId === target.slotId;
    },
  },
  {
    id: "beat-1-aftermath",
    kind: "prompt",
    title: "Recipe satisfied",
    body: "Backroad Batch is now **Aging**. Each round it'll collect a year. The cards you committed are locked in until you sell.",
    spotlight: { kind: "rickhouse-slot", ownerId: TUTORIAL_HUMAN_ID, slotIndex: 0 },
  },

  // ── Beat 2 — Make Bourbon, partial commit ───────────────────────
  {
    id: "beat-2-make-heritage",
    kind: "await-action",
    title: "Start the picky one",
    body: "**Heritage Reserve** needs **1 cask, 1 corn, 2 rye — and at least one Specialty Rye.** Commit what you've got. The Specialty Rye comes from the market next.",
    spotlight: { kind: "rickhouse-slot", ownerId: TUTORIAL_HUMAN_ID, slotIndex: 1 },
    matches: (action, state) => {
      if (action.type !== "MAKE_BOURBON") return false;
      if (action.playerId !== TUTORIAL_HUMAN_ID) return false;
      const target = findHumanBarrelByBillDef(state, "tutorial_heritage_reserve");
      return target != null && action.slotId === target.slotId;
    },
  },
  {
    id: "beat-2-aftermath",
    kind: "prompt",
    title: "Building, not aging",
    body: "Heritage Reserve is **Building** — the recipe still needs 1 specialty rye before it can age. We'll grab one from the market.",
    spotlight: { kind: "rickhouse-slot", ownerId: TUTORIAL_HUMAN_ID, slotIndex: 1 },
  },

  // ── Beat 3 — Market trip ────────────────────────────────────────
  {
    id: "beat-3-buy-specialty-rye",
    kind: "await-action",
    title: "Buy the Specialty Rye",
    body: "**Capital cards pay their face value.** Spend the **$3** capital to grab the Specialty Rye on the conveyor.",
    spotlight: { kind: "market-slot", slotIndex: 0 },
    matches: (action) =>
      action.type === "BUY_FROM_MARKET" &&
      action.playerId === TUTORIAL_HUMAN_ID &&
      action.marketSlotIndex === 0,
  },
  {
    id: "beat-3-aftermath",
    kind: "prompt",
    title: "Off to your discard",
    body: "Bought cards land in your **discard** — they cycle back into your hand later. Watch what happens after the round ends…",
    spotlight: { kind: "none" },
  },

  // ── Beat 4 — End round, rigged draw, time passes ────────────────
  {
    id: "beat-4-time-passes",
    kind: "transition",
    title: "Time passes…",
    subtitle: "Year 2",
    body: "Both distilleries close their books. Demand holds. The deck reshuffles for a new round.",
    fakeRolls: [{ dice: [1, 1] }],
    durationMs: 2600,
    mutate: (state) => rigSpecialtyRyeToDeckTop(state),
  },
  {
    id: "beat-4-end-round",
    kind: "scripted",
    body: "(internal — pass turn for both, run cleanup, force demand roll, force draws)",
    delayMs: 80,
    build: (state) => {
      const actions: GameAction[] = [];
      // Whoever's currently on the clock passes; engine will route the
      // bot's pass through the same branch when its turn comes up.
      const current = state.players[state.currentPlayerIndex];
      if (current && !current.outForRound) {
        actions.push({ type: "PASS_TURN", playerId: current.id });
      }
      return actions;
    },
  },
  {
    id: "beat-4-bot-pass",
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
    id: "beat-4-pin-start-player",
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
    id: "beat-4-draw-human",
    kind: "scripted",
    body: "(internal — human draws round-2 hand including the Specialty Rye)",
    delayMs: 80,
    build: (state) => {
      if (state.phase !== "draw") return [];
      const human = state.players.find((p) => p.id === TUTORIAL_HUMAN_ID);
      if (!human || state.playerIdsCompletedPhase.includes(TUTORIAL_HUMAN_ID)) return [];
      return [{ type: "DRAW_HAND", playerId: TUTORIAL_HUMAN_ID }];
    },
  },
  {
    id: "beat-4-draw-bot",
    kind: "scripted",
    body: "(internal — bot draws)",
    delayMs: 80,
    build: (state) => {
      if (state.phase !== "draw") return [];
      const bot = state.players.find((p) => p.id === TUTORIAL_BOT_ID);
      if (!bot || state.playerIdsCompletedPhase.includes(TUTORIAL_BOT_ID)) return [];
      return [{ type: "DRAW_HAND", playerId: TUTORIAL_BOT_ID }];
    },
  },
  {
    id: "beat-4-rigged-draw",
    kind: "prompt",
    title: "There it is",
    body: "**Specialty Rye** — fresh in your hand. Time to finish Heritage Reserve.",
    spotlight: { kind: "hand-card", cardId: "" }, // controller injects
  },

  // ── Beat 5 — Make Bourbon completion ────────────────────────────
  {
    id: "beat-5-finish-heritage",
    kind: "await-action",
    title: "Complete the recipe",
    body: "Commit the **Specialty Rye** to Heritage Reserve. The recipe will be satisfied — and Specialty cards grant **+1 reputation when the barrel sells.**",
    spotlight: { kind: "rickhouse-slot", ownerId: TUTORIAL_HUMAN_ID, slotIndex: 1 },
    matches: (action, state) => {
      if (action.type !== "MAKE_BOURBON") return false;
      if (action.playerId !== TUTORIAL_HUMAN_ID) return false;
      const target = findHumanBarrelByBillDef(state, "tutorial_heritage_reserve");
      if (!target || action.slotId !== target.slotId) return false;
      const ryeId = findSpecialtyRyeInHand(state);
      return ryeId != null && action.cardIds.includes(ryeId);
    },
  },
  {
    id: "beat-5-fixup",
    kind: "scripted",
    body: "(internal — backdate Heritage so the player can age it this round; otherwise the engine's just-completed rule blocks AGE_BOURBON in the same round)",
    delayMs: 40,
    mutate: (state) => {
      const next = structuredClone(state);
      const heritage = next.allBarrels.find(
        (b) =>
          b.ownerId === TUTORIAL_HUMAN_ID &&
          b.attachedMashBill.defId === "tutorial_heritage_reserve",
      );
      if (heritage && heritage.completedInRound != null && heritage.completedInRound >= state.round) {
        heritage.completedInRound = Math.max(0, state.round - 1);
      }
      return next;
    },
    build: () => [],
  },
  {
    id: "beat-5-aftermath",
    kind: "prompt",
    title: "Now both are aging",
    body: "Heritage Reserve is **Aging**. Specialty cards stick with the barrel until sale — that **+1 rep** is locked in for whenever you cash out.",
    spotlight: { kind: "rickhouse-row", ownerId: TUTORIAL_HUMAN_ID },
  },

  // ── Beat 6 — Aging ──────────────────────────────────────────────
  {
    id: "beat-6-age-prompt",
    kind: "prompt",
    title: "Send a year down each barrel",
    body: "Each round you can place **one card** on top of an aging barrel to age it by 1 year. Let's age both right now.",
    spotlight: { kind: "rickhouse-row", ownerId: TUTORIAL_HUMAN_ID },
  },
  {
    id: "beat-6-age-backroad",
    kind: "await-action",
    title: "Age Backroad Batch",
    body: "Pick any card from your hand and drop it on **Backroad Batch.**",
    spotlight: { kind: "rickhouse-slot", ownerId: TUTORIAL_HUMAN_ID, slotIndex: 0 },
    matches: (action, state) => {
      if (action.type !== "AGE_BOURBON") return false;
      if (action.playerId !== TUTORIAL_HUMAN_ID) return false;
      const target = findHumanBarrelByBillDef(state, "tutorial_backroad_batch");
      return target != null && action.barrelId === target.barrelId;
    },
  },
  {
    id: "beat-6-age-heritage",
    kind: "await-action",
    title: "Now Heritage Reserve",
    body: "Drop another card on **Heritage Reserve.**",
    spotlight: { kind: "rickhouse-slot", ownerId: TUTORIAL_HUMAN_ID, slotIndex: 1 },
    matches: (action, state) => {
      if (action.type !== "AGE_BOURBON") return false;
      if (action.playerId !== TUTORIAL_HUMAN_ID) return false;
      const target = findHumanBarrelByBillDef(state, "tutorial_heritage_reserve");
      return target != null && action.barrelId === target.barrelId;
    },
  },
  {
    id: "beat-6-pass-human",
    kind: "scripted",
    body: "(internal — human ends turn so the bot can sell)",
    delayMs: 600,
    build: () => [{ type: "PASS_TURN", playerId: TUTORIAL_HUMAN_ID }],
  },

  // ── Beat 7 — Bot sells ──────────────────────────────────────────
  {
    id: "beat-7-bot-sells",
    kind: "scripted",
    body: "(internal — scripted bot sale)",
    delayMs: 800,
    build: (state) => {
      const target = findBotAgingBarrel(state);
      if (!target || !target.cardId) return [];
      const bot = state.players.find((p) => p.id === TUTORIAL_BOT_ID);
      if (!bot) return [];
      // Bot's barrel is Backroad at age 4, demand 2. Grid lookup:
      // ageBands [2,4] → row 1; demandBands [1,3] → col 0; reward 3.
      return [
        {
          type: "SELL_BOURBON",
          playerId: TUTORIAL_BOT_ID,
          barrelId: target.barrelId,
          reputationSplit: 3,
          cardDrawSplit: 0,
          spendCardId: target.cardId,
        },
      ];
    },
  },
  {
    id: "beat-7-modal",
    kind: "prompt",
    title: "The market just shifted",
    body: "Your opponent sold a barrel. **Demand dropped from 2 to 1.** Your Backroad Batch is age 2 — sellable now. But Heritage Reserve will pay a lot more if you wait for demand to rise.",
    spotlight: { kind: "demand" },
    ctaLabel: "What now?",
  },

  // ── Beat 8 — False decision ─────────────────────────────────────
  {
    id: "beat-8-decision",
    kind: "decision",
    title: "Your move",
    body: "Two paths in front of you. Which feels right?",
    optionA: {
      label: "Sell Backroad Batch now",
      reply: "Good call — small wins fund the big ones. Let's lock it in.",
    },
    optionB: {
      label: "Wait and age more",
      reply: "Smart instinct! But selling Backroad now gives you reputation **and** purchasing power for the big sale. Let's do that.",
    },
  },
  {
    id: "beat-8-bot-pass",
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
    id: "beat-8-round-3-pin-start-player",
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
    id: "beat-8-round-3-draw-human",
    kind: "scripted",
    body: "(internal)",
    delayMs: 80,
    build: (state) =>
      state.phase === "draw" && !state.playerIdsCompletedPhase.includes(TUTORIAL_HUMAN_ID)
        ? [{ type: "DRAW_HAND", playerId: TUTORIAL_HUMAN_ID }]
        : [],
  },
  {
    id: "beat-8-round-3-draw-bot",
    kind: "scripted",
    body: "(internal)",
    delayMs: 80,
    build: (state) =>
      state.phase === "draw" && !state.playerIdsCompletedPhase.includes(TUTORIAL_BOT_ID)
        ? [{ type: "DRAW_HAND", playerId: TUTORIAL_BOT_ID }]
        : [],
  },

  // ── Beat 9 — Sell Backroad ──────────────────────────────────────
  {
    id: "beat-9-sell-backroad",
    kind: "await-action",
    title: "Sell Backroad Batch",
    body: "Selling costs **1 card from your hand** — pick any. The grid pays **2 reputation** at this market temperature. We'll **split it: 1 rep, 1 card draw.**",
    spotlight: { kind: "rickhouse-slot", ownerId: TUTORIAL_HUMAN_ID, slotIndex: 0 },
    matches: (action, state) => {
      if (action.type !== "SELL_BOURBON") return false;
      if (action.playerId !== TUTORIAL_HUMAN_ID) return false;
      const target = findHumanBarrelByBillDef(state, "tutorial_backroad_batch");
      return target != null && action.barrelId === target.barrelId;
    },
    rewrite: (action) => {
      if (action.type !== "SELL_BOURBON") return null;
      // Force the rep/draw split per the spec.
      return { ...action, reputationSplit: 1, cardDrawSplit: 1 };
    },
  },
  {
    id: "beat-9-aftermath",
    kind: "prompt",
    title: "Slot's open again",
    body: "**+1 reputation** banked, **+1 card** drawn into your hand. Backroad's a Common — no award — so the slot opens fully. Empires grow one barrel at a time.",
    spotlight: { kind: "reputation" },
  },

  // ── Beat 10 — Time skip ─────────────────────────────────────────
  {
    id: "beat-10-time-skip",
    kind: "transition",
    title: "Time passes…",
    subtitle: "Demand spikes. The summer runs hot.",
    body: "Bottle shops empty out. Allocation lists fill up. **Demand climbs to 5.** Heritage Reserve picks up another year in the rickhouse.",
    fakeRolls: [
      { dice: [4, 5], commitToDemand: true },
      { dice: [5, 6], commitToDemand: true },
      { dice: [6, 6], commitToDemand: true },
    ],
    durationMs: 4200,
    mutate: (state) => {
      // Direct fast-forward: bump demand to 5 and Heritage to age 3.
      const next = structuredClone(state);
      next.demand = 5;
      const heritage = next.allBarrels.find(
        (b) => b.ownerId === TUTORIAL_HUMAN_ID && b.attachedMashBill.defId === "tutorial_heritage_reserve",
      );
      if (heritage) {
        heritage.age = 3;
        heritage.agingCards = [
          ...heritage.agingCards,
          { id: "agingcard_tutorial_skip_1", cardDefId: "corn", type: "resource", subtype: "corn", resourceCount: 1 },
        ];
      }
      return next;
    },
  },

  // ── Beat 11 — Big sale ──────────────────────────────────────────
  {
    id: "beat-11-sell-heritage",
    kind: "await-action",
    title: "Now. This is the moment.",
    body: "Heritage Reserve at **age 3, demand 5.** Sell it. The Specialty Rye in the recipe pays an extra **+1 rep** at sale, and you'll trigger the **Silver award.**",
    spotlight: { kind: "rickhouse-slot", ownerId: TUTORIAL_HUMAN_ID, slotIndex: 1 },
    matches: (action, state) => {
      if (action.type !== "SELL_BOURBON") return false;
      if (action.playerId !== TUTORIAL_HUMAN_ID) return false;
      const target = findHumanBarrelByBillDef(state, "tutorial_heritage_reserve");
      return target != null && action.barrelId === target.barrelId;
    },
    rewrite: (action) => {
      if (action.type !== "SELL_BOURBON") return null;
      // Grid 5 + Specialty +1 = 6 to player as reputation.
      return { ...action, reputationSplit: 5, cardDrawSplit: 0 };
    },
  },

  // ── Beat 12 — Celebration + finale ──────────────────────────────
  {
    id: "beat-12-silver",
    kind: "celebrate",
    title: "Silver award",
    body: "Heritage Reserve hit the age threshold. The recipe stays in the slot, ready to build again. **+6 reputation** locked in.",
    lines: [
      "Grid payout · 5",
      "Specialty Rye bonus · +1",
      "Silver award · recipe retained",
    ],
    ctaLabel: "Continue",
  },
  {
    id: "beat-12-finale",
    kind: "finale",
    title: "You just learned the whole game.",
    body: "That's Bourbonomics. The distillery with the most reputation when the supply runs dry wins.",
    bullets: [
      "Built recipes from scratch — one in a single turn, one across multiple turns.",
      "Bought a Specialty card from the market to finish a tough recipe.",
      "Aged your barrels.",
      "Sold the small one to fund the big one.",
      "Waited for demand to rise.",
      "Earned a Silver award — your recipe is still in the slot, ready to do it again.",
    ],
    closeLabel: "Start a real game",
    replayLabel: "Replay tutorial",
  },
];

/** Helper used by the controller's hand-card spotlight injection. */
export function spotlightSpecialtyRye(state: GameState): string | null {
  return findSpecialtyRyeInHand(state);
}

/**
 * Convenience: pick out a hand card the player can use to age (any
 * resource or capital). Used by the controller for visual hints during
 * Beat 6 — not for forcing the action.
 */
export function pickAnyHandCard(state: GameState): string | null {
  return findHandCard(state, () => true);
}
