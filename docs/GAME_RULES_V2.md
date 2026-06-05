# 🥃 Bourbonomics v2

A cozy engine-building game about building a bourbon distillery — one barrel at a time. You collect resources, build bourbons, age them quietly in the rickhouse, and sell them into a shared market at the right moment. The bourbons you sell become bottles in your **brand lines** — and your brand lines are the engine. Build the best portfolio of bourbon when the supply runs dry and you win.

**Players:** 1–4 · **Length:** ~45–60 min · **Complexity:** Medium-light

> **A note on this redesign.** Bourbonomics v2 is a ground-up reconception, not an iteration on the v3.x line. It keeps the theme (mash bills, aging, demand, selling) and the age × demand payoff matrix, and discards almost everything else. There is no dual rickhouse-and-portfolio rep economy, no doomsday-clock-as-only-spine, no aging-as-card-tax, no per-slot recipe gating. Instead the game is built around two decisions repeated all game: **when to sell a bourbon**, and **where to place it in a brand line**. Everything else serves those two. The design lane is deliberately cozy — production-focused, gentle competition, no direct player attacks — aimed at the bourbon-enthusiast and gift market. This document is the canonical rules for v2 and is authoritative over any prototype code.

---

# 🚀 Quick Start

### The 90-second pitch

You run a bourbon distillery. Each turn you take **6 actions** from a simple menu: draw resources, take a recipe, build a bourbon, sell a bourbon, open a brand line, or draft a marketing card. Bourbons you build go into your **rickhouse** to age. When the market demand is favorable — and your bourbon is old enough — you **sell**, banking Capital and turning the bourbon into a **bottle**. Bottles fill the slots of your **brand lines**, which are the heart of your distillery: filled slots pay you back, and a coherent, well-built brand scores big at the end.

The whole game turns on two questions, asked over and over:

1. **When do I sell?** — demand rises and falls on a shared, forecastable market; older bourbon is worth more; but a bourbon sitting in the rickhouse is taking up scarce space.
2. **Where do I place it?** — a brand line runs young-to-old, left-to-right. Place a bourbon **low** for a modest, reliable reward that preserves your line's potential; place it **high** for a bigger reward that *caps* the line's ceiling. Cheap bourbon belongs low; premium aged bourbon earns the high anchors.

### The magic thread

The single most important thing to understand: **nothing pays off much on its own.** A premium cask, a high slot, a matching marketing card, a hot demand window — each is marginal alone. But they **multiply**. A cheap bourbon in an undeveloped engine is worth almost nothing; the same effort, aligned — premium resources into an aged bourbon, sold at high demand, placed in the right slot of a coherently-marketed brand line — pays off enormously. The game is the slow, satisfying work of getting your systems to line up so a single sale lands big.

### Winning

The game ends when the **mash bill supply runs out**. Each player's final score is their **Capital** plus their **Reputation** (converted from prestige). Most points wins.

---

# 🎬 Setup

1. **Shared demand market.** Place the demand marker at **0** on the 0–12 track. Reveal **2 forecast cards** face-up beside it.
2. **Resource pool.** Shuffle the **communal resource deck** (casks, corn, grain — in Common / Specialty / Heritage qualities). It is shared by all players; there are no personal decks. Place a discard space beside it.
3. **Mash bill supply.** Shuffle the mash bills face-down. Deal **3 face-up** as the mash bill tray. The remaining face-down supply is the **doomsday clock** — when it empties, the game ends.
4. **Slot card supply.** Sort the slot cards by design (3–6 designs, multiple copies each) where every player can reach them. They are abundant.
5. **Marketing tray.** Shuffle the marketing cards; reveal a face-up tray.
6. **Players.** Each player takes a player board (rickhouse + brand-line area), starts with **0 Capital** and **0 prestige**, and draws an opening hand of resource cards from the communal deck.
7. Pick a start player.

---

# 🔄 The Round

A round is a series of turns taken **round-robin** — players take **one action at a time**, going around the table, until everyone has spent all **6 of their actions** for the round.

Taking one action at a time (rather than a full 6-action turn before passing) keeps the shared market live: the demand market, the trays, and the supply all change between your actions, so you react to the table as you go.

**End of round (the Year Pass).** Once every player has spent their 6 actions:

1. **Age.** Every bourbon in every rickhouse ages **+1**.
2. **Demand moves.** Advance the demand forecast — resolve the next scheduled forecast move and reveal the next forecast card.
3. **Refill.** Top up the mash bill tray, resource market, and marketing tray.
4. **Rotate.** The start player passes one seat; a new round begins.

Time advances **once per round**, at the Year Pass — never mid-round. Within a round, every player acts in the same market and the same demand level, which is what makes the shared demand forecast something everyone can plan around.

