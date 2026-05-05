# 🥃 Bourbonomics

## Become the Bourbon Baron

Welcome to *Bourbonomics*, a deckbuilding strategy game about building a bourbon empire through patience, timing, and the discipline of inventory management. Recommended for **2–4 players**; supported for 5–6.

Each player owns a distillery and competes to earn the most reputation. Barons select a distillery, draft mash bills, manage a personal deck of resource cards, produce bourbon, age it over time, and sell it at the perfect moment to convert tied-up inventory into reputation.

The challenge isn't just making bourbon — it's knowing **when** to make it, **how long** to age it, and **what to give up** while you wait.

> **Scope note (v2.1 alpha).** This rulebook covers the implemented core: distillery selection, drafting, the round loop, production, aging, selling, market buying, operations cards, trading, and the doomsday-deck endgame. Investment cards are planned for a later release; their design is sketched in [`PLANNED_MECHANICS.md`](PLANNED_MECHANICS.md) and is not part of the current rules. The current build is **computer-only** — every player slot is filled by a heuristic bot. A human-controlled player slot will land alongside the UI work.

---

# 🏆 Winning the Game

The game ends when **the last mash bill leaves the Bourbon supply** — that is, when the Bourbon deck is empty *and* the face-up mash bill row is empty. Drawing or acquiring the final mash bill triggers the final round. All players, including the triggering player, complete the current round normally. After the action phase ends, scoring occurs immediately.

The player with the **most reputation** at the end of the game wins. Tiebreakers, in order:

1. Most barrels sold over the course of the game.
2. Shared victory.

## Why the Final Round Matters

The final round is when the most dramatic plays happen. Players race to liquidate aged barrels, push final reputation gains, and time their sales against fluctuating demand. Cards committed to barrels that don't sell in the final round are lost — there is no next round for them to return to.

---

# 🎬 Setup

## Step 1: Distillery Selection

Each player selects a **Distillery Card** — a large-format player board that represents their operation for the entire game. The distillery card contains:

- The distillery's name, identity, and starting bonus
- The player's **Rickhouse** — 4 barrel slots arranged across two tiers (see §The Rickhouse)
- The player's **Reputation Track**
- Reference information for mash bills and demand bands

Distillery cards are selected in reverse snake order (last player picks first). Each distillery has a unique starting bonus tied to a specific card or permanent ability. No two players may select the same distillery.

### Distillery Bonuses

Each distillery bonus maps directly to a physical game element — a card, an extra slot, or a permanent rule modifier. Examples:

- **Warehouse Distillery** — start with 1 extra rickhouse slot (5 total). The extra slot is on the upper tier and is not part of your bonded warehouse.
- **High-Rye House** — start with 1 free 2-rye premium card already in your starter deck.
- **Wheated Baron** — your wheated mash bills cost 1 fewer grain card to produce (minimum 1).
- **The Broker** — once per round, you may trade without spending an action.
- **Old-Line Distillery** — your bonded warehouse holds 3 barrels instead of 2.

Specific distillery cards and their bonuses are defined in the distillery card set. Bonuses are public information from the moment of selection.

### The Vanilla Distillery

A player may choose the **Vanilla Distillery** instead of a named distillery. The Vanilla Distillery has no starting bonus and no special rules. It is intended as a challenge option for experienced players or for competitive play where bonus asymmetry is unwanted.

---

## Step 2: Mash Bill Draft

Each player drafts **3 mash bills** from a shared pool. The exact draft procedure is up to the group, but a snake draft (1-2-3-3-2-1) is recommended for fairness. These mash bills are the player's permanent recipes for the game, though more can be drawn during play.

---

## Step 3: Starter Deck Draft

Each player builds a personal **16-card starter deck** by selecting from the communal pool of "plain" cards. Players may choose any combination of:

- **Cask cards**
- **Corn cards**
- **Grain cards** (rye, barley, wheat — depending on the pool)
- **Capital cards**

A typical balanced starter might be 4 cask, 4 corn, 4 grain, 2 capital, plus 2 of the player's choice — but players are free to specialize. A player who plans to focus on high-rye bourbon might draft more rye-leaning grain cards. The draft itself is the first strategic decision of the game.

All cards in the starter deck are "plain" — basic versions of each type. Premium cards (like 2-rye) are only available through the market during play, or through a distillery bonus.

---

## Step 4: First Hand

After all players have drafted their starter decks, each player shuffles and draws **8 cards** as their opening hand. Play begins.

---

## Step 5: Board Setup

- Set up the **Market Conveyor**: 6 cards face-up from the market supply deck.
- Shuffle and place the **Operations Deck** face-down in the center. Deal each player **2 Operations cards** face-down as their starting operations hand.
- Set the **Demand Track** to **0** (starting position).
- Each player begins with **0 reputation**.
- Place the Bourbon deck (mash bills) face-down within reach.
- Roll for first player or use any agreed method to determine turn order.
- Place distillery cards in front of each player. Seated order determines rickhouse adjacency for the purposes of any operations cards that reference neighboring distilleries.

---

# 🗺️ Understanding the Board

## Shared Elements (Center of Table)

- **Market Conveyor** — 6 face-up cards available for purchase
- **Bourbon Deck** — the doomsday clock; 3 face-up mash bills beside it
- **Demand Track** — a shared strip tracking current demand (0–12)
- **Operations Deck** — face-down stack; source of operations cards

## Personal Elements (Each Player's Distillery Card)

- **Rickhouse** — your barrel slots, arranged in two tiers
- **Reputation Track** — your running score
- **Hand** — resource, capital, and operations cards
- **Deck and Discard Pile** — kept beside your distillery card

---

# 🏚️ The Rickhouse

Each player owns their rickhouse outright — it is printed on their distillery card. There is no shared barrel space. Your barrels age in your rickhouse. Opponents' barrels age in theirs.

## Rickhouse Layout

Each distillery card has **4 barrel slots** by default, arranged across two tiers:

