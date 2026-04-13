# Bourbonomics

**Control document:** This file is the canonical place for **game rules, structure, and balance**. When you change how Bourbonomics is played or administered, **update this document** so implementations (app, tests, marketing copy) can stay aligned. Cursor/project guidance points here from [`.cursor/rules.md`](../.cursor/rules.md).

---

**Welcome to Bourbonomics!**

In *Bourbonomics*, your goal is to become **the Bourbon Baron of America**—a legendary distiller with the most successful bourbon empire! But the road to whiskey wealth isn't easy. You'll need to secure the best ingredients, **outmaneuver competitors**, **manage your bourbon**, and expand your brand while avoiding financial ruin.

Each **round** runs in three beats for the whole table: **rickhouse fees** (skipped in **round 1**), a shared **action phase** where barons go around the table taking actions or passing, then a **market phase** for demand or events (see **Rounds (Overview)**). Within that rhythm you’ll collect resources, **age and sell bourbon**, navigate shifting demand, and invest in your business and operations. Will you focus on crafting small-batch artisanal whiskey, or will you scale up for mass production? Can you source prime barrels and top-tier corn? Or will a sudden drop in market demand put your business at risk?

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

### Opening investments (Kentucky Straight and BiB)

Before **Round 1** begins, each Baron seeds their **investment** hand:

1. **Draw 6** cards from the **investment** deck.
2. **Keep 3** in hand. **Return the other 3** to the **bottom** of the investment deck (shuffle the returned cards together first if you want less order memory).
3. **Optional auction (at most 1 per Baron):** You may offer **one** investment from your hand for auction. If you do, resolve it **before** step 4.
   - **Bidding:** Go **clockwise** around the seller, starting with the Baron **immediately clockwise** from the seller. Each Baron may **raise** the current bid or **pass**. The **seller bids last** and may **match or beat** the high bid to **keep** the card.
   - **Payment:** The **winner** (the Baron who ends up with the card after bidding) pays the **seller** the **winning bid**. **If the seller wins** by matching or beating the high bid to **keep** the card, they pay the **bank** that **winning bid** (cash leaves the seller’s pool; it is not received as seller income — there is no “pay yourself”).
   - **What the winner gets:** The card is **upright** and **active immediately**—it works **this year (Round 1)**. The card’s **printed capital** is **waived** for this purchase; the **winning bid** is the only purchase cost. That makes auctions **high risk / high reward**: you can land a **ready-to-run** investment, but you can also **overpay** in cash you need elsewhere.
4. **Commit what’s left in hand:** For each investment still in your hand after any auction, pick **one** (this step is **setup**—it does **not** use an **action**):
   - **Implement** (opening): Pay the card’s **printed capital** from **starting cash** → place it **sideways** (**paid**, **waiting** one year—the same as **Implement investment** in play). Flip **upright** (**active**) at the **start of Round 2**, not Round 1.
   - **Hold uncommitted:** Leave it in your **hand** (off the table). It has **no effect** until you **Implement** it with the **Implement investment** action (it is already **drawn**—you do not **Draw** it again).

**Starting cash** must be enough to make the choices in step 4 and any auctions meaningful; set it in your **mode rules** or scenario sheet and keep it consistent across playtests.

---

## Board

### Bourbon Regions

The board has the 6 regions of Bourbon. Each region has a **rickhouse** with various slots for bourbon aging. There are fixed number of starting slots, players can invest in expanding rickhouse slots via investment cards

### Market

The market has **3 goods for sale** a "Cask" pile, a "Corn" pile and a "Grain" pile. These goods are "face-down", buyers draw from the pile and can view the card when selecting

### Business

These decks sit in the **business** area of the board. Taking or buying a card from them usually **costs an action** (see **Actions**). Full rules for each type appear later in this document; here is what each deck represents.

#### Investment cards (In Kentucky Straight and BiB Mode)

**Investment cards** are long-term **strategic** upgrades to your distillery: cheaper rickhouse fees, advantages on resources, better leverage when you take actions, extra rickhouse slots, and similar effects. In **normal play**, you **Draw** a card (**unbuilt**, **upright**), then you may **Implement** it by paying **printed capital** and placing it **sideways**—**sideways** means **paid for** but **waiting** until **next year** before it flips **upright** and becomes **active**. **Opening** deals and **auctions** can change timing—see **Opening investments** and **Investment cards** under **Bourbon Cycle**. The **playable catalog** (ids, capital, modifiers synced into the app) lives in **[investment_catalog.yaml](investment_catalog.yaml)**. **[investment_cards.yaml](investment_cards.yaml)** remains a broader design/backlog reference.

