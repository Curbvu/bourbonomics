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
  /** v3.6 commit-as-resource — Cooper's Contract / Grain Futures. */
  commitableAs?: "cask" | "grain";
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

  // ── v3.6 Aggression axis ────────────────────────────────────────
  //
  // Five simple attacks fire immediately on PLAY_OPERATIONS_CARD.
  // Sabotage and Whiskey Raid introduce new mechanics (committed-
  // card discard + barrel dump; blind dice contest with defender X)
  // and ship as `implemented: false` until those handlers land.
  // Cooper's Contract / Grain Futures introduce the "commit as
  // resource" pattern with ops-discard return on sale.
  {
    defId: "slow_pour",
    name: "Slow Pour",
    description: "Choose an aging barrel. It does not age next round.",
    flavor: "A quiet word in the warehouse foreman's ear.",
    cost: 1,
    copies: 3,
    implemented: true,
  },
  {
    defId: "spoiled_batch",
    name: "Spoiled Batch",
    description: "Choose an opponent. They discard 1 random card from their hand.",
    flavor: "Something got into the mash. Hard to say what.",
    cost: 1,
    copies: 3,
    implemented: true,
  },
  {
    defId: "audit",
    name: "Audit",
    description: "Reveal an opponent's hand. They discard 1 card of your choice.",
    flavor: "The revenuers are here. They'd like to see your books.",
    cost: 2,
    copies: 2,
    implemented: true,
  },
  {
    defId: "counterfeit_bottles",
    name: "Counterfeit Bottles",
    description:
      "An opponent's next sale reads the demand grid as if demand were 2 lower (floor 0). Tier floor still applies.",
    flavor:
      "Looks like bourbon. Tastes like bourbon. Sells like bourbon. Mostly.",
    cost: 2,
    copies: 2,
    implemented: true,
  },
  {
    defId: "federal_inspector",
    name: "Federal Inspector",
    description:
      "Choose an opponent. They lose 2 Capital and discard 1 card of your choice.",
    flavor: "Some paperwork's gone missing. Yours, apparently.",
    cost: 3,
    copies: 2,
    implemented: true,
  },
  {
    defId: "sabotage",
    name: "Sabotage",
    description:
      "Choose an opponent's aging barrel. Discard 1 committed resource card from it; the barrel is dumped (bill stays attached, rebuild from scratch).",
    flavor: "Someone left the valve open. Or the bunghole. Or the door. All three.",
    cost: 4,
    copies: 2,
    implemented: true,
  },
  {
    defId: "whiskey_raid",
    name: "Whiskey Raid",
    description:
      "Target an opponent's aging barrel of age 2 or less. Defender discards X cards (declared before any roll), both roll 2d6; defender adds X plus +1 per Watchman. Defender wins ties. Attacker wins → barrel transfers; defender loses discarded cards regardless.",
    flavor: "They came over the back fence. Three barrels gone by morning.",
    cost: 3,
    copies: 2,
    implemented: true,
  },
  {
    defId: "coopers_contract",
    name: "Cooper's Contract",
    description:
      "Commit this card to a barrel in place of 1 cask during Make Bourbon. On sale this card returns to the ops discard, not your discard.",
    flavor: "The barrels can wait. The bourbon can't.",
    cost: 1,
    copies: 2,
    implemented: true,
    commitableAs: "cask",
  },
  {
    defId: "grain_futures",
    name: "Grain Futures",
    description:
      "Commit this card to a barrel in place of 1 grain card during Make Bourbon. On sale this card returns to the ops discard, not your discard.",
    flavor: "Grain on credit, due at the still.",
    cost: 2,
    copies: 2,
    implemented: true,
    commitableAs: "grain",
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
        ...(spec.commitableAs ? { commitableAs: spec.commitableAs } : {}),
      });
    }
  }
  return cards;
}

/** Public catalog read for the UI / docs (includes design-only entries). */
export function operationsCardSpecs(): OpsCardSpec[] {
  return SPECS.map((s) => ({ ...s }));
}
