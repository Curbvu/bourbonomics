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
import { demandBandFor, lookupSalePrice } from "@/lib/rules/pricing";
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
import { logoFor } from "./playerLogos";
import { TIER_CHROME, tierOrCommon } from "./tierStyles";

const TOTAL_SLOTS = RICKHOUSES.reduce((n, r) => n + r.capacity, 0);

export default function RickhouseRow() {
  const state = useGameStore((s) => s.state)!;
  const dispatch = useGameStore((s) => s.dispatch);
  const makeBourbon = useUiStore((s) => s.makeBourbon);
  const cancelMakeBourbon = useUiStore((s) => s.cancelMakeBourbon);
  const inspectBarrel = useUiStore((s) => s.inspectBarrel);
  const sellMode = useUiStore((s) => s.sell);
  const cancelSell = useUiStore((s) => s.cancelSell);
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
  const pickedBillDef =
    makeBourbon.active && makeBourbon.mashBillId
      ? BOURBON_CARDS_BY_ID[makeBourbon.mashBillId]
      : null;
  const mashOk =
    makeBourbon.active &&
    validateMash(selectedMash, pickedBillDef?.recipe).ok;
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
  const humanFreeRemaining = humanId
    ? state.actionPhase.freeActionsRemainingByPlayer[humanId] ?? 0
    : 0;
  const actionCost =
    humanFreeRemaining > 0 || state.actionPhase.freeWindowActive
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
    // Exit sell mode after a sale — one barrel per click, by design.
    cancelSell();
  };

  // Lift either the make-bourbon dim or the sell-mode dim above the
  // backdrop so the rickhouse area stays interactive while the rest of
  // the dashboard fades. Both are mutually exclusive in practice — the
  // mode buttons gate each other.
  const sectionClass =
    makeBourbon.active || sellMode.active ? "relative z-40" : "";

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
          ) : sellMode.active ? (
            <span className="ml-2 rounded border border-amber-500 bg-amber-700/[0.20] px-1.5 py-0.5 text-amber-200">
              Click one of your aged barrels to sell
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
                  const ownerPlayer = state.players[b.ownerId];
                  const seatIdx = paletteIndex(ownerPlayer?.seatIndex ?? 0);
                  const ownerLogo = logoFor(ownerPlayer?.logoId, ownerPlayer?.seatIndex ?? 0);
                  const isMine = !!humanId && b.ownerId === humanId;
                  const ageOk = b.age >= 2;
                  const sellable = isMine && ageOk && sellingAllowed;
                  const card = BOURBON_CARDS_BY_ID[b.mashBillId];
                  const tier = tierOrCommon(card?.tier);
                  const tierChrome = TIER_CHROME[tier];
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
                  // Pay scale — row of 3 prices for the resolved age
                  // band, with the cell at the current demand band marked
                  // as the live one. For aging barrels the engine's age
                  // resolver throws, so fall back to the lowest age row
                  // (what the barrel will pay once it ages into ageBands[0]).
                  let ageRowIndex = 0;
                  if (card && ageOk) {
                    for (let i = card.ageBands.length - 1; i >= 0; i -= 1) {
                      if (card.ageBands[i] <= b.age) {
                        ageRowIndex = i;
                        break;
                      }
                    }
                  }
                  const payScaleRow: readonly number[] = card
                    ? card.grid[ageRowIndex]
                    : [0];
                  const liveDemandBand = card
                    ? demandBandFor(card, state.demand)
                    : 0;
                  // Live cell shows the alt-boosted payout when applicable;
                  // the printed grid value is preserved as a tooltip.
                  const liveCellPrice =
                    altPick && ageOk ? altPick.payout : payScaleRow[liveDemandBand];
                  // In sell mode, the barrel becomes the click target;
                  // outside it, click-to-inspect is the only path —
                  // accidental sells are gone.
                  const sellTarget = sellable && sellMode.active;
                  const tooltip = isMine
                    ? `${card?.name ?? b.mashBillId}${isRare ? " (Rare)" : ""} · age ${b.age}` +
                      (b.age < 2
                        ? " · needs ≥2 to sell · click to inspect"
                        : sellTarget
                          ? ` · click to sell for $${projectedPrice}` +
                            (altPick
                              ? ` (Gold alt: ${BOURBON_CARDS_BY_ID[altPick.goldId]?.name ?? altPick.goldId})`
                              : "")
                          : ` · sells for $${projectedPrice}` +
                            (altPick
                              ? ` (Gold alt: ${BOURBON_CARDS_BY_ID[altPick.goldId]?.name ?? altPick.goldId})`
                              : "") +
                            " · click to inspect")
                    : `${state.players[b.ownerId]?.name ?? "?"} · ${
                        card?.name ?? b.mashBillId
                      }${isRare ? " (Rare)" : ""} · age ${b.age} · click to inspect`;
                  // Card-sized barrel chip painted with the bourbon's
                  // tier chrome (gradient + border colour) so rarity
                  // reads at a glance. A slim owner stripe along the
                  // top carries the player's logo + the barrel age,
                  // and the price badge anchors the bottom-right when
                  // the barrel is sellable. Sell mode adds an amber
                  // outline + glow to the player's own aged barrels
                  // and dims everyone else's.
                  const chipClass = [
                    "group relative flex h-[124px] w-[120px] flex-col overflow-hidden rounded-md border-2 text-left transition-all",
                    tierChrome.gradient,
                    tierChrome.glow,
                    tier === "epic" || tier === "legendary" ? tierChrome.shimmer : "",
                    sellTarget
                      ? "border-amber-400 outline outline-2 outline-amber-300/80 outline-offset-1 shadow-[0_0_18px_rgba(245,158,11,.45)] hover:-translate-y-0.5 hover:border-amber-300"
                      : sellMode.active
                        ? `${tierChrome.borderSoft} opacity-60`
                        : `${tierChrome.border} hover:-translate-y-0.5 hover:brightness-110`,
                  ]
                    .filter(Boolean)
                    .join(" ");
                  // Suppress click during make-bourbon mode — that
                  // mode's click target is the rickhouse card itself.
                  const clickable = !makeBourbon.active;
                  const onClick = clickable
                    ? sellTarget
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
                      {/* Owner stripe: logo on the left, age on the right */}
                      <div
                        className={`flex items-center justify-between px-1.5 py-[3px] text-white ${PLAYER_BG_CLASS[seatIdx]}`}
                      >
                        <span
                          className="text-[12px] leading-none"
                          aria-hidden
                          title={ownerPlayer?.name ?? "?"}
                        >
                          {ownerLogo.glyph}
                        </span>
                        <span className="font-mono text-[11px] font-bold leading-none tabular-nums">
                          {b.age}
                          <span className="text-[9px] opacity-80">y</span>
                        </span>
                      </div>
                      {/* Body: bill name + pay scale (current demand cell highlighted) */}
                      <div className="relative flex flex-1 flex-col px-1.5 pb-1 pt-1">
                        <span
                          className={`line-clamp-2 text-center font-display text-[11px] font-semibold leading-tight tracking-[.01em] ${tierChrome.titleInk}`}
                          title={card?.name}
                        >
                          {card?.name ?? b.mashBillId}
                        </span>
                        {/* Pay scale — what this barrel pays at low/mid/high
                            demand for its current age band (or the band it
                            will first hit). The live demand cell ALWAYS glows;
                            aging barrels use a sky tint to mark the value
                            as future-facing, with a "matures in Xy" line in
                            place of the lo/mid/hi labels. */}
                        <div className="mt-auto flex items-stretch gap-[3px]">
                          {payScaleRow.map((printed, bandIdx) => {
                            const isLive = bandIdx === liveDemandBand;
                            const cellPrice =
                              isLive && altPick && ageOk ? liveCellPrice : printed;
                            const liveStyle = !ageOk
                              ? "bg-sky-400 text-slate-950 shadow-[0_0_10px_rgba(56,189,248,.55)]"
                              : altPick
                                ? "bg-amber-300 text-slate-950 shadow-[0_0_10px_rgba(252,211,77,.65)]"
                                : "bg-emerald-400 text-slate-950 shadow-[0_0_10px_rgba(52,211,153,.65)]";
                            const bandLo = card?.demandBands[bandIdx] ?? 0;
                            const bandHi =
                              bandIdx === payScaleRow.length - 1
                                ? "+"
                                : `–${(card?.demandBands[bandIdx + 1] ?? 0) - 1}`;
                            return (
                              <span
                                key={bandIdx}
                                title={`Demand ${bandLo}${bandHi} · $${printed}`}
                                className={[
                                  "flex flex-1 items-center justify-center rounded-[3px] py-[3px] font-mono font-bold leading-none tabular-nums",
                                  isLive
                                    ? `text-[13px] ${liveStyle}`
                                    : "text-[11px] bg-slate-900/70 text-slate-300 ring-1 ring-inset ring-slate-700",
                                ].join(" ")}
                              >
                                ${cellPrice}
                              </span>
                            );
                          })}
                        </div>
                        {ageOk ? null : (
                          <div
                            className="mt-[2px] text-center font-mono text-[9px] uppercase tracking-[.10em] text-sky-300/90"
                            title={`Sellable in ${(card?.ageBands[0] ?? 2) - b.age}y at the live $${liveCellPrice} cell`}
                          >
                            matures in {(card?.ageBands[0] ?? 2) - b.age}y
                          </div>
                        )}
                        {isRare ? (
                          <span
                            className={`pointer-events-none absolute left-1 top-0.5 text-[11px] leading-none ${tierChrome.label}`}
                            aria-hidden
                            title="Rare bill"
                          >
                            ★
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
                      "flex h-[124px] w-[120px] items-center justify-center rounded-md border border-dashed font-mono text-[10px] uppercase tracking-[.12em]",
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
