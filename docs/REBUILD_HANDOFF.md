# Bourbonomics — Ground-Up Rebuild Handoff (Claude Code)

## Goal
Rebuild Bourbonomics to match the new `GAME_RULES.md` (canonical, authoritative — if doc and code disagree, fix the code). **Target: a playable web skeleton that runs the full loop end-to-end for 2–6 players**, so the chassis can be playtested. Card *content* may be a small placeholder set, but every *structural* system in the rules must work. **All numbers are `[PH]` — config-driven, never hardcoded.**

**Stack (unchanged):** Cloudflare Workers / PartyKit (Durable Objects = per-room authoritative state), TypeScript/React monorepo, `apps/prototype` + `packages/prototype-engine`. Inherit existing UI/UX where it transfers; expect heavy rework (the game is structurally different now).

---

## ⚠️ Survey-and-confirm gate (FIRST — stop and wait for confirmation)

Before any code, survey the current codebase and report:
1. **Carries forward:** mash-bill data, the five resource types, rickhouse + two-step build/age, the Capital/Reputation counters, basic distillery board scaffolding. Confirm where each lives.
2. **Delete entirely:** brand lines, placement, slot cards, marketing cards (old impl), the 6-action budget, the `age × demand` **payoff matrix**, Tasting Room, the old single-phase round loop, the old pile-budget/overflow/cost-spike Collect, any "collections" layer if present, solo (1p) mode. List the blast radius.
3. **Build new:** three-phase round state machine; demand-card-pile system (zones, crash, slots-scale-to-player-count, completed-cards-kept); dice-draft Collect (most-Capital-first, inherit/keep/reroll/pass); disaggregated sell payoff (barrel value w/ quality ceiling + zone + card); seven departments on a per-player linear shared ramp with per-distillery ultimate subsets; demand-deck clock.
4. **Config flags to expose:** clock mode (`demand_deck` default | `mash_bill_supply`); all `[PH]` values in one config module.

**STOP. Wait for confirmation before Batch 1.**

---

## Batches (after confirmation)

### Batch 1 — Teardown + three-phase skeleton
- Strip the deleted systems. Replace round loop with `DEMAND → COLLECT → PLAY → (age +1) → DEMAND`. Authoritative phase in the DO; no out-of-phase actions.
- Keep mash bills, rickhouse, aging, Capital/Reputation counters.
- **Verify:** 2–6p game cycles phases with no actions wired.

### Batch 2 — Demand system (the spine; build this early, it's the core)
- **Demand deck**; draw **2 cards/round** in the Demand Phase. Cards persist until completed.
- **Four-section card grammar** (On Start / Requirement / On Fill / On Completed; sections optional). Placeholder card set using the real structure.
- **Slots per card scale to player count** (print max, activate N by player count).
- **Zones by total cards on table:** 1–4 Low, 5–7 Mid, 8–9 High. Card effects read the current zone.
- **Crash at the 10th card:** checked at the Demand-Phase draw — if the 2-card draw would reach 10, wipe all table cards (uncompleted lost) and the 2 new cards become the market (Low).
- **Completed cards are kept by the completing player** (Reputation); partial fills remain on the table and count toward the total.
- **Clock:** completed-and-kept cards permanently deplete the demand deck; crashed/cleared cards reshuffle. **Game ends when the demand deck is exhausted** (finish the round). (Behind a flag: mash-bill-supply clock instead.)
- **Verify:** zones compute by count; crash fires correctly at the draw; completed cards leave to the player; deck depletes via completions and ends the game; scales 2–6p via slot depth.

### Batch 3 — Collect Phase (dice draft)
- Dice faces: cask/corn/rye/wheat/barley/anything. **Most-Capital-first** order (tiebreak `[PH]`).
- Per turn: inherit leftover dice → keep/reroll up to **Supply** cap → **one reroll** (second with Supply ultimate) → **claim** dice (type→pile, anything→chosen pile, blind quality) up to **Warehouse** cap → pass leftovers. **One loop**, then leftovers return to pool.
- **Verify:** caps enforced; reroll limited; inheritance/pass correct; Warehouse never overfills; works at 2p and 6p.

