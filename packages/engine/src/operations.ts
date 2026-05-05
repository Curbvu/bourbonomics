import type { OperationsCard, OperationsCardDefId } from "./types";

// ============================================================
// Operations card catalog. Each entry maps to a distinct effect
// resolved by the PLAY_OPERATIONS_CARD action handler.
// ============================================================

interface OpsCardSpec {
  defId: OperationsCardDefId;
  name: string;
  description: string;
  copies: number;
}

const SPECS: OpsCardSpec[] = [
  {
    defId: "market_manipulation",
    name: "Market Manipulation",
    description: "Move the Demand Track up or down by 1.",
    copies: 3,
  },
  {
    defId: "regulatory_inspection",
    name: "Regulatory Inspection",
    description: "Target an upper-tier barrel of any player. That barrel may not be aged this round.",
    copies: 3,
  },
  {
    defId: "rushed_shipment",
    name: "Rushed Shipment",
    description: "Age one of your barrels twice this round instead of once.",
    copies: 3,
  },
  {
    defId: "distressed_sale_notice",
    name: "Distressed Sale Notice",
    description: "Force a player whose rickhouse is full to Rush to Market on a barrel of your choice.",
    copies: 2,
  },
  {
    defId: "barrel_broker",
    name: "Barrel Broker",
    description: "Transfer one of your barrels to another player's empty upper-tier slot for a card payment.",
    copies: 2,
  },
  {
    defId: "market_corner",
    name: "Market Corner",
    description: "Take one face-up market card into your hand without paying its cost. Refill the market.",
    copies: 3,
  },
  {
    defId: "blend",
    name: "Blend",
    description: "Combine two of your own non-bonded barrels into one. Higher age, higher-value mash bill, all cards.",
    copies: 2,
  },
  {
    defId: "demand_surge",
    name: "Demand Surge",
    description: "The Demand Track does not drop when you sell your next barrel this round.",
    copies: 2,
  },
];

export function defaultOperationsDeck(): OperationsCard[] {
  const cards: OperationsCard[] = [];
  let idx = 0;
  for (const spec of SPECS) {
    for (let i = 0; i < spec.copies; i++) {
      cards.push({
        id: `ops_${spec.defId}_${idx++}`,
        defId: spec.defId,
        name: spec.name,
        description: spec.description,
        drawnInRound: 0,
      });
    }
  }
  return cards;
}

export function operationsCardSpecs(): { defId: OperationsCardDefId; name: string; description: string }[] {
  return SPECS.map((s) => ({ defId: s.defId, name: s.name, description: s.description }));
}
