/**
 * Round badge that visually identifies a player — colored disc with their
 * chosen bourbon-centric logo glyph centered on top. Replaces the bare
 * color dot used pre-logos so every render site (top bar, opponent panel,
 * event log, barrel chips) reads "who is this?" at a glance via BOTH
 * colour and icon.
 */

import { PLAYER_BG_CLASS, paletteIndex } from "./playerColors";
import { logoFor } from "./playerLogos";

type Size = "xs" | "sm" | "md" | "lg";

const SIZE: Record<Size, { box: string; glyph: string }> = {
  xs: { box: "h-4 w-4", glyph: "text-[10px]" },
  sm: { box: "h-5 w-5", glyph: "text-[12px]" },
  md: { box: "h-7 w-7", glyph: "text-[16px]" },
  lg: { box: "h-9 w-9", glyph: "text-[20px]" },
};

export default function PlayerSwatch({
  seatIndex,
  logoId,
  size = "sm",
  ring = true,
  title,
}: {
  seatIndex: number;
  logoId?: string | null;
  size?: Size;
  /** Slate-950 ring so the swatch separates from busy backgrounds. Off for inline contexts. */
  ring?: boolean;
  title?: string;
}) {
  const idx = paletteIndex(seatIndex);
  const logo = logoFor(logoId, seatIndex);
  const { box, glyph } = SIZE[size];
  return (
    <span
      title={title ?? logo.name}
      className={[
        "grid flex-shrink-0 place-items-center rounded-full leading-none text-white shadow-[inset_0_1px_0_rgba(255,255,255,.18)]",
        ring ? "ring-2 ring-slate-950" : "",
        box,
        PLAYER_BG_CLASS[idx],
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden
    >
      <span className={glyph}>{logo.glyph}</span>
    </span>
  );
}