#### Operations cards (In Kentucky Straight and BiB Mode)

**Operations cards** are **tactical** one-offs: they have **no capital cost** to resolve. They typically give an **immediate** payoff (cash), a benefit on your **next** round, or a **short window** of advantage printed on the card. Details: **Operations cards**; example seeds: **[operations_cards.yaml](operations_cards.yaml)**.

#### Bourbon cards

**Bourbon cards** define **how your barrelled bourbon sells**: each card has a **Market Price Guide** (fixed **age bands** × **demand bands**) used when you **sell bourbon**. There is always one **face-up** Bourbon Card, and the rest sit in the Bourbon pile. When selling Bourbons, you can either choose the face up card or draw one from the face down pile. *Note* some resource, investment and operation cards allow you to draw multiple cards or lets you discard Bourbon cards. 

Bourbon Cards may contain award criteria (**Silver** / **Gold**) on the card. These convey unique advantages to your Bourbon and your distillery and Gold Bourbon Cards are also a win condition. Generally awards require a large amount of resources and barrel aging; keep an eye on your business while you try and elevate your Bourbon to Gold!

---

## Rounds (Overview)

Each **round** (a round is a "year") of play has three parts, in order:

1. **Rickhouse fees (and aging)** — All barons pay rickhouse fees for their barrelled bourbon (see **Phase 1**). **The first round of the game skips this step** (no bourbon so no fees!).
2. **Action phase** — Barons take **actions** one at a time in order, going around the table clockwise. See **Actions** and **Phase 2**. This continues until all Barons pass.
3. **Market phase** — Barons roll **market demand** (dice) **or** draw an **event card**—each baron does this **once** unless a card or rule says otherwise. See **Phase 3**.

**Starting player for the next year:** The **first baron to pass** during the **action phase** becomes the **start player** for the **next** round. Play then proceeds around the table clockwise: the start player **leads** the next **action phase** and you continue from that baron for that round’s phases unless a rule says otherwise.

**Trade:** Players may **trade** resources, barrelled bourbons, investment cards, operations cards, and Bourbon Cards / Awards at any point; **trading does not use an action**. Anything and everything can be traded!

---

## Actions

Actions are how you run your distillery during the **action phase**.

### Free actions, passes, and paid actions

- Actions move **clockwise** around the **barons**. Barons can perform one action at a time (unless they have a card that allows otherwise). Each loop around the table is a "phase". Barons can take an action or **pass**
- **While no one has passed yet**, every action is **free**
- **As soon as any baron passes**, the **free‑action period ends** at the end of that action phase. After that, **each** phase costs money if a baron performs an action during that phase. **Barons who passed at any prior phase may still take actions**.
- **Paid‑action ladder:** The first paid action phase costs **$1** per Baron that takes actions, the next **$2**, the next **$3**, and so on (**+$1** each time). Barons must pay before they take their actions. 
- **When does the action phase end?** The action phase ends when all Barons pass in a phase. 

If a baron cannot pay for a **paid** before they take their action, they cannot take the action

**Trading** does not count as an action and does not advance the paid‑action ladder.

### What counts as one action

Each of the following is **one action** when you take it on **your opportunity** in the action phase:

1. **Draw resource cards** — players can draw one resource card from any pile (unless they have a card that allows more card draws)
2. **Draw bourbon cards** — Players can draw a Bourbon card to keep in their hand. Note: **Selling bourbon** still uses its **own** action and includes **drawing Bourbon Card(s)** as part of completing that sale (see **Sell bourbon** below).
3. **Make bourbon** — Combine the required **resource cards** (cask, corn, and grain) and **barrel** the bourbon into a rickhouse slot. 
4. **Sell bourbon** — Pick a barrelled bourbon to sell, **draw Bourbon Card(s)** as required, and **complete that sale**. You must **finish one sale** before starting another sale action.
5. **Draw investment** — **One action** unless a card says otherwise: take an investment from the deck (or the mode’s supply). It is **unbuilt** (capital **not** paid): keep it **upright** in your **hand** or **prospect** row—**no** effects yet. (**Sideways** is reserved for **funded** cards that are **waiting** a year; see **Implement investment**.)
6. **Draw operations cards** — Drawing an **operations** card uses an action when the rules or card say so (see **Operations cards**).
7. **Implement investment** — **One action** in the **action phase** on an **unbuilt** investment you control (including one **held** from **Opening investments**): pay its **printed capital**, then place it **sideways**. **Sideways** = **paid for**, **waiting** until **next year** (**no** effects **this round**). At the **start of the next round**, flip it **upright**—it is then **active**. (Opening **Implement** in **Opening investments** is the same move but is **free** during **setup**.)
8. **Resolve an operations card** — **Playing** or **resolving** an operations card uses an action unless the card says otherwise (operations cards have **no capital cost**). Operations cards can be used in the same year as the year drawn.

