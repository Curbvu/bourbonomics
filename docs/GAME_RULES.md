# 🥃 Bourbonomics

A deckbuilding strategy game about building a bourbon empire — one barrel at a time. Recipes take rounds to assemble, demand swings round to round, and the player with the most reputation when the supply runs dry wins.

**Players:** 2–4 · **Length:** ~30–60 min · **Complexity:** Medium

> **Scope (v2.10 alpha — "Identity & Economy").** Drafting, the round loop (Draw → Action → Cleanup, with per-turn demand roll + mandatory aging inside Action), slot-bound mash bills, incremental production, selling, market (4-band economy), operations cards, trading, doomsday-deck endgame. **Distillery selection is back** — every game opens with a 4-distillery picker (Vanilla, High-Rye House, Wheated Baron, Connoisseur Estate). Investment cards are sketched in [`PLANNED_MECHANICS.md`](PLANNED_MECHANICS.md) and not yet live. **Multiplayer is live** — host a 4-char-code room from `/multiplayer`, share the link, claim seats; bots fill the rest. Solo-vs-bots and online-multi-human both ship from the same engine.

---

# 🚀 Quick Start

For the impatient. Read once, play once, the rest of the rulebook will make sense.

> **Prefer to learn by doing?** The home screen has a **Tutorial** tile that opens an interactive walkthrough at `/tutorial` — a 13-step guided game (1 human + 1 bot, fixed seed) that hand-holds you from your first roll through your first sale, with spotlights and tooltips overlaying the live board. Skip out at any time.

### The 90-second pitch

You run a bourbon distillery. You have a **rickhouse** (4 barrel slots), a **deck** (16 starter cards), and **mash bills** (recipes) that live directly in your rickhouse slots. Each round:

1. **Draw 8** cards from your deck.
2. **Take your turn** — Roll demand → Age every aging barrel → Take actions (make / sell / buy / trade / etc.).
3. **Cleanup.** Discards reset, the start player rotates, next round.

Each player's turn opens with their own demand roll and a mandatory aging commit (1 card to **every** one of their aging barrels) — that's the holding cost for keeping inventory. *Then* the rest of their turn opens up.

### The core loop

- **Mash bills are slot-bound.** Bills are drafted into your slots at setup and drawn directly into open slots during play. They never enter your hand. Every bill is public the moment it's slotted.
- **Make bourbon** by committing cards (cask + corn + grain) from your hand to a slotted bill. Recipes take **multiple turns** to assemble — commit what you have now, finish the recipe later.
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

### Step 1 — Distillery selection

Players pick distilleries in **reverse snake order** (last seat first, then up the table, then back down) from a shared pool of four — **Vanilla**, **High-Rye House**, **Wheated Baron**, and **Connoisseur Estate**. Each pick is private until reveal, which fires at the start of round 1's action phase. No two players share a distillery.

