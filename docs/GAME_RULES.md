# 🥃 Bourbonomics

## Become the Bourbon Baron

Welcome to *Bourbonomics*, an economic strategy game about building a bourbon empire in a shifting and often unpredictable market.

Each player owns a distillery and tries to grow their business into the most valuable bourbon empire. Barons source ingredients, produce bourbon, age it over time, and sell it at the perfect moment. Along the way, you'll invest in your distillery, improve operations, adapt to market conditions, and try to outmaneuver your competitors.

The challenge isn't just making bourbon—it's knowing **when** to make it, **where** to store it, and **when** to sell.

---

# 🏆 Winning the Game

The game ends when a player **unlocks** their third Gold Bourbon. Unlocking the third Gold does not end the round immediately — it announces that the **current round is the final round**.

The action phase continues normally for all players, including the triggering player. All standard actions are allowed: production, sales, drawing cards, calling audits, installing investments, and playing Operations cards. The paid-action pivot and audit rules apply as usual.

After the action phase ends, scoring occurs immediately. The Market Phase is skipped in the final round — there is no next round for market effects to apply to.

## Scoring

Each player calculates their final score by totaling the following:

- **Cash:** Face value (each $1 in cash = $1 in score).
- **Active Investments:** Each active investment scores its printed installation cost.
- **Unlocked Gold Bourbons:** Each scores its listed Brand Value.
- **Cards in hand (mash bills, Investments not yet installed, Operations cards):** Score $0.

The highest total wins. Ties are broken first by number of unlocked Gold Bourbons, then by remaining cash. If still tied, the win is shared.

## Why the Final Round Matters

Triggering the third Gold doesn't immediately end play — every player, including the triggerer, takes their full set of actions in the final round. Most players will use the final round to liquidate barrels at current demand. Because each sale lowers demand by 1, selling order matters enormously: the first player to sell in the final round gets peak prices, while later sellers may face a crashed market. Smart play earlier in the game (pre-selling barrels, banking cash) sets up a strong position for this final scramble.

---

# 🎬 Setup

Each player starts with **$40** in initial capital. No one starts with investments in play.

Shuffle all decks separately: the resource piles (Cask, Corn, Grain), the Bourbon cards, the Investment cards, the Operations cards, and the Market cards.

Deal each player 4 Bourbon cards (called "mash bills") as their starting hand. Mash bills are kept hidden from other players until played onto a barrel.

Set the market demand to **6**. This number will rise and fall throughout the game and directly affects how valuable your bourbon is when you sell it.

---

# 🗺️ Understanding the Board

The game revolves around three main areas: the **market**, the **rickhouses**, and the **business decks**.

The market consists of three face-down piles: casks, corn, and grain. These represent the raw materials you'll use to produce bourbon.

Rickhouses are shared storage locations where your bourbon ages. Each rickhouse has limited capacity, so space becomes competitive over time.

The business decks contain Investment cards (long-term upgrades), Operations cards (short-term advantages), and the **Bourbon deck** of mash bills (the brands that decide how much each barrel sells for — see §Mash Bills).

Lastly there are the Market cards, which are drawn at the end of each round.

---

# 📜 Mash Bills

Bourbon cards are called **mash bills** — recipes that determine each barrel's sale price based on its age and current market demand.

Mash bills are committed **at production, not at sale**. When you make bourbon, you choose one mash bill from your hand and place it face-up on the new barrel. Once placed, the mash bill is **locked to that barrel for its lifetime** and becomes public information that any player may inspect.

When the barrel is sold, the attached mash bill's grid determines the payout based on the barrel's age and the current demand band.

Each mash bill defines **its own age and demand band thresholds** (always three of each, increasing) in addition to its 3×3 grid of sale prices. A workhorse bill might use shallow bands (e.g. age `2 / 4 / 6`, demand `2 / 4 / 6`); a premium bill might use deep ones (e.g. age `6 / 8 / 10`, demand `6 / 8 / 12`). A barrel's sale price is always read from the **attached bill's** thresholds against its current age and the global market demand — there is no shared lookup table. See §Mash Bill Pricing for the mechanics.

A player with **no mash bills in hand cannot make bourbon**. As an action, a player may draw a mash bill from the Bourbon deck. There is no swap-and-replace; mash bills accumulate freely until the 10-card hand limit is enforced via an Audit.

If the Bourbon deck runs out, **reshuffle the Bourbon discard pile** to form a new deck and continue play.

