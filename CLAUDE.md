# Bourbonomics — project rules for Claude Code

## Hard requirements (non-negotiable)

### 1. Everything fits on one screen. No scrollbars in gameplay.

The whole game must fit inside the viewport at the design scale handled by `ScalingHost`. The play screen, every modal, every overlay — **no vertical or horizontal scrollbars** anywhere a player interacts with the game.

If a panel or modal grows past the available height, the answer is **never** to scroll it. Instead:

- Tighten the panel: drop redundant rows, collapse labels, shrink padding, switch to a denser grid, paginate, or use a tabbed/segmented layout.
- Shrink the content: smaller card tiles, fewer mash-bill grid cells, condensed flavor text.
- Push the chrome into a tooltip, hover-card, or inspect modal (which itself must also fit).

The single allowed exception is **`/rules`** — the in-app rulebook is a long-form reading experience and intentionally scrolls. Nothing else.

Before considering a UI change "done", you must visually confirm in the preview (`preview_screenshot` / `preview_eval` against `document.body.scrollHeight` vs viewport height) that no scrollbars are introduced.

### 2. All resource cards share one visual style.

Anywhere a card from a player's hand or the market is shown — the hand tray, the drafting modal, the buy modal, the inspect modal, flights, etc. — the **same card visual treatment** applies: same gradient, same glyph, same name typography, same flavor line, same badges. `HandCardTile` is the canonical implementation; if a surface needs to render a card and it doesn't reach for `HandCardTile` (or a documented variant), that's a bug.

If a surface "needs" a custom card look, push back — propose a `size` / `variant` extension to `HandCardTile` instead of a parallel renderer. We've already paid the cost of consolidation; don't fracture it again.

## Game rules (canonical)

[`docs/GAME_RULES.md`](docs/GAME_RULES.md) is the **single source of truth** for gameplay. When game behavior changes, update the rulebook first (or in the same change). If doc and code disagree, the document is authoritative — fix the code.

## Branching

- PRs target `dev`, not `main`. `dev` is the integration branch; `main` lags and triggers prod deploy on push.
- Prod ship = commit on dev → push dev → checkout main → `git merge --no-ff origin/dev` → push main.

## Stack notes

- Monorepo, npm workspaces: `packages/{engine,client,server}`.
- Engine is pure TS — no DOM, no fetch, no console. Every mutation goes through `applyAction(state, action)`.
- Client is Next.js 16 (App Router), React 19, Tailwind v4.
- Server is AWS Lambda + DynamoDB over WebSockets, deployed via SST (`sst.config.ts`).
- Run `npm test` and `npm run typecheck` from the repo root.
