# Bourbonomics 2.0 — Claude Code Implementation Guide

This document is a structured prompt for Claude Code to implement Bourbonomics 2.0 as a digital game. It assumes a clean repository and provides the architecture, data models, mechanics, and implementation order.

---

## Project Overview

Build a digital implementation of **Bourbonomics 2.0**, a deckbuilding strategy game about running a bourbon distillery. The game combines hand management, deckbuilding, market timing, and inventory aging mechanics. Refer to [`GAME_RULES.md`](GAME_RULES.md) for the complete ruleset.

The implementation should support **2-4 players**, either local hot-seat or networked play (start with local). Target platform: **web (TypeScript + React + Node.js backend)** unless otherwise specified.

---

## Tech Stack Recommendations

- **Frontend:** React + TypeScript + Tailwind CSS
- **Backend:** Node.js + Express + WebSocket (for multiplayer state sync)
- **State management:** Zustand or Redux Toolkit (game state is complex and benefits from a single source of truth)
- **Game engine logic:** Pure TypeScript modules, framework-agnostic, fully unit-testable
- **Persistence:** SQLite for local development, Postgres for production
- **Testing:** Vitest for unit tests, Playwright for end-to-end gameplay tests

---

## Architectural Principles

1. **Separate game logic from UI.** The core game engine must be a pure TypeScript module with no UI dependencies. UI subscribes to state changes via a clean interface.

2. **Game state is immutable.** Every action produces a new state object. This enables undo, replay, and easier debugging.

3. **Actions are typed events.** All player and system actions are typed objects passed through a single reducer. This makes the action history serializable and replayable.

4. **Validation is explicit.** Every action has a validator function that checks legality before mutation. Never trust client input — validate on the server.

5. **Randomness is seedable.** Dice rolls, deck shuffles, and market draws all draw from a single seeded RNG. This enables deterministic replay of games for debugging and testing.

---

## Core Data Models

### Card

```typescript
type CardType = "resource" | "capital" | "mashbill" | "investment" | "operations";
type ResourceSubtype = "cask" | "corn" | "rye" | "barley" | "wheat";

interface Card {
  id: string;                    // Unique instance ID
  cardDefId: string;             // References the card definition
  type: CardType;
  subtype?: ResourceSubtype;
  premium?: boolean;             // True for cards like 2-rye
  resourceCount?: number;        // 1 for plain, 2 for 2-rye, etc.
  capitalValue?: number;         // For capital cards
}

interface MashBill {
  id: string;
  name: string;
  ageBands: [number, number, number];
  demandBands: [number, number, number];
  rewardGrid: number[][];        // 3x3 grid; null = blank cell (0 reward)
  recipe?: {
    minCorn?: number;
    minRye?: number;
    minBarley?: number;
    minWheat?: number;
    maxRye?: number;             // 0 means forbidden
    maxWheat?: number;
    minTotalGrain?: number;
  };
  silverAward?: AwardCondition;
  goldAward?: AwardCondition;
}

interface Investment {
  id: string;
  name: string;
  capitalCost: number;
  effect: InvestmentEffect;      // Discriminated union
}

interface OperationsCard {
  id: string;
  name: string;
  effect: OperationsEffect;      // Discriminated union
}
```

### Game State