## Per-Bill Mash Recipes

In addition to the universal mash rules (§Making Bourbon), some mash bills carry an explicit **recipe** — extra grain requirements that the mash committed at production must satisfy. Recipes only ever **tighten** the universal rules; they never loosen them.

A recipe can specify a `min` count, a `max` count, or both, on each of: **corn**, **barley**, **rye**, **wheat**, and **total grain** (corn + small grains). A `max: 0` entry means the recipe **forbids** that grain (e.g. a wheated bill that excludes rye).

Examples:

- **High-rye** bill — recipe: `rye ≥ 3`. Three rye cards must be in the mash.
- **Wheated** bill — recipe: `wheat ≥ 1, no rye`. Wheat is required; rye is forbidden.
- **Four-grain** bill — recipe: `barley ≥ 1, rye ≥ 1, wheat ≥ 1`. All three small grains are required.
- **High-corn** bill — recipe: `corn ≥ 3`.

Mash bills without a printed recipe accept any legal mash. Recipes are public information once the bill is in play; the make-bourbon UI surfaces the bill's requirements live as the mash is being assembled.

---

# 🃏 Hand Limit

A player's hand may contain a mix of **mash bills, Investment cards, and Operations cards**. The soft hand limit is **10 cards total** across all card types.

The limit is **soft** because nothing prevents you from temporarily exceeding it. Instead, the limit is enforced by a player-triggered mechanism called the **Audit** (see next section).

---

# 🔍 The Audit

As their action on their turn, a player may **call an Audit**.

When an Audit is called, **all players** (including the auditor) holding **more than 10 cards** in hand must immediately discard down to 10. The discarding player chooses which cards to discard. Discarded cards go to their appropriate discard piles — mash bills to the Bourbon discard, Investments to the Investment discard, Operations to the Operations discard.

Players already at 10 or fewer cards are unaffected.

**Only one Audit may be called per round.** After an Audit is called, no further Audits may be called until the next round. The auditor's action is consumed by the Audit, regardless of whether any opponents had to discard.

*Thematically, think of this as a regulatory inspection — distillery audits are part of the bourbon business.*

---

# 🔄 How a Round Works

Each round represents a year and is played in three phases: **Rickhouse Fees**, **Action Phase**, and **Market Phase**.

---

# 💸 Phase 1: Rickhouse Fees

Skip this phase in the first round.

**Phase 1 sequence:** (a) any outstanding loan repayment is taken from the baron's cash first; (b) the baron may then take a Distressed Distiller's Loan if eligible; (c) rent is calculated and paid.

For each barrel you have aging in a rickhouse, you must pay rent. The rent is equal to the total number of barrels in that rickhouse, including those owned by other players.

If you pay the rent, your bourbon ages by one year. If you cannot pay, that barrel simply does not age this round. There are no additional penalties, but losing time can be costly.

## 🪙 Distressed Distiller's Loan

A baron who is short on cash at the start of Phase 1 may take a one-time **Distressed Distiller's Loan** from the bank. The loan is intentionally harsh — the **$5 interest is a real cost**, not a soft bridge — and lingering debt freezes the baron out of cash flow until it clears.

- **Eligibility:** At the start of Phase 1 (after any outstanding repayment is taken), the baron's available cash must be **less than the rent they owe this round**. The loan may be used **once per game** per baron — no stacking, no second loan, ever.
- **Loan amount:** **$10**, taken from the bank into the baron's cash pool immediately.
- **Repayment:** **$15** (the loan plus $5 interest), paid off the top at the **start of the next Phase 1**, before any rent is calculated.
- **The interest is a permanent score hit.** Even when paid in full on time, the loan permanently reduces the baron's final score by **$5** — that interest leaves their cash pool and never returns. Taking the loan is always a bet that surviving this round is worth $5 of end-game value.
- **Lingering debt is a punishment.** If the baron cannot repay $15 in full at the start of next Phase 1, they pay whatever cash they have toward the loan; the remaining debt does not compound, but **all future income goes to the bank first**. Every dollar earned (sales, operations effects, investment payouts) is automatically siphoned to the loan until the full **$15** is settled. The baron is effectively frozen out of cash flow for the duration — they cannot spend on actions, capital, or rent until the bank is paid in full, and they may not take another loan.
- **Tracking:** Place a "Loan" token in front of the baron while the loan is outstanding so the table remembers.

