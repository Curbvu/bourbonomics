"use client";

/**
 * Recipe pip strip — shows the bill's ingredient requirements as a row
 * of colored dots so a player can read the recipe at a glance from
 * the card face. One pip per required unit; pip colour matches the
 * subtype palette used everywhere else (cask=amber, corn=yellow,
 * rye=red, barley=teal, wheat=cyan). Generic "any grain" units
 * (when `minTotalGrain` exceeds the sum of named-grain mins) are
 * shown as hollow neutral pips so the player knows they have
 * substitution flexibility.
 *
 * The universal recipe (1 cask + 1 corn + 1 grain) is always
 * implied — the strip starts with the cask + corn + at-least-one
 * grain, then layers any extra recipe constraints on top.
 *
 * Forbidden subtypes (`maxRye: 0` / `maxWheat: 0`) appear as a
 * struck-through pip at the end so the player remembers the
 * exclusion without flipping the card.
 */

import type { MashBill } from "@bourbonomics/engine";

const PIP_COLORS: Record<string, string> = {
  cask: "bg-amber-400",
  corn: "bg-yellow-300",
  rye: "bg-red-400",
  barley: "bg-teal-300",
  wheat: "bg-cyan-300",
};

interface PipSpec {
  key: string;
  color: string;
  /** True for the hollow-ring "any grain" placeholder. */
  wild?: boolean;
  /** True for a struck-through forbidden-subtype marker. */
  forbidden?: boolean;
}

function buildPips(bill: MashBill): PipSpec[] {
  const r = bill.recipe ?? {};
  const minCorn = Math.max(1, r.minCorn ?? 0);
  const minRye = r.minRye ?? 0;
  const minBarley = r.minBarley ?? 0;
  const minWheat = r.minWheat ?? 0;
  const namedGrain = minRye + minBarley + minWheat;
  // The universal rule guarantees ≥1 grain. If the recipe has no
  // named-grain min, surface a single "any grain" pip so the player
  // sees the requirement; otherwise the named ones cover it.
  const minTotal = Math.max(r.minTotalGrain ?? 0, namedGrain === 0 ? 1 : namedGrain);
  const wildGrain = Math.max(0, minTotal - namedGrain);

  const pips: PipSpec[] = [];
  pips.push({ key: "cask", color: PIP_COLORS.cask! });
  for (let i = 0; i < minCorn; i++) {
    pips.push({ key: `corn-${i}`, color: PIP_COLORS.corn! });
  }
  for (let i = 0; i < minRye; i++) {
    pips.push({ key: `rye-${i}`, color: PIP_COLORS.rye! });
  }
  for (let i = 0; i < minBarley; i++) {
    pips.push({ key: `barley-${i}`, color: PIP_COLORS.barley! });
  }
  for (let i = 0; i < minWheat; i++) {
    pips.push({ key: `wheat-${i}`, color: PIP_COLORS.wheat! });
  }
  for (let i = 0; i < wildGrain; i++) {
    pips.push({ key: `wild-${i}`, color: "bg-transparent", wild: true });
  }
  if (r.maxRye === 0) {
    pips.push({ key: "no-rye", color: PIP_COLORS.rye!, forbidden: true });
  }
  if (r.maxWheat === 0) {
    pips.push({ key: "no-wheat", color: PIP_COLORS.wheat!, forbidden: true });
  }
  return pips;
}

export default function RecipePips({ bill }: { bill: MashBill }) {
  const pips = buildPips(bill);
  return (
    <div className="mt-0.5 flex flex-wrap items-center justify-center gap-[3px]">
      {pips.map((p) => (
        <span
          key={p.key}
          className={[
            "relative inline-block h-[7px] w-[7px] rounded-full",
            p.wild ? "border border-white/45 bg-transparent" : p.color,
            p.forbidden ? "opacity-65" : "",
          ].join(" ")}
          aria-hidden
        >
          {p.forbidden ? (
            <span
              className="pointer-events-none absolute inset-0 flex items-center justify-center text-[8px] leading-none text-slate-100"
              aria-hidden
            >
              ✕
            </span>
          ) : null}
        </span>
      ))}
    </div>
  );
}