```typescript
interface GameState {
  seed: number;                  // RNG seed for reproducibility
  round: number;
  phase: "setup" | "demand" | "draw" | "action" | "cleanup" | "ended";
  currentPlayerIndex: number;
  players: PlayerState[];
  rickhouses: Rickhouse[];
  marketConveyor: Card[];        // Always 6 cards
  marketSupplyDeck: Card[];      // Cards waiting to enter conveyor
  bourbonDeck: MashBill[];
  investmentDeck: Investment[];
  operationsDeck: OperationsCard[];
  bourbonDiscard: MashBill[];    // Currently unused; mash bills in barrels go here on sale
  demand: number;                // 0-12
  finalRoundTriggered: boolean;
  actionHistory: GameAction[];   // For replay/undo
}

interface PlayerState {
  id: string;
  name: string;
  hand: Card[];
  deck: Card[];
  discard: Card[];
  trashed: Card[];               // Cards removed from game (for endgame display)
  mashBills: MashBill[];         // In hand, not yet committed
  unlockedGoldBourbons: MashBill[];
  activeInvestments: Investment[];
  heldOperations: OperationsCard[];
  reputation: number;
  handSize: number;              // Default 8, modified by investments
  barrels: Barrel[];             // Owned barrels currently aging or ready
}

interface Barrel {
  id: string;
  ownerId: string;
  rickhouseId: string;
  attachedMashBill: MashBill;
  productionCards: Card[];       // Cards used in production (for recipe verification only; already in discard)
  agingCards: Card[];            // Face-down cards committed to aging
  age: number;                   // Equals agingCards.length
  productionRound: number;
}

interface Rickhouse {
  id: string;
  name: string;
  capacity: number;
  barrels: Barrel[];             // References to barrels currently here
}
```

### Actions (Discriminated Union)

```typescript
type GameAction =
  | { type: "ROLL_DEMAND"; roll: [number, number] }
  | { type: "DRAW_HAND"; playerId: string }
  | { type: "MAKE_BOURBON"; playerId: string; cardIds: string[]; mashBillId: string; rickhouseId: string; trashCardId?: string }
  | { type: "AGE_BOURBON"; playerId: string; barrelId: string; cardId: string }
  | { type: "SELL_BOURBON"; playerId: string; barrelId: string; reputationSplit: number; cardDrawSplit: number; goldBourbonId?: string }
  | { type: "BUY_FROM_MARKET"; playerId: string; marketSlotIndex: number; spendCardIds: string[] }
  | { type: "IMPLEMENT_INVESTMENT"; playerId: string; investmentId: string; capitalCardIds: string[] }
  | { type: "PLAY_OPERATIONS"; playerId: string; operationsCardId: string; targetData?: any }
  | { type: "DRAW_MASH_BILL"; playerId: string; spendCardId: string }
  | { type: "DRAW_INVESTMENT"; playerId: string; spendCardId: string }
  | { type: "DRAW_OPERATIONS"; playerId: string; spendCardId: string }
  | { type: "TRADE"; player1Id: string; player2Id: string; player1Cards: string[]; player2Cards: string[]; player1ActionCardId: string; player2ActionCardId: string }
  | { type: "CONVERT_3_TO_1"; playerId: string; spendCardIds: string[]; resourceType: ResourceSubtype }
  | { type: "END_TURN"; playerId: string }
  | { type: "TRIGGER_FINAL_ROUND" };
```

---

## Game Engine API

The engine exposes a clean reducer interface:

```typescript
interface GameEngine {
  initializeGame(config: GameConfig): GameState;
  validateAction(state: GameState, action: GameAction): ValidationResult;
  applyAction(state: GameState, action: GameAction): GameState;
  getLegalActions(state: GameState, playerId: string): GameAction[];
  isGameOver(state: GameState): boolean;
  computeFinalScores(state: GameState): ScoreResult[];
}

interface ValidationResult {
  legal: boolean;
  reason?: string;
}
```

Every game mutation flows through `applyAction`. The UI never modifies state directly.

---

## Implementation Order

Build the game in vertical slices. Each phase produces a working, testable subset.

### Phase 1: Core Engine Skeleton (Days 1-2)

- Set up TypeScript project, testing framework, linter.
- Define all types and interfaces in `engine/types.ts`.
- Implement seeded RNG utility (`engine/rng.ts`).
- Implement deck shuffling and drawing (`engine/deck.ts`).
- Write `initializeGame()` to set up a game with 2 dummy players, default starter decks (14 plain cards each), 6 default mash bills in the deck, an empty market.
- Write tests confirming initial state shape.

