# 🥃 Bourbonomics

A cozy game about running a bourbon distillery: gather grain through a shared dice draft, build and age bourbon in your rickhouse, and sell it into a shared, forecastable demand market at the right moment. Grow your distillery's departments to draw harder, hold more, and sell richer. Each demand order you complete becomes a kept card worth Prestige. When the market is worked dry, the distillery with the most Capital + Prestige wins.

**Players:** 2–6 · **Length:** ~45–60 min · **Complexity:** Medium-light

> **The heart of the game.** Bourbonomics turns on one repeated decision — **when and what to sell into a shifting demand market** — and one long arc — **growing your distillery to sell better**. The lane is deliberately cozy: production-focused, gentle competition, **no direct player attacks**. "I take more" is allowed; "you get less / you lose X" aimed at an opponent is not.

---

# 🎬 Setup

1. **Resource piles.** Five face-down piles — **cask, corn, rye, wheat, barley** — one per type. **Quality (Common / Uncommon / Rare / Epic / Legendary) is mixed blind into each pile** (Legendary rare). Piles are shared; resources are effectively infinite. A discard beside each pile reshuffles into its own pile.
2. **Resource dice.** A shared pool of dice, each with six faces: **cask, corn, rye, wheat, barley, anything**.
3. **Demand deck.** Shuffle the demand cards into the demand deck. Deal the starting market (see §Demand Phase).
4. **Mash bills.** Shuffle the mash bills into a supply (reshuffles when drawn-from is exhausted; see §The Clock).
5. **Players.** Each picks a **distillery** (a board of departments with its own per-branch ultimate options). Start with **5 Capital**, **0 Prestige**, an empty warehouse, an empty rickhouse.
6. First-player order is by Capital each round (most Capital first); turn-1 ties are broken randomly.

---

# 🔄 The Round — three phases

```
DEMAND  →  COLLECT  →  PLAY  →  (age all bourbon +1)  →  DEMAND …
```

Time advances once per round (aging at the end of Play). No fixed round count.

---

## 📊 1. Demand Phase

**Draw 1 demand card** and add it to the shared market (the slow drip is what lets the pile climb toward Hot). The game **opens with 2 "any bourbon" cards** so nobody is locked out while producing their first bourbon. Cards **persist** on the table until **completed** (fully filled); a completed card is removed and **kept by the player who completed it** as Prestige. **Partially filled cards still sit on the table and still count** toward the market total.

### Card structure

A demand card is just three things: a **Requirement** (what a bourbon must be to fill a slot — required **tags** / age band / quality; an "any bourbon" card has none), a row of **slots** (`2 × player count`), and the **Prestige** the completer keeps. There are no per-order cash bonuses and no on-start / on-fill / on-completed effects — **filling a slot pays the bourbon's own value** (see §Selling), and **completing the card** (its final slot) hands the whole card to that player as Prestige.

- **Open vs. gated (≈50/50):** about half the deck is **"any bourbon"** — the no-lockout floor (anyone can fill it, but it carries **little Prestige**: the volume / Common outlet). The other half is **gated** — it requires specific tags (and the premium cards add quality+/age+), and is worth **far more Prestige** (the premium outlet). Every slot pays the same way (the bourbon's own value × zone); the **Prestige gap** is the competition: only the matching bourbon fills a gated order, and the bigger Prestige is what makes specializing worth it.
- **Slots per card = 2 × player count** (deep cards), so a single order absorbs a lot of selling and represents a big shared opportunity — a tagged player rushes to fill it before the window closes.
- **The current demand zone** (below) multiplies every sale — the same bourbon banks more Capital filling a slot in a Hot market than a Low one.

### Demand zones (by total cards on the table)

| Cards on table | Zone | Sale multiplier |
|---|---|---|
| 1–3 | **Low** | ×1 |
| 4–5 | **Mid** | ×2 |
| 6 | **Hot** | ×3 |
| **7th card** | **MARKET CRASH** |

The card pile **is** the demand continuum — it persists between rounds, grows as cards arrive (1/round) and lingers (deep cards complete slowly), and shrinks only as cards are completed. Higher zone = cards pay more (the market is starved). This is forecastable: count the pile.

### Market crash (passive overflow)

Checked **at the Demand Phase draw**. If drawing this round's card would bring the table to **7 cards**, instead **wipe all cards currently on the table** (uncompleted cards lost — see *What's lost on a wipe*) and redraw the fresh market toward the starting low state. This is the passive correction if the table backs up without a Hot completion.

