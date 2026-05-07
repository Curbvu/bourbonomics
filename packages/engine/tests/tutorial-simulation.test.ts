/**
 * Smoke check that the v2.9 /tutorial flow reaches each step's
 * advance condition with the deterministic seed=42 starter the
 * client uses. Not a unit test of any single mechanic — it exists
 * to catch the case where seed 42 happens to deal the human a hand
 * with no cask / no corn / no grain and the tutorial stalls at the
 * make-bourbon step.
 */

import { describe, expect, it } from "vitest";
import {
  applyAction,
  buildVanillaDistilleryFor,
  defaultMashBillCatalog,
  initializeGame,
} from "../src/index.js";

const SEED = 42;

function buildTutorialStart() {
  const catalog = defaultMashBillCatalog();
  const players = [
    { id: "human", name: "You", isBot: false },
    { id: "bot1", name: "Tutor", isBot: true },
  ];
  const startingMashBills = [];
  let cursor = 0;
  for (let i = 0; i < players.length; i++) {
    const slice = catalog.slice(cursor, cursor + 3);
    startingMashBills.push(slice);
    cursor += slice.length;
  }
  const bourbonDeck = catalog.slice(cursor);
  const startingDistilleries = players.map((p) =>
    buildVanillaDistilleryFor(p.id),
  );
  return initializeGame({
    seed: SEED,
    players,
    startingMashBills,
    bourbonDeck,
    startingDistilleries,
  });
}

