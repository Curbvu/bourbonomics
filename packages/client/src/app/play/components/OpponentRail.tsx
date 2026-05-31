"use client";

/**
 * v3 OpponentRail — compact left-side list of rivals.
 *
 * Replaces the per-opponent panel that lived in RickhouseRow. Each
 * opponent gets a tight summary card: seat-color avatar + name +
 * distillery handle in seat ink + large rep number + mini rickhouse
 * (slot cells tinted by their bill's tier). Hand / deck / disc / sold
 * counts live on the tile-level `title` tooltip so the rail can keep
 * the column tight.
 *
 * Filters players to non-human seats — the human's rickhouse renders
 * front-and-center in `DistilleryStage`.
 *
 * Stamps `data-bb-zone="opponent-rickhouse"` on each card so the
 * existing drag-mode focus-dim CSS in `globals.css` keeps masking
 * opponent rows when the human is dragging a card to commit.
 */

import type { GameState } from "@bourbonomics/engine";
import { useGameStore } from "@/lib/store/game";
import { useZoneFocusClass, useZoneFocusStyle } from "./pickerFocus";
import { PLAYER_HEX, paletteIndex } from "./playerColors";
import { TIER_INK, tierOrCommon } from "./tierStyles";
import LineStrip from "./LineStrip";

export default function OpponentRail() {
  const { state, multiplayerMode } = useGameStore();
  if (!state) return null;

  // The same "you" detection HandTray uses: in multiplayer the local
  // seat is whichever id the connection claimed; in solo it's the lone
  // non-bot. Filter to "not you" so we render every other seat as an
  // opponent — including human opponents in multiplayer.
  const youId = multiplayerMode
    ? multiplayerMode.playerId
    : state.players.find((p) => !p.isBot)?.id ?? null;

  const opponents = state.players
    .map((p, i) => ({ player: p, seatIndex: i }))
    .filter(({ player }) => player.id !== youId);

  const focusClass = useZoneFocusClass("rickhouse-others");
  const focusStyle = useZoneFocusStyle("rickhouse-others");
  if (opponents.length === 0) return null;

  return (
    <aside
      data-rickhouse-row="true"
      // No scroll per CLAUDE.md. Up to 3 opponents share this column at
      // the design scale — they fit. If a future 4+ player layout
      // needs more, the tiles need to be tightened, not scrolled.
      className={`bb-panel bb-panel--rivals flex min-h-0 flex-col gap-[10px] overflow-hidden px-[12px] py-3 ${focusClass}`}
      style={{ gridArea: "rivals", ...focusStyle }}
    >
      <header className="flex items-baseline justify-between">
        <h2
          className="m-0 font-display text-[14px] font-semibold tracking-[.02em]"
          style={{ color: "var(--ink-muted)" }}
        >
          Rivals
        </h2>
        <span className="label-sm">{opponents.length}</span>
      </header>
      <div className="flex flex-col gap-2">
        {opponents.map(({ player, seatIndex }) => (
          <OpponentCard
            key={player.id}
            player={player}
            seatIndex={seatIndex}
            state={state}
          />
        ))}
      </div>
    </aside>
  );
}

