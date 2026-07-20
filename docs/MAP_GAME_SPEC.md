# Bourbonomics: Map Game — Canonical Specification

> **Working title.** This is a *separate product* from the base game (the cozy engine-builder at
> `playbourbonomics.com`, canon in [`GAME_RULES.md`](GAME_RULES.md)). Shared theme, distinct mechanics.

| Field | Value |
|---|---|
| **Status** | Design spec — **v0 prototype implemented & playable** (see §15). Pre-balance. |
| **Spec version** | `0.2.0` |
| **Playable at** | `apps/prototype/src/mapgame/` (pure-TS engine + React UI), route **`/mapgame`**. `npm run dev` → `localhost:3100/mapgame`. |
| **Authority** | This document is **authoritative over any implementation.** If code and spec disagree, the spec wins — fix the code, or change the spec first in the same commit. |
| **All numbers** | Every value tagged `[PH]` is a placeholder pending playtest. See §12 for the full registry. |
| **See also** | [`MAP_GAME_BUILD_SURVEY.md`](MAP_GAME_BUILD_SURVEY.md) — the build brief this codebase implements, plus the resolved design decisions. Where the brief and this spec disagree, the brief (and the code) win. |

---

## 0. Conventions

- **`[PH]`** — placeholder value, not yet tuned. Never hard-code a `[PH]` number without registering it in §12. Prefer a named constant so tuning is one edit.
- **Canonical names** — the `Code name` column in §1 is the source of truth for identifiers (types, enums, actions). Don't invent synonyms in code; if a better name emerges, rename here first.
- **Determinism** — this game has **no hidden randomness in resolution**. No dice. Every outcome is a pure function of committed state. This is a hard design constraint: `resolve(state, commitments)` must be deterministic and replayable. Hidden *information* (face-down commits) exists; hidden *rolls* do not.
- **Player count** — `[PH]`; assume 2–4 for tuning until decided.

---

## 1. Glossary — Canonical Objects

| Term | Code name | Definition | State it carries |
|---|---|---|---|
| **Tile** | `Tile` | A hex representing a slice of consumer taste-space. **Not geography.** | taste traits, optional reward icons |
| **Distribution Point** | `DP` | A player's presence on a tile. | `DPStatus` = `Active` \| `Inactive` |
| **Niche** | `Niche` | A player-declared cluster of ≥5 contiguous controlled tiles. | declared, public, flagged; owner |
| **Bourbon** | `Bourbon` | A card in a player's portfolio. Weapon, shield, identity. | `BourbonState` = `Fresh` \| `Flipped`; `locked` flag; `maturitySlot` (1–5) |
| **Agent** | `Agent` | A worker used to acquire bourbons. | location: `DistillCard` \| `Supply` |
| **Token** | `Token` | Tempo fuel; spent in prelude for bonus actions. | count (per player) |
| **Capital** | `Capital` | **Score *and* attack currency.** Unspent Capital = victory points. | count (per player) |
| **Action Card** | `ActionCard` | Hand card carrying **rank** (initiative) and **bips** (actions). The two are **inverse**. | in hand \| played \| sacrificed |
| **Bip** | `bip` | One unit of action economy granted by an action card. | — |
| **Fit** | `fit` | Derived 0–3 effectiveness of a bourbon against a target tile. | computed, never stored |

---

## 2. Object Model (data shapes)

> Field-level model for the engine. Types are indicative; `[PH]` marks unfixed ranges.

### `Tile`
| Field | Type | Notes |
|---|---|---|
| `id` | id | stable |
| `traits` | `TasteTrait[]` | e.g. `rye`, `wheat`, `corn`, `aged`, `premium`, `channelType` |
| `rewards` | `RewardIcon[]` | `Capital` and/or `Token` icons. Present on ~20–40% of tiles `[PH]` |
| `adjacency` | `TileId[]` | hex neighbors, for contiguity |

### `DP`
| Field | Type | Notes |
|---|---|---|
| `owner` | PlayerId | |
| `tile` | TileId | |
| `status` | `Active` \| `Inactive` | Inactive stays on the tile until repaired or purged |

### `Bourbon`
| Field | Type | Notes |
|---|---|---|
| `traits` | `TasteTrait[]` | for fit matching |
| `basePrice` | Capital | reflects **shape**, not strength (see §4) |
| `ceiling` | 1–3 | max fit it can ever reach |
| `state` | `Fresh` \| `Flipped` | Flipped = already committed this age |
| `locked` | bool | tied to a tile after a winning defense (see §7) |
| `maturitySlot` | 1–5 | **tracked on the player board, never on the card** (see §6) |

