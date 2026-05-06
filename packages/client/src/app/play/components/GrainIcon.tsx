/**
 * Grain glyphs — corn / rye / barley / wheat as inline SVG components.
 *
 * Mirrors the BCurrency.tsx idiom: each component sets `width="1em"
 * height="1em"` so it scales with the surrounding `font-size`, and uses
 * `fill="currentColor"` so the same SVG renders in the per-grain palette
 * (corn-yellow, rye-red, barley-teal, wheat-cyan) just by inheriting
 * `text-...` from its parent.
 *
 * Wired up via `RESOURCE_GLYPH` in `handCardStyles.ts` so every render
 * site (HandTray, MarketCenter, CardInspectModal, StarterDeckDraftModal,
 * PurchaseFlight) picks the new icons up automatically.
 *
 * Cask still uses a plain ◯ unicode glyph (defined inline in
 * `handCardStyles.ts`) — it's not a grain, and its single-character
 * rendering already tints correctly via the same color machinery.
 */

import type { SVGProps } from "react";

type IconProps = Omit<SVGProps<SVGSVGElement>, "fill" | "viewBox" | "xmlns">;

const COMMON: SVGProps<SVGSVGElement> = {
  xmlns: "http://www.w3.org/2000/svg",
  width: "1em",
  height: "1em",
  viewBox: "0 0 24 24",
  fill: "currentColor",
  "aria-hidden": true,
};

/**
 * Corn — vertical cob with two husk leaves visible at the top. The
 * silhouette reads as a "pill" in the lineup, distinct from the V-pattern
 * shapes of wheat / barley and the narrow spike of rye.
 */
export function CornIcon(props: IconProps) {
  return (
    <svg {...COMMON} {...props}>
      {/* Husk leaves curling up from the cob's shoulders */}
      <path
        d="M9 7c-2-1-4.2-1.8-6-1.6 1.1 1.8 3.2 3.5 6 4.4z"
        opacity="0.55"
      />
      <path
        d="M15 7c2-1 4.2-1.8 6-1.6-1.1 1.8-3.2 3.5-6 4.4z"
        opacity="0.55"
      />
      {/* Cob body */}
      <path d="M12 4c-2.5 0-4 2-4 5v9c0 2 1.5 4 4 4s4-2 4-4V9c0-3-1.5-5-4-5z" />
      {/* Kernel rows — translucent dark stripes for an embossed look that
          works on the per-grain yellow background */}
      <path
        d="M8.5 9h7M8.5 11h7M8.5 13h7M8.5 15h7M8.5 17h7"
        stroke="#000"
        strokeWidth="0.6"
        opacity="0.22"
        fill="none"
      />
    </svg>
  );
}

/**
 * Wheat — central stalk with three pairs of tilted kernel ovals plus a
 * single kernel at the very top. Reads as the classic "ear of wheat"
 * silhouette in the V-pattern family.
 */
export function WheatIcon(props: IconProps) {
  return (
    <svg {...COMMON} {...props}>
      {/* Stalk */}
      <path d="M11.25 8h1.5v14h-1.5z" />
      {/* Top kernel */}
      <ellipse cx="12" cy="5" rx="1.6" ry="2.4" />
      {/* Three pairs of side kernels, tilted out from the stalk */}
      <ellipse
        cx="9"
        cy="9.5"
        rx="1.4"
        ry="2.2"
        transform="rotate(-25 9 9.5)"
      />
      <ellipse
        cx="15"
        cy="9.5"
        rx="1.4"
        ry="2.2"
        transform="rotate(25 15 9.5)"
      />
      <ellipse
        cx="9"
        cy="13.5"
        rx="1.4"
        ry="2.2"
        transform="rotate(-25 9 13.5)"
      />
      <ellipse
        cx="15"
        cy="13.5"
        rx="1.4"
        ry="2.2"
        transform="rotate(25 15 13.5)"
      />
      <ellipse
        cx="9"
        cy="17.5"
        rx="1.4"
        ry="2.2"
        transform="rotate(-25 9 17.5)"
      />
      <ellipse
        cx="15"
        cy="17.5"
        rx="1.4"
        ry="2.2"
        transform="rotate(25 15 17.5)"
      />
    </svg>
  );
}

/**
 * Barley — wheat-shaped head plus the long awn whiskers that botanically
 * distinguish barley from wheat. The whiskers extend straight up past the
 * top of the bounding box so the silhouette reads as "spiky on top".
 */
export function BarleyIcon(props: IconProps) {
  return (
    <svg {...COMMON} {...props}>
      {/* Awns / whiskers extending up from the kernel head */}
      <path
        d="M12 10V1M9.5 10L6.5 1.5M14.5 10L17.5 1.5M10.5 10L8.5 1M13.5 10L15.5 1"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
      />
      {/* Stalk */}
      <path d="M11.25 13h1.5v9h-1.5z" />
      {/* Top kernel — single bigger cluster (barley heads tighter than wheat) */}
      <ellipse cx="12" cy="11" rx="2.2" ry="3" />
      {/* Two pairs of side kernels */}
      <ellipse cx="9" cy="15" rx="1.4" ry="2" transform="rotate(-25 9 15)" />
      <ellipse cx="15" cy="15" rx="1.4" ry="2" transform="rotate(25 15 15)" />
      <ellipse cx="9" cy="19" rx="1.4" ry="2" transform="rotate(-25 9 19)" />
      <ellipse cx="15" cy="19" rx="1.4" ry="2" transform="rotate(25 15 19)" />
    </svg>
  );
}

/**
 * Rye — narrow elongated seed-head with horizontal kernel ridges and a
 * stalk extending below. Significantly thinner than wheat / barley so the
 * silhouette reads as "rye-spike" at any size.
 */
export function RyeIcon(props: IconProps) {
  return (
    <svg {...COMMON} {...props}>
      {/* Lower stalk */}
      <path d="M11.25 17h1.5v5h-1.5z" />
      {/* Tall narrow head — narrower than corn/wheat/barley */}
      <path d="M12 2c-2.4 0-3.5 1.5-3.5 4v8c0 2 1.4 3 3.5 3s3.5-1 3.5-3V6c0-2.5-1.1-4-3.5-4z" />
      {/* Kernel ridges — translucent dark bands */}
      <path
        d="M8.7 6h6.6M8.5 8h7M8.5 10h7M8.5 12h7M8.7 14h6.6"
        stroke="#000"
        strokeWidth="0.55"
        opacity="0.22"
        fill="none"
      />
    </svg>
  );
}
