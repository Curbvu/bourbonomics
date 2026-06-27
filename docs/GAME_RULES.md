# 🥃 Bourbonomics

A cozy game about running a bourbon distillery. Gather grain in a shared dice draft, build and age bourbon in your rickhouse, and sell it into a shared demand market at the right moment. Improve your distillery's departments to draw harder, hold more, and sell richer. Every order you complete becomes a kept card worth Prestige.

**The game ends once a player has completed 8 orders. The distillery with the most Capital + Prestige wins.**

**Players:** 2–6 · **Length:** ~45–60 min · **Complexity:** Medium-light

You win by selling well and finishing orders. You can take more than your share of the shared dice and the shared market, but you can never directly hurt another player — there are no attacks.

---

# 🎬 Setup

1. **Resource piles.** Five face-down piles — **cask, corn, rye, wheat, barley** — one per type. Each card also has a hidden **quality** (Common / Uncommon / Rare / Epic / Legendary; Legendary is rare), mixed into every pile. Piles are shared and never run out. When a pile empties, shuffle its discard back in.
2. **Resource dice.** A shared pool of dice. Each die has six faces: **cask, corn, rye, wheat, barley, anything**.
3. **Demand deck.** Shuffle the demand cards. Put out the starting market (see Demand Phase).
4. **Mash bills.** Shuffle the mash bills into a supply (it reshuffles when it runs low).
5. **Players.** Each picks a **distillery** (your board of departments). Start with **5 Capital**, **0 Prestige**, an empty warehouse, and an empty rickhouse.
6. Each round, players go in order of most Capital first. Break first-round ties randomly.

---

# 🔄 The Round

```
DEMAND  →  COLLECT  →  PLAY  →  (every barrel ages +1)  →  next round …
```

Each round runs three phases — Demand, Collect, Play — and then every barrel in play ages **+1**. Repeat until someone has completed 8 orders.

---

## 📊 1. Demand Phase

At the start of each round, **1 new demand card is added to the shared market.** The game opens with a single **"any bourbon"** card, so everyone can sell while building their first bourbon.

Cards stay on the table until they're **completed** (every slot filled). A completed card is removed and **kept by the player who filled the last slot** as Prestige. A partly filled card stays on the table and still counts toward the market total.

### What a demand card is

Every demand card has three parts:

- **Requirement** — what a bourbon must be to fill a slot: required **tags**, a minimum age, and/or a minimum quality. An **"any bourbon"** card has no requirement.
- **Slots** — a row of `2 × player count` slots. Each slot is one sale. **Filling a slot pays you the bourbon's own value** (see Selling).
- **Prestige** — kept by whoever fills the **last** slot. Completing the card hands them the whole card.

**Open vs. gated.** Roughly half the deck is **"any bourbon"** — anyone can fill it, but it's worth **little Prestige**. The other half is **gated**: it needs specific tags (the best ones also ask for higher quality or age) and is worth **far more Prestige**. Every slot pays the same Capital either way; the Prestige is what makes chasing a gated order — and specializing your distillery to match it — worth it.

### Demand zones

The **number of cards on the table** sets the current zone, which multiplies every sale:

| Cards on table | Zone | Sale multiplier |
|---|---|---|
| 1–3 | **Low** | ×1 |
| 4–5 | **Mid** | ×2 |
| 6 | **Hot** | ×3 |
| **7th card** | **Market crash** | — |

The pile grows by 1 each round and only shrinks when cards are completed, so a market nobody is clearing drifts toward Hot. A higher zone means every sale pays more. You can always see it coming — just count the cards.

### Market crash

When the new card would be the **7th** on the table, the whole table is **wiped instead** (uncompleted cards are lost — see *What you lose on a wipe*) and the market starts fresh with a single card. This clears a market that has backed up without anyone cashing in at Hot.

### ⭐ Hot completion reset

If a player **completes a card while the zone is Hot (6 cards)**, the market resets — in this exact order:

1. **That player resolves first** — they bank their sale at the **×3 Hot** multiplier and **keep the card** they completed.
2. **Then every other card on the table is wiped** (uncompleted, so their Prestige is lost) and the market resets to a single card (Low).

