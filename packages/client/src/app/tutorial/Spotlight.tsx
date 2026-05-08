"use client";

/**
 * Tutorial spotlight — locates the DOM element matching the active
 * beat's `SpotlightTarget` and draws a glowing ring around it. Also
 * exports the `RichText` helper used by every overlay surface.
 *
 * The lookup table maps each SpotlightTarget kind to a DOM selector
 * against the live game components: rickhouse rows + per-slot ids,
 * hand tray, market panel, top-bar zones. We poll the bounding box
 * 4× per second so the ring tracks layout shifts (mode toggles in
 * MakeOverlay/BuyOverlay can move things around).
 */

import { useEffect, useState } from "react";
import { TUTORIAL_HUMAN_ID } from "@bourbonomics/engine";
import type { SpotlightTarget } from "./types";

function findSpotlightElement(target: SpotlightTarget): Element | null {
  switch (target.kind) {
    case "rickhouse-slot": {
      const slotId = `slot_${target.ownerId}_${target.slotIndex}`;
      return document.querySelector(`[data-slot-id="${slotId}"]`);
    }
    case "rickhouse-row": {
      // The human's row is the one NOT marked as opponent-rickhouse.
      // Both rows carry [data-rickhouse-row]; the human row also has a
      // RickhouseRow with default data-bb-zone (no value); the opponent's
      // wrapping rickhouse panel has data-bb-zone="opponent-rickhouse".
      const rows = Array.from(
        document.querySelectorAll("[data-rickhouse-row]"),
      );
      if (target.ownerId === TUTORIAL_HUMAN_ID) {
        const human = rows.find((r) => {
          const wrapper = r.parentElement;
          return wrapper?.getAttribute("data-bb-zone") !== "opponent-rickhouse";
        });
        return human ?? rows[0] ?? null;
      }
      const opp = rows.find((r) => {
        const wrapper = r.parentElement;
        return wrapper?.getAttribute("data-bb-zone") === "opponent-rickhouse";
      });
      return opp ?? rows[1] ?? rows[0] ?? null;
    }
    case "hand-card": {
      // HandTray exposes `data-card-id` on each hand card. Fall back to
      // the whole hand tray if the card has been spent / not yet drawn.
      const el = document.querySelector(`[data-card-id="${target.cardId}"]`);
      return el ?? document.querySelector("[data-hand-tray]");
    }
    case "hand-cards": {
      // Multi-card spotlight: use the bounding box of the union via the
      // first matched card's parent. For now, fall back to the whole
      // hand tray — the spec's tour just needs the row visible.
      if (target.cardIds.length > 0) {
        const first = document.querySelector(
          `[data-card-id="${target.cardIds[0]}"]`,
        );
        if (first) return first;
      }
      return document.querySelector("[data-hand-tray]");
    }
    case "market-slot":
    case "market-row":
      // Spotlight just the conveyor row (10 face-up cards). The full
      // market zone (`data-bb-zone='market'`) also wraps the mash-bills
      // row + investments + ops + bourbon deck — too broad for the
      // tour stop and the per-slot beat.
      return (
        document.querySelector("[data-market-conveyor]") ??
        document.querySelector("[data-bb-zone='market']")
      );
    case "demand":
      return document.querySelector('[data-bb-zone="demand"]');
    case "reputation":
      return document.querySelector('[data-bb-zone="reputation"]');
    case "supply":
      // The bourbon mash-bills row IS the supply — a depleted row is
      // the doomsday clock. Fall back to the small counter chip in the
      // top bar if MarketCenter hasn't mounted yet.
      return (
        document.querySelector("[data-bourbon-row]") ??
        document.querySelector('[data-bb-zone="supply-counter"]')
      );
    case "none":
    default:
      return null;
  }
}

/**
 * When the primary spotlight is on a target that requires committing
 * a card from hand (rickhouse barrels for make/age, market for buy),
 * we ALSO leave the hand tray un-dimmed and faintly ringed so the
 * player sees they need to follow up with a hand-card click. Without
 * this, the dim layer covers the hand and the sky/amber rings on
 * individual cards get muted.
 */
function wantsHandSecondary(target: SpotlightTarget | undefined): boolean {
  if (!target) return false;
  return (
    target.kind === "rickhouse-slot" ||
    target.kind === "rickhouse-row" ||
    target.kind === "market-slot" ||
    target.kind === "market-row"
  );
}

function findHandTrayElement(): Element | null {
  return document.querySelector("[data-hand-tray]");
}

