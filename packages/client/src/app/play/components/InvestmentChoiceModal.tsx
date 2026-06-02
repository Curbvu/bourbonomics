"use client";

/**
 * v3.6 InvestmentChoiceModal — on-purchase choice picker.
 *
 * Four investment cards require a follow-up pick the moment they're
 * bought. The engine sets `player.pendingInvestmentChoice` and gates
 * the player to `RESOLVE_INVESTMENT_CHOICE` until it clears (mirrors
 * `pendingBottlePlacement` / BottlePlacementModal). This modal renders
 * the right picker per defId and dispatches the resolving action:
 *
 *   brand_ambassador             → pick one of your barrels (barrelId)
 *   master_distiller             → pick a tag (tag)
 *   climate_controlled_warehouse → pick a rickhouse slot (slotId)
 *   bonded_warehouse             → pick a rickhouse slot (slotId)
 */

import type { Barrel, BillTag, GameAction } from "@bourbonomics/engine";
import { MASTER_DISTILLER_TAGS } from "@bourbonomics/engine";
import { useGameStore } from "@/lib/store/game";

type ChoiceCopy = {
  eyebrow: string;
  title: string;
  hint: string;
};

const COPY: Record<string, ChoiceCopy> = {
  brand_ambassador: {
    eyebrow: "Brand Ambassador",
    title: "Choose a barrel to promote",
    hint: "That barrel reads the grid at demand +2 — permanently. Pick the barrel you plan to age and sell at a high band.",
  },
  master_distiller: {
    eyebrow: "Master Distiller",
    title: "Choose your house style",
    hint: "Every barrel you complete from now on inherits this tag, opening tag-gated portfolio slots.",
  },
  climate_controlled_warehouse: {
    eyebrow: "Climate-Controlled Warehouse",
    title: "Choose a slot to protect",
    hint: "Barrels in this slot are immune to opponent aging-negative ops (Regulatory Inspection, Slow Pour).",
  },
  bonded_warehouse: {
    eyebrow: "Bonded Warehouse",
    title: "Choose a slot to bond",
    hint: "Aging cards committed to a barrel in this slot return to your hand when you sell it.",
  },
};

const TAG_LABEL: Record<string, string> = {
  wheated: "Wheated",
  "rye-heavy": "Rye-Heavy",
  "single-grain": "Single-Grain",
  "triple-grain": "Triple-Grain",
};

