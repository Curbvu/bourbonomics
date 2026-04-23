# Bourbonomics — Cursor rules

## Project

**Bourbonomics** is a client-side Next.js solo-vs-computer implementation of the Bourbonomics board game (Kentucky Straight mode). No backend; all state is a pure reducer + Zustand store. Follow existing patterns for TypeScript and React.

## Game rules (canonical)

**[`docs/GAME_RULES.md`](../docs/GAME_RULES.md)** is the **single source of truth** for gameplay. The engine (`lib/engine/`), rules modules (`lib/rules/`), modifier opcodes (`lib/modifiers/`), and AI (`lib/ai/`) must all agree with it.

- **Before** implementing or changing anything that affects gameplay, validation, or rules-tied copy, **read (or re-read) `docs/GAME_RULES.md`**.
- **When the game changes**, update `docs/GAME_RULES.md` first (or in the same change) — keep doc and code aligned.
- If doc and code disagree, **the document is authoritative**; fix code or flag the mismatch.

## Layout

- `data/` — runtime YAML catalogs (bourbon / investment / operations / resource / events).
- `lib/catalogs/*.generated.ts` — typed JSON emitted from `data/` by `scripts/build-catalogs.ts`. **Do not hand-edit generated files.**
- `lib/engine/` — state shape, reducer, phases, RNG, legal-action checks. Pure functions only.
- `lib/rules/` — per-rule modules (mash, pricing, awards, fees, investments).
- `lib/modifiers/` — opcode dispatchers for resource / investment / operations effects.
- `lib/ai/` — bot scoring + decision.
- `lib/store/` — Zustand store and localStorage persistence.
- `app/` — Next.js App Router: `/` (new game), `/play` (game), `/rules` (rules doc viewer).

## Scope of edits

Change only what the task requires. Do not refactor unrelated code or add unsolicited files.
