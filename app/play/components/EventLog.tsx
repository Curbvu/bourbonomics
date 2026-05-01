"use client";

/**
 * Body of the RightRail "Log" tab.
 *
 * Spec: design_handoff_bourbon_blend/README.md §Log tab.
 *
 * Each entry is a flex row:
 *   R{round}    [colored dot]    {message}
 *
 * Older entries get .55 opacity. The colored dot reflects who/what the
 * event is about (player colour, sale, system).
 */

import { useGameStore } from "@/lib/store/gameStore";
import { PLAYER_HEX, paletteIndex } from "./playerColors";

const FRESH_TAIL = 4; // entries this many from the end render at full opacity

export default function EventLog() {
  const state = useGameStore((s) => s.state)!;
  // Reverse-chronological, last 40, summarised.
  const entries = state.log.slice(-40).reverse();

  return (
    <div className="flex h-full flex-col px-3.5 py-3.5">
      <span className="mb-2.5 font-mono text-[10px] uppercase tracking-[.12em] text-slate-500">
        recent
      </span>
      <ol
        aria-live="polite"
        aria-relevant="additions"
        className="flex flex-1 flex-col gap-2 overflow-y-auto pr-1 font-mono text-[11.5px]"
      >
        {entries.length === 0 ? (
          <li className="italic text-slate-500">No events yet.</li>
        ) : (
          entries.map((e, i) => {
            const isFresh = i < FRESH_TAIL;
            const playerId =
              typeof e.data.playerId === "string"
                ? (e.data.playerId as string)
                : null;
            const seatIdx = playerId
              ? paletteIndex(state.players[playerId]?.seatIndex ?? 0)
              : null;
            const dotColor = colorForKind(
              e.kind,
              seatIdx == null ? null : PLAYER_HEX[seatIdx],
            );
            const message = summarise(
              e.kind,
              e.data,
              playerId
                ? state.players[playerId]?.name
                : null,
            );
            return (
              <li
                key={e.at}
                className={`flex items-start gap-2.5 ${
                  isFresh ? "" : "opacity-55"
                }`}
              >
                <span className="min-w-[22px] text-slate-600">
                  R{e.round}
                </span>
                <span
                  className="mt-1.5 block h-1.5 w-1.5 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: dotColor }}
                  aria-hidden
                />
                <span
                  className={`flex-1 ${
                    e.kind.startsWith("error:")
                      ? "text-rose-300"
                      : "text-slate-200"
                  }`}
                >
                  {message}
                </span>
              </li>
            );
          })
        )}
      </ol>
    </div>
  );
}

/**
 * Pick a colored dot for a log entry. Player events use the player's seat
 * colour; sale events glow emerald; pricing/demand events glow amber-400;
 * everything else falls back to slate-600.
 */
function colorForKind(kind: string, seatColor: string | null): string {
  if (kind === "sell_bourbon") return "#10b981"; // emerald
  if (kind === "win") return "#fbbf24"; // amber-400
  if (kind === "market_demand_change") return "#fbbf24";
  if (kind === "loan_taken" || kind === "loan_repaid") return "#fbbf24";
  if (kind.startsWith("error:")) return "#f43f5e"; // rose
  if (seatColor) return seatColor;
  return "#475569"; // slate-600
}

/**
 * Render an event as a single human-readable line. Falls back to the raw
 * kind for events without a known shape, so unrecognized events still show
 * up in the log instead of silently rendering blank.
 */
function summarise(
  kind: string,
  data: Record<string, unknown>,
  playerName: string | null,
): string {
  const who = playerName ?? "—";
  const num = (k: string) =>
    typeof data[k] === "number" ? (data[k] as number) : null;
  const str = (k: string) =>
    typeof data[k] === "string" ? (data[k] as string) : null;

  switch (kind) {
    case "first_pass":
      return `${who} passed first`;
    case "pass":
      return `${who} passed`;
    case "draw_resource":
    case "draw_resource_bonus":
      return `${who} drew ${str("pile") ?? "resource"}${
        kind === "draw_resource_bonus" ? " (bonus)" : ""
      }`;
    case "draw_bourbon":
      return `${who} drew a bourbon card`;
    case "draw_investment":
      return `${who} drew an investment`;
    case "draw_operations":
      return `${who} drew an operations card`;
    case "make_bourbon":
      return `${who} barrelled bourbon`;
    case "sell_bourbon": {
      const age = num("age");
      const payout = num("finalPayout");
      return `${who} sold ${age != null ? `${age}y bourbon` : "bourbon"}${
        payout != null ? ` for $${payout}` : ""
      }`;
    }
    case "implement_investment":
      return `${who} implemented ${str("cardId") ?? "an investment"}`;
    case "resolve_operations":
      return `${who} played ${str("cardId") ?? "an operations card"}`;
    case "fees_paid":
      return `${who} paid rent (${num("paid") ?? 0})`;
    case "loan_taken":
      return `${who} took a distressed loan`;
    case "loan_repaid":
      return `${who} repaid the loan`;
    case "market_draw":
      return `${who} drew 2 market cards`;
    case "market_demand_change": {
      const delta = num("delta");
      const after = num("after");
      return `Demand ${delta != null ? (delta >= 0 ? `+${delta}` : delta) : "shifted"} (now ${after ?? "—"})`;
    }
    case "phase_change":
      return `Phase → ${str("phase") ?? "?"}`;
    case "lap_end":
      return `Lap ended (tier $${num("paidLapTier") ?? 0})`;
    case "win":
      return `${who} wins (${str("reason") ?? "—"})`;
    default:
      if (kind.startsWith("error:")) {
        return kind.replace(/^error:/, "⚠ ");
      }
      return kind;
  }
}