export default function InvestmentChoiceModal() {
  const { state, humanSeatPlayerId, dispatch } = useGameStore();
  const seatId = humanSeatPlayerId;
  const player = seatId ? state?.players.find((p) => p.id === seatId) : null;
  if (!state || !player) return null;
  const pending = player.pendingInvestmentChoice;
  if (!pending) return null;

  const copy = COPY[pending.defId];
  if (!copy) return null;

  const resolveBarrel = (barrelId: string) =>
    dispatch({ type: "RESOLVE_INVESTMENT_CHOICE", playerId: player.id, barrelId });
  const resolveTag = (tag: BillTag) =>
    dispatch({ type: "RESOLVE_INVESTMENT_CHOICE", playerId: player.id, tag });
  const resolveSlot = (slotId: string) =>
    dispatch({ type: "RESOLVE_INVESTMENT_CHOICE", playerId: player.id, slotId });

  const ownBarrels = state.allBarrels.filter((b) => b.ownerId === player.id);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={copy.title}
      className="fixed inset-0 z-[57] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur"
    >
      <div className="relative flex max-h-[calc(100vh-2rem)] w-full max-w-[920px] flex-col gap-4 overflow-hidden rounded-xl border border-amber-700/50 bg-gradient-to-b from-slate-950 to-slate-900/95 px-6 py-5 shadow-[0_24px_64px_rgba(0,0,0,.55)]">
        <header className="flex-shrink-0">
          <div className="font-mono text-[12px] uppercase tracking-[.18em] text-amber-300">
            Investment bought · {copy.eyebrow}
          </div>
          <div className="mt-1 font-display text-2xl font-semibold text-amber-100">
            {copy.title}
          </div>
          <div className="mt-1 font-mono text-[11px] leading-relaxed tracking-[.04em] text-slate-400">
            {copy.hint}
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
          {pending.defId === "brand_ambassador" ? (
            <BarrelPicker barrels={ownBarrels} onPick={resolveBarrel} />
          ) : null}

          {pending.defId === "master_distiller" ? (
            <TagPicker onPick={resolveTag} />
          ) : null}

          {pending.defId === "climate_controlled_warehouse" ||
          pending.defId === "bonded_warehouse" ? (
            <SlotPicker
              slots={player.rickhouseSlots}
              barrels={ownBarrels}
              onPick={resolveSlot}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────

function PickButton({
  onClick,
  primary,
  secondary,
  meta,
}: {
  onClick: () => void;
  primary: string;
  secondary?: string;
  meta?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-w-[180px] flex-col gap-1 rounded-lg border border-amber-700/40 bg-slate-950/55 px-3 py-2.5 text-left transition-all hover:-translate-y-[2px] hover:border-amber-500/70 hover:bg-amber-950/30 hover:brightness-110"
    >
      <span className="font-display text-[15px] font-semibold leading-tight text-amber-100">
        {primary}
      </span>
      {secondary ? (
        <span className="font-mono text-[10.5px] uppercase tracking-[.12em] text-slate-400">
          {secondary}
        </span>
      ) : null}
      {meta ? (
        <span className="mt-0.5 font-mono text-[10px] tracking-[.06em] text-amber-300/80 opacity-0 transition-opacity group-hover:opacity-100">
          {meta}
        </span>
      ) : null}
    </button>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-950/50 px-4 py-6 text-center font-mono text-[11px] leading-relaxed tracking-[.06em] text-slate-400">
      {children}
    </div>
  );
}

function BarrelPicker({
  barrels,
  onPick,
}: {
  barrels: Barrel[];
  onPick: (barrelId: string) => void;
}) {
  if (barrels.length === 0) {
    return (
      <EmptyNote>
        You have no barrels yet. The Brand Ambassador needs a barrel to
        promote — make one, then this choice resolves.
      </EmptyNote>
    );
  }
  return (
    <div className="flex flex-wrap gap-2.5">
      {barrels.map((b) => (
        <PickButton
          key={b.id}
          onClick={() => onPick(b.id)}
          primary={b.attachedMashBill.name}
          secondary={`${phaseLabel(b)} · age ${b.age}`}
          meta="↑ +2 demand read forever"
        />
      ))}
    </div>
  );
}

function TagPicker({ onPick }: { onPick: (tag: BillTag) => void }) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {MASTER_DISTILLER_TAGS.map((tag) => (
        <PickButton
          key={tag}
          onClick={() => onPick(tag)}
          primary={TAG_LABEL[tag] ?? tag}
          secondary={tag}
          meta="↑ inherited by future barrels"
        />
      ))}
    </div>
  );
}

function SlotPicker({
  slots,
  barrels,
  onPick,
}: {
  slots: readonly { id: string }[];
  barrels: Barrel[];
  onPick: (slotId: string) => void;
}) {
  if (slots.length === 0) {
    return <EmptyNote>You have no rickhouse slots to designate.</EmptyNote>;
  }
  return (
    <div className="flex flex-wrap gap-2.5">
      {slots.map((s, i) => {
        const occupant = barrels.find((b) => b.slotId === s.id);
        return (
          <PickButton
            key={s.id}
            onClick={() => onPick(s.id)}
            primary={`Slot ${i + 1}`}
            secondary={
              occupant ? occupant.attachedMashBill.name : "empty"
            }
            meta="↑ designate this slot"
          />
        );
      })}
    </div>
  );
}

function phaseLabel(b: Barrel): string {
  if (b.phase === "ready") return "ready";
  if (b.phase === "construction") return "building";
  return "aging";
}