**Bonded Warehouse (lower tier) — 2 slots**
Your bonded warehouse is inviolable. No operations card, trade agreement, or game effect can remove, reduce, or interfere with these 2 slots. They represent your core licensed operation and are always available for production.

**Upper Tier — 2 slots**
Your upper tier slots are standard production space. These slots can be affected by certain operations cards (see §Operations Cards). The Warehouse Distillery bonus adds a third upper tier slot.

## Rickhouse Capacity

A player's rickhouse capacity is the total number of slots on their distillery card. Default capacity is 4. The Warehouse Distillery bonus raises this to 5. Investment cards (planned) may raise it further, to a maximum of 6.

When **your** rickhouse is full, you cannot Make Bourbon until you sell a barrel and free a slot. Other players are unaffected by the state of your rickhouse.

## Rickhouse and Player Interaction

Players do not directly interfere with each other's rickhouse slots in the base game. However:

- Certain **Operations cards** can affect neighboring players' upper tier slots (see §Operations Cards).
- Players may informally agree to **rickhouse leasing** as part of a Trade — one player offers use of an empty upper tier slot to another for a negotiated card payment. Leasing is entirely voluntary, governed by the Trade rules, and has no dedicated mechanic. The leaseholder places their barrel in the owner's upper tier slot; the owner's bonded warehouse is never part of any lease agreement.

---

# 📜 Mash Bills

Mash bills are recipes that determine each barrel's reputation reward when sold. Players draft 3 at game start; more can be drawn during play.

Mash bills are committed **at production, not at sale**. When you make bourbon, you choose one mash bill from your hand and place it face-up on the new barrel. Once placed, the mash bill is **locked to that barrel for its lifetime** and becomes public information.

When a barrel is sold, the attached mash bill's grid determines the reputation reward based on the barrel's age and the current demand. The mash bill is then discarded and cannot be reused (unless it carries an award that returns or removes it — see §Bourbon Awards).

A player with **no mash bills in hand cannot make bourbon**. As an action, a player may draw a mash bill from the Bourbon deck (see §Draw a Mash Bill).

If the Bourbon deck *and* the face-up mash bill row are both empty, the **final round trigger** activates. The deck is *not* reshuffled.

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

Each player draws **8 cards** from their resource deck at the start of every round, plus **1 Operations card** from the Operations deck (see §Operations Cards).

There is no maximum hand size during a turn (mid-sale draws can temporarily expand a hand). At the end of each round, all unused resource and capital cards in hand are placed in the discard pile. Unplayed Operations cards are **held** — they do not discard at end of round and may be played in a future round.

## Deck Composition

A player's deck contains a mix of:
- **Resource cards** (cask, corn, grain — including premium variants like 2-rye).
- **Capital cards** (currency for market purchases, mash bill draws, and investments).

Mash bills and Operations cards are *not* part of the resource deck. They are managed separately. The 16-card starter deck contains only resource and capital cards.

Decks grow through market purchases. Decks shrink through trashing (see §Trashing Cards) and temporary commitment to aging barrels (see §Age Bourbon).

## Card Types

### Resource Cards
Resources are cask, corn, wheat, rye, and barley. These are needed to make bourbon. Premium resource cards (which count for more than one unit, e.g., 2-rye) can be purchased from the market.

### Capital Cards
Capital cards are spent as currency. They cannot be used to make bourbon. The number printed on a capital card is its **payment value**, and it pays at full printed value in any of these contexts:

- **Buying cards from the Market** (see §Buy from the Market).
- **Acquiring face-up mash bills** (see §Draw a Mash Bill).
- **Implementing Investment cards**, when that mechanic is added in a future release.

In every other context — conversion, trading, aging — a capital card counts as a single card, the same as any other.

### Operations Cards
Operations cards are a separate card type drawn from the Operations deck. They are played from hand as a free action during the Action Phase and represent market moves, regulatory events, and competitive plays. See §Operations Cards for full rules.

---

# 🔄 How a Round Works

Each round consists of five phases:

1. **Demand Phase** — Roll 2d6; if higher than current demand, demand +1.
2. **Draw Phase** — Each player draws 8 resource cards and 1 Operations card.
3. **Age Phase** — Players may place a card on top of each of their barrels to advance its age.
4. **Action Phase** — Players take turns spending cards as actions until all hands are exhausted.
5. **Cleanup Phase** — Unused resource cards go to discard, per-round flags reset, and the next round begins. If the final round was triggered, the game ends here and scoring occurs.

---

# 🎲 Phase 1: Demand Phase

At the start of each round, **roll 2d6**. If the result is **greater than** the current demand, demand increases by 1 (capped at 12). Otherwise, demand remains unchanged.

This is the only way demand rises naturally. Sales reduce demand by 1 each (floored at 0). Certain Operations cards can also move demand (see §Operations Cards).

The bell-curve probability of 2d6 means demand naturally tends toward the middle of its range, with rare booms and crashes.

---

# 🎴 Phase 2: Draw Phase

Each player draws **8 cards** from their personal resource deck. If the deck runs out, shuffle the discard pile to form a new deck and continue drawing.

Each player also draws **1 Operations card** from the shared Operations deck and adds it to their operations hand. Operations cards are held across rounds until played.

---

# 🛢️ Phase 3: Age Phase

Players may place a card from their hand on each of their barrels to advance its age. Aging is optional, but it is the primary path to reputation — most barrels need to age for several rounds before they pay out well.

## Age Bourbon

Choose one of *your own* barrels in your rickhouse. Take one resource or capital card from your hand and place it face-down on top of that barrel. The card is committed to aging and cannot be used until the barrel is sold.

The number of cards on top of a barrel equals its age (in years). A barrel may only be aged once per round (one card per barrel per round, unless a card explicitly allows otherwise).

When the barrel is sold, all cards committed to its aging return to the player's discard pile.

---

# 🎯 Phase 4: Action Phase

Players take turns clockwise. On your turn, you take one action. The phase continues until **all players have exhausted their hands or passed**.

A player whose hand is empty is "out" for the round and skipped on subsequent turns. A player who passes is also out for the round; any resource cards remaining in their hand are held until cleanup, when they go to the discard pile. Passing is a hard commitment — you cannot rejoin the round.