### Phase 2: Demand and Draw Phases (Day 3)

- Implement `ROLL_DEMAND` action with 2d6 logic.
- Implement `DRAW_HAND` action with deck-empty reshuffle.
- Test demand rises only when roll > current demand.
- Test demand caps at 12.

### Phase 3: Production and Aging (Days 4-5)

- Implement `MAKE_BOURBON` validator: checks for cask + corn + grain, mash bill in hand, rickhouse capacity, recipe satisfaction.
- Implement `MAKE_BOURBON` mutation: creates barrel, attaches mash bill, places in rickhouse, moves cards to discard.
- Implement `AGE_BOURBON` validator: checks player owns barrel, hasn't aged this round, has card in hand.
- Implement `AGE_BOURBON` mutation: face-down card on barrel, increments age.
- Tests: production fails without resources, production fails without mash bill, recipe-locked bills enforce requirements, aging caps at one per barrel per round.

### Phase 4: Selling and Reputation (Days 6-7)

- Implement mash bill grid lookup (`computeReward(mashBill, age, demand) → number`).
- Implement `SELL_BOURBON` validator: barrel age ≥ 2, split sums to total reward.
- Implement `SELL_BOURBON` mutation: applies reputation, draws cards mid-action, returns aging cards to discard, decrements demand, discards mash bill (or unlocks gold).
- Implement Silver and Gold award triggers.
- Test: reward grid lookup works for all band combinations including blanks; reputation/card splits sum correctly; demand decreases correctly; awards trigger on qualification.

### Phase 5: Market and Buying (Days 8-9)

- Implement Market Conveyor: 6 face-up cards, refilled from supply on purchase.
- Implement `BUY_FROM_MARKET` validator: cost is met by spend cards (capital where required).
- Implement `BUY_FROM_MARKET` mutation: spend cards + purchased card both go to discard; conveyor refills.
- Test: capital-required cards reject non-capital spends; conveyor refills correctly; supply deck reshuffles on exhaustion.

### Phase 6: Investments and Operations (Days 10-11)

