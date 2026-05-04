# 🥃 Bourbonomics

## Become the Bourbon Baron

Welcome to *Bourbonomics*, a deckbuilding strategy game about building a bourbon empire through patience, timing, and the discipline of inventory management. Designed for **2-6 players**.

Each player owns a distillery and competes to earn the most reputation. Barons draft mash bills, manage a personal deck of resource cards, produce bourbon, age it over time, and sell it at the perfect moment to convert tied-up inventory into reputation.

The challenge isn't just making bourbon — it's knowing **when** to make it, **how long** to age it, and **what to give up** while you wait.

> **Scope note (v2.0 alpha).** This rulebook covers the implemented core: drafting, the round loop, production, aging, selling, market buying, trading, and the doomsday-deck endgame. Investment cards, Operations cards, and a Distillery starting bonus are deferred to a later release; see [`IMPLEMENTATION_GUIDE.md`](IMPLEMENTATION_GUIDE.md) for the planned scope. The current build is **computer-only** — every player slot is filled by a heuristic bot. A human-controlled player slot will land alongside the UI work.

---

# 🏆 Winning the Game

The game ends when **the last mash bill is drawn from the Bourbon deck**. Drawing the final mash bill triggers the final round — all players, including the triggering player, complete the current round normally. After the action phase ends, scoring occurs immediately.

The player with the **most reputation** at the end of the game wins. Tiebreakers (in order):

1. Most barrels sold over the course of the game.
2. Shared victory.

## Why the Final Round Matters

The final round is when the most dramatic plays happen. Players race to liquidate aged barrels, push final reputation gains, and time their sales against fluctuating demand. Cards committed to barrels that don't sell in the final round are lost — there is no next round for them to return to.

---

# 🎬 Setup

## Step 1: Mash Bill Draft

Each player drafts **3 mash bills** from a shared pool. The exact draft procedure is up to the group, but a snake draft (1-2-3-3-2-1) is recommended for fairness. These mash bills are the player's permanent recipes for the game, though more can be drawn during play.

## Step 2: Starter Deck Draft

Each player builds a personal **14-card starter deck** by selecting from the communal pool of "plain" cards. Players may choose any combination of:

- **Cask cards**
- **Corn cards**
- **Grain cards** (rye, barley, wheat — depending on the pool)
- **Capital cards**

A typical balanced starter might be 3 cask, 4 corn, 3 grain, 2 capital, plus 2 of the player's choice — but players are free to specialize. A player who plans to focus on high-rye bourbon might draft more rye-leaning grain cards. The draft itself is the first strategic decision of the game.

All cards in the starter deck are "plain" — basic versions of each type. Premium cards (like 2-rye) are only available through the market during play.

## Step 3: First Hand

After all players have drafted their starter decks, each player shuffles and draws **8 cards** as their opening hand. Play begins.

## Step 4: Board Setup

- Set up the **Market Conveyor**: 6 cards face-up from the market supply deck.
- Set the **Demand Track** to **6** (starting position).
- Each player begins with **0 reputation**.
- Place the Bourbon deck (mash bills) face-down within reach.
- Roll for first player or use any agreed method to determine turn order.

---

# 🗺️ Understanding the Board

The game revolves around three shared elements: **the Market Conveyor**, **the Bourbon deck**, and **the Rickhouses**.

Each player additionally manages their **personal deck**, **hand**, **discard pile**, **aging barrels**, and **reputation track**.

---

# 📜 Mash Bills

Mash bills are recipes that determine each barrel's reputation reward when sold. Players draft 3 at game start; more can be drawn during play.

Mash bills are committed **at production, not at sale**. When you make bourbon, you choose one mash bill from your hand and place it face-up on the new barrel. Once placed, the mash bill is **locked to that barrel for its lifetime** and becomes public information.

When a barrel is sold, the attached mash bill's grid determines the reputation reward based on the barrel's age and the current demand. The mash bill is then discarded and cannot be reused (unless it carries an award that returns or removes it — see §Bourbon Awards).

A player with **no mash bills in hand cannot make bourbon**. As an action, a player may draw a mash bill from the Bourbon deck.

