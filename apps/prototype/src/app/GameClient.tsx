"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  applyAction,
  createGame,
  matrixValue,
  rankPlayers,
  CONFIG,
  openLineCost,
} from "@bourbonomics/prototype-engine";
import type {
  Action,
  Bourbon,
  BrandLine,
  GameState,
  Player,
  ResourceCard,
  ResourceKind,
  RewardLeaf,
  SlotCard,
  SlotSpec,
  Station,
  StationId,
} from "@bourbonomics/prototype-engine";

import ScalingHost from "./components/ScalingHost";
import CardTile from "./components/CardTile";
import { setMakeDragPayload } from "./components/dragMake";
import HandFan from "./components/HandFan";
import MarketShelf from "./components/MarketShelf";
import DemandTrack from "./components/DemandTrack";
import Barrel from "./components/Barrel";
import MiniCard from "./components/MiniCard";

// ── small chrome helpers ─────────────────────────────────────────────

function Panel({
  title,
  accent = "",
  right,
  children,
  className = "",
  bodyClassName = "",
}: {
  title: string;
  accent?: "market" | "stage" | "hand" | "rivals" | "log" | "";
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`bb-panel ${accent ? `bb-panel--${accent}` : ""} flex flex-col overflow-hidden ${className}`}
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--rule)] px-3 py-2">
        <span className="label-sm" style={{ color: "var(--brass)" }}>
          {title}
        </span>
        {right}
      </header>
      <div className={`min-h-0 flex-1 p-3 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13px] italic text-[var(--mute)]">{children}</p>
  );
}

function ActionBtn({
  children,
  onClick,
  disabled,
  active,
  tone = "neutral",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  tone?: "neutral" | "gold";
}) {
  const gold = tone === "gold";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "rounded-md border px-3 py-2 font-mono text-[12px] font-semibold uppercase tracking-[.12em] transition",
        active || gold
          ? "border-[var(--gold)] bg-gradient-to-b from-[#f0c970] to-[#c69d52] text-[#1a120b]"
          : "border-[var(--rule)] bg-[var(--panel-2)] text-[var(--ink-muted)] hover:border-[var(--amber)] hover:text-[var(--ink)]",
        "disabled:cursor-not-allowed disabled:opacity-35",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

const qualityInk: Record<string, string> = {
  common: "text-[var(--t-common)]",
  specialty: "text-[var(--t-specialty)]",
  heritage: "text-[var(--t-heritage)]",
};

function recipeLabel(recipe: Record<string, number | undefined>): string {
  return (
    Object.entries(recipe)
      .filter(([, n]) => n)
      .map(([k, n]) => `${n}${k[0]}`)
      .join(" ") || "—"
  );
}

const QUALITY_RANK: Record<string, number> = { common: 0, specialty: 1, heritage: 2 };

function kindCounts(cards: ResourceCard[]): Record<ResourceKind, number> {
  const c: Record<ResourceKind, number> = { cask: 0, corn: 0, grain: 0 };
  for (const card of cards) c[card.kind] += 1;
  return c;
}

/** Whether the chosen cards satisfy a recipe exactly (no missing, no extras). */
function selectionSatisfies(
  recipe: Partial<Record<ResourceKind, number>>,
  cards: ResourceCard[],
): boolean {
  const have = kindCounts(cards);
  for (const k of ["cask", "corn", "grain"] as ResourceKind[]) {
    if ((recipe[k] ?? 0) !== have[k]) return false;
  }
  return true;
}

/**
 * Mirror of the engine's placement rules so the UI can disable slots a sale
 * would be refused for: empty slot, staircase (non-decreasing by nearest
 * filled neighbors), and the Expressions paired-age match.
 */
function slotEligible(line: BrandLine, i: number, bourbon: Bourbon): boolean {
  if (line.slots[i]) return false;
  const age = bourbon.age;
  for (let l = i - 1; l >= 0; l--) {
    const s = line.slots[l];
    if (s) {
      if (s.age > age) return false;
      break;
    }
  }
  for (let r = i + 1; r < line.slots.length; r++) {
    const s = line.slots[r];
    if (s) {
      if (s.age < age) return false;
      break;
    }
  }
  const spec = line.slotCard.slots[i];
  if (spec?.matchAgeOfSlot !== undefined) {
    const paired = line.slots[spec.matchAgeOfSlot];
    if (!paired || paired.age !== age) return false;
  }
  return true;
}

/** Distinct icon pills for a single reward leaf (capital / prestige / resources). */
function RewardBits({
  leaf,
  age,
  className = "",
}: {
  leaf: RewardLeaf;
  age?: number;
  className?: string;
}) {
  const bits: { key: string; color: string; text: string }[] = [];
  if (leaf.capital) bits.push({ key: "c", color: "var(--gold)", text: `+${leaf.capital}฿` });
  if (leaf.prestige) bits.push({ key: "p", color: "#c4a7e7", text: `+${leaf.prestige}★` });
  if (leaf.prestigeFromAge)
    bits.push({ key: "pa", color: "#c4a7e7", text: age !== undefined ? `+${age}★` : "+age★" });
  if (leaf.resources) bits.push({ key: "r", color: "var(--emerald)", text: `+${leaf.resources}⊞` });
  if (bits.length === 0) bits.push({ key: "n", color: "var(--mute)", text: "—" });
  return (
    <span className={`flex flex-wrap items-center gap-1 ${className}`}>
      {bits.map((b) => (
        <span
          key={b.key}
          className="font-mono text-[10px] font-bold leading-none"
          style={{ color: b.color }}
        >
          {b.text}
        </span>
      ))}
    </span>
  );
}

/** Reward summary for a slot spec — both branches for a choice; gate for gated. */
function SlotReward({ spec, age }: { spec: SlotSpec; age?: number }) {
  const r = spec.reward;
  if (r.kind === "flat") return <RewardBits leaf={r.reward} age={age} />;
  if (r.kind === "choice") {
    return (
      <span className="flex items-center gap-1">
        <RewardBits leaf={r.options[0]!} age={age} />
        <span className="text-[9px] text-[var(--mute)]">/</span>
        <RewardBits leaf={r.options[1] ?? r.options[0]!} age={age} />
      </span>
    );
  }
  // gated: show hit reward + the gate condition.
  const gate: string[] = [];
  if (r.gate.minAge !== undefined) gate.push(`age≥${r.gate.minAge}`);
  if (r.gate.minQuality !== undefined) gate.push(r.gate.minQuality);
  return (
    <span className="flex items-center gap-1">
      <RewardBits leaf={r.hit} age={age} />
      <span className="text-[9px] text-[var(--mute)]">if {gate.join(" ")}</span>
      <span className="text-[9px] text-[var(--mute)]">· else</span>
      <RewardBits leaf={r.miss} age={age} />
    </span>
  );
}

// ── main component ────────────────────────────────────────────────────

export default function GameClient() {
  const [seed, setSeed] = useState(1);
  const [numPlayers, setNumPlayers] = useState(1);
  const [state, setState] = useState<GameState>(() =>
    createGame({ seed: 1, playerNames: ["Player 1"] }),
  );
  const stateRef = useRef(state);
  stateRef.current = state;
  const [message, setMessage] = useState<string | null>(null);

  const [selResources, setSelResources] = useState<Set<string>>(new Set());
  const [selMarket, setSelMarket] = useState<Set<string>>(new Set());
  const [selLine, setSelLine] = useState<string | null>(null);
  // Placement modal: the built barrel being sold + the line to place it into.
  const [sellBarrel, setSellBarrel] = useState<Bourbon | null>(null);
  const [sellLineId, setSellLineId] = useState<string | null>(null);
  // Slot-card draw picker: pick any available design from the supply.
  const [drawingSlot, setDrawingSlot] = useState(false);
  // Bumped on each successful resource draw so the hand fan replays its
  // deal-in keyframe (mirrors the live game's lastDrawHand.seq).
  const [dealSeq, setDealSeq] = useState(1);

  const player = state.players[state.currentPlayerIndex]!;
  const ended = state.phase === "ended";
  const rickhouseStation = player.distillery.stations.find((s) => s.id === "rickhouse");
  const rickhouseCap = rickhouseStation
    ? rickhouseStation.levels[rickhouseStation.builtTier]!
    : 0;
  const rickhouseFull = player.rickhouse.length >= rickhouseCap;

  function newGame() {
    const names = Array.from({ length: numPlayers }, (_, i) => `Player ${i + 1}`);
    setState(createGame({ seed, playerNames: names }));
    setMessage(null);
    setSelResources(new Set());
    setSelMarket(new Set());
    setSelLine(null);
    setSellBarrel(null);
    setSellLineId(null);
    setDrawingSlot(false);
  }

  function dispatch(action: Action): boolean {
    const res = applyAction(stateRef.current, action);
    if (!res.ok) {
      setMessage(res.reason);
      return false;
    }
    stateRef.current = res.state;
    setState(res.state);
    setMessage(null);
    setSelResources(new Set());
    if (action.type === "TAKE_MARKET_RESOURCES") {
      setSelMarket(new Set());
      setDealSeq((n) => n + 1);
    }
    return true;
  }

  function toggleResource(id: string) {
    setSelResources((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleMarket(id: string) {
    const need = Math.min(CONFIG.RESOURCE_DRAW_COUNT, stateRef.current.resourceMarket.length);
    setSelMarket((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < need) next.add(id);
      return next;
    });
  }

  const ranked = useMemo(() => (ended ? rankPlayers(state) : []), [ended, state]);
  const targetLine = selLine ?? player.brandLines[0]?.id ?? null;

  // Cards currently selected in hand → used to build an unbuilt barrel.
  const selectedHandCards = player.hand.filter((c) => selResources.has(c.id));

  function openSell(barrel: Bourbon) {
    // A batch yields multiple sales. Intermediate extractions just bank
    // Capital — no placement — so fire them directly. Only the FINAL sale
    // (one left) mints a bottle and opens the placement modal.
    if (barrel.salesRemaining > 1) {
      dispatch({ type: "EXTRACT", bourbonId: barrel.id });
      return;
    }
    setSellBarrel(barrel);
    setSellLineId(targetLine ?? player.brandLines[0]?.id ?? null);
  }

  function confirmSell(lineId: string, slotIndex: number, rewardChoice?: number) {
    if (!sellBarrel) return;
    const okDone = dispatch({
      type: "EXTRACT",
      bourbonId: sellBarrel.id,
      brandLineId: lineId,
      slotIndex,
      ...(rewardChoice !== undefined ? { rewardChoice } : {}),
    });
    if (okDone) setSellBarrel(null);
  }

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[var(--bg)]">
      <TopBar
        state={state}
        player={player}
        ended={ended}
        seed={seed}
        numPlayers={numPlayers}
        onSeed={setSeed}
        onNumPlayers={(n) => setNumPlayers(Math.max(1, Math.min(4, n)))}
        onNewGame={newGame}
      />

      <ScalingHost>
        <div className="relative flex h-full w-full flex-col gap-4 p-6">
          {/* transient message toast */}
          {message ? (
            <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2">
              <div className="rounded-md border border-[var(--rose)] bg-[#2a1410] px-4 py-2 text-[13px] text-[var(--rose)] shadow-lg">
                {message}
              </div>
            </div>
          ) : null}

          {/* ── Market strip ───────────────────────────────────── */}
          <div className="grid h-[176px] shrink-0 grid-cols-[230px_788px_1fr_1fr] gap-4">
            <Panel title="Demand market" accent="market">
              <div className="flex h-full flex-col justify-between">
                <DemandTrack demand={state.demand} />
                <FloodMeter
                  cubes={state.cubesPlaced}
                  blue={state.blueLine}
                  red={state.redLine}
                />
                <div className="flex flex-wrap gap-1">
                  {state.demandCards.map((c) => {
                    const broad = c.slots.some((sl) => sl.tagRestriction === "open");
                    return (
                      <span
                        key={c.id}
                        className="rounded border border-[var(--rule)] bg-[var(--panel)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[.06em] text-[var(--amber-2)]"
                        title={`${c.label} — blue ${c.blueCapacity} / red ${c.redCapacity}`}
                      >
                        {broad ? "any" : c.tag}
                      </span>
                    );
                  })}
                </div>
              </div>
            </Panel>

            <MarketShelf
              market={state.resourceMarket}
              selected={selMarket}
              takeCount={CONFIG.RESOURCE_DRAW_COUNT}
              deckCount={state.resourceDeck.length}
              disabled={ended}
              onToggle={toggleMarket}
              onTake={() =>
                dispatch({
                  type: "TAKE_MARKET_RESOURCES",
                  cardIds: [...selMarket],
                })
              }
            />

            <Panel
              title="Mash bill tray"
              accent="market"
              right={
                <span className="label-sm" style={{ color: "var(--mute)" }}>
                  keep 1 → rests a barrel
                </span>
              }
            >
              <div className="flex h-full items-stretch gap-2">
                {state.mashBillTray.map((b, i) => (
                  <MiniCard
                    key={b.id}
                    tone="mashbill"
                    disabled={ended || rickhouseFull}
                    onClick={() => dispatch({ type: "DRAW_MASH_BILLS", keepIndex: i })}
                    title={b.name}
                    sub={recipeLabel(b.recipe)}
                    tags={b.traits}
                  />
                ))}
              </div>
            </Panel>

            <Panel
              title="Marketing tray"
              accent="market"
              right={
                <span className="label-sm" style={{ color: "var(--mute)" }}>
                  attach to target line
                </span>
              }
            >
              <div className="flex h-full items-stretch gap-2">
                {state.marketingTray.map((m, i) => (
                  <MiniCard
                    key={m.id}
                    tone="marketing"
                    disabled={ended || !targetLine}
                    onClick={() =>
                      targetLine &&
                      dispatch({
                        type: "DRAW_MARKETING",
                        keepIndex: i,
                        brandLineId: targetLine,
                      })
                    }
                    title={m.name}
                    sub={`+${m.prestigeOnMatch}★ · ${m.exclusiveGroup}`}
                    tags={m.requiredTraits.length ? m.requiredTraits : ["any"]}
                  />
                ))}
              </div>
            </Panel>
          </div>

          {/* ── Main area ─────────────────────────────────────── */}
          <div className="grid min-h-0 flex-1 grid-cols-[360px_860px_1fr] gap-4">
            {/* col 1: rivals + distillery + log */}
            <div className="grid min-h-0 grid-rows-[auto_auto_1fr] gap-4">
              <Panel title="Distillers" accent="rivals" className="max-h-[150px]">
                <div className="flex flex-col gap-2">
                  {state.players.map((p, i) => (
                    <PlayerRow
                      key={p.id}
                      player={p}
                      active={!ended && i === state.currentPlayerIndex}
                    />
                  ))}
                </div>
              </Panel>
              <Panel
                title={player.distillery.name}
                accent="rivals"
                right={
                  <span className="label-sm" style={{ color: "var(--mute)" }}>
                    upgrades
                  </span>
                }
              >
                <DistilleryPanel
                  stations={player.distillery.stations}
                  capital={player.capital}
                  disabled={ended}
                  onBuild={(stationId) => dispatch({ type: "BUILD_UPGRADE", stationId })}
                />
              </Panel>
              <Panel
                title="Tasting notes"
                accent="log"
                right={
                  <span className="flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className="h-1.5 w-1.5 rounded-full"
                      style={{
                        background: "var(--emerald)",
                        boxShadow: "0 0 6px var(--emerald)",
                      }}
                    />
                    <span
                      className="font-mono text-[10px] font-semibold uppercase tracking-[.16em]"
                      style={{ color: "var(--emerald)" }}
                    >
                      Live
                    </span>
                  </span>
                }
              >
                <div className="flex h-full flex-col-reverse gap-1 overflow-hidden text-[12px] text-[var(--ink-muted)]">
                  {[...state.log]
                    .slice(-12)
                    .reverse()
                    .map((l, i) => (
                      <div key={i} className="log-line leading-snug">
                        {l}
                      </div>
                    ))}
                </div>
              </Panel>
            </div>

            {/* col 2: brand lines (top) + rickhouse (below) */}
            <div className="grid min-h-0 grid-rows-[1fr_auto] gap-4">
            <Panel
              title="Brand lines"
              accent="stage"
              right={
                <span className="label-sm" style={{ color: "var(--mute)" }}>
                  age staircase · low → high
                </span>
              }
            >
              {player.brandLines.length === 0 ? (
                <Empty>Open a brand line from a slot card to sell into.</Empty>
              ) : (
                <div className="flex flex-col gap-3">
                  {player.brandLines.map((line) => {
                    const isTarget = targetLine === line.id;
                    return (
                      <button
                        key={line.id}
                        type="button"
                        onClick={() => setSelLine(line.id)}
                        className={[
                          "rounded-lg border p-3 text-left transition",
                          isTarget
                            ? "border-[var(--gold)] bg-[var(--panel-2)]"
                            : "border-[var(--rule)] bg-[var(--panel)] hover:border-[var(--amber)]",
                        ].join(" ")}
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span className="font-display text-[17px] font-semibold text-[var(--ink)]">
                            {line.slotCard.name}
                            {isTarget ? (
                              <span className="ml-2 font-mono text-[10px] uppercase tracking-[.14em] text-[var(--gold)]">
                                ● target
                              </span>
                            ) : null}
                          </span>
                          <span className="label-sm" style={{ color: "var(--mute)" }}>
                            ceiling {line.ageCeiling ?? "—"}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          {(() => {
                            const ceilingIdx = line.slots.reduce(
                              (last, s, i) => (s ? i : last),
                              -1,
                            );
                            return line.slots.map((slot, i) => (
                              <SlotCell
                                key={i}
                                slot={slot}
                                spec={line.slotCard.slots[i]!}
                                index={i}
                                isCeiling={i === ceilingIdx}
                              />
                            ));
                          })()}
                        </div>
                        {line.marketingCards.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {line.marketingCards.map((m) => (
                              <span
                                key={m.id}
                                className="rounded border border-[var(--rule)] bg-[var(--panel-3)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[.08em] text-[var(--amber)]"
                              >
                                {m.name} +{m.prestigeOnMatch}★
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </Panel>

              <Panel
                title={`Rickhouse ${player.rickhouse.length}/${rickhouseCap}`}
                accent="stage"
                className="max-h-[300px]"
              >
                {player.rickhouse.length === 0 ? (
                  <Empty>No barrels resting. Keep a mash bill to rest one.</Empty>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {player.rickhouse.map((b) => (
                      <Barrel
                        key={b.id}
                        bourbon={b}
                        demand={state.demand}
                        canSell={
                          !ended &&
                          b.built &&
                          b.age >= CONFIG.MIN_SELL_AGE &&
                          b.salesRemaining > 0 &&
                          // Intermediate extraction needs no line; only the
                          // final sale (one left) requires somewhere to place.
                          (b.salesRemaining > 1 || player.brandLines.length > 0)
                        }
                        canBuild={
                          !ended &&
                          !b.built &&
                          selectionSatisfies(b.recipe, selectedHandCards)
                        }
                        onSell={() => openSell(b)}
                        onBuild={(cardIds) =>
                          dispatch({
                            type: "MAKE_BOURBON",
                            barrelId: b.id,
                            resourceCardIds: cardIds ?? [...selResources],
                          })
                        }
                      />
                    ))}
                  </div>
                )}
              </Panel>
            </div>

            {/* col 3: cellar */}
            <Panel title="Your cellar" right={
                <span className="label-sm" style={{ color: "var(--mute)" }}>
                  slot cards
                </span>
              }>
                <div className="flex h-full flex-col gap-3">
                  <div>
                    <div className="label-sm mb-1.5" style={{ color: "var(--mute)" }}>
                      Slot cards (open a line)
                    </div>
                    {player.slotCards.length === 0 ? (
                      <Empty>Draw a slot card.</Empty>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {player.slotCards.map((c) => (
                          <MiniCard
                            key={c.id}
                            tone="slot"
                            disabled={ended}
                            onClick={() =>
                              dispatch({ type: "OPEN_BRAND_LINE", slotCardId: c.id })
                            }
                            title={c.name}
                            sub={`${c.slots.length} slots`}
                            cost={`${openLineCost(player.brandLines.length)}฿`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Panel>
          </div>

          {/* ── Hand strip ───────────────────────────────────── */}
          <div className="grid h-[262px] shrink-0 grid-cols-[1fr_420px] gap-4">
            <Panel
              title={`Hand — ${player.name}`}
              accent="hand"
              right={
                <span className="label-sm" style={{ color: "var(--mute)" }}>
                  resources on hand
                </span>
              }
              bodyClassName="!p-0"
            >
              {player.hand.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <Empty>No resources. Draw some from the market.</Empty>
                </div>
              ) : (
                <HandFan dealKey={dealSeq} size="md">
                  {player.hand.map((c) => (
                    <CardTile
                      key={c.id}
                      kind={c.kind}
                      quality={c.quality}
                      name={c.name}
                      size="lg"
                      selected={selResources.has(c.id)}
                      dim={selResources.size > 0 && !selResources.has(c.id)}
                      onClick={() => toggleResource(c.id)}
                      draggable={!ended}
                      onDragStart={(e) => {
                        // Drag the whole selection if this card is part of it,
                        // otherwise drag just this card.
                        const ids =
                          selResources.has(c.id) && selResources.size > 0
                            ? [...selResources]
                            : [c.id];
                        setMakeDragPayload(e, ids);
                      }}
                    />
                  ))}
                </HandFan>
              )}
            </Panel>

            <Panel title="Workbench" accent="hand">
              <div className="flex h-full flex-col justify-between gap-3">
                <ActionBtn
                  onClick={() => setDrawingSlot(true)}
                  disabled={ended || state.slotCardSupply.length === 0}
                >
                  Draw slot
                </ActionBtn>

                <div className="rounded-md border border-[var(--rule)] bg-[var(--panel)] px-3 py-2 text-[12px] text-[var(--ink-muted)]">
                  Keep a mash bill to rest a barrel
                  {rickhouseFull ? " — rickhouse is full." : "."} Select the
                  recipe resources in hand, then <b>Build</b> the barrel to start
                  aging. Open a brand line, then sell aged barrels into a chosen
                  slot.
                </div>
              </div>
            </Panel>
          </div>

          {/* ── Sell placement overlay ──────────────────────── */}
          {sellBarrel && !ended ? (
            <SellModal
              barrel={sellBarrel}
              lines={player.brandLines}
              lineId={sellLineId}
              demand={state.demand}
              onLine={setSellLineId}
              onConfirm={confirmSell}
              onCancel={() => setSellBarrel(null)}
            />
          ) : null}

          {/* ── Slot-card draw picker ────────────────────────── */}
          {drawingSlot && !ended ? (
            <SlotDrawModal
              supply={state.slotCardSupply}
              onPick={(slotDefId) => {
                if (dispatch({ type: "DRAW_SLOT_CARD", slotDefId })) {
                  setDrawingSlot(false);
                }
              }}
              onCancel={() => setDrawingSlot(false)}
            />
          ) : null}

          {/* ── Final standings overlay ─────────────────────── */}
          {ended ? (
            <div className="absolute inset-0 z-30 grid place-items-center bg-[#0c0805]/80 backdrop-blur-sm">
              <div className="bb-panel bb-panel--stage w-[560px] p-6">
                <h2 className="font-display text-[28px] font-bold text-[var(--gold)]">
                  Final standings
                </h2>
                <ol className="mt-4 space-y-2">
                  {ranked.map((r, i) => (
                    <li
                      key={r.playerId}
                      className="flex items-center justify-between rounded-md border border-[var(--rule)] bg-[var(--panel)] px-3 py-2"
                    >
                      <span className="font-display text-[18px] font-semibold text-[var(--ink)]">
                        {i + 1}. {r.name}
                      </span>
                      <span className="text-[14px] text-[var(--ink-muted)]">
                        <span className="font-bold text-[var(--gold)]">{r.total}</span>{" "}
                        pts · {r.capital}฿ + {r.prestigeAsCapital} rep · {r.bourbonsSold}{" "}
                        sold
                      </span>
                    </li>
                  ))}
                </ol>
                <button
                  type="button"
                  onClick={newGame}
                  className="mt-5 w-full rounded-md border border-[var(--gold)] bg-gradient-to-b from-[#f0c970] to-[#c69d52] py-2.5 font-mono text-[13px] font-bold uppercase tracking-[.14em] text-[#1a120b]"
                >
                  New game
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </ScalingHost>
    </div>
  );
}

// ── Top bar (native, outside ScalingHost) ────────────────────────────

function TopBar({
  state,
  player,
  ended,
  seed,
  numPlayers,
  onSeed,
  onNumPlayers,
  onNewGame,
}: {
  state: GameState;
  player: Player;
  ended: boolean;
  seed: number;
  numPlayers: number;
  onSeed: (n: number) => void;
  onNumPlayers: (n: number) => void;
  onNewGame: () => void;
}) {
  return (
    <header
      className="relative z-10 grid shrink-0 items-center gap-3 overflow-hidden border-b border-[#3b2818] px-[14px] py-[10px]"
      style={{
        gridTemplateColumns: "auto 1fr auto",
        background: "linear-gradient(180deg, #15100a 0%, #0c0805 100%)",
        boxShadow: "0 1px 0 rgba(240,201,112,.10) inset, 0 4px 14px rgba(0,0,0,.5)",
      }}
    >
      {/* brand block — links back to the menu */}
      <Link href="/" className="flex items-center gap-3" title="Back to menu">
        <div
          aria-hidden
          className="grid h-[38px] w-[38px] place-items-center rounded-md font-display font-bold leading-none"
          style={{
            fontSize: 22,
            background:
              "radial-gradient(circle at 35% 30%, #f0c970, #b06a38 70%, #2a1a10)",
            color: "#1a120b",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,.25), 0 2px 6px rgba(0,0,0,.6)",
          }}
        >
          B
        </div>
        <div className="flex flex-col leading-tight">
          <span
            className="font-display font-semibold tracking-[.01em] text-[#f0e3c8]"
            style={{ fontSize: 22 }}
          >
            Bourbonomics
          </span>
          <span className="label-sm" style={{ color: "var(--brass)", fontSize: 9.5 }}>
            ← Menu · Round {state.roundNumber}
          </span>
        </div>
      </Link>

      {/* center: stat chips */}
      <div className="flex min-w-0 items-center justify-center gap-2">
        <StatChip label="Turn" value={ended ? "—" : player.name} />
        <DemandMeter demand={state.demand} />
        <StatChip
          label="Actions"
          value={ended ? "—" : String(player.actionsRemaining)}
        />
      </div>

      {/* right: clock + dev controls */}
      <div className="flex items-center gap-2">
        <BillsChip
          remaining={state.mashBillSupply.length}
          final={state.finalRound != null}
        />
        <div className="flex items-center gap-1.5">
          <label
            className="label-sm"
            style={{ color: "var(--mute)", fontSize: 9.5 }}
          >
            seed
          </label>
          <input
            type="number"
            value={seed}
            onChange={(e) => onSeed(Number(e.target.value))}
            className="w-16 rounded border border-[var(--rule)] bg-[var(--panel-2)] px-2 py-1 text-[12px] text-[var(--ink)]"
          />
          <label
            className="label-sm"
            style={{ color: "var(--mute)", fontSize: 9.5 }}
          >
            players
          </label>
          <input
            type="number"
            min={1}
            max={4}
            value={numPlayers}
            onChange={(e) => onNumPlayers(Number(e.target.value))}
            className="w-12 rounded border border-[var(--rule)] bg-[var(--panel-2)] px-2 py-1 text-[12px] text-[var(--ink)]"
          />
          <button
            type="button"
            onClick={onNewGame}
            className="rounded-[7px] border border-[var(--gold)] bg-gradient-to-b from-[#f0c970] to-[#c69d52] px-3 py-1.5 font-mono font-semibold uppercase tracking-[.16em] text-[#1a120b]"
            style={{ fontSize: 10.5 }}
          >
            New game
          </button>
        </div>
      </div>
    </header>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex items-center gap-2 rounded-md border border-[var(--rule)] px-3 py-1.5"
      style={{
        background: "linear-gradient(180deg, rgba(34,23,16,.9), rgba(22,15,10,.9))",
      }}
    >
      <span className="label-sm" style={{ color: "var(--mute)", fontSize: 9.5 }}>
        {label}
      </span>
      <span
        className="font-display font-bold leading-none text-[var(--ink)]"
        style={{ fontSize: 18 }}
      >
        {value}
      </span>
    </div>
  );
}

function DemandMeter({ demand }: { demand: number }) {
  const pct = Math.round((demand / CONFIG.DEMAND_CAP) * 100);
  return (
    <div
      title={`Demand ${demand} / ${CONFIG.DEMAND_CAP}`}
      data-bb-zone="demand"
      className="flex items-center gap-2 rounded-md border border-[var(--copper)] px-3 py-1.5"
      style={{
        background: "linear-gradient(180deg, rgba(176,106,56,.16), rgba(120,40,32,.10))",
      }}
    >
      <span className="label-sm" style={{ color: "var(--amber-2)", fontSize: 9.5 }}>
        Demand
      </span>
      <div className="h-2 w-24 overflow-hidden rounded-full bg-[#1a0f06]">
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, #b06a38, #f0c970)",
          }}
        />
      </div>
      <span
        className="font-display font-bold leading-none text-[var(--gold)]"
        style={{ fontSize: 18 }}
      >
        {demand}
      </span>
    </div>
  );
}

function BillsChip({ remaining, final }: { remaining: number; final: boolean }) {
  return (
    <div
      title="Mash bill supply remaining (the clock)"
      className={[
        "flex items-center gap-2 rounded-md border px-3 py-1.5",
        final ? "border-[var(--gold)]" : "border-[var(--brass)]",
      ].join(" ")}
      style={{
        background: "linear-gradient(180deg, rgba(240,201,112,.15), rgba(176,106,56,.08))",
        boxShadow: "inset 0 1px 0 rgba(240,201,112,.35)",
      }}
    >
      <span className="label-sm" style={{ color: "var(--gold)", fontSize: 9.5 }}>
        Bills
      </span>
      <span
        className="font-display font-bold leading-none text-[var(--gold)]"
        style={{ fontSize: 22 }}
      >
        {remaining}
      </span>
      {final ? (
        <span
          className="rounded bg-amber-500 px-1 py-px font-mono font-bold uppercase tracking-[.10em] text-slate-950"
          style={{ fontSize: 11 }}
        >
          final
        </span>
      ) : null}
    </div>
  );
}

// ── tiles ─────────────────────────────────────────────────────────────

function SlotCell({
  slot,
  spec,
  index,
  isCeiling,
}: {
  slot: Bourbon | null;
  spec: SlotSpec;
  index: number;
  isCeiling: boolean;
}) {
  return (
    <div
      className="flex h-[76px] w-[92px] flex-col justify-between rounded-md border p-1.5"
      style={
        slot
          ? {
              borderColor: isCeiling ? "var(--gold)" : "rgba(198,157,82,.6)",
              background: "linear-gradient(180deg, rgba(58,40,24,.7), rgba(26,18,11,.9))",
              boxShadow: isCeiling ? "0 0 0 1px rgba(240,201,112,.4)" : "none",
            }
          : {
              borderColor: "rgba(198,157,82,.25)",
              borderStyle: "dashed",
              background: "linear-gradient(180deg, rgba(28,18,11,.7), rgba(16,11,7,.9))",
            }
      }
    >
      {slot ? (
        <>
          <div className="flex items-start gap-1">
            <span
              className="mt-0.5 h-2 w-2 shrink-0 rounded-full"
              style={{
                background: `var(--t-${slot.quality})`,
                boxShadow: `0 0 5px var(--t-${slot.quality})`,
              }}
            />
            <span
              className={`line-clamp-2 text-[11px] font-semibold leading-tight ${qualityInk[slot.quality]}`}
            >
              {slot.name}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-[var(--brass)]">age {slot.age}</span>
            <SlotReward spec={spec} age={slot.age} />
          </div>
        </>
      ) : (
        <>
          <span className="font-mono text-[10px] text-[var(--whisper)]">
            slot {index + 1}
            {spec.optional ? " · opt" : ""}
          </span>
          <SlotReward spec={spec} />
        </>
      )}
    </div>
  );
}

// ── Sell placement modal ─────────────────────────────────────────────

/**
 * The player's distillery board: each upgrade station as a row with tier pips,
 * its current effect, and a build button (cost on the cover). Building advances
 * the tier — the rickhouse station is the rickhouse capacity, replacing the old
 * hard cap of 4.
 */
function DistilleryPanel({
  stations,
  capital,
  disabled,
  onBuild,
}: {
  stations: Station[];
  capital: number;
  disabled: boolean;
  onBuild: (stationId: StationId) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {stations.map((st) => {
        const maxed = st.builtTier >= st.maxTier;
        const cost = st.costs[st.builtTier + 1] ?? 0;
        const affordable = !maxed && capital >= cost;
        return (
          <div
            key={st.id}
            className="flex items-center justify-between gap-2 rounded border border-[var(--rule)] bg-[var(--panel)] px-2 py-1.5"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink)]">{st.name}</span>
                <span className="flex gap-0.5">
                  {Array.from({ length: st.maxTier }, (_, t) => (
                    <span
                      key={t}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{
                        background: t < st.builtTier ? "var(--gold)" : "var(--whisper)",
                        boxShadow: t < st.builtTier ? "0 0 4px var(--gold)" : "none",
                      }}
                    />
                  ))}
                </span>
              </div>
              <div className="truncate font-mono text-[9px] text-[var(--mute)]">
                {st.blurb} · now {st.levels[st.builtTier]}
              </div>
            </div>
            <button
              type="button"
              disabled={disabled || maxed || !affordable}
              onClick={() => onBuild(st.id)}
              className="shrink-0 rounded border border-[var(--rule)] bg-[var(--panel-2)] px-2 py-1 font-mono text-[10px] uppercase tracking-[.06em] text-[var(--ink-muted)] transition enabled:hover:border-[var(--gold)] enabled:hover:text-[var(--gold)] disabled:opacity-40"
            >
              {maxed ? "max" : `▲ ${cost}฿`}
            </button>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Live flood meter: cubes sold this round vs the round's blue/red lines. The
 * fill runs toward the red line (the cliff); the green tick marks the blue
 * line (below it demand is underserved and rises next round). Color tracks the
 * band so the brewing flood reads at a glance.
 */
function FloodMeter({ cubes, blue, red }: { cubes: number; blue: number; red: number }) {
  const pct = red > 0 ? Math.min(1, cubes / red) : 0;
  const bluePct = red > 0 ? Math.min(1, blue / red) : 0;
  const band = cubes >= red ? "cliff" : cubes >= blue ? "flooding" : "healthy";
  const color =
    band === "cliff" ? "var(--rose)" : band === "flooding" ? "var(--gold)" : "var(--emerald)";
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="label-sm" style={{ color: "var(--mute)" }}>
          Market flood
        </span>
        <span className="font-mono text-[10px]" style={{ color }}>
          {cubes}/{red}
          {band === "cliff" ? " · CLIFF" : band === "flooding" ? " · flooding" : ""}
        </span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full border border-[var(--rule)] bg-[#160d06]">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct * 100}%`, background: color, transition: "width 300ms ease" }}
        />
        <span
          className="absolute top-0 h-full w-px bg-[var(--emerald)]"
          style={{ left: `${bluePct * 100}%` }}
          title={`blue line ${blue}`}
        />
      </div>
    </div>
  );
}

