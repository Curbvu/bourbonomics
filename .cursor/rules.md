# Bourbonomics — Cursor rules

## Project

**Bourbonomics** is this repository: a Next.js app, AWS/SST-style backend pieces, and DynamoDB. Stack and conventions live in the codebase; follow existing patterns for TypeScript, React, and infra.

## Game rules (canonical)

**[`docs/GAME_RULES.md`](../docs/GAME_RULES.md)** is the **single source of truth** for how the Bourbonomics game works: setup, modes, board, turn structure, phases, bourbon/mash/rickhouse rules, market demand, awards, and bankruptcy.

- **Before** implementing or changing anything that affects gameplay, UX copy tied to rules, or validation logic, **read (or re-read) `docs/GAME_RULES.md`**.
- **When the game changes**, updates belong in **`docs/GAME_RULES.md` first** (or in the same change: keep the doc and code aligned). Do not invent rules in code that are not reflected there unless the user explicitly asks for a temporary divergence.
- If `GAME_RULES.md` and implementation disagree, **treat the document as authoritative** for “what the game is supposed to be” and fix code—or flag the mismatch for the maintainer.

## Other Cursor rules

Additional always-on rules (for example DynamoDB access patterns) live under **`.cursor/rules/`** as `*.mdc` files. Follow those for infrastructure and data access.

## Scope of edits

Change only what the task requires. Do not refactor unrelated code or add unsolicited markdown files outside what was requested.
