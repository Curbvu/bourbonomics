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
      return document.querySelector("[data-bb-zone='market']");
    case "demand":
    case "reputation":
    case "supply":
      // All three live in the GameTopBar header. Spotlight the whole
      // top bar — close enough to draw the eye.
      return document.querySelector("header");
    case "none":
    default:
      return null;
  }
}

export function SpotlightLayer({ target }: { target: SpotlightTarget | undefined }) {
  const [box, setBox] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!target || target.kind === "none") {
      setBox(null);
      return;
    }
    const measure = () => {
      const el = findSpotlightElement(target);
      const next = el?.getBoundingClientRect() ?? null;
      setBox((prev) => {
        if (!prev || !next) return next;
        // Avoid setState churn when the box hasn't moved.
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

  // The cut-out: 4 rectangles around the spotlight that dim the rest of
  // the page. Cheaper than a CSS clip-path and works reliably across
  // browsers without coordinate-system surprises.
  const dim = "absolute bg-slate-950/55 pointer-events-none";
  const PAD = 8;
  const top = box.top - PAD;
  const left = box.left - PAD;
  const width = box.width + PAD * 2;
  const height = box.height + PAD * 2;

  return (
    <div className="pointer-events-none fixed inset-0 z-40">
      <div className={dim} style={{ top: 0, left: 0, right: 0, height: top }} />
      <div className={dim} style={{ top, left: 0, width: left, height }} />
      <div className={dim} style={{ top, left: left + width, right: 0, height }} />
      <div className={dim} style={{ top: top + height, left: 0, right: 0, bottom: 0 }} />
      <div
        className="absolute rounded-lg border-2 border-amber-400 shadow-[0_0_24px_rgba(251,191,36,.55),inset_0_0_24px_rgba(251,191,36,.18)]"
        style={{ top, left, width, height }}
      />
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
