"use client";

/**
 * v3 MarketDrawer — overlay sheet that surfaces the shared market
 * when the player clicks the BUY MARKET action button. Replaces the
 * persistent inline MarketCenter row so the main view stays focused
 * on the rickhouse + hand. Closes on backdrop click, ✕ button, or
 * the keyboard Escape key.
 *
 * Card flow:
 *
 *   1. User clicks `BUY MARKET` in ActionBar → drawer opens (controlled
 *      by `marketOpen` local state in GameBoard).
 *   2. User clicks a MarketCard → drawer closes + the standard
 *      `buyMode` flow engages with the slot pre-targeted. BuyOverlay
 *      then handles payment selection.
 *
 * Preserves the existing `data-market-conveyor` + `data-market-slot-
 * index` attributes on each market card so the tutorial spotlight can
 * still anchor to specific tiles when the drawer is open.
 */

import { useEffect } from "react";
import type {
  Card,
  InvestmentCard,
  OperationsCard,
  ResourceSubtype,
} from "@bourbonomics/engine";
import { useGameStore } from "@/lib/store/game";
import {
  LABOR_CHROME,
  OPS_CHROME,
  RESOURCE_CHROME,
  RESOURCE_GLYPH,
  RESOURCE_LABEL,
  laborGlyphFor,
} from "./handCardStyles";
import { TIER_CHROME, TIER_INK, tierOrCommon } from "./tierStyles";