The loan is an emergency bridge — enough to cover a tight Phase 1 and keep barrels aging — but never a free expansion of capital.

---

# 🎯 Phase 2: Action Phase

This is the heart of the game.

Players take turns in clockwise order. Once around the table is a "loop". On your turn, you may take one action or pass. The phase continues looping around the table until all players pass.

At the beginning of the phase, all actions are free. This continues until the first player decides to pass.

When that pass happens, two things take effect:

- The remaining players in that loop each still get a **free action** — the rest of the current loop is free.
- The passing player becomes the **paid-action pivot**: their seat is the marker where each new cost tier begins.

When play returns to the pivot, the **next loop starts and costs $1 per action**. Each subsequent return to the pivot advances the cost to **$2**, then **$3**, and so on — one full loop per cost tier.

If the pivot player chooses to re-enter the action phase on a paid loop, they pay the current loop's cost just like everyone else. Passing first does not exempt you from paid actions if you come back in.

The phase ends once all players pass in the same loop. The pivot player (the first to pass) also becomes the starting player for the next round.

---

# 🎲 Actions

On your turn, you choose one action from the list below.

You might **draw a resource card** from the market — a cask, corn, or grain — to build toward a mash.

You could **draw a card from a business deck**: a mash bill from the **Bourbon deck**, an **Investment** card, or an **Operations** card. Each of these is its own action — you pick one deck per turn. Mash bills accumulate in your hand freely; the 10-card hand limit is only enforced when someone calls an Audit.

You can **make bourbon**. To do this, you must combine at least one cask, one corn, and one grain, then choose one mash bill from your hand and place it face-up on the new barrel as you place it in an available rickhouse slot. The mash bill is locked to that barrel and becomes public information. You can add additional grains or corn to improve your mix, but you may only use one cask per barrel. A player with no mash bills in hand cannot make bourbon.

You can **sell bourbon** if the barrel is at least two years old. When you sell, refer to the mash bill attached to that barrel and determine the payout based on the bourbon's age and the current market demand. If the barrel satisfies the requirements of one of your already-unlocked Gold Bourbons, you may apply that Gold Bourbon's payout instead — this is free and always optional (see §Bourbon Awards). The mash bill is then discarded with the barrel; the exceptions are when its Silver award returns it to your hand, or its Gold award unlocks a new Gold Bourbon for you.

You may **implement an investment**. This requires paying the cost printed on the card. Once paid, the investment is placed in front of you and becomes active immediately. Each player may have no more than **three active investments at any time** — choose which long-term advantages matter most.

You may **play an Operations card**, which provides an immediate effect.

You may **call an Audit**, which forces every player holding more than 10 cards to discard down to 10. See the Audit section for full rules.

You may **pass**. The first player to pass becomes the paid-action pivot for the rest of the round (see §Phase 2: Action Phase).

At any time, players may **trade** freely. Trading does not require an action and can involve any combination of resources, cards, bourbon, or even investments.

---

# 🥃 The Bourbon Cycle

The core of the game follows a simple rhythm.

First, you gather resources from the market. Then you combine them to create bourbon and place it into a rickhouse. Over time, as you pay rent, your bourbon ages. Once it reaches at least two years, you may sell it for profit.

The longer you wait, the more valuable it can become—but the market may not cooperate.

---

# 📉 Phase 3: Market Phase

After all players have finished the action phase, the market shifts.

Each player, in turn, draws two Market cards. From those two, you choose one to resolve and discard the other.

The deck is intentionally **mixed**: roughly equal portions of cards that help the broad market, cards that hurt it, and **conditional** cards whose effect depends on board state — plus a small handful of neutral events. A typical "draw 2, pick 1" is therefore often a choice between two imperfect options, not a clear win. Reading the cards against your own position — and your opponents' — is the heart of the phase.

Most market effects apply during the **next round** and last for only one round. A smaller number are **persistent** for several rounds; persistent cards print their duration and continue to fire at the start of each subsequent round until they expire.

