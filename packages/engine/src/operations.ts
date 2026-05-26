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
// Lean catalog: 10 implemented ops cards, 24 copies minted at game
// start.
// ============================================================

interface OpsCardSpec {
  defId: OperationsCardDefId | string;
  name: string;
  description: string;
  /** Witty one-line tagline shown on the card face beneath the name. */
  flavor?: string;
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
    flavor: "A whisper, a wink, a lever pulled.",
    cost: 2,
    copies: 3,
    implemented: true,
  },
  {
    defId: "bourbon_boom",
    name: "Bourbon Boom",
    description: "Demand increases by 2 immediately (capped at 12).",
    flavor: "The whole town's drinking tonight.",
    cost: 3,
    copies: 2,
    implemented: true,
  },
  {
    defId: "glut",
    name: "Glut",
    description: "Demand decreases by 2 immediately (floored at 0).",
    flavor: "Too much bourbon, not enough thirst.",
    cost: 2,
    copies: 2,
    implemented: true,
  },
  {
    defId: "demand_surge",
    name: "Demand Surge",
    description:
      "The Demand Track does not drop when you sell your next barrel this round.",
    flavor: "Hold the price — they'll come back.",
    cost: 3,
    copies: 2,
    implemented: true,
  },

  // ── Production / aging ──────────────────────────────────────────
  {
    defId: "rushed_shipment",
    name: "Rushed Shipment",
    description: "Age one of your barrels twice this round instead of once.",
    flavor: "Skip a winter, ship by spring.",
    cost: 3,
    copies: 3,
    implemented: true,
  },
  {
    defId: "wild_mash",
    name: "Wild Mash",
    description:
      "This turn, treat 1 cask card in your hand as a wild grain when committing to a recipe (or treat 1 grain card as a cask).",
    flavor: "Whatever's in the hopper, that's the recipe.",
    cost: 2,
    copies: 3,
    implemented: true,
  },

  // ── Defensive ───────────────────────────────────────────────────
  {
    defId: "regulatory_inspection",
    name: "Regulatory Inspection",
    description:
      "Target an aging barrel of any player. That barrel may not be aged this round.",
    flavor: "Inspector says: not this round.",
    cost: 3,
    copies: 3,
    implemented: true,
  },

  // ── Sale amplifiers ─────────────────────────────────────────────
  {
    defId: "rating_boost",
    name: "Rating Boost",
    description: "Pre-play. Your next Sell Bourbon gains +2 reputation.",
    flavor: "Critic's pick, just in time.",
    cost: 3,
    copies: 2,
    implemented: true,
  },

  // ── Endgame / draw ──────────────────────────────────────────────
  {
    defId: "allocation",
    name: "Allocation",
    description:
      "Draw 2 mash bills from the Bourbon deck without paying their normal cost.",
    flavor: "Two recipes off the truck — no questions.",
    cost: 3,
    copies: 2,
    implemented: true,
  },
  {
    defId: "kentucky_connection",
    name: "Kentucky Connection",
    description: "Draw 2 cards from your resource deck.",
    flavor: "Old friend. Two cards on the way.",
    cost: 3,
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
        flavor: spec.flavor,
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
