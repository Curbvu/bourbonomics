/**
 * Advanced tutorial beats — covers the 10+ systems the basic tutorial
 * skips. 14 chapters in canonical play order:
 *
 *   1. Pick your distillery
 *   2. Build your starter (trade window)
 *   3. Read a mash bill
 *   4. Run a Drafting Loop
 *   5. Specialty resources
 *   6. Demand mechanics
 *   7. Operations cards
 *   8. Warehouse (the v3.5 replacement for Save Slot)
 *   9. Trade with a player
 *  10. Awards
 *  11. Place a bottle
 *  12. Inventory + retrieve
 *  13. Draft second portfolio
 *  14. Endgame & scoring
 *
 * Architecture mirrors `../beats.ts` — same beat kinds, same shape,
 * same controller. Chapter cards use the `chapter` field so the
 * progress chip reads "Chapter N · Label · 2/4" instead of a flat
 * "Tutorial · 23/60".
 *
 * Between chapters: `transition` beats with a `mutate` jump state
 * forward (refill markets, age barrels, restock decks) so each
 * chapter is self-contained.
 *
 * Most chapters have 3–5 visible beats by design. The early ones
 * (1–4) carry full interactivity; later chapters lean on `prompt`
 * walk-throughs + `scripted` demonstrations because the full
 * interaction would balloon the chapter count past the budget
 * (per spec: ~6 visible beats per chapter max).
 */

import {
  ADV_TUTORIAL_HUMAN_ID,
  ADV_TUTORIAL_BOT1_ID,
  ADV_TUTORIAL_BOT2_ID,
  ADV_TUTORIAL_BOT3_ID,
  buildAdvTutorialAwardBill,
  buildAdvTutorialRareBill,
} from "@bourbonomics/engine";
import type { Barrel, GameAction, GameState } from "@bourbonomics/engine";
import type { Beat, BeatKind } from "../types";

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

/** Find the High-Rye House distillery instance in the pool. */
function findHighRyeHouseId(state: GameState): string | null {
  const d = state.distilleryPool.find((d) => d.defId === "high_rye_house");
  return d?.id ?? null;
}

/** Find a distillery by defId from EITHER the pool or any player's pick. */
function findDistilleryByDefId(
  state: GameState,
  defId: string,
): string | null {
  const fromPool = state.distilleryPool.find((d) => d.defId === defId);
  if (fromPool) return fromPool.id;
  for (const p of state.players) {
    if (p.distillery?.defId === defId) return p.distillery.id;
  }
  return null;
}

/** Generic "scripted no-op state mutate" — for transition beats whose
 *  only job is to rebuild state between chapters. */
function noopBuild(): GameAction[] {
  return [];
}

// ─────────────────────────────────────────────────────────────────
// The beats
// ─────────────────────────────────────────────────────────────────

