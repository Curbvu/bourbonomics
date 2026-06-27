# 🥃 Bourbonomics

A cozy game about running a bourbon distillery: gather grain through a shared dice draft, build and age bourbon in your rickhouse, and sell it into a shared demand market at the right moment. Grow your distillery's departments to draw harder, hold more, and sell richer. Each demand order you complete becomes a kept card worth Prestige. The game ends once a player has completed 8 orders; the distillery with the most Capital + Prestige then wins.

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

Each round runs Demand → Collect → Play, then every barrel ages **+1** at the end of Play.

---

## 📊 1. Demand Phase

At the start of each round, **1 new demand card is added to the shared market.** The game **opens with 1 "any bourbon" card** so everyone can sell while building their first bourbon. Cards **stay on the table until completed** (every slot filled); a completed card is removed and **kept by the player who finished it** as Prestige. **Partly filled cards stay on the table and still count** toward the market total.

### What a demand card is

A demand card has three parts:

- **Requirement** — what a bourbon must be to fill a slot (required **tags** / minimum age / minimum quality). An **"any bourbon"** card has no requirement.
- **Slots** — a row of `2 × player count` slots. Each slot is one sale. **Filling a slot pays you the bourbon's own value** (see §Selling).
- **Prestige** — kept by whoever fills the **final** slot. Completing the card hands them the whole card.

**Open vs. gated (about half and half):** roughly half the deck is **"any bourbon"** — anyone can fill it, but it's worth **little Prestige**. The other half is **gated** — it requires specific tags (premium ones also ask for higher quality or age) and is worth **far more Prestige**. Every slot pays the same Capital (the bourbon's value × zone); the Prestige is what makes chasing a gated order — and specializing your distillery — worth it.

**The current demand zone** (below) multiplies every sale — the same bourbon banks more Capital filling a slot in a Hot market than a Low one.

### Demand zones (by total cards on the table)

| Cards on table | Zone | Sale multiplier |
|---|---|---|
| 1–3 | **Low** | ×1 |
| 4–5 | **Mid** | ×2 |
| 6 | **Hot** | ×3 |
| **7th card** | **MARKET CRASH** |

The number of cards on the table sets the zone. It grows as new cards arrive (1 per round) and shrinks only as cards are completed, so a market nobody is clearing drifts toward Hot. Higher zone = every sale pays more. You can always see it coming — just count the cards.

### Market crash

