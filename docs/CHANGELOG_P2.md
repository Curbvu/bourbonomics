# Bourbonomics P2 (prototype) — changelog

Scoped to the **P2 prototype** (`apps/prototype` + `packages/prototype-engine`). The
**P1** live game (`packages/{engine,client,server}`) is untouched; the prototype stays
fully isolated and imports no P1 code. Canonical rules: [`GAME_RULES_P2.md`](GAME_RULES_P2.md).

All content and balance values are **placeholder, pre-playtest**.

---

## UI — resource-selection contrast

Stronger selected/unselected contrast wherever resource cards are picked (hand fan and
the market shelf): the chosen cards **brighten, scale up, lift, and gain a gold ring**
while the rest **dim**. Implemented in `CardTile` (selected/dim styles), `MarketShelf`
(dim once any card is picked), `GameClient` (hand passes `dim`), and `HandFan` +
`globals.css` (`.hand-fan-card--selected` lifts the whole fan slot clear of neighbors).

## Slot Cards (Brand Lines) — five frozen designs

Adds the five frozen slot-card designs — **Standard, Flagship, Expressions,
Workhorse, Single Barrel** — to the prototype engine and UI, plus the production
flow that feeds them. Twelve copies of each card ship via
`buildSlotCardSupply()` (`content.ts` → `SLOT_CARD_DEFS`, defIds
`slot_standard`, `slot_flagship`, `slot_expressions`, `slot_workhorse`,
`slot_single_barrel`).

See [`GAME_RULES_P2.md`](GAME_RULES_P2.md) for canonical behavior, including the
**Workhorse carve-out** (six flat, position-independent slots — the deliberate
exception to "rewards scale with position").

### Minimal schema extensions

Reward model (new):

- `RewardLeaf` — `{ capital?, prestige?, resources?, prestigeFromAge? }`. The atom
  a slot pays out. `prestigeFromAge` converts the placed bottle's age into prestige.
- `SlotRewardSpec` — a tagged union of reward shapes:
  - `flat` — `{ kind: "flat", reward: RewardLeaf }`.
  - `choice` — `{ kind: "choice", options: RewardLeaf[] }`; the player picks a
    branch at placement (`SELL_BOURBON.rewardChoice`).
  - `gated` — `{ kind: "gated", gate, hit: RewardLeaf, miss: RewardLeaf }`; pays
    `hit` when the gate (e.g. `minAge`, quality) is met, else `miss`.
- `SlotSpec` — `{ reward: SlotRewardSpec, optional?, matchAgeOfSlot? }`.
  `matchAgeOfSlot` pairs an optional slot to a required one (Expressions).

`SlotCard` (extended):

- `slots: SlotSpec[]` — replaces the old flat `slotRewards`; each slot carries its
  own reward spec and placement constraints.
- `houseStyleBonus?: number` — end-game prestige bonus, evaluated once at scoring
  (`scorePlayer` → `houseStyleBonus(line)`), not at placement.

### Actions

- `SELL_BOURBON` — extended to `{ ..., brandLineId, slotIndex, rewardChoice? }`.
  The player chooses the target brand line and slot; the engine enforces the
  age-ceiling staircase, optional-slot age matching, and slot occupancy, then
  fires the slot's reward (resolving `rewardChoice` for `choice` slots).

### Notes

- **Bot heuristics** for the new cards are intentionally deferred to a separate
  batch — the AI does not yet reason about slot cards.

## Two-step production + resource market

Reworks production into a deliberate two-action sequence and adds a face-up
resource market.

- **Unbuilt barrels.** `DRAW_MASH_BILLS` now lays a kept recipe down as an
  **unbuilt barrel** resting in the rickhouse: it shows the recipe it needs, takes a
  rickhouse slot, and does **not** age. `MAKE_BOURBON { barrelId, resourceCardIds }`
  commits the exact recipe from hand to build it, starting it aging at age 0 with
  quality set by the best card committed. The rickhouse cap now blocks **Draw Mash
  Bills** (laying down), not Make Bourbon.
- **Resource market.** New `TAKE_MARKET_RESOURCES { cardIds }` lets a player take
  `RESOURCE_DRAW_COUNT` of an 8-card face-up market (`resourceMarket`,
  take-and-refill), alongside the blind `DRAW_RESOURCES`.
- **Schema:** `Bourbon` gains `built`, `recipe`, and `expression`; `MashBill` gains
  `expression` (carried onto the built bottle, read by the Expressions line).

## prototype v0.1 — core engine skeleton

6-action round-robin loop, communal resource pool, make/age/sell pipeline,
age × demand matrix selling, brand-line age-ceiling staircase with
floor/ceiling placement, trait-gated stackable marketing, Capital + prestige
scoring, bills-run-out end. Isolated under `packages/prototype-engine` +
`apps/prototype`, deployed to `prototype.bourbonomics.com`. Live (P1) game
unaffected.

> Out of scope for the skeleton batch: bots/AI, multiplayer/networking,
> investments, cascades, demand-coordination activation, and marketing-stacking
> depth tuning.