**Operations cards may be played at any point during your turn**, before or after your main action, at no additional cost. Playing an Operations card does not consume your action for the turn. Each Operations card may only be played once.

## Available Actions

Each action requires spending one or more cards from your hand. Spent cards go to your discard pile unless otherwise noted.

Players can:
- Buy from the Market
- Make Bourbon
- Sell Bourbon
- Rush to Market
- Draw a Mash Bill
- Trade
- Convert (3:1)
- Trash a Card
- Pass Turn

### Buy from the Market

Spend cards from your hand totaling at least the cost of a card in the Market. Most basic cards cost 1; premium cards may cost more. A capital card contributes its printed value toward the purchase price; every other card counts as 1.

Both the **spent card(s)** and the **purchased card** go to your discard pile. After purchase, refill the Market by drawing a new card from the supply deck.

For example, a card with cost 4 can be bought by discarding any 4 cards from hand, or by combining a +2 capital with two other cards, or by combining a +3 capital with one other card.

Cards can only be purchased one at a time. There is no bundling and no carryover. If you overpay, the excess value is lost — using a +3 capital to buy a 2-cost card does not let you spend the leftover 1 on another card.

### Make Bourbon

Assemble a legal mash from your hand and produce bourbon. To be legal, the mash must include at least 1 cask, 1 corn, and 1 grain, plus any extra requirements printed on the chosen mash bill (see §Per-Bill Recipes).

Place the mash bill face-up on a new barrel in **your rickhouse**, with all the resource cards spent on production face-up beneath it. The mash bill stays attached to the barrel for its lifetime.

The cards spent on production are locked with the barrel and do not count toward its age. They return to your discard pile only when the barrel is sold.

If **your** rickhouse is full, this action is unavailable to you. Other players are unaffected.

#### Failed Batch (optional)

While producing a barrel, you may also discard one extra card from your hand and **trash** it (remove it from the game permanently). This is one of two ways to thin your deck (see §Trashing Cards).

### Sell Bourbon

Sell any of your barrels that is at least 2 years old. Reference the attached mash bill's grid using the barrel's age and the current demand to determine the total reward (N).

You may allocate N across two outcomes, in any combination, with the total spent ≤ N:

- **Gain Reputation** — advance your reputation track.
- **Gain Purchasing Power** — spend points as currency to buy cards from the market right now, following normal market costs.

Any unspent portion of N is automatically converted to reputation. Cards purchased this way go to your discard pile, the same as any other purchase. Purchasing power from a single sale cannot be saved for a later turn and cannot chain into another Sell action.

After resolving the sale:
- Reduce demand by 1 (floored at 0).
- Discard the mash bill, unless an award says otherwise (see §Bourbon Awards).
- Return all aging cards and ingredient cards on the barrel to your discard pile.
- Remove the barrel from your rickhouse.

### Rush to Market

Sell one of your barrels that is only **1 year old** — below the normal minimum age. This is a distress sale and carries penalties:

- The reputation reward is **half the normal grid value**, rounded down (minimum 1).
- **Demand does not drop** after a Rush to Market sale.
- The purchasing power option is **not available** — the full (halved) reward converts directly to reputation.

All other sale resolution steps apply normally. Rush to Market is the primary comeback mechanism for players who are hand-starved or locked into a bad position. It frees cards from a barrel at significant cost.

### Draw a Mash Bill

Three mash bills are kept face-up beside the Bourbon deck. On your turn you may take either:

- **A face-up mash bill** — pay its printed capital cost. Capital cards pay at their printed value; any other card counts as 1 toward the cost. Refill the face-up row by drawing the top mash bill from the Bourbon deck.
- **The top of the Bourbon deck (blind)** — pay any 1 card from your hand.

Spent cards go to your discard pile. The acquired mash bill goes into your hand.

When the Bourbon deck *and* the face-up row are both empty, the final round trigger activates.

### Trade

Two players may trade cards and make agreements by mutual consent. Each side must offer at least one card. **Traded cards go to the recipient's discard pile**, not their hand.

Trade costs **one action** for the active player only. The other player does not lose a turn or pay any extra card cost.

Trades may include informal agreements — for example, a player may offer cards now in exchange for a promised future action, a rickhouse leasing arrangement, or a deferred reputation split. Informal agreements are **not enforced by the rules** and rely on player honor. The game does not police side deals.

Trading is not allowed during the final round.

### Convert (3:1)

If you cannot make bourbon due to a missing resource type, you may use **3 cards from your hand** to count as **1 unit** of any basic resource (cask, corn, or basic grain) for a single bourbon production. Only basic resources can be created this way; premium variants cannot be produced through conversion. Capital cards may be used as part of the 3 spent, but each capital card counts as 1 in conversion regardless of its printed value.

The 3 cards spent on conversion are committed to the barrel alongside the rest of the mash and return to your discard pile when the barrel is sold.

### Trash a Card

You may spend 1 card from your hand to permanently remove 1 other card from your hand. The trashed card is removed from the game; the spent card goes to your discard pile.

(See also the Failed Batch sub-option of Make Bourbon for a second way to trash.)

### Pass Turn

End your turn voluntarily. Resource cards remaining in your hand are held until cleanup, when they go to the discard pile. Operations cards in hand are held across rounds. Once you pass, you are out for the round and skipped on subsequent turns.

---

# 🃏 Operations Cards

Operations cards represent market moves, regulatory events, competitive pressure, and moments of opportunism. They are drawn from a shared Operations deck — one per player per round — and held across rounds until played.

## How Operations Cards Work

- Drawn at the start of each round during the Draw Phase (1 card per player).
- Held in a separate operations hand. There is no limit to how many you may hold.
- Played during **your turn in the Action Phase**, before or after your main action. Playing an Operations card is free and does not consume your action.
- Each Operations card is **one-time use** and is discarded after play unless the card states otherwise.
- Operations cards cannot be traded.
- Operations cards are **not** played during the final round, except those already triggered before the final round began.

