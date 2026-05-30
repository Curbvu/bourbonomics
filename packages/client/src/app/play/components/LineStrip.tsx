"use client";

/**
 * v3.2 LineStrip — per-player Brand Portfolio surface, designed to sit
 * inline under each rickhouse without breaking CLAUDE.md rule #1 (no
 * scrollbars). Despite the filename, this is the v3.2 portfolio strip;
 * the v3.1 "Lines" terminology is retained only as the import path so
 * DistilleryStage / OpponentRail call sites stay stable.
 *
 * Two density modes:
 *
 *   compact (default) — opponent rail. Single ~26px row:
 *     flagship name + slot dots (filled/open/locked) + second-portfolio
 *     chip if drafted + inventory counter.
 *
 *   roomy — DistilleryStage (the human's hero panel). Tier-grouped
 *     mini slot cells with name + value, projected portfolio score,
 *     second-portfolio chip, inventory counter, and an Open Board CTA.
 *     Entire strip is clickable → opens the BrandPortfolioDrawer.
 */

import type {
  Portfolio,
  PortfolioSlotDef,
  PortfolioState,
  PlayerState,
} from "@bourbonomics/engine";
import {
  getPortfolio,
  scorePortfolio,
  slotEligibleForFill,
} from "@bourbonomics/engine";
import { useGameStore } from "@/lib/store/game";

export interface LineStripProps {
  player: PlayerState;
  state: unknown;
  density?: "compact" | "roomy";
}

