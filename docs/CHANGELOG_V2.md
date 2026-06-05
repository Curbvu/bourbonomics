# Bourbonomics v2 (prototype) — changelog

Scoped to the **p2 prototype** (`apps/prototype` + `packages/prototype-engine`). The
p1 live game is untouched; the prototype stays fully isolated.

## Slot Cards (Brand Lines) — five frozen designs

Adds the five frozen slot-card designs — **Standard, Flagship, Expressions,
Workhorse, Single Barrel** — to the prototype engine and UI, plus the production
flow that feeds them. Twelve copies of each card ship via
`buildSlotCardSupply()` (`content.ts` → `SLOT_CARD_DEFS`, defIds
`slot_standard`, `slot_flagship`, `slot_expressions`, `slot_workhorse`,
`slot_single_barrel`).

See [`GAME_RULES_V2.md`](GAME_RULES_V2.md) for canonical behavior, including the
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

`Bourbon` (extended):

- `expression?: string` — the bourbon's expression (used by Expressions'
  paired-slot matching and the house-style bonus).
- `recipe?: Partial<Record<ResourceKind, number>>` — the resources an unbuilt
  barrel needs before it can be built.
- `built: boolean` — `false` for a resting mash bill (a recipe placeholder that
  does **not** age), `true` once resources are committed.

`MashBill` (extended):

- `expression?: string` — carried onto the built bourbon.

### Actions

- `MAKE_BOURBON` — `{ barrelId, resourceCardIds }`. Commits the selected hand
  resources into an unbuilt barrel in **one action**: validates the recipe, marks
  the barrel `built`, starts aging at age 0, and sets quality to the best
  committed tier. Resting mash bills enter the rickhouse as unbuilt barrels when
  drawn (`DRAW_MASH_BILLS`) and only age once built.
- `SELL_BOURBON` — extended to `{ ..., brandLineId, slotIndex, rewardChoice? }`.
  The player chooses the target brand line and slot; the engine enforces the
  age-ceiling staircase, optional-slot age matching, and slot occupancy, then
  fires the slot's reward (resolving `rewardChoice` for `choice` slots).

### Notes

- Balance values (rewards, bonuses, age ceilings) are **provisional, pre-playtest**.
- **Bot heuristics** for the new cards are intentionally deferred to a separate
  batch — the AI does not yet reason about slot cards.