### ⭐ Hot completion reset (the tension mechanic)

If a player **completes a card while the zone is Hot (6 cards)**, the market resets — but resolution order is critical:
1. The completer **fully resolves first** — banks their sale at the **×3 Hot** multiplier and **keeps the completed card** (Prestige).
2. **Then** every other card on the table is **wiped** (their completions / Prestige forfeited — see below) and the market **resets to 2 open cards** (Low).

So reaching Hot is a **race to be the first to complete**: first-to-cash takes their ×3 and detonates everyone else's held cards. **Low/Mid completions do NOT reset** the market. Hot is a brief, explosive flashpoint — holding for ×3 is lucrative only if you *win* the window; otherwise a defector's Hot completion (or the 7-card crash) wipes you. No targeted attacks — all pressure is the shared market state.

### What's lost on a wipe (crash or Hot reset)

Uncompleted cards are removed and their **completion reward (the kept card / Prestige) forfeited**. **Capital already banked from intermediate sales is kept** (every sale banked Capital when it happened). So a partial filler keeps their per-sale Capital but loses the shot at that card's Prestige — the *completion* is what's at risk when you hold.

### Marketing Department

The **Marketing Department** shapes the Demand Phase — how many cards you draw, and (at its ultimate) a Private Demand Card only you can fill (see §The Distillery).

---

## 🎲 2. Collect Phase — shared dice draft

**One pass around the table, most-Capital-first.** (Deliberate: the leader rolls a fresh set first; later players inherit a richer pool of pre-rolled dice to cherry-pick, compensating for going later.)

**On your collect turn:**
1. **Draw Mash Bills (recipes first).** Reveal **Mash Floor**-many mash bills and keep any as resting (unbuilt) barrels — pick your recipes *before* you draft, so you know which grain to chase. **Once per turn**; blocked when the rickhouse is full.
2. **Inherit** the leftover dice passed from the previous player. They go straight **onto your table** and **count against your Supply cap**.
3. **Keep, then roll.** Tap the inherited dice you want to **keep**; everything else (plus enough fresh dice to fill your table up to your **Supply** cap) is then **rolled**. *(With no inherited dice — e.g. the first player — you simply roll a full fresh set.)* This first roll is **free**.
4. **One reroll at the base level** — keep what you like, reroll the rest. *(The Supply "Second Reroll" ultimate grants a second.)*
5. **Claim** dice into resources — each claimed die draws the top card of its matching pile (blind quality); an **anything** die draws from any one pile you choose. Claim up to what fits your **Warehouse**.
6. **Pass** all unclaimed dice to the next player.

One loop only; when the last player passes, the phase ends and leftover dice return to the pool. Rejected dice are optionality handed forward, not waste.

---

## ⚙️ 3. Play Phase — unlimited actions

Round-robin. **No action economy** — take unlimited actions, gated only by resources, departments, and capacity.

*(Recipes are chosen earlier — **Draw Mash Bills** happens at the start of your Collect turn, so resting barrels are already on your rickhouse when Play begins.)*

