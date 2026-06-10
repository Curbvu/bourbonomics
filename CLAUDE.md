# Bourbonomics — project rules for Claude Code

## Hard requirements (non-negotiable)

### 1. The game canvas is a fixed 16:9 aspect ratio.

The game area is a **fixed 1920 × 1080 design canvas** (16:9), handled by `ScalingHost`. Every UI decision — text sizes, padding, hit targets, animation timing, layout — gets designed at that resolution. `ScalingHost` does one job: scales the canvas uniformly to fit the viewport. Excess space on the dominant axis is letterbox (top + bottom) or pillarbox (left + right) and shows the page background. **No reflow, no aspect-driven layout, no "looks fine at one size but breaks at another."**

Why it's non-negotiable:
- **Performance** stays predictable — the canvas paints at a known size.
- **Text and spacing stay consistent** across every monitor — 12pt copy reads as 12pt at every viewport.
- **Edit consistency** — when we tighten the rickhouse, restyle the hand strip, or move a chip, we're always editing the same canvas. There is no "but on this viewport…"

Consequences for editing:
- Design at **1920 × 1080**. If your panel doesn't fit at that resolution, the panel is the bug — not the canvas.
- Never reach for media queries to make the game canvas "respond." The canvas does not respond to viewport size; it scales.
- `GameTopBar` lives **outside** `ScalingHost` and is the one piece of chrome that spans the full viewport. Everything else (`GameBoard`, all in-game modals/overlays/flights that anchor inside the canvas) lives inside.
- If you ever change the design dimensions or the aspect ratio, change them in `ScalingHost.tsx` **and this file** in the same commit.

### 2. Everything fits on one screen. No scrollbars in gameplay.

The whole game must fit inside the 1920 × 1080 canvas. The play screen, every modal, every overlay — **no vertical or horizontal scrollbars** anywhere a player interacts with the game.

If a panel or modal grows past the available height, the answer is **never** to scroll it. Instead:

- Tighten the panel: drop redundant rows, collapse labels, shrink padding, switch to a denser grid, paginate, or use a tabbed/segmented layout.
- Shrink the content: smaller card tiles, fewer mash-bill grid cells, condensed flavor text.
- Push the chrome into a tooltip, hover-card, or inspect modal (which itself must also fit).

The single allowed exception is **`/rules`** — the in-app rulebook is a long-form reading experience and intentionally scrolls. Nothing else.

Before considering a UI change "done", you must visually confirm in the preview (`preview_screenshot` / `preview_eval` against `document.body.scrollHeight` vs viewport height) that no scrollbars are introduced.

### 3. All resource cards share one visual style.

Anywhere a card from a player's hand or the market is shown — the hand tray, the drafting modal, the buy modal, the inspect modal, flights, etc. — the **same card visual treatment** applies: same gradient, same glyph, same name typography, same flavor line, same badges. `HandCardTile` is the canonical implementation; if a surface needs to render a card and it doesn't reach for `HandCardTile` (or a documented variant), that's a bug.

If a surface "needs" a custom card look, push back — propose a `size` / `variant` extension to `HandCardTile` instead of a parallel renderer. We've already paid the cost of consolidation; don't fracture it again.

## Game rules (canonical)

[`docs/GAME_RULES.md`](docs/GAME_RULES.md) is the **single source of truth** for gameplay. When game behavior changes, update the rulebook first (or in the same change). If doc and code disagree, the document is authoritative — fix the code.

## Branching

- PRs target `dev`, not `main`. `dev` is the integration branch; `main` lags and triggers prod deploy on push.
- Prod ship = commit on dev → push dev → checkout main → `git merge --no-ff origin/dev` → push main.

## Domains (stage → host)

P2 (the prototype) is now the primary product at the apex root; the P1 live game is retired to `legacy.`. Branch → stage → host (wired in `sst.config.ts` + `.github/workflows/ci.yml`):

- `prototype-main` → `proto-prod` → **playbourbonomics.com** (P2 root)
- `prototype-dev` → `proto-dev` → **dev.playbourbonomics.com**
- `main` → `prod` → **legacy.playbourbonomics.com** (P1 live game)
- `dev` → `dev` → **dev-legacy.playbourbonomics.com**

When swapping the apex between stages, deploy live-first (releases the apex) then prototype (claims it) — Route 53 can only alias the apex to one CloudFront distribution at a time.

## Stack notes

- Monorepo, npm workspaces: `packages/{engine,client,server}`.
- Engine is pure TS — no DOM, no fetch, no console. Every mutation goes through `applyAction(state, action)`.
- Client is Next.js 16 (App Router), React 19, Tailwind v4.
- Server is AWS Lambda + DynamoDB over WebSockets, deployed via SST (`sst.config.ts`).
- Run `npm test` and `npm run typecheck` from the repo root.
