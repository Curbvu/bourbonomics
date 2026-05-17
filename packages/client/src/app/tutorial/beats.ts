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

/**
 * Helper: tally cumulative resource counts in a barrel's production pile.
 * Used by every Make sub-beat's `advanceWhen` to look for the specific
 * ingredient that this step expects to have just landed.
 */
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
 * Shared matcher factory — a Make sub-beat accepts any MAKE_BOURBON to
 * the right barrel's slot. Composition is gated through `advanceWhen`
 * (per-step "has the new ingredient landed?" predicates).
 */
function matchMakeForBill(billDefId: string) {
  return (action: GameAction, state: GameState) => {
    if (action.type !== "MAKE_BOURBON") return false;
    if (action.playerId !== TUTORIAL_HUMAN_ID) return false;
    const target = findHumanBarrelByBillDef(state, billDefId);
    return target != null && action.slotId === target.slotId;
  };
}

export const TUTORIAL_BEATS: Beat[] = [
  // ── Lesson 1 chapter card ───────────────────────────────────────
  {
    id: "lesson-1-intro",
    kind: "prompt",
    title: "Make your first bourbon",
    body: "We'll add the ingredients one at a time. Start with the corn.",
    spotlight: { kind: "none" },
    chapter: { number: 1, label: "Make bourbon" },
  },

  // ── Beat 1 — Make Backroad, one ingredient at a time ────────────
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
    body: "Backroad Batch is **Aging**. Add 1 card each turn to age it.",
    spotlight: { kind: "rickhouse-slot", ownerId: TUTORIAL_HUMAN_ID, slotIndex: 0 },
  },

  // ── Beat 2 — Make Heritage, ingredient by ingredient ────────────
  {
    id: "beat-2-intro",
    kind: "prompt",
    title: "One more recipe",
    body: "**Heritage Reserve** is your second slot. Same idea — we'll add ingredients one at a time. It also needs a Specialty Rye, but you don't own one yet — we'll buy it after.",
    spotlight: { kind: "rickhouse-slot", ownerId: TUTORIAL_HUMAN_ID, slotIndex: 1 },
  },
  {
    id: "beat-2a-add-corn",
    kind: "await-action",
    title: "Add the corn",
    body: "Drag your remaining **corn** onto **Heritage Reserve**.",
    spotlight: { kind: "rickhouse-slot", ownerId: TUTORIAL_HUMAN_ID, slotIndex: 1 },
    handCardFilter: (c) => c.type === "resource" && c.subtype === "corn",
    dragHint: {
      pickHandCard: (c) => c.type === "resource" && c.subtype === "corn",
      slotIndex: 1,
    },
    matches: matchMakeForBill("tutorial_heritage_reserve"),
    advanceWhen: (state) => {
      const t = pileTotals(state, "tutorial_heritage_reserve");
      return t != null && t.corn >= 1;
    },
  },
  {
    id: "beat-2b-add-rye-1",
    kind: "await-action",
    title: "Add a rye",
    body: "Heritage is rye-heavy. Drag a **rye** card onto it.",
    spotlight: { kind: "rickhouse-slot", ownerId: TUTORIAL_HUMAN_ID, slotIndex: 1 },
    handCardFilter: (c) =>
      c.type === "resource" && c.subtype === "rye" && !c.specialty,
    dragHint: {
      pickHandCard: (c) =>
        c.type === "resource" && c.subtype === "rye" && !c.specialty,
      slotIndex: 1,
    },
    matches: matchMakeForBill("tutorial_heritage_reserve"),
    advanceWhen: (state) => {
      const t = pileTotals(state, "tutorial_heritage_reserve");
      return t != null && t.rye >= 1;
    },
  },
  {
    id: "beat-2c-add-rye-2",
    kind: "await-action",
    title: "And another rye",
    body: "Drag your **second rye** onto Heritage. (You'll add a Specialty Rye later.)",
    spotlight: { kind: "rickhouse-slot", ownerId: TUTORIAL_HUMAN_ID, slotIndex: 1 },
    handCardFilter: (c) =>
      c.type === "resource" && c.subtype === "rye" && !c.specialty,
    dragHint: {
      pickHandCard: (c) =>
        c.type === "resource" && c.subtype === "rye" && !c.specialty,
      slotIndex: 1,
    },
    matches: matchMakeForBill("tutorial_heritage_reserve"),
    advanceWhen: (state) => {
      const t = pileTotals(state, "tutorial_heritage_reserve");
      return t != null && t.rye >= 2;
    },
  },
  {
    id: "beat-2d-add-cask",
    kind: "await-action",
    title: "Finish with the cask",
    body: "Drag your last **cask** onto Heritage.",
    spotlight: { kind: "rickhouse-slot", ownerId: TUTORIAL_HUMAN_ID, slotIndex: 1 },
    handCardFilter: (c) => c.type === "resource" && c.subtype === "cask",
    dragHint: {
      pickHandCard: (c) => c.type === "resource" && c.subtype === "cask",
      slotIndex: 1,
    },
    matches: matchMakeForBill("tutorial_heritage_reserve"),
    advanceWhen: (state) => {
      const t = pileTotals(state, "tutorial_heritage_reserve");
      return t != null && t.cask >= 1;
    },
  },
  {
    id: "beat-2-aftermath",
    kind: "prompt",
    title: "Still Building",
    body: "Heritage needs 1 Specialty Rye to finish. Buy one next.",
    spotlight: { kind: "rickhouse-slot", ownerId: TUTORIAL_HUMAN_ID, slotIndex: 1 },
  },

  // ── Lesson 2 chapter card ───────────────────────────────────────
  {
    id: "lesson-2-intro",
    kind: "prompt",
    title: "Hit the market",
    body: "Time to shop. The cards on the conveyor are for sale — pay with cards from your hand.",
    spotlight: { kind: "none" },
    chapter: { number: 2, label: "Buy a specialty" },
  },

  // ── Beat 3 — Market trip ────────────────────────────────────────
  {
    id: "beat-3-buy-specialty-rye",
    kind: "await-action",
    title: "Buy the Specialty Rye",
    body: "Spend your **two $1 capitals** on the Specialty Rye ($2).",
    spotlight: { kind: "market-slot", slotIndex: 0 },
    matches: (action) =>
      action.type === "BUY_FROM_MARKET" &&
      action.playerId === TUTORIAL_HUMAN_ID &&
      action.marketSlotIndex === 0,
    // Advance only after the buy ACTUALLY landed: the Specialty Rye
    // moves out of the conveyor and into the human's discard. Guards
    // against a matched-but-rejected dispatch (e.g. underpaid) racing
    // the controller forward without the buy having succeeded.
    advanceWhen: (state) => {
      const human = state.players.find((p) => p.id === TUTORIAL_HUMAN_ID);
      return (
        human != null &&
        human.discard.some((c) => c.cardDefId === "superior_rye")
      );
    },
  },
  {
    id: "beat-3-aftermath",
    kind: "prompt",
    title: "Into your discard",
    body: "Bought cards go to discard. They'll come back next reshuffle.",
    spotlight: { kind: "none" },
  },

  // ── Beat 4 — End round, rigged draw, time passes ────────────────
  {
    id: "beat-4-time-passes",
    kind: "transition",
    title: "Time passes…",
    subtitle: "Year 2",
    body: "Round ends. Decks reshuffle.",
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
    title: "Specialty Rye drawn",
    body: "Finish Heritage with it next.",
    spotlight: { kind: "hand-card", cardId: "" }, // controller injects
  },

  // ── Beat 5 — Make Bourbon completion ────────────────────────────
  {
    id: "beat-5-finish-heritage",
    kind: "await-action",
    title: "Finish Heritage",
    body: "Commit the **Specialty Rye**. Specialty cards unlock recipe gates that demand them — without one, Heritage Reserve cannot finish.",
    spotlight: { kind: "rickhouse-slot", ownerId: TUTORIAL_HUMAN_ID, slotIndex: 1 },
    // Lock the hand to the Specialty Rye specifically — it's the only
    // card the recipe still needs. The other resources in hand are
    // technically a legal partial commit, but commiting them would
    // lock cards on the barrel for no payoff.
    handCardFilter: (c) => c.cardDefId === "superior_rye",
    matches: (action, state) => {
      if (action.type !== "MAKE_BOURBON") return false;
      if (action.playerId !== TUTORIAL_HUMAN_ID) return false;
      const target = findHumanBarrelByBillDef(state, "tutorial_heritage_reserve");
      if (!target || action.slotId !== target.slotId) return false;
      const ryeId = findSpecialtyRyeInHand(state);
      return ryeId != null && action.cardIds.includes(ryeId);
    },
    // Advance only when Heritage actually transitions to Aging — the
    // matcher passing isn't enough on its own; if the engine rejects
    // the commit (illegal cap, etc.) state stays in construction.
    advanceWhen: (state) => {
      const heritage = state.allBarrels.find(
        (b) =>
          b.ownerId === TUTORIAL_HUMAN_ID &&
          b.attachedMashBill.defId === "tutorial_heritage_reserve",
      );
      return heritage != null && heritage.phase === "aging";
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
    title: "Both aging",
    body: "Heritage is locked in. The barrel ages from next round on.",
    spotlight: { kind: "rickhouse-row", ownerId: TUTORIAL_HUMAN_ID },
  },
  {
    // Step 1 of 2: GET the player to right-click. Continue is hidden
    // (and auto-advance fires) once the inspect modal opens for
    // Heritage. Standard bottom-center prompt — no modal up yet,
    // nothing to overlap.
    id: "beat-5c-open-card",
    kind: "prompt",
    title: "Inspect Heritage",
    body: "**Right-click Heritage Reserve** to see its payoff grid.",
    spotlight: { kind: "rickhouse-slot", ownerId: TUTORIAL_HUMAN_ID, slotIndex: 1 },
    awaitInspectBarrelDefId: "tutorial_heritage_reserve",
  },
  {
    // Step 2 of 2: walk the player through the inspector contents.
    // Positioned top-right so it sits beside the centered inspect
    // modal instead of underneath it.
    id: "beat-5d-grid-explained",
    kind: "prompt",
    title: "The grid",
    body: "Rows = **age**, columns = **demand**. Cell = rep at sale. **🥈 Silver** keeps the recipe in your slot. **🥇 Gold** lets you swap it. Heritage hits **Silver at age 3** — your goal.",
    spotlight: { kind: "rickhouse-slot", ownerId: TUTORIAL_HUMAN_ID, slotIndex: 1 },
    position: "top-right",
    // Auto-close the still-open inspect modal when the player clicks
    // Continue. The next beat (Age a year on each barrel) needs the
    // rickhouse interactive again, and the modal would be in the way.
    closeInspectOnAdvance: true,
  },

  // ── Lesson 3 chapter card ───────────────────────────────────────
  {
    id: "lesson-3-intro",
    kind: "prompt",
    title: "Age your barrels",
    body: "Every year an aging barrel needs 1 card to keep maturing. Older bourbon pays better — but only if you sell at the right time.",
    spotlight: { kind: "none" },
    chapter: { number: 3, label: "Age your barrels" },
  },

  // ── Beat 6 — Aging ──────────────────────────────────────────────
  {
    id: "beat-6-age-prompt",
    kind: "prompt",
    title: "Age your barrels",
    body: "Click a barrel, then a hand card to add 1 year. (Or drag.)",
    spotlight: { kind: "rickhouse-row", ownerId: TUTORIAL_HUMAN_ID },
  },
  {
    // Single accumulator beat — was two sequential awaits (Backroad, then
    // Heritage) but the auto-pass on beat-6-pass-human raced the second
    // age and the bot would fire its sale before the player could commit
    // the second card. With one beat using `advanceWhen`, the controller
    // doesn't move on until BOTH barrels are aged, in either order.
    id: "beat-6-age-both",
    kind: "await-action",
    title: "Age both",
    body: "Age **Backroad Batch** and **Heritage Reserve**. Either order.",
    spotlight: { kind: "rickhouse-row", ownerId: TUTORIAL_HUMAN_ID },
    matches: (action, state) => {
      if (action.type !== "AGE_BOURBON") return false;
      if (action.playerId !== TUTORIAL_HUMAN_ID) return false;
      const backroad = findHumanBarrelByBillDef(state, "tutorial_backroad_batch");
      const heritage = findHumanBarrelByBillDef(state, "tutorial_heritage_reserve");
      return (
        (backroad != null && action.barrelId === backroad.barrelId) ||
        (heritage != null && action.barrelId === heritage.barrelId)
      );
    },
    advanceWhen: (state) => {
      const backroad = state.allBarrels.find(
        (b) =>
          b.ownerId === TUTORIAL_HUMAN_ID &&
          b.attachedMashBill.defId === "tutorial_backroad_batch",
      );
      const heritage = state.allBarrels.find(
        (b) =>
          b.ownerId === TUTORIAL_HUMAN_ID &&
          b.attachedMashBill.defId === "tutorial_heritage_reserve",
      );
      return (
        backroad != null &&
        backroad.agedThisRound &&
        heritage != null &&
        heritage.agedThisRound
      );
    },
  },
  {
    id: "beat-6-pass-human",
    kind: "scripted",
    body: "(internal — human ends turn so the bot can sell)",
    // Bumped from 600ms — the second AGE_BOURBON ripples through state
    // (agingCards push, age++, agedThisRound flag) and then the
    // controller's `advanceWhen` re-evaluates. Give the player a
    // beat to actually see the second barrel tick to 1Y before the
    // turn flips to the bot.
    delayMs: 900,
    build: () => [{ type: "PASS_TURN", playerId: TUTORIAL_HUMAN_ID }],
  },

  // ── Lesson 4 chapter card ───────────────────────────────────────
  {
    id: "lesson-4-intro",
    kind: "prompt",
    title: "Sell at the right time",
    body: "Selling earns reputation — but it drops the market's demand for everyone. Watch when your opponent sells.",
    spotlight: { kind: "none" },
    chapter: { number: 4, label: "Sell" },
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
        },
      ];
    },
  },
  {
    id: "beat-7-modal",
    kind: "prompt",
    title: "Demand dropped",
    body: "Opponent sold. **Demand: 2 → 1.** Backroad's sellable now; Heritage waits for a spike.",
    spotlight: { kind: "demand" },
    ctaLabel: "What now?",
  },

  // ── Beat 8 — False decision ─────────────────────────────────────
  {
    id: "beat-8-decision",
    kind: "decision",
    title: "Your move",
    body: "Pick one.",
    optionA: {
      label: "Sell Backroad now",
      reply: "Locking it in.",
    },
    optionB: {
      label: "Wait and age more",
      reply: "Selling Backroad now gives you cash to grow. Let's do that.",
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
  {
    id: "beat-8-passive-age-backroad",
    kind: "scripted",
    body: "(internal — Backroad picks up its second year across the round break so it lands on the engine's MIN_SELL_AGE of 2)",
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

  // ── Beat 9 — Sell Backroad ──────────────────────────────────────
  {
    id: "beat-9-sell-backroad",
    kind: "await-action",
    title: "Sell Backroad",
    body: "Click **Sell**, then **Backroad Batch**. Grid pays **2 rep**. Selling is free — no card cost.",
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
      // Take the full grid value as reputation. The rep ↔ card draw
      // split is a real game mechanic but we leave it for the
      // post-tutorial onboarding so the first sale stays simple.
      return { ...action, reputationSplit: 2, cardDrawSplit: 0 };
    },
    // Advance once the Backroad barrel actually leaves the rickhouse —
    // sale rejected by the engine would leave the barrel in place.
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
    id: "beat-9-aftermath",
    kind: "prompt",
    title: "Slot reopened",
    body: "**+2 reputation** banked. Backroad's a Common — no award — so the slot opens fully.",
    spotlight: { kind: "reputation" },
  },

  // ── Beat 10 — Time skip ─────────────────────────────────────────
  {
    id: "beat-10-time-skip",
    kind: "transition",
    title: "Time passes…",
    subtitle: "Demand spikes.",
    body: "**Demand: 1 → 5.** Heritage ages another year.",
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
    title: "Sell Heritage",
    body: "**Age 3 × demand 5 → 5 rep.** Specialty Rye adds **+1**. Silver hits.",
    spotlight: { kind: "action-button", action: "sell" },
    postEngageSpotlight: {
      kind: "rickhouse-slot",
      ownerId: TUTORIAL_HUMAN_ID,
      slotIndex: 1,
    },
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
    // Advance once the human's `barrelsSold` ticks (proves the engine
    // actually landed the sale — Silver Award keeps the bill in the
    // slot but increments the sold counter regardless).
    advanceWhen: (state) => {
      const human = state.players.find((p) => p.id === TUTORIAL_HUMAN_ID);
      return human != null && human.barrelsSold >= 2;
    },
  },

  // ── Beat 12 — Celebration + finale ──────────────────────────────
  {
    id: "beat-12-silver",
    kind: "celebrate",
    title: "Silver",
    body: "**+6 rep.** Recipe stays — build it again.",
    lines: [
      "Grid · 5",
      "Specialty · +1",
      "Silver · recipe retained",
    ],
    ctaLabel: "Continue",
  },
  {
    id: "beat-12-finale",
    kind: "finale",
    title: "That's the game.",
    body: "Most reputation when the supply dries up wins. Patience and timing.",
    bullets: [
      "Built two recipes.",
      "Bought a Specialty from market.",
      "Aged your barrels.",
      "Sold small to fund big.",
      "Waited for demand.",
      "Earned a Silver award.",
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
