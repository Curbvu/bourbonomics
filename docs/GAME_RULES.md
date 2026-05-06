# 🥃 Bourbonomics

A deckbuilding strategy game about building a bourbon empire — one barrel at a time. Recipes take rounds to assemble, demand swings round to round, and the player with the most reputation when the supply runs dry wins.

**Players:** 2–4 · **Length:** ~30–60 min · **Complexity:** Medium

> **Scope (v2.7 alpha).** Drafting, the round loop, incremental production, aging, selling, market (4-band economy), operations cards, trading, doomsday-deck endgame. **Distillery selection is temporarily disabled** — every game runs as Vanilla. Investment cards are sketched in [`PLANNED_MECHANICS.md`](PLANNED_MECHANICS.md) and not yet live. Computer-only build today; human-controlled slots ship alongside the UI work.

---

# 🚀 Quick Start

For the impatient. Read once, play once, the rest of the rulebook will make sense.

### The 90-second pitch

You run a bourbon distillery. You have a **rickhouse** (4 barrel slots), a **deck** (16 starter cards), and a **mash bill** or three (recipes). Each round:

1. **Demand rolls.** A shared market gauge ticks up or holds.
2. **Draw 8** cards from your deck.
3. **Age** any aging barrels you own (one card per barrel, face-down on top).
4. **Take your turn.** Make bourbon, sell bourbon, buy from the market, etc. — full turn, not one-action-per-round.
5. **Cleanup.** Discards reset, the start player rotates, next round.

### The core loop

- **Make bourbon** by committing cards (cask + corn + grain) to a barrel and attaching a mash bill. Recipes take **multiple turns** to assemble — you commit what you have now and finish the recipe later.
- A barrel becomes **aging** the moment its recipe is satisfied. From the next round on, you can place 1 aging card per round on top of it.
- **Sell** an aging barrel (age ≥ 2) and read its mash bill's grid against your barrel's age and the current demand. The grid value becomes reputation, purchasing power, or both.
- **Buy** new cards from the 10-card market conveyor with cards from your hand (capital cards pay their face value; any other card pays 1).

### Winning

The game ends when the **last mash bill leaves the bourbon supply**. Most reputation wins; ties broken by barrels sold.

---

# 🏆 Winning the Game

The game ends when the **bourbon supply** is exhausted — both the deck AND the face-up mash bill row are empty. Drawing or acquiring the final mash bill triggers the **final round**: every player completes the round and scoring happens immediately after.

**Most reputation wins.** Tiebreakers, in order: (1) most barrels sold, (2) shared victory.

The final round is the high-drama round — players race to liquidate aged barrels and time sales against demand. Cards committed to barrels that don't sell in the final round are lost; there is no next round to bail them out.

---

# 🎬 Setup

### Step 1 — Distillery selection (temporarily disabled in v2.7)

