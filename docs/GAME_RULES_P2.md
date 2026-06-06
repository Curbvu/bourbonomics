# 🥃 Bourbonomics P2

A cozy engine-building game about building a bourbon distillery — one barrel at a time. You collect resources, build bourbons, age them quietly in the rickhouse, and sell them into a shared market at the right moment. The bourbons you sell become bottles in your **brand lines** — and your brand lines are the engine. Build the best portfolio of bourbon when the supply runs dry and you win.

**Players:** 1–4 · **Length:** ~45–60 min · **Complexity:** Medium-light

> **A note on this redesign.** Bourbonomics **P2** is a ground-up reconception, not an iteration on the **P1** line (the original live game, whose rules live in [`GAME_RULES.md`](GAME_RULES.md)). It keeps the theme (mash bills, aging, demand, selling) and the age × demand payoff matrix, and discards almost everything else. There is no dual rickhouse-and-portfolio rep economy, no doomsday-clock-as-only-spine, no aging-as-card-tax, no per-slot recipe gating. Instead the game is built around two decisions repeated all game: **when to sell a bourbon**, and **where to place it in a brand line**. Everything else serves those two. The design lane is deliberately cozy — production-focused, gentle competition, no direct player attacks — aimed at the bourbon-enthusiast and gift market. This document is the canonical rules for P2 and is authoritative over any prototype code.
>
> **Doc vs. prototype.** This rulebook describes the intended whole. The prototype implements it in batches, so a few sections below describe mechanics that are **designed but not yet built** — each is tagged **`🔮 PLANNED`**. Everything untagged matches the current prototype.

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
2. **Resource pool.** Shuffle the **communal resource deck** (casks, corn, grain — in Common / Specialty / Heritage qualities). It is shared by all players; there are no personal decks. Deal **8 face-up** as the **resource market** (take-and-refill), and place a discard space beside the deck.
3. **Mash bill supply.** Shuffle the mash bills face-down. Deal **3 face-up** as the mash bill tray (take-and-refill). The remaining face-down supply is the **doomsday clock** — when it empties, the game ends.
4. **Slot card supply.** Lay out the slot cards by design (**5 frozen designs**, 12 copies each) where every player can reach them. They are abundant and drawn freely.
5. **Marketing tray.** Shuffle the marketing cards; reveal a face-up tray of **4**.
6. **Players.** Each player takes a player board (rickhouse + brand-line area) and starts with **5 Capital**, **0 prestige**, and an **empty hand** (you gather your first resources on your turn).
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
| **Draw Resources** | 1 action | Draw **3** resource cards blind off the communal deck into your hand. |
| **Take Market Resources** | 1 action | Take **3** of the **8** face-up cards from the resource market; the market refills from the deck. Lets you pick quality on purpose. |
| **Draw Mash Bills** | 1 action | Keep **1** of the 3-card mash bill tray; it lays down as an **unbuilt barrel** resting in your rickhouse (it shows the recipe it needs and does **not** age yet). Take-and-refill; drains the bill supply (the clock). |
| **Make Bourbon** | 1 action | Commit the **exact recipe** of resource cards from your hand into one of your **resting unbuilt barrels**. It builds, sets its quality from the best card committed, and begins aging at **age 0**. Spent cards go to the communal discard. |
| **Draw Slot Card** | 1 action | Take one of the five slot-card designs into your hand of slot cards (to spend later on Open Brand Line). No Capital cost. |
| **Open Brand Line** | 1 action + Capital | Spend a slot card you hold and pay **+1 Capital** (escalating per additional line) to open it as a new brand line. |
| **Draft Marketing** | 1 action + Capital | Pay **+1 Capital** (the first marketing card of the game is free), keep **1** from the face-up marketing tray, and **attach it immediately** to a brand line. No marketing inventory. |
| **Sell Bourbon** | 1 action | Sell an eligible **built**, aged bourbon. Bank Capital, place the bottle. See [§Selling](#-selling). |

The **rickhouse holds at most 4 barrels** (hard cap), counting both resting unbuilt barrels and aging built ones. When it is full you **cannot lay down a new barrel** (Draw Mash Bills is blocked) — build and sell to make room. Future investments may expand it.

> **Two-step production.** Making a bourbon takes **two actions across the game**: first **Draw Mash Bills** lays the recipe down as a resting barrel; later **Make Bourbon** commits the resources to build it. The gap is deliberate — you can reserve a recipe early and gather the right resources before committing.

---

# 🛢️ Building and Aging Bourbon

### Lay down, then build

Each mash bill is a recipe — a set of resource requirements (some mix of cask + corn + grain). Production is a **two-step** sequence:

1. **Draw Mash Bills** keeps a recipe and lays it down as an **unbuilt barrel** resting in your rickhouse. It displays the recipe it needs, takes up a rickhouse slot, and does **not** age while unbuilt.
2. **Make Bourbon** commits the **exact recipe** of resource cards from your hand into that resting barrel (no missing cards, no extras). The barrel builds, begins aging at **age 0**, and its **quality** — Common, Specialty, or Heritage — is set by the **best** card you committed. Quality gates the premium end of the payoff matrix.

Spent resource cards go to the **communal discard** (they are consumed — one-shot — not returned to your hand; there are no personal decks).

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

Two forecast cards are visible at all times. They schedule how demand will move at the next Year Pass, so the whole table can plan around them. Most are upward, but the deck also holds flat and small downward swings.

- **Forecast cards in the prototype:** `+1`, `+2`, `+1 if demand < 6`, `-1`, and `no change`.
- A conditional forecast (e.g. `+1 if demand < 6`) only fires when its threshold is met, so a cold market is easy to lift and a hot one resists further heating. This self-limits how high demand climbs.
- At the **Year Pass**, the front forecast card resolves automatically (applying its move if its condition holds), then the next card is revealed — so you can always see the next two moves coming.

### 🔮 PLANNED — Activating a forecast (the coordination puzzle)

> *Not yet in the prototype. Today demand advances automatically at the Year Pass (above); players cannot trigger forecasts. The mechanic below is the design target for a later batch, and assumes a boost-only forecast deck.*

Once per round, during your turn, for **free** (no action cost), a player may **activate** one of the visible forecast cards. This resolves the forecast's demand move **immediately** — but the activating player **does not get to act on the new demand themselves on that activation.** The benefit lands for whoever comes next.

This creates a gentle table-wide **coordination puzzle**. Demand is 4; if every player activates a boost before anyone sells, the table can lift demand to 7 or 8 and *everyone* sells into a rich market. But the moment a player **sells** (defects), they take the high window for themselves and cool the market for everyone after. Building demand is a shared good; cashing it in is a private one. Reading how much the players after you will consume before demand loops back to you — and deciding whether to keep boosting or sell now — is the puzzle.

With a boost-only forecast deck, activating one can never *hurt* another player; it can only help, and the only question is whom it helps most. The rotating start player equalizes seat-order advantage over a game.

---

# 🏚️ The Rickhouse

A small intermediate area where bourbons age before they're sold and placed.

- **Capacity:** 4 barrels (hard cap), counting both resting unbuilt barrels and aging built ones. Expandable later via investments.
- A resting barrel takes a slot but does not age; a built bourbon ages +1 per round and leaves when sold.
- A full rickhouse blocks **laying down a new barrel** (Draw Mash Bills) — build and sell to make room.

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

- **Acquire** via the Draft Marketing action: 1 action + 1 Capital (first card of the game free), keep 1 from the face-up marketing tray, and **attach immediately** to a brand line. No inventory — you commit on draft.
- **Mutually exclusive** where they conflict: a *rye-only* card and a *wheated-only* card cannot share a line. Attaching one forecloses incompatible identities for that line.
- **Trait-gated:** a placed bottle fires only the marketing cards whose traits it matches. An off-identity bottle simply doesn't fire the card — no penalty, no retroactive breakage.
- **Stackable** up to **3** per line. Stacking *narrows* the bourbons that qualify while *raising* the payoff — a tall stack pays out fully only for a bourbon that hits every trait, which is rare and expensive to produce. The stack self-throttles: rich payoffs demand coherent, specific production.

Marketing rewards **prestige**, which converts to Capital at the end of the game.

### Example marketing card — "Premium Rye"

> *Rye-only line. Each time you place a rye bourbon here, gain a fixed amount of prestige. Non-rye bottles score nothing from this card.*

Rewards exactly what the name promises — and gently disincentivizes diluting the line, without ever blocking a placement. (Each marketing card pays a flat prestige amount per trait-matched placement; tuning these payoffs is pre-playtest.)

---

# ↔️ Cascades · 🔮 PLANNED

> *Not yet in the prototype. Bottles currently fire their slot reward and any trait-matched marketing on placement, but carry no cascade. The mechanic below is the design target for a later batch.*

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
- **Opening brand lines** — +1 Capital, escalating per additional line.
- **Drafting marketing** — +1 Capital per draft (first of the game free).
- **🔮 PLANNED — Premium resources / better cards.** Today both Draw Resources and Take Market Resources are free (you pay only an action; the market just lets you pick quality on purpose). A paid market that makes Capital "buy up in quality" is a design target for later.
- **🔮 PLANNED — Investments** — permanent engine upgrades (the catalog finally gets a currency to be bought with).
- **🔮 PLANNED — Extra actions** (optional, braked) — a flexibility valve with escalating cost / a hard per-round cap, since Capital→actions→more-Capital is the one runaway risk.

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

This document is the canonical rules for **Bourbonomics P2** — the redesigned cozy engine-builder — and is distinct from **P1**, the original live game (rules in [`GAME_RULES.md`](GAME_RULES.md)). It is authoritative over any prototype implementation. P2 is now the primary product and serves the apex root at `playbourbonomics.com` (workspaces `apps/prototype` + `packages/prototype-engine`); the P1 live game has been retired to `legacy.playbourbonomics.com`. P2 is built in discrete batches; this rulebook describes the intended whole, while the prototype implements it incrementally.

**Currently in the prototype:** the full single-player loop — the eight actions (Draw Resources, Take Market Resources, Draw Mash Bills, Make Bourbon, Draw Slot Card, Open Brand Line, Draft Marketing, Sell Bourbon), the two-step rest→build production, the age × demand selling matrix, the five frozen slot cards with their reward specs and the Expressions house-style bonus, trait-gated stackable marketing, the automatic Year-Pass demand forecast, and Capital + prestige scoring with the bills-run-out clock.

**Tagged `🔮 PLANNED` above (not yet built):** player-activated demand forecasts (the coordination puzzle) and on-placement cascades. Also deferred to later batches: investments, extra-action buying, bot/AI heuristics, and multiplayer/networking. All content and balance values are **placeholder, pre-playtest**.
