"use client";

/**
 * LineCardTile — visual tile for a Line Card instance. Two sizes:
 *
 *   xs — chip for stacked-on-line display (name + theme stripe)
 *   sm — full tile for the draft / keep modals
 *
 * Renders from the def resolved by `getLineCardDef(instance.defId)`.
 * Unknown defIds (corrupted save) render a tombstone — UX-survivable.
 *
 * Theme color comes from a tiny static map keyed by `themeTag`. The
 * engine def carries the themeTag verbatim from the card author so
 * adding new cards only needs an extra entry here for chrome.
 */

import { getLineCardDef, type LineCardInstance } from "@bourbonomics/engine";

const THEME_INK: Record<string, string> = {
  // Recipe
  rye: "#d96b54",
  "high-rye": "#e08560",
  wheated: "#7da6df",
  barley: "#82c9a3",
  "pure-corn": "#e9c46e",
  "triple-grain": "#c69df0",
  "single-grain": "#b9a684",
  "heritage-recipe": "#b89a6a",
  // Cask
  "heritage-cask": "#f0b070",
  "specialty-cask": "#d59650",
  "common-cask": "#b9a684",
  // Rarity
  premium: "#7da6df",
  boutique: "#c69df0",
  // Age
  "aged-4": "#c9a86b",
  "aged-5": "#d3b275",
  "aged-6": "#dab87a",
  "aged-8": "#f0c98a",
  "aged-young": "#9ab7c7",
  // Market
  "demand-high": "#f0b070",
  "demand-low": "#82c9a3",
  "premium-press": "#c69df0",
  "demand-leader": "#e08560",
  // Volume
  volume: "#b9a684",
  depth: "#a98b58",
  variety: "#c69df0",
};

const FALLBACK_INK = "#b9a684";

export interface LineCardTileProps {
  instance: LineCardInstance;
  size?: "xs" | "sm";
  selected?: boolean;
  interactive?: boolean;
  onClick?: () => void;
}

export default function LineCardTile({
  instance,
  size = "sm",
  selected = false,
  interactive = false,
  onClick,
}: LineCardTileProps) {
  const def = getLineCardDef(instance.defId);

  if (size === "xs") {
    return (
      <span
        title={def ? `${def.name} — ${def.flavorText}` : `unknown card ${instance.defId}`}
        className="inline-flex items-center gap-1 rounded-[3px] border px-1 py-px font-mono text-[9px] uppercase tracking-[.06em]"
        style={{
          borderColor: def ? THEME_INK[def.themeTag] ?? FALLBACK_INK : "var(--rule)",
          color: def ? THEME_INK[def.themeTag] ?? FALLBACK_INK : "var(--mute)",
          background: "rgba(0,0,0,.35)",
        }}
      >
        {def?.name ?? "?"}
      </span>
    );
  }

  const ink = def ? THEME_INK[def.themeTag] ?? FALLBACK_INK : FALLBACK_INK;
  const baseClasses =
    "relative flex flex-col gap-1 rounded-[6px] border bg-gradient-to-b from-[rgba(34,23,16,.85)] to-[rgba(20,14,8,.95)] px-2 py-2 text-left shadow-[inset_0_1px_0_rgba(255,255,255,.04)] transition-transform";
  const interactiveClasses = interactive
    ? "cursor-pointer hover:scale-[1.02] hover:shadow-[0_0_0_2px_rgba(240,201,112,.25)]"
    : "";
  const selectedClasses = selected
    ? "ring-2 ring-amber-300 ring-offset-2 ring-offset-slate-950"
    : "";

  const Tag = interactive ? "button" : ("div" as const);
  return (
    <Tag
      type={interactive ? "button" : undefined}
      onClick={interactive ? onClick : undefined}
      className={`${baseClasses} ${interactiveClasses} ${selectedClasses}`}
      style={{
        width: 132,
        minHeight: 88,
        borderColor: selected ? "var(--gold)" : ink,
      }}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-[3px] rounded-t-[5px]"
        style={{ background: ink }}
      />
      <span
        className="mt-1 font-display text-[12px] font-semibold leading-tight"
        style={{ color: "var(--ink)" }}
      >
        {def?.name ?? "Unknown Line Card"}
      </span>
      {def ? (
        <span
          className="font-mono text-[9px] italic leading-snug"
          style={{ color: "var(--ink-muted)" }}
        >
          {def.flavorText}
        </span>
      ) : null}
      <span
        className="mt-auto self-start rounded border px-1 py-px font-mono text-[8.5px] uppercase tracking-[.08em]"
        style={{ borderColor: ink, color: ink }}
      >
        {def?.themeTag ?? instance.defId}
      </span>
    </Tag>
  );
}
