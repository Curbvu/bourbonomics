# 🥃 Bourbonomics — Dev Design Commit

**Status:** Ground-up redesign, mid-design. This document is the **current source of truth** for the revised game. It supersedes the prior brand-line ruleset. Sections marked `🚧 TBD` are deliberately unsolved; sections marked `[PH]` are placeholder values pending playtest. Do not invent designs for `🚧 TBD` items.

---

## 1. Overview

A cozy distillery game: gather grain via a shared dice draft, build and age bourbon in your rickhouse, and sell into a shared, forecastable demand market at the right moment. Grow your distillery's departments to draw harder, hold more, and sell richer. When the mash-bill supply runs dry (Ticket to Ride–style clock), most **Capital + Reputation** wins.

- **Players:** 2–6
- **Length:** ~45–60 min (variable with player count is acceptable)
- **Lane:** cozy, production-focused, gentle competition, **no direct player attacks**. "I take more" is allowed; "you get less / you lose X" targeted at an opponent is not.

**Kept from prior version:** five resource types, original **mash bills**, the **age × demand payoff matrix**, rickhouse + two-step build/age, prestige, the bills-run-out clock.
**Removed:** brand lines, placement, slot cards, marketing cards (as prestige source), the 6-action budget, Tasting Room, solo (1p) mode.

---

## 2. The Round — three phases

```
DEMAND  →  COLLECT  →  PLAY  →  (age all bourbon +1)  →  DEMAND …
```

Time advances once per round (aging at end of Play). No fixed round count; the game ends when the mash-bill supply empties (see Clock).

### 2.1 Demand Phase

Demand is laid out for all players and holds for the **entire round** (forecastable). Two card types, both clear at round end.

**Order cards** — **one per player**, dealt each round (scales with table). Each is a fillable order with up to **four trigger sections** (not all cards carry all four):

1. **On Start** — fires when laid out (immediate/environmental).
2. **Requirement** — gate: what a batch must be to fill a slot (tag / age band / quality).
3. **On Fill** — fires each time a slot is filled while the card is *not yet complete*.
4. **On Completed** — fires when the **final** slot is filled: a personal reward to the completer **plus** a market consequence (e.g. demand −1).

- A card holds **N slots** (`[PH]`). Filling pays the batch's `(age × demand)` **matrix value + the card's On Fill/On Completed**. Matrix is the floor; the card is the multiplier (this is where the "magic thread" now lives).
- **Fill-vs-setup tension is intended:** completing pays more than filling, so a player may fill a first slot (handing a later player the completion) or hold hoping to complete it. Cards clear at round end, so holding risks scoring nothing. **Load-bearing tuning number: the On Fill / On Completed ratio** (`[PH]`) — keep On Fill worth taking so the table doesn't sandbag into paralysis.

**Glut cards** (oversupply valve) — **lazy-spawn**: none exists until the first overflow/unmatched sale needs one. A clean round (all legit orders filled) sees no glut and no demand drop.

- **On Start: demand −1** (almost always), firing on entry *before* dumps, so all glut sales cash at the lowered level.
- **Requirement: anything** (also the cozy safety valve — no inventory is ever truly stuck).
- **On Fill: matrix only** (no card bonus).
- **On Completed:** some glut cards drop demand **−1 again**. When a glut fills, **draw the next glut card** (fires its On Start −1) — gluts **cycle within the round**, so sustained overproduction keeps cooling demand.
- **Demand hard floor: 0.** Recovery comes from the next round's fresh cards + the underfill up-force. Practical brake on glut cycling = rickhouse/warehouse throughput.

**Market symmetry:**
- **Overproduction cools demand** (overflow → glut cards, each −1).
- **Underproduction warms demand** (order slots left empty at round end push demand up, `[PH]`).

The **Marketing Department** shapes the order-card layout (see Departments).

### 2.2 Collect Phase — shared dice draft

**One pass around the table, most-Capital-first** (turn-1 tiebreak `[PH]`; this is deliberate — the leader gets first fresh roll, later players inherit a richer pool of pre-rolled dice to keep or reroll, which compensates for going later).

**Resource dice faces:** `cask, corn, rye, wheat, barley, anything`. A type face draws from that pile; **anything** draws from any one pile you choose. **Quality is blind** (Specialty mixed into the decks — `🚧 TBD` distribution). Resources are effectively infinite (no empty-pile handling needed).

**On your collect turn:**
1. **Inherit** leftover dice passed from the previous player; keep any as-is or set the rest to reroll.
2. **Roll/reroll up to your Supply cap.** Inherited-kept + freshly-rolled dice cannot exceed your **Supply** count.
3. **One reroll** of dice you don't like (a **Supply ultimate** grants a second reroll).
4. **Claim** dice → draw the matching pile's top card (blind quality), up to what fits your **Warehouse**.
5. **Pass** unclaimed dice to the next player.