---

# 🎯 The Action Menu

Each turn you spend your 6 actions, one at a time, choosing freely from:

| Action | Cost | Effect |
|---|:-:|---|
| **Draw Resources** | 1 action | Draw 3 resource cards from the communal deck to your hand. |
| **Draw Mash Bills** | 1 action | Reveal 3 from the mash bill tray; keep 1, the rest are discarded. Drains the bill supply (the clock). |
| **Make Bourbon** | 1 action | Commit resource cards from your hand to a mash bill's recipe; spent cards go to the communal discard. The new bourbon enters your rickhouse at age 0. |
| **Sell Bourbon** | 1 action | Sell an eligible aging bourbon. Bank Capital, place the bottle. See [§Selling](#-selling). |
| **Open Brand Line** | 1 action + Capital | Pay **+1 Capital** (escalating per additional line) and place a slot card as a new brand line. |
| **Draft Marketing** | 1 action + Capital | Pay **+1 Capital** (the first marketing card of the game is free), draw 3 marketing cards, keep 1, and **attach it immediately** to a brand line. No marketing inventory. |
| **Activate Forecast** | free, once/round | Activate a visible forecast card. See [§The Demand Forecast](#-the-demand-forecast). Does not cost an action. |

The **rickhouse holds at most 4 barrels** (hard cap). You cannot build a bourbon if your rickhouse is full — sell or you're stuck. Future investments may expand it.

---

# 🛢️ Building and Aging Bourbon

### Make Bourbon

Each mash bill is a recipe — a set of resource requirements (cask + corn + grain, with quality minimums on premium bills). To **make** a bourbon, commit matching resource cards from your hand. The **quality** of the resources you commit — Common, Specialty, or Heritage — sets the bourbon's quality tier, which gates the premium end of the payoff matrix and demand.

Spent resource cards go to the **communal discard** (they are consumed — one-shot — not returned to your hand; there are no personal decks). The new bourbon enters your rickhouse at **age 0**.

### Aging is set-and-forget

This is true to real bourbon: once it's in the barrel, you don't add anything to it. A bourbon in your rickhouse simply ages **+1 each round**, automatically, at the Year Pass. There is no aging cost, no card to feed it, no maintenance. The only decision aging asks of you is **when to stop aging and sell**.

A bourbon must be **age 2 or older** (and have aged at least one full round) before it can be sold.

### Premium resources and the magic thread

A premium (Specialty / Heritage) cask costs more Capital to acquire and is consumed like any other resource. It is *not* worth it in a cheap bourbon — you'll spend more than you earn. It is marginal in an expensive bourbon at low demand, good at high demand, and — once you have the slot, the marketing, and the engine aligned — it pays off enormously. Premium resources gate the high end: you cannot reach the top of the matrix without them. Spend up only when the context will pay you back.

---

# 📊 The Demand Market

Demand is a single shared track, **0–12**, starting at 0. Every player sells against the same demand.

- **Selling drops demand by 1** (floor 0). Flooding the market cools it.
- **Demand moves each round** at the Year Pass, per the forecast.

The payoff matrix on each mash bill is keyed on **(age × demand)** — higher demand and older bourbon pay more. Reading the market and timing your sale into a favorable window is the central tactical skill.

---

# 🔮 The Demand Forecast

Two forecast cards are visible at all times. Each is a **boost** to demand — forecasts only ever raise demand, never crash it — and many carry a simple condition.

- **Example forecast cards:** `+1`, `+2`, `+1 if demand < 6`, `+2 if demand < 4`.
- Conditional forecasts only fire when their threshold is met, so a cold market is easy to boost and a hot market resists further heating. This self-limits how high the table can push demand.

### Activating a forecast (the coordination puzzle)

Once per round, during your turn, for **free** (no action cost), a player may **activate** one of the visible forecast cards. This resolves the forecast's demand move **immediately** — but the activating player **does not get to act on the new demand themselves on that activation.** The benefit lands for whoever comes next.

This creates a gentle table-wide **coordination puzzle**. Demand is 4; if every player activates a boost before anyone sells, the table can lift demand to 7 or 8 and *everyone* sells into a rich market. But the moment a player **sells** (defects), they take the high window for themselves and cool the market for everyone after. Building demand is a shared good; cashing it in is a private one. Reading how much the players after you will consume before demand loops back to you — and deciding whether to keep boosting or sell now — is the puzzle.

Because forecasts are boost-only, activating one can never *hurt* another player; it can only help, and the only question is whom it helps most. The rotating start player equalizes seat-order advantage over a game.

---

# 🏚️ The Rickhouse

A small intermediate area where bourbons age before they're sold and placed.

- **Capacity:** 4 barrels (hard cap). Expandable later via investments.
- Bourbons enter at age 0, age +1 per round, and leave when sold.
- A full rickhouse blocks Make Bourbon — manage your space by selling.

The rickhouse is the production throttle. The volume player needs to keep it cycling (sell often to make room); the premium player keeps a few barrels aging long. Space is the squeeze.

---

# 💰 Selling

Sell any eligible aging bourbon — **age ≥ 2**, aged at least one full round — for 1 action.

### Sale resolution

1. **Read the matrix.** Look up the bourbon's `(age, demand)` cell on its mash bill's payoff grid.
2. **Apply engine modifiers.** Add the destination slot's base reward and any trait-matched marketing bonuses on the brand line it's placed into (see Placement).
3. **Bank Capital** equal to the total.
4. **Demand drops 1** (floor 0).
5. **Place the bottle.** The sold bourbon becomes a **bottle** and must be placed into one of your brand lines (or it cannot be sold). See [§Placement](#-placement).

The matrix is the heart of the timing decision: older bourbon and higher demand both pay more, and premium-quality bourbons reach matrix cells that common ones cannot.

---

# 🏷️ Brand Lines (the engine)

Your brand lines are your distillery's product portfolio — and the engine of the game. Each is a **slot card**: a row of **up to 6 slots** running **left (young / entry) to right (aged / premium)**.

### Opening a brand line

Open a new line with the **Open Brand Line** action: 1 action + **1 Capital** (escalating — each additional line costs more). Going wide (many lines) is a real investment, balanced against going deep (a few rich lines).

### The age-ceiling staircase

The one hard placement rule: a brand line's bottles must read in **non-decreasing age order, left to right** (ties allowed — this is forgiving). Young bourbon goes left; older bourbon goes right.

- The **rightmost-anchored bourbon's age sets the line's ceiling** — everything to its left must be at most that age.
- There is **no rule against "wrong" placements.** You *may* anchor a young common bourbon on the right; the game simply won't reward it well, because the payoff matrix and slot rewards make the mismatch unprofitable. The discipline is emergent, not enforced.

### Slot rewards

Each slot prints its own reward, fired the moment a bottle fills it — small utilities like **+1 Capital**, **+1 resource card**, **+1 prestige**, draw a card. Rewards typically scale with position: premium right-hand slots pay more. The slot rewards are the cozy floor — every placement is worth *something*, even with no marketing attached.

> **Carve-out — the Workhorse Line.** The Workhorse Line is the deliberate exception to "rewards scale with position." It prints **six flat, position-independent slots** (every slot pays the same modest reward, left to right) and no end-game house-style bonus. It rewards **breadth and volume rather than efficiency or aging discipline**: there is no incentive to anchor high or to sequence quality, so the line cashes equally on a wall of cheap young bourbons. It is the home of the Volume / mid strategy — fill it fast, fill it wide, and ignore the staircase tension that drives the other cards.

---

# 🎚️ Placement (the central decision)

When you sell a bourbon, you place its bottle into a brand-line slot. This is the game's defining decision: **floor vs. ceiling, matched to the bourbon's quality.**

- **Place low (floor).** A modest slot reward, but you **preserve the line's ceiling** — everything to the right can still climb to premium and aged, hitting the big matrix payoffs later. A cheap bourbon placed low reliably returns its modest reward and keeps the line open to greatness above it.
- **Place high (ceiling).** A bigger immediate reward (the "take the max" anchor), but you **cap the whole line** at that bourbon's age. Anchor a young common bourbon high and you've spent your ceiling on something that can't deliver the premium payoffs — and capped everything beneath it.

The lesson the game teaches through its payoffs, never through rules: **cheap, young bourbons belong low; premium aged bourbons earn the high anchors.** Mismatching wastes either a ceiling or a premium bourbon.

This single decision supports three viable strategies, each throttled differently:

- **Premium / tall** — few bourbons, premium resources, aged high, anchored high, hitting the full matrix. Huge per-sale payoffs; throttled by long build time and cost.
- **Volume / mid** — churn out 4-year workhorses, place across many slots, steady rewards. Throttled by demand-crash (flooding cools your own market).
- **Floor / reliable** — cheap commons placed low, preserving ceilings, steady small returns. Throttled by the opportunity cost of the ceilings you're not yet using.

---

# 🪧 Marketing Cards (identity & prestige)

Marketing cards layer a **brand identity** onto a line and are the source of **prestige**.

- **Acquire** via the Draft Marketing action: 1 action + 1 Capital (first card of the game free), draw 3, keep 1, **attach immediately** to a brand line. No inventory — you commit on draft.
- **Mutually exclusive** where they conflict: a *rye-only* card and a *wheated-only* card cannot share a line. Attaching one forecloses incompatible identities for that line.
- **Trait-gated:** a placed bottle fires only the marketing cards whose traits it matches. An off-identity bottle simply doesn't fire the card — no penalty, no retroactive breakage.
- **Stackable** up to **3** per line. Stacking *narrows* the bourbons that qualify while *raising* the payoff — a tall stack pays out fully only for a bourbon that hits every trait, which is rare and expensive to produce. The stack self-throttles: rich payoffs demand coherent, specific production.

Marketing rewards **prestige**, which converts to Capital at the end of the game.

### Example marketing card — "Premium Rye"

> *Rye-only line. When you place a rye bourbon here, gain prestige scaling with its age. Non-rye bottles score nothing from this card.*

Rewards exactly what the name promises — aged rye — and gently disincentivizes diluting the line, without ever blocking a placement.

---

# ↔️ Cascades

Every bourbon carries a small **on-placement cascade** effect — a minor utility like *draw 1 resource* or *gain 1 prestige*, printed on the bourbon.

- When you place the bottle, choose a **direction** — up the line or down the line.
- The cascade fires across **every bourbon already in the chosen direction** (it scales with how many bourbons sit that way). A long, coherent line pays a bigger cascade.
- Cascade effects are always on the **utility / prestige** axis, never raw Capital — they're grease for the engine, not fuel, so they never run away.

Choosing a direction gives you agency and rewards building a consistent progression. Early-game cascades are small (short lines); they grow as your engine comes online — reinforcing the satisfying arc of a maturing distillery. Lean on slot rewards and sale Capital to carry the opening turns while cascades build.

---

# 🪙 Capital and Scoring

**Capital** is both the spendable currency and the final score.

### Earning Capital
- Selling bourbon (the matrix value + engine modifiers).
- Slot rewards that print Capital.

### Spending Capital
- **Premium resources / better cards** from the market (the primary sink — basic resources come free from Draw Resources; Capital buys up in quality).
- **Investments** — permanent engine upgrades (a later addition; the catalog finally gets a currency to be bought with).
- **Opening brand lines** — +1 Capital, escalating.
- **Drafting marketing** — +1 Capital per draft (first free).
- **Extra actions** (optional, braked) — a flexibility valve with escalating cost / a hard per-round cap, since Capital→actions→more-Capital is the one runaway risk.

Unspent Capital banks toward your final score, creating the reinvest-vs-bank tension.

### Three scoring sources, three jobs
- **Selling → Capital** (timing skill — your running score).
- **Slots → cards / actions / utility** (engine fuel — capability, not direct score).
- **Marketing → prestige → end-game Capital** (coherence — deferred score).

### Final score
**Capital + Reputation** (prestige converted in). Most points wins; tiebreak: most bourbons sold.

---

# ⏳ The Clock

The game ends when the **mash bill supply is exhausted** — bills leave the supply only through the Draw Mash Bills action (one keep per use, bounded and roughly equal across players), so no single player can slam the end shut far ahead of the others. When the supply empties, finish the current round so every player gets an equal number of turns, then score.

---

# 🧑‍🤝‍🧑 Player Count & Solo

Designed for **1–4 players**.

- **Solo** — a parallel engine-builder against the clock (and an optional automa in a later batch). The shared-demand coordination puzzle collapses to a pure timing-against-the-forecast game, which solo handles cleanly.
- **2–4** — the demand-coordination puzzle is the social heart: cooperate to inflate demand, or defect to cash it in. The more players, the richer the commons dynamic.

There are **no direct attacks** at any player count — competition is entirely at the shared edges (the market, the trays, the demand commons, racing the clock).

---

# 🔁 The Core Loop

Collect resources → build a bourbon (quality set by what you commit) → let it age in the rickhouse → read the demand forecast and **sell at the right time** → **place the bottle** low (preserve) or high (anchor) in a brand line → fire slot rewards, cascades, and trait-matched marketing → bank Capital, build prestige → spend Capital on better resources, more lines, marketing, and investments → repeat until the bills run dry → score Capital + Reputation.

---

# 🥃 Final Thought

Bourbonomics isn't about making bourbon.

It's about **patience** — knowing what to age, when the world is ready to pay, and where each bottle belongs in the story of your brand.

---

# 📜 Versioning

This document is **v2** — the canonical rules for the redesigned cozy engine-builder. It is authoritative over any prototype implementation. The prototype lives isolated at `prototype.bourbonomics.com` and is built in discrete batches; this rulebook describes the intended whole, while the prototype implements it incrementally (Batch 1: core single-player loop; later batches add the demand-coordination activation, cascades, marketing depth, investments, bots, and multiplayer).