## Operations Card Examples

The following are representative examples. The full Operations deck is defined in the Operations Card Set.

---

**Market Manipulation**
*Move the Demand Track up or down by 1. This effect occurs immediately and stacks with normal demand changes this round.*

The single most important gap in the base game's demand system. Rare and powerful — hold it for the right moment.

---

**Regulatory Inspection**
*Target one of any player's upper tier barrel slots. That barrel may not be aged this round.*

Represents a real-world regulatory hold. Targets the upper tier only — bonded warehouse barrels are legally protected and cannot be inspected. The affected barrel ages normally next round.

---

**Rushed Shipment**
*Age one of your barrels twice this round instead of once. Place 2 aging cards on a single barrel during the Age Phase.*

Accelerates a barrel's timeline at the cost of two hand cards instead of one. Powerful in the late game when a barrel is close to a valuable age band.

---

**Distressed Sale Notice**
*Force a player with a full rickhouse to immediately Rush to Market on one of their barrels of your choice. That player resolves the Rush to Market sale on their next turn.*

Aggressive. Targets players overextended in production. The forced barrel is chosen by the playing player; the affected player resolves the sale.

---

**Barrel Broker**
*Arrange a Secondary Market sale. One of your barrels transfers to another player's empty upper tier slot at a negotiated card payment agreed between both players. The receiving player inherits the barrel at its current age and attached mash bill. Demand does not drop.*

Enables a private economy alongside the public market. Both players must agree to terms. The barrel's bonded status does not transfer — it occupies the recipient's upper tier only.

---

**Market Corner**
*Remove one face-up card from the Market Conveyor and place it in your hand. You do not pay its cost. Refill the Market normally.*

Represents cornering a scarce resource before opponents can buy it. The acquired card goes to hand immediately and can be used this round.

---

**Blend**
*Combine two of your own barrels into one. The blended barrel takes the higher age, the higher-value mash bill, and all ingredient and aging cards from both barrels. The lower-value mash bill is discarded. The merged barrel occupies one slot; the freed slot is immediately available.*

One of the most powerful operations cards. Best used when one barrel is aging well and another is underperforming. Both barrels must be in your rickhouse and neither can be in the bonded warehouse.

---

**Demand Surge**
*The Demand Track does not drop when you sell your next barrel this round.*

Allows a high-demand sale without paying the demand cost. Particularly powerful when multiple players are timing sales against a peak demand moment.

---

# 🥇 Bourbon Awards

Some mash bills grant special awards when their bourbon is sold.

## Silver — Bill Returns to Hand

A Silver award returns the mash bill to the player's hand instead of being discarded. The bill can be attached to a future barrel.

## Gold — Permanent Recipe

A Gold award removes the mash bill from circulation and places it face-up in front of the player as a permanent unlocked recipe. The unlocked Gold recipe may be applied as a free option at sale time on any future barrel, providing its reputation reward instead of the attached mash bill's normal reward. The attached mash bill on that barrel is discarded normally.

Gold awards do not trigger the final round in this version of the game — only the exhaustion of the Bourbon supply does.

## Award Precedence

If a sale qualifies for both Silver and Gold, Gold takes precedence.

---

# 📊 Market Demand

Demand ranges from **0 to 12**. It begins at 0.

- **Rises by 1** at the start of each round if 2d6 rolls higher than the current demand.
- **Falls by 1** each time a barrel is sold via Sell Bourbon (floored at 0).
- **Unaffected** by Rush to Market sales.
- **Can be moved** by certain Operations cards.

Demand affects every sale. The mash bill's grid uses the current demand to determine the reputation reward.

## Demand Bands

Each mash bill defines its own demand band thresholds. Some bills favor low demand; others require high demand to pay out at all. Reading a mash bill's demand bands before attaching it to a barrel is part of the game.

---

# 📈 Mash Bill Pricing

Every mash bill prints a grid based on age and demand. More premium bourbons have more complex grids; common barrels typically have a simple 2x2 or 3x3 grid. There is no shared lookup table — each bill defines its own scale.

To read a sale:
1. Find the highest age threshold ≤ the barrel's age — that's the row.
2. Find the highest demand threshold ≤ current demand — that's the column.
3. The cell is the reputation reward (N).

Every legal sale pays at least 1 reputation. The barrel sells, demand drops by 1, and the player gains the printed reward.

## Example

**Backroad Batch** — workhorse bill:

`ageBands: [2, 4, 6]`, `demandBands: [2, 4, 6]`

| Age \ Demand | 2–3 | 4–5 | 6+ |
|---|:-:|:-:|:-:|
| 2–3 | 1 | 2 | 3 |
| 4–5 | 2 | 4 | 5 |
| 6+  | 3 | 5 | 6 |

A 5-year barrel sold at demand 7 yields **5 reputation**, which the player may split between the reputation track and purchasing power.

---

# 🃏 Trashing Cards

Cards can be permanently removed from a player's deck (trashed) two ways:

- **Trash a Card** as a standalone action — spend 1 card from hand to trash 1 other card from hand.

Trashed cards are removed from the game — they do not return to the deck, discard pile, or any other zone.

---

# 🔁 The Core Loop

You select a distillery. You draft mash bills. You build a starter deck. You draw 8 cards each round plus an operations card. You make bourbon. You age it by locking cards on top. You sell when demand favors you. You take reputation, or cards, or both. You buy from the market when needed. You play operations cards at the right moment. You time your endgame.

The mash bill supply is the doomsday clock. Drawing mash bills accelerates the end.

---# 🥃 Bourbonomics

## Become the Bourbon Baron

Welcome to *Bourbonomics*, a deckbuilding strategy game about building a bourbon empire through patience, timing, and the discipline of inventory management. Recommended for **2–4 players**; supported for 5–6.

Each player owns a distillery and competes to earn the most reputation. Barons select a distillery, draft mash bills, manage a personal deck of resource cards, produce bourbon, age it over time, and sell it at the perfect moment to convert tied-up inventory into reputation.

