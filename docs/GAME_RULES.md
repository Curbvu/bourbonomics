# 🥃 Bourbonomics

A cozy game about running a bourbon distillery: gather grain through a shared dice draft, build and age bourbon in your rickhouse, and sell it into a shared, forecastable demand market at the right moment. Grow your distillery's departments to draw harder, hold more, and sell richer. Each demand order you complete becomes a kept card worth Reputation. When the market is worked dry, the distillery with the most Capital + Reputation wins.

**Players:** 2–6 · **Length:** ~45–60 min (variable with player count is acceptable) · **Complexity:** Medium-light

> **The design.** This is a ground-up redesign. The game turns on one repeated decision — **when and what to sell into a shifting demand market** — and one long arc — **growing your distillery to sell better**. The lane is deliberately cozy: production-focused, gentle competition, **no direct player attacks**. "I take more" is allowed; "you get less / you lose X" aimed at an opponent is not. This document is canonical and authoritative over any code: if doc and code disagree, fix the code. All numbers are **`[PH]` placeholders, pre-playtest** — wired to be adjustable, not balanced.

> **⚠️ Skeleton-test build.** The goal of the current build is to **play the full loop end-to-end in a web version** to validate the chassis. Card *content* (demand cards, mash bills) may be a small placeholder set using the real structure. One structural decision is flagged inline: **the clock** (see §The Clock) — currently demand-deck-driven; swappable.

---

# 🎬 Setup

1. **Resource piles.** Five face-down piles — **cask, corn, rye, wheat, barley** — one per type. **Quality (Common / Specialty / Heritage) is mixed blind into each pile** (`[PH]` distribution). Piles are shared; resources are effectively infinite (no empty-pile handling). A discard beside each pile reshuffles into its own pile.
2. **Resource dice.** A shared pool of dice, each with six faces: **cask, corn, rye, wheat, barley, anything**.
3. **Demand deck.** Shuffle the demand cards into the demand deck. Deal the starting market (see §Demand Phase). *(Card content `[PH]`; structure is real.)*
4. **Mash bills.** Shuffle the mash bills into a supply (reshuffles when drawn-from is exhausted; see §The Clock).
5. **Players.** Each picks a **distillery** (board of departments + cost profile + per-branch ultimate options). Start with **5 Capital** (`[PH]`), **0 Reputation**, an empty warehouse, an empty rickhouse.
6. First-player order is by Capital each round (most Capital first); turn-1 tiebreak `[PH]` (e.g. random).

---

# 🔄 The Round — three phases

```
DEMAND  →  COLLECT  →  PLAY  →  (age all bourbon +1)  →  DEMAND …
```

Time advances once per round (aging at the end of Play). No fixed round count.

---

## 📊 1. Demand Phase

**Draw 2 demand cards** and add them to the shared market. Cards **persist** on the table until **completed** (fully filled); a completed card is removed and **kept by the player who completed it** as Reputation. **Partially filled cards still sit on the table and still count** toward the market total.

### Card structure (four optional sections)

