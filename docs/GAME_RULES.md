# 🥃 Bourbonomics

A cozy game about running a bourbon distillery — gathering grain, building and aging bourbon in your rickhouse, and selling it into a shared, forecastable demand market at the right moment. You grow your distillery's departments over the game to draw harder, hold more, and sell richer. When the supply runs dry, the distillery with the most Capital and Reputation wins.

**Players:** 2–6 · **Length:** ~45–60 min · **Complexity:** Medium-light

> **The design.** This is a **ground-up revision** of Bourbonomics. The previous version turned on *when to sell* and *where to place a bottle in a brand line*. Brand lines, placement, and slot cards are **removed**. The game now turns on a **three-phase round** — Demand, Collect, Play — with a **shared dice-draft collection** and a **department-growth engine**. The lane is still deliberately cozy: production-focused, gentle competition, **no direct player attacks**, aimed at the bourbon-enthusiast and gift market. This document is the canonical ruleset and is authoritative over any code: if doc and code disagree, fix the code. All numbers are **`[PH]` placeholders, pre-playtest** — wired to be adjustable, not yet balanced.

> **⚠️ Open design — deliberate stubs.** Three systems are intentionally **not yet designed** and are marked `🚧 TBD` throughout. They are stubbed, not forgotten, and must be revisited before the game is complete:
> 1. **The engine / what you build toward.** With brand lines gone, the game needs a spine beyond timing. *Stubbed.*
> 2. **The prestige source.** Prestige is half the final score but currently has no defined origin. *Stubbed.*
> 3. **Dice → quality detail.** Dice faces name resource *types*; quality (Specialty) is mixed blind into the decks. The exact quality distribution and how it gates payoff is *stubbed.*
>
> Until these are resolved, the game is playable as a resource-timing race but lacks its strategic core. Do not invent designs for these — leave them as stubs.

---

# 🎬 Setup