- Define a few seed investments (hand-size +1, carry-over 1 card between rounds, free trash once per round, draw +1 mash bill per round).
- Define a few seed Operations cards (demand +2, trash an opponent's discard, etc.).
- Implement `IMPLEMENT_INVESTMENT`: validate 3-investment cap, pay capital cost, attach investment to player, hook investment effect into engine triggers.
- Implement `PLAY_OPERATIONS`: resolve effect, discard card.
- Test: hand-size investment changes draw count; carry-over investment persists hand cards; trash investment provides free trashing.

### Phase 7: Trading, Conversion, and Trashing (Day 12)

- Implement `TRADE`: validate both sides give cards, both spend action cards; traded cards go to recipient's discard.
- Implement `CONVERT_3_TO_1`: validates 3 cards spent, produces 1 basic resource for a single subsequent production action. Consider implementing this as a *flag* on the next MAKE_BOURBON rather than a standalone action, so the engine can verify the conversion happens within the same turn.
- Implement trashing: production-based trashing as a flag on `MAKE_BOURBON`, investment-based trashing as triggered effects.
- Test: traded cards appear in correct discard piles; conversion produces only basic resources; trashed cards leave the game permanently.

### Phase 8: Setup and Drafting (Day 13)

- Implement mash bill draft (snake order, players pick 3 each from a shared pool of, say, 12-15 mash bills).
- Implement starter deck draft (each player chooses 14 plain cards from the communal pool: cask, corn, rye, barley, wheat, capital).
- Set initial demand to 6, draw initial 8-card hands, set round to 1.
- Test: drafted mash bills appear in player hands; drafted decks shuffle correctly; first hands draw 8 cards.

### Phase 9: Endgame and Scoring (Day 14)

- Implement final-round trigger when bourbon deck exhausts via `DRAW_MASH_BILL`.
- Implement endgame scoring: reputation is the primary metric; tiebreakers are deck size (lean wins), barrels sold, then shared.
- Skip Demand and Draw phases in the final round? No — the final round still uses normal phases; it's just the *last* round.
- Test: drawing the final mash bill sets `finalRoundTriggered`; game ends after that round's cleanup; tiebreakers resolve correctly.

### Phase 10: UI Layer (Days 15-21)

Build the React UI in vertical slices, one phase at a time:

- **Game board view:** rickhouses, market conveyor, demand track, current player indicator.
- **Player tableau:** hand (face-up for current player, face-down for others), deck/discard counts, active investments, reputation, owned barrels.
- **Action panel:** legal actions for the current player, with form inputs for each.
- **Animations:** card draws, barrel aging stacks, demand roll, sale rewards.
- **Setup UI:** mash bill draft interface, starter deck draft interface.
- **End-game screen:** final reputation, tiebreaker info, replay link.

The UI subscribes to engine state via the action history. Each user input dispatches a `GameAction`, which is validated and applied by the engine. The UI re-renders from the new state.

### Phase 11: Multiplayer (Days 22-28)

- Add WebSocket layer for real-time multiplayer.
- Server holds authoritative game state. Clients send `GameAction` requests; server validates and broadcasts state updates.
- Implement reconnection: clients can rejoin a game using a session token; server replays the action history to bring them up to speed.
- Add basic lobby (create game, join game, start when full).

### Phase 12: AI Opponent (Optional, Days 29-35)

- Build a baseline heuristic AI that:
  - Always makes bourbon if possible.
  - Ages barrels when demand is below 5.
  - Sells barrels when demand is above 8 *and* the mash bill grid pays well.
  - Buys from market when capital allows and a useful card is available.
- Optional: train an MCTS or RL agent against the heuristic for a stronger opponent.

---

## Card Content Required

This is a *content* checklist. The engine is the framework; these cards populate it.

### Mash Bills (~15-20 unique designs)

Each must specify:
- Name and flavor text
- Age bands (3 thresholds, increasing, first ≥ 2)
- Demand bands (3 thresholds, increasing, range 0-12)
- 3×3 reward grid (some cells may be 0/blank)
- Optional recipe constraints
- Optional Silver and/or Gold award conditions

Aim for variety: workhorse bills with shallow bands, premium bills with deep bands, demand specialists, recipe-restricted bills (high-rye, wheated, four-grain).

### Market Supply Cards (~30-40 cards)

Mix of:
- Premium resource cards (2-rye, 2-corn, 2-cask)
- High-value capital cards (2-capital, 3-capital)
- Specialty cards (a card that counts as any grain, a card that produces 2 reputation when discarded, etc.)

### Investments (~10-12 cards)

Examples:
- **Larger Distillery:** Hand size +1.
- **Master Distiller:** Free trash once per round.
- **Bottling Line:** Carry over 1 card between rounds.
- **Marketing Campaign:** +1 demand at the start of each round you control this.
- **Tasting Room:** Once per round, exchange 1 capital for 2 reputation.
- **Storage Expansion:** All your barrels age 1 year for free at the start of each round.

### Operations (~15-20 cards)

Examples:
- **Bourbon Boom:** +2 demand immediately.
- **Bottle Shortage:** -2 demand immediately.
- **Quality Audit:** Trash 1 card from each opponent's hand.
- **Industry Acquisition:** Steal 1 card from an opponent's discard pile.
- **Press Coverage:** Draw 3 cards.

---

## Testing Strategy

### Unit Tests

Every action validator and mutator must have tests. Cover:
- Happy path (action succeeds, state changes correctly).
- Each failure mode (missing resource, full rickhouse, illegal target).
- Edge cases (empty deck triggers reshuffle, demand at boundaries).

### Integration Tests

Run scripted multi-turn scenarios:
- A full round with all four phases.
- Triggering the final round mid-action-phase.
- A trade that affects future hands.
- An investment that changes hand size mid-game.

### Property-Based Tests

Use a library like fast-check to assert invariants:
- Total cards in player's deck + hand + discard + barrels + trashed = constant per game.
- Reputation only increases, never decreases.
- Rickhouse barrel count never exceeds capacity.
- Demand stays in [0, 12].

### Replay Tests

Save action histories from real games. Replay them through the engine and assert the final state matches. This catches regressions when refactoring engine internals.

---

## Performance Considerations

- **Card lookups should be O(1).** Use Maps keyed by card ID, not array searches.
- **State snapshots can be expensive for large games.** Consider structural sharing (immer or similar) rather than full deep clones.
- **Action history can grow.** Compress old actions into state snapshots every N rounds for efficient replay.

---

## Stretch Goals

- **Tutorial mode:** Walk new players through their first few rounds with hints.
- **Replay viewer:** Let players watch past games turn-by-turn.
- **Stats dashboard:** Track win rates by strategy (Volume, Patient, Speedrun).
- **Card editor:** Let designers add new mash bills and investments via a JSON config without touching code.
- **Solo mode:** A single-player puzzle variant where the player tries to maximize reputation in a fixed number of rounds against a fixed market.

---

## Project Structure

```
bourbonomics/
├── packages/
│   ├── engine/              # Pure game logic, no UI
│   │   ├── src/
│   │   │   ├── types.ts
│   │   │   ├── rng.ts
│   │   │   ├── deck.ts
│   │   │   ├── actions/
│   │   │   ├── validators/
│   │   │   ├── reducers/
│   │   │   └── index.ts
│   │   └── tests/
│   ├── client/              # React UI
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── store/
│   │   │   ├── hooks/
│   │   │   └── App.tsx
│   │   └── tests/
│   ├── server/              # WebSocket multiplayer host
│   │   ├── src/
│   │   │   ├── lobby.ts
│   │   │   ├── game-host.ts
│   │   │   └── index.ts
│   │   └── tests/
│   └── content/             # JSON card definitions
│       ├── mashbills.json
│       ├── investments.json
│       ├── operations.json
│       └── market-supply.json
├── package.json
├── tsconfig.json
└── README.md
```

---

## First Task for Claude Code

When this repository is opened, the first task is to:

1. Initialize the monorepo structure above (use pnpm workspaces or npm workspaces).
2. Set up TypeScript, ESLint, Prettier, and Vitest in the engine package.
3. Implement `engine/src/types.ts` with all interfaces from the Core Data Models section.
4. Implement `engine/src/rng.ts` (a simple seeded LCG or Mulberry32 is fine).
5. Implement `engine/src/deck.ts` with `shuffle()`, `draw(n)`, and `reshuffleDiscard()` functions.
6. Write tests for the RNG (deterministic with same seed) and deck (no card duplication or loss).
7. Commit and report back.

After confirmation, proceed to Phase 2 (Demand and Draw Phases) and continue through the implementation order.

---

## Notes for Claude Code

- **Refer to [`GAME_RULES.md`](GAME_RULES.md)** for any rule clarifications. The rules are authoritative; this document is the implementation translation.
- **When in doubt about a rule, ask.** Some details (like exact reward grid values, investment costs, and operations card effects) are content decisions that benefit from explicit input.
- **Build vertical slices.** Don't try to implement all data models, then all validators, then all UI. Each phase should produce a runnable, testable subset of the game.
- **Write tests before mutators.** TDD works well for game logic because the rules are unambiguous and the test cases are obvious.
- **Keep the engine pure.** No DOM, no fetch, no console.log in core engine code. The engine should be runnable in Node, browser, or any other JavaScript runtime.
- **Document non-obvious decisions** in code comments. Future-you (or the next contributor) will appreciate it.

This is a meaty project. Take it phase by phase. Ship working slices. Trust the architecture.