The choice ships a starting state (open slots, pre-aged barrels, draft size), a permanent ability, and (for the asymmetric three) a constraint. See [§Distillery Profiles](#distillery-profiles) for the full roster.

### Step 2 — Mash bill draft

Setup-time bill drafting is now distillery-driven (v2.10):

- **Vanilla** — 0 starting bills. Every slot ships **Open**; the first bill is drawn during play.
- **High-Rye House** — 0 starting bills + 1 pre-aged rye barrel (`high_rye_basic`, age 1, `agingSinceRound = 0`). Three Open slots remain.
- **Wheated Baron** — 0 starting bills + 1 pre-aged wheated barrel (`wheated_basic`, age 1, `agingSinceRound = 0`). Three Open slots remain.
- **Connoisseur Estate** — **4** starting bills, filling every slot Staged. No Open slots until one is freed. Slotted-bill cap of 4 means Rickhouse Expansion Permit's 5th and 6th slots can only receive transferred barrels — never freshly drawn bills.

Pre-aged starter barrels carry a virtual production pile — no actual resource cards are returned on sale. Their attached bills are basic Common-tier (no Specialty gates, no Gold awards).

### Step 3 — Starter hand

Build the starter pool: per player, 6 cask · 4 corn · 4 grain (2 rye / 1 barley / 1 wheat) · 2 capital. Shuffle and **deal 16 cards face-up** to each player.

**Trade window — 3 minutes.** Players negotiate **1-for-1 trades** with anyone, in any order. Trades are public and require both sides to agree. Each trade is exactly one card per side; multi-card swaps are run as multiple trades.

**Stuck-hand swap.** Once during the trade window, a player may return up to 3 cards to the pool and draw the same number off the top. One-shot per player per game.

When the timer expires (or every player has signaled "pass"), shuffle your final 16 cards into your starter deck. Premium variants — Specialties and Double Specialties — only enter via the market.

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

Three phases per round:

1. **Draw** — each player draws 8 cards from their resource deck.
2. **Action** — players take full turns in the rotated order. Each turn runs as **Roll demand → Age every aging barrel → Take actions** (see [§Action Phase](#-action-phase) for the gated sub-steps).
3. **Cleanup** — unused resource and capital cards go to discard; per-round flags reset; start player rotates one seat counter-clockwise.

**Operations cards persist** — they're not discarded at end of round.

---

# 🎴 Turn Order and the Bookend

The first player rotates each round. The player who went **last** in round N goes **first** in round N+1.

For 4 players seated 1-2-3-4: rounds run 1234 → 4123 → 3412 → 2341 → 1234.

**The bookend.** Going last-then-first across a round boundary lets you act with full information at the end of round N and again with a fresh hand at the start of round N+1. It's a deliberate feature of the design — every player gets it equally over an N-player game. Operations cards held across rounds amplify this; demand-boosting ops in particular.

---

# 🎲 Demand (per-turn, v2.9)

At the **top of each player's action turn** (before any other action), the active player rolls **2d6**. If the result is **greater than** current demand, demand **rises by 1** (cap 12). Otherwise it holds. The roll is a mandatory first action — the engine rejects Make/Age/Sell/Buy/Trade until it lands.

This is the only natural rise — but with N players acting per round, demand can climb up to N times before the round ends, which speeds the market more than the old once-per-round roll. Demand still **falls by 1** for each barrel sold (floor 0). Some ops cards move it directly.

The bell curve of 2d6 means demand drifts toward the middle, with rare booms and crashes.

---

# 🎴 Draw Phase

Each player draws **8 cards** from their resource deck. Reshuffle the discard if the deck runs out.

Operations cards are NOT auto-drawn — they're bought from the ops market.

---

# 🛢️ Aging (per-turn, v2.9)

After rolling demand at the top of your turn, you **must commit one card from your hand to every one of your eligible aging barrels** before taking any other action. This is the holding cost for keeping inventory in the rickhouse — every turn a barrel sits unsold, you pay 1 card per barrel to keep it alive.

The committed card advances the barrel's age by 1 year (or more for cards with bonus ages). Aging cards do not contribute to sale payout beyond the age they buy on the grid — their value is the year they purchase.

**Staged and Building barrels do not age.** A barrel only starts aging once its recipe is fully satisfied — partial pile, no aging. See [§Make Bourbon](#make-bourbon) for the slot lifecycle. The aging commit only fires for barrels that are already in the **aging** phase.

When the barrel sells, all aging cards go to the player's discard.

### Edge cases

- **No aging barrels** — the cost is skipped; you go straight to step 3.
- **Not enough cards in hand** — you can't pay the full cost. The only legal move is `PASS_TURN`, which forfeits the turn; any un-aged barrels stay un-aged this round.
- **Multiple aging barrels** — every one must age. You commit one card per barrel; until they're all touched, no other action is legal. Each barrel still ages at most once per round (Rushed Shipment grants exceptions).
- **Just-completed barrels** — a barrel that finished construction this round doesn't age until next round and is not counted toward the requirement; if your ONLY aging barrels fall in that bucket, the cost is skipped this turn.

---

# 🎯 Action Phase

Each player takes their **full turn** in rotated order. The turn opens with two mandatory micro-steps before the free actions begin:

1. **Roll demand** (see [§Demand](#-demand-per-turn-v29)).
2. **Age every aging barrel** (see [§Aging](#️-aging-per-turn-v29)) — commit one card per un-aged aging barrel; skipped only if you have none.
3. **Free actions** — take as many of these as you want, in any order: Make Bourbon, Sell Bourbon, Buy from the Market, Buy Operations Card, Draw a Mash Bill, Trade, Trash a Card. End the turn voluntarily when you're done.

Until both gated micro-steps are paid, the engine rejects every other action except `PASS_TURN` and `PLAY_OPERATIONS_CARD` (which always plays free).

**Operations cards** play as a **free interruption** at any point during your turn — including before the demand roll and during the aging step. They don't consume an action; each ops card is one-shot.

**Voluntarily ending your turn is final** — you don't act again until the next round. Cards in your hand stay there until cleanup.

Plan during others' turns. Target pace: ~3 minutes per round at 4 players.

### Available Actions

- **Make Bourbon** — commit cards from your hand to a Staged or Building slot.
- **Sell Bourbon** — sell an aging barrel ≥ 2 years old that has aged at least one full round. No card cost.
- **Buy from the Market** — spend cards to acquire a market card.
- **Buy Operations Card** — same, but for the ops market.
- **Draw a Mash Bill** — pay cost; bill lands directly in one of your open slots as Staged.
- **Trade** — exchange cards with another player. Mash bills are not tradeable.
- **Trash a Card** — permanently remove a card from your deck (see [§Trashing](#-trashing-cards) for bills).
- **End Turn** — voluntary; cards remaining in hand stay there until cleanup.

---

## Make Bourbon

> **v2.6: Slot-Bound Bills.** Bills live on slots from the moment they're drawn. `Make Bourbon` only commits cards — there is no separate "attach a bill" sub-step.

Each rickhouse slot lives in one of four phases:

- **Open** — no bill in the slot. Drawable into via [§Draw a Mash Bill](#draw-a-mash-bill).
- **Staged** — bill present, no committed cards. Visible to all players. Does NOT age.
- **Building** — bill + ≥1 committed card, recipe not yet satisfied. Does NOT age.
- **Aging** — recipe satisfied. Locked in. Accepts one aging card per round from the round AFTER completion.

### The action

`Make Bourbon` commits one or more cards from your hand to one of your **Staged** or **Building** slots. The bill is already attached — you only choose the slot and the cards.

**No per-slot limit.** You can Make Bourbon to any of your Staged or Building slots as many times as you want on a single turn. Each commit is its own action; the recipe-completion check fires after every commit, so a slot can transition Staged → Building → Aging across multiple commits in one turn.

Committed cards (resource OR capital) are **locked with the barrel** — they don't go to discard until the barrel sells.

### Recipe satisfaction

A slot transitions **Building → Aging** the moment its committed pile satisfies BOTH:

1. **Universal rule:** exactly 1 cask + ≥1 corn + ≥1 grain.
2. **The slotted bill's recipe** (if any), e.g. "rye ≥ 3" for a high-rye bill.

The first commit transitions the slot **Staged → Building**. The completion check fires at the end of every commit, so a single sufficient commit can take a slot all the way from Staged to Aging in one action.

### Exact-recipe rule (v2.10)

The total cards on a barrel match the recipe exactly. The engine rejects any commit that would push **corn** past the recipe's corn count, **total grain** past the recipe's grain count, or **cask** past 1. Per-grain minimums (e.g. `minRye: 2`) stay floors — they're the lowest count for that grain — but the *wildcard* portion of `minTotalGrain` can land on any grain (subject to per-grain caps like `maxRye: 0` on wheated bills).

Recipe **caps** (`maxRye: 0`, `maxWheat: 0`, etc.) are still enforced — those are bill-specific bans, not minimums.

**Specialty-cask exclusivity.** If a recipe demands `minSpecialty.cask ≥ 1`, plain casks are not legal commits — the player must lead with a Specialty cask. (The universal "exactly 1 cask" rule would otherwise strand the barrel.)

**Specialties are backwards-compatible.** A Specialty card satisfies both its subtype's regular minimum AND the specialty floor — one card, two boxes ticked. A bill with `minRye: 1, minSpecialty.rye: 1` needs just **one Specialty Rye** to complete its rye requirement, not two cards. A bill with `minRye: 2, minSpecialty.rye: 1` needs 2 rye total, at least one specialty — so 1 plain + 1 specialty (or 2 specialty), never 3 cards.

### Timing

- Completion check fires at the end of the action that placed the satisfying card.
- A barrel completed in **round N first ages in round N+1** — completion doesn't grant a free aging round. This preserves the temporal cost of a slow build.
- A barrel completed in round N also **cannot sell until round N+1** at the earliest (v2.10 round-gap rule, see [§Sell Bourbon](#sell-bourbon)). Ops cards that accelerate age (Rushed Shipment, Forced Cure) cannot bypass the round-gap.

### Per-bill recipes

Recipes only ever **tighten** the universal rule, never loosen it. Examples:
- High-rye — `rye ≥ 3`
- Wheated — `wheat ≥ 1, no rye`
- Four-grain — `barley ≥ 1, rye ≥ 1, wheat ≥ 1`

Bills without a printed recipe accept any legal mash. Recipes are public information from the moment the bill is slotted.

### Specialty gates (v2.7.2)

Higher-rarity bills can require **Specialty** cards by subtype, on top of the regular minimums. A recipe with `minSpecialty: { rye: 1 }` requires at least one Specialty (or Double Specialty) Rye card in the production pile.

A Specialty card counts toward **both** the regular minimum AND the specialty floor — one card, two boxes ticked. So a Wheated Estate bill (`minWheat: 2, minSpecialty: { wheat: 1 }`) needs 2 wheat cards total, of which at least 1 must be Specialty.

Specialty thresholds tend to be:
- **Common** — universal rule only.
- **Uncommon** — one named-grain minimum.
- **Rare** — three+ named grain OR one specialty card.
- **Epic** — at least one specialty card required.
- **Legendary** — two+ specialty cards required.

Each Specialty card committed also grants **+1 reputation on sale** — a passive bonus separate from any specialty-gate requirement.

### Over-committing is rejected (v2.10)

The engine refuses commits that would push the barrel past its recipe — see [§Exact-recipe rule](#exact-recipe-rule-v210) above. Players who run out of legal cards mid-build can `ABANDON_BARREL` to recover the pile.

### Failed Batch (optional)

The first time a slot transitions **Staged → Building** (your first commit to a freshly-drawn bill), you may also discard one extra card from your hand and **trash** it. One of two ways to thin your deck (see [§Trashing Cards](#-trashing-cards)). Not available on subsequent commits to the same slot.

---

## Sell Bourbon

Sell any of your **aging** barrels that is **at least 2 years old** AND has been in Aging phase for at least one full round.

**No card cost (v2.10).** The sell action is free — mandatory per-turn aging is the sole holding cost in the cards-in-to-rep-out economy.

### Round-gap rule (v2.10)

A barrel completed in round N first becomes sellable in round N+1, in addition to the age ≥ 2 threshold. Mechanically: a barrel is sellable iff `barrel.age >= 2 AND state.round > barrel.completedInRound`. The check is independent of how the barrel reached age 2 — Rushed Shipment or Forced Cure inside the completion round still cannot bypass the round-gap.

Pre-aged starter barrels (High-Rye House, Wheated Baron) ship with `completedInRound: 0`, so the gap is satisfied from round 1 onward; their age 1 floor still has to clear before they sell.

### Sale resolution

1. Read the attached mash bill's grid at `(barrel age, current demand)` to get N.
2. Add **+1 reputation** for each Specialty or Double Specialty resource committed during production.
3. Apply any persistent barrel offsets (e.g. Master Distiller).
4. Determine the award eligibility:
   - **No award / Silver-eligible** — 100% of the total goes to **reputation**. Purchasing power is not available.
   - **Gold-eligible** — the player allocates the total across two outcomes (any combination summing to ≤ total):
     - **Reputation** — advance your reputation track.
     - **Purchasing power** — spend immediately on market buys following normal costs.
5. Demand drops by 1 (floor 0).
6. Distribute cards and resolve slot fate per [§Bourbon Awards](#-bourbon-awards).

Any unspent total becomes reputation. Purchased cards go to discard. Purchasing power can't be saved across turns and can't chain into another sale.

After the sale:
- All cards under the barrel return to your discard.
- The barrel record is removed.
- **Slot fate depends on awards** (see [§Bourbon Awards](#-bourbon-awards)):
  - **No award** — bill goes to bourbon discard, slot becomes fully **Open**.
  - **Silver** — bill stays in the now-empty slot as **Staged** (recipe ready to receive new commits). Slot does NOT open.
  - **Gold** — player chooses: Convert (replace another slot's bill, or land in an Open slot for Connoisseur Estate), Keep (Silver-style retention), or Decline (bill to discard, slot opens).

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

**An open slot is required.** The drawn bill lands directly in one of your open rickhouse slots as **Staged**. If you have no open slots (all four are Staged, Building, or Aging), `Draw a Mash Bill` is illegal — you must sell or trash a slot first to create room.

This makes slot capacity the gating resource on the doomsday clock: bills can't be drawn speculatively to accelerate the clock — every draw requires an actual project.

When the deck **and** face-up row are both empty, the **final round trigger** activates.

## Trade

Two players exchange cards by mutual consent. Each side must offer at least one card. **Traded cards land in the recipient's hand**, not their discard. They are immediately available to play on subsequent turns (or this turn, if you are the active player receiving them as part of your own trade action). Trade is one of the active player's actions but does NOT end your turn.

**Mash bills cannot be traded.** Bills are slot-bound and public — they only move via game actions (Draw a Mash Bill, Sell Bourbon's Gold-Convert option, Blend, Barrel Broker), never by player-to-player negotiation.

Informal agreements (deferred trades, rickhouse leases) ride on Trade — they're not enforced by the rules.

**Trading is illegal during the final round.**

## Trash a Card

Spend 1 card from your hand to permanently remove 1 other card from your hand. The trashed card is removed from the game; the spent card goes to discard. (Failed Batch on Make Bourbon is the second way to trash.)

**Mash bills are governed separately.** A Staged slot may be trashed for free (the bill goes to bourbon discard, slot opens). Building and Aging slots cannot be trashed — once you've committed a card to a recipe, the only way out is to finish the build and sell the barrel.

## End Turn

Voluntary. Cards remaining in your hand stay until cleanup, when resource and capital cards discard. Operations cards persist. You don't act again until next round.

---

# 🏚️ The Rickhouse

Each player owns their rickhouse outright — printed on the distillery card. **4 slots** by default, equivalent. No shared barrel space.

Each slot is in one of four phases:

| Phase | Bill? | Cards? | Ages? | Drawable into? |
|---|:-:|:-:|:-:|:-:|
| **Open** | — | — | — | ✅ |
| **Staged** | ✅ | — | — | — |
| **Building** | ✅ | partial | — | — |
| **Aging** | ✅ | recipe complete | ✅ | — |

The lifecycle: `Open` → (Draw a Mash Bill) → `Staged` → (Make Bourbon, first commit) → `Building` → (Make Bourbon, recipe complete) → `Aging` → (Sell Bourbon) → `Open` (or `Staged` on Silver / Gold-Keep).

When **all four** of your slots are taken (Staged, Building, or Aging), you cannot draw a new bill — you must sell or trash to free a slot.

The Rickhouse Expansion Permit ops card raises capacity to a maximum of **6**.

---

# 📜 Mash Bills

Recipes that determine each barrel's reward grid. **Bills are slot-bound** — they live directly on rickhouse slots and never enter a player's hand.

### How bills enter play

- **Setup draft** — each player drafts 3 bills (Connoisseur Estate: 4) directly into their starting slots. Standard distilleries leave the 4th slot Open for a bill drawn during play.
- **Draw a Mash Bill action** — pay cost; bill lands in one of your Open slots as Staged.
- **Allocation** ops card — draw up to 2 bills, capped by your Open-slot count.
- **Barrel Broker** ops card — transfers a completed barrel (with its bill) into a recipient's Open slot.
- **Gold Convert award** — replaces another slot's bill with the Gold one when its committed cards already satisfy the Gold recipe.

### Public information

A bill is **public the moment it's slotted**. Every player can read every other player's bills (recipe, reward grid, awards) at any time. There's no hidden hand of recipes.

### What ends a bill's lifetime

When a barrel sells, the bill's fate depends on awards (see [§Bourbon Awards](#-bourbon-awards)):
- **No award** — bill goes to bourbon discard, slot opens.
- **Silver / Gold-Keep** — bill stays in the now-empty slot as Staged.
- **Gold-Convert** — bill replaces another slot's bill; selling slot opens.
- **Gold-Decline** — bill goes to bourbon discard, slot opens.

A bill also goes to the bourbon discard when its Staged slot is trashed.

### Bills are not tradeable

Bills cannot be transferred between players via Trade. They only move via the game actions listed above.

---

# 🃏 Hand and Deck

Each player draws **8 cards** at the start of every round. No max hand size during a turn (mid-sale draws can temporarily expand). At cleanup, all unused resource and capital cards in hand discard. Operations cards persist.

The deck contains **resource cards** (cask, corn, grain — premium variants like 2-rye come from the market) and **capital cards** (face-value currency).

**Mash bills are NOT in your hand.** They live directly on rickhouse slots and are public. Operations cards are the only non-resource/non-capital cards a player holds privately.

Decks grow through market purchases. The effective working deck shrinks as cards lock onto Building or Aging barrels — those cards are unavailable until sale.

### Card types

- **Resource** — cask, corn, wheat, rye, barley. Needed to make bourbon. Premium variants count for more units.
- **Capital** — currency. The printed value is its **payment value** when buying market cards, ops cards, or mash bills. In every other context (production, trading, aging) a capital card counts as 1.
- **Operations** — bought from the face-up ops market. Played as a free action during the action phase. One-shot unless stated otherwise.

### Card Bands

Resource cards in the market sort into three pricing bands (v2.10 retired the plain Double tier — see changelog). Specialties carry a uniform luxury bonus — **+1 reputation when the barrel sells**, for each Specialty (or Double Specialty) committed to it. Capital cards collapse onto a $1 / $3 / $5 ladder; cost equals face value across the board.

| Band | Cost | Units | On sale |
|---|:-:|:-:|---|
| **Common** (cask, corn, rye, wheat, barley) | $1 | 1 | — |
| **Specialty** (superior cask / corn / rye / wheat / barley) | $3 | 1 | +1 reputation |
| **Double Specialty** (double superior cask / rye / wheat) | $6 | 2 | +1 reputation |

Premium variants — Specialties and Double Specialties — only enter play via the market.

---

# 🥇 Bourbon Awards

Some mash bills grant special awards on sale. Awards manipulate **slot state** rather than card draws — winning a great bourbon means the recipe sticks around or jumps to a more promising slot.

### Silver — Bill stays in slot

When a barrel with a Silver-eligible bill sells:
- All committed and aging cards distribute as normal (player's discard, mid-sale draws, etc.).
- **The bill stays in the now-empty slot as Staged.** The slot does NOT open — it's a "ready project" awaiting fresh commits.
- The full grid total goes to **reputation** (Silver does not unlock purchasing power; see [§Sell Bourbon](#sell-bourbon)).

This rewards a successful sale by keeping the recipe on the board, ready to receive cards from your next hand.

### Gold — Three mutually exclusive options

When a barrel with a Gold-eligible bill sells, the player chooses **one** of:

- **Convert.** Replace one of your **other** slots' bill with the Gold bill, provided that slot's already-committed cards satisfy the Gold recipe. The replaced bill goes to bourbon discard. The Gold bill is then locked into the target slot. The selling slot opens fully.
  - **Connoisseur Estate — Open-slot Convert (v2.10).** Connoisseur may Convert into one of their **Open slots** (no barrel record there yet). The Gold bill lands in the Open slot as a Staged barrel. No recipe check is needed because there are no committed cards to validate.
- **Keep.** The Gold bill stays in the now-empty selling slot (Silver-style retention). Slot becomes Staged.
- **Decline.** The Gold bill goes to bourbon discard. The selling slot opens fully.

**Convert constraints:**
- Target must be one of your own slots, **not** the slot being sold.
- Target slot must currently hold a bill whose committed cards satisfy the Gold bill's recipe — **unless** you're playing Connoisseur Estate, in which case an Open slot is also legal.
- If no legal Convert target exists, the option is unavailable — pick Keep or Decline.

Gold takes precedence if both Silver and Gold conditions are met. Gold awards do NOT trigger the final round — only the bourbon supply running out does.

**Gold is the only path to purchasing power (v2.10).** Silver and no-award sales pay 100% reputation. Choosing Decline on a Gold-eligible sale still grants the rep/PP split — the monetization gate is Gold eligibility, not which Gold slot option you exercise.

---

# 📊 Market Demand

Range **0–12**, starting at 0.

- **Rises by 1** when an active player's 2d6 turn-opening roll exceeds current demand. Up to N rises per round, one per player.
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
| **Allocation** | 4 | Draw up to 2 mash bills free, one per Open slot. If you have 0 Open slots, the card is consumed for no effect. |
| **Regulatory Inspection** | 5 | Target an aging barrel. It cannot be aged this round. |
| **Barrel Broker** | 6 | Transfer one of your aging barrels to another player's **fully-Open** slot for a card payment. The barrel's bill rides with it; the recipient now owns both. |
| **Blend** | 6 | Merge two of your aging barrels into one slot. Pick which slot survives; the other opens fully. Merged barrel keeps the higher age, higher-value bill (player's choice on tie), and all committed + aging cards. The discarded bill goes to bourbon discard. |
| **Rating Boost** | 4 | Pre-play. Your next sale gains +2 reputation. |
| **Master Distiller** | 6 | Choose one of your aging barrels — for the rest of the game it reads its grid as if demand were +2. |
| **Rickhouse Expansion Permit** | 6 | Permanently +1 rickhouse slot (max 6). |

---

# 🏛️ Distillery Profiles

Four distilleries (v2.10). Each profile is a full asymmetric package: **starting state**, **permanent ability**, **constraint** (asymmetric three only). Setup runs a reverse-snake pick from the shared pool — no two players share a distillery.

### Vanilla Distillery — "The Symmetric Option"
- *Starting state:* 4 Open slots, no pre-aged barrels.
- *Permanent ability:* None.
- *Constraint:* None.

Pick Vanilla for a level playing field or an introductory game.

### High-Rye House — "The Specialist"
- *Starting state:* 1 pre-aged rye barrel (age 1, `starter_high_rye` bill, `agingSinceRound = 0`), 3 Open slots, plus **2 free Specialty Rye** cards in your starter deck.
- *Permanent ability:* +1 reputation when selling any barrel whose attached bill has `minRye ≥ 1`. Stacks with Specialty bonuses.
- *Constraint:* You cannot draft or draw any mash bill with `maxRye: 0` (the wheated lane is closed). Wheated bills in the face-up row are illegal targets; blind draws auto-skip wheated bills back to the bottom of the deck.

### Wheated Baron — "The Smooth Operator"
- *Starting state:* 1 pre-aged wheated barrel (age 1, `starter_wheated` bill, `agingSinceRound = 0`), 3 Open slots.
- *Permanent ability:* Wheated bills (`maxRye: 0`) require 1 fewer wheat to complete (floor 0 on the bill's `minWheat`). No effect on wheated bills whose `minWheat` is already 0.
- *Constraint:* You cannot commit **any rye card** (Common, Specialty, Double Specialty) to a barrel. Rye in your hand is still legal currency at the market and in trades.

### Connoisseur Estate — "The Diversified"
- *Starting state:* Drafts **4 mash bills** at setup instead of 3 — every slot ships Staged at game start. No Open slot until one is freed.
- *Permanent ability:* When you trigger a Gold award, Convert may target an **Open slot** in addition to existing-bill slots. The Gold bill lands there as a Staged barrel (no recipe check required). Standard Convert into an existing slot also remains available.
- *Constraint:* Maximum slotted bills is 4. Even with Rickhouse Expansion Permit, slots 5 and 6 cannot receive freshly drawn bills — they function only as overflow space for completed barrels transferred via Barrel Broker, Blend, or other ops effects.

> **Roster note.** The earlier v3 roster (Quick-Turn Bottler, Patient Cooper, Single-Barrel House, The Estate, Storm Chaser, Mothballed, Bourbon Purist, Artisanal) is retired alongside the older Warehouse / Old-Line / The Broker. Most of those leaned on the composition-buff system, which v2.8 removed entirely. The v2.10 four-distillery roster retargets every ability at systems that exist today: specialty gates, slot caps, and sale-time modifiers.

---

# 🎲 Player Count Notes

Designed and balanced for **2–4 players**.

- **2 players** — fastest; high variance. Demand swings dramatically with fewer sales to anchor it. Tactical play over long-arc planning.
- **3 players** — the sweet spot. Demand pressure is meaningful, ops cards make table moments, doomsday clock paces well.
- **4 players** — fullest experience. Real drama on ops, contested demand track, the most chaotic final rounds.

v2.10 ships four distilleries (Vanilla + 3 asymmetric), supporting 2–4 players cleanly. **5+ players are not supported** in this build for balance reasons.

---

# 🌐 Multiplayer

Two ways to play, both running the same engine:

- **Solo (`/play`)** — you + 1–3 bots. State lives in your browser; bots step locally.
- **Online (`/multiplayer` + `/play/[code]`)** — 1–4 humans + bots, server-authoritative. State lives in DynamoDB behind a WebSocket Lambda; every action round-trips through `applyAction` on the server, then broadcasts to every connected client. Bot turns inline-step on the server too, so bot moves animate instantly between human turns.

### Host flow

1. Open `/multiplayer`, pick a name + total human seats (1–4) + bot seats (0–3).
2. **Create room →** mints a 4-character code (Boggle-style, no 0/O/1/I), seats you as host (`human0`), and routes you to `/play/[code]`.
3. Copy the share link from the room banner. The waiting room shows the per-seat roster live.
4. **Start game →** flips the room out of pre-game lobby. The setup-phase modals (starter-deck draft, draw) fire same as solo — only the seat the engine is on the clock for sees the prompt; the rest see "waiting on X". Once the action phase begins, each player rolls their own demand and ages their own barrel on their own turn (per v2.9).

### Join flow

1. Paste the share link. If you've never set a name on this device, a name prompt appears before the socket opens.
2. The roster strip in the room banner shows every seat — **claim** an open seat by clicking it. You become that seat for the rest of the game; subsequent actions you submit are gated server-side against your claimed playerId.
3. If you arrive as a **spectator** (deep-link to a started game with no open seats), you see the GameBoard but the bottom tray reads "👁 Spectating" instead of someone else's hand.

### Under the hood

- 4-char codes mint from a 32-letter alphabet (8-try collision resolution against ~1M keyspace).
- Rooms expire 14 days after their last write (DynamoDB TTL); abandoned games clean themselves up.
- Connection table has a `roomCode` GSI so broadcasts iterate every socket in a room without scanning.
- Optimistic CAS on every state write — two clients racing the same action see one win, the other gets `stale-state` and resyncs.
- Reconnect is name-based: if your display name already owns a seat, joining the room rebinds you to it without a re-claim round-trip.
- Animations (sale flight, make flight, purchase flight) ride along on every broadcast so flights fire on every client, not just the actor's screen.

### Lifecycle messages

- `create-room` / `join-room` / `claim-seat` / `release-seat` / `start-game` (host-only) / `action` / `resync`.
- Host-only actions (`start-game`) are gated by `connectionId.playerId === "human0"`.
- Setup-phase modals self-gate: starter-deck draft only fires on the seat the engine is awaiting; draw phase fires for each seat that hasn't drawn yet; the v2.9 demand-roll modal and aging overlay each fire only for the seat whose turn is currently open (not host-only — every player rolls and ages on their own turn).

---

# 🔁 The Core Loop

Pick a distillery → draft mash bills directly into your slots → build a starter deck → draw 8 cards a round → commit cards toward a Staged or Building slot → finish the recipe → age it → sell when demand favors you → take rep, cards, or both → buy more → play ops at the right moment → **manage your open slots** (every drawn bill needs one) → watch the rotation for your bookend → time your endgame.

The mash bill supply is the **doomsday clock**. Drawing mash bills accelerates the end — and slot capacity is the natural throttle: you can't draw a bill without an Open slot to receive it.

---

# 🥃 Final Thought

Bourbonomics isn't about making bourbon.

It's about **knowing what to lock up, what to let go, and when the world is ready to pay**.

---

# 📜 Changelog

- **v2.10** — **"Identity & Economy."**
  - **Gold-only purchasing power.** Only Gold-awarded sales can split grid value between reputation and purchasing power. Silver and no-award sales pay 100% reputation. Sale resolution branches on award type — `canMonetize` is gated by Gold eligibility, not the player's allocation choice. Net effect: Gold becomes the sprinter's economy (fast capital, deck-shaping), non-Gold becomes the grinder's economy (steady rep, deck stable). Cash Out and the operations market become more important for non-Gold players; investments will close more of the gap when they ship.
  - **All barrels must age before selling.** Formalized the round-gap rule: a barrel must be in the Aging phase for at least one full round before it can sell, in addition to the `age ≥ 2` threshold. Tracked via `completedInRound` on each barrel; sellability requires `currentRound > completedInRound`. Closes the v2.9 edge case where Rushed Shipment or Forced Cure could compress completion-to-sale into a single round. Pre-aged starter barrels are exempt (their `completedInRound = 0` makes them sellable from round 1 onward as soon as they clear the age 2 threshold).
  - **Distilleries re-enabled.** `DISTILLERIES_ENABLED` flips back on. Four-distillery roster returns: **Vanilla, High-Rye House, Wheated Baron, Connoisseur Estate**. Abilities re-tooled for the post-composition-buff world — High-Rye gets a +1 rep sale-time mod on rye-bill sales, Wheated reduces wheat requirements on wheated bills, Connoisseur unlocks Gold Convert into Open slots. Constraints retargeted: High-Rye bans wheated bills, Wheated bans rye commits, Connoisseur caps slotted bills at 4. Vanilla is the symmetric default. The retired roster (Quick-Turn, Patient Cooper, Single-Barrel, Estate, Storm Chaser, Mothballed, Bourbon Purist, Artisanal — and the older Warehouse / Old-Line / The Broker) stays retired.
  - **Sell action no longer costs a card.** The v2.7.1 1-card sell cost is dropped. Mandatory per-turn aging (v2.9) is now the sole holding cost in the cards-in-to-rep-out economy. Floor ratio shifts from 7:1 to ~6:1; combined with Gold-only PP, the two economic paths widen meaningfully. Sell UX simplifies: pick barrel → sale resolves. No card-spend step.
  - **Bot AI overhaul.** Bot heuristics updated for the v2.10 economy: distillery-aware action weights (High-Rye prefers rye bills and skips wheated drafts, Wheated never commits rye, Connoisseur values Open-slot Convert), Gold-eligibility valued ~50% higher than equivalent non-Gold sales, distillery sale-bonus baked into the priority score, and a round-gap-respecting sale filter. Distillery picker rebuilt around the new 4-roster.
  - **Resource bands reduced from four to three.** Plain Double cards (Double Corn / Rye / Barley / Wheat — the $3 2-unit tier, plus the earlier Double Cask) are retired. Two singles satisfy every recipe gate a Double would, so the band added market clutter without adding strategy. The bands now are Common ($1, 1 unit), Specialty ($3, 1 unit + rep), and Double Specialty ($6, 2 units + rep). Double Specialty stays because each card counts as 2 toward `minSpecialty.<subtype>` gates — a role no other card fills. Dead `bonusTwoRye` plumbing on `DistilleryStarterPoolMods` is removed alongside; High-Rye House's starter rye runs through `bonusSpecialtyRye`.
  - **Exact-recipe rule.** Over-committing is no longer allowed. The engine rejects any commit that would push corn past the recipe's corn count, grain past the recipe's `minTotalGrain`, or cask past 1. Per-grain minimums (e.g. `minRye: 2`) stay floors — the wildcard portion of `minTotalGrain` can still land on any grain — but the *total* is exact. Two follow-on rules:
    - **Specialty-cask exclusivity.** If a recipe demands `minSpecialty.cask ≥ 1`, plain casks are illegal commits up front (the universal "exactly 1 cask" rule would otherwise strand the barrel). The legacy v3.1 upgrade-swap path remains in code for recipes WITHOUT a specialty-cask floor, where the player upgrades for the +1 rep on sale.
    - **Specialties are backwards-compatible (no double commit).** A Specialty card ticks both its subtype floor AND the specialty gate with a single commit. A recipe with `minRye: 1, minSpecialty.rye: 1` needs just one Specialty Rye, not "1 rye + 1 specialty rye" = 2 cards. With `minRye: 2, minSpecialty.rye: 1`, the player commits 2 rye total of which ≥1 is specialty.
- **v2.9** —
  - **Per-turn demand rolls.** Demand is no longer a once-per-round global ceremony at the top of the round. Each player rolls their own 2d6 at the very start of *their own* action turn — it's the mandatory first action of the turn, gated by `player.needsDemandRoll` (set when the cursor lands on the seat, cleared by ROLL_DEMAND). The phase strip drops the dedicated `demand` phase; rounds now run **Draw → Action → Cleanup**. Demand can rise up to N times per round (once per player) instead of once total, accelerating the market. Multiplayer: each player sees their own demand-roll modal at the top of their turn (others wait for the broadcast); bots roll inline via the orchestrator.
  - **Mandatory per-turn aging.** The dedicated Age phase is gone. Right after the demand roll, the active player **must commit one card from hand to every one of their eligible aging barrels** before taking any other action — gated by `player.needsAgeBarrels` (set by ROLL_DEMAND when the player has any un-aged aging barrel, cleared by AGE_BOURBON once every eligible barrel has been touched). Players with no aging barrels skip the cost; players with no cards in hand can `PASS_TURN` (forfeits the turn) or `ABANDON_BARREL` (only for ready/construction barrels — aging barrels can only leave via SELL). The per-turn loop is now: **Roll → Age → Actions**, creating a real holding cost for sitting on inventory while waiting for demand to rise. v3 tightened this from "one barrel touched is enough" to "every aging barrel must be touched" — multiple aging barrels now compound the holding cost.
  - **Tutorial mode.** New `/tutorial` route — an overlay-driven walkthrough that boots a deterministic solo game (1 human + 1 bot, seed 42) and narrates 13 steps from welcome through the player's first sale. The overlay paints a yellow halo or cutout dim around the call-to-action zone; steps with auto-advance predicates fire forward when the player satisfies the relevant `GameState` condition (round ticked, barrel reached aging, age ≥ 2, barrelsSold ≥ 1, etc.). Read-only board-tour pages get a hard cutout dim; live-action pages stay light so the player can see and click the whole board. Skip button on every step. The home screen surfaces it as a violet tile so a fresh player lands here first.
- **v2.8** —
  - **Multiplayer (online).** Host a 4-char-code room at `/multiplayer`; friends join via share link, claim seats, the host hits Start. Server-authoritative — every action round-trips through `applyAction` on AWS Lambda, then broadcasts to every connected client. Bot turns inline-step server-side so bot moves animate instantly between human turns. Pre-game lobby (waiting room with roster + Start button), seat claiming + release, reconnect-by-name, spectator mode, host-gated demand roll, per-seat draw modals. Setup-phase modals self-gate to the seat the engine is on the clock for. Infra: SST 4 / API Gateway WebSocket / DynamoDB rooms+connections / EventBridge cron tick fallback. See §Multiplayer for the full flow.
  - **Composition Buffs removed entirely.** The five threshold buffs (3+ cask, 3+ corn, 3+ single grain, 2+ capital, all four grains) are deleted with no replacement. Sale resolution simplifies to grid lookup + Specialty bonus + awards. Aging cards now exclusively advance the age counter and contribute nothing else to sale payout. Resource cards do whatever their printed text says — most have no sale-time effect. The "demand does not drop on sale" effect previously granted by 2+ capital is preserved only via the Demand Surge ops card.
  - **Reward grids are now monotonic.** Every bill's grid rises (or holds flat) going right across demand and going down across age — no backward steps. Dropped the v2.7.2 "grain character" curves where wheat peaked mid-demand and barley peaked low; those produced cells that paid less at higher demand and read as bugs at a glance. Locked in with a per-tier shape invariant.
  - **Tier 1 commons run a slim single-axis grid** (1×N or N×1) with at most 2×2; uncommons run a varied 1×3 / 2×2 / 2×3 / 3×1 mix; rares 2×2 / 2×3 / 3×2; epics 3×2 / 3×3; legendary 4×4. Shape now encodes character — a flat-age wheat bill reads `1×3`, a pure-aging barley bill reads `3×1`.
  - **Sell + Age UX overhaul.** Sell now opens a picker (pick a barrel, pick a card to spend, action auto-fires on the second click). Age auto-fires the same way — no Confirm button. Selling a barrel fans the production + aging cards out from the slot to the seller's discard pile via a new `SaleFlight` animation. Recipe chips on the inspect modal + gallery now dedupe specialty + universal — a `minSpecialty: { cask: 1 }` recipe shows one chip, not two. New `mashBillBuildCost` tuning aid (basic = 1, specialty = 4, plus draw cost) surfaced as a "build N" pill on every card.
- **v2.7.2** — **Specialty gates + rarity-ramped recipes.** Mash bill recipes can now require **Specialty** cards by subtype (`minSpecialty: { rye: 1 }`). One Specialty card satisfies both the regular minimum AND the specialty floor — a single Superior Rye covers a `minRye: 1, minSpecialty: { rye: 1 }` recipe. Recipe complexity now scales with rarity: commons keep the universal rule only; uncommons require ≥2 of a named grain; rares ask for 3 grain or 1 specialty; epics gate behind 1+ specialty; legendaries 2+ specialty. Bourbon Cards gallery rebuilt around the new constraints — heat-mapped payoff matrix, gold-bordered specialty chips, awards baked into the matrix cell background.
- **v2.7.1** —
  - **Trade clarified:** traded cards land in the recipient's hand (not discard), making them immediately available on subsequent turns. Corrects an earlier draft that sent traded cards to discard and made the trade action mechanically inert until the next round.
  - **Sell Bourbon now explicitly costs 1 card from hand** (any resource or capital card), spent to discard. This formalizes part of the intended cards-in-to-rep-out economy: a baseline barrel sale consumes ~7 cards across its full lifecycle (bill draw + cask + corn + grain + 2 aging cards + sell-action card) for a minimum 1 rep payout, establishing the 7:1 floor ratio that scales toward ~2:1 at peak play.
- **v2.7** — **Make Bourbon per-slot turn cap removed** (a player can now commit to the same slot as many times as they want on a single turn; recipe-completion fires after every commit). **Mash bill catalog recalibrated** into three difficulty/payoff tiers (Tier 1 starter / Tier 2 mid / Tier 3 specialty) with peak rewards and Gold awards scaled per tier. **Distillery profiles temporarily disabled** behind a `DISTILLERIES_ENABLED` feature flag — every game runs as Vanilla while the roster is rebuilt; engine code preserved. New **Bourbon Cards gallery** on the home screen — a read-only browser of every mash bill, sorted by tier. **Resource card economy overhaul** — market resources collapse onto four pricing bands (Common $1 / Double $3 / Specialty $3 / Double Specialty $6) with a uniform Specialty bonus (+1 rep on sale); capitals collapse onto a $1 / $3 / $5 ladder.
- **v2.6** — **Slot-Bound Mash Bills.** Mash bills no longer enter a player's hand. Bills are drawn directly into an open rickhouse slot and remain public for their lifetime in that slot. Drawing a bill requires an open slot — slot capacity now gates the doomsday clock. New 4-phase slot lifecycle: **Open → Staged → Building → Aging**. `Make Bourbon`'s "attach a bill" sub-step is removed; the action only commits cards. Silver award reworked to "bill stays in slot" (slot becomes Staged, ready for fresh commits). Gold award reworked to three mutually exclusive options on trigger: **Convert** (replace another slot's recipe with the Gold bill, provided that slot's already-committed cards satisfy the Gold recipe), **Keep** (Silver-style retention in the now-empty selling slot), or **Decline** (bill to bourbon discard, slot opens fully). Connoisseur Estate constraint reframed as "maximum slotted bills is 4" (replaces the old mash-bill hand cap). Allocation, Barrel Broker, and Blend ops cards updated for slot-bound bills. Trashing bills is free for Staged slots, action-cost for Building slots (subsumed by Abandon Barrel). Over-committing past a recipe minimum is allowed but earns no bonus — the reward grid is keyed off `(age, demand)` only.
- **v2.5** — **Incremental Mash Commitment.** Production redesigned: barrels are built across multiple turns via repeated `Make Bourbon` actions. Recipes auto-complete the moment the cumulative committed pile satisfies them; completed barrels first age the round after completion. New `Abandon Barrel` action returns committed cards to discard. **Convert (3:1) removed** — incremental commitment makes stranded resources less common. Distillery roster trimmed: Warehouse, Old-Line, and The Broker retired (their abilities were inert or carved out an awkward final-round asymmetry). Trading is now flatly illegal in the final round, no exceptions. Player count narrowed to 2–4.
- **v2.4** — Composition Buffs added (3+ cask, 3+ corn, 3+ single grain, 2+ capital, all-four-grains). Starter deck setup replaced with random-deal + 3-minute trade window + once-per-player stuck-hand swap. Distillery cards rebuilt as full asymmetric opening packages. Bot heuristics updated.
- **v2.2.x** — Rickhouse bonded/upper tier distinction removed. All slots equivalent; ops cards (Regulatory Inspection, Barrel Broker, Blend) that used to be tier-gated now operate on any aging slot.
- **v2.2** — Action Phase restructured: full turns, not one-action-per-round. Start player rotates each round (last → first). Operations cards moved to purchase-only.
- **v2.1** — Operations cards added (8 effects), Rush to Market and Distressed Sale Notice removed, ops bought from face-up market.