The challenge isn't just making bourbon — it's knowing **when** to make it, **how long** to age it, and **what to give up** while you wait.

> **Scope note (v2.1 alpha).** This rulebook covers the implemented core: distillery selection, drafting, the round loop, production, aging, selling, market buying, operations cards, trading, and the doomsday-deck endgame. Investment cards are planned for a later release; their design is sketched in [`PLANNED_MECHANICS.md`](PLANNED_MECHANICS.md) and is not part of the current rules. The current build is **computer-only** — every player slot is filled by a heuristic bot. A human-controlled player slot will land alongside the UI work.

---

# 🏆 Winning the Game

The game ends when **the last mash bill leaves the Bourbon supply** — that is, when the Bourbon deck is empty *and* the face-up mash bill row is empty. Drawing or acquiring the final mash bill triggers the final round. All players, including the triggering player, complete the current round normally. After the action phase ends, scoring occurs immediately.

The player with the **most reputation** at the end of the game wins. Tiebreakers, in order:

1. Most barrels sold over the course of the game.
2. Shared victory.

## Why the Final Round Matters

The final round is when the most dramatic plays happen. Players race to liquidate aged barrels, push final reputation gains, and time their sales against fluctuating demand. Cards committed to barrels that don't sell in the final round are lost — there is no next round for them to return to.

---

# 🎬 Setup

## Step 1: Distillery Selection

Each player selects a **Distillery Card** — a large-format player board that represents their operation for the entire game. The distillery card contains:

- The distillery's name, identity, and starting bonus
- The player's **Rickhouse** — 4 barrel slots arranged across two tiers (see §The Rickhouse)
- The player's **Reputation Track**
- Reference information for mash bills and demand bands

Distillery cards are selected in reverse snake order (last player picks first). Each distillery has a unique starting bonus tied to a specific card or permanent ability. No two players may select the same distillery.

### Distillery Bonuses

Each distillery bonus maps directly to a physical game element — a card, an extra slot, or a permanent rule modifier. Examples:

- **Warehouse Distillery** — start with 1 extra rickhouse slot (5 total). The extra slot is on the upper tier and is not part of your bonded warehouse.
- **High-Rye House** — start with 1 free 2-rye premium card already in your starter deck.
- **Wheated Baron** — your wheated mash bills cost 1 fewer grain card to produce (minimum 1).
- **The Broker** — once per round, you may trade without spending an action.
- **Old-Line Distillery** — your bonded warehouse holds 3 barrels instead of 2.

Specific distillery cards and their bonuses are defined in the distillery card set. Bonuses are public information from the moment of selection.

### The Vanilla Distillery

A player may choose the **Vanilla Distillery** instead of a named distillery. The Vanilla Distillery has no starting bonus and no special rules. It is intended as a challenge option for experienced players or for competitive play where bonus asymmetry is unwanted.

---

## Step 2: Mash Bill Draft

Each player drafts **3 mash bills** from a shared pool. The exact draft procedure is up to the group, but a snake draft (1-2-3-3-2-1) is recommended for fairness. These mash bills are the player's permanent recipes for the game, though more can be drawn during play.

---

## Step 3: Starter Deck Draft

Each player builds a personal **16-card starter deck** by selecting from the communal pool of "plain" cards. Players may choose any combination of:

- **Cask cards**
- **Corn cards**
- **Grain cards** (rye, barley, wheat — depending on the pool)
- **Capital cards**

A typical balanced starter might be 4 cask, 4 corn, 4 grain, 2 capital, plus 2 of the player's choice — but players are free to specialize. A player who plans to focus on high-rye bourbon might draft more rye-leaning grain cards. The draft itself is the first strategic decision of the game.

All cards in the starter deck are "plain" — basic versions of each type. Premium cards (like 2-rye) are only available through the market during play, or through a distillery bonus.

---

## Step 4: First Hand

After all players have drafted their starter decks, each player shuffles and draws **8 cards** as their opening hand. Play begins.

---

## Step 5: Board Setup

- Set up the **Market Conveyor**: 6 cards face-up from the market supply deck.
- Shuffle and place the **Operations Deck** face-down in the center. Deal each player **2 Operations cards** face-down as their starting operations hand.
- Set the **Demand Track** to **0** (starting position).
- Each player begins with **0 reputation**.
- Place the Bourbon deck (mash bills) face-down within reach.
- Roll for first player or use any agreed method to determine turn order.
- Place distillery cards in front of each player. Seated order determines rickhouse adjacency for the purposes of any operations cards that reference neighboring distilleries.

---

# 🗺️ Understanding the Board

## Shared Elements (Center of Table)

- **Market Conveyor** — 6 face-up cards available for purchase
- **Bourbon Deck** — the doomsday clock; 3 face-up mash bills beside it
- **Demand Track** — a shared strip tracking current demand (0–12)
- **Operations Deck** — face-down stack; source of operations cards

## Personal Elements (Each Player's Distillery Card)

- **Rickhouse** — your barrel slots, arranged in two tiers
- **Reputation Track** — your running score
- **Hand** — resource, capital, and operations cards
- **Deck and Discard Pile** — kept beside your distillery card

---

# 🏚️ The Rickhouse

Each player owns their rickhouse outright — it is printed on their distillery card. There is no shared barrel space. Your barrels age in your rickhouse. Opponents' barrels age in theirs.

## Rickhouse Layout

Each distillery card has **4 barrel slots** by default, arranged across two tiers:

**Bonded Warehouse (lower tier) — 2 slots**
Your bonded warehouse is inviolable. No operations card, trade agreement, or game effect can remove, reduce, or interfere with these 2 slots. They represent your core licensed operation and are always available for production.

**Upper Tier — 2 slots**
Your upper tier slots are standard production space. These slots can be affected by certain operations cards (see §Operations Cards). The Warehouse Distillery bonus adds a third upper tier slot.

## Rickhouse Capacity

A player's rickhouse capacity is the total number of slots on their distillery card. Default capacity is 4. The Warehouse Distillery bonus raises this to 5. Investment cards (planned) may raise it further, to a maximum of 6.