If the Bourbon deck is exhausted, the **final round trigger** activates. The deck is *not* reshuffled.

## Per-Bill Recipes

Some mash bills carry an explicit recipe — extra grain requirements that the mash committed at production must satisfy. Recipes only ever **tighten** the universal rules (1 cask + 1 corn + 1 grain minimum); they never loosen them.

Examples:
- **High-rye** bill — recipe: `rye ≥ 3`.
- **Wheated** bill — recipe: `wheat ≥ 1, no rye`.
- **Four-grain** bill — recipe: `barley ≥ 1, rye ≥ 1, wheat ≥ 1`.

Mash bills without a printed recipe accept any legal mash. Recipes are public information once the bill is in play.

---

# 🃏 Hand and Deck

## Hand Size

Each player draws **8 cards** at the start of every round.

There is no maximum hand size during a turn (mid-sale draws can temporarily expand a hand). At the end of each round, all unused cards in hand are placed in the discard pile.

## Deck Composition

A player's deck contains a mix of:
- **Resource cards** (cask, corn, grain — including premium variants like 2-rye).
- **Operations cards**
- **Capital cards** (currency for market purchases and investments).

Mash bills are *not* part of the deck. They live in the player's hand and are managed separately. The 14-card starter deck contains only resource, operations and capital cards.

Decks grow during the game through market purchases. Decks shrink through trashing (see §Trashing Cards) and temporary commitment to aging barrels (see §Aging).

## Card Types
### Resource cards
Resources cards are cask, corn, wheat, rye and barley. These are needed to make bourbon. Better resource cards can be purchased from the market

### Operations cards
These cards convey one-off effects during that turn

### Capital cards
These cards can be used to purchase other cards and make investments. They cannot be used to make Bourbon

---

# 🔄 How a Round Works

Each round consists of four phases:

1. **Demand Phase** — Roll 2d6; if higher than current demand, demand +1.
2. **Draw Phase** — Each player draws 8 cards from their personal deck.
3. **Age Phase** - All Bourbons on the board are aged, players place a card on top of their Bourbons to denote aging.
4. **Action Phase** — Players take turns spending cards as actions until all hands are exhausted.
5. **Cleanup Phase** — Unused cards go to discard, per-round flags reset (barrels become eligible to age again), and the next round begins. If the final round was triggered, the game ends here instead.

---

# 🎲 Phase 1: Demand Phase

At the start of each round, **roll 2d6**. If the result is **greater than** the current demand, demand increases by 1 (capped at 12). Otherwise, demand remains unchanged.

This is the only way demand rises. Sales reduce demand by 1 each (floored at 0).

The bell-curve probability of 2d6 means demand naturally tends toward the middle of its range, with rare booms and crashes.

---

# 🎴 Phase 2: Draw Phase

Each player draws **8 cards** from their personal deck. If the deck runs out, shuffle the discard pile to form a new deck and continue drawing.

---

# 🎴 Phase 3: Age Phase

Players place a card on each Bourbon in the rickhouse to denote aging. Players to not need to age every Bourbon but it is highly recommended as this is the primary means to win the game. 

### Age Bourbon

Choose a barrel in the rickhouse. Take one card from your hand and place it face-down on top of that barrel. The card is committed to aging and cannot be used until the barrel is sold.

The number of cards on top of a barrel = its age (in years). A barrel may only be aged once per round (one card per barrel per round, unless there is a card that allows otherwise).

When the barrel is sold, all cards committed to its aging return to the player's discard pile.

---

# 🎯 Phase 4: Action Phase

Players take turns clockwise. On your turn, you take one action. The phase continues until **all players have exhausted their hands** (or passed).

A player whose hand is empty is "out" for the round and skipped on subsequent turns.

## Available Actions

Each action requires spending one or more cards from your hand. Spent cards go to your discard pile unless otherwise noted.
Players can: 
* Purchase cards from the market
* Make Bourbon
* Implement an investment
* Sell Bourbon
* Draw Mash Bill

### Buy from the Market

