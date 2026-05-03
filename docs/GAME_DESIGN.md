# Bourbonomics — Game Design Requirements

Living checklist of product, gameplay, and UX requirements that the
implementation is held to. New constraints land here first, then drive
code, tests, and `docs/GAME_RULES.md` (the canonical rulebook).

This file is for *what we want to be true*; `docs/GAME_RULES.md` is for
*how the game plays out at the table*. Where they overlap (e.g.
Distilleries), the rulebook is the public-facing source and this file
records the design intent that shaped it.

---

## Layout & viewport

- **No vertical or horizontal scroll on the dashboard.** The play page
  must fit in a single 1280×720+ viewport: top bar, phase sub-bar,
  rickhouse grid, right rail, and hand tray all visible at once.
- **3-slot rickhouses fit their barrels in a single row.** Cards
  (filled chips and empty slots) are sized so a 3-capacity rickhouse
  in a 3fr column never wraps to a second row at typical desktop
  widths (1280–1440px). Larger rickhouses (5–6 capacity) may wrap.
- **Hand tray sections are scannable in one idiom.** Resources,
  bourbon, and play (ops + investments) all use the same card-fan
  layout; cash sits as its own section without a bordered mini-box.

## Setup & opening

> **Status:** Implemented. `DEFAULT_STARTING_CASH = 40`,
> `STARTING_BOURBON_HAND = 4`, `STARTING_DEMAND = 0`. Distillery draft
> phase + per-player perks live at the top of `reducer.ts` /
> `phases.ts` / `checks.ts` / `fees.ts`. UI flow runs through
> `DistilleryDraftModal` (deal-2-pick-1 with "Start {x}" double-commit)
> and `DistilleryInspectModal` (clickable name in top bar / hand /
> opponent panel). The Recipe Book "draw 2 keep 1 on bourbon draw"
> perk is the lone stub — needs a multi-step UI before it can land.

- **Distilleries — asymmetric starting identities.** Each baron is
  dealt 2 Distillery cards face-down at game start, picks 1 to keep
  face-up, returns the other. The chosen card grants a one-time
  **starting bonus** and a permanent **ongoing perk**. Eight cards in
  the initial pool span production rusher / patient ager / spreader /
  market manipulator / mash-bill specialist / Operations player /
  cash baron / cooperage. No penalties — pure positive identities.
  See `docs/GAME_RULES.md` §Distilleries for the full pool.
- **Starting cash: $40.** Restored after the brief $25 experiment.
  Distilleries handle differentiation and immediate ramp; the larger
  bankroll keeps paid-action flexibility healthy.
- **Starting bourbon hand: 4 mash bills.** Restored — Distilleries can
  add to it (e.g. The Recipe Book grants +2) but the base deal is back.
- **No setup round.** Round 1 plays under normal action-phase rules
  from the start. Phase 1 (rent) is skipped because no one has
  barrels yet, but the lap-cost ladder fires the moment someone
  passes.
- **No round-1 free-action budget.** The previous "8 free actions"
  experiment is removed — Distilleries replace it as the source of
  early-game asymmetry.

## Bourbon cards (mash bills)

- **Tier-sized pricing grids.** Common bills are simple, rarer bills
  earn richer pricing surfaces:
  | Tier | Max grid | Initial migration |
  |---|---|---|
  | common | 2 × 2 | reduced to 1 × 2 |
  | uncommon | 2 × 3 | reduced to 2 × 2 |
  | rare | 3 × 3 | unchanged |
  | epic | 3 × 3 | unchanged |
  | legendary | 3 × 3 | unchanged |
  Catalog generator enforces the tier max — future YAML edits cannot
  violate it.
- **No `≥` or `≤` symbols in card copy.** Award text strips both at
  render time; the bare number reads cleaner because context already
  implies "at least / at most". Authors may keep typing the symbols
  in YAML.
- **Variable-length bands.** `ageBands` and `demandBands` accept 1–3
  thresholds; `grid` shape must match. Pricing, inspect modal, and
  in-rickhouse chip pay-scale all render whatever dimensions the bill
  declares.

## Mash construction

- **Generous mash cap.** `MAX_MASH_CARDS = 9` total resource cards
  (cask + grains). Bills like 3 corn + 3 rye + cask are legal; the
  cap is large enough for variety stacks without inflating turns.
- **Bill recipes can tighten, never loosen.** A bill's optional
  `MashRecipe` adds per-grain min/max constraints on top of the
  universal rules (1 cask, ≥1 corn, ≥1 small grain, ≤ MAX_MASH_CARDS).

## Players & identity

- **Bourbon-centric logo per baron.** Each player picks a logo at
  game setup from a curated 12-icon catalog (still, barrel, tumbler,
  corn, rye, oak, char, mash, mash tub, rickhouse, decanter, baron).
  Bots are auto-assigned distinct logos.
- **Diversified palette.** Six visually distinct hues (indigo, rose,
  emerald, amber, sky, violet) so default 3-player games get three
  obviously different colors rather than three blues.
