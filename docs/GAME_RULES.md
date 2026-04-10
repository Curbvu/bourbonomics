# Bourbonomics

**Control document:** This file is the canonical place for **game rules, structure, and balance**. When you change how Bourbonomics is played or administered, **update this document** so implementations (app, tests, marketing copy) can stay aligned. Cursor/project guidance points here from [`.cursor/rules.md`](../.cursor/rules.md).

---

**Welcome to Bourbonomics!**

In *Bourbonomics*, your goal is to become **the Bourbon Baron of America**—a legendary distiller with the most successful bourbon empire! But the road to whiskey wealth isn't easy. You'll need to secure the best ingredients, **outmaneuver competitors**, **manage your bourbon**, and expand your brand while avoiding financial ruin.

Each round, you'll collect resources, **age, and sell bourbon**, navigate shifting market demands, and make strategic investments to your business and work on refining operations. Will you focus on crafting small-batch artisanal whiskey, or will you scale up for mass production? Can you source prime barrels and top-tier corn? Or will a sudden drop in market demand put your business at risk?

Only the savviest player will rise to the top. **Do you have what it takes to rule the world of bourbon?**

---

## Game Setup

### Game Modes

- **Whiskey Tutorial Mode** — First-time players should start with this mode. It focuses on the core concept of the game. 
- **Kentucky Straight** —This is the "normal" game mode. All instructions are written for the "normal" game mode.
- **Bottled-in-Bond** — This mode is not for the faint of heart; it presents more challenges for the players.

### Winning

- **Triple Crown** — Have 3 Gold Bourbon Awards.
- **Last Baron Standing** — All other players eliminated or bankrupted.
- **Baron of Kentucky** — Have 15 barrelled bourbon and atleast one in each of the 6 rickhouses.

---

## Board

### Bourbon Regions

The board has the 6 regions of Bourbon. Each region has a **rickhouse** with various slots for bourbon aging. There are fixed number of starting slots, players can invest in expanding rickhouse slots via investment cards

### Market

The market has **3 goods for sale** a "Cask" pile, a "Corn" pile and a "Grain" pile. These goods are "face-down", buyers draw from the pile and can view the card when selecting

### Business

These decks sit in the **business** area of the board. Taking or buying a card from them usually **costs an action** (see **Actions**). Full rules for each type appear later in this document; here is what each deck represents.

#### Investment cards (In Kentucky Straight and BiB Mode)

**Investment cards** are long-term **strategic** upgrades to your distillery: cheaper rickhouse fees, advantages on resources, better leverage when you take actions, extra rickhouse slots, and similar effects. Investment cards can be acquired via an "action". However, they also require **capital** that you must pay to **implement** the investment card. Newly acquired investment cards start **sideways** until you pay that capital and stand them **upright**. When invested, then the card effects can be used. *Note* if you choose not to put in capital on the turn that you drew the card, then you must pay for another action to capitalize the card. You can perform other actions on that turn (for example if you need to raise money). Details: **Investment cards**; example seeds: **[investment_cards.yaml](investment_cards.yaml)**.

#### Operations cards (In Kentucky Straight and BiB Mode)

**Operations cards** are **tactical** one-offs: they have **no capital cost** to resolve. They typically give an **immediate** payoff (cash), a benefit on your **next** turn, or a **short window** of advantage printed on the card. Details: **Operations cards**; example seeds: **[operations_cards.yaml](operations_cards.yaml)**.

#### Bourbon cards

**Bourbon cards** define **how your barrelled bourbon sells**: each card has a **Market Price Guide** (fixed **age bands** × **demand bands**) used when you **sell bourbon**. There is always one **face-up** Bourbon Card, and the rest sit in the Bourbon pile. When selling Bourbons, you can either choose the face up card or draw one from the face down pile. *Note* some resource, investment and operation cards allow you to draw multiple cards or lets you discard Bourbon cards. 

Bourbon Cards may contain award criteria (**Silver** / **Gold**) on the card. These convey unique advantages to your Bourbon and your distillery and Gold Bourbon Cards are also a win condition. Generally awards require a large amount of resources and barrel aging; keep an eye on your business while you try and elevate your Bourbon to Gold!

---

## Turns (Overview)

Each turn includes:

1. **Rickhouse fees & aging** — Pay rent for barrelled bourbon and age your stock (see Phase 1).
2. **Market demand** — Roll Dice to determine market demand goes up or down
3. **Actions** — Take as many actions as you want and can afford (see **Actions** below). The **first three action each turn is free**; each further action costs more than the previous

**Trade:** Players may **trade** resources, barrelled bourbons, investments cards, operations cards and Bourbon Cards / Awards at any point; **trading does not use an action**! Anything and everything can be traded!

