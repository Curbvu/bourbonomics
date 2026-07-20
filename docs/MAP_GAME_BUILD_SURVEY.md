# Map Game — Build Survey (implemented)

**Status:** ✅ Built at **v3**. Engine + UI at `apps/prototype/src/mapgame/`. **118 tests pass**; games run to age 5 for 2–5 players, deterministic; the browser plays every stage with no scrollbars on the fixed 16:9 canvas. This doc keeps the v2 design record below; the v3 delta + decisions are at the top.

## v3 (current) — the "Push" rebuild

The pasted **v3 brief** superseded the earlier design. Adapted in place (kept hex/rng/ids/fit-core/control/adjacency/setup/market/UI shell; rewrote the rest). Confirmed decisions: **adapt in place**; ownership slots only on LOYALTY+KEYSTONE (WILDCARD) tiles; an **empty** ownership slot is claimed by placing a DP (`CLAIM_SLOT`, no Push) while an owned slot flips only by Push; catch-up = PLAYERS+1 swap; first niche flag anywhere then chain-adjacent; retreating defender = strength 0.

Key v3 changes from v2:
- **PROOF tag removed** — 5 slots (Grain·Batch·Bonded·Age·Premium).
- **Scoring is niche-only, 3 stacking tiers** (`ageLoop.scoreNiches`): tier1 +1/controlled claim; tier2 majority→rewards on controlled reward tiles; tier3 monopoly→all niche rewards. **No per-tile income.** Non-niche tiles score 0.
- **Bourbon FRESH/DEPLETED** replaces garrison/burn: committing depletes (win/lose/tie), persists across ages; **Refresh** (Distill) un-depletes one. `push.ts`.
- **The Push** (`push.ts`): tie does **nothing**; margin removes DPs **1:1 outright** (one step); ownership capture clears the owner's DPs slot-last then seats the winner.
- **Ownership slots** (`tileOwner`) — owner ≠ controller.
- **45-card deck with copies**, `pips` + `icon`. **Initiative marker**: last icon card played leads next round, sticky if none (`updateMarker`). Distill = Bid + Refresh.
- **Chaining**: `COMMIT_PLAY {faceUpIds, sacrificeIds, surrender}` — one primary + N chained (each paid by a face-down sacrifice), or a surrender. A **cardless player auto-passes** commit (`autoPassCardless`) — needed because chaining can empty a hand before round 5.
- **Niche flags must chain adjacent** to your own flags (`canAddFlag`).
- **2–5 players.**

Open (v3 §19, deferred): bot quality is low — v0 bots build/bid but don't form niches, push, or claim slots, so with placeholder numbers scores stay flat; smarter bots + balancing are the next pass. All numbers `[PH]`.

**Authority:** the v3 brief supersedes `MAP_GAME_SPEC.md` and the (deleted) `MAP_GAME_ACTION_CARDS.md`. The section below documents the earlier v2 build for history.

---

## v2 (superseded) — design record

## Resolved decisions (from the build session)