When **your** rickhouse is full, you cannot Make Bourbon until you sell a barrel and free a slot. Other players are unaffected by the state of your rickhouse.

A full personal rickhouse is a self-imposed constraint — the consequence of ambitious production decisions. You have committed resources to more barrels than you can comfortably manage, and now every new production must wait for a sale. Managing this tension is one of the central disciplines of the game: knowing when your rickhouse can absorb another barrel and when you need to liquidate before you produce again.

## Rickhouse and Player Interaction

Players do not directly interfere with each other's rickhouse slots in the base game. However:

- Certain **Operations cards** can affect neighboring players' upper tier slots (see §Operations Cards).
- Players may informally agree to **rickhouse leasing** as part of a Trade — one player offers use of an empty upper tier slot to another for a negotiated card payment. Leasing is entirely voluntary, governed by the Trade rules, and has no dedicated mechanic. The leaseholder places their barrel in the owner's upper tier slot; the owner's bonded warehouse is never part of any lease agreement.

---

# 📜 Mash Bills

Mash bills are recipes that determine each barrel's reputation reward when sold. Players draft 3 at game start; more can be drawn during play.

Mash bills are committed **at production, not at sale**. When you make bourbon, you choose one mash bill from your hand and place it face-up on the new barrel. Once placed, the mash bill is **locked to that barrel for its lifetime** and becomes public information.

When a barrel is sold, the attached mash bill's grid determines the reputation reward based on the barrel's age and the current demand. The mash bill is then discarded and cannot be reused (unless it carries an award that returns or removes it — see §Bourbon Awards).

A player with **no mash bills in hand cannot make bourbon**. As an action, a player may draw a mash bill from the Bourbon deck (see §Draw a Mash Bill).

If the Bourbon deck *and* the face-up mash bill row are both empty, the **final round trigger** activates. The deck is *not* reshuffled.

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

Each player draws **8 cards** from their resource deck at the start of every round, plus **1 Operations card** from the Operations deck (see §Operations Cards).

There is no maximum hand size during a turn (mid-sale draws can temporarily expand a hand). At the end of each round, all unused resource and capital cards in hand are placed in the discard pile. Unplayed Operations cards are **held** — they do not discard at end of round and may be played in a future round.

## Deck Composition

A player's deck contains a mix of:
- **Resource cards** (cask, corn, grain — including premium variants like 2-rye).
- **Capital cards** (currency for market purchases, mash bill draws, and investments).

Mash bills and Operations cards are *not* part of the resource deck. They are managed separately. The 16-card starter deck contains only resource and capital cards.

Decks grow through market purchases. The effective size of your working deck shrinks as cards are committed to aging barrels — those cards are unavailable until their barrel sells (see §Age Bourbon).

## Card Types

### Resource Cards
Resources are cask, corn, wheat, rye, and barley. These are needed to make bourbon. Premium resource cards (which count for more than one unit, e.g., 2-rye) can be purchased from the market.

### Capital Cards
Capital cards are spent as currency. They cannot be used to make bourbon. The number printed on a capital card is its **payment value**, and it pays at full printed value in any of these contexts:

- **Buying cards from the Market** (see §Buy from the Market).
- **Acquiring face-up mash bills** (see §Draw a Mash Bill).
- **Implementing Investment cards**, when that mechanic is added in a future release.

In every other context — conversion, trading, aging — a capital card counts as a single card, the same as any other.

### Operations Cards
Operations cards are a separate card type drawn from the Operations deck. They are played from hand as a free action during the Action Phase and represent market moves, regulatory events, and competitive plays. See §Operations Cards for full rules.

---

# 🔄 How a Round Works

Each round consists of five phases:

1. **Demand Phase** — Roll 2d6; if higher than current demand, demand +1.
2. **Draw Phase** — Each player draws 8 resource cards and 1 Operations card.
3. **Age Phase** — Players may place a card on top of each of their barrels to advance its age.
4. **Action Phase** — Players take turns spending cards as actions until all hands are exhausted.
5. **Cleanup Phase** — Unused resource cards go to discard, per-round flags reset, and the next round begins. If the final round was triggered, the game ends here and scoring occurs.

---

# 🎲 Phase 1: Demand Phase

At the start of each round, **roll 2d6**. If the result is **greater than** the current demand, demand increases by 1 (capped at 12). Otherwise, demand remains unchanged.

This is the only way demand rises naturally. Sales reduce demand by 1 each (floored at 0). Certain Operations cards can also move demand (see §Operations Cards).

The bell-curve probability of 2d6 means demand naturally tends toward the middle of its range, with rare booms and crashes.

---

# 🎴 Phase 2: Draw Phase

Each player draws **8 cards** from their personal resource deck. If the deck runs out, shuffle the discard pile to form a new deck and continue drawing.

Each player also draws **1 Operations card** from the shared Operations deck and adds it to their operations hand. Operations cards are held across rounds until played.

---

# 🛢️ Phase 3: Age Phase

Players may place a card from their hand on each of their barrels to advance its age. Aging is optional, but it is the primary path to reputation — most barrels need to age for several rounds before they pay out well.

## Age Bourbon

Choose one of *your own* barrels in your rickhouse. Take one resource or capital card from your hand and place it face-down on top of that barrel. The card is committed to aging and cannot be used until the barrel is sold.

The number of cards on top of a barrel equals its age (in years). A barrel may only be aged once per round (one card per barrel per round, unless a card explicitly allows otherwise).

When the barrel is sold, all cards committed to its aging return to the player's discard pile.

---

# 🎯 Phase 4: Action Phase

Players take turns clockwise. On your turn, you take one action. The phase continues until **all players have exhausted their hands or passed**.

A player whose hand is empty is "out" for the round and skipped on subsequent turns. A player who passes is also out for the round; any resource cards remaining in their hand are held until cleanup, when they go to the discard pile. Passing is a hard commitment — you cannot rejoin the round.

**Operations cards may be played at any point during your turn**, before or after your main action, at no additional cost. Playing an Operations card does not consume your action for the turn. Each Operations card may only be played once.

