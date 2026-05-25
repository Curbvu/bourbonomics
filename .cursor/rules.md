# Bourbonomics — Cursor rules

## Project

**Bourbonomics 2.0** is a multiplayer (2–4) deckbuilding strategy game about running a bourbon distillery. The codebase is an npm-workspaces monorepo with a pure TypeScript engine, a Next.js 16 (App Router) client, and a WebSocket multiplayer server. Solo (vs-bots) and live multiplayer share the same engine.

## Game rules (canonical)

**[`docs/GAME_RULES.md`](../docs/GAME_RULES.md)** is the **single source of truth** for gameplay. The engine (`packages/engine/src/`) and any rules-tied UI copy must agree with it.

- **Before** implementing or changing anything that affects gameplay, validation, or rules-tied copy, **read (or re-read) `docs/GAME_RULES.md`**.
- **When the game changes**, update `docs/GAME_RULES.md` first (or in the same change) — keep doc and code aligned.
- If doc and code disagree, **the document is authoritative**; fix code or flag the mismatch.

## Layout

- `packages/engine/` — pure TypeScript game engine. Action-based reducer (`applyAction`), seeded Mulberry32 RNG, immer-driven state. **No DOM, no fetch, no console.** Tests in `packages/engine/tests/` (vitest).
- `packages/engine/content/` — YAML catalogs (operations, distilleries, investments). Mirrored by hand into `src/operations.ts`, `src/distilleries.ts`, and the investment block in `src/defaults.ts`.
- `packages/client/` — Next.js 16 App Router UI. Tailwind, React 19. Connects to the multiplayer server over WebSocket.
- `packages/server/` — WebSocket multiplayer host. AWS Lambda + DynamoDB rooms/connections tables. Deployed via SST (`sst.config.ts`).
- `docs/GAME_RULES.md` — canonical rulebook.
- `docs/IMPLEMENTATION_GUIDE.md` — phase-by-phase engineering plan.

## Engine conventions

- Every state mutation goes through `applyAction(state, action)`. Never mutate state directly.
- `validateAction(state, action)` is safe for UI gating; `applyAction` throws `IllegalActionError` if a check is skipped.
- New action types: add to `GameAction` union in `types.ts`, add a file in `src/actions/`, register both `validate` and `apply` branches in `engine.ts`.
- Run `npm test` and `npm run typecheck` from the repo root.

## Scope of edits

Change only what the task requires. Do not refactor unrelated code or add unsolicited files.