### `Player`
| Field | Type | Notes |
|---|---|---|
| `capital` | int | score + ammo |
| `tokens` | int | prelude fuel |
| `hand` | `ActionCard[]` | drawn 5 at age start |
| `cellar` | `Bourbon[5]` | maturity row, slots 1–5 |
| `agents` | int | in supply; placed ones live on `DistillCard`s |

---

## 3. Structure — Turn State Machine

**5 ages × up to 5 rounds.** An **age** is the scoring window.

```
GAME
└─ for age in 1..5:
   ├─ AGE_START
   │    • each player draws action cards to 5
   │    • refresh ALL Flipped bourbons → Fresh
   │    • unlock ALL locked bourbons
   ├─ for round in 1..5 (age may end early — see stop condition [PH]):
   │    ├─ PRELUDE      • players may spend Tokens for bonus actions
   │    └─ ACTION       • each player plays ONE action card
   │                    • resolve in INITIATIVE order (by card rank)
   │                    • a card grants 2–4 bips; a card played FACE-DOWN grants 1 bip
   └─ AGE_END
        • resolve niche harvest (§9)
        • clear the Distill row (unclaimed cards discarded)
        • advance cellar maturity: every bourbon slides one slot right (§6)
```

**Initiative** is set by action-card **rank**. Lower bips ⇄ higher rank (the inverse coupling): committing to fewer actions buys you the right to move first. Ties broken by `[PH]`.

**Age stop condition** (early end) — `[PH]`, flagged in §11.

---

## 4. Tiles & Niches

**Tiles** carry taste traits and optional reward icons. There is **no cap on how many DPs a tile holds** — any number of players may build there; presence is contested by DP count, not by capacity.

- **Board setup:** ~5 tiles per player `[PH]`.
- **Blue-ocean expansion:** players may place additional tiles during play (`PlaceTile`, 1 bip). This is the catch-up / map-growth lane — costing not yet tuned (§11).

**Derived relationships (all computed, never stored):**

| Concept | Definition |
|---|---|
| **Access** | ≥1 **Active** DP on a tile. |
| **Control** | Strictly most **Active** DPs on a tile. Ties → **nobody** controls. |
| **Niche** | ≥5 **contiguous** tiles all under your control. Declared as one action; flags placed. |
| **Niche control** | You control the **majority** of tiles in your declared niche. |
| **Niche monopoly** | **Zero** rival **Active** DPs on **any** tile of the niche. |

**Rules:**
- **Rival DPs entering a declared niche enter `Inactive`.** (Entry into a niche is a foothold, not a foothold that works.)
- **Niche size is unbounded.** `AddTileToNiche` (1 bip) grows harvest potential but makes monopoly harder to hold.
- **`RemoveTileFromNiche`** (1 bip) is defensive consolidation. Dropping below **5** tiles **collapses** the niche.

---

## 5. Bourbons & Fit

**No printed quality tier.** All bourbons are mechanically peer-level in the box. Differentiation is *shape*:

- **Narrow & deep** (expensive): high fit in few markets.
- **Broad & shallow** (cheap): low fit across many.

`basePrice` encodes shape, **not** strength.

### Fit computation

Fit is computed against a **target tile** at commit time. Three caps compose:

```
traitFit(bourbon, tile) =
    0   if bourbon contradicts the tile's taste
    1   if neutral / no relevant trait
    2   if matches exactly one trait
    3   if matches multiple traits

effectiveFit(bourbon, tile) =
    min(
        traitFit(bourbon, tile),      // taste match
        bourbon.ceiling,              // printed max
        maturityAllowance(bourbon.maturitySlot)   // aging gate — [PH] curve, slot → max fit
    )
```

- **`maturityAllowance`** maps a cellar slot (1–5) to the max fit it permits. Exact curve `[PH]` (§12). Intent: a low-maturity bourbon **cannot reach its ceiling** — aging unlocks fit.
- **Fresh / Flipped:** committing a bourbon flips it (`Fresh → Flipped`). Flipped bourbons **cannot be committed again** this age. **All bourbons refresh to Fresh at age start.**

---

## 6. Acquisition — The Distill Board

**One shared deck.** No sorting, no tiers.

**The row:** 5 face-up slots. Each round, cards **slide left**; a new card enters at **position 5**. Unclaimed cards **clear at age end**.

**Position premium** (added to `basePrice`):

| Slot | 1 | 2 | 3 | 4 | 5 |
|---|:-:|:-:|:-:|:-:|:-:|
| **Premium** | +0 | +1 | +1 | +2 | +3 |

`totalCost = basePrice + positionPremium(slot)`

**Two acquisition methods** — each places an agent via `Distill` (1 bip per placement):

| Method | Agents required | Entry maturity | Result |
|---|:-:|:-:|---|
| **Grab** | **1** | slot **1** | Take it at low maturity — capped fit. |
| **Court** | **3** | slot **3** `[PH]` | Take it mature — full ceiling reachable. |

