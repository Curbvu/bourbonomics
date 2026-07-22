// Bourbonomics: Map Game — distillery abilities (brief §17).
//
// The expansion hook. A player's Distillery (data on state) may name an
// `abilityId`; the IMPLEMENTATIONS live here in a registry, never on state, so
// GameState stays structuredClone-safe. runDistilleryTrigger fires at each
// defined trigger moment and applies any matching ability.
//
// The base game ships EMPTY (no abilities), so every trigger is a no-op — the
// architecture exists and is exercised, the content arrives with expansions.
// Prefer economy-modifying abilities (cheaper refresh, extra token) over
// combat-math ones — far easier to balance and they don't slow the Push (§17).

import type { DistilleryTrigger, GameState } from "./types";

export interface DistilleryAbility {
  /** When this ability fires. */
  trigger: DistilleryTrigger;
  /** Pure mutation of the given player within the draft. Economy-only by convention. */
  apply(draft: GameState, playerId: string): void;
}

/** abilityId → implementation. EMPTY at launch (symmetric base game). */
export const DISTILLERY_ABILITIES: Record<string, DistilleryAbility> = {};

/** The default (symmetric) distillery every player starts with. */
export function baseDistillery(name: string) {
  return { name, abilityId: null as string | null };
}

/**
 * Fire a trigger. Applies each player's ability whose trigger matches — optionally
 * scoped to a single player (used by onPushWin / onPushLose, which are about the
 * combatant, not everyone). No-op while the registry is empty.
 */
export function runDistilleryTrigger(draft: GameState, trigger: DistilleryTrigger, onlyPlayerId?: string): void {
  for (const p of draft.players) {
    if (onlyPlayerId && p.id !== onlyPlayerId) continue;
    const id = p.distillery.abilityId;
    if (!id) continue;
    const ability = DISTILLERY_ABILITIES[id];
    if (ability && ability.trigger === trigger) ability.apply(draft, p.id);
  }
}
