"use client";

/**
 * LineStrip — compact per-player Line system surface, designed to sit
 * inline under each rickhouse without breaking CLAUDE.md rule #1 (no
 * scrollbars).
 *
 * Two density modes:
 *
 *   compact (default) — opponent rail. Single 26px-ish row:
 *     flagship board badge + bottle dots + secondary badges +
 *     hand/inventory counters.
 *
 *   roomy — DistilleryStage (the human's hero panel). Same content
 *     but with full names, theme stripes on board badges, and a
 *     slightly taller bottle row.
 *
 * Mid-game tap-to-inspect is deferred (per the minimum-viable UI
 * slice). For now everything is read-only chrome.
 */

import type { Bottle, GameState, PlayerState } from "@bourbonomics/engine";
import { getLineBoardDef } from "@bourbonomics/engine";
import BottleChip from "./BottleChip";

export interface LineStripProps {
  player: PlayerState;
  state: GameState;
  density?: "compact" | "roomy";
}

export default function LineStrip({
  player,
  density = "compact",
}: LineStripProps) {
  const flagshipBoard = player.flagshipLine.lineBoardId
    ? getLineBoardDef(player.flagshipLine.lineBoardId)
    : null;

  // v3.2: lineCardHand removed. The strip is purely portfolio + inventory now.
  const handCount = 0;
  const inventoryCount = player.inventory.length;
  const hasNothing =
    !flagshipBoard &&
    player.flagshipLine.bottles.length === 0 &&
    player.secondaryLines.length === 0 &&
    inventoryCount === 0;
  if (hasNothing) return null;

  if (density === "roomy") {
    return (
      <div
        className="flex flex-col gap-2 rounded-[8px] border bg-[linear-gradient(180deg,rgba(34,23,16,.45),rgba(20,14,8,.45))] px-3 py-2"
        style={{ borderColor: "var(--rule)" }}
      >
        <div className="flex items-baseline gap-2">
          <span className="stage-tag">Lines</span>
          <span
            aria-hidden
            className="h-px flex-1"
            style={{
              background: "linear-gradient(90deg, var(--rule), transparent)",
            }}
          />
          <Counter glyph="✋" label="hand" v={handCount} />
          <Counter glyph="▥" label="stock" v={inventoryCount} />
        </div>
        <LineRow
          label={flagshipBoard?.name ?? "Flagship"}
          bottles={player.flagshipLine.bottles}
          isFlagship
        />
        {player.secondaryLines.map((line, i) => (
          <LineRow
            key={line.id}
            label={`Secondary ${i + 1}`}
            bottles={line.bottles}
          />
        ))}
        {player.secondaryLines.length === 0 ? (
          <div
            className="rounded border border-dashed px-2 py-1 text-center font-mono text-[10px] uppercase tracking-[.1em]"
            style={{
              borderColor: "var(--whisper)",
              color: "var(--mute)",
            }}
          >
            second portfolio — draft from the shared pool with 1 worker
          </div>
        ) : null}
      </div>
    );
  }

  // Compact (opponent rail) — single horizontal strip, ≤ 28px tall.
  return (
    <div
      className="flex items-center gap-2 rounded border bg-[rgba(0,0,0,.25)] px-2 py-1"
      style={{ borderColor: "var(--rule)" }}
    >
      <FlagshipBadge boardName={flagshipBoard?.name ?? "—"} />
      <div className="flex flex-wrap items-center gap-1">
        {player.flagshipLine.bottles.slice(0, 6).map((b) => (
          <BottleChip key={b.bottleId} bottle={b} size="xs" />
        ))}
        {player.flagshipLine.bottles.length > 6 ? (
          <span
            className="font-mono text-[9px]"
            style={{ color: "var(--mute)" }}
          >
            +{player.flagshipLine.bottles.length - 6}
          </span>
        ) : null}
      </div>
      {player.secondaryLines.length > 0 ? (
        <>
          <span
            aria-hidden
            className="h-3 w-px"
            style={{ background: "var(--whisper)" }}
          />
          {player.secondaryLines.map((line, i) => (
            <SecondaryMini key={line.id} index={i + 1} bottles={line.bottles} />
          ))}
        </>
      ) : null}
      <span className="ml-auto flex items-center gap-2">
        <Counter glyph="✋" label="hand" v={handCount} mini />
        <Counter glyph="▥" label="stk" v={inventoryCount} mini />
      </span>
    </div>
  );
}

function FlagshipBadge({ boardName }: { boardName: string }) {
  return (
    <span
      className="truncate rounded border px-1.5 py-px font-mono text-[9px] uppercase tracking-[.08em]"
      style={{
        borderColor: "var(--brass)",
        color: "var(--gold)",
        background: "rgba(240,201,112,.08)",
        maxWidth: 110,
      }}
      title={boardName}
    >
      ★ {boardName}
    </span>
  );
}

function SecondaryMini({
  index,
  bottles,
}: {
  index: number;
  bottles: Bottle[];
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded border px-1 py-px font-mono text-[9px]"
      style={{
        borderColor: "var(--whisper)",
        color: "var(--ink-muted)",
      }}
      title={`Secondary line ${index} — ${bottles.length} bottle(s)`}
    >
      L{index}
      {bottles.slice(0, 3).map((b) => (
        <BottleChip key={b.bottleId} bottle={b} size="xs" />
      ))}
      {bottles.length > 3 ? <span>+{bottles.length - 3}</span> : null}
    </span>
  );
}

function LineRow({
  label,
  bottles,
  isFlagship = false,
}: {
  label: string;
  bottles: Bottle[];
  isFlagship?: boolean;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded border px-2 py-1"
      style={{
        borderColor: isFlagship ? "var(--brass)" : "var(--rule)",
        background: isFlagship ? "rgba(240,201,112,.06)" : "rgba(0,0,0,.2)",
      }}
    >
      <span
        className="font-mono text-[10px] font-semibold uppercase tracking-[.1em]"
        style={{ color: isFlagship ? "var(--gold)" : "var(--ink-muted)" }}
      >
        {isFlagship ? "★ " : ""}
        {label}
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-1">
        {bottles.length === 0 ? (
          <span
            className="font-mono text-[9px] italic"
            style={{ color: "var(--mute)" }}
          >
            no bottles
          </span>
        ) : (
          bottles.map((b) => <BottleChip key={b.bottleId} bottle={b} />)
        )}
      </div>
    </div>
  );
}

function Counter({
  glyph,
  label,
  v,
  mini = false,
}: {
  glyph: string;
  label: string;
  v: number;
  mini?: boolean;
}) {
  if (mini) {
    return (
      <span
        className="inline-flex items-center gap-0.5 font-mono text-[10px]"
        style={{ color: "var(--ink-muted)" }}
        title={`${label}: ${v}`}
      >
        <span style={{ color: "var(--brass)" }} aria-hidden>
          {glyph}
        </span>
        {v}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 font-mono text-[11px]"
      style={{ color: "var(--ink-muted)" }}
    >
      <span style={{ color: "var(--brass)" }} aria-hidden>
        {glyph}
      </span>
      {v}
      <span className="label-sm" style={{ fontSize: 9 }}>
        {label}
      </span>
    </span>
  );
}