So Hot is a **race to complete first**. Whoever cashes in first takes the ×3 *and* wipes everyone else's cards. Completing at Low or Mid does **not** reset anything. Holding your cards for the ×3 only pays off if you win the race — otherwise someone else's Hot completion, or the 7-card crash, clears the cards you were sitting on.

### What you lose on a wipe (crash or Hot reset)

Uncompleted cards are removed and the Prestige they'd have given is lost. **Capital you already banked from earlier sales is yours to keep** — every sale paid you when you made it. So you keep your Capital, but you lose the shot at finishing those cards. The *completion* is what's at risk when you hold.

### Marketing

The **Marketing** department sets how many demand cards you draw in this phase, and at its top level grants a **Private Demand Card** only you can fill (see The Distillery).

---

## 🎲 2. Collect Phase

Players take one turn each, in order of most Capital first. The leader rolls a fresh set of dice; later players inherit the dice passed to them, so going later still has an upside — you start from dice someone already rolled.

**On your turn:**

1. **Draw mash bills.** Reveal **Mash Floor**-many mash bills and keep any you like as **resting barrels** (recipes that aren't built yet). Pick your recipes first, so you know which grain to chase. Once per turn, and only if your rickhouse has room.
2. **Inherit** the dice passed from the previous player. They sit on your table and count against your **Supply** cap.
3. **Keep, then roll.** Keep the inherited dice you want; everything else — plus enough fresh dice to fill your table up to your Supply cap — is rolled. (First player just rolls a fresh set.) This roll is free.
4. **Reroll** any dice you don't like, once. (The Supply *Second Reroll* upgrade gives you a second reroll.)
5. **Claim** dice into resource cards. Each die draws the top card of its matching pile (you don't see its quality first); an **anything** die draws from any one pile you choose. You can only claim up to what fits your **Warehouse**.
6. **Pass** the dice you didn't claim to the next player.

Once the last player passes, the phase ends and any leftover dice go back to the pool.

---

## ⚙️ 3. Play Phase

Players take turns. On your turn you may take **as many actions as you want, in any order** — you're limited only by your resources, your departments, and your capacity.

Your recipes are already chosen (you drew mash bills in Collect), so your resting barrels are waiting in the rickhouse.

| Action | What it does |
|---|---|
| **Stage** | Put a matching resource card from your hand onto a resting barrel. It leaves your hand (freeing Warehouse space) and locks to that barrel. *(The Warehouse* Long Cellar *upgrade lets you move staged cards back.)* |
| **Make Bourbon** | Once a resting barrel has all the resources its recipe needs, build it. **Its quality = the best card you put in.** It starts aging at age 0. *(The Rickhouse* Char & Toast *upgrade starts it at age 1.)* |
| **Sell** | Take one sale from a built barrel that's **aged to at least 2** and put it in a matching demand slot. You bank Capital every time. See Selling. |
| **Improve Distillery** | Raise one department one step. Each upgrade costs more than the last (see The Distillery). |

---

# 🛢️ Resources, Building, Aging

- **Five resource types:** cask, corn, rye, wheat, barley. The grains you use give your bourbon its **tags** (below), which demand cards ask for.
- **Five quality tiers:** **Common, Uncommon, Rare, Epic, Legendary** — hidden in the piles, with Legendary the rarest. A barrel's quality is set by the **best card you build it with**, and quality drives its **sale value** (see Selling). The colors run grey → green → blue → purple → orange.
- **What makes it bourbon:** every recipe needs **exactly 1 cask**, **at least 1 corn**, and **at least 1 grain** (rye, wheat, or barley). Fancier recipes ask for more.
- **Tags.** Every bourbon carries one or more **tags** (its grain identity, like Rye, Wheat, High-Corn, Four-Grain, or Classic). Tags are color-coded on both the bourbon and the demand cards, so filling an order is a quick color match. To fill a gated slot, your bourbon must have **all** the tags that card requires.
- **Sales per barrel.** How many times you can sell a barrel is set by its **quality**, not its recipe: **Common sells once**, up to **3 times** at Legendary. (A few mash bills bend this slightly — e.g. a Common that still sells twice.)
- **Two steps to a bourbon:** drawing a mash bill (in Collect) puts a recipe in your rickhouse as a resting barrel; staging and Make Bourbon (in Play) build it.
- **Warehouse cap is checked when you claim.** You can never claim past your Warehouse cap, and you never discard at end of round. Only loose resource cards count against the cap — once a card is staged or built into a barrel, it no longer takes space. A premium card with no matching barrel just sits in your Warehouse until you can use it.
- **Aging is automatic:** every built barrel ages **+1 at the end of each Play phase**. There's no maximum age — barrels can age as long as you like. They become sellable at **age 2**.

---

# 💰 Selling

A sale pays you the **bourbon's value**, multiplied by the **current demand zone**:

> **Capital from a sale = bourbon's age value × zone multiplier (×1 / ×2 / ×3)**

### 1. The bourbon's age value — younger, prime, older

Every mash bill has a **prime window** (for example, **6–8 years**). A bourbon is worth one of three amounts, depending on its age:

- **Younger** — old enough to sell (age 2+) but not yet in its window: the **low** value.
- **Prime** — inside its window: the **best** value.
- **Older** — past its window: still good, but **less** than prime.

These amounts get bigger with **quality** — a Legendary in its prime is worth far more than a Common. A barrel below age 2 can't be sold yet. A barrel that ages past its window simply drops to its *older* value and stays there.

| Quality | younger | **prime** | older |
|:--|:--:|:--:|:--:|
| Common | 1 | **2** | 1 |
| Uncommon | 1 | **3** | 2 |
| Rare | 2 | **4** | 3 |
| Epic | 2 | **6** | 4 |
| Legendary | 3 | **8** | 5 |

The prime window is printed on each mash bill (usually **6–8**; some quick-drinking bills peak a little earlier, some showpiece bills a little later). A bourbon keeps the window of the bill it was built from.

### 2. The zone multiplier

The current demand zone multiplies your sale: **Low ×1, Mid ×2, Hot ×3.** Hot pays triple, but it's a race — see Hot completion reset. You can't safely sit in Hot.

**You need a matching open slot to sell.** If no order on the table fits your bourbon, the barrel just waits until one does.

**Examples:**
- A **Common in its prime** (value 2) sold at **Low** = 2 × 1 = **2**.
- That same Common sold **older** (value 1) at **Hot** = 1 × 3 = **3**.
- A **Legendary in its prime** (value 8) sold at **Hot** = 8 × 3 = **24**.

**Tip:** sell your best barrels while they're in their window, and try to time that window for a hot market — both make the same number bigger.

### Selling a barrel more than once

A barrel can sell **1–3 times** over its life (set by its quality). **Each sale pays you Capital.** A barrel only leaves your rickhouse after its **last** sale. Higher-quality barrels can fill several slots across different orders and rounds — and a barrel can age out of its prime between sales, so don't wait too long.

### Completing an order

Whoever fills an order's **last slot** keeps the card as Prestige. Everyone who sold into it earlier already banked their Capital; the finisher additionally takes the card. **Capital is the pay for the work; Prestige is the bonus for the finish.**

---

# 🏚️ The Rickhouse

Where your barrels rest, build, and age.

- Your **Rickhouse department** sets how many barrels you can hold (resting + aging). It starts at **3**.
- A resting barrel takes a slot but doesn't age. A built barrel ages +1 each round and leaves once its last sale is made.
- If your rickhouse is full, you can't draw mash bills — build and sell to free up room.
- There's no limit on a barrel's age. The rickhouse limits how *many* barrels you keep, not how *old* they get.

---

# 🏭 The Distillery

You run a board of **departments**. Once you improve a department, it stays improved for the rest of the game — no upkeep.

### How departments grow

Every department goes **Base → +1 → +1 → Ultimate.** The two middle steps raise a number (more dice, more space, and so on). The **Ultimate** is a powerful special ability. Each distillery offers a **different set of Ultimates** for its departments — that's what makes distilleries feel different to play.

### What upgrades cost

Each upgrade costs more than the last: your **1st** costs **1** Capital, your **2nd** costs **2**, your **3rd** costs **3**, and so on — one rising price shared across all your departments. You'll only afford about **5–6** upgrades in a whole game, so you can't grow everything. Pick a direction.

### The five departments

| Department | What it controls | Starts at |
|---|---|---|
| **Supply** | Dice you roll in Collect | 4 dice |
| **Warehouse** | Loose resource cards you can hold | 4 cards |
| **Mash Floor** | Mash bills you draw each Collect turn | 2 |
| **Marketing** | Demand cards you draw each Demand phase; Ultimate = a Private Demand Card | 1 |
| **Rickhouse** | Barrels you can hold | 3 |

### The Ultimates

**Rickhouse** (3 → 4 → 5 → Ultimate):
- **Mega Expansion** — +2 barrel slots.
- **Climate Controlled** — one chosen barrel ages +2 per round.
- **Char & Toast** — every barrel you build starts at age 1.
- **Double Maturation** — a barrel that reaches age 8+ gets one extra sale.
- **Warehouse Tasting** — while 3+ of your barrels are aging, gain +1 Capital each round.

**Supply** (4 → 5 → 6 → Ultimate):
- **Second Reroll** — a second reroll each Collect turn.
- **Overflow Roll** — +2 dice.
- **Prospector** — pick one pile; claims from it draw 2 and keep the better.
- **Triple Threat** — once per Collect turn, discard 2 dice you don't want to take 1 die of any face.

**Warehouse** (4 → 5 → 6 → Ultimate):
- **Grand Warehouse** — +3 cap.
- **Quality Sort** — once per round, a free draw from any pile.
- **Long Cellar** — staged cards stay swappable instead of locking to a barrel.

**Mash Floor** (2 → 3 → 4 → Ultimate):
- **Master Recipe** — +1 mash bill shown each draw.
- **House Blend** — one slot in a recipe accepts any resource type.
- **Open Bill** — one extra mash-bill draw each round.

**Marketing** (1 → 2 → Ultimate):
- **Private Demand Card** — a personal order only you can fill. It sits off the shared table: it doesn't change the zone, can't cause a crash, and survives every wipe, but it still pays at the current zone multiplier. Completing it keeps it as Prestige and draws you a replacement, and it never triggers the Hot reset.

### The distilleries

Each distillery has a real **strength** and a real **weakness** that point you toward a playstyle. **Standard** is the balanced all-rounder with neither.

| Distillery | Strength | Weakness |
|---|---|---|
| **Standard** | balanced, no specialty | none |
| **Old Oak Rickhouse** | starts Rickhouse at 4; aging-focused Ultimates | starts Supply at 3 |
| **Ironhill Volume** | starts Supply at 5 and Warehouse at 5 | Rickhouse can't grow past 4 |
| **Hollow & Crane** | starts Marketing a step in; best path to the Private Card | starts Warehouse at 3 |
| **Copperline Craft** | once per Collect, one claimed card is bumped +1 quality | starts Rickhouse at 2 |
| **Coopersmith & Sons** | starts Mash Floor at 3; recipe-focused Ultimates | starts Warehouse at 3 |

---

# 🪙 Scoring

- **Capital** — you bank it from **every sale**, and spend it only on upgrades. Whatever's left counts toward your score.
- **Prestige** — the value of the **completed order cards you keep**. It's the only source of Prestige.
- **Final score = Capital + Prestige.** Most points wins. Ties go to whoever completed more orders.

Both come from selling: you earn Capital for every sale you make, and Prestige for the orders you finish.

---

# ⏳ Ending the Game

**The game ends as soon as a player has completed 8 orders.** The current round finishes so everyone gets the same number of turns, then you score.

The demand deck and mash-bill supply never run out — they reshuffle as needed, so neither one ends the game. (There's also a round limit as a safety net for big games where orders fill slowly, but normally the 8th completion is what ends it.)

---

# 🧑‍🤝‍🧑 Player Count

**2–6 players.** No one can attack anyone — you compete over the shared dice you pass along, the shared market and its crashes, and the race to 8 completions. Each order's slots scale with the player count (`2 × players`), so the table stays manageable even at 6. More players means the market fills and crashes faster and feels more volatile; fewer players means a slower, calmer market.

---

# 🔁 The Loop at a Glance

**Demand** (add a card, read the zone) → **Collect** (draw mash bills, roll and draft dice into your Warehouse, pass the rest) → **Play** (stage, build, sell for Capital, finish orders for Prestige, improve your distillery) → every barrel ages +1 → repeat until someone completes 8 orders → finish the round → most Capital + Prestige wins.
