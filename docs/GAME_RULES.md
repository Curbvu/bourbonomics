# 🥃 Bourbonomics

A deckbuilding strategy game about building a bourbon empire — one barrel at a time. Recipes take rounds to assemble, demand swings round to round, and the player with the most reputation when the supply runs dry wins.

**Players:** 2–4 · **Length:** ~30–60 min · **Complexity:** Medium

> **Scope (current alpha — "Investments Go Live").** Five-distillery picker (Standard / Vanilla / High-Rye House / Wheated Baron / Connoisseur Estate; Standard is a human-only beginner pick), slot-bound mash bills (with `minCorn`/`maxCorn` ranges, carrying a printed tag set derived from recipe / rarity / award eligibility), incremental production, single-step selling that produces bottles for the v3.2 Brand Portfolio system, a unified 10-card market (resources + Labor + ops + investments together), trading, doomsday-deck endgame. **Capital is the in-game spendable currency (v3.3)**; sales credit Capital, purchases deduct it. **Reputation is the end-game-only score** — Brand Portfolio events (slot end-game values, Signature Bonuses, Completion/Theme/Mastery bonuses, minus the second-portfolio failure penalty) accrue here at game end. Banked Capital still counts 1:1 toward final score (`total = capital + reputation`). Labor cards supplement Capital on purchases. Generic Labor is finite per player (3 in the starter deck, plus +1 for High-Rye House; no central pile, no Hire). **v3.5 rule changes.** The free Save Slot is removed — the **Warehouse** investment card (cost 4) is now the only persistent-card-storage option. All market purchases route to the buyer's hand by default; investment cards are the one exception (they transfer directly to the player's investments area as permanent passives). The aging mechanic is formally clarified: **aging cards committed to a barrel ARE the barrel's age** (`barrel.age === barrel.agingCards.length`) — no effect can advance age without committing a card. **Brand Portfolios.** Each player owns a pre-claimed flagship portfolio bound to their distillery — a 3–7 slot product lineup with **required** (solid-outline) and **optional** (dotted-outline) slots grouped into **tiers**. Slot requirements gate on age + ingredients + strength (corn count) + demand-at-sale, referenced by **tag string keys** (v3.4). Filling a slot fires an immediate **non-rep utility** reward; filling it with the slot's **signature bill** also fires a Signature Bonus. End-game scoring is three cumulative tiers: **Completion** (all required filled), **Theme** (every filled slot satisfies the soft Brand Restriction), **Mastery** (every filled slot meets the strict purity condition). Players may spend 1 Generic Labor to **draft a second portfolio** mid-game from a shared face-up pool (N+2 boards). Inventory is an unscored buffer; bottles retrieve back to slots at 1 Generic Labor each. A drafted second portfolio that fails to reach Completion pays −2 Reputation per unfilled required slot (capped −10); the flagship has no penalty. **Investment catalog rebuilt to 33 cards** grounded in real-world distillery capital expenditures (stills, mash tuns, fermenters, warehouses, cooperages, climate control, bottling lines, visitor centers, sales offices, marketing departments). **v3.6: investment effects are live** — 28 of the 33 cards now resolve in the engine (on-purchase unlocks, choice-gated picks, and automatic sale/aging/end-game effects), with new free actions for Warehouse store/retrieve and Trade Lobby's demand shift; 5 cards (Field Office, Marketing Department, Sales Office, Cooperage, Column Still) remain `implemented: false` pending follow-up. Multiplayer is live (host a 4-char-code room from `/multiplayer`). Version history lives in [`GAME_VERSION.md`](./GAME_VERSION.md).

---

# 🚀 Quick Start

> **Learn by doing.** The home screen has a **Tutorial** tile (a guided walkthrough at `/tutorial`) that hand-holds a fresh player from their first roll through their first sale.

### The 90-second pitch

You run a bourbon distillery. You have a **rickhouse** (4 barrel slots), a **deck** (16 starter cards), and **mash bills** (recipes) that live directly on your slots. Each round:

1. **Take your turn** — Roll demand → Age every aging barrel → Take actions. Your hand was already refilled to 8 at the end of your previous turn (or at setup, for round 1).
2. **End Turn** discards anything still in hand and redraws 8 — the single hand refresh of the game.
3. **Cleanup.** Round-level flags reset, market cycles, the start player rotates, next round.

Your turn opens with your own demand roll and one aging card committed to **every** of your aging barrels — that's the holding cost for keeping inventory. *Then* the rest of your turn opens up.

### The core loop

- **Mash bills are slot-bound.** Bills are drafted into your slots at setup and acquired through the **Drafting Loop** during play. They never enter your hand.
- **Make bourbon** by committing cards (cask + corn + grain) from your hand to a slotted bill. Recipes take **multiple turns** to assemble.
- A barrel becomes **aging** the moment its recipe is satisfied. From the next round on, you commit 1 aging card per round on top of it.
- **Sell** an aging barrel (age ≥ 2) — the engine reads the bill's grid at `(barrel age, current demand)`, adds card / distillery / ops bonuses, and lifts the total to the bill's **tier floor** (3 / 4 / 5 rep). The total lands on your **reputation** track.
- **Buy** new cards from the 10-card market with **reputation** and/or **Labor cards** from hand (Cooper +2 toward market resources, Marketing +2 toward ops, Generic +1 anywhere). Rep and Labor are fully fungible — pay in rep, Labor, or any mix.
- **Draft mash bills** by initiating the **Drafting Loop** — put a card on the table, reveal 3 bills, take what you want for 1 card each; the remainder passes around the table for others to claim. Bills cost no rep.
- **Labor is finite per player.** You start with 3 Generic Labor in your deck — that's it. New Labor only enters via **Specialty Labor** cards bought from the market (Cooper, Marketing, future Architect).

### Winning

