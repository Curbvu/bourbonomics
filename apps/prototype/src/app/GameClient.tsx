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

// ── tiny presentational helpers ──────────────────────────────────────

function Panel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-lg border border-[var(--rule)] bg-[var(--panel)] p-3 ${className}`}
    >
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Btn({
  children,
  onClick,
  disabled,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md border px-2.5 py-1.5 text-sm transition ${
        active
          ? "border-[var(--gold)] bg-[var(--panel-2)] text-[var(--gold)]"
          : "border-[var(--rule)] bg-[var(--panel-2)] text-[var(--ink)] hover:border-[var(--amber)]"
      } disabled:cursor-not-allowed disabled:opacity-35`}
    >
      {children}
    </button>
  );
}

const qualityColor: Record<string, string> = {
  common: "text-[var(--ink-muted)]",
  specialty: "text-[var(--amber)]",
  heritage: "text-[var(--gold)]",
};

// ── main component ────────────────────────────────────────────────────

export default function GameClient() {
  const [seed, setSeed] = useState(1);
  const [numPlayers, setNumPlayers] = useState(1);
  const [state, setState] = useState<GameState>(() =>
    createGame({ seed: 1, playerNames: ["Player 1"] }),
  );
  // Always dispatch against the freshest state, even for clicks that fire
  // within a single render tick (avoids a stale-closure double-action bug).
  const stateRef = useRef(state);
  stateRef.current = state;
  const [message, setMessage] = useState<string | null>(null);

  // make-bourbon selection state
  const [selBill, setSelBill] = useState<string | null>(null);
  const [selResources, setSelResources] = useState<Set<string>>(new Set());
  // marketing / sell target line
  const [selLine, setSelLine] = useState<string | null>(null);

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
      setMessage(`✗ ${res.reason}`);
      return;
    }
    stateRef.current = res.state; // keep synchronous dispatches consistent
    setState(res.state);
    setMessage(null);
    // clear transient selections that may now be stale
    setSelResources(new Set());
    if (action.type === "MAKE_BOURBON") setSelBill(null);
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
    <main className="mx-auto max-w-[1400px] p-4">
      {/* header / new game */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold text-[var(--gold)]">
          Bourbonomics — Prototype
        </h1>
        <span className="rounded bg-[var(--panel-2)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[var(--amber)]">
          Batch 1 · PLACEHOLDER content
        </span>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <label className="text-[var(--ink-muted)]">seed</label>
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value))}
            className="w-20 rounded border border-[var(--rule)] bg-[var(--panel-2)] px-2 py-1"
          />
          <label className="text-[var(--ink-muted)]">players</label>
          <input
            type="number"
            min={1}
            max={4}
            value={numPlayers}
            onChange={(e) =>
              setNumPlayers(Math.max(1, Math.min(4, Number(e.target.value))))
            }
            className="w-16 rounded border border-[var(--rule)] bg-[var(--panel-2)] px-2 py-1"
          />
          <Btn onClick={newGame}>New game</Btn>
        </div>
      </div>

      {/* status bar */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Round" value={String(state.roundNumber)} />
        <Stat
          label="Demand"
          value={`${state.demand} / ${CONFIG.DEMAND_CAP}`}
        />
        <Stat
          label="Turn"
          value={ended ? "—" : player.name}
        />
        <Stat
          label="Actions left"
          value={ended ? "—" : String(player.actionsRemaining)}
        />
        <Stat
          label="Bills left"
          value={String(state.mashBillSupply.length)}
        />
      </div>

      {message && (
        <div className="mb-3 rounded-md border border-[var(--rose,#d96b54)] bg-[var(--panel-2)] px-3 py-2 text-sm text-[var(--amber)]">
          {message}
        </div>
      )}

      {ended && (
        <Panel title="Final standings" className="mb-4">
          <ol className="space-y-1 text-sm">
            {ranked.map((r, i) => (
              <li key={r.playerId} className="flex justify-between">
                <span>
                  {i + 1}. {r.name}
                </span>
                <span className="text-[var(--gold)]">
                  {r.total} pts ({r.capital} cap + {r.prestigeAsCapital} prestige,{" "}
                  {r.bourbonsSold} sold)
                </span>
              </li>
            ))}
          </ol>
        </Panel>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        {/* left column: the active player */}
        <div className="space-y-4">
          {/* shared market */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Panel title="Demand forecast (next rounds)">
              <div className="flex gap-2">
                {state.demandForecast.map((f, i) => (
                  <div
                    key={f.id}
                    className="flex-1 rounded border border-[var(--rule)] bg-[var(--panel-2)] p-2 text-center text-xs"
                  >
                    <div className="text-[10px] text-[var(--ink-muted)]">
                      {i === 0 ? "next" : `+${i}`}
                    </div>
                    {f.label}
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="Mash bill tray (keep 1 · drains supply)">
              <div className="flex flex-wrap gap-2">
                {state.mashBillTray.map((b, i) => (
                  <button
                    key={b.id}
                    disabled={ended}
                    onClick={() => dispatch({ type: "DRAW_MASH_BILLS", keepIndex: i })}
                    className="rounded border border-[var(--rule)] bg-[var(--panel-2)] px-2 py-1 text-left text-xs hover:border-[var(--amber)] disabled:opacity-40"
                  >
                    <div className="font-medium">{b.name}</div>
                    <div className="text-[10px] text-[var(--ink-muted)]">
                      {recipeLabel(b.recipe)} · {b.traits.join(", ")}
                    </div>
                  </button>
                ))}
              </div>
            </Panel>
          </div>

          {/* actions */}
          <Panel title="Actions">
            <div className="flex flex-wrap gap-2">
              <Btn
                onClick={() => dispatch({ type: "DRAW_RESOURCES" })}
                disabled={ended}
              >
                Draw resources (+{CONFIG.RESOURCE_DRAW_COUNT})
              </Btn>
              <Btn
                onClick={() => dispatch({ type: "DRAW_SLOT_CARD" })}
                disabled={ended}
              >
                Draw slot card
              </Btn>
              <Btn
                onClick={() =>
                  selBill &&
                  dispatch({
                    type: "MAKE_BOURBON",
                    mashBillId: selBill,
                    resourceCardIds: [...selResources],
                  })
                }
                disabled={ended || !selBill || selResources.size === 0}
                active={!!selBill && selResources.size > 0}
              >
                Make bourbon
                {selBill ? ` (${selResources.size} committed)` : ""}
              </Btn>
            </div>
            <p className="mt-2 text-[11px] text-[var(--ink-muted)]">
              To make a bourbon: pick one of your mash bills, then click the hand
              cards to commit, then “Make bourbon”.
            </p>
          </Panel>

          {/* hand */}
          <Panel title={`Hand — ${player.name} (resources)`}>
            {player.hand.length === 0 ? (
              <Empty>No resources. Draw some.</Empty>
            ) : (
              <div className="flex flex-wrap gap-2">
                {player.hand.map((c) => (
                  <ResourceChip
                    key={c.id}
                    card={c}
                    selected={selResources.has(c.id)}
                    onClick={() => toggleResource(c.id)}
                  />
                ))}
              </div>
            )}
          </Panel>

          {/* mash bills + slot cards held */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Panel title="Your mash bills (recipes)">
              {player.mashBills.length === 0 ? (
                <Empty>Keep one from the tray.</Empty>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {player.mashBills.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setSelBill(b.id)}
                      className={`rounded border px-2 py-1 text-left text-xs ${
                        selBill === b.id
                          ? "border-[var(--gold)] text-[var(--gold)]"
                          : "border-[var(--rule)] hover:border-[var(--amber)]"
                      } bg-[var(--panel-2)]`}
                    >
                      <div className="font-medium">{b.name}</div>
                      <div className="text-[10px] text-[var(--ink-muted)]">
                        {recipeLabel(b.recipe)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Panel>
            <Panel title="Your slot cards (open a line)">
              {player.slotCards.length === 0 ? (
                <Empty>Draw a slot card.</Empty>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {player.slotCards.map((c) => (
                    <button
                      key={c.id}
                      disabled={ended}
                      onClick={() =>
                        dispatch({ type: "OPEN_BRAND_LINE", slotCardId: c.id })
                      }
                      className="rounded border border-[var(--rule)] bg-[var(--panel-2)] px-2 py-1 text-left text-xs hover:border-[var(--amber)] disabled:opacity-40"
                    >
                      <div className="font-medium">{c.name}</div>
                      <div className="text-[10px] text-[var(--ink-muted)]">
                        {c.slotRewards.length} slots · open for{" "}
                        {openLineCost(player.brandLines.length)} cap
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          {/* rickhouse */}
          <Panel
            title={`Rickhouse (${player.rickhouse.length}/${CONFIG.RICKHOUSE_CAPACITY})`}
          >
            {player.rickhouse.length === 0 ? (
              <Empty>No barrels resting.</Empty>
            ) : (
              <div className="flex flex-wrap gap-2">
                {player.rickhouse.map((b) => (
                  <BarrelChip
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

          {/* brand lines */}
          <Panel title="Brand lines (portfolios)">
            {player.brandLines.length === 0 ? (
              <Empty>Open a brand line to sell into.</Empty>
            ) : (
              <div className="space-y-3">
                {player.brandLines.map((line) => (
                  <div
                    key={line.id}
                    className={`rounded border p-2 ${
                      targetLine === line.id
                        ? "border-[var(--gold)]"
                        : "border-[var(--rule)]"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <button
                        onClick={() => setSelLine(line.id)}
                        className="text-sm font-medium hover:text-[var(--gold)]"
                      >
                        {line.slotCard.name}
                        {targetLine === line.id && (
                          <span className="ml-2 text-[10px] text-[var(--gold)]">
                            ● sell target
                          </span>
                        )}
                      </button>
                      <span className="text-[10px] text-[var(--ink-muted)]">
                        ceiling: {line.ageCeiling ?? "—"}
                      </span>
                    </div>
                    <div className="flex gap-1.5">
                      {line.slots.map((slot, i) => (
                        <div
                          key={i}
                          className="flex h-16 w-20 flex-col justify-between rounded border border-[var(--rule)] bg-[var(--panel-2)] p-1 text-[10px]"
                        >
                          {slot ? (
                            <>
                              <span className={qualityColor[slot.quality]}>
                                {slot.name}
                              </span>
                              <span className="text-[var(--ink-muted)]">
                                age {slot.age}
                              </span>
                            </>
                          ) : (
                            <span className="m-auto text-[var(--ink-muted)]">
                              slot {i + 1}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                    {line.marketingCards.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {line.marketingCards.map((m) => (
                          <span
                            key={m.id}
                            className="rounded bg-[var(--panel)] px-1.5 py-0.5 text-[10px] text-[var(--amber)]"
                          >
                            {m.name} (+{m.prestigeOnMatch}★)
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* marketing tray */}
          <Panel title="Marketing tray (attach to sell-target line)">
            <p className="mb-2 text-[11px] text-[var(--ink-muted)]">
              First attach is free; each later attach costs{" "}
              {CONFIG.MARKETING_DRAW_COST} capital. Trait-gated; one per exclusive
              group; max {CONFIG.MARKETING_STACK_CAP} per line.
            </p>
            <div className="flex flex-wrap gap-2">
              {state.marketingTray.map((m, i) => (
                <button
                  key={m.id}
                  disabled={ended || !targetLine}
                  onClick={() =>
                    targetLine &&
                    dispatch({
                      type: "DRAW_MARKETING",
                      keepIndex: i,
                      brandLineId: targetLine,
                    })
                  }
                  className="rounded border border-[var(--rule)] bg-[var(--panel-2)] px-2 py-1 text-left text-xs hover:border-[var(--amber)] disabled:opacity-40"
                >
                  <div className="font-medium">{m.name}</div>
                  <div className="text-[10px] text-[var(--ink-muted)]">
                    needs {m.requiredTraits.join("+") || "—"} · +
                    {m.prestigeOnMatch}★ · [{m.exclusiveGroup}]
                  </div>
                </button>
              ))}
            </div>
          </Panel>
        </div>

        {/* right column: players summary + log */}
        <div className="space-y-4">
          <Panel title="Players">
            <div className="space-y-2">
              {state.players.map((p, i) => (
                <PlayerRow
                  key={p.id}
                  player={p}
                  active={!ended && i === state.currentPlayerIndex}
                />
              ))}
            </div>
          </Panel>
          <Panel title="Log">
            <div className="max-h-[420px] space-y-1 overflow-y-auto text-[11px] text-[var(--ink-muted)]">
              {[...state.log].reverse().map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </main>
  );
}

// ── sub-components ────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--rule)] bg-[var(--panel)] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-[var(--ink-muted)]">
        {label}
      </div>
      <div className="text-base font-semibold text-[var(--ink)]">{value}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs italic text-[var(--ink-muted)]">{children}</p>;
}

function ResourceChip({
  card,
  selected,
  onClick,
}: {
  card: ResourceCard;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded border px-2 py-1 text-xs ${
        selected
          ? "border-[var(--gold)] text-[var(--gold)]"
          : "border-[var(--rule)] hover:border-[var(--amber)]"
      } bg-[var(--panel-2)]`}
    >
      <span className={qualityColor[card.quality]}>{card.name}</span>
      <span className="ml-1 text-[10px] text-[var(--ink-muted)]">
        {card.kind}/{card.quality[0]}
      </span>
    </button>
  );
}

function BarrelChip({
  bourbon,
  demand,
  canSell,
  onSell,
}: {
  bourbon: Bourbon;
  demand: number;
  canSell: boolean;
  onSell: () => void;
}) {
  const preview = matrixValue(bourbon.matrix, bourbon.age, demand);
  return (
    <div className="w-28 rounded border border-[var(--rule)] bg-[var(--panel-2)] p-2 text-xs">
      <div className={`font-medium ${qualityColor[bourbon.quality]}`}>
        {bourbon.name}
      </div>
      <div className="text-[10px] text-[var(--ink-muted)]">
        age {bourbon.age} · sells ~{preview}
      </div>
      <button
        onClick={onSell}
        disabled={!canSell}
        className="mt-1.5 w-full rounded border border-[var(--rule)] bg-[var(--panel)] px-1 py-0.5 text-[10px] hover:border-[var(--amber)] disabled:opacity-40"
      >
        {canSell ? "Sell →" : `aging (${bourbon.age}/${CONFIG.MIN_SELL_AGE})`}
      </button>
    </div>
  );
}

function PlayerRow({ player, active }: { player: Player; active: boolean }) {
  return (
    <div
      className={`rounded border px-2 py-1.5 text-xs ${
        active ? "border-[var(--gold)]" : "border-[var(--rule)]"
      } bg-[var(--panel-2)]`}
    >
      <div className="flex justify-between">
        <span className="font-medium">{player.name}</span>
        {active && <span className="text-[10px] text-[var(--gold)]">active</span>}
      </div>
      <div className="text-[10px] text-[var(--ink-muted)]">
        {player.capital} cap · {player.prestige}★ · {player.rickhouse.length} resting ·{" "}
        {player.brandLines.length} lines · {player.bourbonsSold} sold
      </div>
    </div>
  );
}

function recipeLabel(recipe: Record<string, number | undefined>): string {
  return (
    Object.entries(recipe)
      .filter(([, n]) => n)
      .map(([k, n]) => `${n}${k[0]}`)
      .join(" ") || "—"
  );
}