### Batch 4 — Building, aging, selling (disaggregated payoff)
- Two-step production: Draw Mash Bills (once/turn, count = Distilling Office) → resting barrel. **Stage** recipe-matched cards (leave hand, free Warehouse, lock to barrel). **Make Bourbon** when recipe met; **quality = best card**; age 0 (or 1 w/ Char & Toast).
- Aging +1/round at end of Play; **no ceiling**. Sellable age ≥ 2.
- **Sell payoff = barrel value (quality base + age, capped by quality ceiling) + zone effect + card alignment.** Glut = barrel value only. **Multi-sale batches** (`batchQty`); **every sale banks Capital**; final sale frees the slot; completing a card's final slot gives the card to the seller.
- **Verify:** quality ceiling caps barrel value but not physical age; every sale pays Capital; completion transfers the kept card; glut path works; full game playable start→deck-exhaustion at 2p and 6p.

### Batch 5 — Departments + linear ramp
- Seven departments (Supply, Warehouse, Distilling Office, Marketing, Distribution, Counting House, Rickhouse) with starters from the rules.
- **Improve Distillery:** single shared per-player improvement counter, **linear cost, persists all game.**
- Branch = Base → +1 → +1 → **Ultimate** (per-distillery offered subset). Implement the **built** ultimate menus for Rickhouse, Supply, Warehouse (in rules); leave the other four branches' ultimates as `[PH]` stubs.
- **Verify:** ramp cost rises per player correctly; department caps drive Collect (Supply/Warehouse), Draw Mash Bills (Distilling Office), selling (Distribution); ultimates fire.

### Batch 6 — UI/UX for the skeleton test
- Inherit existing visual style. Build/repair: **phase tracker**; **demand market** (card pile w/ zone indicator + crash proximity + per-card slots and fill state + your kept cards); **dice-draft panel** (inherit/keep/reroll/claim/pass with the "X inherited + Y fresh" explainer); **rickhouse** (barrels with age + quality, staging affordance); **warehouse** (loose cards vs. cap); **department board** (seven branches, shared ramp cost, ultimate picks); **clock readout** (demand deck remaining). Show `[PH]`/TBD badges where content is placeholder.
- **Verify:** a human can play a full 2–6p game through the UI without console knowledge.

---

## Verification checklist
- [ ] 2–6p; phase order enforced; no out-of-phase actions.
- [ ] Demand: 2/round; zones 1-4/5-7/8-9; crash at 10th at draw; slots scale to player count; partial fills count; completed cards kept by completer.
- [ ] Clock: demand deck depletes via kept completions; game ends on exhaustion; mash-bill clock available behind a flag.
- [ ] Collect: most-Capital-first; inherit/keep/reroll-once (+2nd w/ ultimate); Supply & Warehouse caps; one loop; leftovers pass then return.
- [ ] Sell payoff = barrel value (quality base + age, quality ceiling) + zone + card; glut = value only; every sale banks Capital; multi-sale batches; completion transfers card.
- [ ] No aging ceiling; ceiling on quality only.
- [ ] Per-player linear shared improvement ramp; built ultimates (Rickhouse/Supply/Warehouse) work; other branches stubbed.
- [ ] Score = Capital + Reputation(kept cards).
- [ ] All numbers `[PH]` and config-adjustable; clock mode is a flag.

## Do NOT
- Do not reintroduce brand lines, placement, slot cards, the action budget, the payoff matrix, Tasting Room, or a separate collections layer.
- Do not hardcode balance numbers.
- Do not invent demand-card *mechanics*; use the four-section grammar with placeholder content.
- Do not design the four unbuilt ultimate menus — stub them.
- Do not add an aging ceiling (it lives on quality).
