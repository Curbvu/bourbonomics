import type { Player } from "@/lib/engine/state";

/** First-viable mash pick (1 cask + 1 corn + 1 grain) from a player's hand. */
export function pickMashFromHand(player: Player): string[] {
  const cask = player.resourceHand.find((r) => r.resource === "cask");
  const corn = player.resourceHand.find((r) => r.resource === "corn");
  const grain = player.resourceHand.find(
    (r) => r.resource === "rye" || r.resource === "wheat" || r.resource === "barley",
  );
  const picks: string[] = [];
  if (cask) picks.push(cask.instanceId);
  if (corn) picks.push(corn.instanceId);
  if (grain) picks.push(grain.instanceId);
  return picks;
}
