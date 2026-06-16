// Bourbonomics — the AI policy. Pure & deterministic: given a GameState whose
// current player should be auto-played, `botAction` returns the single next
// Action to take. The client's auto-driver dispatches these one at a time (with
// visual pacing) for every AI seat; the same policy is exercised end-to-end by
// the full-game playthrough test, so the shipped bot is the tested bot.
//
// It is a competent greedy player, not an optimizer: draft toward what your
// resting barrels need, build when you can, sell aged batches (preferring to
// COMPLETE a matching demand card), grow capacity, then end the turn.

import { CONFIG, improvementCost } from "./config";
import { mashFloorDraw, meetsRequirement, rickhouseCapacity, warehouseCap } from "./engine";
import type { Action, Bourbon, DepartmentId, GameState, ResourceKind } from "./types";

const ALL_KINDS: ResourceKind[] = ["cask", "corn", "rye", "wheat", "barley"];
const IMPROVE_PRIORITY: DepartmentId[] = [
  "warehouse",
  "supply",
  "rickhouse",
  "mashFloor",
  "distribution",
  "countingHouse",
  "marketing",
];

/** Resource kinds a resting barrel still needs after its staged cards. */
function need(b: Bourbon): ResourceKind[] {
  const out: ResourceKind[] = [];
  for (const k of ALL_KINDS) {
    const n = (b.recipe[k] ?? 0) - b.staged.filter((c) => c.kind === k).length;
    for (let i = 0; i < n; i++) out.push(k);
  }
  return out;
}

/** True when the engine is waiting on an AI seat to act (collect or play). */
export function isBotTurn(state: GameState): boolean {
  if (state.phase !== "playing") return false;
  if (state.roundPhase !== "collect" && state.roundPhase !== "play") return false;
  return state.players[state.currentPlayerIndex]?.isBot === true;
}

/**
 * The single next action for the current player. Assumes it is that player's
 * collect or play turn (demand-phase BEGIN_COLLECT is driven by the client).
 */
export function botAction(state: GameState): Action {
  const me = state.players[state.currentPlayerIndex]!;

  // ---- Collect: draft toward needs, pass the rest (one COLLECT_CLAIM) ----
  if (state.roundPhase === "collect") {
    const c = state.collect!;
    const room = Math.max(0, warehouseCap(me) - me.hand.length);
    const needs = me.rickhouse.filter((b) => !b.built).flatMap(need);
    const want = [...needs, "cask", "corn", "cask", "barley", "rye", "wheat"] as ResourceKind[];
    const score = (face: string) =>
      face === "anything" ? 2 : needs.includes(face as ResourceKind) ? 3 : want.includes(face as ResourceKind) ? 1 : 0;
    const claims: { dieId: string; pile?: ResourceKind }[] = [];
    for (const die of [...c.dice].sort((a, b) => score(b.face) - score(a.face))) {
      if (claims.length >= room) break;
      if (score(die.face) === 0) continue; // leave junk to pass on
      if (die.face === "anything") {
        claims.push({ dieId: die.id, pile: needs[claims.length % Math.max(1, needs.length)] ?? "cask" });
      } else {
        claims.push({ dieId: die.id });
      }
    }
    return { type: "COLLECT_CLAIM", claims };
  }

  // ---- Play: one action toward selling, building, growing, then END_TURN ----

  // 1. Sell an aged batch into a matching open order (no glut — only sell when
  //    a matching slot exists). Prefer a card it can COMPLETE, then any match.
  const matchOpen = (b: Bourbon) =>
    state.demandCards.filter((dc) => dc.filledBy.includes(null) && meetsRequirement(b, dc.requirement));
  const sellable = me.rickhouse.find((b) => b.built && b.age >= CONFIG.MIN_SELL_AGE && b.salesRemaining > 0 && matchOpen(b).length > 0);
  if (sellable) {
    const matching = matchOpen(sellable);
    const completer = matching.find((dc) => dc.filledBy.filter((f) => f === null).length === 1);
    const target = completer ?? matching[0]!;
    return { type: "SELL", bourbonId: sellable.id, demandCardId: target.id };
  }

  // 2. Stage a hand card a resting barrel still needs.
  for (const b of me.rickhouse.filter((x) => !x.built)) {
    const card = me.hand.find((cd) => need(b).includes(cd.kind));
    if (card) return { type: "STAGE", barrelId: b.id, resourceCardId: card.id };
  }

  // 3. Build a fully-staged resting barrel.
  const buildable = me.rickhouse.find((x) => !x.built && need(x).length === 0);
  if (buildable) return { type: "MAKE_BOURBON", barrelId: buildable.id, resourceCardIds: [] };

  // 4. Draw a bill when there's room and we aren't hoarding resting barrels.
  const resting = me.rickhouse.filter((x) => !x.built).length;
  if (!me.drewMashBillsThisTurn && rickhouseCapacity(me) - me.rickhouse.length > 0 && resting < 2 && state.mashBillSupply.length > 0) {
    const reveal = state.mashBillSupply.slice(0, mashFloorDraw(me));
    const handKinds = me.hand.map((cd) => cd.kind);
    let best = 0, bestScore = -1e9;
    reveal.forEach((bill, i) => {
      let s = 0;
      for (const k of ALL_KINDS) s += Math.min(bill.recipe[k] ?? 0, handKinds.filter((h) => h === k).length);
      s -= Object.values(bill.recipe).reduce((a, n) => a + (n ?? 0), 0) * 0.1; // prefer smaller recipes
      if (s > bestScore) { bestScore = s; best = i; }
    });
    return { type: "DRAW_MASH_BILLS", keepIndexes: [best] };
  }

  // 5. Grow capacity when comfortably affordable (exercises the ramp + ultimates).
  const cost = improvementCost(me.improvements, 0);
  if (me.capital >= cost + 3) {
    const dep =
      IMPROVE_PRIORITY.map((id) => me.distillery.departments.find((d) => d.id === id)!).find((d) => d.level < d.maxLevel) ??
      me.distillery.departments.find((d) => d.level < d.maxLevel);
    if (dep) {
      const toUlt = dep.level + 1 === dep.maxLevel;
      const realUlts = dep.ultimateOptions.filter((u) => u !== "ph");
      const ultimateId = toUlt && realUlts.length ? realUlts[0] : undefined;
      return {
        type: "IMPROVE",
        departmentId: dep.id,
        ...(ultimateId ? { ultimateId } : {}),
        ...(ultimateId === "prospector" ? { ultimatePile: "cask" as ResourceKind } : {}),
      };
    }
  }

  // 6. Nothing left to do.
  return { type: "END_TURN" };
}
