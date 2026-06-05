"use client";

import { matrixValue, CONFIG } from "@bourbonomics/prototype-engine";
import type { Bourbon, ResourceKind } from "@bourbonomics/prototype-engine";

const TIER_INK: Record<string, string> = {
  common: "var(--t-common)",
  specialty: "var(--t-specialty)",
  heritage: "var(--t-heritage)",
};

/** Recipe → ["1 cask", "2 corn"] chips. */
function recipeChips(recipe: Partial<Record<ResourceKind, number>>): string[] {
  const out: string[] = [];
  for (const k of ["cask", "corn", "grain"] as ResourceKind[]) {
    const n = recipe[k] ?? 0;
    if (n > 0) out.push(`${n} ${k}`);
  }
  return out;
}

/**
 * A single barrel in the rickhouse, in one of two states:
 *  - UNBUILT: a resting recipe placeholder. Shows the resources it needs and
 *    a Build button (commit the selected hand resources). Does not age.
 *  - BUILT: an aging barrel. Oak-stave body + brass age medallion that embers
 *    when sellable; shows the live sale preview at the current demand.
 */
export default function Barrel({
  bourbon,
  demand,
  canSell,
  canBuild,
  onSell,
  onBuild,
}: {
  bourbon: Bourbon;
  demand: number;
  canSell: boolean;
  canBuild: boolean;
  onSell: () => void;
  onBuild: () => void;
}) {
  const ink = TIER_INK[bourbon.quality];

  // ── Unbuilt barrel: recipe placeholder ──────────────────────────────
  if (!bourbon.built) {
    return (
      <div className="pour-in flex w-[132px] flex-col gap-1.5">
        <div className="brass-edge relative grid h-[78px] place-items-center overflow-hidden rounded-[10px] border border-dashed border-[var(--brass)] bg-[linear-gradient(180deg,rgba(40,28,16,.7),rgba(20,13,8,.9))]">
          <span className="font-display text-[26px] leading-none text-[var(--brass)]" aria-hidden>
            🛠
          </span>
          <span className="absolute bottom-1 font-mono text-[9px] uppercase tracking-[.1em] text-[var(--whisper)]">
            unbuilt
          </span>
        </div>
        <div className="line-clamp-1 text-[12px] font-semibold leading-tight text-[var(--ink-muted)]">
          {bourbon.name}
        </div>
        <div className="flex flex-wrap gap-1">
          {recipeChips(bourbon.recipe).map((c) => (
            <span
              key={c}
              className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[.04em] text-[var(--amber-2)]"
            >
              {c}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={onBuild}
          disabled={!canBuild}
          className="w-full rounded border border-[var(--rule)] bg-[var(--panel)] px-1 py-1 font-mono text-[10px] uppercase tracking-[.08em] text-[var(--ink-muted)] transition enabled:hover:border-[var(--gold)] enabled:hover:text-[var(--gold)] disabled:opacity-40"
        >
          Build
        </button>
      </div>
    );
  }

  // ── Built barrel: aging + sale preview ──────────────────────────────
  const preview = matrixValue(bourbon.matrix, bourbon.age, demand);
  const ready = bourbon.age >= CONFIG.MIN_SELL_AGE;

  return (
    <div className="pour-in flex w-[132px] flex-col gap-1.5">
      {/* barrel graphic */}
      <div className="brass-edge barrel-wood relative grid h-[78px] place-items-center overflow-hidden rounded-[10px]">
        {/* hoops */}
        <span className="pointer-events-none absolute inset-x-0 top-[12px] h-[3px] bg-gradient-to-b from-[#f3e2b4] via-[#b89358] to-[#5c3c1f]" />
        <span className="pointer-events-none absolute inset-x-0 bottom-[12px] h-[3px] bg-gradient-to-b from-[#f3e2b4] via-[#b89358] to-[#5c3c1f]" />
        {/* tier pip */}
        <span
          className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full"
          style={{ background: ink, boxShadow: `0 0 6px ${ink}` }}
          title={bourbon.quality}
        />
        {/* medallion */}
        <div
          className={[
            "brass-medallion grid h-12 w-12 place-items-center rounded-full",
            ready ? "ember-needs" : "ember-aged",
          ].join(" ")}
        >
          <span
            className="font-display font-bold leading-none text-[#1a120b]"
            style={{ fontSize: 20 }}
          >
            {bourbon.age}
          </span>
        </div>
      </div>

      <div
        className="line-clamp-1 text-[12px] font-semibold leading-tight"
        style={{ color: ink }}
      >
        {bourbon.name}
      </div>
      <div className="font-mono text-[10px] text-[var(--mute)]">
        ~{preview}฿ now
      </div>
      <button
        type="button"
        onClick={onSell}
        disabled={!canSell}
        className="w-full rounded border border-[var(--rule)] bg-[var(--panel)] px-1 py-1 font-mono text-[10px] uppercase tracking-[.08em] text-[var(--ink-muted)] transition hover:border-[var(--amber)] hover:text-[var(--gold)] disabled:opacity-40"
      >
        {canSell
          ? "Sell →"
          : ready
            ? "needs a line"
            : `aging ${bourbon.age}/${CONFIG.MIN_SELL_AGE}`}
      </button>
    </div>
  );
}
