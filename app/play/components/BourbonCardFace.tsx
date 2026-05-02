"use client";

import { Fragment, type ReactNode } from "react";

import { isRickhouseId, rickhouseById } from "@/lib/engine/rickhouses";
import type { BourbonCardDef } from "@/lib/catalogs/types";

type HighlightCell = {
  ageBand: 0 | 1 | 2;
  demandBand: 0 | 1 | 2;
};

/**
 * Build human-readable band labels from a bill's three lower-bound
 * thresholds. Bands 0 and 1 read as `lo–(next-1)`; band 2 reads as `lo+`.
 * Example: `[2, 4, 7]` → ["2–3", "4–6", "7+"].
 */
function bandLabels(thresholds: readonly [number, number, number]): string[] {
  return [
    thresholds[1] - thresholds[0] === 1
      ? `${thresholds[0]}`
      : `${thresholds[0]}–${thresholds[1] - 1}`,
    thresholds[2] - thresholds[1] === 1
      ? `${thresholds[1]}`
      : `${thresholds[1]}–${thresholds[2] - 1}`,
    `${thresholds[2]}+`,
  ];
}

type Size = "sm" | "md" | "lg";

const SIZE_TOKENS: Record<
  Size,
  {
    cell: string;
    title: string;
    eyebrow: string;
    body: string;
    award: string;
    pad: string;
    rounded: string;
    sectionGap: string;
  }
> = {
  sm: {
    cell: "h-7 w-10 text-[11px]",
    title: "text-xs",
    eyebrow: "text-[7px]",
    body: "text-[9px]",
    award: "text-[8.5px]",
    pad: "p-2.5",
    rounded: "rounded-md",
    sectionGap: "gap-2",
  },
  md: {
    cell: "h-10 w-12 text-sm",
    title: "text-sm",
    eyebrow: "text-[8px]",
    body: "text-[10px]",
    award: "text-[10px]",
    pad: "p-3.5",
    rounded: "rounded-lg",
    sectionGap: "gap-3",
  },
  lg: {
    cell: "h-12 w-16 text-base",
    title: "text-2xl",
    eyebrow: "text-[10px]",
    body: "text-[11px]",
    award: "text-[12px]",
    pad: "p-5",
    rounded: "rounded-xl",
    sectionGap: "gap-4",
  },
};

/**
 * Readable rendering of a Bourbon Card's Market Price Guide. Pass `highlight`
 * to draw the sale-resolution glow on a specific (ageBand, demandBand) cell;
 * pass `currentDemand` to softly tint the column representing the current
 * market demand band (skipped when `highlight` is set so the two cues never
 * collide).
 */
