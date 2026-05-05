# Bourbonomics — Game Design Requirements

Living checklist of product, gameplay, and UX requirements that the
implementation is held to. New constraints land here first, then drive
code, tests, and `docs/GAME_RULES.md` (the canonical rulebook).

This file is for *what we want to be true*; `docs/GAME_RULES.md` is for
*how the game plays out at the table*. Where they overlap (e.g.
Distilleries), the rulebook is the public-facing source and this file
records the design intent that shaped it.

---

## User-Requested Customizations (v2.1+)

Authoritative checklist of explicit asks the user has made for v2.1.
Implementation must respect every item on this list; new asks are
added at the top.

- **Every card on screen renders at the SAME fixed silhouette** — hand,
  market conveyor, mash bills (face-up + draw pile), ops cards, and
  empty slots. Single source of truth: `CARD_SIZE_CLASS` in
  `handCardStyles.ts`. Current value: `h-[112px] w-[80px]`. Increasing
  one tile means increasing them all.
- **"Mash bill" and "bourbon" are the same card.** UI labels use
  "mash bills" everywhere; rules-doc copy may use either interchangeably.
- **Right rail is the Action Log only.** Player ("baron") status moved
  into each player's rickhouse panel; the rail collapses to a single
  panel showing the live action log so the user can see what bots are
  doing each turn. No tabs.
- **Each rickhouse panel folds in the player's full status.** Identity,
  reputation, distillery name, slot tally, hand/deck/discard counts,
  and bills/ops/gold/sold counters all live inside the player's
  rickhouse card — replacing the standalone Barons sidebar.
- **Rickhouse slots render as a single horizontal row** with a
  labelled vertical divider between Upper and Bonded. Bonded slots
  carry an amber-tinted dashed border so the inviolable tier is
  visually distinct from upper slots.
- **Phase strip is inlined into the top bar.** No standalone sub-bar;
  the round-loop chrome (5 phase chips + demand + bourbon counter +
  Step / Auto controls) lives in a single header row alongside the
  brand and Quit button. Setup phases swap in a "Setup · pick your
  distillery" / "build your starter deck" banner instead.
- **Market: 10 face-up cards in the conveyor.** Below the conveyor,
  three subsections (Mash bills, Operations, Investments) each render
  3 face-up cards plus a face-down "draw from pile" tile that shows the
  remaining deck count. Investments is a placeholder until v2.2.
  Engine: `MARKET_CONVEYOR_SIZE = 10`. Rules updated to match.
- **Rickhouses sit in a top row spanning the full canvas width.**
  Below them, the Market Center takes the full middle width with the
  Right rail (320px) at its right edge. Per-player rickhouse panels
  wrap into 2–6 columns depending on viewport.
- **Bots auto-resolve setup picks without user input.** During
  `distillery_selection` and `starter_deck_draft` the round-loop
  banner (Step / Auto controls) is hidden, so the store auto-steps
  any bot pick on a 220ms beat. Stops automatically when it hits the
  human's turn — the corresponding modal then takes over.
- **WoW-style tier colour system on mash bills.** Mash bills are
  classed `common | uncommon | rare | epic | legendary` and rendered
  with the canonical WoW palette: white/slate, green, blue, purple,
  orange. Tier drives card border, gradient, and outer glow on
  every render surface (HandTray, MarketCenter mash-bill row,
  inspect modals). Source of truth: `tierStyles.ts` in the client.
- **Centralize the Market into the play canvas.** The Market lives
  in the **center column** of the dashboard, not in the right rail.
  Below the market, three subsections list the available **mash
  bills, operations cards, and investment cards** (investment is a
  placeholder until the mechanic ships in v2.2). Right rail keeps
  Barons + Log only.
- **Stylized portrait cards everywhere a card is shown.** Resources,
  capital, mash bills, and ops cards all use the dev-branch portrait
  silhouette (112×128 in the hand, 100×140 on the table) with a
  type-coloured gradient, glyph, and accordion-fan hover lift.
  Centralised in `handCardStyles.ts`.