export const TUTORIAL_ADVANCED_BEATS: Beat[] = [
  // ════════════════════════════════════════════════════════════════
  // CHAPTER 1 — Pick your distillery
  // ════════════════════════════════════════════════════════════════
  {
    id: "ch1-intro",
    kind: "prompt",
    title: "Pick your distillery",
    body:
      "Every game starts here. Four profiles offer different starting capital, pre-aged barrels, abilities, and constraints — they're package deals, not just head starts. **You'll pick High-Rye House** so later chapters can demo the rye-sale bonus.",
    spotlight: { kind: "none" },
    chapter: { number: 1, label: "Distillery" },
  },
  {
    id: "ch1-pick-high-rye",
    kind: "await-action",
    title: "Choose High-Rye House",
    body:
      "Click **High-Rye House** in the picker. It starts with 3 Capital, a pre-aged rye barrel, +1 Capital on every rye-bill sale, and a hard ban on wheated bills.",
    spotlight: { kind: "none" },
    matches: (action, state) => {
      if (action.type !== "SELECT_DISTILLERY") return false;
      if (action.playerId !== ADV_TUTORIAL_HUMAN_ID) return false;
      const targetId = findHighRyeHouseId(state);
      return targetId != null && action.distilleryId === targetId;
    },
  },
  {
    id: "ch1-bots-pick",
    kind: "scripted",
    body: "(internal — bots pick remaining distilleries in reverse-snake order)",
    delayMs: 200,
    build: (state) => {
      // Bots pick first-available distillery in their selection-order slot
      const out: GameAction[] = [];
      // The engine's reverse-snake order means the cursor advances
      // automatically. We just need to dispatch SELECT_DISTILLERY for
      // each remaining bot in order.
      const order = state.distillerySelectionOrder;
      const cursor = state.distillerySelectionCursor;
      const remaining = order.slice(cursor);
      // Build the chain — each bot picks the first pool entry.
      let poolSnapshot = [...state.distilleryPool];
      for (const playerId of remaining) {
        if (playerId === ADV_TUTORIAL_HUMAN_ID) continue;
        const pick = poolSnapshot[0];
        if (!pick) break;
        out.push({
          type: "SELECT_DISTILLERY",
          playerId,
          distilleryId: pick.id,
        });
        poolSnapshot = poolSnapshot.slice(1);
      }
      return out;
    },
  },
  {
    id: "ch1-aftermath",
    kind: "prompt",
    title: "Rickhouse ready",
    body:
      "Your High-Rye House is built — 3 slots, your pre-aged rye barrel is already aging, and you start with 3 Capital + 2 Specialty Rye cards. **Aha:** distillery picks are 4-axis package deals, not just starting-rep variants.",
    spotlight: { kind: "rickhouse-row", ownerId: ADV_TUTORIAL_HUMAN_ID },
  },

  // ════════════════════════════════════════════════════════════════
  // CHAPTER 2 — Build your starter
  // ════════════════════════════════════════════════════════════════
  {
    id: "ch2-intro",
    kind: "prompt",
    title: "Build your starter",
    body:
      "Each player gets a **locked 16-card pool** dealt face-up: 6 cask + 4 corn + 3 grain + 3 Generic Labor. The shape is identical for everyone — variance comes from your distillery's adjustments + the trade window. High-Rye adds 2 Specialty Rye for free.",
    spotlight: { kind: "hand-cards", cardIds: [] },
    chapter: { number: 2, label: "Starter" },
  },
  {
    id: "ch2-explain-trade",
    kind: "prompt",
    title: "The trade window",
    body:
      "Before round 1, every pair of players can do **1-for-1 trades** by mutual consent. There's also a **stuck-hand swap** — once per window, return up to 3 cards and draw the same number off your starter buffer.",
    spotlight: { kind: "hand-cards", cardIds: [] },
  },
  {
    id: "ch2-skip-trade",
    kind: "scripted",
    body: "(internal — fast-forward through the starter draft phase)",
    delayMs: 300,
    mutate: (state) => {
      // Skip to round 1 draw phase by clearing the starter draft and
      // dealing every player their opening hand. Since the engine
      // controls this flow, we mutate state directly here.
      const next: GameState = JSON.parse(JSON.stringify(state));
      if (next.phase === "starter_deck_draft") {
        next.phase = "draw";
        next.starterDeckDraftOrder = [];
        // v3.10: hands are dealt at setup — dispatch the same final
        // step STARTER_PASS would have run (shuffle starterHand into
        // deck, then draw handSize into hand). Without this the new
        // single-refresh model leaves the player empty-handed
        // through Chapter 3+ (DRAW_HAND no longer touches cards).
        for (const p of next.players) {
          if (p.starterHand.length > 0) {
            p.deck = [...p.starterHand, ...p.deck];
            p.starterHand = [];
          }
          const needed = Math.max(0, p.handSize - p.hand.length);
          const take = Math.min(needed, p.deck.length);
          if (take > 0) {
            p.hand.push(...p.deck.slice(-take));
            p.deck = p.deck.slice(0, p.deck.length - take);
          }
        }
        next.starterUndealtPool = [];
      }
      return next;
    },
    build: noopBuild,
  },
  {
    id: "ch2-aftermath",
    kind: "prompt",
    title: "Round 1 begins",
    body:
      "Trade window closed. Your starter deck is shuffled and you've drawn your opening hand. **Aha:** composition is identical for everyone — order + distillery mods are the only variance.",
    spotlight: { kind: "hand-cards", cardIds: [] },
  },

  // ════════════════════════════════════════════════════════════════
  // CHAPTER 3 — Read a mash bill
  // ════════════════════════════════════════════════════════════════
  {
    id: "ch3-setup",
    kind: "scripted",
    body: "(internal — slot a Rare bill for inspection)",
    delayMs: 250,
    mutate: (state) => {
      const next: GameState = JSON.parse(JSON.stringify(state));
      next.phase = "action";
      next.currentPlayerIndex = next.players.findIndex(
        (p) => p.id === ADV_TUTORIAL_HUMAN_ID,
      );
      // Slot the Rare bill as a Staged barrel in the human's open slot
      const human = next.players.find((p) => p.id === ADV_TUTORIAL_HUMAN_ID);
      if (!human) return next;
      const rare = buildAdvTutorialRareBill(0);
      // Find an empty slot
      const occupied = new Set(
        next.allBarrels.filter((b) => b.ownerId === human.id).map((b) => b.slotId),
      );
      const openSlot = human.rickhouseSlots.find((s) => !occupied.has(s.id));
      if (openSlot) {
        const barrel: Barrel = {
          id: `barrel_${human.id}_pepperbox`,
          ownerId: human.id,
          slotId: openSlot.id,
          attachedMashBill: rare,
          phase: "ready",
          productionCards: [],
          productionCardDefIds: [],
          agingCards: [],
          age: 0,
          productionRound: next.round,
          completedInRound: null,
          agedThisRound: false,
          extraAgesAvailable: 0,
          inspectedThisRound: false,
          skipNextRoundAging: false,
          gridRepOffset: 0,
          demandBandOffset: 0,
          refundedCaskCount: 0,
        };
        next.allBarrels.push(barrel);
      }
      // Clear gates
      for (const p of next.players) {
        p.needsDemandRoll = false;
        p.needsAgeBarrels = false;
      }
      return next;
    },
    build: noopBuild,
  },
  {
    id: "ch3-intro",
    kind: "prompt",
    title: "Read a mash bill",
    body:
      "Every bill carries a **2D grid** keyed on age × demand. Find the highest age threshold you've reached (row), highest demand threshold (column), read the cell. **Right-click Pepperbox Rare** to open the inspect modal.",
    spotlight: { kind: "rickhouse-row", ownerId: ADV_TUTORIAL_HUMAN_ID },
    chapter: { number: 3, label: "Mash bill" },
    awaitInspectBarrelDefId: "adv_tutorial_rare_rye",
  },
  {
    id: "ch3-grid",
    kind: "prompt",
    title: "Grid + tier floor",
    body:
      "Pepperbox is a **Rare** bill (4-rep tier floor). The grid pays 4–7 rep depending on age and demand. Even if the grid would pay less, the tier floor guarantees ≥ 4. **Aha:** the floor is a safety net — your build cost is always recovered.",
    spotlight: { kind: "rickhouse-row", ownerId: ADV_TUTORIAL_HUMAN_ID },
    position: "top-right",
  },
  {
    id: "ch3-recipe",
    kind: "prompt",
    title: "Recipe gates",
    body:
      "The recipe demands **2 rye + 1 Specialty Rye**. One Specialty Rye satisfies BOTH `minRye:1` AND `minSpecialty.rye:1` — you don't need a regular rye on top. Silver award fires at age 4+.",
    spotlight: { kind: "rickhouse-row", ownerId: ADV_TUTORIAL_HUMAN_ID },
    position: "top-right",
    closeInspectOnAdvance: true,
  },

  // ════════════════════════════════════════════════════════════════
  // CHAPTER 4 — Run a Drafting Loop
  // ════════════════════════════════════════════════════════════════
  {
    id: "ch4-intro",
    kind: "prompt",
    title: "Run a Drafting Loop",
    body:
      "Once per round, you can spend a card to **reveal 3 mash bills** from the bourbon deck. You take 0–N (capped by open slots), each costing one more card to your draft pile. The pile then passes left — other players scavenge cards + take bills.",
    spotlight: { kind: "none" },
    chapter: { number: 4, label: "Drafting Loop" },
  },
  {
    id: "ch4-explain",
    kind: "prompt",
    title: "Three-in-one engine",
    body:
      "The Drafting Loop does **three things at once**: ① gets you bills, ② thins your deck (the cards you spend leave permanently), ③ lets you scavenge cards from earlier players' offerings (free, late-seat advantage). Sitting late = scavenging opportunity.",
    spotlight: { kind: "none" },
  },
  {
    id: "ch4-aftermath-prompt",
    kind: "prompt",
    title: "Bills go to slots",
    body:
      "Bills you take land in open slots as **Staged** barrels (no resources committed yet). Leftover bills shuffle back into the bourbon deck. Leftover cards in the pile go to the market discard — permanently thinning the table.",
    spotlight: { kind: "none" },
  },

  // ════════════════════════════════════════════════════════════════
  // CHAPTER 5 — Specialty & Heritage resources
  // ════════════════════════════════════════════════════════════════
  {
    id: "ch5-intro",
    kind: "prompt",
    title: "Specialty & Heritage",
    body:
      "Premium resources come in three tiers: **Common $1, Specialty $2, Heritage $3** — all 1 unit each. They only enter via the market (never starter, never Drafting Loop). Specialty/Heritage are the **only way** to unlock `minSpecialty` recipes.",
    spotlight: { kind: "market-row" },
    chapter: { number: 5, label: "Specialty" },
  },
  {
    id: "ch5-buy-specialty",
    kind: "prompt",
    title: "Buy a Specialty Rye",
    body:
      "The market has a **Specialty Rye** at slot 0 for $2. You'd buy it, commit it to Pepperbox Rare, and watch the `minSpecialty.rye:1` chip flip green. **Aha:** Heritage doesn't gate higher than Specialty — either satisfies the gate.",
    spotlight: { kind: "market-slot", slotIndex: 0 },
  },

  // ════════════════════════════════════════════════════════════════
  // CHAPTER 6 — Demand mechanics
  // ════════════════════════════════════════════════════════════════
  {
    id: "ch6-intro",
    kind: "prompt",
    title: "Demand mechanics",
    body:
      "Demand runs **0–12**, starts at 0. At the top of each turn, you roll **2d6**. If the roll is **strictly greater** than current demand, demand rises by 1 (cap 12). Each sale drops demand by 1 (floor 0).",
    spotlight: { kind: "demand" },
    chapter: { number: 6, label: "Demand" },
  },
  {
    id: "ch6-rolls",
    kind: "transition",
    title: "Demand rolls…",
    subtitle: "2d6 each turn",
    body:
      "Watch how the dice land: rolls of 4, 7, 9 push demand up quickly when it's low; once it's near 8+ it gets harder to keep climbing.",
    fakeRolls: [
      { dice: [2, 2] },
      { dice: [3, 4] },
      { dice: [5, 4] },
    ],
    durationMs: 3000,
  },
  {
    id: "ch6-aftermath",
    kind: "prompt",
    title: "Low vs high demand",
    body:
      "Demand is the column on every grid — selling at demand 2 pays the LEFT column, demand 9 pays the RIGHT. **Aha:** chaining sales tanks the dial — each sale −1 — so time your big bills for when demand peaks.",
    spotlight: { kind: "demand" },
  },

  // ════════════════════════════════════════════════════════════════
  // CHAPTER 7 — Operations cards
  // ════════════════════════════════════════════════════════════════
  {
    id: "ch7-intro",
    kind: "prompt",
    title: "Operations cards",
    body:
      "Ops cards live in a **separate hand**, persist across rounds (NOT discarded at End Turn), and are **not tradeable**. Play them as a free interruption any time during your turn — they don't consume an action.",
    spotlight: { kind: "none" },
    chapter: { number: 7, label: "Ops cards" },
  },
  {
    id: "ch7-final-round",
    kind: "prompt",
    title: "Final-round restriction",
    body:
      "Ops cards you bought BEFORE the final round play normally. **Ops bought during the final round cannot be played that round** — they're locked. Plan ops purchases earlier than you'd expect.",
    spotlight: { kind: "none" },
  },

  // ════════════════════════════════════════════════════════════════
  // CHAPTER 8 — Warehouse (replaces v3.5-removed Save Slot)
  // ════════════════════════════════════════════════════════════════
  {
    id: "ch8-intro",
    kind: "prompt",
    title: "Warehouse",
    body:
      "v3.5 removed the free Save Slot. The replacement is the **Warehouse investment** ($4 from the market): a persistent 1-card slot. Stash any card on your turn, retrieve it as a free action on any future turn.",
    spotlight: { kind: "none" },
    chapter: { number: 8, label: "Warehouse" },
  },
  {
    id: "ch8-aha",
    kind: "prompt",
    title: "Investment, not a freebie",
    body:
      "**Aha:** cross-round persistence now costs 4 Capital up front. It's the timing lever — stash a Cooper, an ops card, or an irreplaceable Heritage Rye, retrieve when the round needs it.",
    spotlight: { kind: "none" },
  },

  // ════════════════════════════════════════════════════════════════
  // CHAPTER 9 — Trade with a player
  // ════════════════════════════════════════════════════════════════
  {
    id: "ch9-intro",
    kind: "prompt",
    title: "Trade with a player",
    body:
      "Two players exchange cards by **mutual consent** — each side offers ≥1 card. **Traded cards land in the recipient's HAND**, not their discard, so they're immediately usable.",
    spotlight: { kind: "none" },
    chapter: { number: 9, label: "Trade" },
  },
  {
    id: "ch9-restrictions",
    kind: "prompt",
    title: "What can't be traded",
    body:
      "**Mash bills are slot-bound** — not tradeable. **Ops cards are private** — not tradeable. **Trading is illegal in the final round**. Use trades for resource matchmaking or specialty handoffs.",
    spotlight: { kind: "none" },
  },

  // ════════════════════════════════════════════════════════════════
  // CHAPTER 10 — Awards
  // ════════════════════════════════════════════════════════════════
  {
    id: "ch10-intro",
    kind: "prompt",
    title: "Silver & Gold awards",
    body:
      "Some bills carry award hooks that fire on sale. **Silver** = bonus rep this sale; bill discards normally. **Gold** = bonus rep + 1 prestige point; bill is **retired** (out of the game).",
    spotlight: { kind: "none" },
    chapter: { number: 10, label: "Awards" },
  },
  {
    id: "ch10-prestige",
    kind: "prompt",
    title: "Prestige stacks",
    body:
      "Prestige adds **+1 rep to every future Silver/Gold sale**, permanent, stacks, no cap. Connoisseur Estate doubles award prestige. **Aha:** Silver/Gold ride on TOP of the grid+floor — they're a parallel reward layer.",
    spotlight: { kind: "reputation" },
  },

  // ════════════════════════════════════════════════════════════════
  // CHAPTER 11 — Place a bottle (brand portfolios)
  // ════════════════════════════════════════════════════════════════
  {
    id: "ch11-intro",
    kind: "prompt",
    title: "Brand portfolios",
    body:
      "Every sale freezes a **Bottle** with recipe tags, cask rarity, age at sale, corn count, and demand at sale. You **must place it** before any other action resumes.",
    spotlight: { kind: "none" },
    chapter: { number: 11, label: "Portfolios" },
  },
  {
    id: "ch11-rules",
    kind: "prompt",
    title: "Placement rules",
    body:
      "**Required slots fill left-to-right**. Optional slots open in any order, but only after their **tier** unlocks (each tier unlocks when its first required slot fills). Eligibility: age ≥, ingredient tags, corn-count category, demand-at-sale. **Bottles are permanent** — place carefully.",
    spotlight: { kind: "none" },
  },
  {
    id: "ch11-signature",
    kind: "prompt",
    title: "Signature Bonus",
    body:
      "When the bottle's source bill matches the slot's **signature bill**, you bank a Signature Bonus (typically +2 end-game value + small immediate utility). Slot on-fill rewards fire immediately but never pay rep mid-game.",
    spotlight: { kind: "none" },
  },

  // ════════════════════════════════════════════════════════════════
  // CHAPTER 12 — Inventory + retrieve
  // ════════════════════════════════════════════════════════════════
  {
    id: "ch12-intro",
    kind: "prompt",
    title: "Inventory + retrieve",
    body:
      "**Inventory is always a legal placement target** — no constraints. Use it when no slot is eligible yet (a tier hasn't unlocked, or no slot matches the bottle's profile). **Inventory scores ZERO at end of game** — don't park bottles there permanently.",
    spotlight: { kind: "none" },
    chapter: { number: 12, label: "Inventory" },
  },
  {
    id: "ch12-retrieve",
    kind: "prompt",
    title: "Retrieve = 1 Generic Labor",
    body:
      "**Spend 1 Generic Labor** to move a bottle from inventory to any now-eligible slot. Free action, unlimited per turn. **Aha:** inventory is the **timing lever** — stash now, retrieve after a tier unlocks or a signature bill finishes.",
    spotlight: { kind: "none" },
  },

  // ════════════════════════════════════════════════════════════════
  // CHAPTER 13 — Draft second portfolio
  // ════════════════════════════════════════════════════════════════
  {
    id: "ch13-intro",
    kind: "prompt",
    title: "Draft a second portfolio",
    body:
      "Setup lays out **N+2 face-up secondary portfolios** beside the play area (N = players). Spend **1 Generic Labor** any time during your action phase to draft one. Once per game per player. Illegal in the final round.",
    spotlight: { kind: "none" },
    chapter: { number: 13, label: "2nd portfolio" },
  },
  {
    id: "ch13-penalty",
    kind: "prompt",
    title: "The real cost",
    body:
      "If you don't reach **Completion** (all required slots filled) on a second portfolio, you take **−2 rep per unfilled required slot, capped at −10**. The flagship NEVER carries this penalty. **Aha:** 1 Labor is the trivial cost — the back-end penalty is the real price.",
    spotlight: { kind: "none" },
  },

  // ════════════════════════════════════════════════════════════════
  // CHAPTER 14 — Endgame & scoring
  // ════════════════════════════════════════════════════════════════
  {
    id: "ch14-intro",
    kind: "prompt",
    title: "The doomsday clock",
    body:
      "Game ends when the **bourbon supply runs out** (last bill leaves). Drafting Loop reveals drain the supply on every claim. Watch the BOURBON counter on the top bar — it's your game-end clock.",
    spotlight: { kind: "supply" },
    chapter: { number: 14, label: "Endgame" },
  },
  {
    id: "ch14-final-restrictions",
    kind: "prompt",
    title: "Final-round restrictions",
    body:
      "Once final round triggers: **no Drafting Loop**, **no Trade**, **no Draft Second Portfolio**, **ops cards bought this round can't be played**. Existing aging barrels still age + sell normally. Gold does NOT trigger the final round — only supply exhaustion does.",
    spotlight: { kind: "none" },
  },
  {
    id: "ch14-scoring",
    kind: "prompt",
    title: "Final score",
    body:
      "Final score = **banked Capital + banked Reputation + portfolio scoring**. Portfolio = filled-slot values + Signature Bonuses + **cumulative tier bonuses**: Completion → Theme → Mastery. Inventory bottles score zero. Tiebreaker: most barrels sold.",
    spotlight: { kind: "reputation" },
  },
  {
    id: "ch14-finale",
    kind: "finale",
    title: "You know the whole game now.",
    body:
      "Distillery picks, starter draft, mash bills, the Drafting Loop, Specialty resources, demand, ops cards, Warehouse, trade, awards, portfolios, second portfolios, endgame. Time to play.",
    bullets: [
      "Distillery profiles are 4-axis package deals.",
      "Drafting Loop is bills + deck thinning + scavenging.",
      "Specialty/Heritage are gates, not stat boosts.",
      "Demand is per-turn — chained sales tank the dial.",
      "Portfolios pay at game end; inventory pays zero.",
    ],
    closeLabel: "Start a real game",
    replayLabel: "Replay advanced tutorial",
  },
];

