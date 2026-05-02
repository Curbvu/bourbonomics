"use client";

/**
 * Rickhouse grid — six region cards laid out 3 columns × 2 rows on lg+
 * screens, dropping to 2 columns on md.
 *
 * Spec: design_handoff_bourbon_blend/README.md §RickhouseGrid.
 *
 * Each card has a Cormorant Garamond region name, a `{filled}/{capacity}
 * barrels` subtitle, an optional "+N you" callout in the player's seat
 * colour, and a wrapping grid of barrel slots. Each filled slot is a
 * card-sized chip (108 × 88) that shows the mash bill's name, age,
 * current sale price, owner colour stripe, and a rarity star — enough
 * to read the bill at a glance. Click any barrel chip to open a full
 * inspect modal with the complete grid + awards + Sell button.
 *
 * Phase 2 of the make-bourbon flow: when `useUiStore.makeBourbon.active`
 * is true and the player has a valid mash selected in their hand, the
 * rickhouses with capacity light up amber and become click-to-place. The
 * click dispatches MAKE_BOURBON with the selected resource ids and clears
 * the mode. (In that mode, individual barrel-chip clicks are suppressed
 * so the rickhouse-card-as-target behaviour wins.)
 *
 * The component name is kept (`RickhouseRow`) for import compatibility with
 * existing consumers — the layout is no longer a single row.
 */

import { BOURBON_CARDS_BY_ID } from "@/lib/catalogs/bourbon.generated";
import { pickBestGoldAlt } from "@/lib/ai/evaluators";
import { lookupSalePrice } from "@/lib/rules/pricing";
import { validateMash } from "@/lib/rules/mash";
import type { RickhouseId } from "@/lib/engine/rickhouses";
import {
  RICKHOUSES,
  RICKHOUSE_DISPLAY_ORDER,
  rickhouseById,
} from "@/lib/engine/rickhouses";
import { useGameStore } from "@/lib/store/gameStore";
import { useUiStore } from "@/lib/store/uiStore";
import { PLAYER_BG_CLASS, paletteIndex } from "./playerColors";

const TOTAL_SLOTS = RICKHOUSES.reduce((n, r) => n + r.capacity, 0);