1. **Resource piles.** Build **five face-down piles** — **cask, corn, rye, wheat, barley** — one per resource type. Each pile is its own shuffled stack. **Specialty cards are mixed blind into the decks** (`🚧 TBD` distribution). Piles are shared; there are no personal decks. Place a discard space beside each pile (discards reshuffle back into their own pile when it empties).
2. **Mash bill supply.** Shuffle the mash bills face-down into a single supply. Mash bills are drawn from this supply during the Play Phase (see [§Play Phase](#-3-play-phase)); the supply is the **clock** — when it empties, the game ends. (The original mash-bill identities and the age × demand payoff matrix carry forward unchanged.)
3. **Demand deck.** Shuffle the demand deck. *(Demand cards are `🚧 placeholder` — see [§Demand Phase](#-1-demand-phase).)*
4. **Resource dice.** Set out the shared pool of **resource dice**. Each die has six faces: **cask, corn, rye, wheat, barley, anything**.
5. **Players.** Each player picks a **distillery** (its board carries the five departments + a signature ability — see [§The Distillery](#-the-distillery)) and starts with **5 Capital** (`[PH]`), **0 prestige**, and an empty warehouse.
6. Determine seating; first-player order each round is set by Capital (see below).

---

# 🔄 The Round

A round has **three phases, in order**:

1. **Demand Phase** — lay out the round's demand.
2. **Collect Phase** — one pass around the table; players roll and draft resource dice.
3. **Play Phase** — round-robin; players take unlimited actions.

At the end of the Play Phase, every bourbon in every rickhouse **ages +1**, and a new round begins. Time advances once per round.

---

## 📊 1. Demand Phase

The round's demand is laid out for all players to see and plan around.

- Demand cards are **`🚧 placeholder`** — their exact content (tags, thresholds, payoff shaping) is not finalized. Use the prior version's demand cards as a **temporary stand-in** so the rest of the loop is testable.
- The **Marketing Department** determines how demand is shaped this round — for example, **how many demand cards are laid down**, and/or a **draw-and-select** mechanic that lets the player influence which demand appears. *(Exact Marketing Department effect is `[PH]`; it is the demand-shaping department.)*

Demand laid out in this phase holds for the **entire round** — every player sells against the same demand picture, which is what makes the market forecastable.

---

## 🎲 2. Collect Phase

Players gather resources by drafting **resource dice**, in **one pass around the table**.

**Turn order: most Capital goes first.** The player with the most Capital takes the first collect turn, then play proceeds around the table. *(This is deliberate: the leader gets first pick of a fresh roll, while later players inherit a growing pool of pre-rolled dice to keep or reroll — optionality that compensates for going later. Ties broken by `[PH]`.)*

**On your collect turn:**

1. **Inherit.** Take any **leftover dice** passed from the previous player. You may **keep** any of them as-is, or set the rest aside to reroll.
2. **Roll up to your Supply cap.** Your **Supply** department sets how many dice you may have in play. Roll fresh dice (and reroll the inherited dice you didn't keep) up to that cap. *(Inherited-kept dice + freshly rolled dice together cannot exceed your Supply cap.)*
3. **One reroll.** You may reroll any dice you don't like **once**. *(A Supply department upgrade grants a **second reroll** — see [§The Distillery](#-the-distillery).)*
4. **Take resources.** For each die you choose to **claim**, draw one card from the matching pile (quality blind): a type face draws from that type's pile; an **anything** face draws from any one pile you choose. You may claim up to what fits in your **Warehouse**.
5. **Hold limit.** You can only hold the number of resource cards that **fit in your Warehouse** department. You cannot claim resources you have no room to hold.
6. **Pass.** Any dice you did **not** claim are passed to the next player as their inheritance.

The pass goes once around the table; when the last player finishes and passes, the Collect Phase ends and leftover dice return to the pool.

> **Why the pass matters.** Rejected dice aren't waste — they're **optionality handed to the next player**, who can lock in a good face you declined or reroll it for their own needs. Going later in the order means a smaller fresh roll but a richer inherited buffet.

---

## ⚙️ 3. Play Phase

Players take turns **round-robin**. There is **no action economy** — on your turn you may take an **unlimited number of actions**, constrained only by your **resources, your departments, and your rickhouse/warehouse capacity**.

The actions available in the Play Phase:

| Action | Effect |
|---|---|
| **Draw Mash Bills** | Draw mash bills from the supply and keep them as **resting unbuilt barrels** in your rickhouse. The number you may draw is set by your **Distilling Office** department. **Once per turn.** Rejected/undrawn bills cycle back into the supply. Drains the clock. |
| **Make Bourbon** | Commit the **exact recipe** of resource cards from your warehouse into a resting unbuilt barrel. It builds, sets its **quality from the best card committed**, and begins aging at **age 0**. Spent cards go to their matching pile discards. |
| **Sell (Extract)** | Extract one sale from an eligible **built, aged** batch (age ≥ 2). Bank the `(age × demand)` matrix value; sell bonuses are set by your **Tasting Room** department. See [§Selling](#-selling). |
| **Improve Distillery** | Pay Capital to advance one department one step along its growth path. Cost rises **linearly** with each improvement you've already made (see [§The Distillery](#-the-distillery)). Permanent, no upkeep. |

> **Once-per-turn mash bills.** Each player may **Draw Mash Bills only once per turn**. Everything else may be repeated as resources and capacity allow.

> **Two-step production carries over.** Making a bourbon is still two steps across the game: **Draw Mash Bills** lays a recipe down as a resting barrel; **Make Bourbon** commits resources to build it. The gap lets you reserve a recipe and gather the right resources before committing.

---

# 🛢️ Building and Aging Bourbon

### Lay down, then build

Each mash bill is a recipe naming specific piles (some mix of cask, corn, and named grains: rye / wheat / barley). A *high-rye* bill needs **rye**; a *wheated* bill needs **wheat**.

1. **Draw Mash Bills** keeps a recipe and lays it down as an **unbuilt barrel** resting in your rickhouse. It takes a rickhouse slot and does **not** age while unbuilt.
2. **Make Bourbon** commits the **exact recipe** of resource cards (no missing cards, no extras). The barrel builds, begins aging at **age 0**, and its **quality** is set by the **best** card committed. *(How quality gates payoff is `🚧 TBD` pending the dice/quality decision.)*

### Aging is set-and-forget

A bourbon in your rickhouse ages **+1 each round**, automatically, at the end of the Play Phase. No aging cost, no maintenance. The only decision aging asks is **when to stop aging and sell**. A bourbon must be **age 2 or older** before it can be sold.

---

# 🏚️ The Rickhouse

A small area where bourbons rest, build, and age before they're sold.

- **Capacity** is set by your **rickhouse** (a department / growth path), counting both resting unbuilt barrels and aging built ones. Starts small; grow it to hold more.
- A resting barrel takes a slot but doesn't age; a built batch ages +1 per round and leaves only when its **last** sale is extracted.
- A full rickhouse blocks **Draw Mash Bills** — build and sell to make room.

The rickhouse is the production throttle and the primary limiter on the clock.

---

# 🏭 The Distillery

Each player runs a **distillery board** of **departments** grown over the game. Departments are **permanent** with **no upkeep**. Grow one with the **Improve Distillery** action: pay the next step's Capital cost and advance it along its growth path.

**The five departments (`[PH]`):**

- **Supply** — how many **dice** you may roll/hold in the Collect Phase. A Supply upgrade also grants a **second reroll**. *(The input-throughput department.)*
- **Warehouse** — how many **resource cards** you may hold (your hand/storage cap).
- **Distilling Office** — how many **mash bills** you may draw per Draw Mash Bills action.
- **Tasting Room** — your **sell bonuses** when you Sell (Extract). *(Exact bonus shape `[PH]`.)*
- **Marketing Department** — how **demand is shaped** in the Demand Phase (cards laid down, draw/select). *(Exact effect `[PH]`.)*

*(More departments may be added later; five is the current set.)*

### Linear improvement cost

Each improvement you make costs **more Capital than the last, rising linearly** (`[PH]`: e.g. 1 → 2 → 3 → 4 …). The counter is **per player** and **persists all game** — your Nth improvement (across any department) costs the Nth step on the ramp. This caps how built-out any one engine gets and forces you to choose which departments to grow and in what order, balanced against banking Capital toward your score.

### Asymmetric distilleries

At setup each player picks a **distillery**. The department menu is the same for everyone, but distilleries differ by **cost profile** (which growth paths are cheap), **starting positions / caps**, and a **signature ability** (a sale-time or phase edge). *(Roster carried/adapted from the prior version is `[PH]` and will be revisited alongside the stubbed engine.)*

---

# 💰 Selling (Extraction)

A bourbon is a **batch**: a built barrel yields a fixed number of sales over its life — its **`batchQty`**. Each sale is an **extraction**: in the Play Phase, Sell one eligible aging batch — **age ≥ 2**, with sales remaining.

### Extraction resolution

1. **Read the matrix.** Look up the batch's `(age, demand)` cell on its mash bill's payoff grid and **bank that Capital**. Apply **Tasting Room** sell bonuses.
2. **Decrement** the batch's remaining sales by 1.
3. **Final sale** additionally cools demand and frees the rickhouse slot. *(Completion bonus / what the final sale produces is tied to the `🚧 TBD` engine — stubbed.)*

The matrix is the heart of the timing decision: older bourbon and higher demand both pay more.

---

# 🪙 Capital, Prestige, and Scoring

**Capital** is the spendable currency and half the final score.

### Earning Capital
- Selling bourbon (matrix value + Tasting Room bonuses).

### Spending Capital
- **Improving the distillery** — the linear-ramp cost of each department step.

### Prestige
- Prestige is kept and converts to Reputation at game end. **Its source is `🚧 TBD`** (the old source — marketing on brand lines — is removed). Stubbed pending the engine decision.

### Final score
**Capital + Reputation** (prestige converted in). Most points wins. *(Tiebreak `[PH]`.)*

---

# ⏳ The Clock

The game ends when the **mash bill supply is exhausted**. Bills leave the supply only via Draw Mash Bills (once per turn per player, count set by Distilling Office). When the supply empties, finish the current round so every player gets an equal number of turns, then score. Rickhouse capacity is the practical throughput limiter that keeps the clock from being slammed shut.

---

# 🧑‍🤝‍🧑 Player Count

Designed for **2–6 players**. There are **no direct attacks** at any count — competition is entirely at the shared edges (the dice pool and its pass, the demand commons, the mash-bill supply, racing the clock). The Collect Phase pass and the most-Capital-first order scale naturally across the range.

---

# 🔁 The Core Loop

**Demand Phase** (Marketing shapes the round's demand) → **Collect Phase** (roll, inherit, keep/reroll, claim resources into your Warehouse, pass leftovers) → **Play Phase** (draw mash bills once, make bourbon, sell into the demand window with Tasting Room bonuses, improve departments) → age all bourbon +1 → repeat until the bills run dry → score Capital + Reputation.

---

# 📜 Versioning & Open Questions

This is a **ground-up revision** of Bourbonomics. It **keeps**: the five resource types, the original **mash bills** and the **age × demand payoff matrix**, the rickhouse + two-step build-and-age production, prestige, the bills-run-out clock, and the cozy / no-attacks lane. It **removes**: brand lines, placement, slot cards, marketing cards as a prestige source, and the 6-action budget.

**Deliberate open stubs (must be revisited):**
1. 🚧 **The engine** — what players build toward now that brand lines are gone.
2. 🚧 **Prestige source** — where prestige originates.
3. 🚧 **Dice/quality detail** — Specialty distribution in the decks and how quality gates payoff.

All values are **placeholder, pre-playtest**.
