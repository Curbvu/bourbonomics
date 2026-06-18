# 🥃 Bourbonomics

A cozy game about running a bourbon distillery: gather grain through a shared dice draft, build and age bourbon in your rickhouse, and sell it into a shared, forecastable demand market at the right moment. Grow your distillery's departments to draw harder, hold more, and sell richer. Each demand order you complete becomes a kept card worth Prestige. When the market is worked dry, the distillery with the most Capital + Prestige wins.

**Players:** 2–6 · **Length:** ~45–60 min (variable with player count is acceptable) · **Complexity:** Medium-light

> **The design.** This is a ground-up redesign. The game turns on one repeated decision — **when and what to sell into a shifting demand market** — and one long arc — **growing your distillery to sell better**. The lane is deliberately cozy: production-focused, gentle competition, **no direct player attacks**. "I take more" is allowed; "you get less / you lose X" aimed at an opponent is not. This document is canonical and authoritative over any code: if doc and code disagree, fix the code. All numbers are **`[PH]` placeholders, pre-playtest** — wired to be adjustable, not balanced.

> **⚠️ Skeleton-test build.** The goal of the current build is to **play the full loop end-to-end in a web version** to validate the chassis. Card *content* (demand cards, mash bills) may be a small placeholder set using the real structure. One structural decision is flagged inline: **the clock** (see §The Clock) — currently demand-deck-driven; swappable.

---

# 🎬 Setup

1. **Resource piles.** Five face-down piles — **cask, corn, rye, wheat, barley** — one per type. **Quality (Common / Uncommon / Rare / Epic / Legendary) is mixed blind into each pile** (`[PH]` distribution — Legendary rare). Piles are shared; resources are effectively infinite (no empty-pile handling). A discard beside each pile reshuffles into its own pile.
2. **Resource dice.** A shared pool of dice, each with six faces: **cask, corn, rye, wheat, barley, anything**.
3. **Demand deck.** Shuffle the demand cards into the demand deck. Deal the starting market (see §Demand Phase). *(Card content `[PH]`; structure is real.)*
4. **Mash bills.** Shuffle the mash bills into a supply (reshuffles when drawn-from is exhausted; see §The Clock).
5. **Players.** Each picks a **distillery** (board of departments + cost profile + per-branch ultimate options). Start with **5 Capital** (`[PH]`), **0 Prestige**, an empty warehouse, an empty rickhouse.
6. First-player order is by Capital each round (most Capital first); turn-1 tiebreak `[PH]` (e.g. random).

---

# 🔄 The Round — three phases

```
DEMAND  →  COLLECT  →  PLAY  →  (age all bourbon +1)  →  DEMAND …
```

Time advances once per round (aging at the end of Play). No fixed round count.

---

## 📊 1. Demand Phase

**Draw 1 demand card** and add it to the shared market (the slow drip is what lets the pile climb toward Hot). The game **opens with 2 "any bourbon" cards** so nobody is locked out while producing their first bourbon. Cards **persist** on the table until **completed** (fully filled); a completed card is removed and **kept by the player who completed it** as Prestige. **Partially filled cards still sit on the table and still count** toward the market total.

### Card structure (four optional sections)

Each demand card may carry any of: **On Start** (fires when laid out), **Requirement** (what a bourbon must be to fill a slot — required **tags** / age band / quality), **On Fill** (fires each time a slot is filled while incomplete), **On Completed** (fires when the final slot is filled — the completer's reward + any market consequence). Not all cards carry all four.

- **Open vs. gated (≈50/50):** about half the deck is **"any bourbon"** — the no-lockout floor (anyone can fill it, but it pays **low**: the volume / Common outlet). The other half is **gated** — it requires specific tags (and the premium cards add quality+/age+), and pays **meaningfully more** (the premium outlet). The value gap is the competition mechanism: only the matching bourbon fills a gated order, and the bigger reward is what makes specializing worth it. (Replaces the old glut as the safety valve — **there is no glut**.)
- **Slots per card = 2 × player count** (deep cards), so a single order absorbs a lot of selling and represents a big shared opportunity — a tagged player rushes to fill it before the window closes.
- **Card effects read the current demand zone** (below) — a card does/pays differently in Low vs. Mid vs. Hot.

### Demand zones (by total cards on the table)

| Cards on table | Zone | Sale multiplier |
|---|---|---|
| 1–3 | **Low** | ×1 |
| 4–5 | **Mid** | ×2 |
| 6 | **Hot** | ×3 |
| **7th card** | **MARKET CRASH** |

The card pile **is** the demand continuum — it persists between rounds, grows as cards arrive (1/round) and lingers (deep cards complete slowly), and shrinks only as cards are completed. Higher zone = cards pay more (the market is starved). This is forecastable: count the pile.

### Market crash (passive overflow)

Checked **at the Demand Phase draw**. If drawing this round's card would bring the table to **7 cards**, instead **wipe all cards currently on the table** (uncompleted cards lost — see *What's lost on a wipe*) and redraw the fresh market toward the starting low state. This is the passive correction if the table backs up without a Hot completion.