---

## Actions

Your actions are what make your growing business. Each turn you get 3 **Free** actions. You can get additional actions by spending money. If you choose to take additional actions, you pay for all the actions at the end of your turn. If you do not have enough money to pay for your additional actions, then you go bankrupt. Trading does not cost "actions".

actions costs:
First 3 action - Free
4th action - $1
5th action - $2
6th action - $5
7th action - $10
8th action - $15
9th action - $20
10th action - $30
thereafter $10 each

Each of the following counts as **one action** when you take it:

1. **Buy from the market** — Each time you take this action, you receive **3 resource cards** (enough to make a Bourbon)!
2. **Make bourbon** — Combine the required **resource cards** (cask, corn, and grain) and **barrel** it into a rickhouse slot. Pay any **entry rent** for that rickhouse as usual when the bourbon is placed.
3. **Sell bourbon** — Pick a Bourbon to sell, **draw Bourbon Card(s)** and see how much your Bourbon's worth. Collect cash. You must **finish one sale** before starting another.

-- Kentucky Straight Actions:
4. **Draw investment cards** — When specified by the game deck / market, taking or purchasing an **investment** card uses an action (see **Investment cards**).
5. **Draw operations cards** — Taking or purchasing an **operations** card uses an action (see **Operations cards**).
6. **Capitalize an investment** - For investment cards not capitalized on that turn, you must pay for an action

### Bourbon Cycle
Collecting Resources, Making Bourbon and Selling Bourbon is the primary way you make money in Bourbonomics. Making Bourbon, even the cheap stuff, is not a quick turn-around. Bourbon needs to age at least 2 years before you can sell it. A lot can happen when you start making Bourbon to when you sell it: demand can shoot up, other distilleries can be opening, rickhouses might also fill up! 

#### Resources
Resources can be purchased from the market. There is a Cask, Corn and Grain pile. These cards are "face-down". When you purchase from the market you get to select any 3 cards. For example, you can select one from each pile; that will be enough to make one Bourbon. 

The Grain pile is unique: There are three different types of Grains: Barley, Rye, Wheat. 

| Resource | Role |
|----------|------|
| **Cask** | Required for Bourbon. Some casks have **special traits**. |
| **Corn** | Required for Bourbon; some corn cards have **special properties**. |
| **Barley, Rye, or Wheat** | **Grains** — at least **one** grain card must be in each Bourbon (any mix of barley, rye, and wheat allowed). |

> **Note:** By U.S. law, bourbon must be at least **51% corn** in the grain bill.

Some resource cards contain special properties and traits, they can improve sale price, add certain bonuses; additionally some Bourbon awards are dependent on how much corn or grains are in your Bourbon. Some resource cards have **special properties** — mix and match to maximize benefit. A working catalog of **specialty** resource cards (names + example rules) lives in **[SPECIALTY_RESOURCE_CARDS.md](SPECIALTY_RESOURCE_CARDS.md)**.

#### Making Bourbon

You make Bourbon by collecting the necessary resources and putting the Bourbon into a rickhouse. Your bourbon must include **at least 1 cask, 1 corn, and 1 grain**. You can include additional corn and grains; you can only include 1 cask.  Your Bourbon can have up to 6 resource cards total.

- 4 corn + 1 grain + 1 cask
- 1 corn + 2 grain + 1 cask 
- 2 corn + 2 grain + 1 cask

You put your cards into a "rickhouse slot". You must pay the entry fee. The entry fee is equal to the number of Bourbons (including the Bourbon your adding), in that rickhouse. For example, if there are two other Bourbons in the rickhouse, and you're adding a Bourbon, your entry fee will be $3. 

#### Aging Bourbon
At the start of every turn, you'll pay the yearly rickhouse fee to age your Bourbon. The rickhouse fee is the total number of Bourbons in that rickhouse. You will need to pay the rickhouse fee for every Bourbon. When you pay the fee, you'll place one token on top of each Bourbon; this will track how many years old your Bourbon has aged. 

#### Selling Bourbon

 All your hard work has finally paid off! Selling Bourbon is where you make the money! A Bourbon must be at least 2 years old (have 2 tokens on top). 

 To sell Bourbon, you first select which Bourbon you'd like to sell. Then you draw a Bourbon card. A Bourbon card has a payoff chart which determines how much you make from your Bourbon based on the age of the Bourbon and market demand. All else being equal, you make more money when market demand is high and your bourbon is well-aged (8+years). Make sure you time your sales right!  

Return the **cask, corn, and grain** cards from that mash to the **market piles** (they go back under the face-down Cask / Corn / Grain stacks). Return the drawn Bourbon card to the discard pile unless you earn a **Silver** or **Gold** award and keep it. 