describe("/tutorial seed=42 walkthrough", () => {
  it("phase=starter_deck_draft on entry", () => {
    const s = buildTutorialStart();
    expect(s.phase).toBe("starter_deck_draft");
    expect(s.players[0]!.starterHand.length).toBe(16);
  });

  it("after both starter-pass, phase=draw", () => {
    let s = buildTutorialStart();
    s = applyAction(s, { type: "STARTER_PASS", playerId: "bot1" });
    s = applyAction(s, { type: "STARTER_PASS", playerId: "human" });
    expect(s.phase).toBe("draw");
  });

  it("after both DRAW_HAND, phase=action with start player armed for demand", () => {
    let s = buildTutorialStart();
    s = applyAction(s, { type: "STARTER_PASS", playerId: "bot1" });
    s = applyAction(s, { type: "STARTER_PASS", playerId: "human" });
    s = applyAction(s, { type: "DRAW_HAND", playerId: "human" });
    s = applyAction(s, { type: "DRAW_HAND", playerId: "bot1" });
    expect(s.phase).toBe("action");
    expect(s.currentPlayerIndex).toBe(0);
    expect(s.players[0]!.needsDemandRoll).toBe(true);
  });

  it("human's drawn hand contains at least 1 cask + 1 corn + 1 grain (so they can make their first bourbon)", () => {
    let s = buildTutorialStart();
    s = applyAction(s, { type: "STARTER_PASS", playerId: "bot1" });
    s = applyAction(s, { type: "STARTER_PASS", playerId: "human" });
    s = applyAction(s, { type: "DRAW_HAND", playerId: "human" });
    const hand = s.players[0]!.hand;
    const cask = hand.find((c) => c.subtype === "cask");
    const corn = hand.find((c) => c.subtype === "corn");
    const grain = hand.find(
      (c) =>
        c.subtype === "rye" || c.subtype === "wheat" || c.subtype === "barley",
    );
    expect(cask, "starter hand has no cask — tutorial would stall").toBeDefined();
    expect(corn, "starter hand has no corn — tutorial would stall").toBeDefined();
    expect(grain, "starter hand has no grain — tutorial would stall").toBeDefined();
  });

  it("after roll + make on a tier-1 ready barrel, the barrel transitions to aging (tutorial step 'make-bourbon' advances)", () => {
    let s = buildTutorialStart();
    s = applyAction(s, { type: "STARTER_PASS", playerId: "bot1" });
    s = applyAction(s, { type: "STARTER_PASS", playerId: "human" });
    s = applyAction(s, { type: "DRAW_HAND", playerId: "human" });
    s = applyAction(s, { type: "DRAW_HAND", playerId: "bot1" });
    s = applyAction(s, {
      type: "ROLL_DEMAND",
      playerId: "human",
      roll: [3, 4],
    });
    // Pick the simplest ready barrel (lowest tier first).
    const myBarrels = s.allBarrels.filter(
      (b) => b.ownerId === "human" && b.phase === "ready",
    );
    expect(myBarrels.length).toBeGreaterThan(0);
    const target = myBarrels[0]!;
    const hand = s.players[0]!.hand;
    const cask = hand.find((c) => c.subtype === "cask")!;
    const corn = hand.find((c) => c.subtype === "corn")!;
    const grain = hand.find(
      (c) =>
        c.subtype === "rye" || c.subtype === "wheat" || c.subtype === "barley",
    )!;
    s = applyAction(s, {
      type: "MAKE_BOURBON",
      playerId: "human",
      slotId: target.slotId,
      cardIds: [cask.id, corn.id, grain.id],
    });
    const built = s.allBarrels.find((b) => b.slotId === target.slotId)!;
    // Tier-1 commons require only the universal rule (1 cask + 1 corn
    // + 1 grain), so the barrel should snap straight to aging.
    expect(built.phase).toBe("aging");
    expect(built.completedInRound).toBe(1);
  });

  it("end-to-end: every tutorial step's advance predicate fires in order, ending in a sold barrel", () => {
    // Mirrors the script in TUTORIAL_STEPS — runs the player from
    // start → first sale, asserting each gate flips at the right
    // moment. If a future engine change breaks the tutorial flow this
    // test catches it before a player runs into a stuck step.
    let s = buildTutorialStart();
    const human = () => s.players.find((p) => p.id === "human")!;
    const myBarrel = () =>
      s.allBarrels.find((b) => b.ownerId === "human" && b.phase === "aging");

    // step 5: starter-pass — advances when phase leaves starter_deck_draft
    s = applyAction(s, { type: "STARTER_PASS", playerId: "bot1" });
    s = applyAction(s, { type: "STARTER_PASS", playerId: "human" });
    expect(s.phase).not.toBe("starter_deck_draft");

    // step 6: draw — advances when phase reaches action
    s = applyAction(s, { type: "DRAW_HAND", playerId: "human" });
    s = applyAction(s, { type: "DRAW_HAND", playerId: "bot1" });
    expect(s.phase).toBe("action");

    // step 7: roll-demand — advances when human's needsDemandRoll clears
    expect(human().needsDemandRoll).toBe(true);
    s = applyAction(s, { type: "ROLL_DEMAND", playerId: "human", roll: [3, 4] });
    expect(human().needsDemandRoll).toBe(false);

    // step 8: make-bourbon — advances when human has any aging barrel
    expect(myBarrel()).toBeUndefined();
    const ready = s.allBarrels.find(
      (b) => b.ownerId === "human" && b.phase === "ready",
    )!;
    const hand1 = human().hand;
    s = applyAction(s, {
      type: "MAKE_BOURBON",
      playerId: "human",
      slotId: ready.slotId,
      cardIds: [
        hand1.find((c) => c.subtype === "cask")!.id,
        hand1.find((c) => c.subtype === "corn")!.id,
        hand1.find(
          (c) =>
            c.subtype === "rye" ||
            c.subtype === "wheat" ||
            c.subtype === "barley",
        )!.id,
      ],
    });
    expect(myBarrel()).toBeDefined();
    const startRound = s.round;

    // step 9: end-turn-1 — advances when round ticks. Human passes,
    // bot's turn auto-runs in production via the orchestrator (we
    // simulate by hand here).
    s = applyAction(s, { type: "PASS_TURN", playerId: "human" });
    // Bot now needs to roll demand, then act. Drive its turn.
    s = applyAction(s, { type: "ROLL_DEMAND", playerId: "bot1", roll: [2, 2] });
    s = applyAction(s, { type: "PASS_TURN", playerId: "bot1" });
    expect(s.round).toBeGreaterThan(startRound);
    // Round 2 starts at the rotated start player (idx 1 = bot in a
    // 2-player game). Drive bot's round-2 turn.
    s = applyAction(s, { type: "DRAW_HAND", playerId: "human" });
    s = applyAction(s, { type: "DRAW_HAND", playerId: "bot1" });
    expect(s.phase).toBe("action");
    // Bot is current; roll + pass.
    expect(s.players[s.currentPlayerIndex]!.id).toBe("bot1");
    s = applyAction(s, { type: "ROLL_DEMAND", playerId: "bot1", roll: [2, 2] });
    s = applyAction(s, { type: "PASS_TURN", playerId: "bot1" });
    expect(s.players[s.currentPlayerIndex]!.id).toBe("human");

    // step 10: age-barrel — human rolls, age requirement triggers,
    // human ages → barrel.age >= 1.
    s = applyAction(s, { type: "ROLL_DEMAND", playerId: "human", roll: [2, 2] });
    expect(human().needsAgeBarrels).toBe(true);
    const myAgingBarrel = myBarrel()!;
    const hand2 = human().hand;
    expect(hand2.length).toBeGreaterThan(0);
    s = applyAction(s, {
      type: "AGE_BOURBON",
      playerId: "human",
      barrelId: myAgingBarrel.id,
      cardId: hand2[0]!.id,
    });
    expect(myBarrel()!.age).toBeGreaterThanOrEqual(1);
    expect(human().needsAgeBarrels).toBe(false);

    // step 11: second-end-turn — round 3 needed for barrel.age >= 2.
    // Human passes, bot turn, cleanup, round 3, bot turn, human turn.
    s = applyAction(s, { type: "PASS_TURN", playerId: "human" });
    // Round wraps; in round 3, start player rotates back to human (idx 0).
    s = applyAction(s, { type: "DRAW_HAND", playerId: "human" });
    s = applyAction(s, { type: "DRAW_HAND", playerId: "bot1" });
    expect(s.phase).toBe("action");
    expect(s.players[s.currentPlayerIndex]!.id).toBe("human");

    s = applyAction(s, { type: "ROLL_DEMAND", playerId: "human", roll: [2, 2] });
    expect(human().needsAgeBarrels).toBe(true);
    const hand3 = human().hand;
    s = applyAction(s, {
      type: "AGE_BOURBON",
      playerId: "human",
      barrelId: myBarrel()!.id,
      cardId: hand3[0]!.id,
    });
    expect(myBarrel()!.age).toBeGreaterThanOrEqual(2);

    // step 12: sell — advances when barrelsSold >= 1. Compute the
    // exact reward so the split matches engine expectations.
    expect(human().barrelsSold).toBe(0);
    const saleable = myBarrel()!;
    const bill = saleable.attachedMashBill;
    let ageRow = 0;
    for (let i = 0; i < bill.ageBands.length; i++) {
      if (saleable.age >= bill.ageBands[i]!) ageRow = i;
    }
    let demandCol = 0;
    for (let i = 0; i < bill.demandBands.length; i++) {
      if (s.demand >= bill.demandBands[i]!) demandCol = i;
    }
    const reward = bill.rewardGrid[ageRow]?.[demandCol] ?? 1;
    const hand4 = human().hand;
    expect(hand4.length).toBeGreaterThan(0);
    s = applyAction(s, {
      type: "SELL_BOURBON",
      playerId: "human",
      barrelId: saleable.id,
      reputationSplit: reward,
      cardDrawSplit: 0,
      spendCardId: hand4[0]!.id,
    });
    expect(human().barrelsSold).toBe(1);
  });
});