### ⭐ Hot completion reset (the tension mechanic)

If a player **completes a card while the zone is Hot (6 cards)**, the market resets — but resolution order is critical:
1. The completer **fully resolves first** — banks their sale at the **×3 Hot** multiplier and **keeps the completed card** (Reputation).
2. **Then** every other card on the table is **wiped** (their completions/Reputation forfeited — see below) and the market **resets to 2 open cards** (Low).

So reaching Hot is a **race to be the first to complete**: first-to-cash takes their ×3 and detonates everyone else's held cards. **Low/Mid completions do NOT reset** the market. Hot is a brief, explosive flashpoint — holding for ×3 is lucrative only if you *win* the window; otherwise a defector's Hot completion (or the 7-card crash) wipes you. No targeted attacks — all pressure is the shared market state.

### What's lost on a wipe (crash or Hot reset)

Uncompleted cards are removed and their **completion rewards (the kept card / Reputation) forfeited**. **Capital already banked from intermediate sales is kept** (every sale banked Capital when it happened). So a partial filler keeps their per-sale Capital but loses the shot at that card's Reputation — the *completion* is what's at risk when you hold.

### Marketing Department

The **Marketing Department** shapes the Demand Phase (e.g. how many cards drawn / a draw-and-select). Effect `[PH]`.

---

## 🎲 2. Collect Phase — shared dice draft

**One pass around the table, most-Capital-first.** (Deliberate: the leader rolls a fresh set first; later players inherit a richer pool of pre-rolled dice to cherry-pick, compensating for going later.)

**On your collect turn:**
1. **Inherit** the leftover dice passed from the previous player. They go straight **onto your table** and **count against your Supply cap**.
2. **Keep, then roll.** Tap the inherited dice you want to **keep**; everything else (plus enough fresh dice to fill your table up to your **Supply** cap) is then **rolled**. *(With no inherited dice — e.g. the first player — you simply roll a full fresh set.)* This first roll is **free**.
3. **No reroll at the base level.** *(The Supply "Second Reroll" ultimate grants one extra reroll afterward — keep what you like, reroll the rest.)*
4. **Claim** dice into resources — each claimed die draws the top card of its matching pile (blind quality); an **anything** die draws from any one pile you choose. Claim up to what fits your **Warehouse**.
5. **Pass** all unclaimed dice to the next player.

One loop only; when the last player passes, the phase ends and leftover dice return to the pool. Rejected dice are optionality handed forward, not waste.

---

## ⚙️ 3. Play Phase — unlimited actions

Round-robin. **No action economy** — take unlimited actions, gated only by resources, departments, and capacity.

| Action | Effect |
|---|---|
| **Draw Mash Bills** | Draw mash bills as resting unbuilt barrels. Count = **Mash Floor**. **Once per turn.** |
| **Stage** | Move a **recipe-matched** resource card from hand onto a resting barrel. Staged cards leave the hand (free Warehouse) but **lock to that barrel** *(a Warehouse ultimate unlocks them)*. |
| **Make Bourbon** | When a resting barrel's recipe is fully met (staged and/or committed from hand), build it. **Quality = best card committed.** Begins aging at age 0 *(age 1 with the Char & Toast ultimate)*. |
| **Sell (Extract)** | Extract one sale from a built, aged batch (age ≥ 2) into a matching **demand card slot** (no glut). See §Selling. Banks Capital every time. |
| **Improve Distillery** | Advance one department one step. Cost rises on the per-player linear ramp (see §The Distillery). |

---

# 🛢️ Resources, Building, Aging