function SellModal({
  barrel,
  lines,
  lineId,
  demand,
  onLine,
  onConfirm,
  onCancel,
}: {
  barrel: Bourbon;
  lines: BrandLine[];
  lineId: string | null;
  demand: number;
  onLine: (id: string) => void;
  onConfirm: (lineId: string, slotIndex: number, rewardChoice?: number) => void;
  onCancel: () => void;
}) {
  const line = lines.find((l) => l.id === lineId) ?? lines[0];
  const value = matrixValue(barrel.matrix, barrel.age, demand);

  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-[#0c0805]/80 backdrop-blur-sm">
      <div className="bb-panel bb-panel--stage w-[920px] p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-[22px] font-bold text-[var(--gold)]">
            Place {barrel.name}
          </h2>
          <span className="font-mono text-[12px] text-[var(--ink-muted)]">
            age {barrel.age} · {barrel.quality} · sells for{" "}
            <span className="font-bold text-[var(--gold)]">{value}฿</span>
          </span>
        </div>

        {/* line tabs (only when more than one) */}
        {lines.length > 1 ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {lines.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => onLine(l.id)}
                className={[
                  "rounded-md border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[.1em] transition",
                  l.id === line?.id
                    ? "border-[var(--gold)] bg-[var(--panel-2)] text-[var(--gold)]"
                    : "border-[var(--rule)] bg-[var(--panel)] text-[var(--ink-muted)] hover:border-[var(--amber)]",
                ].join(" ")}
              >
                {l.slotCard.name}
              </button>
            ))}
          </div>
        ) : null}

        {!line ? (
          <p className="text-[13px] italic text-[var(--mute)]">
            Open a brand line first.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {line.slots.map((slot, i) => {
              const spec = line.slotCard.slots[i]!;
              const eligible = !slot && slotEligible(line, i, barrel);
              const filled = !!slot;
              const isChoice = spec.reward.kind === "choice";
              return (
                <div
                  key={i}
                  className="flex w-[130px] flex-col gap-1 rounded-md border p-2"
                  style={{
                    borderColor: filled
                      ? "rgba(198,157,82,.5)"
                      : eligible
                        ? "var(--gold)"
                        : "rgba(198,157,82,.2)",
                    background: eligible
                      ? "linear-gradient(180deg, rgba(58,40,24,.7), rgba(26,18,11,.9))"
                      : "linear-gradient(180deg, rgba(20,13,8,.7), rgba(14,9,6,.9))",
                    opacity: filled || !eligible ? 0.55 : 1,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-[.08em] text-[var(--whisper)]">
                      slot {i + 1}
                      {spec.optional ? " · opt" : ""}
                    </span>
                  </div>

                  {filled ? (
                    <span className="font-mono text-[10px] text-[var(--mute)]">
                      filled · age {slot!.age}
                    </span>
                  ) : isChoice && eligible ? (
                    <div className="flex flex-col gap-1">
                      {spec.reward.kind === "choice"
                        ? spec.reward.options.map((opt, j) => (
                            <button
                              key={j}
                              type="button"
                              onClick={() => onConfirm(line.id, i, j)}
                              className="flex items-center justify-center gap-1 rounded border border-[var(--rule)] bg-[var(--panel)] py-1 transition hover:border-[var(--gold)]"
                            >
                              <RewardBits leaf={opt} age={barrel.age} />
                            </button>
                          ))
                        : null}
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={!eligible}
                      onClick={() => onConfirm(line.id, i)}
                      className="flex items-center justify-center rounded border border-[var(--rule)] bg-[var(--panel)] py-1.5 transition enabled:hover:border-[var(--gold)] disabled:cursor-not-allowed"
                    >
                      <SlotReward spec={spec} age={barrel.age} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={onCancel}
          className="mt-5 rounded-md border border-[var(--rule)] bg-[var(--panel)] px-4 py-2 font-mono text-[12px] uppercase tracking-[.12em] text-[var(--ink-muted)] hover:border-[var(--amber)] hover:text-[var(--ink)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Slot-card draw picker ─────────────────────────────────────────────

/**
 * Pick any available slot-card design from the supply. Shows every distinct
 * design still in `slotCardSupply` (deduped, with copies-left), each with a
 * compact preview of its slots and rewards. Selecting one draws that design
 * into the player's cellar via DRAW_SLOT_CARD { slotDefId }.
 */
function SlotDrawModal({
  supply,
  onPick,
  onCancel,
}: {
  supply: SlotCard[];
  onPick: (defId: string) => void;
  onCancel: () => void;
}) {
  // Dedupe designs by defId (first occurrence wins), counting copies left.
  const designs: { card: SlotCard; count: number }[] = [];
  const seen = new Map<string, number>();
  for (const c of supply) {
    const at = seen.get(c.defId);
    if (at === undefined) {
      seen.set(c.defId, designs.length);
      designs.push({ card: c, count: 1 });
    } else {
      designs[at]!.count += 1;
    }
  }

  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-[#0c0805]/80 backdrop-blur-sm">
      <div className="bb-panel bb-panel--stage w-[960px] p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-[22px] font-bold text-[var(--gold)]">
            Draw a slot card
          </h2>
          <span className="font-mono text-[12px] text-[var(--ink-muted)]">
            pick any available design
          </span>
        </div>

        {designs.length === 0 ? (
          <p className="text-[13px] italic text-[var(--mute)]">
            The slot-card supply is empty.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {designs.map(({ card, count }) => (
              <button
                key={card.defId}
                type="button"
                onClick={() => onPick(card.defId)}
                className="rounded-lg border border-[var(--rule)] bg-[var(--panel)] p-3 text-left transition hover:border-[var(--gold)]"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-display text-[16px] font-semibold text-[var(--ink)]">
                    {card.name}
                  </span>
                  <span className="font-mono text-[10px] text-[var(--mute)]">
                    {card.slots.length} slots
                    {card.houseStyleBonus !== undefined
                      ? ` · house-style +${card.houseStyleBonus}★`
                      : ""}{" "}
                    · {count} left
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {card.slots.map((s, i) => (
                    <div
                      key={i}
                      className="flex min-w-[96px] flex-col gap-1 rounded-md border border-[var(--rule)] bg-[var(--panel-2)] px-2 py-1.5"
                    >
                      <span className="font-mono text-[10px] text-[var(--whisper)]">
                        slot {i + 1}
                        {s.optional ? " · opt" : ""}
                        {s.matchAgeOfSlot !== undefined
                          ? ` · =s${s.matchAgeOfSlot + 1}`
                          : ""}
                      </span>
                      <SlotReward spec={s} />
                    </div>
                  ))}
                </div>
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={onCancel}
          className="mt-5 rounded-md border border-[var(--rule)] bg-[var(--panel)] px-4 py-2 font-mono text-[12px] uppercase tracking-[.12em] text-[var(--ink-muted)] hover:border-[var(--amber)] hover:text-[var(--ink)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function PlayerRow({ player, active }: { player: Player; active: boolean }) {
  return (
    <div
      className={[
        "rounded-md border px-3 py-2",
        active
          ? "border-[var(--gold)] bg-[var(--panel-2)]"
          : "border-[var(--rule)] bg-[var(--panel)]",
      ].join(" ")}
    >
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-semibold text-[var(--ink)]">
          {player.name}
        </span>
        {active ? (
          <span className="font-mono text-[10px] uppercase tracking-[.14em] text-[var(--gold)]">
            active
          </span>
        ) : null}
      </div>
      <div className="mt-0.5 font-mono text-[11px] text-[var(--mute)]">
        {player.capital}฿ · {player.prestige}★ · {player.rickhouse.length} resting ·{" "}
        {player.brandLines.length} lines · {player.bourbonsSold} sold
      </div>
    </div>
  );
}
