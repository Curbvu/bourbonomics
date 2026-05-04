# Bourbonomics 2.0

A multiplayer (2–4) deckbuilding strategy game about running a bourbon distillery. Players draft mash bills, manage personal decks of resource cards, produce bourbon, age it over time, and sell at the perfect moment to convert tied-up inventory into reputation. Whoever ends with the most reputation wins.

## Rules

[`docs/GAME_RULES.md`](docs/GAME_RULES.md) is the canonical rulebook. When game behavior changes, update the rulebook first.

[`docs/IMPLEMENTATION_GUIDE.md`](docs/IMPLEMENTATION_GUIDE.md) is the engineering plan that the engine follows.

## Layout

This is an npm-workspaces monorepo.

```
packages/
└── engine/        Pure TypeScript game engine — no DOM, no fetch.
                   Action-based reducer with seeded RNG and immer-driven state.
```

Future packages (per the implementation guide):
- `packages/client` — React UI (planned)
- `packages/server` — WebSocket multiplayer host (planned)
- `packages/content` — JSON catalogs of mash bills, investments, operations cards, market supply (planned)

## Getting started

Use **Node.js 22+** (see `.nvmrc`).

```bash
npm install
npm test         # run engine tests across all packages
npm run typecheck
```

## Engine

The engine is framework-agnostic and lives in `packages/engine`. Everything flows through one reducer:

```typescript
import { initializeGame, applyAction } from "@bourbonomics/engine";

const state = initializeGame({ seed: 42, players: [{ id: "p1", name: "Alice" }, { id: "p2", name: "Bob" }] });
const next = applyAction(state, { type: "ROLL_DEMAND", roll: [3, 4] });
```

- **Pure-functional state:** every action returns a new GameState (via immer).
- **Seedable RNG:** all randomness threads through a single state field — replays are exact.
- **Validated actions:** `validateAction(state, action)` is safe for UI gating; `applyAction` throws `IllegalActionError` if you skip the check.

### Rickhouses

The six rickhouses map to the **[Kentucky Bourbon Trail® regions](https://kybourbontrail.com/regions/)**:

| Region      | Capacity |
|-------------|----------|
| Northern    | 3        |
| Louisville  | 5        |
| Central     | 4        |
| Lexington   | 5        |
| Bardstown   | 6        |
| Western     | 3        |

Total capacity: **26 barrels**.
