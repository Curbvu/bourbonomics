"use client";

/**
 * BuyOverlay — sticky control bar for interactive Buy mode.
 *
 * Renders only when `buyMode` is non-null. Shows the in-progress
 * purchase: which target (conveyor card OR face-up ops card) the player
 * picked, the cost vs paid totals (resource cards count 1¢ each, capital
 * cards pay their face value), and a Confirm button gated on paid ≥ cost.
 * Cancel exits without dispatching.
 *
 * The conveyor + ops row + hand do their own click wiring (MarketCenter
 * + HandTray); this component is the contract surface — it tells the
 * player what to do next and lets them commit.
 */

import { useGameStore } from "@/lib/store/game";
import {
  paymentValue,
  type Card,
  type GameState,
  type OperationsCard,
} from "@bourbonomics/engine";
import { formatMoney, MoneyText } from "./money";

const FACEUP_OPS_SIZE = 3;

export default function BuyOverlay() {
  const { state, buyMode, cancelBuyMode, confirmBuy } = useGameStore();
  if (!state || !buyMode) return null;
  const human = state.players.find((p) => !p.isBot);
  if (!human) return null;

  const target = resolveTarget(state, buyMode.pickedTarget);
  const cost = target?.cost ?? null;

  // Both capital AND resource cards can pay. Resource cards count 1¢
  // each; capital cards pay their printed value.
  const selectedCards = human.hand.filter((c) =>
    buyMode.spendCardIds.includes(c.id),
  );
  const paid = selectedCards.reduce((acc, c) => acc + paymentValue(c), 0);

  const canConfirm = target != null && cost != null && paid >= cost;
  const overpaid = target != null && cost != null && paid > cost;

  let prompt: string;
  if (!target) {
    prompt = "Pick a card from the market or operations row.";
  } else if (cost != null && paid < cost) {
    prompt = `Tag ${formatMoney(cost - paid)} more from your hand (resource = ${formatMoney(1)}, capital pays its face value).`;
  } else if (overpaid) {
    prompt = "You're spending more than the cost — confirm or untag a card.";
  } else {
    prompt = "Ready to buy. Confirm to dispatch.";
  }

  return (
    <div className="border-t border-amber-700/60 bg-gradient-to-b from-amber-900/40 to-slate-950 px-[18px] py-2">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded border border-amber-500 bg-amber-700/30 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[.14em] text-amber-100">
          Buying
        </span>
        <span className="font-display text-[13px] font-semibold text-amber-100">
          {target ? targetLabel(target) : "—"}
        </span>
        {cost != null ? (
          <span className="font-mono text-[11px] uppercase tracking-[.10em] text-slate-300">
            cost{" "}
            <MoneyText n={cost} className="font-bold text-amber-200" />{" "}
            · paid{" "}
            <MoneyText
              n={paid}
              className={`font-bold ${paid >= cost ? "text-emerald-300" : "text-rose-300"}`}
            />
            {selectedCards.length ? (
              <span className="text-slate-500">
                {" "}
                ({selectedCards.length} card
                {selectedCards.length === 1 ? "" : "s"})
              </span>
            ) : null}
          </span>
        ) : (
          <span className="font-mono text-[11px] uppercase tracking-[.10em] text-slate-500">
            no slot picked yet
          </span>
        )}
        {/* Action buttons sit right next to the data — was previously
            pushed to the far right by a flex-1 spacer, which forced a
            long mouse trip from the picked card to Confirm. */}
        <button
          type="button"
          onClick={cancelBuyMode}
          className="rounded-md border border-rose-700/60 bg-rose-900/30 px-3 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[.08em] text-rose-100 transition-colors hover:border-rose-400 hover:bg-rose-800/40"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!canConfirm}
          onClick={canConfirm ? confirmBuy : undefined}
          className={
            canConfirm
              ? "confirm-ready rounded-md border border-amber-300 bg-gradient-to-b from-amber-300 to-amber-600 px-5 py-1.5 font-sans text-[13px] font-bold uppercase tracking-[.07em] text-slate-950 hover:from-amber-200 hover:to-amber-500"
              : "rounded-md border border-slate-800 bg-slate-900 px-5 py-1.5 font-sans text-[13px] font-bold uppercase tracking-[.07em] text-slate-600 cursor-not-allowed"
          }
        >
          Confirm ↵
        </button>
        <span className="font-mono text-[10px] italic text-slate-400">
          {prompt}
        </span>
      </div>
    </div>
  );
}

interface TargetView {
  cost: number;
  type: "conveyor-resource" | "conveyor-capital" | "operations";
  card: Card | OperationsCard;
}

function resolveTarget(
  state: GameState,
  picked: { source: "conveyor" | "operations"; slotIndex: number } | null,
): TargetView | null {
  if (!picked) return null;
  if (picked.source === "conveyor") {
    const card = state.marketConveyor[picked.slotIndex];
    if (!card) return null;
    return {
      cost: card.cost ?? 1,
      type: card.type === "capital" ? "conveyor-capital" : "conveyor-resource",
      card,
    };
  }
  // operations: face-up row = last 3 of operationsDeck.
  if (picked.slotIndex < 0 || picked.slotIndex >= FACEUP_OPS_SIZE) return null;
  const total = state.operationsDeck.length;
  const idx = total - 1 - picked.slotIndex;
  const opsCard = state.operationsDeck[idx];
  if (!opsCard) return null;
  return { cost: opsCard.cost, type: "operations", card: opsCard };
}

function targetLabel(t: TargetView): string {
  if (t.type === "operations") {
    const ops = t.card as OperationsCard;
    return `Ops · ${ops.name}`;
  }
  const card = t.card as Card;
  if (card.displayName) return card.displayName;
  if (t.type === "conveyor-capital") return `Capital ${formatMoney(card.capitalValue ?? 1)}`;
  const sub = card.subtype ?? "";
  const subCap = sub ? sub[0]!.toUpperCase() + sub.slice(1) : "Resource";
  const count = card.resourceCount && card.resourceCount > 1 ? `${card.resourceCount}× ` : "";
  return `${count}${subCap}`;
}