## Available Actions

Each action requires spending one or more cards from your hand. Spent cards go to your discard pile unless otherwise noted.

Players can:
- Buy from the Market
- Make Bourbon
- Sell Bourbon
- Rush to Market
- Draw a Mash Bill
- Trade
- Convert (3:1)
- Pass Turn

### Buy from the Market

Spend cards from your hand totaling at least the cost of a card in the Market. Most basic cards cost 1; premium cards may cost more. A capital card contributes its printed value toward the purchase price; every other card counts as 1.

Both the **spent card(s)** and the **purchased card** go to your discard pile. After purchase, refill the Market by drawing a new card from the supply deck.

For example, a card with cost 4 can be bought by discarding any 4 cards from hand, or by combining a +2 capital with two other cards, or by combining a +3 capital with one other card.

Cards can only be purchased one at a time. There is no bundling and no carryover. If you overpay, the excess value is lost — using a +3 capital to buy a 2-cost card does not let you spend the leftover 1 on another card.

### Make Bourbon

Assemble a legal mash from your hand and produce bourbon. To be legal, the mash must include at least 1 cask, 1 corn, and 1 grain, plus any extra requirements printed on the chosen mash bill (see §Per-Bill Recipes).

Place the mash bill face-up on a new barrel in **your rickhouse**, with all the resource cards spent on production face-up beneath it. The mash bill stays attached to the barrel for its lifetime.

The cards spent on production are locked with the barrel and do not count toward its age. They return to your discard pile only when the barrel is sold.

If **your** rickhouse is full, this action is unavailable to you. Other players are unaffected.

### Sell Bourbon

Sell any of your barrels that is at least 2 years old. Reference the attached mash bill's grid using the barrel's age and the current demand to determine the total reward (N).

You may allocate N across two outcomes, in any combination, with the total spent ≤ N:

- **Gain Reputation** — advance your reputation track.
- **Gain Purchasing Power** — spend points as currency to buy cards from the market right now, following normal market costs.

Any unspent portion of N is automatically converted to reputation. Cards purchased this way go to your discard pile, the same as any other purchase. Purchasing power from a single sale cannot be saved for a later turn and cannot chain into another Sell action.

After resolving the sale:
- Reduce demand by 1 (floored at 0).
- Discard the mash bill, unless an award says otherwise (see §Bourbon Awards).
- Return all aging cards and ingredient cards on the barrel to your discard pile.
- Remove the barrel from your rickhouse.

### Rush to Market

Sell one of your barrels that is only **1 year old** — below the normal minimum age. This is a distress sale and carries penalties:

- The reputation reward is **half the normal grid value**, rounded down (minimum 1).
- **Demand does not drop** after a Rush to Market sale.
- The purchasing power option is **not available** — the full (halved) reward converts directly to reputation.

All other sale resolution steps apply normally. Rush to Market is the primary comeback mechanism for players who are hand-starved or locked into a bad position. It frees cards from a barrel at significant cost.

### Draw a Mash Bill

Three mash bills are kept face-up beside the Bourbon deck. On your turn you may take either:

- **A face-up mash bill** — pay its printed capital cost. Capital cards pay at their printed value; any other card counts as 1 toward the cost. Refill the face-up row by drawing the top mash bill from the Bourbon deck.
- **The top of the Bourbon deck (blind)** — pay any 1 card from your hand.

Spent cards go to your discard pile. The acquired mash bill goes into your hand.

When the Bourbon deck *and* the face-up row are both empty, the final round trigger activates.

### Trade

Two players may trade cards and make agreements by mutual consent. Each side must offer at least one card. **Traded cards go to the recipient's discard pile**, not their hand.

Trade costs **one action** for the active player only. The other player does not lose a turn or pay any extra card cost.

Trades may include informal agreements — for example, a player may offer cards now in exchange for a promised future action, a rickhouse leasing arrangement, or a deferred reputation split. Informal agreements are **not enforced by the rules** and rely on player honor. The game does not police side deals.

Trading is not allowed during the final round.

### Convert (3:1)

If you cannot make bourbon due to a missing resource type, you may use **3 cards from your hand** to count as **1 unit** of any basic resource (cask, corn, or basic grain) for a single bourbon production. Only basic resources can be created this way; premium variants cannot be produced through conversion. Capital cards may be used as part of the 3 spent, but each capital card counts as 1 in conversion regardless of its printed value.

The 3 cards spent on conversion are committed to the barrel alongside the rest of the mash and return to your discard pile when the barrel is sold.

### Pass Turn

End your turn voluntarily. Resource cards remaining in your hand are held until cleanup, when they go to the discard pile. Operations cards in hand are held across rounds. Once you pass, you are out for the round and skipped on subsequent turns.

---

# 🃏 Operations Cards

Operations cards represent market moves, regulatory events, competitive pressure, and moments of opportunism. They are drawn from a shared Operations deck — one per player per round — and held across rounds until played.

## How Operations Cards Work

## Operations Card Examples

The following are representative examples. The full Operations deck is defined in the Operations Card Set.

---

**Market Manipulation**
*Move the Demand Track up or down by 1. This effect occurs immediately and stacks with normal demand changes this round.*

The single most important gap in the base game's demand system. Rare and powerful — hold it for the right moment.

---

**Regulatory Inspection**
*Target one of any player's upper tier barrel slots. That barrel may not be aged this round.*

Represents a real-world regulatory hold. Targets the upper tier only — bonded warehouse barrels are legally protected and cannot be inspected. The affected barrel ages normally next round.

---

**Rushed Shipment**
*Age one of your barrels twice this round instead of once. Place 2 aging cards on a single barrel during the Age Phase.*

Accelerates a barrel's timeline at the cost of two hand cards instead of one. Powerful in the late game when a barrel is close to a valuable age band.

---

**Distressed Sale Notice**
*Force a player with a full rickhouse to immediately Rush to Market on one of their barrels of your choice. That player resolves the Rush to Market sale on their next turn.*