| Action | Effect |
|---|---|
| **Stage** | Move a **recipe-matched** resource card from hand onto a resting barrel. Staged cards leave the hand (free Warehouse) but **lock to that barrel** *(a Warehouse ultimate unlocks them)*. |
| **Make Bourbon** | When a resting barrel's recipe is fully met (staged and/or committed from hand), build it. **Quality = best card committed.** Begins aging at age 0 *(age 1 with the Char & Toast ultimate)*. |
| **Sell (Extract)** | Extract one sale from a built, aged batch (age ≥ 2) into a matching **demand card slot** (no glut). See §Selling. Banks Capital every time. |
| **Improve Distillery** | Advance one department one step. Cost rises on the per-player linear ramp (see §The Distillery). |

---

# 🛢️ Resources, Building, Aging

- **Five types:** cask, corn, rye, wheat, barley. A bourbon's grain identity seeds its matchable **tags** (below), which demand requirements key off.
- **Quality (five tiers):** **Common · Uncommon · Rare · Epic · Legendary**, blind in the piles (Legendary very rare, Common abundant — the rare pull is the thrill). The **best card committed** sets a barrel's tier, which sets its **sale value** (see §Selling). The familiar ladder is colored grey/green/blue/purple/orange.
- **The bourbon rule:** every mash bill requires **exactly 1 cask**, **at least 1 corn**, and **at least 1 grain** (rye / wheat / barley) — no cask/corn-only recipes. More complex bills add more resources.
- **Tags (matchable identity):** every bourbon carries one or more **tags** (seeded with the grain identities — rye / wheat / highCorn / fourGrain / classic). Tags are shown **right-side and color-coded** on both the bourbon card and the demand cards, so filling an order is a visual pattern-match ("my crimson bourbon fills that crimson order"). A demand card's required tags must **all** be present on the bourbon.
- **Sales per barrel by quality:** how many sales a built barrel yields over its life is set by its **quality tier**, NOT its recipe — **Common = 1** (one-and-done), scaling up to **3** at Legendary. A few bills carry a small off-curve variance (e.g. a Common bill that still yields 2).
- **Two-step production:** Draw Mash Bills (at the start of your Collect turn) lays a recipe as a resting (non-aging) barrel; Stage/Make Bourbon (in Play) builds it.
- **Warehouse cap is a claim-time gate** — you can never *claim* past cap; there is no round-end discard. Loose (uncommitted) resource cards count against cap; staged/built cards do not. A lucky premium pull with no matching resting barrel sits loose and eats cap (the premium-hold tension).
- **Aging is set-and-forget:** every built barrel ages **+1 at the end of Play**. **No aging ceiling — barrels age freely.** Sellable at **age ≥ 2**.

---

# 💰 Selling (Extraction) — three age phases, demand as a multiplier

Selling is straightforward. A demand order pays the **bourbon's own value**, scaled by the demand zone — there is no per-order cash bonus, no recipe premium, and no distribution add-on. A sale's Capital is:

```
sale_capital = age_phase_value(quality, age, prime_window) × demand_zone_multiplier
```

**1. Age-phase value — younger / prime / older.** Every mash bill has a **prime window** (e.g. **6–8 years**). A bourbon sells for one of **three** values depending on where its age sits relative to that window:

- **Younger** — sellable (≥ age 2) but **before** its prime window: the low value.
- **Prime** — inside the window `[start, end]`: the **peak** value.
- **Older** — past the window: still good, but **below** prime (the mid value).

The three values scale with **quality** — a Legendary's prime beats a Common's. A barrel under the **minimum sell age (2)** is worth nothing yet. **No rickhouse aging ceiling** — a barrel may keep aging past its window; its value just settles at the *older* tier.

| Quality | younger | **prime** | older |
|:--|:--:|:--:|:--:|
| Common | 1 | **2** | 1 |
| Uncommon | 1 | **3** | 2 |
| Rare | 2 | **4** | 3 |
| Epic | 2 | **6** | 4 |
| Legendary | 3 | **8** | 5 |

The **prime window** is per mash bill (default **6–8**; young-drinking bills prime a touch earlier, showpiece bills a touch later). A bourbon inherits its bill's window when it's built.

