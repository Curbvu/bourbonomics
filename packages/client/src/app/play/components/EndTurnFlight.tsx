"use client";

/**
 * EndTurnFlight — fans the human's hand into the discard pile when
 * they press "End turn". Reads `lastEndTurnDiscard` from the store
 * (bumped synchronously by ActionBar BEFORE it dispatches PASS_TURN,
 * so the cards are captured while the hand still exists). Each card
 * spawns at the hand-tray center, fans into a brief shallow arc, and
 * slides + shrinks into the discard tile (`data-purchase-target=
 * "discard"`).
 *
 * Pure visual / pure DOM — no game-state mutation; just unmounts when
 * the animation finishes. Mounted at the page root in play/page.tsx.
 */

import { useEffect, useState } from "react";
import type { Card } from "@bourbonomics/engine";
import { useGameStore } from "@/lib/store/game";
import HandCardTile from "./HandCardTile";

const FLIGHT_MS = 720;
const CARD_W = 100;
const CARD_H = 140;

interface FlyingCard {
  card: Card;
  index: number;
  total: number;
  startX: number;
  startY: number;
  dx: number;
  dy: number;
}

export default function EndTurnFlight() {
  const { lastEndTurnDiscard } = useGameStore();
  const [active, setActive] = useState<{
    key: number;
    cards: FlyingCard[];
  } | null>(null);

  useEffect(() => {
    if (!lastEndTurnDiscard || lastEndTurnDiscard.cards.length === 0) return;

    // Target the discard tile that PurchaseFlight already routes to.
    // Falls back to the bottom-left corner if the tile isn't mounted
    // (very early or in tutorial mode without a hand tray).
    const target = document.querySelector<HTMLElement>(
      '[data-purchase-target="discard"]',
    );
    const trayCenter = (() => {
      const tray = document.querySelector<HTMLElement>("[data-hand-tray]");
      if (tray) {
        const r = tray.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }
      return { x: window.innerWidth / 2, y: window.innerHeight - 160 };
    })();
    const targetCenter = (() => {
      if (!target) return { x: 100, y: window.innerHeight - 80 };
      const r = target.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })();

    const n = lastEndTurnDiscard.cards.length;
    const stride = 70;
    const mid = (n - 1) / 2;
    const cards: FlyingCard[] = lastEndTurnDiscard.cards.map((card, i) => {
      const off = i - mid;
      // Spread the start positions across the hand tray width so the
      // animation looks like the actual hand lifting off, not a stack.
      const startX = trayCenter.x + off * stride - CARD_W / 2;
      const startY = trayCenter.y - CARD_H / 2;
      const dx = targetCenter.x - (startX + CARD_W / 2);
      const dy = targetCenter.y - (startY + CARD_H / 2);
      return { card, index: i, total: n, startX, startY, dx, dy };
    });

    setActive({ key: lastEndTurnDiscard.seq, cards });
    const id = window.setTimeout(
      () => setActive(null),
      FLIGHT_MS + n * 35 + 60,
    );
    return () => window.clearTimeout(id);
  }, [lastEndTurnDiscard]);

  if (!active) return null;

  return (
    <div
      key={active.key}
      className="pointer-events-none fixed inset-0 z-40"
      aria-hidden
    >
      {active.cards.map((c) => (
        <div
          key={c.index}
          className="end-turn-flight-card absolute"
          style={
            {
              left: `${c.startX}px`,
              top: `${c.startY}px`,
              width: CARD_W,
              height: CARD_H,
              "--dx": `${c.dx}px`,
              "--dy": `${c.dy}px`,
              animationDelay: `${c.index * 35}ms`,
            } as React.CSSProperties
          }
        >
          <HandCardTile card={c.card} size="md" />
        </div>
      ))}
      <style>{`
        @keyframes end-turn-flight {
          0% {
            transform: translate(0, 0) scale(1) rotate(0deg);
            opacity: 0;
          }
          12% {
            opacity: 1;
            transform: translate(0, -24px) scale(1.02) rotate(0deg);
          }
          100% {
            transform: translate(var(--dx), var(--dy)) scale(0.32) rotate(-14deg);
            opacity: 0;
          }
        }
        .end-turn-flight-card {
          animation: end-turn-flight ${FLIGHT_MS}ms cubic-bezier(0.4, 0.05, 0.7, 0.95) both;
          filter: drop-shadow(0 8px 18px rgba(0, 0, 0, 0.55));
          transform-origin: center;
        }
      `}</style>
    </div>
  );
}