Spend cards and from your hand totaling at least the cost of a card in the Market. Most basic cards cost 1; premium cards may cost more. Capital cards apply the number listed towards the purchase price. All other cards count as "1". 

Both the **spent card(s)** and the **purchased card** go to your discard pile.

After purchase, refill the Market by drawing a new card from the supply deck.

For example, a +3 capital card costs 4. You can either discard 4 cards, or if you have a +2 capital card, then use that plus another 2 card, or if you have a +3 capital card, then use that plus another card. 

Cards can only be purchased one at a time. There is no bundling. If you overpay, the rest of the value is gone. For example, using a +3 capital card to purchase a card worth 2 does not result in being able to purchase a 1 value card or carry over to another purchase. 

### Make Bourbon

Assemble the requirements for your mash from your hand to produce bourbon. Place all ingredients and the mash bill in the rickhouse in the middle of the board. This means your barrel is aging

The cards spent on production stay with your bourbon "face-up". They do not count towards the "age" of the Bourbon. These resources remain locked until the Bourbon is sold. The mash bill remains attached to the barrel.

### Sell Bourbon

Sell Bourbon

Sell any barrel that is at least 2 years old. Reference the attached mash bill’s grid using the barrel’s age and the current demand to determine the total reward (N).

You may allocate this reward between two outcomes, in any combination:

Gain Reputation: Advance your reputation track by any amount of N.
Gain Purchasing Power: Spend any amount of N as purchasing power to buy cards from the market and/or implement investments, following normal costs.

All purchases made this way are resolved immediately as part of the Sell action.

Any unused portion is automatically converted into reputation.

After resolving the sale:

Reduce demand by 1.
Discard the mash bill (unless an award says otherwise).
Return all aging and ingredient cards to your discard pile.
Remove the barrel from the rickhouse.

### Implement Investment
The 3 investment cards are displayed face up. Players may "implement one" buy paying the required amount of capital. Capital cards have the listed amount of value, every other card is worth 1. Once implemented, the investment sits in front of the player and conveys bonus abilities throughout the game. A player can have max 3 investments. A player may replace an investment, they do not get any benefits from the discarded investment. Discarded investments are put to the bottom of the deck. 

If none of the investments are to the players liking, they can pay one card, to draw the top investment from the deck. They can then choose to implement. If player chooses to not implement, then another player can pay the listed amount to implement. This is determined in clockwise order. If another player implements, they do not consume an additional action, the game resumes from the original player. If no one implements, it will return to the bottom of the deck.

#### Investment examples
Warehouse - allows you to commit a card in your hand to be used in future rounds. This card sits "in the warehouse". This can be any card
Distillery Expansion - allows you to draw +1 card in your hand
Corn Futures - on your turn, if there is a corn card available in the market, you can use this investment as +1 card toward the purchase of corn. For basic corn, this is enough. For premium corn, this counts as +1 toward the purchase. Can only be used for corn
Wheat Futures
Rye Futures
Expert Cooper


### Draw a Mash Bill

3 mash bills are shown face up. Players can play the listed capital cost to acquire a mash bill. If a mash bill is drawn, replace it with the top mash bill from the mash bill deck. Players can also spend any 1 capital/card from your hand to draw the top mash bill from the Bourbon deck into your hand. Once all the mash bills are gone (including the face up ones) then the final round begin.

### Trade

Players may trade cards with each other. Both sides must give at least one card. **Traded cards go to the recipient's discard pile**, not their hand.

Trading costs **one action card from each player** (each player spends one card from hand, both going to discard, in addition to the cards being traded).

Trading is only allowed during the action phase, not during the final round.

### 2:1 Conversion

If you cannot make bourbon due to a missing resource type, you may use 2 cards from your hand to count as 1 resource of any basic type (cask, corn, or grain) for the purpose of a single bourbon production. Only basic resource types can be created this way; premium cards cannot be produced through conversion.

The 2 cards plus the cards used to make bourbon all are committed to your Bourbon. 

### Trash a Card (via Production)

You may trash 1 card from your hand at the cost of 1 card. The trash card is removed permanently from the game. The card used to trash your card is placed in the discard pile