Distillery profiles are temporarily disabled in this build. All players use the **Vanilla** setup: 4 Open slots, no pre-aged barrels, no asymmetric ability or constraint. The full roster (High-Rye House, Wheated Baron, Connoisseur Estate, plus future distilleries) will return in a later release. See [§Distillery Profiles](#distillery-profiles) for the legacy reference.

### Step 2 — Mash bill draft

Each player drafts **3 mash bills** from a shared pool (snake draft recommended). These are your starting recipes. More can be drawn during play.

### Step 3 — Starter hand

Build the starter pool: per player, 6 cask · 4 corn · 4 grain (2 rye / 1 barley / 1 wheat) · 2 capital. Shuffle and **deal 16 cards face-up** to each player.

**Trade window — 3 minutes.** Players negotiate **1-for-1 trades** with anyone, in any order. Trades are public and require both sides to agree. Each trade is exactly one card per side; multi-card swaps are run as multiple trades.

**Stuck-hand swap.** Once during the trade window, a player may return up to 3 cards to the pool and draw the same number off the top. One-shot per player per game.

When the timer expires (or every player has signaled "pass"), shuffle your final 16 cards into your starter deck. Premium variants — Doubles, Specialties, and Double Specialties — only enter via the market.

### Step 4 — First hand

Each player shuffles and **draws 8 cards** as their opening hand.

### Step 5 — Board setup

- **Market conveyor:** 10 cards face-up from the market supply.
- **Operations market:** 3 face-up ops cards beside the ops deck. Players begin with an empty operations hand.
- **Bourbon deck:** mash bills face-down, with 3 face-up beside the deck.
- **Demand track:** start at 0.
- **Reputation:** 0 for everyone.
- Pick a start player. Rotation is one seat counter-clockwise after each round.

---

# 🔄 The Round

Five phases per round:

1. **Demand** — roll 2d6. If higher than current demand, demand +1.
2. **Draw** — each player draws 8 cards.
3. **Age** — each player may place a card on top of any of their **aging barrels** (one per barrel per round).
4. **Action** — players take full turns in the rotated order. See [§Action Phase](#-phase-4-action-phase).
5. **Cleanup** — unused resource and capital cards go to discard; per-round flags reset; start player rotates one seat counter-clockwise.

**Operations cards persist** — they're not discarded at end of round.

---

# 🎴 Turn Order and the Bookend

The first player rotates each round. The player who went **last** in round N goes **first** in round N+1.

For 4 players seated 1-2-3-4: rounds run 1234 → 4123 → 3412 → 2341 → 1234.

**The bookend.** Going last-then-first across a round boundary lets you act with full information at the end of round N and again with a fresh hand at the start of round N+1. It's a deliberate feature of the design — every player gets it equally over an N-player game. Operations cards held across rounds amplify this; demand-boosting ops in particular.

---

# 🎲 Phase 1 — Demand

Roll **2d6**. If the result is **greater than** current demand, demand **rises by 1** (cap 12). Otherwise it holds.

This is the only natural rise. Demand **falls by 1** for each barrel sold (floor 0). Some ops cards move it directly.

The bell curve of 2d6 means demand drifts toward the middle, with rare booms and crashes.

---

# 🎴 Phase 2 — Draw

Each player draws **8 cards** from their resource deck. Reshuffle the discard if the deck runs out.

Operations cards are NOT auto-drawn — they're bought from the ops market.

---

# 🛢️ Phase 3 — Age

For each of your **aging barrels**, you may place one face-down card from your hand on top to advance its age by 1 year. Aging is optional but it's the primary path to reputation — most bourbons need years to pay out well.

**Construction barrels do not age.** They're skipped until they finish construction. See [§Make Bourbon](#make-bourbon).

A barrel may only age **once per round** unless an ops card explicitly grants more.

When the barrel sells, all aging cards go to the player's discard.

---

# 🎯 Phase 4 — Action Phase

Each player takes their **full turn** in rotated order. On your turn you take as many actions as you want — production, sales, market buys, mash bill draws, trades, abandons — until you voluntarily end your turn (or run out of legal plays). Then play passes.

**Operations cards** play as a **free interruption** at any point during your turn. They don't consume an action; each ops card is one-shot.

**Voluntarily ending your turn is final** — you don't act again until the next round. Cards in your hand stay there until cleanup.

Plan during others' turns. Target pace: ~3 minutes per round at 4 players.

### Available Actions

- **Make Bourbon** — commit cards to (or open) a barrel.
- **Sell Bourbon** — sell an aging barrel ≥ 2 years old.
- **Buy from the Market** — spend cards to acquire a market card.
- **Buy Operations Card** — same, but for the ops market.
- **Draw a Mash Bill** — spend cards to take a face-up bill or blind-draw.
- **Trade** — exchange cards with another player.
- **Abandon Barrel** — discard an under-construction barrel.
- **Trash a Card** — permanently remove a card from your deck.
- **End Turn** — voluntary; cards remaining in hand stay there until cleanup.

---

## Make Bourbon

> **v2.5: Incremental Mash Commitment.** A barrel is built across multiple turns. You commit cards a few at a time, attach a mash bill once, and the barrel auto-finishes the moment your committed pile satisfies the recipe.

A barrel has two phases:

- **Construction** — recipe not yet satisfied. The barrel does NOT age. You may keep committing cards on later turns.
- **Aging** — recipe satisfied. The barrel is locked in and ages from the round AFTER it completed.

### The action

`Make Bourbon` opens a new barrel in an empty slot, OR commits more cards to one of your existing under-construction barrels. Each Make Bourbon action does at least one of:

- Commit one or more cards from your hand to the barrel, **and/or**
- Attach a mash bill from your hand to the barrel (only allowed once per barrel — the bill is locked once attached).

**No per-slot limit.** You can Make Bourbon to any of your Ready or Construction slots as many times as you want on a single turn. Each commit is its own action; the recipe-completion check fires after every commit, so a slot can transition Ready → Construction → Aging across multiple commits in one turn.

Committed cards (resource OR capital) are **locked with the barrel** — they don't go to discard until the barrel sells or is abandoned.

### Recipe satisfaction

A barrel **completes** (transitions to aging) the moment its committed pile satisfies BOTH:

1. **Universal rule:** exactly 1 cask + ≥1 corn + ≥1 grain.
2. **The attached bill's recipe** (if any), e.g. "rye ≥ 3" for a high-rye bill.

A barrel **cannot complete without an attached mash bill**, even if the universal rule is otherwise met.

### Timing

- Completion check fires at the end of the action that placed the satisfying card.
- A barrel completed in **round N first ages in round N+1** — completion doesn't grant a free aging round. This preserves the temporal cost of a slow build.

### Per-bill recipes

Recipes only ever **tighten** the universal rule, never loosen it. Examples:
- High-rye — `rye ≥ 3`
- Wheated — `wheat ≥ 1, no rye`
- Four-grain — `barley ≥ 1, rye ≥ 1, wheat ≥ 1`

Bills without a printed recipe accept any legal mash. Recipes are public information once the bill is in play.

### Failed Batch (optional, opening only)

When you OPEN a new barrel via Make Bourbon, you may also discard one extra card from your hand and **trash** it. One of two ways to thin your deck (see [§Trashing Cards](#-trashing-cards)). Not available on subsequent commits to the same barrel.

---

## Abandon Barrel

Discard one of your **under-construction** barrels. All committed cards return to your discard pile; the slot frees up. The attached mash bill (if any) goes to the bourbon discard.

**Aging-phase barrels cannot be abandoned** — once a barrel finishes construction it can only leave via Sell Bourbon.

---

## Sell Bourbon

Sell any of your **aging** barrels that is **at least 2 years old**.

Read the attached mash bill's grid using `(barrel age, current demand)` to get N. Apply [§Composition Buffs](#-composition-buffs) — buffs may shift the grid lookup or stack flat reputation/purchasing power on top.

Allocate N across two outcomes (any combination summing to ≤ N):
- **Reputation** — advance your reputation track.
- **Purchasing power** — spend immediately on market buys following normal costs.

Any unspent N becomes reputation. Purchased cards go to discard. Purchasing power can't be saved across turns and can't chain into another sale.

After the sale:
- Demand falls by 1 (floor 0).
- Mash bill discards (unless an award returns it — see [§Bourbon Awards](#-bourbon-awards)).
- All cards under the barrel return to your discard.
- The barrel is removed; the slot frees up.

---

## Buy from the Market

Spend cards from your hand totaling at least the **cost** of a card on the **market conveyor** (10 face-up cards). **Capital cards pay their printed value; any other card pays 1.** Resource and capital cards may be mixed in one purchase.

Both the spent and purchased cards go to your discard. The empty conveyor slot refills from the supply.

One purchase at a time. No carryover — overpaying loses the excess.

## Buy Operations Card

Spend cards from your hand totaling the cost of a card from the **operations market** (3 face-up). Same payment rule as the market: capital pays its value, others pay 1. The bought ops card goes to your **operations hand**.

You may also blind-draw the top of the ops deck by paying any 1 card.

## Draw a Mash Bill

Three mash bills sit face-up beside the bourbon deck. Take one of:

- **A face-up bill** — pay its printed cost. Capital pays printed value; others pay 1. Refill the row from the deck.
- **The blind top** — pay any 1 card.

When the deck **and** face-up row are both empty, the **final round trigger** activates.

## Trade

Two players exchange cards by mutual consent. Each side must offer at least one card. **Traded cards land in the recipient's discard pile** (not their hand). Trade is one of the active player's actions but does NOT end your turn.

Informal agreements (deferred trades, rickhouse leases) ride on Trade — they're not enforced by the rules.

**Trading is illegal during the final round.**

## Trash a Card

Spend 1 card from your hand to permanently remove 1 other card from your hand. The trashed card is removed from the game; the spent card goes to discard. (Failed Batch on Make Bourbon is the second way to trash.)

## End Turn

Voluntary. Cards remaining in your hand stay until cleanup, when resource and capital cards discard. Operations cards persist. You don't act again until next round.

---

# 🏚️ The Rickhouse

Each player owns their rickhouse outright — printed on the distillery card. **4 slots** by default, equivalent. No shared barrel space.

A slot can hold one of:
- An **under-construction barrel** (recipe partial, not aging, can still receive commits).
- An **aging barrel** (recipe satisfied, accepts one aging card per round).

When **your** rickhouse is full you cannot Make Bourbon to a new slot — you have to sell, abandon, or commit to an existing under-construction barrel first.

The Rickhouse Expansion Permit ops card raises capacity to a maximum of **6**.

---

# 📜 Mash Bills

Recipes that determine each barrel's reward grid. Players draft 3 at game start; more can be drawn during play.

Mash bills attach to a barrel **at any commit** during construction — once attached, locked for the barrel's lifetime and public. A barrel cannot complete without one.

When a barrel sells, the attached mash bill discards (unless an award says otherwise — see [§Bourbon Awards](#-bourbon-awards)).

A player with no mash bills in hand cannot finish a barrel; they may Draw a Mash Bill as an action to acquire one.

---

# 🃏 Hand and Deck

Each player draws **8 cards** at the start of every round. No max hand size during a turn (mid-sale draws can temporarily expand). At cleanup, all unused resource and capital cards in hand discard. Operations cards persist.

The deck contains **resource cards** (cask, corn, grain — premium variants like 2-rye come from the market) and **capital cards** (face-value currency).

Decks grow through market purchases. The effective working deck shrinks as cards lock onto aging barrels — those cards are unavailable until sale.

### Card types

- **Resource** — cask, corn, wheat, rye, barley. Needed to make bourbon. Premium variants count for more units.
- **Capital** — currency. The printed value is its **payment value** when buying market cards, ops cards, or mash bills. In every other context (production, trading, aging) a capital card counts as 1.
- **Operations** — bought from the face-up ops market. Played as a free action during the action phase. One-shot unless stated otherwise.

### Card Bands (v2.7)

Resource cards in the market sort into four pricing bands. Doubles count as 2 units toward both recipes and composition buffs. Specialties carry a uniform luxury bonus — **+1 reputation when the barrel sells**, for each Specialty (or Double Specialty) committed to it. Capital cards collapse onto a $1 / $3 / $5 ladder; cost equals face value across the board.

| Band | Cost | Units | On sale |
|---|:-:|:-:|---|
| **Common** (cask, corn, rye, wheat, barley) | $1 | 1 | — |
| **Double** (double cask / corn / rye / wheat / barley) | $3 | 2 | — |
| **Specialty** (superior cask / corn / rye / wheat / barley) | $3 | 1 | +1 reputation |
| **Double Specialty** (double superior cask / rye / wheat) | $6 | 2 | +1 reputation |

Premium variants — Doubles, Specialties, and Double Specialties — only enter play via the market. Composition-buff thresholds count Doubles and Double Specialties at their full unit value (a Double Rye contributes 2 toward the rye threshold and 2 toward the "3+ single grain" buff).

---

# 🧪 Composition Buffs

When a barrel sells, examine **everything** committed to it (production cards + aging cards). Each composition threshold met grants a buff. Buffs stack with each other and with the grid reward.

| Threshold | Buff |
|---|---|
| 3+ cask cards committed | +1 reputation |
| 3+ corn cards committed | +1 purchasing power |
| 3+ of a single grain (rye / wheat / barley) | Read demand as +1 for this sale's grid lookup |
| 2+ capital cards committed | Demand does not drop from this sale |
| All four grain types present (rye / wheat / barley / corn) | +2 reputation |

Demand-band buffs apply **before** the grid lookup; flat reputation and purchasing-power buffs apply **after**, on top of N. Skip-demand-drop overrides the normal post-sale demand drop.

**Premium resources count by full unit value.** A Double Rye counts as 2 toward the rye threshold and a Double Specialty Wheat counts as 2 toward the wheat threshold. Specialties (1 unit) count as 1; the Specialty bonus (+1 reputation on sale) is separate from composition buffs and stacks on top. Capital cards count as 1 each toward the 2+ capital threshold regardless of printed face value.

Composition is calculated **at sale time only**. Awards (Silver/Gold) read the grid value as printed plus persistent barrel offsets — buffs don't change award eligibility.

---

# 🥇 Bourbon Awards

Some mash bills grant special awards on sale.

- **Silver — Bill returns to hand.** The bill goes back to the player's hand instead of discard.
- **Gold — Permanent recipe.** The bill is removed from circulation and placed face-up in front of the player. The unlocked Gold recipe may be applied as a free option at sale on any future barrel, providing its reward instead of the attached bill's. The attached bill discards normally.

Gold takes precedence if both qualify. Gold awards do NOT trigger the final round — only the bourbon supply running out does.

---

# 📊 Market Demand

Range **0–12**, starting at 0.

- **Rises by 1** if the start-of-round 2d6 roll exceeds current demand.
- **Falls by 1** for each barrel sold (floor 0), unless skipped by an effect.
- **Moved directly** by some ops cards (Market Manipulation, Bourbon Boom, Glut).

Each mash bill defines its own demand bands — some pay better at low demand, others demand a hot market. Reading bands before attaching the bill is part of the game.

---

# 📈 Mash Bill Pricing

Every bill prints a grid keyed on age and demand. To resolve a sale:

1. Find the highest age threshold ≤ the barrel's age — that's the row.
2. Find the highest demand threshold ≤ current demand — that's the column.
3. The cell is the reputation reward (N).

Every legal sale pays at least 1 rep.

### Example — Backroad Batch (workhorse bill)

`ageBands: [2, 4, 6]`, `demandBands: [2, 4, 6]`

| Age \ Demand | 2–3 | 4–5 | 6+ |
|---|:-:|:-:|:-:|
| 2–3 | 1 | 2 | 3 |
| 4–5 | 2 | 4 | 5 |
| 6+ | 3 | 5 | 6 |

A 5-year barrel at demand 7 pays **5** reputation, allocatable across the rep track and purchasing power.

---

# 🃏 Trashing Cards

Two ways to permanently remove a card from your deck:

- **Trash a Card** action — spend 1 to trash 1.
- **Failed Batch** — when opening a barrel via Make Bourbon, you may also discard and trash one extra card.

Trashed cards leave the game; they don't return to deck, discard, or any zone.

---

# 🃏 Operations Cards

Operations cards represent market moves, regulatory events, competitive pressure, and moments of opportunism.

- Bought from the face-up **operations market** (3 face-up). Empty slot refills from the top of the deck after each purchase.
- Held in a separate **operations hand** with no size limit.
- Played as a **free interruption** during your turn — does NOT consume an action.
- **One-shot** unless the card states otherwise; discarded after play.
- **Not tradeable.**
- **Not playable during the final round** — except those already in your hand before the final round began.

### Selected ops cards

These are representative — the full deck is defined in `packages/engine/content/operations.yaml`.

| Card | Cost | Effect |
|---|:-:|---|
| **Market Manipulation** | 3 | Move demand up or down by 1. |
| **Bourbon Boom** | 4 | Demand +2 (cap 12). |
| **Glut** | 3 | Demand −2 (floor 0). |
| **Demand Surge** | 4 | Your next sale this round does not drop demand. |
| **Rushed Shipment** | 4 | Age one of your barrels twice this round. |
| **Forced Cure** | 4 | Place an extra aging card on a barrel for one extra year. |
| **Mash Futures** | 3 | Pre-play. Your next Make Bourbon's grain min relaxes by 1. |
| **Cooper's Contract** | 2 | Pre-play. Your next Make Bourbon may use 0 cask. |
| **Market Corner** | 5 | Take a face-up market card free into your hand. |
| **Insider Buyer** | 3 | Discard the conveyor and refill from supply. |
| **Kentucky Connection** | 2 | Draw 2 cards. |
| **Bottling Run** | 3 | Every player draws 1. |
| **Cash Out** | 1 | Discard your resource cards; gain that many $1 capitals in discard. |
| **Allocation** | 4 | Draw 2 mash bills free. |
| **Regulatory Inspection** | 5 | Target an aging barrel. It cannot be aged this round. |
| **Barrel Broker** | 6 | Transfer one of your aging barrels to another player's empty slot for a card payment. |
| **Blend** | 6 | Combine two of your aging barrels — higher age, higher-value bill, all cards. |
| **Rating Boost** | 4 | Pre-play. Your next sale gains +2 reputation. |
| **Master Distiller** | 6 | Choose one of your aging barrels — for the rest of the game it reads its grid as if demand were +2. |
| **Rickhouse Expansion Permit** | 6 | Permanently +1 rickhouse slot (max 6). |

---

# 🏛️ Distillery Profiles

> **v2.7: temporarily disabled.** Distillery profiles are not active in this build. Every player uses the **Vanilla** setup (4 Open slots, no pre-aged barrels, no asymmetric ability or constraint). The full roster — High-Rye House, Wheated Baron, Connoisseur Estate, plus future distilleries — will return in a later release. The reference text below is preserved so the engine and documentation stay in sync the moment the flag flips back on.

Each distillery is a full asymmetric package: a **starting state**, a **permanent ability**, and a **constraint**.

### High-Rye House — "The Specialist"
- *Starting state:* 1 pre-aged barrel (age 1, basic high-rye bill). Starter hand gets 2 free 2-rye premium cards.
- *Permanent ability:* +1 reputation when selling any high-rye bill.
- *Constraint:* Wheat counts as 0 toward your composition-buff thresholds.

### Wheated Baron — "The Smooth Operator"
- *Starting state:* 1 pre-aged barrel (age 1, basic wheated bill).
- *Permanent ability:* Wheated bills cost 1 fewer wheat to complete (floor 0). Your "3+ single grain" composition buff fires at **2+** instead of 3+.
- *Constraint:* Rye counts as 0 toward your composition-buff thresholds.

### Connoisseur Estate — "The Diversified"
- *Starting state:* Draft 4 mash bills during setup instead of 3.
- *Permanent ability:* Your "all four grain types" composition buff fires at **3 of 4** distinct grains and grants **+3 reputation** (instead of +2).
- *Constraint:* Maximum mash-bill hand size is 4.

### Vanilla Distillery — "The Symmetric Option"
No starting state, no permanent ability, no constraint. Choose this for a level playing field or an introductory game.

> **Roster note (v2.5).** Three earlier distilleries — Warehouse, Old-Line, and The Broker — were retired. The first two carried abilities the v2.2 flat-rickhouse cleanup had already neutralised; The Broker hinged on a final-round trading carve-out that asked the rules to bend for one card. They will return when each one earns a real, engine-supported ability.

---

# 🎲 Player Count Notes

Designed and balanced for **2–4 players**.

- **2 players** — fastest; high variance. Demand swings dramatically with fewer sales to anchor it. Tactical play over long-arc planning.
- **3 players** — the sweet spot. Demand pressure is meaningful, ops cards make table moments, doomsday clock paces well.
- **4 players** — fullest experience. Real drama on ops, contested demand track, the most chaotic final rounds.

v2.7 runs every game as Vanilla while the distillery roster is disabled, so player-count notes about distillery seating no longer apply. **5+ players are not supported** in this build for balance reasons.

---

# 🔁 The Core Loop

Pick a distillery → draft mash bills → build a starter deck → draw 8 cards a round → commit cards toward a barrel → finish the recipe → age it → sell when demand favors you → take rep, cards, or both → buy more → play ops at the right moment → manage your slots → watch the rotation for your bookend → time your endgame.

The mash bill supply is the **doomsday clock**. Drawing mash bills accelerates the end.

---

# 🥃 Final Thought

Bourbonomics isn't about making bourbon.

It's about **knowing what to lock up, what to let go, and when the world is ready to pay**.

---

# 📜 Changelog

- **v2.7** — **Make Bourbon per-slot turn cap removed** (a player can now commit to the same slot as many times as they want on a single turn; recipe-completion fires after every commit). **Mash bill catalog recalibrated** into three difficulty/payoff tiers (Tier 1 starter / Tier 2 mid / Tier 3 specialty) with peak rewards and Gold awards scaled per tier. **Distillery profiles temporarily disabled** behind a `DISTILLERIES_ENABLED` feature flag — every game runs as Vanilla while the roster is rebuilt; engine code preserved. New **Bourbon Cards gallery** on the home screen — a read-only browser of every mash bill, sorted by tier. **Resource card economy overhaul** — market resources collapse onto four pricing bands (Common $1 / Double $3 / Specialty $3 / Double Specialty $6) with a uniform Specialty bonus (+1 rep on sale); capitals collapse onto a $1 / $3 / $5 ladder.
- **v2.6** — **Slot-Bound Mash Bills.** Mash bills no longer enter a player's hand. Bills are drawn directly into an open rickhouse slot and remain public for their lifetime in that slot. Drawing a bill requires an open slot — slot capacity now gates the doomsday clock. `Make Bourbon`'s "attach a bill" sub-step is removed. Silver award reworked to "bill stays in slot" (slot becomes a "ready project" rather than fully opening). Gold award reworked to three mutually exclusive options on trigger: **Convert** (replace another slot's recipe with the Gold bill, provided that slot's already-committed cards satisfy the Gold recipe), **Keep** (Silver-style retention in the now-empty selling slot), or **Decline** (bill to bourbon discard, slot opens fully). Connoisseur Estate constraint reframed as "maximum slotted bills is 4" (replaces the old mash-bill hand cap). Allocation, Barrel Broker, and Blend ops cards updated for slot-bound bills. Trashing bills is free for empty/ready slots, action-cost for committed slots (subsumed by Abandon Barrel).
- **v2.5** — **Incremental Mash Commitment.** Production redesigned: barrels are built across multiple turns via repeated `Make Bourbon` actions. Recipes auto-complete the moment the cumulative committed pile satisfies them; completed barrels first age the round after completion. New `Abandon Barrel` action returns committed cards to discard. **Convert (3:1) removed** — incremental commitment makes stranded resources less common. Distillery roster trimmed: Warehouse, Old-Line, and The Broker retired (their abilities were inert or carved out an awkward final-round asymmetry). Trading is now flatly illegal in the final round, no exceptions. Player count narrowed to 2–4.
- **v2.4** — Composition Buffs added (3+ cask, 3+ corn, 3+ single grain, 2+ capital, all-four-grains). Starter deck setup replaced with random-deal + 3-minute trade window + once-per-player stuck-hand swap. Distillery cards rebuilt as full asymmetric opening packages. Bot heuristics updated.
- **v2.2.x** — Rickhouse bonded/upper tier distinction removed. All slots equivalent; ops cards (Regulatory Inspection, Barrel Broker, Blend) that used to be tier-gated now operate on any aging slot.
- **v2.2** — Action Phase restructured: full turns, not one-action-per-round. Start player rotates each round (last → first). Operations cards moved to purchase-only.
- **v2.1** — Operations cards added (8 effects), Rush to Market and Distressed Sale Notice removed, ops bought from face-up market.
