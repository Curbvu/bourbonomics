"use client";

/**
 * BuyOverlay — sticky control bar for interactive Buy mode.
 *
 * Renders only when `buyMode` is non-null. Shows the in-progress
 * purchase as rep + Labor: cost is paid from the player's rep track,
 * optionally supplemented by Labor cards tagged from hand (Cooper +2
 * toward market resources, Marketing +2 toward ops, Generic +1
 * anywhere). Rep and Labor are fully fungible — any cost can be paid
 * in rep, Labor, or a mix.
 *
 * The conveyor + ops row + hand do their own click wiring (MarketCenter
 * + HandTray); this component is the contract surface — it tells the
 * player what to do next and lets them commit.
 */

import { useGameStore } from "@/lib/store/game";
import {
  type Card,
  type GameState,
} from "@bourbonomics/engine";
import { buyDomainForTarget } from "./buyDomain";
import { MoneyText } from "./money";

export default function BuyOverlay() {
  const { state, buyMode, cancelBuyMode, confirmBuy } = useGameStore();
  if (!state || !buyMode) return null;
  const human = state.players.find((p) => !p.isBot);
  if (!human) return null;

  const target = resolveTarget(state, buyMode.pickedTarget);
  const cost = target?.cost ?? null;
  const laborDomain = target ? buyDomainForTarget(target.card) : "market_resource";

  // only Labor cards contribute. Non-Labor selections in
  // `spendCardIds` are ignored at confirm time (store filter); we
  // mirror that here so the overlay totals match what dispatches.
  const selectedLabor = human.hand.filter(
    (c) => c.type === "labor" && buyMode.spendCardIds.includes(c.id),
  );
  const laborContrib = selectedLabor.reduce((acc, c) => {
    if (c.laborDomain === "any") return acc + (c.laborContribution ?? 1);
    if (c.laborDomain === laborDomain) return acc + (c.laborContribution ?? 2);
    return acc;
  }, 0);
  const repPortion = cost != null ? Math.max(0, cost - laborContrib) : 0;
  const canConfirm =
    target != null &&
    cost != null &&
    repPortion <= human.reputation &&
    (cost === 0 || repPortion > 0 || selectedLabor.length > 0);

  let prompt: string;
  if (!target) {
    prompt = "Pick a card from the market or operations row.";
  } else if (cost != null && repPortion > human.reputation) {
    prompt = `Need ${repPortion} rep — you have ${human.reputation}.`;
  } else if (cost != null) {
    prompt = `Pay ${repPortion} rep${selectedLabor.length ? ` + ${selectedLabor.length} Labor` : ""}. Tag Labor cards from hand to reduce the rep cost.`;
  } else {
    prompt = "Ready to buy. Confirm to dispatch.";
  }

  // v3.4: floating bar — used to be in-flow inside HandTray, which
  // pushed the action bar / status / hand fan downward whenever the
  // player entered buy mode. Now `position: fixed` above the action
  // bar so the rest of the screen stays put. Mount point in HandTray
  // is unchanged; only the layout stance moved.
  //
  // v3.7: lifted to overlay the bottom of the distillery panel
  // (rickhouse area) rather than the hand. Empirically the hand-tray
  // strip is ~230–260px tall, so anchoring at bottom ~280px puts the
  // chip over the rickhouse's caption row — where the player's eye
  // is already focused on the picked target's destination.
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center animate-bb-tour-pop"
      style={{ bottom: 280 }}
    >
      <div
        className="pointer-events-auto mx-3 flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/70 bg-gradient-to-b from-amber-900/85 to-slate-950/95 px-4 py-2 shadow-[0_-2px_24px_rgba(240,201,112,.25),inset_0_1px_0_rgba(255,255,255,.08)] backdrop-blur-md"
      >
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
            · pay{" "}
            <MoneyText
              n={repPortion}
              className={`font-bold ${repPortion <= human.reputation ? "text-emerald-300" : "text-rose-300"}`}
            />
            {" rep"}
            {selectedLabor.length ? (
              <span className="text-slate-500">
                {" "}
                + {selectedLabor.length} Labor
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
  type: "resource" | "labor" | "operations" | "investment";
  card: Card;
}

function resolveTarget(
  state: GameState,
  picked: { slotIndex: number } | null,
): TargetView | null {
  if (!picked) return null;
  const card = state.market[picked.slotIndex];
  if (!card) return null;
  return {
    cost: card.cost ?? 1,
    type: card.type,
    card,
  };
}

function targetLabel(t: TargetView): string {
  const card = t.card;
  if (card.displayName) return card.displayName;
  if (t.type === "operations" && card.opSpec) return `Ops · ${card.opSpec.name}`;
  if (t.type === "investment" && card.investmentSpec)
    return `Invest · ${card.investmentSpec.name}`;
  if (card.type === "labor") {
    const sub = card.laborSubtype ?? "labor";
    return `Labor · ${sub[0]!.toUpperCase()}${sub.slice(1)}`;
  }
  const sub = card.subtype ?? "";
  const subCap = sub ? sub[0]!.toUpperCase() + sub.slice(1) : "Resource";
  const count = card.resourceCount && card.resourceCount > 1 ? `${card.resourceCount}× ` : "";
  return `${count}${subCap}`;
}