function OpponentCard({
  player,
  seatIndex,
  state,
}: {
  player: GameState["players"][number];
  seatIndex: number;
  state: GameState;
}) {
  const ink = PLAYER_HEX[paletteIndex(seatIndex)]!;
  const myBarrels = state.allBarrels.filter((b) => b.ownerId === player.id);
  const slotsTotal = player.rickhouseSlots.length;
  const filled = myBarrels.length;
  const isOnClock =
    state.phase === "action" &&
    state.players[state.currentPlayerIndex]?.id === player.id;

  return (
    <div
      data-bb-zone="opponent-rickhouse"
      data-opponent-tile={player.id}
      // Pile/hand counts live on the tile-level tooltip instead of a
      // visible counter row — the row was eating ~26px of column height
      // for read-only chrome. Inner elements with their own `title`
      // (slot cells, prestige badge) keep their tooltips because the
      // browser uses the deepest matching `title` on hover.
      title={`${player.name} · ✋ ${player.hand.length} hand · ▤ ${player.deck.length} deck · ↻ ${player.discard.length} disc · 🛢 ${player.barrelsSold} sold`}
      className={[
        "flex flex-col gap-2 rounded-[9px] border bg-[linear-gradient(180deg,rgba(34,23,16,.65),rgba(20,14,8,.65))] p-[10px] shadow-[inset_0_1px_0_rgba(255,255,255,.04)] transition-colors",
        // v3.8: gold halo breathes while this player is on the clock,
        // so the human's eye snaps to whoever's currently acting.
        isOnClock ? "bb-onclock-pulse" : "",
      ].join(" ")}
      style={{
        borderColor: isOnClock ? "rgba(240,201,112,.55)" : "var(--rule)",
      }}
    >
      {/* Identity row */}
      <div className="flex items-center gap-3">
        <div
          aria-hidden
          className="h-[32px] w-[32px] flex-shrink-0 rounded-full"
          style={{
            background: `radial-gradient(circle at 35% 30%, ${ink}, #1a120b 90%)`,
            boxShadow: `0 0 0 1.5px ${ink}88, inset 0 1px 0 rgba(255,255,255,.18)`,
          }}
        />
        <div className="min-w-0 flex-1">
          <div
            className="truncate font-display text-[17px] font-semibold leading-tight"
            style={{ color: "var(--ink)" }}
          >
            {player.name}
          </div>
          <div
            className="label-sm mt-[3px] truncate"
            style={{ color: ink, fontSize: 16 }}
          >
            {player.distillery?.name ?? "no distillery"}
          </div>
        </div>
        <div className="flex items-center gap-2 text-right leading-tight">
          {player.prestige > 0 ? (
            <span
              className="font-display text-[13px] font-bold leading-none"
              style={{ color: "var(--gold)" }}
              title={`${player.prestige} prestige — +${player.prestige} Capital on every Silver/Gold sale`}
            >
              ★{player.prestige}
            </span>
          ) : null}
          <div>
            <div
              className="font-display text-[26px] font-bold leading-none"
              style={{ color: "var(--gold)" }}
            >
              {player.capital}
            </div>
            <div className="label-sm" style={{ fontSize: 16 }}>
              Cap
            </div>
          </div>
        </div>
      </div>

      {/* Mini rickhouse — slot cells, tier-tinted if filled */}
      <div className="flex gap-1">
        {Array.from({ length: slotsTotal }).map((_, i) => {
          const barrel = myBarrels[i];
          const tier = barrel?.attachedMashBill
            ? tierOrCommon(barrel.attachedMashBill.tier)
            : null;
          const cellInk = tier ? TIER_INK[tier] : "var(--whisper)";
          const bill = barrel?.attachedMashBill;
          // Quick rep-range read: peak grid value gives the player the
          // gist of how chunky the slot can pay without a click.
          let range = "";
          if (bill) {
            const cells: number[] = [];
            for (const row of bill.rewardGrid) {
              for (const c of row) if (c !== null) cells.push(c);
            }
            const peak = cells.length ? Math.max(...cells) : 0;
            const floor = cells.length ? Math.min(...cells) : 0;
            range = `${floor}–${peak}`;
          }
          return (
            <div
              key={i}
              title={bill ? `${bill.name} · ${range} rep` : "empty slot"}
              className="grid h-[34px] flex-1 place-items-center rounded-[5px] border font-mono text-[12px] font-semibold uppercase tracking-[.12em]"
              style={{
                borderColor: barrel ? cellInk : "var(--whisper)",
                background: barrel
                  ? `linear-gradient(180deg, ${cellInk}33, rgba(0,0,0,.4))`
                  : "transparent",
                color: barrel ? cellInk : "var(--whisper)",
              }}
            >
              {range || ""}
            </div>
          );
        })}
      </div>

      {/* v3.0: Line system inline strip — flagship board + bottle dots
          + secondary line minis + hand/inventory counters. Compact
          density keeps the row under ~28px. */}
      <LineStrip player={player} state={state} density="compact" />

      {/* Counter row (hand · deck · disc · sold) retired — values surface
          via the tile-level `title` tooltip. Saves ~26px of read-only
          chrome per opponent and gives the rail more breathing room. */}

      {/* "On the clock" pill */}
      {isOnClock ? (
        <div
          className="label-sm rounded border px-1 py-px text-center"
          style={{
            borderColor: "rgba(240,201,112,.55)",
            background: "rgba(240,201,112,.12)",
            color: "var(--gold)",
            fontSize: 7.5,
          }}
        >
          their turn
        </div>
      ) : null}

      {/* Slot count for clarity */}
      <div className="-mt-1 flex justify-end">
        <span className="label-sm" style={{ fontSize: 16 }}>
          <span style={{ color: "var(--gold)" }}>{filled}</span>
          <span style={{ color: "var(--mute)" }}>/{slotsTotal} slots</span>
        </span>
      </div>
    </div>
  );
}