// ─────────────────────────────────────────────────────────────────
// Chapter progress helper
// ─────────────────────────────────────────────────────────────────

const VISIBLE_KINDS: BeatKind[] = [
  "prompt",
  "await-action",
  "decision",
  "transition",
  "celebrate",
  "finale",
];

export function chapterProgressForAdvanced(beatIndex: number): {
  chapterLabel: string;
  chapterNumber: number;
  position: number;
  total: number;
} | null {
  if (beatIndex < 0 || beatIndex >= TUTORIAL_ADVANCED_BEATS.length) return null;
  let chapterStart = 0;
  let label = "Tutorial";
  let number = 0;
  for (let i = beatIndex; i >= 0; i--) {
    const b = TUTORIAL_ADVANCED_BEATS[i];
    if (b?.kind === "prompt" && b.chapter) {
      chapterStart = i;
      label = b.chapter.label;
      number = b.chapter.number;
      break;
    }
  }
  let chapterEnd = TUTORIAL_ADVANCED_BEATS.length;
  for (let i = chapterStart + 1; i < TUTORIAL_ADVANCED_BEATS.length; i++) {
    const b = TUTORIAL_ADVANCED_BEATS[i];
    if (b?.kind === "prompt" && b.chapter) {
      chapterEnd = i;
      break;
    }
  }
  let total = 0;
  let position = 0;
  for (let i = chapterStart; i < chapterEnd; i++) {
    const b = TUTORIAL_ADVANCED_BEATS[i];
    if (!b) continue;
    if (!VISIBLE_KINDS.includes(b.kind)) continue;
    total += 1;
    if (i <= beatIndex) position += 1;
  }
  return { chapterLabel: label, chapterNumber: number, position, total };
}

// Mark unused-but-imported helpers OK for downstream extension.
void buildAdvTutorialAwardBill;
void ADV_TUTORIAL_BOT1_ID;
void ADV_TUTORIAL_BOT2_ID;
void ADV_TUTORIAL_BOT3_ID;
void findDistilleryByDefId;
