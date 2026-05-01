"use client";

/**
 * Layered deck-stack visual — three offset rectangles giving the illusion of
 * a stack of cards face-up.
 *
 * Spec: design_handoff_bourbon_blend/README.md §Deck stack visual.
 *
 * Three visual states:
 *
 *   - **Static** (no onClick, no disabled): full-colour, no cursor change.
 *     Used for purely informational stacks.
 *   - **Interactive enabled** (onClick provided, disabled=false): full-colour,
 *     cursor-pointer, hover-lifts 2px and gains an amber ring outline. Click
 *     fires the handler.
 *   - **Disabled** (disabled=true): muted via opacity + grayscale. No hover,
 *     no cursor change, click ignored. Use this to convey "this deck *would*
 *     be drawable, but it's not your turn / not the right phase / empty."
 *
 * Tone palette: default, amber (bourbon / cask), emerald (investments), sky
 * (reserved), violet (operations).
 */

export type DeckStackTone = "default" | "amber" | "emerald" | "sky" | "violet";

const TONES: Record<
  DeckStackTone,
  { face: string; border: string; ink: string; label: string }
> = {
  default: {
    face: "bg-slate-900",
    border: "border-slate-700",
    ink: "text-slate-200",
    label: "text-slate-400",
  },
  amber: {
    // amber-700 at 20% — warm but readable on the dark canvas
    face: "bg-amber-700/[0.2]",
    border: "border-amber-700",
    ink: "text-amber-100",
    label: "text-amber-300",
  },
  emerald: {
    face: "bg-emerald-500/10",
    border: "border-emerald-500/45",
    ink: "text-emerald-200",
    label: "text-emerald-400",
  },
  sky: {
    face: "bg-sky-500/10",
    border: "border-sky-500/45",
    ink: "text-sky-200",
    label: "text-sky-400",
  },
  violet: {
    face: "bg-violet-500/10",
    border: "border-violet-500/45",
    ink: "text-violet-200",
    label: "text-violet-400",
  },
};

export default function DeckStack({
  label,
  count,
  tone = "default",
  width = 56,
  height = 78,
  onClick,
  disabled = false,
  title,
}: {
  label: string;
  count: number;
  tone?: DeckStackTone;
  width?: number;
  height?: number;
  onClick?: () => void;
  /** When true, mute the stack and ignore clicks. */
  disabled?: boolean;
  title?: string;
}) {
  const t = TONES[tone];
  const interactive = Boolean(onClick) && !disabled;

  return (
    <div
      style={{ width, height }}
      className={[
        "relative flex-shrink-0 rounded-md transition-[transform,opacity,filter] duration-150",
        interactive
          ? "cursor-pointer hover:-translate-y-0.5 hover:ring-2 hover:ring-amber-400/60"
          : "",
        disabled ? "cursor-not-allowed opacity-40 grayscale" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? onClick : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      title={title}
      aria-label={`${label} deck, ${count} card${count === 1 ? "" : "s"}`}
      aria-disabled={disabled || undefined}
    >
      {/* Back card — bottom of stack, offset down-right */}
      <div
        className="absolute inset-0 translate-x-[3px] translate-y-[3px] rounded-md border border-slate-800 bg-slate-950"
        aria-hidden
      />
      {/* Middle card — half-step offset */}
      <div
        className="absolute inset-0 translate-x-[1.5px] translate-y-[1.5px] rounded-md border border-slate-800 bg-slate-900"
        aria-hidden
      />
      {/* Face card — tone-specific, with inset top highlight */}
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center gap-0.5 rounded-md border shadow-[inset_0_1px_0_rgba(255,255,255,.05)] ${t.face} ${t.border}`}
      >
        <span
          className={`font-mono text-[9px] font-semibold uppercase tracking-[.14em] ${t.label}`}
        >
          {label}
        </span>
        <span
          className={`font-mono text-xl font-bold tabular-nums leading-none ${t.ink}`}
        >
          {count}
        </span>
      </div>
    </div>
  );
}