export default function LineStrip({
  player,
  density = "compact",
}: LineStripProps) {
  const { setPortfolioDrawerOpen } = useGameStore();
  const flagship = getPortfolio(player.flagshipPortfolio.portfolioId);
  const second = player.secondPortfolio
    ? getPortfolio(player.secondPortfolio.portfolioId) ?? null
    : null;
  const inventoryCount = player.inventory.length;
  const pendingBottle = player.pendingBottlePlacement != null;

  if (!flagship) return null;

  const onOpen = density === "roomy" ? () => setPortfolioDrawerOpen(true) : undefined;

  if (density === "roomy") {
    const score = scorePortfolio(flagship, player.flagshipPortfolio, player);
    const tiers = flagship.tiers.map((tier) => ({
      index: tier.index,
      slotDefs: tier.slotIndices
        .map((i) => flagship.slots[i])
        .filter((s): s is PortfolioSlotDef => !!s),
    }));
    return (
      <button
        type="button"
        onClick={onOpen}
        className={`group flex w-full flex-col gap-2 rounded-[10px] border px-3 py-2 text-left transition-all hover:-translate-y-[1px] ${pendingBottle ? "" : ""}`}
        style={{
          borderColor: pendingBottle ? "var(--gold)" : "rgba(198,157,82,.45)",
          background:
            "radial-gradient(120% 120% at 0% 0%, rgba(240,201,112,.08), transparent 55%), linear-gradient(180deg, rgba(34,23,16,.85), rgba(16,11,7,.92))",
          boxShadow: pendingBottle
            ? "0 0 0 1px rgba(240,201,112,.45), 0 8px 22px rgba(240,201,112,.2)"
            : "inset 0 1px 0 rgba(240,201,112,.12), 0 4px 12px rgba(0,0,0,.4)",
        }}
        title={pendingBottle ? "Place your bottle — click to open the portfolio" : "Open your Brand Portfolio"}
      >
        <header className="flex items-baseline gap-3">
          <span className="stage-tag" style={{ color: "var(--gold)" }}>
            Brand Portfolio
          </span>
          <span className="font-display text-[16px] font-semibold leading-none text-amber-100">
            {flagship.name}
          </span>
          <span
            aria-hidden
            className="h-px flex-1"
            style={{ background: "linear-gradient(90deg, var(--rule), transparent)" }}
          />
          {second ? (
            <span className="font-mono text-[10px] uppercase tracking-[.14em] text-slate-400">
              + {second.name}
            </span>
          ) : null}
          <ScoreReadout score={score.total} tier={score.tier} pending={pendingBottle} />
        </header>

        <div className="flex flex-wrap items-stretch gap-2">
          {tiers.map((tier, ti) => (
            <div key={tier.index} className="flex items-stretch gap-2">
              {ti > 0 ? <TierDivider /> : null}
              <div className="flex flex-col gap-1">
                <span
                  className="font-mono text-[8.5px] font-bold uppercase tracking-[.16em]"
                  style={{
                    color:
                      tier.slotDefs.some(
                        (s) => player.flagshipPortfolio.slots[s.index]?.filled,
                      )
                        ? "var(--brass)"
                        : "var(--mute)",
                  }}
                >
                  Tier {tier.index + 1}
                </span>
                <div className="flex gap-1.5">
                  {tier.slotDefs.map((slotDef) => (
                    <MiniSlot
                      key={slotDef.index}
                      slotDef={slotDef}
                      portfolio={flagship}
                      state={player.flagshipPortfolio}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}

          <span className="ml-auto flex items-center gap-3">
            <Counter glyph="▥" label="inventory" v={inventoryCount} />
            <span
              className="rounded border px-2 py-[3px] font-mono text-[9.5px] font-bold uppercase tracking-[.14em]"
              style={{
                borderColor: "rgba(198,157,82,.55)",
                background: "linear-gradient(180deg, rgba(240,201,112,.16), rgba(34,23,16,.7))",
                color: "var(--gold)",
              }}
            >
              Open Board ↗
            </span>
          </span>
        </div>
      </button>
    );
  }

  // ── Compact (opponent rail) ─────────────────────────────────────
  // Tight single row: flagship name, filled-slot dots, second chip if
  // drafted, inventory counter.
  const filledCount = player.flagshipPortfolio.slots.filter((s) => s.filled).length;
  const totalSlots = flagship.slots.length;
  return (
    <div
      className="flex items-center gap-2 rounded border bg-[rgba(0,0,0,.25)] px-2 py-1"
      style={{ borderColor: "var(--rule)" }}
    >
      <span
        className="truncate rounded border px-1.5 py-px font-mono text-[9px] uppercase tracking-[.08em]"
        style={{
          borderColor: "var(--brass)",
          color: "var(--gold)",
          background: "rgba(240,201,112,.08)",
          maxWidth: 120,
        }}
        title={flagship.name}
      >
        ★ {flagship.name}
      </span>
      <span
        className="font-mono text-[9.5px] tabular-nums"
        style={{ color: "var(--ink-muted)" }}
        title={`${filledCount}/${totalSlots} slots filled`}
      >
        {filledCount}/{totalSlots}
      </span>
      <div className="flex items-center gap-[3px]">
        {player.flagshipPortfolio.slots.map((s, i) => (
          <span
            key={i}
            aria-hidden
            className="inline-block h-[6px] w-[6px] rounded-full"
            style={{
              background: s.filled ? "var(--gold)" : "transparent",
              border: "1px solid rgba(198,157,82,.55)",
            }}
          />
        ))}
      </div>
      {second ? (
        <span
          className="rounded border px-1 py-px font-mono text-[8.5px] uppercase tracking-[.08em]"
          style={{
            borderColor: "var(--whisper)",
            color: "var(--ink-muted)",
          }}
          title={second.name}
        >
          + 2P
        </span>
      ) : null}
      <span className="ml-auto inline-flex items-center gap-0.5 font-mono text-[10px]" style={{ color: "var(--ink-muted)" }}>
        <span style={{ color: "var(--brass)" }} aria-hidden>▥</span>
        {inventoryCount}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// MiniSlot — narrow tier-cell rendering.
// Filled → small amber chip; eligible/open → outlined; locked → dim.
// ─────────────────────────────────────────────────────────────────────

function MiniSlot({
  slotDef,
  portfolio,
  state,
}: {
  slotDef: PortfolioSlotDef;
  portfolio: Portfolio;
  state: PortfolioState;
}) {
  const slot = state.slots[slotDef.index];
  if (!slot) return null;
  const isOpen = slotEligibleForFill(portfolio, state, slotDef.index);
  const locked = !slot.filled && !isOpen;
  const borderStyle = slotDef.required ? "solid" : "dashed";
  const borderColor = slot.filled
    ? "rgba(198,157,82,.6)"
    : isOpen
      ? "rgba(198,157,82,.45)"
      : "rgba(110,80,50,.4)";
  return (
    <span
      title={`${slotDef.name} · +${slotDef.endGameValue}`}
      className="flex w-[64px] flex-col items-center gap-0.5 rounded-[6px] px-1 py-1"
      style={{
        borderWidth: 1.2,
        borderStyle,
        borderColor,
        background: slot.filled
          ? "linear-gradient(180deg, rgba(58,40,24,.7), rgba(26,18,11,.9))"
          : "rgba(16,11,7,.55)",
        opacity: locked ? 0.55 : 1,
      }}
    >
      <span
        aria-hidden
        className="grid h-4 w-4 place-items-center rounded-full"
        style={{
          border: slot.filled
            ? "1px solid rgba(198,157,82,.65)"
            : `1px ${borderStyle} ${borderColor}`,
          background: slot.filled
            ? "radial-gradient(circle at 40% 30%, #d59650, #6b3d1d 90%)"
            : "transparent",
          fontSize: 16,
        }}
      >
        {slot.filled ? "🍾" : locked ? "🔒" : "+"}
      </span>
      <span
        className="truncate font-display text-[9px] font-semibold leading-tight"
        style={{
          color: slot.filled ? "var(--ink)" : "var(--ink-muted)",
          maxWidth: 56,
        }}
      >
        {shortSlotName(slotDef.name)}
      </span>
      <span
        className="font-mono text-[7.5px] font-bold tabular-nums"
        style={{ color: slot.filled ? "var(--gold)" : "var(--mute)" }}
      >
        +{slotDef.endGameValue}
        {slotDef.required ? "" : " ·opt"}
      </span>
    </span>
  );
}

function shortSlotName(name: string): string {
  return name
    .replace(/^Baron's\s+/, "")
    .replace(/Cask Strength/, "Cask Str.")
    .replace(/Vintage Reserve/, "Vintage")
    .slice(0, 16);
}

function TierDivider() {
  return (
    <span
      aria-hidden
      className="w-px self-stretch"
      style={{
        background:
          "linear-gradient(180deg, transparent, rgba(198,157,82,.35) 20%, rgba(198,157,82,.35) 80%, transparent)",
      }}
    />
  );
}

function ScoreReadout({
  score,
  tier,
  pending,
}: {
  score: number;
  tier: "none" | "completion" | "theme" | "mastery";
  pending: boolean;
}) {
  if (pending) {
    return (
      <span
        className="font-display text-[13px] italic"
        style={{ color: "var(--gold)" }}
      >
        Place a bottle →
      </span>
    );
  }
  const tierLabel =
    tier === "mastery"
      ? "Mastery"
      : tier === "theme"
        ? "Theme"
        : tier === "completion"
          ? "Completion"
          : null;
  return (
    <span className="flex items-baseline gap-1">
      <span className="label-sm" style={{ color: "var(--mute)" }}>
        Projected
      </span>
      <span
        className="font-display text-[22px] font-bold tabular-nums"
        style={{ color: "var(--gold)", lineHeight: 1 }}
      >
        {score}
      </span>
      <span className="font-mono text-[8.5px]" style={{ color: "var(--brass)" }}>
        REP
      </span>
      {tierLabel ? (
        <span
          className="ml-1 rounded border px-1.5 py-[1px] font-mono text-[8.5px] font-bold uppercase tracking-[.12em]"
          style={{
            borderColor: "rgba(109,178,140,.55)",
            background: "rgba(109,178,140,.12)",
            color: "var(--emerald)",
          }}
        >
          {tierLabel}
        </span>
      ) : null}
    </span>
  );
}

function Counter({
  glyph,
  label,
  v,
}: {
  glyph: string;
  label: string;
  v: number;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 font-mono text-[10px]"
      style={{ color: "var(--ink-muted)" }}
      title={`${label}: ${v}`}
    >
      <span style={{ color: "var(--brass)" }} aria-hidden>
        {glyph}
      </span>
      {v}
      <span className="label-sm" style={{ fontSize: 16 }}>
        {label}
      </span>
    </span>
  );
}