- Agents are **public** and **persist** on the card. A rival can claim a bourbon out from under you by reaching the threshold **first** — **initiative decides the race.** Losing agents return to **supply** with nothing.
- **Capital is paid on claim** (not on agent placement).

**The quality/quantity fork:** 3 bips = one *courted* mature bourbon, **or** three *grabbed* young ones.

---

## 7. Maturity — The Cellar

**Maturity is a board position, never a card field.** The **cellar** is a 5-slot row (1–5); **the slot number *is* the bourbon's maturity.**

- At each **age end**, every bourbon **slides one slot right** (toward 5, more mature).
- **Grabbed** bourbons enter at **slot 1**.
- **Courted** bourbons enter at **slot 3** `[PH]`.
- **Cellar capacity is finite** `[PH]` — aging occupies space; overflow handling is `[PH]` (§11).

---

## 8. Combat — The Push

**No dice. Simultaneous secret reveal. Fully deterministic.**

### Framing
- The **initiator is always the attacker**, regardless of who controls the tile. Clearing squatters from your **own** niche is an *offense*, with an attacker's costs.

### Initiating an attack (`Push`, attack variant)
- Spend **1 bip**.
- Pay **Capital = defender's Active DPs on the tile**.
- **Commit ≥1 bourbon**, face-down.

### Defending
- Commit **0, 1, or more** bourbons, face-down.
- Committing **zero = retreat** — legal and often correct.

### Resolution (deterministic)

```
attackerStrength = attackerActiveDPs(tile) * Σ effectiveFit(b, tile) for b in attackerCommitted
defenderStrength = defenderActiveDPs(tile) * max(1, Σ effectiveFit(b, tile) for b in defenderCommitted)

winner = (attackerStrength > defenderStrength) ? attacker : defender   // TIES → DEFENDER
margin = |attackerStrength - defenderStrength|
damage = min(margin, loserActiveDPs(tile))                             // capped at loser's DPs present

// apply: turn `damage` of the loser's Active DPs → Inactive, one per point of margin
```

- **Defender's floor of 1** means DPs defend even with no product committed → retreat is **survivable, not annihilation**.
- **Ties → defender.**

### Costs (the central asymmetry)

| Role & outcome | Committed bourbons | Rationale |
|---|---|---|
| **Attacker** (win or lose) | **Burned regardless** | Offense is expensive |
| **Defender, wins** | **`locked` to the tile** — cannot attack, cannot defend elsewhere, until age end | Winning immobilizes you |
| **Defender, loses** | **Burned** | — |

> **Attacking mortgages your portfolio. Winning a defense nails it to the board.** This tension is the game.

### Inactive DPs
- **Stay on the tile.** Knocking a rival down does **not** remove their presence.
- `RepairDP` (1 bip) → back to `Active`.
- Removed **only** by a **Purge**.

### Purge (`Push`, purge variant)
- **A purge is an offense.** Initiator pays full attack costs (1 bip + Capital + ≥1 bourbon commit, resolved as combat).
- On success: **remove all Inactive rival DPs** from the tile.

---

## 9. Economy

| Currency | Source | Sink |
|---|---|---|
| **Capital** | Controlled tiles (per age) + `Capital` reward icons | Attacking; bourbon acquisition. **Unspent Capital = score.** |
| **Tokens** | `Token` reward icons | Prelude bonus actions |
| **Bips (actions)** | Action-card bips (2–4); **+1** if the card is sacrificed face-down | Everything |

> **Capital is both score and ammunition.** Every fight literally costs victory points.

---

## 10. Age-End Harvest

Resolved **only at age end** (§3), never between rounds.

| Condition | Reward |
|---|---|
| **Niche control** (majority of tiles) | **1** reward icon of your choice from within the niche |
| **Niche monopoly** (zero rival Active DPs) | **All** reward icons within the niche |

> A single surviving rival DP downgrades monopoly → control. **Denial is cheap; clearing is expensive.** Intentional.

---

## 11. Action Menu (canonical action enum)

| Action | Code name | Cost |
|---|---|:-:|
| Place tile | `PlaceTile` | 1 bip |
| Build DP | `BuildDP` | 2 bips `[PH]` |
| Repair DP (Inactive → Active) | `RepairDP` | 1 bip |
| Push (attack / purge) | `Push` | 1 bip + Capital + ≥1 bourbon |
| Declare niche | `DeclareNiche` | 1 bip |
| Add tile to niche | `AddTileToNiche` | 1 bip |
| Remove tile from niche | `RemoveTileFromNiche` | 1 bip |
| Distill (place 1 agent) | `Distill` | 1 bip |

