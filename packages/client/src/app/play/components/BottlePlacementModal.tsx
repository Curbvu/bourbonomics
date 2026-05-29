"use client";

import type { GameAction } from "@bourbonomics/engine";
import { useGameStore } from "@/lib/store/game";
import BottleChip from "./BottleChip";

/**
 * v3.2 BottlePlacementModal — minimal "send to inventory" picker.
 *
 * The full slot-picker (showing each portfolio's slots with
 * solid/dotted outlines, eligibility, signature-bill highlights)
 * lands alongside the v3.2 portfolio board UI redesign. Until
 * then, human players land bottles in inventory and retrieve them
 * later via RETRIEVE_BOTTLE (also requires UI; for now bots and
 * tests are the primary placement paths).
 */
export default function BottlePlacementModal() {
  const { state, humanSeatPlayerId, dispatch } = useGameStore();
  const seatId = humanSeatPlayerId;
  const player = seatId
    ? state?.players.find((p) => p.id === seatId)
    : null;
  if (!state || !player) return null;
  const pending = player.pendingBottlePlacement;
  if (!pending) return null;
  const bottle = pending.bottle;

  const sendToInventory: GameAction = {
    type: "PLACE_BOTTLE",
    playerId: player.id,
    destination: { kind: "inventory" },
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Place your bottle"
      className="fixed inset-0 z-[56] flex items-center justify-center bg-slate-950/85 p-6 backdrop-blur"
    >
      <div className="relative flex max-w-[520px] flex-col items-center gap-4 rounded-lg border border-slate-800 bg-slate-950/95 p-6">
        <div className="text-center">
          <div className="font-mono text-[12px] uppercase tracking-[.18em] text-amber-300">
            Sale resolved · Place the bottle
          </div>
          <div className="mt-1 font-display text-2xl font-semibold text-amber-100">
            {bottle.name}
          </div>
          <div className="mt-2 font-mono text-[11px] uppercase tracking-[.1em] text-slate-400">
            v3.2 portfolio slot picker is pending UI redesign. For now,
            bottles land in inventory; retrieve them with 1 Generic
            Labor once the picker ships.
          </div>
        </div>
        <BottleChip bottle={bottle} />
        <button
          type="button"
          className="rounded border border-amber-500 bg-amber-500/10 px-4 py-2 font-mono text-[12px] uppercase tracking-[.1em] text-amber-200 transition hover:bg-amber-500/20"
          onClick={() => dispatch(sendToInventory)}
        >
          Send to inventory
        </button>
      </div>
    </div>
  );
}
