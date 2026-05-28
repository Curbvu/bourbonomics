# 🥃 Bourbonomics

A deckbuilding strategy game about building a bourbon empire — one barrel at a time. Recipes take rounds to assemble, demand swings round to round, and the player with the most reputation when the supply runs dry wins.

**Players:** 2–4 · **Length:** ~30–60 min · **Complexity:** Medium

> **Scope (current alpha — "Lines & Bottles").** Distillery selection (4-distillery picker), slot-bound mash bills, incremental production, single-step selling that produces bottles for the new Lines portfolio system, a unified 10-card market (resources + Labor + ops + investments together), trading, doomsday-deck endgame. Reputation is the unified currency for both VP and spending; Labor cards supplement rep on purchases. Generic Labor is finite per player (3 in the starter deck, no central pile, no Hire). Lines & Bottles ship: every sale produces a Bottle that lands on the player's flagship line, a secondary line, or inventory, and the full Line pile scores at game end on top of banked rep. Investment cards ship in the market but their on-buy effects are still effect-pending. Multiplayer is live (host a 4-char-code room from `/multiplayer`).

---

# 🚀 Quick Start

> **Learn by doing.** The home screen has a **Tutorial** tile (a guided walkthrough at `/tutorial`) that hand-holds a fresh player from their first roll through their first sale.

### The 90-second pitch

You run a bourbon distillery. You have a **rickhouse** (4 barrel slots), a **deck** (16 starter cards), and **mash bills** (recipes) that live directly on your slots. Each round:

1. **Draw 8** cards.
2. **Take your turn** — Roll demand → Age every aging barrel → Take actions.
3. **Cleanup.** Discards reset, the start player rotates, next round.

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