- **Logo + color render together.** A `<PlayerSwatch />` colored disc
  with the chosen glyph appears everywhere a player swatch lives:
  top-bar baron pills, opponent panel, inspect modal, market recap,
  and the barrel-chip header in rickhouses.
- **Older saves fall back gracefully.** Pre-logo saves resolve to a
  deterministic logo derived from `seatIndex` so they keep playing
  without a forced new game.

## Barrel chips in rickhouses

- **Tier chrome on the chip body.** Barrel chips paint with their
  bourbon's tier gradient + border so rarity reads at a glance.
- **Owner stripe on top.** A slim band in the owner's color carries
  their logo glyph + the barrel age (`Ny`).
- **Pay-scale row in the body.** Three (or fewer, per the bill's
  demand bands) cells show low/mid/high payouts for the resolved age
  band. The cell at the live demand glows emerald (or amber when a
  Gold-bourbon alt boosts the payout, or sky when the barrel is still
  aging).
- **Aging barrels show value AND timer.** For age < 2, the chip uses
  the lowest age band's prices in sky tint and adds a "matures in Xy"
  line in place of the LO/MID/HI labels.
- **No demand-band labels under the scale.** The cells communicate
  band visually (left = low, right = high); explicit labels are noise.

## Top bar & cost ladder

- **No deck-count widgets next to Quit.** The right side of the top
  bar shows only Quit; bourbon/market deck sizes are not first-class
  identity for the player.
- **Cost ladder is always visible.** The FREE → $1 → $2 → $3+ chip
  is the canonical action-cost display from round 1 onward. (The
  previous "setup round N/8" pill was removed alongside the setup
  round itself.)

## Hand tray

- **Cash fills its column without an inner box.** Big number, no
  bordered card chrome — cash IS the column, not a card within it.
- **Resource cards label the type at top-left.** Cards show "CORN" /
  "WHEAT" / "CASK" directly instead of a redundant "RESOURCE"
  eyebrow with a separate type chip.

## Persistence & migrations

- **Saves survive additive engine fields.** New `ActionPhaseState`
  fields (e.g. `freeActionsRemainingByPlayer`) get a soft-migration
  in `lib/store/persistence.ts` that fills sane defaults on load, so
  in-flight games don't crash on the first deploy that introduces a
  field.
- **UI reads of recently-added fields use optional chaining** as a
  belt-and-suspenders guard against pre-migration state.

---

## Conversation history — completed asks

Every UX/design ask from the design conversation that shaped this
file, in chronological order. Useful when re-evaluating tradeoffs.

1. Remove the bourbon/market deck counters from the top bar (next to
   Quit).
2. Make the free → paid action transition significant to the user.
   *(Superseded by the setup-round design — round 1 has its own pill;
   the free-window-to-$1 transition stayed as the existing CostChip
   highlight.)*
3. Cash card fills its whole column — no bordered mini-box.
4. Resource cards drop the "RESOURCE" eyebrow and show the type
   ("CORN") directly in the top-left.
5. New player palette + bourbon-centric logo identity per baron;
   logo and color render everywhere a swatch appears.
6. Default starting cash bumped to $25.
7. Tier color + owner logo on the in-rickhouse barrel chip.
8. Show pay scale prominently on barrel chips so players can see
   value at a glance.
9. Resize barrel chips up so they breathe — but never so wide that
   3-slot rickhouses wrap to a second row.
10. Drop the "AGING" badge; for aging barrels, show the live cell
    highlighted with the projected price + "matures in Xy".
11. Tier-sized bourbon grids (commons 1–2 bands per axis, more for
    rarer tiers); 26 commons reduced to 1×2, 20 uncommons reduced to
    2×2, rare/epic/legendary stay 3×3.
12. Eliminate LO/MID/HI labels under the chip pay scale.
13. Strip `≥`/`≤` symbols from rendered award text.
14. Relax the mash bill total-cards cap to allow varieties like 3
    rye + 3 corn (cap raised 6 → 9).
15. ~~Round 1 = 8 free actions per player, then the game begins.~~
    *(Superseded by #20 — replaced by Distillery draft.)*
16. ~~Eliminate the 4 starting mash bills — players draw their own
    opening hand during the setup round.~~ *(Superseded by #20 —
    starting hand of 4 mash bills restored alongside Distilleries.)*
17. ~~After the setup phase, immediately advance to round 2; players
    can't continue into paid actions in round 1.~~ *(Superseded by
    #20 — no setup phase exists anymore.)*
18. Vertically tighten the dashboard so it fits the viewport without
    scrolling.
19. This file: enumerate the requirements above and the asks that
    produced them.
20. **Distillery identity cards** (Age-of-Empires-style asymmetric
    civs). Replaces the round-1 setup mechanic entirely — every
    baron drafts 1 of 2 dealt Distilleries that grants a starting
    bonus + permanent ongoing perk. Eight cards in the pool spanning
    eight strategic archetypes; balance via cross-pulling perks
    rather than per-card drawbacks. Full design spec lives in
    `docs/GAME_RULES.md` §Distilleries; engine implementation
    pending.
