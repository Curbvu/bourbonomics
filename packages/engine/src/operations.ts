import type { OperationsCard, OperationsCardDefId } from "./types";

// ============================================================
// Operations card catalog (engine-side mirror of
// `packages/engine/content/operations.yaml`).
//
// The YAML is the canonical, human-editable source of truth. When you
// edit it, mirror the change in this file — same defIds, same costs,
// same copy counts, same `implemented` flags. Future TODO is a build
// script that generates this file from the YAML; until then, keep the
// two in sync by hand.
//
// Only entries marked `implemented: true` are minted into the deck.
// Design-only entries are documented but skipped, so the engine never
// produces an OperationsCard for an effect it cannot resolve.
// ============================================================

interface OpsCardSpec {
  defId: OperationsCardDefId | string;
  name: string;
  description: string;
  cost: number;
  copies: number;
  implemented: boolean;
}

const SPECS: OpsCardSpec[] = [
  // ── Demand manipulation ─────────────────────────────────────────
  {
    defId: "market_manipulation",
    name: "Market Manipulation",
    description: "Move the Demand Track up or down by 1.",
    cost: 3,
    copies: 3,
    implemented: true,
  },
  {
    defId: "bourbon_boom",
    name: "Bourbon Boom",
    description: "Demand increases by 2 immediately (capped at 12).",
    cost: 4,
    copies: 2,
    implemented: true,
  },
  {
    defId: "glut",
    name: "Glut",
    description: "Demand decreases by 2 immediately (floored at 0).",
    cost: 3,
    copies: 2,
    implemented: true,
  },

  // ── Counter-play / flood enable ─────────────────────────────────
  {
    defId: "demand_surge",
    name: "Demand Surge",
    description:
      "The Demand Track does not drop when you sell your next barrel this round.",
    cost: 4,
    copies: 2,
    implemented: true,
  },

  // ── Production / aging ──────────────────────────────────────────
  {
    defId: "rushed_shipment",
    name: "Rushed Shipment",
    description: "Age one of your barrels twice this round instead of once.",
    cost: 4,
    copies: 3,
    implemented: true,
  },
  {
    defId: "forced_cure",
    name: "Forced Cure",
    description:
      "Place an extra aging card on one of your barrels for one extra year this round.",
    cost: 4,
    copies: 2,
    implemented: true,
  },
  {
    defId: "mash_futures",
    name: "Mash Futures",
    description:
      "Pre-play. Your next Make Bourbon needs 1 fewer grain card (minimum 1 grain still required).",
    cost: 3,
    copies: 2,
    implemented: true,
  },
  {
    defId: "coopers_contract",
    name: "Cooper's Contract",
    description:
      "Pre-play. Your next Make Bourbon may use 0 cask cards instead of the required 1.",
    cost: 2,
    copies: 2,
    implemented: true,
  },

  // ── Market & economy ────────────────────────────────────────────
  {
    defId: "market_corner",
    name: "Market Corner",
    description:
      "Take one face-up market card into your hand without paying its cost. Refill the market.",
    cost: 5,
    copies: 3,
    implemented: true,
  },
  {
    defId: "insider_buyer",
    name: "Insider Buyer",
    description:
      "Discard the entire 10-card market conveyor and refill from supply.",
    cost: 3,
    copies: 2,
    implemented: true,
  },
  {
    defId: "kentucky_connection",
    name: "Kentucky Connection",
    description: "Draw 2 cards from your resource deck.",
    cost: 2,
    copies: 3,
    implemented: true,
  },
  {
    defId: "bottling_run",
    name: "Bottling Run",
    description: "Every player draws 1 card from their resource deck.",
    cost: 3,
    copies: 2,
    implemented: true,
  },
  {
    defId: "cash_out",
    name: "Cash Out",
    description:
      "Discard every resource card in your hand. Gain that many $1 capital cards in your discard.",
    cost: 1,
    copies: 3,
    implemented: true,
  },

  // ── Endgame & clock ─────────────────────────────────────────────
  {
    defId: "allocation",
    name: "Allocation",
    description:
      "Draw 2 mash bills from the Bourbon deck without paying their normal cost.",
    cost: 4,
    copies: 2,
    implemented: true,
  },

  // ── Defensive / reactive ────────────────────────────────────────
  {
    defId: "regulatory_inspection",
    name: "Regulatory Inspection",
    description:
      "Target a barrel of any player. That barrel may not be aged this round.",
    cost: 5,
    copies: 3,
    implemented: true,
  },
  {
    defId: "barrel_broker",
    name: "Barrel Broker",
    description:
      "Transfer one of your barrels to another player's empty rickhouse slot for a card payment.",
    cost: 6,
    copies: 2,
    implemented: true,
  },
  {
    defId: "blend",
    name: "Blend",
    description:
      "Combine two of your own barrels into one. Higher age, higher-value mash bill, all cards.",
    cost: 6,
    copies: 2,
    implemented: true,
  },

  // ── Sale amplifiers / persistent buffs ─────────────────────────
  {
    defId: "rating_boost",
    name: "Rating Boost",
    description: "Pre-play. Your next Sell Bourbon gains +2 reputation.",
    cost: 4,
    copies: 2,
    implemented: true,
  },
  {
    defId: "master_distiller",
    name: "Master Distiller",
    description:
      "Choose one of your barrels. For the rest of the game, that barrel reads its grid as if demand were 2 higher.",
    cost: 6,
    copies: 2,
    implemented: true,
  },

  // ── Persistent infrastructure ───────────────────────────────────
  {
    defId: "rickhouse_expansion_permit",
    name: "Rickhouse Expansion Permit",
    description:
      "Permanently gain 1 additional rickhouse slot (max 6 total).",
    cost: 6,
    copies: 2,
    implemented: true,
  },
];

/** Build the shuffled-source operations deck. Skips design-only specs. */
export function defaultOperationsDeck(): OperationsCard[] {
  const cards: OperationsCard[] = [];
  let idx = 0;
  for (const spec of SPECS) {
    if (!spec.implemented) continue;
    for (let i = 0; i < spec.copies; i++) {
      cards.push({
        id: `ops_${spec.defId}_${idx++}`,
        defId: spec.defId as OperationsCardDefId,
        name: spec.name,
        description: spec.description,
        cost: spec.cost,
        drawnInRound: 0,
      });
    }
  }
  return cards;
}

/** Public catalog read for the UI / docs (includes design-only entries). */
export function operationsCardSpecs(): OpsCardSpec[] {
  return SPECS.map((s) => ({ ...s }));
}