Some cards are **conditional** — they target specific players or board states (the player with the most barrels, every barrel in a particular rickhouse, sales of barrels above a certain age, sales that land in a bill's top demand band, etc.) — and so a card you choose to play can hurt you as easily as an opponent if the board shifts.

If the Market deck runs out, **reshuffle the discard pile** to form a new deck and continue play.

**Final Round Exception:** The Market Phase is skipped in the final round (the round in which a player unlocks their third Gold Bourbon). After the action phase ends, scoring occurs immediately.

---

### Example

You draw two cards:
- **Connoisseur boom** — *Demand +3 next round, but the boost only applies to sales of barrels aged 6+ years.*
- **Cooperage strike** — *Cask pile is locked next round.*

If you have a 7-year barrel queued to sell, the boom is golden — but if you don't, that +3 is locked away from you and the strike at least denies casks to everyone equally. The right pick depends on what's in your rickhouses, not on which card looks better in the abstract.

---

# 📊 Market Demand

Market demand ranges from 0 to 12 and begins at 6.

Each time a player sells bourbon, demand decreases by 1. High demand leads to better prices, while low demand reduces profits.

Managing demand—either by timing your sales or shaping the market—is one of the most important skills in the game.

## Demand Bands

Market demand always ranges 0–12, but **demand bands are defined per mash bill**, not globally. Each bill prints three demand thresholds (e.g. `3 / 6 / 9`, or `6 / 8 / 12`). At sale time the engine finds the highest band whose threshold is ≤ the current demand, and reads the price from the matching column of that bill's grid.

Some Market cards talk about demand in absolute terms (e.g. "demand +2", "if demand is above 6") — those still operate on the global 0–12 value. Other cards reference a bill's own bands (e.g. "sales in the highest demand band get +$2") — those resolve against whichever bill is on the barrel being sold.

Demand still **decreases by 1 per sale**, regardless of which bill was used.

# 📈 Mash Bill Pricing

Every mash bill prints a 3×3 grid (three age bands down, three demand bands across) **plus its own thresholds for those bands**. There is no shared age table or demand table — `[2, 4, 6]` on one bill and `[6, 8, 10]` on another are both legal and describe very different cards.

## Reading a Bill

1. Take the barrel's age. Find the highest of the bill's age thresholds that is ≤ the age — that's the row.
2. Take the current global market demand. Find the highest of the bill's demand thresholds that is ≤ the demand — that's the column.
3. The cell at that row × column is the sale price. Blank cells (`—`) pay $0.

The lowest age band is always indexed at the bill's first threshold — a barrel that just turned 2 sells using row 0, regardless of what the bill's age thresholds are. The global "must be ≥ 2 years old to sell" floor still applies, and a bill's first age threshold may not be set below 2.

## Design Intent

Three principles drive the numbers across the bill pool:

- **The lowest-band corner of any bill rarely pays.** Mistiming a sale into both the bill's lowest age band and lowest demand band should usually be a loss or break-even, not a profit. Most bills carry blanks here.
- **The middle band is the default outcome.** A typical sale lands in some middle cell and is modestly profitable — enough to cover the rent the barrel accumulated, with a little left over.
- **The top-right cell is the reward for good timing.** The jump from middle to highest demand band is large (often 50–100% per cell) so reading the market is meaningful. The jump from middle to highest age band is gentler (30–60% per cell) so rent eats much of the gain from extreme aging.

No single bill should dominate. A premium bill with a $22 ceiling has hard-to-reach band thresholds; a workhorse bill with a $6 ceiling has easy ones. Risk and reward are balanced across the pool.

## Examples

**Backroad Batch** — workhorse with shallow bands and modest payouts:

`ageBands: [2, 4, 6]`, `demandBands: [2, 4, 6]`

| Age \\ Demand | 2–3 | 4–5 | 6+ |
|---|:-:|:-:|:-:|
| 2–3 | $1 | $2 | $3 |
| 4–5 | $2 | $4 | $5 |
| 6+  | $3 | $5 | $6 |

**Cask 1849 Reserve** — patient bill that pays nothing young, big late:

`ageBands: [6, 8, 10]`, `demandBands: [6, 8, 12]`

| Age \\ Demand | 6–7 | 8–11 | 12 |
|---|:-:|:-:|:-:|
| 6–7  | —   | $5  | $9  |
| 8–9  | $5  | $11 | $16 |
| 10+  | $9  | $16 | $22 |

**High Tide 12** — demand specialist, blank below demand 7:

`ageBands: [3, 6, 9]`, `demandBands: [7, 9, 11]`

| Age \\ Demand | 7–8 | 9–10 | 11+ |
|---|:-:|:-:|:-:|
| 3–5 | —  | $4  | $7  |
| 6–8 | $4 | $9  | $13 |
| 9+  | $6 | $13 | $18 |

A blank cell ("—") means **this mash bill pays nothing** in that age-and-demand combination. Sparseness is intentional: every mash bill has gaps, and not every recipe rewards aging or scaling. Reading a mash bill's grid — including its own thresholds — **before you attach it to a barrel** is part of the game; once committed, you can't change your mind.

If you sell into a cell with no printed price, you simply collect nothing for that sale (the bill is still discarded or returned-to-hand normally per any award).

---

# 🏚️ Rickhouses

There are **six rickhouses**, each tied to a Kentucky bourbon region. They are shared by all players: once you place a barrel, it stays there permanently. Because rent is based on the total number of barrels in a location, crowded rickhouses become expensive. Choosing where to store your bourbon is often just as important as when to sell it.

| Region     | Capacity |
|------------|:--------:|
| Northern   | 3        |
| Louisville | 5        |
| Central    | 4        |
| Lexington  | 5        |
| Bardstown  | 6        |
| Western    | 3        |

Capacity is the maximum number of barrels (across all players) that can age in that rickhouse at any time. Total slots on the board: **26**.

---

# 🥇 Bourbon Awards

Some mash bills grant special awards when the bourbon they're attached to is sold. There are two tiers — Silver and Gold — and they behave very differently.

## Silver — Bill Returns to Hand

A **Silver award** returns the mash bill to the player's hand instead of being discarded with the barrel. The player can attach it to a future barrel like any other mash bill in their hand. Silver bills count toward the 10-card hand limit.

## Gold — Unlocked Gold Bourbon

A **Gold award** is a different beast. The mash bill itself is **removed from circulation** — the printed card is set face-up in front of the player as an **unlocked Gold Bourbon**, representing a permanent mastered bourbon style.

An unlocked Gold Bourbon:

- Is **not** part of the player's hand and **does not** count toward the 10-card hand limit.
- Cannot be attached to future barrels and cannot be discarded.
- Counts toward the **win condition** — unlocking the third Gold Bourbon triggers the final round.
- Scores its **listed Brand Value** at game end.

The mash bill that earned the Gold is *not* returned to the hand. It lives in front of the player as the Gold Bourbon for the rest of the game.

### Reusing an Unlocked Gold Bourbon

Once unlocked, a Gold Bourbon may be applied as a **free option at sale time**. When a player sells any barrel whose age, mash composition, and demand satisfy that Gold Bourbon's listed requirements, they may choose to apply the Gold Bourbon's payout/effect **instead of** the attached mash bill's normal payout.

- Applying an unlocked Gold Bourbon at sale time costs nothing and is never required.
- The barrel's attached mash bill is still discarded with the barrel as normal (unless that bill itself carries a Silver award).
- A Gold Bourbon may be applied to any number of qualifying sales over the course of the game.

If the barrel doesn't satisfy any of your unlocked Gold Bourbons' requirements, the sale resolves using the attached mash bill's grid as usual.

## Award Precedence

A given mash bill prints both Silver and Gold criteria; whichever is met by the sale is the award that fires. Gold takes precedence over Silver when both qualify — the bill is unlocked as a Gold Bourbon rather than returned to hand.

## Design Guidance for Card Authors

When designing a mash bill with a Gold award, the qualification bar should be intentionally hard to reach. As a rule of thumb, Gold typically requires a bourbon that is 10+ years aged AND uses at least 2 grain cards in its mash bill. Pair that with a strong demand band requirement and Gold stays rare and meaningful — it is both the win-condition trigger and a source of repeatable end-game value, so it should feel earned. Silver criteria can be looser (e.g. a single specialty grain, or one demand band lower) so that mid-game play has reachable upside without trivializing Gold.

---

# 🔁 The Core Loop

At its heart, the game follows this rhythm:

You gather resources, make bourbon, let it age, sell it into the market, and then adapt to whatever changes come next.

---

# 🧠 Strategy Notes

Early in the game, your focus should be on getting bourbon into rickhouses as quickly as possible so it can begin aging.

In the middle of the game, you'll need to balance production, investment, and timing. Watch the market carefully—selling at the wrong moment can undo several rounds of work.

In the late game, everything comes down to timing. A well-timed sale or a smart market choice can be the difference between winning and losing.

---

# 🥃 Final Thought

Bourbonomics isn't about making bourbon.

It's about knowing when the world is ready to buy it.