### Bourbon Cycle
Collecting Resources, Making Bourbon and Selling Bourbon is the primary way you make money in Bourbonomics. Making Bourbon, even the cheap stuff, is not a quick turn-around. Bourbon needs to age at least 2 years before you can sell it. A lot can happen when you start making Bourbon to when you sell it: demand can shoot up, other distilleries can be opening, rickhouses might also fill up! 

#### Resources
Resources come from the market. There is a Cask, Corn, and Grain pile. These cards are "face-down". When you use the **draw resource cards** action (see **Actions**), you typically select **1** card. However certain investments and operation cards can get you an advantage. 

The **grain** pile uses three base types — **barley**, **rye**, and **wheat** — drawn as separate sub-piles or marked on the card. **Plain** grain cards are **type-only** (no rule line). **Specialty** grains add a printed rule; the canonical list is **[resource_cards.yaml](resource_cards.yaml)** (see the `barley_specialty`, `rye_specialty`, and `wheat_specialty` sections).

| Resource | Role |
|----------|------|
| **Cask** | Required for Bourbon. Some casks have **special traits**. |
| **Corn** | **Baseload** grain: real bourbon **must** be **≥51% corn** in the grain bill (U.S. law—see note). In *Bourbonomics* every mash includes **at least 1 corn**, and corn is where you stack **volume** and **flex**—**specialty** corn spans a **wide** range of **advantages** (sell bonuses, demand tricks, cash on **make**, awards, and more). See **[resource_cards.yaml](resource_cards.yaml)** (`corn_specialty`). |
| **Barley** | **Grain** — the **base** grain; it counts toward the mash’s **≥1 grain** rule. Barley is tuned to work well when **market demand** is **low**, and it typically **helps with operations costs** (and related fees—see specialty card text). **Specialty** barley rules live in **[resource_cards.yaml](resource_cards.yaml)** (`barley_specialty`). |
| **Rye** | **Grain** — counts toward the mash’s **≥1 grain** rule. Rye **shines in high-demand** periods: expect **sell** payoffs and effects that spike when the market is hot. **Specialty** rye rules live in **[resource_cards.yaml](resource_cards.yaml)** (`rye_specialty`). |
| **Wheat** | **Grain** — counts toward the mash’s **≥1 grain** rule. Treat wheat as a **modifier**: it **adjusts** how other parts of the mash or the market resolve (demand **lookup**, bill shape, cushioning small hits) rather than defining the core “low vs high demand” posture on its own. **Specialty** wheat rules live in **[resource_cards.yaml](resource_cards.yaml)** (`wheat_specialty`). |

Each bourbon must include **at least one** grain card (**any mix** of barley, rye, and wheat). **Specialty** text on a card overrides the generalities above when there is a conflict.

> **Note:** Federal rules treat **corn** as the backbone of the grain bill: **≥51% corn** is required for bourbon. Build mashes so your **corn count** reflects that majority when you translate cards into a bill.

Some resource cards contain special properties and traits; they can improve sale price, add bonuses, and tie into **Silver** / **Gold** award checks. Mix and match to maximize benefit. A human-readable digest is **[SPECIALTY_RESOURCE_CARDS.md](SPECIALTY_RESOURCE_CARDS.md)**; machine-oriented names and opcode hooks live in **[resource_cards.yaml](resource_cards.yaml)**.

#### Making Bourbon

You make Bourbon by collecting the necessary resources and putting the Bourbon into a rickhouse. Your bourbon must include **at least 1 cask, 1 corn, and 1 grain**. You can include additional corn and grains; you can only include 1 cask.  Your Bourbon can have up to 6 resource cards total.