### Kentucky Straight Actions
For more advanced game modes, we introduce 3 additional actions:
- Investment Cards
- Operations Cards
- Capitalize an Investment

#### Investment cards

**Investment cards** are long-term effects on your business: lower rickhouse fees, resource monopolies, extra leverage on actions, and similar payoffs. For printable **idea seeds**, see **[INVESTMENT_CARD_IDEAS.md](INVESTMENT_CARD_IDEAS.md)**.

- When an investment card is **drawn or acquired**, place it **sideways** (not yet active).
- Each card lists a **capital** cost. When you **pay that capital**, rotate the card **upright** — it is now **implemented** and its ongoing rules apply.
- If you **do not** pay capital to implement the card **on the turn you draw it**, you must spend **another action** later to pay the capital and turn the card upright — i.e. **delaying implementation costs an extra action** on top of the action you already used to take the card.
- You may **sell** an investment card to another player **whether it is sideways or upright**. The buyer receives it in the **same state** (sideways stays sideways; upright stays upright).

---

## Operations cards

**Operations cards** have **no capital / investment cost** to resolve. They usually provide **immediate or short-term** benefits: cash now, reduced costs on your **next** turn, or a **limited-time** effect that expires after a window printed on the card. For printable **idea seeds**, see **[OPERATIONS_CARD_IDEAS.md](OPERATIONS_CARD_IDEAS.md)**.


---

# Bourbon 101
A little bit of fact, trivia and history of Bourbon and how it relates to the game.

## Mash

A **mash bill** is the recipe used to make your bourbon, built from **resource cards** (see **Resources**). When you **sell**, you **draw Bourbon Card(s)** depending on mash composition — often **up to 3 Bourbon Cards** based on how rich your mash is; choose which Bourbon Card to use for that sale unless the rules say otherwise.

## Rickhouse

> **Tip:** A **rickhouse** (or rackhouse) is a multi-story warehouse used to age bourbon in barrels. The structure's wood floors, open ventilation, and height all affect how barrels age. Temperature swings across different levels create unique aging conditions—barrels at the top tend to age faster due to higher heat, while barrels at the bottom age slower and smoother.

Rickhouses are where bourbon is stored and aged. There are **6 rickhouses** in the state—each tied to a **Kentucky Bourbon Trail®** region (in play order: **Northern**, **Louisville**, **Central**, **Lexington**, **Bardstown**, **Western**), each with a capacity of **3, 4, 5, or 6** bourbons.

- Players pay **rent** to the rickhouse based on the total number of barrelled bourbons stored there (your bourbon as well as other players bourbons).
  - **Rent = Total number of barrelled bourbons in that rickhouse.**
- Once a bourbon is barrelled and placed in a rickhouse, it **cannot be moved** to another rickhouse.
- If a baron **fills every slot** in a **6-capacity** rickhouse and **every barrel there is theirs**, they pay **no rent** for that rickhouse (a true monopoly on a full six-slot warehouse).

**Bourbon Demand** — Bourbon Demand is anywhere from 0–12 barrels. Demand starts the game at **6 barrels**. Each time Bourbon is sold, demand goes down by **1 barrel**. At the end of each turn, players will roll the Bourbon Dice. If the number on the dice is higher than Bourbon Demand, then Bourbon Demand goes up by 1. 

## Bourbon / Bourbon Card

Each Bourbon Card has a **Market Price Guide** that shows the **value of your bourbon** based on its **age** and **current market demand**. You won't know its true worth until you go to market.

**How to read the Market Price Guide:** Every card uses the same **bands** — no stepped “≤” lookup. **Demand** runs across the top in three bands: **Low (2–3)**, **Mid (4–5)**, **High (6+)** barrels. **Age** runs down the left in three bands: **2–3**, **4–7**, and **8+** years. Find the row for your bourbon’s age band and the column for the current market-demand band; the dollar amount in that cell is your sale price.

- *Example:* Market demand is **5** → **Mid (4–5)** column. Your bourbon is **6** years old → **4–7** row. You collect the cash printed where that row and column meet.

**Demand is 0:** You may still sell your bourbon for its **age in dollars** (e.g., a 3-year bourbon sells for **$3**) — not a grid cell. Some money is better than no money.

![Market Price Guide](market-price-guide.png)

*Add an image of the Market Price Guide table here (Demand on top, Age on left, value at intersection).*

The catalog of **named** Bourbon cards (Market Price Guides + award lines) is in **[BOURBON_CARDS.md](BOURBON_CARDS.md)**.

#### Silver Award

If your bourbon qualifies for the **Silver Award**, you may keep the Bourbon Card for **one additional** bourbon sale.

**Note:** You can also sell this Bourbon Card with Silver Award to another player!

