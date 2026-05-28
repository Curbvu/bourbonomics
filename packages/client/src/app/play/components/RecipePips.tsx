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

import { computeRecipeFloors, type MashBill } from "@bourbonomics/engine";

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
  /** True for a Specialty / Heritage gated slot — renders a star
   *  outline instead of a plain disc so the player can tell at a
   *  glance "this slot must be a market-only specialty card." */
  specialty?: boolean;
}

function buildPips(bill: MashBill): PipSpec[] {
  const f = computeRecipeFloors(bill.recipe);
  const pips: PipSpec[] = [];
  // Plain pips first — `f.<sub>.plain` already deducts the specialty
  // floor one-for-one, so a `minCask:1 + minSpecialty.cask:1` recipe
  // renders ONE specialty cask pip, not "1 plain + 1 specialty"
  // (which would imply two casks — engine only ever wants 1).
  if (f.cask.plain > 0) {
    pips.push({ key: "cask", color: PIP_COLORS.cask! });
  }
  for (const sub of ["corn", "rye", "barley", "wheat"] as const) {
    for (let i = 0; i < f[sub].plain; i++) {
      pips.push({ key: `${sub}-${i}`, color: PIP_COLORS[sub]! });
    }
  }
  for (let i = 0; i < f.grain.wildSlots; i++) {
    pips.push({ key: `wild-${i}`, color: "bg-transparent", wild: true });
  }
  // Specialty pips — one per subtype slot. The star-outline glyph
  // (rendered in the JSX below) is the visual cue: an outlined ★ on
  // the subtype-tinted disc reads as "this needs a market-bought
  // Specialty card" at a glance.
  for (const sub of ["cask", "corn", "rye", "barley", "wheat"] as const) {
    for (let i = 0; i < f[sub].specialty; i++) {
      pips.push({
        key: `sp-${sub}-${i}`,
        color: PIP_COLORS[sub] ?? "bg-amber-300",
        specialty: true,
      });
    }
  }
  if (f.forbidsRye) {
    pips.push({ key: "no-rye", color: PIP_COLORS.rye!, forbidden: true });
  }
  if (f.forbidsWheat) {
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
            "relative inline-block rounded-full",
            // Specialty pips get a slightly larger footprint + amber
            // halo so they read as "different" without leaning on the
            // subtype color alone (which a colorblind player can't
            // distinguish from the plain disc next to them).
            p.specialty ? "h-[10px] w-[10px] shadow-[0_0_4px_rgba(252,211,77,.85)]" : "h-[7px] w-[7px]",
            p.wild ? "border border-white/45 bg-transparent" : p.color,
            p.specialty ? "ring-1 ring-amber-200" : "",
            p.forbidden ? "opacity-65" : "",
          ].join(" ")}
          title={p.specialty ? "Specialty required" : undefined}
          aria-hidden
        >
          {p.forbidden ? (
            <span
              className="pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] leading-none text-slate-100"
              aria-hidden
            >
              ✕
            </span>
          ) : null}
          {p.specialty ? (
            <span
              className="pointer-events-none absolute inset-0 flex items-center justify-center text-[8px] font-bold leading-none text-amber-50"
              aria-hidden
            >
              ★
            </span>
          ) : null}
        </span>
      ))}
    </div>
  );
}