- 4 corn + 1 grain + 1 cask
- 1 corn + 2 grain + 1 cask 
- 2 corn + 2 grain + 1 cask

You put your cards into an available **rickhouse slot** (respect each rickhouse’s **capacity** printed on the board). There is **no separate entry fee** when placing a new bourbon; ongoing **rickhouse rent** is handled in **Phase 1** only.

#### Aging Bourbon
During **Phase 1 (Rickhouse fees)** each **round** (except the **first round**, which skips fees), barons pay the yearly rickhouse fee to age their Bourbon. The rickhouse fee is the total number of Bourbons in that rickhouse. You pay the fee for each of your barrelled bourbons in that warehouse. When you pay the fee for a barrel, place a **$1 token** (or coin) on that barrel; it **ages one year**. 

#### Selling Bourbon

 All your hard work has finally paid off! Selling Bourbon is where you make the money! A Bourbon must be at least 2 years old (have 2 tokens on top). 

 To sell Bourbon, you first select which Bourbon you'd like to sell. Then you draw a Bourbon card. A Bourbon card has a payoff chart which determines how much you make from your Bourbon based on the age of the Bourbon and market demand. All else being equal, you make more money when market demand is high and your bourbon is well-aged (8+years). Make sure you time your sales right!  

Return the **cask, corn, and grain** cards from that mash to the **market piles** (they go back under the face-down Cask / Corn / Grain stacks). Return the drawn Bourbon card to the discard pile unless you earn a **Silver** or **Gold** award and keep it. 

#### Investment cards (Kentucky Straight and BiB)

**Investment cards** are long-term effects on your business: lower rickhouse fees, resource monopolies, extra leverage on actions, and similar payoffs. For printable **idea seeds**, see **[INVESTMENT_CARD_IDEAS.md](INVESTMENT_CARD_IDEAS.md)**.

**States (normal play)**

- **Unbuilt:** **Drawn**, **capital not paid**—keep **upright** in your **hand** / **prospect** row, **no** effects. (Opening **Hold** cards are **unbuilt** here until **Implemented**.)
- **Sideways (funded, waiting):** **Capital paid** via **Implement** (either **opening** setup or the **Implement investment** action). **Sideways** = **paid for**, but the project **does not go live** until **next year**—**no** effects **this round**. At the **start of the next round**, flip **upright**.
- **Active:** **Upright** after the wait; the card’s rules apply.

**Flow**

1. **Draw** (action) → **unbuilt** (**upright**, unpaid).  
2. **Implement** (action) → pay **printed capital** → **sideways** (paid, **waiting** one year).  
3. **Start of next round** → flip **sideways** → **upright** (**active**).

**Opening and auctions**

- Follow **Opening investments**. **Auction** winners are the main **exception**: they receive the card **upright** and **active immediately** in Round 1, with **printed capital waived**. **Another Baron’s winning bid is paid to the seller**; **if the seller keeps** the card, that winning amount is paid to the **bank** instead. **Implement** during opening (setup) uses the same **sideways (paid, wait) → next round upright** timing as **Implement investment** during play.

**Trading**

- You may **sell** an investment. The buyer keeps the same **state** (**unbuilt** **upright** / **sideways** waiting / **active** **upright**) and the same **activation** schedule. **Held** cards stay **unbuilt** in the buyer’s hand until they **Implement** them.

---

## Operations cards

**Operations cards** have **no capital / investment cost** to resolve. They usually provide **immediate or short-term** benefits: cash now, reduced costs on your **next** round, or a **limited-time** effect that expires after a window printed on the card. For printable **idea seeds**, see **[OPERATIONS_CARD_IDEAS.md](OPERATIONS_CARD_IDEAS.md)**.


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

**Bourbon Demand** — Bourbon Demand is anywhere from 0–12 barrels. Demand starts the game at **6 barrels**. Each time Bourbon is sold, demand goes down by **1 barrel** (unless a rule or card says otherwise). During the **market phase** (see **Phase 3**), each baron may **roll** to shift demand or **draw an event card**—usually **once per round** each. 

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

## Round structure (phases of a round)

Phases run **once per round** for the whole table, in order: **Phase 1 → Phase 2 → Phase 3**.