- **Round phase strip shows 5 phases: Demand → Draw → Age → Action
  → Cleanup.** Distillery selection and starter-deck draft are
  opening-only setup phases; they don't appear in the round-loop
  banner. Banner self-hides during setup and the modals own the
  canvas.
- **Distillery draft + starter-deck draft are interactive for the
  human seat.** A modal pops on the human's turn during each setup
  phase. Distillery: pick from the shared pool (no duplicates).
  Starter deck: compose 16 cards from the six plain types via +/-
  controls, with a live 16-slot preview that lights up as you fill
  it. Bots auto-resolve the same actions through the runner.
- **No vertical or horizontal scroll on the dashboard.** The play
  page must fit a single 1280×720+ viewport — top bar, phase
  sub-bar, rickhouse grid, market center, right rail, and hand tray
  all visible at once.

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
- **$12 payout floor + ~$15 average on commons.** Every printed grid
  cell pays at least $12 — that's the break-even cost a player paid to
  barrel and sell a bourbon (~6 actions + 2 rounds of rickhouse rent),
  rounded up to leave a small margin. Common (1×2) bills are
  redistributed across six floor-respecting patterns whose **aggregate
  average across the 26-card common pool lands at ~$15**, deliberately
  fat for early-game tragedy-of-the-commons economics: early sales
  bankroll more production → rickhouses fill → rent climbs → late entry
  is brutal. Blank cells (`0`) are intentional and skip the check
  (some sparse grids by design pay nothing in certain age/demand
  combinations). The catalog generator enforces the floor on every
  build via `PAYOUT_FLOOR = 12` in `scripts/build-catalogs.ts` —
  future YAML edits that drop a printed cell below $12 fail the build
  with a clear error message.
- **Non-common bills follow a formula.** Every uncommon / rare / epic
  / legendary bill's grid is built per row from the design owner's
  formula:
  - **Row floor** (lowest demand cell at this age) = `max($12, age × 2)`.
    A 4-year row floors at $12; a 6-year at $12; an 8-year at $16; a
    10-year at $20; a 15-year at $30.
  - **Row average target** = `max($15, $15 + (age − 2) × $3 + (ingredients − 3) × $3)`.
    A 4-year row with the baseline 3-card mash averages $21; an 8-year
    row averages $33; a 10-year averages $39; a 15-year averages $54.
    Adding mandatory recipe grain (e.g. a `rye ≥ 2` bill is a 4-card
    mash) bumps the row average by $3 per extra card.
  - **3-cell rows** distribute as roughly `[F, 2F, 3.75F]` and then
    renormalise so the row's arithmetic mean exactly hits the target.
    Reference: 8-year, 4-ingredient → `[16, 32, 60]` avg $36.
  - **2-cell rows** = `[F, 2M − F]` so the arithmetic mean = M.
  - **1-cell rows** = `max(F, M)`.
  - Older age bands within the same bill compound the bonus — row-2 of
    a 3×3 epic with `ageBands: [4, 7, 10]` pays $20 / $34 / $63 vs
    row-0's $12 / $18 / $33. That's the "with more age, increase more"
    behaviour: each year of additional aging widens the spread between
    low and high demand on the same card.
  - Implemented as a one-shot rebuild via `scripts/formula-rebalance-bourbons.ts`
    (deleted after running). Commons are exempt — they keep their
    six-pattern $15-average distribution.

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
21. **$10 payout floor on every printed bourbon-grid cell** so a 2-year
    sale always clears the ~6 actions + 2 years of rent break-even.
    Variance above the floor is unconstrained. Catalog generator
    enforces the floor at build time.
22. **Floor raised to $12 + commons redistributed to ~$15 average**
    for tragedy-of-the-commons early-game economics. Floor-respecting
    pattern set across the 26 commons; richer tiers had any sub-$12
    printed cells lifted to $12.
23. **Non-common bills rebuilt to a formula** — row floor `max($12,
    age × 2)`, row average `$15 + (age − 2) × $3 + (extra
    ingredients) × $3`, 3-cell rows shaped roughly `[F, 2F, 3.75F]`
    and renormalised to the target average. Older age bands within
    the same card compound the bonus, so a 15-year legendary row pays
    $30 / $46 / $86 while its 8-year row pays $16 / $29 / $54.