export default function BourbonCardFace({
  card,
  highlight,
  currentDemand,
  size = "md",
}: {
  card: BourbonCardDef;
  highlight?: HighlightCell;
  currentDemand?: number;
  size?: Size;
}) {
  const tok = SIZE_TOKENS[size];
  const ageLabels = bandLabels(card.ageBands);
  const demandLabels = bandLabels(card.demandBands);
  const liveDemandBand =
    highlight == null && currentDemand != null
      ? currentDemand >= card.demandBands[2]
        ? 2
        : currentDemand >= card.demandBands[1]
          ? 1
          : 0
      : null;
  const isRare = card.rarity === "Rare";
  return (
    <article
      className={[
        "relative overflow-hidden border-2 shadow-[0_10px_32px_rgba(0,0,0,.55),inset_0_1px_0_rgba(255,255,255,.08)]",
        tok.rounded,
        tok.pad,
        isRare ? "border-amber-400" : "border-amber-700/80",
        "bg-[radial-gradient(120%_80%_at_50%_-10%,rgba(245,158,11,.20),transparent_55%),linear-gradient(180deg,rgba(120,53,15,.45)_0%,rgba(15,23,42,.95)_75%)]",
      ].join(" ")}
      aria-label={`Bourbon card ${card.name}`}
    >
      {/* Top hairline gloss */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/40 to-transparent"
        aria-hidden
      />

      {/* Header */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className={`font-mono uppercase tracking-[.22em] text-amber-300/60 ${tok.eyebrow}`}
          >
            Bourbon
          </p>
          <h3
            className={`mt-0.5 font-display font-semibold leading-tight text-amber-50 drop-shadow-[0_1px_2px_rgba(0,0,0,.5)] ${tok.title}`}
          >
            {card.name}
          </h3>
        </div>
        <RarityBadge rarity={card.rarity} size={size} />
      </header>

      {/* Section divider — Market Price Guide */}
      <SectionDivider label="Market Price Guide" size={size} />

      {/* Price grid */}
      <div className="flex justify-center">
        <table className="border-separate border-spacing-1 text-center">
          <thead>
            <tr>
              <th scope="col" className="sr-only">
                Age
              </th>
              {demandLabels.map((label, c) => {
                const live = liveDemandBand === c;
                const hit = highlight?.demandBand === c;
                return (
                  <th
                    key={label}
                    scope="col"
                    className={[
                      "pb-1 font-mono uppercase tracking-[.18em]",
                      tok.body,
                      hit
                        ? "text-amber-200"
                        : live
                          ? "text-amber-300"
                          : "text-amber-400/55",
                    ].join(" ")}
                  >
                    {label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {card.grid.map((row, r) => (
              <tr key={r}>
                <th
                  scope="row"
                  className={[
                    "pr-2 text-right font-mono uppercase tracking-[.18em]",
                    tok.body,
                    highlight?.ageBand === r
                      ? "text-amber-200"
                      : "text-amber-400/55",
                  ].join(" ")}
                >
                  {ageLabels[r]}
                </th>
                {row.map((price, c) => {
                  const isHit =
                    highlight?.ageBand === r && highlight?.demandBand === c;
                  const liveCol = liveDemandBand === c;
                  const isBlank = price == null || price <= 0;
                  return (
                    <td
                      key={c}
                      className={[
                        "align-middle font-semibold tabular-nums transition rounded-md",
                        tok.cell,
                        isHit
                          ? "bg-amber-300 text-slate-950 ring-2 ring-amber-200 shadow-[0_0_18px_rgba(245,158,11,.55)]"
                          : isBlank
                            ? "border border-dashed border-slate-700/70 bg-slate-950/40 text-slate-600"
                            : liveCol
                              ? "bg-amber-700/[0.20] text-amber-100 ring-1 ring-amber-500/40"
                              : "bg-slate-900/80 text-slate-100 ring-1 ring-amber-900/40",
                      ].join(" ")}
                    >
                      {isBlank ? "—" : `$${price}`}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recipe */}
      {card.recipe ? (
        <>
          <SectionDivider label="Mash Recipe" size={size} />
          <RecipeBadges recipe={card.recipe} size={size} />
        </>
      ) : null}

      {/* Awards */}
      {card.awards && (card.awards.silver || card.awards.gold) ? (
        <>
          <SectionDivider label="Distillery Honors" size={size} />
          <ul className={`flex flex-col ${tok.sectionGap} pt-1`}>
            {card.awards.silver ? (
              <AwardRow
                tier="silver"
                text={card.awards.silver}
                textSize={tok.award}
              />
            ) : null}
            {card.awards.gold ? (
              <AwardRow
                tier="gold"
                text={card.awards.gold}
                textSize={tok.award}
              />
            ) : null}
          </ul>
        </>
      ) : null}
    </article>
  );
}

function RecipeBadges({
  recipe,
  size,
}: {
  recipe: NonNullable<BourbonCardDef["recipe"]>;
  size: Size;
}) {
  const text = size === "lg" ? "text-[11px]" : "text-[9px]";
  const entries: { label: string; body: string }[] = [];
  for (const key of ["corn", "barley", "rye", "wheat", "grain"] as const) {
    const bound = recipe[key];
    if (!bound) continue;
    const label = key === "grain" ? "total grain" : key;
    let body = "";
    if (bound.max === 0) {
      body = `no ${label}`;
    } else if (bound.min != null && bound.max != null) {
      body = `${bound.min}–${bound.max} ${label}`;
    } else if (bound.min != null) {
      body = `≥${bound.min} ${label}`;
    } else if (bound.max != null) {
      body = `≤${bound.max} ${label}`;
    }
    if (body) entries.push({ label, body });
  }
  if (entries.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {entries.map((e) => (
        <li
          key={e.label}
          className={`rounded-md border border-amber-700/60 bg-amber-900/[0.25] px-2 py-0.5 font-mono uppercase tracking-[.12em] text-amber-100 ${text}`}
        >
          {e.body}
        </li>
      ))}
    </ul>
  );
}

// ──────────────────────────────────────────────────────────────────────────

function RarityBadge({ rarity, size }: { rarity: string; size: Size }) {
  const isRare = rarity === "Rare";
  const padding = size === "lg" ? "px-2.5 py-1" : "px-1.5 py-0.5";
  const text = size === "lg" ? "text-[10px]" : "text-[8.5px]";
  return (
    <span
      className={[
        "flex-shrink-0 rounded-full border font-mono uppercase tracking-[.18em]",
        padding,
        text,
        isRare
          ? "border-amber-300 bg-gradient-to-b from-amber-300 to-amber-500 text-slate-950 shadow-[0_2px_8px_rgba(245,158,11,.45)]"
          : "border-amber-700/60 bg-amber-900/30 text-amber-200/85",
      ].join(" ")}
    >
      {rarity}
    </span>
  );
}

function SectionDivider({ label, size }: { label: string; size: Size }) {
  const margin = size === "lg" ? "my-4" : size === "md" ? "my-3" : "my-2";
  const text = size === "lg" ? "text-[8.5px]" : "text-[7.5px]";
  return (
    <div className={`flex items-center gap-3 ${margin}`} aria-hidden>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-700/60 to-transparent" />
      <span
        className={`font-mono uppercase tracking-[.32em] text-amber-400/60 ${text}`}
      >
        {label}
      </span>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-700/60 to-transparent" />
    </div>
  );
}

function AwardRow({
  tier,
  text,
  textSize,
}: {
  tier: "silver" | "gold";
  text: string;
  textSize: string;
}) {
  const isGold = tier === "gold";
  return (
    <li className="flex items-start gap-2.5">
      <Medal tier={tier} />
      <p
        className={`flex-1 leading-snug ${textSize} ${
          isGold ? "text-amber-100" : "text-amber-100/90"
        }`}
      >
        <span
          className={`mr-1.5 font-mono text-[9px] font-bold uppercase tracking-[.18em] ${
            isGold ? "text-amber-300" : "text-slate-300"
          }`}
        >
          {isGold ? "Gold" : "Silver"}
        </span>
        {renderAwardText(text)}
      </p>
    </li>
  );
}

function Medal({ tier }: { tier: "silver" | "gold" }) {
  const isGold = tier === "gold";
  return (
    <span
      aria-hidden
      className={[
        "mt-0.5 grid h-5 w-5 flex-shrink-0 place-items-center rounded-full border-2 font-mono text-[8px] font-black tracking-tight shadow-[inset_0_1px_2px_rgba(255,255,255,.4),0_2px_6px_rgba(0,0,0,.45)]",
        isGold
          ? "border-amber-200 bg-gradient-to-b from-amber-200 to-amber-500 text-amber-950"
          : "border-slate-200 bg-gradient-to-b from-slate-200 to-slate-400 text-slate-800",
      ].join(" ")}
    >
      {isGold ? "G" : "S"}
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Award text rendering: parses `**bold**` markdown and replaces engine
// rickhouse ids ("rickhouse-3") with the region name ("Lexington") so the
// text reads as gameplay copy, not engine plumbing.

function renderAwardText(text: string): ReactNode {
  const expanded = expandRickhouseRefs(text);
  const parts: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(expanded)) !== null) {
    if (m.index > lastIdx)
      parts.push(<Fragment key={key++}>{expanded.slice(lastIdx, m.index)}</Fragment>);
    parts.push(
      <strong key={key++} className="font-semibold text-amber-50">
        {m[1]}
      </strong>,
    );
    lastIdx = re.lastIndex;
  }
  if (lastIdx < expanded.length)
    parts.push(<Fragment key={key++}>{expanded.slice(lastIdx)}</Fragment>);
  return parts;
}

function expandRickhouseRefs(text: string): string {
  return text.replace(/rickhouse-\d/g, (id) => {
    if (isRickhouseId(id)) return rickhouseById(id).name;
    return id;
  });
}
