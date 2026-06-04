"use client";

import { useMemo, useRef, useState } from "react";
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
  GameState,
  Player,
  ResourceCard,
} from "@bourbonomics/prototype-engine";

import ScalingHost from "./components/ScalingHost";
import CardTile from "./components/CardTile";
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

  const [selBill, setSelBill] = useState<string | null>(null);
  const [selResources, setSelResources] = useState<Set<string>>(new Set());
  const [selLine, setSelLine] = useState<string | null>(null);
  // Bumped on each successful resource draw so the hand fan replays its
  // deal-in keyframe (mirrors the live game's lastDrawHand.seq).
  const [dealSeq, setDealSeq] = useState(1);

  const player = state.players[state.currentPlayerIndex]!;
  const ended = state.phase === "ended";

  function newGame() {
    const names = Array.from({ length: numPlayers }, (_, i) => `Player ${i + 1}`);
    setState(createGame({ seed, playerNames: names }));
    setMessage(null);
    setSelBill(null);
    setSelResources(new Set());
    setSelLine(null);
  }

  function dispatch(action: Action) {
    const res = applyAction(stateRef.current, action);
    if (!res.ok) {
      setMessage(res.reason);
      return;
    }
    stateRef.current = res.state;
    setState(res.state);
    setMessage(null);
    setSelResources(new Set());
    if (action.type === "MAKE_BOURBON") setSelBill(null);
    if (action.type === "DRAW_RESOURCES") setDealSeq((n) => n + 1);
  }

  function toggleResource(id: string) {
    setSelResources((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const ranked = useMemo(() => (ended ? rankPlayers(state) : []), [ended, state]);
  const targetLine = selLine ?? player.brandLines[0]?.id ?? null;

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
          <div className="grid h-[176px] shrink-0 grid-cols-[260px_1.4fr_1fr_1fr] gap-4">
            <Panel title="Demand market" accent="market">
              <div className="flex h-full flex-col justify-between">
                <DemandTrack demand={state.demand} />
                <div className="flex gap-2">
                  {state.demandForecast.map((f, i) => (
                    <div
                      key={f.id}
                      className="flex flex-1 flex-col items-center justify-center rounded border border-[var(--rule)] bg-[var(--panel)] px-1 py-1 text-center"
                    >
                      <div className="label-sm" style={{ color: "var(--mute)" }}>
                        {i === 0 ? "Next" : `+${i}`}
                      </div>
                      <div className="mt-0.5 text-[12px] font-semibold text-[var(--amber-2)]">
                        {f.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>

            <MarketShelf
              deckCount={state.resourceDeck.length}
              drawCount={CONFIG.RESOURCE_DRAW_COUNT}
              disabled={ended}
              onDraw={() => dispatch({ type: "DRAW_RESOURCES" })}
            />

            <Panel
              title="Mash bill tray"
              accent="market"
              right={
                <span className="label-sm" style={{ color: "var(--mute)" }}>
                  keep 1 · drains the clock
                </span>
              }
            >
              <div className="flex h-full items-stretch gap-2">
                {state.mashBillTray.map((b, i) => (
                  <MiniCard
                    key={b.id}
                    tone="mashbill"
                    disabled={ended}
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
            {/* col 1: rivals + log */}
            <div className="grid min-h-0 grid-rows-[auto_1fr] gap-4">
              <Panel title="Distillers" accent="rivals" className="max-h-[280px]">
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

            {/* col 2: brand lines */}
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

            {/* col 3: rickhouse + cellar */}
            <div className="grid min-h-0 grid-rows-[auto_1fr] gap-4">
              <Panel
                title={`Rickhouse ${player.rickhouse.length}/${CONFIG.RICKHOUSE_CAPACITY}`}
                accent="stage"
                className="max-h-[300px]"
              >
                {player.rickhouse.length === 0 ? (
                  <Empty>No barrels resting. Make a bourbon.</Empty>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {player.rickhouse.map((b) => (
                      <Barrel
                        key={b.id}
                        bourbon={b}
                        demand={state.demand}
                        canSell={!ended && b.age >= CONFIG.MIN_SELL_AGE}
                        onSell={() =>
                          dispatch({
                            type: "SELL_BOURBON",
                            bourbonId: b.id,
                            ...(targetLine ? { brandLineId: targetLine } : {}),
                          })
                        }
                      />
                    ))}
                  </div>
                )}
              </Panel>

              <Panel title="Your cellar" right={
                <span className="label-sm" style={{ color: "var(--mute)" }}>
                  recipes · slot cards
                </span>
              }>
                <div className="flex h-full flex-col gap-3">
                  <div>
                    <div className="label-sm mb-1.5" style={{ color: "var(--mute)" }}>
                      Mash bills (pick to brew)
                    </div>
                    {player.mashBills.length === 0 ? (
                      <Empty>Keep one from the tray.</Empty>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {player.mashBills.map((b) => (
                          <MiniCard
                            key={b.id}
                            tone="mashbill"
                            title={b.name}
                            sub={recipeLabel(b.recipe)}
                            tags={b.traits}
                            selected={selBill === b.id}
                            onClick={() => setSelBill(b.id)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
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
                            sub={`${c.slotRewards.length} slots`}
                            cost={`${openLineCost(player.brandLines.length)}฿`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Panel>
            </div>
          </div>

          {/* ── Hand strip ───────────────────────────────────── */}
          <div className="grid h-[262px] shrink-0 grid-cols-[1fr_420px] gap-4">
            <Panel
              title={`Hand — ${player.name}`}
              accent="hand"
              right={
                <span className="label-sm" style={{ color: "var(--mute)" }}>
                  click to commit for brewing
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
                      onClick={() => toggleResource(c.id)}
                    />
                  ))}
                </HandFan>
              )}
            </Panel>

            <Panel title="Workbench" accent="hand">
              <div className="flex h-full flex-col justify-between gap-3">
                <ActionBtn
                  onClick={() => dispatch({ type: "DRAW_SLOT_CARD" })}
                  disabled={ended}
                >
                  Draw slot
                </ActionBtn>

                <div className="rounded-md border border-[var(--rule)] bg-[var(--panel)] px-3 py-2 text-[12px] text-[var(--ink-muted)]">
                  {selBill ? (
                    <>
                      Brewing with{" "}
                      <span className="font-semibold text-[var(--gold)]">
                        {player.mashBills.find((b) => b.id === selBill)?.name}
                      </span>{" "}
                      · {selResources.size} resource
                      {selResources.size === 1 ? "" : "s"} committed
                    </>
                  ) : (
                    "Draw resources from the market, pick a mash bill, commit hand cards, then brew."
                  )}
                </div>

                <ActionBtn
                  tone="gold"
                  onClick={() =>
                    selBill &&
                    dispatch({
                      type: "MAKE_BOURBON",
                      mashBillId: selBill,
                      resourceCardIds: [...selResources],
                    })
                  }
                  disabled={ended || !selBill || selResources.size === 0}
                >
                  ⚗ Make bourbon
                </ActionBtn>
              </div>
            </Panel>
          </div>

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
      {/* brand block */}
      <div className="flex items-center gap-3">
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
            Prototype · Round {state.roundNumber}
          </span>
        </div>
      </div>

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
  index,
  isCeiling,
}: {
  slot: Bourbon | null;
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
          <span className="font-mono text-[10px] text-[var(--brass)]">
            age {slot.age}
          </span>
        </>
      ) : (
        <span className="m-auto font-mono text-[10px] text-[var(--whisper)]">
          slot {index + 1}
        </span>
      )}
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
