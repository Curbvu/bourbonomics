"use client";

/**
 * DraftPickFlight — two-phase animation that bridges the gap between
 * the drafting modal closing and the new mash bill landing in its
 * destination slot. Mirrors AgeFlight / MakeFlight in mount style
 * (`fixed inset-0 z-[80]`, two-step setTimeout, getBoundingClientRect
 * for live coordinates).
 *
 * Triggered by `triggerDraftPickAnimation` from DrawBillOverlay's
 * pay handler, which captures the bill's DOM rect synchronously (the
 * modal unmounts on dispatch so we can't measure it later).
 *
 * Choreography (total ≈ 1100ms):
 *   t=0        spawn both ghosts; the card sits on top of the hand
 *              tray, the bill sits where it was clicked in the modal
 *   t=80ms     start card → bill translation (400ms)
 *              the card flies up into the bill, fading out at the end
 *   t=500ms    start bill → slot translation (600ms)
 *              the bill flies down into the destination rickhouse slot
 *   t=1180ms   clear
 *
 * The two-element handoff sells the trade: "this card became that
 * bill, which became this barrel."
 */

import { useEffect, useState } from "react";
import {
  useGameStore,
  type LastDraftPick,
} from "@/lib/store/game";
import {
  LABOR_CHROME,
  RESOURCE_CHROME,
  RESOURCE_GLYPH,
  RESOURCE_LABEL,
  laborGlyphFor,
} from "./handCardStyles";
import type { ResourceSubtype } from "@bourbonomics/engine";

const CARD_FLIGHT_MS = 400;
const CARD_SPAWN_MS = 80;
const BILL_DELAY_MS = 500;
const BILL_FLIGHT_MS = 600;
const TOTAL_MS = BILL_DELAY_MS + BILL_FLIGHT_MS + 80;

interface ActiveFlight {
  snapshot: LastDraftPick;
  cardSource: { x: number; y: number } | null;
  cardDelta: { dx: number; dy: number } | null;
  billDelta: { dx: number; dy: number; scale: number } | null;
}