**2. Demand zone MULTIPLIER** (the timing swing) — by total cards on the table: a simple **Low ×1 · Mid ×2 · Hot ×3**, applied to the age-phase value. Reaching/cashing **Hot** is a race (see §Hot completion reset) — it's not a zone you can safely sit in.

**There is no glut:** every sale fills a matching open order slot; with no eligible order the barrel waits. A card's slots = `2 × player count`.

*Worked: a **Common in its prime** (value 2) on a **Low** order = 2 × 1 = **2** (floor). The same Common sold **older** (value 1) at **Hot** = 1 × 3 = **3**. A **Legendary in its prime** (value 8) at **Hot** = 8 × 3 = **24**. **Tip:** cash your best barrels **in their window** and time that window against a **hot** market — both levers multiply the same number.*

**Multi-sale batches:** a built barrel yields multiple sales over its life, set by its **quality** (Common 1 → Legendary 3). **Every sale banks Capital** — intermediate or completing. A batch frees its rickhouse slot when its **last** sale is extracted. A Common is one-and-done (fills exactly one slot); higher tiers fill multiple slots, possibly across different orders / rounds — and a barrel can age out of its prime between sales.

**Completing a demand card:** the player who fills a card's **final slot keeps the card** as Prestige. Earlier fillers already banked Capital from their sales; the completer additionally takes the card. (Capital for the work, Prestige for the finish.)

**The magic thread:** a premium (high-quality), **prime-aged** (sold inside its window), well-timed (Hot zone ×3) sale is large because every part multiplies the same number — the big payout emerges from quality × timing.

---

# 🏚️ The Rickhouse

A small area where barrels rest, build, and age.

- **Capacity** (resting + aging barrels) is set by the **Rickhouse department**. Starts at **3 slots**.
- A resting barrel holds a slot but doesn't age; a built batch ages +1/round and leaves when its last sale is extracted.
- A full rickhouse blocks **Draw Mash Bills** — build and sell to make room.
- **No aging ceiling from the rickhouse** — it governs how *many* barrels, not how *old* they may get.

---

# 🏭 The Distillery — departments & branches

Each player runs a distillery board. Departments are **permanent, no upkeep**. The **office band sits above the Rickhouse** (offices = inputs/planning/market; Rickhouse = production anchor below).

### Branch structure

Every department is a branch: **Base → +1 → +1 → Ultimate.** The two mid-steps are quantitative; the **Ultimate is a powerful qualitative effect.** Each distillery offers a **subset of ultimate options per branch** — this is the asymmetric differentiation between distilleries.

### The improvement ramp

**Per-player, linear, persists all game, single shared counter:** your Nth improvement (across any department) costs the Nth step (1→2→3→4…). A player realistically affords ~5–6 improvements all game, so departments **compete for scarce slots** → forced specialization.

### The five departments

| Department | Function | Starter |
|---|---|---|
| **Supply** | Dice rolled in Collect (second reroll folded into the branch) | 4 dice |
| **Warehouse** | Loose resource cards held | 4 cards |
| **Mash Floor** | Mash bills drawn per Draw Mash Bills | 2 |
| **Marketing Department** | Demand cards drawn per Demand Phase; ultimate = a Private Demand Card | 1 |
| **Rickhouse** | Barrel capacity (resting + aging) | 3 slots |

### Branch detail