export function SpotlightLayer({ target }: { target: SpotlightTarget | undefined }) {
  const [box, setBox] = useState<DOMRect | null>(null);
  const [handBox, setHandBox] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!target || target.kind === "none") {
      setBox(null);
      setHandBox(null);
      return;
    }
    const wantsHand = wantsHandSecondary(target);
    const measure = () => {
      const el = findSpotlightElement(target);
      const next = el?.getBoundingClientRect() ?? null;
      setBox((prev) => {
        if (!prev || !next) return next;
        if (
          Math.abs(prev.top - next.top) < 0.5 &&
          Math.abs(prev.left - next.left) < 0.5 &&
          Math.abs(prev.width - next.width) < 0.5 &&
          Math.abs(prev.height - next.height) < 0.5
        ) {
          return prev;
        }
        return next;
      });
      if (wantsHand) {
        const handEl = findHandTrayElement();
        const handNext = handEl?.getBoundingClientRect() ?? null;
        setHandBox((prev) => {
          if (!prev || !handNext) return handNext;
          if (
            Math.abs(prev.top - handNext.top) < 0.5 &&
            Math.abs(prev.left - handNext.left) < 0.5 &&
            Math.abs(prev.width - handNext.width) < 0.5 &&
            Math.abs(prev.height - handNext.height) < 0.5
          ) {
            return prev;
          }
          return handNext;
        });
      } else {
        setHandBox(null);
      }
    };
    measure();
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    const id = window.setInterval(measure, 250);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
      window.clearInterval(id);
    };
  }, [target]);

  if (!target || target.kind === "none" || !box) return null;

  const PAD = 8;
  const top = box.top - PAD;
  const left = box.left - PAD;
  const width = box.width + PAD * 2;
  const height = box.height + PAD * 2;

  // Secondary hand-tray hole (only present for rickhouse / market beats).
  const HAND_PAD = 4;
  const ht = handBox
    ? {
        top: handBox.top - HAND_PAD,
        left: handBox.left - HAND_PAD,
        width: handBox.width + HAND_PAD * 2,
        height: handBox.height + HAND_PAD * 2,
      }
    : null;

  // SVG mask: white = dim, black = transparent. Two black rects punch
  // out the primary spotlight and (optionally) the hand-tray, so the
  // amber-glow ring on the spotlit element AND the hand cards' own
  // sky/amber selection chrome both stay readable. Bumped to 70%
  // dim (was 55%) for stronger contrast between the actionable target
  // and the background table.
  return (
    <div className="pointer-events-none fixed inset-0 z-40">
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <mask id="bb-spotlight-mask" maskUnits="userSpaceOnUse">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect
              x={left}
              y={top}
              width={width}
              height={height}
              rx="8"
              fill="black"
            />
            {ht ? (
              <rect
                x={ht.left}
                y={ht.top}
                width={ht.width}
                height={ht.height}
                rx="8"
                fill="black"
              />
            ) : null}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgb(2 6 23)"
          fillOpacity="0.7"
          mask="url(#bb-spotlight-mask)"
        />
      </svg>
      {/* Primary amber ring — pointer-events-none so drop events land
          on the spotlit element underneath (see bf39ea6). */}
      <div
        className="pointer-events-none absolute rounded-lg border-2 border-amber-400 shadow-[0_0_24px_rgba(251,191,36,.55),inset_0_0_24px_rgba(251,191,36,.18)]"
        style={{ top, left, width, height }}
      />
      {/* Secondary, softer ring around the hand tray when this beat
          needs a hand-card follow-up. Lighter to read as "you'll act
          here next" rather than "click here first". */}
      {ht ? (
        <div
          className="pointer-events-none absolute rounded-lg border-2 border-sky-300/70 shadow-[0_0_14px_rgba(125,211,252,.35)]"
          style={{ top: ht.top, left: ht.left, width: ht.width, height: ht.height }}
        />
      ) : null}
    </div>
  );
}

/**
 * Light-weight markdown-ish renderer: only handles **bold** spans.
 * Everything else passes through verbatim. Beat copy uses **word**
 * sparingly so this is sufficient.
 */
export function RichText({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  const parts: { text: string; bold: boolean }[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(children)) !== null) {
    if (m.index > last) parts.push({ text: children.slice(last, m.index), bold: false });
    parts.push({ text: m[1]!, bold: true });
    last = m.index + m[0].length;
  }
  if (last < children.length) parts.push({ text: children.slice(last), bold: false });
  return (
    <p className={className}>
      {parts.map((p, i) =>
        p.bold ? (
          <strong key={i} className="font-semibold text-amber-100">
            {p.text}
          </strong>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </p>
  );
}