**Start-of-round housekeeping:** At the **beginning of each round**, before **Phase 1** (or before the **action phase** in **Round 1**, if you prefer), flip **sideways** (**funded**, **waiting**) investments **upright**: anything **Implemented** the **prior** round (or during **opening Implement** in setup) becomes **active** now (see **Investment cards** under **Bourbon Cycle**). **Opening Implement** cards therefore turn **active** at the **start of Round 2**.

### Phase 1: Rickhouse fees (and aging)

**Round 1 exception — skip fees:** Skip this phase entirely in the **first round** of the game (no rickhouse fees, no aging from fees).

**All later rounds:** Before the action phase, **each baron** pays **rickhouse rent** for their own barrelled bourbon. Rent per barrel is based on the **total number of barrelled bourbons** in that rickhouse (all players’ barrels count toward the count; each baron pays for **their** barrels there).

1. **Pay fees** — Resolve fees **in full** for the barrels you choose to keep aging (see **Not enough cash?** for partial payment).
2. **Age bourbon** — For each barrel you paid for, place a **$1 token** (or coin) on that barrel (**+1 year**). Excess payments go to the bank as usual.

#### Not enough cash?

If a Baron **cannot pay** rickhouse fees for some barrels, those barrels **do not age** this round, and the Baron owes **double** the unpaid fee. *Note:* A Baron can pay for some barrels and not others; only **unpaid** barrels trigger the double penalty. The double penalty is based on the barrels **at the start of Phase 1**; if a Baron sells that mash later in the round, they **still** owe the fee for barrels that were unpaid in Phase 1.

- The Baron pays **double the unpaid fee** at the **end of Phase 1** (before **Phase 2** begins), unless your table explicitly uses another fixed moment—stay consistent.
- If they **still cannot pay**, the player **bankrupts**:
  - The bank takes possession of the assets: All money goes to the bank.
  - All assets are **sold in bulk** by category. The auction process goes as follows:
      - first **resources are auctioned** as a group
      - **barrelled bourbons**
      - operations cards
      - investment cards
      - Bourbon Awards
  - The Baron is **eliminated** from the game.

### Phase 2: Action phase

This is the heart of Bourbonomics. Barons take **one action or pass** in **seat order**, repeating until the **all‑pass lap** end condition in **Actions** is met (see **Actions** for the free‑action period, passes, paid‑action ladder, and the list of actions).

Reminder: The **first baron to pass** this phase becomes the **start player** for the **next** round (see **Rounds (Overview)**).

Details for common actions (mash rules, sale steps, cards) are in **Actions**, **Bourbon Cycle**, **Investment cards**, and **Operations cards** above.

### Phase 3: Market phase

**Market demand** is **0–12 barrels**. The higher demand, the better bourbon sale prices tend to be.

- Each **sale** during the action phase usually lowers demand by **1 barrel** (unless a card or rule says otherwise).

After the action phase, in **seat order** (usually starting with the **start player** for the **next** round—the baron who passed first in Phase 2—or another fixed order your table agrees on), **each baron chooses once**:

- **Roll for demand** — e.g. **roll 2 dice**; if the **total** is **greater than** current market demand, demand **increases by 1**; on **double sixes**, demand jumps to **12** immediately (unless you replace this with a printed chart later), **or**
- **Draw an event card** — resolve the card (some events may change demand or grant an **extra** market resolution—follow the card).

Each baron normally does **only one** of these (roll **or** event) **per round**, unless a card explicitly allows more.

# Notes
* In the early game, market demand will often rise during **market phases**; the **action phase** stays tight once someone passes and the **paid‑action ladder** kicks in—choose wisely when investing and expanding your distillery
* In the later rounds, selling Bourbon will put pressure on market demand; time your sales wisely.
* Most Bourbon cards are based on even number demands, the rare cards will have odd number demands
* A double six is a huge windfall

---

## Related design docs

Scratchpads for printable cards (not core rules until you adopt them):

- **[Investment cards](investment_cards.yaml)** — long-term investments (printed **capital**; **Draw** → **unbuilt upright** → **Implement** → **sideways** = paid, wait one year → **upright active**; YAML may use older verbs—map to **GAME_RULES**).
- **[Operations cards](operations_cards.yaml)** — tactical one-offs (**no capital**; immediate or short-term).
- **[Resource cards](resource_cards.yaml)** — specialty cask / corn / grain cards and example rule text.
- **[Bourbon cards](bourbon_cards.yaml)** — named Market Price Guides and award lines (full list).