One loop only; when the last player passes, the phase ends and leftover dice return to the pool. Rejected dice are **optionality handed forward**, not waste.

### 2.3 Play Phase — unlimited actions

Round-robin. **No action economy** — take unlimited actions, gated only by resources, departments, and capacity.

| Action | Effect |
|---|---|
| **Draw Mash Bills** | Draw mash bills from the supply as resting unbuilt barrels. Count = **Mash Floor**. **Once per turn.** Undrawn bills cycle back into the supply (only *kept* bills drain the clock). |
| **Make Bourbon** | Commit a recipe's exact cards into a resting barrel (or build a fully-staged barrel). Quality = **best card committed**. Begins aging at age 0 (age 1 with the Char & Toast ultimate). |
| **Sell (Extract)** | Extract one sale from a built, aged batch (age ≥ 2). Route to a matching **order slot** (matrix + card bonus) or to the **glut** (matrix only + cool demand). |
| **Improve Distillery** | Advance one department one step. Cost rises on the per-player linear ramp (see Departments). |

---

## 3. Resources, Building, Aging

- **Five resource types:** cask, corn, rye, wheat, barley. Grain identity (rye/wheat/barley) is the style tag.
- **Quality:** Common / Specialty (and Heritage, prior tier) mixed blind into the decks. `🚧 TBD`: exact distribution and how quality gates payoff (must preserve "**premium is lucky, not bought**" — quality comes blind from the pile, never chosen).
- **Two-step production:** Draw Mash Bills lays a recipe as a resting (non-aging) barrel; Make Bourbon builds it.
- **Staging (NEW):** you may stage **recipe-matched** resource cards onto an existing resting barrel before it builds. Staged cards **leave your hand (free Warehouse cap)** but are **locked to that barrel** (the Long Cellar ultimate unlocks them). Loose (uncommitted) cards still count against Warehouse — so a lucky premium pull with no matching resting barrel sits loose and eats cap (the premium-hold tension lives here).
- **Warehouse cap is a claim-time gate** — you can never *claim* past cap; there is no round-end discard. Built/staged cards don't count; only loose cards do.
- **Aging is set-and-forget:** +1/round at end of Play. Sellable at **age ≥ 2**. No age ceiling.

---

## 4. The Demand Matrix & Selling

- A batch yields a fixed number of sales (`batchQty`). Each Sell extracts one.
- **Payout = `(age × demand)` matrix value + Distribution/card modifiers.** Order sale adds the card's On Fill/On Completed; glut sale is matrix-only and cools demand.
- A batch frees its rickhouse slot when its **last** sale is extracted.

---

## 5. The Distillery — departments & the branch tree

Each player runs a distillery board. Departments are **permanent, no upkeep**. The board places the **office band above the Rickhouse** (offices = inputs/planning/market; Rickhouse = physical production anchor below).

### 5.1 Branch structure (Polytopia-shape + AoE2-differentiation)

Every department is a **branch**: **Base → +1 upgrade → +1 upgrade → Ultimate fork.** The two mid-upgrades are quantitative; the **ultimate is qualitative and powerful**, chosen from several options — but **only a subset of ultimates is offered per distillery** (this is the AoE2 unique-tech differentiation; the department menu is shared, the available ultimates differ by distillery).

**Ultimate design rule:** must be resolvable by **counting or a one-time state change** — never ongoing per-use token-shuffling. (Pass: "3+ barrels → +1 Capital", "barrels start at age 1." Fail: "move age between barrels each round.")

### 5.2 The improvement ramp

**Per-player, linear, persists all game.** Your Nth improvement (across any department) costs the Nth step (`[PH]`, e.g. 1→2→3→4…). Realistically a player affords ~5–6 improvements all game, so departments **compete for scarce slots** — forcing specialization. *(Open: confirm single shared counter vs. per-department counter — current assumption: single shared per-player counter.)*

### 5.3 The seven departments

| Department | Function | Starter (`[PH]`) |
|---|---|---|
| **Supply** | Dice rolled in Collect | 5 dice |
| **Warehouse** | Loose resource cards held | 5 cards |
| **Mash Floor** | Mash bills drawn per Draw Mash Bills | 3 |
| **Marketing Department** | Demand shaping (Demand Phase) | draw 1 card |
| **Distribution** | Sell-side: sell throughput + market-outcome shaping (self-directed only) | `[PH]` |
| **Counting House** | Capital efficiency (ramp discount / interest / softened penalties) | `[PH]` |
| **Rickhouse** | Barrel capacity (resting + aging) | 3 slots |