export default function DraftPickFlight() {
  const { lastDraftPick } = useGameStore();
  const [active, setActive] = useState<ActiveFlight | null>(null);

  // Re-trigger on every new seq so the same slot can be filled
  // multiple times in a game.
  useEffect(() => {
    if (!lastDraftPick) return;
    setActive({
      snapshot: lastDraftPick,
      cardSource: null,
      cardDelta: null,
      billDelta: null,
    });
  }, [lastDraftPick?.seq]); // eslint-disable-line react-hooks/exhaustive-deps

  // Step 1: locate the hand tray as the card's start position.
  useEffect(() => {
    if (!active) return;
    if (active.cardSource != null) return;
    const tray = document.querySelector<HTMLElement>("[data-hand-tray]");
    if (!tray) {
      // Fallback to bottom-center of the viewport — better than
      // killing the animation entirely if the tray happens to be
      // unmounted at this exact frame.
      setActive({
        ...active,
        cardSource: {
          x: window.innerWidth / 2,
          y: window.innerHeight - 100,
        },
      });
      return;
    }
    const r = tray.getBoundingClientRect();
    setActive({
      ...active,
      cardSource: { x: r.left + r.width / 2, y: r.top + r.height / 2 },
    });
  }, [active]);

  // Step 2: after a brief spawn beat, translate the card from hand →
  // bill rect. The bill ghost stays parked at billStartRect during
  // this phase (i.e. cardDelta is set but billDelta is still null).
  useEffect(() => {
    if (!active) return;
    if (active.cardSource == null) return;
    if (active.cardDelta != null) return;
    const t = window.setTimeout(() => {
      const billCx =
        active.snapshot.billStartRect.x +
        active.snapshot.billStartRect.w / 2;
      const billCy =
        active.snapshot.billStartRect.y +
        active.snapshot.billStartRect.h / 2;
      const dx = billCx - active.cardSource!.x;
      const dy = billCy - active.cardSource!.y;
      setActive({ ...active, cardDelta: { dx, dy } });
    }, CARD_SPAWN_MS);
    return () => window.clearTimeout(t);
  }, [active]);

  // Step 3: after BILL_DELAY_MS, translate the bill from its start
  // rect into the destination slot. The slot may not exist yet if the
  // engine rejected (or the player has no rickhouse slots in DOM
  // because they're scrolled off) — bail in that case rather than
  // animate to a stale position.
  useEffect(() => {
    if (!active) return;
    if (active.cardDelta == null) return;
    if (active.billDelta != null) return;
    const t = window.setTimeout(() => {
      const target = document.querySelector<HTMLElement>(
        `[data-slot-id="${active.snapshot.slotId}"]`,
      );
      if (!target) return;
      const dest = target.getBoundingClientRect();
      const billCx =
        active.snapshot.billStartRect.x +
        active.snapshot.billStartRect.w / 2;
      const billCy =
        active.snapshot.billStartRect.y +
        active.snapshot.billStartRect.h / 2;
      const destCx = dest.left + dest.width / 2;
      const destCy = dest.top + dest.height / 2;
      const dx = destCx - billCx;
      const dy = destCy - billCy;
      // Shrink to roughly the slot so the landing reads as
      // "this bill became that barrel".
      const scale = Math.max(0.35, dest.width / 220);
      setActive((prev) =>
        prev
          ? { ...prev, billDelta: { dx, dy, scale } }
          : prev,
      );
    }, BILL_DELAY_MS - CARD_SPAWN_MS);
    return () => window.clearTimeout(t);
  }, [active]);

  // Step 4: clear after the full sequence finishes.
  useEffect(() => {
    if (!active || active.cardDelta == null) return;
    const t = window.setTimeout(() => setActive(null), TOTAL_MS);
    return () => window.clearTimeout(t);
  }, [active]);

  if (!active || !active.cardSource) return null;
  const { snapshot, cardSource, cardDelta, billDelta } = active;

  // Card ghost transform — translates from hand center into bill rect.
  const cardTransform =
    cardDelta == null
      ? "translate(-50%, -50%) scale(1)"
      : `translate(calc(-50% + ${cardDelta.dx}px), calc(-50% + ${cardDelta.dy}px)) scale(0.85)`;

  // Bill ghost transform — sits at its captured rect, then translates
  // into the destination slot when billDelta is set.
  const billTransform =
    billDelta == null
      ? "translate(0, 0) scale(1)"
      : `translate(${billDelta.dx}px, ${billDelta.dy}px) scale(${billDelta.scale.toFixed(3)})`;

  // Card chrome — pull from the resource/labor palette so the ghost
  // reads as the same kind of card the player just spent.
  const card = snapshot.spentCard;
  const isLabor = card.type === "labor";
  const subtype = card.subtype as ResourceSubtype | undefined;
  const chrome = isLabor
    ? LABOR_CHROME
    : subtype
      ? RESOURCE_CHROME[subtype]
      : LABOR_CHROME;
  const laborSubtypeLabel =
    card.laborSubtype === "marketing"
      ? "Marketing"
      : card.laborSubtype === "cooper"
        ? "Cooper"
        : card.laborSubtype === "architect"
          ? "Architect"
          : "Labor";
  const cardLabel = isLabor
    ? laborSubtypeLabel
    : subtype
      ? RESOURCE_LABEL[subtype]
      : "Card";
  const cardGlyph = isLabor
    ? laborGlyphFor(card.laborSubtype)
    : subtype
      ? RESOURCE_GLYPH[subtype]
      : "?";

  return (
    <div
      key={snapshot.seq}
      className="pointer-events-none fixed inset-0 z-[80]"
      aria-hidden
    >
      {/* Card ghost — starts centered on the hand tray, flies into
          the captured bill rect. */}
      <div
        className={`absolute flex h-[110px] w-[78px] flex-col items-center justify-center gap-1 overflow-hidden rounded-md border-2 shadow-[0_8px_22px_rgba(0,0,0,.55)] ${chrome.gradient} ${chrome.border}`}
        style={{
          top: cardSource.y,
          left: cardSource.x,
          transform: cardTransform,
          transition:
            cardDelta == null
              ? undefined
              : `transform ${CARD_FLIGHT_MS}ms cubic-bezier(0.4, 0.05, 0.7, 0.95), opacity ${CARD_FLIGHT_MS / 2}ms ease-in ${CARD_FLIGHT_MS / 2}ms`,
          opacity: cardDelta == null ? 1 : 0,
        }}
      >
        <span className={`text-3xl ${chrome.ink}`}>{cardGlyph}</span>
        <span
          className={`font-mono text-[9px] uppercase tracking-[.12em] ${chrome.label}`}
        >
          {cardLabel}
        </span>
      </div>

      {/* Bill ghost — anchored to the captured bill rect, then flies
          into the destination distillery slot once the card lands. */}
      <div
        className="absolute flex flex-col rounded-xl border-2 border-amber-300 bg-gradient-to-b from-amber-800/90 via-amber-950/90 to-slate-950 px-3.5 py-3 shadow-[0_12px_30px_rgba(251,191,36,.45)]"
        style={{
          top: snapshot.billStartRect.y,
          left: snapshot.billStartRect.x,
          width: snapshot.billStartRect.w,
          height: snapshot.billStartRect.h,
          transform: billTransform,
          transformOrigin: "center center",
          transition:
            billDelta == null
              ? undefined
              : `transform ${BILL_FLIGHT_MS}ms cubic-bezier(0.4, 0.05, 0.7, 0.95), opacity ${BILL_FLIGHT_MS}ms ease-in`,
          opacity: billDelta == null ? 1 : 0.9,
        }}
      >
        <div className="font-mono text-[10px] uppercase tracking-[.18em] text-amber-300">
          New Bill
        </div>
        <h4 className="mt-1 line-clamp-2 font-display text-[14px] font-bold leading-tight text-amber-50 drop-shadow-[0_1px_4px_rgba(0,0,0,.5)]">
          {snapshot.mashBillName}
        </h4>
        <div className="mt-auto flex justify-center">
          <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-amber-300 bg-white/10 text-xl text-amber-100">
            🛢
          </span>
        </div>
      </div>
    </div>
  );
}
