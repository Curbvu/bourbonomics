"use client";

/**
 * PurchaseFlight — animated confirmation that a market card was bought.
 *
 * Reads `lastPurchase` from the store (bumped by every BUY_FROM_MARKET
 * dispatch — bot or human). Spawns an absolutely-positioned card
 * silhouette that slides + fades from the top of the viewport (where the
 * market lives) toward the bottom-right (where the player's deck +
 * discard counter live in the HandTray strip). Auto-clears after the
 * animation completes; the next purchase remounts on a fresh `seq` key.
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

const FLIGHT_MS = 850;

export default function PurchaseFlight() {
  const { lastPurchase } = useGameStore();
  // Local mirror so we keep painting through the animation even after
  // the store moves on to the next purchase.
  const [active, setActive] = useState<{ card: Card; key: number } | null>(
    null,
  );

  useEffect(() => {
    if (!lastPurchase) return;
    setActive({ card: lastPurchase.card, key: lastPurchase.seq });
    const id = window.setTimeout(() => setActive(null), FLIGHT_MS);
    return () => window.clearTimeout(id);
  }, [lastPurchase]);

  if (!active) return null;

  return (
    <div
      key={active.key}
      className="pointer-events-none fixed inset-0 z-40"
      aria-hidden
    >
      <div
        className="absolute h-[140px] w-[100px] purchase-flight-card"
        style={{ left: "calc(50% - 50px)", top: "120px" }}
      >
        <FlightFace card={active.card} />
      </div>
      <style>{`
        @keyframes purchase-flight {
          0% {
            transform: translate(0, 0) scale(1) rotate(0deg);
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          70% {
            opacity: 0.95;
          }
          100% {
            transform: translate(40vw, 70vh) scale(0.35) rotate(18deg);
            opacity: 0;
          }
        }
        .purchase-flight-card {
          animation: purchase-flight ${FLIGHT_MS}ms cubic-bezier(0.4, 0.05, 0.7, 0.95) forwards;
          filter: drop-shadow(0 8px 18px rgba(0, 0, 0, 0.55));
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
        <span className={`text-[8px] font-semibold uppercase tracking-[0.16em] ${chrome.label}`}>
          Capital
        </span>
        <div className={`mt-auto flex flex-col items-center ${chrome.ink}`}>
          <MoneyText
            n={value}
            className="font-display text-[24px] font-bold leading-none drop-shadow-[0_2px_6px_rgba(0,0,0,.45)]"
          />
          <span className={`mt-0.5 font-mono text-[8px] uppercase tracking-[.16em] ${chrome.label}`}>
            spend
          </span>
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
      <span className={`text-[8px] font-semibold uppercase tracking-[0.16em] ${chrome.label}`}>
        {RESOURCE_LABEL[subtype]}
      </span>
      <h4 className={`mt-0.5 font-display text-[11px] font-bold leading-tight ${chrome.ink}`}>
        {count > 1 ? `${count}×` : ""} {RESOURCE_LABEL[subtype]}
      </h4>
      <div
        className={`mt-auto grid h-9 w-9 self-center place-items-center rounded-full border-2 bg-white/10 text-lg ${chrome.border} ${chrome.ink}`}
      >
        {RESOURCE_GLYPH[subtype]}
      </div>
    </div>
  );
}