- **Five types:** cask, corn, rye, wheat, barley. A bourbon's grain identity seeds its matchable **tags** (below), which demand requirements key off.
- **Quality (five tiers):** **Common · Uncommon · Rare · Epic · Legendary**, blind in the piles (`[PH]` weights — Legendary very rare, Common abundant; the rare pull is the dopamine moment). Quality = best card committed sets a barrel's tier, which sets its **age-value track** (below). UI colors the familiar ladder grey/green/blue/purple/orange.
- **The bourbon rule:** every mash bill requires **exactly 1 cask**, **at least 1 corn**, and **at least 1 grain** (rye / wheat / barley) — no cask/corn-only recipes. More complex bills add more resources.
- **Tags (matchable identity):** every bourbon carries one or more **tags** (seeded with the grain identities — rye / wheat / highCorn / fourGrain / classic). Tags are shown **right-side and color-coded** on both the bourbon card and the demand cards, so filling an order is a visual pattern-match ("my crimson bourbon fills that crimson order"). A demand card's required tags must **all** be present on the bourbon.
- **batchQty by quality:** how many sales a built barrel yields over its life is set by its **quality tier**, NOT its recipe — **Common = 1** (one-and-done), scaling up to **3** at Legendary. Per-bill `batchQtyBias` allows off-curve variance (a Common bill that still yields 2). Data-driven, `[PH]`.
- **Complexity premium (config-driven):** a recipe's *complexity* = how many resources it needs (min 3 = 1 cask + 1 corn + 1 grain). Every resource beyond the minimum grants **more Capital per sale** (a per-sale premium) — the reward for harder recipes that premium orders demand. `[PH]`.
- **Two-step production:** Draw Mash Bills lays a recipe as a resting (non-aging) barrel; Stage/Make Bourbon builds it.
- **Warehouse cap is a claim-time gate** — you can never *claim* past cap; there is no round-end discard. Loose (uncommitted) resource cards count against cap; staged/built cards do not. A lucky premium pull with no matching resting barrel sits loose and eats cap (the premium-hold tension).
- **Aging is set-and-forget:** every built barrel ages **+1 at the end of Play**. **No aging ceiling — barrels age freely.** Sellable at **age ≥ 2**.

---

# 💰 Selling (Extraction) — value off the track, demand as a multiplier

There is **no payoff matrix** and **no formula** for age value. A sale's Capital is:

```
sale_capital = (age_track_value + order_value) × demand_zone_multiplier + complexity_premium + distribution
```

The bourbon's aged value and the matched order's value are summed, then scaled by the demand zone (a simple **×1 / ×2 / ×3**). The complexity premium and Distribution are added flat, outside the multiply.

**1. Age-track value** — read off a printed 1-D table by **(tier, age)** (an editable lookup in config, not a formula). Each tier climbs to the year it caps, then holds (the barrel may keep aging with no further value). `[PH]`:

| Age | Common | Uncommon | Rare | Epic | Legendary |
|----:|:------:|:--------:|:----:|:----:|:---------:|
| 2 | 1 | 1 | 1 | 2 | 2 |
| 4 | **2 (cap)** | 2 | 2 | 3 | 3 |
| 6 | — | **3 (cap)** | 3 | 4 | 4 |
| 8 | — | — | **4 (cap)** | 5 | 5 |
| 12 | — | — | — | **7 (cap)** | 7 |
| 18 | — | — | — | — | **11 (cap)** |

Caps: Common 4/2 · Uncommon 6/3 · Rare 8/4 · Epic 12/7 · Legendary 18/11. **No rickhouse aging ceiling** — barrels age past the cap, the *value* just stops climbing (the ceiling lives on **quality**).

**2. Order value** — each demand card carries a single **order value** that is *added to the bourbon's age value before* the zone multiplier, so a premium order makes the whole sale scale harder in a hot market. (See the Demand catalog.)

**3. Demand zone MULTIPLIER** (the real timing swing) — by total cards on the table: a simple **Low ×1 · Mid ×2 · Hot ×3**, applied to `(age value + order value)`. Reaching/cashing **Hot** is a race (see §Hot completion reset) — it's not a zone you can safely sit in.

**4. Complexity premium & distribution** — the per-sale premium for richer bills (see §Resources) and the **Distribution** department bonus are added **flat**, outside the multiply.

**There is no glut:** every sale fills a matching open order slot; with no eligible order the barrel waits. A card's slots = the **player count** (some a multiple).

*Worked: Common age 2 (value 1) on a Low House Pour (order +1) = (1+1)×1 = **2** (floor). Common age 4 (value 2) on a Hot order (order +1) = (2+1)×3 = **9**. Legendary age 18 (value 11) on a Hot Collector's order (order +4) = (11+4)×3 = **45**. Design intent: dumping cheap young stock into Low/Mid is safe; gambling on being first to cash at Hot pays multiplicatively — if you win the window. Two knobs — the value table & order values (magnitude) and the ×1/×2/×3 (timing).*

**Multi-sale batches:** a built barrel yields `batchQty` sales over its life, set by its **quality** (Common 1 → Legendary 3). **Every sale banks Capital** — intermediate or completing. A batch frees its rickhouse slot when its **last** sale is extracted. A Common is one-and-done (fills exactly one slot); higher tiers fill multiple slots, possibly across different orders / rounds.

**Completing a demand card:** the player who fills a card's **final slot keeps the card** as Prestige. Earlier fillers already banked Capital from their sales; the completer additionally takes the card. (Capital for the work, Prestige for the finish.)