*(Tasting Room cut. Prestige is now orphaned and must come from the `🚧 TBD` engine — no department fallback remains.)*

### 5.4 Completed branch detail

#### Rickhouse — base 3 → 4 → 5 → ultimate
Ultimates (distilleries offer a subset):
- **Mega Expansion** — +2 slots.
- **Climate Controlled** — one designated barrel ages +2/round.
- **Char & Toast** — every barrel you build starts at **age 1** (not 0).
- **Double Maturation** — a barrel reaching **age 8+** gains **+1 batchQty**.
- **Warehouse Tasting** — while you have **3+ barrels aging**, gain **+1 Capital/round**.

*Camps: capacity (Mega) · aging speed (Climate single / Char & Toast global) · patience-payoff (Double Maturation extra sale / Warehouse Tasting income).*
*Balance watch: aging accelerants (Climate, Char & Toast) are high-leverage; Double Maturation requires games long enough to reach age 8.*

#### Supply — base 5 → 6 → 7 → ultimate
Ultimates (distilleries offer a subset):
- **Second Reroll** — reroll a second time each Collect turn.
- **Overflow Roll** — roll **+2 dice** (beyond the +2 from upgrades).
- **Prospector** — choose **one pile**; claims from that pile **draw 2, keep the better**.
- **Triple Threat** — once per Collect turn, **discard 2 unwanted dice → take 1 die of any face**.

*Camps: consistency (Second Reroll) · volume (Overflow Roll) · quality (Prospector) · flexibility-at-a-cost (Triple Threat).*

#### Warehouse — base 5 → 6 → 7 → ultimate
Ultimates (distilleries offer a subset):
- **Grand Warehouse** — **+3 cap** (hold 10).
- **Quality Sort** — once per round, **1 free blind draw** from any pile (respects cap).
- **Long Cellar** — **staged cards stay swappable** (not locked to the barrel) — pull back or replace a staged card before the barrel builds.

*Camps: capacity (Grand) · free intake (Quality Sort) · staging flexibility (Long Cellar).*
*Balance watch: Quality Sort's compounding free card may be over-chosen.*

#### Mash Floor / Marketing Department / Distribution / Counting House
Branch structure defined (Base → +1 → +1 → ultimate); **mid-tier numbers and ultimate menus still to be designed.** Starters as above.

---

## 6. Capital, Prestige, Scoring

- **Capital:** earned by selling (matrix + modifiers); spent only on **Improve Distillery** (the linear ramp). Banks toward final score.
- **Prestige:** kept; converts to Reputation at game end. **Source is `🚧 TBD`** — must come from the engine (no department supplies it now).
- **Final score:** Capital + Reputation. Most points wins (tiebreak `[PH]`).

---

## 7. The Clock

Ticket to Ride model: the **mash-bill supply** drains as bills are *kept* via Draw Mash Bills (undrawn bills return, don't drain). No fixed round count. When the supply empties, finish the round (equal turns) and score. Rickhouse capacity is the practical throughput limiter.
*(Open watch: a player who never draws bills doesn't advance the clock — confirm the rickhouse throttle naturally forces bill-drawing, or add a rule.)*

---

## 8. Open items

**🚧 TBD (do not invent — design deliberately):**
1. **The engine** — the long-arc thing players develop that makes aligned sales *multiply* over the game. Prestige must fall out of this. (Departments are currently throughput utilities without an archetype-defining spine.)
2. **Prestige source** — orphaned; tied to #1.
3. **Dice → quality detail** — Specialty/Heritage distribution and how quality gates payoff.

**Remaining design (structure known, content pending):**
- Ultimate menus + mid-tier numbers for **Mash Floor, Marketing, Distribution, Counting House**.
- **Distillery roster** — rebuild around the seven departments; each distillery = cost profile + starting positions/caps + which ultimates it offers per branch + (eventually) a signature ability. Defer until the engine is set (signatures may key off it).

**`[PH]` to tune at playtest:**
- The linear ramp values; all department starters and tier values; On Fill/On Completed ratio; order-card slot counts; underfill demand-rise amount; matrix values; batchQty distribution; quality distribution.

**Confirmed structural decisions:**
- 2–6 players; three-phase round; unlimited Play actions; most-Capital-first one-loop dice draft; staging (recipe-matched, locked, off-cap); Warehouse claim-time gate; per-player linear persistent ramp; Polytopia-branch + AoE2-differentiated departments; ultimates must be count-or-state-change simple; no direct attacks; TtR clock.