Each demand card may carry any of: **On Start** (fires when laid out), **Requirement** (what a bourbon must be to fill a slot — style tag / age band / quality), **On Fill** (fires each time a slot is filled while incomplete), **On Completed** (fires when the final slot is filled — the completer's reward + any market consequence). Not all cards carry all four.

- **Slots per card = player count** (× the card's slot multiple; most cards 1×, some 2×), so each order holds one fill per player and capacity scales with the table while the *number of cards* stays low and readable.
- **Card effects read the current demand zone** (below) — a card does/pays differently in Low vs. Mid vs. High.

### Demand zones (by total cards on the table)

| Cards on table | Zone |
|---|---|
| 1–4 | **Low** |
| 5–7 | **Mid** |
| 8–9 | **High** |
| **10th card** | **MARKET CRASH** |

The card pile **is** the demand continuum — it persists between rounds, grows when the table underproduces (cards go unfilled), and shrinks only as cards are completed. Higher zone = cards pay/do more (the market is starved). This is forecastable: count the pile.

### Market crash

The crash is checked **at the Demand Phase draw**. If drawing the round's 2 new cards would bring the table to **10 cards**, instead **wipe all cards currently on the table** (uncompleted cards are lost, their rewards unpaid) and the **2 freshly drawn cards become the new market** (reset to Low). The round before a likely crash is the last chance to sell into High.

### Marketing Department

The **Marketing Department** shapes the Demand Phase (e.g. how many cards drawn / a draw-and-select). Effect `[PH]`.

---

## 🎲 2. Collect Phase — shared dice draft

**One pass around the table, most-Capital-first.** (Deliberate: the leader gets first fresh roll; later players inherit a richer pool of pre-rolled dice to keep or reroll, compensating for going later.)

**On your collect turn:**
1. **Inherit** the leftover dice passed from the previous player. Keep any as-is, or set the rest aside to reroll.
2. **Roll up to your Supply cap.** Inherited-kept dice + freshly rolled dice cannot exceed your **Supply** (dice count).
3. **One reroll** of dice you don't like. *(A Supply ultimate grants a second reroll.)*
4. **Claim** dice into resources — each claimed die draws the top card of its matching pile (blind quality); an **anything** die draws from any one pile you choose. Claim up to what fits your **Warehouse**.
5. **Pass** all unclaimed dice to the next player.

One loop only; when the last player passes, the phase ends and leftover dice return to the pool. Rejected dice are optionality handed forward, not waste.

---

## ⚙️ 3. Play Phase — unlimited actions

Round-robin. **No action economy** — take unlimited actions, gated only by resources, departments, and capacity.

| Action | Effect |
|---|---|
| **Draw Mash Bills** | Draw mash bills as resting unbuilt barrels. Count = **Distilling Office** (`[PH]` rename pending — see departments). **Once per turn.** |
| **Stage** | Move a **recipe-matched** resource card from hand onto a resting barrel. Staged cards leave the hand (free Warehouse) but **lock to that barrel** *(a Warehouse ultimate unlocks them)*. |
| **Make Bourbon** | When a resting barrel's recipe is fully met (staged and/or committed from hand), build it. **Quality = best card committed.** Begins aging at age 0 *(age 1 with the Char & Toast ultimate)*. |
| **Sell (Extract)** | Extract one sale from a built, aged batch (age ≥ 2) into a matching **demand card slot** (no glut). See §Selling. Banks Capital every time. |
| **Improve Distillery** | Advance one department one step. Cost rises on the per-player linear ramp (see §The Distillery). |

---

# 🛢️ Resources, Building, Aging

- **Five types:** cask, corn, rye, wheat, barley. Grain identity (rye/wheat/barley) is the style tag used by demand requirements.
- **Quality:** Common / Specialty / Heritage, blind in the piles. Quality sets a barrel's **base value** AND its **age-value ceiling** (below).
- **Two-step production:** Draw Mash Bills lays a recipe as a resting (non-aging) barrel; Stage/Make Bourbon builds it.
- **Warehouse cap is a claim-time gate** — you can never *claim* past cap; there is no round-end discard. Loose (uncommitted) resource cards count against cap; staged/built cards do not. A lucky premium pull with no matching resting barrel sits loose and eats cap (the premium-hold tension).
- **Aging is set-and-forget:** every built barrel ages **+1 at the end of Play**. **No aging ceiling — barrels age freely.** Sellable at **age ≥ 2**.

---

# 💰 Selling (Extraction) — the disaggregated payoff

There is **no payoff matrix.** A sale's Capital is the **sum of three readable parts**:

1. **Barrel value** = quality base + age, **capped by the quality ceiling**:

| Quality | Base | Per-year aging | Ceiling (`[PH]`) |
|---|---|---|---|
| Common | 1 | +1 / year | caps at 4 |
| Specialty | 2 | +1 / year | caps at 8 |
| Heritage | 3 | +1 / year | caps at 12 |

A barrel keeps physically aging past its ceiling, but its **value stops climbing** there. This is the home of the old matrix's "low quality can't ride to high age" behavior — the ceiling lives on **quality**, not the rickhouse.

2. **Demand zone effect** — the card's effect/payout as read in the current zone (Low/Mid/High).

3. **Card alignment** — every sale fills a matching demand-card slot, firing its On Fill / On Completed. **There is no glut:** a barrel can only be sold into an order whose Requirement it meets and that has an open slot; with no eligible order it waits for one. A card's slots equal the **player count** (some cards a multiple of it), so each order holds one fill per player.

**Multi-sale batches:** a built barrel yields several sales over its life (`batchQty`, mostly 2–3, some 4). **Every sale banks Capital** — intermediate or completing. A batch frees its rickhouse slot when its **last** sale is extracted.

**Completing a demand card:** the player who fills a card's **final slot keeps the card** as Reputation. Earlier fillers already banked Capital from their sales; the completer additionally takes the card. (Capital for the work, Reputation for the finish.)

**The magic thread:** a premium (high base + high ceiling), aged (rode the value up), well-timed (High zone), aligned (fills a matching premium order) sale is large because all parts align — the multiply emerges from the sum of aligned parts, no grid.

---

# 🏚️ The Rickhouse

A small area where barrels rest, build, and age.

- **Capacity** (resting + aging barrels) is set by the **Rickhouse department**. Starts at **3 slots** (`[PH]`).
- A resting barrel holds a slot but doesn't age; a built batch ages +1/round and leaves when its last sale is extracted.
- A full rickhouse blocks **Draw Mash Bills** — build and sell to make room.
- **No aging ceiling from the rickhouse** — it governs how *many* barrels, not how *old* they may get.

---

# 🏭 The Distillery — departments & branches

Each player runs a distillery board. Departments are **permanent, no upkeep**. The **office band sits above the Rickhouse** (offices = inputs/planning/market; Rickhouse = production anchor below).

### Branch structure (Polytopia-shape, per-distillery ultimates)

Every department is a branch: **Base → +1 → +1 → Ultimate.** The two mid-steps are quantitative; the **Ultimate is a powerful qualitative effect.** Each distillery offers a **subset of ultimate options per branch** (the asymmetric differentiation). **Ultimate design rule:** resolvable by counting or a one-time state change — never ongoing per-use token-shuffling.

### The improvement ramp

**Per-player, linear, persists all game, single shared counter:** your Nth improvement (across any department) costs the Nth step (`[PH]`, e.g. 1→2→3→4…). A player realistically affords ~5–6 improvements all game, so departments **compete for scarce slots** → forced specialization.

### The seven departments

| Department | Function | Starter (`[PH]`) |
|---|---|---|
| **Supply** | Dice rolled in Collect | 5 dice |
| **Warehouse** | Loose resource cards held | 5 cards |
| **Distilling Office** *(rename pending → "Mash Floor")* | Mash bills drawn per Draw Mash Bills | 3 |
| **Marketing Department** | Demand shaping (Demand Phase) | draw 1 |
| **Distribution** | Sell-side: sell throughput + market-outcome shaping (self-directed only) | `[PH]` |
| **Counting House** | Capital efficiency (ramp discount / interest / softened penalties) | `[PH]` |
| **Rickhouse** | Barrel capacity (resting + aging) | 3 slots |

### Completed branch detail (built; others structurally defined, ultimates `[PH]`)

**Rickhouse** — base 3 → 4 → 5 → ultimate (choose from the distillery's offered subset):
- **Mega Expansion** — +2 slots.
- **Climate Controlled** — one designated barrel ages +2/round.
- **Char & Toast** — every barrel you build starts at age 1.
- **Double Maturation** — a barrel reaching age 8+ gains +1 batchQty.
- **Warehouse Tasting** — while you have 3+ barrels aging, gain +1 Capital/round.

**Supply** — base 5 → 6 → 7 → ultimate:
- **Second Reroll** — reroll a second time each Collect turn.
- **Overflow Roll** — +2 dice.
- **Prospector** — pick one pile; claims from it draw 2, keep the better.
- **Triple Threat** — once per Collect turn, discard 2 unwanted dice → take 1 die of any face.

**Warehouse** — base 5 → 6 → 7 → ultimate:
- **Grand Warehouse** — +3 cap.
- **Quality Sort** — once per round, 1 free blind draw from any pile (respects cap).
- **Long Cellar** — staged cards stay swappable (not locked to the barrel).

*(Distilling Office / Marketing / Distribution / Counting House: branch structure known; mid-tier numbers and ultimate menus `[PH]`, to design.)*

### Asymmetric distilleries

Each distillery = a cost profile (which branches are cheap) + starting positions/caps + which ultimates it offers per branch + (eventually) a signature ability. Roster `[PH]`, to rebuild around these seven departments.

---

# 🪙 Capital, Reputation, Scoring

- **Capital** — banked from **every sale** (the disaggregated payoff). Spent only on **Improve Distillery** (the linear ramp). Banks toward final score.
- **Reputation** — the **completed demand cards you keep**. This is the sole prestige source. (A completed card's Reputation value is printed on it; `[PH]`.)
- **Final score = Capital + Reputation.** Most points wins; tiebreak `[PH]` (e.g. most cards completed).

The two score sources both flow from the single act of selling into demand, differentiated by whether you **participated** in a card (Capital) or **finished** it (the kept card / Reputation).

---

# ⏳ The Clock  ⚠️ DECISION POINT

**Current design: the demand deck is the clock.** Completed cards are **kept by players** and permanently leave the deck, so the deck only depletes. **When the demand deck is exhausted, the game ends** — finish the current round so all players get equal turns, then score. This is self-pacing (the more the table completes, the sooner it ends) and applies the Ticket-to-Ride virtue (the scoring action *is* the clock). It also removes any stall problem.
- Non-kept cards (crashed / cleared) **reshuffle** back into the deck; only **completed-and-kept** cards permanently deplete it. Deck size (`[PH]`) must comfortably outlast a normal game.

**Alternative (swappable in one section): mash-bill supply is the clock** (Ticket-to-Ride; kept mash bills deplete it, demand reshuffles fully). If chosen, watch the stall risk (a player who never draws bills doesn't advance it).

*Build the demand-deck clock; keep the mash-bill-supply clock behind a config flag for A/B testing.*

---

# 🧑‍🤝‍🧑 Player Count

**2–6.** No direct attacks at any count — competition is at the shared edges (the dice pool & its pass, the demand commons & the crash, racing the clock). Demand scales by **card slot depth** (not card count), so the table stays readable at 6p while capacity scales. More players → faster pile growth → more frequent crashes → a more volatile market; fewer players → a slower, more contemplative market. Same rules, different feel by count (free variety).

---

# 🔁 The Core Loop

**Demand Phase** (draw 2 cards, read the zone, check the crash) → **Collect Phase** (roll/inherit/keep/reroll, claim resources into Warehouse, pass leftovers) → **Play Phase** (draw mash bills, stage & make bourbon, sell into demand for Capital + complete cards for Reputation, improve departments) → age all barrels +1 → repeat until the demand deck runs dry → score Capital + Reputation.

---

# 📜 Open items

**`[PH]` to tune at playtest:** the linear ramp values; all department starters/tiers; quality bases & ceilings; demand-card content & slot-depth-per-player; demand-card Reputation values; zone effects; batchQty distribution; quality distribution in piles; demand-deck size vs. game length.

**Structure known, content/design pending:**
- Ultimate menus + mid-tier numbers for **Distilling Office, Marketing, Distribution, Counting House**.
- **Distillery roster** rebuilt around the seven departments (cost profiles, caps, offered ultimates, signatures).
- **Distilling Office** rename to **Mash Floor** (decide and apply consistently).

**Confirmed structural decisions (locked):** 2–6 players; three-phase round; unlimited Play actions; most-Capital-first one-loop dice draft with inherit/keep/reroll; staging (recipe-matched, locked, off-cap); Warehouse claim-time gate; per-player linear shared improvement ramp; Polytopia branches + per-distillery ultimates; ultimates count-or-state-change simple; no aging ceiling (ceiling lives on quality); disaggregated payoff (barrel value + zone + card, no matrix); multi-sale batches, every sale banks Capital; demand = persistent card pile with zones (1-4/5-7/8-9) and crash at 10th card, drawn 2/round, slots scale to player count, completed cards kept as Reputation; prestige source = kept completed cards; score = Capital + Reputation; no direct attacks; demand-deck clock (mash-bill clock behind a flag).