**The magic thread:** a premium (high base + high ceiling), aged (rode the value up), aligned (fills a matching premium order, raising the order value), well-timed (Hot zone ×3) sale is large because every part feeds the same multiply — the big number emerges from aligned parts, no payoff grid.

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
| **Mash Floor** | Mash bills drawn per Draw Mash Bills | 3 |
| **Marketing Department** | Demand cards drawn per Demand Phase | 1 (`[PH]`) |
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
- **Second Reroll** — grants **one** reroll after your roll (the base level gets none).
- **Overflow Roll** — +2 dice.
- **Prospector** — pick one pile; claims from it draw 2, keep the better.
- **Triple Threat** — once per Collect turn, discard 2 unwanted dice → take 1 die of any face.

**Warehouse** — base 5 → 6 → 7 → ultimate:
- **Grand Warehouse** — +3 cap.
- **Quality Sort** — once per round, 1 free blind draw from any pile (respects cap).
- **Long Cellar** — staged cards stay swappable (not locked to the barrel).

*(Mash Floor / Marketing / Distribution / Counting House: branch structure known; mid-tier numbers and ultimate menus `[PH]`, to design.)*

### Asymmetric distilleries

Each distillery = a cost profile (which branches are cheap) + starting positions/caps + which ultimates it offers per branch + (eventually) a signature ability. Roster `[PH]`, to rebuild around these seven departments.

---

# 🪙 Capital, Prestige, Scoring

- **Capital** — banked from **every sale** (the disaggregated payoff). Spent only on **Improve Distillery** (the linear ramp). Banks toward final score.
- **Prestige** — the **completed demand cards you keep**. This is the sole prestige source. (A completed card's Prestige value is printed on it; `[PH]`.)
- **Final score = Capital + Prestige.** Most points wins; tiebreak `[PH]` (e.g. most cards completed).

The two score sources both flow from the single act of selling into demand, differentiated by whether you **participated** in a card (Capital) or **finished** it (the kept card / Prestige).

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

**Demand Phase** (draw 1 card, read the zone, check the crash) → **Collect Phase** (roll/inherit/keep/reroll, claim resources into Warehouse, pass leftovers) → **Play Phase** (draw mash bills, stage & make bourbon, sell into demand for Capital + complete cards for Prestige, improve departments) → age all barrels +1 → repeat until the demand deck runs dry → score Capital + Prestige.

---

# 📜 Open items

**`[PH]` to tune at playtest:** the linear ramp values; all department starters/tiers; quality bases & ceilings; demand-card content & slot-depth-per-player; demand-card Prestige & order values; the open-vs-gated split and its **value gradient**; zone multiplier; batchQty-by-quality curve & per-bill bias; quality distribution in piles; demand-deck size vs. game length.

**Structure known, content/design pending:**
- Ultimate menus + mid-tier numbers for **Mash Floor, Marketing, Distribution, Counting House**.
- **Distillery roster** rebuilt around the seven departments (cost profiles, caps, offered ultimates, signatures).
- Whether **tags** stay the grain identities or split into an orthogonal axis (the tag list is flexible either way; seeded with grain identities).

**Confirmed structural decisions (locked):** 2–6 players; three-phase round; unlimited Play actions; most-Capital-first one-loop dice draft where **inherited dice land on the table and count against Supply, you keep-then-roll once (no base reroll; the Second Reroll ultimate adds one)**; staging (recipe-matched, locked, off-cap); Warehouse claim-time gate; per-player linear shared improvement ramp; Polytopia branches + per-distillery ultimates; ultimates count-or-state-change simple; no aging ceiling (ceiling lives on quality); **payoff = (barrel value + order value) × demand-zone multiplier + complexity premium + distribution, no matrix**; **batchQty set by built quality (Common 1 → Legendary 3, per-bill bias)**; multi-sale batches, every sale banks Capital; **tagged matching — bourbons carry color-coded tags, demand orders require them**; demand = persistent card pile **drawn 1/round (opens with 2 open cards), slots = 2× player count**, zones **1-3 Low / 4-5 Mid / 6 Hot (×1/×2/×3)** and crash at the 7th card; **a completion at Hot resets the market — completer resolves at ×3 and keeps the card FIRST, then all other cards wipe and the market resets to 2 (race to cash first; Low/Mid completions don't reset)**; on any wipe, uncompleted cards' Reputation is forfeit but banked Capital is kept; **~50/50 open ("any bourbon", low value) vs gated (tagged/premium, higher value) — the value gradient is the competition, and there is no glut**; completed cards kept as Prestige; score = Capital + Prestige; no direct attacks; demand-deck clock (mash-bill clock behind a flag).