The game ends when the **last mash bill leaves the bourbon supply**. Every player then scores their **Lines & Bottles** portfolio on top of banked reputation (flagship Line Board + stacked Line Cards + inventory bottles). Most reputation wins; tiebreakers: most barrels sold, then shared victory. See [§Lines & Bottles](#-lines--bottles).

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
- **Line Cards & flagship boards:** every player is dealt **4 Line Cards** (keep exactly 2) and pre-claims a **flagship Line Board** that defines their portfolio's end-game scoring rule. See [§Lines & Bottles](#-lines--bottles).
- **Demand:** starts at 0.
- Pick a start player.

---

# 🔄 The Round

Three phases per round:

1. **Draw** — each player draws 8 cards. A player who used the **Save slot** last round adds the saved card on top, drawing effectively 9 that round.
2. **Action** — players take full turns in rotated order. Each turn runs as **Roll demand → Age every aging barrel → Take actions**.
3. **Cleanup** — unused resource and Labor cards go to discard; per-round flags reset; **the 10 market cards cycle out to the market discard and 10 fresh cards are dealt from the supply**; start player rotates one seat counter-clockwise.

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
- **Save Card** — set aside one card from hand into your Save slot for next round's draw.
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

### Exact-recipe rule

The total cards on a barrel match the recipe exactly. The engine rejects any commit that would push **corn**, **total grain**, or **cask** past the recipe — no over-committing. Per-grain minimums stay floors; bill-specific caps (`maxRye: 0` on wheated bills) are enforced.

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
8. The bill becomes a **Bottle** that must be placed on one of your **Lines** (or in inventory) before you can take other actions. See [§Lines & Bottles](#-lines--bottles).

The tier floor guarantees every sale clears its baseline build cost — even a Common bill at age 2 / demand 2 pays 3 rep. Higher-rarity bills float higher floors because their build costs are higher (more Specialty cards).

There is no split prompt — the engine resolves the rep total and lands it directly. Bottle placement auto-routes to the flagship when legal; an explicit picker only opens when the choice matters.

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
- **Investments** (long-term effects — *effects pending implementation*)

Mash bills are NOT in this market — they live face-down in the bourbon deck and only surface during the [§Drafting Loop](#draft-mash-bills-the-drafting-loop).

**On every buy or draw, the empty slot refills immediately** from the face-down market supply. Cards in the supply that aren't drawn between rounds aren't lost — they shuffle back when needed.

**At the end of every year (cleanup), the entire 10-card market is replaced.** The current 10 cards go to the market discard; 10 fresh cards are dealt from the supply (reshuffling the discard back in when supply runs low).

## Buy from the Market

Cost is paid in **reputation** and/or **Labor cards** from hand. Rep and Labor are **fully fungible** — any cost can be paid in rep, Labor, or any mix.

- **Cooper** (Specialty Labor) — +2 toward market resource buys.
- **Marketing** (Specialty Labor) — +2 toward ops buys (no help on market resources).
- **Architect** (Specialty Labor) — +2 toward investment buys.
- **Generic Labor** — +1 toward any buy. (You only get 3 in your starter deck — finite.)

Rep can never go below 0.

The purchased card lands directly in your **hand** so you can use it this turn. Any spent Labor cards go to your **discard**. The empty market slot refills from the supply. (End Turn discards everything in hand and redraws — see v3.9 — so a bought card you don't use this turn naturally cycles into your deck at turn end.)

## Buy Operations Card

Same payment model as a resource buy — the engine routes ops targets through a dedicated action because they land in your **operations hand** instead of your discard. Marketing Labor (+2) is the matching specialty.

## Buy Investment

Same payment model. The bought investment lands in your **hand** with a placeholder marker; on-buy effects are not yet wired (every catalog entry ships `implemented: false` in this wave). Architect Labor (+2) is the matching specialty.

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

## Save Card

At any point during your turn, set aside one card from your hand into your **Save slot**. Only resource and Labor cards may be saved.

- Holds at most one card.
- Persists across rounds.
- On the next round's draw, the saved card joins your 8-card hand (so you draw 9 effectively).

Strategic use: keep a Cooper card for the round you plan to buy a Heritage, or save a Specialty Rye for the round you'll commit it.

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

# 🍾 Lines & Bottles

Each barrel you **sell** also produces a **Bottle** — a frozen snapshot of the bill (recipe tags, cask rarity, age, sale demand). Bottles are placed onto **Lines** — your brand portfolio — where they score at game end alongside the per-sale reputation.

> Lines are the long-game scoring track. The reputation you bank from individual sales is your tactical score; your line portfolio is your strategic one. A focused flagship and one or two themed secondaries usually beat a scattered "anything-goes" board.

### Setup: initial Line Card draft

At game start, every player is dealt **4 Line Cards** face-down and must **keep exactly 2** — the picks shape your portfolio direction (rye-heavy, wheated, premium-press, etc.). Discarded cards go to the bottom of the Line Card deck.

The initial draft must be resolved before you can take any other action. The other 2 cards return to the bottom of the Line Card deck.

### The board: flagship + secondaries + inventory

Every player has:

- **1 flagship line** — pre-claimed at setup with a **Line Board** that defines its end-game scoring rule (Volume Series, Depth, Premium Press, etc.). The flagship is the only line you can never delete.
- **Up to 2 secondary lines** — created when you place a bottle "on a new line" during a sale. Each secondary requires you to **stack ≥1 Line Card** onto it from your hand at creation; the stacked cards both gate placement (their `predicate`) AND contribute to scoring.
- **Inventory** — a fallback bucket for bottles that don't fit any line. Each inventory bottle scores a flat **+1 rep** at game end.

### Bottle placement (after every sale)

When you sell, the engine derives the Bottle's profile and then offers you placement targets:

1. **Flagship** — if the flagship's Line Board predicate accepts the bottle, this is usually the right choice. The flagship's score rule fires for the whole pile at end-game.
2. **Existing secondary** — if you have one with a predicate the bottle satisfies.
3. **New secondary** — costs ≥1 Line Card from hand (stacked onto the new line). Caps at 2 secondaries per player.
4. **Inventory** — always legal. Flat +1 rep per bottle, no constraints.

Placement is **mandatory** — you cannot take other actions until the bottle lands. The UI auto-routes to your flagship when legal; the explicit picker only appears when the choice matters.

### Drawing more Line Cards mid-game

Once per round (free action) you may **draw up to 3 Line Cards** off the top of the deck and **keep ≥1**. The unkept cards return to the bottom of the deck. Use this to refresh your hand toward a theme your sales are leaning into.

### Extending a line

The **Extend Line** action lets you stack a Line Card from hand onto **any** of your existing lines (flagship or secondary). Stacked cards add their score rule on top of the Line Board's — every line scores its base rule plus every card stacked on it. Cards never come back off a line.

### End-game scoring

When the bourbon supply runs out, every line scores independently:

- **Flagship + each secondary** — Line Board's `endGameScore` rule + each stacked card's `endGameScore` rule, all summed across the bottles in that line. Unknown defIds (corrupted save) contribute 0.
- **Empty lines with stacked cards** — pay a **−2 rep penalty per stacked card**. (An empty line with no cards is harmless.)
- **Inventory** — +1 rep per bottle, flat.

The total lands on each player's reputation; the winner is whoever has the highest reputation after Line scoring. Tiebreakers: most barrels sold, then shared victory.

### Why this matters

The Line system rewards **planning your sales for placement**. A bottle's recipe tags + cask rarity + age + sale demand are frozen the moment you sell, so trying to retrofit a portfolio late is expensive: empty lines penalize you, and Specialty bottles you needed for a Premium Press secondary can't be unsold.

---

# 🃏 Hand and Deck

Each player draws **8 cards** at the start of round 1 (9 if they saved a card). No max hand size during a turn.

**End Turn = discard + redraw (v3.9).** When a player ends their turn, every resource and Labor card still in hand is sent to discard and the player immediately redraws back up to **8 cards**. The redraw is the last thing that happens on their turn before the cursor passes to the next seat. Operations cards in hand persist across turns and rounds — they are never discarded by End Turn.

There is no second discard at round end. Cleanup runs round-level resets (aging flags, drafting-loop allowance, market refresh, start-player rotation) but leaves each player's hand alone — the v3.9 End-Turn redraw is the source of truth for the next round's starting hand. The round's draw phase still fires for orchestration, but it's a top-up: zero cards drawn when the hand is already at handSize.

The deck contains **resource cards** (cask, corn, grain — premiums come from the market) and **Labor cards** (sweat equity that supplements rep on purchases).

### Card types

- **Resource** — cask, corn, wheat, rye, barley. Needed to make bourbon.
- **Labor** — sweat equity. Generic Labor (+1 anywhere) lives only in the starter deck (3 per player, finite — there is no central Hire pile). Specialty Labor (Cooper +2 toward market resources, Marketing +2 toward ops, Architect +2 toward investments) appears in the unified market and is the only way new Labor enters your deck.
- **Operations** — bought from the unified market. Held in your operations hand; play as a free interruption (one-shot).
- **Investment** — bought from the unified market. Long-term effects; effects are pending implementation in the current alpha.

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

### The full deck

| Card | Cost (rep) | Effect |
|---|:-:|---|
| **Cooper's Contract** | 1 | Pre-play. Next Make Bourbon may use 0 cask. |
| **Cash Out** | 1 | Discard any number of resource cards; gain 1 rep per 2 discarded (round down). |
| **Kentucky Connection** | 1 | Draw 2 cards. |
| **Market Manipulation** | 2 | Move demand ±1. |
| **Glut** | 2 | Demand −2 (floor 0). |
| **Mash Futures** | 2 | Pre-play. Next Make Bourbon grain min −1. |
| **Insider Buyer** | 2 | Discard the entire 10-card market; refill from supply. Your next market buy this turn pays half price (round up, floor 1). |
| **Bottling Run** | 2 | Every player draws 1. |
| **Bourbon Boom** | 3 | Demand +2 (cap 12). |
| **Demand Surge** | 3 | Your next sale this round does not drop demand. |
| **Rushed Shipment** | 3 | Age one of your barrels twice this round. |
| **Forced Cure** | 3 | +1 aging card on a barrel for an extra year. |
| **Allocation** | 3 | Draw up to 2 mash bills free, capped by Open slots. |
| **Rating Boost** | 3 | Pre-play. Next sale +2 reputation. |
| **Regulatory Inspection** | 3 | Target an aging barrel. It cannot be aged this round. |
| **Market Corner** | 3 | Take a face-up market card free into your hand. |
| **Blend** | 4 | Combine two of your own barrels into one. |
| **Barrel Broker** | 4 | Transfer one of your aging barrels to another player's Open slot for a card payment. |
| **Master Distiller** | 5 | Persistent. One barrel reads grid at demand +2. |
| **Rickhouse Expansion Permit** | 5 | Permanently +1 rickhouse slot (max 6). |

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

- **v3.0** — **"Lines & Bottles."** Every sale now produces a **Bottle** (frozen bill snapshot) that must be placed on a **Line** — the player's brand portfolio — or in **inventory**. Each player gets 1 flagship line (pre-claimed Line Board defining the end-game score rule) + up to 2 secondary lines (created on-the-fly by stacking ≥1 Line Card from hand) + inventory (flat +1 rep / bottle). Initial Line Card draft seeded at game init: 4 dealt, **keep 2**. Mid-game **Draw Line Cards** action (once per round, free): reveal up to 3, keep ≥1. **Extend Line** action stacks a Line Card onto any existing line for additional score rules. Final score adds the full Lines pile on top of banked rep: flagship board + every stacked card's `endGameScore` rule + inventory. Empty lines with stacked cards pay **−2 rep per card** (the only Line scoring penalty). 25 base-game Line Card definitions covering recipe themes (rye / wheated / pure-corn / triple-grain / heritage-recipe), cask rarity (heritage-cask / specialty-cask / common-cask), age band, market demand, and volume/breadth axes. New engine actions: CHOOSE_INITIAL_LINE_CARDS, DRAW_LINE_CARDS, KEEP_LINE_CARDS, EXTEND_LINE, PLACE_BOTTLE; new gate flags on player state (pendingInitialLineCardDraft, pendingLineCardDraw, pendingBottlePlacement) the engine's validateAction enforces so the resolution can't be skipped.

- **v2.15** — **"Prestige."** Gold Convert/Keep/Decline collapsed into a single outcome: take the rep, **retire the bill** (removed from the game entirely, not just discarded), gain **1 prestige point**. Silver simplified to a one-shot bonus — bill goes to discard, slot opens (no more "stays Staged"). New permanent **prestige counter** on every player; each point adds +1 rep to every future Silver- or Gold-triggering sale (base sales unaffected). Connoisseur Estate reworked as the prestige specialist: +1 extra prestige on Silver (now 1) and +1 extra on Gold (now 2). The Open-slot Convert ability is retired. Bot scoring rewired around prestige acquisition: Gold-eligible bills are valued higher at draft time and selling now factors in both prestige earned and the prestige already on the player's track. New `retiredBills` array on game state tracks the graveyard of past Gold sales for UI presentation. Retiring Gold bills accelerates the final-round trigger (the bourbon supply runs out faster) — intended.

- **v2.14.2** — **"Human Picks First."** Setup-pick order changed: humans pick before any bots in distillery selection and the starter trade window. Reverse-snake is preserved within the human group AND within the bot group, so an all-human room still resolves to the original `[last seat, …, first seat]` order. The fix targets solo: with the bot's preference list (Connoisseur > Vanilla > High-Rye > Wheated) and reverse-snake across the whole seating, the human at seat 0 always picked last and bots routinely stripped Vanilla (the level-playing-field baseline) from the pool. Vanilla is now reliably available to the human in solo.

- **v2.14.1** — **"Locked Starter Composition."** Starter-pool dealing is no longer a global shuffle across `(numPlayers × 16) + buffer` cards — every player now receives the canonical PER_PLAYER block (6 cask + 4 corn + 1 rye + 1 barley + 1 wheat + 3 Generic Labor) shuffled internally for draw-order variance. Previously a single global shuffle could hand one player 6 Generic Labor and another zero; the trade window's 1-for-1 swaps couldn't close that swing. Composition is now locked per seat; the shared buffer still backs the stuck-hand safety valve. Regression test pins the exact tally on every dealt hand.

- **v2.14** — **"The Drafting Loop" + "Smoother Starter."**

  **The Drafting Loop.** Bill acquisition is rebuilt from the ground up as a table event. The face-up bill row is retired. The blind bill draw (1 rep) is retired. The flat rep cost on face-up bills (1/1/2/3/4) is retired. Bills are now acquired exclusively through the **Drafting Loop**: the active player places one card from hand on the table and reveals 3 bills from the deck; they take 0–N bills (limited by Open slots) by adding one card to the pile per bill; the pile then passes left, with each subsequent player able to take cards from the pile freely AND/OR take remaining bills at a cost of 1 card each. When the pile returns to the initiator, leftover bills shuffle back into the deck and leftover cards go to the market discard. **Bills now cost no rep — only cards.** This restores deck thinning to the game (retired in v2.11 with Trash a Card), reintroduces meaningful player-to-player card transfer outside of Trade, and turns bill drafting into a social moment. The action is limited to **once per round per player** and is illegal in the final round. Distillery constraints apply (High-Rye House skips wheated bills; Connoisseur Estate respects its 4-bill cap). Specialty Labor for bill draws (the future "Distiller" worker) is no longer reserved space — it's obsolete under the cards-only economy.

  **Smoother Starter.** Starter Generic Labor bumped from 2 to 3 (cut one rye to keep the deck at 16; grain mix is now symmetric at 1 rye / 1 barley / 1 wheat). The round-1 Labor rig is gone — round 1 now draws 8 random cards like every other round. Labor doesn't carry over between rounds, so the bump-not-rig approach better solves what the rig was patching: at 2 Labor the zero-Labor-round rate was ~27%, leaving the rep-supplement sub-economy offline too often; at 3 Labor it drops to ~11% with expected Labor/round rising from 1.0 to 1.5.

- **v2.13** — **"Unified Market."** The three face-up rows (resource conveyor, ops face-up, investments display-stub) collapsed into a single 10-card market alongside the separate mash-bills column. All non-bill card types (resource / Labor / ops / investment) share one supply deck and one discard; each buy refills the empty slot immediately, and at end of every year all 10 cards cycle out and 10 fresh cards are dealt. Capital cards eradicated from the codebase end-to-end — the type member, factories, `capitalValue` field, distillery `capitalDelta` field, and every UI render branch are gone. Architect Labor (+2 toward investment buys) ships in the market alongside Cooper and Marketing; Generic Labor no longer appears in the market (your 2 starter-deck Labor are all you'll ever own). Every player's round-1 opening hand is guaranteed to contain both Generic Labor cards (deck is rigged at init so the 2 Labors sit on top). Investment effects are still effect-pending — buying transfers them to discard with a placeholder marker.

- **v2.12** — **"Labor Scarcity."** Generic Labor is now finite per player: starter deck holds **2** Generic Labor and there is no central Hire pile or HIRE action — new Labor only enters a deck via Specialty Labor (Cooper, Marketing, future Architect) bought from the market. The spending anchor rule (≥$2 buys require ≥1 rep paid) is gone: rep and Labor are fully fungible — any cost can be paid in rep, Labor, or any mix. PurchaseFlight animation tightened from 850ms → 650ms. Tutorial restructured to four chapters: Make → Hire (new) → Age → Sell, and the tutorial deck no longer contains any Capital cards. Game shell auto-scales to fit any desktop down to 1280×720 via CSS transform-scale, so the HandTray no longer falls off the bottom of shorter viewports. Escape now cancels any open picker overlay.

- **v2.11** — **"Three Bands · Unified Rep"** — a two-part economic redesign that ships in one alpha:

  **Three Bands, One Unit** (resource economy)
  - **2-unit cards eliminated.** Every card is now 1 unit. The Double Specialty band (2-unit $6 cards) is renamed **Heritage** and shipped at 1 unit, $3, with cards minted for all five subtypes (cask, corn, rye, barley, wheat). The plain Double band was retired in v2.10; v2.11 finishes the job.
  - **Cost ladder compressed.** Common $1 / Specialty $2 / Heritage $3 — the old $1 / $3 / $6 ladder shortens to three single-step bands.
  - **Uniform Specialty +1 rep on sale retired.** Specialty cards no longer pay a flat band-wide sale bonus. Heritage cards each carry a reserved `effect` hook for per-card bonuses (no Heritage card ships a populated bonus in v2.11). Distillery-driven sale modifiers (High-Rye House's +1 rep on rye bills) ride a separate code path and are unaffected.
  - **Mash bill specialty-gate ramp retuned.** Uncommons gain light specialty pressure (≤1 grain slot gated). Rares span 1–2 entries. Epics fully gate cask + every named-grain subtype in the recipe. Legendary High Rickhouse Select broadens to 5 entries / 6 specialty units total — more than any epic on both axes.
  - **`mashBillBuildCost` recalibrated.** `SPECIALTY_UNIT_COST` drops from 4 to 2 (market cost only, no sale-bonus premium). The Bourbon Wiki "build N" pill now reads accurately.

  **Unified Rep & Sweat Equity** (currency / spending economy)
  - **Capital cards retired entirely.** No capital in starter decks, the market, or game state. Reputation is now the single unified currency for both victory points and spending power. Every purchase is a real victory cost.
  - **Reputation track is the wallet AND the score.** Spent on market buys, ops card buys, and mash bill draws. Rep can never go below 0.
  - **Sale floors by tier.** Every sale pays at least the tier floor: 3 rep for Tier 1 (Common/Uncommon), 4 for Tier 2 (Rare), 5 for Tier 3 (Epic/Legendary). Guarantees every sale clears its base build cost; encourages playing the production loop.
  - **No split prompt on Sell.** Single-step sale — engine resolves grid + bonuses + tier floor and lands the total on the rep track. The v2.10 Gold-only purchasing-power rule is retired.
  - **Labor cards — new card type.**
    - **Generic Labor** ($1, 4 in the starter deck, lives in the central Hire pile) — +1 toward any purchase. Also legal as an aging-commit card.
    - **Specialty Labor** — domain specialists (rare market drops):
      - **Cooper** ($4) — +2 toward market resource buys.
      - **Marketing** ($4) — +2 toward ops card buys.
      - **Architect** ($4) — +2 toward investment buys. *Reserved for v2.12 when investments ship.*
  - **Spending anchor rule.** Purchases costing ≥ 2 require ≥ 1 rep paid (Labor cannot fully cover ≥$2 buys). $1 buys may be paid with 1 Labor and 0 rep. Applies uniformly to market buys, ops buys, AND bill draws.
  - **Hire action.** Once per turn, free: take 1 Generic Labor from the central pile into your discard. Pile is finite (~5 per player).
  - **Save slot.** Each player has one Save slot. At any point during your turn, set aside one card from your hand. It joins next round's draw on top of the 8-card deal.
  - **Starting rep by distillery.** Vanilla 5, High-Rye House 4, Wheated Baron 4, Connoisseur Estate 6.
  - **Bill cost ladder.** Face-up bills cost rep by rarity tier — common/uncommon 1, rare 2, epic 3, legendary 4. Blind draws cost 1 rep. Bill draws follow the same rep + Labor rules as the rest of the economy; Generic Labor (+1 anywhere) supplements rep, while Specialty Labor for bill draws (a future "Distiller" worker) is reserved space.
  - **Ops card cost rebalance.** Every cost dropped under unified rep (rep is precious). New ladder caps at 5 — Master Distiller and Rickhouse Expansion Permit at the top, Cooper's Contract and Cash Out at the floor.
  - **Cash Out reworked.** "Discard any number of resource cards; gain 1 rep per 2 discarded (round down)" — the internal-economy "convert spare cards to rep" valve.
  - **Trash a Card action removed.** Top-level Trash a Card is gone. Failed Batch (Make Bourbon sub-option) is also removed. Both were marginal under the new economy.
  - **Bot AI overhaul.** Bot heuristics rewritten for the unified-rep economy: Hire each turn, prioritize bill draws when no in-progress barrel + bills available, reserve rep for bill draws over cheap buys, pay with Labor first then rep, simplified single-step sales.

- **v2.10** — **"Identity & Economy."** Distilleries re-enabled (4-distillery roster). Sell action no longer costs a card. Round-gap rule (a barrel completed in round N first sells in round N+1). Resource bands reduced from four to three (plain Double tier retired). Exact-recipe rule introduced (over-committing rejected). Specialty-cask exclusivity. Specialties backwards-compatible with subtype mins.
- **v2.9** — **Per-turn demand rolls + mandatory per-turn aging.** Demand is no longer a once-per-round global ceremony — each player rolls at the top of their own turn. The dedicated Age phase is gone; after rolling demand, the active player must commit one card to every eligible aging barrel before taking other actions. Tutorial mode added at `/tutorial`.
- **v2.8** — **Online multiplayer.** Composition Buffs removed entirely. Reward grids are now monotonic (no backward steps).
- **v2.7.x** — Specialty gates + rarity-ramped recipes. Make Bourbon per-slot turn cap removed. Mash bill catalog recalibrated into three difficulty/payoff tiers. Bourbon Cards gallery added. Resource card economy collapsed to four pricing bands (then to three in v2.10).
- **v2.6** — **Slot-Bound Mash Bills.** Bills no longer enter the hand — they live on slots from draw to sale. 4-phase slot lifecycle: Open → Staged → Building → Aging. Silver award reworked to "bill stays in slot." Gold reworked to Convert / Keep / Decline.
- **v2.5** — **Incremental Mash Commitment.** Barrels built across multiple turns. Trading flatly illegal in the final round.
- **v2.4 and earlier** — Composition Buffs (later removed in v2.8). Random-deal starter pool + trade window + stuck-hand swap. Distillery cards as full asymmetric packages. Operations cards added (v2.1).