export default function MarketDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { state, startBuyMode, setBuyTarget, tutorialSpotlight } = useGameStore();

  // Esc closes the drawer.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !state) return null;

  const onCardClick = (slotIndex: number) => {
    // Close the drawer immediately and engage the standard buyMode
    // flow — BuyOverlay will then drive the payment selection.
    onClose();
    startBuyMode();
    setBuyTarget({ slotIndex });
  };

  // During an active tutorial spotlight, drop the drawer's full-screen
  // backdrop so the tutorial's own dim layer shows through. Without
  // this, the drawer's `rgba(8,5,3,.78)` + 6px blur stacks on top of
  // the tutorial dim and the hand tray below — making the spotlit
  // slot look muted and hiding the Labor card the player needs to
  // click. The drawer's content panel still renders normally; only
  // the wrapper background is gated.
  const dimDuringTutorial = tutorialSpotlight == null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="The market"
      className="fixed inset-0 z-[60] flex flex-col items-stretch justify-start p-8"
      style={{
        background: dimDuringTutorial
          ? "radial-gradient(60% 60% at 50% 40%, rgba(213,150,80,.18), transparent 70%), rgba(8,5,3,.78)"
          : "transparent",
        backdropFilter: dimDuringTutorial ? "blur(6px)" : undefined,
        animation: "log-in 220ms ease-out both",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="m-auto flex w-full max-w-[1200px] flex-col overflow-hidden rounded-[14px] border border-[#3b2818]"
        style={{
          maxHeight: "80vh",
          background:
            "radial-gradient(120% 60% at 50% 0%, rgba(240,201,112,.10), transparent 60%), linear-gradient(180deg, #1e140c 0%, #15100a 100%)",
          boxShadow:
            "0 30px 80px rgba(0,0,0,.7), inset 0 1px 0 rgba(240,201,112,.18)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-4 border-b border-[#3b2818] px-[22px] py-[14px]"
          style={{
            background:
              "linear-gradient(180deg, rgba(34,23,16,.85), rgba(20,14,8,.85))",
          }}
        >
          <div className="flex flex-col">
            <span className="stage-tag">The Market</span>
            <h2
              className="m-0 font-display text-[24px] font-semibold tracking-[.01em]"
              style={{ color: "var(--ink)" }}
            >
              Conveyor &amp; Bills
            </h2>
          </div>
          <span
            className="ml-2 font-display italic"
            style={{ color: "var(--brass)", fontSize: 14 }}
          >
            What the table is selling, this round.
          </span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="rounded-[7px] border border-[#3b2818] px-3.5 py-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[.16em]"
            style={{
              background:
                "linear-gradient(180deg, rgba(34,23,16,.9), rgba(20,14,8,.9))",
              color: "var(--ink-muted)",
            }}
          >
            Close ✕
          </button>
        </div>

        {/* Body */}
        <div
          data-market-conveyor
          className="scroll-thin flex flex-col gap-4 overflow-auto px-[22px] py-5"
        >
          <div className="flex items-baseline gap-2.5">
            <span className="stage-tag">Conveyor</span>
            <span
              aria-hidden
              className="h-px flex-1"
              style={{
                background:
                  "linear-gradient(90deg, var(--rule), transparent)",
              }}
            />
            <span className="label-sm">
              ten cards · refreshed each round
            </span>
          </div>
          <div
            className="grid gap-2.5"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(132px, 1fr))",
            }}
          >
            {state.market.map((c, i) => {
              const tutorialPulse =
                tutorialSpotlight?.kind === "market-slot" &&
                tutorialSpotlight.slotIndex === i;
              return (
                <MarketCard
                  key={c.id}
                  card={c}
                  slotIndex={i}
                  onClick={() => onCardClick(i)}
                  tutorialPulse={tutorialPulse}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Single market card in the drawer. Tier-tinted border + glow + hover
 * lift. Resources show subtype glyph; labor shows the worker glyph;
 * ops + investments use their kind label.
 */
function MarketCard({
  card,
  slotIndex,
  onClick,
  tutorialPulse = false,
}: {
  card: Card;
  slotIndex: number;
  onClick: () => void;
  /**
   * Tutorial-pulse passes through to DrawerCard so the spotlight is
   * visible inside the high-z drawer panel — the global SpotlightLayer
   * ring sits at z-40 below the drawer and would otherwise be hidden.
   */
  tutorialPulse?: boolean;
}) {
  // Cards are wider than the conveyor row's 100×140; the drawer can
  // afford bigger silhouettes. Tier chrome drives border + glow.
  const cost = card.cost ?? 1;

  // Resource / labor share a similar layout — subtype label top-right,
  // glyph centered. Ops + investment use their `opSpec` / `investmentSpec`.
  if (card.type === "labor") {
    const sub = card.laborSubtype;
    const chrome = LABOR_CHROME;
    const subtypeLabel =
      sub === "marketing"
        ? "Marketing"
        : sub === "cooper"
          ? "Cooper"
          : sub === "architect"
            ? "Architect"
            : "Worker";
    return (
      <DrawerCard
        cost={cost}
        slotIndex={slotIndex}
        onClick={onClick}
        tierInk={TIER_INK.common}
        kindLabel="Labor"
        gradient={chrome.gradient}
        border={chrome.border}
        labelColor={chrome.label}
        ink={chrome.ink}
        tutorialPulse={tutorialPulse}
      >
        <h4
          className="mt-0.5 line-clamp-2 font-display text-[16px] font-semibold leading-tight"
          style={{ color: "var(--ink)" }}
        >
          {card.displayName ?? `${subtypeLabel} Labor`}
        </h4>
        {card.flavor ? (
          <p
            className="mt-1 line-clamp-2 font-display text-[13px] italic leading-snug"
            style={{ color: "var(--mute)" }}
          >
            {card.flavor}
          </p>
        ) : null}
        <div
          className="mt-auto flex items-center justify-between border-t border-dotted pt-1.5"
          style={{ borderColor: "rgba(110,80,50,.3)" }}
        >
          <span
            className="font-emoji text-[18px] leading-none"
            style={{ color: chrome.label }}
            aria-hidden
          >
            {laborGlyphFor(sub)}
          </span>
          <span
            className="rounded px-1.5 py-px font-mono text-[11px] font-bold uppercase tracking-[.12em]"
            style={{
              border: `1px solid ${TIER_INK.common}`,
              color: TIER_INK.common,
            }}
          >
            {subtypeLabel === "Worker" ? "+1 any" : `+2 ${subtypeLabel.toLowerCase()}`}
          </span>
        </div>
      </DrawerCard>
    );
  }

  if (card.type === "operations" && card.opSpec) {
    const spec = card.opSpec;
    const chrome = OPS_CHROME;
    return (
      <DrawerCard
        cost={cost}
        slotIndex={slotIndex}
        onClick={onClick}
        tierInk={TIER_INK.uncommon}
        kindLabel="Ops"
        gradient={chrome.gradient}
        border={chrome.border}
        labelColor={chrome.label}
        ink={chrome.ink}
        tutorialPulse={tutorialPulse}
      >
        <h4
          className="mt-0.5 line-clamp-2 font-display text-[16px] font-semibold leading-tight"
          style={{ color: "var(--ink)" }}
        >
          {spec.name}
        </h4>
        {spec.flavor ? (
          <p
            className="mt-1 line-clamp-2 font-display text-[13px] italic leading-snug"
            style={{ color: "var(--mute)" }}
          >
            {spec.flavor}
          </p>
        ) : null}
        <div
          className="mt-auto flex items-center justify-between border-t border-dotted pt-1.5"
          style={{ borderColor: "rgba(110,80,50,.3)" }}
        >
          <span
            className="text-[16px]"
            style={{ color: chrome.label }}
            aria-hidden
          >
            ⚡
          </span>
          <span
            className="rounded px-1.5 py-px font-mono text-[11px] font-bold uppercase tracking-[.12em]"
            style={{
              border: `1px solid ${chrome.label}`,
              color: chrome.label,
            }}
          >
            Ops
          </span>
        </div>
      </DrawerCard>
    );
  }

  if (card.type === "investment" && card.investmentSpec) {
    const spec = card.investmentSpec;
    return (
      <DrawerCard
        cost={cost}
        slotIndex={slotIndex}
        onClick={onClick}
        tierInk="#82c9a3"
        kindLabel="Invest"
        gradient="bg-[linear-gradient(180deg,rgba(6,78,59,.30)_0%,rgba(20,14,8,.95)_70%)]"
        border="border-[#82c9a3]/60"
        labelColor="text-[#82c9a3]"
        ink="text-[#f0e3c8]"
        tutorialPulse={tutorialPulse}
      >
        <h4
          className="mt-0.5 line-clamp-2 font-display text-[15px] font-semibold leading-tight"
          style={{ color: "var(--ink)" }}
        >
          {spec.name}
        </h4>
        <p
          className="mt-1 line-clamp-3 font-display text-[12px] italic leading-snug"
          style={{ color: "rgba(130,201,163,.85)" }}
        >
          {spec.short}
        </p>
        <div className="mt-auto flex items-center justify-between border-t border-dotted pt-1.5" style={{ borderColor: "rgba(110,80,50,.3)" }}>
          <span className="text-[16px]" aria-hidden>
            📈
          </span>
          <span
            className="rounded px-1.5 py-px font-mono text-[11px] font-bold uppercase tracking-[.12em]"
            style={{ color: "rgba(130,201,163,.85)" }}
          >
            effect pending
          </span>
        </div>
      </DrawerCard>
    );
  }

  // Default: resource card
  const subtype = card.subtype as ResourceSubtype;
  const chrome = RESOURCE_CHROME[subtype];
  const count = card.resourceCount ?? 1;
  const tierInk = card.specialty ? TIER_INK.uncommon : TIER_INK.common;
  const titleLabel =
    card.displayName ??
    `${count > 1 ? `${count}× ` : ""}${RESOURCE_LABEL[subtype]}`;
  return (
    <DrawerCard
      cost={cost}
      slotIndex={slotIndex}
      onClick={onClick}
      tierInk={tierInk}
      kindLabel={RESOURCE_LABEL[subtype]}
      gradient={chrome.gradient}
      border={chrome.border}
      labelColor={chrome.label}
      ink={chrome.ink}
      tutorialPulse={tutorialPulse}
    >
      <h4
        className="mt-0.5 line-clamp-2 font-display text-[16px] font-semibold leading-tight"
        style={{ color: "var(--ink)" }}
      >
        {titleLabel}
      </h4>
      {card.flavor ? (
        <p
          className="mt-1 line-clamp-2 font-display text-[13px] italic leading-snug"
          style={{ color: "var(--mute)" }}
        >
          {card.flavor}
        </p>
      ) : null}
      <div className="mt-auto flex items-center justify-between border-t border-dotted pt-1.5" style={{ borderColor: "rgba(110,80,50,.3)" }}>
        <span className={`text-[16px] ${chrome.ink}`} aria-hidden>
          {RESOURCE_GLYPH[subtype]}
        </span>
        <span
          className="rounded px-1.5 py-px font-mono text-[11px] font-bold uppercase tracking-[.12em]"
          style={{
            border: `1px solid ${tierInk}`,
            color: tierInk,
          }}
        >
          {card.specialty ? "Specialty" : "Common"}
        </span>
      </div>
    </DrawerCard>
  );
}

function DrawerCard({
  cost,
  slotIndex,
  onClick,
  tierInk,
  kindLabel,
  gradient,
  border,
  labelColor,
  children,
  tutorialPulse = false,
}: {
  cost: number;
  slotIndex: number;
  onClick: () => void;
  tierInk: string;
  kindLabel: string;
  gradient: string;
  border: string;
  labelColor: string;
  ink: string;
  children: React.ReactNode;
  tutorialPulse?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-market-slot-index={slotIndex}
      className={`relative flex flex-col rounded-[10px] border p-2.5 text-left transition-all hover:-translate-y-[2px] ${gradient} ${border} ${tutorialPulse ? "ring-2 ring-amber-300 shadow-[0_0_24px_rgba(252,211,77,.55)]" : ""}`}
      style={{
        boxShadow: `inset 0 1px 0 rgba(255,255,255,.06), 0 4px 14px ${tierInk}33`,
        minHeight: 156,
      }}
    >
      <div className="mb-1 flex items-baseline justify-between">
        <span
          className={`font-mono text-[11px] font-bold uppercase tracking-[.18em] ${labelColor}`}
        >
          {kindLabel}
        </span>
        <span
          className="rounded px-1.5 font-mono text-[12px] font-bold"
          style={{
            background: "linear-gradient(180deg, #f0c970, #c69d52)",
            color: "#1a120b",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,.4)",
          }}
        >
          ${cost}
        </span>
      </div>
      {children}
    </button>
  );
}