Aggressive. Targets players overextended in production. The forced barrel is chosen by the playing player; the affected player resolves the sale.

---

**Barrel Broker**
*Arrange a Secondary Market sale. One of your barrels transfers to another player's empty upper tier slot at a negotiated card payment agreed between both players. The receiving player inherits the barrel at its current age and attached mash bill. Demand does not drop.*

Enables a private economy alongside the public market. Both players must agree to terms. The barrel's bonded status does not transfer — it occupies the recipient's upper tier only.

---

**Market Corner**
*Remove one face-up card from the Market Conveyor and place it in your hand. You do not pay its cost. Refill the Market normally.*

Represents cornering a scarce resource before opponents can buy it. The acquired card goes to hand immediately and can be used this round.

---

**Blend**
*Combine two of your own barrels into one. The blended barrel takes the higher age, the higher-value mash bill, and all ingredient and aging cards from both barrels. The lower-value mash bill is discarded. The merged barrel occupies one slot; the freed slot is immediately available.*

One of the most powerful operations cards. Best used when one barrel is aging well and another is underperforming. Both barrels must be in your rickhouse and neither can be in the bonded warehouse.

---

**Demand Surge**
*The Demand Track does not drop when you sell your next barrel this round.*

Allows a high-demand sale without paying the demand cost. Particularly powerful when multiple players are timing sales against a peak demand moment.

---

# 🥇 Bourbon Awards

Some mash bills grant special awards when their bourbon is sold.

## Silver — Bill Returns to Hand

A Silver award returns the mash bill to the player's hand instead of being discarded. The bill can be attached to a future barrel.

## Gold — Permanent Recipe

A Gold award removes the mash bill from circulation and places it face-up in front of the player as a permanent unlocked recipe. The unlocked Gold recipe may be applied as a free option at sale time on any future barrel, providing its reputation reward instead of the attached mash bill's normal reward. The attached mash bill on that barrel is discarded normally.

Gold awards do not trigger the final round in this version of the game — only the exhaustion of the Bourbon supply does.

## Award Precedence

If a sale qualifies for both Silver and Gold, Gold takes precedence.

---

# 📊 Market Demand

Demand ranges from **0 to 12**. It begins at 0.

- **Rises by 1** at the start of each round if 2d6 rolls higher than the current demand.
- **Falls by 1** each time a barrel is sold via Sell Bourbon (floored at 0).
- **Unaffected** by Rush to Market sales.
- **Can be moved** by certain Operations cards.

Demand affects every sale. The mash bill's grid uses the current demand to determine the reputation reward.

## Demand Bands

Each mash bill defines its own demand band thresholds. Some bills favor low demand; others require high demand to pay out at all. Reading a mash bill's demand bands before attaching it to a barrel is part of the game.

---

# 📈 Mash Bill Pricing

Every mash bill prints a grid based on age and demand. More premium bourbons have more complex grids; common barrels typically have a simple 2x2 or 3x3 grid. There is no shared lookup table — each bill defines its own scale.

To read a sale:
1. Find the highest age threshold ≤ the barrel's age — that's the row.
2. Find the highest demand threshold ≤ current demand — that's the column.
3. The cell is the reputation reward (N).

Every legal sale pays at least 1 reputation. The barrel sells, demand drops by 1, and the player gains the printed reward.

## Example

**Backroad Batch** — workhorse bill:

`ageBands: [2, 4, 6]`, `demandBands: [2, 4, 6]`

| Age \ Demand | 2–3 | 4–5 | 6+ |
|---|:-:|:-:|:-:|
| 2–3 | 1 | 2 | 3 |
| 4–5 | 2 | 4 | 5 |
| 6+  | 3 | 5 | 6 |

A 5-year barrel sold at demand 7 yields **5 reputation**, which the player may split between the reputation track and purchasing power.

---

# 🔁 The Core Loop

You select a distillery. You draft mash bills. You build a starter deck. You draw 8 cards each round plus an operations card. You make bourbon. You age it by locking cards on top. You sell when demand favors you. You take reputation, or cards, or both. You buy from the market when needed. You play operations cards at the right moment. You manage your four slots. You time your endgame.

The mash bill supply is the doomsday clock. Drawing mash bills accelerates the end.

---

# 🎲 Player Count Notes

Bourbonomics is designed and balanced for **2–4 players**.

- **2 players** — fastest game, highest variance. Demand swings more dramatically with fewer sales to anchor it. Each player has more room to breathe in their own rickhouse and the game rewards sharp, tactical play over long-arc planning.
- **3 players** — the sweet spot. Demand pressure is meaningful, operations cards create genuine table moments, and the doomsday clock moves at a satisfying pace.
- **4 players** — the fullest experience. Operations cards spark real drama, the demand track is actively contested, and the final round tends to be the most chaotic and memorable.

**5–6 players** are supported but the game plays differently at those counts. Downtime between turns increases noticeably, and the demand track moves unpredictably under the weight of more sales. Recommended only for groups already comfortable with the rules who want a longer, louder experience.

---

# 🥃 Final Thought

Bourbonomics isn't about making bourbon.

It's about knowing what to lock up, what to let go, and when the world is ready to pay.

# 🎲 Player Count Notes

Bourbonomics is designed and balanced for **2–4 players**.

- **2 players** — fastest game, highest variance. Demand swings more dramatically. Rickhouse pressure is lower. Recommended for experienced players who want a sharp, tactical game.
- **3 players** — the sweet spot. Balanced demand pressure, meaningful rickhouse tension, and enough player interaction to make operations cards interesting.
- **4 players** — the fullest experience. Rickhouse pressure is real, operations cards create table drama, and the final round is genuinely tense.

**5–6 players** are supported but the game plays differently at those counts. Downtime between turns increases, rickhouse pressure is extreme from the early rounds, and the demand track moves unpredictably. Recommended only for groups comfortable with the rules who want a longer, more chaotic experience.

---

# 🥃 Final Thought

Bourbonomics isn't about making bourbon.

It's about knowing what to lock up, what to let go, and when the world is ready to pay.