### Pass Turn

You may end your turn voluntarily. Cards remaining in your hand stay there for the rest of the action phase but are discarded during cleanup. Once you pass, you are out for the round and skipped on subsequent turns.

---

# 🥇 Bourbon Awards

Some mash bills grant special awards when their bourbon is sold.

## Silver — Bill Returns to Hand

A Silver award returns the mash bill to the player's hand instead of being discarded. The bill can be attached to a future barrel.

## Gold — Permanent Recipe

A Gold award removes the mash bill from circulation and places it face-up in front of the player as a permanent unlocked recipe. The unlocked Gold Bourbon may be applied as a free option at sale time on any future barrel, providing its reputation reward instead of the attached mash bill's normal reward.

Gold awards do not trigger the final round in this version of the game — only the exhaustion of the Bourbon deck does.

## Award Precedence

If a sale qualifies for both Silver and Gold, Gold takes precedence.

---

# 🏚️ The Rickhouse

There is **one shared rickhouse**. Every player's aging bourbon lives there. Once a barrel is placed it stays until it's sold.

The aging cost is the cards committed to barrels.

---

# 📊 Market Demand

Demand ranges from **0 to 12**. It begins at 0.

- **Rises by 1** at the start of each round if 2d6 rolls higher than current demand.
- **Falls by 1** each time a barrel is sold (floored at 0).

Demand affects every sale. The mash bill's grid uses the current demand to determine the reputation reward.

## Demand Bands

Each mash bill defines its own demand band thresholds. Some bills favor low demand; others require high demand to pay out at all. Reading a mash bill's demand bands before attaching it to a barrel is part of the game.

---

# 📈 Mash Bill Pricing

Every mash bill prints a grid based on age and demand. More premium bourbons will have more complex grids. Common barrels will typically have a simple 1x2 grid. There is no shared lookup table; each bill defines its own scale.

To read a sale:
1. Find the highest age threshold ≤ the barrel's age — that's the row.
2. Find the highest demand threshold ≤ current demand — that's the column.
3. The cell is the reputation reward.

Every bourbon produces some reputation. The barrel still sells (and demand still drops by 1), but the player gains nothing.

## Example

**Backroad Batch** — workhorse bill:

`ageBands: [2, 4, 6]`, `demandBands: [2, 4, 6]`

| Age \ Demand | 2–3 | 4–5 | 6+ |
|---|:-:|:-:|:-:|
| 2–3 | 1 | 2 | 3 |
| 4–5 | 2 | 4 | 5 |
| 6+  | 3 | 5 | 6 |

A 5-year barrel sold at demand 7 yields **5 reputation**, which the player splits between the reputation track and card draws.

---

# 🃏 Trashing Cards

Cards can be permanently removed from a player's deck (trashed) via the **Failed Batch** option on Make Bourbon: when producing a barrel, discard one additional card from hand and remove it from the game.

Trashed cards are removed from the game — they do not return to the deck, discard pile, or any other zone.

---

# 🔁 The Core Loop

You draft mash bills. You build a starter deck. You draw 8 cards each round. You make bourbon. You age it by locking cards on top. You sell when demand favors you. You take reputation, or cards, or both. You buy from the market when needed. You time your endgame.

The mash bill deck is the doomsday clock. Drawing mash bills accelerates the end.

---

# 🧠 Strategic Identities

Three viable strategies emerge from the rules:

- **The Volume Distiller** — Wide deck, frequent production, sells at moderate ages. Wins by raw output.
- **The Patient Curator** — Lean deck, deep aging, sells into peak demand. Wins by big single sales.
- **The Speedrunner** — Drains the mash bill deck quickly to end the game on their terms. Wins by triggering the endgame before others perfect their engines.

Each strategy has counters. Volume Distillers crash demand on Patient Curators. Patient Curators outscore Volume Distillers in single sales. Speedrunners shortcut both.

---

# 🥃 Final Thought

Bourbonomics isn't about making bourbon.

It's about knowing what to lock up, what to let go, and when the world is ready to pay.
