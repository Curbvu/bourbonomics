import type { Draft } from "immer";
import type { GameAction, GameState, ValidationResult } from "../types";
import { roll2d6 } from "../rng";
import { emptySlotsFor } from "../state";

type RaidDefenseAction = Extract<GameAction, { type: "RAID_DEFENSE_DECLARE" }>;

/**
 * v3.6 Whiskey Raid — defender's blind declaration + dice contest
 * resolution.
 *
 * The attacker dispatched PLAY_OPERATIONS_CARD with `defId:
 * "whiskey_raid"` and a target barrel. The engine rolled the
 * attacker's 2d6 there and froze the raid into `state.pendingRaid`.
 * This action lets the defender pick how many cards from their hand
 * to discard as defense (X ≥ 0, declared blind) and then resolves
 * the contest in the same apply step.
 *
 * Resolution:
 *   - Roll the defender's 2d6.
 *   - defenderTotal = roll + X + count(watchman).
 *   - attackerTotal = `state.pendingRaid.attackerRoll`.
 *   - Defender wins ties.
 *   - Discarded cards are lost regardless of outcome.
 *   - If the attacker wins, the barrel transfers — bill + every
 *     committed and aging card travel with it to one of the
 *     attacker's open slots.
 */

export function validateRaidDefenseDeclare(
  state: GameState,
  action: RaidDefenseAction,
): ValidationResult {
  const raid = state.pendingRaid;
  if (!raid) {
    return { legal: false, reason: "no raid is pending" };
  }
  if (action.defenderId !== raid.defenderId) {
    return {
      legal: false,
      reason: `defender ${action.defenderId} is not the targeted player`,
    };
  }
  const defender = state.players.find((p) => p.id === action.defenderId);
  if (!defender) {
    return { legal: false, reason: `unknown defender ${action.defenderId}` };
  }
  // Every named card must be in the defender's hand. Duplicates not
  // allowed — each instance is unique.
  if (new Set(action.discardCardIds).size !== action.discardCardIds.length) {
    return { legal: false, reason: "duplicate card id in defense discard" };
  }
  const handIds = new Set(defender.hand.map((c) => c.id));
  for (const id of action.discardCardIds) {
    if (!handIds.has(id)) {
      return {
        legal: false,
        reason: `card ${id} is not in your hand`,
      };
    }
  }
  return { legal: true };
}

export function applyRaidDefenseDeclare(
  draft: Draft<GameState>,
  action: RaidDefenseAction,
): void {
  const raid = draft.pendingRaid!;
  const defender = draft.players.find((p) => p.id === action.defenderId)!;
  const attacker = draft.players.find((p) => p.id === raid.attackerId)!;
  const barrel = draft.allBarrels.find((b) => b.id === raid.targetBarrelId)!;

  // Discard the named cards from the defender's hand to their
  // discard pile. These are lost regardless of who wins — that's the
  // real cost of defense.
  const toDiscard = new Set(action.discardCardIds);
  const discardedCount = action.discardCardIds.length;
  const removed = defender.hand.filter((c) => toDiscard.has(c.id));
  defender.hand = defender.hand.filter((c) => !toDiscard.has(c.id));
  defender.discard.push(...removed);

  // Defender's 2d6 + X + Watchman count. Watchman investment is
  // catalog-only at this writing, but we read the count generically
  // so future copies stack the moment they're acquired.
  const [[a, b], nextState] = roll2d6(draft.rngState);
  draft.rngState = nextState;
  const defenderRoll = a + b;
  const watchmanCount = defender.investments.filter(
    (inv) => inv.defId === "watchman",
  ).length;
  const defenderTotal = defenderRoll + discardedCount + watchmanCount;
  const attackerTotal = raid.attackerRoll;

  if (defenderTotal >= attackerTotal) {
    // Defender wins (ties go to the defender per spec). Barrel
    // stays. pendingRaid clears.
    draft.pendingRaid = null;
    return;
  }

  // Attacker wins — transfer the barrel. Find an open slot for them
  // (we validated ≥1 open slot at raid time, but a slot could have
  // closed via Allocation or a concurrent ops resolution between
  // PLAY_OPERATIONS_CARD and RAID_DEFENSE_DECLARE — be safe).
  const openSlots = emptySlotsFor(draft, attacker.id);
  if (openSlots.length === 0) {
    // Pathological — attacker has no slot to receive. Barrel stays,
    // raid resolves as failure. Defender keeps the barrel; their
    // discards are still lost.
    draft.pendingRaid = null;
    return;
  }
  const targetSlotId = openSlots[0]!;
  barrel.ownerId = attacker.id;
  barrel.slotId = targetSlotId;
  // Carry every committed + aging card along — that's part of the
  // value transfer.
  draft.pendingRaid = null;
}