---

## 12. Placeholder Registry (`[PH]`)

Every unresolved number lives here. Wire each to a **named constant**; tuning = editing this table + the constant.

| Key | Placeholder | Current guess | Notes |
|---|---|---|---|
| `PLAYER_COUNT` | supported range | 2–4 | affects board size |
| `TILE_REWARD_DENSITY` | % of tiles with reward icons | 20–40% | |
| `TILES_PER_PLAYER_SETUP` | starting tiles | ~5 | |
| `COURT_ENTRY_SLOT` | cellar slot for courted bourbons | 3 | |
| `CELLAR_CAPACITY` | cellar size / overflow rule | 5 slots, overflow TBD | |
| `MATURITY_ALLOWANCE_CURVE` | slot (1–5) → max fit | TBD | gates fit by age |
| `BUILD_DP_COST` | bips to build a DP | 2 | |
| `PLACE_TILE_COST` | bips / catch-up costing | 1 | blue-ocean lane not fully tuned |
| `AGE_STOP_CONDITION` | early-end trigger for an age | none / TBD | |
| `INITIATIVE_TIEBREAK` | rank-tie resolution | TBD | |

---

## 13. Open Questions

Unresolved. Flagged for future design sessions — do **not** implement past these without a decision.

1. **Employees / Agents.** Agents are currently undifferentiated from bourbons in role. Do they need a distinct structural job, or be cut?
2. **Win condition.** Capital is score. Sufficient, or do niches also score at game end?
3. **Contested entry.** May a player place a DP onto a tile where a rival has Active DPs **without** initiating a Push? **Recommendation: no** — entry into contested ground is always a fight.
4. **Distillery asymmetry.** The base game has asymmetric distilleries. Does the map game?
5. **Blue-ocean tuning.** Tile placement is the catch-up lane; not yet costed (`PLACE_TILE_COST`).

---

## 14. Change Log

| Version | Date | Change |
|---|---|---|
| `0.1.0` | 2026-07-13 | Initial canonical spec — formalized from design draft. All numbers `[PH]`, pre-playtest. |
| `0.2.0` | 2026-07-13 | **v0 prototype implemented** (`apps/prototype/src/mapgame/`, route `/mapgame`). Engine + playable UI + bots + tests. Records the v0 decisions in §15. |
| `0.2.1` | 2026-07-13 | **Removed shelf capacity entirely.** Tiles no longer cap DP count — any number of DPs may occupy a tile; presence is contested purely by active-DP count. Dropped `Tile.shelfCapacity`, `SHELF_*` config, `shelfUsed`, and all UI/spec references. |

---

## 15. v0 Implementation Notes

Where the prototype had to resolve an open question or simplify for a first
playtest, it is recorded here so **doc and code agree** (per CLAUDE.md, the doc
is authoritative — these are now the canon for v0, to revisit after playtest).

1. **Turn model.** The action-card round is **sequential**, not simultaneous:
   each player picks a card (CHOOSE, in seat order), initiative is computed
   (fewer bips first; sacrifice = 1 bip + last), then players take full turns in
   that order (ACT). Only combat commits are hidden. **Prelude** is folded into
   an in-turn action: *Spend token → +1 bip*.
2. **Fit contradiction (§5).** A tile carries an optional **`averse` trait**
   (~30% of tiles). A committed bourbon with that trait scores fit **0**.
   Otherwise fit = shared-trait count → 1 / 2 / 3, capped by ceiling and
   `maturityAllowance`.
3. **Combat (§8).** v0 **bots are non-aggressive** — they never initiate a Push
   (they expand, distill, declare niches, and *defend*). The human drives
   combat. The **defender's commit is automatic** (a best-fit heuristic), so no
   mid-turn defense prompt is needed. Interactive defense + bot aggression are
   the top post-playtest TODOs (`CONFIG.BOTS_AGGRESSIVE`).
4. **Contested entry (Open Q §13.3).** v0 **allows** building an **active** DP
   onto a contested tile (the "always a fight" recommendation was relaxed to
   keep the board fluid). Entry into a **rival's declared niche** still enters
   **inactive** (spec §3).
5. **Distill row (§6).** The row refills **on claim** (claimed slot removed,
   others slide left, a fresh offer enters at the end). No separate per-round
   slide in v0, so position premiums stay meaningful between claims.
6. **Harvest (§9).** Reward icons are **recurring** — they are not consumed when
   harvested, so a held niche pays every age.
7. **Win condition (Open Q §13.2).** Unspent **Capital** after `AGES` ages.
   Niches contribute only via harvested Capital, not a separate end-game score.
8. **Cellar overflow.** A claim that would exceed `CELLAR_CAPACITY` is refused
   (no auto-discard).