**Rickhouse** — base 3 → 4 → 5 → ultimate (choose from the distillery's offered subset):
- **Mega Expansion** — +2 slots.
- **Climate Controlled** — one designated barrel ages +2/round.
- **Char & Toast** — every barrel you build starts at age 1.
- **Double Maturation** — a barrel reaching age 8+ gains +1 sale.
- **Warehouse Tasting** — while you have 3+ barrels aging, gain +1 Capital/round.

**Supply** — base 4 → 5 → 6 → ultimate:
- **Second Reroll** — grants **one** reroll after your roll (the base level gets none).
- **Overflow Roll** — +2 dice.
- **Prospector** — pick one pile; claims from it draw 2, keep the better.
- **Triple Threat** — once per Collect turn, discard 2 unwanted dice → take 1 die of any face.

**Warehouse** — base 4 → 5 → 6 → ultimate:
- **Grand Warehouse** — +3 cap.
- **Quality Sort** — once per round, 1 free blind draw from any pile (respects cap).
- **Long Cellar** — staged cards stay swappable (not locked to the barrel).

**Mash Floor** — base 2 → 3 → 4 → ultimate:
- **Master Recipe** — +1 mash bill revealed each Draw.
- **House Blend** — one recipe slot accepts any resource type at build.
- **Open Bill** — one extra Draw Mash Bills each round (off the once-per-turn limit).

**Marketing** — base 1 → 2 → ultimate (a shorter branch):
- **Private Demand Card** — a personal order on your own track that **only you** can fill. It sits **outside the zone/crash count** (it doesn't push zones, doesn't trigger crashes, and survives every wipe) but **pays at the current zone multiplier**. Completing it keeps it as Prestige and immediately draws a replacement; a private completion does **not** trigger the Hot reset.

### Asymmetric distilleries

Each distillery trades a real **weakness** (a department that starts below base, or a hard cap on how far a branch can climb) for a real **strength** (a department that starts a step in, an offered ultimate subset, or a passive signature). The weakness pushes toward the strength's archetype; **Standard** is the balanced, all-base baseline.

| Distillery | Strength | Weakness |
|---|---|---|
| **Standard** | none (balanced generalist) | none |
| **Old Oak Rickhouse** | start Rickhouse 4; aging ultimates | start Supply 3 |
| **Ironhill Volume** | start Supply 5 & Warehouse 5 | Rickhouse capped at 4 |
| **Hollow & Crane** | Marketing one step in; best path to the Private Card | start Warehouse 3 |
| **Copperline Craft** | signature: once/Collect, one claimed card is +1 quality tier; Prospector + Quality Sort offered | start Rickhouse 2 |
| **Coopersmith & Sons** | start Mash Floor 3; Master Recipe + House Blend offered | start Warehouse 3 |

---

# 🪙 Capital, Prestige, Scoring

- **Capital** — banked from **every sale**. Spent only on **Improve Distillery** (the linear ramp). Banks toward final score.
- **Prestige** — the **completed demand cards you keep**. This is the sole prestige source. (A completed card's Prestige value is printed on it.)
- **Final score = Capital + Prestige.** Most points wins; ties are broken by most cards completed.

The two score sources both flow from the single act of selling into demand, differentiated by whether you **participated** in a card (Capital) or **finished** it (the kept card / Prestige).

---

# ⏳ The Clock

**The game ends when any player has completed 8 demand cards.** The triggering round **finishes** (all players get equal turns), then score. The clock is self-pacing — the scoring action itself is what ends the game.

- The **demand deck and the mash-bill supply are both renewable** — they reshuffle (and mint fresh stock when needed) and **neither ends the game**.
- A round limit guarantees the game ends even if no one reaches 8 completions (which can happen at high player counts, where each card needs more fills) — a safety net, not the usual finish.

---

# 🧑‍🤝‍🧑 Player Count

**2–6.** No direct attacks at any count — competition is at the shared edges (the dice pool & its pass, the demand commons & the crash, racing the clock). Demand scales by **card slot depth** (not card count), so the table stays readable at 6p while capacity scales. More players → faster pile growth → more frequent crashes → a more volatile market; fewer players → a slower, more contemplative market. Same rules, different feel by count (free variety).

---

# 🔁 The Core Loop

**Demand Phase** (draw 1 card, read the zone, check the crash) → **Collect Phase** (draw mash bills, then roll/inherit/keep/reroll, claim resources into Warehouse, pass leftovers) → **Play Phase** (stage & make bourbon, sell into demand for Capital + complete cards for Prestige, improve departments) → age all barrels +1 → repeat until a player has completed 8 cards → finish the round → score Capital + Prestige.
