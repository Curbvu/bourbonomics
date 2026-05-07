"use client";

/**
 * SaleFlight — animated confirmation that a barrel just sold.
 *
 * Reads `lastSale` from the store (bumped by every SELL_BOURBON
 * dispatch) and spawns one card silhouette per card that left the
 * barrel (production + aging pile). Each card flies from the (now
 * vanished) slot to the discard pile with a small per-card stagger
 * so the row reads as "the barrel emptied into the discard."
 *
 * Falls back to a fixed bottom-left translate if the destination
 * tile or origin slot isn't mounted yet.
 */

import { useEffect, useState } from "react";
import type { Card, ResourceSubtype } from "@bourbonomics/engine";
import { useGameStore } from "@/lib/store/game";
import {
  CAPITAL_CHROME,
  RESOURCE_CHROME,
  RESOURCE_GLYPH,
  RESOURCE_LABEL,
} from "./handCardStyles";
import { MoneyText } from "./money";

const FLIGHT_MS = 720;
const STAGGER_MS = 55;
const CARD_W = 80;
const CARD_H = 110;
// Cap the visible card count so a 7-card barrel doesn't choke the
// animation. Beyond this we still show the count badge.
const MAX_VISIBLE = 6;

interface ActiveSale {
  cards: Card[];
  start: { x: number; y: number };
  end: { x: number; y: number };
  totalCount: number;
  key: number;
}

export default function SaleFlight() {
  const { lastSale } = useGameStore();
  const [active, setActive] = useState<ActiveSale | null>(null);

  useEffect(() => {
    if (!lastSale) return;
    const slot = document.querySelector<HTMLElement>(
      `[data-slot-id="${lastSale.slotId}"]`,
    );
    const discard = document.querySelector<HTMLElement>(
      '[data-purchase-target="discard"]',
    );
    let startX = window.innerWidth / 2 - CARD_W / 2;
    let startY = window.innerHeight / 2 - CARD_H / 2;
    if (slot) {
      const r = slot.getBoundingClientRect();
      startX = r.left + r.width / 2 - CARD_W / 2;
      startY = r.top + r.height / 2 - CARD_H / 2;
    }
    let endX = startX - window.innerWidth * 0.4;
    let endY = startY + window.innerHeight * 0.5;
    if (discard) {
      const r = discard.getBoundingClientRect();
      endX = r.left + r.width / 2 - CARD_W / 2;
      endY = r.top + r.height / 2 - CARD_H / 2;
    }
    const visible = lastSale.cards.slice(0, MAX_VISIBLE);
    setActive({
      cards: visible,
      start: { x: startX, y: startY },
      end: { x: endX, y: endY },
      totalCount: lastSale.cards.length,
      key: lastSale.seq,
    });
    const last = STAGGER_MS * Math.max(0, visible.length - 1) + FLIGHT_MS;
    const id = window.setTimeout(() => setActive(null), last + 80);
    return () => window.clearTimeout(id);
  }, [lastSale]);

  if (!active) return null;
  const { cards, start, end, totalCount, key } = active;
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  return (
    <div
      key={key}
      className="pointer-events-none fixed inset-0 z-40"
      aria-hidden
    >
      {cards.map((card, i) => {
        // Tiny lateral fan so the cards don't perfectly overlap. The
        // spread is bounded so a 6-card sale still reads as a single
        // arc rather than a starburst.
        const fan = (i - (cards.length - 1) / 2) * 14;
        return (
          <div
            key={`${card.id}-${i}`}
            className="absolute sale-flight-card"
            style={
              {
                left: `${start.x + fan}px`,
                top: `${start.y}px`,
                width: `${CARD_W}px`,
                height: `${CARD_H}px`,
                "--dx": `${dx - fan}px`,
                "--dy": `${dy}px`,
                animationDelay: `${i * STAGGER_MS}ms`,
              } as React.CSSProperties
            }
          >
            <FlightFace card={card} />
          </div>
        );
      })}
      {totalCount > MAX_VISIBLE ? (
        <div
          className="absolute font-mono text-[10px] font-bold uppercase tracking-[.18em] text-amber-200"
          style={{
            left: `${start.x + CARD_W + 4}px`,
            top: `${start.y - 6}px`,
          }}
        >
          +{totalCount - MAX_VISIBLE}
        </div>
      ) : null}
      <style>{`
        @keyframes sale-flight {
          0% {
            transform: translate(0, 0) scale(1) rotate(0deg);
            opacity: 0;
          }
          12% {
            opacity: 1;
          }
          70% {
            opacity: 0.92;
          }
          100% {
            transform: translate(var(--dx), var(--dy)) scale(0.32) rotate(-8deg);
            opacity: 0;
          }
        }
        .sale-flight-card {
          animation: sale-flight ${FLIGHT_MS}ms cubic-bezier(0.4, 0.05, 0.7, 0.95) forwards;
          filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.55));
        }
      `}</style>
    </div>
  );
}

function FlightFace({ card }: { card: Card }) {
  if (card.type === "capital") {
    const value = card.capitalValue ?? 1;
    const chrome = CAPITAL_CHROME;
    return (
      <div
        className={[
          "relative flex h-full w-full flex-col overflow-hidden rounded-md border-2 p-1.5 ring-1 ring-white/10",
          chrome.gradient,
          chrome.border,
        ].join(" ")}
      >
        <span className={`text-[7px] font-semibold uppercase tracking-[0.16em] ${chrome.label}`}>
          Capital
        </span>
        <div className={`mt-auto flex flex-col items-center ${chrome.ink}`}>
          <MoneyText
            n={value}
            className="font-display text-[20px] font-bold leading-none drop-shadow-[0_2px_6px_rgba(0,0,0,.45)]"
          />
        </div>
      </div>
    );
  }
  const subtype = (card.subtype ?? "corn") as ResourceSubtype;
  const chrome = RESOURCE_CHROME[subtype];
  const count = card.resourceCount ?? 1;
  return (
    <div
      className={[
        "relative flex h-full w-full flex-col overflow-hidden rounded-md border-2 p-1.5 ring-1 ring-white/10",
        chrome.gradient,
        chrome.border,
      ].join(" ")}
    >
      <span className={`text-[7px] font-semibold uppercase tracking-[0.16em] ${chrome.label}`}>
        {RESOURCE_LABEL[subtype]}
      </span>
      <h4 className={`mt-0.5 font-display text-[10px] font-bold leading-tight ${chrome.ink}`}>
        {count > 1 ? `${count}×` : ""} {RESOURCE_LABEL[subtype]}
      </h4>
      <div
        className={`mt-auto grid h-7 w-7 self-center place-items-center rounded-full border-2 bg-white/10 text-base ${chrome.border} ${chrome.ink}`}
      >
        {RESOURCE_GLYPH[subtype]}
      </div>
    </div>
  );
}
