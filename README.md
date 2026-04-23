# Bourbonomics

A solo-vs-computer implementation of the **Bourbonomics** board game — [Kentucky Straight mode](docs/GAME_RULES.md). Single-player only: you vs. 1–5 bots, all running in the browser.

## Rules

[`docs/GAME_RULES.md`](docs/GAME_RULES.md) is the canonical rulebook. When game behavior changes, update the rulebook first.

## Getting started

Use **Node.js 22+** (see `.nvmrc`).

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Scripts

- `npm run build:catalogs` — regenerate `lib/catalogs/*.generated.ts` from `data/*.yaml`. Runs automatically before `dev` and `build`.
- `npm run dev` — start Next.js locally.
- `npm run build` / `npm start` — production build.
- `npm test` — run the engine test suite (Vitest).

## Architecture

- **Frontend:** Next.js 16 (App Router), React 19, Tailwind 4.
- **State:** pure reducer (`lib/engine/reducer.ts`) wrapped by a Zustand store. Immer for nested updates. Seeded PRNG (`lib/engine/rng.ts`) makes games reproducible.
- **Persistence:** localStorage — one active game at a time.
- **No backend.** Everything runs in the browser.

See [`docs/GAME_RULES.md`](docs/GAME_RULES.md) for gameplay rules and [`.cursor/rules.md`](.cursor/rules.md) for project conventions.

### Rickhouses

The six rickhouses map to the **[Kentucky Bourbon Trail® regions](https://kybourbontrail.com/regions/)**:

| Index | Region      | Capacity |
|-------|-------------|----------|
| 0     | Northern    | 3        |
| 1     | Louisville  | 4        |
| 2     | Central     | 5        |
| 3     | Lexington   | 6        |
| 4     | Bardstown   | 4        |
| 5     | Western     | 5        |
