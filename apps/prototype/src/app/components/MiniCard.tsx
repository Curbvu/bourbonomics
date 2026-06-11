"use client";

/**
 * Unified compact card for the non-resource surfaces — mash bills,
 * marketing cards, slot cards. One visual language across every card
 * on the board (per the project's card-consistency rule): gradient
 * body, glyph chip, display name, sub line, trait badges.
 */

export type MiniCardTone = "mashbill" | "marketing" | "slot";

const TONE: Record<MiniCardTone, { gradient: string; border: string; glyph: string }> = {
  mashbill: {
    gradient: "from-[#5a3a1e]/95 via-[#3a2412]/95 to-[#1a0f06]",
    border: "border-[#a07142]",
    glyph: "📜",
  },
  marketing: {
    gradient: "from-[#3a2a52]/95 via-[#241634]/95 to-[#0f0a18]",
    border: "border-[#9a7fd0]",
    glyph: "🪧",
  },
  slot: {
    gradient: "from-[#5a4a1e]/95 via-[#3a3010]/95 to-[#1a1406]",
    border: "border-[#d6b94a]",
    glyph: "🏷",
  },
};

export default function MiniCard({
  tone,
  title,
  sub,
  tags = [],
  cost,
  selected = false,
  disabled = false,
  onClick,
}: {
  tone: MiniCardTone;
  title: string;
  sub?: string;
  tags?: string[];
  cost?: string;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const t = TONE[tone];
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "relative flex min-w-0 flex-1 flex-col gap-1 overflow-hidden rounded-md border-2 bg-gradient-to-b p-2 text-left transition",
        t.gradient,
        t.border,
        selected ? "ring-2 ring-[var(--gold)] ring-offset-1 ring-offset-[var(--bg)]" : "",
        disabled
          ? "cursor-not-allowed opacity-40"
          : "cursor-pointer hover:-translate-y-0.5 hover:brightness-110",
      ].join(" ")}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/20"
      />
      {cost ? (
        <span className="absolute right-1 top-1 font-mono text-[10px] font-bold text-[var(--gold)]">
          {cost}
        </span>
      ) : null}

      <div className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-white/20 bg-white/10 text-[11px] leading-none backdrop-blur"
        >
          {t.glyph}
        </span>
        <span className="line-clamp-1 font-display text-[13px] font-bold leading-tight text-[var(--ink)]">
          {title}
        </span>
      </div>

      {sub ? (
        <div className="font-mono text-[10px] leading-tight text-white/55">{sub}</div>
      ) : null}

      {tags.length > 0 ? (
        <div className="mt-auto flex flex-wrap gap-1">
          {tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[.05em] text-white/75"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </button>
  );
}