export default function RickhouseRow() {
  const state = useGameStore((s) => s.state)!;
  const dispatch = useGameStore((s) => s.dispatch);
  const makeBourbon = useUiStore((s) => s.makeBourbon);
  const cancelMakeBourbon = useUiStore((s) => s.cancelMakeBourbon);
  const inspectBarrel = useUiStore((s) => s.inspectBarrel);
  const humanId = state.playerOrder.find(
    (id) => state.players[id].kind === "human",
  );

  // Per-player barrel totals across all rickhouses, used for the heading tally.
  const totals: Record<string, number> = {};
  for (const id of state.playerOrder) totals[id] = 0;
  for (const h of state.rickhouses) {
    for (const b of h.barrels) {
      if (totals[b.ownerId] != null) totals[b.ownerId] += 1;
    }
  }

  const tallyParts = state.playerOrder.map((id) => {
    const p = state.players[id];
    const label = id === humanId ? "you" : p.name.toLowerCase();
    return `${label} ${totals[id]}`;
  });

  // Compute mash validity once per render so each rickhouse card can
  // light up consistently. Both pieces — a valid resource mash AND a
  // chosen mash bill from the bourbon hand — are required before the
  // rickhouse becomes a click target.
  const me = humanId ? state.players[humanId] : null;
  const selectedSet = new Set(makeBourbon.selectedIds);
  const selectedMash =
    makeBourbon.active && me
      ? me.resourceHand.filter((r) => selectedSet.has(r.instanceId))
      : [];
  const mashOk = makeBourbon.active && validateMash(selectedMash).ok;
  const billOk =
    makeBourbon.active &&
    !!makeBourbon.mashBillId &&
    !!me?.bourbonHand.includes(makeBourbon.mashBillId);
  const mashValid = mashOk && billOk;

  const placeInRickhouse = (rickhouseId: RickhouseId) => {
    if (!mashValid || !humanId || !makeBourbon.mashBillId) return;
    dispatch({
      t: "MAKE_BOURBON",
      playerId: humanId,
      rickhouseId,
      resourceInstanceIds: makeBourbon.selectedIds,
      mashBillId: makeBourbon.mashBillId,
    });
    cancelMakeBourbon();
  };

  // Per-barrel sell affordance. With mash bills locked to barrels at
  // production every owned barrel has a knowable sale price right now,
  // so each chip becomes a click-to-sell button when the conditions are
  // right. Sell mode is mutually exclusive with make-bourbon mode (the
  // rickhouse-card itself is the click target during a make), and is
  // disabled while the player owes an audit discard or is frozen by a
  // distressed loan.
  const isMyActionTurn =
    !!humanId &&
    state.currentPlayerId === humanId &&
    state.phase === "action";
  const actionCost = state.actionPhase.freeWindowActive
    ? 0
    : state.actionPhase.paidLapTier;
  const canAffordAction = !!me && me.cash >= actionCost;
  const auditPending = !!me && (me.pendingAuditOverage ?? 0) > 0;
  const sellingAllowed =
    !!humanId &&
    !!me &&
    isMyActionTurn &&
    canAffordAction &&
    !makeBourbon.active &&
    !auditPending &&
    !me.loanSiphonActive;

  const sellBarrel = (barrelId: string, applyGoldBourbonId?: string) => {
    if (!sellingAllowed || !humanId) return;
    if (applyGoldBourbonId) {
      dispatch({
        t: "SELL_BOURBON",
        playerId: humanId,
        barrelId,
        applyGoldBourbonId,
      });
    } else {
      dispatch({
        t: "SELL_BOURBON",
        playerId: humanId,
        barrelId,
      });
    }
  };

  const sectionClass = makeBourbon.active ? "relative z-40" : "";

  return (
    <section className={sectionClass}>
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[.18em] text-slate-400">
          Rickhouses · {RICKHOUSES.length} regions · {TOTAL_SLOTS} slots
          {mashValid ? (
            <span className="ml-2 rounded border border-amber-500 bg-amber-700/[0.20] px-1.5 py-0.5 text-amber-200">
              Click a rickhouse to barrel
            </span>
          ) : makeBourbon.active && mashOk && !billOk ? (
            <span className="ml-2 rounded border border-amber-500/60 bg-amber-700/[0.10] px-1.5 py-0.5 text-amber-200/90">
              Pick a mash bill
            </span>
          ) : null}
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-[.12em] tabular-nums text-slate-500">
          {tallyParts.join(" · ")}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-1 md:grid-cols-2 lg:grid-cols-[minmax(0,3fr)_minmax(0,3fr)_minmax(0,4fr)]">
        {RICKHOUSE_DISPLAY_ORDER.map((id) => {
          const h = state.rickhouses.find((r) => r.id === id);
          if (!h) return null;
          const def = rickhouseById(id);
          const filled = h.barrels.length;
          const yoursHere = humanId
            ? h.barrels.filter((b) => b.ownerId === humanId).length
            : 0;
          const freeSlots = def.capacity - filled;
          const targetable = mashValid && freeSlots > 0;
          return (
            <div
              key={h.id}
              role={targetable ? "button" : undefined}
              tabIndex={targetable ? 0 : undefined}
              onClick={targetable ? () => placeInRickhouse(h.id) : undefined}
              onKeyDown={
                targetable
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        placeInRickhouse(h.id);
                      }
                    }
                  : undefined
              }
              title={
                makeBourbon.active && !mashValid
                  ? "Mash isn't valid yet"
                  : makeBourbon.active && freeSlots === 0
                    ? "No room here"
                    : targetable
                      ? `Barrel mash in ${def.name}`
                      : undefined
              }
              className={[
                "flex flex-col gap-2 rounded-lg border bg-slate-900/60 px-3.5 py-2.5 transition-all",
                targetable
                  ? "cursor-pointer border-amber-500 shadow-[0_0_0_3px_rgba(245,158,11,.15)] hover:-translate-y-0.5 hover:shadow-[0_0_0_3px_rgba(245,158,11,.35)]"
                  : makeBourbon.active && freeSlots === 0
                    ? "border-rose-700/40 opacity-60"
                    : "border-slate-800",
              ].join(" ")}
            >
              {/* Compact one-row header — region name + barrel count + */}
              {/* "+N you" all on the same line to save vertical space.   */}
              <div className="flex items-baseline gap-2">
                <span className="font-display text-[17px] font-semibold leading-tight tracking-[.01em] text-amber-100">
                  {def.name}
                </span>
                <span className="font-mono text-[10.5px] tabular-nums text-slate-500">
                  {filled}/{def.capacity}
                </span>
                <span className="flex-1" />
                {yoursHere > 0 ? (
                  <span className="font-mono text-[10px] font-bold text-indigo-400">
                    +{yoursHere} you
                  </span>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                {h.barrels.map((b) => {
                  const seatIdx = paletteIndex(
                    state.players[b.ownerId]?.seatIndex ?? 0,
                  );
                  const isMine = !!humanId && b.ownerId === humanId;
                  const ageOk = b.age >= 2;
                  const sellable = isMine && ageOk && sellingAllowed;
                  const card = BOURBON_CARDS_BY_ID[b.mashBillId];
                  // Pricing helpers throw on age < 2 (the engine's sale path
                  // never gets there). Skip the lookup entirely for aging
                  // barrels so a freshly-made age-0 chip doesn't crash the
                  // render.
                  const basePrice =
                    card && ageOk
                      ? lookupSalePrice(card, b.age, state.demand).price
                      : 0;
                  const altPick =
                    isMine && me && ageOk ? pickBestGoldAlt(state, me, b) : null;
                  const projectedPrice = altPick ? altPick.payout : basePrice;
                  const isRare = card?.rarity === "Rare";
                  const showPrice = isMine && ageOk;
                  const tooltip = isMine
                    ? `${card?.name ?? b.mashBillId}${isRare ? " (Rare)" : ""} · age ${b.age}` +
                      (b.age < 2
                        ? " · needs ≥2 to sell · click to inspect"
                        : ` · sells for $${projectedPrice}` +
                          (altPick
                            ? ` (Gold alt: ${BOURBON_CARDS_BY_ID[altPick.goldId]?.name ?? altPick.goldId})`
                            : "") +
                          " · click to inspect / sell")
                    : `${state.players[b.ownerId]?.name ?? "?"} · ${
                        card?.name ?? b.mashBillId
                      }${isRare ? " (Rare)" : ""} · age ${b.age} · click to inspect`;
                  // Card-sized barrel chip with the bill's name on a
                  // header strip in the owner's colour, age centered,
                  // and a price badge for sellable own barrels.
                  const chipClass = [
                    "group relative flex h-[88px] w-[108px] flex-col overflow-hidden rounded-md border bg-slate-950/70 text-left transition-all",
                    sellable
                      ? "border-amber-400 outline outline-2 outline-amber-300/70 outline-offset-1 hover:-translate-y-0.5 hover:border-amber-300"
                      : "border-slate-700 hover:-translate-y-0.5 hover:border-amber-500/60",
                  ].join(" ");
                  // Suppress click during make-bourbon mode — that
                  // mode's click target is the rickhouse card itself.
                  const clickable = !makeBourbon.active;
                  const onClick = clickable
                    ? sellable
                      ? () =>
                          sellBarrel(
                            b.barrelId,
                            altPick ? altPick.goldId : undefined,
                          )
                      : () => inspectBarrel(b.barrelId)
                    : undefined;
                  // Sell-mode barrels stay sellable on click; everyone
                  // else opens the inspect modal. The modal exposes its
                  // own Sell button so a player can always inspect first
                  // — opt-in via the chip's bottom-left "info" badge.
                  return (
                    <button
                      key={b.barrelId}
                      type="button"
                      title={tooltip}
                      onClick={onClick}
                      disabled={!clickable}
                      className={chipClass}
                    >
                      {/* Owner color header strip with bill name */}
                      <div
                        className={`flex items-center gap-1 px-1.5 py-0.5 text-white ${PLAYER_BG_CLASS[seatIdx]}`}
                      >
                        <span
                          className="line-clamp-1 flex-1 font-display text-[11px] font-semibold leading-tight tracking-[.01em]"
                          title={card?.name}
                        >
                          {card?.name ?? b.mashBillId}
                        </span>
                        {isRare ? (
                          <span
                            className="text-[9px] leading-none text-amber-200"
                            aria-hidden
                          >
                            ★
                          </span>
                        ) : null}
                      </div>
                      {/* Body: age centered + price badge */}
                      <div className="relative flex flex-1 items-center justify-center">
                        <span className="font-mono text-[20px] font-bold leading-none tabular-nums text-amber-100">
                          {b.age}
                          <span className="ml-0.5 text-[11px] text-slate-400">
                            y
                          </span>
                        </span>
                        {showPrice ? (
                          <span
                            className={[
                              "absolute bottom-1 right-1 rounded px-1 py-px font-mono text-[9px] font-bold leading-none tabular-nums",
                              altPick
                                ? "bg-amber-300/95 text-slate-950"
                                : "bg-emerald-400/90 text-slate-950",
                            ].join(" ")}
                          >
                            ${projectedPrice}
                          </span>
                        ) : null}
                        {!sellable && clickable ? (
                          <span
                            className="absolute bottom-1 left-1 rounded border border-slate-600 bg-slate-900/80 px-1 font-mono text-[8px] font-bold uppercase tracking-[.05em] text-slate-300 opacity-0 transition-opacity group-hover:opacity-100"
                            aria-hidden
                          >
                            info
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
                {Array.from({ length: freeSlots }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className={[
                      "flex h-[88px] w-[108px] items-center justify-center rounded-md border border-dashed font-mono text-[9px] uppercase tracking-[.12em]",
                      targetable
                        ? "border-amber-400/70 text-amber-300/70"
                        : "border-slate-700 text-slate-700",
                    ].join(" ")}
                    aria-hidden
                  >
                    empty
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