#### Gold Award

If your bourbon earns the **Gold Award**, you may use that Bourbon Card for an **unlimited number of barrelled bourbons**—as long as the bourbon you sell meets or exceeds the gold standard.

**Note:** You can also sell this Bourbon Card with the Gold Award to another player!

> **Normal vs Bottled-in-Bond:** In Normal mode, the Gold Award only applies to bourbons you sell using that Bourbon Card. In Bottled-in-Bond mode, the Gold Award applies to **all** bourbons you sell, regardless of whether you're using the Bourbon Card!

---

## Player Phases (Turn Structure)

### Phase 1: Rickhouse Fees

At the start of their turn, the Baron must pay rent for each barrelled bourbon based on the number of bourbons in each respective warehouse. 

1. **Rickhouse Fees**
   - The fee is equal to the **total number of barrelled bourbons** in each rickhouse, including barrels owned by other players.
   - All rickhouse fees must be paid **in full** before the player can continue to the next phase.

2. **Aging Bourbon**
   - For each barrelled bourbon that a player pays rent on, place a **$1 token** (or coin) on top of the barrel.
   - This token represents that the bourbon has **aged one year**.
   - Any additional rent is put in the bank.

#### Not Enough Cash?

If a Baron **cannot pay their rickhouse fees**, then those barrels do not age and the Baron must pay double the rickhouse fee at the end of their turn. (Even after paying those barrels do not age!) *Note* A Baron can pay fees for some barrels and not for others, only the barrels that were unpaid incur the double penalty. The double penalty is based on the barrels at the start of the turn; if a Baron sells that mash they still have to pay the fee.  

- The player pays **double the fee** at the **end of their turn**.
- If they **still cannot pay**, the player goes **bankruptcy**:
  - The bank takes possession of the assets: All money goes to the bank.
  - All assets are **sold in bulk** by category. The auction process goes as follows:
      - first **resources are auctioned** as a group
      - **barrelled bourbons**
      -  operations cards
      - investment cards
      - Bourbon Awards
  - The Baron is **eliminated** from the game.

### Phase 2: Actions (operations)

This is the heart of Bourbonomics. Use the **Actions** section above: each **make bourbon**, **market buy**, **sell bourbon**, or **card** purchase/draw that counts as an action advances the **$0, $1, $2, $3…** cost track for that turn. You may mix actions in any order (e.g., sell, buy from market, make bourbon, sell again) as long as you pay each action’s cost in sequence.

**Make bourbon (one action)**

- Spend the resource cards that form your **mash** and **barrel** the bourbon into an available rickhouse slot.
- Pay **entry rent** for that rickhouse based on the number of barrelled bourbons (including your new bourbon and other players’ bourbons) already there.
- Once placed, barrelled bourbons **cannot move** to another rickhouse. Choose wisely.

**Buy from the market (one action)**

- Resolve the market’s procedure for **which** goods or piles you take; you always receive **3 resource cards** for that action.

**Sell bourbon (one action)**

- Choose which barrelled bourbon you are selling; **complete that sale** before starting another sale action.
- Draw **Bourbon Card(s)** per your mash (often up to **3**). Choose which Bourbon Card applies to this sale.
- If market demand is **0**, the bourbon can still be sold for its **age in years**.

**Investment and operations cards**

- Follow **Investment cards** and **Operations cards** for sideways/upright, capital, and timing. Taking or buying a card typically uses **one action** unless a specific card says otherwise.

### Phase 3: Market Demand Phase

**Market Demand** is 0–12 barrels. The more barrels, the higher the price your bourbon will sell for.

- Each time a **bourbon is sold**, demand **decreases by 1 barrel**. (e.g., selling 3 bourbons reduces demand by 3.)

At the **end of each turn**, players roll to see how demand shifts:

1. **Roll 2 dice.**
2. If number greater than market demand, market demand goes up. 
3. If roll double 6's, then market demand goes to 12 immediately

# Notes
* In the early phases, market demand will steadily increase and actions are limited, choose wisely on investing and expanding your distillery
* In the later phases selling Bourbon will put pressure on market demand, time your sales wisely. 
* Most Bourbon cards are based on even number demands, the rare cards will have odd number demands
* A double six is a huge windfall

---

## Related design docs

Scratchpads for printable cards (not core rules until you adopt them):

- **[Investment cards](investment_cards.yaml)** — long-term investments (**capital**, sideways / upright).
- **[Operations cards](operations_cards.yaml)** — tactical one-offs (**no capital**; immediate or short-term).
- **[Resource cards](resource_cards.yaml)** — specialty cask / corn / grain cards and example rule text.
- **[Bourbon cards](bourbon_cards.yaml)** — named Market Price Guides and award lines (full list).


