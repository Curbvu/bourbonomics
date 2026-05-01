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

export type DeckStackTone =
  | "default"
  | "amber"
  | "yellow"
  | "lime"
  | "emerald"
  | "sky"
  | "violet"
  | "rose";

const TONES: Record<
  DeckStackTone,
  { face: string; border: string; ink: string; label: string; glyph: string }
> = {
  default: {
    face: "bg-slate-900",
    border: "border-slate-700",
    ink: "text-slate-200",
    label: "text-slate-400",
    glyph: "",
  },
  amber: {
    // Cask — toasted oak, warm amber.
    face: "bg-amber-700/[0.22]",
    border: "border-amber-600",
    ink: "text-amber-100",
    label: "text-amber-300",
    glyph: "◯",
  },
  yellow: {
    // Corn — kernel yellow.
    face: "bg-yellow-500/[0.20]",
    border: "border-yellow-500/60",
    ink: "text-yellow-100",
    label: "text-yellow-300",
    glyph: "◆",
  },
  lime: {
    // Grain — fields and barley.
    face: "bg-lime-500/[0.20]",
    border: "border-lime-500/60",
    ink: "text-lime-100",
    label: "text-lime-300",
    glyph: "★",
  },
  emerald: {
    face: "bg-emerald-500/[0.15]",
    border: "border-emerald-500/55",
    ink: "text-emerald-200",
    label: "text-emerald-400",
    glyph: "$",
  },
  sky: {
    face: "bg-sky-500/[0.15]",
    border: "border-sky-500/55",
    ink: "text-sky-200",
    label: "text-sky-400",
    glyph: "",
  },
  violet: {
    face: "bg-violet-500/[0.18]",
    border: "border-violet-500/55",
    ink: "text-violet-200",
    label: "text-violet-400",
    glyph: "⚙",
  },
  rose: {
    face: "bg-rose-500/[0.15]",
    border: "border-rose-500/55",
    ink: "text-rose-200",
    label: "text-rose-400",
    glyph: "",
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
  shutdown = false,
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
  /**
   * When true, the pile is shut down (resource shortage in effect for
   * this round). Renders a desaturated rose-tinted face with a 🚫
   * overlay to communicate "this pile is locked, no draws this round."
   */
  shutdown?: boolean;
}) {
  const t = TONES[tone];
  const interactive = Boolean(onClick) && !disabled && !shutdown;

  return (
    <div
      style={{ width, height }}
      className={[
        "relative flex-shrink-0 rounded-md transition-[transform,opacity,filter] duration-150",
        interactive
          ? "cursor-pointer hover:-translate-y-0.5 hover:ring-2 hover:ring-amber-400/60"
          : "",
        disabled && !shutdown ? "cursor-not-allowed opacity-40 grayscale" : "",
        shutdown ? "cursor-not-allowed" : "",
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
      aria-label={`${label} deck, ${count} card${count === 1 ? "" : "s"}${shutdown ? " (shut down)" : ""}`}
      aria-disabled={disabled || shutdown || undefined}
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
      {/* Face card — tone-specific, with inset top highlight. When the
          pile is shut down, swap to the rose "locked" treatment with a
          diagonal hatch + 🚫 glyph so it reads as "no draws this round" */}
      <div
        className={[
          "absolute inset-0 flex flex-col items-center justify-center gap-0.5 rounded-md border shadow-[inset_0_1px_0_rgba(255,255,255,.05)]",
          shutdown
            ? "border-rose-600 bg-rose-900/40 grayscale-[40%]"
            : `${t.face} ${t.border}`,
        ].join(" ")}
      >
        {/* Tone glyph (faint, top-left). Hidden when shutdown. */}
        {!shutdown && t.glyph ? (
          <span
            className={`pointer-events-none absolute left-1.5 top-1 font-mono text-[10px] opacity-50 ${t.label}`}
            aria-hidden
          >
            {t.glyph}
          </span>
        ) : null}
        <span
          className={[
            "font-mono text-[9px] font-semibold uppercase tracking-[.14em]",
            shutdown ? "text-rose-300" : t.label,
          ].join(" ")}
        >
          {label}
        </span>
        <span
          className={[
            "font-mono text-xl font-bold tabular-nums leading-none",
            shutdown ? "text-rose-200/60 line-through" : t.ink,
          ].join(" ")}
        >
          {count}
        </span>
        {shutdown ? (
          <>
            {/* Diagonal hatch overlay */}
            <div
              className="pointer-events-none absolute inset-0 rounded-md opacity-30"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(135deg, rgba(244,63,94,.5) 0 4px, transparent 4px 10px)",
              }}
              aria-hidden
            />
            <span
              className="pointer-events-none absolute inset-0 grid place-items-center text-2xl text-rose-300 drop-shadow"
              aria-hidden
              title="Shut down — no draws this round"
            >
              🚫
            </span>
            <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 font-mono text-[8px] font-bold uppercase tracking-[.12em] text-rose-300">
              shut down
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}
