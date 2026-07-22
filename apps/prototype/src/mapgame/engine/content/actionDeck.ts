// Bourbonomics: Map Game — action deck (brief v4 §15c).
//
// 45 cards (6 suits × 5 designs, with copies — the §15c copy list sums to 45).
// Each card carries `pips` and a bourbon-initiative `icon` (the last icon played
// takes the marker — §4). No numeric rank. The two breadth-1 suits (Distribution,
// Distill) carry the highest pips (top designs 5/5/4 → distinct sum ~19); the
// breadth-2 suits sum ~15–16. All values [PH].

import type { ActionCard, Suit } from "../types";

type CardSeed = { name: string; pips: number; icon: boolean; copies: number };

const DECK: Record<Suit, CardSeed[]> = {
  DISTRIBUTION: [
    { name: "Route Expansion", pips: 5, icon: false, copies: 2 },
    { name: "Field Buildout", pips: 5, icon: false, copies: 2 },
    { name: "Shelf Placement", pips: 4, icon: false, copies: 2 },
    { name: "Merchandising", pips: 3, icon: true, copies: 2 },
    { name: "Rapid Rollout", pips: 2, icon: true, copies: 2 },
  ],
  SALES: [
    { name: "Contract War", pips: 4, icon: false, copies: 1 },
    { name: "Territory Push", pips: 3, icon: false, copies: 2 },
    { name: "Account Offensive", pips: 3, icon: false, copies: 2 },
    { name: "Closing Call", pips: 3, icon: true, copies: 1 },
    { name: "Cold Strike", pips: 2, icon: true, copies: 1 },
  ],
  MARKETING: [
    { name: "Brand Campaign", pips: 4, icon: false, copies: 2 },
    { name: "Repositioning", pips: 4, icon: false, copies: 1 },
    { name: "Category Play", pips: 3, icon: false, copies: 2 },
    { name: "Rebrand", pips: 3, icon: true, copies: 1 },
    { name: "Ad Blitz", pips: 2, icon: true, copies: 1 },
  ],
  BUSINESS_DEV: [
    { name: "Aggressive Growth", pips: 4, icon: false, copies: 2 },
    { name: "Market Entry", pips: 3, icon: false, copies: 1 },
    { name: "New Frontier", pips: 3, icon: false, copies: 2 },
    { name: "Expansion Deal", pips: 3, icon: true, copies: 1 },
    { name: "Opportunistic Grab", pips: 2, icon: true, copies: 1 },
  ],
  SOURCING: [
    { name: "Supply Chain", pips: 4, icon: false, copies: 2 },
    { name: "Warehouse Buy", pips: 4, icon: false, copies: 1 },
    { name: "Procurement Run", pips: 3, icon: false, copies: 2 },
    { name: "Logistics", pips: 3, icon: true, copies: 1 },
    { name: "Rush Order", pips: 2, icon: true, copies: 1 },
  ],
  DISTILL: [
    { name: "Barrel Allocation", pips: 5, icon: false, copies: 2 },
    { name: "Private Pick", pips: 5, icon: false, copies: 1 },
    { name: "Single Barrel Program", pips: 4, icon: false, copies: 2 },
    { name: "Warehouse Pick", pips: 3, icon: true, copies: 1 },
    { name: "Rush Allocation", pips: 2, icon: true, copies: 1 },
  ],
};

/** Build the full deck (with copies). IDs are deterministic and deck-stable. */
export function buildActionDeck(): ActionCard[] {
  const cards: ActionCard[] = [];
  let n = 0;
  for (const suit of Object.keys(DECK) as Suit[]) {
    for (const seed of DECK[suit]) {
      for (let c = 0; c < seed.copies; c++) {
        n += 1;
        cards.push({ id: `card_${n}`, name: seed.name, suit, pips: seed.pips, icon: seed.icon });
      }
    }
  }
  return cards;
}

export const ACTION_DECK_SIZE = 45;