The game ends when the **last mash bill leaves the bourbon supply**. Every player then scores their **Brand Portfolios** on top of banked reputation: filled slot end-game values + Signature Bonuses + Completion / Theme / Mastery tier bonuses for each portfolio that reached them, minus the second-portfolio failure penalty (if applicable). Inventory scores nothing. Most reputation wins; tiebreakers: most barrels sold, then shared victory. See [§Brand Portfolios](#-brand-portfolios).

---

# 🎬 Setup

### Step 1 — Distillery selection
Players pick distilleries from a shared pool of four: **Vanilla**, **High-Rye House**, **Wheated Baron**, **Connoisseur Estate**. No two players share a distillery. See [§Distillery Profiles](#-distillery-profiles).

**Pick order — humans before bots.** Humans pick first, in reverse-snake order within the human group (last human seat picks first among humans). Any bots pick after every human has picked, also in reverse-snake within the bot group. In an all-human room this collapses to plain reverse-snake — last seat picks first.

> **Why humans first?** Bots prefer Connoisseur > Vanilla > High-Rye > Wheated. Under plain reverse-snake the human at seat 0 picked last in solo, and bots stripped the easier distilleries first. Promoting humans ahead of bots restores access to the level-playing-field options (notably Vanilla).

### Step 2 — Starting rep
Each distillery's stake lands on the rep track at setup:

| Distillery | Starting rep |
|---|:-:|
| Vanilla Distillery | **5** |
| High-Rye House | **4** |
| Wheated Baron | **4** |
| Connoisseur Estate | **6** |

This is *starting* rep — not earned — but it counts toward your final score throughout the game.

### Step 3 — Mash bill draft
- **Vanilla** — 0 starting bills; every slot Open.
- **High-Rye House** — 0 starting bills + 1 pre-aged rye barrel (age 1).
- **Wheated Baron** — 0 starting bills + 1 pre-aged wheated barrel (age 1).
- **Connoisseur Estate** — **4** starting bills, filling every slot Staged.

### Step 4 — Starter pool draft (locked composition + trade window)
Every player's starter hand is built from the canonical per-player block: **6 cask · 4 corn · 3 grain (1 rye / 1 barley / 1 wheat) · 3 Generic Labor = 16 cards**. The composition is locked — every player begins with the exact same mix, only the draw order varies per seed. An additional 8-card buffer (2 cask · 1 corn · 1 rye · 1 barley · 1 wheat · 2 Generic Labor) sits aside in `starterUndealtPool` for the stuck-hand safety valve.

The cards are dealt face-up so every player can read their hand and the others' hands during the trade window.

> **Distillery starter mods.** **High-Rye House** adds **+2 Specialty Rye** to its dealt hand (18 cards), satisfying its `minSpecialty.rye` floor right out of the gate. No other distillery currently modifies the starter hand.

**Trade window.** Players negotiate **1-for-1 trades** in any order, public and mutual.

**Stuck-hand swap.** Once during the trade window, a player may return up to 3 cards to the pool and draw the same number off the top.

When every player passes, shuffle your final cards into your starter deck. Premium variants — **Specialty** and **Heritage** — only enter via the market.

> **UI status (current alpha).** Trading + stuck-hand swap are live in the engine (`STARTER_TRADE` and `STARTER_SWAP` actions) but the trade UI in `StarterDeckDraftModal` is not yet wired — humans review their dealt hand and click **Shuffle Deck** to pass; bots auto-pass. Both UI surfaces will land in a follow-up frontend pass.

### Step 5 — First hand
- Each player **draws 8 cards** from their starter deck.
### Step 6 — Board setup
- **Unified market:** 10 cards face-up from a single shuffled supply containing **resources** (Common $1 / Specialty $2 / Heritage $3), **Specialty Labor** (Marketing $4, Cooper $4, Architect $4), **operations cards**, and **investment cards**. Generic Labor is **not** sold; the 3 in your starter deck are all you'll ever own.
- **Bourbon deck:** mash bills face-down. No face-up bill row — bills are acquired exclusively through the **Drafting Loop**.
- **Brand Portfolios.** Every player pre-claims the **flagship portfolio** bound to their distillery (e.g., Wheated Baron → *The Baron's Lineup*). Lay out **N+2 secondary portfolios face-up** next to the play area, drawn from a face-down secondary-pool supply — these are visible to everyone for the rest of the game and available to draft via the **Draft Second Portfolio** action. See [§Brand Portfolios](#-brand-portfolios).
- **Demand:** starts at 0.
- Pick a start player.

---

# 🔄 The Round

Three phases per round:

1. **Draw** — pure orchestration. v3.10: hands are **not** redealt here. The canonical hand refresh is end-of-turn (see §Hand and Deck) — by the time a new round opens, every player already holds 8 cards from the redraw their previous turn fired. The Draw phase exists only so the between-rounds recap (Year Pass) can land cleanly before play resumes. The initial round-1 deal happens once, at setup.
2. **Action** — players take full turns in rotated order. Each turn runs as **Roll demand → Age every aging barrel → Take actions**.
3. **Cleanup** — per-round flags reset; **the 10 market cards cycle out to the market discard and 10 fresh cards are dealt from the supply**; start player rotates one seat counter-clockwise. v3.10: hands are left alone — the end-of-turn redraw already set up every player's next-round hand.

**Operations cards persist** across rounds in your operations hand.

**Turn order rotates** — the player who acted last in round N goes first in round N+1 (the *bookend*). Each player gets the bookend equally over an N-player game.

---

# 🎲 Demand (per-turn)

At the **top of each player's action turn** (before any other action), the active player rolls **2d6**. If the result is **greater than** current demand, demand **rises by 1** (cap 12). Otherwise it holds.

Demand **falls by 1** for each barrel sold (floor 0), unless skipped by an effect (Demand Surge, Heirloom Wheat). Some ops cards (Market Manipulation, Bourbon Boom, Glut) move it directly.

The 2d6 bell curve drifts demand toward the middle, with rare booms and crashes.

---

# 🛢️ Aging (per-turn)

After rolling demand, you **must commit one card from hand to every one of your eligible aging barrels** before taking any other action — the holding cost for inventory.

- **Staged and Building barrels do not age.** Only barrels in the **Aging** phase trigger the requirement.
- A barrel that finished construction this round skips its first aging until next round.
- **Generic Labor** is legal as an aging card (sweat equity in the warehouse). Specialty Labor cards (Marketing, Cooper, Architect) are not.
- If you have no cards left, only `PASS_TURN` is legal — your un-aged barrels stay un-aged this round.

**v3.5 invariant — aging cards ARE the age counter.** A barrel's age is literally the number of aging cards committed to it (`barrel.age === barrel.agingCards.length`). Aging is not a tempo cost separate from age — aging cards _are_ age. No effect in the game can "skip aging" while still incrementing the age counter; no effect can advance age without committing an aging card. Cards in the v3.4 catalog that promised auto-aging or skipped-aging shortcuts were retired or repurposed in v3.5 for this reason.

When the barrel sells, all aging cards go to your discard.

---

# 🎯 Action Phase

After rolling demand and paying the aging cost, take **any number** of these free actions in any order:

- **Make Bourbon** — commit cards from your hand to a Staged or Building slot.
- **Sell Bourbon** — sell an aging barrel ≥ 2 years old that has aged at least one full round.
- **Buy from the Market** — pay rep (+ optional Labor) to acquire a card.
- **Buy Operations Card** — same; Marketing Labor discounts ops.
- **Draft Mash Bills** — initiate the **Drafting Loop**: spend 1 card to reveal 3 bills, take any number for 1 card each, then pass the remainder around the table. Once per round per player.
- **Trade** — exchange cards with another player. Mash bills are not tradeable.
- **Retrieve Bottle from Inventory** — spend 1 Generic Labor from hand to move one Bottle out of inventory and onto any portfolio slot it satisfies. Unlimited per turn (bounded by available Generic Labor + eligible slots). See [§Brand Portfolios](#-brand-portfolios).
- **Draft Second Portfolio** — spend 1 Generic Labor from hand to claim one of the face-up secondary portfolios next to the play area. Once per game per player; illegal in the final round. See [§Brand Portfolios](#-brand-portfolios).
- **Play Operations Card** — free interruption at any time.
- **End Turn** — voluntary; cards remaining in hand stay until cleanup.

Operations cards always play as a free interruption — they don't consume an action.

---

## Make Bourbon

Each rickhouse slot lives in one of four phases:

- **Open** — no bill. Filled via the [§Drafting Loop](#draft-mash-bills-the-drafting-loop).
- **Staged** — bill present, no committed cards. Public. Does NOT age.
- **Building** — bill + ≥1 committed card, recipe not yet satisfied. Does NOT age.
- **Aging** — recipe satisfied. Locked in. Accepts one aging card per round from the round AFTER completion.

`Make Bourbon` commits cards from your hand to a Staged or Building slot. The bill is already attached — you only choose the slot and the cards. **No per-slot limit** — you can commit to the same slot as many times as you want in a single turn.

Committed cards are **locked with the barrel** — they don't return to discard until the barrel sells.

### Recipe satisfaction

A slot transitions **Building → Aging** the moment its committed pile satisfies BOTH:
1. **Universal rule:** exactly 1 cask + ≥1 corn + ≥1 grain.
2. **The slotted bill's recipe** (if any).

### Exact-recipe rule (with corn range, v3.2)

The total cards on a barrel match the recipe exactly **except for corn**, which now satisfies a **range** `[minCorn, maxCorn]` rather than a fixed count. The player chooses how much corn to commit inside the range; the choice is recorded on the Bottle as its **corn count** and feeds the **strength axis** on Brand Portfolio slot requirements (some slots demand `corn ≥ 4`, for example). **Cask and total grain stay exact** — the engine still rejects commits that push cask past 1 or grain past the recipe.

Per-grain minimums stay floors; bill-specific caps (`maxRye: 0` on wheated bills) are enforced.

> **Backwards compatibility.** Bills authored before v3.2 default to `minCorn = maxCorn = (their fixed value)`, so existing recipes behave exactly as before. Only newly authored bills designed for the v3.2 Brand Portfolio system specify a meaningful corn range (e.g., `minCorn: 2, maxCorn: 5`).

**Specialty-cask exclusivity.** If a recipe demands `minSpecialty.cask ≥ 1`, plain casks are not legal — you must lead with a Specialty (or Heritage) cask.

**Specialty cards satisfy both the regular minimum AND the specialty floor.** One Specialty Rye covers `minRye: 1 + minSpecialty.rye: 1` — not two cards. Heritage cards satisfy the gate the same way.

### Timing

- A barrel completed in **round N first ages in round N+1**.
- A barrel completed in round N **cannot sell until round N+1** (the round-gap rule). Ops cards that accelerate age (Rushed Shipment, Forced Cure) cannot bypass this.

### Specialty gates by rarity

Higher-rarity bills require **Specialty** or **Heritage** cards by subtype, on top of the regular minimums.

| Rarity | Specialty pressure |
|---|---|
| **Common** | Universal rule only. |
| **Uncommon** | Transition tier: at most 1 grain slot gated. |
| **Rare** | Semi-gated: 1–2 `minSpecialty` entries. |
| **Epic** | Fully gated: every cask + named-grain subtype in the recipe demands Specialty or Heritage. |
| **Legendary** | Fully gated AND broader: more entries than any epic, often with tighter unit counts on a single slot. |

---

## Sell Bourbon

Sell any of your **aging** barrels that is **age ≥ 2** AND has been in Aging for at least one full round.

### Sale resolution (single-step)

1. Read the bill's grid at `(barrel age, current demand)` → grid value.
2. Add any per-card on-sale bonuses (themed cards like Spicy Rye, future Heritage hooks).
3. Apply persistent barrel offsets (Master Distiller) and distillery sale modifiers (High-Rye House's +1 rep on rye bills).
4. **Apply the tier floor** — the total is at least:
   - **Tier 1** (Common, Uncommon) — 3 rep
   - **Tier 2** (Rare) — 4 rep
   - **Tier 3** (Epic, Legendary) — 5 rep
5. Add the total to your **reputation** track.
6. Demand drops by 1 (floor 0), unless an effect skips the drop.
7. Cards under the barrel return to your discard.
8. The bill becomes a **Bottle** — a frozen snapshot of recipe tags, cask rarity, age at sale, **corn count committed**, and demand at sale. You must then place it on **any eligible portfolio slot** (across either of your portfolios — required slots respect left-to-right order, optional slots open once their tier unlocks) **or** stash it in **inventory** before you can take other actions. Inventory is always legal and has no constraints, but inventory bottles score nothing at end of game. If the bottle lands on a slot, that slot's **on-fill reward** fires immediately (non-rep utility — draws, prestige, persistent effects); if the bottle's source bill matches the slot's **signature bill**, the slot's **Signature Bonus** also fires. Bottles on slots are **permanent** — they never move once placed. See [§Brand Portfolios](#-brand-portfolios).

The tier floor guarantees every sale clears its baseline build cost — even a Common bill at age 2 / demand 2 pays 3 rep. Higher-rarity bills float higher floors because their build costs are higher (more Specialty cards).

There is no split prompt — the engine resolves the rep total and lands it directly. Bottle placement auto-routes to a slot when exactly one is eligible; the explicit picker opens whenever multiple slots qualify or when inventory might be the better tactical call.

### Awards

Some bills grant awards on sale — they grant **prestige**, a permanent multiplier on future premium sales.

- **Silver** — Bonus rep on this sale (per the bill's Silver value). Slot opens normally; bill goes to discard.
- **Gold** — Bonus rep on this sale (per the bill's Gold value) AND you gain **1 prestige point**. Slot opens normally; bill is *retired* (removed from the game, not just discarded — your distillery has graduated past it).

**Prestige.** Each prestige point you hold adds **+1 reputation to every future Silver or Gold sale** you make. Prestige is permanent and stacks. There is no cap, but Gold-eligible bills are rare enough that 3–4 prestige in a game is exceptional. Prestige does NOT apply to base sales (sales that don't hit Silver or Gold thresholds).

Gold takes precedence if both Silver and Gold trigger. Gold does NOT trigger the final round — only the bourbon supply running out does.

---

## The Unified Market

The market is a **single 10-card face-up row** containing a mix of:

- **Resources** (cask, corn, rye, barley, wheat — Common $1, Specialty $2, Heritage $3)
- **Specialty Labor** ($4 — Cooper, Marketing, Architect)
- **Operations cards** (one-shot effects with various costs)
- **Investments** (long-term permanent passives — effects live as of v3.6; 28 of 33 cards resolved)

Mash bills are NOT in this market — they live face-down in the bourbon deck and only surface during the [§Drafting Loop](#draft-mash-bills-the-drafting-loop).

**On every buy or draw, the empty slot refills immediately** from the face-down market supply. Cards in the supply that aren't drawn between rounds aren't lost — they shuffle back when needed.

**At the end of every year (cleanup), the entire 10-card market is replaced.** The current 10 cards go to the market discard; 10 fresh cards are dealt from the supply (reshuffling the discard back in when supply runs low).

## Buy from the Market

Cost is paid in **Capital** and/or **Labor cards** from hand. Capital and Labor are **fully fungible** — any cost can be paid in Capital, Labor, or any mix.

- **Cooper** (Specialty Labor) — +2 toward market resource buys.
- **Marketing** (Specialty Labor) — +2 toward ops buys (no help on market resources).
- **Architect** (Specialty Labor) — +2 toward investment buys.
- **Generic Labor** — +1 toward any buy. (You only get 3 in your starter deck — finite.)

Capital can never go below 0.

**v3.5 routing.** Every market purchase lands in the buyer's hand, available the same turn. This covers resource cards, ops cards, and Specialty Labor. **Investment cards are the only exception** — they activate immediately on purchase as permanent passives and transfer directly to the player's investments area (they never touch hand). Spent Labor cards go to discard. The empty market slot refills from the supply. End Turn discards everything in hand and redraws — see v3.9 — so a bought resource you don't use this turn naturally cycles into your deck at turn end.

## Buy Operations Card

Same payment model as a resource buy — the engine routes ops targets through a dedicated action because they land in your **operations hand** instead of your discard. Marketing Labor (+2) is the matching specialty.

## Buy Investment

Same payment model. The bought investment transfers directly to your **investments area** (the on-purchase effect fires immediately and the card stays in front of you as a permanent passive — it never sits in hand). v3.6: effects are live for 28 of the 33 cards — on-purchase cards apply at once (Warehouse unlock, Aging Warehouse slot, Estate Bottling free draft), and the four choice cards stash a pending pick that gates you to `RESOLVE_INVESTMENT_CHOICE` before any other action (see [§Investment Cards](#-investment-cards-v36)). Architect Labor (+2) is the matching specialty.

## Draft Mash Bills (The Drafting Loop)

The signature bill-acquisition action. A table event, not a solo transaction.

**Once per round per player. Not legal in the final round.**

### How it works

1. **Initiate.** The active player places one resource or Labor card from hand face-up on the table to start the **draft pile**. They reveal the top **3 bills** from the bourbon deck face-up beside the pile.
2. **First pick.** The active player takes 0–N bills (where N = their current Open slots), adding one card from hand to the draft pile for each bill taken. Each bill lands in an Open slot as **Staged**. Bills cost no rep — the only cost is the card added to the pile per bill.
3. **Pass left.** The draft pile (cards + remaining bills) passes to the player on the active player's left.
4. **Each subsequent player, in turn, may — in this order:**
   - **Take any cards from the draft pile** into their hand (free).
   - **Take any remaining bills** by adding one card from hand to the draft pile per bill, capped by their Open slots. Bills land as Staged.
   They may take cards only, bills only, both, or pass entirely. Then they pass the pile to their left.
5. **Loop closes.** When the pile returns to the initiator, the loop ends. Any remaining bills shuffle back into the bourbon deck. Any remaining cards go to the market discard.

### What can be paid into the pile

Any single resource card (Common, Specialty, or Heritage) **or** any Labor card (Generic or Specialty). One card per bill taken. Mash bills cannot be paid into the pile — they're slot-bound and never enter hands.

### Distillery constraints

Constraints apply normally. **High-Rye House** cannot take a bill with `maxRye: 0`; it stays in the pile and passes on. **Wheated Baron** has no bill constraint (only a card-commit constraint). **Connoisseur Estate's** 4-bill cap applies — they cannot take a bill if doing so would push their slotted-bill count past 4.

If all 3 revealed bills are illegal for the initiator and no other players take them either, the loop still consumes the initiator's once-per-round use.

### Why this matters

The Drafting Loop is a three-way value engine:

- **Bill acquisition** — the obvious draw. First pick of 3 random bills, with the option to grab multiple.
- **Deck thinning** — the card you offer (and any cards you put in for bills you take) may leave your deck permanently if someone else claims them.
- **Card pickup** — anyone in the loop can scavenge the accumulating pile, picking up cards left behind by previous players. The later you sit in the loop, the bigger the pile tends to be.

Strategic considerations:

- **Offer junk that someone might want.** A Common Wheat you don't need might be valuable to the Wheated Baron — they'll happily take it and thin your deck for you.
- **Offer pure junk if you just want it gone.** It cycles to the market discard if nobody takes it — still removed from your deck.
- **Sit late in the loop for cumulative pickup.** Mid-loop players paying for bills feed the pile; the last player often inherits a stack of cards.
- **Initiate when you want bills AND want to thin.** The action is most efficient when both motives align.

### Round-gap behavior

Bills acquired through the Drafting Loop land as Staged like any other bill draft. Standard rules apply — no aging this turn, recipe satisfaction requires commits in following turns.

## Warehouse (replaces the v3.4 Save Slot)

The free Save Slot is gone in v3.5. The **Warehouse** investment card (cost 4) is now the only way to carry a single card between rounds. Buying the Warehouse engages a private Warehouse slot for that player; at any time on their turn they may set aside one card from hand into the Warehouse (holds at most one), and on any future turn they may move the Warehouse card back into hand as a free action. The stored card persists across rounds and is **not** discarded at End Turn. Strategic use is the same as the old Save Slot — keep a Cooper for the round you plan to buy a Heritage, or stash a Specialty Rye for the round you'll commit it — but now you have to invest 4 Capital to get the ability.

## Trade

Two players exchange cards by mutual consent. Each side offers at least one card. **Traded cards land in the recipient's hand** (not discard).

**Mash bills cannot be traded** — they're slot-bound and public. **Trading is illegal during the final round.**

## End Turn

Voluntary. Cards remaining in your hand stay until cleanup. Operations cards persist across rounds.

---

# 🏚️ The Rickhouse

**4 slots** by default, all equivalent. The Rickhouse Expansion Permit ops card raises the cap to **6**.

| Phase | Bill? | Cards? | Ages? | Draftable into? |
|---|:-:|:-:|:-:|:-:|
| **Open** | — | — | — | ✅ |
| **Staged** | ✅ | — | — | — |
| **Building** | ✅ | partial | — | — |
| **Aging** | ✅ | recipe complete | ✅ | — |

Lifecycle: `Open` → (Draft) → `Staged` → (Make, first commit) → `Building` → (Make, recipe complete) → `Aging` → (Sell) → `Open`.

When **all** slots hold a bill, you cannot take a new one — sell or finish a barrel first.

---

# 📜 Mash Bills

Recipes that determine each barrel's reward grid. **Bills are slot-bound** — they live on rickhouse slots and never enter a player's hand.

### How bills enter play

- **Setup draft** — Vanilla draws 0, High-Rye/Wheated 0 + 1 pre-aged, Connoisseur 4.
- **Drafting Loop action** — the standard in-game bill acquisition (see [§Draft Mash Bills](#draft-mash-bills-the-drafting-loop)).
- **Allocation** ops card — up to 2 bills free, capped by Open slots.
- **Barrel Broker** ops card — transfers a completed barrel (with its bill) to another player.
### Public information

Every bill is **public the moment it's slotted** — recipe, grid, awards, all visible to all players.

### Bills are not tradeable

Bills move only via the actions listed above — never by Trade.

---

# 🏷️ Brand Portfolios

Each barrel you **sell** also produces a **Bottle** — a frozen snapshot of the bill (recipe tags, cask rarity, age, **corn count committed**, demand at sale). Bottles fill the named **slots** of your **Brand Portfolios** — product-line boards in front of you. Filling a slot fires an immediate **non-rep utility** reward (draws, prestige, persistent effects); filling it with the slot's **signature bill** also fires a Signature Bonus. End-game scoring climbs **three cumulative tiers** per portfolio: **Completion** (all required slots filled), **Theme** (every filled slot satisfies the soft Brand Restriction), **Mastery** (every filled slot meets the portfolio's strict purity condition).

> Brand Portfolios are the long-game scoring track. Banked reputation is your tactical score; portfolio tier climbing is your strategic one. A flagship that reaches Theme usually beats one that just hits Completion; a second portfolio that reaches Mastery can swing the game, but failing to complete it punishes you back.

## The boards: flagship + optional second + inventory

Every player has:

- **1 flagship portfolio** — pre-claimed at setup. A 3–6 slot product lineup bound to your distillery (Wheated Baron → *The Baron's Lineup*, Vanilla → *Standard Reserve*, etc.) with a Brand Restriction, a Mastery Condition, named slots with their own requirements, on-fill rewards, signature bills, and end-game values. The flagship is yours for the whole game and **cannot be discarded — and has no failure penalty.**
- **Up to 1 second portfolio** — drafted mid-game by spending 1 Generic Labor on the **Draft Second Portfolio** action. Pulled from the shared face-up pool of **N+2** boards laid out at setup. Once per game per player; illegal in the final round. Carries a back-end penalty if you don't reach Completion.
- **Inventory** — an unscored buffer for bottles you can't (or don't want to) place right now. Bottles in inventory at game end score **zero rep**; the v3.1 +1/bottle rule is removed. You can retrieve a bottle from inventory back to an eligible slot at any time during your turn — see [§Retrieving from inventory](#retrieving-from-inventory).

## Slot mechanics: required, optional, and tiers

Each portfolio's slots split two ways:

- **Required slots** (printed with a **solid outline**) must fill **left-to-right**. You cannot place a bottle in the next required slot until the previous one is filled.
- **Optional slots** (printed with a **dotted outline**) can fill in any order, but only after their **tier** has unlocked.

A portfolio's slots are grouped into **tiers** (small clusters of consecutive slots). A tier unlocks the moment its **first required slot** fills — at that point every optional slot in the same tier becomes eligible too. Tiers themselves are sequential: reaching tier 3 still requires tier 2's required slots filled (per the left-to-right required-slot rule).

> **Placement rule, canonical statement.** Required slots fill left-to-right across the portfolio's required-slot sequence. Optional slots can be filled in any order, but only after the tier containing them has unlocked. A tier unlocks when its first required slot is filled.

## Slot anatomy

Each slot carries:

| Field | Meaning |
|---|---|
| **Name** | The product this slot represents (e.g., "Baron's Cask Strength"). |
| **Required / Optional** | Solid outline = required (gates progression); dotted = optional (scores when filled). |
| **Tier** | Which tier this slot belongs to. Optional slots only become eligible once their tier unlocks. |
| **Placement requirement** | Gates on any combination of **age** (≥), **ingredients** (recipe tags, cask rarity), **strength** (corn count committed at production), and **demand at sale**. A slot may gate on 1–3 axes; higher-tier slots gate on more. |
| **Signature bill** | A specific bill defId. Filling this slot with a bottle produced from that bill fires the **Signature Bonus** in addition to the normal on-fill reward. |
| **On-fill reward** | Non-rep utility (draw cards, +prestige, gain a worker, persistent effects, etc.) that fires the moment the slot transitions empty → filled. **Slot rewards never pay mid-game rep**; mid-game rep comes from sales. |
| **Signature Bonus** | Extra reward fired alongside the on-fill reward when the signature bill matches. Typically equivalent to about one tier higher than the slot's normal reward. |
| **End-game value** | Rep contributed by this slot if filled at game end. |

## Slot requirement axes

A slot gates a bottle on any combination of:

- **Age** — barrel age at sale. Monotonic: a 7-year bottle satisfies "age 2+", "5+", and "7+" simultaneously.
- **Ingredients** — recipe tags (rye-heavy, wheated, single-grain, triple-grain, heritage-recipe) and cask rarity (Common / Specialty / Heritage).
- **Strength** — the corn count committed at production. Categorical: a 4-corn bottle does NOT satisfy "corn ≤ 2".
- **Demand at sale** — the demand level when the bottle sold, frozen on the bottle.

## Brand Restriction (soft — scoring only)

Each portfolio carries a **Brand Restriction** — a thematic guideline (e.g., "wheated bottles," "no repeating primary recipe tag," "Heritage cask"). **The Brand Restriction does NOT gate placement.** Any bottle that satisfies a slot's individual requirement may be placed there regardless of whether it satisfies the Brand Restriction.

The Restriction matters only at end-game scoring, where it determines whether the portfolio reaches the **Theme tier**. This is a breaking change from v3.1, where Restrictions were hard placement gates.

## Bottle placement (after every sale)

When you sell, the engine derives the bottle's profile (recipe tags, cask rarity, age, **corn count**, demand at sale). Then choose one of:

1. **Place on any eligible portfolio slot.** Walk every slot across both portfolios. A slot is eligible if its requirement is satisfied AND it's open (next-in-line required, or a tier-unlocked optional). When more than one slot is eligible, you pick.
2. **Stash in inventory.** Always legal. No constraints. Inventory scores zero at end of game — it's a pure buffer.

Placement is **mandatory** before any other action resumes. **Bottles on slots are permanent.** Once placed, a bottle never moves again — not to another slot, not back to inventory, not into discard. The slot is filled with that specific bottle for the rest of the game.

## Retrieving from inventory

Any time during your turn (free action, no phase restriction beyond the action phase): **spend 1 Generic Labor** from hand to move one bottle out of inventory and onto an eligible portfolio slot. Standard eligibility rules apply (requirement satisfied, tier unlocked or next-required). The spent worker goes to your discard. On a successful retrieval, the slot's on-fill reward fires immediately, and the Signature Bonus fires if the bottle's source bill matches.

Retrievals are **unlimited per turn**, bounded only by available Generic Labor and currently-eligible slots. A bottle that can't satisfy any open slot stays in inventory.

## Slot rewards (non-rep utility only)

On-fill rewards fire **exactly once**, the moment the slot transitions empty → filled. They are **never mid-game rep** — mid-game rep is what the sale rewards on the rep track. Slot rewards escalate by tier position:

| Tier position | Typical on-fill reward |
|---|---|
| Slot 1 | Small utility — draw 1 card, +1 demand on next sale, gain 1 worker |
| Slot 2 | Moderate — draw 2 cards, +1 prestige, single-turn persistent effect |
| Slot 3 | Strong — +2 prestige, round-long persistent effect, free market card |
| Slot 4 | Powerful — triggered effect, defensive ability, +1 rickhouse slot |
| Slot 5 | Dramatic — combination of multiple powerful utilities |

There is **no cascade** — filling slot N does not re-trigger slot N−1's reward.

### Signature Bonus

If a slot's signature bill ID matches the bottle's source bill, an additional reward fires. The Signature Bonus is typically the equivalent of one tier-position higher than the slot's normal reward — substantial but not game-breaking. The **starting tuning** is: +2 end-game value AND a small immediate utility (e.g., draw 1 card, +1 prestige).

## End-game scoring (three cumulative tiers)

When the bourbon supply runs out, each of your portfolios scores independently across three tiers. Tiers are **cumulative** — reaching Mastery means you also scored Completion and Theme.

### Completion tier

- **Condition:** all **required** slots filled. (Optional slots don't count toward Completion.)
- **Reward:** the portfolio's **Completion Bonus** (typically +5 to +10 rep).

### Theme tier

- **Condition:** Completion AND **every filled slot** (required and optional) holds a bottle satisfying the **Brand Restriction**.
- **Reward:** the portfolio's **Theme Bonus** (typically +5 to +10 additional rep).
- The Brand Restriction is enforced only at this step — never at placement.

### Mastery tier

- **Condition:** Theme AND every filled slot meets the portfolio's **Mastery Condition** (a strict purity requirement, stricter than the Brand Restriction).
- **Reward:** the portfolio's **Mastery Bonus** (typically +10 to +15 additional rep).

### Putting it together

Each portfolio scores:

- Sum of end-game values from all filled slots (required + optional)
- Sum of Signature Bonuses earned
- Completion Bonus (if Completion reached)
- Theme Bonus (if Theme reached)
- Mastery Bonus (if Mastery reached)

**Flagship: no failure penalty.** Leaving the flagship short of Completion costs you the bonus and the unfilled slots' values, but does not pay rep on top.

**Second portfolio failure penalty.** If you drafted a second portfolio and **did not reach Completion**, you lose **2 rep per unfilled required slot, capped at −10 rep**. If the second portfolio reached Completion (or higher), no penalty. The flagship never carries this penalty.

Total per player = banked rep + flagship scoring + second-portfolio scoring (minus failure penalty if applicable) + 0 from inventory.

## Drafting the second portfolio

At setup, **N+2 portfolio boards** (where N = player count) are laid out face-up next to the play area from a face-down secondary-pool supply. They stay visible and unchanged for the whole game — no refill, no rotation. Once a board is drafted, the pool shrinks.

The **Draft Second Portfolio** action (free, action phase) costs **1 Generic Labor** from hand (to your discard). You take one portfolio board from the pool and place it next to your flagship. From that moment, the second portfolio is live for bottle placement.

- **Once per game per player.**
- **Illegal in the final round.**
- Bots evaluate the draft alongside other free actions; humans use the explicit action button when the pool offers something matching their production direction.

The choice carries real risk: drafting a 5-slot portfolio you can't complete costs −10 rep at game end. Drafting a 3-slot portfolio with looser requirements is safer but has a lower ceiling.

## Flagship Portfolios (one per distillery)

Each base-game distillery ships exactly one flagship portfolio. Final designs for three of the four are still being authored; the canonical example below is for Wheated Baron and matches the v3.2 spec's illustrative table.

### Wheated Baron — "The Baron's Lineup" (canonical)

- **Brand Restriction:** wheated bottles (Theme tier requires every filled slot is wheated).
- **Mastery Condition:** all filled slots wheated AND no rye in any committed recipe AND every filled slot aged 4+.

| # | Slot | Tier | Required? | Requirement | Signature Bill | On-Fill Reward | Signature Bonus | End-Game Value |
|---|---|:-:|:-:|---|---|---|---|:-:|
| 1 | Baron's Select | 1 | Required | wheated, age 2+ | Baron's Select Bill | +1 demand on next sale | draw 1 card | +2 |
| 2 | Baron's Reserve | 1 | Optional (dotted) | wheated, age 3+, corn 3+ | (none) | draw 2 cards | — | +3 |
| 3 | Baron's Cask Strength | 2 | Required | wheated, age 4+, corn 4+ | Baron's CS Bill | gain 1 worker, +1 prestige | +1 prestige | +5 |
| 4 | Baron's Heritage | 3 | Required | wheated, Heritage cask, age 5+ | Baron's Heritage Bill | +2 prestige; persistent: next sale +2 demand | gain 1 free market card | +7 |
| 5 | Baron's Vintage Reserve | 3 | Required | wheated, Heritage cask, age 7+, corn 5+ | Baron's Vintage Bill | persistent: demand never drops on your sales | +3 prestige, draw 3 cards | +10 |

- **Completion Bonus:** +8 rep
- **Theme Bonus:** +6 rep
- **Mastery Bonus:** +10 rep

> Values are illustrative; final tuning is pending balance pass.

### Vanilla Distillery, High-Rye House, Connoisseur Estate — design pending

The other three flagships are being redesigned to the v3.2 structure. Their thematic anchors are locked even where slot specifics aren't:

- **Vanilla Distillery — "Standard Reserve"** — no Brand Restriction (any bottle qualifies for Theme). Mastery rewards broad production; the working draft Mastery Condition reads roughly "every filled slot in your second portfolio is also filled," tying flagship Mastery to second-portfolio Completion.
- **High-Rye House — "The House Lineup"** — Brand Restriction: rye-heavy bottles. Mastery Condition tightens to "rye-heavy AND no barley in any committed recipe."
- **Connoisseur Estate — "The Estate Collection"** — Brand Restriction: no repeated primary recipe tag across filled slots. Mastery Condition tightens further: every filled slot has a unique cask rarity AND a unique primary grain tag.

Until the design pass lands, the engine ships these three flagships with placeholder slot definitions sufficient to let games complete; the rulebook (this document) is authoritative for their thematic identity.

## Secondary Pool (base game)

The base-game secondary pool ships 6–8 portfolios spanning a range of identities and slot counts (3 to 6 slots — your difficulty/ceiling choice when drafting). Working list:

- **Single-Origin Series** — single-grain bottles (one grain type only).
- **Counter-Cyclical** — bottles sold at low demand.
- **Heritage Collection** — Heritage cask bottles.
- **Volume Brand** — loose requirements, high slot count, low individual rewards.
- **Boutique Limited Release** — strict requirements, 3 slots, high per-slot rewards.
- **Cask Strength Reserve** — high-corn bottles.
- **Aged Statement** — high-age bottles, recipe agnostic.

Final slot tables for the secondary pool are part of the same design pass as the three non-Baron flagships.

## Expansions

Licensed expansions can add:

- New **flagships** for existing distilleries (a distillery with multiple available flagships lets the player choose at setup, locked for the game).
- New **secondary portfolios** that shuffle into the secondary pool supply.
- New **signature bills** that enter the bourbon deck alongside their portfolios.

A Rabbit Hole expansion, for example, might ship Rabbit Hole Core (diversity portfolio), Rabbit Hole Founder's Collection (Heritage cask, high age), and Rabbit Hole Distillery Series (cask strength, experimental finishes).

## Strategic notes

- **The flagship is a gift.** You start with it for free; there is no failure penalty. Treat its Theme and Mastery tiers as upside, Completion as the baseline goal.
- **The second portfolio is a bet.** Drafting one buys you upside but commits you to its required slots. Pick a 3-slot Boutique only if your production already points that way; don't draft a 5-slot Volume just because it's available.
- **Inventory is a real tool.** Stashing a great bottle now and retrieving it later (after a tier unlocks, or after a signature bill finishes production) is the v3.2 deck's main timing lever.
- **Signature bills shift draft priority.** A bourbon-deck bill that's a signature for one of your slots gains value. If the signature is on a Required slot of your flagship's high tier, that bill might be worth grabbing even off-theme.
- **Strength is now a real axis.** Choosing how much corn to commit to a recipe is no longer cosmetic — corn 4+ bottles open doors that 2-corn bottles can't.

---

# 🃏 Hand and Deck

Each player is dealt **8 cards** once, during setup. From that point on the hand refreshes at exactly one moment per turn — see below. No max hand size during a turn.

**End Turn is the only hand refresh (v3.10).** When a player ends their turn, every resource and Labor card still in hand is sent to discard and the player immediately redraws back up to **8 cards**. The redraw is the last thing that happens on their turn before the cursor passes to the next seat. By the time the next round opens, every player already holds 8 cards from that redraw — there is no separate top-up at round start. Operations cards in hand persist across turns and rounds — they are never discarded by End Turn.

The round's `Draw` phase still ticks for orchestration (it exists so the Year Pass recap can land between rounds), but the `DRAW_HAND` action is a pure phase-marker — it never moves a card. Cleanup likewise leaves each player's hand alone — it handles round-level resets only (aging flags, drafting-loop allowance, market refresh, start-player rotation).

The deck contains **resource cards** (cask, corn, grain — premiums come from the market) and **Labor cards** (sweat equity that supplements rep on purchases).

### Card types

- **Resource** — cask, corn, wheat, rye, barley. Needed to make bourbon.
- **Labor** — sweat equity. Generic Labor (+1 anywhere) lives only in the starter deck (3 per player, finite — there is no central Hire pile). Specialty Labor (Cooper +2 toward market resources, Marketing +2 toward ops, Architect +2 toward investments) appears in the unified market and is the only way new Labor enters your deck.
- **Operations** — bought from the unified market. Held in your operations hand; play as a free interruption (one-shot).
- **Investment** — bought from the unified market. Long-term permanent passives; effects are live as of v3.6 (28 of 33 cards resolved, 5 deferred).

### Card Bands

Resource cards in the market sort into three pricing bands. Every card is **1 unit**. Costs are paid in reputation (and/or Labor).

| Band | Cost | Units | Notes |
|---|:-:|:-:|---|
| **Common** (cask, corn, rye, wheat, barley) | $1 | 1 | Basic; payable in 1 rep or 1 Generic Labor. |
| **Specialty** (superior cask / corn / rye / wheat / barley) | $2 | 1 | Satisfies `minSpecialty.<subtype>` gates. |
| **Heritage** (heritage cask / corn / rye / wheat / barley) | $3 | 1 | Satisfies the same gates; per-card on-sale bonus hook (no Heritage card ships a populated bonus yet). |

Premium variants — Specialty and Heritage — only enter play via the market.

The Specialty Labor strip:

| Labor | Cost | Domain |
|---|:-:|---|
| **Marketing** | $4 | Ops (+2 toward ops buys) |
| **Cooper** | $4 | Market resources (+2 toward market resource buys) |
| **Architect** | $4 | Investments (+2 toward investment buys) |

Generic Labor is not sold — your 3 starter-deck Generic Labor cards are the only Generic Labor you'll ever own. Specialty Labor (above) is the only way new Labor enters your deck.

---

# 📊 Market Demand

Range **0–12**, starting at 0.

- **Rises by 1** when an active player's 2d6 turn-opening roll exceeds current demand. Up to N rises per round (once per player).
- **Falls by 1** for each barrel sold (floor 0), unless skipped.
- **Moved directly** by some ops cards.

Each mash bill defines its own demand bands. Some pay better at low demand; others demand a hot market.

---

# 📈 Reading a Mash Bill

Every bill prints a grid keyed on age and demand:

1. Find the highest age threshold ≤ the barrel's age — that's the row.
2. Find the highest demand threshold ≤ current demand — that's the column.
3. The cell is the base reputation reward.

The **tier floor** then guarantees a minimum (3 / 4 / 5 by rarity).

### Example — Backroad Batch (Tier 1 workhorse bill)

`ageBands: [2, 4, 6]`, `demandBands: [2, 4, 6]`

| Age \ Demand | 2–3 | 4–5 | 6+ |
|---|:-:|:-:|:-:|
| 2–3 | 1 | 2 | 3 |
| 4–5 | 2 | 4 | 5 |
| 6+ | 3 | 5 | 6 |

A 5-year barrel at demand 7 reads **5** on the grid. Tier-1 floor (3) is met — no clamp needed. The 5 rep lands on the player's track.

---

# 🃏 Operations Cards

Bought from the **unified market** (any of the 10 face-up slots that happens to hold an ops card). Held in a separate **operations hand** (no size limit). Played as a **free interruption** during your turn — one-shot. **Not tradeable.**

Operations cards held before the final round can be played; new ops cards bought during the final round **cannot** be played that round.

### The live catalog

The numbers below match `packages/engine/content/operations.yaml`
(the canonical catalog the engine ships from). The deck holds the
**copies** column of each row × the listed card. The v3.6
aggression-axis additions are detailed in the next section.

| Card | Cost | Copies | Effect |
|---|:-:|:-:|---|
| **Kentucky Connection** | 1 | 2 | Draw 2 cards from your resource deck. |
| **Market Manipulation** | 2 | 3 | Move the demand track ±1. |
| **Glut** | 2 | 2 | Demand −2 (floor 0). |
| **Wild Mash** | 2 | 3 | Pre-play. This turn, treat 1 cask card in your hand as a wild grain when committing to a recipe (or treat 1 grain as a cask). |
| **Bourbon Boom** | 3 | 2 | Demand +2 (cap 12). |
| **Demand Surge** | 3 | 2 | Your next sale this round does not drop demand. |
| **Rushed Shipment** | 3 | 3 | Age one of your barrels twice this round. |
| **Rating Boost** | 3 | 2 | Pre-play. Next sale +2 reputation. |
| **Regulatory Inspection** | 3 | 3 | Target an aging barrel of any player. It may not be aged this round. |
| **Allocation** | 3 | 2 | Draw up to 2 mash bills free from the bourbon deck, capped by your Open slots and (if you have one) by your distillery's max-slotted-bill cap. |
| **Cooper's Contract** ⚐ | 1 | 2 | Commit-as-resource (cask). See v3.6 section. |
| **Slow Pour** | 1 | 3 | Attack — Choose an aging barrel. It does not age next round. |
| **Spoiled Batch** | 1 | 3 | Attack — Choose an opponent. They discard 1 random card from their hand. |
| **Grain Futures** ⚐ | 2 | 2 | Commit-as-resource (any grain). See v3.6 section. |
| **Audit** | 2 | 2 | Attack — Reveal an opponent's hand. They discard 1 card of your choice. |
| **Counterfeit Bottles** | 2 | 2 | Attack — An opponent's next sale reads the grid as if demand were 2 lower (floor 0). Tier floor still applies. Stacks. |
| **Federal Inspector** | 3 | 2 | Attack — Choose an opponent. They lose 2 Capital (floored at 0) and discard 1 card of your choice. |
| **Whiskey Raid** | 3 | 2 | Attack — Target an opponent's aging barrel of age ≤ 2. Blind dice contest. See v3.6 section. |
| **Sabotage** | 4 | 2 | Attack — Choose an opponent's aging barrel. Discard 1 committed resource card from it; the barrel is dumped (bill stays attached). |

**Total:** 19 distinct cards, 47 copies. Cards marked ⚐ are
**committed during MAKE_BOURBON** instead of played via
PLAY_OPERATIONS_CARD — the engine rejects a play attempt with a
"committed via MAKE_BOURBON, not played" message.

> **Removed in earlier passes.** The v3.1 deck shipped a long tail
> of effects that never resolved cleanly — Blend, Barrel Broker,
> Rickhouse Expansion Permit, Cash Out, Insider Buyer, Bottling Run,
> Forced Cure, Market Corner, Mash Futures, Master Distiller. Commit
> `90df94c` (v3.2 prep) dropped them; commit `41bcf8f` and after
> (v3.6) added the modern attack axis above. None of the listed
> v3.1-only cards are in the deck today.

## v3.6 — Aggression axis (added)

Until v3.5 the ops deck had a single griefing card (Regulatory
Inspection). v3.6 adds **aggression as a strategic axis** with seven
attack vectors across four price points, plus two production
**commit-as-resource** contracts and the deck's first **defensive
investment**.

### Commit-as-resource — Cooper's Contract + Grain Futures

| Card | Cost | Copies | Acts as |
|---|:-:|:-:|---|
| **Cooper's Contract** | 1 | 2 | 1 cask in a barrel commit |
| **Grain Futures** | 2 | 2 | 1 grain in a barrel commit (any-grain wildcard, not a per-grain min) |

Both cards are **committed** during `MAKE_BOURBON` from the player's
operations hand — they are NOT played via PLAY_OPERATIONS_CARD. Each
card occupies a single resource slot and is locked into the barrel
until sale. **Specialty floors are never satisfied** by these cards —
they are paper contracts, not actual casks/grain. The exact-recipe
rule (v2.10) still applies: one cask slot per barrel, etc.

On sale, the committed contract returns to the player's
`opsDiscard` pile — separate from the resource discard, so paper
contracts don't recycle into the resource deck.

### The seven attack vectors

| Card | $ | Effect |
|---|:-:|---|
| **Slow Pour** | 1 | Choose an aging barrel. It does not age **next** round. |
| **Spoiled Batch** | 1 | Choose an opponent. They discard 1 random card from their hand. |
| **Audit** | 2 | Reveal an opponent's hand. They discard 1 card of your choice. |
| **Counterfeit Bottles** | 2 | An opponent's next sale reads the grid as if demand were 2 lower (floor 0). Tier floor still applies. Stacks. |
| **Federal Inspector** | 3 | Choose an opponent. They lose 2 Capital (floored at 0) and discard 1 card of your choice. |
| **Whiskey Raid** | 3 | Target an opponent's aging barrel of **age ≤ 2**. See defense flow below. |
| **Sabotage** | 4 | Choose an opponent's aging barrel. Discard 1 committed resource card from it; the barrel is dumped (bill stays attached, rebuild from scratch). All cards in the barrel return to the opponent's discard. |

### Whiskey Raid defense flow

The signature aggression card runs as a **two-step blind dice
contest**.

1. Attacker plays Whiskey Raid, names the target barrel (age ≤ 2,
   opponent only, attacker must have ≥1 open rickhouse slot).
2. Engine rolls the attacker's **2d6** immediately and freezes the
   raid into `state.pendingRaid`. No other action is legal on the
   targeted barrel and no other raid may start until this one
   resolves.
3. Defender silently picks **X ≥ 0** cards from their hand to
   discard as defense (declared blind, before any defender roll).
4. Engine rolls defender 2d6 → `defenderRoll`. Defender total is
   `defenderRoll + X + (count of Watchman investments)`.
5. **Defender wins ties.** If defender total ≥ attacker total, the
   barrel stays.
6. Otherwise the attacker wins → the barrel transfers to one of
   the attacker's open slots. Bill + every committed and aging
   card travels with it. Slot mapping is the attacker's first open
   slot.
7. **Discarded cards are lost regardless of outcome.** Every card
   the defender named is a real cost; nothing comes back.

Resource math at typical X values (no Watchman):

| X | Attacker's odds (defender wins ties) |
|:-:|:-:|
| 0 | ~42% |
| 1 | ~33% |
| 2 | ~25% |
| 3 | ~17% |
| 4 | ~11% |

### Watchman investment

| Card | Cost | Category | Effect |
|---|:-:|---|---|
| **Watchman** | 3 | defense | Persistent. Each copy adds **+1** to your raid defense roll. Multiple Watchmen stack. |

The first investment with a live effect. Read inside
`RAID_DEFENSE_DECLARE` (count of player.investments where
`defId === "watchman"`). Outside a raid the card is dormant
chrome.

Why an investment and not an ops card:

- Ops cards are one-shot; defense needs to be persistent.
- Investments are the right home for permanent ongoing benefit.
- "Specifies attacks as a category" — the engine reads the
  Watchman count generically, so future attack cards that follow
  the dice-contest pattern slot in for free.

---

# 💼 Investment Cards (v3.6)

Bought from the unified market like every other card. Per [§Buy Investment](#buy-investment), investments transfer directly to your **investments area** on purchase (they never sit in hand) and stay as permanent passives in front of you.

**v3.6 — effects are live.** The engine now resolves **28 of the 33 cards** (`implemented: true`). On-purchase cards fire the instant they land (Warehouse unlock, Aging Warehouse's +1 slot, Estate Bottling's free draft); the four **choice cards** — Brand Ambassador, Master Distiller, Climate-Controlled Warehouse, Bonded Warehouse — stash a pending choice that gates you to a single follow-up pick (barrel / tag / slot) before any other action. Automatic cards read ownership at the relevant trigger (sale, aging, end-game). **Free actions** ride dedicated moves: Warehouse store/retrieve, and Trade Lobby's once-per-round demand shift. **Five cards remain `implemented: false`** pending follow-up design and are marked **⏳** below: Field Office, Marketing Department, Sales Office, Cooperage, Column Still.

The v3.6 catalog is **33 cards** distributed 9 small (cost 3–4) · 13 medium (cost 5–8) · 11 large (cost 9–15), grounded in real-world distillery capital expenditures.

### Small tier (cost 3–4)

| Card | Cost | Category | Text (short) |
|---|:-:|---|---|
| **Tasting Room** | 4 | sales | Sell a barrel aged 5+ → +1 Capital. |
| **Grain Contract** | 4 | deck | First grain commit each round → draw 1. |
| **Tasting Notes** | 3 | deck | Sell → bottle on slot draws 2, bottle to inventory draws 1. |
| **Field Office** ⏳ | 4 | info | On purchase, peek every face-up secondary portfolio's full slot table; reveal one. |
| **Warehouse** | 4 | deck | Persistent 1-card slot across rounds. The v3.5 replacement for the free Save Slot. |
| **Visitor Center** | 4 | sales | Sell → +1 Capital (+2 if the bill is `gold-eligible` or `silver-eligible`). |
| **Rail Spur** | 3 | market | First market purchase each round costs 1 less Capital (floor 1). |
| **Watchman** | 3 | defense | Opponent raids one of your barrels → +1 to your defense roll. Stacks. |
| **Cellar Foreman** | 4 | deck | Turn start (after demand roll, before aging): draw 1. Once per round. |

### Medium tier (cost 5–8)

| Card | Cost | Category | Text (short) |
|---|:-:|---|---|
| **Marketing Department** ⏳ | 5 | demand | Reroll one demand die at turn start. Once per round. |
| **Trade Lobby** | 6 | demand | Shift demand ±1 at turn start. Once per round. |
| **Distillery Tour Program** | 6 | demand | Your sales / grid lookups treat demand as 4 if lower. |
| **Hedge Fund** | 7 | sales | Sell at demand 8+ → +3 Capital; demand doesn't drop. |
| **R&D Department** | 8 | market | Specialty / Heritage buys cost 1 less Capital (floor 1). |
| **Master Blender** | 7 | production | Complete recipe with corn ≤ 2 or ≥ 5 → +2 Capital and +1 Reputation. |
| **Estate Bottling** | 8 | endgame | Next Draft Second Portfolio is free; second-portfolio failure penalty halves. |
| **Heritage Cooperage** | 7 | production | Sell barrel with ≥1 Heritage card → all Heritage cards return to hand. |
| **Bottling Line** | 8 | sales | First sale each round returns the cask to hand instead of discard. |
| **Yeast Lab** | 6 | production | First recipe completion each round → draw 2. |
| **Bottling Plant** | 7 | sales | Sell → draw 1 and +1 Capital. No round limit. |
| **Sales Office** ⏳ | 7 | market | Turn start: peek top 3 supply cards; rearrange or discard one. Once per round. |
| **Rickhouse Office** | 6 | deck | Turn start (after demand, before aging): draw 2. Once per round. |
| **Cooperage** ⏳ | 6 | production | First cask commit each round returns the cask to hand. |
| **Climate-Controlled Warehouse** | 7 | aging | Designate one slot; immune to aging-negative ops. |

### Large tier (cost 9–15)

| Card | Cost | Category | Text (short) |
|---|:-:|---|---|
| **Brand Ambassador** | 9 | sales | Choose one barrel; reads grid at demand +2 forever. |
| **Premium Label** | 10 | sales | Sell barrel containing ≥2 Specialty/Heritage cards → +3 Capital. |
| **Aging Warehouse** | 11 | slots | +1 permanent rickhouse slot (max 6). |
| **Bonded Warehouse** | 12 | aging | Designate one slot as bonded; aging cards return to hand on sale from that slot. |
| **Vintage Reserve** | 13 | sales | Sell barrel age 7+ → triple the grid value (before tier-floor clamp). |
| **Bourbon Hall of Fame** | 15 | endgame | End of game: +1 Reputation per distinct bill sold (cap +6). |
| **Master Distiller** | 12 | production | Choose one tag (`wheated` / `rye-heavy` / `single-grain` / `triple-grain`); every barrel you complete inherits it. |
| **Column Still** ⏳ | 10 | production | Make Bourbon may commit to up to TWO Staged/Building slots in one action. |
| **Climate-Controlled Rickhouse** | 12 | aging | All your slots are climate-controlled (aging-negative ops immunity). |

Source-of-truth specs live in `packages/engine/content/investments.yaml`. The cards in the table above are exactly the entries shipped by `defaultInvestmentCatalog()` in `packages/engine/src/defaults.ts`.

---

# 🏛️ Distillery Profiles

Four distilleries. Each profile is a full asymmetric package: **starting state**, **starting rep**, **permanent ability**, **constraint** (asymmetric three only).

### Vanilla Distillery — "The Symmetric Option"
- *Starting state:* 5 starting rep, 4 Open slots, no pre-aged barrels.
- *Permanent ability:* None.
- *Constraint:* None.

The baseline. Pick for an introductory game.

### High-Rye House — "The Specialist"
- *Starting state:* 4 starting rep, 1 pre-aged rye barrel (age 1), 3 Open slots, plus **2 free Specialty Rye** in your starter deck.
- *Permanent ability:* +1 reputation when selling any barrel whose bill has `minRye ≥ 1`.
- *Constraint:* Cannot draft any mash bill with `maxRye: 0` (wheated lane closed).

### Wheated Baron — "The Smooth Operator"
- *Starting state:* 4 starting rep, 1 pre-aged wheated barrel (age 1), 3 Open slots.
- *Permanent ability:* Wheated bills require 1 fewer wheat to complete (floor 0).
- *Constraint:* Cannot commit **any rye card** (Common, Specialty, Heritage) to a barrel. Rye is still legal at the market and in trades.

### Connoisseur Estate — "The Diversified"
- *Starting state:* 6 starting rep, drafts **4 mash bills** at setup — every slot ships Staged.
- *Permanent ability:* When you trigger a Silver award you gain **1 prestige**; when you trigger a Gold award you gain **2 prestige** (every other distillery gains 0 / 1).
- *Constraint:* Slotted-bill cap of 4 — even with Rickhouse Expansion Permit, slots 5/6 are overflow only (transferred barrels, never freshly drafted bills).

---

# 🎲 Player Count Notes

Designed for **2–4 players**.

- **2** — fastest; high variance.
- **3** — sweet spot. Demand pressure is meaningful, ops cards make table moments.
- **4** — fullest experience. Real drama on ops, contested demand track.

**5+ players are not supported** in this build for balance reasons.

---

# 🌐 Multiplayer

Two ways to play, both running the same engine:

- **Solo (`/play`)** — you + 1–3 bots. State lives in your browser.
- **Online (`/multiplayer` + `/play/[code]`)** — 1–4 humans + bots. Server-authoritative (WebSocket Lambda + DynamoDB). Bot turns inline-step server-side; moves animate instantly between human turns.

### Host flow

1. Open `/multiplayer`, pick a name + total human seats (1–4) + bot seats (0–3).
2. **Create room →** mints a 4-character code, seats you as host, routes you to `/play/[code]`.
3. Copy the share link. The waiting room shows the per-seat roster live.
4. **Start game →** flips the room out of pre-game lobby. Setup-phase modals fire on the seat the engine is awaiting; others see "waiting on X". Each player rolls their own demand and ages their own barrels on their own turn.

### Join flow

1. Paste the share link. Name prompt if first time on this device.
2. **Claim** an open seat by clicking it in the roster.
3. **Spectator** mode if you deep-link to a started game with no open seats.

---

# 🔁 The Core Loop

Pick a distillery → draft mash bills directly into your slots → build a starter deck → draw 8 cards a round → commit cards toward a Staged or Building slot → finish the recipe → age it → sell when demand favors you → bank the rep → spend rep (with Labor) to grow the engine → initiate the **Drafting Loop** to refresh your bill lineup and thin your deck → play ops at the right moment → **manage your open slots and your rep balance** → watch the rotation for your bookend → time your endgame.

The mash bill supply is the **doomsday clock**. Every Drafting Loop reveals 3 bills; whatever isn't claimed returns to the deck. Bill claims accelerate the end — slot capacity is the natural throttle.

---

# 🥃 Final Thought

Bourbonomics isn't about making bourbon.

It's about **knowing what to lock up, what to let go, and when the world is ready to pay**.

---

# 📜 Changelog

Version history lives in [`GAME_VERSION.md`](./GAME_VERSION.md) — the
append-only log of every version that's shipped. This file (the
rulebook) describes the **current** game; `GAME_VERSION.md` traces
how it got here.