- **v0 rewritten in place**, keeping `hex.ts` / `rng.ts` / `ids.ts` (reworked to thread through state) / `tileController` / `tilesContiguous`. Old design recoverable at commit `c878a46`.
- **`MAP_GAME_ACTION_CARDS.md` deleted** → 30 single-copy deck; Marketing breadth-3 with Expand Market; **higher rank leads** next round.
- **Contest:** LIVE DPs gate *how many* bourbons you may commit; DPs never add strength. Strength = fit sum (+ defense bonus for the tile's owner). **Retreat = commit no bourbon = strength 0.** A controlling defender may commit into a tie to hold the tile (tie → all burn, controller keeps).
- **Rewards flow only through niche harvest**, plus +1 Capital per controlled tile at age end. Capital is score-only (never spent).
- **Niche rewards recur** — a held niche harvests every age end. Tokens fund extra actions in the planning phase.
- **Loyalty claim:** DP majority claims an unowned Loyalty/Keystone tile (declaring the wildcard); thereafter ownership flips only by winning a Contest.
- **Deviation to note:** token-funded actions are spent in the planning phase but the engine also lets leftover token pips carry into the resolve turn (survey Q13). Tokens are public, so this is telegraphed either way.
- **Trade & catch-up** are now interactive age-start stages (`trade` → `catchup` → `planning`), driven by `TRADE_OFFER` / `CATCHUP_SWAP` actions and playable in the UI each age. Bots offer nothing / pass in v0. Runs at every age boundary including age 1.

---

## 1. Finding: what already exists

`apps/prototype/src/mapgame/` holds ~2,200 lines of committed, playable v0 (commit `c878a46`, then `2352225`). **It implements a different design**, not an earlier draft of this one. The brief says "discard any prior code" — that is close to right, but worth stating precisely before we do it.

| System | v0 today | Brief | Verdict |
|---|---|---|---|
| Demand language | 5 tastes + an `averse` trait; fit = 0/1/2/3 step function | Tag bags (grain/batch/quality/thresholds), doubles, meet-or-exceed, fit = pure addition | **Rewrite** |
| Bourbon economy | Agents, grab/court, cellar capacity, maturity slots, base price + position premium | Shared face-up market, bid with DP-markers, most-markers-wins, ties discard | **Delete + rewrite** |
| Action cards | `{ id, bips }` — no suits, synthetic per-player hand | 30 single-copy suited cards, rank + pips, shared deck, the Trade, catch-up | **Rewrite** |
| Combat | `Push` (attack/purge), 1v1, defender-commits | `Contest` — tile-targeted, multi-party, free, damage ladder, garrison/burn | **Rewrite** |
| Niches | Declared over *controlled* tiles | Aspirational flags, overlap allowed, untouchable, harvest by control/monopoly | **Rewrite** |
| Capital | Score **and** attack currency | Score only (contesting is free) | **Rewrite** |
| Special tiles | None | Loyalty / Keystone / Blocking | **New** |
| Setup | Seeded starting DPs on spread tiles | 3-tile line seed, snake tile placement, snake draft, 4 picks each | **Rewrite** |

**Genuinely reusable (~110 lines + patterns):**
- `hex.ts` — axial math, neighbors, distance, spiral, pixel layout, SVG polygon points. Design-independent, keep as-is.
- `rng.ts`, `ids.ts` — seeded RNG and id minting. Keep.
- `derive.ts::tileController` — already computes "strictly most active DPs, ties → nobody," which is exactly the brief's control rule. Keep the function, drop the file's fit logic.
- `derive.ts::tilesContiguous` — needed verbatim for niche contiguity.
- `MapGameClient.tsx` — the board rendering, `ScalingHost` integration, and route wiring are worth mining even though the panels change.
- The `applyAction(state, action) → { ok, state } | { ok: false, reason }` shape. Keep.

**Recommendation:** rewrite in place at `apps/prototype/src/mapgame/`, preserving the four modules above. v0 is committed, so it stays recoverable from git — replacing it is reversible and I don't need to keep a parallel copy. **Confirm before I overwrite.**

---

## 2. Data-model sketch

```ts
// ── Tags ─────────────────────────────────────────────────────────────
type Grain     = "RYE" | "WHEAT" | "TRADITIONAL";
type Batch     = "SINGLE_BARREL" | "SMALL_BATCH";
type Quality   = "BONDED" | "PREMIUM";
type Threshold = { kind: "AGE" | "PROOF"; value: number };
type Tag = { kind: "GRAIN"; v: Grain }
         | { kind: "BATCH"; v: Batch }
         | { kind: "QUALITY"; v: Quality }
         | Threshold & { kind: "AGE" | "PROOF" };
// Tags are a multiset (doubles legal). Canonical order for render/compare:
// grain → batch → quality → age → proof.

// ── Board ────────────────────────────────────────────────────────────
type TileCategory =
  | "PURE_PREFERENCE" | "OFF_PREMISE" | "ON_PREMISE" | "EXPERIENTIAL"
  | "EXPORT" | "LOYALTY" | "KEYSTONE" | "BLOCKING";

type Reward =
  | { kind: "CAPITAL"; amount: number }
  | { kind: "TOKEN"; suit: Suit | "ANY" };

interface Tile {
  id: string;
  hex: Hex;
  category: TileCategory;
  tags: Tag[];                 // multiset; [] for BLOCKING
  reward: Reward | null;
  // special-tile state
  wildcardTag: Tag | null;     // LOYALTY/KEYSTONE — declared by owner on claim
  defenseBonus: number;        // 0 for ordinary tiles
  ownerOverride: string | null;// LOYALTY/KEYSTONE — ownership is contest-gated,
                               // not DP-majority. null = unclaimed.
  uncontestedSince: number|null;// "Word of Mouth" → loyalty conversion tracking
}

interface DP { id: string; owner: string; tileId: string; state: "LIVE" | "DARK"; }

interface NicheFlag { id: string; owner: string; tileId: string; }
// A niche is DERIVED: the connected components of one player's flags.
// Only components of >= NICHE_MIN_TILES (5) harvest. Flags on their own are legal.

// ── Bourbon ──────────────────────────────────────────────────────────
interface BourbonDef { defId: string; name: string; tags: Tag[]; }
interface Bourbon {
  id: string; defId: string; name: string; tags: Tag[];
  owner: string;
  garrisonedTileId: string | null; // locked to a tile until age end
  burned: boolean;                 // removed for the age
}

// ── Market ───────────────────────────────────────────────────────────
interface MarketLot {
  def: BourbonDef;
  bids: Record<string /*playerId*/, number>; // DP-markers committed
}

// ── Action cards ─────────────────────────────────────────────────────
type Suit = "DISTRIBUTION" | "SALES" | "MARKETING" | "BUSINESS_DEV" | "SOURCING" | "DISTILL";
type ActionType =
  | "BUILD_DP" | "REPAIR_DP" | "CONTEST"
  | "ADD_NICHE_FLAG" | "REMOVE_NICHE_FLAG"
  | "EXPAND_MARKET" | "BID";

interface ActionCard { id: string; name: string; suit: Suit; rank: number; pips: number; }
const SUIT_ACTIONS: Record<Suit, ActionType[]> = { /* per brief §5 */ };

// ── Player ───────────────────────────────────────────────────────────
interface Player {
  id: string; name: string; isBot: boolean; colorIdx: number;
  capital: number;                       // score only
  dpSupply: number;                      // one pool: map DPs AND bid markers
  tokens: Record<Suit, number>;          // public, uncapped
  hand: ActionCard[];
  bourbons: Bourbon[];
  heldTile: Tile | null;                 // max 1
  // per-round
  committedCard: ActionCard | null;
  playedFaceDown: boolean;
  pipsRemaining: number;
}

// ── Game ─────────────────────────────────────────────────────────────
interface GameState {
  phase: "setup" | "playing" | "ended";
  age: number; round: number;
  stage: "planning" | "commit" | "resolve" | "ageEnd";
  players: Player[];
  tiles: Tile[]; dps: DP[]; nicheFlags: NicheFlag[];
  tileSupply: Tile[];
  market: MarketLot[];
  actionDeck: ActionCard[]; actionDiscard: ActionCard[];
  catchUpBoard: ActionCard[];
  bourbonDeck: BourbonDef[];
  initiative: number[];        // player indices for THIS round
  nextInitiative: number[];    // built from this round's ranks
  turnPos: number;
  rngSeed: number;
  log: LogEntry[];
}
```

**Notable modelling calls (flagging, not assuming):**
- **Niche as derived, not stored.** The brief says flags are placed one tile at a time and a niche is "5+ contiguous flagged tiles." Storing `Niche` entities forces awkward questions (what happens to the entity at 4 flags?). Deriving connected components from flags makes "aspirational," "overlap allowed," and "multiple niches per player" fall out for free. **Confirm.**
- **One `dpSupply` pool** for map DPs and bid markers, per brief §11's "one pool, two uses."
- **`tokens` keyed by suit**, not a scalar (v0 had a scalar).

---

## 3. Proposed module structure

```
apps/prototype/src/mapgame/
  engine/
    config.ts        # ALL [PH] numbers — single tuning surface
    types.ts         # the model above
    hex.ts           # KEPT from v0
    rng.ts           # KEPT from v0
    ids.ts           # KEPT from v0
    tags.ts          # tag ctors, canonical ordering, render strings, colors
    fit.ts           # fit(bourbon, tile) — slot-matching, doubles, meet-or-exceed
    derive.ts        # control, adjacency, contiguity, niches, monopoly, legal moves
    content/
      tiles.ts       # ~41 tile defs (37 demand + 4 blocking)
      bourbons.ts    # ~20 bourbon defs
      actionDeck.ts  # 30 single-copy cards
    setup.ts         # seed line, snake tile placement, market, snake draft
    actions/
      build.ts       # Build DP / Repair DP
      expand.ts      # Expand Market (draw / place)
      niche.ts       # Add / Remove niche flag
      market.ts      # Bid / move bid
      contest.ts     # Contest resolution — strength, damage ladder, garrison/burn
    ageLoop.ts       # deal, Trade, catch-up, round loop, age-end, income, harvest
    engine.ts        # applyAction dispatch + turn/stage machine
    bot.ts           # deterministic bot
    index.ts
  ui/                # rebuilt; mines v0's board renderer + ScalingHost wiring
```

Each `actions/*` module lands with its own test file; nothing stacks until the layer below is green.

---

## 4. Rules restated as testable behaviors

Ordered by the brief's build order. Each line is one test.

### Fit (§3)
1. Bourbon `[RYE]` vs tile `[RYE]` → 1.
2. Bourbon `[RYE,RYE]` vs tile `[RYE,RYE]` → 2.
3. Bourbon `[RYE,RYE]` vs tile `[RYE]` → 1 (tile presents one slot).
4. Bourbon `[RYE]` vs tile `[RYE,RYE]` → 1 (bourbon supplies one).
5. Bourbon `AGE 20` vs tile `AGE 8` → 1 (meet-or-exceed).
6. Bourbon `AGE 20` vs tile `AGE 23` → 0.
7. Bourbon `AGE 8` vs tile `AGE 8` → 1 (boundary, meets).
8. Fit is additive across slot kinds: `[RYE, BONDED, AGE 10]` vs `[RYE, BONDED, AGE 8]` → 3.
9. Tags the tile doesn't present contribute 0 (no penalty, no bonus).
10. Fit never multiplies; no averse/negative term exists.
11. Fit against a BLOCKING tile is undefined/unreachable (no DPs, never contested).

### Board, DP, control (§6)
12. Build DP on a tile you control → arrives LIVE.
13. Build DP on an uncontrolled tile → arrives LIVE.
14. Build DP on a rival-controlled tile → arrives DARK.
15. Repair DP flips one of your DARK DPs → LIVE.
16. Control = strictly more LIVE DPs than any single rival.
17. Two players tied at the most LIVE DPs → nobody controls.
18. DARK DPs count for nothing: control, monopoly, contest commitment.
19. Post-setup placement must be adjacent to a tile you control, or onto an uncontrolled tile.
20. Placement anchored only on your DPs inside a rival-controlled tile is **rejected** (no growing through a rival).
21. A tile holds unlimited DPs (no shelf cap).
22. BLOCKING tiles reject every DP placement.
23. BLOCKING tiles break adjacency chains (not a valid anchor, not a valid neighbor for growth).

### Expand Market (§6b)
24. Expand Market draws a tile into hand → 1 pip.
25. Expand Market places the held tile → 1 pip.
26. Drawing while already holding a tile → rejected (cap 1).
27. Held tile persists across rounds and ages.
28. Placement must touch ≥2 existing tiles → otherwise rejected.
29. Full frontier occupation costs exactly 3 pips (draw + place + build).

### Action cards & turn loop (§4, §5)
30. Deck is exactly 30 cards, all single-copy.
31. Each suit permits exactly its brief §5 action set; an off-suit action is rejected.
32. A card grants `pips` actions, mixable freely within the suit.
33. Face-down play = 1 action of ANY type, contributes no rank.
34. Rank sets the **next** round's initiative (direction — see Q2).
35. Age start deals 5 cards each.
36. The Trade: up to 2 cards in, shuffle, draw back the same count.
37. Catch-up: N cards to a shared board; least-Capital player swaps first.
38. Tokens spend in Planning for +1 action of that suit.
39. An age runs up to 5 rounds.

### Contest (§10)
40. Contest costs 1 Sales action and **0 Capital**.
41. Committed bourbons ≤ your LIVE-DP count on that tile.
42. Strength = summed fit of committed bourbons (+ defense bonus on Loyalty/Keystone).
43. Highest strength wins the tile.
44. Damage is computed **per loser**, from that loser's own margin.
45. 1 margin → one LIVE DP goes DARK.
46. 2 margin → one LIVE DP fully removed (dark, then remove).
47. 1 margin against an existing DARK DP → removed.
48. Overkill is wasted (damage caps at what the loser has).
49. Winner's committed bourbons garrison the tile until age end.
50. Garrisoned bourbons defend that tile if re-contested and are unusable elsewhere.
51. Loser's committed bourbons burn.
52. Retreating (committing nothing) keeps your bourbons.
53. Tie at the top → all committed bourbons from all players burn.
54. On a tie, the current controller keeps the tile.
55. Garrison releases at age end.

### Niches (§8)
56. A flag may be placed on a tile with zero DPs (aspirational).
57. No player may add or remove another player's flag.
58. A tile may carry flags from multiple players (overlap).
59. A flagged group harvests only at ≥5 contiguous tiles.
60. Non-contiguous flag groups are separate niches.
61. One player may hold multiple qualifying niches.
62. Harvest, majority control → take 1 reward from within the niche.
63. Harvest, monopoly (zero rival LIVE DPs anywhere in it) → take ALL rewards.
64. One rival LIVE DP anywhere in the niche drops monopoly → control.
65. Rival DARK DPs do **not** block monopoly.

### Market (§11)
66. Age start lays out PLAYERS+1 face-up lots.
67. Bid = 1 action, places one DP-marker from your supply.
68. Moving a bid = 1 action.
69. Age end: most markers wins the lot.
70. Tie on markers → nobody wins, bourbon discarded.
71. Markers always return to their owner.
72. Won bourbons are usable immediately.
73. A marker on a lot is a DP not available for the map.

### Tokens (§7)
74. Tokens are won from tile rewards.
75. Spending 1 token in Planning yields +1 action of that suit, taken immediately.
76. Tokens never contribute to score.
77. All players can read all token holdings.
78. No storage cap, no usage cap (config hook present but inert).

### Special tiles (§12)
79. Loyalty tile ownership does not follow DP majority.
80. Loyalty ownership flips only by winning a Contest against owner's bourbons + defense bonus.
81. Loyalty owner declares the wildcard tag on claim.
82. Keystone (State Capital) pays 1 ANY token each age to its owner.
83. "Word of Mouth" converts to loyalty if held uncontested a full age.

### Setup (§13)
84. Seed is 3 tiles in a line at center.
85. Each player gets 5 setup tiles; snake placement, each touching ≥2 existing tiles.
86. Market is PLAYERS+1, refreshed as drafted during the opening draft.
87. Opening draft is snake order, 4 turns each, each turn = draft a bourbon OR place 1 LIVE DP.
88. Opening DP placement ignores the control-adjacency rule.
89. First player = whoever drafted last in the first snake round.

### Age end & scoring (§4, §15)
90. Age end order: market resolves → harvest → income.
91. Income = +1 Capital per controlled tile.
92. Action cards discard and the deck reshuffles at age end.
93. Game ends after age 5; most Capital wins.
94. Tiebreak = most tiles controlled.
95. Every number above reads from `config.ts` — no inline literals.

---

## 5. Ambiguities

### 5a. Blocking — I need answers before these systems can be built

**Q1 — Deck size: 30 or 45?**
Brief §5/§14 say **30 single-copy**. Your `MAP_GAME_ACTION_CARDS.md` (untracked, newer than the spec) specifies **45 with 2-copies of most cards**, and its per-suit counts (10/7/7/7/7/7) sum to 45. These can't both hold. Single-copy also changes the Trade and catch-up math — with 30 cards and 4 players, 20 are dealt and the catch-up board takes N more, leaving little deck.

**Q2 — Rank direction.**
Brief §2.5: "lower rank number = leads earlier — CONFIRM." Brief §18 lists it open. Your action-cards doc says the opposite: "**Higher** rank leads next round," and its curve is built that way (Sales high-rank = strike now, lead next; BizDev low-rank = reshape, cede). The doc's design rationale is coherent, so I lean **higher rank leads** — but the brief flags it, so I won't guess.

**Q3 — Marketing's breadth, and Expand Market's homes.**
Brief §5 table: Marketing = breadth **3** (Add flag · Remove flag · Expand Market), giving Expand Market two homes (BizDev + Marketing), reasserted in the §5 lookup and the scarcity note. Your action-cards doc: Marketing = breadth **2** (Add · Remove), and Place tile is **BizDev-only, "rare."** Conflict. Note the brief's own §14 hint ("Marketing breadth-3 top card ~3 pips") disagrees with the doc's Brand Campaign at 4 pips.

**Q4 — Retreat strength vs committed strength.** *(design hole, not just a naming gap)*
§10 says a retreating defender's strength = their LIVE-DP count, but a defender who **commits** bourbons has strength = fit sum **only** — DP count isn't added. So a defender with 3 LIVE DPs and one fit-2 bourbon is **stronger retreating (3) than fighting (2)** — and retreating also keeps the bourbon. That inverts the intent. Options: (a) committed strength = fit sum **+** LIVE-DP count; (b) retreat strength = something lower (e.g. `floor(DP/2)`, or 0); (c) retreat strength = LIVE-DP count and committed = `max(fit sum, DP count)`. I'd propose **(a)** — it makes position a modifier on top of fit, exactly as §10's design intent states — but this is your call.

**Q5 — Do reward tiles pay outside of niches?**
§4's age-end income is only "+1 Capital per tile you control." §8's harvest is the only other reward path. Read literally, **a reward tile you control but haven't flagged into a 5-tile niche pays nothing, ever** — which makes ~43% of the reward density inert for most of the board and makes niches the only economy. Intended, or should controlled reward tiles pay at age end?

**Q6 — Are niche rewards consumed or recurring?**
Harvest "take 1 reward from within the niche" — once taken, is that tile's reward spent for the game, or does it pay again every age? Large scoring-curve consequence.

**Q7 — Contest with zero DPs on the tile.**
"Commit up to your LIVE-DP count" implies an attacker with 0 LIVE DPs commits 0 bourbons for strength 0. Is Contest legal only with ≥1 LIVE DP on the target tile? (Assuming yes.)

**Q8 — How is a Loyalty tile first claimed?**
§12 says ownership flips **only** by winning a Contest against the owner's bourbons + defense bonus — but an unclaimed loyalty tile has no owner and no bourbons to contest. Does the first Contest against an empty loyalty tile auto-claim it? Does DP majority claim it while unowned, and only then lock to contest-flips?

### 5b. Non-blocking — I'll implement my stated assumption unless you object

**Q9 — Damage ladder ordering.** Determinism requires a fixed rule for *which* DP darkens/dies. Assumption: the **attacker chooses**, with a canonical default (oldest-first) for bots and replay.

**Q10 — Market refresh cadence.** §4 refreshes at age start; lots resolve at age end. Assumption: **the market is static during an age** — no mid-age refill.

**Q11 — Round-1 initiative.** Rank sets the *next* round, so an age's round 1 has no prior rank. Assumption: **age 1 round 1** uses the §13 first player; **later ages' round 1** carries the final round's rank order from the prior age.

**Q12 — All-sacrifice rounds.** If every player plays face-down, no ranks exist. Assumption: initiative order **carries over unchanged**.

**Q13 — Planning-phase resolution order.** Token actions are "taken now," before the commit/reveal. Assumption: resolved in **current initiative order**, and this is intentionally pre-reveal information.

**Q14 — Adding a flag to a disconnected tile.** Assumption: **legal** — flags are aspirational, contiguity is only tested at harvest.

**Q15 — Capital never gets spent.** §2.1 says capital is "also spent (see costs)," but contesting is free and no other cost exists in the brief. Assumption: **capital is score-only**, `[PH]5` is just a starting score, and §2.1's clause is vestigial.

**Q16 — Naming.** Adopting the brief's vocabulary throughout: **Contest** (not Campaign/Push), **Bid** (not Distill-the-verb), **Expand Market** (not Place tile), **pips** (not bips), **LIVE/DARK** (not active/inactive). The v0 code and `MAP_GAME_SPEC.md` use the older names; both get updated.

**Q17 — Blocking density at 2p.** Brief §18 flags this. Assumption: ship 4 blocking tiles at all counts, expose as config, tune in playtest.

**Q18 — Catch-up N and swap-vs-take.** Brief §9 defaults to swap with N = PLAYERS or PLAYERS+1. Assumption: **swap**, N = PLAYERS+1, both config.