Checked **when the new card is added each round**. If adding it would bring the table to **7 cards**, the whole table is **wiped instead** (uncompleted cards are lost — see *What's lost on a wipe*) and the market starts fresh from a single low card. This is what clears a market that has backed up without anyone cashing at Hot.

### ⭐ Hot completion reset (the tension mechanic)

If a player **completes a card while the zone is Hot (6 cards)**, the market resets — but resolution order is critical:
1. The completer **fully resolves first** — banks their sale at the **×3 Hot** multiplier and **keeps the completed card** (Prestige).
2. **Then** every other card on the table is **wiped** (their completions / Prestige forfeited — see below) and the market **resets to 1 open card** (Low).

So reaching Hot is a **race to complete first**: whoever cashes first takes their ×3 and wipes everyone else's held cards. **Low/Mid completions do not reset** the market. Holding for the ×3 only pays off if you win the race — otherwise someone else's Hot completion (or the 7-card crash) clears the cards you were sitting on. Nobody attacks you directly; the pressure is just the shared market.

### What's lost on a wipe (crash or Hot reset)

Uncompleted cards are removed and their **completion reward (the kept card / Prestige) forfeited**. **Capital already banked from intermediate sales is kept** (every sale banked Capital when it happened). So a partial filler keeps their per-sale Capital but loses the shot at that card's Prestige — the *completion* is what's at risk when you hold.

### Marketing Department

The **Marketing Department** shapes the Demand Phase — how many cards you draw, and (at its ultimate) a Private Demand Card only you can fill (see §The Distillery).

---

## 🎲 2. Collect Phase — shared dice draft

**One pass around the table, most-Capital-first.** The leader rolls a fresh set; later players inherit the dice passed to them, so going later still has an upside — you start from a pool someone already rolled.

**On your collect turn:**
1. **Draw Mash Bills (recipes first).** Reveal **Mash Floor**-many mash bills and keep any as resting (unbuilt) barrels — pick your recipes *before* you draft, so you know which grain to chase. **Once per turn**; blocked when the rickhouse is full.
2. **Inherit** the leftover dice passed from the previous player. They go straight **onto your table** and **count against your Supply cap**.
3. **Keep, then roll.** Tap the inherited dice you want to **keep**; everything else (plus enough fresh dice to fill your table up to your **Supply** cap) is then **rolled**. *(With no inherited dice — e.g. the first player — you simply roll a full fresh set.)* This first roll is **free**.
4. **One reroll at the base level** — keep what you like, reroll the rest. *(The Supply "Second Reroll" ultimate grants a second.)*
5. **Claim** dice into resources — each claimed die draws the top card of its matching pile (blind quality); an **anything** die draws from any one pile you choose. Claim up to what fits your **Warehouse**.
6. **Pass** all unclaimed dice to the next player.

One loop only; when the last player passes, the phase ends and any leftover dice return to the pool.

---

## ⚙️ 3. Play Phase — unlimited actions

Round-robin. **No action economy** — take unlimited actions, gated only by resources, departments, and capacity.

*(Recipes are chosen earlier — **Draw Mash Bills** happens at the start of your Collect turn, so resting barrels are already on your rickhouse when Play begins.)*

| Action | Effect |
|---|---|
| **Stage** | Move a **recipe-matched** resource card from hand onto a resting barrel. Staged cards leave the hand (free Warehouse) but **lock to that barrel** *(a Warehouse ultimate unlocks them)*. |
| **Make Bourbon** | When a resting barrel's recipe is fully met (staged and/or committed from hand), build it. **Quality = best card committed.** Begins aging at age 0 *(age 1 with the Char & Toast ultimate)*. |
| **Sell (Extract)** | Extract one sale from a built, aged batch (age ≥ 2) into a matching **demand card slot**. See §Selling. Banks Capital every time. |
| **Improve Distillery** | Advance one department one step. Cost rises on the per-player linear ramp (see §The Distillery). |

---

# 🛢️ Resources, Building, Aging

- **Five types:** cask, corn, rye, wheat, barley. A bourbon's grain identity seeds its matchable **tags** (below), which demand requirements key off.
- **Quality (five tiers):** **Common · Uncommon · Rare · Epic · Legendary**, blind in the piles (Legendary very rare, Common abundant — the rare pull is the thrill). The **best card committed** sets a barrel's tier, which sets its **sale value** (see §Selling). The familiar ladder is colored grey/green/blue/purple/orange.
- **The bourbon rule:** every mash bill requires **exactly 1 cask**, **at least 1 corn**, and **at least 1 grain** (rye / wheat / barley) — no cask/corn-only recipes. More complex bills add more resources.
- **Tags (matchable identity):** every bourbon carries one or more **tags** (seeded with the grain identities — rye / wheat / highCorn / fourGrain / classic). Tags are shown **right-side and color-coded** on both the bourbon card and the demand cards, so filling an order is a visual pattern-match ("my crimson bourbon fills that crimson order"). A demand card's required tags must **all** be present on the bourbon.
- **Sales per barrel by quality:** how many sales a built barrel yields over its life is set by its **quality tier**, NOT its recipe — **Common = 1** (one-and-done), scaling up to **3** at Legendary. A few bills carry a small off-curve variance (e.g. a Common bill that still yields 2).
- **Two-step production:** Draw Mash Bills (at the start of your Collect turn) lays a recipe as a resting (non-aging) barrel; Stage/Make Bourbon (in Play) builds it.
- **Warehouse cap is checked when you claim** — you can never *claim* past your cap, and there's no end-of-round discard. Loose (uncommitted) resource cards count against the cap; staged and built cards do not. A premium card with no matching resting barrel sits loose and takes up cap until you can use it.
- **Aging is set-and-forget:** every built barrel ages **+1 at the end of Play**. **No aging ceiling — barrels age freely.** Sellable at **age ≥ 2**.

---

# 💰 Selling (Extraction) — three age phases, demand as a multiplier

Selling is straightforward: a demand order pays the **bourbon's own value**, scaled by the current demand zone. A sale's Capital is:

```
sale_capital = age_phase_value(quality, age, prime_window) × demand_zone_multiplier
```

**1. Age-phase value — younger / prime / older.** Every mash bill has a **prime window** (e.g. **6–8 years**). A bourbon sells for one of **three** values depending on where its age sits relative to that window:

- **Younger** — sellable (≥ age 2) but **before** its prime window: the low value.
- **Prime** — inside the window `[start, end]`: the **peak** value.
- **Older** — past the window: still good, but **below** prime (the mid value).

The three values scale with **quality** — a Legendary's prime beats a Common's. A barrel under the **minimum sell age (2)** can't be sold yet. A barrel can keep aging past its window — its value just settles at the **older** tier.

| Quality | younger | **prime** | older |
|:--|:--:|:--:|:--:|
| Common | 1 | **2** | 1 |
| Uncommon | 1 | **3** | 2 |
| Rare | 2 | **4** | 3 |
| Epic | 2 | **6** | 4 |
| Legendary | 3 | **8** | 5 |

The **prime window** is per mash bill (default **6–8**; young-drinking bills prime a touch earlier, showpiece bills a touch later). A bourbon inherits its bill's window when it's built.

**2. Demand zone MULTIPLIER** (the timing swing) — by total cards on the table: a simple **Low ×1 · Mid ×2 · Hot ×3**, applied to the age-phase value. Reaching/cashing **Hot** is a race (see §Hot completion reset) — it's not a zone you can safely sit in.

**Every sale needs a matching open slot.** If no order on the table fits your bourbon, the barrel simply waits until one does.

*Worked: a **Common in its prime** (value 2) on a **Low** order = 2 × 1 = **2** (floor). The same Common sold **older** (value 1) at **Hot** = 1 × 3 = **3**. A **Legendary in its prime** (value 8) at **Hot** = 8 × 3 = **24**. **Tip:** cash your best barrels **in their window** and time that window against a **hot** market — both levers multiply the same number.*

**Multi-sale batches:** a built barrel yields multiple sales over its life, set by its **quality** (Common 1 → Legendary 3). **Every sale banks Capital** — intermediate or completing. A batch frees its rickhouse slot when its **last** sale is extracted. A Common is one-and-done (fills exactly one slot); higher tiers fill multiple slots, possibly across different orders / rounds — and a barrel can age out of its prime between sales.

**Completing a demand card:** the player who fills a card's **final slot keeps the card** as Prestige. Earlier fillers already banked Capital from their sales; the player who finishes it additionally takes the card. (Capital for the work, Prestige for the finish.)

---

# 🏚️ The Rickhouse

A small area where barrels rest, build, and age.

- **Capacity** (resting + aging barrels) is set by the **Rickhouse department**. Starts at **3 slots**.
- A resting barrel holds a slot but doesn't age; a built batch ages +1/round and leaves when its last sale is extracted.
- A full rickhouse blocks **Draw Mash Bills** — build and sell to make room.
- **No aging ceiling from the rickhouse** — it governs how *many* barrels, not how *old* they may get.

---

# 🏭 The Distillery — departments & branches

Each player runs a distillery board of departments. Departments are **permanent and need no upkeep** — once you improve one, it stays improved for the rest of the game.

### Branch structure

Every department grows the same way: **Base → +1 → +1 → Ultimate.** The two middle steps raise a number (more dice, more cap, etc.); the **Ultimate is a one-time, powerful effect.** Each distillery offers a different **subset of ultimates per department** — that's what makes distilleries play differently.

### The improvement ramp

Improving costs more each time. Your **1st** improvement costs **1** Capital, your **2nd** costs **2**, your **3rd** costs **3**, and so on — one rising price shared across all your departments. You'll only afford about **5–6** improvements in a whole game, so you can't grow everything — you'll specialize.

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

Each distillery trades a real **weakness** (a department that starts below base, or a cap on how far a department can climb) for a real **strength** (a department that starts a step ahead, a stronger set of ultimates, or an always-on perk). The weakness nudges you toward the playstyle the strength rewards. **Standard** is the balanced all-rounder with no weakness and no special strength.

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

**2–6.** No direct attacks at any count — you compete at the shared edges: the dice pool and the dice you pass on, the demand market and its crashes, and the race to 8 completions. Each demand card's slots scale with the player count (`2 × players`), so the table stays readable at 6 players. More players → the market fills faster, crashes more often, and feels more volatile; fewer players → a slower, more contemplative market. Same rules, different feel depending on player count.

---

# 🔁 The Core Loop

**Demand Phase** (draw 1 card, read the zone, check the crash) → **Collect Phase** (draw mash bills, then roll/inherit/keep/reroll, claim resources into Warehouse, pass leftovers) → **Play Phase** (stage & make bourbon, sell into demand for Capital + complete cards for Prestige, improve departments) → age all barrels +1 → repeat until a player has completed 8 cards → finish the round → score Capital + Prestige.
