/**
 * Stable color palette for players. Index by playerIndex (0-3).
 * Each entry has Tailwind classes for various surfaces.
 */
export interface PlayerColor {
  /** Avatar circle background. */
  avatarBg: string;
  /** Avatar circle border. */
  avatarBorder: string;
  /** Solid barrel chip background (used in the rickhouse). */
  barrelBg: string;
  /** Lighter ring around the active player chip. */
  ring: string;
  /** Hex for non-Tailwind contexts. */
  accent: string;
}

export const PLAYER_COLORS: PlayerColor[] = [
  {
    avatarBg: "bg-violet-600",
    avatarBorder: "border-violet-400",
    barrelBg: "bg-violet-700",
    ring: "ring-violet-400",
    accent: "#7c3aed",
  },
  {
    avatarBg: "bg-rose-600",
    avatarBorder: "border-rose-400",
    barrelBg: "bg-rose-700",
    ring: "ring-rose-400",
    accent: "#e11d48",
  },
  {
    avatarBg: "bg-emerald-600",
    avatarBorder: "border-emerald-400",
    barrelBg: "bg-emerald-700",
    ring: "ring-emerald-400",
    accent: "#059669",
  },
  {
    avatarBg: "bg-sky-600",
    avatarBorder: "border-sky-400",
    barrelBg: "bg-sky-700",
    ring: "ring-sky-400",
    accent: "#0284c7",
  },
];

export function colorFor(playerIndex: number): PlayerColor {
  return PLAYER_COLORS[playerIndex % PLAYER_COLORS.length]!;
}
