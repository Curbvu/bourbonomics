/**
 * Map a market target card → which Labor domain can supplement its
 * rep cost. Mirrors the engine's purchase routing:
 *
 *   operations  → `ops`              (Marketing Labor +2)
 *   investment  → `investment`       (Architect Labor +2)
 *   everything  → `market_resource`  (Cooper Labor +2)
 *
 * Generic Labor (`laborDomain === "any"`) contributes +1 to every
 * domain regardless of which target was picked.
 *
 * Single source of truth so BuyOverlay's cost preview, the store's
 * confirmBuy dispatch routing, and HandTray's hand-card eligibility
 * highlighting all stay in lockstep.
 */

import type { Card } from "@bourbonomics/engine";

export type BuyLaborDomain = "ops" | "market_resource" | "investment";

export function buyDomainForTarget(target: Card): BuyLaborDomain {
  if (target.type === "operations") return "ops";
  if (target.type === "investment") return "investment";
  return "market_resource";
}
